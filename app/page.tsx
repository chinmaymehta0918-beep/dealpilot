"use client";

import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BriefcaseBusiness,
  CalendarClock,
  CalendarDays,
  Check,
  ChevronDown,
  CircleAlert,
  Clock3,
  Copy,
  DollarSign,
  FileText,
  Handshake,
  LayoutDashboard,
  Mail,
  Menu,
  MoreHorizontal,
  Plus,
  Search,
  Send,
  Settings,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  X
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

type Stage = "Discovery" | "Proposal" | "Negotiation" | "Won" | "Lost";
type Health = "On track" | "Needs attention" | "At risk";
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

const starterDeals: Deal[] = [
  { id: "d1", company: "Acme Creative Studio", initials: "AC", color: "#e8f1e9", service: "Brand strategy", contact: "Olivia Chen", email: "olivia@acme.example", amount: 12000, stage: "Proposal", health: "At risk", nextStep: "Follow up on proposal", followUp: "2026-11-15", updated: "2 hours ago" },
  { id: "d2", company: "Northstar Labs", initials: "NL", color: "#edf0fb", service: "Website redesign", contact: "Daniel Brooks", email: "daniel@northstar.example", amount: 18500, stage: "Proposal", health: "On track", nextStep: "Confirm stakeholder review", followUp: "2026-11-18", updated: "Yesterday" },
  { id: "d3", company: "Terra & Co.", initials: "TC", color: "#f8eee5", service: "Marketing retainer", contact: "Maya Patel", email: "maya@terra.example", amount: 9600, stage: "Discovery", health: "On track", nextStep: "Share discovery recap", followUp: "2026-11-17", updated: "Yesterday" },
  { id: "d4", company: "Evoke Digital", initials: "ED", color: "#f5eefa", service: "Product design sprint", contact: "James Wilson", email: "james@evoke.example", amount: 14000, stage: "Negotiation", health: "Needs attention", nextStep: "Send revised scope", followUp: "2026-11-16", updated: "2 days ago" },
  { id: "d5", company: "Monarch Advisors", initials: "MA", color: "#eaf2f6", service: "RevOps consulting", contact: "Sarah Miller", email: "sarah@monarch.example", amount: 22000, stage: "Negotiation", health: "On track", nextStep: "Schedule decision call", followUp: "2026-11-19", updated: "3 days ago" },
  { id: "d6", company: "Fable Health", initials: "FH", color: "#f7f0e7", service: "GTM strategy", contact: "Ethan Wright", email: "ethan@fable.example", amount: 7500, stage: "Won", health: "On track", nextStep: "Prepare kickoff", followUp: "2026-11-20", updated: "4 days ago" }
];

const navItems = [
  { name: "Overview", icon: LayoutDashboard },
  { name: "Deals", icon: BriefcaseBusiness },
  { name: "Follow-ups", icon: Mail },
  { name: "Activity", icon: Activity }
];

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

function buildDraft(deal: Deal) {
  const firstName = deal.contact.split(" ")[0] || "there";
  return "Hi " + firstName + ",\\n\\nI wanted to follow up on the " + deal.service.toLowerCase() + " proposal we shared. I know priorities can shift, so I wanted to see whether you had a chance to review it and whether any questions have come up.\\n\\nWould a quick conversation this week be useful to align on next steps?\\n\\nBest,\\nYour name";
}

