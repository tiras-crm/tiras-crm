// ─────────────────────────────────────────────────────────────────────────────
// TIRAS CRM — MyLeadsList
// File: src/pages/MyLeadsList.jsx
//
// HOW TO USE:
//   In src/pages/index.js replace:
//     export const MyLeadsList = () => <Placeholder name="My Leads List" />;
//   with the full contents of this file.
//
// FIRESTORE:
//   Real-time onSnapshot on leads
//   where assignedTo == currentUser.uid AND companyId == companyId
//   All filtering / sorting is client-side — no extra composite indexes needed.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
} from "firebase/firestore";
import { db, COLLECTIONS } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import {
  COLORS,
  FONTS,
  SPACING,
  RADIUS,
  SHADOWS,
  TRANSITIONS,
} from "../theme";

// ─── Keyframe injection ───────────────────────────────────────────────────────

const STYLE_ID = "tiras-leads-styles";
const injectStyles = () => {
  if (document.getElementById(STYLE_ID)) return;
  const tag = document.createElement("style");
  tag.id = STYLE_ID;
  tag.textContent = `
    @keyframes tiras-fade-up   { from { opacity:0; transform:translateY(10px);} to { opacity:1; transform:translateY(0);} }
    @keyframes tiras-spin       { to { transform: rotate(360deg); } }
    @keyframes tiras-row-in     { from { opacity:0; transform:translateX(-6px);} to { opacity:1; transform:translateX(0);} }
    @keyframes tiras-dropdown-in{ from { opacity:0; transform:translateY(-6px);} to { opacity:1; transform:translateY(0);} }
  `;
  document.head.appendChild(tag);
};

// ─── Constants ────────────────────────────────────────────────────────────────

const STAGES = [
  "New", "Contacted", "Interested",
  "Follow-up", "Negotiation", "Closed Won", "Closed Lost",
];

const SOURCES = [
  "IndiaMART", "Website", "Cold Call", "Referral",
  "Walk-in", "Social Media", "WhatsApp", "Trade Show",
];

const SCORES = ["Hot", "Warm", "Cold", "Dead"];

const SORT_OPTIONS = [
  { value: "newest",    label: "Newest first" },
  { value: "oldest",    label: "Oldest first" },
  { value: "name_az",   label: "Name A → Z" },
  { value: "name_za",   label: "Name Z → A" },
  { value: "last_call", label: "Last call" },
  { value: "score",     label: "Lead score" },
];

const SCORE_ORDER = { Hot: 0, Warm: 1, Cold: 2, Dead: 3 };

// ─── Visual config ────────────────────────────────────────────────────────────

const STAGE_COLORS = {
  "New":         { text: COLORS.textMuted,  bg: `${COLORS.textMuted}18`  },
  "Contacted":   { text: COLORS.info,       bg: `${COLORS.info}18`       },
  "Interested":  { text: COLORS.accent,     bg: `${COLORS.accent}18`     },
  "Follow-up":   { text: COLORS.warning,    bg: `${COLORS.warning}18`    },
  "Negotiation": { text: COLORS.primary,    bg: `${COLORS.primary}18`    },
  "Closed Won":  { text: COLORS.success,    bg: `${COLORS.success}18`    },
  "Closed Lost": { text: COLORS.danger,     bg: `${COLORS.danger}18`     },
};

