// TIRAS CRM V2 — Subscribe Page
// Route: /subscribe
// Shown when trial ends OR subscription expires
// No sidebar, no navbar — clean centered page
// Displays 3 plan cards: Starter, Basic, Growth
// Calls Firebase Cloud Function to create Razorpay payment link

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { doc, onSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, COLLECTIONS, functions } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import {
  COLORS, FONTS, SPACING, RADIUS, SHADOWS, TRANSITIONS, STYLES, PLANS,
} from "../theme";

// ─── Inject styles ────────────────────────────────────────────────────────────
const injectStyles = () => {
  if (document.getElementById("tiras-subscribe-styles")) return;
  const s = document.createElement("style");
  s.id = "tiras-subscribe-styles";
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:wght@400;500;600;700&display=swap');
    @keyframes sub-fade { from{opacity:0;transform:translateY(16px);} to{opacity:1;transform:translateY(0);} }
    @keyframes sub-spin { 0%{transform:rotate(0deg);} 100%{transform:rotate(360deg);} }
    .plan-card { transition: all 0.2s ease; cursor: pointer; }
    .plan-card:hover { transform: translateY(-4px); box-shadow: 0 12px 40px rgba(0,0,0,0.6) !important; }
    .plan-card.featured { border-color: ${COLORS.primary} !important; }
    .sub-faq summary { cursor: pointer; list-style: none; }
    .sub-faq summary::-webkit-details-marker { display: none; }
  `;
  document.head.appendChild(s);
};

// ─── Plan Card ────────────────────────────────────────────────────────────────

const PlanCard = ({ planKey, plan, featured, onSubscribe, loading }) => {
  const isLoading = loading === planKey;

  const featureMap = {
    starter: [
      "3 agents + 1 manager",
      "5GB storage",
      "15-day recording retention",
      "AI call summaries",
      "Calling wallet system",
      "All lead management features",
      "Support tickets",
    ],
    basic: [
      "10 agents + 2 managers",
      "15GB storage",
      "30-day recording retention",
      "AI call summaries",
      "Calling wallet system",
      "All lead management features",
      "Reports & analytics",
      "Priority support",
    ],
    growth: [
      "Unlimited agents & managers",
      "50GB storage",
      "90-day recording retention",
      "AI call summaries",
      "Calling wallet system",
      "All lead management features",
      "Advanced reports & export",
      "Priority WhatsApp support",
    ],
  };

  const features = featureMap[planKey] || [];
  const priceFormatted = plan.price
    ? `₹${new Intl.NumberFormat("en-IN").format(plan.price)}`
    : "Custom";

  return (
    <div
      className={`plan-card${featured ? " featured" : ""}`}
      style={{
        backgroundColor: COLORS.surface,
        border:          `2px solid ${featured ? COLORS.primary : COLORS.border}`,
        borderRadius:    RADIUS.xl,
        padding:         SPACING["2xl"],
        display:         "flex",
        flexDirection:   "column",
        gap:             SPACING.base,
        position:        "relative",
        boxShadow:       featured ? SHADOWS.gold : SHADOWS.sm,
        minHeight:       "520px",
      }}
    >
      {/* Featured badge */}
      {featured && (
        <div style={{
          position:        "absolute",
          top:             "-14px",
          left:            "50%",
          transform:       "translateX(-50%)",
          backgroundColor: COLORS.primary,
          color:           COLORS.primaryText,
          fontFamily:      FONTS.body,
          fontSize:        FONTS.size.xs,
          fontWeight:      FONTS.weight.bold,
          padding:         `4px ${SPACING.base}`,
          borderRadius:    RADIUS.full,
          whiteSpace:      "nowrap",
          textTransform:   "uppercase",
          letterSpacing:   "0.06em",
        }}>
          Most Popular
        </div>
      )}

      {/* Plan name */}
      <div>
        <h3 style={{ fontFamily: FONTS.heading, fontSize: "20px", fontWeight: 700, color: featured ? COLORS.primary : COLORS.textPrimary, margin: 0 }}>
          {plan.name}
        </h3>
      </div>

      {/* Price */}
      <div style={{ display: "flex", alignItems: "baseline", gap: SPACING.xs }}>
        <span style={{ fontFamily: FONTS.heading, fontSize: "36px", fontWeight: 700, color: COLORS.textPrimary }}>
          {priceFormatted}
        </span>
        {plan.price && (
          <span style={{ fontFamily: FONTS.body, fontSize: FONTS.size.sm, color: COLORS.textSecondary }}>/year</span>
        )}
      </div>

      {/* Per month equivalent */}
      {plan.price && (
        <div style={{ fontFamily: FONTS.body, fontSize: FONTS.size.sm, color: COLORS.textMuted }}>
          ≈ ₹{Math.round(plan.price / 12).toLocaleString("en-IN")} per month
        </div>
      )}

      {/* Divider */}
      <div style={{ height: "1px", backgroundColor: COLORS.border }} />

      {/* Features */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: SPACING.sm }}>
        {features.map((feat) => (
          <div key={feat} style={{ display: "flex", alignItems: "flex-start", gap: SPACING.sm }}>
            <span style={{ color: COLORS.success, fontSize: FONTS.size.base, flexShrink: 0 }}>✓</span>
            <span style={{ fontFamily: FONTS.body, fontSize: FONTS.size.sm, color: COLORS.textSecondary, lineHeight: 1.5 }}>
              {feat}
            </span>
          </div>
        ))}
      </div>

      {/* CTA button */}
      <button
        onClick={() => onSubscribe(planKey, plan.price)}
        disabled={isLoading}
        style={{
          ...STYLES.buttonPrimary,
          width:           "100%",
          marginTop:       SPACING.md,
          opacity:         isLoading ? 0.7 : 1,
          cursor:          isLoading ? "not-allowed" : "pointer",
          backgroundColor: featured ? COLORS.primary : "transparent",
          color:           featured ? COLORS.primaryText : COLORS.primary,
          border:          featured ? "none" : `2px solid ${COLORS.primary}`,
          fontSize:        FONTS.size.md,
        }}
      >
        {isLoading ? (
          <>
            <span style={{ width: "14px", height: "14px", borderRadius: "50%", border: "2px solid transparent", borderTop: `2px solid currentColor`, display: "inline-block", animation: "sub-spin 0.65s linear infinite" }} />
            Processing…
          </>
        ) : plan.price ? `Subscribe — ${priceFormatted}/year` : "Contact for Pricing"}
      </button>

      {plan.price && (
        <p style={{ fontFamily: FONTS.body, fontSize: "11px", color: COLORS.textMuted, textAlign: "center", margin: 0 }}>
          Paid securely via Razorpay · 2% transaction fee applies
        </p>
      )}
    </div>
  );
};

// ─── FAQ ──────────────────────────────────────────────────────────────────────

const faqs = [
  { q: "What happens to my data after trial?", a: "Your data is safe. All leads, calls, and recordings are preserved. Only calling features are paused until you subscribe." },
  { q: "Is calling included in the plan?", a: "Calling is separate. You recharge a wallet (minimum ₹1,000) and are charged ₹1 per minute as you use it. No monthly lock." },
  { q: "Can I upgrade plans later?", a: "Yes. Contact Tony on WhatsApp and he'll upgrade your plan immediately. Difference is prorated." },
  { q: "What payment methods are accepted?", a: "All major cards, UPI (GPay, PhonePe, Paytm), net banking, and wallets via Razorpay." },
  { q: "Is there a refund policy?", a: "Annual plans are non-refundable. If you have a technical issue, contact Tony directly and it will be resolved within 2 hours." },
];

// ─── SubscribePage ────────────────────────────────────────────────────────────

export const SubscribePage = () => {
  injectStyles();

  const { currentUser, companyId } = useAuth();
  const navigate = useNavigate();

  const [company,  setCompany]  = useState(null);
  const [loading,  setLoading]  = useState(null);   // which plan is being processed
  const [error,    setError]    = useState(null);

  // Fetch company to show personalized expired message
  useEffect(() => {
    if (!companyId) return;
    const unsub = onSnapshot(
      doc(db, COLLECTIONS.COMPANIES, companyId),
      (snap) => { if (snap.exists()) setCompany({ id: snap.id, ...snap.data() }); }
    );
    return () => unsub();
  }, [companyId]);

  const handleSubscribe = async (planKey, priceINR) => {
    if (!priceINR) {
      // Enterprise — open WhatsApp
      window.open("https://wa.me/91XXXXXXXXXX?text=Hi%20Tony%2C%20I%20want%20to%20discuss%20TIRAS%20Enterprise%20pricing%20for%20" + encodeURIComponent(company?.name || "my company"), "_blank");
      return;
    }

    setLoading(planKey);
    setError(null);

    try {
      const createLink = httpsCallable(functions, "createRazorpayPaymentLink");
      const result = await createLink({
        amount_inr:      priceINR,
        description:     `TIRAS CRM — ${PLANS[planKey].name} Plan (Annual)`,
        customer_name:   company?.name || "Customer",
        customer_email:  currentUser?.email || "",
        customer_phone:  "",
        lead_id:         "",
        company_id:      companyId,
        agent_id:        currentUser?.uid,
        notes:           `Plan: ${planKey} | Company: ${company?.name}`,
      });

      const url = result.data?.payment_link_url || result.data?.short_url;
      if (url) {
        window.open(url, "_blank");
      } else {
        throw new Error("No payment link returned.");
      }

    } catch (err) {
      setError("Failed to generate payment link. Please WhatsApp Tony directly.");
    } finally {
      setLoading(null);
    }
  };

  const isTrialExpired      = company?.subscriptionStatus === "trial" && new Date() > company?.trialEndDate?.toDate?.();
  const isSubscriptionExpired = company?.subscriptionStatus === "expired";

  return (
    <div style={{
      minHeight:       "100vh",
      backgroundColor: COLORS.background,
      fontFamily:      FONTS.body,
      overflowX:       "hidden",
    }}>
      <div style={{
        maxWidth:  "1100px",
        margin:    "0 auto",
        padding:   `${SPACING["4xl"]} ${SPACING.xl}`,
        animation: "sub-fade 0.4s ease",
      }}>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div style={{ textAlign: "center", marginBottom: SPACING["4xl"] }}>
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: SPACING.sm, marginBottom: SPACING.xl }}>
            <div style={{ width: "36px", height: "36px", borderRadius: RADIUS.md, backgroundColor: COLORS.primary, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 16px rgba(212,175,55,0.3)` }}>
              <span style={{ color: COLORS.primaryText, fontFamily: FONTS.heading, fontSize: "18px", fontWeight: 700 }}>T</span>
            </div>
            <span style={{ fontFamily: FONTS.heading, fontSize: "22px", fontWeight: 700, color: COLORS.primary }}>TIRAS CRM</span>
          </div>

          {/* Expired banner */}
          {(isTrialExpired || isSubscriptionExpired) && (
            <div style={{
              display:         "inline-block",
              backgroundColor: COLORS.accentMuted,
              border:          `1px solid ${COLORS.accent}`,
              borderRadius:    RADIUS.lg,
              padding:         `${SPACING.sm} ${SPACING.xl}`,
              marginBottom:    SPACING.xl,
              fontFamily:      FONTS.body,
              fontSize:        FONTS.size.base,
              color:           COLORS.accent,
            }}>
              {isTrialExpired ? "⚠️ Your 14-day trial has ended." : "⚠️ Your subscription has expired."}
              {" "}Subscribe below to continue.
            </div>
          )}

          <h1 style={{ fontFamily: FONTS.heading, fontSize: "clamp(24px, 4vw, 36px)", fontWeight: 700, color: COLORS.textPrimary, margin: 0, marginBottom: SPACING.sm }}>
            Choose Your Plan
          </h1>
          <p style={{ fontFamily: FONTS.body, fontSize: FONTS.size.lg, color: COLORS.textSecondary, maxWidth: "520px", margin: "0 auto", lineHeight: 1.6 }}>
            Annual billing · No hidden fees · Calling wallet separate · Cancel anytime via WhatsApp
          </p>
        </div>

        {/* ── Error ───────────────────────────────────────────────────────── */}
        {error && (
          <div style={{
            backgroundColor: COLORS.accentMuted,
            border:          `1px solid ${COLORS.accent}`,
            borderRadius:    RADIUS.md,
            padding:         SPACING.base,
            marginBottom:    SPACING.xl,
            fontFamily:      FONTS.body,
            fontSize:        FONTS.size.base,
            color:           COLORS.accent,
            textAlign:       "center",
          }}>
            {error}
          </div>
        )}

        {/* ── Plan cards ──────────────────────────────────────────────────── */}
        <div style={{
          display:               "grid",
          gridTemplateColumns:   "repeat(auto-fit, minmax(280px, 1fr))",
          gap:                   SPACING.xl,
          marginBottom:          SPACING["4xl"],
          alignItems:            "stretch",
        }}>
          <PlanCard planKey="starter" plan={PLANS.starter} onSubscribe={handleSubscribe} loading={loading} />
          <PlanCard planKey="basic"   plan={PLANS.basic}   featured onSubscribe={handleSubscribe} loading={loading} />
          <PlanCard planKey="growth"  plan={PLANS.growth}  onSubscribe={handleSubscribe} loading={loading} />
        </div>

        {/* ── Calling wallet info ──────────────────────────────────────────── */}
        <div style={{
          backgroundColor: COLORS.surface,
          border:          `1px solid ${COLORS.border}`,
          borderRadius:    RADIUS.xl,
          padding:         SPACING["2xl"],
          marginBottom:    SPACING["3xl"],
          textAlign:       "center",
        }}>
          <h3 style={{ fontFamily: FONTS.heading, fontSize: "18px", fontWeight: 700, color: COLORS.primary, margin: `0 0 ${SPACING.sm}` }}>
            📞 Calling Wallet — Separate from Plan
          </h3>
          <p style={{ fontFamily: FONTS.body, fontSize: FONTS.size.base, color: COLORS.textSecondary, margin: `0 0 ${SPACING.base}`, lineHeight: 1.6, maxWidth: "600px", marginInline: "auto" }}>
            Calling is not included in the subscription. Recharge a wallet from ₹1,000 and pay ₹1 per minute as you use it. No monthly commitment. No calls = no charge.
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: SPACING.xl, flexWrap: "wrap" }}>
            {[["₹1,000", "1,000 min"], ["₹2,000", "2,000 min"], ["₹5,000", "5,000 min"]].map(([amt, mins]) => (
              <div key={amt} style={{ textAlign: "center" }}>
                <div style={{ fontFamily: FONTS.mono, fontSize: FONTS.size.xl, fontWeight: 700, color: COLORS.primary }}>{amt}</div>
                <div style={{ fontFamily: FONTS.body, fontSize: FONTS.size.xs, color: COLORS.textMuted }}>{mins} of calling</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── FAQs ─────────────────────────────────────────────────────────── */}
        <div style={{ maxWidth: "680px", margin: "0 auto", marginBottom: SPACING["4xl"] }}>
          <h3 style={{ fontFamily: FONTS.heading, fontSize: "20px", fontWeight: 700, color: COLORS.textPrimary, marginBottom: SPACING.xl, textAlign: "center" }}>
            Frequently Asked Questions
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: SPACING.sm }}>
            {faqs.map((faq) => (
              <details
                key={faq.q}
                className="sub-faq"
                style={{
                  backgroundColor: COLORS.surface,
                  border:          `1px solid ${COLORS.border}`,
                  borderRadius:    RADIUS.lg,
                  overflow:        "hidden",
                }}
              >
                <summary style={{
                  padding:    `${SPACING.base} ${SPACING.xl}`,
                  fontFamily: FONTS.body,
                  fontSize:   FONTS.size.base,
                  fontWeight: FONTS.weight.semibold,
                  color:      COLORS.textPrimary,
                  display:    "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}>
                  {faq.q}
                  <span style={{ color: COLORS.primary, fontSize: FONTS.size.xl, lineHeight: 1 }}>+</span>
                </summary>
                <div style={{
                  padding:    `0 ${SPACING.xl} ${SPACING.base}`,
                  fontFamily: FONTS.body,
                  fontSize:   FONTS.size.base,
                  color:      COLORS.textSecondary,
                  lineHeight: 1.6,
                }}>
                  {faq.a}
                </div>
              </details>
            ))}
          </div>
        </div>

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <div style={{ textAlign: "center" }}>
          <p style={{ fontFamily: FONTS.body, fontSize: FONTS.size.sm, color: COLORS.textMuted }}>
            Questions? WhatsApp Tony at{" "}
            <a href="https://wa.me/91XXXXXXXXXX" target="_blank" rel="noreferrer" style={{ color: COLORS.primary, textDecoration: "none", fontWeight: FONTS.weight.semibold }}>
              +91 XXXXX XXXXX
            </a>
            {" "}— Tony responds personally within 2 hours.
          </p>
          {currentUser && (
            <button
              onClick={() => navigate(-1)}
              style={{ ...STYLES.buttonSecondary, marginTop: SPACING.base, display: "inline-flex" }}
            >
              ← Go back
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SubscribePage;
