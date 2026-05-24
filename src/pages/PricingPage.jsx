import { useState } from "react";

/* ─────────────────────────────────────────────────────────────────────────────
   TIRAS CRM — PricingPage
   Production-ready public pricing page
   Theme: Obsidian Gold · Playfair Display + DM Sans
   Export: export const PricingPage
───────────────────────────────────────────────────────────────────────────── */

// ── Inject global styles ──────────────────────────────────────────────────────
const STYLE_ID = "tiras-pp-v2-prod";
if (typeof document !== "undefined" && !document.getElementById(STYLE_ID)) {
  const el = document.createElement("style");
  el.id = STYLE_ID;
  el.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,800;1,700&family=DM+Sans:wght@400;500;600;700&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; }

    @keyframes pp-up    { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
    @keyframes pp-shine { 0%{background-position:-200% center} 100%{background-position:200% center} }
    @keyframes pp-pop   { 0%{transform:scale(.9);opacity:0} 100%{transform:scale(1);opacity:1} }

    .pp-up   { animation:pp-up .5s cubic-bezier(.22,.68,0,1.1) both; }
    .pp-pop  { animation:pp-pop .28s cubic-bezier(.34,1.56,.64,1) both; }
    .pp-d1   { animation-delay:.07s; } .pp-d2 { animation-delay:.14s; }
    .pp-d3   { animation-delay:.21s; } .pp-d4 { animation-delay:.28s; }

    .pp-nav-link:hover   { color:#D4AF37 !important; }
    .pp-nav-link         { transition:color .14s; }
    .pp-cta-gold:hover   { filter:brightness(1.1); transform:translateY(-2px); box-shadow:0 12px 44px rgba(212,175,55,.4) !important; }
    .pp-cta-gold         { transition:all .18s ease; }
    .pp-cta-ghost:hover  { border-color:#D4AF37 !important; color:#D4AF37 !important; }
    .pp-cta-ghost        { transition:all .15s ease; }
    .pp-plan-card        { transition:transform .2s ease, box-shadow .2s ease; }
    .pp-plan-card:hover  { transform:translateY(-5px); }
    .pp-faq-item         { transition:background .14s, border-color .14s; }
    .pp-faq-btn          { transition:background .14s; cursor:pointer; border:none; }
    .pp-faq-btn:hover    { background:rgba(255,255,255,.03) !important; }
    .pp-topup-btn        { transition:all .15s; cursor:pointer; }
    .pp-topup-btn:hover  { border-color:rgba(212,175,55,.6) !important; background:rgba(212,175,55,.1) !important; }
    .pp-topup-btn.active { border-color:#D4AF37 !important; background:rgba(212,175,55,.18) !important; color:#D4AF37 !important; }
    .pp-footer-link:hover { color:#D4AF37 !important; }
    .pp-footer-link      { transition:color .14s; }
    .pp-cmp-row:hover td,
    .pp-cmp-row:hover .pp-td { background:#1E1E1F !important; }

    @media (max-width:780px) {
      .pp-plans-grid   { grid-template-columns:1fr !important; max-width:400px; margin-left:auto; margin-right:auto; }
      .pp-model-grid   { grid-template-columns:1fr !important; }
      .pp-wallet-grid  { grid-template-columns:1fr !important; }
      .pp-hide-mobile  { display:none !important; }
      .pp-h1           { font-size:36px !important; letter-spacing:-1px !important; }
      .pp-h2           { font-size:24px !important; }
      .pp-cmp-wrap     { overflow-x:auto; display:block; }
      .pp-footer-inner { flex-direction:column !important; gap:32px !important; }
      .pp-footer-bot   { flex-direction:column !important; gap:8px !important; align-items:flex-start !important; }
      .pp-cta-strip    { flex-direction:column !important; gap:12px !important; align-items:stretch !important; }
    }
  `;
  document.head.appendChild(el);
}

// ── SVG Icon ──────────────────────────────────────────────────────────────────
const Ic = ({ d, s = 16, c = "currentColor", fill = "none" }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill={fill}
    stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
    style={{ flexShrink: 0 }} aria-hidden="true"><path d={d} /></svg>
);

const D = {
  check:   "M20 6L9 17l-5-5",
  minus:   "M5 12h14",
  x:       "M18 6L6 18M6 6l12 12",
  arrow:   "M5 12h14M12 5l7 7-7 7",
  chevR:   "M9 18l6-6-6-6",
  chevD:   "M6 9l6 6 6-6",
  chevU:   "M18 15l-6-6-6 6",
  menu:    "M3 12h18M3 6h18M3 18h18",
  wa:      "M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z",
  wallet:  "M21 12V7H5a2 2 0 0 1 0-4h14v4M21 12a2 2 0 0 1 0 4H5a2 2 0 0 1 0-4h16v4",
  shield:  "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  hdd:     "M22 12H2M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11zM6 16h.01M10 16h.01",
  bell:    "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0",
  tag:     "M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82zM7 7h.01",
  info:    "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-4M12 8h.01",
  lock:    "M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2zM7 11V7a5 5 0 0 1 10 0v4",
  zap:     "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
  phone:   "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13 19.79 19.79 0 0 1 1.61 4.37 2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.18 6.18",
  upgrade: "M12 19V5M5 12l7-7 7 7",
  users:   "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  headset: "M3 18v-6a9 9 0 0 1 18 0v6M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z",
  star:    "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
};

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:       "#121212",
  surface:  "#1A1A1B",
  surfHov:  "#222223",
  border:   "#2A2A2B",
  gold:     "#D4AF37",
  goldMut:  "rgba(212,175,55,0.12)",
  red:      "#E63946",
  green:    "#10B981",
  blue:     "#3B82F6",
  text:     "#F5F5F5",
  textSec:  "#9A9A9A",
  textMut:  "#555555",
};

// ── Logo ──────────────────────────────────────────────────────────────────────
const Logo = ({ size = 30 }) => (
  <a href="/" style={{ display: "flex", alignItems: "center", gap: 9, textDecoration: "none" }}>
    <div style={{ width: size, height: size, borderRadius: Math.round(size * 0.28), background: "linear-gradient(145deg,#D4AF37,#8A7020)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Playfair Display',serif", fontWeight: 700, fontSize: Math.round(size * 0.55), color: "#000", boxShadow: "0 0 16px rgba(212,175,55,.3)", flexShrink: 0 }}>T</div>
    <span style={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, fontSize: Math.round(size * 0.65), color: "#F5F5F5", letterSpacing: "1px" }}>TIRAS</span>
  </a>
);

// ── Eyebrow ───────────────────────────────────────────────────────────────────
const Eyebrow = ({ children }) => (
  <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, fontWeight: 700, color: C.gold, textTransform: "uppercase", letterSpacing: "1.6px", textAlign: "center", marginBottom: 14 }}>{children}</p>
);

// ── Section H2 ────────────────────────────────────────────────────────────────
const H2 = ({ children, sub, style: extra }) => (
  <div style={{ textAlign: "center", marginBottom: sub ? 16 : 52, ...extra }}>
    <h2 className="pp-h2" style={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, fontSize: 34, color: C.text, letterSpacing: "-.7px", lineHeight: 1.18, marginBottom: sub ? 14 : 0 }}>{children}</h2>
    {sub && <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 15, color: C.textSec, maxWidth: 480, margin: "0 auto", lineHeight: 1.72 }}>{sub}</p>}
  </div>
);

// ── CellVal ───────────────────────────────────────────────────────────────────
const CellVal = ({ v, hot }) => {
  if (v === true)  return <Ic d={D.check} s={15} c={hot ? C.gold : C.green} />;
  if (v === false) return <Ic d={D.minus} s={15} c="#2A2A2B" />;
  return <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 600, color: hot ? C.gold : C.textSec, textAlign: "center", lineHeight: 1.3 }}>{v}</span>;
};

// ═══════════════════════════════════════════════════════════════════════════════
// NAVBAR
// ═══════════════════════════════════════════════════════════════════════════════
const Navbar = () => {
  const [menuOpen, setMenuOpen] = useState(false);

  const NAV_LINKS = [
    { label: "Features",    href: "/#features"    },
    { label: "How It Works",href: "/#how-it-works" },
    { label: "Pricing",     href: "#"              },
  ];

  return (
    <nav style={{ position: "sticky", top: 0, zIndex: 200, background: "rgba(10,10,10,.94)", borderBottom: `1px solid ${C.border}`, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}>
      <div style={{ maxWidth: 1140, margin: "0 auto", padding: "0 24px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Logo />

        <nav className="pp-hide-mobile" style={{ display: "flex", gap: 32 }}>
          {NAV_LINKS.map(({ label, href }) => (
            <a key={label} href={href} className="pp-nav-link"
              style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, fontWeight: 500, color: label === "Pricing" ? C.gold : C.textSec, textDecoration: "none" }}>
              {label}
            </a>
          ))}
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <a href="/" className="pp-cta-ghost pp-hide-mobile"
            style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 500, color: C.textSec, padding: "7px 14px", borderRadius: 8, border: `1px solid ${C.border}`, textDecoration: "none" }}>
            ← Back to Home
          </a>
          <a href="/register" className="pp-cta-gold"
            style={{ fontFamily: "'DM Sans',sans-serif", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "#000", background: C.gold, padding: "9px 20px", borderRadius: 8, textDecoration: "none", boxShadow: "0 4px 18px rgba(212,175,55,.25)" }}>
            Start Free Trial <Ic d={D.arrow} s={13} c="#000" />
          </a>
          <button
            onClick={() => setMenuOpen(o => !o)}
            style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 9px", cursor: "pointer", alignItems: "center", display: "none" }}
            className="pp-show-mobile">
            <Ic d={menuOpen ? D.x : D.menu} s={18} c={C.text} />
          </button>
        </div>
      </div>
      {menuOpen && (
        <div style={{ background: "#111", borderTop: `1px solid ${C.border}`, padding: "14px 24px 22px", display: "flex", flexDirection: "column" }}>
          {NAV_LINKS.map(({ label, href }) => (
            <a key={label} href={href} onClick={() => setMenuOpen(false)}
              style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 15, fontWeight: 500, color: C.textSec, textDecoration: "none", padding: "12px 0", borderBottom: `1px solid #1A1A1B` }}>{label}</a>
          ))}
          <a href="/register"
            style={{ marginTop: 14, fontFamily: "'DM Sans',sans-serif", fontSize: 14, fontWeight: 700, color: "#000", background: C.gold, padding: "12px 0", borderRadius: 9, textAlign: "center", textDecoration: "none" }}>
            Start Free Trial →
          </a>
        </div>
      )}
    </nav>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// HERO
// ═══════════════════════════════════════════════════════════════════════════════
const Hero = () => (
  <section style={{ padding: "72px 24px 60px", textAlign: "center", position: "relative", overflow: "hidden", background: C.bg }}>
    <div style={{ position: "absolute", top: "-10%", left: "50%", transform: "translateX(-50%)", width: "80%", height: "60%", background: "radial-gradient(ellipse,rgba(212,175,55,.1) 0%,transparent 66%)", borderRadius: "50%", pointerEvents: "none" }} />
    <div style={{ position: "relative", maxWidth: 640, margin: "0 auto" }}>

      {/* No hidden fees badge */}
      <div className="pp-up" style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 14px", borderRadius: 99, background: "rgba(16,185,129,.1)", border: "1px solid rgba(16,185,129,.25)", marginBottom: 28 }}>
        <Ic d={D.shield} s={13} c={C.green} />
        <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 600, color: C.green }}>No hidden fees. No surprises. Ever.</span>
      </div>

      <h1 className="pp-up pp-d1 pp-h1"
        style={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, fontSize: 50, color: C.text, letterSpacing: "-1.8px", lineHeight: 1.08, marginBottom: 18 }}>
        Simple, Honest Pricing
      </h1>

      <p className="pp-up pp-d2"
        style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 16, color: C.textSec, lineHeight: 1.72, maxWidth: 440, margin: "0 auto 0" }}>
        One flat annual fee for the platform. Pay only for the calls you make.
      </p>
    </div>
  </section>
);