const SCORE_COLORS = {
  Hot:  { text: COLORS.hot,   bg: `${COLORS.hot}18`,   dot: COLORS.hot   },
  Warm: { text: COLORS.warm,  bg: `${COLORS.warm}18`,  dot: COLORS.warm  },
  Cold: { text: COLORS.cold,  bg: `${COLORS.cold}18`,  dot: COLORS.cold  },
  Dead: { text: COLORS.dead,  bg: `${COLORS.dead}18`,  dot: COLORS.dead  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const timeAgo = (ts) => {
  if (!ts) return null;
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const diff  = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  const days = Math.floor(diff / 86400);
  if (days === 1)   return "Yesterday";
  if (days < 7)     return `${days}d ago`;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

const normalise = (str) => (str ?? "").toLowerCase().trim();

// ─── Style objects ────────────────────────────────────────────────────────────

const S = {
  page: {
    minHeight: "100%",
    backgroundColor: COLORS.background,
    padding: SPACING["2xl"],
    fontFamily: FONTS.family,
  },

  // ── Header ──────────────────────────────────────────────────────────────────
  pageHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: SPACING.xl,
    gap: SPACING.base,
    flexWrap: "wrap",
    animation: "tiras-fade-up 0.3s ease both",
  },
  headerLeft: { display: "flex", flexDirection: "column", gap: "3px" },
  pageTitle: {
    color: COLORS.textPrimary,
    fontSize: FONTS.size["3xl"],
    fontWeight: FONTS.weight.bold,
    letterSpacing: "-0.01em",
  },
  pageSubtitle: { color: COLORS.textSecondary, fontSize: FONTS.size.base },

  // ── Add Lead button ─────────────────────────────────────────────────────────
  addBtn: {
    backgroundColor: COLORS.primary,
    color: "#121212",
    border: "none",
    borderRadius: RADIUS.md,
    fontFamily: FONTS.family,
    fontSize: FONTS.size.base,
    fontWeight: FONTS.weight.semibold,
    padding: `${SPACING.sm} ${SPACING.lg}`,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: SPACING.xs,
    transition: TRANSITIONS.base,
    boxShadow: SHADOWS.primary,
    flexShrink: 0,
    whiteSpace: "nowrap",
  },

  // ── Toolbar (search + filters) ──────────────────────────────────────────────
  toolbar: {
    display: "flex",
    gap: SPACING.sm,
    marginBottom: SPACING.base,
    flexWrap: "wrap",
    alignItems: "center",
    animation: "tiras-fade-up 0.3s ease 60ms both",
  },
  searchWrap: {
    position: "relative",
    flex: "1 1 220px",
    minWidth: "180px",
  },
  searchIcon: {
    position: "absolute",
    left: SPACING.md,
    top: "50%",
    transform: "translateY(-50%)",
    color: COLORS.textMuted,
    pointerEvents: "none",
    display: "flex",
  },
  searchInput: {
    backgroundColor: COLORS.surface,
    border: `1px solid ${COLORS.border}`,
    borderRadius: RADIUS.md,
    color: COLORS.textPrimary,
    fontFamily: FONTS.family,
    fontSize: FONTS.size.base,
    padding: `${SPACING.sm} ${SPACING.md} ${SPACING.sm} 38px`,
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
    transition: TRANSITIONS.fast,
  },

  // Filter select
  filterSelect: {
    backgroundColor: COLORS.surface,
    border: `1px solid ${COLORS.border}`,
    borderRadius: RADIUS.md,
    color: COLORS.textSecondary,
    fontFamily: FONTS.family,
    fontSize: FONTS.size.sm,
    padding: `${SPACING.sm} ${SPACING.md}`,
    outline: "none",
    cursor: "pointer",
    transition: TRANSITIONS.fast,
    flexShrink: 0,
  },

  // Results bar
  resultsBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.base,
    gap: SPACING.sm,
    flexWrap: "wrap",
  },
  resultsCount: {
    color: COLORS.textMuted,
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.medium,
  },
  clearFiltersBtn: {
    background: "none",
    border: "none",
    color: COLORS.accent,
    fontFamily: FONTS.family,
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.medium,
    cursor: "pointer",
    padding: "0",
    transition: TRANSITIONS.fast,
  },

  // ── Table ───────────────────────────────────────────────────────────────────
  tableWrap: {
    backgroundColor: COLORS.surface,
    border: `1px solid ${COLORS.border}`,
    borderRadius: RADIUS.lg,
    boxShadow: SHADOWS.sm,
    overflow: "hidden",
    animation: "tiras-fade-up 0.35s ease 100ms both",
  },
  tableHeader: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 100px",
    backgroundColor: COLORS.surfaceActive,
    padding: `${SPACING.sm} ${SPACING.xl}`,
    borderBottom: `1px solid ${COLORS.border}`,
  },
  th: {
    color: COLORS.textMuted,
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.semibold,
    textTransform: "uppercase",
    letterSpacing: "0.07em",
    userSelect: "none",
    display: "flex",
    alignItems: "center",
    gap: "4px",
  },
  tableRow: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 100px",
    padding: `${SPACING.md} ${SPACING.xl}`,
    borderBottom: `1px solid ${COLORS.border}`,
    cursor: "pointer",
    transition: TRANSITIONS.fast,
    alignItems: "center",
    animation: "tiras-row-in 0.2s ease both",
  },
  td: {
    display: "flex",
    alignItems: "center",
    overflow: "hidden",
  },

  // Lead name cell
  leadName: {
    color: COLORS.textPrimary,
    fontSize: FONTS.size.base,
    fontWeight: FONTS.weight.semibold,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  leadPhone: {
    color: COLORS.textMuted,
    fontSize: FONTS.size.sm,
    marginTop: "1px",
  },

  // Badge
  badge: {
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.semibold,
    padding: `2px ${SPACING.sm}`,
    borderRadius: RADIUS.full,
    whiteSpace: "nowrap",
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
  },
  scoreDot: {
    width: "5px",
    height: "5px",
    borderRadius: "50%",
    flexShrink: 0,
  },

  sourceTag: {
    color: COLORS.textSecondary,
    fontSize: FONTS.size.sm,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  lastActivity: {
    color: COLORS.textMuted,
    fontSize: FONTS.size.sm,
    whiteSpace: "nowrap",
  },
  activityOutcome: {
    display: "block",
    color: COLORS.textSecondary,
    fontSize: FONTS.size.xs,
    marginTop: "1px",
  },

  // Action buttons in row
  actionWrap: {
    display: "flex",
    gap: SPACING.xs,
    justifyContent: "flex-end",
  },
  iconBtn: {
    background: "none",
    border: `1px solid ${COLORS.border}`,
    borderRadius: RADIUS.base,
    color: COLORS.textSecondary,
    cursor: "pointer",
    padding: "5px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: TRANSITIONS.fast,
    flexShrink: 0,
  },

  // Loading / empty
  loadingWrap: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: `${SPACING["5xl"]} ${SPACING.xl}`,
    gap: SPACING.sm,
    color: COLORS.textMuted,
    fontSize: FONTS.size.sm,
  },
  spinner: {
    width: "18px",
    height: "18px",
    borderRadius: "50%",
    border: `2px solid ${COLORS.border}`,
    borderTopColor: COLORS.primary,
    animation: "tiras-spin 0.7s linear infinite",
    flexShrink: 0,
  },
  emptyState: {
    textAlign: "center",
    padding: `${SPACING["5xl"]} ${SPACING.xl}`,
    color: COLORS.textMuted,
  },
  emptyIcon: { fontSize: "36px", marginBottom: SPACING.md, opacity: 0.4 },
  emptyTitle: {
    color: COLORS.textSecondary,
    fontSize: FONTS.size.lg,
    fontWeight: FONTS.weight.semibold,
    marginBottom: SPACING.xs,
  },
  emptyBody: { fontSize: FONTS.size.base, lineHeight: FONTS.lineHeight.relaxed },
};

