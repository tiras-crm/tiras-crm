import { useState, useRef } from "react";
import { doc, updateDoc } from "firebase/firestore";
import {
  updatePassword,
  updateEmail,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from "firebase/auth";
import { db, auth } from "../firebase";
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
  user:    "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
  mail:    "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6",
  lock:    "M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2zM7 11V7a5 5 0 0 1 10 0v4",
  eye:     "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  eyeOff:  "M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22",
  bell:    "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0",
  check:   "M20 6L9 17l-5-5",
  save:    "M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2zM17 21v-8H7v8M7 3v5h8",
  shield:  "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  phone:   "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13 19.79 19.79 0 0 1 1.61 4.37 2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.18 6.18",
  building:"M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 22V12h6v10",
  logout:  "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
};

const TABS = [
  { key: "profile",       label: "Profile",       icon: ICONS.user   },
  { key: "security",      label: "Security",      icon: ICONS.shield  },
  { key: "notifications", label: "Notifications", icon: ICONS.bell   },
];

const NOTIF_PREFS = [
  { key: "followUpReminder",  label: "Follow-up reminders",          desc: "Before a scheduled follow-up is due" },
  { key: "leadAssigned",      label: "New lead assigned to me",       desc: "When admin or manager assigns a lead" },
  { key: "ticketUpdate",      label: "Ticket status changes",         desc: "When your ticket moves stage" },
  { key: "recordingReady",    label: "Call recording ready",          desc: "After a call recording is processed" },
  { key: "paymentReceived",   label: "Payment received",              desc: "When a customer completes payment" },
  { key: "overdueFollowUp",   label: "Overdue follow-up alerts",      desc: "When a follow-up is past due" },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
const initials = (name = "") =>
  name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

// ── Sub-components ───────────────────────────────────────────────────────────
const Field = ({ label, children, error }) => (
  <div style={styles.field}>
    <label style={styles.fieldLabel}>{label}</label>
    {children}
    {error && <span style={styles.fieldError}>{error}</span>}
  </div>
);

const Input = ({ icon, type = "text", value, onChange, placeholder, rightEl, disabled }) => (
  <div style={{ ...styles.inputWrap, opacity: disabled ? 0.5 : 1 }}>
    {icon && (
      <span style={styles.inputIcon}>
        <Icon d={icon} size={15} color="#888" />
      </span>
    )}
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      style={{ ...styles.input, paddingLeft: icon ? 40 : 14 }}
    />
    {rightEl && <span style={styles.inputRight}>{rightEl}</span>}
  </div>
);

const Toggle = ({ checked, onChange }) => (
  <button
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    style={{
      ...styles.toggle,
      background: checked ? "#B65E3C" : "#2A2A2A",
    }}
  >
    <span
      style={{
        ...styles.toggleThumb,
        transform: checked ? "translateX(20px)" : "translateX(2px)",
      }}
    />
  </button>
);

const Toast = ({ msg, type }) =>
  msg ? (
    <div
      style={{
        ...styles.toast,
        background: type === "error" ? "#3A1515" : "#1A2A1A",
        borderColor: type === "error" ? "#E05C5C44" : "#5AB45A44",
        color: type === "error" ? "#E05C5C" : "#7DD87D",
      }}
    >
      <Icon
        d={type === "error" ? ICONS.shield : ICONS.check}
        size={14}
        color={type === "error" ? "#E05C5C" : "#7DD87D"}
      />
      {msg}
    </div>
  ) : null;

// ── Main Component ───────────────────────────────────────────────────────────
export const ProfileSettings = () => {
  const { currentUser, userProfile } = useAuth();
  const [activeTab, setActiveTab] = useState("profile");
  const [toast, setToast] = useState({ msg: "", type: "success" });

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: "", type: "success" }), 3500);
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div style={styles.avatarLarge}>
          {initials(userProfile?.displayName || currentUser?.email)}
        </div>
        <div>
          <h1 style={styles.title}>{userProfile?.displayName || "My Account"}</h1>
          <p style={styles.subtitle}>
            <span style={styles.rolePill}>{userProfile?.role ?? "Agent"}</span>
            {currentUser?.email}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        {TABS.map((t) => (
          <button
            key={t.key}
            style={{
              ...styles.tab,
              ...(activeTab === t.key ? styles.tabActive : styles.tabInactive),
            }}
            onClick={() => setActiveTab(t.key)}
          >
            <Icon
              d={t.icon}
              size={15}
              color={activeTab === t.key ? "#F2A65A" : "#888"}
            />
            {t.label}
          </button>
        ))}
      </div>

      {/* Toast */}
      <Toast msg={toast.msg} type={toast.type} />

      {/* Tab panels */}
      <div style={styles.panel}>
        {activeTab === "profile" && (
          <ProfileTab
            currentUser={currentUser}
            userProfile={userProfile}
            showToast={showToast}
          />
        )}
        {activeTab === "security" && (
          <SecurityTab currentUser={currentUser} showToast={showToast} />
        )}
        {activeTab === "notifications" && (
          <NotificationsTab
            currentUser={currentUser}
            userProfile={userProfile}
            showToast={showToast}
          />
        )}
      </div>
    </div>
  );
};