// ═══════════════════════════════════════════════════════════════════════════════
// BILLING MODEL EXPLANATION
// ═══════════════════════════════════════════════════════════════════════════════
const BillingModel = () => (
  <section style={{ padding: "0 24px 72px", background: C.bg }}>
    <div style={{ maxWidth: 820, margin: "0 auto" }}>
      <div className="pp-model-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

        {/* Platform fee */}
        <div style={{ padding: "28px 26px", borderRadius: 14, background: C.surface, border: `1px solid ${C.border}`, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ width: 46, height: 46, borderRadius: 12, background: "rgba(212,175,55,.12)", border: "1px solid rgba(212,175,55,.28)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Ic d={D.star} s={21} c={C.gold} />
          </div>
          <div>
            <h3 style={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, fontSize: 17, color: C.text, marginBottom: 10 }}>Platform Fee</h3>
            <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13.5, color: C.textSec, lineHeight: 1.72 }}>
              Your annual subscription gives your entire team full access to TIRAS — call recording, AI summaries, dashboards, lead management, and everything else. One price, all features.
            </p>
          </div>
          <div style={{ marginTop: "auto", padding: "10px 14px", borderRadius: 8, background: C.bg, border: `1px solid ${C.border}` }}>
            <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: C.textMut }}>Billed annually · Renews each year</p>
          </div>
        </div>

        {/* Calling wallet */}
        <div style={{ padding: "28px 26px", borderRadius: 14, background: C.surface, border: `1px solid ${C.border}`, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ width: 46, height: 46, borderRadius: 12, background: "rgba(16,185,129,.1)", border: "1px solid rgba(16,185,129,.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Ic d={D.wallet} s={21} c={C.green} />
          </div>
          <div>
            <h3 style={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, fontSize: 17, color: C.text, marginBottom: 10 }}>Calling Wallet</h3>
            <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13.5, color: C.textSec, lineHeight: 1.72 }}>
              Recharge your calling wallet anytime with ₹1,000 or more. Calls are charged at ₹1 per minute, deducted automatically. Your unused balance always carries forward — it never expires.
            </p>
          </div>
          <div style={{ marginTop: "auto", padding: "10px 14px", borderRadius: 8, background: C.bg, border: `1px solid ${C.border}` }}>
            <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: C.textMut }}>₹1/minute · Balance never expires</p>
          </div>
        </div>
      </div>
    </div>
  </section>
);

