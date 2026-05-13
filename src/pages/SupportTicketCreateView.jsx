import { useState, useEffect } from "react";
import {
  collection,
  addDoc,
  doc,
  getDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";

// ── Icon primitive ───────────────────────────────────────────────────────────
const Icon = ({ d, size = 18, color = "currentColor" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d={d} />
  </svg>
);

const ICONS = {
  ticket:     "M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z",
  plus:       "M12 5v14M5 12h14",
  x:          "M18 6L6 18M6 6l12 12",
  chevDown:   "M6 9l6 6 6-6",
  chevRight:  "M9 18l6-6-6-6",
  chevLeft:   "M15 18l-6-6 6-6",
  user:       "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
  link:       "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71",
  phone:      "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13 19.79 19.79 0 0 1 1.61 4.37 2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.18 6.18",
  clock:      "M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zM12 6v6l4 2",
  alert:      "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01",
  check:      "M20 6L9 17l-5-5",
  send:       "M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z",
  mic:        "M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8",
  filter:     "M22 3H2l8 9.46V19l4 2v-8.54L22 3z",
  inbox:      "M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z",
  arrowUp:    "M12 19V5M5 12l7-7 7 7",
  edit:       "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z",
};

// ── Constants ────────────────────────────────────────────────────────────────
const PRIORITIES = [
  { value: "low",      label: "Low",      color: "#5AB45A" },
  { value: "medium",   label: "Medium",   color: "#F2A65A" },
  { value: "high",     label: "High",     color: "#E05C5C" },
  { value: "critical", label: "Critical", color: "#FF3B3B" },
];

const STAGES = [
  { key: "Open",        color: "#5AB4F2" },
  { key: "Assigned",    color: "#F2A65A" },
  { key: "In Progress", color: "#B65E3C" },
  { key: "Resolved",    color: "#5AB45A" },
  { key: "Closed",      color: "#666"    },
];

const CATEGORIES = [
  "Call Issue",
  "Lead Data Error",
  "Payment Problem",
  "Access / Permission",
  "Recording Missing",
  "App Bug",
  "Other",
];

const VIEW = { LIST: "list", CREATE: "create", DETAIL: "detail" };

// ── Helpers ──────────────────────────────────────────────────────────────────
const timeAgo = (ts) => {
  if (!ts) return "—";
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  const diff = Math.floor((Date.now() - d) / 1000);
  if (diff < 60)   return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

const priorityConfig = (v) =>
  PRIORITIES.find((p) => p.value === v) ?? PRIORITIES[1];

const stageConfig = (k) =>
  STAGES.find((s) => s.key === k) ?? STAGES[0];

const isOverdue = (ts) => {
  if (!ts) return false;
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return (Date.now() - d) / 1000 > 86400;
};

// ── Main Component ───────────────────────────────────────────────────────────
export const SupportTicketCreateView = () => {
  const { currentUser, userProfile } = useAuth();
  const [view,    setView]    = useState(VIEW.LIST);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [filterStage, setFilterStage] = useState("all");

  // ── Live ticket list ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUser?.uid) return;

    const isManager = ["manager", "company_admin", "platform_owner"].includes(
      userProfile?.role
    );

    const q = isManager
      ? query(
          collection(db, "tickets"),
          where("companyId", "==", userProfile?.companyId ?? ""),
          orderBy("createdAt", "desc")
        )
      : query(
          collection(db, "tickets"),
          where("raisedBy", "==", currentUser.uid),
          orderBy("createdAt", "desc")
        );

    const unsub = onSnapshot(q, (snap) => {
      setTickets(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, [currentUser?.uid, userProfile?.role]);

  const filtered =
    filterStage === "all"
      ? tickets
      : tickets.filter((t) => t.stage === filterStage);

  const openCount = tickets.filter(
    (t) => t.stage !== "Resolved" && t.stage !== "Closed"
  ).length;

  const openDetail = async (id) => {
    const t = tickets.find((x) => x.id === id);
    if (t) { setSelected(t); setView(VIEW.DETAIL); }
  };

  if (view === VIEW.CREATE)
    return (
      <CreateForm
        currentUser={currentUser}
        userProfile={userProfile}
        onBack={() => setView(VIEW.LIST)}
        onSuccess={() => setView(VIEW.LIST)}
      />
    );

  if (view === VIEW.DETAIL && selected)
    return (
      <TicketDetail
        ticket={selected}
        currentUser={currentUser}
        userProfile={userProfile}
        onBack={() => { setSelected(null); setView(VIEW.LIST); }}
      />
    );

  // ── List view ────────────────────────────────────────────────────────────
  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.headerIconWrap}>
            <Icon d={ICONS.ticket} size={20} color="#F2A65A" />
          </div>
          <div>
            <h1 style={styles.title}>Support Tickets</h1>
            <p style={styles.subtitle}>
              {openCount > 0
                ? `${openCount} open ticket${openCount !== 1 ? "s" : ""}`
                : "No open tickets"}
            </p>
          </div>
        </div>
        <button style={styles.newBtn} onClick={() => setView(VIEW.CREATE)}>
          <Icon d={ICONS.plus} size={15} color="#121212" />
          New Ticket
        </button>
      </div>

      {/* Stage filter */}
      <div style={styles.filterRow}>
        {["all", ...STAGES.map((s) => s.key)].map((s) => {
          const active = filterStage === s;
          const cfg = s !== "all" ? stageConfig(s) : null;
          const count =
            s === "all"
              ? tickets.length
              : tickets.filter((t) => t.stage === s).length;
          return (
            <button
              key={s}
              onClick={() => setFilterStage(s)}
              style={{
                ...styles.filterBtn,
                background: active ? "#1E1510" : "#1A1A1A",
                border: `1px solid ${active ? "#B65E3C55" : "#2A2A2A"}`,
                color: active ? (cfg?.color ?? "#F2A65A") : "#888",
              }}
            >
              {s === "all" ? "All" : s}
              {count > 0 && (
                <span
                  style={{
                    ...styles.filterCount,
                    background: active ? "#B65E3C22" : "#222",
                    color: active ? (cfg?.color ?? "#F2A65A") : "#666",
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* List */}
      {loading ? (
        <LoadingSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyTickets onNew={() => setView(VIEW.CREATE)} />
      ) : (
        <div style={styles.list}>
          {filtered.map((t) => (
            <TicketCard
              key={t.id}
              ticket={t}
              onClick={() => openDetail(t.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ── Ticket Card ──────────────────────────────────────────────────────────────
const TicketCard = ({ ticket: t, onClick }) => {
  const [hovered, setHovered] = useState(false);
  const pri = priorityConfig(t.priority);
  const stg = stageConfig(t.stage);
  const overdue = isOverdue(t.createdAt) && !["Resolved","Closed"].includes(t.stage);

  return (
    <div
      style={{
        ...styles.card,
        background: hovered ? "#1C1C1C" : "#1A1A1A",
        borderLeft: `3px solid ${overdue ? "#E05C5C" : pri.color}`,
        cursor: "pointer",
        transform: hovered ? "translateX(3px)" : "none",
        transition: "all 0.15s",
      }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={styles.cardTop}>
        <div style={styles.cardTopLeft}>
          {overdue && (
            <span style={styles.overdueTag}>
              <Icon d={ICONS.alert} size={11} color="#E05C5C" />
              Overdue
            </span>
          )}
          <span
            style={{
              ...styles.stagePill,
              background: `${stg.color}18`,
              border: `1px solid ${stg.color}44`,
              color: stg.color,
            }}
          >
            {t.stage ?? "Open"}
          </span>
          <span
            style={{
              ...styles.priorityPill,
              background: `${pri.color}18`,
              color: pri.color,
            }}
          >
            {pri.label}
          </span>
        </div>
        <span style={styles.cardTime}>{timeAgo(t.createdAt)}</span>
      </div>

      <p style={styles.cardSubject}>{t.subject}</p>

      {t.description && (
        <p style={styles.cardDesc}>
          {t.description.length > 110
            ? t.description.slice(0, 110) + "…"
            : t.description}
        </p>
      )}

      <div style={styles.cardMeta}>
        <span style={styles.metaItem}>
          <Icon d={ICONS.filter} size={12} color="#888" />
          {t.category ?? "—"}
        </span>
        {t.linkedLeadName && (
          <span style={styles.metaItem}>
            <Icon d={ICONS.link} size={12} color="#888" />
            {t.linkedLeadName}
          </span>
        )}
        {t.linkedRecordingId && (
          <span style={styles.metaItem}>
            <Icon d={ICONS.mic} size={12} color="#888" />
            Recording linked
          </span>
        )}
        <span style={styles.metaItem}>
          <Icon d={ICONS.user} size={12} color="#888" />
          {t.raisedByName ?? "You"}
        </span>
      </div>

      <Icon d={ICONS.chevRight} size={16} color="#444" style={{ position: "absolute", right: 16, top: "50%" }} />
    </div>
  );
};

// ── Create Form ──────────────────────────────────────────────────────────────
const CreateForm = ({ currentUser, userProfile, onBack, onSuccess }) => {
  const [form, setForm] = useState({
    subject:          "",
    description:      "",
    category:         CATEGORIES[0],
    priority:         "medium",
    linkedLeadId:     "",
    linkedLeadName:   "",
    linkedRecordingId:"",
  });
  const [errors,  setErrors]  = useState({});
  const [saving,  setSaving]  = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [priOpen, setPriOpen] = useState(false);

  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const validate = () => {
    const e = {};
    if (!form.subject.trim())     e.subject     = "Subject is required";
    if (!form.description.trim()) e.description = "Description is required";
    return e;
  };

  const submit = async () => {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setSaving(true);
    try {
      await addDoc(collection(db, "tickets"), {
        subject:           form.subject.trim(),
        description:       form.description.trim(),
        category:          form.category,
        priority:          form.priority,
        stage:             "Open",
        raisedBy:          currentUser.uid,
        raisedByName:      userProfile?.displayName ?? currentUser.email,
        companyId:         userProfile?.companyId ?? "",
        linkedLeadId:      form.linkedLeadId.trim() || null,
        linkedLeadName:    form.linkedLeadName.trim() || null,
        linkedRecordingId: form.linkedRecordingId.trim() || null,
        createdAt:         serverTimestamp(),
        updatedAt:         serverTimestamp(),
        timeline: [
          {
            action:    "Ticket created",
            by:        userProfile?.displayName ?? currentUser.email,
            timestamp: new Date().toISOString(),
          },
        ],
      });
      onSuccess();
    } catch {
      setErrors({ submit: "Failed to create ticket. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  const selPriority = PRIORITIES.find((p) => p.value === form.priority);

  return (
    <div style={styles.page}>
      {/* Back header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <button style={styles.backBtn} onClick={onBack}>
            <Icon d={ICONS.chevLeft} size={16} color="#AAAAAA" />
          </button>
          <div style={styles.headerIconWrap}>
            <Icon d={ICONS.plus} size={20} color="#F2A65A" />
          </div>
          <div>
            <h1 style={styles.title}>New Ticket</h1>
            <p style={styles.subtitle}>Describe the issue clearly</p>
          </div>
        </div>
      </div>

      <div style={styles.panel}>
        {/* Subject */}
        <FieldWrap label="Subject *" error={errors.subject}>
          <input
            style={{ ...styles.input, ...(errors.subject ? styles.inputError : {}) }}
            placeholder="One-line summary of the issue"
            value={form.subject}
            onChange={set("subject")}
            maxLength={120}
          />
        </FieldWrap>

        {/* Category + Priority row */}
        <div style={styles.twoCol}>
          {/* Category */}
          <FieldWrap label="Category">
            <div style={{ position: "relative" }}>
              <button
                style={styles.select}
                onClick={() => { setCatOpen((o) => !o); setPriOpen(false); }}
              >
                {form.category}
                <Icon d={ICONS.chevDown} size={14} color="#888" />
              </button>
              {catOpen && (
                <Dropdown
                  items={CATEGORIES.map((c) => ({ label: c, value: c }))}
                  onSelect={(v) => { setForm((f) => ({ ...f, category: v })); setCatOpen(false); }}
                  onClose={() => setCatOpen(false)}
                />
              )}
            </div>
          </FieldWrap>

          {/* Priority */}
          <FieldWrap label="Priority">
            <div style={{ position: "relative" }}>
              <button
                style={{
                  ...styles.select,
                  color: selPriority.color,
                  borderColor: `${selPriority.color}44`,
                }}
                onClick={() => { setPriOpen((o) => !o); setCatOpen(false); }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: selPriority.color,
                    flexShrink: 0,
                    display: "inline-block",
                  }}
                />
                {selPriority.label}
                <Icon d={ICONS.chevDown} size={14} color={selPriority.color} />
              </button>
              {priOpen && (
                <Dropdown
                  items={PRIORITIES.map((p) => ({
                    label: p.label,
                    value: p.value,
                    color: p.color,
                  }))}
                  onSelect={(v) => { setForm((f) => ({ ...f, priority: v })); setPriOpen(false); }}
                  onClose={() => setPriOpen(false)}
                />
              )}
            </div>
          </FieldWrap>
        </div>

        {/* Description */}
        <FieldWrap label="Description *" error={errors.description}>
          <textarea
            style={{
              ...styles.textarea,
              ...(errors.description ? styles.inputError : {}),
            }}
            placeholder="Explain the issue in detail. Include what happened, what you expected, and steps to reproduce if applicable."
            value={form.description}
            onChange={set("description")}
            rows={5}
          />
        </FieldWrap>

        {/* Optional links */}
        <div style={styles.sectionDivider}>
          <span>Optional — Link to Lead or Recording</span>
        </div>

        <div style={styles.twoCol}>
          <FieldWrap label="Lead ID (if applicable)">
            <input
              style={styles.input}
              placeholder="Firestore lead doc ID"
              value={form.linkedLeadId}
              onChange={set("linkedLeadId")}
            />
          </FieldWrap>
          <FieldWrap label="Lead Name">
            <input
              style={styles.input}
              placeholder="Customer name"
              value={form.linkedLeadName}
              onChange={set("linkedLeadName")}
            />
          </FieldWrap>
        </div>

        <FieldWrap label="Recording ID (if applicable)">
          <input
            style={styles.input}
            placeholder="Plivo recording ID or storage path"
            value={form.linkedRecordingId}
            onChange={set("linkedRecordingId")}
          />
          <span style={styles.hint}>
            Linking a recording lets your manager play it directly from the ticket.
          </span>
        </FieldWrap>

        {errors.submit && (
          <div style={styles.submitError}>
            <Icon d={ICONS.alert} size={14} color="#E05C5C" />
            {errors.submit}
          </div>
        )}

        {/* Actions */}
        <div style={styles.formFooter}>
          <button style={styles.cancelBtn} onClick={onBack}>
            Cancel
          </button>
          <button
            style={{ ...styles.saveBtn, opacity: saving ? 0.6 : 1 }}
            onClick={submit}
            disabled={saving}
          >
            <Icon d={ICONS.send} size={15} color="#121212" />
            {saving ? "Submitting…" : "Submit Ticket"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Ticket Detail ────────────────────────────────────────────────────────────
const TicketDetail = ({ ticket: t, currentUser, userProfile, onBack }) => {
  const [comment,   setComment]  = useState("");
  const [posting,   setPosting]  = useState(false);
  const [stageOpen, setStageOpen] = useState(false);
  const [ticket,    setTicket]   = useState(t);

  const canChangeStage = ["manager", "company_admin", "platform_owner", "support_agent"].includes(
    userProfile?.role
  );

  const pri = priorityConfig(ticket.priority);
  const stg = stageConfig(ticket.stage);
  const overdue = isOverdue(ticket.createdAt) && !["Resolved", "Closed"].includes(ticket.stage);

  // Live updates for this ticket
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "tickets", ticket.id), (snap) => {
      if (snap.exists()) setTicket({ id: snap.id, ...snap.data() });
    });
    return () => unsub();
  }, [ticket.id]);

  const changeStage = async (newStage) => {
    setStageOpen(false);
    const entry = {
      action:    `Stage changed to ${newStage}`,
      by:        userProfile?.displayName ?? currentUser.email,
      timestamp: new Date().toISOString(),
    };
    await updateDoc(doc(db, "tickets", ticket.id), {
      stage:     newStage,
      updatedAt: serverTimestamp(),
      timeline:  [...(ticket.timeline ?? []), entry],
    });
  };

  const postComment = async () => {
    if (!comment.trim()) return;
    setPosting(true);
    const entry = {
      action:    `Comment: ${comment.trim()}`,
      by:        userProfile?.displayName ?? currentUser.email,
      timestamp: new Date().toISOString(),
      isComment: true,
    };
    try {
      await updateDoc(doc(db, "tickets", ticket.id), {
        updatedAt: serverTimestamp(),
        timeline:  [...(ticket.timeline ?? []), entry],
      });
      setComment("");
    } finally {
      setPosting(false);
    }
  };

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <button style={styles.backBtn} onClick={onBack}>
            <Icon d={ICONS.chevLeft} size={16} color="#AAAAAA" />
          </button>
          <div>
            <h1 style={{ ...styles.title, fontSize: 18 }}>{ticket.subject}</h1>
            <p style={styles.subtitle}>
              Raised by {ticket.raisedByName} · {timeAgo(ticket.createdAt)}
            </p>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Overdue banner */}
        {overdue && (
          <div style={styles.overdueBanner}>
            <Icon d={ICONS.alert} size={15} color="#E05C5C" />
            This ticket has been open for over 24 hours without resolution.
          </div>
        )}

        {/* Meta pills */}
        <div style={styles.metaPills}>
          <span style={{ ...styles.stagePill, background: `${stg.color}18`, border: `1px solid ${stg.color}44`, color: stg.color }}>
            {ticket.stage}
          </span>
          <span style={{ ...styles.priorityPill, background: `${pri.color}18`, color: pri.color }}>
            {pri.label} priority
          </span>
          <span style={{ ...styles.metaPill }}>
            <Icon d={ICONS.filter} size={12} color="#888" />
            {ticket.category}
          </span>
          {ticket.linkedLeadName && (
            <span style={styles.metaPill}>
              <Icon d={ICONS.link} size={12} color="#888" />
              {ticket.linkedLeadName}
            </span>
          )}
          {ticket.linkedRecordingId && (
            <span style={{ ...styles.metaPill, color: "#F2A65A", borderColor: "#F2A65A33" }}>
              <Icon d={ICONS.mic} size={12} color="#F2A65A" />
              Recording linked
            </span>
          )}
        </div>

        {/* Body + actions */}
        <div style={styles.detailGrid}>
          {/* Left — description + timeline */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={styles.panel}>
              <p style={styles.detailSectionTitle}>Description</p>
              <p style={styles.detailDesc}>{ticket.description}</p>
            </div>

            {/* Timeline */}
            <div style={styles.panel}>
              <p style={styles.detailSectionTitle}>Activity</p>
              <div style={styles.timeline}>
                {(ticket.timeline ?? []).map((entry, i) => (
                  <div key={i} style={styles.timelineItem}>
                    <div style={styles.timelineDot} />
                    <div style={styles.timelineBody}>
                      <span
                        style={{
                          ...styles.timelineText,
                          color: entry.isComment ? "#F5F5F5" : "#AAAAAA",
                        }}
                      >
                        {entry.action}
                      </span>
                      <span style={styles.timelineMeta}>
                        {entry.by} · {new Date(entry.timestamp).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add comment */}
              <div style={styles.commentRow}>
                <input
                  style={{ ...styles.input, flex: 1 }}
                  placeholder="Add a comment or update…"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && postComment()}
                />
                <button
                  style={{ ...styles.saveBtn, padding: "10px 16px", opacity: posting ? 0.6 : 1 }}
                  onClick={postComment}
                  disabled={posting || !comment.trim()}
                >
                  <Icon d={ICONS.send} size={14} color="#121212" />
                </button>
              </div>
            </div>
          </div>

          {/* Right — stage change */}
          {canChangeStage && (
            <div style={styles.panel}>
              <p style={styles.detailSectionTitle}>Change Stage</p>
              <div style={{ position: "relative" }}>
                <button
                  style={{
                    ...styles.select,
                    width: "100%",
                    color: stg.color,
                    borderColor: `${stg.color}44`,
                  }}
                  onClick={() => setStageOpen((o) => !o)}
                >
                  <span
                    style={{
                      width: 8, height: 8, borderRadius: "50%",
                      background: stg.color, display: "inline-block",
                    }}
                  />
                  {ticket.stage}
                  <Icon d={ICONS.chevDown} size={14} color={stg.color} />
                </button>
                {stageOpen && (
                  <Dropdown
                    items={STAGES.map((s) => ({ label: s.key, value: s.key, color: s.color }))}
                    onSelect={changeStage}
                    onClose={() => setStageOpen(false)}
                  />
                )}
              </div>
              <p style={{ ...styles.hint, marginTop: 10 }}>
                Changing stage adds an entry to the activity log automatically.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Dropdown ─────────────────────────────────────────────────────────────────
const Dropdown = ({ items, onSelect, onClose }) => (
  <>
    <div style={styles.dropdownOverlay} onClick={onClose} />
    <div style={styles.dropdown}>
      {items.map((item) => (
        <button
          key={item.value}
          style={{ ...styles.dropdownItem, color: item.color ?? "#F5F5F5" }}
          onClick={() => onSelect(item.value)}
        >
          {item.color && (
            <span
              style={{
                width: 8, height: 8, borderRadius: "50%",
                background: item.color, display: "inline-block",
              }}
            />
          )}
          {item.label}
        </button>
      ))}
    </div>
  </>
);

// ── Field wrapper ────────────────────────────────────────────────────────────
const FieldWrap = ({ label, error, children }) => (
  <div style={styles.field}>
    <label style={styles.fieldLabel}>{label}</label>
    {children}
    {error && <span style={styles.fieldError}>{error}</span>}
  </div>
);

// ── Empty state ──────────────────────────────────────────────────────────────
const EmptyTickets = ({ onNew }) => (
  <div style={styles.empty}>
    <div style={styles.emptyIconRing}>
      <Icon d={ICONS.ticket} size={30} color="#B65E3C" />
    </div>
    <p style={styles.emptyTitle}>No tickets yet</p>
    <p style={styles.emptyText}>Raise a support ticket when you encounter a problem.</p>
    <button style={styles.saveBtn} onClick={onNew}>
      <Icon d={ICONS.plus} size={14} color="#121212" />
      Raise First Ticket
    </button>
  </div>
);

// ── Loading skeleton ─────────────────────────────────────────────────────────
const LoadingSkeleton = () => (
  <div style={styles.list}>
    {[...Array(4)].map((_, i) => (
      <div key={i} style={{ ...styles.card, borderLeft: "3px solid #2A2A2A", cursor: "default" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <div style={{ height: 20, width: 70, background: "#222", borderRadius: 6 }} />
          <div style={{ height: 20, width: 50, background: "#222", borderRadius: 6 }} />
        </div>
        <div style={{ height: 16, width: "65%", background: "#1E1E1E", borderRadius: 4, marginBottom: 8 }} />
        <div style={{ height: 13, width: "85%", background: "#1C1C1C", borderRadius: 4 }} />
      </div>
    ))}
  </div>
);

// ── Styles ───────────────────────────────────────────────────────────────────
const styles = {
  page: {
    minHeight: "100vh",
    background: "#121212",
    color: "#F5F5F5",
    fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
    padding: "32px 24px",
    maxWidth: 820,
    margin: "0 auto",
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 28,
    flexWrap: "wrap",
    gap: 12,
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  headerIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: "#1E1510",
    border: "1px solid #B65E3C33",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    background: "#1A1A1A",
    border: "1px solid #2A2A2A",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    flexShrink: 0,
  },
  title: {
    margin: 0,
    fontSize: 22,
    fontWeight: 700,
    letterSpacing: "-0.3px",
    color: "#F5F5F5",
  },
  subtitle: {
    margin: "3px 0 0",
    fontSize: 13,
    color: "#AAAAAA",
  },
  newBtn: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    padding: "9px 18px",
    borderRadius: 8,
    border: "none",
    background: "#B65E3C",
    color: "#121212",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  filterRow: {
    display: "flex",
    gap: 6,
    marginBottom: 20,
    overflowX: "auto",
    paddingBottom: 4,
    scrollbarWidth: "none",
    flexWrap: "wrap",
  },
  filterBtn: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 12px",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 500,
    cursor: "pointer",
    transition: "all 0.15s",
    whiteSpace: "nowrap",
  },
  filterCount: {
    padding: "1px 6px",
    borderRadius: 5,
    fontSize: 11,
    fontWeight: 700,
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  card: {
    background: "#1A1A1A",
    border: "1px solid #252525",
    borderRadius: 10,
    padding: "14px 40px 14px 16px",
    position: "relative",
  },
  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    flexWrap: "wrap",
    gap: 6,
  },
  cardTopLeft: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  overdueTag: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    padding: "2px 8px",
    borderRadius: 5,
    background: "#3A1515",
    border: "1px solid #E05C5C33",
    color: "#E05C5C",
    fontSize: 11,
    fontWeight: 600,
  },
  stagePill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "2px 9px",
    borderRadius: 5,
    fontSize: 11,
    fontWeight: 600,
  },
  priorityPill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "2px 8px",
    borderRadius: 5,
    fontSize: 11,
    fontWeight: 600,
  },
  metaPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "2px 8px",
    borderRadius: 5,
    background: "#222",
    border: "1px solid #2A2A2A",
    color: "#AAAAAA",
    fontSize: 11,
  },
  cardTime: {
    fontSize: 11,
    color: "#666",
    flexShrink: 0,
  },
  cardSubject: {
    margin: "0 0 6px",
    fontSize: 15,
    fontWeight: 600,
    color: "#F5F5F5",
  },
  cardDesc: {
    margin: "0 0 10px",
    fontSize: 13,
    color: "#AAAAAA",
    lineHeight: 1.5,
  },
  cardMeta: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  metaItem: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    fontSize: 11,
    color: "#888",
  },
  panel: {
    background: "#1A1A1A",
    border: "1px solid #252525",
    borderRadius: 12,
    padding: "22px 24px",
  },
  twoCol: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: "#AAAAAA",
    textTransform: "uppercase",
    letterSpacing: "0.6px",
  },
  fieldError: {
    fontSize: 12,
    color: "#E05C5C",
    marginTop: 2,
  },
  input: {
    width: "100%",
    padding: "10px 14px",
    background: "#121212",
    border: "1px solid #2A2A2A",
    borderRadius: 8,
    color: "#F5F5F5",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "inherit",
  },
  inputError: {
    borderColor: "#E05C5C66",
  },
  textarea: {
    width: "100%",
    padding: "10px 14px",
    background: "#121212",
    border: "1px solid #2A2A2A",
    borderRadius: 8,
    color: "#F5F5F5",
    fontSize: 14,
    outline: "none",
    resize: "vertical",
    boxSizing: "border-box",
    fontFamily: "inherit",
    lineHeight: 1.6,
    minHeight: 110,
  },
  select: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    width: "100%",
    padding: "10px 14px",
    background: "#121212",
    border: "1px solid #2A2A2A",
    borderRadius: 8,
    color: "#F5F5F5",
    fontSize: 14,
    cursor: "pointer",
    justifyContent: "space-between",
    boxSizing: "border-box",
  },
  sectionDivider: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    color: "#555",
    fontSize: 12,
    fontWeight: 500,
    textTransform: "uppercase",
    letterSpacing: "0.6px",
  },
  hint: {
    fontSize: 11,
    color: "#666",
    marginTop: 4,
  },
  submitError: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 14px",
    borderRadius: 8,
    background: "#3A1515",
    border: "1px solid #E05C5C33",
    color: "#E05C5C",
    fontSize: 13,
  },
  formFooter: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 8,
  },
  cancelBtn: {
    padding: "10px 20px",
    borderRadius: 8,
    border: "1px solid #2A2A2A",
    background: "transparent",
    color: "#AAAAAA",
    fontSize: 14,
    cursor: "pointer",
  },
  saveBtn: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 22px",
    borderRadius: 8,
    border: "none",
    background: "#B65E3C",
    color: "#121212",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    letterSpacing: "0.2px",
    transition: "opacity 0.15s",
  },
  overdueBanner: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "12px 16px",
    borderRadius: 8,
    background: "#3A1515",
    border: "1px solid #E05C5C44",
    color: "#E05C5C",
    fontSize: 13,
    fontWeight: 500,
  },
  metaPills: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },
  detailGrid: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: 16,
    alignItems: "start",
  },
  detailSectionTitle: {
    margin: "0 0 14px",
    fontSize: 12,
    fontWeight: 600,
    color: "#888",
    textTransform: "uppercase",
    letterSpacing: "0.6px",
  },
  detailDesc: {
    margin: 0,
    fontSize: 14,
    color: "#AAAAAA",
    lineHeight: 1.7,
    whiteSpace: "pre-wrap",
  },
  timeline: {
    display: "flex",
    flexDirection: "column",
    gap: 0,
    marginBottom: 16,
    maxHeight: 300,
    overflowY: "auto",
  },
  timelineItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    padding: "10px 0",
    borderBottom: "1px solid #1E1E1E",
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#B65E3C",
    flexShrink: 0,
    marginTop: 4,
  },
  timelineBody: {
    display: "flex",
    flexDirection: "column",
    gap: 3,
  },
  timelineText: {
    fontSize: 13,
    lineHeight: 1.5,
  },
  timelineMeta: {
    fontSize: 11,
    color: "#555",
  },
  commentRow: {
    display: "flex",
    gap: 8,
    marginTop: 4,
  },
  dropdownOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 9,
  },
  dropdown: {
    position: "absolute",
    top: "calc(100% + 4px)",
    left: 0,
    right: 0,
    background: "#1E1E1E",
    border: "1px solid #2A2A2A",
    borderRadius: 8,
    zIndex: 10,
    overflow: "hidden",
    boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
  },
  dropdownItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    width: "100%",
    padding: "10px 14px",
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: 13,
    textAlign: "left",
    transition: "background 0.1s",
  },
  empty: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "80px 24px",
    textAlign: "center",
    gap: 14,
  },
  emptyIconRing: {
    width: 72,
    height: 72,
    borderRadius: "50%",
    background: "#1E1510",
    border: "1px solid #B65E3C33",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyTitle: {
    margin: 0,
    fontSize: 17,
    fontWeight: 600,
    color: "#F5F5F5",
  },
  emptyText: {
    margin: 0,
    fontSize: 14,
    color: "#888",
    maxWidth: 300,
    lineHeight: 1.6,
  },
};

export default SupportTicketCreateView;
