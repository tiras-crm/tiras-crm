// TIRAS CRM — SupportTicketsOverview.jsx
// Company Admin — all support tickets; quick-assign; 24h escalation glow; status tabs
//
// USAGE: In src/pages/index.js replace:
//   export const SupportTicketsOverview = () => <Placeholder name="Support Tickets Overview" />;
// with:
//   export { SupportTicketsOverview } from "./SupportTicketsOverview";

import React, { useState, useEffect, useCallback } from "react";
import {
  collection, query, where, getDocs,
  doc, updateDoc, serverTimestamp, orderBy,
} from "firebase/firestore";
import { db, COLLECTIONS } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import {
  COLORS, FONTS, SPACING, RADIUS, SHADOWS, STYLES, TRANSITIONS,
} from "../theme";
import {
  RiSearchLine, RiLoader4Line, RiRefreshLine,
  RiCustomerServiceLine, RiAlertLine, RiTimeLine,
  RiUserAddLine, RiCheckLine, RiCloseLine,
  RiArrowUpLine, RiArrowDownLine,
  RiExternalLinkLine, RiPhoneLine,
} from "react-icons/ri";

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_TABS = [
  { value: "all",         label: "All" },
  { value: "open",        label: "Open" },
  { value: "assigned",    label: "Assigned" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved",    label: "Resolved" },
  { value: "closed",      label: "Closed" },
];

const STATUS_CFG = {
  open:        { label: "Open",        color: COLORS.danger,  bg: COLORS.dangerMuted },
  assigned:    { label: "Assigned",    color: COLORS.warning, bg: COLORS.warningMuted },
  in_progress: { label: "In Progress", color: COLORS.info,    bg: COLORS.infoMuted },
  resolved:    { label: "Resolved",    color: COLORS.success, bg: COLORS.successMuted },
  closed:      { label: "Closed",      color: COLORS.textMuted, bg: COLORS.surfaceActive },
};

const ESCALATED_STATUSES = new Set(["open", "assigned", "in_progress"]);
const ESCALATION_HOURS = 24;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const isEscalated = (ticket) => {
  if (!ESCALATED_STATUSES.has(ticket.status)) return false;
  const created = ticket.createdAt?.toDate?.() || new Date(ticket.createdAt);
  const hoursOld = (Date.now() - created.getTime()) / 3600000;
  return hoursOld > ESCALATION_HOURS;
};

const relativeTime = (ts) => {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 60) return "Just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

const shortId = (id) => id?.slice(-5).toUpperCase() || "—";

// ─── StatusBadge ──────────────────────────────────────────────────────────────

const StatusBadge = ({ status }) => {
  const cfg = STATUS_CFG[status] || STATUS_CFG.open;
  return (
    <span style={{
      fontSize: FONTS.size.xs, fontWeight: FONTS.weight.semibold,
      color: cfg.color, backgroundColor: cfg.bg,
      border: `1px solid ${cfg.color}30`,
      borderRadius: RADIUS.full, padding: `2px ${SPACING.sm}`,
      whiteSpace: "nowrap",
    }}>
      {cfg.label}
    </span>
  );
};

// ─── Assign Popover ───────────────────────────────────────────────────────────

const AssignPopover = ({ ticket, agents, onAssign, onClose }) => (
  <div style={{
    position: "fixed", inset: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 1000,
  }}
    onClick={(e) => e.target === e.currentTarget && onClose()}
  >
    <div style={{
      backgroundColor: COLORS.surface,
      border: `1px solid ${COLORS.border}`,
      borderRadius: RADIUS.xl,
      padding: SPACING.xl,
      width: "320px",
      boxShadow: SHADOWS.lg,
    }}>
      <div style={{ fontSize: FONTS.size.lg, fontWeight: FONTS.weight.bold, color: COLORS.textPrimary, marginBottom: SPACING.xs }}>
        Assign Ticket #{shortId(ticket.id)}
      </div>
      <div style={{ fontSize: FONTS.size.sm, color: COLORS.textSecondary, marginBottom: SPACING.lg }}>
        {ticket.title || "Support ticket"}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: SPACING.sm, maxHeight: "240px", overflowY: "auto" }}>
        {agents.length === 0 && (
          <div style={{ color: COLORS.textMuted, fontSize: FONTS.size.sm, textAlign: "center", padding: SPACING.base }}>
            No support agents found. Add one in Team Management.
          </div>
        )}
        {agents.map(agent => (
          <button
            key={agent.id}
            onClick={() => onAssign(agent)}
            style={{
              background: "none",
              border: `1px solid ${COLORS.border}`,
              borderRadius: RADIUS.md,
              padding: `${SPACING.sm} ${SPACING.md}`,
              display: "flex", alignItems: "center", gap: SPACING.md,
              cursor: "pointer", textAlign: "left",
              transition: TRANSITIONS.fast,
              fontFamily: FONTS.family,
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = COLORS.surfaceHover}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
          >
            <div style={{
              width: "32px", height: "32px", borderRadius: "50%",
              backgroundColor: COLORS.infoMuted, border: `1px solid ${COLORS.info}40`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: FONTS.size.base, fontWeight: FONTS.weight.bold,
              color: COLORS.info, flexShrink: 0,
            }}>
              {(agent.displayName || agent.email || "?").charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: FONTS.size.sm, fontWeight: FONTS.weight.semibold, color: COLORS.textPrimary }}>
                {agent.displayName || agent.email}
              </div>
              <div style={{ fontSize: FONTS.size.xs, color: COLORS.textSecondary }}>
                {agent.role === "support_agent" ? "Support Agent" : "Agent"}
              </div>
            </div>
            {ticket.assignedToId === agent.id && (
              <RiCheckLine size={16} color={COLORS.success} style={{ marginLeft: "auto" }} />
            )}
          </button>
        ))}
      </div>

      <button
        onClick={onClose}
        style={{ ...STYLES.buttonSecondary, width: "100%", marginTop: SPACING.md, justifyContent: "center", display: "flex" }}
      >
        Cancel
      </button>
    </div>
  </div>
);

