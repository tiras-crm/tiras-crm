// TIRAS CRM — Company Detail View
// Role: platform_owner — full drill-down into one specific company
// Route: /platform/companies/:companyId
// Queries: companies/{id}, users where companyId==id, leads where companyId==id (count + stage breakdown),
//          calls where companyId==id (this month), payments where companyId==id

import React, { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  doc, getDoc, collection, query, where, getDocs,
  updateDoc, serverTimestamp, orderBy, limit, Timestamp,
} from "firebase/firestore";
import { db, COLLECTIONS, ROLES } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import {
  COLORS, FONTS, SPACING, RADIUS, SHADOWS, STYLES, TRANSITIONS,
} from "../theme";

// ─── Constants ────────────────────────────────────────────────────────────────

const PLAN_META = {
  Basic:      { color: COLORS.info,    bg: COLORS.infoMuted,    price: "₹1,800/mo"  },
  Growth:     { color: COLORS.accent,  bg: COLORS.accentMuted,  price: "₹3,000/mo"  },
  Enterprise: { color: COLORS.primary, bg: COLORS.primaryMuted, price: "Custom"      },
};

const STATUS_META = {
  active:    { color: COLORS.success,   bg: COLORS.successMuted,  label: "Active"    },
  suspended: { color: COLORS.danger,    bg: COLORS.dangerMuted,   label: "Suspended" },
  trial:     { color: COLORS.warning,   bg: COLORS.warningMuted,  label: "Trial"     },
  inactive:  { color: COLORS.textMuted, bg: COLORS.surfaceActive, label: "Inactive"  },
};

const STAGE_COLORS = {
  New:           COLORS.info,
  Contacted:     "#7B68EE",
  Interested:    COLORS.accent,
  "Follow-up":   COLORS.warning,
  Negotiation:   COLORS.primary,
  "Closed Won":  COLORS.success,
  "Closed Lost": COLORS.danger,
};

const ROLE_LABELS = {
  [ROLES.COMPANY_ADMIN]: "Company Admin",
  [ROLES.MANAGER]:       "Manager",
  [ROLES.AGENT]:         "Agent",
  [ROLES.SUPPORT_AGENT]: "Support Agent",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const startOfMonth = () => {
  const d = new Date(); d.setDate(1); d.setHours(0,0,0,0);
  return Timestamp.fromDate(d);
};

const fmtDate = (ts) => {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

const fmtDateShort = (ts) => {
  if (!ts) return "Never";
  const d    = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7)  return `${diff}d ago`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

const fmtRupee = (n) => {
  if (!n) return "₹0";
  if (n >= 100000) return `₹${(n/100000).toFixed(1)}L`;
  if (n >= 1000)   return `₹${(n/1000).toFixed(1)}K`;
  return `₹${n}`;
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const Shimmer = ({ w = "100%", h = "14px", r = RADIUS.base }) => (
  <div style={{
    width: w, height: h, borderRadius: r,
    background: `linear-gradient(90deg,${COLORS.surface} 25%,#2a2a2a 50%,${COLORS.surface} 75%)`,
    backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite",
  }} />
);

const InfoRow = ({ label, value, valueColor }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: `${SPACING.sm} 0`, borderBottom: `1px solid ${COLORS.border}` }}>
    <span style={{ fontSize: FONTS.size.sm, color: COLORS.textMuted, flexShrink: 0 }}>{label}</span>
    <span style={{ fontSize: FONTS.size.sm, color: valueColor || COLORS.textPrimary, fontWeight: FONTS.weight.medium, textAlign: "right", maxWidth: "60%", wordBreak: "break-word" }}>{value}</span>
  </div>
);

const StatBox = ({ label, value, color, icon }) => (
  <div style={{ ...STYLES.card, textAlign: "center", padding: SPACING.base, flex: "1 1 120px" }}>
    <div style={{ fontSize: "20px", marginBottom: SPACING.xs }}>{icon}</div>
    <div style={{ fontSize: FONTS.size["3xl"], fontWeight: FONTS.weight.bold, color: color || COLORS.textPrimary, lineHeight: 1 }}>{value}</div>
    <div style={{ fontSize: FONTS.size.xs, color: COLORS.textMuted, marginTop: "4px" }}>{label}</div>
  </div>
);

const SectionHeader = ({ title, count, action }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: SPACING.base }}>
    <div style={{ display: "flex", alignItems: "center", gap: SPACING.sm }}>
      <div style={{ width: "3px", height: "18px", backgroundColor: COLORS.primary, borderRadius: RADIUS.full }} />
      <span style={{ fontSize: FONTS.size.base, fontWeight: FONTS.weight.semibold, color: COLORS.textPrimary }}>{title}</span>
      {count !== undefined && (
        <span style={{ ...STYLES.badge, backgroundColor: COLORS.primaryMuted, color: COLORS.primary, fontSize: FONTS.size.xs }}>{count}</span>
      )}
    </div>
    {action}
  </div>
);

