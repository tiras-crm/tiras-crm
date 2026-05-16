// TIRAS CRM V2 — AdminDashboard.jsx  (UPPARA account)
// God View: real-time Firestore via onSnapshot, wallet balance card,
// skeleton loading, count-up numbers, mobile-first responsive layout
//
// DROP INTO: src/pages/AdminDashboard.jsx
// In src/pages/index.js replace the placeholder with:
//   export { AdminDashboard } from "./AdminDashboard";

import { AnnouncementBanner } from "../../components/UI/AnnouncementBanner";<AnnouncementBanner />
// Then inside return, first line before stat cards:
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  collection, query, where, doc,
  onSnapshot, Timestamp, orderBy,
} from "firebase/firestore";
import { db, COLLECTIONS } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import {
  RiUserLine, RiPhoneLine, RiBarChartBoxLine,
  RiTrophyLine, RiAlertLine, RiCustomerServiceLine,
  RiWalletLine, RiArrowUpLine, RiArrowDownLine,
  RiAddLine, RiRefreshLine, RiCheckboxCircleLine,
  RiTimeLine, RiTeamLine, RiMoneyDollarCircleLine,
  RiLightbulbLine,
} from "react-icons/ri";

// ─── V2 Design Tokens (Obsidian Gold) ────────────────────────────────────────

const C = {
  bg:         "#121212",
  surface:    "#1A1A1B",
  surfaceHov: "#202022",
  gold:       "#D4AF37",
  goldMuted:  "rgba(212,175,55,0.12)",
  goldBorder: "rgba(212,175,55,0.25)",
  red:        "#E63946",
  redMuted:   "rgba(230,57,70,0.12)",
  text:       "#F5F5F5",
  sub:        "#9A9A9A",
  border:     "#2A2A2B",
  success:    "#2ECC71",
  successMuted: "rgba(46,204,113,0.12)",
  warning:    "#F39C12",
  warningMuted: "rgba(243,156,18,0.12)",
  info:       "#3498DB",
  infoMuted:  "rgba(52,152,219,0.12)",
  danger:     "#E63946",
  dangerMuted:"rgba(230,57,70,0.12)",
};

const FONT_HEAD = "'Playfair Display', Georgia, serif";
const FONT_BODY = "'DM Sans', system-ui, sans-serif";

const R = { sm: "6px", md: "8px", lg: "12px", xl: "16px", full: "9999px" };
const SH = {
  sm:  "0 1px 3px rgba(0,0,0,0.4)",
  md:  "0 4px 16px rgba(0,0,0,0.5)",
  glow:"0 0 20px rgba(212,175,55,0.15)",
};

// ─── Count-up hook ────────────────────────────────────────────────────────────

