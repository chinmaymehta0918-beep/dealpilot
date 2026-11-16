"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowRight, ArrowUpRight, Bell, BriefcaseBusiness, CalendarClock,
  CalendarDays, Check, CircleAlert, Clock3, Copy, DollarSign, LayoutDashboard,
  LogOut, Mail, Plus, Search, Sparkles, Target, TrendingUp, X
} from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { Session } from "@supabase/supabase-js";

type Stage = "Discovery" | "Proposal" | "Negotiation" | "Won" | "Lost";
type Health = "On track" | "Needs attention" | "At risk";
const APP_URL = "https://dealpilot-chinu0918.vercel.app";

type DealRow = {
  id: string;
  company: string;
  service: string;
  contact_name: string | null;
  contact_email: string | null;
  amount: number | string;
  stage: Stage;
  health: Health;
  next_step: string | null;
  follow_up_at: string | null;
  updated_at: string;
};

type Deal = {
  id: string;
  company: string;
  initials: string;
  color: string;
  service: string;
  contact: string;
  email: string;
  amount: number;
  stage: Stage;
  health: Health;
  nextStep: string;
  followUp: string;
  updated: string;
};

const stages: Stage[] = ["Discovery", "Proposal", "Negotiation", "Won", "Lost"];
const palette = ["#e8f1e9", "#edf0fb", "#f8eee5", "#f5eefa", "#eaf2f6"];

