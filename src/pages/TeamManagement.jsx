// TIRAS CRM — TeamManagement.jsx
// Company Admin — add agents/managers, assign roles, activate/deactivate team members
// All queries scoped by companyId. New user creation calls Cloud Function "createTeamMember".
//
// USAGE:
//   1. Drop into src/pages/TeamManagement.jsx
//   2. In src/pages/index.js replace:
//        export const TeamManagement = () => <Placeholder name="Team Management" />;
//      with:
//        export { TeamManagement } from "./TeamManagement";
//
// CLOUD FUNCTION REQUIRED — "createTeamMember":
//   The Add Member flow calls httpsCallable(functions, "createTeamMember").
//   That function must: create Firebase Auth user → send password-reset email
//   → write users/{uid} doc in Firestore with the payload below.
//   Until deployed, the "Add Member" button will show the API error — everything
//   else (list, edit, deactivate) works against live Firestore data.

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions, COLLECTIONS, ROLES } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import {
  COLORS,
  FONTS,
  SPACING,
  RADIUS,
  SHADOWS,
  STYLES,
  TRANSITIONS,
  ROLE_CONFIG,
} from "../theme";
import {
  RiAddLine,
  RiSearchLine,
  RiEditLine,
  RiUserLine,
  RiShieldUserLine,
  RiTeamLine,
  RiCheckboxCircleLine,
  RiIndeterminateCircleLine,
  RiLoader4Line,
  RiCloseLine,
  RiMailLine,
  RiAlertLine,
  RiUserSettingsLine,
  RiRefreshLine,
} from "react-icons/ri";

// ─── Constants ───────────────────────────────────────────────────────────────

const ROLE_OPTIONS = [
  {
    value: ROLES.MANAGER,
    label: "Manager",
    desc: "Sees his agents, their leads, call recordings. Can assign tickets.",
  },
  {
    value: ROLES.AGENT,
    label: "Agent",
    desc: "Sees only his own assigned leads, calls, and follow-ups.",
  },
  {
    value: ROLES.SUPPORT_AGENT,
    label: "Support Agent",
    desc: "Sees only tickets assigned to them and linked recordings.",
  },
];

const FILTER_TABS = [
  { value: "all", label: "All" },
  { value: ROLES.MANAGER, label: "Managers" },
  { value: ROLES.AGENT, label: "Agents" },
  { value: ROLES.SUPPORT_AGENT, label: "Support" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatLastActive = (ts) => {
  if (!ts) return "Never";
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

/** Returns a stable hue for a given string (for avatar background) */
const nameToColor = (name = "") => {
  const hues = [
    COLORS.primary,
    COLORS.info,
    COLORS.success,
    COLORS.accent,
    "#9B59B6",
    "#1ABC9C",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i);
  return hues[hash % hues.length];
};

// ─── RoleBadge ───────────────────────────────────────────────────────────────

const RoleBadge = ({ role }) => {
  const cfg = ROLE_CONFIG[role] || {
    label: role,
    color: COLORS.textSecondary,
    bg: COLORS.surfaceActive,
  };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: `2px ${SPACING.sm}`,
        borderRadius: RADIUS.full,
        fontSize: FONTS.size.xs,
        fontWeight: FONTS.weight.semibold,
        color: cfg.color,
        backgroundColor: cfg.bg,
        border: `1px solid ${cfg.color}30`,
        whiteSpace: "nowrap",
      }}
    >
      {cfg.label}
    </span>
  );
};

// ─── StatusBadge ─────────────────────────────────────────────────────────────

const StatusBadge = ({ isActive }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: "4px",
      padding: `2px ${SPACING.sm}`,
      borderRadius: RADIUS.full,
      fontSize: FONTS.size.xs,
      fontWeight: FONTS.weight.semibold,
      color: isActive !== false ? COLORS.success : COLORS.textMuted,
      backgroundColor:
        isActive !== false ? COLORS.successMuted : COLORS.surfaceActive,
      border: `1px solid ${isActive !== false ? COLORS.success + "30" : COLORS.border}`,
    }}
  >
    <span
      style={{
        width: "5px",
        height: "5px",
        borderRadius: "50%",
        backgroundColor:
          isActive !== false ? COLORS.success : COLORS.textMuted,
        flexShrink: 0,
      }}
    />
    {isActive !== false ? "Active" : "Inactive"}
  </span>
);

