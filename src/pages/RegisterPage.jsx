// TIRAS CRM V2 — Register Page
// Route: /register
// 3-step flow: Company Details → Admin Account → Confirmation
// Creates Firebase Auth user + Firestore company + user documents
// Starts 14-day trial immediately on submit

import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { auth, db, COLLECTIONS } from "../firebase";
import {
  COLORS, FONTS, SPACING, RADIUS, SHADOWS, TRANSITIONS, STYLES,
} from "../theme";

// ─── Keyframes ────────────────────────────────────────────────────────────────
const injectStyles = () => {
  if (document.getElementById("tiras-register-styles")) return;
  const s = document.createElement("style");
  s.id = "tiras-register-styles";
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:wght@400;500;600;700&display=swap');
    @keyframes reg-fade-in { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
    @keyframes reg-spin { 0%{transform:rotate(0deg);} 100%{transform:rotate(360deg);} }
    .reg-input:focus { border-color: ${COLORS.primary} !important; outline: none; box-shadow: 0 0 0 2px rgba(212,175,55,0.15); }
    .reg-input::placeholder { color: ${COLORS.textMuted}; }
    .reg-select { appearance: none; }
    .reg-btn-primary:hover { background-color: ${COLORS.primaryHover} !important; transform: translateY(-1px); }
    .reg-btn-primary:active { transform: translateY(0); }
    .reg-btn-secondary:hover { border-color: ${COLORS.primary} !important; color: ${COLORS.primary} !important; }
  `;
  document.head.appendChild(s);
};

// ─── Constants ────────────────────────────────────────────────────────────────

const INDUSTRIES = [
  "Staffing & Recruitment", "Real Estate", "EdTech / Education", "Healthcare",
  "Manufacturing", "IT & Technology", "FMCG / Retail", "Financial Services",
  "Logistics & Transport", "Construction", "Hospitality", "Other",
];

const TRIAL_DAYS = 14;

// ─── Field component ──────────────────────────────────────────────────────────

const Field = ({ label, error, children, required }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: SPACING.xs }}>
    <label style={{
      fontFamily:  FONTS.body,
      fontSize:    FONTS.size.sm,
      fontWeight:  FONTS.weight.medium,
      color:       COLORS.textSecondary,
    }}>
      {label}{required && <span style={{ color: COLORS.accent, marginLeft: "2px" }}>*</span>}
    </label>
    {children}
    {error && (
      <span style={{ fontFamily: FONTS.body, fontSize: FONTS.size.xs, color: COLORS.accent }}>
        {error}
      </span>
    )}
  </div>
);

const inputStyle = {
  ...STYLES.input,
  fontFamily: FONTS.body,
};

// ─── Step indicator ───────────────────────────────────────────────────────────

const StepIndicator = ({ current, total }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: SPACING.sm, marginBottom: SPACING["2xl"] }}>
    {Array.from({ length: total }, (_, i) => i + 1).map((step) => (
      <React.Fragment key={step}>
        <div style={{
          width:           step === current ? "32px" : "28px",
          height:          step === current ? "32px" : "28px",
          borderRadius:    RADIUS.full,
          backgroundColor: step < current
            ? COLORS.primary
            : step === current
            ? COLORS.primary
            : COLORS.border,
          color:           step <= current ? COLORS.primaryText : COLORS.textMuted,
          display:         "flex",
          alignItems:      "center",
          justifyContent:  "center",
          fontFamily:      FONTS.body,
          fontSize:        FONTS.size.sm,
          fontWeight:      FONTS.weight.bold,
          transition:      TRANSITIONS.base,
          boxShadow:       step === current ? `0 0 12px rgba(212,175,55,0.4)` : "none",
        }}>
          {step < current ? "✓" : step}
        </div>
        {step < total && (
          <div style={{
            height:          "2px",
            width:           "40px",
            backgroundColor: step < current ? COLORS.primary : COLORS.border,
            borderRadius:    "2px",
            transition:      TRANSITIONS.base,
          }} />
        )}
      </React.Fragment>
    ))}
  </div>
);

// ─── Step 1 — Company Details ─────────────────────────────────────────────────

const Step1 = ({ data, onChange, errors, onNext }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: SPACING.lg }}>
    <div>
      <h2 style={{ fontFamily: FONTS.heading, fontSize: "22px", fontWeight: 700, color: COLORS.textPrimary, margin: 0 }}>
        Company Details
      </h2>
      <p style={{ fontFamily: FONTS.body, fontSize: FONTS.size.base, color: COLORS.textSecondary, marginTop: SPACING.xs }}>
        Tell us about your business
      </p>
    </div>

    <Field label="Company Name" error={errors.companyName} required>
      <input
        className="reg-input"
        style={inputStyle}
        placeholder="e.g. MAINDSOURCE LLP"
        value={data.companyName}
        onChange={(e) => onChange("companyName", e.target.value)}
      />
    </Field>

    <Field label="GST Number" error={errors.gstNumber} required>
      <input
        className="reg-input"
        style={inputStyle}
        placeholder="e.g. 29ABCDE1234F1Z5"
        value={data.gstNumber}
        onChange={(e) => onChange("gstNumber", e.target.value.toUpperCase())}
        maxLength={15}
      />
    </Field>

    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: SPACING.base }}>
      <Field label="City" error={errors.city}>
        <input
          className="reg-input"
          style={inputStyle}
          placeholder="e.g. Bangalore"
          value={data.city}
          onChange={(e) => onChange("city", e.target.value)}
        />
      </Field>

      <Field label="Industry" error={errors.industry} required>
        <select
          className="reg-input reg-select"
          style={{ ...inputStyle, cursor: "pointer" }}
          value={data.industry}
          onChange={(e) => onChange("industry", e.target.value)}
        >
          <option value="">Select industry</option>
          {INDUSTRIES.map((ind) => (
            <option key={ind} value={ind}>{ind}</option>
          ))}
        </select>
      </Field>
    </div>

    <button className="reg-btn-primary" style={{ ...STYLES.buttonPrimary, width: "100%", marginTop: SPACING.sm }} onClick={onNext}>
      Continue →
    </button>
  </div>
);

// ─── Step 2 — Admin Account ───────────────────────────────────────────────────

const Step2 = ({ data, onChange, errors, onNext, onBack, loading }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: SPACING.lg }}>
    <div>
      <h2 style={{ fontFamily: FONTS.heading, fontSize: "22px", fontWeight: 700, color: COLORS.textPrimary, margin: 0 }}>
        Admin Account
      </h2>
      <p style={{ fontFamily: FONTS.body, fontSize: FONTS.size.base, color: COLORS.textSecondary, marginTop: SPACING.xs }}>
        Your login credentials for TIRAS
      </p>
    </div>

    <Field label="Full Name" error={errors.displayName} required>
      <input
        className="reg-input"
        style={inputStyle}
        placeholder="e.g. Surya Kiran"
        value={data.displayName}
        onChange={(e) => onChange("displayName", e.target.value)}
      />
    </Field>

    <Field label="Email Address" error={errors.email} required>
      <input
        className="reg-input"
        style={inputStyle}
        type="email"
        placeholder="e.g. admin@yourcompany.com"
        value={data.email}
        onChange={(e) => onChange("email", e.target.value)}
      />
    </Field>

    <Field label="Password" error={errors.password} required>
      <input
        className="reg-input"
        style={inputStyle}
        type="password"
        placeholder="Minimum 8 characters"
        value={data.password}
        onChange={(e) => onChange("password", e.target.value)}
      />
    </Field>

    <Field label="Confirm Password" error={errors.confirmPassword} required>
      <input
        className="reg-input"
        style={inputStyle}
        type="password"
        placeholder="Re-enter your password"
        value={data.confirmPassword}
        onChange={(e) => onChange("confirmPassword", e.target.value)}
      />
    </Field>

    {errors.submit && (
      <div style={{
        backgroundColor: COLORS.accentMuted,
        border:          `1px solid ${COLORS.accent}`,
        borderRadius:    RADIUS.md,
        padding:         SPACING.md,
        fontFamily:      FONTS.body,
        fontSize:        FONTS.size.sm,
        color:           COLORS.accent,
      }}>
        {errors.submit}
      </div>
    )}

    <div style={{ display: "flex", gap: SPACING.sm }}>
      <button className="reg-btn-secondary" style={{ ...STYLES.buttonSecondary, flex: 1 }} onClick={onBack} disabled={loading}>
        ← Back
      </button>
      <button
        className="reg-btn-primary"
        style={{ ...STYLES.buttonPrimary, flex: 2, opacity: loading ? 0.7 : 1, cursor: loading ? "not-allowed" : "pointer" }}
        onClick={onNext}
        disabled={loading}
      >
        {loading ? (
          <>
            <span style={{ width: "14px", height: "14px", borderRadius: "50%", border: "2px solid transparent", borderTop: `2px solid ${COLORS.primaryText}`, display: "inline-block", animation: "reg-spin 0.65s linear infinite" }} />
            Creating account…
          </>
        ) : "Create Account →"}
      </button>
    </div>
  </div>
);

// ─── Step 3 — Confirmation ────────────────────────────────────────────────────

const Step3 = ({ companyName, adminName, onGoToDashboard }) => {
  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS);
  const formattedEnd = trialEnd.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

  const features = [
    "Full lead management and pipeline",
    "AI-powered call summaries",
    "Support ticket system",
    "Team performance analytics",
    "WhatsApp integration",
    "All 31 pages — no restrictions",
  ];

  const excluded = [
    "Calling & recording (requires wallet top-up)",
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: SPACING.xl, textAlign: "center" }}>
      {/* Success icon */}
      <div style={{
        width:           "72px",
        height:          "72px",
        borderRadius:    RADIUS.full,
        backgroundColor: COLORS.successMuted,
        border:          `2px solid ${COLORS.success}`,
        display:         "flex",
        alignItems:      "center",
        justifyContent:  "center",
        margin:          "0 auto",
        fontSize:        "32px",
        boxShadow:       `0 0 24px rgba(16,185,129,0.2)`,
      }}>
        ✓
      </div>

      <div>
        <h2 style={{ fontFamily: FONTS.heading, fontSize: "24px", fontWeight: 700, color: COLORS.primary, margin: 0 }}>
          Welcome to TIRAS, {adminName.split(" ")[0]}!
        </h2>
        <p style={{ fontFamily: FONTS.body, fontSize: FONTS.size.base, color: COLORS.textSecondary, marginTop: SPACING.sm }}>
          {companyName} is now live on a 14-day free trial.
        </p>
      </div>

      {/* Trial info card */}
      <div style={{
        backgroundColor: COLORS.primaryMuted,
        border:          `1px solid rgba(212,175,55,0.3)`,
        borderRadius:    RADIUS.lg,
        padding:         SPACING.xl,
        textAlign:       "left",
      }}>
        <div style={{ fontFamily: FONTS.body, fontSize: FONTS.size.sm, fontWeight: FONTS.weight.semibold, color: COLORS.primary, marginBottom: SPACING.md, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Your 14-Day Trial — Until {formattedEnd}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: SPACING.sm }}>
          {features.map((f) => (
            <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: SPACING.sm, fontFamily: FONTS.body, fontSize: FONTS.size.sm, color: COLORS.textPrimary }}>
              <span style={{ color: COLORS.success, flexShrink: 0, marginTop: "1px" }}>✓</span>
              {f}
            </div>
          ))}
          {excluded.map((f) => (
            <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: SPACING.sm, fontFamily: FONTS.body, fontSize: FONTS.size.sm, color: COLORS.textMuted }}>
              <span style={{ flexShrink: 0, marginTop: "1px" }}>○</span>
              {f}
            </div>
          ))}
        </div>
      </div>

      <button
        className="reg-btn-primary"
        style={{ ...STYLES.buttonPrimary, width: "100%", fontSize: FONTS.size.lg }}
        onClick={onGoToDashboard}
      >
        Go to Dashboard →
      </button>

      <p style={{ fontFamily: FONTS.body, fontSize: FONTS.size.xs, color: COLORS.textMuted }}>
        Need help? WhatsApp Tony at +91 XXXXX XXXXX or open a ticket from the app.
      </p>
    </div>
  );
};

// ─── RegisterPage ─────────────────────────────────────────────────────────────

export const RegisterPage = () => {
  injectStyles();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [companyData, setCompanyData] = useState({
    companyName: "",
    gstNumber:   "",
    city:        "",
    industry:    "",
  });

  const [adminData, setAdminData] = useState({
    displayName:     "",
    email:           "",
    password:        "",
    confirmPassword: "",
  });

  const [errors, setErrors] = useState({});

  const updateCompany = (key, val) => {
    setCompanyData((prev) => ({ ...prev, [key]: val }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: "" }));
  };

  const updateAdmin = (key, val) => {
    setAdminData((prev) => ({ ...prev, [key]: val }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: "" }));
  };

  // ── Step 1 validation ──────────────────────────────────────────────────────

  const validateStep1 = () => {
    const errs = {};
    if (!companyData.companyName.trim()) errs.companyName = "Company name is required.";
    if (!companyData.gstNumber.trim()) {
      errs.gstNumber = "GST number is required.";
    } else if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(companyData.gstNumber)) {
      errs.gstNumber = "Enter a valid GST number (e.g. 29ABCDE1234F1Z5).";
    }
    if (!companyData.industry) errs.industry = "Please select your industry.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Step 2 validation ──────────────────────────────────────────────────────

  const validateStep2 = () => {
    const errs = {};
    if (!adminData.displayName.trim()) errs.displayName = "Full name is required.";
    if (!adminData.email.trim()) {
      errs.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(adminData.email)) {
      errs.email = "Enter a valid email address.";
    }
    if (!adminData.password) {
      errs.password = "Password is required.";
    } else if (adminData.password.length < 8) {
      errs.password = "Password must be at least 8 characters.";
    }
    if (adminData.password !== adminData.confirmPassword) {
      errs.confirmPassword = "Passwords do not match.";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Firebase registration ──────────────────────────────────────────────────

  const handleCreateAccount = async () => {
    if (!validateStep2()) return;
    setLoading(true);

    try {
      // 1. Create Firebase Auth user
      const credential = await createUserWithEmailAndPassword(
        auth,
        adminData.email.trim(),
        adminData.password
      );

      const uid = credential.user.uid;

      // 2. Update display name
      await updateProfile(credential.user, { displayName: adminData.displayName.trim() });

      // 3. Create company document
      const trialStart = Timestamp.now();
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + TRIAL_DAYS);
      const trialEnd = Timestamp.fromDate(trialEndDate);

      const companyRef = doc(db, COLLECTIONS.COMPANIES, uid); // Use UID as company ID for simplicity
      await setDoc(companyRef, {
        name:                 companyData.companyName.trim(),
        gstNumber:            companyData.gstNumber.trim(),
        city:                 companyData.city.trim(),
        industry:             companyData.industry,
        adminUid:             uid,
        adminEmail:           adminData.email.trim(),
        plan:                 "trial",
        subscriptionStatus:   "trial",
        trialStartDate:       trialStart,
        trialEndDate:         trialEnd,
        subscriptionStartDate: null,
        subscriptionEndDate:   null,
        wallet: {
          balance:         0,
          lowBalanceAlert: 200,
          currency:        "INR",
          lastRechargeDate: null,
        },
        storage: {
          usedGB:  0,
          limitGB: 5,
        },
        minutesUsedThisMonth: 0,
        createdAt:            serverTimestamp(),
      });

      // 4. Create user document
      await setDoc(doc(db, COLLECTIONS.USERS, uid), {
        uid,
        email:        adminData.email.trim(),
        displayName:  adminData.displayName.trim(),
        role:         "company_admin",
        companyId:    uid,
        managerId:    null,
        isActive:     true,
        createdAt:    serverTimestamp(),
        lastLoginAt:  serverTimestamp(),
      });

      setStep(3);

    } catch (err) {
      let msg = "Registration failed. Please try again.";
      if (err.code === "auth/email-already-in-use") msg = "This email is already registered. Try logging in.";
      if (err.code === "auth/weak-password") msg = "Password is too weak. Use at least 8 characters.";
      if (err.code === "auth/network-request-failed") msg = "Network error. Check your connection.";
      setErrors((prev) => ({ ...prev, submit: msg }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight:       "100vh",
      backgroundColor: COLORS.background,
      display:         "flex",
      alignItems:      "center",
      justifyContent:  "center",
      padding:         SPACING.xl,
      fontFamily:      FONTS.body,
    }}>
      <div style={{
        width:    "100%",
        maxWidth: "480px",
        animation:"reg-fade-in 0.4s ease",
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: SPACING["2xl"] }}>
          <div style={{
            display:         "inline-flex",
            alignItems:      "center",
            gap:             SPACING.sm,
            marginBottom:    SPACING.sm,
          }}>
            <div style={{
              width: "36px", height: "36px", borderRadius: RADIUS.md,
              backgroundColor: COLORS.primary,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: `0 0 16px rgba(212,175,55,0.3)`,
            }}>
              <span style={{ color: COLORS.primaryText, fontFamily: FONTS.heading, fontSize: "18px", fontWeight: 700 }}>T</span>
            </div>
            <span style={{ fontFamily: FONTS.heading, fontSize: "22px", fontWeight: 700, color: COLORS.primary }}>TIRAS CRM</span>
          </div>
          <p style={{ fontFamily: FONTS.body, fontSize: FONTS.size.sm, color: COLORS.textMuted, margin: 0 }}>
            Start your 14-day free trial
          </p>
        </div>

        {/* Card */}
        <div style={{
          backgroundColor: COLORS.surface,
          border:          `1px solid ${COLORS.border}`,
          borderRadius:    RADIUS.xl,
          padding:         SPACING["2xl"],
          boxShadow:       SHADOWS.lg,
        }}>
          {step < 3 && <StepIndicator current={step} total={2} />}

          {step === 1 && (
            <Step1
              data={companyData}
              onChange={updateCompany}
              errors={errors}
              onNext={() => { if (validateStep1()) setStep(2); }}
            />
          )}
          {step === 2 && (
            <Step2
              data={adminData}
              onChange={updateAdmin}
              errors={errors}
              onNext={handleCreateAccount}
              onBack={() => setStep(1)}
              loading={loading}
            />
          )}
          {step === 3 && (
            <Step3
              companyName={companyData.companyName}
              adminName={adminData.displayName}
              onGoToDashboard={() => navigate("/admin/dashboard")}
            />
          )}
        </div>

        {step < 3 && (
          <p style={{ textAlign: "center", marginTop: SPACING.xl, fontFamily: FONTS.body, fontSize: FONTS.size.sm, color: COLORS.textMuted }}>
            Already have an account?{" "}
            <Link to="/login" style={{ color: COLORS.primary, textDecoration: "none", fontWeight: FONTS.weight.semibold }}>
              Sign in
            </Link>
          </p>
        )}
      </div>
    </div>
  );
};

export default RegisterPage;
