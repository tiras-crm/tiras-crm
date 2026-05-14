// TIRAS CRM — AllLeadsView.jsx
// Company Admin — every lead across all agents, filterable, sortable, bulk-actionable
//
// USAGE: In src/pages/index.js replace:
//   export const AllLeadsView = () => <Placeholder name="All Leads View" />;
// with:
//   export { AllLeadsView } from "./AllLeadsView";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  collection, query, where, getDocs, doc,
  updateDoc, deleteDoc, serverTimestamp, orderBy,
} from "firebase/firestore";
import { db, COLLECTIONS } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import {
  COLORS, FONTS, SPACING, RADIUS, SHADOWS, STYLES, TRANSITIONS,
} from "../theme";
import {
  RiSearchLine, RiFilterLine, RiAddLine, RiDownloadLine,
  RiLoader4Line, RiUserLine, RiPhoneLine, RiDeleteBinLine,
  RiEditLine, RiArrowUpLine, RiArrowDownLine, RiArrowLeftLine,
  RiArrowRightLine, RiCheckboxLine, RiCheckboxBlankLine,
  RiFireLine, RiTempColdLine, RiSkullLine, RiAlertLine,
  RiRefreshLine, RiFundsLine,
} from "react-icons/ri";

// ─── Constants ────────────────────────────────────────────────────────────────

const STAGES = [
  "New", "Contacted", "Interested", "Follow-up",
  "Negotiation", "Closed Won", "Closed Lost",
];

const SOURCES = [
  "IndiaMART", "Website", "Cold Call", "Referral",
  "Walk-in", "Social Media", "WhatsApp", "Trade Show", "Other",
];

const STAGE_COLOR = {
  "New":         COLORS.info,
  "Contacted":   COLORS.primary,
  "Interested":  COLORS.accent,
  "Follow-up":   COLORS.warning,
  "Negotiation": "#9B59B6",
  "Closed Won":  COLORS.success,
  "Closed Lost": COLORS.danger,
};

const SCORE_CFG = {
  hot:  { label: "🔥 Hot",  color: COLORS.hot,  bg: COLORS.hot  + "22" },
  warm: { label: "♨ Warm", color: COLORS.warm, bg: COLORS.warm + "22" },
  cold: { label: "❄ Cold", color: COLORS.cold, bg: COLORS.cold + "22" },
  dead: { label: "☠ Dead", color: COLORS.dead, bg: COLORS.dead + "22" },
};