// ── Profile Tab ──────────────────────────────────────────────────────────────
const ProfileTab = ({ currentUser, userProfile, showToast }) => {
  const [form, setForm] = useState({
    displayName: userProfile?.displayName ?? "",
    phone:       userProfile?.phone ?? "",
    company:     userProfile?.company ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const validate = () => {
    const errs = {};
    if (!form.displayName.trim()) errs.displayName = "Name is required";
    if (form.phone && !/^\+?[\d\s\-()]{7,15}$/.test(form.phone))
      errs.phone = "Enter a valid phone number";
    return errs;
  };

  const save = async () => {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setSaving(true);
    try {
      await updateDoc(doc(db, "users", currentUser.uid), {
        displayName: form.displayName.trim(),
        phone:       form.phone.trim(),
        company:     form.company.trim(),
        updatedAt:   new Date(),
      });
      showToast("Profile saved successfully");
    } catch (err) {
      showToast("Failed to save profile", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={styles.formGrid}>
      <Field label="Full Name" error={errors.displayName}>
        <Input
          icon={ICONS.user}
          value={form.displayName}
          onChange={set("displayName")}
          placeholder="Your full name"
        />
      </Field>

      <Field label="Email Address">
        <Input
          icon={ICONS.mail}
          value={currentUser?.email ?? ""}
          disabled
          placeholder="—"
        />
        <span style={styles.fieldHint}>Email cannot be changed here — contact platform owner.</span>
      </Field>

      <Field label="Phone Number" error={errors.phone}>
        <Input
          icon={ICONS.phone}
          value={form.phone}
          onChange={set("phone")}
          placeholder="+91 98765 43210"
        />
      </Field>

      <Field label="Company / Team">
        <Input
          icon={ICONS.building}
          value={form.company}
          onChange={set("company")}
          placeholder="Your company name"
        />
      </Field>

      <div style={styles.formFooter}>
        <button
          style={{ ...styles.saveBtn, opacity: saving ? 0.6 : 1 }}
          onClick={save}
          disabled={saving}
        >
          <Icon d={ICONS.save} size={15} color="#121212" />
          {saving ? "Saving…" : "Save Profile"}
        </button>
      </div>
    </div>
  );
};

// ── Security Tab ─────────────────────────────────────────────────────────────
const SecurityTab = ({ currentUser, showToast }) => {
  const [form, setForm] = useState({
    currentPassword: "",
    newPassword:     "",
    confirmPassword: "",
  });
  const [show, setShow] = useState({ current: false, new: false, confirm: false });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const toggleShow = (k) => setShow((s) => ({ ...s, [k]: !s[k] }));

  const eyeBtn = (k) => (
    <button
      type="button"
      onClick={() => toggleShow(k)}
      style={styles.eyeBtn}
      tabIndex={-1}
    >
      <Icon d={show[k] ? ICONS.eyeOff : ICONS.eye} size={15} color="#888" />
    </button>
  );

  const validate = () => {
    const errs = {};
    if (!form.currentPassword) errs.currentPassword = "Enter your current password";
    if (form.newPassword.length < 8) errs.newPassword = "Minimum 8 characters";
    if (form.newPassword !== form.confirmPassword) errs.confirmPassword = "Passwords do not match";
    return errs;
  };

  const save = async () => {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setSaving(true);
    try {
      const credential = EmailAuthProvider.credential(
        currentUser.email,
        form.currentPassword
      );
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, form.newPassword);
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      showToast("Password updated successfully");
    } catch (err) {
      if (err.code === "auth/wrong-password") {
        setErrors({ currentPassword: "Incorrect current password" });
      } else {
        showToast("Failed to update password", "error");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={styles.formGrid}>
      <div style={styles.securityNote}>
        <Icon d={ICONS.shield} size={15} color="#F2A65A" />
        Password must be at least 8 characters. You will stay signed in after changing.
      </div>

      <Field label="Current Password" error={errors.currentPassword}>
        <Input
          icon={ICONS.lock}
          type={show.current ? "text" : "password"}
          value={form.currentPassword}
          onChange={set("currentPassword")}
          placeholder="Enter current password"
          rightEl={eyeBtn("current")}
        />
      </Field>

      <Field label="New Password" error={errors.newPassword}>
        <Input
          icon={ICONS.lock}
          type={show.new ? "text" : "password"}
          value={form.newPassword}
          onChange={set("newPassword")}
          placeholder="Minimum 8 characters"
          rightEl={eyeBtn("new")}
        />
      </Field>

      <Field label="Confirm New Password" error={errors.confirmPassword}>
        <Input
          icon={ICONS.lock}
          type={show.confirm ? "text" : "password"}
          value={form.confirmPassword}
          onChange={set("confirmPassword")}
          placeholder="Repeat new password"
          rightEl={eyeBtn("confirm")}
        />
      </Field>

      <div style={styles.formFooter}>
        <button
          style={{ ...styles.saveBtn, opacity: saving ? 0.6 : 1 }}
          onClick={save}
          disabled={saving}
        >
          <Icon d={ICONS.shield} size={15} color="#121212" />
          {saving ? "Updating…" : "Update Password"}
        </button>
      </div>
    </div>
  );
};

// ── Notifications Tab ────────────────────────────────────────────────────────
const NotificationsTab = ({ currentUser, userProfile, showToast }) => {
  const defaults = NOTIF_PREFS.reduce((acc, p) => ({ ...acc, [p.key]: true }), {});
  const [prefs, setPrefs] = useState({
    ...defaults,
    ...(userProfile?.notificationPrefs ?? {}),
  });
  const [saving, setSaving] = useState(false);

  const toggle = (key) => setPrefs((p) => ({ ...p, [key]: !p[key] }));

  const save = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, "users", currentUser.uid), {
        notificationPrefs: prefs,
        updatedAt: new Date(),
      });
      showToast("Notification preferences saved");
    } catch {
      showToast("Failed to save preferences", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <p style={styles.notifHeading}>In-app notification preferences</p>
      <div style={styles.notifList}>
        {NOTIF_PREFS.map((pref) => (
          <div key={pref.key} style={styles.notifRow}>
            <div style={styles.notifInfo}>
              <span style={styles.notifLabel}>{pref.label}</span>
              <span style={styles.notifDesc}>{pref.desc}</span>
            </div>
            <Toggle
              checked={prefs[pref.key] ?? true}
              onChange={() => toggle(pref.key)}
            />
          </div>
        ))}
      </div>

      <div style={styles.formFooter}>
        <button
          style={{ ...styles.saveBtn, opacity: saving ? 0.6 : 1 }}
          onClick={save}
          disabled={saving}
        >
          <Icon d={ICONS.save} size={15} color="#121212" />
          {saving ? "Saving…" : "Save Preferences"}
        </button>
      </div>
    </div>
  );
};

// ── Styles ───────────────────────────────────────────────────────────────────
const styles = {
  page: {
    minHeight: "100vh",
    background: "#121212",
    color: "#F5F5F5",
    fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
    padding: "32px 24px",
    maxWidth: 680,
    margin: "0 auto",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 18,
    marginBottom: 32,
  },
  avatarLarge: {
    width: 64,
    height: 64,
    borderRadius: 16,
    background: "linear-gradient(135deg, #B65E3C, #7A3520)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 22,
    fontWeight: 700,
    color: "#F5F5F5",
    flexShrink: 0,
    letterSpacing: "0.5px",
  },
  title: {
    margin: 0,
    fontSize: 22,
    fontWeight: 700,
    letterSpacing: "-0.3px",
  },
  subtitle: {
    margin: "5px 0 0",
    fontSize: 13,
    color: "#AAAAAA",
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  rolePill: {
    display: "inline-block",
    padding: "2px 9px",
    borderRadius: 5,
    background: "#1E1510",
    border: "1px solid #B65E3C44",
    color: "#F2A65A",
    fontSize: 11,
    fontWeight: 600,
    textTransform: "capitalize",
  },
  tabs: {
    display: "flex",
    gap: 6,
    marginBottom: 28,
    borderBottom: "1px solid #222",
    paddingBottom: 0,
  },
  tab: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    padding: "10px 16px",
    borderRadius: "8px 8px 0 0",
    border: "none",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    transition: "all 0.15s",
    marginBottom: -1,
  },
  tabActive: {
    background: "#1E1510",
    color: "#F2A65A",
    borderBottom: "2px solid #B65E3C",
  },
  tabInactive: {
    background: "transparent",
    color: "#AAAAAA",
  },
  toast: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 14px",
    borderRadius: 8,
    border: "1px solid",
    fontSize: 13,
    marginBottom: 20,
    fontWeight: 500,
  },
  panel: {
    background: "#1A1A1A",
    border: "1px solid #2A2A2A",
    borderRadius: 12,
    padding: "24px",
  },
  formGrid: {
    display: "flex",
    flexDirection: "column",
    gap: 20,
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
  fieldHint: {
    fontSize: 11,
    color: "#666",
    marginTop: 4,
  },
  inputWrap: {
    position: "relative",
    display: "flex",
    alignItems: "center",
  },
  inputIcon: {
    position: "absolute",
    left: 12,
    display: "flex",
    alignItems: "center",
    pointerEvents: "none",
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
    transition: "border-color 0.15s",
    boxSizing: "border-box",
  },
  inputRight: {
    position: "absolute",
    right: 10,
    display: "flex",
    alignItems: "center",
  },
  eyeBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: 4,
    display: "flex",
    alignItems: "center",
  },
  securityNote: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 14px",
    borderRadius: 8,
    background: "#1E1808",
    border: "1px solid #F2A65A22",
    fontSize: 13,
    color: "#AAAAAA",
  },
  formFooter: {
    marginTop: 8,
    display: "flex",
    justifyContent: "flex-end",
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
    transition: "opacity 0.15s",
    letterSpacing: "0.2px",
  },
  notifHeading: {
    margin: "0 0 18px",
    fontSize: 13,
    color: "#888",
    fontWeight: 500,
  },
  notifList: {
    display: "flex",
    flexDirection: "column",
    gap: 0,
  },
  notifRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 0",
    borderBottom: "1px solid #222",
    gap: 16,
  },
  notifInfo: {
    display: "flex",
    flexDirection: "column",
    gap: 3,
  },
  notifLabel: {
    fontSize: 14,
    fontWeight: 500,
    color: "#F5F5F5",
  },
  notifDesc: {
    fontSize: 12,
    color: "#888",
  },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    border: "none",
    cursor: "pointer",
    position: "relative",
    transition: "background 0.2s",
    flexShrink: 0,
    padding: 0,
  },
  toggleThumb: {
    position: "absolute",
    top: 2,
    width: 20,
    height: 20,
    borderRadius: "50%",
    background: "#F5F5F5",
    transition: "transform 0.2s",
    boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
  },
};

export default ProfileSettings;
