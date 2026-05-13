// TIRAS CRM — My Team Leads
// Manager sees all leads assigned to his agents — filterable by agent, stage, temperature, search
// Queries: leads where managerId == currentUser.uid + companyId

import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  collection,
  query,
  where,
  getDocs,
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
  STYLES,
  TRANSITIONS,
} from "../theme";

// ─── Constants ────────────────────────────────────────────────────────────────

const STAGES = [
  "All Stages",
  "New",
  "Contacted",
  "Interested",
  "Follow-up",
  "Negotiation",
  "Closed Won",
  "Closed Lost",
];

const TEMPERATURES = ["All", "Hot", "Warm", "Cold", "Dead"];

const STAGE_META = {
  New:         { color: COLORS.info,          bg: COLORS.infoMuted },
  Contacted:   { color: "#7B68EE",            bg: "#7B68EE26" },
  Interested:  { color: COLORS.accent,        bg: COLORS.accentMuted },
  "Follow-up": { color: COLORS.warning,       bg: COLORS.warningMuted },
  Negotiation: { color: COLORS.primary,       bg: COLORS.primaryMuted },
  "Closed Won":  { color: COLORS.success,     bg: COLORS.successMuted },
  "Closed Lost": { color: COLORS.danger,      bg: COLORS.dangerMuted },
};

const TEMP_META = {
  Hot:  { color: COLORS.hot,  icon: "🔥", bg: "#E0525226" },
  Warm: { color: COLORS.warm, icon: "☀️", bg: "#F2A65A26" },
  Cold: { color: COLORS.cold, icon: "❄️", bg: "#5A9BF226" },
  Dead: { color: COLORS.dead, icon: "💀", bg: "#66666626" },
};

