// TIRAS CRM — PipelineKanban.jsx
// Company Admin — drag-and-drop pipeline board; dropping a card updates the lead's stage in Firestore instantly
//
// USAGE: In src/pages/index.js replace:
//   export const PipelineKanban = () => <Placeholder name="Pipeline Kanban Board" />;
// with:
//   export { PipelineKanban } from "./PipelineKanban";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  collection, query, where, getDocs, doc,
  updateDoc, serverTimestamp, orderBy,
} from "firebase/firestore";
import { db, COLLECTIONS } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import {
  COLORS, FONTS, SPACING, RADIUS, SHADOWS, STYLES, TRANSITIONS,
} from "../theme";
import {
  RiLoader4Line, RiRefreshLine, RiAddLine,
  RiPhoneLine, RiMoneyDollarCircleLine, RiDragMove2Line,
  RiUserLine, RiTimeLine,
} from "react-icons/ri";

// ─── Stage config ─────────────────────────────────────────────────────────────

const DEFAULT_STAGES = [
  "New", "Contacted", "Interested",
  "Follow-up", "Negotiation", "Closed Won", "Closed Lost",
];

const STAGE_COLOR = {
  "New":         { primary: COLORS.info,    bg: COLORS.infoMuted },
  "Contacted":   { primary: COLORS.primary, bg: COLORS.primaryMuted },
  "Interested":  { primary: COLORS.accent,  bg: COLORS.accentMuted },
  "Follow-up":   { primary: COLORS.warning, bg: COLORS.warningMuted },
  "Negotiation": { primary: "#9B59B6",      bg: "#9B59B622" },
  "Closed Won":  { primary: COLORS.success, bg: COLORS.successMuted },
  "Closed Lost": { primary: COLORS.danger,  bg: COLORS.dangerMuted },
};

