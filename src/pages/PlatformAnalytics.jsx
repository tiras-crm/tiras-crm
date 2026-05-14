// TIRAS CRM — Platform Analytics
// Role: platform_owner — platform-wide growth, revenue, conversion, lead metrics
// No companyId filter — sees all data across every company on the platform

import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  collection, query, getDocs, where, Timestamp, orderBy,
} from "firebase/firestore";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, PieChart, Pie, Cell,
} from "recharts";
import { db, COLLECTIONS } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS, STYLES, TRANSITIONS } from "../theme";

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const PIE_COLORS = [
  COLORS.primary, COLORS.accent, COLORS.info, COLORS.success, COLORS.warning, "#7B68EE",
];

const PLAN_META = {
  Basic:      { color: COLORS.info   },
  Growth:     { color: COLORS.accent },
  Enterprise: { color: COLORS.primary},
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtRupee = (n) => {
  if (!n) return "₹0";
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000)   return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n.toLocaleString("en-IN")}`;
};

const startOfNMonthsAgo = (n) => {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return Timestamp.fromDate(d);
};

const build6MonthSkeleton = () =>
  Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    return { label: MONTHS_SHORT[d.getMonth()], month: d.getMonth(), year: d.getFullYear(), companies: 0, revenue: 0, calls: 0 };
  });

// ─── Sub-components ───────────────────────────────────────────────────────────

const Shimmer = ({ w = "100%", h = "16px", r = RADIUS.base }) => (
  <div style={{
    width: w, height: h, borderRadius: r,
    background: `linear-gradient(90deg, ${COLORS.surface} 25%, #2a2a2a 50%, ${COLORS.surface} 75%)`,
    backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite",
  }} />
);

const StatCard = ({ icon, label, value, sub, color, loading }) => (
  <div style={{ ...STYLES.card, flex: "1 1 180px", padding: SPACING.xl, position: "relative", overflow: "hidden" }}>
    <div style={{ position: "absolute", top: "-10px", right: "-10px", width: "64px", height: "64px", borderRadius: "50%", backgroundColor: (color || COLORS.primary) + "18" }} />
    {loading ? (
      <><Shimmer w="28px" h="28px" r={RADIUS.md} /><div style={{ marginTop: SPACING.md }}><Shimmer h="32px" w="55%" /></div><div style={{ marginTop: SPACING.xs }}><Shimmer h="12px" w="70%" /></div></>
    ) : (
      <>
        <div style={{ fontSize: "22px", marginBottom: SPACING.sm }}>{icon}</div>
        <div style={{ fontSize: FONTS.size["4xl"], fontWeight: FONTS.weight.bold, color: color || COLORS.textPrimary, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: FONTS.size.sm, fontWeight: FONTS.weight.semibold, color: COLORS.textPrimary, marginTop: SPACING.xs }}>{label}</div>
        {sub && <div style={{ fontSize: FONTS.size.xs, color: COLORS.textMuted, marginTop: "2px" }}>{sub}</div>}
      </>
    )}
  </div>
);

