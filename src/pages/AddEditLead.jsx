// ─────────────────────────────────────────────────────────────────────────────
// TIRAS CRM — AddEditLead
// File: src/pages/AddEditLead.jsx
//
// HOW TO USE:
//   In src/pages/index.js replace:
//     export const AddEditLead = () => <Placeholder name="Add / Edit Lead" />;
//   with the full contents of this file.
//
// ROUTES:
//   /agent/add-lead            — create new lead
//   /agent/edit-lead/:leadId   — edit existing lead (pre-fills form)
//
// FIRESTORE:
//   On ADD:  addDoc to COLLECTIONS.LEADS
//   On EDIT: updateDoc to COLLECTIONS.LEADS/{leadId}
//   Duplicate check: query leads where phone == input AND companyId == companyId
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
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

const STYLE_ID = "tiras-addlead-styles";
const injectStyles = () => {
  if (document.getElementById(STYLE_ID)) return;
  const tag = document.createElement("style");
  tag.id = STYLE_ID;
  tag.textContent = `
    @keyframes tiras-fade-up  { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
    @keyframes tiras-spin     { to{transform:rotate(360deg)} }
    @keyframes tiras-shake    { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-5px)} 60%{transform:translateX(5px)} }
  `;
  document.head.appendChild(tag);
};

// ─── Constants ────────────────────────────────────────────────────────────────

const SOURCES = [
  "IndiaMART", "Website", "Cold Call", "Referral",
  "Walk-in", "Social Media", "WhatsApp", "Trade Show",
];

const STAGES = [
  "New", "Contacted", "Interested",
  "Follow-up", "Negotiation", "Closed Won", "Closed Lost",
];

const EMPTY_FORM = {
  name:       "",
  phone:      "",
  email:      "",
  company:    "",
  source:     "",
  stage:      "New",
  dealValue:  "",
  notes:      "",
  // custom fields array handled separately
};

// ─── Style objects ────────────────────────────────────────────────────────────

