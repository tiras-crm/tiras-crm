// TIRAS CRM — Subscription & Billing Manager
// Role: platform_owner — manage plans, payments, renewals for all companies
// Route: /platform/billing
// Queries: companies (all), payments (all, ordered by date)
// Features: plan change, manual payment entry, renewal tracking, overdue alerts, CSV export

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  collection, query, getDocs, doc, updateDoc,
  addDoc, orderBy, serverTimestamp, Timestamp, where,
} from "firebase/firestore";
import { db, COLLECTIONS } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import {
  COLORS, FONTS, SPACING, RADIUS, SHADOWS, STYLES, TRANSITIONS,
} from "../theme";

// ─── Constants ────────────────────────────────────────────────────────────────

const PLAN_PRICES = { Basic: 1800, Growth: 3000, Enterprise: null };
const PLAN_META   = {
  Basic:      { color: COLORS.info,    bg: COLORS.infoMuted    },
  Growth:     { color: COLORS.accent,  bg: COLORS.accentMuted  },
  Enterprise: { color: COLORS.primary, bg: COLORS.primaryMuted },
};
const PAY_STATUS_META = {
  paid:    { color: COLORS.success, bg: COLORS.successMuted, label: "Paid"    },
  pending: { color: COLORS.warning, bg: COLORS.warningMuted, label: "Pending" },
  failed:  { color: COLORS.danger,  bg: COLORS.dangerMuted,  label: "Failed"  },
  refunded:{ color: COLORS.textMuted, bg: COLORS.surfaceActive, label: "Refunded" },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtRupee = (n) => {
  if (!n && n !== 0) return "—";
  if (n >= 100000) return `₹${(n/100000).toFixed(1)}L`;
  if (n >= 1000)   return `₹${(n/1000).toFixed(1)}K`;
  return `₹${n.toLocaleString("en-IN")}`;
};

const fmtDate = (ts) => {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : (ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts));
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

const daysUntil = (ts) => {
  if (!ts) return null;
  const d    = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000);
  const diff = Math.ceil((d.getTime() - Date.now()) / 86_400_000);
  return diff;
};

const startOfMonth = () => {
  const d = new Date(); d.setDate(1); d.setHours(0,0,0,0);
  return Timestamp.fromDate(d);
};

const exportCSV = (payments, companyMap) => {
  const rows = payments.map((p) => [
    `"${companyMap[p.companyId] || p.companyId || ""}"`,
    p.plan || "",
    p.amount || 0,
    p.status || "",
    fmtDate(p.createdAt),
    p.razorpayId || "",
  ].join(","));
  const csv  = ["Company,Plan,Amount,Status,Date,Razorpay ID", ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = `tiras-payments-${new Date().toISOString().slice(0,10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const Shimmer = ({ w = "100%", h = "14px", r = RADIUS.base }) => (
  <div style={{
    width: w, height: h, borderRadius: r,
    background: `linear-gradient(90deg,${COLORS.surface} 25%,#2a2a2a 50%,${COLORS.surface} 75%)`,
    backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite",
  }} />
);

const StatCard = ({ icon, label, value, sub, color }) => (
  <div style={{ ...STYLES.card, flex: "1 1 180px", padding: SPACING.xl, position: "relative", overflow: "hidden" }}>
    <div style={{ position: "absolute", top: "-12px", right: "-12px", width: "60px", height: "60px", borderRadius: "50%", backgroundColor: (color || COLORS.primary) + "18" }} />
    <div style={{ fontSize: "20px", marginBottom: SPACING.sm }}>{icon}</div>
    <div style={{ fontSize: FONTS.size["4xl"], fontWeight: FONTS.weight.bold, color: color || COLORS.textPrimary, lineHeight: 1 }}>{value}</div>
    <div style={{ fontSize: FONTS.size.sm, fontWeight: FONTS.weight.semibold, color: COLORS.textPrimary, marginTop: SPACING.xs }}>{label}</div>
    {sub && <div style={{ fontSize: FONTS.size.xs, color: COLORS.textMuted, marginTop: "2px" }}>{sub}</div>}
  </div>
);

