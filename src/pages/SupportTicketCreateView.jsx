import { useState, useEffect, useCallback } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db, COLLECTIONS } from "../firebase";
import { useAuth } from "../contexts/AuthContext";

/* ─────────────────────────────────────────────────────────────────────────────
   TIRAS CRM V2 — SupportTicketCreateView
   Theme: Obsidian Gold  |  Route: /tickets  |  All roles
   Views: List → Create form → Detail (activity log + stage change)
   Real-time onSnapshot · Role-aware · Toast on every write · Skeleton
───────────────────────────────────────────────────────────────────────────── */

const C = {
  bg:         "#121212",
  surface:    "#1A1A1B",
  surfaceHov: "#222223",
  border:     "#2A2A2B",
  gold:       "#D4AF37",
  goldMuted:  "rgba(212,175,55,0.12)",
  red:        "#E63946",
  redMuted:   "rgba(230,57,70,0.12)",
  green:      "#10B981",
  greenMuted: "rgba(16,185,129,0.12)",
  blue:       "#3B82F6",
  blueMuted:  "rgba(59,130,246,0.12)",
  amber:      "#F59E0B",
  text:       "#F5F5F5",
  textSec:    "#9A9A9A",
  textMuted:  "#555555",
};

// ── Global styles ─────────────────────────────────────────────────────────────
const STYLE_ID = "tiras-v2-stcv";
if (typeof document !== "undefined" && !document.getElementById(STYLE_ID)) {
  const s = document.createElement("style");
  s.id = STYLE_ID;
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:wght@400;500;600;700&display=swap');

    @keyframes stcv-up    { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
    @keyframes stcv-shimm { 0%{background-position:-400px 0} 100%{background-position:400px 0} }
    @keyframes stcv-toast { from{transform:translateX(110%);opacity:0} to{transform:translateX(0);opacity:1} }

    .stcv-up   { animation:stcv-up .42s ease both; }
    .stcv-skel {
      background:linear-gradient(90deg,#1A1A1B 25%,#222223 50%,#1A1A1B 75%);
      background-size:400px 100%; animation:stcv-shimm 1.4s infinite; border-radius:6px;
    }
    .stcv-card { transition:background .14s,transform .14s,border-color .14s; cursor:pointer; }
    .stcv-card:hover { background:#222223 !important; transform:translateX(3px); }
    .stcv-input:focus { border-color:#D4AF37 !important; outline:none; box-shadow:0 0 0 3px rgba(212,175,55,0.12); }
    .stcv-btn-gold:hover   { filter:brightness(1.08); transform:translateY(-1px); }
    .stcv-btn-gold         { transition:all .15s; }
    .stcv-btn-ghost:hover  { border-color:#D4AF37 !important; color:#D4AF37 !important; }
    .stcv-btn-ghost        { transition:all .15s; }
    .stcv-filter:hover     { color:#D4AF37 !important; }
    .stcv-filter           { transition:all .14s; }
    .stcv-stage-opt:hover  { background:#222223 !important; }
    .stcv-toast {
      position:fixed; bottom:24px; right:24px; z-index:9999;
      display:flex; align-items:center; gap:10px; padding:12px 18px;
      border-radius:10px; font-family:'DM Sans',sans-serif; font-size:13px; font-weight:600;
      box-shadow:0 8px 32px rgba(0,0,0,.5); animation:stcv-toast .3s ease both;
    }
    @media(max-width:640px){
      .stcv-two-col { grid-template-columns:1fr !important; }
      .stcv-filters { overflow-x:auto; scrollbar-width:none; flex-wrap:nowrap !important; }
      .stcv-detail-grid { grid-template-columns:1fr !important; }
    }
  `;
  document.head.appendChild(s);
}

// ── Icon ──────────────────────────────────────────────────────────────────────
const Ic = ({ d, s = 16, c = "currentColor", fill = "none" }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill={fill}
    stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
    style={{ flexShrink: 0 }} aria-hidden="true">
    <path d={d} />
  </svg>
);

const D = {
  ticket:  "M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z",
  plus:    "M12 5v14M5 12h14",
  back:    "M19 12H5M12 19l-7-7 7-7",
  check:   "M20 6L9 17l-5-5",
  alert:   "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01",
  clock:   "M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zM12 6v6l4 2",
  user:    "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
  link:    "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71",
  mic:     "M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8",
  send:    "M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z",
  chevD:   "M6 9l6 6 6-6",
  chevR:   "M9 18l6-6-6-6",
  inbox:   "M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z",
  tag:     "M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82zM7 7h.01",
  message: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
};

// ── Constants ─────────────────────────────────────────────────────────────────
const STAGES = [
  { key: "Open",        color: C.blue   },
  { key: "Assigned",    color: C.amber  },
  { key: "In Progress", color: C.gold   },
  { key: "Resolved",    color: C.green  },
  { key: "Closed",      color: C.textMuted },
];

const PRIORITIES = [
  { value: "low",      label: "Low",      color: C.green },
  { value: "medium",   label: "Medium",   color: C.amber },
  { value: "high",     label: "High",     color: C.red   },
  { value: "critical", label: "Critical", color: "#FF3B3B" },
];

const CATEGORIES = [
  "Call Issue", "Lead Data Error", "Payment Problem",
  "Access / Permission", "Recording Missing", "App Bug", "Other",
];

const MANAGER_ROLES = ["manager", "company_admin", "platform_owner", "support_agent"];

const VIEW = { LIST: "list", CREATE: "create", DETAIL: "detail" };

// ── Helpers ───────────────────────────────────────────────────────────────────
const stageConf  = (k) => STAGES.find((s) => s.key === k)    ?? STAGES[0];
const prioConf   = (v) => PRIORITIES.find((p) => p.value === v) ?? PRIORITIES[1];
const isOverdue  = (ts) => {
  if (!ts) return false;
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return (Date.now() - d) / 1000 > 86400;
};
const timeAgo = (ts) => {
  if (!ts) return "—";
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  const diff = Math.floor((Date.now() - d) / 1000);
  if (diff < 60)    return "just now";
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};
const fmtDateTime = (ts) => {
  if (!ts) return "—";
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
};

// ── Toast hook ────────────────────────────────────────────────────────────────
const useToast = () => {
  const [t, setT] = useState(null);
  const show = useCallback((msg, type = "success") => {
    setT({ msg, type });
    setTimeout(() => setT(null), 3200);
  }, []);
  return [t, show];
};

// ── Shared primitives ─────────────────────────────────────────────────────────
const Toast = ({ t }) => {
  if (!t) return null;
  const err = t.type === "error";
  return (
    <div className="stcv-toast" style={{
      background: err ? "#2A1215" : "#0F2A1E",
      border: `1px solid ${err ? C.red : C.green}44`,
      color: err ? C.red : C.green,
    }}>
      <Ic d={err ? D.alert : D.check} s={14} c={err ? C.red : C.green} />
      {t.msg}
    </div>
  );
};

const Label = ({ children, required }) => (
  <label style={{
    fontFamily: "DM Sans, sans-serif", fontSize: 11, fontWeight: 700,
    color: C.textSec, textTransform: "uppercase", letterSpacing: "0.7px",
    display: "block", marginBottom: 7,
  }}>{children}{required && <span style={{ color: C.red, marginLeft: 3 }}>*</span>}</label>
);

const FieldErr = ({ msg }) =>
  msg ? <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 11, color: C.red, marginTop: 5 }}>{msg}</p> : null;

const TextInput = ({ icon, value, onChange, placeholder, error, disabled, multiline, rows = 4 }) => {
  const base = {
    width: "100%", boxSizing: "border-box",
    padding: `10px 14px 10px ${icon ? "40px" : "14px"}`,
    background: disabled ? C.surfaceHov : C.bg,
    border: `1px solid ${error ? C.red + "88" : C.border}`,
    borderRadius: 8, color: C.text,
    fontFamily: "DM Sans, sans-serif", fontSize: 14,
    transition: "border-color .15s",
    resize: multiline ? "vertical" : undefined,
    minHeight: multiline ? `${rows * 24}px` : undefined,
  };
  const inner = multiline
    ? <textarea className="stcv-input" style={base} value={value} onChange={onChange} placeholder={placeholder} rows={rows} />
    : <input    className="stcv-input" style={base} value={value} onChange={onChange} placeholder={placeholder} disabled={disabled} />;
  return (
    <div style={{ position: "relative" }}>
      {icon && (
        <span style={{ position: "absolute", left: 13, top: 12, pointerEvents: "none" }}>
          <Ic d={icon} s={14} c={C.textMuted} />
        </span>
      )}
      {inner}
    </div>
  );
};

// Custom select (dropdown)
const Select = ({ value, options, onChange, colorFn }) => {
  const [open, setOpen] = useState(false);
  const cur = options.find((o) => (o.value ?? o) === value);
  const label = cur?.label ?? cur ?? value;
  const color = colorFn ? colorFn(value) : C.text;

  return (
    <>
      {open && <div style={{ position: "fixed", inset: 0, zIndex: 9 }} onClick={() => setOpen(false)} />}
      <div style={{ position: "relative" }}>
        <button onClick={() => setOpen((o) => !o)}
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
            width: "100%", padding: "10px 14px", borderRadius: 8,
            border: `1px solid ${C.border}`, background: C.bg,
            color, fontFamily: "DM Sans, sans-serif", fontSize: 14,
            cursor: "pointer", boxSizing: "border-box",
          }}>
          <span>{label}</span>
          <Ic d={D.chevD} s={14} c={C.textMuted} />
        </button>
        {open && (
          <div style={{
            position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
            background: "#1E1E1F", border: `1px solid ${C.border}`,
            borderRadius: 8, zIndex: 10, overflow: "hidden",
            boxShadow: "0 12px 40px rgba(0,0,0,.6)",
          }}>
            {options.map((opt) => {
              const v = opt.value ?? opt;
              const l = opt.label ?? opt;
              const c = colorFn ? colorFn(v) : C.text;
              return (
                <button key={v} className="stcv-stage-opt"
                  onClick={() => { onChange(v); setOpen(false); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    width: "100%", padding: "10px 14px",
                    background: "none", border: "none", cursor: "pointer",
                    fontFamily: "DM Sans, sans-serif", fontSize: 13,
                    color: c, textAlign: "left",
                  }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: c, flexShrink: 0 }} />
                  {l}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
};

// Priority dot
const PrioPill = ({ value }) => {
  const p = prioConf(value);
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "2px 9px", borderRadius: 99,
      background: `${p.color}18`, border: `1px solid ${p.color}33`,
      fontFamily: "DM Sans, sans-serif", fontSize: 11, fontWeight: 700, color: p.color,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: p.color }} />
      {p.label}
    </span>
  );
};

// Stage pill
const StagePill = ({ stage }) => {
  const cfg = stageConf(stage);
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "2px 9px", borderRadius: 99,
      background: `${cfg.color}18`, border: `1px solid ${cfg.color}33`,
      fontFamily: "DM Sans, sans-serif", fontSize: 11, fontWeight: 700, color: cfg.color,
    }}>{stage}</span>
  );
};

// Overdue badge
const OverdueBadge = () => (
  <span style={{
    display: "inline-flex", alignItems: "center", gap: 4,
    padding: "2px 8px", borderRadius: 99,
    background: C.redMuted, border: `1px solid ${C.red}33`,
    fontFamily: "DM Sans, sans-serif", fontSize: 10, fontWeight: 700, color: C.red,
  }}>
    <Ic d={D.clock} s={10} c={C.red} /> Overdue
  </span>
);

// ── Skeleton ──────────────────────────────────────────────────────────────────
const Skeleton = () => (
  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
    {[...Array(5)].map((_, i) => (
      <div key={i} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "16px 18px" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <div className="stcv-skel" style={{ height: 20, width: 70 }} />
          <div className="stcv-skel" style={{ height: 20, width: 55 }} />
        </div>
        <div className="stcv-skel" style={{ height: 14, width: "58%", marginBottom: 8 }} />
        <div className="stcv-skel" style={{ height: 12, width: "80%" }} />
      </div>
    ))}
  </div>
);

// ── Empty state ───────────────────────────────────────────────────────────────
const Empty = ({ onNew }) => (
  <div style={{
    display: "flex", flexDirection: "column", alignItems: "center",
    padding: "80px 24px", gap: 14, textAlign: "center",
  }}>
    <div style={{
      width: 70, height: 70, borderRadius: "50%",
      background: C.goldMuted, border: `1px solid ${C.gold}30`,
      display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 6,
    }}>
      <Ic d={D.inbox} s={30} c={C.gold} />
    </div>
    <p style={{ fontFamily: "Playfair Display, serif", fontWeight: 700, fontSize: 17, color: C.text, margin: 0 }}>
      No tickets yet
    </p>
    <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 13, color: C.textSec, maxWidth: 280, lineHeight: 1.6, margin: 0 }}>
      Raise a ticket when you encounter a call issue, data problem, or anything that needs attention.
    </p>
    <button className="stcv-btn-gold" onClick={onNew}
      style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        padding: "10px 22px", minHeight: 44, borderRadius: 8, border: "none",
        background: C.gold, color: "#000",
        fontFamily: "DM Sans, sans-serif", fontSize: 14, fontWeight: 700, cursor: "pointer",
      }}>
      <Ic d={D.plus} s={14} c="#000" /> Raise first ticket
    </button>
  </div>
);

// ── Ticket card ───────────────────────────────────────────────────────────────
const TicketCard = ({ ticket: t, onClick }) => {
  const overdue = isOverdue(t.createdAt) && !["Resolved", "Closed"].includes(t.stage);
  const prio    = prioConf(t.priority);
  return (
    <div className="stcv-card stcv-up"
      onClick={onClick}
      style={{
        background: C.surface, borderRadius: 12, padding: "14px 40px 14px 16px",
        border: `1px solid ${overdue ? C.red + "44" : C.border}`,
        position: "relative",
      }}>
      {/* Top row */}
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8, flexWrap: "wrap" }}>
        {overdue && <OverdueBadge />}
        <StagePill stage={t.stage ?? "Open"} />
        <PrioPill value={t.priority} />
        <span style={{ fontFamily: "DM Sans, sans-serif", fontSize: 11, color: C.textMuted, marginLeft: "auto" }}>
          {timeAgo(t.createdAt)}
        </span>
      </div>

      <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 15, fontWeight: 600, color: C.text, margin: "0 0 6px" }}>
        {t.subject}
      </p>
      {t.description && (
        <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 13, color: C.textSec, margin: "0 0 10px", lineHeight: 1.5 }}>
          {t.description.length > 100 ? t.description.slice(0, 100) + "…" : t.description}
        </p>
      )}

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <span style={{ fontFamily: "DM Sans, sans-serif", fontSize: 11, color: C.textMuted, display: "flex", alignItems: "center", gap: 4 }}>
          <Ic d={D.tag} s={11} c={C.textMuted} /> {t.category}
        </span>
        {t.linkedLeadName && (
          <span style={{ fontFamily: "DM Sans, sans-serif", fontSize: 11, color: C.textMuted, display: "flex", alignItems: "center", gap: 4 }}>
            <Ic d={D.link} s={11} c={C.textMuted} /> {t.linkedLeadName}
          </span>
        )}
        {t.linkedRecordingId && (
          <span style={{ fontFamily: "DM Sans, sans-serif", fontSize: 11, color: C.gold, display: "flex", alignItems: "center", gap: 4 }}>
            <Ic d={D.mic} s={11} c={C.gold} /> Recording linked
          </span>
        )}
        <span style={{ fontFamily: "DM Sans, sans-serif", fontSize: 11, color: C.textMuted, display: "flex", alignItems: "center", gap: 4 }}>
          <Ic d={D.user} s={11} c={C.textMuted} /> {t.raisedByName ?? "You"}
        </span>
      </div>

      <Ic d={D.chevR} s={16} c={C.textMuted} style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)" }} />
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// CREATE FORM
// ═══════════════════════════════════════════════════════════════════════════════
const CreateForm = ({ currentUser, userProfile, onBack, onSuccess, showToast }) => {
  const [form, setForm] = useState({
    subject: "", description: "", category: CATEGORIES[0],
    priority: "medium", linkedLeadId: "", linkedLeadName: "", linkedRecordingId: "",
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

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
      await addDoc(collection(db, COLLECTIONS.TICKETS), {
        subject:           form.subject.trim(),
        description:       form.description.trim(),
        category:          form.category,
        priority:          form.priority,
        stage:             "Open",
        raisedBy:          currentUser.uid,
        raisedByName:      userProfile?.displayName ?? currentUser.email,
        companyId:         userProfile?.companyId ?? "",
        linkedLeadId:      form.linkedLeadId.trim()      || null,
        linkedLeadName:    form.linkedLeadName.trim()     || null,
        linkedRecordingId: form.linkedRecordingId.trim()  || null,
        createdAt:         serverTimestamp(),
        updatedAt:         serverTimestamp(),
        timeline: [{
          action:    "Ticket created",
          by:        userProfile?.displayName ?? currentUser.email,
          timestamp: new Date().toISOString(),
        }],
      });
      showToast("Ticket raised successfully");
      onSuccess();
    } catch {
      showToast("Failed to create ticket", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="stcv-up">
      {/* Back header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <button className="stcv-btn-ghost" onClick={onBack}
          style={{ width: 38, height: 38, borderRadius: 9, border: `1px solid ${C.border}`, background: "transparent", color: C.textSec, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
          <Ic d={D.back} s={16} c={C.textSec} />
        </button>
        <div>
          <h1 style={{ fontFamily: "Playfair Display, serif", fontWeight: 700, fontSize: 20, color: C.text, margin: 0 }}>
            New Support Ticket
          </h1>
          <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 13, color: C.textSec, margin: "3px 0 0" }}>
            Describe the issue clearly — attach a recording if available
          </p>
        </div>
      </div>

      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Subject */}
        <div>
          <Label required>Subject</Label>
          <TextInput value={form.subject} onChange={set("subject")} placeholder="One-line summary of the issue" error={errors.subject} />
          <FieldErr msg={errors.subject} />
        </div>

        {/* Category + Priority */}
        <div className="stcv-two-col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <Label>Category</Label>
            <Select value={form.category} options={CATEGORIES}
              onChange={(v) => setForm((f) => ({ ...f, category: v }))} />
          </div>
          <div>
            <Label>Priority</Label>
            <Select
              value={form.priority}
              options={PRIORITIES.map((p) => ({ value: p.value, label: p.label }))}
              onChange={(v) => setForm((f) => ({ ...f, priority: v }))}
              colorFn={(v) => prioConf(v).color}
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <Label required>Description</Label>
          <TextInput value={form.description} onChange={set("description")}
            placeholder="Describe what happened, what you expected, and steps to reproduce…"
            error={errors.description} multiline rows={5} />
          <FieldErr msg={errors.description} />
        </div>

        {/* Divider */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1, height: 1, background: C.border }} />
          <span style={{ fontFamily: "DM Sans, sans-serif", fontSize: 11, fontWeight: 600, color: C.textMuted, whiteSpace: "nowrap" }}>
            Optional — Link to a lead or recording
          </span>
          <div style={{ flex: 1, height: 1, background: C.border }} />
        </div>

        {/* Optional links */}
        <div className="stcv-two-col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <Label>Lead ID</Label>
            <TextInput icon={D.link} value={form.linkedLeadId} onChange={set("linkedLeadId")} placeholder="Firestore lead doc ID" />
          </div>
          <div>
            <Label>Lead Name</Label>
            <TextInput icon={D.user} value={form.linkedLeadName} onChange={set("linkedLeadName")} placeholder="Customer name" />
          </div>
        </div>
        <div>
          <Label>Recording ID</Label>
          <TextInput icon={D.mic} value={form.linkedRecordingId} onChange={set("linkedRecordingId")} placeholder="Plivo recording ID or storage path" />
          <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 11, color: C.textMuted, marginTop: 5 }}>
            Linking a recording lets your manager click play directly from this ticket.
          </p>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: 4 }}>
          <button className="stcv-btn-ghost" onClick={onBack}
            style={{ padding: "10px 20px", minHeight: 44, borderRadius: 8, border: `1px solid ${C.border}`, background: "transparent", color: C.textSec, fontFamily: "DM Sans, sans-serif", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
            Cancel
          </button>
          <button className="stcv-btn-gold" onClick={submit} disabled={saving}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 22px", minHeight: 44, borderRadius: 8, border: "none", background: C.gold, color: "#000", fontFamily: "DM Sans, sans-serif", fontSize: 14, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1 }}>
            <Ic d={D.send} s={14} c="#000" />
            {saving ? "Submitting…" : "Submit Ticket"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// DETAIL VIEW
// ═══════════════════════════════════════════════════════════════════════════════
const DetailView = ({ ticketId, currentUser, userProfile, onBack, showToast }) => {
  const [ticket,   setTicket]   = useState(null);
  const [comment,  setComment]  = useState("");
  const [posting,  setPosting]  = useState(false);
  const [stgSaving,setStgSaving]= useState(false);

  const canChangeStage = MANAGER_ROLES.includes(userProfile?.role);
  const overdue = ticket && isOverdue(ticket.createdAt) && !["Resolved","Closed"].includes(ticket.stage);

  // Live ticket listener
  useEffect(() => {
    const unsub = onSnapshot(doc(db, COLLECTIONS.TICKETS, ticketId),
      (snap) => snap.exists() && setTicket({ id: snap.id, ...snap.data() }),
      () => {}
    );
    return () => unsub();
  }, [ticketId]);

  const changeStage = async (newStage) => {
    setStgSaving(true);
    const entry = { action: `Stage → ${newStage}`, by: userProfile?.displayName ?? currentUser.email, timestamp: new Date().toISOString() };
    try {
      await updateDoc(doc(db, COLLECTIONS.TICKETS, ticketId), {
        stage: newStage, updatedAt: serverTimestamp(),
        timeline: [...(ticket.timeline ?? []), entry],
      });
      showToast(`Stage changed to ${newStage}`);
    } catch {
      showToast("Failed to change stage", "error");
    } finally {
      setStgSaving(false);
    }
  };

  const postComment = async () => {
    if (!comment.trim()) return;
    setPosting(true);
    const entry = {
      action: comment.trim(), by: userProfile?.displayName ?? currentUser.email,
      timestamp: new Date().toISOString(), isComment: true,
    };
    try {
      await updateDoc(doc(db, COLLECTIONS.TICKETS, ticketId), {
        updatedAt: serverTimestamp(),
        timeline: [...(ticket.timeline ?? []), entry],
      });
      setComment("");
      showToast("Comment added");
    } catch {
      showToast("Failed to add comment", "error");
    } finally {
      setPosting(false);
    }
  };

  // Skeleton while loading
  if (!ticket) return (
    <div>
      <div style={{ height: 40, background: C.surface, borderRadius: 8, marginBottom: 24 }} className="stcv-skel" />
      <Skeleton />
    </div>
  );

  return (
    <div className="stcv-up">
      {/* Back + title */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 20 }}>
        <button className="stcv-btn-ghost" onClick={onBack}
          style={{ width: 38, height: 38, borderRadius: 9, border: `1px solid ${C.border}`, background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
          <Ic d={D.back} s={16} c={C.textSec} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontFamily: "Playfair Display, serif", fontWeight: 700, fontSize: 19, color: C.text, margin: 0, lineHeight: 1.3 }}>
            {ticket.subject}
          </h1>
          <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 12, color: C.textSec, margin: "5px 0 0" }}>
            Raised by {ticket.raisedByName} · {timeAgo(ticket.createdAt)}
          </p>
        </div>
      </div>

      {/* Overdue banner */}
      {overdue && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderRadius: 10, marginBottom: 16, background: C.redMuted, border: `1px solid ${C.red}44` }}>
          <Ic d={D.clock} s={16} c={C.red} />
          <span style={{ fontFamily: "DM Sans, sans-serif", fontSize: 13, fontWeight: 600, color: C.red }}>
            This ticket has been open for over 24 hours without resolution.
          </span>
        </div>
      )}

      {/* Meta pills */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
        <StagePill stage={ticket.stage} />
        <PrioPill value={ticket.priority} />
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 9px", borderRadius: 99, background: C.surface, border: `1px solid ${C.border}`, fontFamily: "DM Sans, sans-serif", fontSize: 11, color: C.textSec }}>
          <Ic d={D.tag} s={11} c={C.textMuted} /> {ticket.category}
        </span>
        {ticket.linkedLeadName && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 9px", borderRadius: 99, background: C.surface, border: `1px solid ${C.border}`, fontFamily: "DM Sans, sans-serif", fontSize: 11, color: C.textSec }}>
            <Ic d={D.link} s={11} c={C.textMuted} /> {ticket.linkedLeadName}
          </span>
        )}
        {ticket.linkedRecordingId && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 9px", borderRadius: 99, background: C.goldMuted, border: `1px solid ${C.gold}33`, fontFamily: "DM Sans, sans-serif", fontSize: 11, color: C.gold }}>
            <Ic d={D.mic} s={11} c={C.gold} /> Recording linked
          </span>
        )}
      </div>

      {/* Body grid */}
      <div className="stcv-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 16, alignItems: "start" }}>
        {/* Left: description + activity */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Description */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
            <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: ".7px", margin: "0 0 12px" }}>Description</p>
            <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 14, color: C.textSec, lineHeight: 1.72, margin: 0, whiteSpace: "pre-wrap" }}>
              {ticket.description}
            </p>
          </div>

          {/* Activity timeline */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
            <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: ".7px", margin: "0 0 14px" }}>
              Activity ({(ticket.timeline ?? []).length})
            </p>

            {/* Timeline entries */}
            <div style={{ display: "flex", flexDirection: "column", gap: 0, maxHeight: 300, overflowY: "auto", marginBottom: 16 }}>
              {(ticket.timeline ?? []).map((entry, i) => (
                <div key={i} style={{ display: "flex", gap: 12, padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: entry.isComment ? C.gold : C.border, flexShrink: 0, marginTop: 5 }} />
                  <div>
                    <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 13, color: entry.isComment ? C.text : C.textSec, margin: 0, lineHeight: 1.5 }}>
                      {entry.action}
                    </p>
                    <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 11, color: C.textMuted, margin: "3px 0 0" }}>
                      {entry.by} · {fmtDateTime(entry.timestamp)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Comment box */}
            <div style={{ display: "flex", gap: 8 }}>
              <input className="stcv-input"
                style={{ flex: 1, padding: "10px 14px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontFamily: "DM Sans, sans-serif", fontSize: 13 }}
                placeholder="Add a comment or update…"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && postComment()}
              />
              <button className="stcv-btn-gold"
                onClick={postComment}
                disabled={posting || !comment.trim()}
                style={{ padding: "10px 14px", borderRadius: 8, border: "none", background: C.gold, cursor: (posting || !comment.trim()) ? "not-allowed" : "pointer", opacity: (posting || !comment.trim()) ? 0.5 : 1, display: "flex", alignItems: "center" }}>
                <Ic d={D.send} s={15} c="#000" />
              </button>
            </div>
          </div>
        </div>

        {/* Right: stage change panel (managers only) */}
        {canChangeStage && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
            <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: ".7px", margin: "0 0 14px" }}>Change Stage</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {STAGES.map((stg) => {
                const isActive = ticket.stage === stg.key;
                return (
                  <button key={stg.key}
                    className="stcv-stage-opt"
                    disabled={isActive || stgSaving}
                    onClick={() => !isActive && changeStage(stg.key)}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 14px", borderRadius: 9, width: "100%", textAlign: "left",
                      border: `1px solid ${isActive ? stg.color + "55" : C.border}`,
                      background: isActive ? `${stg.color}18` : "transparent",
                      cursor: isActive ? "default" : stgSaving ? "not-allowed" : "pointer",
                      opacity: (!isActive && stgSaving) ? 0.5 : 1,
                    }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: stg.color, flexShrink: 0 }} />
                    <span style={{ fontFamily: "DM Sans, sans-serif", fontSize: 13, fontWeight: 600, color: isActive ? stg.color : C.textSec, flex: 1 }}>
                      {stg.key}
                    </span>
                    {isActive && <Ic d={D.check} s={13} c={stg.color} />}
                  </button>
                );
              })}
            </div>
            <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 11, color: C.textMuted, marginTop: 12, lineHeight: 1.6 }}>
              Every stage change is logged in the activity timeline automatically.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT EXPORT
// ═══════════════════════════════════════════════════════════════════════════════
export const SupportTicketCreateView = () => {
  const { currentUser, userProfile } = useAuth();
  const [view,       setView]        = useState(VIEW.LIST);
  const [selectedId, setSelectedId]  = useState(null);
  const [tickets,    setTickets]     = useState([]);
  const [loading,    setLoading]     = useState(true);
  const [filterStage,setFilterStage] = useState("all");
  const [toast, showToast]           = useToast();

  const isManager = MANAGER_ROLES.includes(userProfile?.role);

  // ── Real-time ticket list ─────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUser?.uid || !userProfile) return;
    const constraints = isManager
      ? [where("companyId", "==", userProfile.companyId ?? ""), orderBy("createdAt", "desc")]
      : [where("raisedBy",  "==", currentUser.uid),             orderBy("createdAt", "desc")];

    const q     = query(collection(db, COLLECTIONS.TICKETS), ...constraints);
    const unsub = onSnapshot(q,
      (snap) => { setTickets(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); setLoading(false); },
      ()      => setLoading(false)
    );
    return () => unsub();
  }, [currentUser?.uid, userProfile?.role, userProfile?.companyId]);

  const filtered = filterStage === "all"
    ? tickets
    : tickets.filter((t) => t.stage === filterStage);

  const openCount   = tickets.filter((t) => !["Resolved","Closed"].includes(t.stage)).length;
  const overdueCount= tickets.filter((t) => isOverdue(t.createdAt) && !["Resolved","Closed"].includes(t.stage)).length;

  if (view === VIEW.CREATE) return (
    <>
      <div style={{ minHeight: "100vh", background: C.bg, padding: "28px 20px 64px", maxWidth: 760, margin: "0 auto" }}>
        <CreateForm currentUser={currentUser} userProfile={userProfile}
          onBack={() => setView(VIEW.LIST)} onSuccess={() => setView(VIEW.LIST)} showToast={showToast} />
      </div>
      <Toast t={toast} />
    </>
  );

  if (view === VIEW.DETAIL && selectedId) return (
    <>
      <div style={{ minHeight: "100vh", background: C.bg, padding: "28px 20px 64px", maxWidth: 900, margin: "0 auto" }}>
        <DetailView ticketId={selectedId} currentUser={currentUser} userProfile={userProfile}
          onBack={() => { setSelectedId(null); setView(VIEW.LIST); }} showToast={showToast} />
      </div>
      <Toast t={toast} />
    </>
  );

  // ── LIST VIEW ─────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "DM Sans, sans-serif", padding: "28px 20px 64px", maxWidth: 820, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontFamily: "Playfair Display, serif", fontWeight: 700, fontSize: 22, color: C.text, margin: 0 }}>
            Support Tickets
          </h1>
          <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 13, color: C.textSec, margin: "4px 0 0" }}>
            {loading ? "Loading…" : `${openCount} open${overdueCount > 0 ? ` · ${overdueCount} overdue` : ""}`}
          </p>
        </div>
        <button className="stcv-btn-gold"
          onClick={() => setView(VIEW.CREATE)}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", minHeight: 44, borderRadius: 8, border: "none", background: C.gold, color: "#000", fontFamily: "DM Sans, sans-serif", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          <Ic d={D.plus} s={14} c="#000" /> New Ticket
        </button>
      </div>

      {/* Stage filter tabs */}
      <div className="stcv-filters" style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
        {["all", ...STAGES.map((s) => s.key)].map((key) => {
          const active = filterStage === key;
          const cfg    = key !== "all" ? stageConf(key) : null;
          const count  = key === "all" ? tickets.length : tickets.filter((t) => t.stage === key).length;
          return (
            <button key={key} className="stcv-filter"
              onClick={() => setFilterStage(key)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "6px 13px", minHeight: 34, borderRadius: 8,
                border: `1px solid ${active ? (cfg?.color ?? C.gold) + "55" : C.border}`,
                background: active ? `${cfg?.color ?? C.gold}14` : C.surface,
                color: active ? (cfg?.color ?? C.gold) : C.textSec,
                fontFamily: "DM Sans, sans-serif", fontSize: 12, fontWeight: 600,
                cursor: "pointer", whiteSpace: "nowrap",
              }}>
              {key === "all" ? "All" : key}
              {count > 0 && (
                <span style={{ minWidth: 18, height: 18, borderRadius: 9, padding: "0 4px", background: active ? `${cfg?.color ?? C.gold}22` : C.surfaceHov, color: active ? (cfg?.color ?? C.gold) : C.textMuted, fontFamily: "DM Sans, sans-serif", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* List */}
      {loading ? <Skeleton />
        : filtered.length === 0 ? <Empty onNew={() => setView(VIEW.CREATE)} />
        : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map((t, i) => (
              <div key={t.id} style={{ animationDelay: `${i * 0.04}s` }}>
                <TicketCard ticket={t} onClick={() => { setSelectedId(t.id); setView(VIEW.DETAIL); }} />
              </div>
            ))}
          </div>
        )}

      <Toast t={toast} />
    </div>
  );
};

export default SupportTicketCreateView;
