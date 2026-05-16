// TIRAS CRM V2 — AnnouncementsManager.jsx
// Platform Owner only — /platform/announcements
// Full CRUD for announcements shown across all companies
// Firestore collection: announcements
// Obsidian Gold theme | Playfair Display headings | Mobile responsive

import React, { useEffect, useState, useMemo } from "react";
import {
  collection, query, onSnapshot, doc,
  addDoc, updateDoc, deleteDoc,
  serverTimestamp, orderBy, Timestamp,
} from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../contexts/AuthContext";

// ─── Design Tokens ────────────────────────────────────────────────────────────
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
  amberMuted: "rgba(245,158,11,0.12)",
  purple:     "#8B5CF6",
  text:       "#F5F5F5",
  textSub:    "#9A9A9A",
  textMuted:  "#555555",
};
const F = {
  heading: "'Playfair Display', Georgia, serif",
  body:    "'DM Sans', system-ui, sans-serif",
};

// ─── Constants ────────────────────────────────────────────────────────────────
const TYPE_META = {
  offer:       { label: "Offer",       color: C.gold,   bg: C.goldMuted   },
  feature:     { label: "Feature",     color: C.green,  bg: C.greenMuted  },
  maintenance: { label: "Maintenance", color: C.amber,  bg: C.amberMuted  },
  urgent:      { label: "Urgent",      color: C.red,    bg: C.redMuted    },
};

const TARGET_OPTIONS = [
  { value: "all",        label: "All Companies"  },
  { value: "starter",    label: "Starter Only"   },
  { value: "basic",      label: "Basic Only"     },
  { value: "growth",     label: "Growth Only"    },
  { value: "enterprise", label: "Enterprise Only"},
];

const SHOW_ON_OPTIONS = [
  { value: "dashboard",     label: "Dashboard Banner" },
  { value: "notifications", label: "Notifications"    },
  { value: "pricing",       label: "Pricing Page"     },
];

const EMPTY_FORM = {
  title:           "",
  message:         "",
  type:            "feature",
  target:          "all",
  showOn:          ["dashboard"],
  discountPercent: "",
  validUntil:      "",
  isActive:        true,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtDate = (ts) => {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

const toDateInputValue = (ts) => {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toISOString().split("T")[0];
};

// ─── Sub-components ───────────────────────────────────────────────────────────
const Shimmer = ({ w = "100%", h = 14, r = 6 }) => (
  <div style={{
    width: w, height: h, borderRadius: r,
    background: `linear-gradient(90deg, ${C.surface} 25%, #252526 50%, ${C.surface} 75%)`,
    backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite",
  }} />
);

const Toast = ({ msg, type, onDone }) => {
  useEffect(() => { const t = setTimeout(onDone, 3200); return () => clearTimeout(t); }, [onDone]);
  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 9999,
      backgroundColor: type === "error" ? C.red : C.green,
      color: "#fff", padding: "12px 20px", borderRadius: 10,
      fontFamily: F.body, fontSize: 14, fontWeight: 600,
      boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
      animation: "slideIn 0.25s ease",
    }}>
      {msg}
    </div>
  );
};

const TypeBadge = ({ type }) => {
  const m = TYPE_META[type] || TYPE_META.feature;
  return (
    <span style={{
      fontFamily: F.body, fontSize: 11, fontWeight: 700,
      padding: "3px 10px", borderRadius: 20,
      backgroundColor: m.bg, color: m.color,
      border: `1px solid ${m.color}44`,
      textTransform: "uppercase", letterSpacing: "0.06em",
    }}>
      {m.label}
    </span>
  );
};

const Toggle = ({ checked, onChange, disabled }) => (
  <div
    onClick={() => !disabled && onChange(!checked)}
    style={{
      width: 40, height: 22, borderRadius: 11, flexShrink: 0,
      backgroundColor: checked ? C.green : C.border,
      position: "relative", cursor: disabled ? "not-allowed" : "pointer",
      transition: "background-color 0.2s ease",
      opacity: disabled ? 0.5 : 1,
    }}
  >
    <div style={{
      width: 16, height: 16, borderRadius: "50%", backgroundColor: "#fff",
      position: "absolute", top: 3,
      left: checked ? 21 : 3,
      transition: "left 0.2s ease",
      boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
    }} />
  </div>
);