// ═══════════════════════════════════════════════════════════════════════════════
// PLAN CARDS
// ═══════════════════════════════════════════════════════════════════════════════
const PLANS = [
  {
    key: "starter", name: "Starter", price: "₹5,499", cycle: "/year",
    tag: "For small teams getting started", hot: false, popular: false,
    agents: "Up to 3 agents", managers: "1 manager",
    storage: "5 GB recording storage", retention: "15-day retention",
    support: "Standard support",
    feats: [
      "3 agents · 1 manager",
      "5 GB recording storage",
      "15-day call recording retention",
      "Click to call from browser",
      "Auto call recording",
      "AI call summaries",
      "Lead scoring & pipeline",
      "WhatsApp integration",
      "Follow-up reminders",
      "Team dashboard",
      "Standard email support",
    ],
    cta: "Get Started", ctaHref: "/register",
  },
  {
    key: "basic", name: "Basic", price: "₹9,999", cycle: "/year",
    tag: "For growing sales teams", hot: false, popular: false,
    feats: [
      "10 agents · 2 managers",
      "15 GB recording storage",
      "30-day call recording retention",
      "Everything in Starter",
      "Advanced reports & analytics",
      "Agent performance tracking",
      "Custom pipeline stages",
      "Priority email & chat support",
    ],
    cta: "Get Started", ctaHref: "/register",
  },
  {
    key: "growth", name: "Growth", price: "₹15,999", cycle: "/year",
    tag: "For teams that want no limits", hot: true, popular: true,
    feats: [
      "Unlimited agents & managers",
      "50 GB recording storage",
      "90-day call recording retention",
      "Everything in Basic",
      "Leaderboard & target tracking",
      "Bulk lead import & management",
      "Custom branding options",
      "Dedicated account support",
    ],
    cta: "Get Started", ctaHref: "/register",
  },
  {
    key: "enterprise", name: "Enterprise", price: "Custom", cycle: " pricing",
    tag: "For large organisations", hot: false, popular: false,
    feats: [
      "Unlimited agents & managers",
      "Custom recording storage",
      "365-day retention",
      "Everything in Growth",
      "Custom onboarding & training",
      "SLA guarantee",
      "Dedicated relationship manager",
      "Custom integrations on request",
    ],
    cta: "Contact Us", ctaHref: "https://wa.me/91XXXXXXXXXX?text=Hi%2C%20I%20want%20to%20know%20about%20TIRAS%20Enterprise%20pricing",
    ctaExternal: true,
  },
];