const useCountUp = (target, duration = 800) => {
  const [val, setVal]   = useState(0);
  const frameRef        = useRef(null);
  const prevTarget      = useRef(target);

  useEffect(() => {
    if (target === prevTarget.current && val !== 0) return;
    prevTarget.current = target;
    const start     = Date.now();
    const startFrom = val;

    const step = () => {
      const p = Math.min((Date.now() - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3); // cubic ease-out
      setVal(Math.round(startFrom + (target - startFrom) * ease));
      if (p < 1) frameRef.current = requestAnimationFrame(step);
      else setVal(target);
    };
    frameRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target]); // eslint-disable-line

  return val;
};

// ─── Skeleton shimmer ─────────────────────────────────────────────────────────

const SK = ({ w = "100%", h = "16px", r = R.md, style = {} }) => (
  <div style={{
    width: w, height: h, borderRadius: r, flexShrink: 0,
    background: `linear-gradient(90deg, ${C.surface} 25%, #232325 50%, ${C.surface} 75%)`,
    backgroundSize: "200% 100%",
    animation: "v2Shimmer 1.6s ease-in-out infinite",
    ...style,
  }} />
);

// ─── Stat card ────────────────────────────────────────────────────────────────

const StatCard = ({
  icon: Icon, iconColor, iconBg,
  label, value, sub, subColor,
  subIcon: SubIcon, alert, loading,
}) => {
  const [hov, setHov] = useState(false);
  const num = typeof value === "number" ? value : null;
  const displayNum = useCountUp(num ?? 0);

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        backgroundColor: C.surface,
        borderRadius: R.lg,
        border: `1px solid ${alert ? C.red + "55" : C.border}`,
        padding: "20px",
        position: "relative",
        overflow: "hidden",
        transition: "transform 0.15s ease, box-shadow 0.15s ease",
        transform: hov ? "translateY(-2px)" : "none",
        boxShadow: hov ? SH.md : (alert ? `0 0 0 1px ${C.red}30, ${SH.sm}` : SH.sm),
        cursor: "default",
        minHeight: "130px",
        display: "flex", flexDirection: "column", justifyContent: "space-between",
      }}
    >
      {/* Gold top accent bar on hover */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: "2px",
        backgroundColor: alert ? C.red : C.gold,
        opacity: (hov || alert) ? 1 : 0,
        transition: "opacity 0.15s ease",
      }} />

      <div>
        {/* Icon row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px" }}>
          <div style={{
            width: "40px", height: "40px", borderRadius: R.md,
            backgroundColor: iconBg, display: "flex",
            alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <Icon size={19} color={iconColor} />
          </div>
          {alert && (
            <div style={{
              width: "8px", height: "8px", borderRadius: "50%",
              backgroundColor: C.red, boxShadow: `0 0 6px ${C.red}`,
              animation: "v2Pulse 1.5s ease-in-out infinite",
            }} />
          )}
        </div>

        {/* Value */}
        {loading ? (
          <>
            <SK w="60%" h="32px" style={{ marginBottom: "8px" }} />
            <SK w="80%" h="14px" />
          </>
        ) : (
          <>
            <div style={{
              fontFamily: FONT_BODY, fontSize: "32px",
              fontWeight: "700", color: C.text, lineHeight: 1.1,
              letterSpacing: "-0.5px", marginBottom: "4px",
            }}>
              {num !== null ? displayNum.toLocaleString("en-IN") : value}
            </div>
            <div style={{ fontFamily: FONT_BODY, fontSize: "13px", color: C.sub, fontWeight: "500" }}>
              {label}
            </div>
          </>
        )}
      </div>

      {/* Sub info */}
      {sub && !loading && (
        <div style={{
          display: "flex", alignItems: "center", gap: "4px",
          fontSize: "12px", fontWeight: "600", fontFamily: FONT_BODY,
          color: subColor || C.sub, marginTop: "8px",
        }}>
          {SubIcon && <SubIcon size={11} />}
          {sub}
        </div>
      )}
    </div>
  );
};

// ─── Wallet card ──────────────────────────────────────────────────────────────

const WalletCard = ({ balance, estimatedMins, loading, isLow, navigate }) => {
  const [hov, setHov] = useState(false);
  const displayBal = useCountUp(Math.floor(balance || 0));

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        backgroundColor: C.surface,
        borderRadius: R.lg,
        border: `1px solid ${isLow ? C.red + "55" : C.goldBorder}`,
        padding: "20px 24px",
        background: `linear-gradient(135deg, ${C.surface} 0%, ${C.goldMuted} 100%)`,
        boxShadow: hov ? `${SH.md}, ${SH.glow}` : (isLow ? `0 0 0 1px ${C.red}30` : SH.sm),
        transition: "transform 0.15s ease, box-shadow 0.15s ease",
        transform: hov ? "translateY(-2px)" : "none",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Gold accent bar */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: "2px",
        backgroundColor: isLow ? C.red : C.gold,
      }} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
            <RiWalletLine size={17} color={C.gold} />
            <span style={{ fontFamily: FONT_BODY, fontSize: "12px", fontWeight: "600", color: C.gold, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Calling Wallet
            </span>
          </div>

          {loading ? (
            <>
              <SK w="140px" h="44px" r={R.md} style={{ marginBottom: "8px" }} />
              <SK w="100px" h="14px" />
            </>
          ) : (
            <>
              <div style={{
                fontFamily: FONT_HEAD, fontSize: "42px", fontWeight: "700",
                color: isLow ? C.red : C.gold, lineHeight: 1, letterSpacing: "-1px",
              }}>
                ₹{displayBal.toLocaleString("en-IN")}
              </div>
              <div style={{ fontFamily: FONT_BODY, fontSize: "13px", color: C.sub, marginTop: "6px" }}>
                ≈ {estimatedMins.toLocaleString("en-IN")} mins of calling remaining
              </div>
            </>
          )}

          {isLow && !loading && (
            <div style={{
              display: "inline-flex", alignItems: "center", gap: "5px",
              backgroundColor: C.redMuted, border: `1px solid ${C.red}40`,
              borderRadius: R.full, padding: "3px 10px",
              fontSize: "11px", fontWeight: "600", color: C.red,
              marginTop: "8px",
            }}>
              <RiAlertLine size={11} />
              Low balance — recharge now
            </div>
          )}
        </div>

        <button
          onClick={() => navigate("/admin/wallet")}
          style={{
            backgroundColor: C.gold, color: "#000",
            border: "none", borderRadius: R.md,
            fontFamily: FONT_BODY, fontSize: "13px", fontWeight: "700",
            padding: "8px 16px", cursor: "pointer",
            display: "flex", alignItems: "center", gap: "5px",
            flexShrink: 0, whiteSpace: "nowrap",
          }}
        >
          <RiAddLine size={14} />
          Top Up
        </button>
      </div>
    </div>
  );
};