// Delete confirmation modal
const DeleteModal = ({ announcement, onConfirm, onCancel, saving }) => (
  <>
    <div onClick={onCancel} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.7)", zIndex: 200 }} />
    <div style={{
      position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
      backgroundColor: C.surface, border: `1px solid ${C.border}`,
      borderRadius: 14, padding: 28, width: "min(400px,90vw)",
      zIndex: 201, fontFamily: F.body, textAlign: "center",
    }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>🗑️</div>
      <div style={{ fontFamily: F.heading, fontSize: 20, fontWeight: 700, color: C.text, marginBottom: 8 }}>
        Delete Announcement?
      </div>
      <div style={{ fontSize: 14, color: C.textSub, marginBottom: 24 }}>
        <strong style={{ color: C.text }}>{announcement?.title}</strong>
        <br />This cannot be undone.
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={onCancel} style={{
          flex: 1, padding: "10px 0", fontFamily: F.body, fontSize: 13, fontWeight: 600,
          border: `1px solid ${C.border}`, borderRadius: 8, backgroundColor: "transparent",
          color: C.text, cursor: "pointer",
        }}>Cancel</button>
        <button onClick={onConfirm} disabled={saving} style={{
          flex: 1, padding: "10px 0", fontFamily: F.body, fontSize: 13, fontWeight: 700,
          border: "none", borderRadius: 8, backgroundColor: C.red,
          color: "#fff", cursor: "pointer", opacity: saving ? 0.7 : 1,
        }}>
          {saving ? "Deleting…" : "Delete"}
        </button>
      </div>
    </div>
  </>
);

