// TIRAS CRM — CallRecordingsLibrary.jsx
// Company Admin — browse every call recording; inline audio player; AI summary expand/collapse
//
// USAGE: In src/pages/index.js replace:
//   export const CallRecordingsLibrary = () => <Placeholder name="Call Recordings Library" />;
// with:
//   export { CallRecordingsLibrary } from "./CallRecordingsLibrary";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  collection, query, where, getDocs,
  orderBy, Timestamp,
} from "firebase/firestore";
import { db, COLLECTIONS } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import {
  COLORS, FONTS, SPACING, RADIUS, SHADOWS, STYLES, TRANSITIONS,
} from "../theme";
import {
  RiSearchLine, RiPlayCircleLine, RiPauseCircleLine,
  RiLoader4Line, RiRefreshLine, RiMicLine,
  RiRobot2Line, RiArrowDownSLine, RiArrowUpSLine,
  RiDownloadLine, RiPhoneLine, RiUserLine,
  RiTimeLine, RiCalendarLine,
} from "react-icons/ri";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatDuration = (seconds) => {
  if (!seconds && seconds !== 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
};

const formatDate = (ts) => {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
};

const relativeTime = (ts) => {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return formatDate(ts);
};

const OUTCOME_COLOR = {
  "Interested":      COLORS.success,
  "Not Interested":  COLORS.danger,
  "Call Back":       COLORS.warning,
  "No Answer":       COLORS.textMuted,
  "Wrong Number":    COLORS.danger,
  "Busy":            COLORS.warning,
  "Voicemail":       COLORS.info,
};

// ─── Inline Audio Player ──────────────────────────────────────────────────────

const AudioPlayer = ({ url, callId, activeId, setActiveId }) => {
  const audioRef  = useRef(null);
  const rafRef    = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);   // seconds
  const [duration, setDuration] = useState(0); // seconds

  const isActive = activeId === callId;

  // If another recording starts, pause this one
  useEffect(() => {
    if (!isActive && playing) {
      audioRef.current?.pause();
      setPlaying(false);
    }
  }, [isActive, playing]);

  const tick = () => {
    if (audioRef.current) setCurrent(Math.floor(audioRef.current.currentTime));
    rafRef.current = requestAnimationFrame(tick);
  };

  const handlePlay = () => {
    if (!audioRef.current) return;
    setActiveId(callId);
    audioRef.current.play();
    setPlaying(true);
    rafRef.current = requestAnimationFrame(tick);
  };

  const handlePause = () => {
    audioRef.current?.pause();
    setPlaying(false);
    cancelAnimationFrame(rafRef.current);
  };

  const handleEnded = () => {
    setPlaying(false);
    setCurrent(0);
    cancelAnimationFrame(rafRef.current);
  };

  const handleLoaded = () => {
    setDuration(Math.floor(audioRef.current?.duration || 0));
  };

  const handleSeek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct  = (e.clientX - rect.left) / rect.width;
    const t    = pct * (audioRef.current?.duration || 0);
    if (audioRef.current) {
      audioRef.current.currentTime = t;
      setCurrent(Math.floor(t));
    }
  };

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const pct = duration > 0 ? (current / duration) * 100 : 0;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: SPACING.sm, flex: 1 }}>
      <audio
        ref={audioRef}
        src={url}
        onLoadedMetadata={handleLoaded}
        onEnded={handleEnded}
        preload="metadata"
      />

      {/* Play / Pause */}
      <button
        onClick={playing ? handlePause : handlePlay}
        style={{
          background: "none", border: "none",
          color: COLORS.primary, cursor: "pointer",
          padding: 0, display: "flex", alignItems: "center",
          flexShrink: 0,
        }}
      >
        {playing
          ? <RiPauseCircleLine size={28} />
          : <RiPlayCircleLine  size={28} />
        }
      </button>

      {/* Scrubber + time */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Scrubber bar */}
        <div
          onClick={handleSeek}
          style={{
            width: "100%", height: "4px",
            backgroundColor: COLORS.surfaceActive,
            borderRadius: RADIUS.full,
            cursor: "pointer", position: "relative",
            marginBottom: "4px",
          }}
        >
          <div style={{
            width: `${pct}%`, height: "100%",
            backgroundColor: COLORS.primary,
            borderRadius: RADIUS.full,
            transition: playing ? "none" : "width 0.1s ease",
          }} />
        </div>

        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: FONTS.size.xs, color: COLORS.textMuted }}>
            {formatDuration(current)}
          </span>
          <span style={{ fontSize: FONTS.size.xs, color: COLORS.textMuted }}>
            {formatDuration(duration)}
          </span>
        </div>
      </div>
    </div>
  );
};