// Plan edit modal
const PlanModal = ({ company, onClose, onSaved }) => {
  const [plan, setPlan]     = useState(company.plan || "Basic");
  const [status, setStatus] = useState(company.status || "active");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, COLLECTIONS.COMPANIES, company.id), { plan, status, updatedAt: serverTimestamp() });
      onSaved({ plan, status });
      onClose();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", zIndex: 200 }} />
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
        backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}`,
        borderRadius: RADIUS.xl, padding: SPACING["2xl"], width: "380px",
        boxShadow: SHADOWS.lg, zIndex: 201, fontFamily: FONTS.family,
      }}>
        <div style={{ fontSize: FONTS.size.xl, fontWeight: FONTS.weight.bold, color: COLORS.textPrimary, marginBottom: SPACING.xl }}>
          Edit Plan — {company.name}
        </div>

        <div style={{ marginBottom: SPACING.base }}>
          <label style={{ fontSize: FONTS.size.xs, color: COLORS.textMuted, display: "block", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Plan</label>
          <select value={plan} onChange={(e) => setPlan(e.target.value)} style={{ ...STYLES.input }}>
            <option>Basic</option>
            <option>Growth</option>
            <option>Enterprise</option>
          </select>
        </div>

        <div style={{ marginBottom: SPACING.xl }}>
          <label style={{ fontSize: FONTS.size.xs, color: COLORS.textMuted, display: "block", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ ...STYLES.input }}>
            <option value="active">Active</option>
            <option value="trial">Trial</option>
            <option value="suspended">Suspended</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <div style={{ display: "flex", gap: SPACING.sm }}>
          <button onClick={onClose} style={{ ...STYLES.buttonSecondary, flex: 1, padding: SPACING.sm }}>Cancel</button>
          <button onClick={save} disabled={saving} style={{ ...STYLES.buttonPrimary, flex: 1, padding: SPACING.sm, opacity: saving ? 0.7 : 1 }}>
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const CompanyDetailView = () => {
  const { companyId } = useParams();
  const { isPlatformOwner } = useAuth();
  const navigate = useNavigate();

  const [company, setCompany]   = useState(null);
  const [users, setUsers]       = useState([]);
  const [leads, setLeads]       = useState([]);
  const [callsMonth, setCalls]  = useState(0);
  const [revenue, setRevenue]   = useState(0);
  const [recentLeads, setRecentLeads] = useState([]);

  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [showPlanModal, setShowPlanModal] = useState(false);

  // ─── Fetch ─────────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    if (!companyId) return;
    try {
      setLoading(true);

      // 1. Company document
      const compSnap = await getDoc(doc(db, COLLECTIONS.COMPANIES, companyId));
      if (!compSnap.exists()) { setError("Company not found."); setLoading(false); return; }
      setCompany({ id: compSnap.id, ...compSnap.data() });

      // 2. All users in this company
      const usersSnap = await getDocs(
        query(collection(db, COLLECTIONS.USERS), where("companyId", "==", companyId))
      );
      setUsers(usersSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

      // 3. All leads
      const leadsSnap = await getDocs(
        query(collection(db, COLLECTIONS.LEADS), where("companyId", "==", companyId), limit(5000))
      );
      const allLeads = leadsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setLeads(allLeads);

      // 4. Recent leads (last 5)
      const recentSnap = await getDocs(
        query(collection(db, COLLECTIONS.LEADS), where("companyId", "==", companyId), orderBy("createdAt", "desc"), limit(5))
      );
      setRecentLeads(recentSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

      // 5. Calls this month
      const callsSnap = await getDocs(
        query(
          collection(db, COLLECTIONS.CALLS),
          where("companyId", "==", companyId),
          where("createdAt", ">=", startOfMonth())
        )
      );
      setCalls(callsSnap.size);

      // 6. Revenue (paid payments)
      const paySnap = await getDocs(
        query(
          collection(db, COLLECTIONS.PAYMENTS),
          where("companyId", "==", companyId),
          where("status", "==", "paid")
        )
      );
      const total = paySnap.docs.reduce((s, d) => s + (d.data().amount || 0), 0);
      setRevenue(total);
    } catch (e) {
      console.error("CompanyDetailView fetch error:", e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ─── Derived ───────────────────────────────────────────────────────────

  const stageMap = {};
  leads.forEach((l) => { const s = l.stage || "New"; stageMap[s] = (stageMap[s] || 0) + 1; });
  const stageEntries = Object.entries(stageMap).sort((a, b) => b[1] - a[1]);

  const agentCount   = users.filter((u) => u.role === ROLES.AGENT).length;
  const managerCount = users.filter((u) => u.role === ROLES.MANAGER).length;

  const toggleSuspend = async () => {
    if (!company) return;
    const next = company.status === "suspended" ? "active" : "suspended";
    await updateDoc(doc(db, COLLECTIONS.COMPANIES, company.id), { status: next });
    setCompany((c) => ({ ...c, status: next }));
  };

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
        ::-webkit-scrollbar{width:6px}
        ::-webkit-scrollbar-track{background:${COLORS.scrollbarTrack}}
        ::-webkit-scrollbar-thumb{background:${COLORS.scrollbarThumb};border-radius:3px}
        .tab-btn:hover{color:${COLORS.textPrimary}!important}
      `}</style>

      <div style={{ minHeight: "100vh", backgroundColor: COLORS.background, fontFamily: FONTS.family, color: COLORS.textPrimary }}>

        {/* ── Top bar with back + actions ── */}
        <div style={{ backgroundColor: COLORS.surface, borderBottom: `1px solid ${COLORS.border}`, padding: `${SPACING.base} ${SPACING["2xl"]}`, display: "flex", alignItems: "center", gap: SPACING.base, position: "sticky", top: 0, zIndex: 10 }}>
          <button onClick={() => navigate(-1)} style={{ ...STYLES.buttonSecondary, padding: `${SPACING.xs} ${SPACING.md}`, fontSize: FONTS.size.sm }}>← Back</button>

          {loading ? <Shimmer w="200px" h="20px" /> : (
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: FONTS.size.xl, fontWeight: FONTS.weight.bold, color: COLORS.textPrimary }}>{company?.name || "Company"}</div>
              <div style={{ fontSize: FONTS.size.xs, color: COLORS.textMuted }}>{company?.industry} · {company?.city || "India"}</div>
            </div>
          )}

          {!loading && company && (
            <div style={{ display: "flex", gap: SPACING.sm }}>
              <button onClick={() => setShowPlanModal(true)} style={{ ...STYLES.buttonSecondary, fontSize: FONTS.size.sm, padding: `${SPACING.xs} ${SPACING.base}` }}>✏ Edit Plan</button>
              <button
                onClick={toggleSuspend}
                style={{
                  padding: `${SPACING.xs} ${SPACING.base}`, fontSize: FONTS.size.sm, fontFamily: FONTS.family,
                  border: `1px solid ${company.status === "suspended" ? COLORS.success + "88" : COLORS.danger + "66"}`,
                  borderRadius: RADIUS.base, backgroundColor: "transparent",
                  color: company.status === "suspended" ? COLORS.success : COLORS.danger, cursor: "pointer",
                }}
              >
                {company.status === "suspended" ? "↑ Restore" : "⊘ Suspend"}
              </button>
            </div>
          )}
        </div>

        <div style={{ padding: `${SPACING.xl} ${SPACING["2xl"]}` }}>

          {/* ── Error ── */}
          {error && (
            <div style={{ backgroundColor: COLORS.dangerMuted, border: `1px solid ${COLORS.danger}`, borderRadius: RADIUS.md, padding: SPACING.base, color: COLORS.danger, fontSize: FONTS.size.sm, marginBottom: SPACING.xl }}>⚠ {error}</div>
          )}

          {/* ── Hero stats ── */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: SPACING.base, marginBottom: SPACING["2xl"] }}>
            {loading ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ ...STYLES.card, flex: "1 1 120px", padding: SPACING.base, textAlign: "center" }}>
                <Shimmer h="28px" w="60%" /><div style={{ margin: "6px auto 0" }}><Shimmer h="11px" w="50%" /></div>
              </div>
            )) : (
              <>
                <StatBox icon="📋" label="Total Leads"    value={(leads.length).toLocaleString("en-IN")} color={COLORS.accent} />
                <StatBox icon="👥" label="Agents"         value={agentCount}      color={COLORS.primary} />
                <StatBox icon="🧑‍💼" label="Managers"      value={managerCount}    color={COLORS.info}    />
                <StatBox icon="📞" label="Calls (Month)"  value={callsMonth}      color={COLORS.success} />
                <StatBox icon="💰" label="Total Revenue"  value={fmtRupee(revenue)} color={COLORS.warning} />
              </>
            )}
          </div>

          {/* ── Tabs ── */}
          <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${COLORS.border}`, marginBottom: SPACING.xl }}>
            {["overview", "users", "leads", "activity"].map((tab) => (
              <button key={tab} className="tab-btn" onClick={() => setActiveTab(tab)} style={{
                padding: `${SPACING.sm} ${SPACING.xl}`, fontSize: FONTS.size.sm,
                fontWeight: activeTab === tab ? FONTS.weight.semibold : FONTS.weight.regular,
                fontFamily: FONTS.family, cursor: "pointer", border: "none", background: "none",
                color: activeTab === tab ? COLORS.primary : COLORS.textSecondary,
                borderBottom: activeTab === tab ? `2px solid ${COLORS.primary}` : "2px solid transparent",
                transition: TRANSITIONS.fast, textTransform: "capitalize",
                marginBottom: "-1px",
              }}>
                {tab}
              </button>
            ))}
          </div>

          {/* ── OVERVIEW TAB ── */}
          {activeTab === "overview" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: SPACING.base }}>
              {/* Company info */}
              <div style={{ ...STYLES.card }}>
                <SectionHeader title="Company Information" />
                {loading ? Array.from({ length: 6 }).map((_, i) => <div key={i} style={{ marginBottom: SPACING.sm }}><Shimmer h="14px" /></div>) : (
                  <>
                    <InfoRow label="Company Name"   value={company?.name || "—"} />
                    <InfoRow label="Admin Email"     value={company?.adminEmail || "—"} />
                    <InfoRow label="Industry"        value={company?.industry || "—"} />
                    <InfoRow label="City"            value={company?.city || "—"} />
                    <InfoRow label="Phone"           value={company?.phone || "—"} />
                    <InfoRow label="Plan"            value={company?.plan || "—"} valueColor={PLAN_META[company?.plan]?.color} />
                    <InfoRow label="Status"          value={STATUS_META[company?.status]?.label || "Active"} valueColor={STATUS_META[company?.status]?.color} />
                    <InfoRow label="Joined"          value={fmtDate(company?.createdAt)} />
                    <InfoRow label="Last Active"     value={fmtDateShort(company?.lastActiveAt)} />
                  </>
                )}
              </div>

              {/* Leads by stage */}
              <div style={{ ...STYLES.card }}>
                <SectionHeader title="Pipeline Breakdown" count={leads.length} />
                {loading ? Array.from({ length: 5 }).map((_, i) => <div key={i} style={{ marginBottom: SPACING.sm }}><Shimmer h="28px" /></div>) :
                  stageEntries.length === 0 ? (
                    <div style={{ textAlign: "center", padding: `${SPACING["3xl"]} 0`, color: COLORS.textMuted, fontSize: FONTS.size.sm }}>No leads yet.</div>
                  ) : stageEntries.map(([stage, count]) => {
                    const max = Math.max(...stageEntries.map(([, c]) => c), 1);
                    const pct = (count / max) * 100;
                    const col = STAGE_COLORS[stage] || COLORS.textMuted;
                    return (
                      <div key={stage} style={{ display: "flex", alignItems: "center", gap: SPACING.sm, marginBottom: SPACING.sm }}>
                        <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: col, flexShrink: 0 }} />
                        <div style={{ fontSize: FONTS.size.sm, color: COLORS.textSecondary, width: "110px", flexShrink: 0 }}>{stage}</div>
                        <div style={{ flex: 1, height: "6px", borderRadius: RADIUS.full, backgroundColor: COLORS.border, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${pct}%`, backgroundColor: col, borderRadius: RADIUS.full }} />
                        </div>
                        <div style={{ fontSize: FONTS.size.sm, fontWeight: FONTS.weight.semibold, color: COLORS.textPrimary, width: "28px", textAlign: "right", flexShrink: 0 }}>{count}</div>
                      </div>
                    );
                  })
                }
              </div>
            </div>
          )}

          {/* ── USERS TAB ── */}
          {activeTab === "users" && (
            <div style={{ ...STYLES.card, padding: 0, overflow: "hidden" }}>
              <div style={{ padding: `${SPACING.base} ${SPACING.xl}`, borderBottom: `1px solid ${COLORS.border}` }}>
                <div style={{ fontSize: FONTS.size.base, fontWeight: FONTS.weight.semibold }}>
                  Team Members <span style={{ ...STYLES.badge, backgroundColor: COLORS.primaryMuted, color: COLORS.primary, marginLeft: SPACING.xs, fontSize: FONTS.size.xs }}>{users.length}</span>
                </div>
              </div>
              {/* Header */}
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 1fr 100px", backgroundColor: COLORS.surfaceActive, borderBottom: `1px solid ${COLORS.border}` }}>
                {["Name & Email", "Role", "Manager", "Last Login", "Status"].map((h) => (
                  <div key={h} style={{ ...STYLES.tableHeader, paddingLeft: SPACING.xl }}>{h}</div>
                ))}
              </div>
              {loading ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 1fr 100px", padding: `${SPACING.md} ${SPACING.xl}`, gap: SPACING.base, borderBottom: `1px solid ${COLORS.border}`, alignItems: "center" }}>
                  <div><Shimmer h="13px" w="55%" /><div style={{ marginTop: "4px" }}><Shimmer h="11px" w="75%" /></div></div>
                  <Shimmer h="20px" w="80px" r={RADIUS.full} />
                  <Shimmer h="11px" w="70%" />
                  <Shimmer h="11px" w="55px" />
                  <Shimmer h="20px" w="60px" r={RADIUS.full} />
                </div>
              )) : users.length === 0 ? (
                <div style={{ textAlign: "center", padding: `${SPACING["3xl"]} 0`, color: COLORS.textMuted, fontSize: FONTS.size.sm }}>No users in this company.</div>
              ) : users.map((user, idx) => (
                <div key={user.id} style={{
                  display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 1fr 100px",
                  borderBottom: `1px solid ${COLORS.border}`,
                  backgroundColor: idx % 2 === 0 ? "transparent" : COLORS.surface + "55",
                  alignItems: "center",
                }}>
                  <div style={{ padding: `${SPACING.md} ${SPACING.xl}` }}>
                    <div style={{ fontSize: FONTS.size.sm, fontWeight: FONTS.weight.medium, color: COLORS.textPrimary }}>{user.displayName || "—"}</div>
                    <div style={{ fontSize: FONTS.size.xs, color: COLORS.textMuted, marginTop: "2px" }}>{user.email}</div>
                  </div>
                  <div style={{ padding: `${SPACING.md} ${SPACING.xl}` }}>
                    <span style={{ ...STYLES.badge, fontSize: FONTS.size.xs, backgroundColor: COLORS.primaryMuted, color: COLORS.primary }}>
                      {ROLE_LABELS[user.role] || user.role || "—"}
                    </span>
                  </div>
                  <div style={{ padding: `${SPACING.md} ${SPACING.xl}`, fontSize: FONTS.size.xs, color: COLORS.textSecondary }}>
                    {user.managerId ? "Assigned" : "—"}
                  </div>
                  <div style={{ padding: `${SPACING.md} ${SPACING.xl}`, fontSize: FONTS.size.xs, color: COLORS.textMuted }}>
                    {fmtDateShort(user.lastLoginAt)}
                  </div>
                  <div style={{ padding: `${SPACING.md} ${SPACING.xl}` }}>
                    <span style={{ ...STYLES.badge, fontSize: FONTS.size.xs, backgroundColor: user.isActive !== false ? COLORS.successMuted : COLORS.dangerMuted, color: user.isActive !== false ? COLORS.success : COLORS.danger }}>
                      {user.isActive !== false ? "Active" : "Off"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── LEADS TAB ── */}
          {activeTab === "leads" && (
            <div style={{ ...STYLES.card, padding: 0, overflow: "hidden" }}>
              <div style={{ padding: `${SPACING.base} ${SPACING.xl}`, borderBottom: `1px solid ${COLORS.border}`, display: "flex", alignItems: "center", gap: SPACING.base }}>
                <div style={{ fontSize: FONTS.size.base, fontWeight: FONTS.weight.semibold }}>
                  Recent Leads <span style={{ ...STYLES.badge, backgroundColor: COLORS.primaryMuted, color: COLORS.primary, marginLeft: SPACING.xs, fontSize: FONTS.size.xs }}>{leads.length} total</span>
                </div>
                <div style={{ marginLeft: "auto", fontSize: FONTS.size.xs, color: COLORS.textMuted }}>Showing last 5</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 1fr 100px", backgroundColor: COLORS.surfaceActive, borderBottom: `1px solid ${COLORS.border}` }}>
                {["Lead Name", "Phone", "Stage", "Agent", "Added"].map((h) => (
                  <div key={h} style={{ ...STYLES.tableHeader, paddingLeft: SPACING.xl }}>{h}</div>
                ))}
              </div>
              {loading ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 1fr 100px", padding: `${SPACING.md} ${SPACING.xl}`, gap: SPACING.base, borderBottom: `1px solid ${COLORS.border}`, alignItems: "center" }}>
                  <Shimmer h="13px" w="65%" />
                  <Shimmer h="11px" w="70%" />
                  <Shimmer h="20px" w="70px" r={RADIUS.full} />
                  <Shimmer h="11px" w="60%" />
                  <Shimmer h="11px" w="50px" />
                </div>
              )) : recentLeads.length === 0 ? (
                <div style={{ textAlign: "center", padding: `${SPACING["3xl"]} 0`, color: COLORS.textMuted, fontSize: FONTS.size.sm }}>No leads in this company yet.</div>
              ) : recentLeads.map((lead, idx) => (
                <div key={lead.id} style={{
                  display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 1fr 100px",
                  borderBottom: `1px solid ${COLORS.border}`,
                  backgroundColor: idx % 2 === 0 ? "transparent" : COLORS.surface + "55",
                  alignItems: "center",
                }}>
                  <div style={{ padding: `${SPACING.md} ${SPACING.xl}`, fontSize: FONTS.size.sm, fontWeight: FONTS.weight.medium, color: COLORS.textPrimary }}>{lead.name || "—"}</div>
                  <div style={{ padding: `${SPACING.md} ${SPACING.xl}`, fontSize: FONTS.size.xs, color: COLORS.textSecondary, fontFamily: FONTS.mono }}>{lead.phone || "—"}</div>
                  <div style={{ padding: `${SPACING.md} ${SPACING.xl}` }}>
                    <span style={{ ...STYLES.badge, fontSize: FONTS.size.xs, backgroundColor: (STAGE_COLORS[lead.stage || "New"] || COLORS.textMuted) + "26", color: STAGE_COLORS[lead.stage || "New"] || COLORS.textMuted }}>
                      {lead.stage || "New"}
                    </span>
                  </div>
                  <div style={{ padding: `${SPACING.md} ${SPACING.xl}`, fontSize: FONTS.size.xs, color: COLORS.textMuted }}>{lead.agentId ? "Assigned" : "Unassigned"}</div>
                  <div style={{ padding: `${SPACING.md} ${SPACING.xl}`, fontSize: FONTS.size.xs, color: COLORS.textMuted }}>{fmtDateShort(lead.createdAt)}</div>
                </div>
              ))}
            </div>
          )}

          {/* ── ACTIVITY TAB ── */}
          {activeTab === "activity" && (
            <div style={{ ...STYLES.card, textAlign: "center", padding: `${SPACING["5xl"]} 0`, color: COLORS.textMuted }}>
              <div style={{ fontSize: "36px", marginBottom: SPACING.base }}>📊</div>
              <div style={{ fontSize: FONTS.size.base, color: COLORS.textSecondary }}>Detailed activity log coming in Phase 2.</div>
              <div style={{ fontSize: FONTS.size.sm, marginTop: SPACING.xs }}>Will show call logs, stage changes, and team actions.</div>
            </div>
          )}
        </div>
      </div>

      {showPlanModal && company && (
        <PlanModal
          company={company}
          onClose={() => setShowPlanModal(false)}
          onSaved={(updates) => setCompany((c) => ({ ...c, ...updates }))}
        />
      )}
    </>
  );
};

export default CompanyDetailView;