const PlanCards = () => (
  <section style={{ padding: "0 24px 80px", background: C.bg }}>
    <div style={{ maxWidth: 1080, margin: "0 auto" }}>
      <div className="pp-plans-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, alignItems: "start" }}>
        {PLANS.map((plan, i) => (
          <div key={plan.key} className="pp-plan-card pp-up"
            style={{ borderRadius: 16, padding: "26px 22px", position: "relative", border: plan.hot ? "1px solid rgba(212,175,55,.55)" : `1px solid ${C.border}`, background: plan.hot ? "#1C1608" : C.surface, boxShadow: plan.hot ? "0 0 70px rgba(212,175,55,.1)" : "none", animationDelay: `${i * .08}s` }}>
            {plan.popular && (
              <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: C.gold, color: "#000", fontFamily: "'DM Sans',sans-serif", fontSize: 9, fontWeight: 800, padding: "3px 14px", borderRadius: 99, whiteSpace: "nowrap", letterSpacing: ".6px", textTransform: "uppercase", boxShadow: "0 2px 12px rgba(212,175,55,.35)" }}>
                Most Popular
              </div>
            )}

            <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 9, fontWeight: 700, color: plan.hot ? C.gold : C.textMut, textTransform: "uppercase", letterSpacing: "1.2px", marginBottom: 6 }}>{plan.name}</p>
            <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: C.textMut, marginBottom: 16, lineHeight: 1.4 }}>{plan.tag}</p>

            <div style={{ display: "flex", alignItems: "baseline", gap: 3, marginBottom: 18 }}>
              <span style={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, fontSize: 28, color: plan.hot ? C.gold : C.text, letterSpacing: "-1px" }}>{plan.price}</span>
              <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: C.textMut }}>{plan.cycle}</span>
            </div>

            <div style={{ height: 1, background: C.border, marginBottom: 18 }} />

            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 22 }}>
              {plan.feats.map((f, j) => (
                <div key={j} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <Ic d={D.check} s={12} c={plan.hot ? C.gold : C.green} />
                  <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "#CCCCCC", lineHeight: 1.45 }}>{f}</span>
                </div>
              ))}
            </div>

            <a href={plan.ctaHref}
              target={plan.ctaExternal ? "_blank" : undefined}
              rel={plan.ctaExternal ? "noreferrer" : undefined}
              className="pp-cta-gold"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "11px 0", borderRadius: 9, width: "100%", background: plan.hot ? C.gold : "transparent", color: plan.hot ? "#000" : C.textSec, border: plan.hot ? "none" : `1px solid ${C.border}`, fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 700, textDecoration: "none", boxShadow: plan.hot ? "0 4px 24px rgba(212,175,55,.28)" : "none" }}>
              {plan.cta} <Ic d={D.chevR} s={12} c={plan.hot ? "#000" : C.textMut} />
            </a>
          </div>
        ))}
      </div>

      {/* Note below cards */}
      <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: C.textMut, textAlign: "center", marginTop: 24 }}>
        All plans include a 14-day free trial. Calling billed separately from wallet at ₹1/minute.
      </p>
    </div>
  </section>
);

