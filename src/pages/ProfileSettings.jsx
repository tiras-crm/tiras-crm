import { useState, useCallback } from "react";
import {
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import {
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from "firebase/auth";
import { db, COLLECTIONS } from "../firebase";
import { useAuth } from "../contexts/AuthContext";

/* ─────────────────────────────────────────────────────────────────────────────
   TIRAS CRM V2 — ProfileSettings
   Theme: Obsidian Gold  |  Route: /profile  |  All roles
   3 tabs: Profile · Security · Notifications
   Fully mobile responsive · Toast on every write · Skeleton on load
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
  text:       "#F5F5F5",
  textSec:    "#9A9A9A",
  textMuted:  "#555555",
};

// ── Global styles ─────────────────────────────────────────────────────────────
const STYLE_ID = "tiras-v2-ps";
if (typeof document !== "undefined" && !document.getElementById(STYLE_ID)) {
  const s = document.createElement("style");
  s.id = STYLE_ID;
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:wght@400;500;600;700&display=swap');

    @keyframes ps-up    { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
    @keyframes ps-toast { from { transform:translateX(110%); opacity:0; } to { transform:translateX(0); opacity:1; } }

    .ps-up     { animation: ps-up .42s ease both; }
    .ps-tab    { transition: all .15s; border:none; cursor:pointer; }
    .ps-tab:hover { color: #D4AF37 !important; }
    .ps-input:focus { border-color: #D4AF37 !important; outline: none; box-shadow: 0 0 0 3px rgba(212,175,55,0.12); }
    .ps-btn-primary:hover  { filter:brightness(1.08); transform:translateY(-1px); }
    .ps-btn-primary  { transition:all .15s; }
    .ps-btn-ghost:hover    { border-color:#D4AF37 !important; color:#D4AF37 !important; }
    .ps-btn-ghost    { transition:all .15s; }
    .ps-toggle { transition:background .2s; }
    .ps-toggle-thumb { transition:transform .2s; }
    .ps-toast {
      position:fixed; bottom:24px; right:24px; z-index:9999;
      display:flex; align-items:center; gap:10px; padding:12px 18px;
      border-radius:10px; font-family:'DM Sans',sans-serif; font-size:13px; font-weight:600;
      box-shadow:0 8px 32px rgba(0,0,0,.5); animation:ps-toast .3s ease both;
    }

    @media (max-width:640px) {
      .ps-tabs    { overflow-x:auto; scrollbar-width:none; }
      .ps-two-col { grid-template-columns:1fr !important; }
      .ps-header  { flex-direction:column !important; gap:14px !important; }
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
  user:    "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
  shield:  "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  bell:    "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0",
  lock:    "M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2zM7 11V7a5 5 0 0 1 10 0v4",
  eye:     "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  eyeOff:  "M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22",
  mail:    "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6",
  phone:   "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13 19.79 19.79 0 0 1 1.61 4.37 2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.18 6.18",
  build:   "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 22V12h6v10",
  save:    "M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2zM17 21v-8H7v8M7 3v5h8",
  check:   "M20 6L9 17l-5-5",
  alert:   "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01",
  calendar:"M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 0 2-2z",
  ticket:  "M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z",
  mic:     "M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8",
  dollar:  "M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  wallet:  "M21 12V7H5a2 2 0 0 1 0-4h14v4M21 12a2 2 0 0 1 0 4H5a2 2 0 0 1 0-4h16v4",
};

// ── Notification prefs config ─────────────────────────────────────────────────
const NOTIF_PREFS = [
  { key: "followUpReminder",  icon: D.calendar, label: "Follow-up reminders",       desc: "Before a scheduled follow-up is due"               },
  { key: "leadAssigned",      icon: D.user,     label: "New lead assigned to me",    desc: "When a lead is assigned to your account"           },
  { key: "ticketUpdate",      icon: D.ticket,   label: "Ticket status changes",      desc: "When a ticket you raised changes stage"            },
  { key: "recordingReady",    icon: D.mic,      label: "Call recording ready",       desc: "After a call recording has been processed"        },
  { key: "paymentReceived",   icon: D.dollar,   label: "Payment received",           desc: "When a customer completes a Razorpay payment"     },
  { key: "lowBalance",        icon: D.wallet,   label: "Low wallet balance alerts",  desc: "When company wallet balance drops below ₹200"     },
  { key: "overdueFollowUp",   icon: D.alert,    label: "Overdue follow-up alerts",   desc: "When a scheduled follow-up passes without action" },
];

const ROLE_LABELS = {
  platform_owner: "Platform Owner",
  company_admin:  "Company Admin",
  manager:        "Manager",
  agent:          "Agent",
  support_agent:  "Support Agent",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const initials = (name = "") =>
  name.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");

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
    <div className="ps-toast" style={{
      background: err ? "#2A1215" : "#0F2A1E",
      border: `1px solid ${err ? C.red : C.green}44`,
      color: err ? C.red : C.green,
    }}>
      <Ic d={err ? D.alert : D.check} s={14} c={err ? C.red : C.green} />
      {t.msg}
    </div>
  );
};

const Label = ({ children }) => (
  <label style={{
    fontFamily: "DM Sans, sans-serif", fontSize: 11, fontWeight: 700,
    color: C.textSec, textTransform: "uppercase", letterSpacing: "0.7px",
    display: "block", marginBottom: 7,
  }}>{children}</label>
);

const FieldError = ({ msg }) =>
  msg ? <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 11, color: C.red, marginTop: 5 }}>{msg}</p> : null;

const Hint = ({ children }) => (
  <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 11, color: C.textMuted, marginTop: 5 }}>{children}</p>
);

const Input = ({ icon, type = "text", value, onChange, placeholder, disabled, rightEl, error }) => (
  <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
    {icon && (
      <span style={{ position: "absolute", left: 13, display: "flex", alignItems: "center", pointerEvents: "none" }}>
        <Ic d={icon} s={14} c={C.textMuted} />
      </span>
    )}
    <input
      className="ps-input"
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      style={{
        width: "100%", padding: `10px 14px 10px ${icon ? "40px" : "14px"}`,
        background: disabled ? C.surfaceHov : C.bg,
        border: `1px solid ${error ? C.red + "88" : C.border}`,
        borderRadius: 8, color: disabled ? C.textMuted : C.text,
        fontFamily: "DM Sans, sans-serif", fontSize: 14,
        transition: "border-color .15s", boxSizing: "border-box",
        cursor: disabled ? "not-allowed" : "text",
      }}
    />
    {rightEl && (
      <span style={{ position: "absolute", right: 12, display: "flex", alignItems: "center" }}>
        {rightEl}
      </span>
    )}
  </div>
);

const Toggle = ({ checked, onChange }) => (
  <button
    role="switch" aria-checked={checked}
    onClick={() => onChange(!checked)}
    className="ps-toggle"
    style={{
      width: 44, height: 24, borderRadius: 12, border: "none",
      background: checked ? C.gold : C.border,
      cursor: "pointer", position: "relative", flexShrink: 0, padding: 0,
    }}>
    <span className="ps-toggle-thumb" style={{
      position: "absolute", top: 2, width: 20, height: 20,
      borderRadius: "50%", background: checked ? "#000" : C.textMuted,
      transform: `translateX(${checked ? "22px" : "2px"})`,
      boxShadow: "0 1px 4px rgba(0,0,0,.4)",
    }} />
  </button>
);

const SectionPanel = ({ children }) => (
  <div style={{
    background: C.surface, border: `1px solid ${C.border}`,
    borderRadius: 12, padding: "24px", display: "flex", flexDirection: "column", gap: 22,
  }}>{children}</div>
);

const SaveBtn = ({ loading, label = "Save changes", icon = D.save, onClick }) => (
  <div style={{ display: "flex", justifyContent: "flex-end" }}>
    <button className="ps-btn-primary" onClick={onClick} disabled={loading}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "10px 22px", minHeight: 44, borderRadius: 8, border: "none",
        background: C.gold, color: "#000",
        fontFamily: "DM Sans, sans-serif", fontSize: 14, fontWeight: 700,
        cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1,
      }}>
      <Ic d={icon} s={14} c="#000" />
      {loading ? "Saving…" : label}
    </button>
  </div>
);

// ── Avatar ────────────────────────────────────────────────────────────────────
const Avatar = ({ name, role }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 28 }}>
    <div style={{
      width: 64, height: 64, borderRadius: 16, flexShrink: 0,
      background: `linear-gradient(140deg, ${C.gold} 0%, #8A7020 100%)`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "Playfair Display, serif", fontWeight: 700,
      fontSize: 24, color: "#000", letterSpacing: "-.5px",
      boxShadow: `0 0 24px ${C.goldMuted}`,
    }}>
      {initials(name) || "?"}
    </div>
    <div>
      <h1 style={{
        fontFamily: "Playfair Display, serif", fontWeight: 700,
        fontSize: 20, color: C.text, margin: 0, letterSpacing: "-.3px",
      }}>{name || "My Account"}</h1>
      <span style={{
        display: "inline-block", marginTop: 6, padding: "3px 10px",
        borderRadius: 20, background: C.goldMuted, border: `1px solid ${C.gold}33`,
        fontFamily: "DM Sans, sans-serif", fontSize: 11, fontWeight: 700,
        color: C.gold, textTransform: "capitalize", letterSpacing: ".3px",
      }}>{ROLE_LABELS[role] ?? role}</span>
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 1 — PROFILE
// ═══════════════════════════════════════════════════════════════════════════════
const ProfileTab = ({ currentUser, userProfile, showToast }) => {
  const [form, setForm] = useState({
    displayName: userProfile?.displayName ?? "",
    phone:       userProfile?.phone       ?? "",
    city:        userProfile?.city        ?? "",
    company:     userProfile?.company     ?? "",
  });
  const [errors,  setErrors]  = useState({});
  const [saving,  setSaving]  = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const validate = () => {
    const e = {};
    if (!form.displayName.trim())             e.displayName = "Full name is required";
    if (form.phone && !/^\+?[\d\s\-()+]{7,16}$/.test(form.phone))
      e.phone = "Enter a valid phone number";
    return e;
  };

  const save = async () => {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setSaving(true);
    try {
      await updateDoc(doc(db, COLLECTIONS.USERS, currentUser.uid), {
        displayName: form.displayName.trim(),
        phone:       form.phone.trim(),
        city:        form.city.trim(),
        company:     form.company.trim(),
        updatedAt:   serverTimestamp(),
      });
      showToast("Profile updated successfully");
    } catch {
      showToast("Failed to save profile", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionPanel>
      {/* Two-col grid on desktop */}
      <div className="ps-two-col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        <div>
          <Label>Full Name *</Label>
          <Input icon={D.user} value={form.displayName} onChange={set("displayName")} placeholder="Your full name" error={errors.displayName} />
          <FieldError msg={errors.displayName} />
        </div>
        <div>
          <Label>Email Address</Label>
          <Input icon={D.mail} value={currentUser?.email ?? ""} disabled />
          <Hint>Email cannot be changed here. Contact Platform Owner to update.</Hint>
        </div>
        <div>
          <Label>Phone Number</Label>
          <Input icon={D.phone} value={form.phone} onChange={set("phone")} placeholder="+91 98765 43210" error={errors.phone} />
          <FieldError msg={errors.phone} />
        </div>
        <div>
          <Label>City</Label>
          <Input icon={D.build} value={form.city} onChange={set("city")} placeholder="Bengaluru, Hyderabad…" />
        </div>
      </div>

      <div>
        <Label>Company / Team</Label>
        <Input icon={D.build} value={form.company} onChange={set("company")} placeholder="Company or team name" />
      </div>

      {/* Role — read only */}
      <div style={{ padding: "12px 14px", borderRadius: 8, background: C.bg, border: `1px solid ${C.border}` }}>
        <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 12, color: C.textMuted, margin: "0 0 3px", textTransform: "uppercase", letterSpacing: ".6px", fontWeight: 700 }}>Role</p>
        <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 14, color: C.textSec, margin: 0 }}>
          {ROLE_LABELS[userProfile?.role] ?? userProfile?.role ?? "—"} — read-only, set by Platform Owner
        </p>
      </div>

      <SaveBtn loading={saving} onClick={save} />
    </SectionPanel>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 2 — SECURITY (multi-step password change)