// Log payment modal
const LogPaymentModal = ({ companies, onClose, onLogged }) => {
  const [form, setForm] = useState({ companyId: "", amount: "", plan: "Basic", status: "paid", razorpayId: "", note: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState("");

  const set = (k) => (e) => {
    const val = e.target.value;
    setForm((f) => {
      const next = { ...f, [k]: val };
      // Auto-fill amount when plan selected
      if (k === "plan" && PLAN_PRICES[val]) next.amount = String(PLAN_PRICES[val]);
      return next;
    });
  };

  const save = async () => {
    if (!form.companyId) { setErr("Select a company."); return; }
    if (!form.amount || isNaN(Number(form.amount))) { setErr("Enter a valid amount."); return; }
    setSaving(true);
    try {
      const payload = {
        companyId:  form.companyId,
        amount:     Number(form.amount),
        plan:       form.plan,
        status:     form.status,
        razorpayId: form.razorpayId.trim() || null,
        note:       form.note.trim() || null,
        createdAt:  serverTimestamp(),
        loggedBy:   "platform_owner",
      };
      await addDoc(collection(db, COLLECTIONS.PAYMENTS), payload);
      // Update company's lastPaymentAt
      await updateDoc(doc(db, COLLECTIONS.COMPANIES, form.companyId), {
        plan: form.plan, lastPaymentAt: serverTimestamp(),
      });
      onLogged(payload);
      onClose();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.65)", zIndex: 200 }} />
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
        backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}`,
        borderRadius: RADIUS.xl, padding: SPACING["2xl"], width: "460px",
        boxShadow: SHADOWS.lg, zIndex: 201, fontFamily: FONTS.family,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: SPACING.xl }}>
          <div style={{ fontSize: FONTS.size.xl, fontWeight: FONTS.weight.bold, color: COLORS.textPrimary }}>Log Payment</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: COLORS.textMuted, cursor: "pointer", fontSize: FONTS.size["2xl"], lineHeight: 1, padding: 0 }}>×</button>
        </div>

        {[
          { label: "Company *", key: "companyId", type: "select", opts: companies.map((c) => ({ v: c.id, l: c.name })) },
          { label: "Plan",      key: "plan",      type: "select", opts: ["Basic","Growth","Enterprise"].map((v) => ({ v, l: v })) },
          { label: "Amount (₹) *", key: "amount", type: "number" },
          { label: "Status",    key: "status",    type: "select", opts: ["paid","pending","failed","refunded"].map((v) => ({ v, l: v[0].toUpperCase() + v.slice(1) })) },
          { label: "Razorpay Payment ID", key: "razorpayId", type: "text" },
          { label: "Note (optional)",     key: "note",       type: "text" },
        ].map(({ label, key, type, opts }) => (
          <div key={key} style={{ marginBottom: SPACING.base }}>
            <label style={{ fontSize: FONTS.size.xs, color: COLORS.textMuted, display: "block", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</label>
            {type === "select" ? (
              <select value={form[key]} onChange={set(key)} style={{ ...STYLES.input }}>
                <option value="">— Select —</option>
                {opts.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            ) : (
              <input type={type} value={form[key]} onChange={set(key)} style={{ ...STYLES.input }} />
            )}
          </div>
        ))}

        {err && <div style={{ marginBottom: SPACING.base, padding: SPACING.sm, backgroundColor: COLORS.dangerMuted, border: `1px solid ${COLORS.danger}`, borderRadius: RADIUS.base, fontSize: FONTS.size.xs, color: COLORS.danger }}>{err}</div>}

        <div style={{ display: "flex", gap: SPACING.sm }}>
          <button onClick={onClose} style={{ ...STYLES.buttonSecondary, flex: 1, padding: SPACING.sm }}>Cancel</button>
          <button onClick={save} disabled={saving} style={{ ...STYLES.buttonPrimary, flex: 1, padding: SPACING.sm, opacity: saving ? 0.7 : 1 }}>
            {saving ? "Saving…" : "Log Payment"}
          </button>
        </div>
      </div>
    </>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const SubscriptionBillingManager = () => {
  const { isPlatformOwner } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedCompany = searchParams.get("company");

  const [companies, setCompanies] = useState([]);
  const [payments, setPayments]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [showLog, setShowLog]     = useState(false);
  const [activeTab, setActiveTab] = useState("subscriptions"); // subscriptions | history | renewals
  const [search, setSearch]       = useState("");
  const [planFilter, setPlanFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [editingPlan, setEditingPlan] = useState(null); // { companyId, currentPlan }

  // ─── Fetch ─────────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [compSnap, paySnap] = await Promise.all([
        getDocs(query(collection(db, COLLECTIONS.COMPANIES), orderBy("createdAt", "desc"))),
        getDocs(query(collection(db, COLLECTIONS.PAYMENTS), orderBy("createdAt", "desc"))),
      ]);
      setCompanies(compSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setPayments(paySnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ─── Quick plan change ──────────────────────────────────────────────────

  const changePlan = async (companyId, plan) => {
    await updateDoc(doc(db, COLLECTIONS.COMPANIES, companyId), { plan, updatedAt: serverTimestamp() });
    setCompanies((prev) => prev.map((c) => c.id === companyId ? { ...c, plan } : c));
    setEditingPlan(null);
  };

  // ─── Derived ───────────────────────────────────────────────────────────

  const companyMap = useMemo(() => {
    const m = {};
    companies.forEach((c) => { m[c.id] = c.name; });
    return m;
  }, [companies]);

  const thisMonthTs = startOfMonth().toMillis();

  const revenueTotal  = payments.filter((p) => p.status === "paid").reduce((s, p) => s + (p.amount || 0), 0);
  const revenueMonth  = payments.filter((p) => p.status === "paid" && (p.createdAt?.seconds || 0) * 1000 >= thisMonthTs).reduce((s, p) => s + (p.amount || 0), 0);
  const pendingCount  = payments.filter((p) => p.status === "pending").length;
  const expiringSoon  = companies.filter((c) => { const d = daysUntil(c.currentPeriodEnd); return d !== null && d >= 0 && d <= 7; }).length;

  // Subscriptions filtered
  const filteredSubs = useMemo(() => {
    let r = [...companies];
    if (search.trim()) { const q = search.toLowerCase(); r = r.filter((c) => (c.name||"").toLowerCase().includes(q) || (c.adminEmail||"").toLowerCase().includes(q)); }
    if (planFilter !== "All") r = r.filter((c) => c.plan === planFilter);
    if (statusFilter !== "All") r = r.filter((c) => (c.status||"active") === statusFilter);
    return r;
  }, [companies, search, planFilter, statusFilter]);

  // Payments filtered
  const filteredPayments = useMemo(() => {
    if (!search.trim()) return payments;
    const q = search.toLowerCase();
    return payments.filter((p) => (companyMap[p.companyId]||"").toLowerCase().includes(q) || (p.razorpayId||"").toLowerCase().includes(q));
  }, [payments, search, companyMap]);

  // Renewals coming up
  const renewals = useMemo(() => companies
    .filter((c) => c.currentPeriodEnd)
    .map((c) => ({ ...c, daysLeft: daysUntil(c.currentPeriodEnd) }))
    .sort((a, b) => (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999))
  , [companies]);

  // ─── Access guard ───────────────────────────────────────────────────────

  if (!isPlatformOwner) return (
    <div style={{ minHeight: "100vh", backgroundColor: COLORS.background, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONTS.family }}>
      <div style={{ textAlign: "center", color: COLORS.textMuted }}><div style={{ fontSize: "40px" }}>🔒</div><div style={{ marginTop: SPACING.base }}>Platform Owner access required.</div></div>
    </div>
  );

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
        ::-webkit-scrollbar{width:6px;height:6px}
        ::-webkit-scrollbar-track{background:${COLORS.scrollbarTrack}}
        ::-webkit-scrollbar-thumb{background:${COLORS.scrollbarThumb};border-radius:3px}
        .row-hover:hover{background-color:${COLORS.surfaceHover}!important}
      `}</style>

      <div style={{ minHeight: "100vh", backgroundColor: COLORS.background, padding: `${SPACING.xl} ${SPACING["2xl"]}`, fontFamily: FONTS.family, color: COLORS.textPrimary }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: SPACING["2xl"] }}>
          <div>
            <div style={{ fontSize: FONTS.size.xs, color: COLORS.accent, fontWeight: FONTS.weight.semibold, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: SPACING.xs }}>Platform Owner</div>
            <h1 style={{ fontSize: FONTS.size["4xl"], fontWeight: FONTS.weight.bold, margin: 0, lineHeight: 1.1 }}>Subscription & Billing</h1>
            <div style={{ fontSize: FONTS.size.sm, color: COLORS.textSecondary, marginTop: SPACING.xs }}>Manage plans, payments, and renewals across all companies</div>
          </div>
          <div style={{ display: "flex", gap: SPACING.sm }}>
            <button onClick={() => exportCSV(payments, companyMap)} style={{ ...STYLES.buttonSecondary, fontSize: FONTS.size.sm, padding: `${SPACING.sm} ${SPACING.base}` }}>↓ Export</button>
            <button onClick={fetchAll} style={{ ...STYLES.buttonSecondary, fontSize: FONTS.size.sm, padding: `${SPACING.sm} ${SPACING.base}` }}>↻</button>
            <button onClick={() => setShowLog(true)} style={{ ...STYLES.buttonPrimary, fontSize: FONTS.size.sm, padding: `${SPACING.sm} ${SPACING.base}` }}>+ Log Payment</button>
          </div>
        </div>

        {error && <div style={{ backgroundColor: COLORS.dangerMuted, border: `1px solid ${COLORS.danger}`, borderRadius: RADIUS.md, padding: SPACING.base, color: COLORS.danger, fontSize: FONTS.size.sm, marginBottom: SPACING.xl }}>⚠ {error}</div>}

        {/* ── Stat Cards ── */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: SPACING.base, marginBottom: SPACING["2xl"] }}>
          <StatCard icon="💰" label="Total Revenue" value={loading ? "…" : fmtRupee(revenueTotal)} sub="all time, paid" color={COLORS.success} />
          <StatCard icon="📅" label="This Month"    value={loading ? "…" : fmtRupee(revenueMonth)} sub="from subscriptions" color={COLORS.accent} />
          <StatCard icon="⚠️" label="Pending"       value={loading ? "…" : pendingCount} sub="payments awaiting" color={COLORS.warning} />
          <StatCard icon="🔔" label="Renewing Soon" value={loading ? "…" : expiringSoon} sub="within 7 days" color={expiringSoon > 0 ? COLORS.danger : COLORS.textMuted} />
          <StatCard icon="🏢" label="Companies"     value={loading ? "…" : companies.length} sub="on platform" color={COLORS.primary} />
        </div>

        {/* ── Tabs ── */}
        <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${COLORS.border}`, marginBottom: SPACING.xl }}>
          {[
            { id: "subscriptions", label: "Subscriptions" },
            { id: "history",       label: "Payment History" },
            { id: "renewals",      label: `Renewals ${expiringSoon > 0 ? `(${expiringSoon})` : ""}` },
          ].map(({ id, label }) => (
            <button key={id} onClick={() => setActiveTab(id)} style={{
              padding: `${SPACING.sm} ${SPACING.xl}`, fontSize: FONTS.size.sm,
              fontWeight: activeTab === id ? FONTS.weight.semibold : FONTS.weight.regular,
              fontFamily: FONTS.family, cursor: "pointer", border: "none", background: "none",
              color: activeTab === id ? COLORS.primary : COLORS.textSecondary,
              borderBottom: activeTab === id ? `2px solid ${COLORS.primary}` : "2px solid transparent",
              transition: TRANSITIONS.fast, marginBottom: "-1px",
            }}>{label}</button>
          ))}
        </div>

        {/* ── Search + plan/status filter ── */}
        <div style={{ display: "flex", gap: SPACING.sm, marginBottom: SPACING.base, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative", flex: 1, minWidth: "200px" }}>
            <span style={{ position: "absolute", left: SPACING.md, top: "50%", transform: "translateY(-50%)", color: COLORS.textMuted }}>🔍</span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search companies…"
              style={{ ...STYLES.input, paddingLeft: "34px", fontSize: FONTS.size.sm }} />
          </div>
          {activeTab === "subscriptions" && (
            <>
              <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value)} style={{ ...STYLES.input, width: "auto", fontSize: FONTS.size.sm }}>
                <option>All</option><option>Basic</option><option>Growth</option><option>Enterprise</option>
              </select>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ ...STYLES.input, width: "auto", fontSize: FONTS.size.sm }}>
                <option>All</option><option value="active">Active</option><option value="trial">Trial</option><option value="suspended">Suspended</option>
              </select>
            </>
          )}
        </div>

        {/* ── SUBSCRIPTIONS TAB ── */}
        {activeTab === "subscriptions" && (
          <div style={{ ...STYLES.card, padding: 0, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "2.5fr 1.2fr 1fr 1.2fr 130px 150px", backgroundColor: COLORS.surfaceActive, borderBottom: `1px solid ${COLORS.border}` }}>
              {["Company","Plan","Status","Period End","Monthly Value","Actions"].map((h, i) => (
                <div key={h} style={{ ...STYLES.tableHeader, paddingLeft: i === 0 ? SPACING.xl : SPACING.base, textAlign: i === 5 ? "center" : "left" }}>{h}</div>
              ))}
            </div>

            {loading ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "2.5fr 1.2fr 1fr 1.2fr 130px 150px", padding: `${SPACING.md} ${SPACING.base}`, gap: SPACING.base, borderBottom: `1px solid ${COLORS.border}`, alignItems: "center" }}>
                <div><Shimmer h="13px" w="60%" /><div style={{ marginTop: "4px" }}><Shimmer h="11px" w="45%" /></div></div>
                <Shimmer h="20px" w="65px" r={RADIUS.full} />
                <Shimmer h="20px" w="60px" r={RADIUS.full} />
                <Shimmer h="11px" w="75px" />
                <Shimmer h="13px" w="55px" />
                <div style={{ display: "flex", gap: "6px", justifyContent: "center" }}><Shimmer h="26px" w="60px" /><Shimmer h="26px" w="70px" /></div>
              </div>
            )) : filteredSubs.length === 0 ? (
              <div style={{ textAlign: "center", padding: `${SPACING["3xl"]} 0`, color: COLORS.textMuted }}>No companies match.</div>
            ) : filteredSubs.map((company, idx) => {
              const dLeft    = daysUntil(company.currentPeriodEnd);
              const expiring = dLeft !== null && dLeft <= 7 && dLeft >= 0;
              const expired  = dLeft !== null && dLeft < 0;
              const price    = PLAN_PRICES[company.plan];
              const isEditing = editingPlan?.companyId === company.id;

              return (
                <div key={company.id} className="row-hover" style={{
                  display: "grid", gridTemplateColumns: "2.5fr 1.2fr 1fr 1.2fr 130px 150px",
                  borderBottom: `1px solid ${COLORS.border}`,
                  backgroundColor: expired ? COLORS.dangerMuted + "33" : expiring ? COLORS.warningMuted + "33" : (idx % 2 === 0 ? "transparent" : COLORS.surface + "55"),
                  alignItems: "center", transition: TRANSITIONS.fast,
                }}>
                  {/* Company */}
                  <div style={{ padding: `${SPACING.md} ${SPACING.xl}` }}>
                    <div style={{ fontSize: FONTS.size.sm, fontWeight: FONTS.weight.medium, color: COLORS.textPrimary, cursor: "pointer" }}
                      onClick={() => navigate(`/platform/companies/${company.id}`)}>
                      {company.name || "—"}
                    </div>
                    <div style={{ fontSize: FONTS.size.xs, color: COLORS.textMuted, marginTop: "2px" }}>{company.adminEmail}</div>
                  </div>

                  {/* Plan — inline edit */}
                  <div style={{ padding: `${SPACING.md} ${SPACING.base}` }}>
                    {isEditing ? (
                      <select
                        defaultValue={company.plan}
                        autoFocus
                        onBlur={(e) => { if (e.target.value !== company.plan) changePlan(company.id, e.target.value); else setEditingPlan(null); }}
                        onChange={(e) => changePlan(company.id, e.target.value)}
                        style={{ ...STYLES.input, padding: "2px 6px", fontSize: FONTS.size.xs, width: "100px" }}
                      >
                        <option>Basic</option><option>Growth</option><option>Enterprise</option>
                      </select>
                    ) : (
                      <span
                        onClick={() => setEditingPlan({ companyId: company.id })}
                        style={{ cursor: "pointer" }}
                        title="Click to edit plan"
                      >
                        {(() => {
                          const m = PLAN_META[company.plan] || { color: COLORS.textMuted, bg: COLORS.surfaceActive };
                          return <span style={{ ...STYLES.badge, backgroundColor: m.bg, color: m.color, border: `1px solid ${m.color}33`, fontSize: FONTS.size.xs }}>{company.plan || "—"} ✏</span>;
                        })()}
                      </span>
                    )}
                  </div>

                  {/* Status */}
                  <div style={{ padding: `${SPACING.md} ${SPACING.base}` }}>
                    {(() => {
                      const s = company.status || "active";
                      const m = { active: { c: COLORS.success, bg: COLORS.successMuted, l: "Active" }, suspended: { c: COLORS.danger, bg: COLORS.dangerMuted, l: "Suspended" }, trial: { c: COLORS.warning, bg: COLORS.warningMuted, l: "Trial" } };
                      const meta = m[s] || { c: COLORS.textMuted, bg: COLORS.surfaceActive, l: s };
                      return <span style={{ ...STYLES.badge, backgroundColor: meta.bg, color: meta.c, fontSize: FONTS.size.xs }}>{meta.l}</span>;
                    })()}
                  </div>

                  {/* Period end */}
                  <div style={{ padding: `${SPACING.md} ${SPACING.base}` }}>
                    {company.currentPeriodEnd ? (
                      <div>
                        <div style={{ fontSize: FONTS.size.xs, color: expired ? COLORS.danger : expiring ? COLORS.warning : COLORS.textSecondary }}>
                          {fmtDate(company.currentPeriodEnd)}
                        </div>
                        {dLeft !== null && (
                          <div style={{ fontSize: "10px", color: expired ? COLORS.danger : expiring ? COLORS.warning : COLORS.textMuted, fontWeight: FONTS.weight.semibold }}>
                            {expired ? `${Math.abs(dLeft)}d overdue` : dLeft === 0 ? "Expires today" : `${dLeft}d left`}
                          </div>
                        )}
                      </div>
                    ) : <span style={{ fontSize: FONTS.size.xs, color: COLORS.textMuted }}>Not set</span>}
                  </div>

                  {/* Monthly value */}
                  <div style={{ padding: `${SPACING.md} ${SPACING.base}` }}>
                    <span style={{ fontSize: FONTS.size.sm, fontWeight: FONTS.weight.semibold, color: COLORS.success }}>
                      {price ? fmtRupee(price) : "Custom"}
                    </span>
                  </div>

                  {/* Actions */}
                  <div style={{ padding: `${SPACING.md} ${SPACING.base}`, display: "flex", gap: "6px", justifyContent: "center" }}>
                    <button onClick={() => { setShowLog(true); }} style={{ padding: `4px ${SPACING.sm}`, fontSize: FONTS.size.xs, border: `1px solid ${COLORS.success}55`, borderRadius: RADIUS.base, backgroundColor: COLORS.successMuted, color: COLORS.success, cursor: "pointer", fontFamily: FONTS.family }}>
                      + Payment
                    </button>
                    <button onClick={() => navigate(`/platform/companies/${company.id}`)} style={{ padding: `4px ${SPACING.sm}`, fontSize: FONTS.size.xs, border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.base, backgroundColor: "transparent", color: COLORS.textSecondary, cursor: "pointer", fontFamily: FONTS.family }}>
                      View
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── PAYMENT HISTORY TAB ── */}
        {activeTab === "history" && (
          <div style={{ ...STYLES.card, padding: 0, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1.5fr 100px", backgroundColor: COLORS.surfaceActive, borderBottom: `1px solid ${COLORS.border}` }}>
              {["Company","Plan","Amount","Status","Razorpay ID","Date"].map((h, i) => (
                <div key={h} style={{ ...STYLES.tableHeader, paddingLeft: i === 0 ? SPACING.xl : SPACING.base }}>{h}</div>
              ))}
            </div>

            {loading ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1.5fr 100px", padding: `${SPACING.md} ${SPACING.base}`, gap: SPACING.base, borderBottom: `1px solid ${COLORS.border}`, alignItems: "center" }}>
                <Shimmer h="13px" w="65%" />
                <Shimmer h="20px" w="60px" r={RADIUS.full} />
                <Shimmer h="13px" w="55px" />
                <Shimmer h="20px" w="55px" r={RADIUS.full} />
                <Shimmer h="11px" w="80%" />
                <Shimmer h="11px" w="55px" />
              </div>
            )) : filteredPayments.length === 0 ? (
              <div style={{ textAlign: "center", padding: `${SPACING["3xl"]} 0`, color: COLORS.textMuted }}>No payments recorded yet.</div>
            ) : filteredPayments.map((pay, idx) => {
              const meta = PAY_STATUS_META[pay.status] || PAY_STATUS_META.pending;
              return (
                <div key={pay.id} className="row-hover" style={{
                  display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1.5fr 100px",
                  borderBottom: `1px solid ${COLORS.border}`,
                  backgroundColor: idx % 2 === 0 ? "transparent" : COLORS.surface + "55",
                  alignItems: "center", transition: TRANSITIONS.fast,
                }}>
                  <div style={{ padding: `${SPACING.sm} ${SPACING.xl}`, fontSize: FONTS.size.sm, color: COLORS.textPrimary, fontWeight: FONTS.weight.medium }}>
                    {companyMap[pay.companyId] || pay.companyId || "—"}
                  </div>
                  <div style={{ padding: `${SPACING.sm} ${SPACING.base}` }}>
                    {(() => { const m = PLAN_META[pay.plan] || { color: COLORS.textMuted, bg: COLORS.surfaceActive }; return <span style={{ ...STYLES.badge, backgroundColor: m.bg, color: m.color, fontSize: FONTS.size.xs }}>{pay.plan || "—"}</span>; })()}
                  </div>
                  <div style={{ padding: `${SPACING.sm} ${SPACING.base}`, fontSize: FONTS.size.sm, fontWeight: FONTS.weight.semibold, color: pay.status === "paid" ? COLORS.success : COLORS.textPrimary }}>
                    {fmtRupee(pay.amount)}
                  </div>
                  <div style={{ padding: `${SPACING.sm} ${SPACING.base}` }}>
                    <span style={{ ...STYLES.badge, backgroundColor: meta.bg, color: meta.color, fontSize: FONTS.size.xs }}>{meta.label}</span>
                  </div>
                  <div style={{ padding: `${SPACING.sm} ${SPACING.base}`, fontSize: FONTS.size.xs, color: COLORS.textMuted, fontFamily: FONTS.mono, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {pay.razorpayId || "—"}
                  </div>
                  <div style={{ padding: `${SPACING.sm} ${SPACING.base}`, fontSize: FONTS.size.xs, color: COLORS.textMuted }}>
                    {fmtDate(pay.createdAt)}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── RENEWALS TAB ── */}
        {activeTab === "renewals" && (
          <div style={{ display: "flex", flexDirection: "column", gap: SPACING.sm }}>
            {loading ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ ...STYLES.card, display: "flex", alignItems: "center", gap: SPACING.base }}>
                <Shimmer w="60px" h="60px" r={RADIUS.md} />
                <div style={{ flex: 1 }}><Shimmer h="14px" w="50%" /><div style={{ marginTop: SPACING.xs }}><Shimmer h="11px" w="35%" /></div></div>
                <Shimmer w="80px" h="28px" />
              </div>
            )) : renewals.length === 0 ? (
              <div style={{ ...STYLES.card, textAlign: "center", padding: `${SPACING["3xl"]} 0`, color: COLORS.textMuted }}>
                <div style={{ fontSize: "36px", marginBottom: SPACING.base }}>📅</div>
                <div>No renewal dates set for any company.</div>
              </div>
            ) : renewals.map((company) => {
              const expired  = company.daysLeft < 0;
              const expiring = !expired && company.daysLeft <= 7;
              const ok       = !expired && company.daysLeft > 7;
              const color    = expired ? COLORS.danger : expiring ? COLORS.warning : COLORS.success;

              return (
                <div key={company.id} style={{
                  ...STYLES.card,
                  display: "flex", alignItems: "center", gap: SPACING.base,
                  border: expired ? `1px solid ${COLORS.danger}44` : expiring ? `1px solid ${COLORS.warning}44` : `1px solid ${COLORS.border}`,
                  padding: `${SPACING.base} ${SPACING.xl}`,
                }}>
                  {/* Days ring */}
                  <div style={{
                    width: "64px", height: "64px", borderRadius: RADIUS.lg, flexShrink: 0,
                    backgroundColor: color + "18", border: `2px solid ${color}44`,
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  }}>
                    <div style={{ fontSize: FONTS.size["2xl"], fontWeight: FONTS.weight.bold, color, lineHeight: 1 }}>
                      {expired ? Math.abs(company.daysLeft) : company.daysLeft}
                    </div>
                    <div style={{ fontSize: "9px", color, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {expired ? "past" : "days"}
                    </div>
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: FONTS.size.base, fontWeight: FONTS.weight.semibold, color: COLORS.textPrimary }}>{company.name}</div>
                    <div style={{ fontSize: FONTS.size.xs, color: COLORS.textMuted, marginTop: "2px" }}>
                      {company.plan} · Expires {fmtDate(company.currentPeriodEnd)}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: SPACING.sm, flexShrink: 0 }}>
                    <span style={{ ...STYLES.badge, backgroundColor: color + "18", color, fontSize: FONTS.size.xs, border: `1px solid ${color}44` }}>
                      {expired ? "Expired" : expiring ? "Expiring Soon" : "Active"}
                    </span>
                    <button onClick={() => setShowLog(true)} style={{ padding: `${SPACING.xs} ${SPACING.md}`, fontSize: FONTS.size.xs, border: `1px solid ${COLORS.success}55`, borderRadius: RADIUS.base, backgroundColor: COLORS.successMuted, color: COLORS.success, cursor: "pointer", fontFamily: FONTS.family }}>
                      Renew
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showLog && (
        <LogPaymentModal
          companies={companies}
          onClose={() => setShowLog(false)}
          onLogged={(p) => { setPayments((prev) => [{ id: Date.now().toString(), ...p }, ...prev]); }}
        />
      )}
    </>
  );
};

export default SubscriptionBillingManager;