const SCORE_DOT = {
  hot:  COLORS.hot,
  warm: COLORS.warm,
  cold: COLORS.cold,
  dead: COLORS.dead,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatINR = (n) => {
  if (!n) return null;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000)   return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n.toLocaleString("en-IN")}`;
};

const relativeTime = (ts) => {
  if (!ts) return null;
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

// ─── LeadCard ─────────────────────────────────────────────────────────────────

const LeadCard = ({ lead, onDragStart, onDragEnd, isDragging }) => {
  const scoreColor = SCORE_DOT[lead.leadScore];

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, lead)}
      onDragEnd={onDragEnd}
      style={{
        backgroundColor: COLORS.surfaceHover,
        border: `1px solid ${COLORS.border}`,
        borderRadius: RADIUS.md,
        padding: SPACING.md,
        cursor: "grab",
        userSelect: "none",
        opacity: isDragging ? 0.4 : 1,
        transition: "opacity 0.15s ease, box-shadow 0.15s ease",
        boxShadow: SHADOWS.sm,
        position: "relative",
      }}
    >
      {/* Score dot indicator */}
      {scoreColor && (
        <div style={{
          position: "absolute", top: SPACING.md, right: SPACING.md,
          width: "8px", height: "8px", borderRadius: "50%",
          backgroundColor: scoreColor,
          boxShadow: `0 0 5px ${scoreColor}`,
        }} />
      )}

      {/* Drag handle */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: SPACING.xs, marginBottom: SPACING.sm }}>
        <RiDragMove2Line size={13} color={COLORS.textMuted} style={{ marginTop: "2px", flexShrink: 0 }} />
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: FONTS.size.sm, fontWeight: FONTS.weight.semibold,
            color: COLORS.textPrimary, overflow: "hidden",
            textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.3,
            paddingRight: SPACING.base,
          }}>
            {lead.name || "Unnamed Lead"}
          </div>
          {lead.phone && (
            <div style={{ display: "flex", alignItems: "center", gap: "3px", marginTop: "3px", fontSize: FONTS.size.xs, color: COLORS.textSecondary }}>
              <RiPhoneLine size={10} /> {lead.phone}
            </div>
          )}
        </div>
      </div>

      {/* Meta row */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: SPACING.xs }}>
        {lead.dealValue && (
          <span style={{
            fontSize: FONTS.size.xs, color: COLORS.accent,
            fontWeight: FONTS.weight.semibold, display: "flex",
            alignItems: "center", gap: "2px",
          }}>
            <RiMoneyDollarCircleLine size={11} /> {formatINR(lead.dealValue)}
          </span>
        )}
        {lead.agentName && (
          <span style={{ fontSize: FONTS.size.xs, color: COLORS.textSecondary, display: "flex", alignItems: "center", gap: "2px" }}>
            <RiUserLine size={10} /> {lead.agentName.split(" ")[0]}
          </span>
        )}
        {lead.source && (
          <span style={{
            fontSize: FONTS.size.xs, color: COLORS.textMuted,
            backgroundColor: COLORS.surfaceActive, borderRadius: RADIUS.full,
            padding: `1px ${SPACING.xs}`,
          }}>
            {lead.source}
          </span>
        )}
      </div>

      {/* Last activity */}
      {(lead.updatedAt || lead.createdAt) && (
        <div style={{ fontSize: FONTS.size.xs, color: COLORS.textMuted, marginTop: "6px", display: "flex", alignItems: "center", gap: "3px" }}>
          <RiTimeLine size={9} />
          {relativeTime(lead.updatedAt || lead.createdAt)}
        </div>
      )}
    </div>
  );
};

// ─── StageColumn ──────────────────────────────────────────────────────────────

const StageColumn = ({
  stage, leads, isDragOver,
  onDragOver, onDragLeave, onDrop,
  onDragStart, onDragEnd, draggingId,
}) => {
  const cfg     = STAGE_COLOR[stage] || { primary: COLORS.textMuted, bg: COLORS.surfaceActive };
  const total   = leads.reduce((s, l) => s + (l.dealValue || 0), 0);
  const fmtTotal = formatINR(total);

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={{
        width: "240px",
        minWidth: "240px",
        display: "flex",
        flexDirection: "column",
        backgroundColor: isDragOver ? cfg.bg : COLORS.surface,
        border: `1px solid ${isDragOver ? cfg.primary : COLORS.border}`,
        borderRadius: RADIUS.lg,
        transition: "background-color 0.15s ease, border-color 0.15s ease",
        boxShadow: isDragOver ? `0 0 0 1px ${cfg.primary}40` : SHADOWS.sm,
        maxHeight: "calc(100vh - 280px)",
        flexShrink: 0,
      }}
    >
      {/* Column header */}
      <div style={{
        padding: `${SPACING.md} ${SPACING.base}`,
        borderBottom: `1px solid ${COLORS.border}`,
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: SPACING.xs }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: cfg.primary, flexShrink: 0 }} />
            <span style={{ fontSize: FONTS.size.sm, fontWeight: FONTS.weight.semibold, color: COLORS.textPrimary }}>
              {stage}
            </span>
          </div>
          <span style={{
            fontSize: FONTS.size.xs, fontWeight: FONTS.weight.bold,
            color: cfg.primary, backgroundColor: cfg.bg,
            borderRadius: RADIUS.full, padding: `1px ${SPACING.xs}`,
            minWidth: "20px", textAlign: "center",
          }}>
            {leads.length}
          </span>
        </div>
        {fmtTotal && (
          <div style={{ fontSize: FONTS.size.xs, color: COLORS.textMuted }}>
            {fmtTotal} pipeline
          </div>
        )}
      </div>

      {/* Cards scroll area */}
      <div style={{
        padding: SPACING.sm,
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        gap: SPACING.sm,
        flexGrow: 1,
        scrollbarWidth: "thin",
        scrollbarColor: `${COLORS.scrollbarThumb} transparent`,
      }}>
        {leads.length === 0 && (
          <div style={{
            padding: SPACING.base, textAlign: "center",
            color: COLORS.textMuted, fontSize: FONTS.size.xs,
            border: `2px dashed ${isDragOver ? cfg.primary : COLORS.border}`,
            borderRadius: RADIUS.md,
            transition: "border-color 0.15s ease",
          }}>
            {isDragOver ? "Drop here" : "No leads"}
          </div>
        )}
        {leads.map(lead => (
          <LeadCard
            key={lead.id}
            lead={lead}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            isDragging={draggingId === lead.id}
          />
        ))}
        {/* Drop zone at bottom when column has cards */}
        {leads.length > 0 && isDragOver && (
          <div style={{
            height: "40px", border: `2px dashed ${cfg.primary}`,
            borderRadius: RADIUS.md, flexShrink: 0,
          }} />
        )}
      </div>
    </div>
  );
};

// ─── PipelineKanban ───────────────────────────────────────────────────────────

export const PipelineKanban = () => {
  const { companyId } = useAuth();

  const [leads, setLeads]         = useState([]);
  const [stages, setStages]       = useState(DEFAULT_STAGES);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingId, setSavingId]   = useState(null); // id of lead being saved

  // Drag state
  const [draggingLead, setDraggingLead] = useState(null);   // lead object
  const [dragOverStage, setDragOverStage] = useState(null); // stage string
  const dragCounter = useRef({}); // per-stage counter to handle child dragenter/leave

  // ── Loaders ─────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!companyId) return;
    try {
      const [leadsSnap, stagesSnap] = await Promise.all([
        getDocs(query(
          collection(db, COLLECTIONS.LEADS),
          where("companyId", "==", companyId),
          orderBy("createdAt", "desc"),
        )),
        getDocs(query(
          collection(db, COLLECTIONS.PIPELINE_STAGES),
          where("companyId", "==", companyId),
          orderBy("order", "asc"),
        )),
      ]);

      setLeads(leadsSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      // Use custom stages if any exist, otherwise default
      const customStages = stagesSnap.docs.map(d => d.data().name).filter(Boolean);
      if (customStages.length > 0) setStages(customStages);

    } catch (err) {
      console.error("PipelineKanban: loadData error:", err);
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

  // ── Drag handlers ────────────────────────────────────────────────────────

  const handleDragStart = (e, lead) => {
    setDraggingLead(lead);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("leadId", lead.id);
  };

  const handleDragEnd = () => {
    setDraggingLead(null);
    setDragOverStage(null);
    dragCounter.current = {};
  };

  const handleDragOver = (e, stage) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverStage(stage);
  };

  const handleDragEnter = (e, stage) => {
    e.preventDefault();
    dragCounter.current[stage] = (dragCounter.current[stage] || 0) + 1;
    setDragOverStage(stage);
  };

  const handleDragLeave = (e, stage) => {
    dragCounter.current[stage] = (dragCounter.current[stage] || 0) - 1;
    if (dragCounter.current[stage] <= 0) {
      dragCounter.current[stage] = 0;
      if (dragOverStage === stage) setDragOverStage(null);
    }
  };

  const handleDrop = async (e, targetStage) => {
    e.preventDefault();
    setDragOverStage(null);
    dragCounter.current = {};

    const lead = draggingLead;
    setDraggingLead(null);

    if (!lead || lead.stage === targetStage) return;

    // Optimistic update
    setLeads(prev =>
      prev.map(l => l.id === lead.id ? { ...l, stage: targetStage } : l)
    );

    // Persist to Firestore
    setSavingId(lead.id);
    try {
      await updateDoc(doc(db, COLLECTIONS.LEADS, lead.id), {
        stage: targetStage,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error("PipelineKanban: stage update error:", err);
      // Rollback
      setLeads(prev =>
        prev.map(l => l.id === lead.id ? { ...l, stage: lead.stage } : l)
      );
    } finally {
      setSavingId(null);
    }
  };

  // ── Group leads by stage ─────────────────────────────────────────────────
  const leadsByStage = stages.reduce((map, stage) => {
    map[stage] = leads.filter(l => l.stage === stage);
    return map;
  }, {});

  // ── Board summary ────────────────────────────────────────────────────────
  const totalValue = leads.reduce((s, l) => s + (l.dealValue || 0), 0);
  const totalHot   = leads.filter(l => l.leadScore === "hot").length;

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div style={{
      backgroundColor: COLORS.background,
      height: "calc(100vh - 60px)",
      display: "flex", flexDirection: "column",
      fontFamily: FONTS.family, overflow: "hidden",
      boxSizing: "border-box",
    }}>
      <style>{`
        @keyframes tirasSpinKf { from{transform:rotate(0)} to{transform:rotate(360deg)} }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${COLORS.scrollbarThumb}; border-radius: 3px; }
      `}</style>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{
        padding: `${SPACING.lg} ${SPACING["2xl"]}`,
        borderBottom: `1px solid ${COLORS.border}`,
        display: "flex", alignItems: "center",
        justifyContent: "space-between", flexWrap: "wrap",
        gap: SPACING.base, flexShrink: 0,
        backgroundColor: COLORS.background,
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: FONTS.size["3xl"], fontWeight: FONTS.weight.bold, color: COLORS.textPrimary, letterSpacing: "-0.5px" }}>
            Pipeline
          </h1>
          {!loading && (
            <p style={{ margin: `${SPACING.xs} 0 0`, fontSize: FONTS.size.sm, color: COLORS.textSecondary }}>
              {leads.length} leads ·{" "}
              <span style={{ color: COLORS.accent }}>
                {formatINR(totalValue)} total pipeline
              </span>
              {totalHot > 0 && (
                <> · <span style={{ color: COLORS.hot }}>🔥 {totalHot} hot</span></>
              )}
            </p>
          )}
        </div>

        <div style={{ display: "flex", gap: SPACING.sm, alignItems: "center" }}>
          {savingId && (
            <span style={{ fontSize: FONTS.size.sm, color: COLORS.textMuted, display: "flex", alignItems: "center", gap: "4px" }}>
              <RiLoader4Line size={13} style={{ animation: "tirasSpinKf 0.8s linear infinite" }} />
              Saving…
            </span>
          )}
          <button
            onClick={handleRefresh}
            disabled={refreshing || loading}
            style={{ ...STYLES.buttonSecondary, padding: `${SPACING.sm} ${SPACING.md}`, display: "flex", alignItems: "center", gap: SPACING.xs, opacity: refreshing ? 0.4 : 1 }}
          >
            <RiRefreshLine size={15} style={{ animation: refreshing ? "tirasSpinKf 0.7s linear infinite" : "none" }} />
          </button>
          <button style={{ ...STYLES.buttonPrimary, display: "flex", alignItems: "center", gap: SPACING.xs }}>
            <RiAddLine size={16} /> Add Lead
          </button>
        </div>
      </div>

      {/* ── Board ───────────────────────────────────────────────────────── */}
      {loading ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: SPACING.md }}>
          <RiLoader4Line size={32} color={COLORS.textMuted} style={{ animation: "tirasSpinKf 1s linear infinite" }} />
          <span style={{ color: COLORS.textMuted, fontSize: FONTS.size.sm }}>Loading pipeline…</span>
        </div>
      ) : (
        <div style={{
          flex: 1, overflowX: "auto", overflowY: "hidden",
          padding: `${SPACING.lg} ${SPACING["2xl"]}`,
          display: "flex", gap: SPACING.base, alignItems: "flex-start",
        }}>
          {stages.map(stage => (
            <StageColumn
              key={stage}
              stage={stage}
              leads={leadsByStage[stage] || []}
              isDragOver={dragOverStage === stage}
              draggingId={draggingLead?.id}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => handleDragOver(e, stage)}
              onDragEnter={(e) => handleDragEnter(e, stage)}
              onDragLeave={(e) => handleDragLeave(e, stage)}
              onDrop={(e) => handleDrop(e, stage)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
