import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

type Tone = "warm" | "direct" | "consultative" | "executive";

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

const toneInstructions: Record<Tone, string> = {
  warm: [
    "Write like a thoughtful person who has an existing professional relationship with the recipient.",
    "Use a natural, friendly opening and a little conversational warmth, without sounding overly familiar.",
    "Make the recipient feel respected and unpressured. Use a gentle, easy-to-answer invitation.",
    "Avoid corporate jargon, forced enthusiasm, exclamation marks, and fake familiarity."
  ].join(" "),
  direct: [
    "Be crisp, confident and economical. Get to the reason for writing in the first sentence.",
    "Use short sentences and concrete language. State the relevant next step plainly.",
    "End with one specific, low-friction question or proposed action.",
    "No pleasantries, throat-clearing, hedging, long context recap, or aggressive urgency."
  ].join(" "),
  consultative: [
    "Sound like a commercially sharp advisor who understands the buyer's decision, not a seller chasing a reply.",
    "Connect the known business need or deal context to one useful consideration, question or decision point.",
    "Show thoughtful understanding without pretending to know the buyer's internal priorities.",
    "Invite a collaborative discussion to resolve the next decision. Avoid generic check-ins and sales clichés."
  ].join(" "),
  executive: [
    "Write for a time-poor senior decision-maker. Lead with the business outcome, decision or unresolved point.",
    "Be composed, concise and commercially mature. Use precise language and no filler.",
    "Make the requested action and its business relevance immediately clear.",
    "Avoid casual language, excessive courtesy, jargon, marketing claims and long explanations."
  ].join(" ")
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

    const payload = await request.json() as {
      dealId?: string;
      followUpId?: string | null;
      tone?: string;
      goal?: string;
      buyerContext?: string;
    };
    if (!payload.dealId || typeof payload.dealId !== "string") return jsonError("A valid deal is required.", 400);

    const tone: Tone = ["warm", "direct", "consultative", "executive"].includes(payload.tone || "")
      ? payload.tone as Tone
      : "consultative";
    const goal = typeof payload.goal === "string" ? payload.goal.trim().slice(0, 500) : "";
    const buyerContext = typeof payload.buyerContext === "string"
      ? payload.buyerContext.trim().slice(0, 2500)
      : "";

    const { data: deal, error: dealError } = await supabase
      .from("deals")
      .select("id, owner_id, company, service, contact_name, contact_email, amount, stage, health, next_step, follow_up_at, notes")
      .eq("id", payload.dealId)
      .single();

    if (dealError || !deal) return jsonError("That opportunity could not be found in your workspace.", 404);

    const typedDeal = deal as DealContext;
    if (buyerContext && buyerContext !== (typedDeal.notes || "")) {
      const { error: contextSaveError } = await supabase
        .from("deals")
        .update({ notes: buyerContext, updated_at: new Date().toISOString() })
        .eq("id", typedDeal.id);
      if (contextSaveError) return jsonError("Could not save the buyer context. Please try again.", 500);
      typedDeal.notes = buyerContext;
    }
    const [{ data: activities }, { data: previousDrafts }] = await Promise.all([
      supabase.from("deal_activities").select("activity_type, body, created_at")
        .eq("deal_id", typedDeal.id).order("created_at", { ascending: false }).limit(12),
      supabase.from("follow_ups").select("subject, body, status, tone, created_at")
        .eq("deal_id", typedDeal.id).order("created_at", { ascending: false }).limit(4)
    ]);

    const internalActivityTypes = new Set([
      "opportunity_created",
      "stage_changed",
      "follow_up_draft_created",
      "follow_up_draft_updated",
      "follow_up_draft_regenerated"
    ]);
    const usefulActivity = (activities || [])
      .filter((item: { activity_type: string; body: string }) => !internalActivityTypes.has(item.activity_type))
      .slice(0, 5)
      .map((item: { activity_type: string; body: string; created_at: string }) => ({
        type: item.activity_type,
        detail: item.body,
        at: item.created_at
      }));

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
      buyerContext: buyerContext || typedDeal.notes || "",
      selectedTone: tone,
      toneInstructions: toneInstructions[tone],
      objective: goal || "Move the conversation to one clear, low-friction next step",
      recentClientActivity: usefulActivity,
      previousFollowUps: (previousDrafts || []).map((item: { subject: string; body: string; status: string; tone: string }) => ({
        subject: item.subject,
        body: item.body.slice(0, 500),
        status: item.status,
        tone: item.tone
      }))
    };

    const aiResponse = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${gatewayToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-6.1-sol",
        temperature: 0.7,
        max_completion_tokens: 850,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: [
              "You write high-quality, human B2B sales emails for an experienced account executive. Your job is to move this exact buyer conversation forward, not to produce a generic CRM follow-up.",
              "FIRST understand the moment: identify the buyer, what they are evaluating, the current stage, the next agreed action, the real blocker (only if stated), and what would make replying easy. Use the strongest available facts from the buyer context and notes. Never invent a relationship, meeting, conversation, objection, deadline, budget, decision process, product capability or promised action.",
              "PERSONALIZATION: Refer naturally to one meaningful specific from the supplied buyer context, company, service or agreed next step. Do not awkwardly repeat the company name or list deal metadata. Do not mention deal value unless commercially necessary and explicitly relevant.",
              "STAGE: Discovery = help clarify the problem or agree the next discovery conversation. Proposal = help evaluate fit, scope, outcomes or an open question in the proposal. Negotiation = address the actual unresolved commercial or decision point without creating pressure. Other stages = follow the supplied next step.",
              "TONE MUST CHANGE THE STRUCTURE, NOT JUST THE ADJECTIVES. Selected tone: " + tone.toUpperCase() + ". Follow the matching blueprint below:",
              "WARM: Open with a natural, personable reference to the actual conversation or context. Use relaxed, considerate language. Make the reply feel easy and pressure-free. CTA is a gentle invitation or offer to help.",
              "DIRECT: Lead immediately with the exact reason for writing. Keep it to 2–4 short sentences. State the decision or action plainly. CTA is one clear, specific question. No warm-up paragraph.",
              "CONSULTATIVE: Lead with a useful observation, trade-off or decision point grounded in buyer context. Frame the email around helping the buyer make a sound decision. CTA invites their perspective or proposes a collaborative working session. Do not lecture or assume their priorities.",
              "EXECUTIVE: Lead with business impact or the decision that needs to be made. Use concise, polished language for a senior stakeholder. Include only essential context and one crisp recommendation or decision request. No casual filler.",
              "Make the four tones visibly different in opening, sentence length, framing and CTA. If regenerating from a previous draft, rewrite it from scratch in the selected voice. Do not preserve the previous draft's structure just because the deal facts are unchanged.",
              "QUALITY BAR: Subject line 3–7 words and specific. Email body 55–100 words, excluding greeting/sign-off. Two or three short paragraphs. One clear CTA. Use natural spoken business English, varied sentence rhythm and concrete nouns/verbs. Prefer a useful observation over 'checking in'.",
              "BANNED PHRASES: 'I hope this email finds you well', 'Hope you're doing well', 'Just checking in', 'I wanted to follow up', 'circling back', 'touching base', 'kindly do the needful', 'synergies', 'game changer', 'at your earliest convenience'. Avoid generic 'let me know your thoughts' unless made specific.",
              "TRUTH AND RESTRAINT: Never claim an email, proposal or attachment was sent unless context says so. Never fabricate a buyer quote, pain point, metric, outcome, urgency or commitment. If context is thin, write a shorter, candid email and ask one relevant question instead of making assumptions.",
              "Return only valid JSON with exactly two string fields: subject and body. The body must include a natural greeting using the buyer's first name where available and a simple sign-off. Do not include markdown fences."
            ].join(" "),
          {
            role: "user",
            content: "Write a fresh follow-up email for this opportunity. Selected tone: " + tone.toUpperCase() + ". Apply the tone instructions as behavior, not just a label. Deal context:\n" + JSON.stringify(context)
          }
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

    let generated: { subject?: string; body?: string };
    try {
      generated = JSON.parse(content) as { subject?: string; body?: string };
    } catch {
      return jsonError("The AI service returned an unreadable draft. Please try again.", 502);
    }

    const subject = typeof generated.subject === "string" ? generated.subject.trim().slice(0, 180) : "";
    const body = typeof generated.body === "string" ? generated.body.trim().slice(0, 6000) : "";
    if (!subject || !body) return jsonError("The AI service did not return a complete email draft.", 502);

    const draftValues = {
      tone,
      generation_goal: goal,
      subject,
      body,
      status: "draft" as const,
      due_at: typedDeal.follow_up_at,
      updated_at: new Date().toISOString()
    };

    let saved: Record<string, unknown> | null = null;
    let saveError: { message: string } | null = null;

    if (payload.followUpId) {
      const result = await supabase.from("follow_ups")
        .update(draftValues)
        .eq("id", payload.followUpId)
        .eq("deal_id", typedDeal.id)
        .eq("status", "draft")
        .select("id, deal_id, subject, body, status, tone, generation_goal, due_at, created_at")
        .single();
      saved = result.data as Record<string, unknown> | null;
      saveError = result.error;
    } else {
      const result = await supabase.from("follow_ups").insert({
        owner_id: userData.user.id,
        deal_id: typedDeal.id,
        channel: "email",
        ...draftValues
      }).select("id, deal_id, subject, body, status, tone, generation_goal, due_at, created_at").single();
      saved = result.data as Record<string, unknown> | null;
      saveError = result.error;
    }

    if (saveError || !saved) {
      console.error("Could not persist follow-up draft:", saveError?.message);
      return jsonError("The email was generated, but DealPilot could not save it. Please try once more.", 500);
    }

    await supabase.from("deal_activities").insert({
      owner_id: userData.user.id,
      deal_id: typedDeal.id,
      activity_type: payload.followUpId ? "follow_up_draft_regenerated" : "follow_up_draft_created",
      body: "AI drafted a " + tone + " email follow-up: " + subject
    });

    return NextResponse.json({ followUp: saved, model: "openai/gpt-6.1-sol" });
  } catch (error) {
    console.error("Follow-up generation error:", error);
    return jsonError("Something went wrong while preparing this follow-up.", 500);
  }
}
