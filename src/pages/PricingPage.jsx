import { useState } from "react";

/* ─────────────────────────────────────────────────────────────────────────────
   TIRAS CRM — Dedicated Pricing Page
   Standalone public route — no auth imports. All CTAs → /login or WhatsApp.
   Theme: Carbon Copper  ·  #121212 · #B65E3C · #F2A65A · #F5F5F5
   Typography: Syne (headings) + DM Sans (body)
───────────────────────────────────────────────────────────────────────────── */

// ── Inject global styles once ─────────────────────────────────────────────────
const STYLE_ID = "tiras-pricing-styles";
if (typeof document !== "undefined" && !document.getElementById(STYLE_ID)) {
  const el = document.createElement("style");
  el.id = STYLE_ID;
  el.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; }

    @keyframes tp-up {
      from { opacity: 0; transform: translateY(20px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes tp-shimmer {
      0%   { background-position: -200% center; }
      100% { background-position:  200% center; }
    }
    @keyframes tp-pop {
      0%   { transform: scale(.94); opacity: 0; }
      100% { transform: scale(1);   opacity: 1; }
    }

    .tp-up  { animation: tp-up .55s cubic-bezier(.22,.68,0,1.2) both; }
    .tp-d1  { animation-delay: .07s; }
    .tp-d2  { animation-delay: .14s; }
    .tp-d3  { animation-delay: .21s; }
    .tp-pop { animation: tp-pop .3s cubic-bezier(.34,1.56,.64,1) both; }

    /* hover utilities */
    .tp-plan-card { transition: transform .22s ease, box-shadow .22s ease; }
    .tp-plan-card:hover { transform: translateY(-5px); }
    .tp-cta-primary:hover  { filter: brightness(1.08); transform: translateY(-2px); box-shadow: 0 12px 44px rgba(182,94,60,.44) !important; }
    .tp-cta-primary        { transition: all .18s ease; }
    .tp-cta-ghost:hover    { border-color: #B65E3C !important; color: #F2A65A !important; }
    .tp-cta-ghost          { transition: all .15s ease; }
    .tp-faq-btn:hover      { background: #1A1A1A !important; }
    .tp-faq-btn            { transition: background .15s; }
    .tp-nav-link:hover     { color: #F2A65A !important; }
    .tp-footer-link:hover  { color: #F2A65A !important; }
    .tp-toggle-btn:hover   { color: #F5F5F5 !important; }
    .tp-addons-card:hover  { border-color: #F2A65A55 !important; }
    .tp-addons-card        { transition: border-color .15s; }
    .tp-table-row:hover td,
    .tp-table-row:hover .tp-td { background: #191919 !important; }

    /* Price change animation */
    .tp-price-val { transition: opacity .18s ease, transform .18s ease; }
    .tp-price-val.changing { opacity: 0; transform: translateY(-6px); }

    /* Mobile */
    @media (max-width: 800px) {
      .tp-plans-grid   { grid-template-columns: 1fr !important; max-width: 400px; margin-left: auto !important; margin-right: auto !important; }
      .tp-cmp-table    { font-size: 12px !important; }
      .tp-cmp-table .tp-col-label { min-width: 90px !important; }
      .tp-toggle-wrap  { gap: 2px !important; }
      .tp-toggle-btn   { padding: 8px 14px !important; font-size: 12px !important; }
      .tp-h1           { font-size: 36px !important; letter-spacing: -1px !important; }
      .tp-h2           { font-size: 24px !important; }
      .tp-footer-flex  { flex-direction: column !important; gap: 10px !important; align-items: flex-start !important; }
      .tp-billing-note { flex-direction: column !important; gap: 8px !important; }
    }
  `;
  document.head.appendChild(el);
}

// ── SVG icon ──────────────────────────────────────────────────────────────────
const Ic = ({ d, s = 16, c = "currentColor", fill = "none" }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill={fill}
    stroke={c} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"
    style={{ flexShrink: 0 }} aria-hidden="true">
    <path d={d} />
  </svg>
);

const D = {
  check:   "M20 6L9 17l-5-5",
  x:       "M18 6L6 18M6 6l12 12",
  chevD:   "M6 9l6 6 6-6",
  chevU:   "M18 15l-6-6-6 6",
  arrow:   "M5 12h14M12 5l7 7-7 7",
  wa:      "M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z",
  hdd:     "M22 12H2M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11zM6 16h.01M10 16h.01",
  shield:  "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  tag:     "M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82zM7 7h.01",
  zap:     "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
  phone:   "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13 19.79 19.79 0 0 1 1.61 4.37 2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.18 6.18",
  refresh: "M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15",
  card:    "M1 4h22v16H1zM1 10h22",
  users:   "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
};

// ── Billing data ──────────────────────────────────────────────────────────────
const BILLING = [
  { key: "monthly",     label: "Monthly",     short: "mo"  },
  { key: "halfyearly",  label: "Half-yearly", short: "6mo" },
  { key: "yearly",      label: "Yearly",      short: "yr"  },
];

// Prices per billing cycle
const PRICES = {
  basic:  { monthly: 1800,  halfyearly: 9000,  yearly: 16000 },
  growth: { monthly: 3000,  halfyearly: 15000, yearly: 27000 },
};

// Savings vs monthly
const SAVINGS = {
  basic:  { halfyearly: 1800,  yearly: 5600  },
  growth: { halfyearly: 3000,  yearly: 9000  },
};

const fmtINR = (n) => `₹${n.toLocaleString("en-IN")}`;

// ── Plan features (cards) ─────────────────────────────────────────────────────
const PLAN_FEATURES = {
  basic: {
    included: [
      "Up to 5 agents",
      "Unlimited leads & contacts",
      "Click-to-call via Plivo",
      "Auto call recording — 7 days",
      "AI call summary per call",
      "Lead scoring Hot/Warm/Cold",
      "Sales pipeline Kanban",
      "WhatsApp button + templates",
      "Razorpay payment links",
      "Support ticket module",
      "Admin dashboard",
      "Leaderboard",
      "Android app included",
      "Help center + WhatsApp support",
    ],
    excluded: [
      "Custom pipeline stages",
      "Priority WhatsApp support",
      "Custom branding",
    ],
  },
  growth: {
    included: [
      "Up to 20 agents",
      "Unlimited leads & contacts",
      "Click-to-call via Plivo",
      "Auto call recording — 30 days",
      "AI call summary per call",
      "Lead scoring Hot/Warm/Cold",
      "Sales pipeline Kanban",
      "WhatsApp button + templates",
      "Razorpay payment links",
      "Support ticket module",
      "Admin dashboard + reports",
      "Leaderboard & agent targets",
      "Android app included",
      "Custom pipeline stages",
      "Priority WhatsApp support",
    ],
    excluded: [
      "Custom branding",
    ],
  },
  enterprise: {
    included: [
      "Unlimited agents",
      "Unlimited leads & contacts",
      "Click-to-call via Plivo",
      "Auto call recording — 365 days",
      "AI call summary per call",
      "Lead scoring Hot/Warm/Cold",
      "Sales pipeline Kanban",
      "WhatsApp button + templates",
      "Razorpay payment links",
      "Support ticket module",
      "Admin dashboard + full reports",
      "Leaderboard & agent targets",
      "Android app included",
      "Custom pipeline stages",
      "Priority + dedicated support",
      "Custom branding (Phase 2)",
    ],
    excluded: [],
  },
};

// ── Comparison table data ─────────────────────────────────────────────────────
const CMP_ROWS = [
  { label: "Agents included",            basic: "Up to 5",   growth: "Up to 20",  enterprise: "Unlimited"      },
  { label: "Call recording retention",   basic: "7 days",    growth: "30 days",   enterprise: "365 days"       },
  { label: "AI call summaries",          basic: true,        growth: true,        enterprise: true             },
  { label: "Lead scoring",               basic: true,        growth: true,        enterprise: true             },
  { label: "WhatsApp button",            basic: true,        growth: true,        enterprise: true             },
  { label: "Support tickets",            basic: true,        growth: true,        enterprise: true             },
  { label: "Admin dashboard",            basic: true,        growth: true,        enterprise: true             },
  { label: "Leaderboard",                basic: true,        growth: true,        enterprise: true             },
  { label: "Custom pipeline stages",     basic: false,       growth: true,        enterprise: true             },
  { label: "Razorpay payment links",     basic: true,        growth: true,        enterprise: true             },
  { label: "Priority WhatsApp support",  basic: false,       growth: true,        enterprise: true             },
  { label: "Custom branding",            basic: false,       growth: false,       enterprise: "Phase 2"        },
];

// ── FAQ data ──────────────────────────────────────────────────────────────────
const FAQS = [
  {
    q: "Can I change plans anytime?",
    a: "Yes. Monthly plans can be upgraded or downgraded at any time — your access continues to the end of the current billing period. Half-yearly and yearly plans can be upgraded by paying the difference. Downgrades take effect at the next renewal.",
  },
  {
    q: "Is there a free trial?",
    a: "Yes — WhatsApp Tony to arrange a free trial for your team. There is no automatic self-serve trial; Tony sets you up personally, walks you through the app, and makes sure your team is productive from day one before billing starts.",
  },
  {
    q: "How does call recording storage work?",
    a: "Every call is recorded automatically via Plivo and stored in Firebase Storage. A cloud function runs at 2 AM daily and deletes recordings older than your plan's retention limit (7 / 30 / 365 days). The call log and AI summary remain permanently — only the audio file is deleted. You can self-archive recordings to your Google Drive before they expire from Company Settings.",
  },
  {
    q: "What happens if I exceed storage?",
    a: "TIRAS will not charge you surprise overages. The 2 AM auto-delete keeps storage within your plan's limit. If you want to keep older recordings without deleting them, add the ₹500/month storage top-up for +100 GB. You can stack multiple top-ups. Alternatively, use self-archive to move recordings to your own Google Drive at zero cost.",
  },
  {
    q: "How do I pay — UPI, card, or bank transfer?",
    a: "All subscription payments are processed through Razorpay on the TIRAS web dashboard. Razorpay supports UPI (GPay, PhonePe, Paytm), all debit and credit cards, net banking, and EMI. Payments are never collected through the Android app — this is intentional to avoid Google's 15% Play Store commission. Razorpay charges 2% per transaction.",
  },
];

// ── Logo ──────────────────────────────────────────────────────────────────────
const Logo = () => (
  <a href="/" style={{ display: "flex", alignItems: "center", gap: 9, textDecoration: "none" }}>
    <div style={{
      width: 32, height: 32, borderRadius: 9,
      background: "linear-gradient(145deg, #C96B40 0%, #7A2A0E 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: 17, color: "#F5F5F5",
      boxShadow: "0 0 18px rgba(182,94,60,.38)",
    }}>T</div>
    <span style={{ fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: 20, color: "#F5F5F5", letterSpacing: "1.5px" }}>
      TIRAS
    </span>
  </a>
);

// ═══════════════════════════════════════════════════════════════════════════════
// 1. NAVBAR
// ═══════════════════════════════════════════════════════════════════════════════
const Navbar = () => (
  <nav style={{
    position: "sticky", top: 0, zIndex: 200,
    background: "rgba(10,10,10,.94)", borderBottom: "1px solid #1C1C1C",
    backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
  }}>
    <div style={{
      maxWidth: 1100, margin: "0 auto", padding: "0 24px",
      height: 62, display: "flex", alignItems: "center", justifyContent: "space-between",
    }}>
      <Logo />
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <a href="/" className="tp-nav-link"
          style={{ fontFamily: "DM Sans, sans-serif", fontSize: 13, fontWeight: 500, color: "#888", textDecoration: "none", padding: "7px 12px", borderRadius: 7, transition: "color .15s" }}>
          ← Home
        </a>
        <a href="/login" className="tp-cta-primary"
          style={{
            fontFamily: "DM Sans, sans-serif", display: "inline-flex", alignItems: "center", gap: 6,
            fontSize: 13, fontWeight: 700, color: "#121212",
            background: "#B65E3C", padding: "9px 20px", borderRadius: 8,
            textDecoration: "none", boxShadow: "0 4px 18px rgba(182,94,60,.28)",
          }}>
          Sign In <Ic d={D.arrow} s={13} c="#121212" />
        </a>
      </div>
    </div>
  </nav>
);

// ═══════════════════════════════════════════════════════════════════════════════
// 2. BILLING TOGGLE
// ═══════════════════════════════════════════════════════════════════════════════
const BillingToggle = ({ value, onChange }) => (
  <div className="tp-toggle-wrap"
    style={{
      display: "inline-flex", gap: 3, padding: 4,
      background: "#161616", border: "1px solid #222", borderRadius: 11,
    }}>
    {BILLING.map((opt) => {
      const active = value === opt.key;
      const savings = opt.key === "halfyearly"
        ? "Save 17%"
        : opt.key === "yearly"
        ? "Save 26%"
        : null;
      return (
        <button key={opt.key}
          className="tp-toggle-btn"
          onClick={() => onChange(opt.key)}
          style={{
            display: "flex", alignItems: "center", gap: 7,
            padding: "9px 20px", borderRadius: 8, border: "none", cursor: "pointer",
            background: active ? "#B65E3C" : "transparent",
            transition: "background .18s ease",
            fontFamily: "DM Sans, sans-serif",
          }}>
          <span style={{
            fontSize: 13, fontWeight: 600,
            color: active ? "#121212" : "#888",
            transition: "color .18s",
          }}>
            {opt.label}
          </span>
          {savings && (
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: ".4px",
              padding: "2px 7px", borderRadius: 99,
              background: active ? "rgba(18,18,18,.25)" : "rgba(125,216,125,.14)",
              color: active ? "#121212" : "#7DD87D",
              transition: "all .18s",
            }}>
              {savings}
            </span>
          )}
        </button>
      );
    })}
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// 3. PLAN CARDS
// ═══════════════════════════════════════════════════════════════════════════════
const PlanCard = ({ planKey, billing, idx }) => {
  const isGrowth     = planKey === "growth";
  const isEnterprise = planKey === "enterprise";
  const names        = { basic: "Basic", growth: "Growth", enterprise: "Enterprise" };
  const taglines     = { basic: "For small teams getting started", growth: "For growing sales operations", enterprise: "For large teams needing more" };

  const price   = isEnterprise ? null : PRICES[planKey][billing];
  const saving  = !isEnterprise && billing !== "monthly" ? SAVINGS[planKey][billing] : null;
  const cycleLabel = { monthly: "/month", halfyearly: "/6 months", yearly: "/year" }[billing];
  const features   = PLAN_FEATURES[planKey];

  return (
    <div className="tp-plan-card tp-up"
      style={{
        animationDelay: `${idx * .1}s`,
        borderRadius: 18, padding: "30px 26px", position: "relative",
        border: isGrowth ? "1px solid rgba(182,94,60,.55)" : "1px solid #1E1E1E",
        background: isGrowth ? "#190F08" : "#141414",
        boxShadow: isGrowth ? "0 0 80px rgba(182,94,60,.12), inset 0 1px 0 rgba(242,166,90,.1)" : "none",
      }}>

      {/* Most popular badge */}
      {isGrowth && (
        <div style={{
          position: "absolute", top: -13, left: "50%", transform: "translateX(-50%)",
          background: "linear-gradient(90deg,#C46840,#B65E3C)",
          color: "#121212", fontFamily: "DM Sans, sans-serif",
          fontSize: 10, fontWeight: 800, padding: "3px 16px",
          borderRadius: 99, whiteSpace: "nowrap",
          letterSpacing: ".6px", textTransform: "uppercase",
          boxShadow: "0 2px 12px rgba(182,94,60,.4)",
        }}>
          Most Popular
        </div>
      )}

      {/* Plan name & tagline */}
      <div style={{ marginBottom: 20 }}>
        <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 10, fontWeight: 700, color: isGrowth ? "#F2A65A" : "#555", textTransform: "uppercase", letterSpacing: "1.3px", marginBottom: 6 }}>
          {names[planKey]}
        </p>
        <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 12, color: "#666" }}>
          {taglines[planKey]}
        </p>
      </div>

      {/* Price */}
      <div style={{ marginBottom: 8 }}>
        {isEnterprise ? (
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: 34, color: "#F5F5F5", letterSpacing: "-1px" }}>Custom</span>
            <span style={{ fontFamily: "DM Sans, sans-serif", fontSize: 13, color: "#666" }}>pricing</span>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
            <span className="tp-price-val"
              style={{ fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: 36, letterSpacing: "-1.2px", color: isGrowth ? "#F2A65A" : "#F5F5F5" }}>
              {fmtINR(price)}
            </span>
            <span style={{ fontFamily: "DM Sans, sans-serif", fontSize: 13, color: "#666" }}>{cycleLabel}</span>
          </div>
        )}
      </div>

      {/* Savings badge */}
      {saving && (
        <div className="tp-pop" style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          padding: "3px 10px", borderRadius: 6, marginBottom: 10,
          background: "rgba(125,216,125,.1)", border: "1px solid rgba(125,216,125,.22)",
        }}>
          <Ic d={D.tag} s={11} c="#7DD87D" />
          <span style={{ fontFamily: "DM Sans, sans-serif", fontSize: 11, fontWeight: 700, color: "#7DD87D" }}>
            Save {fmtINR(saving)} vs monthly
          </span>
        </div>
      )}

      {/* Recording retention pill */}
      <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 12px", borderRadius: 8, background: "#1A1A1A", border: "1px solid #242424", marginBottom: 20 }}>
        <Ic d={D.hdd} s={13} c={isGrowth ? "#F2A65A" : "#888"} />
        <span style={{ fontFamily: "DM Sans, sans-serif", fontSize: 12, color: isGrowth ? "#AAAAAA" : "#777" }}>
          Recording retention:{" "}
          <strong style={{ color: isGrowth ? "#F2A65A" : "#AAAAAA", fontWeight: 600 }}>
            {planKey === "basic" ? "7 days" : planKey === "growth" ? "30 days" : "365 days"}
          </strong>
        </span>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: "#1E1E1E", marginBottom: 18 }} />

      {/* Included features */}
      <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: features.excluded.length ? 14 : 24 }}>
        {features.included.map((f, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
            <Ic d={D.check} s={14} c={isGrowth ? "#F2A65A" : "#7DD87D"} />
            <span style={{ fontFamily: "DM Sans, sans-serif", fontSize: 13, color: "#CCCCCC", lineHeight: 1.4 }}>{f}</span>
          </div>
        ))}
      </div>

      {/* Excluded features */}
      {features.excluded.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24, opacity: .5 }}>
          {features.excluded.map((f, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
              <Ic d={D.x} s={14} c="#E05C5C" />
              <span style={{ fontFamily: "DM Sans, sans-serif", fontSize: 13, color: "#888", lineHeight: 1.4, textDecoration: "line-through" }}>{f}</span>
            </div>
          ))}
        </div>
      )}

      {/* CTA */}
      <a href="/login" className="tp-cta-primary"
        style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          padding: "13px 0", borderRadius: 10, width: "100%", textDecoration: "none",
          background: isGrowth ? "#B65E3C" : "transparent",
          color: isGrowth ? "#121212" : "#AAAAAA",
          border: isGrowth ? "none" : "1px solid #2A2A2A",
          fontFamily: "DM Sans, sans-serif", fontSize: 14, fontWeight: 700,
          boxShadow: isGrowth ? "0 4px 28px rgba(182,94,60,.3)" : "none",
        }}>
        {isEnterprise ? "Contact Tony" : "Get started"} <Ic d={D.arrow} s={14} c={isGrowth ? "#121212" : "#888"} />
      </a>

      {isEnterprise && (
        <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 11, color: "#555", textAlign: "center", marginTop: 10 }}>
          WhatsApp Tony for a custom quote
        </p>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 5. COMPARISON TABLE
// ═══════════════════════════════════════════════════════════════════════════════
const CellVal = ({ v, isGrowth }) => {
  if (v === true)  return <Ic d={D.check} s={15} c={isGrowth ? "#F2A65A" : "#7DD87D"} />;
  if (v === false) return <Ic d={D.x}     s={15} c="#2E2E2E" />;
  return (
    <span style={{
      fontFamily: "DM Sans, sans-serif", fontSize: 12, fontWeight: 600,
      color: isGrowth ? "#F2A65A" : "#AAAAAA", lineHeight: 1.3, textAlign: "center",
    }}>{v}</span>
  );
};

const ComparisonTable = () => (
  <section style={{ padding: "0 24px" }}>
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 11, fontWeight: 700, color: "#B65E3C", textTransform: "uppercase", letterSpacing: "1.5px", textAlign: "center", marginBottom: 12 }}>
        Full feature breakdown
      </p>
      <h2 className="tp-h2" style={{ fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: 28, color: "#F5F5F5", textAlign: "center", letterSpacing: "-.8px", marginBottom: 36, lineHeight: 1.2 }}>
        Compare every feature.
      </h2>

      <div className="tp-cmp-table" style={{ borderRadius: 14, border: "1px solid #1E1E1E", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", background: "#0E0E0E", borderBottom: "1px solid #1E1E1E" }}>
          <div style={{ padding: "13px 18px", fontFamily: "DM Sans, sans-serif", fontSize: 11, fontWeight: 700, color: "#444", textTransform: "uppercase", letterSpacing: ".7px" }}>Feature</div>
          {[
            { name: "Basic",      hot: false },
            { name: "Growth",     hot: true  },
            { name: "Enterprise", hot: false },
          ].map((col) => (
            <div key={col.name} style={{
              padding: "13px 12px", textAlign: "center",
              borderLeft: "1px solid #1E1E1E",
              background: col.hot ? "rgba(182,94,60,.07)" : "transparent",
            }}>
              <span style={{ fontFamily: "DM Sans, sans-serif", fontSize: 12, fontWeight: 700, color: col.hot ? "#F2A65A" : "#888" }}>
                {col.name}
              </span>
            </div>
          ))}
        </div>

        {/* Rows */}
        {CMP_ROWS.map((row, i) => (
          <div key={i} className="tp-table-row"
            style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", borderTop: "1px solid #181818", transition: "background .12s" }}>
            <div className="tp-td" style={{ padding: "13px 18px", fontFamily: "DM Sans, sans-serif", fontSize: 13, color: "#AAAAAA" }}>
              {row.label}
            </div>
            {(["basic", "growth", "enterprise"]).map((pk, pi) => (
              <div key={pk} className="tp-td"
                style={{
                  padding: "13px 12px",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  borderLeft: "1px solid #181818",
                  background: pi === 1 ? "rgba(182,94,60,.025)" : "transparent",
                }}>
                <CellVal v={row[pk]} isGrowth={pi === 1} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  </section>
);

// ═══════════════════════════════════════════════════════════════════════════════
// 6. STORAGE ADD-ON
// ═══════════════════════════════════════════════════════════════════════════════
const StorageAddon = () => (
  <section style={{ padding: "0 24px" }}>
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 11, fontWeight: 700, color: "#B65E3C", textTransform: "uppercase", letterSpacing: "1.5px", textAlign: "center", marginBottom: 12 }}>
        Add-ons
      </p>
      <h2 className="tp-h2" style={{ fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: 28, color: "#F5F5F5", textAlign: "center", letterSpacing: "-.8px", marginBottom: 36, lineHeight: 1.2 }}>
        Need more call history?
      </h2>

      {/* Add-on card */}
      <div className="tp-addons-card"
        style={{
          display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap",
          padding: "28px 28px", borderRadius: 16,
          background: "#141414", border: "1px solid #1E1E1E",
          cursor: "default",
        }}>

        {/* Icon */}
        <div style={{ width: 54, height: 54, borderRadius: 14, background: "#F2A65A1A", border: "1px solid #F2A65A30", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Ic d={D.hdd} s={24} c="#F2A65A" />
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <h3 style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: 17, color: "#F5F5F5" }}>
              Storage Top-up
            </h3>
            <span style={{ padding: "2px 9px", borderRadius: 99, background: "#F2A65A22", border: "1px solid #F2A65A33", fontFamily: "DM Sans, sans-serif", fontSize: 10, fontWeight: 700, color: "#F2A65A", letterSpacing: ".5px", textTransform: "uppercase" }}>
              Add-on
            </span>
          </div>
          <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 13.5, color: "#888", lineHeight: 1.7 }}>
            Add <strong style={{ color: "#AAAAAA" }}>+100 GB</strong> of recording storage to any plan. Stack multiple top-ups if you need more. Or use <strong style={{ color: "#AAAAAA" }}>Self-Archive</strong> in Company Settings to export recordings to Google Drive before they expire — keeping your TIRAS storage at zero cost.
          </p>
        </div>

        {/* Price */}
        <div style={{ textAlign: "center", flexShrink: 0 }}>
          <p style={{ fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: 28, color: "#F2A65A", letterSpacing: "-.8px" }}>₹500</p>
          <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 12, color: "#666" }}>per month</p>
          <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 11, color: "#555", marginTop: 3 }}>per 100 GB</p>
        </div>
      </div>

      {/* How storage auto-delete works */}
      <div style={{ marginTop: 14, padding: "16px 20px", borderRadius: 10, background: "#0E0E0E", border: "1px solid #1A1A1A", display: "flex", alignItems: "flex-start", gap: 12 }}>
        <Ic d={D.refresh} s={14} c="#B65E3C" />
        <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 12.5, color: "#666", lineHeight: 1.7 }}>
          <strong style={{ color: "#AAAAAA" }}>Auto-cleanup:</strong> A Firebase Cloud Function runs at 2 AM daily and deletes recordings older than your plan's retention limit. The call log and AI summary are kept permanently — only the audio file is removed. Lead records update to show "Recording Expired" so nothing is hidden from your team.
        </p>
      </div>
    </div>
  </section>
);

// ═══════════════════════════════════════════════════════════════════════════════
// 7. FAQ
// ═══════════════════════════════════════════════════════════════════════════════
const FAQ = () => {
  const [open, setOpen] = useState(null);
  const toggle = (i) => setOpen(open === i ? null : i);

  return (
    <section style={{ padding: "0 24px" }}>
      <div style={{ maxWidth: 700, margin: "0 auto" }}>
        <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 11, fontWeight: 700, color: "#B65E3C", textTransform: "uppercase", letterSpacing: "1.5px", textAlign: "center", marginBottom: 12 }}>
          FAQ
        </p>
        <h2 className="tp-h2" style={{ fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: 28, color: "#F5F5F5", textAlign: "center", letterSpacing: "-.8px", marginBottom: 36, lineHeight: 1.2 }}>
          Pricing questions answered.
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {FAQS.map((faq, i) => {
            const isOpen = open === i;
            return (
              <div key={i} style={{ borderRadius: 11, border: `1px solid ${isOpen ? "#2A2A2A" : "#1C1C1C"}`, overflow: "hidden", background: isOpen ? "#161210" : "#141414", transition: "background .15s, border-color .15s" }}>
                <button className="tp-faq-btn"
                  onClick={() => toggle(i)}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "17px 20px", background: "none", border: "none", cursor: "pointer", gap: 14, textAlign: "left" }}>
                  <span style={{ fontFamily: "DM Sans, sans-serif", fontSize: 14, fontWeight: 600, color: isOpen ? "#F5F5F5" : "#CCCCCC", lineHeight: 1.45, flex: 1 }}>
                    {faq.q}
                  </span>
                  <span style={{ color: isOpen ? "#F2A65A" : "#555", display: "flex", flexShrink: 0, transition: "transform .2s, color .2s", transform: isOpen ? "rotate(180deg)" : "none" }}>
                    <Ic d={D.chevD} s={16} c="currentColor" />
                  </span>
                </button>
                {isOpen && (
                  <div style={{ padding: "0 20px 18px", borderTop: "1px solid #1E1E1E" }}>
                    <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 13.5, color: "#888", lineHeight: 1.8, paddingTop: 14 }}>
                      {faq.a}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 8. BOTTOM CTA STRIP
// ═══════════════════════════════════════════════════════════════════════════════
const CtaStrip = () => (
  <section style={{ padding: "0 24px" }}>
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      <div style={{
        borderRadius: 20,
        border: "1px solid rgba(182,94,60,.35)",
        background: "linear-gradient(135deg, #1A0E07 0%, #121212 100%)",
        padding: "48px 40px", textAlign: "center", position: "relative", overflow: "hidden",
      }}>
        {/* Glow */}
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 500, height: 260, borderRadius: "50%", background: "radial-gradient(ellipse,rgba(182,94,60,.15) 0%,transparent 66%)", pointerEvents: "none" }} />

        <div style={{ position: "relative" }}>
          {/* WhatsApp icon */}
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(37,211,102,.1)", border: "1px solid rgba(37,211,102,.25)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
            <Ic d={D.wa} s={26} c="#25D366" />
          </div>

          <h2 className="tp-h2" style={{ fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: 30, color: "#F5F5F5", letterSpacing: "-.9px", lineHeight: 1.15, marginBottom: 14 }}>
            Talk to Tony directly.
          </h2>
          <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 15, color: "#888", lineHeight: 1.72, maxWidth: 460, margin: "0 auto 32px" }}>
            Still have questions? Tony responds personally on WhatsApp — usually within 2 hours, 7 days a week. Describe your team size and industry and get a personal recommendation.
          </p>

          <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
            {/* WhatsApp CTA */}
            <a
              href="https://wa.me/919XXXXXXXXX?text=Hi%20Tony%2C%20I%20want%20to%20know%20more%20about%20TIRAS%20CRM%20pricing"
              target="_blank" rel="noreferrer"
              className="tp-cta-primary"
              style={{
                fontFamily: "DM Sans, sans-serif",
                display: "inline-flex", alignItems: "center", gap: 9,
                padding: "13px 28px", borderRadius: 10,
                background: "#25D366", color: "#121212",
                fontSize: 14, fontWeight: 800, textDecoration: "none",
                boxShadow: "0 6px 30px rgba(37,211,102,.28)",
              }}>
              <Ic d={D.wa} s={16} c="#121212" />
              Chat on WhatsApp
            </a>

            {/* Sign in CTA */}
            <a href="/login" className="tp-cta-ghost"
              style={{
                fontFamily: "DM Sans, sans-serif",
                display: "inline-flex", alignItems: "center", gap: 9,
                padding: "13px 24px", borderRadius: 10,
                border: "1px solid #2A2A2A", background: "transparent",
                color: "#AAAAAA", fontSize: 14, fontWeight: 600, textDecoration: "none",
              }}>
              Start free trial <Ic d={D.arrow} s={14} c="#888" />
            </a>
          </div>

          <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 11, color: "#444", marginTop: 20 }}>
            Replace 919XXXXXXXXX with Tony's actual number before going live.
          </p>
        </div>
      </div>
    </div>
  </section>
);

// ═══════════════════════════════════════════════════════════════════════════════
// FOOTER (minimal)
// ═══════════════════════════════════════════════════════════════════════════════
const Footer = () => (
  <footer style={{ marginTop: 72, background: "#080808", borderTop: "1px solid #141414", padding: "36px 24px 28px" }}>
    <div className="tp-footer-flex"
      style={{ maxWidth: 1000, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
      <Logo />
      <div style={{ display: "flex", gap: 28, flexWrap: "wrap", alignItems: "center" }}>
        {["Home", "Features", "Help Center", "Privacy Policy", "Terms"].map((l) => (
          <a key={l} href="#" className="tp-footer-link"
            style={{ fontFamily: "DM Sans, sans-serif", fontSize: 12, color: "#444", textDecoration: "none", transition: "color .15s" }}>
            {l}
          </a>
        ))}
      </div>
      <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 11, color: "#333" }}>
        © 2026 TIRAS CRM
      </p>
    </div>
  </footer>
);

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT EXPORT
// ═══════════════════════════════════════════════════════════════════════════════
export const PricingPage = () => {
  const [billing, setBilling] = useState("monthly");

  return (
    <div style={{ background: "#121212", minHeight: "100vh", fontFamily: "DM Sans, sans-serif" }}>
      <Navbar />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section style={{ padding: "72px 24px 64px", textAlign: "center", position: "relative", overflow: "hidden" }}>
        {/* Ambient glow */}
        <div style={{ position: "absolute", top: -60, left: "50%", transform: "translateX(-50%)", width: 700, height: 420, borderRadius: "50%", background: "radial-gradient(ellipse,rgba(182,94,60,.14) 0%,transparent 64%)", pointerEvents: "none" }} />

        <div style={{ position: "relative", maxWidth: 680, margin: "0 auto" }}>
          <p className="tp-up" style={{ fontFamily: "DM Sans, sans-serif", fontSize: 11, fontWeight: 700, color: "#B65E3C", textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 14 }}>
            Pricing
          </p>
          <h1 className="tp-up tp-d1 tp-h1"
            style={{ fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: 50, color: "#F5F5F5", letterSpacing: "-2px", lineHeight: 1.08, marginBottom: 18 }}>
            Simple pricing.<br />
            <span style={{
              background: "linear-gradient(92deg,#B65E3C 0%,#F2A65A 50%,#B65E3C 100%)",
              backgroundSize: "200% auto",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              animation: "tp-shimmer 4s linear infinite",
            }}>No surprises.</span>
          </h1>
          <p className="tp-up tp-d2"
            style={{ fontFamily: "DM Sans, sans-serif", fontSize: 16, color: "#888", maxWidth: 460, margin: "0 auto 36px", lineHeight: 1.72 }}>
            Every Phase 1 feature included in all plans. No hidden charges. No upsells. Cancel anytime.
          </p>

          {/* Billing toggle */}
          <div className="tp-up tp-d3">
            <BillingToggle value={billing} onChange={setBilling} />
          </div>

          {/* Savings callout for non-monthly */}
          {billing !== "monthly" && (
            <p className="tp-pop" style={{ fontFamily: "DM Sans, sans-serif", fontSize: 12.5, color: "#7DD87D", marginTop: 14 }}>
              {billing === "halfyearly"
                ? "Basic saves ₹1,800 · Growth saves ₹3,000 compared to monthly billing"
                : "Basic saves ₹5,600 · Growth saves ₹9,000 compared to monthly billing"}
            </p>
          )}
        </div>
      </section>

      {/* ── Plan cards ───────────────────────────────────────────────────── */}
      <section style={{ padding: "0 24px 80px" }}>
        <div className="tp-plans-grid"
          style={{ maxWidth: 1000, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 18, alignItems: "start" }}>
          {["basic", "growth", "enterprise"].map((pk, i) => (
            <PlanCard key={pk} planKey={pk} billing={billing} idx={i} />
          ))}
        </div>

        {/* Billing notes */}
        <div className="tp-billing-note"
          style={{ maxWidth: 1000, margin: "20px auto 0", display: "flex", alignItems: "center", justifyContent: "center", gap: 24, padding: "14px 20px", borderRadius: 10, background: "#0E0E0E", border: "1px solid #1A1A1A", flexWrap: "wrap" }}>
          {[
            { c: "#7DD87D", t: "All payments via Razorpay web — never through Play Store" },
            { c: "#5AB4F2", t: "Razorpay charges 2% per transaction" },
            { c: "#F2A65A", t: "Plivo calling billed separately at ~₹0.40/min" },
          ].map((n, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: n.c, flexShrink: 0 }} />
              <span style={{ fontFamily: "DM Sans, sans-serif", fontSize: 12, color: "#666" }}>{n.t}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Comparison table ─────────────────────────────────────────────── */}
      <section style={{ paddingBottom: 80 }}>
        <ComparisonTable />
      </section>

      {/* ── Storage add-on ───────────────────────────────────────────────── */}
      <section style={{ paddingBottom: 80 }}>
        <StorageAddon />
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section style={{ paddingBottom: 80 }}>
        <FAQ />
      </section>

      {/* ── Bottom CTA strip ─────────────────────────────────────────────── */}
      <section style={{ paddingBottom: 0 }}>
        <CtaStrip />
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <Footer />
    </div>
  );
};

export default PricingPage;