// ═══════════════════════════════════════════════════════════════════════════════
const SecurityTab = ({ currentUser, showToast }) => {
  const [step,    setStep]    = useState(1); // 1=enter current | 2=enter new | 3=success
  const [form,    setForm]    = useState({ current: "", newPw: "", confirm: "" });
  const [show,    setShow]    = useState({ current: false, newPw: false, confirm: false });
  const [errors,  setErrors]  = useState({});
  const [saving,  setSaving]  = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const toggleShow = (k) => setShow((s) => ({ ...s, [k]: !s[k] }));
  const eye = (k) => (
    <button type="button" onClick={() => toggleShow(k)}
      style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: 3 }}>
      <Ic d={show[k] ? D.eyeOff : D.eye} s={15} c={C.textMuted} />
    </button>
  );

  const verifyStep1 = async () => {
    if (!form.current) { setErrors({ current: "Enter your current password" }); return; }
    setSaving(true);
    try {
      const cred = EmailAuthProvider.credential(currentUser.email, form.current);
      await reauthenticateWithCredential(currentUser, cred);
      setErrors({});
      setStep(2);
    } catch (err) {
      const msg = err.code === "auth/wrong-password" || err.code === "auth/invalid-credential"
        ? "Incorrect password" : "Verification failed — try again";
      setErrors({ current: msg });
    } finally {
      setSaving(false);
    }
  };

  const saveStep2 = async () => {
    const e = {};
    if (form.newPw.length < 8)           e.newPw   = "Minimum 8 characters";
    if (form.newPw !== form.confirm)      e.confirm = "Passwords do not match";
    if (form.newPw === form.current)      e.newPw   = "New password must differ from current";
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({});
    setSaving(true);
    try {
      await updatePassword(currentUser, form.newPw);
      setStep(3);
      showToast("Password updated successfully");
    } catch {
      showToast("Failed to update password", "error");
    } finally {
      setSaving(false);
    }
  };

  const reset = () => { setStep(1); setForm({ current: "", newPw: "", confirm: "" }); setErrors({}); };

  // Step indicator
  const StepPill = ({ n, label, active, done }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, opacity: (!active && !done) ? 0.4 : 1 }}>
      <div style={{
        width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
        background: done ? C.green : active ? C.gold : C.border,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "DM Sans, sans-serif", fontSize: 11, fontWeight: 700,
        color: (done || active) ? "#000" : C.textMuted,
      }}>
        {done ? <Ic d={D.check} s={13} c="#000" /> : n}
      </div>
      <span style={{ fontFamily: "DM Sans, sans-serif", fontSize: 12, fontWeight: 600, color: active ? C.gold : done ? C.green : C.textMuted }}>
        {label}
      </span>
    </div>
  );

  return (
    <SectionPanel>
      {/* Step indicator */}
      <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
        <StepPill n={1} label="Verify identity"   active={step === 1} done={step > 1} />
        <div style={{ flex: 1, height: 1, background: C.border, minWidth: 20 }} />
        <StepPill n={2} label="Set new password"  active={step === 2} done={step > 2} />
        <div style={{ flex: 1, height: 1, background: C.border, minWidth: 20 }} />
        <StepPill n={3} label="Done"              active={step === 3} done={step === 3} />
      </div>

      {/* Step 1 */}
      {step === 1 && (
        <div className="ps-up" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ padding: "12px 16px", borderRadius: 8, background: C.goldMuted, border: `1px solid ${C.gold}30` }}>
            <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 13, color: C.textSec, margin: 0, lineHeight: 1.6 }}>
              For security, confirm your current password before setting a new one.
            </p>
          </div>
          <div>
            <Label>Current Password</Label>
            <Input icon={D.lock} type={show.current ? "text" : "password"}
              value={form.current} onChange={set("current")}
              placeholder="Enter current password" error={errors.current}
              rightEl={eye("current")} />
            <FieldError msg={errors.current} />
          </div>
          <SaveBtn loading={saving} label="Verify & continue" icon={D.shield} onClick={verifyStep1} />
        </div>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <div className="ps-up" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <Label>New Password</Label>
            <Input icon={D.lock} type={show.newPw ? "text" : "password"}
              value={form.newPw} onChange={set("newPw")}
              placeholder="Minimum 8 characters" error={errors.newPw}
              rightEl={eye("newPw")} />
            <FieldError msg={errors.newPw} />
            {/* Strength indicator */}
            {form.newPw && (
              <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
                {[8, 12, 16].map((min, i) => (
                  <div key={i} style={{
                    height: 3, flex: 1, borderRadius: 2,
                    background: form.newPw.length >= min
                      ? i === 0 ? C.red : i === 1 ? "#F59E0B" : C.green
                      : C.border,
                    transition: "background .2s",
                  }} />
                ))}
                <span style={{ fontFamily: "DM Sans, sans-serif", fontSize: 10, color: C.textMuted, marginLeft: 6, alignSelf: "center" }}>
                  {form.newPw.length < 8 ? "Weak" : form.newPw.length < 12 ? "Fair" : form.newPw.length < 16 ? "Good" : "Strong"}
                </span>
              </div>
            )}
          </div>
          <div>
            <Label>Confirm New Password</Label>
            <Input icon={D.lock} type={show.confirm ? "text" : "password"}
              value={form.confirm} onChange={set("confirm")}
              placeholder="Repeat new password" error={errors.confirm}
              rightEl={eye("confirm")} />
            <FieldError msg={errors.confirm} />
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button className="ps-btn-ghost" onClick={() => setStep(1)}
              style={{
                padding: "10px 18px", minHeight: 44, borderRadius: 8,
                border: `1px solid ${C.border}`, background: "transparent",
                color: C.textSec, fontFamily: "DM Sans, sans-serif",
                fontSize: 14, fontWeight: 600, cursor: "pointer",
              }}>← Back</button>
            <SaveBtn loading={saving} label="Update password" icon={D.shield} onClick={saveStep2} />
          </div>
        </div>
      )}

      {/* Step 3 — success */}
      {step === 3 && (
        <div className="ps-up" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "32px 0" }}>
          <div style={{
            width: 60, height: 60, borderRadius: "50%",
            background: C.greenMuted, border: `1px solid ${C.green}44`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Ic d={D.check} s={28} c={C.green} />
          </div>
          <p style={{ fontFamily: "Playfair Display, serif", fontWeight: 700, fontSize: 17, color: C.text, margin: 0 }}>
            Password updated
          </p>
          <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 13, color: C.textSec, margin: 0 }}>
            You will stay signed in on this device.
          </p>
          <button className="ps-btn-ghost" onClick={reset}
            style={{
              padding: "9px 20px", borderRadius: 8,
              border: `1px solid ${C.border}`, background: "transparent",
              color: C.textSec, fontFamily: "DM Sans, sans-serif",
              fontSize: 13, fontWeight: 600, cursor: "pointer", minHeight: 40,
            }}>Change again</button>
        </div>
      )}
    </SectionPanel>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 3 — NOTIFICATION PREFERENCES
