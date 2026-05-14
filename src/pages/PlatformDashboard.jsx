// TIRAS CRM — Platform Dashboard
// Role: platform_owner (Tony) — sees ALL companies on the platform
// No companyId filter anywhere — this is the god-level view
// Queries: companies (all), payments (this month, all), leads (count, all), calls (today, all)

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  Timestamp,
  orderBy,
  limit,
} from "firebase/firestore";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import { db, COLLECTIONS } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import {
  COLORS, FONTS, SPACING, RADIUS, SHADOWS, STYLES, TRANSITIONS,
} from "../theme";

// ─── Constants ────────────────────────────────────────────────────────────────

const PLAN_META = {
  Basic:      { color: COLORS.info,     bg: COLORS.infoMuted    },
  Growth:     { color: COLORS.accent,   bg: COLORS.accentMuted  },
  Enterprise: { color: COLORS.primary,  bg: COLORS.primaryMuted },
};

const STATUS_META = {
  active:    { color: COLORS.success, bg: COLORS.successMuted, label: "Active"    },
  inactive:  { color: COLORS.textMuted, bg: COLORS.surfaceActive, label: "Inactive" },
  suspended: { color: COLORS.danger,  bg: COLORS.dangerMuted,  label: "Suspended" },
  trial:     { color: COLORS.warning, bg: COLORS.warningMuted, label: "Trial"     },
};

const MONTH_NAMES_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const startOfToday = () => {
  const d = new Date(); d.setHours(0,0,0,0); return Timestamp.fromDate(d);
};

const startOfMonth = () => {
  const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return Timestamp.fromDate(d);
};

const build6MonthSkeleton = () => {
  const result = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    result.push({ label: MONTH_NAMES_SHORT[d.getMonth()], year: d.getFullYear(), month: d.getMonth(), companies: 0 });
  }
  return result;
};

const fmtRupee = (n) => {
  if (!n) return "₹0";
  if (n >= 100000) return `₹${(n/100000).toFixed(1)}L`;
  if (n >= 1000)   return `₹${(n/1000).toFixed(1)}K`;
  return `₹${n}`;
};

const fmtDate = (ts) => {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7)  return `${diff}d ago`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const Shimmer = ({ width = "100%", height = "16px", radius = RADIUS.base }) => (
  <div style={{
    width, height, borderRadius: radius,
    background: `linear-gradient(90deg, ${COLORS.surface} 25%, #2a2a2a 50%, ${COLORS.surface} 75%)`,
    backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite",
  }} />
);

const StatCard = ({ icon, label, value, sub, color, trend, loading }) => (
  <div style={{
    ...STYLES.card,
    flex: "1 1 200px",
    padding: SPACING.xl,
    position: "relative",
    overflow: "hidden",
  }}>
    <div style={{
      position: "absolute", top: "-16px", right: "-16px",
      width: "72px", height: "72px", borderRadius: "50%",
      backgroundColor: (color || COLORS.primary) + "14", pointerEvents: "none",
    }} />
    {loading ? (
      <>
        <Shimmer width="28px" height="28px" radius={RADIUS.md} />
        <div style={{ marginTop: SPACING.md }}><Shimmer height="36px" width="50%" /></div>
        <div style={{ marginTop: SPACING.sm }}><Shimmer height="13px" width="70%" /></div>
      </>
    ) : (
      <>
        <div style={{ fontSize: "22px", marginBottom: SPACING.sm }}>{icon}</div>
        <div style={{ fontSize: FONTS.size["4xl"], fontWeight: FONTS.weight.bold, color: color || COLORS.textPrimary, lineHeight: 1 }}>
          {value}
        </div>
        <div style={{ fontSize: FONTS.size.sm, fontWeight: FONTS.weight.semibold, color: COLORS.textPrimary, marginTop: SPACING.xs }}>{label}</div>
        {sub && <div style={{ fontSize: FONTS.size.xs, color: COLORS.textMuted, marginTop: "2px" }}>{sub}</div>}
        {trend !== undefined && (
          <div style={{ fontSize: FONTS.size.xs, color: trend >= 0 ? COLORS.success : COLORS.danger, marginTop: SPACING.xs, fontWeight: FONTS.weight.semibold }}>
            {trend >= 0 ? "↑" : "↓"} {Math.abs(trend)}% vs last month
          </div>
        )}
      </>
    )}
  </div>
);

