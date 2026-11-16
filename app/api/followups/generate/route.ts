import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

type DealContext = {
  id: string;
  owner_id: string;
  company: string;
  service: string;
  contact_name: string | null;
  contact_email: string | null;
  amount: number | string;
  stage: string;
  health: string;
  next_step: string | null;
  follow_up_at: string | null;
  notes: string | null;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization");
    const accessToken = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
    if (!accessToken) return jsonError("Please sign in again before generating a draft.", 401);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!supabaseUrl || !publishableKey) return jsonError("The database connection is not configured.", 500);

    const supabase = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
    if (userError || !userData.user) return jsonError("Your session has expired. Please sign in again.", 401);

    const payload = await request.json() as { dealId?: string; tone?: string; goal?: string };
    if (!payload.dealId || typeof payload.dealId !== "string") return jsonError("A valid deal is required.", 400);

    const tone = ["warm", "direct", "consultative", "executive"].includes(payload.tone || "")
      ? payload.tone!
      : "consultative";
    const goal = typeof payload.goal === "string" ? payload.goal.trim().slice(0, 500) : "";

    const { data: deal, error: dealError } = await supabase
      .from("deals")
      .select("id, owner_id, company, service, contact_name, contact_email, amount, stage, health, next_step, follow_up_at, notes")
      .eq("id", payload.dealId)
      .single();

    if (dealError || !deal) return jsonError("That opportunity could not be found in your workspace.", 404);

    const typedDeal = deal as DealContext;
    const [{ data: activities }, { data: previousDrafts }] = await Promise.all([
      supabase.from("deal_activities").select("activity_type, body, created_at")
        .eq("deal_id", typedDeal.id).order("created_at", { ascending: false }).limit(8),
      supabase.from("follow_ups").select("subject, body, status, created_at")
        .eq("deal_id", typedDeal.id).order("created_at", { ascending: false }).limit(3)
    ]);

    const gatewayToken = request.headers.get("x-vercel-oidc-token")
      || process.env.VERCEL_OIDC_TOKEN
      || process.env.AI_GATEWAY_API_KEY;
    if (!gatewayToken) {
      return jsonError("AI drafting is not enabled on this deployment yet. Vercel AI Gateway credentials are missing.", 503);
    }

    const context = {
      company: typedDeal.company,
      service: typedDeal.service,
      contact: typedDeal.contact_name || "there",
      contactEmail: typedDeal.contact_email || "not provided",
      dealValue: Number(typedDeal.amount),
      stage: typedDeal.stage,
      health: typedDeal.health,
      nextStep: typedDeal.next_step || "Not specified",
      followUpDate: typedDeal.follow_up_at,
      notes: typedDeal.notes || "",
      tone,
      objective: goal || "Move the conversation to a clear, low-friction next step",
      recentActivity: (activities || []).map((item: { activity_type: string; body: string; created_at: string }) => ({
        type: item.activity_type, detail: item.body, at: item.created_at
      })),
      previousFollowUps: (previousDrafts || []).map((item: { subject: string; body: string; status: string }) => ({
        subject: item.subject, body: item.body.slice(0, 700), status: item.status
      }))
    };

    const aiResponse = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${gatewayToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-4.1-mini",
        temperature: 0.65,
        max_tokens: 700,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "You are DealPilot, a thoughtful B2B sales follow-up copilot for agencies and consultancies. Create a concise, specific email that sounds like a capable human seller, not generic marketing copy. Use only facts in the supplied deal context. Never invent a meeting, promise, proposal attachment, customer outcome, pricing detail, or prior conversation. Avoid pressure and false urgency. Acknowledge the deal stage and next step. Keep the email 70–140 words. Return only valid JSON with exactly two string fields: subject and body. The body must include a sensible greeting and sign-off."
          },
          { role: "user", content: "Draft a follow-up from this deal context:\n" + JSON.stringify(context) }
        ]
      }),
      cache: "no-store"
    });

    if (!aiResponse.ok) {
      const detail = await aiResponse.text();
      console.error("AI Gateway request failed:", aiResponse.status, detail.slice(0, 500));
      if (aiResponse.status === 401 || aiResponse.status === 403) return jsonError("AI Gateway authentication is not enabled for this deployment. Check Vercel OIDC / AI Gateway access.", 503);
      if (aiResponse.status === 402) return jsonError("AI Gateway needs billing or credits configured before it can generate drafts.", 503);
      return jsonError("The AI service could not generate a draft right now. Please try again.", 502);
    }

    const completion = await aiResponse.json() as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const content = completion.choices?.[0]?.message?.content;
    if (!content) return jsonError("The AI service returned an empty draft. Please try again.", 502);

    let draft: { subject?: string; body?: string };
    try {
      draft = JSON.parse(content) as { subject?: string; body?: string };
    } catch {
      return jsonError("The AI service returned an unreadable draft. Please try again.", 502);
    }

    const subject = typeof draft.subject === "string" ? draft.subject.trim().slice(0, 180) : "";
    const body = typeof draft.body === "string" ? draft.body.trim().slice(0, 6000) : "";
    if (!subject || !body) return jsonError("The AI service did not return a complete email draft.", 502);

    const { data: saved, error: saveError } = await supabase.from("follow_ups").insert({
      owner_id: userData.user.id,
      deal_id: typedDeal.id,
      channel: "email",
      subject,
      body,
      status: "draft",
      due_at: typedDeal.follow_up_at
    }).select("id, deal_id, subject, body, status, due_at, created_at").single();

    if (saveError || !saved) {
      console.error("Could not persist follow-up draft:", saveError?.message);
      return jsonError("The email was generated, but DealPilot could not save it. Please try once more.", 500);
    }

    await supabase.from("deal_activities").insert({
      owner_id: userData.user.id,
      deal_id: typedDeal.id,
      activity_type: "follow_up_draft_created",
      body: "AI drafted an email follow-up: " + subject
    });

    return NextResponse.json({ followUp: saved, model: "openai/gpt-4.1-mini" });
  } catch (error) {
    console.error("Follow-up generation error:", error);
    return jsonError("Something went wrong while preparing this follow-up.", 500);
  }
}