// ─── MemberAvatar ─────────────────────────────────────────────────────────────

const MemberAvatar = ({ name, size = 38 }) => {
  const initial = (name || "?").charAt(0).toUpperCase();
  const color = nameToColor(name);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        backgroundColor: color + "22",
        border: `2px solid ${color}50`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.38,
        fontWeight: FONTS.weight.bold,
        color: color,
        flexShrink: 0,
        userSelect: "none",
      }}
    >
      {initial}
    </div>
  );
};

// ─── Mini Stat Tile ───────────────────────────────────────────────────────────

const MiniStat = ({ icon: Icon, iconColor, label, value, loading }) => (
  <div
    style={{
      backgroundColor: COLORS.surface,
      border: `1px solid ${COLORS.border}`,
      borderRadius: RADIUS.lg,
      padding: `${SPACING.base} ${SPACING.lg}`,
      display: "flex",
      alignItems: "center",
      gap: SPACING.md,
    }}
  >
    <div
      style={{
        width: "36px",
        height: "36px",
        borderRadius: RADIUS.md,
        backgroundColor: iconColor + "20",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <Icon size={18} color={iconColor} />
    </div>
    <div>
      <div
        style={{
          fontSize: loading ? FONTS.size.base : FONTS.size["2xl"],
          fontWeight: FONTS.weight.bold,
          color: loading ? COLORS.textMuted : COLORS.textPrimary,
          lineHeight: 1.1,
        }}
      >
        {loading ? "—" : value}
      </div>
      <div
        style={{
          fontSize: FONTS.size.xs,
          color: COLORS.textSecondary,
          marginTop: "2px",
        }}
      >
        {label}
      </div>
    </div>
  </div>
);

// ─── FormField ────────────────────────────────────────────────────────────────

const FormField = ({ label, error, required, children }) => (
  <div style={{ marginBottom: SPACING.base }}>
    <label
      style={{
        display: "block",
        fontSize: FONTS.size.sm,
        fontWeight: FONTS.weight.medium,
        color: COLORS.textSecondary,
        marginBottom: SPACING.xs,
      }}
    >
      {label}
      {required && (
        <span style={{ color: COLORS.danger, marginLeft: "3px" }}>*</span>
      )}
    </label>
    {children}
    {error && (
      <div
        style={{
          fontSize: FONTS.size.xs,
          color: COLORS.danger,
          marginTop: "4px",
          display: "flex",
          alignItems: "center",
          gap: "4px",
        }}
      >
        <RiAlertLine size={11} />
        {error}
      </div>
    )}
  </div>
);

// ─── AddEditModal ─────────────────────────────────────────────────────────────

const AddEditModal = ({
  mode, // "add" | "edit"
  formData,
  setFormData,
  formErrors,
  submitError,
  submitting,
  managers, // list of manager-role members for the "assign manager" dropdown
  onClose,
  onSubmit,
}) => {
  const overlayRef = useRef(null);

  // Close on backdrop click
  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) onClose();
  };

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const isAdd = mode === "add";

  const inputStyle = {
    ...STYLES.input,
    padding: `${SPACING.sm} ${SPACING.md}`,
  };

  const inputFocusStyle = (hasError) => ({
    ...inputStyle,
    border: `1px solid ${hasError ? COLORS.danger : COLORS.inputBorder}`,
    transition: TRANSITIONS.fast,
  });

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.65)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: SPACING.base,
      }}
    >
      <div
        style={{
          backgroundColor: COLORS.surface,
          border: `1px solid ${COLORS.border}`,
          borderRadius: RADIUS.xl,
          width: "100%",
          maxWidth: "480px",
          boxShadow: SHADOWS.lg,
          overflow: "hidden",
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: `${SPACING.lg} ${SPACING.xl}`,
            borderBottom: `1px solid ${COLORS.border}`,
          }}
        >
          <div>
            <div
              style={{
                fontSize: FONTS.size.xl,
                fontWeight: FONTS.weight.bold,
                color: COLORS.textPrimary,
              }}
            >
              {isAdd ? "Add Team Member" : "Edit Team Member"}
            </div>
            <div
              style={{
                fontSize: FONTS.size.sm,
                color: COLORS.textSecondary,
                marginTop: "2px",
              }}
            >
              {isAdd
                ? "Member will receive a password setup email"
                : "Email address cannot be changed"}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: COLORS.textSecondary,
              padding: SPACING.xs,
              display: "flex",
              alignItems: "center",
              borderRadius: RADIUS.base,
            }}
          >
            <RiCloseLine size={22} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: SPACING.xl }}>
          {/* Full Name */}
          <FormField label="Full Name" error={formErrors.displayName} required>
            <input
              type="text"
              placeholder="e.g. Priya Sharma"
              value={formData.displayName}
              onChange={(e) =>
                setFormData((p) => ({ ...p, displayName: e.target.value }))
              }
              style={inputFocusStyle(!!formErrors.displayName)}
            />
          </FormField>

          {/* Email — only shown for Add */}
          {isAdd && (
            <FormField label="Email Address" error={formErrors.email} required>
              <input
                type="email"
                placeholder="e.g. priya@company.com"
                value={formData.email}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, email: e.target.value }))
                }
                style={inputFocusStyle(!!formErrors.email)}
              />
            </FormField>
          )}

          {/* Role Selection */}
          <FormField label="Role" error={formErrors.role} required>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: SPACING.sm,
              }}
            >
              {ROLE_OPTIONS.map((opt) => {
                const selected = formData.role === opt.value;
                const cfg = ROLE_CONFIG[opt.value];
                return (
                  <div
                    key={opt.value}
                    onClick={() =>
                      setFormData((p) => ({ ...p, role: opt.value }))
                    }
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: SPACING.md,
                      padding: `${SPACING.sm} ${SPACING.md}`,
                      borderRadius: RADIUS.md,
                      border: `1px solid ${
                        selected ? cfg.color + "60" : COLORS.border
                      }`,
                      backgroundColor: selected ? cfg.bg : "transparent",
                      cursor: "pointer",
                      transition: TRANSITIONS.fast,
                    }}
                  >
                    {/* Radio circle */}
                    <div
                      style={{
                        width: "16px",
                        height: "16px",
                        borderRadius: "50%",
                        border: `2px solid ${
                          selected ? cfg.color : COLORS.border
                        }`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        transition: TRANSITIONS.fast,
                      }}
                    >
                      {selected && (
                        <div
                          style={{
                            width: "7px",
                            height: "7px",
                            borderRadius: "50%",
                            backgroundColor: cfg.color,
                          }}
                        />
                      )}
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: FONTS.size.sm,
                          fontWeight: FONTS.weight.semibold,
                          color: selected ? cfg.color : COLORS.textPrimary,
                        }}
                      >
                        {opt.label}
                      </div>
                      <div
                        style={{
                          fontSize: FONTS.size.xs,
                          color: COLORS.textSecondary,
                          marginTop: "1px",
                          lineHeight: 1.4,
                        }}
                      >
                        {opt.desc}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </FormField>

          {/* Assign to Manager — only for Agents */}
          {formData.role === ROLES.AGENT && managers.length > 0 && (
            <FormField label="Assign to Manager" error={formErrors.managerId}>
              <select
                value={formData.managerId}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, managerId: e.target.value }))
                }
                style={{
                  ...inputStyle,
                  appearance: "none",
                  cursor: "pointer",
                }}
              >
                <option value="">— Unassigned —</option>
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.displayName || m.email}
                  </option>
                ))}
              </select>
            </FormField>
          )}

          {/* API error */}
          {submitError && (
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: SPACING.sm,
                padding: SPACING.md,
                borderRadius: RADIUS.md,
                backgroundColor: COLORS.dangerMuted,
                border: `1px solid ${COLORS.danger}40`,
                marginBottom: SPACING.base,
              }}
            >
              <RiAlertLine
                size={16}
                color={COLORS.danger}
                style={{ flexShrink: 0, marginTop: "1px" }}
              />
              <div
                style={{
                  fontSize: FONTS.size.sm,
                  color: COLORS.danger,
                  lineHeight: 1.5,
                }}
              >
                {submitError}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: SPACING.md,
            padding: `${SPACING.base} ${SPACING.xl}`,
            borderTop: `1px solid ${COLORS.border}`,
          }}
        >
          <button onClick={onClose} style={{ ...STYLES.buttonSecondary }}>
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={submitting}
            style={{
              ...STYLES.buttonPrimary,
              display: "flex",
              alignItems: "center",
              gap: SPACING.xs,
              opacity: submitting ? 0.6 : 1,
              cursor: submitting ? "not-allowed" : "pointer",
            }}
          >
            {submitting ? (
              <>
                <RiLoader4Line
                  size={15}
                  style={{ animation: "tirasSpinKf 0.8s linear infinite" }}
                />
                {isAdd ? "Creating…" : "Saving…"}
              </>
            ) : (
              <>
                <RiCheckboxCircleLine size={15} />
                {isAdd ? "Create Member" : "Save Changes"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── DeactivateDialog ─────────────────────────────────────────────────────────

const DeactivateDialog = ({ member, onCancel, onConfirm, processing }) => (
  <div
    style={{
      position: "fixed",
      inset: 0,
      backgroundColor: "rgba(0,0,0,0.7)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1100,
      padding: SPACING.base,
    }}
  >
    <div
      style={{
        backgroundColor: COLORS.surface,
        border: `1px solid ${COLORS.danger}40`,
        borderRadius: RADIUS.xl,
        width: "100%",
        maxWidth: "380px",
        padding: SPACING.xl,
        boxShadow: SHADOWS.lg,
      }}
    >
      <div
        style={{
          width: "44px",
          height: "44px",
          borderRadius: RADIUS.lg,
          backgroundColor: COLORS.dangerMuted,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: SPACING.base,
        }}
      >
        <RiIndeterminateCircleLine size={22} color={COLORS.danger} />
      </div>

      <div
        style={{
          fontSize: FONTS.size.lg,
          fontWeight: FONTS.weight.bold,
          color: COLORS.textPrimary,
          marginBottom: SPACING.xs,
        }}
      >
        {member.isActive !== false ? "Deactivate" : "Reactivate"}{" "}
        {member.displayName?.split(" ")[0] || "Member"}?
      </div>

      <div
        style={{
          fontSize: FONTS.size.sm,
          color: COLORS.textSecondary,
          lineHeight: 1.6,
          marginBottom: SPACING.xl,
        }}
      >
        {member.isActive !== false
          ? `${member.displayName || "This member"} will lose access immediately and cannot log in until reactivated. Their data remains untouched.`
          : `${member.displayName || "This member"} will regain full access based on their role.`}
      </div>

      <div style={{ display: "flex", gap: SPACING.md }}>
        <button
          onClick={onCancel}
          style={{ ...STYLES.buttonSecondary, flex: 1 }}
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={processing}
          style={{
            flex: 1,
            backgroundColor:
              member.isActive !== false ? COLORS.danger : COLORS.success,
            color: "#fff",
            border: "none",
            borderRadius: RADIUS.base,
            fontFamily: FONTS.family,
            fontSize: FONTS.size.base,
            fontWeight: FONTS.weight.semibold,
            padding: `${SPACING.sm} ${SPACING.xl}`,
            cursor: processing ? "not-allowed" : "pointer",
            opacity: processing ? 0.6 : 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: SPACING.xs,
          }}
        >
          {processing ? (
            <RiLoader4Line
              size={15}
              style={{ animation: "tirasSpinKf 0.8s linear infinite" }}
            />
          ) : null}
          {member.isActive !== false ? "Yes, Deactivate" : "Yes, Reactivate"}
        </button>
      </div>
    </div>
  </div>
);

// ─── TeamManagement ──────────────────────────────────────────────────────────

export const TeamManagement = () => {
  const { companyId, currentUser } = useAuth();

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const [modalMode, setModalMode] = useState(null); // null | "add" | "edit"
  const [selectedMember, setSelectedMember] = useState(null);
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [deactivateProcessing, setDeactivateProcessing] = useState(false);

  const [formData, setFormData] = useState({
    displayName: "",
    email: "",
    role: ROLES.AGENT,
    managerId: "",
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // ── Load members ────────────────────────────────────────────────────────────
  const loadMembers = useCallback(async () => {
    if (!companyId) return;
    try {
      const snap = await getDocs(
        query(
          collection(db, COLLECTIONS.USERS),
          where("companyId", "==", companyId)
        )
      );
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) =>
          (a.displayName || "").localeCompare(b.displayName || "")
        );
      setMembers(list);
    } catch (err) {
      console.error("TeamManagement: loadMembers error:", err);
    }
  }, [companyId]);

  useEffect(() => {
    setLoading(true);
    loadMembers().finally(() => setLoading(false));
  }, [loadMembers]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadMembers();
    setRefreshing(false);
  };

  // ── Derived data ────────────────────────────────────────────────────────────
  const managers = members.filter((m) => m.role === ROLES.MANAGER && m.isActive !== false);

  const filteredMembers = members.filter((m) => {
    const q = searchQuery.toLowerCase();
    const matchSearch =
      !q ||
      m.displayName?.toLowerCase().includes(q) ||
      m.email?.toLowerCase().includes(q);
    const matchRole = roleFilter === "all" || m.role === roleFilter;
    return matchSearch && matchRole;
  });

  const miniStats = {
    total: members.length,
    active: members.filter((m) => m.isActive !== false).length,
    managers: members.filter((m) => m.role === ROLES.MANAGER).length,
    agents: members.filter((m) => m.role === ROLES.AGENT).length,
  };

  // ── Modal helpers ───────────────────────────────────────────────────────────
  const openAddModal = () => {
    setFormData({ displayName: "", email: "", role: ROLES.AGENT, managerId: "" });
    setFormErrors({});
    setSubmitError("");
    setSelectedMember(null);
    setModalMode("add");
  };

  const openEditModal = (member) => {
    setSelectedMember(member);
    setFormData({
      displayName: member.displayName || "",
      email: member.email || "",
      role: member.role || ROLES.AGENT,
      managerId: member.managerId || "",
    });
    setFormErrors({});
    setSubmitError("");
    setModalMode("edit");
  };

  const closeModal = () => {
    if (submitting) return;
    setModalMode(null);
    setSelectedMember(null);
  };

  // ── Form validation ─────────────────────────────────────────────────────────
  const validate = () => {
    const errs = {};
    if (!formData.displayName.trim()) errs.displayName = "Full name is required";
    if (modalMode === "add") {
      if (!formData.email.trim()) errs.email = "Email is required";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
        errs.email = "Enter a valid email address";
    }
    if (!formData.role) errs.role = "Select a role";
    return errs;
  };

  // ── Add member (Cloud Function) ─────────────────────────────────────────────
  const handleAdd = async () => {
    const errs = validate();
    if (Object.keys(errs).length) { setFormErrors(errs); return; }

    setSubmitting(true);
    setSubmitError("");

    try {
      const createTeamMember = httpsCallable(functions, "createTeamMember");
      await createTeamMember({
        displayName: formData.displayName.trim(),
        email: formData.email.trim().toLowerCase(),
        role: formData.role,
        companyId,
        managerId: formData.managerId || null,
      });
      await loadMembers();
      setModalMode(null);
    } catch (err) {
      console.error("TeamManagement: createTeamMember error:", err);
      setSubmitError(
        err?.message || "Failed to create member. Check that the Cloud Function is deployed."
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ── Edit member (direct Firestore write) ────────────────────────────────────
  const handleEdit = async () => {
    const errs = validate();
    if (Object.keys(errs).length) { setFormErrors(errs); return; }

    setSubmitting(true);
    setSubmitError("");

    try {
      await updateDoc(doc(db, COLLECTIONS.USERS, selectedMember.id), {
        displayName: formData.displayName.trim(),
        role: formData.role,
        managerId: formData.managerId || null,
        updatedAt: serverTimestamp(),
      });
      await loadMembers();
      setModalMode(null);
    } catch (err) {
      console.error("TeamManagement: editMember error:", err);
      setSubmitError(err?.message || "Failed to save changes.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Toggle active/inactive ──────────────────────────────────────────────────
  const handleToggleActive = async () => {
    if (!deactivateTarget) return;
    setDeactivateProcessing(true);
    try {
      await updateDoc(doc(db, COLLECTIONS.USERS, deactivateTarget.id), {
        isActive: deactivateTarget.isActive === false, // flip
        updatedAt: serverTimestamp(),
      });
      await loadMembers();
    } catch (err) {
      console.error("TeamManagement: toggleActive error:", err);
    } finally {
      setDeactivateProcessing(false);
      setDeactivateTarget(null);
    }
  };

  // ── Table column widths ─────────────────────────────────────────────────────
  const COL = {
    member: "1fr",
    role: "140px",
    status: "110px",
    lastActive: "130px",
    actions: "96px",
  };

  const headerCellStyle = {
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.semibold,
    color: COLORS.textMuted,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        backgroundColor: COLORS.background,
        minHeight: "calc(100vh - 60px)",
        padding: `${SPACING["2xl"]} ${SPACING["2xl"]}`,
        fontFamily: FONTS.family,
        boxSizing: "border-box",
      }}
    >
      <style>{`
        @keyframes tirasSpinKf { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .tiras-row:hover { background-color: ${COLORS.surfaceHover} !important; }
        .tiras-action-btn { opacity: 0; transition: opacity 0.15s ease; }
        .tiras-row:hover .tiras-action-btn { opacity: 1; }
        select option { background-color: ${COLORS.surface}; color: ${COLORS.textPrimary}; }
      `}</style>

      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: SPACING.base,
          marginBottom: SPACING["2xl"],
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: FONTS.size["4xl"],
              fontWeight: FONTS.weight.bold,
              color: COLORS.textPrimary,
              letterSpacing: "-0.5px",
              lineHeight: 1.1,
            }}
          >
            Team Management
          </h1>
          <p
            style={{
              margin: `${SPACING.xs} 0 0`,
              fontSize: FONTS.size.base,
              color: COLORS.textSecondary,
            }}
          >
            Add members, assign roles, and manage access to your CRM.
          </p>
        </div>

        <div style={{ display: "flex", gap: SPACING.sm, alignItems: "center" }}>
          <button
            onClick={handleRefresh}
            disabled={refreshing || loading}
            style={{
              ...STYLES.buttonSecondary,
              display: "flex",
              alignItems: "center",
              gap: SPACING.xs,
              padding: `${SPACING.sm} ${SPACING.md}`,
              opacity: refreshing || loading ? 0.4 : 1,
            }}
          >
            <RiRefreshLine
              size={15}
              style={{
                animation: refreshing
                  ? "tirasSpinKf 0.7s linear infinite"
                  : "none",
              }}
            />
          </button>

          <button
            onClick={openAddModal}
            style={{
              ...STYLES.buttonPrimary,
              display: "flex",
              alignItems: "center",
              gap: SPACING.xs,
            }}
          >
            <RiAddLine size={17} />
            Add Member
          </button>
        </div>
      </div>

      {/* ── Mini Stats ───────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: SPACING.md,
          marginBottom: SPACING.xl,
        }}
      >
        <MiniStat icon={RiTeamLine} iconColor={COLORS.info} label="Total Members" value={miniStats.total} loading={loading} />
        <MiniStat icon={RiCheckboxCircleLine} iconColor={COLORS.success} label="Active Members" value={miniStats.active} loading={loading} />
        <MiniStat icon={RiShieldUserLine} iconColor={COLORS.primary} label="Managers" value={miniStats.managers} loading={loading} />
        <MiniStat icon={RiUserLine} iconColor={COLORS.accent} label="Agents" value={miniStats.agents} loading={loading} />
      </div>

      {/* ── Search + Filter Row ───────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: SPACING.md,
          marginBottom: SPACING.base,
          flexWrap: "wrap",
        }}
      >
        {/* Search */}
        <div style={{ position: "relative", flex: "1 1 240px", minWidth: "200px" }}>
          <RiSearchLine
            size={16}
            color={COLORS.textMuted}
            style={{
              position: "absolute",
              left: SPACING.md,
              top: "50%",
              transform: "translateY(-50%)",
              pointerEvents: "none",
            }}
          />
          <input
            type="text"
            placeholder="Search by name or email…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              ...STYLES.input,
              paddingLeft: "36px",
              maxWidth: "360px",
            }}
          />
        </div>

        {/* Role filter tabs */}
        <div
          style={{
            display: "flex",
            backgroundColor: COLORS.surface,
            border: `1px solid ${COLORS.border}`,
            borderRadius: RADIUS.md,
            padding: "3px",
            gap: "2px",
          }}
        >
          {FILTER_TABS.map((tab) => {
            const active = roleFilter === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => setRoleFilter(tab.value)}
                style={{
                  background: active ? COLORS.primary : "transparent",
                  border: "none",
                  borderRadius: RADIUS.base,
                  color: active ? "#fff" : COLORS.textSecondary,
                  fontSize: FONTS.size.sm,
                  fontWeight: active
                    ? FONTS.weight.semibold
                    : FONTS.weight.regular,
                  padding: `4px ${SPACING.md}`,
                  cursor: "pointer",
                  transition: TRANSITIONS.fast,
                  whiteSpace: "nowrap",
                  fontFamily: FONTS.family,
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Result count */}
        {!loading && (
          <span
            style={{ fontSize: FONTS.size.sm, color: COLORS.textMuted, marginLeft: "auto" }}
          >
            {filteredMembers.length} member{filteredMembers.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* ── Table ────────────────────────────────────────────────────────────── */}
      <div
        style={{
          backgroundColor: COLORS.surface,
          border: `1px solid ${COLORS.border}`,
          borderRadius: RADIUS.lg,
          overflow: "hidden",
        }}
      >
        {/* Table Header */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `${COL.member} ${COL.role} ${COL.status} ${COL.lastActive} ${COL.actions}`,
            padding: `${SPACING.sm} ${SPACING.lg}`,
            backgroundColor: COLORS.surfaceActive,
            borderBottom: `1px solid ${COLORS.border}`,
            gap: SPACING.base,
            alignItems: "center",
          }}
        >
          <div style={headerCellStyle}>Member</div>
          <div style={headerCellStyle}>Role</div>
          <div style={headerCellStyle}>Status</div>
          <div style={headerCellStyle}>Last Active</div>
          <div style={{ ...headerCellStyle, textAlign: "right" }}>Actions</div>
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: SPACING["5xl"],
              flexDirection: "column",
              gap: SPACING.md,
            }}
          >
            <RiLoader4Line
              size={28}
              color={COLORS.textMuted}
              style={{ animation: "tirasSpinKf 1s linear infinite" }}
            />
            <span style={{ fontSize: FONTS.size.sm, color: COLORS.textMuted }}>
              Loading team…
            </span>
          </div>
        )}

        {/* Empty state */}
        {!loading && filteredMembers.length === 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: SPACING["5xl"],
              gap: SPACING.md,
            }}
          >
            <div
              style={{
                width: "52px",
                height: "52px",
                borderRadius: RADIUS.xl,
                backgroundColor: COLORS.primaryMuted,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <RiUserSettingsLine size={24} color={COLORS.primary} />
            </div>
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: FONTS.size.lg,
                  fontWeight: FONTS.weight.semibold,
                  color: COLORS.textPrimary,
                  marginBottom: SPACING.xs,
                }}
              >
                {searchQuery || roleFilter !== "all"
                  ? "No members match your filters"
                  : "No team members yet"}
              </div>
              <div style={{ fontSize: FONTS.size.sm, color: COLORS.textSecondary }}>
                {searchQuery || roleFilter !== "all"
                  ? "Try adjusting your search or filter."
                  : 'Click "Add Member" to invite your first agent or manager.'}
              </div>
            </div>
          </div>
        )}

        {/* Rows */}
        {!loading &&
          filteredMembers.map((member, idx) => {
            const isSelf = member.id === currentUser?.uid;
            const isInactive = member.isActive === false;

            return (
              <div
                key={member.id}
                className="tiras-row"
                style={{
                  display: "grid",
                  gridTemplateColumns: `${COL.member} ${COL.role} ${COL.status} ${COL.lastActive} ${COL.actions}`,
                  padding: `${SPACING.md} ${SPACING.lg}`,
                  borderBottom:
                    idx < filteredMembers.length - 1
                      ? `1px solid ${COLORS.border}`
                      : "none",
                  gap: SPACING.base,
                  alignItems: "center",
                  transition: TRANSITIONS.fast,
                  opacity: isInactive ? 0.55 : 1,
                  backgroundColor: COLORS.surface,
                }}
              >
                {/* Member cell */}
                <div style={{ display: "flex", alignItems: "center", gap: SPACING.md, minWidth: 0 }}>
                  <MemberAvatar name={member.displayName || member.email} />
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: FONTS.size.base,
                        fontWeight: FONTS.weight.semibold,
                        color: COLORS.textPrimary,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        display: "flex",
                        alignItems: "center",
                        gap: SPACING.xs,
                      }}
                    >
                      {member.displayName || "—"}
                      {isSelf && (
                        <span
                          style={{
                            fontSize: FONTS.size.xs,
                            color: COLORS.accent,
                            fontWeight: FONTS.weight.regular,
                          }}
                        >
                          (You)
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: FONTS.size.sm,
                        color: COLORS.textSecondary,
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        marginTop: "1px",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      <RiMailLine size={11} />
                      {member.email}
                    </div>
                  </div>
                </div>

                {/* Role */}
                <div>
                  <RoleBadge role={member.role} />
                </div>

                {/* Status */}
                <div>
                  <StatusBadge isActive={member.isActive} />
                </div>

                {/* Last Active */}
                <div
                  style={{
                    fontSize: FONTS.size.sm,
                    color: COLORS.textSecondary,
                  }}
                >
                  {formatLastActive(member.lastLoginAt)}
                </div>

                {/* Actions */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: "6px",
                  }}
                >
                  {/* Edit */}
                  <button
                    className="tiras-action-btn"
                    onClick={() => openEditModal(member)}
                    title="Edit member"
                    style={{
                      background: "none",
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: RADIUS.base,
                      color: COLORS.textSecondary,
                      cursor: "pointer",
                      padding: "6px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <RiEditLine size={14} />
                  </button>

                  {/* Activate / Deactivate */}
                  {!isSelf && (
                    <button
                      className="tiras-action-btn"
                      onClick={() => setDeactivateTarget(member)}
                      title={isInactive ? "Reactivate" : "Deactivate"}
                      style={{
                        background: "none",
                        border: `1px solid ${
                          isInactive ? COLORS.success + "50" : COLORS.danger + "50"
                        }`,
                        borderRadius: RADIUS.base,
                        color: isInactive ? COLORS.success : COLORS.danger,
                        cursor: "pointer",
                        padding: "6px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {isInactive ? (
                        <RiCheckboxCircleLine size={14} />
                      ) : (
                        <RiIndeterminateCircleLine size={14} />
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
      </div>

      {/* ── Modals ───────────────────────────────────────────────────────────── */}
      {modalMode && (
        <AddEditModal
          mode={modalMode}
          formData={formData}
          setFormData={setFormData}
          formErrors={formErrors}
          submitError={submitError}
          submitting={submitting}
          managers={managers}
          onClose={closeModal}
          onSubmit={modalMode === "add" ? handleAdd : handleEdit}
        />
      )}

      {deactivateTarget && (
        <DeactivateDialog
          member={deactivateTarget}
          onCancel={() => setDeactivateTarget(null)}
          onConfirm={handleToggleActive}
          processing={deactivateProcessing}
        />
      )}
    </div>
  );
};