// Create / Edit form modal
const AnnouncementFormModal = ({ initial, currentUserUid, onClose, onSaved }) => {
  const [form,   setForm]   = useState(initial || EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState("");
  const isEdit = !!initial?.id;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const toggleShowOn = (val) => {
    setForm((f) => ({
      ...f,
      showOn: f.showOn.includes(val)
        ? f.showOn.filter((v) => v !== val)
        : [...f.showOn, val],
    }));
  };

  const validate = () => {
    if (!form.title.trim()) return "Title is required.";
    if (!form.message.trim()) return "Message is required.";
    if (form.showOn.length === 0) return "Select at least one Show On option.";
    if (form.type === "offer" && form.discountPercent && (Number(form.discountPercent) < 1 || Number(form.discountPercent) > 100))
      return "Discount must be between 1 and 100.";
    return null;
  };

  const save = async () => {
    const validErr = validate();
    if (validErr) { setErr(validErr); return; }
    setSaving(true);
    try {
      const payload = {
        title:           form.title.trim(),
        message:         form.message.trim(),
        type:            form.type,
        target:          form.target,
        showOn:          form.showOn,
        discountPercent: form.type === "offer" && form.discountPercent ? Number(form.discountPercent) : null,
        validUntil:      form.validUntil ? Timestamp.fromDate(new Date(form.validUntil)) : null,
        isActive:        form.isActive,
        updatedAt:       serverTimestamp(),
      };

      if (isEdit) {
        await updateDoc(doc(db, "announcements", initial.id), payload);
        onSaved("Announcement updated", "success");
      } else {
        await addDoc(collection(db, "announcements"), {
          ...payload,
          createdAt:  serverTimestamp(),
          createdBy:  currentUserUid || "platform_owner",
        });
        onSaved("Announcement created", "success");
      }
      onClose();
    } catch (e) {
      setErr("Save failed: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    width: "100%", backgroundColor: C.surfaceHov, border: `1px solid ${C.border}`,
    borderRadius: 8, padding: "10px 12px", color: C.text, fontFamily: F.body,
    fontSize: 13, outline: "none", boxSizing: "border-box",
  };
  const labelStyle = {
    fontFamily: F.body, fontSize: 11, fontWeight: 600, color: C.textSub,
    display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em",
  };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.7)", zIndex: 200 }} />
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
        backgroundColor: C.surface, border: `1px solid ${C.border}`,
        borderRadius: 14, padding: 28, width: "min(560px,95vw)",
        zIndex: 201, maxHeight: "92vh", overflowY: "auto",
        fontFamily: F.body,
      }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
          <div style={{ fontFamily: F.heading, fontSize: 20, fontWeight: 700, color: C.text }}>
            {isEdit ? "Edit Announcement" : "New Announcement"}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.textSub, cursor: "pointer", fontSize: 22, lineHeight: 1 }}>×</button>
        </div>

        {/* Title */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Title *</label>
          <input value={form.title} onChange={set("title")} placeholder="e.g. 30% off Growth plan this week" style={inputStyle} />
        </div>

        {/* Message */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Message *</label>
          <textarea
            value={form.message}
            onChange={set("message")}
            placeholder="Write the announcement message here…"
            rows={4}
            style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
          />
        </div>

        {/* Type + Target row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
          <div>
            <label style={labelStyle}>Type *</label>
            <select value={form.type} onChange={set("type")} style={inputStyle}>
              <option value="offer">Offer</option>
              <option value="feature">Feature</option>
              <option value="maintenance">Maintenance</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Target *</label>
            <select value={form.target} onChange={set("target")} style={inputStyle}>
              {TARGET_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Discount + Valid Until row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
          <div>
            <label style={labelStyle}>
              Discount % {form.type !== "offer" && <span style={{ color: C.textMuted, fontSize: 10 }}>(offer type only)</span>}
            </label>
            <input
              type="number"
              min={1} max={100}
              value={form.discountPercent}
              onChange={set("discountPercent")}
              disabled={form.type !== "offer"}
              placeholder={form.type === "offer" ? "e.g. 30" : "N/A"}
              style={{ ...inputStyle, opacity: form.type !== "offer" ? 0.4 : 1 }}
            />
          </div>
          <div>
            <label style={labelStyle}>Valid Until</label>
            <input
              type="date"
              value={form.validUntil}
              onChange={set("validUntil")}
              style={inputStyle}
            />
          </div>
        </div>

        {/* Show On checkboxes */}
        <div style={{ marginBottom: 18 }}>
          <label style={labelStyle}>Show On *</label>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {SHOW_ON_OPTIONS.map((opt) => (
              <label key={opt.value} style={{
                display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
                backgroundColor: form.showOn.includes(opt.value) ? C.goldMuted : C.surfaceHov,
                border: `1px solid ${form.showOn.includes(opt.value) ? C.gold : C.border}`,
                borderRadius: 8, padding: "8px 14px", transition: "all 0.15s",
              }}>
                <input
                  type="checkbox"
                  checked={form.showOn.includes(opt.value)}
                  onChange={() => toggleShowOn(opt.value)}
                  style={{ accentColor: C.gold, cursor: "pointer" }}
                />
                <span style={{ fontFamily: F.body, fontSize: 13, color: form.showOn.includes(opt.value) ? C.gold : C.textSub }}>
                  {opt.label}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Active toggle */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 16px", backgroundColor: C.surfaceHov, borderRadius: 8, marginBottom: 20,
        }}>
          <div>
            <div style={{ fontFamily: F.body, fontSize: 13, fontWeight: 600, color: C.text }}>Active</div>
            <div style={{ fontFamily: F.body, fontSize: 11, color: C.textSub, marginTop: 2 }}>
              Inactive announcements are hidden from all users
            </div>
          </div>
          <Toggle checked={form.isActive} onChange={(v) => setForm((f) => ({ ...f, isActive: v }))} />
        </div>

        {err && (
          <div style={{
            marginBottom: 16, padding: "10px 14px",
            backgroundColor: C.redMuted, border: `1px solid ${C.red}44`,
            borderRadius: 8, fontFamily: F.body, fontSize: 12, color: C.red,
          }}>
            {err}
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: "11px 0", fontFamily: F.body, fontSize: 13, fontWeight: 600,
            border: `1px solid ${C.border}`, borderRadius: 8, backgroundColor: "transparent",
            color: C.text, cursor: "pointer", minHeight: 44,
          }}>Cancel</button>
          <button onClick={save} disabled={saving} style={{
            flex: 2, padding: "11px 0", fontFamily: F.body, fontSize: 13, fontWeight: 700,
            border: "none", borderRadius: 8, backgroundColor: C.gold,
            color: "#000", cursor: "pointer", opacity: saving ? 0.7 : 1, minHeight: 44,
          }}>
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Announcement"}
          </button>
        </div>
      </div>
    </>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
export const AnnouncementsManager = () => {
  const { currentUser, isPlatformOwner } = useAuth();

  const [announcements, setAnnouncements] = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [toast,         setToast]         = useState(null);
  const [showForm,      setShowForm]      = useState(false);
  const [editTarget,    setEditTarget]    = useState(null);
  const [deleteTarget,  setDeleteTarget]  = useState(null);
  const [deleteSaving,  setDeleteSaving]  = useState(false);
  const [filterType,    setFilterType]    = useState("all");
  const [filterActive,  setFilterActive]  = useState("all"); // all | active | inactive
  const [togglingId,    setTogglingId]    = useState(null);

  // ── Real-time listener ────────────────────────────────────────────────────
  useEffect(() => {
    const u = onSnapshot(
      query(collection(db, "announcements"), orderBy("createdAt", "desc")),
      (snap) => {
        setAnnouncements(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => { console.error(err); setLoading(false); }
    );
    return () => u();
  }, []);

  // ── Toggle active ─────────────────────────────────────────────────────────
  const toggleActive = async (ann) => {
    setTogglingId(ann.id);
    try {
      await updateDoc(doc(db, "announcements", ann.id), {
        isActive:  !ann.isActive,
        updatedAt: serverTimestamp(),
      });
      setToast({ msg: `Announcement ${!ann.isActive ? "activated" : "deactivated"}`, type: "success" });
    } catch (e) {
      setToast({ msg: "Failed: " + e.message, type: "error" });
    } finally {
      setTogglingId(null);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteSaving(true);
    try {
      await deleteDoc(doc(db, "announcements", deleteTarget.id));
      setToast({ msg: "Announcement deleted", type: "success" });
      setDeleteTarget(null);
    } catch (e) {
      setToast({ msg: "Delete failed: " + e.message, type: "error" });
    } finally {
      setDeleteSaving(false);
    }
  };

  // ── Derived list ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let r = [...announcements];
    if (filterType !== "all")    r = r.filter((a) => a.type === filterType);
    if (filterActive === "active")   r = r.filter((a) => a.isActive);
    if (filterActive === "inactive") r = r.filter((a) => !a.isActive);
    return r;
  }, [announcements, filterType, filterActive]);

  const activeCount   = announcements.filter((a) => a.isActive).length;
  const inactiveCount = announcements.length - activeCount;

  // ── Access guard ──────────────────────────────────────────────────────────
  if (!isPlatformOwner) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F.body }}>
        <div style={{ textAlign: "center", color: C.textSub }}>
          <div style={{ fontSize: 40 }}>🔒</div>
          <div style={{ marginTop: 12 }}>Platform Owner access required.</div>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes slideIn { from{transform:translateX(60px);opacity:0} to{transform:translateX(0);opacity:1} }
        @keyframes fadeIn  { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: ${C.bg}; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 4px; }
        .ann-row:hover { background-color: ${C.surfaceHov} !important; }
        @media (max-width: 640px) {
          .ann-grid { grid-template-columns: 1fr !important; }
          .header-row { flex-direction: column !important; align-items: flex-start !important; }
        }
      `}</style>

      <div style={{ minHeight: "100vh", backgroundColor: C.bg, padding: "24px 20px", fontFamily: F.body, color: C.text, animation: "fadeIn 0.3s ease" }}>

        {/* ── Page Header ── */}
        <div className="header-row" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontFamily: F.body, fontSize: 11, fontWeight: 600, color: C.gold, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 4 }}>
              Platform Owner
            </div>
            <h1 style={{ fontFamily: F.heading, fontSize: 26, fontWeight: 700, color: C.text, margin: 0 }}>
              Announcements
            </h1>
            <div style={{ fontFamily: F.body, fontSize: 13, color: C.textSub, marginTop: 4 }}>
              {loading ? "Loading…" : `${activeCount} active · ${inactiveCount} inactive · `}
              <span style={{ color: C.green }}>● Live</span>
            </div>
          </div>
          <button
            onClick={() => { setEditTarget(null); setShowForm(true); }}
            style={{
              fontFamily: F.body, fontSize: 13, fontWeight: 700,
              backgroundColor: C.gold, color: "#000",
              border: "none", borderRadius: 8, padding: "10px 20px",
              cursor: "pointer", minHeight: 44, whiteSpace: "nowrap",
            }}
          >
            + New Announcement
          </button>
        </div>

        {/* ── Summary Cards ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 20 }}>
          {[
            { label: "Total",    value: announcements.length, color: C.gold  },
            { label: "Active",   value: activeCount,          color: C.green },
            { label: "Inactive", value: inactiveCount,        color: C.textSub },
            ...Object.entries(TYPE_META).map(([type, m]) => ({
              label: m.label,
              value: announcements.filter((a) => a.type === type).length,
              color: m.color,
            })),
          ].map(({ label, value, color }) => (
            <div key={label} style={{
              backgroundColor: C.surface, border: `1px solid ${C.border}`,
              borderRadius: 10, padding: "14px 16px", position: "relative", overflow: "hidden",
            }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, backgroundColor: color, borderRadius: "10px 10px 0 0" }} />
              <div style={{ fontFamily: F.heading, fontSize: 24, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
              <div style={{ fontFamily: F.body, fontSize: 12, color: C.textSub, marginTop: 4 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* ── Filters ── */}
        <div style={{
          backgroundColor: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 10, padding: "12px 16px", marginBottom: 16,
          display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center",
        }}>
          {/* Active filter */}
          {[["all", "All"], ["active", "Active"], ["inactive", "Inactive"]].map(([val, label]) => (
            <button key={val} onClick={() => setFilterActive(val)} style={{
              fontFamily: F.body, fontSize: 12, fontWeight: 600,
              padding: "5px 14px", borderRadius: 20, minHeight: 32, cursor: "pointer",
              border: `1px solid ${filterActive === val ? C.gold : C.border}`,
              backgroundColor: filterActive === val ? C.goldMuted : "transparent",
              color: filterActive === val ? C.gold : C.textSub,
            }}>{label}</button>
          ))}

          <div style={{ width: 1, height: 20, backgroundColor: C.border, margin: "0 4px" }} />

          {/* Type filter */}
          {[["all", "All Types"], ...Object.entries(TYPE_META).map(([v, m]) => [v, m.label])].map(([val, label]) => (
            <button key={val} onClick={() => setFilterType(val)} style={{
              fontFamily: F.body, fontSize: 12, fontWeight: 600,
              padding: "5px 14px", borderRadius: 20, minHeight: 32, cursor: "pointer",
              border: `1px solid ${filterType === val ? C.gold : C.border}`,
              backgroundColor: filterType === val ? C.goldMuted : "transparent",
              color: filterType === val ? C.gold : C.textSub,
            }}>{label}</button>
          ))}
        </div>

        {/* ── Announcements List ── */}
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                  <Shimmer w="45%" h={15} />
                  <Shimmer w={60} h={22} r={20} />
                </div>
                <Shimmer h={12} />
                <div style={{ marginTop: 8 }}><Shimmer h={11} w="60%" /></div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{
            backgroundColor: C.surface, border: `1px solid ${C.border}`,
            borderRadius: 12, textAlign: "center", padding: "52px 0", color: C.textSub,
          }}>
            <div style={{ fontSize: 40, marginBottom: 14 }}>📢</div>
            <div style={{ fontFamily: F.heading, fontSize: 17, color: C.textSub }}>
              {announcements.length === 0 ? "No announcements yet" : "No announcements match your filters"}
            </div>
            {announcements.length === 0 && (
              <button
                onClick={() => { setEditTarget(null); setShowForm(true); }}
                style={{
                  marginTop: 16, fontFamily: F.body, fontSize: 13, fontWeight: 700,
                  backgroundColor: C.gold, color: "#000", border: "none",
                  borderRadius: 8, padding: "10px 20px", cursor: "pointer", minHeight: 44,
                }}
              >
                Create First Announcement
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map((ann) => (
              <div
                key={ann.id}
                className="ann-row"
                style={{
                  backgroundColor: C.surface,
                  border: `1px solid ${ann.isActive ? C.green + "44" : C.border}`,
                  borderLeft: `4px solid ${ann.isActive ? C.green : C.border}`,
                  borderRadius: 12, padding: "16px 20px",
                  transition: "background-color 0.12s",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>

                  {/* Main content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Title row */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
                      <TypeBadge type={ann.type} />
                      {ann.isActive ? (
                        <span style={{
                          fontFamily: F.body, fontSize: 11, fontWeight: 600,
                          padding: "2px 10px", borderRadius: 20,
                          backgroundColor: C.greenMuted, color: C.green,
                        }}>● Active</span>
                      ) : (
                        <span style={{
                          fontFamily: F.body, fontSize: 11, fontWeight: 600,
                          padding: "2px 10px", borderRadius: 20,
                          backgroundColor: C.surfaceHov, color: C.textMuted,
                        }}>○ Inactive</span>
                      )}
                      {ann.discountPercent && (
                        <span style={{
                          fontFamily: F.body, fontSize: 11, fontWeight: 700,
                          padding: "2px 10px", borderRadius: 20,
                          backgroundColor: C.goldMuted, color: C.gold,
                        }}>
                          {ann.discountPercent}% OFF
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <div style={{
                      fontFamily: F.heading, fontSize: 16, fontWeight: 700,
                      color: C.text, marginBottom: 5,
                    }}>
                      {ann.title}
                    </div>

                    {/* Message */}
                    <div style={{
                      fontFamily: F.body, fontSize: 13, color: C.textSub,
                      lineHeight: 1.6, marginBottom: 10,
                    }}>
                      {ann.message}
                    </div>

                    {/* Meta row */}
                    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                      <span style={{ fontFamily: F.body, fontSize: 11, color: C.textMuted }}>
                        🎯 {TARGET_OPTIONS.find((o) => o.value === ann.target)?.label || ann.target}
                      </span>
                      {ann.showOn?.length > 0 && (
                        <span style={{ fontFamily: F.body, fontSize: 11, color: C.textMuted }}>
                          👁 {ann.showOn.join(", ")}
                        </span>
                      )}
                      {ann.validUntil && (
                        <span style={{ fontFamily: F.body, fontSize: 11, color: C.textMuted }}>
                          📅 Until {fmtDate(ann.validUntil)}
                        </span>
                      )}
                      <span style={{ fontFamily: F.body, fontSize: 11, color: C.textMuted }}>
                        🕒 {fmtDate(ann.createdAt)}
                      </span>
                    </div>
                  </div>

                  {/* Actions column */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end", flexShrink: 0 }}>
                    {/* Active toggle */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontFamily: F.body, fontSize: 11, color: C.textSub }}>
                        {ann.isActive ? "On" : "Off"}
                      </span>
                      <Toggle
                        checked={ann.isActive}
                        onChange={() => toggleActive(ann)}
                        disabled={togglingId === ann.id}
                      />
                    </div>

                    {/* Edit + Delete */}
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={() => { setEditTarget(ann); setShowForm(true); }}
                        style={{
                          fontFamily: F.body, fontSize: 12, fontWeight: 600,
                          padding: "6px 12px", minHeight: 32,
                          border: `1px solid ${C.border}`, borderRadius: 6,
                          backgroundColor: "transparent", color: C.textSub,
                          cursor: "pointer",
                        }}
                      >
                        ✏ Edit
                      </button>
                      <button
                        onClick={() => setDeleteTarget(ann)}
                        style={{
                          fontFamily: F.body, fontSize: 12, fontWeight: 600,
                          padding: "6px 12px", minHeight: 32,
                          border: `1px solid ${C.red}44`, borderRadius: 6,
                          backgroundColor: C.redMuted, color: C.red,
                          cursor: "pointer",
                        }}
                      >
                        🗑 Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {showForm && (
        <AnnouncementFormModal
          initial={editTarget}
          currentUserUid={currentUser?.uid}
          onClose={() => { setShowForm(false); setEditTarget(null); }}
          onSaved={(msg, type) => setToast({ msg, type })}
        />
      )}

      {deleteTarget && (
        <DeleteModal
          announcement={deleteTarget}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          saving={deleteSaving}
        />
      )}

      {toast && (
        <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />
      )}
    </>
  );
};

export default AnnouncementsManager;