const SOURCE_LABELS = {
  indiamart:   "IndiaMART",
  website:     "Website",
  cold_call:   "Cold Call",
  referral:    "Referral",
  walk_in:     "Walk-in",
  social:      "Social Media",
  whatsapp:    "WhatsApp",
  trade_show:  "Trade Show",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatDate = (ts) => {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const now = new Date();
  const diff = Math.floor((now - d) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return `${diff}d ago`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

const formatPhone = (phone) => {
  if (!phone) return "—";
  const p = String(phone).replace(/\D/g, "");
  if (p.length === 10) return `+91 ${p.slice(0, 5)} ${p.slice(5)}`;
  return phone;
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const Shimmer = ({ width = "100%", height = "16px", radius = RADIUS.base }) => (
  <div
    style={{
      width, height, borderRadius: radius,
      background: `linear-gradient(90deg, ${COLORS.surface} 25%, #2a2a2a 50%, ${COLORS.surface} 75%)`,
      backgroundSize: "200% 100%",
      animation: "shimmer 1.4s infinite",
    }}
  />
);

const StageBadge = ({ stage }) => {
  const meta = STAGE_META[stage] || { color: COLORS.textMuted, bg: COLORS.surfaceActive };
  return (
    <span
      style={{
        ...STYLES.badge,
        backgroundColor: meta.bg,
        color: meta.color,
        border: `1px solid ${meta.color}33`,
        fontSize: FONTS.size.xs,
        padding: `2px ${SPACING.sm}`,
      }}
    >
      {stage || "New"}
    </span>
  );
};

const TempBadge = ({ temp }) => {
  const meta = TEMP_META[temp];
  if (!meta) return <span style={{ color: COLORS.textMuted, fontSize: FONTS.size.xs }}>—</span>;
  return (
    <span
      style={{
        ...STYLES.badge,
        backgroundColor: meta.bg,
        color: meta.color,
        fontSize: FONTS.size.xs,
        padding: `2px ${SPACING.sm}`,
      }}
    >
      {meta.icon} {temp}
    </span>
  );
};

const FilterChip = ({ label, active, onClick }) => (
  <button
    onClick={onClick}
    style={{
      padding: `${SPACING.xs} ${SPACING.md}`,
      borderRadius: RADIUS.full,
      fontSize: FONTS.size.xs,
      fontWeight: FONTS.weight.semibold,
      cursor: "pointer",
      transition: TRANSITIONS.fast,
      border: `1px solid ${active ? COLORS.primary : COLORS.border}`,
      backgroundColor: active ? COLORS.primaryMuted : "transparent",
      color: active ? COLORS.primary : COLORS.textSecondary,
      fontFamily: FONTS.family,
      whiteSpace: "nowrap",
    }}
  >
    {label}
  </button>
);

// ─── Main Component ───────────────────────────────────────────────────────────

export const MyTeamLeads = () => {
  const { currentUser, companyId } = useAuth();

  const [leads, setLeads]   = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  // Filters
  const [search, setSearch]           = useState("");
  const [agentFilter, setAgentFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("All Stages");
  const [tempFilter, setTempFilter]   = useState("All");
  const [sortBy, setSortBy]           = useState("createdAt"); // createdAt | name | stage | callCount
  const [sortDir, setSortDir]         = useState("desc");

  // Pagination
  const [page, setPage]         = useState(1);
  const PAGE_SIZE               = 20;

  // ─── Fetch ─────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    if (!currentUser?.uid || !companyId) return;
    try {
      setLoading(true);
      const uid = currentUser.uid;

      // Agents under this manager
      const agentsSnap = await getDocs(
        query(
          collection(db, COLLECTIONS.USERS),
          where("managerId", "==", uid),
          where("companyId", "==", companyId)
        )
      );
      const fetchedAgents = agentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setAgents(fetchedAgents);

      // All leads under this manager
      const leadsSnap = await getDocs(
        query(
          collection(db, COLLECTIONS.LEADS),
          where("managerId", "==", uid),
          where("companyId", "==", companyId),
          orderBy("createdAt", "desc")
        )
      );
      const fetchedLeads = leadsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setLeads(fetchedLeads);
    } catch (err) {
      console.error("MyTeamLeads fetch error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.uid, companyId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Reset to page 1 on any filter change
  useEffect(() => { setPage(1); }, [search, agentFilter, stageFilter, tempFilter, sortBy, sortDir]);

  // ─── Derived / filtered leads ──────────────────────────────────────────

  const agentMap = useMemo(() => {
    const m = {};
    agents.forEach((a) => { m[a.id] = a.displayName || a.email || "Agent"; });
    return m;
  }, [agents]);

  const filtered = useMemo(() => {
    let result = [...leads];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (l) =>
          (l.name || "").toLowerCase().includes(q) ||
          (l.phone || "").includes(q) ||
          (l.email || "").toLowerCase().includes(q) ||
          (l.company || "").toLowerCase().includes(q)
      );
    }

    if (agentFilter !== "all") {
      result = result.filter((l) => l.agentId === agentFilter);
    }

    if (stageFilter !== "All Stages") {
      result = result.filter((l) => (l.stage || "New") === stageFilter);
    }

    if (tempFilter !== "All") {
      result = result.filter((l) => (l.temperature || "") === tempFilter);
    }

    // Sort
    result.sort((a, b) => {
      let aVal, bVal;
      if (sortBy === "name") {
        aVal = (a.name || "").toLowerCase();
        bVal = (b.name || "").toLowerCase();
        return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      if (sortBy === "stage") {
        aVal = STAGES.indexOf(a.stage || "New");
        bVal = STAGES.indexOf(b.stage || "New");
      } else if (sortBy === "callCount") {
        aVal = a.callCount || 0;
        bVal = b.callCount || 0;
      } else {
        // createdAt default
        aVal = a.createdAt?.seconds || 0;
        bVal = b.createdAt?.seconds || 0;
      }
      return sortDir === "asc" ? aVal - bVal : bVal - aVal;
    });

    return result;
  }, [leads, search, agentFilter, stageFilter, tempFilter, sortBy, sortDir]);

  const totalPages   = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated    = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ─── Sorting toggle ────────────────────────────────────────────────────

  const handleSort = (col) => {
    if (sortBy === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortDir("desc");
    }
  };

  const SortArrow = ({ col }) => {
    if (sortBy !== col) return <span style={{ color: COLORS.textMuted, fontSize: "10px", marginLeft: "4px" }}>↕</span>;
    return (
      <span style={{ color: COLORS.primary, fontSize: "10px", marginLeft: "4px" }}>
        {sortDir === "asc" ? "↑" : "↓"}
      </span>
    );
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: ${COLORS.scrollbarTrack}; }
        ::-webkit-scrollbar-thumb { background: ${COLORS.scrollbarThumb}; border-radius: 3px; }
        .lead-row:hover { background-color: ${COLORS.surfaceHover} !important; }
        .th-sort:hover { color: ${COLORS.textPrimary} !important; cursor: pointer; }
      `}</style>

      <div
        style={{
          minHeight: "100vh",
          backgroundColor: COLORS.background,
          padding: `${SPACING.xl} ${SPACING["2xl"]}`,
          fontFamily: FONTS.family,
          color: COLORS.textPrimary,
        }}
      >
        {/* ── Page Header ── */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: SPACING["2xl"],
          }}
        >
          <div>
            <div
              style={{
                fontSize: FONTS.size.xs,
                fontWeight: FONTS.weight.semibold,
                color: COLORS.textMuted,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                marginBottom: SPACING.xs,
              }}
            >
              Manager View
            </div>
            <h1
              style={{
                fontSize: FONTS.size["4xl"],
                fontWeight: FONTS.weight.bold,
                color: COLORS.textPrimary,
                margin: 0,
                lineHeight: 1.1,
              }}
            >
              My Team Leads
            </h1>
            <div style={{ fontSize: FONTS.size.sm, color: COLORS.textSecondary, marginTop: SPACING.xs }}>
              {loading ? "Loading…" : `${filtered.length} lead${filtered.length !== 1 ? "s" : ""} across ${agents.length} agent${agents.length !== 1 ? "s" : ""}`}
            </div>
          </div>

          <button onClick={fetchData} style={{ ...STYLES.buttonSecondary, fontSize: FONTS.size.sm, padding: `${SPACING.sm} ${SPACING.base}` }}>
            ↻ Refresh
          </button>
        </div>

        {/* ── Error ── */}
        {error && (
          <div style={{ backgroundColor: COLORS.dangerMuted, border: `1px solid ${COLORS.danger}`, borderRadius: RADIUS.md, padding: SPACING.base, color: COLORS.danger, fontSize: FONTS.size.sm, marginBottom: SPACING.xl }}>
            ⚠ {error}
          </div>
        )}

        {/* ── Search + Filters ── */}
        <div style={{ ...STYLES.card, marginBottom: SPACING.base, padding: `${SPACING.base} ${SPACING.xl}` }}>
          {/* Search bar */}
          <div style={{ position: "relative", marginBottom: SPACING.base }}>
            <span
              style={{
                position: "absolute",
                left: SPACING.md,
                top: "50%",
                transform: "translateY(-50%)",
                color: COLORS.textMuted,
                fontSize: FONTS.size.base,
                pointerEvents: "none",
              }}
            >
              🔍
            </span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, phone, email, or company…"
              style={{
                ...STYLES.input,
                paddingLeft: "38px",
                backgroundColor: COLORS.surfaceHover,
                border: `1px solid ${COLORS.border}`,
              }}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                style={{
                  position: "absolute",
                  right: SPACING.md,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  color: COLORS.textMuted,
                  cursor: "pointer",
                  fontSize: FONTS.size.lg,
                  lineHeight: 1,
                  padding: 0,
                }}
              >
                ×
              </button>
            )}
          </div>

          {/* Filter chips row */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: SPACING.sm, alignItems: "center" }}>
            {/* Agent filter */}
            <div style={{ display: "flex", gap: SPACING.xs, flexWrap: "wrap" }}>
              <FilterChip
                label="All Agents"
                active={agentFilter === "all"}
                onClick={() => setAgentFilter("all")}
              />
              {agents.map((a) => (
                <FilterChip
                  key={a.id}
                  label={a.displayName || a.email || "Agent"}
                  active={agentFilter === a.id}
                  onClick={() => setAgentFilter(a.id)}
                />
              ))}
            </div>

            {/* Separator */}
            <div style={{ width: "1px", height: "20px", backgroundColor: COLORS.border, margin: `0 ${SPACING.xs}` }} />

            {/* Stage filter */}
            <div style={{ display: "flex", gap: SPACING.xs, flexWrap: "wrap" }}>
              {STAGES.map((s) => (
                <FilterChip
                  key={s}
                  label={s}
                  active={stageFilter === s}
                  onClick={() => setStageFilter(s)}
                />
              ))}
            </div>

            {/* Separator */}
            <div style={{ width: "1px", height: "20px", backgroundColor: COLORS.border, margin: `0 ${SPACING.xs}` }} />

            {/* Temperature filter */}
            <div style={{ display: "flex", gap: SPACING.xs, flexWrap: "wrap" }}>
              {TEMPERATURES.map((t) => (
                <FilterChip
                  key={t}
                  label={t === "All" ? "All Temps" : `${TEMP_META[t]?.icon || ""} ${t}`}
                  active={tempFilter === t}
                  onClick={() => setTempFilter(t)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* ── Table ── */}
        <div style={{ ...STYLES.card, padding: 0, overflow: "hidden" }}>
          {/* Table header */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1.2fr 1.2fr 1fr 1fr 100px 90px",
              gap: 0,
              backgroundColor: COLORS.surfaceActive,
              borderBottom: `1px solid ${COLORS.border}`,
            }}
          >
            {[
              { label: "Lead",      col: "name",      style: { paddingLeft: SPACING.xl } },
              { label: "Phone",     col: null },
              { label: "Agent",     col: null },
              { label: "Stage",     col: "stage" },
              { label: "Temp",      col: null },
              { label: "Calls",     col: "callCount" },
              { label: "Added",     col: "createdAt" },
            ].map(({ label, col, style }) => (
              <div
                key={label}
                className={col ? "th-sort" : ""}
                onClick={col ? () => handleSort(col) : undefined}
                style={{
                  ...STYLES.tableHeader,
                  ...style,
                  padding: `${SPACING.md} ${SPACING.base}`,
                  userSelect: "none",
                }}
              >
                {label}
                {col && <SortArrow col={col} />}
              </div>
            ))}
          </div>

          {/* Loading rows */}
          {loading && (
            <div>
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "2fr 1.2fr 1.2fr 1fr 1fr 100px 90px",
                    borderBottom: `1px solid ${COLORS.border}`,
                    padding: `${SPACING.base} ${SPACING.base}`,
                    gap: SPACING.base,
                    alignItems: "center",
                  }}
                >
                  <div style={{ paddingLeft: SPACING.sm }}>
                    <Shimmer height="13px" width="70%" />
                    <div style={{ marginTop: "4px" }}><Shimmer height="11px" width="45%" /></div>
                  </div>
                  <Shimmer height="13px" width="80%" />
                  <Shimmer height="13px" width="60%" />
                  <Shimmer height="20px" width="80px" radius={RADIUS.full} />
                  <Shimmer height="20px" width="60px" radius={RADIUS.full} />
                  <Shimmer height="13px" width="30px" />
                  <Shimmer height="11px" width="50px" />
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {!loading && filtered.length === 0 && (
            <div
              style={{
                textAlign: "center",
                padding: `${SPACING["5xl"]} ${SPACING["2xl"]}`,
                color: COLORS.textMuted,
              }}
            >
              <div style={{ fontSize: "40px", marginBottom: SPACING.base }}>📋</div>
              <div style={{ fontSize: FONTS.size.lg, color: COLORS.textSecondary, fontWeight: FONTS.weight.medium }}>
                {search || agentFilter !== "all" || stageFilter !== "All Stages" || tempFilter !== "All"
                  ? "No leads match your filters"
                  : "No leads assigned to your team yet"}
              </div>
              {(search || agentFilter !== "all" || stageFilter !== "All Stages" || tempFilter !== "All") && (
                <button
                  onClick={() => { setSearch(""); setAgentFilter("all"); setStageFilter("All Stages"); setTempFilter("All"); }}
                  style={{ ...STYLES.buttonSecondary, marginTop: SPACING.base, fontSize: FONTS.size.sm }}
                >
                  Clear all filters
                </button>
              )}
            </div>
          )}

          {/* Lead rows */}
          {!loading &&
            paginated.map((lead, idx) => (
              <div
                key={lead.id}
                className="lead-row"
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1.2fr 1.2fr 1fr 1fr 100px 90px",
                  borderBottom: `1px solid ${COLORS.border}`,
                  backgroundColor: idx % 2 === 0 ? "transparent" : COLORS.surface + "66",
                  transition: TRANSITIONS.fast,
                  cursor: "default",
                  alignItems: "center",
                }}
              >
                {/* Lead name + source */}
                <div style={{ padding: `${SPACING.md} ${SPACING.base}`, paddingLeft: SPACING.xl }}>
                  <div
                    style={{
                      fontSize: FONTS.size.base,
                      fontWeight: FONTS.weight.medium,
                      color: COLORS.textPrimary,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {lead.name || "Unnamed Lead"}
                  </div>
                  <div style={{ fontSize: FONTS.size.xs, color: COLORS.textMuted, marginTop: "2px" }}>
                    {SOURCE_LABELS[lead.source] || lead.source || "—"}
                    {lead.company ? ` · ${lead.company}` : ""}
                  </div>
                </div>

                {/* Phone */}
                <div style={{ padding: `${SPACING.md} ${SPACING.base}` }}>
                  <span
                    style={{
                      fontSize: FONTS.size.sm,
                      color: COLORS.textSecondary,
                      fontFamily: FONTS.mono,
                      letterSpacing: "0.02em",
                    }}
                  >
                    {formatPhone(lead.phone)}
                  </span>
                </div>

                {/* Agent */}
                <div style={{ padding: `${SPACING.md} ${SPACING.base}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: SPACING.xs }}>
                    {/* Agent avatar circle */}
                    <div
                      style={{
                        width: "22px",
                        height: "22px",
                        borderRadius: "50%",
                        backgroundColor: COLORS.primaryMuted,
                        border: `1px solid ${COLORS.primary}44`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "10px",
                        fontWeight: FONTS.weight.bold,
                        color: COLORS.primary,
                        flexShrink: 0,
                      }}
                    >
                      {(agentMap[lead.agentId] || "?")[0].toUpperCase()}
                    </div>
                    <span
                      style={{
                        fontSize: FONTS.size.sm,
                        color: COLORS.textSecondary,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {agentMap[lead.agentId] || "Unassigned"}
                    </span>
                  </div>
                </div>

                {/* Stage */}
                <div style={{ padding: `${SPACING.md} ${SPACING.base}` }}>
                  <StageBadge stage={lead.stage || "New"} />
                </div>

                {/* Temperature */}
                <div style={{ padding: `${SPACING.md} ${SPACING.base}` }}>
                  <TempBadge temp={lead.temperature} />
                </div>

                {/* Call count */}
                <div style={{ padding: `${SPACING.md} ${SPACING.base}`, textAlign: "center" }}>
                  <span
                    style={{
                      fontSize: FONTS.size.sm,
                      fontWeight: FONTS.weight.semibold,
                      color: (lead.callCount || 0) > 0 ? COLORS.textPrimary : COLORS.textMuted,
                    }}
                  >
                    {lead.callCount || 0}
                  </span>
                </div>

                {/* Added date */}
                <div style={{ padding: `${SPACING.md} ${SPACING.base}` }}>
                  <span style={{ fontSize: FONTS.size.xs, color: COLORS.textMuted }}>
                    {formatDate(lead.createdAt)}
                  </span>
                </div>
              </div>
            ))}
        </div>

        {/* ── Pagination ── */}
        {!loading && filtered.length > PAGE_SIZE && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: SPACING.base,
              padding: `${SPACING.sm} ${SPACING.base}`,
            }}
          >
            <div style={{ fontSize: FONTS.size.sm, color: COLORS.textMuted }}>
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
            </div>

            <div style={{ display: "flex", gap: SPACING.xs }}>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{
                  ...STYLES.buttonSecondary,
                  padding: `${SPACING.xs} ${SPACING.md}`,
                  fontSize: FONTS.size.sm,
                  opacity: page === 1 ? 0.4 : 1,
                  cursor: page === 1 ? "not-allowed" : "pointer",
                }}
              >
                ← Prev
              </button>

              {/* Page numbers (max 5 shown) */}
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                .reduce((acc, p, idx, arr) => {
                  if (idx > 0 && arr[idx - 1] !== p - 1) acc.push("…");
                  acc.push(p);
                  return acc;
                }, [])
                .map((item, i) =>
                  item === "…" ? (
                    <span key={`ellipsis-${i}`} style={{ padding: `${SPACING.xs} ${SPACING.sm}`, color: COLORS.textMuted, fontSize: FONTS.size.sm }}>…</span>
                  ) : (
                    <button
                      key={item}
                      onClick={() => setPage(item)}
                      style={{
                        ...STYLES.buttonSecondary,
                        padding: `${SPACING.xs} ${SPACING.md}`,
                        fontSize: FONTS.size.sm,
                        backgroundColor: page === item ? COLORS.primaryMuted : "transparent",
                        color: page === item ? COLORS.primary : COLORS.textSecondary,
                        borderColor: page === item ? COLORS.primary : COLORS.border,
                        minWidth: "36px",
                      }}
                    >
                      {item}
                    </button>
                  )
                )}

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                style={{
                  ...STYLES.buttonSecondary,
                  padding: `${SPACING.xs} ${SPACING.md}`,
                  fontSize: FONTS.size.sm,
                  opacity: page === totalPages ? 0.4 : 1,
                  cursor: page === totalPages ? "not-allowed" : "pointer",
                }}
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default MyTeamLeads;