function dateAfter(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function fromDatabase(row: DealRow, index: number): Deal {
  const company = row.company || "New opportunity";
  return {
    id: row.id,
    company,
    initials: company.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase(),
    color: palette[index % palette.length],
    service: row.service || "Service",
    contact: row.contact_name || "New contact",
    email: row.contact_email || "",
    amount: Number(row.amount) || 0,
    stage: row.stage,
    health: row.health,
    nextStep: row.next_step || "Plan next step",
    followUp: row.follow_up_at ? new Date(row.follow_up_at).toISOString().slice(0, 10) : dateAfter(0),
    updated: "Recently updated"
  };
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function isOpen(deal: Deal) {
  return deal.stage !== "Won" && deal.stage !== "Lost";
}

function stageClass(stage: Stage) {
  return "status-pill status-" + stage.toLowerCase();
}

function dueLabel(value: string) {
  const today = new Date();
  const date = new Date(value + "T12:00:00");
  const days = Math.round((date.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86400000);
  if (days < 0) return Math.abs(days) + "d overdue";
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return "In " + days + " days";
}

function draftFor(deal: Deal) {
  const firstName = deal.contact.split(" ")[0] || "there";
  return "Hi " + firstName + ",\n\nI wanted to follow up on the " + deal.service.toLowerCase() + " proposal we shared. I know priorities can shift, so I wanted to see whether you had a chance to review it and whether any questions have come up.\n\nWould a quick conversation this week be useful to align on next steps?\n\nBest,\nYour name";
}

export default function Home() {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [deals, setDeals] = useState<Deal[]>([]);
  const [activeView, setActiveView] = useState<"Overview" | "Deals" | "Follow-ups">("Overview");
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [draft, setDraft] = useState("");
  const [toast, setToast] = useState("");
  const [formBusy, setFormBusy] = useState(false);
  const [form, setForm] = useState({
    company: "", service: "", contact: "", email: "", amount: "",
    stage: "Discovery" as Stage, followUp: dateAfter(2), nextStep: "Send an introduction"
  });

  function notify(message: string) {
    setToast(message);
  }

  useEffect(() => {
    let alive = true;

    const loadDeals = async () => {
      setDataLoading(true);
      const { data, error } = await supabase
        .from("deals")
        .select("id, company, service, contact_name, contact_email, amount, stage, health, next_step, follow_up_at, updated_at")
        .order("updated_at", { ascending: false });

      if (!alive) return;
      if (error) {
        setToast("Could not load opportunities: " + error.message);
      } else {
        setDeals((data ?? []).map((row: DealRow, index: number) => fromDatabase(row, index)));
      }
      setDataLoading(false);
    };

    supabase.auth.getSession().then((result: { data: { session: Session | null }; error: { message: string } | null }) => {
      const { data, error } = result;
      if (!alive) return;
      if (error) setAuthMessage(error.message);
      const currentUser = data.session?.user;
      setUser(currentUser ? { id: currentUser.id, email: currentUser.email } : null);
      setAuthLoading(false);
      if (currentUser) void loadDeals();
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string, session: Session | null) => {
      if (event === "PASSWORD_RECOVERY") setIsPasswordRecovery(true);
      if (!alive) return;
      const currentUser = session?.user;
      setUser(currentUser ? { id: currentUser.id, email: currentUser.email } : null);
      if (currentUser) {
        window.setTimeout(() => { if (alive) void loadDeals(); }, 0);
      } else {
        setDeals([]);
        setDataLoading(false);
      }
      setAuthLoading(false);
    });

    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const openDeals = useMemo(() => deals.filter(isOpen), [deals]);
  const pipeline = useMemo(() => openDeals.reduce((sum, deal) => sum + deal.amount, 0), [openDeals]);
  const dueDeals = useMemo(() => openDeals.filter((deal) => deal.followUp <= new Date().toISOString().slice(0, 10)), [openDeals]);
  const riskDeals = useMemo(() => openDeals.filter((deal) => deal.health !== "On track"), [openDeals]);

  const visibleDeals = useMemo(() => {
    let rows = [...deals];
    if (activeView === "Deals") rows = rows.filter(isOpen);
    if (activeView === "Follow-ups") rows = rows.filter((deal) => isOpen(deal) && deal.followUp <= new Date().toISOString().slice(0, 10));
    if (search.trim()) {
      const query = search.toLowerCase();
      rows = rows.filter((deal) => [deal.company, deal.service, deal.contact, deal.stage].join(" ").toLowerCase().includes(query));
    }
    return rows;
  }, [deals, activeView, search]);

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthBusy(true);
    setAuthMessage("");
    const email = authEmail.trim().toLowerCase();

    try {
      if (authMode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: APP_URL });
        setAuthMessage(error
          ? error.message
          : "Password reset email requested. Check your inbox and spam folder. The reset link will return you to DealPilot.");
      } else if (authMode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password: authPassword,
          options: { emailRedirectTo: APP_URL }
        });
        if (error) {
          setAuthMessage(error.message);
        } else if (!data.session) {
          setAuthMode("signin");
          setAuthMessage("If this is a new account, check your inbox for the confirmation link. If you have registered before, sign in or use Forgot password.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password: authPassword });
        if (error) {
          setAuthMessage(error.message === "Invalid login credentials"
            ? "Email or password is incorrect. Check your details, or use Forgot password to set a new password."
            : error.message);
        }
      }
    } catch {
      setAuthMessage("We couldn't reach the authentication service. Please try again.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function saveNewPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newPassword.length < 8) {
      setAuthMessage("Use at least 8 characters for your new password.");
      return;
    }
    setAuthBusy(true);
    setAuthMessage("");
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setAuthBusy(false);
    if (error) {
      setAuthMessage(error.message);
    } else {
      setIsPasswordRecovery(false);
      setNewPassword("");
      setAuthMessage("");
      notify("Your password has been updated.");
    }
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) notify("Could not sign out: " + error.message);
    else notify("You have signed out.");
  }

  async function addDeal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    const amount = Number(form.amount);
    if (!form.company.trim() || !form.service.trim() || !Number.isFinite(amount) || amount <= 0) {
      notify("Add a company, service and valid deal value.");
      return;
    }

    setFormBusy(true);
    const { data, error } = await supabase.from("deals").insert({
      owner_id: user.id,
      company: form.company.trim(),
      service: form.service.trim(),
      contact_name: form.contact.trim() || null,
      contact_email: form.email.trim() || null,
      amount,
      stage: form.stage,
      health: "On track",
      next_step: form.nextStep.trim() || "Plan next follow-up",
      follow_up_at: form.followUp ? new Date(form.followUp + "T12:00:00.000Z").toISOString() : null
    }).select("id, company, service, contact_name, contact_email, amount, stage, health, next_step, follow_up_at, updated_at").single();

    setFormBusy(false);
    if (error) {
      notify("Could not save opportunity: " + error.message);
      return;
    }

    setDeals((current) => [fromDatabase(data as DealRow, current.length), ...current]);
    setForm({ company: "", service: "", contact: "", email: "", amount: "", stage: "Discovery", followUp: dateAfter(2), nextStep: "Send an introduction" });
    setShowAdd(false);
    setActiveView("Deals");
    notify("Opportunity saved to your DealPilot workspace.");
  }

  async function updateStage(deal: Deal, stage: Stage) {
    const { error } = await supabase.from("deals").update({ stage }).eq("id", deal.id);
    if (error) {
      notify("Could not update deal: " + error.message);
      return;
    }
    setDeals((current) => current.map((item) => item.id === deal.id ? { ...item, stage } : item));
    notify(deal.company + " moved to " + stage + ".");
  }

  async function copyDraft() {
    try {
      await navigator.clipboard.writeText(draft);
      notify("Follow-up copied to clipboard.");
    } catch {
      notify("Clipboard access was blocked by your browser.");
    }
  }

  if (authLoading) {
    return <main className="auth-shell"><div className="auth-card"><div className="brand-mark"><Target size={20} /></div><p className="auth-muted">Preparing your workspace…</p></div></main>;
  }

  if (isPasswordRecovery) {
    return <main className="auth-shell"><div className="auth-card">
      <div className="auth-brand"><div className="brand-mark"><Target size={20} /></div><div><div className="brand-name">dealpilot</div><div className="auth-brand-caption">Sales follow-through</div></div></div>
      <div className="auth-eyebrow">Account security</div><h1 className="auth-title">Choose a new password.</h1>
      <p className="auth-description">Use at least 8 characters. This will replace your current password.</p>
      <form className="auth-form" onSubmit={saveNewPassword}>
        <label className="field"><span>New password</span><input type="password" minLength={8} required autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label>
        {authMessage && <div className="auth-message" role="status">{authMessage}</div>}
        <button type="submit" className="button-primary auth-submit" disabled={authBusy}>{authBusy ? "Saving…" : "Update password"} <ArrowRight size={14} /></button>
      </form>
    </div></main>;
  }

  if (!user) {
    return (
      <main className="auth-shell">
        <div className="auth-card">
          <div className="auth-brand"><div className="brand-mark"><Target size={20} /></div><div><div className="brand-name">dealpilot</div><div className="auth-brand-caption">Sales follow-through</div></div></div>
          <div className="auth-eyebrow">A calmer way to close</div>
          <h1 className="auth-title">{authMode === "signin" ? "Welcome back." : authMode === "signup" ? "Create your workspace." : "Reset your password."}</h1>
          <p className="auth-description">Keep proposals, next steps and important client conversations moving.</p>
          <form className="auth-form" onSubmit={submitAuth}>
            <label className="field"><span>Email address</span><input type="email" required autoComplete="email" placeholder="you@company.com" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} /></label>
            {authMode !== "forgot" && <label className="field"><span>Password</span><input type="password" minLength={8} required autoComplete={authMode === "signin" ? "current-password" : "new-password"} placeholder="At least 8 characters" value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} /></label>}
            {authMessage && <div className="auth-message" role="status">{authMessage}</div>}
            <button type="submit" className="button-primary auth-submit" disabled={authBusy}>{authBusy ? "Please wait…" : authMode === "signin" ? "Sign in to DealPilot" : authMode === "signup" ? "Create account" : "Send reset link"} <ArrowRight size={14} /></button>
          </form>
          <div className="auth-switch">{authMode === "signin" ? <>New to DealPilot? <button onClick={() => { setAuthMode("signup"); setAuthMessage(""); }}>Create an account</button></> : authMode === "signup" ? <>Already have an account? <button onClick={() => { setAuthMode("signin"); setAuthMessage(""); }}>Sign in</button></> : <>Remembered your password? <button onClick={() => { setAuthMode("signin"); setAuthMessage(""); }}>Sign in</button></>}</div>{authMode === "signin" && <button className="auth-forgot" type="button" onClick={() => { setAuthMode("forgot"); setAuthMessage(""); }}>Forgot password?</button>}
          <div className="auth-footnote">Your deal records are private to your account. Access is enforced by Supabase row-level security.</div>
        </div>
      </main>
    );
  }

  const pageTitle = activeView === "Overview"
    ? "Good morning, " + (user.email?.split("@")[0] || "there")
    : activeView === "Deals" ? "Your deals" : "Follow-up queue";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><Target size={19} strokeWidth={2.6} /></div><div><div className="brand-name">dealpilot</div><div className="brand-caption">Sales follow-through</div></div></div>
        <div className="sidebar-label">Workspace</div>
        <nav className="nav-list" aria-label="Main navigation">
          <button className={"nav-item" + (activeView === "Overview" ? " active" : "")} onClick={() => setActiveView("Overview")}><LayoutDashboard size={17} /><span>Overview</span></button>
          <button className={"nav-item" + (activeView === "Deals" ? " active" : "")} onClick={() => setActiveView("Deals")}><BriefcaseBusiness size={17} /><span>Deals</span></button>
          <button className={"nav-item" + (activeView === "Follow-ups" ? " active" : "")} onClick={() => setActiveView("Follow-ups")}><Mail size={17} /><span>Follow-ups</span>{dueDeals.length > 0 && <small className="nav-count">{dueDeals.length}</small>}</button>
        </nav>
        <div className="sidebar-bottom">
          <div className="plan-card"><div className="plan-title">A little more clarity, every day.</div><div className="plan-copy">DealPilot keeps your next steps visible, so good conversations keep moving.</div><div className="plan-link">Your workspace is connected <Check size={12} /></div></div>
          <div className="profile-row"><div className="avatar">{(user.email || "U").slice(0, 1).toUpperCase()}</div><div style={{ flex: 1, minWidth: 0 }}><div className="profile-name">{user.email || "Workspace owner"}</div><div className="profile-role">Signed-in workspace</div></div></div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><span>/</span><strong>{activeView}</strong></div>
          <div className="topbar-actions">
            <label className="search-box"><Search size={15} /><input aria-label="Search deals" placeholder="Search companies, deals..." value={search} onChange={(event) => setSearch(event.target.value)} /></label>
            <button className="icon-button" aria-label="Follow-up notifications" onClick={() => notify(dueDeals.length + " follow-ups are due or overdue.")}><Bell size={16} /><i className="notification-dot" /></button>
            <button className="button-secondary signout-button" onClick={signOut}><LogOut size={13} /> Sign out</button>
          </div>
        </header>

        <div className="content">
          <div className="page-heading">
            <div><div className="eyebrow">{new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date())} · Your workspace</div><h1 className="page-title">{pageTitle} {activeView === "Overview" ? "👋" : ""}</h1><div className="page-subtitle">A clear view of what needs your attention and where revenue is moving.</div></div>
            <button className="button-primary" onClick={() => setShowAdd(true)}><Plus size={15} /> Add opportunity</button>
          </div>

          <section className="stat-grid" aria-label="Pipeline metrics">
            <div className="stat-card"><div className="stat-top"><span>Open pipeline</span><span className="stat-icon"><DollarSign size={15} /></span></div><div className="stat-value">{money(pipeline)}</div><div className="stat-foot"><span className="stat-positive"><TrendingUp size={11} style={{ display: "inline", verticalAlign: "-2px" }} /> Live total</span><span>· {openDeals.length} open deals</span></div></div>
            <div className="stat-card"><div className="stat-top"><span>Open opportunities</span><span className="stat-icon"><BriefcaseBusiness size={15} /></span></div><div className="stat-value">{openDeals.length}</div><div className="stat-foot"><span className="stat-positive">{deals.filter((deal) => deal.stage === "Won").length} won</span><span>· All active stages</span></div></div>
            <div className="stat-card"><div className="stat-top"><span>Follow-ups due</span><span className="stat-icon" style={{ color: "#a66c20", background: "#fff5e5" }}><CalendarClock size={15} /></span></div><div className="stat-value">{dueDeals.length}</div><div className="stat-foot"><span className="stat-alert">{dueDeals.length > 0 ? "Needs a next step" : "All caught up"}</span><span>· Due today or overdue</span></div></div>
            <div className="stat-card"><div className="stat-top"><span>Deals to watch</span><span className="stat-icon" style={{ color: "#b35f55", background: "#fff0ed" }}><CircleAlert size={15} /></span></div><div className="stat-value">{riskDeals.length}</div><div className="stat-foot"><span className="stat-alert">Needs attention</span><span>· At risk or waiting</span></div></div>
          </section>

          <div className="dashboard-grid">
            <div style={{ display: "grid", gap: 17, minWidth: 0 }}>
              <section className="panel">
                <div className="panel-header"><div><div className="panel-title">Pipeline overview</div><div className="panel-subtitle">Opportunity value by stage · live from your workspace</div></div><span style={{ color: "#8b978f", fontSize: 10 }}>{deals.length} total records</span></div>
                <div className="pipeline-chart">
                  {(["Discovery", "Proposal", "Negotiation", "Won"] as Stage[]).map((stage) => {
                    const value = deals.filter((deal) => deal.stage === stage).reduce((sum, deal) => sum + deal.amount, 0);
                    const max = Math.max(1, ...deals.map((deal) => deal.amount));
                    return <div className="chart-column" key={stage}><div className="chart-value">{value ? "$" + Math.round(value / 1000) + "k" : "$0"}</div><div className="chart-bar-wrap"><div className="chart-bar" style={{ height: Math.max(value ? 7 : 0, (value / (max * 2.4)) * 100) + "%" }} /></div><div className="chart-label">{stage}</div></div>;
                  })}
                </div>
                <div className="chart-legend"><span><i className="legend-dot" /> Opportunity value by stage</span></div>
              </section>

              <section className="panel">
                <div className="panel-header"><div><div className="panel-title">{activeView === "Follow-ups" ? "Follow-ups that need attention" : activeView === "Deals" ? "Open opportunities" : "Recent opportunities"}</div><div className="panel-subtitle">{visibleDeals.length} {visibleDeals.length === 1 ? "record" : "records"} · Stored in Supabase</div></div><button className="button-secondary" onClick={() => { setActiveView("Deals"); setSearch(""); }}>View deals <ArrowRight size={13} /></button></div>
                <div className="deal-table-wrap">
                  <table className="deal-table">
                    <thead><tr><th>Company</th><th>Deal value</th><th>Stage</th><th>Health</th><th>Next step</th><th>Draft</th></tr></thead>
                    <tbody>
                      {visibleDeals.length === 0
                        ? <tr><td colSpan={6}><div className="empty-state">{dataLoading ? "Loading your opportunities…" : "No opportunities yet. Add your first deal to start tracking follow-through."}</div></td></tr>
                        : visibleDeals.map((deal) => (
                          <tr key={deal.id}>
                            <td><div className="company-cell"><div className="company-logo" style={{ background: deal.color, color: "#466b54" }}>{deal.initials}</div><div><div className="company-name">{deal.company}</div><div className="company-sub">{deal.service}</div></div></div></td>
                            <td className="amount-cell">{money(deal.amount)}</td>
                            <td><select className="select-control" aria-label={"Stage for " + deal.company} value={deal.stage} onChange={(event) => void updateStage(deal, event.target.value as Stage)}>{stages.map((stage) => <option key={stage}>{stage}</option>)}</select></td>
                            <td><span className={"health-dot" + (deal.health === "Needs attention" ? " attention" : deal.health === "At risk" ? " risk" : "")} />{deal.health}</td>
                            <td><div style={{ maxWidth: 155, overflow: "hidden", textOverflow: "ellipsis" }}>{deal.nextStep}</div><div className="company-sub">{dueLabel(deal.followUp)}</div></td>
                            <td><button className="row-action" onClick={() => { setSelectedDeal(deal); setDraft(draftFor(deal)); }}><Mail size={12} /> Draft</button></td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            <div className="right-column">
              <section className="panel">
                <div className="panel-header"><div><div className="panel-title">Your next moves</div><div className="panel-subtitle">Deals due today or overdue</div></div><span style={{ color: "#8b978f", fontSize: 10 }}>{dueDeals.length} due</span></div>
                <div className="priority-list">
                  {dueDeals.length === 0 ? <div className="empty-state">You're all caught up. Add a next step to keep a deal moving.</div> : dueDeals.slice(0, 5).map((deal) => (
                    <div className="priority-item" key={deal.id}>
                      <div className={"priority-icon" + (deal.health === "At risk" ? " red" : " green")}>{deal.health === "At risk" ? <CircleAlert size={14} /> : <Clock3 size={14} />}</div>
                      <div className="priority-content"><div className="priority-title">{deal.company}</div><div className="priority-detail">{deal.nextStep} · {money(deal.amount)}</div><button className="priority-link" onClick={() => { setSelectedDeal(deal); setDraft(draftFor(deal)); }}>Prepare follow-up <ArrowUpRight size={11} /></button></div>
                      <div className="priority-time">{dueLabel(deal.followUp)}</div>
                    </div>
                  ))}
                </div>
              </section>
              <section className="ai-card panel"><div className="ai-card-top"><Sparkles size={15} /> Follow-through insight</div><div className="ai-card-copy">{riskDeals.length ? "You have " + riskDeals.length + " deals marked for attention. Review their next steps before the next client conversation." : "Your open deals are currently marked on track. Keep the next action and follow-up date current."}</div><button className="ai-card-link" onClick={() => setActiveView("Follow-ups")}>Review follow-ups <ArrowRight size={12} /></button></section>
              <section className="panel"><div className="panel-header"><div><div className="panel-title">Quick actions</div><div className="panel-subtitle">Make progress in a few clicks</div></div><Activity size={16} color="#9aa59e" /></div><div style={{ display: "grid", gap: 8, padding: "0 17px 17px" }}><button className="button-secondary" style={{ justifyContent: "flex-start", padding: 11 }} onClick={() => setShowAdd(true)}><Plus size={14} color="#478563" /> Add an opportunity</button><button className="button-secondary" style={{ justifyContent: "flex-start", padding: 11 }} onClick={() => setActiveView("Follow-ups")}><CalendarDays size={14} color="#478563" /> Review due follow-ups</button><button className="button-secondary" style={{ justifyContent: "flex-start", padding: 11 }} onClick={() => notify("Connected to Supabase. Your changes are saved to the database.")}><Check size={14} color="#478563" /> Check connection</button></div></section>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 18, color: "#a0aaa3", fontSize: 10 }}><span>Connected workspace · Your opportunities are saved securely to Supabase.</span><span>DealPilot MVP</span></div>
        </div>
      </main>

      {showAdd && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowAdd(false); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="add-title"><div className="modal-header"><div><div id="add-title" className="modal-title">Add an opportunity</div><div className="modal-copy">Capture the essentials. You can refine the details later.</div></div><button className="icon-button" aria-label="Close" onClick={() => setShowAdd(false)}><X size={16} /></button></div><form className="modal-body" onSubmit={addDeal}><div className="form-grid">
        <div className="field"><label htmlFor="company">Company *</label><input id="company" required autoFocus placeholder="e.g. Acme Studio" value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} /></div>
        <div className="field"><label htmlFor="service">Service / deal *</label><input id="service" required placeholder="e.g. Website redesign" value={form.service} onChange={(event) => setForm({ ...form, service: event.target.value })} /></div>
        <div className="field"><label htmlFor="contact">Primary contact</label><input id="contact" placeholder="Alex Morgan" value={form.contact} onChange={(event) => setForm({ ...form, contact: event.target.value })} /></div>
        <div className="field"><label htmlFor="email">Contact email</label><input id="email" type="email" placeholder="alex@company.com" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></div>
        <div className="field"><label htmlFor="amount">Deal value (USD) *</label><input id="amount" type="number" min="1" required placeholder="12000" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} /></div>
        <div className="field"><label htmlFor="stage">Stage</label><select id="stage" value={form.stage} onChange={(event) => setForm({ ...form, stage: event.target.value as Stage })}>{stages.map((stage) => <option key={stage}>{stage}</option>)}</select></div>
        <div className="field"><label htmlFor="followUp">Next follow-up</label><input id="followUp" type="date" value={form.followUp} onChange={(event) => setForm({ ...form, followUp: event.target.value })} /></div>
        <div className="field"><label htmlFor="nextStep">Next step</label><input id="nextStep" value={form.nextStep} onChange={(event) => setForm({ ...form, nextStep: event.target.value })} /></div>
      </div><div className="modal-footer"><button type="button" className="button-secondary" onClick={() => setShowAdd(false)}>Cancel</button><button type="submit" className="button-primary" disabled={formBusy}>{formBusy ? "Saving…" : "Add opportunity"} <Plus size={14} /></button></div></form></section></div>}

      {selectedDeal && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedDeal(null); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="draft-title"><div className="modal-header"><div><div id="draft-title" className="modal-title">Draft a thoughtful follow-up</div><div className="modal-copy">{selectedDeal.company} · {selectedDeal.contact} · {money(selectedDeal.amount)}</div></div><button className="icon-button" aria-label="Close" onClick={() => setSelectedDeal(null)}><X size={16} /></button></div><div className="modal-body"><div style={{ padding: 11, borderRadius: 8, background: "#f3f8f4", color: "#587563", fontSize: 10, lineHeight: 1.6 }}><Sparkles size={13} style={{ display: "inline", verticalAlign: "-3px", marginRight: 5 }} /> Starter draft based on the deal details. AI generation is the next feature to connect.</div><div className="field"><label htmlFor="draft-to">To</label><input id="draft-to" readOnly value={selectedDeal.email || "Add a contact email to this opportunity"} /></div><div className="field"><label htmlFor="draft-message">Email message</label><textarea id="draft-message" value={draft} onChange={(event) => setDraft(event.target.value)} /></div><div className="modal-footer"><button type="button" className="button-secondary" onClick={() => setDraft(draftFor(selectedDeal))}>Reset draft</button><button type="button" className="button-primary" onClick={() => void copyDraft()}><Copy size={14} /> Copy draft</button></div><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, paddingTop: 5 }}><span style={{ fontSize: 10, color: "#9aa49d" }}>Sending is not connected yet.</span><button className="row-action" onClick={() => { void updateStage(selectedDeal, "Negotiation"); setSelectedDeal(null); }}>Move to negotiation <ArrowUpRight size={12} /></button></div></div></section></div>}

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