const S = {
  page: {
    minHeight: "100%",
    backgroundColor: COLORS.background,
    fontFamily: FONTS.family,
    padding: SPACING["2xl"],
  },

  // Back + title row
  topRow: {
    display: "flex",
    alignItems: "center",
    gap: SPACING.md,
    marginBottom: SPACING["2xl"],
    animation: "tiras-fade-up 0.25s ease both",
  },
  backBtn: {
    background: "none",
    border: "none",
    color: COLORS.textMuted,
    cursor: "pointer",
    fontFamily: FONTS.family,
    fontSize: FONTS.size.sm,
    display: "flex",
    alignItems: "center",
    gap: "5px",
    padding: 0,
    transition: TRANSITIONS.fast,
  },
  pageTitleWrap: { display: "flex", flexDirection: "column", gap: "2px" },
  pageTitle: {
    color: COLORS.textPrimary,
    fontSize: FONTS.size["3xl"],
    fontWeight: FONTS.weight.bold,
    letterSpacing: "-0.01em",
  },
  pageSubtitle: {
    color: COLORS.textSecondary,
    fontSize: FONTS.size.base,
  },

  // Two-column form layout
  formLayout: {
    display: "grid",
    gridTemplateColumns: "1fr 360px",
    gap: SPACING.xl,
    alignItems: "flex-start",
    animation: "tiras-fade-up 0.3s ease 50ms both",
  },

  // Card base
  card: {
    backgroundColor: COLORS.surface,
    border: `1px solid ${COLORS.border}`,
    borderRadius: RADIUS.lg,
    boxShadow: SHADOWS.sm,
    overflow: "hidden",
  },

  cardHeader: {
    padding: `${SPACING.base} ${SPACING.xl}`,
    borderBottom: `1px solid ${COLORS.border}`,
    display: "flex",
    alignItems: "center",
    gap: SPACING.sm,
  },

  cardTitle: {
    color: COLORS.textPrimary,
    fontSize: FONTS.size.md,
    fontWeight: FONTS.weight.semibold,
  },

  cardBody: {
    padding: SPACING.xl,
  },

  // Field group
  fieldGroup: {
    marginBottom: SPACING.base,
  },

  fieldRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: SPACING.base,
    marginBottom: SPACING.base,
  },

  label: {
    display: "block",
    color: COLORS.textSecondary,
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.medium,
    marginBottom: SPACING.xs,
    letterSpacing: "0.02em",
  },

  required: {
    color: COLORS.danger,
    marginLeft: "3px",
  },

  input: {
    backgroundColor: COLORS.inputBg,
    border: `1px solid ${COLORS.inputBorder}`,
    borderRadius: RADIUS.md,
    color: COLORS.textPrimary,
    fontFamily: FONTS.family,
    fontSize: FONTS.size.base,
    padding: `${SPACING.sm} ${SPACING.md}`,
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
    transition: TRANSITIONS.fast,
  },

  inputError: {
    borderColor: COLORS.inputError,
    boxShadow: `0 0 0 3px ${COLORS.danger}18`,
  },

  inputFocused: {
    borderColor: COLORS.inputFocus,
    boxShadow: `0 0 0 3px ${COLORS.primary}22`,
  },

  select: {
    backgroundColor: COLORS.inputBg,
    border: `1px solid ${COLORS.inputBorder}`,
    borderRadius: RADIUS.md,
    color: COLORS.textPrimary,
    fontFamily: FONTS.family,
    fontSize: FONTS.size.base,
    padding: `${SPACING.sm} ${SPACING.md}`,
    outline: "none",
    width: "100%",
    cursor: "pointer",
    transition: TRANSITIONS.fast,
  },

  textarea: {
    backgroundColor: COLORS.inputBg,
    border: `1px solid ${COLORS.inputBorder}`,
    borderRadius: RADIUS.md,
    color: COLORS.textPrimary,
    fontFamily: FONTS.family,
    fontSize: FONTS.size.base,
    padding: `${SPACING.sm} ${SPACING.md}`,
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
    resize: "vertical",
    minHeight: "80px",
    transition: TRANSITIONS.fast,
  },

  // Inline field error
  fieldError: {
    color: COLORS.danger,
    fontSize: FONTS.size.xs,
    marginTop: SPACING.xs,
    display: "flex",
    alignItems: "center",
    gap: "4px",
  },

  // Duplicate warning banner
  duplicateWarn: {
    display: "flex",
    alignItems: "flex-start",
    gap: SPACING.sm,
    backgroundColor: `${COLORS.warning}10`,
    border: `1px solid ${COLORS.warning}35`,
    borderRadius: RADIUS.md,
    padding: `${SPACING.sm} ${SPACING.md}`,
    marginBottom: SPACING.base,
    animation: "tiras-shake 0.4s ease",
  },
  duplicateText: {
    color: COLORS.warning,
    fontSize: FONTS.size.sm,
    lineHeight: FONTS.lineHeight.normal,
  },

  // Right column — summary + actions
  rightCol: {
    display: "flex",
    flexDirection: "column",
    gap: SPACING.base,
    position: "sticky",
    top: SPACING.xl,
  },

  summaryCard: {
    backgroundColor: COLORS.surface,
    border: `1px solid ${COLORS.border}`,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    boxShadow: SHADOWS.sm,
  },

  summaryTitle: {
    color: COLORS.textMuted,
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.semibold,
    textTransform: "uppercase",
    letterSpacing: "0.07em",
    marginBottom: SPACING.base,
  },

  summaryName: {
    color: COLORS.textPrimary,
    fontSize: FONTS.size.xl,
    fontWeight: FONTS.weight.bold,
    marginBottom: SPACING.xs,
    minHeight: "28px",
  },

  summaryPhone: {
    color: COLORS.textSecondary,
    fontSize: FONTS.size.base,
    fontFamily: FONTS.mono,
    letterSpacing: "0.06em",
    marginBottom: SPACING.lg,
    minHeight: "20px",
  },

  summaryRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.sm,
  },

  summaryKey: {
    color: COLORS.textMuted,
    fontSize: FONTS.size.sm,
  },

  summaryVal: {
    color: COLORS.textSecondary,
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.medium,
    textAlign: "right",
    maxWidth: "160px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  stageBadge: {
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.semibold,
    padding: `2px ${SPACING.sm}`,
    borderRadius: RADIUS.full,
  },

  dealValueDisplay: {
    color: COLORS.accent,
    fontSize: FONTS.size.lg,
    fontWeight: FONTS.weight.bold,
  },

  // Action buttons
  savePrimaryBtn: {
    width: "100%",
    backgroundColor: COLORS.primary,
    color: "#121212",
    border: "none",
    borderRadius: RADIUS.md,
    fontFamily: FONTS.family,
    fontSize: FONTS.size.base,
    fontWeight: FONTS.weight.semibold,
    padding: `${SPACING.md} ${SPACING.xl}`,
    cursor: "pointer",
    transition: TRANSITIONS.base,
    boxShadow: SHADOWS.primary,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },

  cancelBtn: {
    width: "100%",
    backgroundColor: "transparent",
    color: COLORS.textSecondary,
    border: `1px solid ${COLORS.border}`,
    borderRadius: RADIUS.md,
    fontFamily: FONTS.family,
    fontSize: FONTS.size.base,
    fontWeight: FONTS.weight.medium,
    padding: `${SPACING.sm} ${SPACING.xl}`,
    cursor: "pointer",
    transition: TRANSITIONS.base,
  },

  spinner: {
    width: "15px",
    height: "15px",
    borderRadius: "50%",
    border: "2px solid #12121230",
    borderTopColor: "#121212",
    animation: "tiras-spin 0.7s linear infinite",
    flexShrink: 0,
  },

  // Required fields note
  requiredNote: {
    color: COLORS.textMuted,
    fontSize: FONTS.size.xs,
    marginTop: SPACING.sm,
    textAlign: "center",
  },
};