const PlanBadge = ({ plan }) => {
  const meta = PLAN_META[plan] || { color: COLORS.textMuted, bg: COLORS.surfaceActive };
  return (
    <span style={{ ...STYLES.badge, backgroundColor: meta.bg, color: meta.color, border: `1px solid ${meta.color}33`, fontSize: FONTS.size.xs }}>
      {plan || "—"}
    </span>
  );
};

const StatusBadge = ({ status }) => {
  const meta = STATUS_META[status] || STATUS_META.inactive;
  return (
    <span style={{ ...STYLES.badge, backgroundColor: meta.bg, color: meta.color, fontSize: FONTS.size.xs }}>
      <span style={{ width: "5px", height: "5px", borderRadius: "50%", backgroundColor: meta.color, display: "inline-block" }} />
      {meta.label}
    </span>
  );
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ backgroundColor: "#1E1E1E", border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.md, padding: `${SPACING.sm} ${SPACING.base}`, boxShadow: SHADOWS.md }}>
      <div style={{ fontSize: FONTS.size.xs, color: COLORS.textMuted, marginBottom: "2px" }}>{label}</div>
      <div style={{ fontSize: FONTS.size.lg, fontWeight: FONTS.weight.bold, color: COLORS.primary }}>
        {payload[0].value} {payload[0].value === 1 ? "company" : "companies"}
      </div>
    </div>
  );
};