export default function Home() {
  const [deals, setDeals] = useState<Deal[]>(starterDeals);
  const [hydrated, setHydrated] = useState(false);
  const [activeNav, setActiveNav] = useState("Overview");
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [draft, setDraft] = useState("");
  const [toast, setToast] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [form, setForm] = useState({
    company: "",
    service: "",
    contact: "",
    email: "",
    amount: "",
    stage: "Discovery" as Stage,
    followUp: "2026-11-18",
    nextStep: "Send an introduction"
  });

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("dealpilot-deals");
      if (saved) setDeals(JSON.parse(saved) as Deal[]);
    } catch {
      // Keep the in-memory starter data if browser storage is unavailable.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) {
      try {
        window.localStorage.setItem("dealpilot-deals", JSON.stringify(deals));
      } catch {
        setToast("Could not save changes in this browser.");
      }
    }
  }, [deals, hydrated]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const openDeals = useMemo(() => deals.filter(isOpen), [deals]);
  const pipeline = useMemo(() => openDeals.reduce((sum, deal) => sum + deal.amount, 0), [openDeals]);
  const dueDeals = useMemo(() => openDeals.filter((deal) => new Date(deal.followUp + "T23:59:59").getTime() <= Date.now()), [openDeals]);
  const riskDeals = useMemo(() => openDeals.filter((deal) => deal.health === "At risk" || deal.health === "Needs attention"), [openDeals]);

  const visibleDeals = useMemo(() => {
    let rows = [...deals];
    if (activeNav === "Follow-ups") rows = rows.filter((deal) => isOpen(deal) && new Date(deal.followUp + "T23:59:59").getTime() <= Date.now());
    if (activeNav === "Deals") rows = rows.filter(isOpen);
    if (search.trim()) {
      const query = search.toLowerCase();
      rows = rows.filter((deal) => [deal.company, deal.service, deal.contact, deal.stage].join(" ").toLowerCase().includes(query));
    }
    return rows;
  }, [deals, activeNav, search]);

  const pageTitle = activeNav === "Overview" ? "Good morning, Chinmay" : activeNav === "Follow-ups" ? "Follow-up queue" : activeNav === "Deals" ? "Your deals" : "Recent activity";

  function notify(message: string) {
    setToast(message);
  }

  function openComposer(deal: Deal) {
    setSelectedDeal(deal);
    setDraft(buildDraft(deal));
  }

  function addDeal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(form.amount);
    if (!form.company.trim() || !form.service.trim() || !Number.isFinite(amount) || amount <= 0) {
      notify("Add a company, service and valid deal value.");
      return;
    }
    const company = form.company.trim();
    const initials = company.split(/\\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
    const palette = ["#e8f1e9", "#edf0fb", "#f8eee5", "#f5eefa", "#eaf2f6"];
    const deal: Deal = {
      id: crypto.randomUUID(),
      company,
      initials,
      color: palette[deals.length % palette.length],
      service: form.service.trim(),
      contact: form.contact.trim() || "New contact",
      email: form.email.trim(),
      amount,
      stage: form.stage,
      health: "On track",
      nextStep: form.nextStep.trim() || "Plan next follow-up",
      followUp: form.followUp,
      updated: "Just now"
    };
    setDeals((current) => [deal, ...current]);
    setForm({ company: "", service: "", contact: "", email: "", amount: "", stage: "Discovery", followUp: "2026-11-18", nextStep: "Send an introduction" });
    setShowAdd(false);
    setActiveNav("Deals");
    notify("Opportunity added to your pipeline.");
  }

  function updateStage(deal: Deal, stage: Stage) {
    setDeals((current) => current.map((item) => item.id === deal.id ? { ...item, stage, updated: "Just now" } : item));
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

  return (
    <div className="app-shell">
      {mobileOpen && <div className="mobile-sidebar-overlay" onClick={() => setMobileOpen(false)} />}
      <aside className={"sidebar" + (mobileOpen ? " mobile-open" : "")}>
        <div className="brand">
          <div className="brand-mark"><Target size={19} strokeWidth={2.6} /></div>
          <div><div className="brand-name">dealpilot</div><div className="brand-caption">Sales follow-through</div></div>
        </div>

        <div className="sidebar-label">Workspace</div>
        <nav className="nav-list" aria-label="Main navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.name} className={"nav-item" + (activeNav === item.name ? " active" : "")} onClick={() => { setActiveNav(item.name); setMobileOpen(false); }}>
                <Icon size={17} strokeWidth={1.8} />
                <span>{item.name}</span>
                {item.name === "Follow-ups" && dueDeals.length > 0 && <small className="nav-count">{dueDeals.length}</small>}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-label" style={{ marginTop: 30 }}>Manage</div>
        <nav className="nav-list" aria-label="Settings navigation">
          <button className={"nav-item" + (activeNav === "Settings" ? " active" : "")} onClick={() => setActiveNav("Settings")}><Settings size={17} strokeWidth={1.8} /><span>Settings</span></button>
        </nav>

        <div className="sidebar-bottom">
          <div className="plan-card">
            <div className="plan-title">A little more clarity, every day.</div>
            <div className="plan-copy">DealPilot keeps your next steps visible, so good conversations keep moving.</div>
            <div className="plan-link">Explore the workflow <ArrowUpRight size={12} /></div>
          </div>
          <div className="profile-row">
            <div className="avatar">CM</div>
            <div style={{ flex: 1 }}><div className="profile-name">Chinmay Mehta</div><div className="profile-role">Workspace owner</div></div>
            <MoreHorizontal size={16} color="#91a99a" />
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb">
            <button className="icon-button mobile-menu" aria-label="Open menu" onClick={() => setMobileOpen(true)}><Menu size={16} /></button>
            <span>Workspace</span><span>/</span><strong>{activeNav}</strong>
          </div>
          <div className="topbar-actions">
            <label className="search-box"><Search size={15} /><input aria-label="Search deals" placeholder="Search companies, deals..." value={search} onChange={(event) => setSearch(event.target.value)} /><span style={{ fontSize: 9, color: "#a0aaa3" }}>⌘ K</span></label>
            <button className="icon-button" aria-label="Notifications" onClick={() => notify(dueDeals.length + " follow-ups need your attention.")}><Bell size={16} /><i className="notification-dot" /></button>
            <div className="avatar" style={{ width: 32, height: 32 }}>CM</div>
          </div>
        </header>

        <div className="content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">{activeNav === "Overview" ? "Monday, November 16, 2026 · Your workspace" : "Your workspace · " + activeNav}</div>
              <h1 className="page-title">{pageTitle}{activeNav === "Overview" ? " 👋" : ""}</h1>
              <div className="page-subtitle">{activeNav === "Overview" ? "A clear view of what needs your attention and where revenue is moving." : activeNav === "Follow-ups" ? "Keep every promising conversation moving forward." : activeNav === "Deals" ? "Every opportunity, owner and next step in one place." : "A timeline of the work happening across your pipeline."}</div>
            </div>
            <button className="button-primary" onClick={() => setShowAdd(true)}><Plus size={15} /> Add opportunity</button>
          </div>

          <section className="stat-grid" aria-label="Pipeline metrics">
            <div className="stat-card">
              <div className="stat-top"><span>Open pipeline</span><span className="stat-icon"><DollarSign size={15} /></span></div>
              <div className="stat-value">{money(pipeline)}</div>
              <div className="stat-foot"><span className="stat-positive"><TrendingUp size={11} style={{ display: "inline", verticalAlign: "-2px" }} /> Live total</span><span>· Across {openDeals.length} open deals</span></div>
            </div>
            <div className="stat-card">
              <div className="stat-top"><span>Open opportunities</span><span className="stat-icon"><BriefcaseBusiness size={15} /></span></div>
              <div className="stat-value">{openDeals.length}</div>
              <div className="stat-foot"><span className="stat-positive">{deals.filter((deal) => deal.stage === "Won").length} won</span><span>· All active stages</span></div>
            </div>
            <div className="stat-card">
              <div className="stat-top"><span>Follow-ups due</span><span className="stat-icon" style={{ color: "#a66c20", background: "#fff5e5" }}><CalendarClock size={15} /></span></div>
              <div className="stat-value">{dueDeals.length}</div>
              <div className="stat-foot"><span className="stat-alert">{dueDeals.length > 0 ? "Needs a next step" : "All caught up"}</span><span>· Due today or overdue</span></div>
            </div>
            <div className="stat-card">
              <div className="stat-top"><span>Deals to watch</span><span className="stat-icon" style={{ color: "#b35f55", background: "#fff0ed" }}><CircleAlert size={15} /></span></div>
              <div className="stat-value">{riskDeals.length}</div>
              <div className="stat-foot"><span className="stat-alert">Needs attention</span><span>· At risk or waiting</span></div>
            </div>
          </section>

          <div className="dashboard-grid">
            <div style={{ display: "grid", gap: 17, minWidth: 0 }}>
              <section className="panel">
                <div className="panel-header">
                  <div><div className="panel-title">Pipeline overview</div><div className="panel-subtitle">Opportunity value by stage · illustrative distribution</div></div>
                  <select className="select-control" aria-label="Pipeline timeframe" defaultValue="This month"><option>This month</option><option>This quarter</option><option>All time</option></select>
                </div>
                <div className="pipeline-chart">
                  {[
                    { name: "Discovery", value: deals.filter((d) => d.stage === "Discovery").reduce((s, d) => s + d.amount, 0) },
                    { name: "Proposal", value: deals.filter((d) => d.stage === "Proposal").reduce((s, d) => s + d.amount, 0) },
                    { name: "Negotiation", value: deals.filter((d) => d.stage === "Negotiation").reduce((s, d) => s + d.amount, 0) },
                    { name: "Won", value: deals.filter((d) => d.stage === "Won").reduce((s, d) => s + d.amount, 0) }
                  ].map((bar) => {
                    const max = Math.max(1, ...deals.map((d) => d.amount));
                    const height = Math.max(7, (bar.value / (max * 2.4)) * 100);
                    return <div className="chart-column" key={bar.name}><div className="chart-value">{bar.value ? "$" + Math.round(bar.value / 1000) + "k" : "$0"}</div><div className="chart-bar-wrap"><div className="chart-bar" style={{ height: height + "%" }} /></div><div className="chart-label">{bar.name}</div></div>;
                  })}
                </div>
                <div className="chart-legend"><span><i className="legend-dot" /> Active opportunity value</span><span><i className="legend-dot gray" /> Closed won</span></div>
              </section>

              <section className="panel">
                <div className="panel-header">
                  <div><div className="panel-title">{activeNav === "Follow-ups" ? "Follow-ups that need attention" : activeNav === "Deals" ? "Open opportunities" : activeNav === "Activity" ? "Recent deal activity" : "Recent opportunities"}</div><div className="panel-subtitle">{visibleDeals.length} {visibleDeals.length === 1 ? "record" : "records"} · Updated as you work</div></div>
                  <button className="button-secondary" onClick={() => { setActiveNav("Deals"); setSearch(""); }}><span>View all</span><ArrowRight size={13} /></button>
                </div>
                <div className="deal-table-wrap">
                  <table className="deal-table">
                    <thead><tr><th>Company</th><th>Deal value</th><th>Stage</th><th>Health</th><th>Next step</th><th /></tr></thead>
                    <tbody>
                      {visibleDeals.length === 0 ? <tr><td colSpan={6}><div className="empty-state">No opportunities match this view. Add a deal or change your search.</div></td></tr> :
                        visibleDeals.map((deal) => (
                          <tr key={deal.id}>
                            <td><div className="company-cell"><div className="company-logo" style={{ background: deal.color, color: "#466b54" }}>{deal.initials}</div><div><div className="company-name">{deal.company}</div><div className="company-sub">{deal.service}</div></div></div></td>
                            <td className="amount-cell">{money(deal.amount)}</td>
                            <td><span className={stageClass(deal.stage)}>{deal.stage}</span></td>
                            <td><span className={"health-dot" + (deal.health === "Needs attention" ? " attention" : deal.health === "At risk" ? " risk" : "")} />{deal.health}</td>
                            <td><div style={{ maxWidth: 155, overflow: "hidden", textOverflow: "ellipsis" }}>{deal.nextStep}</div><div className="company-sub">{dueLabel(deal.followUp)}</div></td>
                            <td><button className="row-action" onClick={() => openComposer(deal)}><Mail size={12} /> Draft</button></td>
                          </tr>
                        ))
                      }
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            <div className="right-column">
              <section className="panel">
                <div className="panel-header"><div><div className="panel-title">Your next moves</div><div className="panel-subtitle">A short list to keep deals moving</div></div><span style={{ color: "#8b978f", fontSize: 10 }}>{dueDeals.length} due</span></div>
                <div className="priority-list">
                  {dueDeals.length === 0 ? <div className="empty-state">You're all caught up. Nice work.</div> : dueDeals.slice(0, 4).map((deal) => (
                    <div className="priority-item" key={deal.id}>
                      <div className={"priority-icon" + (deal.health === "At risk" ? " red" : " green")}>{deal.health === "At risk" ? <CircleAlert size={14} /> : <Clock3 size={14} />}</div>
                      <div className="priority-content"><div className="priority-title">{deal.company}</div><div className="priority-detail">{deal.nextStep} · {money(deal.amount)}</div><button className="priority-link" onClick={() => openComposer(deal)}>Prepare follow-up <ArrowUpRight size={11} /></button></div>
                      <div className="priority-time">{dueLabel(deal.followUp)}</div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="ai-card panel">
                <div className="ai-card-top"><Sparkles size={15} /> A clearer next step</div>
                <div className="ai-card-copy">Your highest-value open opportunity is <strong>{openDeals.sort((a, b) => b.amount - a.amount)[0]?.company || "your pipeline"}</strong>. Keep the momentum by confirming the decision process and next meeting.</div>
                <button className="ai-card-link" onClick={() => openDeals.length ? openComposer([...openDeals].sort((a, b) => b.amount - a.amount)[0]) : setShowAdd(true)}>Review priority deal <ArrowRight size={12} /></button>
              </section>

              <section className="panel">
                <div className="panel-header"><div><div className="panel-title">Quick actions</div><div className="panel-subtitle">Make progress in a few clicks</div></div><MoreHorizontal size={16} color="#9aa59e" /></div>
                <div style={{ display: "grid", gap: 8, padding: "0 17px 17px" }}>
                  <button className="button-secondary" style={{ justifyContent: "flex-start", padding: 11 }} onClick={() => setShowAdd(true)}><Plus size={14} color="#478563" /> Add a new opportunity</button>
                  <button className="button-secondary" style={{ justifyContent: "flex-start", padding: 11 }} onClick={() => { setActiveNav("Follow-ups"); setSearch(""); }}><CalendarDays size={14} color="#478563" /> Review due follow-ups</button>
                  <button className="button-secondary" style={{ justifyContent: "flex-start", padding: 11 }} onClick={() => notify("Your demo workspace is saved in this browser.")}><Check size={14} color="#478563" /> Check workspace status</button>
                </div>
              </section>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 18, color: "#a0aaa3", fontSize: 10 }}>
            <span>DealPilot preview · Demo data is stored in this browser only.</span>
            <span>Built for thoughtful follow-through.</span>
          </div>
        </div>
      </main>

      {showAdd && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowAdd(false); }}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="add-title">
            <div className="modal-header"><div><div id="add-title" className="modal-title">Add an opportunity</div><div className="modal-copy">Capture the essentials. You can refine the details later.</div></div><button className="icon-button" aria-label="Close" onClick={() => setShowAdd(false)}><X size={16} /></button></div>
            <form className="modal-body" onSubmit={addDeal}>
              <div className="form-grid">
                <div className="field"><label htmlFor="company">Company *</label><input id="company" required autoFocus placeholder="e.g. Acme Studio" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></div>
                <div className="field"><label htmlFor="service">Service / deal *</label><input id="service" required placeholder="e.g. Website redesign" value={form.service} onChange={(e) => setForm({ ...form, service: e.target.value })} /></div>
                <div className="field"><label htmlFor="contact">Primary contact</label><input id="contact" placeholder="Alex Morgan" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} /></div>
                <div className="field"><label htmlFor="email">Contact email</label><input id="email" type="email" placeholder="alex@company.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div className="field"><label htmlFor="amount">Deal value (USD) *</label><input id="amount" type="number" min="1" required placeholder="12000" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
                <div className="field"><label htmlFor="stage">Stage</label><select id="stage" value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value as Stage })}><option>Discovery</option><option>Proposal</option><option>Negotiation</option><option>Won</option><option>Lost</option></select></div>
                <div className="field"><label htmlFor="followUp">Next follow-up</label><input id="followUp" type="date" value={form.followUp} onChange={(e) => setForm({ ...form, followUp: e.target.value })} /></div>
                <div className="field"><label htmlFor="nextStep">Next step</label><input id="nextStep" value={form.nextStep} onChange={(e) => setForm({ ...form, nextStep: e.target.value })} /></div>
              </div>
              <div className="modal-footer"><button type="button" className="button-secondary" onClick={() => setShowAdd(false)}>Cancel</button><button type="submit" className="button-primary"><Plus size={14} /> Add opportunity</button></div>
            </form>
          </section>
        </div>
      )}

      {selectedDeal && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedDeal(null); }}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="draft-title">
            <div className="modal-header"><div><div id="draft-title" className="modal-title">Draft a thoughtful follow-up</div><div className="modal-copy">{selectedDeal.company} · {selectedDeal.contact} · {money(selectedDeal.amount)}</div></div><button className="icon-button" aria-label="Close" onClick={() => setSelectedDeal(null)}><X size={16} /></button></div>
            <div className="modal-body">
              <div style={{ padding: 11, borderRadius: 8, background: "#f3f8f4", color: "#587563", fontSize: 10, lineHeight: 1.6 }}><Sparkles size={13} style={{ display: "inline", verticalAlign: "-3px", marginRight: 5 }} /> Suggested draft based on the deal details. Review it and personalise before sending.</div>
              <div className="field"><label htmlFor="draft-to">To</label><input id="draft-to" readOnly value={selectedDeal.email || "Add a contact email to this opportunity"} /></div>
              <div className="field"><label htmlFor="draft-message">Email message</label><textarea id="draft-message" value={draft} onChange={(event) => setDraft(event.target.value)} /></div>
              <div className="modal-footer"><button type="button" className="button-secondary" onClick={() => setDraft(buildDraft(selectedDeal))}>Reset draft</button><button type="button" className="button-primary" onClick={copyDraft}><Copy size={14} /> Copy draft</button></div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, paddingTop: 5 }}>
                <span style={{ fontSize: 10, color: "#9aa49d" }}>Sending is not connected in this preview.</span>
                <button className="row-action" onClick={() => { updateStage(selectedDeal, "Negotiation"); setSelectedDeal(null); }}><Handshake size={12} /> Move to negotiation</button>
              </div>
            </div>
          </section>
        </div>
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