// ─── Stage colour helper ──────────────────────────────────────────────────────

const STAGE_COLORS = {
  "New":         { text: COLORS.textMuted,  bg: `${COLORS.textMuted}18`  },
  "Contacted":   { text: COLORS.info,       bg: `${COLORS.info}18`       },
  "Interested":  { text: COLORS.accent,     bg: `${COLORS.accent}18`     },
  "Follow-up":   { text: COLORS.warning,    bg: `${COLORS.warning}18`    },
  "Negotiation": { text: COLORS.primary,    bg: `${COLORS.primary}18`    },
  "Closed Won":  { text: COLORS.success,    bg: `${COLORS.success}18`    },
  "Closed Lost": { text: COLORS.danger,     bg: `${COLORS.danger}18`     },
};

// ─── SVG icons ────────────────────────────────────────────────────────────────

const BackIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
  </svg>
);
const UserIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={COLORS.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);
const PhoneIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={COLORS.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.39 2 2 0 0 1 3.6 1.21h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.85a16 16 0 0 0 6.29 6.29l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
  </svg>
);
const PipelineIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={COLORS.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>
);
const WarnIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

// ─── Input with focus/error state management ──────────────────────────────────

const Field = ({ label, required, error, hint, children }) => (
  <div style={S.fieldGroup}>
    <label style={S.label}>
      {label}
      {required && <span style={S.required}>*</span>}
    </label>
    {children}
    {error && (
      <div style={S.fieldError}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        {error}
      </div>
    )}
    {hint && !error && (
      <div style={{ color: COLORS.textMuted, fontSize: FONTS.size.xs, marginTop: SPACING.xs }}>{hint}</div>
    )}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// AddEditLead Component
// ─────────────────────────────────────────────────────────────────────────────

export const AddEditLead = () => {
  const navigate  = useNavigate();
  const { leadId } = useParams();        // undefined when adding
  const isEdit     = Boolean(leadId);
  const { currentUser, companyId } = useAuth();

  // ─── Form state ─────────────────────────────────────────────────────────────
  const [form,    setForm]    = useState(EMPTY_FORM);
  const [errors,  setErrors]  = useState({});
  const [focused, setFocused] = useState(null);

  // ─── Async state ────────────────────────────────────────────────────────────
  const [loading,        setLoading]        = useState(isEdit);  // loading existing data
  const [saving,         setSaving]         = useState(false);
  const [duplicateWarn,  setDuplicateWarn]  = useState(null);    // { name, id } of existing lead
  const [checkingDupe,   setCheckingDupe]   = useState(false);
  const [saveHovered,    setSaveHovered]    = useState(false);
  const [cancelHovered,  setCancelHovered]  = useState(false);

  // ─── Load existing lead for edit ────────────────────────────────────────────
  useEffect(() => {
    injectStyles();
    if (!isEdit) return;

    const load = async () => {
      try {
        const { getDoc, doc: fsDoc } = await import("firebase/firestore");
        const snap = await getDoc(fsDoc(db, COLLECTIONS.LEADS, leadId));
        if (snap.exists()) {
          const d = snap.data();
          setForm({
            name:      d.name      ?? "",
            phone:     d.phone     ?? "",
            email:     d.email     ?? "",
            company:   d.company   ?? "",
            source:    d.source    ?? "",
            stage:     d.stage     ?? "New",
            dealValue: d.dealValue != null ? String(d.dealValue) : "",
            notes:     d.notes     ?? "",
          });
        }
      } catch (err) {
        console.error("TIRAS: Could not load lead for edit", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [leadId, isEdit]);

  // ─── Field change ─────────────────────────────────────────────────────────
  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    // Clear error on change
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: null }));
    // Clear duplicate warning if phone changed
    if (field === "phone") setDuplicateWarn(null);
  };

  // ─── Duplicate phone check ─────────────────────────────────────────────────
  const checkDuplicate = async (phone) => {
    if (!phone || phone.length < 10) return;
    setCheckingDupe(true);
    try {
      const q = query(
        collection(db, COLLECTIONS.LEADS),
        where("phone",     "==", phone),
        where("companyId", "==", companyId)
      );
      const snap = await getDocs(q);
      const existing = snap.docs.find((d) => d.id !== leadId); // exclude self in edit mode
      if (existing) {
        setDuplicateWarn({ name: existing.data().name, id: existing.id });
      } else {
        setDuplicateWarn(null);
      }
    } finally {
      setCheckingDupe(false);
    }
  };

  // ─── Validation ────────────────────────────────────────────────────────────
  const validate = () => {
    const errs = {};
    if (!form.name.trim())                    errs.name  = "Name is required";
    if (!form.phone.trim())                   errs.phone = "Phone number is required";
    else if (!/^\d{10}$/.test(form.phone.replace(/\s/g, "")))
                                              errs.phone = "Enter a valid 10-digit number";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
                                              errs.email = "Enter a valid email address";
    if (form.dealValue && isNaN(Number(form.dealValue)))
                                              errs.dealValue = "Enter a valid number";
    return errs;
  };

  // ─── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      // Scroll to first error
      document.querySelector("[data-field-error]")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name:       form.name.trim(),
        phone:      form.phone.replace(/\s/g, ""),
        email:      form.email.trim()   || null,
        company:    form.company.trim() || null,
        source:     form.source         || null,
        stage:      form.stage,
        dealValue:  form.dealValue ? Number(form.dealValue) : null,
        notes:      form.notes.trim()   || null,
        companyId,
        updatedAt:  serverTimestamp(),
        updatedBy:  currentUser.uid,
      };

      if (isEdit) {
        await updateDoc(doc(db, COLLECTIONS.LEADS, leadId), payload);
        navigate(`/agent/lead/${leadId}`);
      } else {
        payload.assignedTo  = currentUser.uid;
        payload.createdAt   = serverTimestamp();
        payload.createdBy   = currentUser.uid;
        payload.leadScore   = null;
        payload.lastCallAt  = null;
        const ref = await addDoc(collection(db, COLLECTIONS.LEADS), payload);
        navigate(`/agent/lead/${ref.id}`);
      }
    } catch (err) {
      console.error("TIRAS: Save lead failed", err);
      setErrors({ _form: "Could not save lead. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  // ─── Derived ───────────────────────────────────────────────────────────────
  const stageConf = STAGE_COLORS[form.stage] ?? STAGE_COLORS["New"];

  const inputStyle  = (field) => ({
    ...S.input,
    ...(focused === field               ? S.inputFocused : {}),
    ...(errors[field]                   ? S.inputError   : {}),
  });

  const selectStyle = (field) => ({
    ...S.select,
    ...(focused === field               ? S.inputFocused : {}),
  });

  const textareaStyle = (field) => ({
    ...S.textarea,
    ...(focused === field               ? S.inputFocused : {}),
  });

  if (loading) {
    return (
      <div style={{ ...S.page, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <div style={{ textAlign: "center", color: COLORS.textMuted }}>
          <div style={{ ...S.spinner, width: "24px", height: "24px", border: `3px solid ${COLORS.border}`, borderTopColor: COLORS.primary, margin: "0 auto 12px" }} />
          Loading lead…
        </div>
      </div>
    );
  }

  return (
    <div style={S.page}>

      {/* Top row */}
      <div style={S.topRow}>
        <button
          style={S.backBtn}
          onClick={() => navigate(isEdit ? `/agent/lead/${leadId}` : "/agent/leads")}
          onMouseEnter={(e) => e.currentTarget.style.color = COLORS.accent}
          onMouseLeave={(e) => e.currentTarget.style.color = COLORS.textMuted}
        >
          <BackIcon />
          {isEdit ? "Back to Lead" : "My Leads"}
        </button>
        <span style={{ color: COLORS.border }}>›</span>
        <div style={S.pageTitleWrap}>
          <div style={S.pageTitle}>{isEdit ? "Edit Lead" : "Add New Lead"}</div>
          <div style={S.pageSubtitle}>
            {isEdit ? `Editing ${form.name || "lead"}` : "Fill in the details to add a new lead"}
          </div>
        </div>
      </div>

      {/* Form layout */}
      <div style={S.formLayout}>

        {/* ── LEFT: form fields ─────────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: SPACING.base }}>

          {/* Form-level error */}
          {errors._form && (
            <div style={{
              backgroundColor: `${COLORS.danger}14`,
              border: `1px solid ${COLORS.danger}40`,
              borderRadius: RADIUS.md,
              padding: `${SPACING.sm} ${SPACING.base}`,
              color: COLORS.danger,
              fontSize: FONTS.size.sm,
            }}>
              {errors._form}
            </div>
          )}

          {/* Duplicate warning */}
          {duplicateWarn && (
            <div style={S.duplicateWarn}>
              <span style={{ color: COLORS.warning, flexShrink: 0, marginTop: "1px" }}><WarnIcon /></span>
              <div style={S.duplicateText}>
                This number already exists as{" "}
                <strong
                  style={{ cursor: "pointer", textDecoration: "underline" }}
                  onClick={() => navigate(`/agent/lead/${duplicateWarn.id}`)}
                >
                  {duplicateWarn.name}
                </strong>
                . You can still save a duplicate or{" "}
                <strong
                  style={{ cursor: "pointer", textDecoration: "underline" }}
                  onClick={() => navigate(`/agent/lead/${duplicateWarn.id}`)}
                >
                  view the existing lead
                </strong>.
              </div>
            </div>
          )}

          {/* Contact details card */}
          <div style={S.card}>
            <div style={S.cardHeader}>
              <UserIcon />
              <span style={S.cardTitle}>Contact Details</span>
            </div>
            <div style={S.cardBody}>

              <div style={S.fieldRow}>
                {/* Name */}
                <Field label="Full Name" required error={errors.name}>
                  <input
                    type="text"
                    placeholder="e.g. Ravi Kumar"
                    value={form.name}
                    onChange={(e) => handleChange("name", e.target.value)}
                    onFocus={() => setFocused("name")}
                    onBlur={() => setFocused(null)}
                    style={inputStyle("name")}
                    data-field-error={errors.name ? "1" : undefined}
                  />
                </Field>

                {/* Phone */}
                <Field
                  label="Phone Number"
                  required
                  error={errors.phone}
                  hint={checkingDupe ? "Checking for duplicates…" : undefined}
                >
                  <input
                    type="tel"
                    placeholder="98XXXXXXXX"
                    value={form.phone}
                    onChange={(e) => handleChange("phone", e.target.value.replace(/\D/g, "").slice(0, 10))}
                    onFocus={() => setFocused("phone")}
                    onBlur={() => { setFocused(null); checkDuplicate(form.phone); }}
                    style={inputStyle("phone")}
                    maxLength={10}
                  />
                </Field>
              </div>

              <div style={S.fieldRow}>
                {/* Email */}
                <Field label="Email Address" error={errors.email}>
                  <input
                    type="email"
                    placeholder="ravi@company.com"
                    value={form.email}
                    onChange={(e) => handleChange("email", e.target.value)}
                    onFocus={() => setFocused("email")}
                    onBlur={() => setFocused(null)}
                    style={inputStyle("email")}
                  />
                </Field>

                {/* Company */}
                <Field label="Company / Organisation">
                  <input
                    type="text"
                    placeholder="e.g. ABC Textiles Pvt Ltd"
                    value={form.company}
                    onChange={(e) => handleChange("company", e.target.value)}
                    onFocus={() => setFocused("company")}
                    onBlur={() => setFocused(null)}
                    style={inputStyle("company")}
                  />
                </Field>
              </div>

            </div>
          </div>

          {/* Pipeline details card */}
          <div style={S.card}>
            <div style={S.cardHeader}>
              <PipelineIcon />
              <span style={S.cardTitle}>Pipeline Details</span>
            </div>
            <div style={S.cardBody}>

              <div style={S.fieldRow}>
                {/* Source */}
                <Field label="Lead Source">
                  <select
                    value={form.source}
                    onChange={(e) => handleChange("source", e.target.value)}
                    onFocus={() => setFocused("source")}
                    onBlur={() => setFocused(null)}
                    style={selectStyle("source")}
                  >
                    <option value="">— Select source —</option>
                    {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>

                {/* Stage */}
                <Field label="Pipeline Stage">
                  <select
                    value={form.stage}
                    onChange={(e) => handleChange("stage", e.target.value)}
                    onFocus={() => setFocused("stage")}
                    onBlur={() => setFocused(null)}
                    style={{
                      ...selectStyle("stage"),
                      color: stageConf.text,
                      fontWeight: FONTS.weight.semibold,
                    }}
                  >
                    {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
              </div>

              {/* Deal value */}
              <Field label="Deal Value (₹)" error={errors.dealValue}>
                <div style={{ position: "relative" }}>
                  <span style={{
                    position: "absolute",
                    left: SPACING.md,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: COLORS.textMuted,
                    fontSize: FONTS.size.base,
                    fontWeight: FONTS.weight.semibold,
                    pointerEvents: "none",
                  }}>₹</span>
                  <input
                    type="number"
                    placeholder="0"
                    value={form.dealValue}
                    onChange={(e) => handleChange("dealValue", e.target.value)}
                    onFocus={() => setFocused("dealValue")}
                    onBlur={() => setFocused(null)}
                    style={{ ...inputStyle("dealValue"), paddingLeft: "28px" }}
                    min="0"
                  />
                </div>
              </Field>

            </div>
          </div>

          {/* Notes card */}
          <div style={S.card}>
            <div style={S.cardHeader}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={COLORS.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
              <span style={S.cardTitle}>Notes</span>
            </div>
            <div style={S.cardBody}>
              <Field label="Initial Notes">
                <textarea
                  placeholder="Background context, what they're looking for, how the intro happened…"
                  value={form.notes}
                  onChange={(e) => handleChange("notes", e.target.value)}
                  onFocus={() => setFocused("notes")}
                  onBlur={() => setFocused(null)}
                  style={textareaStyle("notes")}
                  rows={4}
                />
              </Field>
            </div>
          </div>

        </div>

        {/* ── RIGHT: summary + save ──────────────────────────────────────── */}
        <div style={S.rightCol}>

          {/* Live preview card */}
          <div style={S.summaryCard}>
            <div style={S.summaryTitle}>Lead Preview</div>
            <div style={S.summaryName}>
              {form.name || <span style={{ color: COLORS.textMuted, fontWeight: FONTS.weight.regular }}>—</span>}
            </div>
            <div style={S.summaryPhone}>
              {form.phone || <span style={{ color: COLORS.textMuted }}>—</span>}
            </div>

            {/* Summary rows */}
            {[
              { key: "Company",    val: form.company  },
              { key: "Email",      val: form.email    },
              { key: "Source",     val: form.source   },
            ].map(({ key, val }) => val ? (
              <div key={key} style={S.summaryRow}>
                <span style={S.summaryKey}>{key}</span>
                <span style={S.summaryVal}>{val}</span>
              </div>
            ) : null)}

            <div style={S.summaryRow}>
              <span style={S.summaryKey}>Stage</span>
              <span style={{
                ...S.stageBadge,
                color:           stageConf.text,
                backgroundColor: stageConf.bg,
              }}>
                {form.stage}
              </span>
            </div>

            {form.dealValue && Number(form.dealValue) > 0 && (
              <div style={{ ...S.summaryRow, marginTop: SPACING.sm, paddingTop: SPACING.sm, borderTop: `1px solid ${COLORS.border}` }}>
                <span style={S.summaryKey}>Deal Value</span>
                <span style={S.dealValueDisplay}>
                  ₹{Number(form.dealValue).toLocaleString("en-IN")}
                </span>
              </div>
            )}
          </div>

          {/* Save button */}
          <div>
            <button
              style={{
                ...S.savePrimaryBtn,
                ...(saveHovered && !saving
                  ? { backgroundColor: COLORS.primaryHover, transform: "translateY(-1px)", boxShadow: `0 6px 20px ${COLORS.primary}45` }
                  : {}),
                ...(saving ? { opacity: 0.7, cursor: "not-allowed" } : {}),
              }}
              onClick={handleSave}
              disabled={saving}
              onMouseEnter={() => setSaveHovered(true)}
              onMouseLeave={() => setSaveHovered(false)}
            >
              {saving ? (
                <><div style={S.spinner} />{isEdit ? "Saving…" : "Creating…"}</>
              ) : (
                isEdit ? "Save Changes" : "Create Lead"
              )}
            </button>

            <button
              style={{
                ...S.cancelBtn,
                ...(cancelHovered ? { borderColor: COLORS.danger + "60", color: COLORS.danger } : {}),
              }}
              onClick={() => navigate(isEdit ? `/agent/lead/${leadId}` : "/agent/leads")}
              onMouseEnter={() => setCancelHovered(true)}
              onMouseLeave={() => setCancelHovered(false)}
            >
              Cancel
            </button>

            <div style={S.requiredNote}>
              <span style={{ color: COLORS.danger }}>*</span> Required fields
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default AddEditLead;