// ═══════════════════════════════════════════════════════════════════════════════
// WALLET SECTION
// ═══════════════════════════════════════════════════════════════════════════════
const TOPUP_OPTS = ["₹1,000", "₹2,000", "₹5,000"];

const WalletSection = () => {
  const [selected, setSelected] = useState(1);

  const STEPS = [
    { icon: D.wallet,  color: C.gold,  title: "Recharge your wallet",        desc: "Add ₹1,000 or more using UPI, card, or net banking. Takes under a minute." },
    { icon: D.phone,   color: C.green, title: "Make calls",                   desc: "Every call deducts ₹1 per minute from your wallet automatically. No manual tracking." },
    { icon: D.bell,    color: C.red,   title: "Get low-balance alerts",       desc: "TIRAS alerts you when balance drops below ₹200 so you're never caught mid-campaign." },
  ];

  return (
    <section style={{ padding: "80px 24px", background: "#0C0C0C" }}>
      <div style={{ maxWidth: 820, margin: "0 auto" }}>
        <Eyebrow>Calling Wallet</Eyebrow>
        <H2 sub="Simple, pay-as-you-go calling. Recharge when you need it, use only what you call.">
          How the Calling Wallet works
        </H2>

        {/* Steps */}
        <div className="pp-wallet-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 40 }}>
          {STEPS.map((step, i) => (
            <div key={i} style={{ padding: "24px 20px", borderRadius: 12, background: C.surface, border: `1px solid ${C.border}`, display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-start" }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: `${step.color}18`, border: `1px solid ${step.color}28`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Ic d={step.icon} s={18} c={step.color} />
              </div>
              <div style={{ width: 24, height: 24, borderRadius: "50%", background: `${step.color}22`, border: `1px solid ${step.color}44`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, fontSize: 13, color: step.color }}>{i + 1}</span>
              </div>
              <h3 style={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, fontSize: 14, color: C.text, lineHeight: 1.3 }}>{step.title}</h3>
              <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: C.textSec, lineHeight: 1.7 }}>{step.desc}</p>
            </div>
          ))}
        </div>

        {/* Top-up selector */}
        <div style={{ padding: "28px 28px", borderRadius: 14, background: C.surface, border: `1px solid ${C.border}` }}>
          <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 600, color: C.textSec, marginBottom: 16 }}>Quick top-up options</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
            {TOPUP_OPTS.map((opt, i) => (
              <button key={opt} className={`pp-topup-btn ${selected === i ? "active" : ""}`}
                onClick={() => setSelected(i)}
                style={{ padding: "10px 24px", borderRadius: 9, border: `1px solid ${C.border}`, background: "transparent", fontFamily: "'DM Sans',sans-serif", fontSize: 14, fontWeight: 700, color: selected === i ? C.gold : C.textSec, minHeight: 44 }}>
                {opt}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 14px", borderRadius: 8, background: C.bg, border: `1px solid ${C.border}` }}>
            <Ic d={D.info} s={14} c={C.gold} />
            <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: C.textSec }}>
              Unused balance never expires. Top up again anytime — no minimum usage required.
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMPARISON TABLE
// ═══════════════════════════════════════════════════════════════════════════════
const CMP_ROWS = [
  { label: "Agents",                 starter: "3",           basic: "10",          growth: "Unlimited",  enterprise: "Unlimited"  },
  { label: "Managers",               starter: "1",           basic: "2",           growth: "Unlimited",  enterprise: "Unlimited"  },
  { label: "Recording storage",      starter: "5 GB",        basic: "15 GB",       growth: "50 GB",      enterprise: "Custom"     },
  { label: "Recording retention",    starter: "15 days",     basic: "30 days",     growth: "90 days",    enterprise: "365 days"   },
  { label: "AI call summaries",      starter: true,          basic: true,          growth: true,         enterprise: true         },
  { label: "Call recording",         starter: true,          basic: true,          growth: true,         enterprise: true         },
  { label: "Lead scoring",           starter: true,          basic: true,          growth: true,         enterprise: true         },
  { label: "WhatsApp button",        starter: true,          basic: true,          growth: true,         enterprise: true         },
  { label: "Leaderboard",            starter: true,          basic: true,          growth: true,         enterprise: true         },
  { label: "Custom pipeline stages", starter: false,         basic: true,          growth: true,         enterprise: true         },
  { label: "Advanced analytics",     starter: false,         basic: true,          growth: true,         enterprise: true         },
  { label: "Support",                starter: "Standard",    basic: "Priority",    growth: "Dedicated",  enterprise: "Manager"    },
  { label: "Custom onboarding",      starter: false,         basic: false,         growth: false,        enterprise: true         },
  { label: "SLA guarantee",          starter: false,         basic: false,         growth: false,        enterprise: true         },
];

const ComparisonTable = () => (
  <section style={{ padding: "80px 24px", background: C.bg }}>
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
      <Eyebrow>Compare plans</Eyebrow>
      <H2>All features side by side</H2>

      <div className="pp-cmp-wrap" style={{ borderRadius: 14, border: `1px solid ${C.border}`, overflow: "hidden" }}>
        {/* Header */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", background: "#0E0E0E", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ padding: "14px 18px", fontFamily: "'DM Sans',sans-serif", fontSize: 10, fontWeight: 700, color: C.textMut, textTransform: "uppercase", letterSpacing: ".7px" }}>Feature</div>
          {[
            { n: "Starter",    hot: false },
            { n: "Basic",      hot: false },
            { n: "Growth",     hot: true  },
            { n: "Enterprise", hot: false },
          ].map(col => (
            <div key={col.n} style={{ padding: "14px 12px", textAlign: "center", borderLeft: `1px solid ${C.border}`, background: col.hot ? "rgba(212,175,55,.07)" : "transparent" }}>
              <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 700, color: col.hot ? C.gold : C.textSec }}>{col.n}</span>
            </div>
          ))}
        </div>

        {/* Rows */}
        {CMP_ROWS.map((row, i) => (
          <div key={i} className="pp-cmp-row" style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", borderTop: "1px solid #181818" }}>
            <div className="pp-td" style={{ padding: "13px 18px", fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: C.textSec }}>{row.label}</div>
            {(["starter","basic","growth","enterprise"]).map((pk, pi) => (
              <div key={pk} className="pp-td"
                style={{ padding: "13px 12px", display: "flex", alignItems: "center", justifyContent: "center", borderLeft: "1px solid #181818", background: pi === 2 ? "rgba(212,175,55,.025)" : "transparent" }}>
                <CellVal v={row[pk]} hot={pi === 2} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  </section>
);

// ═══════════════════════════════════════════════════════════════════════════════
// FAQ
// ═══════════════════════════════════════════════════════════════════════════════
const FAQS = [
  {
    q: "Is calling included in the plan price?",
    a: "No — calling is billed separately through the Calling Wallet. Your plan subscription gives your team full access to all TIRAS features. Calls are charged at ₹1 per minute and deducted automatically from your wallet balance. This way you only pay for the calls your team actually makes.",
  },
  {
    q: "What happens when my wallet balance runs low?",
    a: "TIRAS sends an automatic in-app alert when your balance drops below ₹200. You can recharge your wallet at any time through the company dashboard using UPI, credit/debit card, or net banking. If the balance reaches ₹0, calling is paused until the next recharge — your data, recordings, and account remain fully intact.",
  },
  {
    q: "Can I upgrade my plan anytime?",
    a: "Yes. You can upgrade your plan at any time from the billing section of your dashboard. When upgrading, you pay the prorated difference for the remaining period of your annual subscription. Downgrading is available at the next renewal date.",
  },
  {
    q: "Is there a free trial?",
    a: "Yes — every plan comes with a 14-day free trial. No credit card is required to start. You'll have full access to all features of your chosen plan during the trial period. At the end of the trial, you can continue by subscribing or let the account lapse — no charges apply automatically.",
  },
  {
    q: "How is call recording stored?",
    a: "All call recordings are stored securely in the cloud with encryption at rest. The recording retention period depends on your plan: 15 days (Starter), 30 days (Basic), 90 days (Growth), and 365 days (Enterprise). Recordings older than your plan's retention period are automatically deleted. You can download recordings anytime before they expire.",
  },
  {
    q: "What payment methods are accepted?",
    a: "TIRAS accepts UPI (Google Pay, PhonePe, Paytm, and others), all major credit and debit cards, and net banking from Indian banks. Payments are processed securely through a certified payment gateway. All transactions are in Indian Rupees (₹) with GST applied as applicable.",
  },
];

const FAQ = () => {
  const [open, setOpen] = useState(null);
  const toggle = (i) => setOpen(open === i ? null : i);

  return (
    <section style={{ padding: "80px 24px", background: "#0C0C0C" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <Eyebrow>FAQ</Eyebrow>
        <H2 sub="Can't find what you're looking for? Chat with us on WhatsApp.">
          Frequently asked questions
        </H2>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {FAQS.map((faq, i) => {
            const isOpen = open === i;
            return (
              <div key={i} className="pp-faq-item"
                style={{ borderRadius: 11, border: `1px solid ${isOpen ? "#3A3A2A" : C.border}`, overflow: "hidden", background: isOpen ? "#161308" : C.surface }}>
                <button className="pp-faq-btn"
                  onClick={() => toggle(i)}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "17px 20px", background: "none", gap: 14, textAlign: "left" }}>
                  <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, fontWeight: 600, color: isOpen ? C.text : "#CCCCCC", lineHeight: 1.45, flex: 1 }}>
                    {faq.q}
                  </span>
                  <span style={{ color: isOpen ? C.gold : C.textMut, display: "flex", flexShrink: 0, transition: "transform .2s, color .2s", transform: isOpen ? "rotate(180deg)" : "none" }}>
                    <Ic d={D.chevD} s={16} c="currentColor" />
                  </span>
                </button>
                {isOpen && (
                  <div style={{ padding: "0 20px 18px", borderTop: `1px solid ${C.border}` }}>
                    <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13.5, color: C.textSec, lineHeight: 1.8, paddingTop: 14 }}>{faq.a}</p>
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
// BOTTOM CTA
// ═══════════════════════════════════════════════════════════════════════════════
const BottomCta = () => (
  <section style={{ padding: "80px 24px", background: C.bg }}>
    <div style={{ maxWidth: 820, margin: "0 auto" }}>
      <div style={{ borderRadius: 20, border: "1px solid rgba(212,175,55,.3)", background: "linear-gradient(135deg,#1C1608 0%,#121212 100%)", padding: "52px 40px", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 500, height: 280, borderRadius: "50%", background: "radial-gradient(ellipse,rgba(212,175,55,.12) 0%,transparent 66%)", pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(37,211,102,.1)", border: "1px solid rgba(37,211,102,.25)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
            <Ic d={D.headset} s={26} c="#25D366" />
          </div>
          <h2 className="pp-h2" style={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, fontSize: 30, color: C.text, letterSpacing: "-.8px", lineHeight: 1.15, marginBottom: 14 }}>
            Still have questions? Talk to us directly.
          </h2>
          <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 15, color: C.textSec, lineHeight: 1.72, maxWidth: 420, margin: "0 auto 32px" }}>
            Our team is happy to walk you through the right plan for your business size and industry.
          </p>
          <div className="pp-cta-strip" style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
            <a href="https://wa.me/91XXXXXXXXXX?text=Hi%2C%20I%20want%20to%20know%20more%20about%20TIRAS%20CRM"
              target="_blank" rel="noreferrer" className="pp-cta-gold"
              style={{ fontFamily: "'DM Sans',sans-serif", display: "inline-flex", alignItems: "center", gap: 9, padding: "13px 28px", borderRadius: 10, background: "#25D366", color: "#000", fontSize: 14, fontWeight: 800, textDecoration: "none", boxShadow: "0 6px 30px rgba(37,211,102,.24)" }}>
              <Ic d={D.wa} s={16} c="#000" /> Chat on WhatsApp
            </a>
            <a href="/register" className="pp-cta-ghost"
              style={{ fontFamily: "'DM Sans',sans-serif", display: "inline-flex", alignItems: "center", gap: 9, padding: "13px 24px", borderRadius: 10, border: `1px solid ${C.border}`, background: "transparent", color: C.textSec, fontSize: 14, fontWeight: 600, textDecoration: "none" }}>
              Start free trial <Ic d={D.arrow} s={14} c={C.textMut} />
            </a>
          </div>
          <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: C.textMut, marginTop: 18 }}>
            Replace 91XXXXXXXXXX with your actual WhatsApp number before going live.
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
  <footer style={{ background: "#080808", borderTop: "1px solid #111", padding: "48px 24px 28px" }}>
    <div className="pp-footer-inner" style={{ maxWidth: 1100, margin: "0 auto", display: "flex", justifyContent: "space-between", gap: 40, flexWrap: "wrap", marginBottom: 40 }}>
      <div>
        <Logo size={28} />
        <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 600, color: C.textSec, marginTop: 14 }}>Beyond Every Limit.</p>
      </div>
      <div style={{ display: "flex", gap: 48, flexWrap: "wrap" }}>
        {[
          { title: "Product", links: ["Features", "Pricing", "Help"] },
          { title: "Company", links: ["Contact",  "Privacy", "Terms"] },
        ].map(col => (
          <div key={col.title} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10, fontWeight: 700, color: "#444", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 4 }}>{col.title}</p>
            {col.links.map(l => (
              <a key={l} href="#" className="pp-footer-link"
                style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "#444", textDecoration: "none" }}>{l}</a>
            ))}
          </div>
        ))}
      </div>
    </div>
    <div className="pp-footer-bot" style={{ maxWidth: 1100, margin: "0 auto", borderTop: "1px solid #111", paddingTop: 22, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
      <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: "#333" }}>© 2026 TIRAS CRM. All rights reserved. Made in India 🇮🇳</p>
      <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: "#333" }}>AI-powered telecalling for Indian businesses</p>
    </div>
  </footer>
);

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT EXPORT
// ═══════════════════════════════════════════════════════════════════════════════
export const PricingPage = () => (
  <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "'DM Sans',sans-serif" }}>
    <Navbar />
    <Hero />
    <BillingModel />
    <PlanCards />
    <WalletSection />
    <ComparisonTable />
    <FAQ />
    <BottomCta />
    <Footer />
  </div>
);

export default PricingPage;