const PAGE_SIZE = 25;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatINR = (n) => {
  if (!n) return "—";
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000)   return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n.toLocaleString("en-IN")}`;
};

const relativeTime = (ts) => {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 60)    return "Just now";
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

// ─── Small reusable bits ──────────────────────────────────────────────────────

const StageBadge = ({ stage }) => {
  const color = STAGE_COLOR[stage] || COLORS.textMuted;
  return (
    <span style={{
      fontSize: FONTS.size.xs, fontWeight: FONTS.weight.semibold,
      color, backgroundColor: color + "22",
      border: `1px solid ${color}35`,
      borderRadius: RADIUS.full, padding: `2px ${SPACING.sm}`,
      whiteSpace: "nowrap",
    }}>
      {stage || "—"}
    </span>
  );
};

const ScoreBadge = ({ score }) => {
  const cfg = SCORE_CFG[score];
  if (!cfg) return <span style={{ color: COLORS.textMuted, fontSize: FONTS.size.xs }}>—</span>;
  return (
    <span style={{
      fontSize: FONTS.size.xs, fontWeight: FONTS.weight.semibold,
      color: cfg.color, backgroundColor: cfg.bg,
      borderRadius: RADIUS.full, padding: `2px ${SPACING.sm}`,
      whiteSpace: "nowrap",
    }}>
      {cfg.label}
    </span>
  );
};

const FilterSelect = ({ value, onChange, children, width = "160px" }) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    style={{
      ...STYLES.input, width, padding: `${SPACING.sm} ${SPACING.md}`,
      appearance: "none", cursor: "pointer", flexShrink: 0,
    }}
  >
    {children}
  </select>
);

// ─── Bulk Action Bar ──────────────────────────────────────────────────────────

const BulkBar = ({ count, agents, stages, onAssign, onStage, onDelete, onClear }) => (
  <div style={{
    position: "fixed", bottom: SPACING.xl,
    left: "50%", transform: "translateX(-50%)",
    backgroundColor: COLORS.surfaceActive,
    border: `1px solid ${COLORS.primary}60`,
    borderRadius: RADIUS.lg,
    padding: `${SPACING.sm} ${SPACING.base}`,
    display: "flex", alignItems: "center", gap: SPACING.md,
    boxShadow: SHADOWS.lg, zIndex: 500,
    boxSizing: "border-box",
  }}>
    <span style={{ fontSize: FONTS.size.sm, fontWeight: FONTS.weight.semibold, color: COLORS.primary, whiteSpace: "nowrap" }}>
      {count} selected
    </span>
    <div style={{ width: "1px", height: "20px", backgroundColor: COLORS.border }} />

    <select
      defaultValue=""
      onChange={(e) => { if (e.target.value) { onAssign(e.target.value); e.target.value = ""; } }}
      style={{ ...STYLES.input, width: "160px", padding: `4px ${SPACING.sm}`, fontSize: FONTS.size.sm }}
    >
      <option value="">Assign to agent…</option>
      {agents.map(a => <option key={a.id} value={a.id}>{a.displayName || a.email}</option>)}
    </select>

    <select
      defaultValue=""
      onChange={(e) => { if (e.target.value) { onStage(e.target.value); e.target.value = ""; } }}
      style={{ ...STYLES.input, width: "150px", padding: `4px ${SPACING.sm}`, fontSize: FONTS.size.sm }}
    >
      <option value="">Change stage…</option>
      {stages.map(s => <option key={s} value={s}>{s}</option>)}
    </select>

    <button
      onClick={onDelete}
      style={{
        background: COLORS.dangerMuted, border: `1px solid ${COLORS.danger}40`,
        borderRadius: RADIUS.base, color: COLORS.danger, cursor: "pointer",
        padding: `4px ${SPACING.md}`, fontSize: FONTS.size.sm,
        fontWeight: FONTS.weight.semibold, fontFamily: FONTS.family,
        display: "flex", alignItems: "center", gap: "4px",
      }}
    >
      <RiDeleteBinLine size={13} /> Delete
    </button>

    <button
      onClick={onClear}
      style={{
        background: "none", border: "none", color: COLORS.textSecondary,
        cursor: "pointer", padding: `4px ${SPACING.sm}`,
        fontSize: FONTS.size.sm, fontFamily: FONTS.family,
      }}
    >
      Clear
    </button>
  </div>
);

// ─── AllLeadsView ─────────────────────────────────────────────────────────────

export const AllLeadsView = () => {
  const { companyId } = useAuth();

  const [leads, setLeads]         = useState([]);
  const [agents, setAgents]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [search, setSearch]           = useState("");
  const [filterStage, setFilterStage] = useState("all");
  const [filterAgent, setFilterAgent] = useState("all");
  const [filterScore, setFilterScore] = useState("all");
  const [filterSource, setFilterSource] = useState("all");

  // Sort
  const [sortKey, setSortKey]   = useState("createdAt");
  const [sortDir, setSortDir]   = useState("desc"); // asc | desc

  // Pagination
  const [page, setPage] = useState(1);

  // Selection
  const [selected, setSelected] = useState(new Set());

  // Delete confirm
  const [deleteTargets, setDeleteTargets] = useState(null); // Set of ids
  const [deleting, setDeleting]           = useState(false);

  // ── Loaders ─────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!companyId) return;
    try {
      const [leadsSnap, usersSnap] = await Promise.all([
        getDocs(query(
          collection(db, COLLECTIONS.LEADS),
          where("companyId", "==", companyId),
          orderBy("createdAt", "desc"),
        )),
        getDocs(query(
          collection(db, COLLECTIONS.USERS),
          where("companyId", "==", companyId),
          where("role", "in", ["agent", "manager"]),
        )),
      ]);
      setLeads(leadsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setAgents(usersSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("AllLeadsView: loadData error:", err);
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

  // ── Filter + sort ────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...leads];
    const q = search.toLowerCase();
    if (q) list = list.filter(l =>
      l.name?.toLowerCase().includes(q) ||
      l.phone?.includes(q) ||
      l.email?.toLowerCase().includes(q)
    );
    if (filterStage !== "all")  list = list.filter(l => l.stage === filterStage);
    if (filterAgent !== "all")  list = list.filter(l => l.agentId === filterAgent);
    if (filterScore !== "all")  list = list.filter(l => l.leadScore === filterScore);
    if (filterSource !== "all") list = list.filter(l => l.source === filterSource);

    list.sort((a, b) => {
      let av = a[sortKey], bv = b[sortKey];
      if (av?.toDate) av = av.toDate().getTime();
      if (bv?.toDate) bv = bv.toDate().getTime();
      if (typeof av === "string") av = av.toLowerCase();
      if (typeof bv === "string") bv = bv.toLowerCase();
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [leads, search, filterStage, filterAgent, filterScore, filterSource, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Reset to page 1 on filter change
  useEffect(() => { setPage(1); setSelected(new Set()); },
    [search, filterStage, filterAgent, filterScore, filterSource]);

  // ── Sort handler ─────────────────────────────────────────────────────────
  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  // ── Selection ────────────────────────────────────────────────────────────
  const toggleSelect = (id) => {
    setSelected(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };
  const toggleAll = () => {
    if (selected.size === paginated.length) setSelected(new Set());
    else setSelected(new Set(paginated.map(l => l.id)));
  };

  // ── Bulk actions ─────────────────────────────────────────────────────────
  const bulkAssign = async (agentId) => {
    const agent = agents.find(a => a.id === agentId);
    await Promise.all([...selected].map(id =>
      updateDoc(doc(db, COLLECTIONS.LEADS, id), {
        agentId, agentName: agent?.displayName || "",
        updatedAt: serverTimestamp(),
      })
    ));
    await loadData();
    setSelected(new Set());
  };

  const bulkStage = async (stage) => {
    await Promise.all([...selected].map(id =>
      updateDoc(doc(db, COLLECTIONS.LEADS, id), { stage, updatedAt: serverTimestamp() })
    ));
    await loadData();
    setSelected(new Set());
  };

  const bulkDelete = async () => {
    setDeleting(true);
    try {
      await Promise.all([...deleteTargets].map(id =>
        deleteDoc(doc(db, COLLECTIONS.LEADS, id))
      ));
      await loadData();
      setSelected(new Set());
    } finally {
      setDeleting(false);
      setDeleteTargets(null);
    }
  };

  // ── CSV Export ───────────────────────────────────────────────────────────
  const exportCSV = () => {
    const rows = [
      ["Name","Phone","Email","Stage","Score","Source","Agent","Deal Value","Created"],
      ...filtered.map(l => [
        l.name || "", l.phone || "", l.email || "",
        l.stage || "", l.leadScore || "", l.source || "",
        l.agentName || "", l.dealValue || "",
        l.createdAt?.toDate?.().toLocaleDateString("en-IN") || "",
      ]),
    ];
    const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = "tiras-leads.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  // ── Column header component ──────────────────────────────────────────────
  const ColHeader = ({ label, sortable, colKey, style = {} }) => (
    <div
      onClick={sortable ? () => handleSort(colKey) : undefined}
      style={{
        fontSize: FONTS.size.xs, fontWeight: FONTS.weight.semibold,
        color: sortKey === colKey ? COLORS.primary : COLORS.textMuted,
        textTransform: "uppercase", letterSpacing: "0.06em",
        cursor: sortable ? "pointer" : "default",
        display: "flex", alignItems: "center", gap: "3px",
        userSelect: "none", ...style,
      }}
    >
      {label}
      {sortable && sortKey === colKey && (
        sortDir === "asc" ? <RiArrowUpLine size={11} /> : <RiArrowDownLine size={11} />
      )}
    </div>
  );

  const allPageSelected = paginated.length > 0 && paginated.every(l => selected.has(l.id));

  // ── Summary stats ────────────────────────────────────────────────────────
  const hotCount     = leads.filter(l => l.leadScore === "hot").length;
  const closedWon    = leads.filter(l => l.stage === "Closed Won").length;
  const pipelineVal  = leads.reduce((s, l) => s + (l.dealValue || 0), 0);

  // grid col template
  const COLS = "36px 1fr 130px 110px 130px 130px 110px 90px";

  return (
    <div style={{
      backgroundColor: COLORS.background, minHeight: "calc(100vh - 60px)",
      padding: `${SPACING["2xl"]} ${SPACING["2xl"]}`,
      fontFamily: FONTS.family, boxSizing: "border-box",
    }}>
      <style>{`
        @keyframes tirasSpinKf { from{transform:rotate(0)} to{transform:rotate(360deg)} }
        .tl-row:hover { background-color: ${COLORS.surfaceHover} !important; }
        select option { background: ${COLORS.surface}; color: ${COLORS.textPrimary}; }
      `}</style>

      {/* Header */}
      <div style={{
        display: "flex", justifyContent: "space-between",
        alignItems: "flex-start", flexWrap: "wrap",
        gap: SPACING.base, marginBottom: SPACING.xl,
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: FONTS.size["4xl"], fontWeight: FONTS.weight.bold, color: COLORS.textPrimary, letterSpacing: "-0.5px" }}>
            All Leads
          </h1>
          <p style={{ margin: `${SPACING.xs} 0 0`, fontSize: FONTS.size.base, color: COLORS.textSecondary }}>
            Every lead across your company — filterable, sortable, bulk-actionable.
          </p>
        </div>
        <div style={{ display: "flex", gap: SPACING.sm }}>
          <button onClick={handleRefresh} disabled={refreshing} style={{ ...STYLES.buttonSecondary, padding: `${SPACING.sm} ${SPACING.md}`, display: "flex", alignItems: "center", gap: SPACING.xs, opacity: refreshing ? 0.4 : 1 }}>
            <RiRefreshLine size={15} style={{ animation: refreshing ? "tirasSpinKf 0.7s linear infinite" : "none" }} />
          </button>
          <button onClick={exportCSV} style={{ ...STYLES.buttonSecondary, display: "flex", alignItems: "center", gap: SPACING.xs }}>
            <RiDownloadLine size={15} /> Export CSV
          </button>
          <button style={{ ...STYLES.buttonPrimary, display: "flex", alignItems: "center", gap: SPACING.xs }}>
            <RiAddLine size={16} /> Add Lead
          </button>
        </div>
      </div>

      {/* Summary pills */}
      <div style={{ display: "flex", gap: SPACING.md, marginBottom: SPACING.lg, flexWrap: "wrap" }}>
        {[
          { label: "Total Leads", value: leads.length, color: COLORS.info },
          { label: "Hot Leads",   value: hotCount,     color: COLORS.hot },
          { label: "Closed Won",  value: closedWon,    color: COLORS.success },
          { label: "Pipeline Value", value: formatINR(pipelineVal), color: COLORS.accent },
        ].map(s => (
          <div key={s.label} style={{
            backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}`,
            borderRadius: RADIUS.lg, padding: `${SPACING.sm} ${SPACING.base}`,
            display: "flex", alignItems: "center", gap: SPACING.sm,
          }}>
            <span style={{ fontSize: FONTS.size.sm, color: COLORS.textSecondary }}>{s.label}:</span>
            <span style={{ fontSize: FONTS.size.base, fontWeight: FONTS.weight.bold, color: s.color }}>{loading ? "—" : s.value}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: SPACING.sm, marginBottom: SPACING.base, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: "1 1 200px", minWidth: "180px" }}>
          <RiSearchLine size={15} color={COLORS.textMuted} style={{ position: "absolute", left: SPACING.md, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
          <input
            type="text" placeholder="Name, phone or email…" value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ ...STYLES.input, paddingLeft: "34px" }}
          />
        </div>
        <FilterSelect value={filterStage} onChange={setFilterStage}>
          <option value="all">All Stages</option>
          {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
        </FilterSelect>
        <FilterSelect value={filterScore} onChange={setFilterScore} width="140px">
          <option value="all">All Scores</option>
          <option value="hot">🔥 Hot</option>
          <option value="warm">♨ Warm</option>
          <option value="cold">❄ Cold</option>
          <option value="dead">☠ Dead</option>
        </FilterSelect>
        <FilterSelect value={filterAgent} onChange={setFilterAgent}>
          <option value="all">All Agents</option>
          {agents.map(a => <option key={a.id} value={a.id}>{a.displayName || a.email}</option>)}
        </FilterSelect>
        <FilterSelect value={filterSource} onChange={setFilterSource} width="150px">
          <option value="all">All Sources</option>
          {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
        </FilterSelect>
        <span style={{ fontSize: FONTS.size.sm, color: COLORS.textMuted, marginLeft: "auto" }}>
          {loading ? "…" : `${filtered.length} leads`}
        </span>
      </div>

      {/* Table */}
      <div style={{ backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.lg, overflow: "hidden" }}>
        {/* Header row */}
        <div style={{ display: "grid", gridTemplateColumns: COLS, padding: `${SPACING.sm} ${SPACING.lg}`, backgroundColor: COLORS.surfaceActive, borderBottom: `1px solid ${COLORS.border}`, gap: SPACING.base, alignItems: "center" }}>
          <div
            onClick={toggleAll}
            style={{ cursor: "pointer", color: allPageSelected ? COLORS.primary : COLORS.textMuted, display: "flex", alignItems: "center" }}
          >
            {allPageSelected ? <RiCheckboxLine size={16} /> : <RiCheckboxBlankLine size={16} />}
          </div>
          <ColHeader label="Lead" sortable colKey="name" />
          <ColHeader label="Stage" sortable colKey="stage" />
          <ColHeader label="Score" />
          <ColHeader label="Agent" sortable colKey="agentName" />
          <ColHeader label="Source" />
          <ColHeader label="Deal Value" sortable colKey="dealValue" />
          <ColHeader label="Last Activity" sortable colKey="updatedAt" />
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ padding: SPACING["5xl"], textAlign: "center" }}>
            <RiLoader4Line size={26} color={COLORS.textMuted} style={{ animation: "tirasSpinKf 1s linear infinite" }} />
            <div style={{ color: COLORS.textMuted, fontSize: FONTS.size.sm, marginTop: SPACING.sm }}>Loading leads…</div>
          </div>
        )}

        {/* Empty */}
        {!loading && filtered.length === 0 && (
          <div style={{ padding: SPACING["5xl"], textAlign: "center" }}>
            <RiFundsLine size={36} color={COLORS.textMuted} style={{ marginBottom: SPACING.md }} />
            <div style={{ color: COLORS.textPrimary, fontWeight: FONTS.weight.semibold, marginBottom: SPACING.xs }}>
              {search || filterStage !== "all" ? "No leads match your filters" : "No leads yet"}
            </div>
            <div style={{ color: COLORS.textSecondary, fontSize: FONTS.size.sm }}>
              {search || filterStage !== "all" ? "Try clearing some filters." : "Add your first lead or import a CSV."}
            </div>
          </div>
        )}

        {/* Rows */}
        {!loading && paginated.map((lead, idx) => (
          <div
            key={lead.id}
            className="tl-row"
            style={{
              display: "grid", gridTemplateColumns: COLS,
              padding: `${SPACING.md} ${SPACING.lg}`,
              borderBottom: idx < paginated.length - 1 ? `1px solid ${COLORS.border}` : "none",
              gap: SPACING.base, alignItems: "center",
              backgroundColor: selected.has(lead.id) ? COLORS.primaryMuted : COLORS.surface,
              transition: TRANSITIONS.fast,
            }}
          >
            {/* Checkbox */}
            <div
              onClick={() => toggleSelect(lead.id)}
              style={{ cursor: "pointer", color: selected.has(lead.id) ? COLORS.primary : COLORS.textMuted, display: "flex", alignItems: "center" }}
            >
              {selected.has(lead.id) ? <RiCheckboxLine size={16} /> : <RiCheckboxBlankLine size={16} />}
            </div>

            {/* Lead name + phone */}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: FONTS.size.base, fontWeight: FONTS.weight.semibold, color: COLORS.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {lead.name || "—"}
              </div>
              <div style={{ fontSize: FONTS.size.xs, color: COLORS.textSecondary, display: "flex", alignItems: "center", gap: "3px", marginTop: "2px" }}>
                <RiPhoneLine size={10} /> {lead.phone || "—"}
              </div>
            </div>

            {/* Stage */}
            <div><StageBadge stage={lead.stage} /></div>

            {/* Score */}
            <div><ScoreBadge score={lead.leadScore} /></div>

            {/* Agent */}
            <div style={{ fontSize: FONTS.size.sm, color: COLORS.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {lead.agentName || <span style={{ color: COLORS.textMuted }}>Unassigned</span>}
            </div>

            {/* Source */}
            <div style={{ fontSize: FONTS.size.sm, color: COLORS.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {lead.source || "—"}
            </div>

            {/* Deal Value */}
            <div style={{ fontSize: FONTS.size.sm, color: lead.dealValue ? COLORS.accent : COLORS.textMuted, fontWeight: lead.dealValue ? FONTS.weight.semibold : FONTS.weight.regular }}>
              {formatINR(lead.dealValue)}
            </div>

            {/* Last Activity */}
            <div style={{ fontSize: FONTS.size.sm, color: COLORS.textSecondary }}>
              {relativeTime(lead.updatedAt || lead.createdAt)}
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {!loading && filtered.length > PAGE_SIZE && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: SPACING.md, marginTop: SPACING.base }}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            style={{ ...STYLES.buttonSecondary, padding: `${SPACING.sm} ${SPACING.md}`, opacity: page === 1 ? 0.4 : 1, display: "flex", alignItems: "center" }}
          >
            <RiArrowLeftLine size={15} />
          </button>
          <span style={{ fontSize: FONTS.size.sm, color: COLORS.textSecondary }}>
            Page <strong style={{ color: COLORS.textPrimary }}>{page}</strong> of {totalPages}
            &nbsp;·&nbsp;{filtered.length} leads
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            style={{ ...STYLES.buttonSecondary, padding: `${SPACING.sm} ${SPACING.md}`, opacity: page === totalPages ? 0.4 : 1, display: "flex", alignItems: "center" }}
          >
            <RiArrowRightLine size={15} />
          </button>
        </div>
      )}

      {/* Bulk Action Bar */}
      {selected.size > 0 && (
        <BulkBar
          count={selected.size}
          agents={agents}
          stages={STAGES}
          onAssign={bulkAssign}
          onStage={bulkStage}
          onDelete={() => setDeleteTargets(new Set(selected))}
          onClear={() => setSelected(new Set())}
        />
      )}

      {/* Delete Confirm Dialog */}
      {deleteTargets && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ ...STYLES.card, maxWidth: "360px", width: "100%", border: `1px solid ${COLORS.danger}40` }}>
            <div style={{ fontSize: FONTS.size.xl, fontWeight: FONTS.weight.bold, color: COLORS.textPrimary, marginBottom: SPACING.sm }}>
              Delete {deleteTargets.size} lead{deleteTargets.size > 1 ? "s" : ""}?
            </div>
            <div style={{ fontSize: FONTS.size.sm, color: COLORS.textSecondary, marginBottom: SPACING.xl, lineHeight: 1.6 }}>
              This cannot be undone. All call logs, notes, and AI summaries for these leads will be permanently removed.
            </div>
            <div style={{ display: "flex", gap: SPACING.md }}>
              <button onClick={() => setDeleteTargets(null)} style={{ ...STYLES.buttonSecondary, flex: 1 }}>Cancel</button>
              <button
                onClick={bulkDelete}
                disabled={deleting}
                style={{ flex: 1, backgroundColor: COLORS.danger, color: "#fff", border: "none", borderRadius: RADIUS.base, fontFamily: FONTS.family, fontSize: FONTS.size.base, fontWeight: FONTS.weight.semibold, padding: `${SPACING.sm} 0`, cursor: deleting ? "not-allowed" : "pointer", opacity: deleting ? 0.6 : 1 }}
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