// ─── SVG icons ────────────────────────────────────────────────────────────────

const SearchIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);
const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);
const EyeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
  </svg>
);
const PhoneIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.39 2 2 0 0 1 3.6 1.21h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.85a16 16 0 0 0 6.29 6.29l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
  </svg>
);
const ChevronIcon = ({ dir = "down" }) => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
    style={{ transform: dir === "up" ? "rotate(180deg)" : "none" }}>
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// MyLeadsList Component
// ─────────────────────────────────────────────────────────────────────────────

export const MyLeadsList = () => {
  const { currentUser, companyId } = useAuth();
  const navigate = useNavigate();

  // ─── Data state ─────────────────────────────────────────────────────────────
  const [leads,   setLeads]   = useState(null);   // null = loading
  const [error,   setError]   = useState(null);

  // ─── Filter / sort state ────────────────────────────────────────────────────
  const [search,    setSearch]    = useState("");
  const [stageFilter, setStageFilter] = useState("All");
  const [scoreFilter, setScoreFilter] = useState("All");
  const [sourceFilter,setSourceFilter]= useState("All");
  const [sortBy,    setSortBy]    = useState("newest");

  // ─── Hover state for rows ───────────────────────────────────────────────────
  const [hoveredRow,    setHoveredRow]    = useState(null);
  const [hoveredAddBtn, setHoveredAddBtn] = useState(false);

  // ─── Firestore real-time listener ───────────────────────────────────────────
  useEffect(() => {
    injectStyles();
    if (!currentUser || !companyId) return;

    const q = query(
      collection(db, COLLECTIONS.LEADS),
      where("assignedTo", "==", currentUser.uid),
      where("companyId",  "==", companyId),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setLeads(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setError(null);
      },
      (err) => {
        console.error("MyLeadsList snapshot error:", err);
        setError("Could not load leads. Check your connection.");
      }
    );

    return () => unsub();
  }, [currentUser, companyId]);

  // ─── Client-side filter + sort ───────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!leads) return [];

    const term = normalise(search);

    return leads
      .filter((lead) => {
        if (term) {
          const match =
            normalise(lead.name).includes(term) ||
            normalise(lead.phone).includes(term) ||
            normalise(lead.email).includes(term);
          if (!match) return false;
        }
        if (stageFilter  !== "All" && lead.stage   !== stageFilter)  return false;
        if (scoreFilter  !== "All" && lead.leadScore !== scoreFilter) return false;
        if (sourceFilter !== "All" && lead.source   !== sourceFilter) return false;
        return true;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case "oldest":
            return (a.createdAt?.seconds ?? 0) - (b.createdAt?.seconds ?? 0);
          case "name_az":
            return normalise(a.name).localeCompare(normalise(b.name));
          case "name_za":
            return normalise(b.name).localeCompare(normalise(a.name));
          case "last_call":
            return (b.lastCallAt?.seconds ?? 0) - (a.lastCallAt?.seconds ?? 0);
          case "score":
            return (SCORE_ORDER[a.leadScore] ?? 9) - (SCORE_ORDER[b.leadScore] ?? 9);
          default: // newest
            return (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0);
        }
      });
  }, [leads, search, stageFilter, scoreFilter, sourceFilter, sortBy]);

  // ─── Filter helpers ──────────────────────────────────────────────────────────
  const hasActiveFilters =
    search || stageFilter !== "All" || scoreFilter !== "All" || sourceFilter !== "All";

  const clearFilters = () => {
    setSearch(""); setStageFilter("All"); setScoreFilter("All"); setSourceFilter("All");
  };

  // ─── Navigation ──────────────────────────────────────────────────────────────
  const goToLead = (id) => navigate(`/agent/lead/${id}`);
  const goToCall = (e, lead) => {
    e.stopPropagation();
    navigate("/agent/call", { state: { lead } });
  };

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={S.page}>

      {/* Page header */}
      <div style={S.pageHeader}>
        <div style={S.headerLeft}>
          <div style={S.pageTitle}>My Leads</div>
          <div style={S.pageSubtitle}>
            {leads !== null
              ? `${leads.length} lead${leads.length !== 1 ? "s" : ""} assigned to you`
              : "Loading your leads…"}
          </div>
        </div>
        <button
          style={{
            ...S.addBtn,
            ...(hoveredAddBtn
              ? { backgroundColor: COLORS.primaryHover, transform: "translateY(-1px)", boxShadow: `0 6px 20px ${COLORS.primary}45` }
              : {}),
          }}
          onMouseEnter={() => setHoveredAddBtn(true)}
          onMouseLeave={() => setHoveredAddBtn(false)}
          onClick={() => navigate("/agent/add-lead")}
        >
          <PlusIcon /> Add Lead
        </button>
      </div>

      {/* Toolbar */}
      <div style={S.toolbar}>
        {/* Search */}
        <div style={S.searchWrap}>
          <span style={S.searchIcon}><SearchIcon /></span>
          <input
            type="text"
            placeholder="Search name, phone or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={S.searchInput}
            onFocus={(e)  => { e.target.style.border = `1px solid ${COLORS.inputFocus}`; e.target.style.boxShadow = `0 0 0 3px ${COLORS.primary}22`; }}
            onBlur={(e)   => { e.target.style.border = `1px solid ${COLORS.border}`;     e.target.style.boxShadow = "none"; }}
          />
        </div>

        {/* Stage filter */}
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          style={S.filterSelect}
        >
          <option value="All">All Stages</option>
          {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        {/* Score filter */}
        <select
          value={scoreFilter}
          onChange={(e) => setScoreFilter(e.target.value)}
          style={S.filterSelect}
        >
          <option value="All">All Scores</option>
          {SCORES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        {/* Source filter */}
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          style={S.filterSelect}
        >
          <option value="All">All Sources</option>
          {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        {/* Sort */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          style={{ ...S.filterSelect, color: COLORS.textPrimary }}
        >
          {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Results bar */}
      {leads !== null && (
        <div style={S.resultsBar}>
          <span style={S.resultsCount}>
            {filtered.length === leads.length
              ? `${leads.length} lead${leads.length !== 1 ? "s" : ""}`
              : `${filtered.length} of ${leads.length} leads`}
          </span>
          {hasActiveFilters && (
            <button style={S.clearFiltersBtn} onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          backgroundColor: `${COLORS.danger}14`,
          border: `1px solid ${COLORS.danger}40`,
          borderRadius: RADIUS.md,
          padding: `${SPACING.sm} ${SPACING.base}`,
          color: COLORS.danger,
          fontSize: FONTS.size.sm,
          marginBottom: SPACING.base,
        }}>
          {error}
        </div>
      )}

      {/* Table */}
      <div style={S.tableWrap}>

        {/* Header row */}
        <div style={S.tableHeader}>
          <div style={S.th}>Lead</div>
          <div style={S.th}>Stage</div>
          <div style={S.th}>Score</div>
          <div style={S.th}>Source</div>
          <div style={S.th}>
            Last Activity
            {sortBy === "last_call" && <ChevronIcon dir="down" />}
          </div>
          <div style={{ ...S.th, justifyContent: "flex-end" }}>Actions</div>
        </div>

        {/* Loading */}
        {leads === null && (
          <div style={S.loadingWrap}>
            <div style={S.spinner} />
            <span>Loading your leads…</span>
          </div>
        )}

        {/* Empty — no leads assigned at all */}
        {leads !== null && leads.length === 0 && (
          <div style={S.emptyState}>
            <div style={S.emptyIcon}>📋</div>
            <div style={S.emptyTitle}>No leads yet</div>
            <div style={S.emptyBody}>
              Your manager hasn't assigned any leads yet, or add your first lead now.
            </div>
          </div>
        )}

        {/* Empty — filters returned nothing */}
        {leads !== null && leads.length > 0 && filtered.length === 0 && (
          <div style={S.emptyState}>
            <div style={S.emptyIcon}>🔍</div>
            <div style={S.emptyTitle}>No results</div>
            <div style={S.emptyBody}>
              No leads match your search or filters.{" "}
              <button style={{ ...S.clearFiltersBtn, fontSize: FONTS.size.base }} onClick={clearFilters}>
                Clear filters
              </button>
            </div>
          </div>
        )}

        {/* Rows */}
        {filtered.map((lead, idx) => {
          const stageConf = STAGE_COLORS[lead.stage]  ?? { text: COLORS.textMuted, bg: `${COLORS.textMuted}18` };
          const scoreConf = SCORE_COLORS[lead.leadScore] ?? { text: COLORS.textMuted, bg: `${COLORS.textMuted}18`, dot: COLORS.textMuted };
          const isHovered = hoveredRow === lead.id;

          return (
            <div
              key={lead.id}
              style={{
                ...S.tableRow,
                animationDelay: `${Math.min(idx * 30, 300)}ms`,
                backgroundColor: isHovered ? COLORS.surfaceHover : "transparent",
                borderBottom: idx === filtered.length - 1 ? "none" : `1px solid ${COLORS.border}`,
              }}
              onMouseEnter={() => setHoveredRow(lead.id)}
              onMouseLeave={() => setHoveredRow(null)}
              onClick={() => goToLead(lead.id)}
            >
              {/* Lead name + phone */}
              <div style={{ ...S.td, flexDirection: "column", alignItems: "flex-start" }}>
                <div style={S.leadName}>{lead.name ?? "—"}</div>
                <div style={S.leadPhone}>{lead.phone ?? "—"}</div>
              </div>

              {/* Stage badge */}
              <div style={S.td}>
                <span style={{
                  ...S.badge,
                  color: stageConf.text,
                  backgroundColor: stageConf.bg,
                }}>
                  {lead.stage ?? "New"}
                </span>
              </div>

              {/* Score badge */}
              <div style={S.td}>
                {lead.leadScore ? (
                  <span style={{
                    ...S.badge,
                    color: scoreConf.text,
                    backgroundColor: scoreConf.bg,
                  }}>
                    <span style={{ ...S.scoreDot, backgroundColor: scoreConf.dot }} />
                    {lead.leadScore}
                  </span>
                ) : (
                  <span style={{ color: COLORS.textMuted, fontSize: FONTS.size.sm }}>—</span>
                )}
              </div>

              {/* Source */}
              <div style={S.td}>
                <span style={S.sourceTag}>{lead.source ?? "—"}</span>
              </div>

              {/* Last activity */}
              <div style={{ ...S.td, flexDirection: "column", alignItems: "flex-start" }}>
                {lead.lastCallAt ? (
                  <>
                    <span style={S.lastActivity}>{timeAgo(lead.lastCallAt)}</span>
                    {lead.lastCallOutcome && (
                      <span style={S.activityOutcome}>{lead.lastCallOutcome}</span>
                    )}
                  </>
                ) : (
                  <span style={{ color: COLORS.textMuted, fontSize: FONTS.size.sm }}>
                    Never called
                  </span>
                )}
              </div>

              {/* Actions */}
              <div style={{ ...S.td, justifyContent: "flex-end" }}>
                <div style={S.actionWrap} onClick={(e) => e.stopPropagation()}>
                  {/* View detail */}
                  <button
                    style={{
                      ...S.iconBtn,
                      ...(isHovered ? { borderColor: COLORS.primary, color: COLORS.primary } : {}),
                    }}
                    title="View lead"
                    onClick={() => goToLead(lead.id)}
                  >
                    <EyeIcon />
                  </button>
                  {/* Quick call */}
                  <button
                    style={{
                      ...S.iconBtn,
                      ...(isHovered ? { borderColor: COLORS.success, color: COLORS.success } : {}),
                    }}
                    title={`Call ${lead.phone}`}
                    onClick={(e) => goToCall(e, lead)}
                  >
                    <PhoneIcon />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
};

export default MyLeadsList;