// ─── SupportTicketsOverview ───────────────────────────────────────────────────

export const SupportTicketsOverview = () => {
  const { companyId } = useAuth();

  const [tickets, setTickets]   = useState([]);
  const [agents, setAgents]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch]             = useState("");
  const [sortKey, setSortKey]           = useState("createdAt");
  const [sortDir, setSortDir]           = useState("desc");

  const [assignTarget, setAssignTarget] = useState(null); // ticket to assign
  const [assigning, setAssigning]       = useState(false);

  // ── Load ──────────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!companyId) return;
    try {
      const [ticketsSnap, usersSnap] = await Promise.all([
        getDocs(query(
          collection(db, COLLECTIONS.TICKETS),
          where("companyId", "==", companyId),
          orderBy("createdAt", "desc"),
        )),
        getDocs(query(
          collection(db, COLLECTIONS.USERS),
          where("companyId", "==", companyId),
          where("role", "in", ["support_agent", "agent", "manager"]),
        )),
      ]);
      setTickets(ticketsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setAgents(usersSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("SupportTicketsOverview: loadData error:", err);
    }
  }, [companyId]);

  useEffect(() => {
    setLoading(true);
    loadData().finally(() => setLoading(false));
  }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // ── Assign ticket ─────────────────────────────────────────────────────────
  const handleAssign = async (agent) => {
    if (!assignTarget) return;
    setAssigning(true);
    try {
      await updateDoc(doc(db, COLLECTIONS.TICKETS, assignTarget.id), {
        assignedToId:   agent.id,
        assignedToName: agent.displayName || agent.email,
        status:         assignTarget.status === "open" ? "assigned" : assignTarget.status,
        updatedAt:      serverTimestamp(),
      });
      await loadData();
      setAssignTarget(null);
    } catch (err) {
      console.error("SupportTicketsOverview: assign error:", err);
    } finally {
      setAssigning(false);
    }
  };

  // ── Quick status update ───────────────────────────────────────────────────
  const advanceStatus = async (ticket) => {
    const map = { open: "assigned", assigned: "in_progress", in_progress: "resolved", resolved: "closed" };
    const next = map[ticket.status];
    if (!next) return;
    try {
      await updateDoc(doc(db, COLLECTIONS.TICKETS, ticket.id), {
        status: next, updatedAt: serverTimestamp(),
      });
      await loadData();
    } catch (err) {
      console.error("SupportTicketsOverview: advanceStatus error:", err);
    }
  };

  // ── Filter + sort ─────────────────────────────────────────────────────────
  const filtered = tickets
    .filter(t => {
      const q = search.toLowerCase();
      const matchSearch = !q ||
        t.title?.toLowerCase().includes(q) ||
        t.leadName?.toLowerCase().includes(q) ||
        t.assignedToName?.toLowerCase().includes(q);
      const matchStatus = statusFilter === "all" || t.status === statusFilter;
      return matchSearch && matchStatus;
    })
    .sort((a, b) => {
      // Escalated first always
      const ea = isEscalated(a), eb = isEscalated(b);
      if (ea && !eb) return -1;
      if (!ea && eb) return 1;

      let av = a[sortKey], bv = b[sortKey];
      if (av?.toDate) av = av.toDate().getTime();
      if (bv?.toDate) bv = bv.toDate().getTime();
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

  // ── Tab counts ────────────────────────────────────────────────────────────
  const tabCounts = STATUS_TABS.reduce((m, t) => {
    m[t.value] = t.value === "all"
      ? tickets.length
      : tickets.filter(tk => tk.status === t.value).length;
    return m;
  }, {});

  const escalatedCount = tickets.filter(isEscalated).length;

  const ColHeader = ({ label, sortable, colKey }) => (
    <div
      onClick={sortable ? () => {
        if (sortKey === colKey) setSortDir(d => d === "asc" ? "desc" : "asc");
        else { setSortKey(colKey); setSortDir("desc"); }
      } : undefined}
      style={{
        fontSize: FONTS.size.xs, fontWeight: FONTS.weight.semibold,
        color: sortKey === colKey ? COLORS.primary : COLORS.textMuted,
        textTransform: "uppercase", letterSpacing: "0.06em",
        cursor: sortable ? "pointer" : "default",
        display: "flex", alignItems: "center", gap: "3px", userSelect: "none",
      }}
    >
      {label}
      {sortable && sortKey === colKey && (sortDir === "asc" ? <RiArrowUpLine size={11} /> : <RiArrowDownLine size={11} />)}
    </div>
  );

  const COLS = "72px 1fr 120px 140px 130px 120px 80px";

  return (
    <div style={{
      backgroundColor: COLORS.background, minHeight: "calc(100vh - 60px)",
      padding: `${SPACING["2xl"]} ${SPACING["2xl"]}`,
      fontFamily: FONTS.family, boxSizing: "border-box",
    }}>
      <style>{`
        @keyframes tirasSpinKf { from{transform:rotate(0)} to{transform:rotate(360deg)} }
        @keyframes tirasGlow { 0%,100%{box-shadow:0 0 0 0 ${COLORS.danger}00} 50%{box-shadow:0 0 8px 1px ${COLORS.danger}40} }
        .tiras-trow:hover { background-color: ${COLORS.surfaceHover} !important; }
        select option { background: ${COLORS.surface}; color: ${COLORS.textPrimary}; }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: SPACING.base, marginBottom: SPACING.xl }}>
        <div>
          <h1 style={{ margin: 0, fontSize: FONTS.size["4xl"], fontWeight: FONTS.weight.bold, color: COLORS.textPrimary, letterSpacing: "-0.5px" }}>
            Support Tickets
          </h1>
          <p style={{ margin: `${SPACING.xs} 0 0`, fontSize: FONTS.size.base, color: COLORS.textSecondary }}>
            {loading ? "Loading…" : (
              <>
                {tickets.length} total ·{" "}
                {escalatedCount > 0 && (
                  <span style={{ color: COLORS.danger }}>
                    🔴 {escalatedCount} escalated (over {ESCALATION_HOURS}h)
                  </span>
                )}
                {escalatedCount === 0 && <span style={{ color: COLORS.success }}>✓ No escalations</span>}
              </>
            )}
          </p>
        </div>
        <button onClick={handleRefresh} disabled={refreshing} style={{ ...STYLES.buttonSecondary, display: "flex", alignItems: "center", gap: SPACING.xs, opacity: refreshing ? 0.4 : 1 }}>
          <RiRefreshLine size={15} style={{ animation: refreshing ? "tirasSpinKf 0.7s linear infinite" : "none" }} />
          Refresh
        </button>
      </div>

      {/* Status Tabs */}
      <div style={{
        display: "flex", gap: "2px", backgroundColor: COLORS.surface,
        border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.md,
        padding: "3px", marginBottom: SPACING.base,
        flexWrap: "wrap", width: "fit-content",
      }}>
        {STATUS_TABS.map(tab => {
          const active = statusFilter === tab.value;
          const count  = tabCounts[tab.value];
          const isAlert = tab.value !== "all" && tab.value !== "closed" && tab.value !== "resolved" && count > 0;
          return (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              style={{
                background: active ? COLORS.primary : "transparent",
                border: "none", borderRadius: RADIUS.base,
                color: active ? "#fff" : COLORS.textSecondary,
                fontSize: FONTS.size.sm, fontWeight: active ? FONTS.weight.semibold : FONTS.weight.regular,
                padding: `4px ${SPACING.md}`, cursor: "pointer",
                transition: TRANSITIONS.fast, fontFamily: FONTS.family,
                display: "flex", alignItems: "center", gap: "5px", whiteSpace: "nowrap",
              }}
            >
              {tab.label}
              {count > 0 && (
                <span style={{
                  backgroundColor: active ? "rgba(255,255,255,0.25)" : (isAlert ? COLORS.danger + "30" : COLORS.surfaceActive),
                  color: active ? "#fff" : (isAlert ? COLORS.danger : COLORS.textSecondary),
                  borderRadius: RADIUS.full, padding: `0px 6px`,
                  fontSize: FONTS.size.xs, fontWeight: FONTS.weight.bold,
                }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div style={{ position: "relative", marginBottom: SPACING.base, maxWidth: "380px" }}>
        <RiSearchLine size={15} color={COLORS.textMuted} style={{ position: "absolute", left: SPACING.md, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
        <input type="text" placeholder="Search by title, lead, or assignee…" value={search} onChange={e => setSearch(e.target.value)}
          style={{ ...STYLES.input, paddingLeft: "34px" }} />
      </div>

      {/* Table */}
      <div style={{ backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.lg, overflow: "hidden" }}>
        {/* Header */}
        <div style={{ display: "grid", gridTemplateColumns: COLS, padding: `${SPACING.sm} ${SPACING.lg}`, backgroundColor: COLORS.surfaceActive, borderBottom: `1px solid ${COLORS.border}`, gap: SPACING.base, alignItems: "center" }}>
          <ColHeader label="Ticket #" />
          <ColHeader label="Title / Lead" sortable colKey="title" />
          <ColHeader label="Status" />
          <ColHeader label="Assigned To" />
          <ColHeader label="Created" sortable colKey="createdAt" />
          <ColHeader label="Last Update" sortable colKey="updatedAt" />
          <div style={{ fontSize: FONTS.size.xs, fontWeight: FONTS.weight.semibold, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "right" }}>Actions</div>
        </div>

        {loading && (
          <div style={{ padding: SPACING["5xl"], textAlign: "center" }}>
            <RiLoader4Line size={26} color={COLORS.textMuted} style={{ animation: "tirasSpinKf 1s linear infinite" }} />
            <div style={{ color: COLORS.textMuted, fontSize: FONTS.size.sm, marginTop: SPACING.sm }}>Loading tickets…</div>
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div style={{ padding: SPACING["5xl"], textAlign: "center" }}>
            <RiCustomerServiceLine size={36} color={COLORS.textMuted} style={{ marginBottom: SPACING.md }} />
            <div style={{ color: COLORS.textPrimary, fontWeight: FONTS.weight.semibold, marginBottom: SPACING.xs }}>
              {search || statusFilter !== "all" ? "No tickets match your filters" : "No support tickets"}
            </div>
            <div style={{ color: COLORS.textSecondary, fontSize: FONTS.size.sm }}>Tickets are raised by agents from the lead detail page.</div>
          </div>
        )}

        {!loading && filtered.map((ticket, idx) => {
          const escalated = isEscalated(ticket);
          const canAdvance = ["open","assigned","in_progress","resolved"].includes(ticket.status);

          return (
            <div
              key={ticket.id}
              className="tiras-trow"
              style={{
                display: "grid", gridTemplateColumns: COLS,
                padding: `${SPACING.md} ${SPACING.lg}`,
                borderBottom: idx < filtered.length - 1 ? `1px solid ${COLORS.border}` : "none",
                gap: SPACING.base, alignItems: "center",
                backgroundColor: escalated ? COLORS.danger + "08" : COLORS.surface,
                borderLeft: escalated ? `3px solid ${COLORS.danger}` : "3px solid transparent",
                transition: TRANSITIONS.fast,
                animation: escalated ? "tirasGlow 2s ease-in-out infinite" : "none",
              }}
            >
              {/* Ticket ID */}
              <div style={{ fontSize: FONTS.size.xs, fontFamily: "'JetBrains Mono', monospace", color: escalated ? COLORS.danger : COLORS.textMuted, display: "flex", alignItems: "center", gap: "3px" }}>
                {escalated && <RiAlertLine size={11} />}
                #{shortId(ticket.id)}
              </div>

              {/* Title + Lead */}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: FONTS.size.sm, fontWeight: FONTS.weight.semibold, color: COLORS.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {ticket.title || "Untitled ticket"}
                </div>
                {ticket.leadName && (
                  <div style={{ fontSize: FONTS.size.xs, color: COLORS.textSecondary, display: "flex", alignItems: "center", gap: "3px", marginTop: "2px" }}>
                    <RiPhoneLine size={10} /> {ticket.leadName}
                  </div>
                )}
              </div>

              {/* Status */}
              <div><StatusBadge status={ticket.status} /></div>

              {/* Assigned To */}
              <div style={{ fontSize: FONTS.size.sm, color: ticket.assignedToName ? COLORS.textSecondary : COLORS.textMuted }}>
                {ticket.assignedToName || <span style={{ fontStyle: "italic" }}>Unassigned</span>}
              </div>

              {/* Created */}
              <div style={{ fontSize: FONTS.size.sm, color: COLORS.textSecondary }}>
                {relativeTime(ticket.createdAt)}
              </div>

              {/* Updated */}
              <div style={{ fontSize: FONTS.size.sm, color: COLORS.textSecondary }}>
                {relativeTime(ticket.updatedAt || ticket.createdAt)}
              </div>

              {/* Actions */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "5px" }}>
                <button
                  onClick={() => setAssignTarget(ticket)}
                  title="Assign"
                  style={{ background: "none", border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.base, color: COLORS.textSecondary, cursor: "pointer", padding: "5px", display: "flex", alignItems: "center" }}
                >
                  <RiUserAddLine size={13} />
                </button>
                {canAdvance && (
                  <button
                    onClick={() => advanceStatus(ticket)}
                    title="Advance status"
                    style={{ background: "none", border: `1px solid ${COLORS.success}50`, borderRadius: RADIUS.base, color: COLORS.success, cursor: "pointer", padding: "5px", display: "flex", alignItems: "center" }}
                  >
                    <RiCheckLine size={13} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Assign Popover */}
      {assignTarget && (
        <AssignPopover
          ticket={assignTarget}
          agents={agents}
          onAssign={handleAssign}
          onClose={() => setAssignTarget(null)}
        />
      )}
    </div>
  );
};