// ─── Chart tooltip ────────────────────────────────────────────────────────────

const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      backgroundColor: "#242426", border: `1px solid ${C.border}`,
      borderRadius: R.md, padding: "8px 14px", boxShadow: SH.md,
    }}>
      <div style={{ fontFamily: FONT_BODY, fontSize: "11px", color: C.sub, marginBottom: "2px" }}>
        {label}
      </div>
      <div style={{ fontFamily: FONT_BODY, fontSize: "20px", fontWeight: "700", color: C.gold }}>
        {payload[0].value}
      </div>
      <div style={{ fontFamily: FONT_BODY, fontSize: "11px", color: C.sub }}>calls</div>
    </div>
  );
};

// ─── Quick row for sidebar ────────────────────────────────────────────────────

const QRow = ({ label, value, color }) => (
  <div style={{
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "8px 0", borderBottom: `1px solid ${C.border}`,
  }}>
    <span style={{ fontFamily: FONT_BODY, fontSize: "13px", color: C.sub }}>{label}</span>
    <span style={{ fontFamily: FONT_BODY, fontSize: "15px", fontWeight: "600", color: color || C.text }}>
      {value}
    </span>
  </div>
);

// ─── AdminDashboard ───────────────────────────────────────────────────────────

export const AdminDashboard = () => {
  const { companyId, userProfile } = useAuth();
  const navigate = useNavigate();

  // Raw snapshot data
  const [companyData,  setCompanyData]  = useState(null);
  const [leads,        setLeads]        = useState([]);
  const [calls7d,      setCalls7d]      = useState([]);
  const [followUps,    setFollowUps]    = useState([]);
  const [tickets,      setTickets]      = useState([]);

  // Per-listener ready flags → single loading state
  const [ready, setReady] = useState({ company: false, leads: false, calls: false, fup: false, tickets: false });
  const loading = !Object.values(ready).every(Boolean);

  const markReady = useCallback((key) => setReady(p => ({ ...p, [key]: true })), []);

  // ── onSnapshot listeners ────────────────────────────────────────────────
  useEffect(() => {
    if (!companyId) return;

    const now      = new Date();
    const sevenAgo = new Date(now); sevenAgo.setDate(sevenAgo.getDate() - 6); sevenAgo.setHours(0,0,0,0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const unsubs = [];

    // 1 — Company document (wallet, plan, subscription)
    unsubs.push(onSnapshot(
      doc(db, COLLECTIONS.COMPANIES, companyId),
      (snap) => { setCompanyData(snap.exists() ? { id: snap.id, ...snap.data() } : null); markReady("company"); },
      (err) => { console.error("AdminDash company snap:", err); markReady("company"); }
    ));

    // 2 — All leads for this company
    unsubs.push(onSnapshot(
      query(collection(db, COLLECTIONS.LEADS), where("companyId", "==", companyId)),
      (snap) => { setLeads(snap.docs.map(d => ({ id: d.id, ...d.data() }))); markReady("leads"); },
      (err) => { console.error("AdminDash leads snap:", err); markReady("leads"); }
    ));

    // 3 — Calls last 7 days (covers today, yesterday, weekly chart)
    unsubs.push(onSnapshot(
      query(
        collection(db, COLLECTIONS.CALLS),
        where("companyId", "==", companyId),
        where("createdAt", ">=", Timestamp.fromDate(sevenAgo)),
      ),
      (snap) => { setCalls7d(snap.docs.map(d => ({ id: d.id, ...d.data() }))); markReady("calls"); },
      (err) => { console.error("AdminDash calls snap:", err); markReady("calls"); }
    ));

    // 4 — Overdue follow-ups (dueAt in the past)
    unsubs.push(onSnapshot(
      query(
        collection(db, COLLECTIONS.FOLLOW_UPS),
        where("companyId", "==", companyId),
        where("dueAt", "<", Timestamp.fromDate(now)),
      ),
      (snap) => {
        setFollowUps(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(f => f.status !== "completed"));
        markReady("fup");
      },
      (err) => { console.error("AdminDash fup snap:", err); markReady("fup"); }
    ));

    // 5 — Open tickets
    unsubs.push(onSnapshot(
      query(
        collection(db, COLLECTIONS.TICKETS),
        where("companyId", "==", companyId),
        where("status", "in", ["open", "assigned", "in_progress"]),
      ),
      (snap) => { setTickets(snap.docs.map(d => ({ id: d.id, ...d.data() }))); markReady("tickets"); },
      (err) => { console.error("AdminDash tickets snap:", err); markReady("tickets"); }
    ));

    return () => unsubs.forEach(u => u());
  }, [companyId, markReady]);

  // ── Derived stats (memoised) ────────────────────────────────────────────
  const stats = useMemo(() => {
    const now        = new Date();
    const todayStart = new Date(now); todayStart.setHours(0,0,0,0);
    const yesterdayStart = new Date(todayStart); yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const DAY_NAMES  = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

    // Build 7-day map
    const dailyMap = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(todayStart); d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      dailyMap[key] = { label: i === 0 ? "Today" : DAY_NAMES[d.getDay()], count: 0 };
    }

    let callsToday = 0, callsYesterday = 0;
    const agentMap = {};

    calls7d.forEach(c => {
      const ts = c.createdAt?.toDate?.();
      if (!ts) return;
      const key = ts.toISOString().split("T")[0];
      if (dailyMap[key]) dailyMap[key].count++;
      if (ts >= todayStart) {
        callsToday++;
        if (c.agentId) {
          if (!agentMap[c.agentId]) agentMap[c.agentId] = { name: c.agentName || "Agent", count: 0 };
          agentMap[c.agentId].count++;
        }
      } else if (ts >= yesterdayStart && ts < todayStart) callsYesterday++;
    });

    // Best agent today
    let bestAgent = null, topCount = 0;
    Object.values(agentMap).forEach(a => { if (a.count > topCount) { topCount = a.count; bestAgent = a; } });

    // Conversion this month
    const monthLeads = leads.filter(l => l.createdAt?.toDate?.() >= monthStart);
    const closedWon  = monthLeads.filter(l => l.stage === "Closed Won").length;
    const convRate   = monthLeads.length > 0 ? Math.round((closedWon / monthLeads.length) * 100) : 0;

    // Pipeline value
    const pipelineVal = leads.reduce((s, l) => s + (l.dealValue || 0), 0);

    // Weekly chart
    const weeklyData  = Object.values(dailyMap).map(({ label, count }) => ({ day: label, calls: count }));
    const weeklyTotal = weeklyData.reduce((s, d) => s + d.calls, 0);

    // Wallet
    const balance = companyData?.wallet?.balance || 0;
    const estimatedMins = Math.floor(balance / 1); // ₹1 per minute

    return {
      totalLeads: leads.length, callsToday, callsYesterday,
      convRate, closedWon, monthLeadsCount: monthLeads.length,
      bestAgent, overdueFollowUps: followUps.length,
      openTickets: tickets.length, pipelineVal,
      weeklyData, weeklyTotal, balance, estimatedMins,
      isLowBalance: balance < 200,
    };
  }, [companyData, leads, calls7d, followUps, tickets]);

  const callsDiff = stats.callsToday - stats.callsYesterday;
  const firstName = userProfile?.displayName?.split(" ")[0] || "Admin";

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div style={{ backgroundColor: C.bg, minHeight: "calc(100vh - 56px)", padding: "28px 28px 60px", fontFamily: FONT_BODY, boxSizing: "border-box" }}>

      {/* Global styles */}
      <style>{`
        @keyframes v2Shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes v2Pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes v2FadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @media (max-width:768px) {
          .dash-stats-grid { grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)) !important; }
          .dash-bottom-grid { grid-template-columns: 1fr !important; }
          .dash-header { flex-direction: column !important; align-items: flex-start !important; }
          .dash-padding { padding: 16px 16px 60px !important; }
        }
        select option { background: ${C.surface}; color: ${C.text}; }
      `}</style>

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="dash-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "28px", flexWrap: "wrap", gap: "12px", animation: "v2FadeUp 0.4s ease" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
            <div style={{ width: "7px", height: "7px", borderRadius: "50%", backgroundColor: C.success, boxShadow: `0 0 8px ${C.success}` }} />
            <span style={{ fontFamily: FONT_BODY, fontSize: "11px", fontWeight: "600", color: C.success, textTransform: "uppercase", letterSpacing: "0.1em" }}>Live</span>
          </div>
          <h1 style={{ margin: 0, fontFamily: FONT_HEAD, fontSize: "clamp(28px, 4vw, 40px)", fontWeight: "700", color: C.text, letterSpacing: "-0.5px", lineHeight: 1.1 }}>
            God View
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: "14px", color: C.sub }}>
            Welcome back, {firstName}. All your numbers — live.
          </p>
        </div>

        {/* Trial / Subscription badge */}
        {companyData?.subscriptionStatus && (
          <div style={{
            backgroundColor: companyData.subscriptionStatus === "trial" ? C.goldMuted : C.successMuted,
            border: `1px solid ${companyData.subscriptionStatus === "trial" ? C.goldBorder : C.success + "40"}`,
            borderRadius: R.full, padding: "6px 14px",
            fontSize: "12px", fontWeight: "600",
            color: companyData.subscriptionStatus === "trial" ? C.gold : C.success,
            display: "flex", alignItems: "center", gap: "6px",
          }}>
            <RiLightbulbLine size={13} />
            {companyData.subscriptionStatus === "trial"
              ? `Trial — ${Math.max(0, Math.ceil((companyData.trialEndDate?.toDate?.() - new Date()) / 86400000))} days left`
              : `${companyData.plan?.charAt(0).toUpperCase()}${companyData.plan?.slice(1)} Plan`
            }
          </div>
        )}
      </div>

      {/* ── Wallet card ───────────────────────────────────────────────────── */}
      <div style={{ marginBottom: "20px", animation: "v2FadeUp 0.4s ease 0.05s both" }}>
        <WalletCard
          balance={stats.balance}
          estimatedMins={stats.estimatedMins}
          loading={loading}
          isLow={stats.isLowBalance}
          navigate={navigate}
        />
      </div>

      {/* ── 6 Stat cards ─────────────────────────────────────────────────── */}
      <div
        className="dash-stats-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "14px",
          marginBottom: "20px",
          animation: "v2FadeUp 0.4s ease 0.1s both",
        }}
      >
        {/* 1 — Total Leads */}
        <StatCard
          icon={RiUserLine} iconColor={C.info} iconBg={C.infoMuted}
          label="Total Leads"
          value={loading ? "—" : stats.totalLeads}
          sub={loading ? null : `₹${stats.pipelineVal >= 100000 ? (stats.pipelineVal/100000).toFixed(1)+"L" : (stats.pipelineVal/1000).toFixed(0)+"K"} pipeline`}
          subColor={C.sub} loading={loading}
        />

        {/* 2 — Calls Today */}
        <StatCard
          icon={RiPhoneLine} iconColor={C.gold} iconBg={C.goldMuted}
          label="Calls Today"
          value={loading ? "—" : stats.callsToday}
          sub={loading ? null : stats.callsYesterday > 0
            ? `${Math.abs(callsDiff)} ${callsDiff >= 0 ? "more" : "fewer"} than yesterday`
            : "No data yesterday"
          }
          subColor={callsDiff > 0 ? C.success : callsDiff < 0 ? C.red : C.sub}
          subIcon={callsDiff > 0 ? RiArrowUpLine : callsDiff < 0 ? RiArrowDownLine : null}
          loading={loading}
        />

        {/* 3 — Conversion Rate */}
        <StatCard
          icon={RiBarChartBoxLine} iconColor={C.success} iconBg={C.successMuted}
          label="Conversion (Month)"
          value={loading ? "—" : `${stats.convRate}%`}
          sub={loading ? null : `${stats.closedWon} of ${stats.monthLeadsCount} closed`}
          subColor={C.sub} loading={loading}
        />

        {/* 4 — Top Caller */}
        <StatCard
          icon={RiTrophyLine} iconColor={C.gold} iconBg={C.goldMuted}
          label="Top Caller Today"
          value={loading ? "—" : stats.bestAgent?.name?.split(" ")[0] || "—"}
          sub={loading ? null : stats.bestAgent ? `${stats.bestAgent.count} calls today` : "No calls yet"}
          subColor={C.gold} loading={loading}
        />

        {/* 5 — Overdue Follow-ups */}
        <StatCard
          icon={RiAlertLine}
          iconColor={stats.overdueFollowUps > 0 ? C.red : C.success}
          iconBg={stats.overdueFollowUps > 0 ? C.redMuted : C.successMuted}
          label="Overdue Follow-ups"
          value={loading ? "—" : stats.overdueFollowUps}
          sub={loading ? null : stats.overdueFollowUps > 0 ? "Action needed" : "All on track"}
          subColor={stats.overdueFollowUps > 0 ? C.red : C.success}
          subIcon={stats.overdueFollowUps === 0 ? RiCheckboxCircleLine : null}
          alert={stats.overdueFollowUps > 0} loading={loading}
        />

        {/* 6 — Open Tickets */}
        <StatCard
          icon={RiCustomerServiceLine}
          iconColor={stats.openTickets > 5 ? C.warning : C.info}
          iconBg={stats.openTickets > 5 ? C.warningMuted : C.infoMuted}
          label="Open Tickets"
          value={loading ? "—" : stats.openTickets}
          sub={loading ? null : stats.openTickets > 5 ? "High volume" : stats.openTickets > 0 ? "Being handled" : "No open tickets"}
          subColor={stats.openTickets > 5 ? C.warning : C.sub}
          alert={stats.openTickets > 5} loading={loading}
        />
      </div>

      {/* ── Bottom: Chart + Quick Stats ───────────────────────────────────── */}
      <div
        className="dash-bottom-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 300px",
          gap: "14px",
          alignItems: "start",
          animation: "v2FadeUp 0.4s ease 0.15s both",
        }}
      >
        {/* Bar chart card */}
        <div style={{
          backgroundColor: C.surface, border: `1px solid ${C.border}`,
          borderRadius: R.lg, padding: "20px 20px 16px",
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "16px", flexWrap: "wrap", gap: "8px" }}>
            <div>
              <div style={{ fontFamily: FONT_HEAD, fontSize: "17px", fontWeight: "700", color: C.text }}>
                Calls Per Day
              </div>
              <div style={{ fontSize: "12px", color: C.sub, marginTop: "2px" }}>Last 7 days</div>
            </div>
            {!loading && (
              <div style={{
                backgroundColor: C.goldMuted, border: `1px solid ${C.goldBorder}`,
                borderRadius: R.full, padding: "3px 12px",
                fontSize: "12px", fontWeight: "600", color: C.gold,
              }}>
                {stats.weeklyTotal} this week
              </div>
            )}
          </div>

          {loading ? (
            <div style={{ height: "220px", display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: "8px", padding: "0 8px" }}>
              {[80,140,60,180,100,220,160].map((h, i) => (
                <SK key={i} w={`${100/7}%`} h={`${h}px`} r={`${R.md} ${R.md} 0 0`}
                  style={{ display: "inline-block", margin: "0 4px",
                    background: `linear-gradient(90deg, ${C.surface} 25%, #232325 50%, ${C.surface} 75%)`,
                    backgroundSize: "200% 100%", animation: "v2Shimmer 1.6s ease-in-out infinite" }} />
              ))}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats.weeklyData} margin={{ top: 4, right: 4, left: -22, bottom: 0 }} barSize={28}>
                <CartesianGrid strokeDasharray="2 4" stroke={C.border} vertical={false} />
                <XAxis dataKey="day" tick={{ fill: C.sub, fontSize: 11, fontFamily: FONT_BODY }} axisLine={{ stroke: C.border }} tickLine={false} />
                <YAxis tick={{ fill: C.sub, fontSize: 11, fontFamily: FONT_BODY }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(255,255,255,0.03)", radius: 4 }} />
                <Bar dataKey="calls" radius={[5, 5, 0, 0]}>
                  {stats.weeklyData.map((entry, i) => (
                    <Cell key={i}
                      fill={entry.day === "Today" ? C.gold : "#3A3A1A"}
                      opacity={entry.day === "Today" ? 1 : 0.8}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}

          {/* Legend */}
          {!loading && (
            <div style={{ display: "flex", gap: "16px", marginTop: "10px", paddingTop: "10px", borderTop: `1px solid ${C.border}` }}>
              {[
                { color: C.gold, label: "Today" },
                { color: "#3A3A1A", label: "Previous days", op: 0.8 },
              ].map(({ color, label, op = 1 }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <div style={{ width: "10px", height: "10px", borderRadius: "2px", backgroundColor: color, opacity: op }} />
                  <span style={{ fontSize: "11px", color: C.sub, fontFamily: FONT_BODY }}>{label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick stats sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

          {/* Today at a glance */}
          <div style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: R.lg, padding: "16px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
              <RiTimeLine size={15} color={C.gold} />
              <span style={{ fontFamily: FONT_BODY, fontSize: "11px", fontWeight: "600", color: C.sub, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Today at a Glance
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <QRow label="Calls made"          value={loading ? "…" : stats.callsToday}        color={C.gold} />
              <QRow label="Deals closed (month)" value={loading ? "…" : stats.closedWon}         color={C.success} />
              <QRow label="Overdue follow-ups"  value={loading ? "…" : stats.overdueFollowUps}  color={stats.overdueFollowUps > 0 ? C.red : C.success} />
              <QRow label="Open tickets"        value={loading ? "…" : stats.openTickets}       color={stats.openTickets > 5 ? C.warning : C.sub} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "8px" }}>
                <span style={{ fontFamily: FONT_BODY, fontSize: "13px", color: C.sub }}>Calls this week</span>
                <span style={{ fontFamily: FONT_BODY, fontSize: "15px", fontWeight: "600", color: C.text }}>{loading ? "…" : stats.weeklyTotal}</span>
              </div>
            </div>
          </div>

          {/* Best agent spotlight */}
          {!loading && stats.bestAgent && (
            <div style={{
              backgroundColor: C.surface,
              border: `1px solid ${C.goldBorder}`,
              borderRadius: R.lg, padding: "16px 18px",
              background: `linear-gradient(135deg, ${C.surface} 0%, ${C.goldMuted} 100%)`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px" }}>
                <RiTrophyLine size={14} color={C.gold} />
                <span style={{ fontFamily: FONT_BODY, fontSize: "11px", fontWeight: "600", color: C.gold, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Top Caller Today
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{
                  width: "42px", height: "42px", borderRadius: "50%",
                  backgroundColor: C.goldMuted, border: `2px solid ${C.gold}50`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: FONT_HEAD, fontSize: "18px", fontWeight: "700", color: C.gold, flexShrink: 0,
                }}>
                  {stats.bestAgent.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontFamily: FONT_BODY, fontSize: "16px", fontWeight: "700", color: C.text, lineHeight: 1.2 }}>
                    {stats.bestAgent.name}
                  </div>
                  <div style={{ fontFamily: FONT_BODY, fontSize: "12px", color: C.sub, marginTop: "2px" }}>
                    {stats.bestAgent.count} calls today
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Pipeline value */}
          <div style={{
            backgroundColor: C.surface, border: `1px solid ${C.border}`,
            borderRadius: R.lg, padding: "16px 18px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
              <RiMoneyDollarCircleLine size={15} color={C.gold} />
              <span style={{ fontFamily: FONT_BODY, fontSize: "11px", fontWeight: "600", color: C.sub, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Pipeline Value
              </span>
            </div>
            <div style={{ fontFamily: FONT_HEAD, fontSize: "28px", fontWeight: "700", color: C.gold, letterSpacing: "-0.5px" }}>
              {loading ? <SK w="120px" h="32px" /> : (
                stats.pipelineVal >= 100000
                  ? `₹${(stats.pipelineVal / 100000).toFixed(1)}L`
                  : `₹${(stats.pipelineVal / 1000).toFixed(0)}K`
              )}
            </div>
            <div style={{ fontFamily: FONT_BODY, fontSize: "12px", color: C.sub, marginTop: "4px" }}>
              Total deal value across all active leads
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