// ─── Recording Row ────────────────────────────────────────────────────────────

const RecordingRow = ({ call, isLast, activePlayId, setActivePlayId }) => {
  const [expanded, setExpanded] = useState(false);
  const outcomeColor = OUTCOME_COLOR[call.outcome] || COLORS.textSecondary;

  return (
    <div style={{
      borderBottom: isLast ? "none" : `1px solid ${COLORS.border}`,
    }}>
      {/* Main row */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 130px 110px 100px 48px",
        gap: SPACING.base,
        padding: `${SPACING.md} ${SPACING.lg}`,
        alignItems: "center",
      }}>
        {/* Lead + Agent info */}
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: SPACING.sm, marginBottom: "4px" }}>
            <div style={{
              fontSize: FONTS.size.base, fontWeight: FONTS.weight.semibold,
              color: COLORS.textPrimary, overflow: "hidden",
              textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {call.leadName || "Unknown Lead"}
            </div>
            {call.outcome && (
              <span style={{
                fontSize: FONTS.size.xs, fontWeight: FONTS.weight.semibold,
                color: outcomeColor, backgroundColor: outcomeColor + "20",
                borderRadius: RADIUS.full, padding: `1px ${SPACING.xs}`,
                flexShrink: 0, whiteSpace: "nowrap",
              }}>
                {call.outcome}
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: SPACING.md, flexWrap: "wrap" }}>
            {call.leadPhone && (
              <span style={{ fontSize: FONTS.size.xs, color: COLORS.textSecondary, display: "flex", alignItems: "center", gap: "3px" }}>
                <RiPhoneLine size={10} /> {call.leadPhone}
              </span>
            )}
            {call.agentName && (
              <span style={{ fontSize: FONTS.size.xs, color: COLORS.textSecondary, display: "flex", alignItems: "center", gap: "3px" }}>
                <RiUserLine size={10} /> {call.agentName}
              </span>
            )}
            <span style={{ fontSize: FONTS.size.xs, color: COLORS.textMuted, display: "flex", alignItems: "center", gap: "3px" }}>
              <RiCalendarLine size={10} /> {relativeTime(call.createdAt)}
            </span>
          </div>
        </div>

        {/* Audio player */}
        <div style={{ gridColumn: "1 / -1", paddingTop: SPACING.xs }}>
          {call.recordingUrl ? (
            <AudioPlayer
              url={call.recordingUrl}
              callId={call.id}
              activeId={activePlayId}
              setActiveId={setActivePlayId}
            />
          ) : (
            <span style={{ fontSize: FONTS.size.xs, color: COLORS.textMuted }}>
              Recording expired or unavailable
            </span>
          )}
        </div>
      </div>

      {/* Duration + AI summary row */}
      <div style={{
        display: "flex", alignItems: "center",
        padding: `0 ${SPACING.lg} ${SPACING.sm}`,
        gap: SPACING.base,
      }}>
        {/* Duration pill */}
        <div style={{
          display: "flex", alignItems: "center", gap: "4px",
          backgroundColor: COLORS.surfaceActive, borderRadius: RADIUS.full,
          padding: `2px ${SPACING.sm}`, flexShrink: 0,
        }}>
          <RiTimeLine size={11} color={COLORS.textMuted} />
          <span style={{ fontSize: FONTS.size.xs, color: COLORS.textSecondary }}>
            {formatDuration(call.durationSeconds)}
          </span>
        </div>

        {/* AI Summary toggle */}
        {call.aiSummary && (
          <button
            onClick={() => setExpanded(e => !e)}
            style={{
              background: "none", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", gap: "4px",
              color: COLORS.accent, padding: 0,
              fontSize: FONTS.size.xs, fontWeight: FONTS.weight.semibold,
              fontFamily: FONTS.family,
            }}
          >
            <RiRobot2Line size={13} />
            AI Summary
            {expanded ? <RiArrowUpSLine size={13} /> : <RiArrowDownSLine size={13} />}
          </button>
        )}

        {/* Download button */}
        {call.recordingUrl && (
          <a
            href={call.recordingUrl}
            download
            target="_blank"
            rel="noreferrer"
            style={{
              marginLeft: "auto", color: COLORS.textMuted,
              display: "flex", alignItems: "center", gap: "3px",
              fontSize: FONTS.size.xs, textDecoration: "none",
            }}
          >
            <RiDownloadLine size={13} /> Download
          </a>
        )}
      </div>

      {/* AI Summary expanded */}
      {expanded && call.aiSummary && (
        <div style={{
          margin: `0 ${SPACING.lg} ${SPACING.md}`,
          padding: SPACING.md,
          backgroundColor: COLORS.accentMuted,
          border: `1px solid ${COLORS.accent}30`,
          borderRadius: RADIUS.md,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: SPACING.xs, marginBottom: SPACING.xs }}>
            <RiRobot2Line size={14} color={COLORS.accent} />
            <span style={{ fontSize: FONTS.size.xs, fontWeight: FONTS.weight.semibold, color: COLORS.accent, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              AI Call Summary
            </span>
          </div>
          <p style={{ margin: 0, fontSize: FONTS.size.sm, color: COLORS.textSecondary, lineHeight: 1.7 }}>
            {call.aiSummary}
          </p>
          {call.aiObjectionTag && (
            <div style={{ marginTop: SPACING.sm, display: "flex", alignItems: "center", gap: SPACING.xs }}>
              <span style={{ fontSize: FONTS.size.xs, color: COLORS.textMuted }}>Objection tagged:</span>
              <span style={{
                fontSize: FONTS.size.xs, fontWeight: FONTS.weight.semibold,
                color: COLORS.warning, backgroundColor: COLORS.warningMuted,
                borderRadius: RADIUS.full, padding: `2px ${SPACING.sm}`,
              }}>
                {call.aiObjectionTag}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── CallRecordingsLibrary ────────────────────────────────────────────────────

export const CallRecordingsLibrary = () => {
  const { companyId } = useAuth();

  const [calls, setCalls]       = useState([]);
  const [agents, setAgents]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [search, setSearch]           = useState("");
  const [filterAgent, setFilterAgent] = useState("all");
  const [filterFrom, setFilterFrom]   = useState("");
  const [filterTo, setFilterTo]       = useState("");

  // One active audio at a time
  const [activePlayId, setActivePlayId] = useState(null);

  // ── Load ─────────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!companyId) return;
    try {
      const [callsSnap, usersSnap] = await Promise.all([
        getDocs(query(
          collection(db, COLLECTIONS.CALLS),
          where("companyId", "==", companyId),
          orderBy("createdAt", "desc"),
        )),
        getDocs(query(
          collection(db, COLLECTIONS.USERS),
          where("companyId", "==", companyId),
          where("role", "in", ["agent", "manager"]),
        )),
      ]);
      setCalls(callsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setAgents(usersSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("CallRecordingsLibrary: loadData error:", err);
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

  // ── Filter ───────────────────────────────────────────────────────────────
  const filtered = calls.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      c.leadName?.toLowerCase().includes(q) ||
      c.agentName?.toLowerCase().includes(q) ||
      c.leadPhone?.includes(q);
    const matchAgent = filterAgent === "all" || c.agentId === filterAgent;

    let matchDate = true;
    if (filterFrom || filterTo) {
      const d = c.createdAt?.toDate?.() || new Date(c.createdAt);
      if (filterFrom) matchDate = matchDate && d >= new Date(filterFrom);
      if (filterTo)   {
        const to = new Date(filterTo);
        to.setHours(23, 59, 59);
        matchDate = matchDate && d <= to;
      }
    }
    return matchSearch && matchAgent && matchDate;
  });

  // ── Stats ─────────────────────────────────────────────────────────────────
  const withRecording    = calls.filter(c => c.recordingUrl).length;
  const withAISummary    = calls.filter(c => c.aiSummary).length;
  const avgDuration      = calls.length > 0
    ? Math.round(calls.reduce((s, c) => s + (c.durationSeconds || 0), 0) / calls.length)
    : 0;

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div style={{
      backgroundColor: COLORS.background, minHeight: "calc(100vh - 60px)",
      padding: `${SPACING["2xl"]} ${SPACING["2xl"]}`,
      fontFamily: FONTS.family, boxSizing: "border-box",
    }}>
      <style>{`
        @keyframes tirasSpinKf { from{transform:rotate(0)} to{transform:rotate(360deg)} }
        select option { background: ${COLORS.surface}; color: ${COLORS.textPrimary}; }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: SPACING.base, marginBottom: SPACING.xl }}>
        <div>
          <h1 style={{ margin: 0, fontSize: FONTS.size["4xl"], fontWeight: FONTS.weight.bold, color: COLORS.textPrimary, letterSpacing: "-0.5px" }}>
            Call Recordings
          </h1>
          <p style={{ margin: `${SPACING.xs} 0 0`, fontSize: FONTS.size.base, color: COLORS.textSecondary }}>
            Every recorded call — play inline, read AI summaries, download originals.
          </p>
        </div>
        <button onClick={handleRefresh} disabled={refreshing} style={{ ...STYLES.buttonSecondary, display: "flex", alignItems: "center", gap: SPACING.xs, opacity: refreshing ? 0.4 : 1 }}>
          <RiRefreshLine size={15} style={{ animation: refreshing ? "tirasSpinKf 0.7s linear infinite" : "none" }} />
          Refresh
        </button>
      </div>

      {/* Summary pills */}
      <div style={{ display: "flex", gap: SPACING.md, marginBottom: SPACING.lg, flexWrap: "wrap" }}>
        {[
          { label: "Total Calls",     value: calls.length,     color: COLORS.info },
          { label: "With Recording",  value: withRecording,    color: COLORS.primary },
          { label: "AI Summaries",    value: withAISummary,    color: COLORS.accent },
          { label: "Avg Duration",    value: formatDuration(avgDuration), color: COLORS.success },
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
          <input type="text" placeholder="Lead name, agent, phone…" value={search} onChange={e => setSearch(e.target.value)} style={{ ...STYLES.input, paddingLeft: "34px" }} />
        </div>
        <select value={filterAgent} onChange={e => setFilterAgent(e.target.value)} style={{ ...STYLES.input, width: "160px", appearance: "none", cursor: "pointer" }}>
          <option value="all">All Agents</option>
          {agents.map(a => <option key={a.id} value={a.id}>{a.displayName || a.email}</option>)}
        </select>
        <div style={{ display: "flex", alignItems: "center", gap: SPACING.xs }}>
          <span style={{ fontSize: FONTS.size.sm, color: COLORS.textSecondary, flexShrink: 0 }}>From</span>
          <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} style={{ ...STYLES.input, width: "145px" }} />
          <span style={{ fontSize: FONTS.size.sm, color: COLORS.textSecondary, flexShrink: 0 }}>To</span>
          <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} style={{ ...STYLES.input, width: "145px" }} />
          {(filterFrom || filterTo) && (
            <button onClick={() => { setFilterFrom(""); setFilterTo(""); }} style={{ background: "none", border: "none", color: COLORS.textMuted, cursor: "pointer", fontSize: FONTS.size.sm, fontFamily: FONTS.family }}>
              Clear
            </button>
          )}
        </div>
        <span style={{ fontSize: FONTS.size.sm, color: COLORS.textMuted, marginLeft: "auto" }}>
          {loading ? "…" : `${filtered.length} recordings`}
        </span>
      </div>

      {/* Recordings List */}
      <div style={{ backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.lg, overflow: "hidden" }}>
        {/* Column header */}
        <div style={{
          display: "flex", padding: `${SPACING.sm} ${SPACING.lg}`,
          backgroundColor: COLORS.surfaceActive, borderBottom: `1px solid ${COLORS.border}`,
          alignItems: "center", gap: SPACING.base,
        }}>
          <RiMicLine size={14} color={COLORS.textMuted} />
          <span style={{ fontSize: FONTS.size.xs, fontWeight: FONTS.weight.semibold, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Recording
          </span>
          <span style={{ marginLeft: "auto", fontSize: FONTS.size.xs, color: COLORS.textMuted }}>
            Only one recording plays at a time
          </span>
        </div>

        {loading && (
          <div style={{ padding: SPACING["5xl"], textAlign: "center" }}>
            <RiLoader4Line size={26} color={COLORS.textMuted} style={{ animation: "tirasSpinKf 1s linear infinite" }} />
            <div style={{ color: COLORS.textMuted, fontSize: FONTS.size.sm, marginTop: SPACING.sm }}>Loading recordings…</div>
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div style={{ padding: SPACING["5xl"], textAlign: "center" }}>
            <RiMicLine size={36} color={COLORS.textMuted} style={{ marginBottom: SPACING.md }} />
            <div style={{ color: COLORS.textPrimary, fontWeight: FONTS.weight.semibold, marginBottom: SPACING.xs }}>
              {search || filterAgent !== "all" ? "No recordings match filters" : "No call recordings yet"}
            </div>
            <div style={{ color: COLORS.textSecondary, fontSize: FONTS.size.sm }}>
              Recordings appear here after agents complete calls via Plivo.
            </div>
          </div>
        )}

        {!loading && filtered.map((call, idx) => (
          <RecordingRow
            key={call.id}
            call={call}
            isLast={idx === filtered.length - 1}
            activePlayId={activePlayId}
            setActivePlayId={setActivePlayId}
          />
        ))}
      </div>
    </div>
  );
};