const SectionTitle = ({ title, sub }) => (
  <div style={{ marginBottom: SPACING.base }}>
    <div style={{ display: "flex", alignItems: "center", gap: SPACING.sm }}>
      <div style={{ width: "3px", height: "18px", backgroundColor: COLORS.primary, borderRadius: RADIUS.full }} />
      <span style={{ fontSize: FONTS.size.base, fontWeight: FONTS.weight.semibold, color: COLORS.textPrimary }}>{title}</span>
    </div>
    {sub && <div style={{ fontSize: FONTS.size.xs, color: COLORS.textMuted, marginTop: "3px", paddingLeft: "11px" }}>{sub}</div>}
  </div>
);

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ backgroundColor: "#1E1E1E", border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.md, padding: `${SPACING.sm} ${SPACING.base}`, boxShadow: SHADOWS.md }}>
      <div style={{ fontSize: FONTS.size.xs, color: COLORS.textMuted, marginBottom: SPACING.xs }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: SPACING.xs, fontSize: FONTS.size.sm, marginBottom: "2px" }}>
          <div style={{ width: "8px", height: "8px", borderRadius: "2px", backgroundColor: p.color || p.fill }} />
          <span style={{ color: COLORS.textSecondary }}>{p.name}:</span>
          <span style={{ color: COLORS.textPrimary, fontWeight: FONTS.weight.semibold }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const PlatformAnalytics = () => {
  const { isPlatformOwner } = useAuth();

  const [companies,  setCompanies]  = useState([]);
  const [payments,   setPayments]   = useState([]);
  const [calls,      setCalls]      = useState([]);
  const [totalLeads, setTotalLeads] = useState(0);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [period,     setPeriod]     = useState("6m"); // 6m | 3m | 1m

  // ─── Fetch ─────────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const windowTs = startOfNMonthsAgo(6);

      const [compSnap, paySnap, callsSnap, leadsSnap] = await Promise.all([
        getDocs(query(collection(db, COLLECTIONS.COMPANIES), orderBy("createdAt", "desc"))),
        getDocs(query(collection(db, COLLECTIONS.PAYMENTS), where("createdAt", ">=", windowTs), orderBy("createdAt", "desc"))),
        getDocs(query(collection(db, COLLECTIONS.CALLS),    where("createdAt", ">=", windowTs))),
        getDocs(query(collection(db, COLLECTIONS.LEADS))),
      ]);

      setCompanies(compSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setPayments(paySnap.docs.map((d)  => ({ id: d.id, ...d.data() })));
      setCalls(callsSnap.docs.map((d)   => ({ id: d.id, ...d.data() })));
      setTotalLeads(leadsSnap.size);
    } catch (e) {
      console.error("PlatformAnalytics fetch error:", e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ─── Derived data ──────────────────────────────────────────────────────

  const monthCount = period === "1m" ? 1 : period === "3m" ? 3 : 6;

  // Skeleton for selected period
  const skeleton = useMemo(() => {
    return Array.from({ length: monthCount }, (_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - (monthCount - 1 - i));
      return { label: MONTHS_SHORT[d.getMonth()], month: d.getMonth(), year: d.getFullYear(), companies: 0, revenue: 0, calls: 0 };
    });
  }, [monthCount]);

  // Growth chart — new companies + revenue + calls by month
  const growthChart = useMemo(() => {
    const data = skeleton.map((s) => ({ ...s }));
    companies.forEach((c) => {
      const d = c.createdAt?.toDate ? c.createdAt.toDate() : null;
      if (!d) return;
      const slot = data.find((s) => s.month === d.getMonth() && s.year === d.getFullYear());
      if (slot) slot.companies += 1;
    });
    payments.filter((p) => p.status === "paid").forEach((p) => {
      const d = p.createdAt?.toDate ? p.createdAt.toDate() : null;
      if (!d) return;
      const slot = data.find((s) => s.month === d.getMonth() && s.year === d.getFullYear());
      if (slot) slot.revenue += p.amount || 0;
    });
    calls.forEach((c) => {
      const d = c.createdAt?.toDate ? c.createdAt.toDate() : null;
      if (!d) return;
      const slot = data.find((s) => s.month === d.getMonth() && s.year === d.getFullYear());
      if (slot) slot.calls += 1;
    });
    return data;
  }, [skeleton, companies, payments, calls]);

  // Plan distribution for pie chart
  const planDist = useMemo(() => {
    const map = {};
    companies.forEach((c) => { map[c.plan || "Unknown"] = (map[c.plan || "Unknown"] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [companies]);

  // Industry distribution
  const industryDist = useMemo(() => {
    const map = {};
    companies.forEach((c) => { const k = c.industry || "Other"; map[k] = (map[k] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, value]) => ({ name, value }));
  }, [companies]);

  // Revenue by plan
  const revenueByPlan = useMemo(() => {
    const map = {};
    payments.filter((p) => p.status === "paid").forEach((p) => {
      map[p.plan || "Unknown"] = (map[p.plan || "Unknown"] || 0) + (p.amount || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [payments]);

  // Key metrics
  const totalRevenue   = payments.filter((p) => p.status === "paid").reduce((s, p) => s + (p.amount || 0), 0);
  const activeCompanies = companies.filter((c) => c.status === "active").length;
  const avgRevenuePerCo = activeCompanies > 0 ? Math.round(totalRevenue / activeCompanies) : 0;
  const totalCalls6m   = calls.length;

  // MRR estimate — sum of plan prices for active companies
  const MRR_MAP = { Basic: 1800, Growth: 3000, Enterprise: 5000 };
  const mrr = companies
    .filter((c) => c.status === "active")
    .reduce((s, c) => s + (MRR_MAP[c.plan] || 0), 0);

  // Conversion rate — active vs total
  const convRate = companies.length > 0 ? Math.round((activeCompanies / companies.length) * 100) : 0;

  // ─── Access guard ───────────────────────────────────────────────────────

  if (!isPlatformOwner) return (
    <div style={{ minHeight: "100vh", backgroundColor: COLORS.background, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONTS.family }}>
      <div style={{ textAlign: "center", color: COLORS.textMuted }}>
        <div style={{ fontSize: "40px" }}>🔒</div>
        <div style={{ fontSize: FONTS.size.lg, marginTop: SPACING.base }}>Platform Owner access required.</div>
      </div>
    </div>
  );

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: ${COLORS.scrollbarTrack}; }
        ::-webkit-scrollbar-thumb { background: ${COLORS.scrollbarThumb}; border-radius: 3px; }
      `}</style>

      <div style={{ minHeight: "100vh", backgroundColor: COLORS.background, padding: `${SPACING.xl} ${SPACING["2xl"]}`, fontFamily: FONTS.family, color: COLORS.textPrimary }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: SPACING["2xl"] }}>
          <div>
            <div style={{ fontSize: FONTS.size.xs, color: COLORS.accent, fontWeight: FONTS.weight.semibold, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: SPACING.xs }}>
              Platform Owner
            </div>
            <h1 style={{ fontSize: FONTS.size["4xl"], fontWeight: FONTS.weight.bold, margin: 0, lineHeight: 1.1 }}>
              Platform Analytics
            </h1>
            <div style={{ fontSize: FONTS.size.sm, color: COLORS.textSecondary, marginTop: SPACING.xs }}>
              Real-time metrics across all companies on TIRAS
            </div>
          </div>

          <div style={{ display: "flex", gap: SPACING.sm, alignItems: "center" }}>
            {/* Period selector */}
            <div style={{ display: "flex", backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.base, overflow: "hidden" }}>
              {[["1m","1 Month"],["3m","3 Months"],["6m","6 Months"]].map(([val, label]) => (
                <button key={val} onClick={() => setPeriod(val)} style={{
                  padding: `${SPACING.xs} ${SPACING.md}`, fontSize: FONTS.size.sm, fontFamily: FONTS.family, cursor: "pointer", border: "none",
                  backgroundColor: period === val ? COLORS.primaryMuted : "transparent",
                  color: period === val ? COLORS.primary : COLORS.textSecondary,
                  fontWeight: period === val ? FONTS.weight.semibold : FONTS.weight.regular,
                  transition: TRANSITIONS.fast,
                }}>
                  {label}
                </button>
              ))}
            </div>
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

        {/* ── KPI Cards ── */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: SPACING.base, marginBottom: SPACING["2xl"] }}>
          <StatCard icon="💰" label="Estimated MRR"      value={loading ? "…" : fmtRupee(mrr)}            sub="monthly recurring revenue"    color={COLORS.success}  loading={loading} />
          <StatCard icon="📦" label="Total Revenue"      value={loading ? "…" : fmtRupee(totalRevenue)}   sub="all paid payments"            color={COLORS.accent}   loading={loading} />
          <StatCard icon="🏢" label="Active Companies"   value={loading ? "…" : activeCompanies}          sub={`${convRate}% activation rate`} color={COLORS.primary} loading={loading} />
          <StatCard icon="📋" label="Total Leads"        value={loading ? "…" : totalLeads.toLocaleString("en-IN")} sub="platform-wide"       color={COLORS.info}     loading={loading} />
          <StatCard icon="📞" label={`Calls (${period})`} value={loading ? "…" : totalCalls6m.toLocaleString("en-IN")} sub="across all agents" color={COLORS.warning}  loading={loading} />
          <StatCard icon="💵" label="Avg Rev / Company"  value={loading ? "…" : fmtRupee(avgRevenuePerCo)} sub="active companies only"       color="#7B68EE"         loading={loading} />
        </div>

        {/* ── Row 1: Growth chart + Plan pie ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: SPACING.base, marginBottom: SPACING.base }}>

          {/* Multi-line growth chart */}
          <div style={{ ...STYLES.card }}>
            <SectionTitle title="Platform Growth" sub={`New companies · Revenue · Calls over last ${monthCount} months`} />
            {loading ? <Shimmer h="260px" /> : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={growthChart} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={COLORS.success} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={COLORS.success} stopOpacity={0}   />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: COLORS.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="co"  tick={{ fill: COLORS.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis yAxisId="rev" orientation="right" tick={{ fill: COLORS.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtRupee(v)} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: FONTS.size.xs, color: COLORS.textSecondary, paddingTop: SPACING.sm }} iconType="circle" iconSize={8} />
                  <Line yAxisId="co"  type="monotone" dataKey="companies" name="New Companies" stroke={COLORS.primary} strokeWidth={2.5} dot={{ r: 4, fill: COLORS.primary }}   activeDot={{ r: 6 }} />
                  <Line yAxisId="rev" type="monotone" dataKey="revenue"   name="Revenue (₹)"  stroke={COLORS.success} strokeWidth={2.5} dot={{ r: 4, fill: COLORS.success }}  activeDot={{ r: 6 }} strokeDasharray="5 3" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Plan distribution pie */}
          <div style={{ ...STYLES.card }}>
            <SectionTitle title="Plan Distribution" sub="Active companies by plan" />
            {loading ? <Shimmer h="200px" /> : planDist.length === 0 ? (
              <div style={{ textAlign: "center", padding: `${SPACING["3xl"]} 0`, color: COLORS.textMuted, fontSize: FONTS.size.sm }}>No data yet.</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={planDist} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                      {planDist.map((entry, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: "flex", flexDirection: "column", gap: SPACING.xs }}>
                  {planDist.map((entry, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: SPACING.xs }}>
                        <div style={{ width: "8px", height: "8px", borderRadius: "2px", backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span style={{ fontSize: FONTS.size.sm, color: COLORS.textSecondary }}>{entry.name}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: SPACING.sm }}>
                        <span style={{ fontSize: FONTS.size.sm, fontWeight: FONTS.weight.bold, color: COLORS.textPrimary }}>{entry.value}</span>
                        <span style={{ fontSize: FONTS.size.xs, color: COLORS.textMuted }}>
                          {companies.length > 0 ? `${Math.round((entry.value / companies.length) * 100)}%` : "0%"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Row 2: Revenue by plan bar + Industry breakdown ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: SPACING.base, marginBottom: SPACING.base }}>

          {/* Revenue by plan — bar */}
          <div style={{ ...STYLES.card }}>
            <SectionTitle title="Revenue by Plan" sub="Total paid revenue per subscription tier" />
            {loading ? <Shimmer h="220px" /> : revenueByPlan.length === 0 ? (
              <div style={{ textAlign: "center", padding: `${SPACING["3xl"]} 0`, color: COLORS.textMuted, fontSize: FONTS.size.sm }}>No paid revenue yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={revenueByPlan} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barCategoryGap="35%">
                  <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: COLORS.textSecondary, fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: COLORS.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtRupee(v)} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: COLORS.surfaceHover }} />
                  <Bar dataKey="value" name="Revenue" radius={[4,4,0,0]}>
                    {revenueByPlan.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Industry breakdown */}
          <div style={{ ...STYLES.card }}>
            <SectionTitle title="Top Industries" sub="Companies by industry sector" />
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => <div key={i} style={{ marginBottom: SPACING.sm }}><Shimmer h="28px" /></div>)
            ) : industryDist.length === 0 ? (
              <div style={{ textAlign: "center", padding: `${SPACING["3xl"]} 0`, color: COLORS.textMuted, fontSize: FONTS.size.sm }}>No data yet.</div>
            ) : industryDist.map(([name, count] = entry => [entry.name, entry.value], entry => entry).map ? industryDist : industryDist).map((entry, i) => {
              const max = Math.max(...industryDist.map((e) => e.value), 1);
              const pct = (entry.value / max) * 100;
              const col = PIE_COLORS[i % PIE_COLORS.length];
              return (
                <div key={entry.name} style={{ marginBottom: SPACING.sm }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <span style={{ fontSize: FONTS.size.sm, color: COLORS.textSecondary }}>{entry.name}</span>
                    <span style={{ fontSize: FONTS.size.sm, fontWeight: FONTS.weight.bold, color: COLORS.textPrimary }}>{entry.value}</span>
                  </div>
                  <div style={{ height: "6px", borderRadius: RADIUS.full, backgroundColor: COLORS.border, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, backgroundColor: col, borderRadius: RADIUS.full, transition: "width 0.5s ease" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Row 3: Monthly calls bar + Company status summary ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: SPACING.base }}>

          {/* Monthly calls bar */}
          <div style={{ ...STYLES.card }}>
            <SectionTitle title="Call Volume by Month" sub={`Total calls across all companies — last ${monthCount} months`} />
            {loading ? <Shimmer h="200px" /> : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={growthChart} margin={{ top: 8, right: 8, left: -20, bottom: 0 }} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: COLORS.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: COLORS.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: COLORS.surfaceHover }} />
                  <Bar dataKey="calls" name="Calls" fill={COLORS.primary} radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Company health summary */}
          <div style={{ ...STYLES.card }}>
            <SectionTitle title="Company Health" />
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => <div key={i} style={{ marginBottom: SPACING.sm }}><Shimmer h="44px" /></div>)
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: SPACING.sm }}>
                {[
                  { label: "Active",    count: companies.filter((c) => c.status === "active").length,    color: COLORS.success, icon: "✓" },
                  { label: "Trial",     count: companies.filter((c) => c.status === "trial").length,     color: COLORS.warning, icon: "◑" },
                  { label: "Suspended", count: companies.filter((c) => c.status === "suspended").length, color: COLORS.danger,  icon: "⊘" },
                  { label: "Inactive",  count: companies.filter((c) => c.status === "inactive").length,  color: COLORS.textMuted, icon: "○" },
                  { label: "Total",     count: companies.length,                                         color: COLORS.primary, icon: "■" },
                ].map(({ label, count, color, icon }) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: `${SPACING.sm} ${SPACING.md}`, backgroundColor: COLORS.surfaceActive, borderRadius: RADIUS.base }}>
                    <div style={{ display: "flex", alignItems: "center", gap: SPACING.sm }}>
                      <span style={{ color, fontSize: FONTS.size.sm }}>{icon}</span>
                      <span style={{ fontSize: FONTS.size.sm, color: COLORS.textSecondary }}>{label}</span>
                    </div>
                    <span style={{ fontSize: FONTS.size.xl, fontWeight: FONTS.weight.bold, color }}>{count}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Activation rate */}
            {!loading && (
              <div style={{ marginTop: SPACING.base, paddingTop: SPACING.base, borderTop: `1px solid ${COLORS.border}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span style={{ fontSize: FONTS.size.xs, color: COLORS.textMuted }}>Activation Rate</span>
                  <span style={{ fontSize: FONTS.size.xs, fontWeight: FONTS.weight.bold, color: convRate >= 70 ? COLORS.success : COLORS.warning }}>{convRate}%</span>
                </div>
                <div style={{ height: "6px", borderRadius: RADIUS.full, backgroundColor: COLORS.border, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${convRate}%`, backgroundColor: convRate >= 70 ? COLORS.success : COLORS.warning, borderRadius: RADIUS.full, transition: "width 0.5s ease" }} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default PlatformAnalytics;