// Suspend confirm modal
const SuspendModal = ({ company, onConfirm, onCancel, loading }) => (
  <>
    <div onClick={onCancel} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", zIndex: 200 }} />
    <div style={{
      position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
      backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}`,
      borderRadius: RADIUS.xl, padding: SPACING["2xl"], width: "400px",
      boxShadow: SHADOWS.lg, zIndex: 201, fontFamily: FONTS.family,
    }}>
      <div style={{ fontSize: "36px", textAlign: "center", marginBottom: SPACING.base }}>⚠️</div>
      <div style={{ fontSize: FONTS.size.xl, fontWeight: FONTS.weight.bold, color: COLORS.textPrimary, textAlign: "center", marginBottom: SPACING.sm }}>
        Suspend Company?
      </div>
      <div style={{ fontSize: FONTS.size.sm, color: COLORS.textSecondary, textAlign: "center", marginBottom: SPACING["2xl"] }}>
        <strong style={{ color: COLORS.textPrimary }}>{company?.name}</strong> will lose access immediately. All data is preserved.
      </div>
      <div style={{ display: "flex", gap: SPACING.sm }}>
        <button onClick={onCancel} style={{ ...STYLES.buttonSecondary, flex: 1, padding: SPACING.sm }}>Cancel</button>
        <button
          onClick={onConfirm}
          disabled={loading}
          style={{ ...STYLES.buttonPrimary, flex: 1, padding: SPACING.sm, backgroundColor: COLORS.danger, boxShadow: "none", opacity: loading ? 0.6 : 1 }}
        >
          {loading ? "Suspending…" : "Suspend"}
        </button>
      </div>
    </div>
  </>
);

// ─── Main Component ───────────────────────────────────────────────────────────

export const PlatformDashboard = () => {
  const { isPlatformOwner } = useAuth();
  const navigate = useNavigate();

  const [companies, setCompanies]   = useState([]);
  const [revenueTotal, setRevenue]  = useState(0);
  const [totalLeads, setLeads]      = useState(0);
  const [callsToday, setCallsToday] = useState(0);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [suspendTarget, setSuspendTarget] = useState(null);
  const [suspending, setSuspending] = useState(false);
  const [sortCol, setSortCol]       = useState("createdAt");
  const [sortDir, setSortDir]       = useState("desc");
  const [search, setSearch]         = useState("");

  // ─── Fetch ──────────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const todayTs = startOfToday();
      const monthTs = startOfMonth();

      // 1. All companies (no filter — platform owner sees everything)
      const companiesSnap = await getDocs(
        query(collection(db, COLLECTIONS.COMPANIES), orderBy("createdAt", "desc"))
      );
      const fetchedCompanies = companiesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setCompanies(fetchedCompanies);

      // 2. Revenue this month — sum all paid payments
      const paymentsSnap = await getDocs(
        query(
          collection(db, COLLECTIONS.PAYMENTS),
          where("status", "==", "paid"),
          where("createdAt", ">=", monthTs)
        )
      );
      const revenue = paymentsSnap.docs.reduce((sum, d) => sum + (d.data().amount || 0), 0);
      setRevenue(revenue);

      // 3. Total leads across platform — count only (Firestore count query)
      // We use a lightweight query — just get all docs (for now; use count() API in production)
      const leadsSnap = await getDocs(
        query(collection(db, COLLECTIONS.LEADS), limit(10000))
      );
      setLeads(leadsSnap.size);

      // 4. Calls today across all companies
      const callsSnap = await getDocs(
        query(
          collection(db, COLLECTIONS.CALLS),
          where("createdAt", ">=", todayTs)
        )
      );
      setCallsToday(callsSnap.size);
    } catch (err) {
      console.error("PlatformDashboard fetch error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ─── Suspend / Reactivate ────────────────────────────────────────────────

  const handleSuspend = async () => {
    if (!suspendTarget) return;
    setSuspending(true);
    try {
      const newStatus = suspendTarget.status === "suspended" ? "active" : "suspended";
      await updateDoc(doc(db, COLLECTIONS.COMPANIES, suspendTarget.id), { status: newStatus });
      setCompanies((prev) =>
        prev.map((c) => c.id === suspendTarget.id ? { ...c, status: newStatus } : c)
      );
    } catch (err) {
      console.error("Suspend error:", err);
    } finally {
      setSuspending(false);
      setSuspendTarget(null);
    }
  };

  // ─── Derived stats ────────────────────────────────────────────────────────

  const activeCount    = companies.filter((c) => c.status === "active").length;
  const inactiveCount  = companies.filter((c) => c.status !== "active").length;
  const newThisMonth   = companies.filter((c) => {
    const ts = c.createdAt?.seconds;
    if (!ts) return false;
    return ts * 1000 >= startOfMonth().toMillis();
  }).length;

  // Signup chart — last 6 months
  const chartData = useMemo(() => {
    const skeleton = build6MonthSkeleton();
    companies.forEach((c) => {
      const d = c.createdAt?.toDate ? c.createdAt.toDate() : null;
      if (!d) return;
      const slot = skeleton.find((s) => s.month === d.getMonth() && s.year === d.getFullYear());
      if (slot) slot.companies += 1;
    });
    return skeleton;
  }, [companies]);

  // Sorted + filtered table
  const tableData = useMemo(() => {
    let result = [...companies];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          (c.name || "").toLowerCase().includes(q) ||
          (c.adminEmail || "").toLowerCase().includes(q) ||
          (c.industry || "").toLowerCase().includes(q)
      );
    }
    result.sort((a, b) => {
      let aV, bV;
      if (sortCol === "name") {
        aV = (a.name || "").toLowerCase();
        bV = (b.name || "").toLowerCase();
        return sortDir === "asc" ? aV.localeCompare(bV) : bV.localeCompare(aV);
      }
      if (sortCol === "agentCount") { aV = a.agentCount || 0; bV = b.agentCount || 0; }
      else { aV = a.createdAt?.seconds || 0; bV = b.createdAt?.seconds || 0; }
      return sortDir === "asc" ? aV - bV : bV - aV;
    });
    return result;
  }, [companies, search, sortCol, sortDir]);

  const handleSort = (col) => {
    if (sortCol === col) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("desc"); }
  };

  const SortArrow = ({ col }) =>
    sortCol !== col
      ? <span style={{ color: COLORS.textMuted, fontSize: "10px", marginLeft: "3px" }}>↕</span>
      : <span style={{ color: COLORS.primary, fontSize: "10px", marginLeft: "3px" }}>{sortDir === "asc" ? "↑" : "↓"}</span>;

  // ─── Access guard ────────────────────────────────────────────────────────

  if (!isPlatformOwner) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: COLORS.background, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONTS.family }}>
        <div style={{ textAlign: "center", color: COLORS.textMuted }}>
          <div style={{ fontSize: "40px" }}>🔒</div>
          <div style={{ fontSize: FONTS.size.lg, marginTop: SPACING.base }}>Platform Owner access required.</div>
        </div>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        ::-webkit-scrollbar{width:6px;height:6px}
        ::-webkit-scrollbar-track{background:${COLORS.scrollbarTrack}}
        ::-webkit-scrollbar-thumb{background:${COLORS.scrollbarThumb};border-radius:3px}
        .co-row:hover{background-color:${COLORS.surfaceHover}!important}
        .action-btn:hover{border-color:${COLORS.primary}!important;color:${COLORS.primary}!important}
      `}</style>

      <div style={{ minHeight: "100vh", backgroundColor: COLORS.background, padding: `${SPACING.xl} ${SPACING["2xl"]}`, fontFamily: FONTS.family, color: COLORS.textPrimary }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: SPACING["2xl"] }}>
          <div>
            <div style={{ fontSize: FONTS.size.xs, fontWeight: FONTS.weight.semibold, color: COLORS.accent, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: SPACING.xs }}>
              TIRAS Platform · Owner View
            </div>
            <h1 style={{ fontSize: FONTS.size["4xl"], fontWeight: FONTS.weight.bold, color: COLORS.textPrimary, margin: 0, lineHeight: 1.1 }}>
              Platform Dashboard
            </h1>
            <div style={{ fontSize: FONTS.size.sm, color: COLORS.textSecondary, marginTop: SPACING.xs }}>
              {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </div>
          </div>
          <div style={{ display: "flex", gap: SPACING.sm }}>
            <button onClick={() => navigate("/platform/companies")} style={{ ...STYLES.buttonSecondary, fontSize: FONTS.size.sm, padding: `${SPACING.sm} ${SPACING.base}` }}>
              🏢 All Companies
            </button>
            <button onClick={fetchAll} style={{ ...STYLES.buttonSecondary, fontSize: FONTS.size.sm, padding: `${SPACING.sm} ${SPACING.base}` }}>
              ↻ Refresh
            </button>
          </div>
        </div>

        {/* ── Error ── */}
        {error && (
          <div style={{ backgroundColor: COLORS.dangerMuted, border: `1px solid ${COLORS.danger}`, borderRadius: RADIUS.md, padding: SPACING.base, color: COLORS.danger, fontSize: FONTS.size.sm, marginBottom: SPACING.xl }}>
            ⚠ {error}
          </div>
        )}

        {/* ── Stat Cards ── */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: SPACING.base, marginBottom: SPACING["2xl"] }}>
          <StatCard icon="🏢" label="Total Companies" value={loading ? "—" : companies.length} sub={loading ? "" : `${activeCount} active · ${inactiveCount} inactive`} color={COLORS.primary} loading={loading} />
          <StatCard icon="💰" label="Revenue This Month" value={loading ? "—" : fmtRupee(revenueTotal)} sub="from all subscriptions" color={COLORS.success} loading={loading} />
          <StatCard icon="📋" label="Total Leads" value={loading ? "—" : totalLeads.toLocaleString("en-IN")} sub="across entire platform" color={COLORS.accent} loading={loading} />
          <StatCard icon="📞" label="Calls Today" value={loading ? "—" : callsToday} sub="across all companies" color={COLORS.info} loading={loading} />
          <StatCard icon="🆕" label="New This Month" value={loading ? "—" : newThisMonth} sub="companies joined" color={COLORS.warning} loading={loading} />
        </div>

        {/* ── Chart + Quick Stats ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: SPACING.base, marginBottom: SPACING.base }}>

          {/* Signup trend chart */}
          <div style={{ ...STYLES.card }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: SPACING.base }}>
              <div>
                <div style={{ fontSize: FONTS.size.base, fontWeight: FONTS.weight.semibold, color: COLORS.textPrimary }}>Company Signups — Last 6 Months</div>
                <div style={{ fontSize: FONTS.size.xs, color: COLORS.textMuted, marginTop: "2px" }}>Monthly new companies joining TIRAS</div>
              </div>
            </div>
            {loading ? <Shimmer height="220px" /> : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="copperGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={COLORS.primary} stopOpacity={0.4} />
                      <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0}   />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: COLORS.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: COLORS.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ stroke: COLORS.primary + "44", strokeWidth: 1 }} />
                  <Area type="monotone" dataKey="companies" stroke={COLORS.primary} strokeWidth={2.5} fill="url(#copperGrad)" dot={{ fill: COLORS.primary, r: 4, strokeWidth: 0 }} activeDot={{ r: 6, fill: COLORS.accent }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Plan breakdown */}
          <div style={{ ...STYLES.card, display: "flex", flexDirection: "column", gap: SPACING.base }}>
            <div style={{ fontSize: FONTS.size.base, fontWeight: FONTS.weight.semibold, color: COLORS.textPrimary }}>Plan Breakdown</div>
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => <Shimmer key={i} height="52px" />)
            ) : (
              ["Basic", "Growth", "Enterprise"].map((plan) => {
                const count = companies.filter((c) => c.plan === plan).length;
                const pct   = companies.length > 0 ? (count / companies.length) * 100 : 0;
                const meta  = PLAN_META[plan];
                return (
                  <div key={plan}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                      <span style={{ fontSize: FONTS.size.sm, color: COLORS.textSecondary }}>{plan}</span>
                      <span style={{ fontSize: FONTS.size.sm, fontWeight: FONTS.weight.bold, color: meta.color }}>{count}</span>
                    </div>
                    <div style={{ height: "8px", borderRadius: RADIUS.full, backgroundColor: COLORS.border, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, backgroundColor: meta.color, borderRadius: RADIUS.full, transition: "width 0.5s ease" }} />
                    </div>
                    <div style={{ fontSize: FONTS.size.xs, color: COLORS.textMuted, marginTop: "2px" }}>
                      {count === 0 ? "No companies" : `${Math.round(pct)}% of platform`}
                    </div>
                  </div>
                );
              })
            )}

            <div style={{ borderTop: `1px solid ${COLORS.border}`, paddingTop: SPACING.base, marginTop: "auto" }}>
              <div style={{ fontSize: FONTS.size.xs, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: SPACING.sm }}>Status</div>
              {["active", "suspended", "trial"].map((s) => {
                const cnt  = companies.filter((c) => c.status === s).length;
                const meta = STATUS_META[s];
                return (
                  <div key={s} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: SPACING.xs }}>
                    <div style={{ display: "flex", alignItems: "center", gap: SPACING.xs }}>
                      <div style={{ width: "7px", height: "7px", borderRadius: "50%", backgroundColor: meta.color }} />
                      <span style={{ fontSize: FONTS.size.sm, color: COLORS.textSecondary }}>{meta.label}</span>
                    </div>
                    <span style={{ fontSize: FONTS.size.sm, fontWeight: FONTS.weight.semibold, color: COLORS.textPrimary }}>{cnt}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Companies Table ── */}
        <div style={{ ...STYLES.card, padding: 0, overflow: "hidden" }}>
          {/* Table toolbar */}
          <div style={{ padding: `${SPACING.base} ${SPACING.xl}`, borderBottom: `1px solid ${COLORS.border}`, display: "flex", alignItems: "center", gap: SPACING.base }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: FONTS.size.base, fontWeight: FONTS.weight.semibold, color: COLORS.textPrimary }}>
                All Companies
              </div>
              <div style={{ fontSize: FONTS.size.xs, color: COLORS.textMuted, marginTop: "2px" }}>
                {tableData.length} of {companies.length} shown
              </div>
            </div>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: SPACING.sm, top: "50%", transform: "translateY(-50%)", color: COLORS.textMuted, pointerEvents: "none" }}>🔍</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search companies…"
                style={{ ...STYLES.input, paddingLeft: "30px", width: "220px", padding: `${SPACING.xs} ${SPACING.md}`, paddingLeft: "28px", fontSize: FONTS.size.sm }}
              />
            </div>
            <button onClick={() => navigate("/platform/companies/new")} style={{ ...STYLES.buttonPrimary, fontSize: FONTS.size.sm, padding: `${SPACING.xs} ${SPACING.base}` }}>
              + Add Company
            </button>
          </div>

          {/* Table header */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 1fr 100px 100px 120px 180px", backgroundColor: COLORS.surfaceActive, borderBottom: `1px solid ${COLORS.border}` }}>
            {[
              { label: "Company",     col: "name",       pl: SPACING.xl },
              { label: "Plan",        col: null          },
              { label: "Admin",       col: null          },
              { label: "Agents",      col: "agentCount"  },
              { label: "Last Active", col: null          },
              { label: "Status",      col: null          },
              { label: "Actions",     col: null, center: true },
            ].map(({ label, col, pl, center }) => (
              <div
                key={label}
                onClick={col ? () => handleSort(col) : undefined}
                style={{
                  ...STYLES.tableHeader,
                  paddingLeft: pl || SPACING.base,
                  cursor: col ? "pointer" : "default",
                  textAlign: center ? "center" : "left",
                }}
              >
                {label}{col && <SortArrow col={col} />}
              </div>
            ))}
          </div>

          {/* Loading skeleton */}
          {loading && Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 1fr 100px 100px 120px 180px", borderBottom: `1px solid ${COLORS.border}`, padding: `${SPACING.md} ${SPACING.base}`, gap: SPACING.base, alignItems: "center" }}>
              <div style={{ paddingLeft: SPACING.sm }}><Shimmer height="14px" width="65%" /><div style={{ marginTop: "4px" }}><Shimmer height="11px" width="40%" /></div></div>
              <Shimmer height="20px" width="70px" radius={RADIUS.full} />
              <Shimmer height="13px" width="80%" />
              <Shimmer height="13px" width="30px" />
              <Shimmer height="11px" width="55px" />
              <Shimmer height="20px" width="70px" radius={RADIUS.full} />
              <div style={{ display: "flex", gap: "6px" }}><Shimmer height="28px" width="56px" radius={RADIUS.base} /><Shimmer height="28px" width="56px" radius={RADIUS.base} /><Shimmer height="28px" width="56px" radius={RADIUS.base} /></div>
            </div>
          ))}

          {/* Empty */}
          {!loading && tableData.length === 0 && (
            <div style={{ textAlign: "center", padding: `${SPACING["5xl"]} 0`, color: COLORS.textMuted }}>
              <div style={{ fontSize: "36px", marginBottom: SPACING.base }}>🏢</div>
              <div style={{ fontSize: FONTS.size.base }}>{search ? "No companies match your search" : "No companies onboarded yet"}</div>
            </div>
          )}

          {/* Rows */}
          {!loading && tableData.map((company, idx) => (
            <div
              key={company.id}
              className="co-row"
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1.2fr 1fr 100px 100px 120px 180px",
                borderBottom: `1px solid ${COLORS.border}`,
                backgroundColor: idx % 2 === 0 ? "transparent" : COLORS.surface + "55",
                transition: TRANSITIONS.fast,
                alignItems: "center",
              }}
            >
              {/* Company name + industry */}
              <div style={{ padding: `${SPACING.md} ${SPACING.base}`, paddingLeft: SPACING.xl }}>
                <div style={{ fontSize: FONTS.size.base, fontWeight: FONTS.weight.medium, color: COLORS.textPrimary, display: "flex", alignItems: "center", gap: SPACING.xs }}>
                  {company.name || "Unnamed"}
                </div>
                <div style={{ fontSize: FONTS.size.xs, color: COLORS.textMuted, marginTop: "2px" }}>
                  {company.industry || "General"} · {company.city || "India"}
                </div>
              </div>

              {/* Plan */}
              <div style={{ padding: `${SPACING.md} ${SPACING.base}` }}>
                <PlanBadge plan={company.plan} />
              </div>

              {/* Admin email */}
              <div style={{ padding: `${SPACING.md} ${SPACING.base}` }}>
                <div style={{ fontSize: FONTS.size.xs, color: COLORS.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {company.adminEmail || "—"}
                </div>
              </div>

              {/* Agent count */}
              <div style={{ padding: `${SPACING.md} ${SPACING.base}`, textAlign: "center" }}>
                <span style={{ fontSize: FONTS.size.sm, fontWeight: FONTS.weight.semibold, color: COLORS.textPrimary }}>
                  {company.agentCount || 0}
                </span>
              </div>

              {/* Last active */}
              <div style={{ padding: `${SPACING.md} ${SPACING.base}` }}>
                <span style={{ fontSize: FONTS.size.xs, color: COLORS.textMuted }}>
                  {fmtDate(company.lastActiveAt || company.createdAt)}
                </span>
              </div>

              {/* Status */}
              <div style={{ padding: `${SPACING.md} ${SPACING.base}` }}>
                <StatusBadge status={company.status || "active"} />
              </div>

              {/* Actions */}
              <div style={{ padding: `${SPACING.md} ${SPACING.base}`, display: "flex", gap: "6px", justifyContent: "center" }}>
                <button
                  className="action-btn"
                  onClick={() => navigate(`/platform/companies/${company.id}`)}
                  style={{
                    ...STYLES.buttonSecondary, padding: `4px ${SPACING.sm}`, fontSize: FONTS.size.xs,
                    border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.base,
                  }}
                  title="View details"
                >
                  View
                </button>
                <button
                  className="action-btn"
                  onClick={() => navigate(`/platform/billing?company=${company.id}`)}
                  style={{
                    ...STYLES.buttonSecondary, padding: `4px ${SPACING.sm}`, fontSize: FONTS.size.xs,
                    border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.base,
                  }}
                  title="Edit plan"
                >
                  Plan
                </button>
                <button
                  onClick={() => setSuspendTarget(company)}
                  style={{
                    padding: `4px ${SPACING.sm}`, fontSize: FONTS.size.xs,
                    border: `1px solid ${company.status === "suspended" ? COLORS.success + "88" : COLORS.danger + "88"}`,
                    borderRadius: RADIUS.base, cursor: "pointer",
                    backgroundColor: "transparent",
                    color: company.status === "suspended" ? COLORS.success : COLORS.danger,
                    fontFamily: FONTS.family, transition: TRANSITIONS.fast,
                  }}
                  title={company.status === "suspended" ? "Reactivate" : "Suspend"}
                >
                  {company.status === "suspended" ? "↑ Restore" : "⊘ Suspend"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Suspend confirm modal ── */}
      {suspendTarget && (
        <SuspendModal
          company={suspendTarget}
          onConfirm={handleSuspend}
          onCancel={() => setSuspendTarget(null)}
          loading={suspending}
        />
      )}
    </>
  );
};

export default PlatformDashboard;