// ═══════════════════════════════════════════════════════════════════════════════
const NotifTab = ({ currentUser, userProfile, showToast }) => {
  const defaults = NOTIF_PREFS.reduce((acc, p) => ({ ...acc, [p.key]: true }), {});
  const [prefs,  setPrefs]  = useState({ ...defaults, ...(userProfile?.notificationPrefs ?? {}) });
  const [saving, setSaving] = useState(false);

  const toggle = (key) => setPrefs((p) => ({ ...p, [key]: !p[key] }));

  const save = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, COLLECTIONS.USERS, currentUser.uid), {
        notificationPrefs: prefs,
        updatedAt:         serverTimestamp(),
      });
      showToast("Notification preferences saved");
    } catch {
      showToast("Failed to save preferences", "error");
    } finally {
      setSaving(false);
    }
  };

  const enabledCount = Object.values(prefs).filter(Boolean).length;

  return (
    <SectionPanel>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 13, color: C.textSec, margin: 0 }}>
          In-app notifications — {enabledCount} of {NOTIF_PREFS.length} enabled
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="ps-btn-ghost"
            onClick={() => setPrefs(NOTIF_PREFS.reduce((a, p) => ({ ...a, [p.key]: true }), {}))}
            style={{ padding: "6px 12px", borderRadius: 7, border: `1px solid ${C.border}`, background: "transparent", color: C.textSec, fontFamily: "DM Sans, sans-serif", fontSize: 12, fontWeight: 600, cursor: "pointer", minHeight: 32 }}>
            Enable all
          </button>
          <button className="ps-btn-ghost"
            onClick={() => setPrefs(NOTIF_PREFS.reduce((a, p) => ({ ...a, [p.key]: false }), {}))}
            style={{ padding: "6px 12px", borderRadius: 7, border: `1px solid ${C.border}`, background: "transparent", color: C.textSec, fontFamily: "DM Sans, sans-serif", fontSize: 12, fontWeight: 600, cursor: "pointer", minHeight: 32 }}>
            Disable all
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {NOTIF_PREFS.map((pref, i) => (
          <div key={pref.key} style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "14px 0", gap: 14,
            borderBottom: i < NOTIF_PREFS.length - 1 ? `1px solid ${C.border}` : "none",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                background: prefs[pref.key] ? C.goldMuted : C.surfaceHov,
                border: `1px solid ${prefs[pref.key] ? C.gold + "33" : C.border}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all .2s",
              }}>
                <Ic d={pref.icon} s={15} c={prefs[pref.key] ? C.gold : C.textMuted} />
              </div>
              <div>
                <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 14, fontWeight: 600, color: C.text, margin: 0 }}>
                  {pref.label}
                </p>
                <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 12, color: C.textSec, margin: "2px 0 0" }}>
                  {pref.desc}
                </p>
              </div>
            </div>
            <Toggle checked={prefs[pref.key] ?? true} onChange={() => toggle(pref.key)} />
          </div>
        ))}
      </div>

      <SaveBtn loading={saving} onClick={save} />
    </SectionPanel>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT EXPORT
// ═══════════════════════════════════════════════════════════════════════════════
export const ProfileSettings = () => {
  const { currentUser, userProfile } = useAuth();
  const [activeTab, setActiveTab]   = useState("profile");
  const [toast, showToast]          = useToast();

  const TABS = [
    { key: "profile",  label: "Profile",       icon: D.user   },
    { key: "security", label: "Security",       icon: D.shield },
    { key: "notifs",   label: "Notifications",  icon: D.bell   },
  ];

  // Loading state while auth resolves
  if (!currentUser) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontFamily: "DM Sans, sans-serif", fontSize: 14, color: C.textSec }}>Loading…</div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh", background: C.bg,
      fontFamily: "DM Sans, sans-serif",
      padding: "28px 20px 64px",
      maxWidth: 700, margin: "0 auto",
    }}>

      {/* Avatar header */}
      <Avatar name={userProfile?.displayName ?? currentUser?.email} role={userProfile?.role} />

      {/* Tabs */}
      <div className="ps-tabs" style={{ display: "flex", gap: 4, marginBottom: 20 }}>
        {TABS.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button key={tab.key} className="ps-tab"
              onClick={() => setActiveTab(tab.key)}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "10px 18px", minHeight: 44, borderRadius: 8,
                border: `1px solid ${active ? C.gold + "55" : C.border}`,
                background: active ? C.goldMuted : C.surface,
                color: active ? C.gold : C.textSec,
                fontFamily: "DM Sans, sans-serif", fontSize: 13, fontWeight: 600,
                whiteSpace: "nowrap",
              }}>
              <Ic d={tab.icon} s={14} c={active ? C.gold : C.textSec} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab panels */}
      <div className="ps-up">
        {activeTab === "profile" && (
          <ProfileTab currentUser={currentUser} userProfile={userProfile} showToast={showToast} />
        )}
        {activeTab === "security" && (
          <SecurityTab currentUser={currentUser} showToast={showToast} />
        )}
        {activeTab === "notifs" && (
          <NotifTab currentUser={currentUser} userProfile={userProfile} showToast={showToast} />
        )}
      </div>

      <Toast t={toast} />
    </div>
  );
};

export default ProfileSettings;
