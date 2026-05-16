import { useState } from "react";

/* ─────────────────────────────────────────────────────────────────────────────
   TIRAS CRM V2 — PricingPage
   Theme: Obsidian Gold  |  Public route — no auth needed
   Fonts: Playfair Display + DM Sans
   All CTAs → /login or WhatsApp
───────────────────────────────────────────────────────────────────────────── */

const STYLE_ID = "tiras-v2-pp";
if (typeof document !== "undefined" && !document.getElementById(STYLE_ID)) {
  const s = document.createElement("style");
  s.id = STYLE_ID;
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,800;1,700&family=DM+Sans:wght@400;500;600;700&display=swap');
    *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
    html { scroll-behavior:smooth; }

    @keyframes pp2-up    { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
    @keyframes pp2-shine { 0%{background-position:-200% center} 100%{background-position:200% center} }
    @keyframes pp2-pop   { 0%{transform:scale(.9);opacity:0} 100%{transform:scale(1);opacity:1} }

    .pp2-up  { animation:pp2-up  .48s cubic-bezier(.22,.68,0,1.1) both; }
    .pp2-pop { animation:pp2-pop .28s cubic-bezier(.34,1.56,.64,1) both; }
    .pp2-d1  { animation-delay:.07s; } .pp2-d2 { animation-delay:.14s; }
    .pp2-d3  { animation-delay:.21s; } .pp2-d4 { animation-delay:.28s; }

    .pp2-nav-link:hover    { color:#D4AF37 !important; }
    .pp2-nav-link          { transition:color .14s; }
    .pp2-cta-gold:hover    { filter:brightness(1.1); transform:translateY(-2px); box-shadow:0 12px 44px rgba(212,175,55,.4) !important; }
    .pp2-cta-gold          { transition:all .18s; }
    .pp2-cta-ghost:hover   { border-color:#D4AF37 !important; color:#D4AF37 !important; }
    .pp2-cta-ghost         { transition:all .15s; }
    .pp2-plan-card:hover   { transform:translateY(-4px); }
    .pp2-plan-card         { transition:transform .2s, box-shadow .2s; }
    .pp2-toggle-opt        { transition:all .18s; cursor:pointer; border:none; }
    .pp2-faq-btn           { transition:background .14s; cursor:pointer; border:none; }
    .pp2-faq-btn:hover     { background:#222223 !important; }
    .pp2-input:focus       { border-color:#D4AF37 !important; outline:none; box-shadow:0 0 0 3px rgba(212,175,55,0.12); }
    .pp2-footer-link:hover { color:#D4AF37 !important; }
    .pp2-footer-link       { transition:color .14s; }
    .pp2-row-hover:hover td,
    .pp2-row-hover:hover .pp2-td { background:#1E1E1F !important; }

    @media(max-width:780px){
      .pp2-plans-grid { grid-template-columns:1fr !important; max-width:400px; margin:0 auto; }
      .pp2-h1         { font-size:36px !important; letter-spacing:-1px !important; }
      .pp2-h2         { font-size:24px !important; }
      .pp2-toggle     { gap:2px !important; }
      .pp2-toggle-opt { padding:8px 14px !important; font-size:12px !important; }
      .pp2-cmp-wrap   { overflow-x:auto; display:block; }
      .pp2-notes-row  { flex-direction:column !important; gap:8px !important; align-items:flex-start !important; }
      .pp2-footer-flex{ flex-direction:column !important; gap:12px !important; align-items:flex-start !important; }
      .pp2-cta-strip  { flex-direction:column !important; gap:16px !important; }
    }
  `;
  document.head.appendChild(s);
}

// ── Icon ──────────────────────────────────────────────────────────────────────
const Ic = ({ d, s = 16, c = "currentColor", fill = "none" }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill={fill}
    stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
    style={{ flexShrink: 0 }} aria-hidden="true"><path d={d} /></svg>
);

const D = {
  check:  "M20 6L9 17l-5-5",
  x:      "M18 6L6 18M6 6l12 12",
  minus:  "M5 12h14",
  arrow:  "M5 12h14M12 5l7 7-7 7",
  chevR:  "M9 18l6-6-6-6",
  chevD:  "M6 9l6 6 6-6",
  wa:     "M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z",
  hdd:    "M22 12H2M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11zM6 16h.01M10 16h.01",
  wallet: "M21 12V7H5a2 2 0 0 1 0-4h14v4M21 12a2 2 0 0 1 0 4H5a2 2 0 0 1 0-4h16v4",
  tag:    "M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82zM7 7h.01",
  refresh:"M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
};

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:      "#121212", surface: "#1A1A1B", surfaceHov: "#222223",
  border:  "#2A2A2B", gold: "#D4AF37", goldMuted: "rgba(212,175,55,0.12)",
  red:     "#E63946", green: "#10B981",
  text:    "#F5F5F5", textSec: "#9A9A9A", textMuted: "#555555",
};

// ── Pricing data ──────────────────────────────────────────────────────────────
const PRICES = {
  basic:  { monthly: 1800,  halfyearly: 9000,  yearly: 16000 },
  growth: { monthly: 3000,  halfyearly: 15000, yearly: 27000 },
};
const SAVINGS = {
  basic:  { halfyearly: 1800, yearly: 5600 },
  growth: { halfyearly: 3000, yearly: 9000 },
};
const BILLING_OPTS = [
  { key: "monthly",    label: "Monthly",     save: null       },
  { key: "halfyearly", label: "Half-yearly", save: "Save 17%" },
  { key: "yearly",     label: "Yearly",      save: "Save 26%" },
];
const fmtINR = (n) => `₹${n.toLocaleString("en-IN")}`;

// ── Plan highlights ───────────────────────────────────────────────────────────
const PLAN_FEATS = {
  basic: [
    "Up to 5 agents",
    "Unlimited leads & contacts",
    "Click-to-call via Plivo",
    "Auto call recording — 7 days",
    "AI call summary per call",
    "Lead scoring Hot/Warm/Cold",
    "Sales pipeline Kanban",
    "WhatsApp button + templates",
    "Razorpay payment links",
    "Wallet-based calling system",
    "Support ticket module",
    "Android app included",
    "Help center + WhatsApp support",
  ],
  growth: [
    "Up to 20 agents",
    "Everything in Basic",
    "30-day recording retention",
    "Advanced reports & analytics",
    "Agent targets + side-by-side",
    "Follow-up calendar view",
    "Custom pipeline stages",
    "Priority WhatsApp support",
    "Storage top-up eligible",
    "Save ₹3,000 on half-yearly",
  ],
  enterprise: [
    "Unlimited agents",
    "Everything in Growth",
    "365-day / lifetime retention",
    "Dedicated support channel",
    "Custom onboarding session",
    "API access (Phase 2)",
    "White-label option (Phase 2)",
    "SLA guarantee",
    "Quarterly review calls",
    "Volume discounts",
  ],
};

// ── Comparison table rows ─────────────────────────────────────────────────────
const CMP_ROWS = [
  { label: "Agents included",            basic: "Up to 5",   growth: "Up to 20",  enterprise: "Unlimited"        },
  { label: "Call recording retention",   basic: "7 days",    growth: "30 days",   enterprise: "365 days"         },
  { label: "AI call summaries",          basic: true,        growth: true,        enterprise: true               },
  { label: "Lead scoring",               basic: true,        growth: true,        enterprise: true               },
  { label: "Wallet-based calling",       basic: true,        growth: true,        enterprise: true               },
  { label: "WhatsApp button",            basic: true,        growth: true,        enterprise: true               },
  { label: "Razorpay payment links",     basic: true,        growth: true,        enterprise: true               },
  { label: "Support tickets",            basic: true,        growth: true,        enterprise: true               },
  { label: "Admin God View dashboard",   basic: true,        growth: true,        enterprise: true               },
  { label: "Leaderboard",                basic: true,        growth: true,        enterprise: true               },
  { label: "Custom pipeline stages",     basic: false,       growth: true,        enterprise: true               },
  { label: "Advanced reports",           basic: false,       growth: true,        enterprise: true               },
  { label: "Agent target tracking",      basic: false,       growth: true,        enterprise: true               },
  { label: "Priority WhatsApp support",  basic: false,       growth: true,        enterprise: true               },
  { label: "Dedicated support channel",  basic: false,       growth: false,       enterprise: true               },
  { label: "Custom branding",            basic: false,       growth: false,       enterprise: "Phase 2"          },
  { label: "API access",                 basic: false,       growth: false,       enterprise: "Phase 2"          },
  { label: "WhatsApp support response",  basic: "< 4 hrs",   growth: "< 2 hrs",   enterprise: "< 1 hr"           },
  { label: "SLA guarantee",              basic: false,       growth: false,       enterprise: true               },
];

// ── FAQs ──────────────────────────────────────────────────────────────────────
const FAQS = [
  {
    q: "Can I change plans anytime?",
    a: "Yes. Monthly plans can be upgraded or downgraded at any time — access continues to the end of the current billing period. Half-yearly and yearly plans can be upgraded by paying the difference. Downgrades apply at next renewal.",
  },
  {
    q: "Is there a free trial?",
    a: "Yes — WhatsApp Tony to arrange a free trial for your team. Tony sets you up personally, walks you through the app, and makes sure your team is productive from day one before billing starts.",
  },
  {
    q: "How does call recording storage work?",
    a: "Every call is recorded automatically via Plivo and stored in Firebase. A cloud function runs at 2 AM daily and auto-deletes recordings older than your plan's limit (7 / 30 / 365 days). The call log and AI summary stay permanently — only the audio file is removed. Use Self-Archive in Company Settings to export recordings to Google Drive before expiry.",
  },
  {
    q: "What happens if I exceed storage?",
    a: "TIRAS will not charge surprise overages. The 2 AM auto-delete keeps storage within your plan's limit. If you want to keep older recordings, add the ₹500/month Storage Top-up for +100 GB. You can stack multiple top-ups. Alternatively, use Self-Archive to move recordings to your own Google Drive at zero cost.",
  },
  {
    q: "How does the Wallet system work?",
    a: "The Wallet is a pre-paid Plivo credit system. Company Admins recharge the wallet via Razorpay on the web dashboard. Every call deducts approximately ₹0.40/min from the wallet. When the balance drops below ₹200, a low-balance alert fires in the app and in Notifications. Calling stops automatically if the wallet hits ₹0.",
  },
  {
    q: "How do I pay — UPI, card, or bank transfer?",
    a: "All payments are processed through Razorpay on the TIRAS web dashboard — never through the Android app. Razorpay supports UPI (GPay, PhonePe, Paytm), all debit and credit cards, net banking, and EMI. Razorpay charges 2% per transaction.",
  },
];

// ── Logo ──────────────────────────────────────────────────────────────────────
const Logo = () => (
  <a href="/" style={{ display: "flex", alignItems: "center", gap: 9, textDecoration: "none" }}>
    <div style={{ width: 30, height: 30, borderRadius: 8, background: "linear-gradient(145deg,#D4AF37,#8A7020)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Playfair Display,serif", fontWeight: 700, fontSize: 16, color: "#000", boxShadow: "0 0 16px rgba(212,175,55,.32)" }}>T</div>
    <span style={{ fontFamily: "Playfair Display,serif", fontWeight: 700, fontSize: 19, color: "#F5F5F5", letterSpacing: "1px" }}>TIRAS</span>
  </a>
);

// ── Eyebrow ───────────────────────────────────────────────────────────────────
const Eyebrow = ({ children }) => (
  <p style={{ fontFamily: "DM Sans,sans-serif", fontSize: 11, fontWeight: 700, color: C.gold, textTransform: "uppercase", letterSpacing: "1.5px", textAlign: "center", marginBottom: 12 }}>{children}</p>
);

// ── CellVal ───────────────────────────────────────────────────────────────────
const CellVal = ({ v, hot }) => {
  if (v === true)  return <Ic d={D.check} s={15} c={hot ? C.gold : C.green} />;
  if (v === false) return <Ic d={D.minus} s={15} c="#2A2A2B" />;
  return <span style={{ fontFamily: "DM Sans,sans-serif", fontSize: 12, fontWeight: 600, color: hot ? C.gold : C.textSec, lineHeight: 1.3, textAlign: "center" }}>{v}</span>;
};

// ═══════════════════════════════════════════════════════════════════════════════
// 1. NAVBAR
// ═══════════════════════════════════════════════════════════════════════════════
const Navbar = () => (
  <nav style={{ position: "sticky", top: 0, zIndex: 200, background: "rgba(10,10,10,.94)", borderBottom: `1px solid ${C.border}`, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}>
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px", height: 62, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <Logo />
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <a href="/" className="pp2-cta-ghost" style={{ fontFamily: "DM Sans,sans-serif", fontSize: 13, fontWeight: 500, color: C.textSec, textDecoration: "none", padding: "7px 14px", borderRadius: 8, border: `1px solid ${C.border}` }}>
          ← Home
        </a>
        <a href="/login" className="pp2-cta-gold" style={{ fontFamily: "DM Sans,sans-serif", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "#000", background: C.gold, padding: "9px 20px", borderRadius: 8, textDecoration: "none", boxShadow: "0 4px 18px rgba(212,175,55,.25)" }}>
          Sign In <Ic d={D.arrow} s={13} c="#000" />
        </a>
      </div>
    </div>
  </nav>
);

// ═══════════════════════════════════════════════════════════════════════════════
// 2. BILLING TOGGLE
// ═══════════════════════════════════════════════════════════════════════════════
const BillingToggle = ({ value, onChange }) => (
  <div className="pp2-toggle" style={{ display: "inline-flex", gap: 3, padding: 4, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 11 }}>
    {BILLING_OPTS.map((opt) => {
      const active = value === opt.key;
      return (
        <button key={opt.key} className="pp2-toggle-opt"
          onClick={() => onChange(opt.key)}
          style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 20px", borderRadius: 8, background: active ? C.gold : "transparent", fontFamily: "DM Sans,sans-serif" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: active ? "#000" : C.textSec }}>{opt.label}</span>
          {opt.save && (
            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 99, background: active ? "rgba(0,0,0,.2)" : "rgba(16,185,129,.14)", color: active ? "#000" : C.green, letterSpacing: ".4px" }}>
              {opt.save}
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
  const isEnt = planKey === "enterprise";
  const isHot = planKey === "growth";
  const names = { basic: "Basic", growth: "Growth", enterprise: "Enterprise" };
  const tags  = { basic: "For small teams",   growth: "For growing teams",    enterprise: "For large teams" };

  const price   = isEnt ? null : PRICES[planKey][billing];
  const saving  = !isEnt && billing !== "monthly" ? SAVINGS[planKey][billing] : null;
  const cycle   = { monthly: "/month", halfyearly: "/6 months", yearly: "/year" }[billing];
  const feats   = PLAN_FEATS[planKey];
  const retention = planKey === "basic" ? "7-day recording retention" : planKey === "growth" ? "30-day recording retention" : "365-day / lifetime retention";

  return (
    <div className="pp2-plan-card pp2-up"
      style={{
        borderRadius: 18, padding: "30px 26px", position: "relative",
        border: isHot ? `1px solid rgba(212,175,55,.55)` : `1px solid ${C.border}`,
        background: isHot ? "#1C1708" : C.surface,
        boxShadow: isHot ? "0 0 70px rgba(212,175,55,.1)" : "none",
        animationDelay: `${idx * .1}s`,
      }}>

      {isHot && (
        <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: C.gold, color: "#000", fontFamily: "DM Sans,sans-serif", fontSize: 10, fontWeight: 800, padding: "3px 16px", borderRadius: 99, whiteSpace: "nowrap", letterSpacing: ".6px", textTransform: "uppercase", boxShadow: "0 2px 12px rgba(212,175,55,.35)" }}>
          Most Popular
        </div>
      )}

      <p style={{ fontFamily: "DM Sans,sans-serif", fontSize: 10, fontWeight: 700, color: isHot ? C.gold : C.textMuted, textTransform: "uppercase", letterSpacing: "1.3px", marginBottom: 6 }}>{names[planKey]}</p>
      <p style={{ fontFamily: "DM Sans,sans-serif", fontSize: 12, color: C.textMuted, marginBottom: 16 }}>{tags[planKey]}</p>

      {/* Price */}
      {isEnt ? (
        <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginBottom: 8 }}>
          <span style={{ fontFamily: "Playfair Display,serif", fontWeight: 700, fontSize: 32, color: C.text, letterSpacing: "-1px" }}>Custom</span>
          <span style={{ fontFamily: "DM Sans,sans-serif", fontSize: 13, color: C.textMuted }}>pricing</span>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 8 }}>
          <span style={{ fontFamily: "Playfair Display,serif", fontWeight: 700, fontSize: 34, letterSpacing: "-1.2px", color: isHot ? C.gold : C.text }}>{fmtINR(price)}</span>
          <span style={{ fontFamily: "DM Sans,sans-serif", fontSize: 13, color: C.textMuted }}>{cycle}</span>
        </div>
      )}

      {/* Savings badge */}
      {saving && (
        <div className="pp2-pop" style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 6, marginBottom: 10, background: "rgba(16,185,129,.1)", border: "1px solid rgba(16,185,129,.22)" }}>
          <Ic d={D.tag} s={11} c={C.green} />
          <span style={{ fontFamily: "DM Sans,sans-serif", fontSize: 11, fontWeight: 700, color: C.green }}>Save {fmtINR(saving)} vs monthly</span>
        </div>
      )}

      {/* Retention */}
      <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 12px", borderRadius: 8, background: C.bg, border: `1px solid ${C.border}`, marginBottom: 18 }}>
        <Ic d={D.hdd} s={13} c={isHot ? C.gold : C.textMuted} />
        <span style={{ fontFamily: "DM Sans,sans-serif", fontSize: 12, color: isHot ? C.textSec : "#666" }}>
          {retention}
        </span>
      </div>

      <div style={{ height: 1, background: C.border, marginBottom: 18 }} />

      {/* Features */}
      <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 26 }}>
        {feats.map((f, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
            <Ic d={D.check} s={13} c={isHot ? C.gold : C.green} />
            <span style={{ fontFamily: "DM Sans,sans-serif", fontSize: 13, color: "#CCCCCC", lineHeight: 1.45 }}>{f}</span>
          </div>
        ))}
      </div>

      {/* CTA */}
      <a href="/login" className="pp2-cta-gold"
        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "13px 0", borderRadius: 9, width: "100%", textDecoration: "none", background: isHot ? C.gold : "transparent", color: isHot ? "#000" : C.textSec, border: isHot ? "none" : `1px solid ${C.border}`, fontFamily: "DM Sans,sans-serif", fontSize: 14, fontWeight: 700, boxShadow: isHot ? "0 4px 24px rgba(212,175,55,.28)" : "none" }}>
        {isEnt ? "Contact Tony" : "Get started"} <Ic d={D.chevR} s={13} c={isHot ? "#000" : C.textMuted} />
      </a>
      {isEnt && <p style={{ fontFamily: "DM Sans,sans-serif", fontSize: 11, color: C.textMuted, textAlign: "center", marginTop: 10 }}>WhatsApp Tony for a custom quote</p>}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 4. COMPARISON TABLE
// ═══════════════════════════════════════════════════════════════════════════════
const CompareTable = () => (
  <section style={{ padding: "0 24px" }}>
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <Eyebrow>Full breakdown</Eyebrow>
      <h2 className="pp2-h2" style={{ fontFamily: "Playfair Display,serif", fontWeight: 700, fontSize: 28, color: C.text, textAlign: "center", letterSpacing: "-.7px", marginBottom: 36, lineHeight: 1.2 }}>
        Compare every feature.
      </h2>
      <div className="pp2-cmp-wrap" style={{ borderRadius: 14, border: `1px solid ${C.border}`, overflow: "hidden" }}>
        {/* Header */}
        <div style={{ display: "grid", gridTemplateColumns: "2.2fr 1fr 1fr 1fr", background: "#0E0E0E", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ padding: "13px 18px", fontFamily: "DM Sans,sans-serif", fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: ".7px" }}>Feature</div>
          {[{ n: "Basic", hot: false }, { n: "Growth", hot: true }, { n: "Enterprise", hot: false }].map((col) => (
            <div key={col.n} style={{ padding: "13px 12px", textAlign: "center", borderLeft: `1px solid ${C.border}`, background: col.hot ? "rgba(212,175,55,.06)" : "transparent" }}>
              <span style={{ fontFamily: "DM Sans,sans-serif", fontSize: 12, fontWeight: 700, color: col.hot ? C.gold : C.textSec }}>{col.n}</span>
            </div>
          ))}
        </div>
        {/* Rows */}
        {CMP_ROWS.map((row, i) => (
          <div key={i} className="pp2-row-hover" style={{ display: "grid", gridTemplateColumns: "2.2fr 1fr 1fr 1fr", borderTop: "1px solid #1A1A1B" }}>
            <div className="pp2-td" style={{ padding: "12px 18px", fontFamily: "DM Sans,sans-serif", fontSize: 13, color: C.textSec }}>{row.label}</div>
            {(["basic", "growth", "enterprise"]).map((pk, pi) => (
              <div key={pk} className="pp2-td" style={{ padding: "12px 12px", display: "flex", alignItems: "center", justifyContent: "center", borderLeft: "1px solid #1A1A1B", background: pi === 1 ? "rgba(212,175,55,.025)" : "transparent" }}>
                <CellVal v={row[pk]} hot={pi === 1} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  </section>
);

// ═══════════════════════════════════════════════════════════════════════════════
// 5. STORAGE ADD-ON
// ═══════════════════════════════════════════════════════════════════════════════
const StorageAddon = () => (
  <section style={{ padding: "0 24px" }}>
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <Eyebrow>Add-ons</Eyebrow>
      <h2 className="pp2-h2" style={{ fontFamily: "Playfair Display,serif", fontWeight: 700, fontSize: 28, color: C.text, textAlign: "center", letterSpacing: "-.7px", marginBottom: 36, lineHeight: 1.2 }}>
        Need more call history?
      </h2>

      {/* Storage add-on card */}
      <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap", padding: "26px 28px", borderRadius: 16, background: C.surface, border: `1px solid ${C.border}`, marginBottom: 14 }}>
        <div style={{ width: 52, height: 52, borderRadius: 13, background: "rgba(212,175,55,.12)", border: "1px solid rgba(212,175,55,.28)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Ic d={D.hdd} s={23} c={C.gold} />
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <h3 style={{ fontFamily: "Playfair Display,serif", fontWeight: 700, fontSize: 16, color: C.text }}>Storage Top-up</h3>
            <span style={{ padding: "2px 9px", borderRadius: 99, background: C.goldMuted, border: `1px solid ${C.gold}33`, fontFamily: "DM Sans,sans-serif", fontSize: 10, fontWeight: 700, color: C.gold, letterSpacing: ".5px", textTransform: "uppercase" }}>Add-on</span>
          </div>
          <p style={{ fontFamily: "DM Sans,sans-serif", fontSize: 13.5, color: C.textSec, lineHeight: 1.72 }}>
            Add <strong style={{ color: C.textSec }}>+100 GB</strong> of recording storage to any plan. Stack multiple top-ups. Or use <strong style={{ color: C.textSec }}>Self-Archive</strong> in Company Settings to export recordings to Google Drive before expiry — keeping TIRAS storage at zero cost.
          </p>
        </div>
        <div style={{ textAlign: "center", flexShrink: 0 }}>
          <p style={{ fontFamily: "Playfair Display,serif", fontWeight: 700, fontSize: 28, color: C.gold, letterSpacing: "-.8px" }}>₹500</p>
          <p style={{ fontFamily: "DM Sans,sans-serif", fontSize: 12, color: C.textMuted }}>per month</p>
          <p style={{ fontFamily: "DM Sans,sans-serif", fontSize: 11, color: C.textMuted, marginTop: 3 }}>per 100 GB</p>
        </div>
      </div>

      {/* Wallet add-on card */}
      <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap", padding: "26px 28px", borderRadius: 16, background: C.surface, border: `1px solid ${C.border}`, marginBottom: 14 }}>
        <div style={{ width: 52, height: 52, borderRadius: 13, background: "rgba(230,57,70,.1)", border: "1px solid rgba(230,57,70,.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Ic d={D.wallet} s={23} c={C.red} />
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <h3 style={{ fontFamily: "Playfair Display,serif", fontWeight: 700, fontSize: 16, color: C.text }}>Plivo Calling Wallet</h3>
            <span style={{ padding: "2px 9px", borderRadius: 99, background: "rgba(230,57,70,.1)", border: "1px solid rgba(230,57,70,.25)", fontFamily: "DM Sans,sans-serif", fontSize: 10, fontWeight: 700, color: C.red, letterSpacing: ".5px", textTransform: "uppercase" }}>Usage</span>
          </div>
          <p style={{ fontFamily: "DM Sans,sans-serif", fontSize: 13.5, color: C.textSec, lineHeight: 1.72 }}>
            Pre-pay Plivo calling credits via Razorpay on the TIRAS web dashboard. Calling costs approximately <strong style={{ color: C.textSec }}>₹0.40/min</strong>. Low-balance alerts fire in-app and via Notifications when balance drops below ₹200. Calling stops if wallet hits ₹0.
          </p>
        </div>
        <div style={{ textAlign: "center", flexShrink: 0 }}>
          <p style={{ fontFamily: "Playfair Display,serif", fontWeight: 700, fontSize: 22, color: C.red, letterSpacing: "-.5px" }}>₹0.40</p>
          <p style={{ fontFamily: "DM Sans,sans-serif", fontSize: 12, color: C.textMuted }}>per minute</p>
          <p style={{ fontFamily: "DM Sans,sans-serif", fontSize: 11, color: C.textMuted, marginTop: 3 }}>pay as you go</p>
        </div>
      </div>

      {/* Auto-cleanup note */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 18px", borderRadius: 10, background: "#0E0E0E", border: `1px solid ${C.border}` }}>
        <Ic d={D.refresh} s={14} c={C.gold} />
        <p style={{ fontFamily: "DM Sans,sans-serif", fontSize: 12.5, color: C.textMuted, lineHeight: 1.72 }}>
          <strong style={{ color: C.textSec }}>Auto-cleanup:</strong> A Firebase Cloud Function runs at 2 AM daily and deletes recordings beyond your plan's retention limit. The call log and AI summary remain permanently — only the audio file is removed. Lead records update to show "Recording Expired" so nothing is hidden from your team.
        </p>
      </div>
    </div>
  </section>
);

// ═══════════════════════════════════════════════════════════════════════════════
// 6. FAQ
// ═══════════════════════════════════════════════════════════════════════════════
const FAQ = () => {
  const [open, setOpen] = useState(null);
  const toggle = (i) => setOpen(open === i ? null : i);

  return (
    <section style={{ padding: "0 24px" }}>
      <div style={{ maxWidth: 700, margin: "0 auto" }}>
        <Eyebrow>FAQ</Eyebrow>
        <h2 className="pp2-h2" style={{ fontFamily: "Playfair Display,serif", fontWeight: 700, fontSize: 28, color: C.text, textAlign: "center", letterSpacing: "-.7px", marginBottom: 36, lineHeight: 1.2 }}>
          Pricing questions answered.
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {FAQS.map((faq, i) => {
            const isOpen = open === i;
            return (
              <div key={i} style={{ borderRadius: 11, border: `1px solid ${isOpen ? "#3A3A2A" : C.border}`, overflow: "hidden", background: isOpen ? "#161308" : C.surface, transition: "all .15s" }}>
                <button className="pp2-faq-btn"
                  onClick={() => toggle(i)}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "17px 20px", background: "none", gap: 14, textAlign: "left" }}>
                  <span style={{ fontFamily: "DM Sans,sans-serif", fontSize: 14, fontWeight: 600, color: isOpen ? C.text : "#CCCCCC", lineHeight: 1.45, flex: 1 }}>
                    {faq.q}
                  </span>
                  <span style={{ color: isOpen ? C.gold : C.textMuted, display: "flex", flexShrink: 0, transition: "transform .2s, color .2s", transform: isOpen ? "rotate(180deg)" : "none" }}>
                    <Ic d={D.chevD} s={16} c="currentColor" />
                  </span>
                </button>
                {isOpen && (
                  <div style={{ padding: "0 20px 18px", borderTop: `1px solid ${C.border}` }}>
                    <p style={{ fontFamily: "DM Sans,sans-serif", fontSize: 13.5, color: C.textSec, lineHeight: 1.8, paddingTop: 14 }}>{faq.a}</p>
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
// 7. BOTTOM CTA STRIP
// ═══════════════════════════════════════════════════════════════════════════════
const CtaStrip = () => (
  <section style={{ padding: "0 24px" }}>
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      <div style={{ borderRadius: 20, border: "1px solid rgba(212,175,55,.35)", background: "linear-gradient(135deg,#1C1608 0%,#121212 100%)", padding: "48px 40px", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 500, height: 260, borderRadius: "50%", background: "radial-gradient(ellipse,rgba(212,175,55,.13) 0%,transparent 66%)", pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(37,211,102,.1)", border: "1px solid rgba(37,211,102,.25)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
            <Ic d={D.wa} s={26} c="#25D366" />
          </div>
          <h2 className="pp2-h2" style={{ fontFamily: "Playfair Display,serif", fontWeight: 700, fontSize: 30, color: C.text, letterSpacing: "-.8px", lineHeight: 1.15, marginBottom: 14 }}>
            Talk to Tony directly.
          </h2>
          <p style={{ fontFamily: "DM Sans,sans-serif", fontSize: 15, color: C.textSec, lineHeight: 1.72, maxWidth: 440, margin: "0 auto 32px" }}>
            Still have questions? Tony responds personally on WhatsApp — usually within 2 hours, 7 days a week.
          </p>
          <div className="pp2-cta-strip" style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
            <a href="https://wa.me/91XXXXXXXXXX?text=Hi%20Tony%2C%20I%20want%20to%20know%20more%20about%20TIRAS%20CRM%20pricing"
              target="_blank" rel="noreferrer" className="pp2-cta-gold"
              style={{ fontFamily: "DM Sans,sans-serif", display: "inline-flex", alignItems: "center", gap: 9, padding: "13px 28px", borderRadius: 10, background: "#25D366", color: "#000", fontSize: 14, fontWeight: 800, textDecoration: "none", boxShadow: "0 6px 30px rgba(37,211,102,.24)" }}>
              <Ic d={D.wa} s={16} c="#000" /> Chat on WhatsApp
            </a>
            <a href="/login" className="pp2-cta-ghost"
              style={{ fontFamily: "DM Sans,sans-serif", display: "inline-flex", alignItems: "center", gap: 9, padding: "13px 24px", borderRadius: 10, border: `1px solid ${C.border}`, background: "transparent", color: C.textSec, fontSize: 14, fontWeight: 600, textDecoration: "none" }}>
              Start free trial <Ic d={D.arrow} s={14} c={C.textMuted} />
            </a>
          </div>
          <p style={{ fontFamily: "DM Sans,sans-serif", fontSize: 11, color: C.textMuted, marginTop: 18 }}>
            Replace 91XXXXXXXXXX with Tony's actual number before going live.
          </p>
        </div>
      </div>
    </div>
  </section>
);

// ═══════════════════════════════════════════════════════════════════════════════
// FOOTER
// ═══════════════════════════════════════════════════════════════════════════════
const Footer = () => (
  <footer style={{ marginTop: 72, background: "#080808", borderTop: "1px solid #111", padding: "36px 24px 28px" }}>
    <div className="pp2-footer-flex" style={{ maxWidth: 1000, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
      <Logo />
      <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
        {["Home", "Features", "Help Center", "Privacy", "Terms"].map((l) => (
          <a key={l} href="#" className="pp2-footer-link" style={{ fontFamily: "DM Sans,sans-serif", fontSize: 13, color: "#3A3A3A", textDecoration: "none" }}>{l}</a>
        ))}
      </div>
      <p style={{ fontFamily: "DM Sans,sans-serif", fontSize: 11, color: "#2A2A2B" }}>© 2026 TIRAS CRM · V2</p>
    </div>
  </footer>
);

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT EXPORT
// ═══════════════════════════════════════════════════════════════════════════════
export const PricingPage = () => {
  const [billing, setBilling] = useState("monthly");

  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "DM Sans,sans-serif" }}>
      <Navbar />

      {/* Hero */}
      <section style={{ padding: "72px 24px 60px", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -60, left: "50%", transform: "translateX(-50%)", width: 700, height: 400, borderRadius: "50%", background: "radial-gradient(ellipse,rgba(212,175,55,.12) 0%,transparent 64%)", pointerEvents: "none" }} />
        <div style={{ position: "relative", maxWidth: 660, margin: "0 auto" }}>
          <Eyebrow>Pricing</Eyebrow>
          <h1 className="pp2-up pp2-h1" style={{ fontFamily: "Playfair Display,serif", fontWeight: 700, fontSize: 50, color: C.text, letterSpacing: "-2px", lineHeight: 1.08, marginBottom: 18 }}>
            Simple pricing.<br />
            <em style={{ fontStyle: "italic", background: "linear-gradient(92deg,#D4AF37 0%,#F0D060 50%,#D4AF37 100%)", backgroundSize: "200% auto", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", animation: "pp2-shine 4s linear infinite" }}>
              No surprises.
            </em>
          </h1>
          <p className="pp2-up pp2-d1" style={{ fontFamily: "DM Sans,sans-serif", fontSize: 16, color: C.textSec, maxWidth: 440, margin: "0 auto 34px", lineHeight: 1.72 }}>
            Every Phase 1 feature included in all plans. No hidden charges. Cancel anytime.
          </p>

          {/* Billing toggle */}
          <div className="pp2-up pp2-d2">
            <BillingToggle value={billing} onChange={setBilling} />
          </div>

          {/* Savings note */}
          {billing !== "monthly" && (
            <p className="pp2-pop" style={{ fontFamily: "DM Sans,sans-serif", fontSize: 12.5, color: C.green, marginTop: 14 }}>
              {billing === "halfyearly"
                ? "Basic saves ₹1,800 · Growth saves ₹3,000 vs monthly"
                : "Basic saves ₹5,600 · Growth saves ₹9,000 vs monthly"}
            </p>
          )}
        </div>
      </section>

      {/* Plan cards */}
      <section style={{ padding: "0 24px 72px" }}>
        <div className="pp2-plans-grid" style={{ maxWidth: 980, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 18, alignItems: "start" }}>
          {["basic", "growth", "enterprise"].map((pk, i) => (
            <PlanCard key={pk} planKey={pk} billing={billing} idx={i} />
          ))}
        </div>

        {/* Billing notes */}
        <div className="pp2-notes-row" style={{ maxWidth: 980, margin: "20px auto 0", display: "flex", alignItems: "center", justifyContent: "center", gap: 24, padding: "14px 20px", borderRadius: 10, background: "#0E0E0E", border: `1px solid ${C.border}`, flexWrap: "wrap" }}>
          {[
            { c: C.green, t: "All payments via Razorpay web — never Play Store" },
            { c: "#3B82F6", t: "Razorpay charges 2% per transaction" },
            { c: C.gold,  t: "Plivo calling billed from wallet at ~₹0.40/min" },
          ].map((n, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: n.c, flexShrink: 0 }} />
              <span style={{ fontFamily: "DM Sans,sans-serif", fontSize: 12, color: C.textMuted }}>{n.t}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Comparison table */}
      <section style={{ paddingBottom: 72 }}><CompareTable /></section>

      {/* Storage & wallet add-ons */}
      <section style={{ paddingBottom: 72 }}><StorageAddon /></section>

      {/* FAQ */}
      <section style={{ paddingBottom: 72 }}><FAQ /></section>

      {/* CTA strip */}
      <section style={{ paddingBottom: 0 }}><CtaStrip /></section>

      <Footer />
    </div>
  );
};

export default PricingPage;
