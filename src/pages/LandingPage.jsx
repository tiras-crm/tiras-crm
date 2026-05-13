import { useState, useEffect, useRef } from "react";

/* ─────────────────────────────────────────────────────────────────────────────
   TIRAS CRM — Landing Page
   Theme: Carbon Copper  |  #121212 · #B65E3C · #F2A65A · #F5F5F5
   Public route — no auth needed. All CTAs → /login
───────────────────────────────────────────────────────────────────────────── */

// ── Global styles injected once ───────────────────────────────────────────────
const STYLE_ID = "tiras-lp-styles";
if (typeof document !== "undefined" && !document.getElementById(STYLE_ID)) {
  const s = document.createElement("style");
  s.id = STYLE_ID;
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; }

    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(26px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes shimmer {
      0%   { background-position: -200% center; }
      100% { background-position:  200% center; }
    }
    @keyframes ticker {
      from { transform: translateX(0); }
      to   { transform: translateX(-50%); }
    }

    .tl-fu  { animation: fadeUp .65s ease both; }
    .tl-d1  { animation-delay: .08s; }
    .tl-d2  { animation-delay: .18s; }
    .tl-d3  { animation-delay: .28s; }
    .tl-d4  { animation-delay: .38s; }
    .tl-d5  { animation-delay: .48s; }

    .tl-nav-link:hover   { color: #F2A65A !important; }
    .tl-footer-link:hover{ color: #F2A65A !important; }
    .tl-btn-primary:hover  { filter: brightness(1.1); transform: translateY(-2px); box-shadow: 0 10px 44px rgba(182,94,60,.45) !important; }
    .tl-btn-ghost:hover    { border-color: #B65E3C !important; color: #F2A65A !important; }
    .tl-feat-card:hover    { border-color: var(--cc,#B65E3C) !important; background: #181410 !important; transform: translateY(-4px); }
    .tl-why-item:hover .tl-why-ico { transform: scale(1.1); }
    .tl-plan-card:hover    { transform: translateY(-3px); }
    .tl-plan-btn:hover     { filter: brightness(1.1); }

    .tl-btn-primary  { transition: all .18s ease; }
    .tl-btn-ghost    { transition: all .18s ease; }
    .tl-feat-card    { transition: all .2s ease; }
    .tl-why-item     { transition: transform .15s ease; }
    .tl-why-ico      { transition: transform .2s ease; }
    .tl-plan-card    { transition: transform .2s ease; }
    .tl-plan-btn     { transition: filter .15s ease; }

    .tl-ticker-track { display: flex; width: max-content; animation: ticker 30s linear infinite; }
    .tl-ticker-track:hover { animation-play-state: paused; }

    @media (max-width: 780px) {
      .tl-hide-mob   { display: none !important; }
      .tl-show-mob   { display: flex !important; }
      .tl-col-1      { grid-template-columns: 1fr !important; }
      .tl-col-2-mob  { grid-template-columns: 1fr 1fr !important; }
      .tl-h1         { font-size: 40px !important; letter-spacing: -1px !important; }
      .tl-h2         { font-size: 28px !important; }
      .tl-hero-ctas  { flex-direction: column; align-items: stretch !important; }
      .tl-stats      { grid-template-columns: 1fr 1fr !important; }
      .tl-footer-row { flex-direction: column; gap: 40px !important; }
      .tl-cmp-grid   { grid-template-columns: 1fr !important; }
    }
    @media (min-width: 781px) {
      .tl-show-mob { display: none !important; }
    }
  `;
  document.head.appendChild(s);
}

// ── SVG icon ──────────────────────────────────────────────────────────────────
const Ic = ({ d, s = 18, c = "currentColor", fill = "none" }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill={fill}
    stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
    style={{ flexShrink: 0 }} aria-hidden="true">
    <path d={d} />
  </svg>
);

const D = {
  check:   "M20 6L9 17l-5-5",
  x:       "M18 6L6 18M6 6l12 12",
  arrow:   "M5 12h14M12 5l7 7-7 7",
  chevR:   "M9 18l6-6-6-6",
  menu:    "M3 12h18M3 6h18M3 18h18",
  phone:   "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13A19.79 19.79 0 0 1 1.61 4.37 2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.18 6.18",
  mic:     "M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8",
  brain:   "M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-1.98-3 2.5 2.5 0 0 1-1.32-4.24 3 3 0 0 1 .34-5.58 2.5 2.5 0 0 1 1.96-3.1A2.5 2.5 0 0 1 9.5 2zM14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 1.98-3 2.5 2.5 0 0 0 1.32-4.24 3 3 0 0 0-.34-5.58 2.5 2.5 0 0 0-1.96-3.1A2.5 2.5 0 0 0 14.5 2z",
  target:  "M22 12h-4M6 12H2M12 6V2M12 22v-4m6.36-9.64-2.83 2.83M8.47 15.53l-2.83 2.83M17.64 17.64l-2.83-2.83M8.47 8.47 5.64 5.64M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  wa:      "M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z",
  dash:    "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 22V12h6v10",
  ticket:  "M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z",
  star:    "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
  shield:  "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  trend:   "M23 6l-9.5 9.5-5-5L1 18M17 6h6v6",
  pin:     "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0zM12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  quote:   "M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1zM15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z",
  zap:     "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
};

// ── useInView ─────────────────────────────────────────────────────────────────
const useInView = (threshold = 0.12) => {
  const ref = useRef(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVis(true); io.disconnect(); } },
      { threshold }
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, vis];
};

// ── Logo ──────────────────────────────────────────────────────────────────────
const Logo = ({ size = 30 }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
    <div style={{
      width: size, height: size, borderRadius: size * 0.28,
      background: "linear-gradient(140deg,#C46840 0%,#7A2E10 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "Syne, sans-serif", fontWeight: 800,
      fontSize: size * 0.55, color: "#F5F5F5",
      boxShadow: "0 0 18px rgba(182,94,60,.38)",
    }}>T</div>
    <span style={{ fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: size * 0.67, color: "#F5F5F5", letterSpacing: "1.5px" }}>
      TIRAS
    </span>
  </div>
);

// ── Eyebrow label ─────────────────────────────────────────────────────────────
const Eyebrow = ({ children }) => (
  <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 11, fontWeight: 700, color: "#B65E3C", textTransform: "uppercase", letterSpacing: "1.5px", textAlign: "center", marginBottom: 14 }}>
    {children}
  </p>
);

// ── Section headline ──────────────────────────────────────────────────────────
const SectionH2 = ({ children, sub }) => (
  <div style={{ textAlign: "center", marginBottom: sub ? 12 : 52 }}>
    <h2 className="tl-h2" style={{ fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: 38, color: "#F5F5F5", letterSpacing: "-1px", lineHeight: 1.14, marginBottom: sub ? 14 : 0 }}>
      {children}
    </h2>
    {sub && <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 15, color: "#888", lineHeight: 1.72, maxWidth: 520, margin: "0 auto" }}>{sub}</p>}
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// NAVBAR
// ═══════════════════════════════════════════════════════════════════════════════
const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const links = [
    { l: "Features",    h: "#features"     },
    { l: "vs NeoDove",  h: "#compare"      },
    { l: "Pricing",     h: "#pricing"      },
    { l: "Testimonials",h: "#testimonials" },
  ];

  return (
    <header style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 200,
      background: scrolled ? "rgba(10,10,10,.92)" : "transparent",
      borderBottom: scrolled ? "1px solid #1C1C1C" : "1px solid transparent",
      backdropFilter: scrolled ? "blur(18px)" : "none",
      transition: "background .3s, border-color .3s",
    }}>
      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "0 24px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <a href="/" style={{ textDecoration: "none" }}><Logo /></a>

        {/* Desktop links */}
        <nav className="tl-hide-mob" style={{ display: "flex", gap: 34 }}>
          {links.map(({ l, h }) => (
            <a key={l} href={h} className="tl-nav-link"
              style={{ fontFamily: "DM Sans, sans-serif", fontSize: 14, fontWeight: 500, color: "#888", textDecoration: "none", transition: "color .15s" }}>
              {l}
            </a>
          ))}
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <a href="/login" className="tl-btn-ghost tl-hide-mob"
            style={{ fontFamily: "DM Sans, sans-serif", fontSize: 13, fontWeight: 600, color: "#888", padding: "8px 16px", borderRadius: 8, border: "1px solid #282828", textDecoration: "none" }}>
            Sign In
          </a>
          <a href="/login" className="tl-btn-primary"
            style={{ fontFamily: "DM Sans, sans-serif", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "#121212", background: "#B65E3C", padding: "9px 20px", borderRadius: 8, textDecoration: "none", boxShadow: "0 4px 18px rgba(182,94,60,.3)" }}>
            Get Started <Ic d={D.arrow} s={13} c="#121212" />
          </a>
          {/* Hamburger */}
          <button className="tl-show-mob" onClick={() => setOpen(o => !o)}
            style={{ background: "none", border: "1px solid #282828", borderRadius: 7, padding: "7px 8px", cursor: "pointer", display: "none", alignItems: "center" }}>
            <Ic d={open ? D.x : D.menu} s={18} c="#F5F5F5" />
          </button>
        </div>
      </div>

      {open && (
        <div style={{ background: "#0E0E0E", borderTop: "1px solid #1C1C1C", padding: "14px 24px 22px", display: "flex", flexDirection: "column" }}>
          {links.map(({ l, h }) => (
            <a key={l} href={h} onClick={() => setOpen(false)}
              style={{ fontFamily: "DM Sans, sans-serif", fontSize: 15, fontWeight: 500, color: "#AAAAAA", textDecoration: "none", padding: "12px 0", borderBottom: "1px solid #1A1A1A" }}>
              {l}
            </a>
          ))}
          <a href="/login" style={{ marginTop: 14, fontFamily: "DM Sans, sans-serif", fontSize: 14, fontWeight: 700, color: "#121212", background: "#B65E3C", padding: "12px 0", borderRadius: 9, textAlign: "center", textDecoration: "none" }}>
            Get Started Free →
          </a>
        </div>
      )}
    </header>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// HERO
// ═══════════════════════════════════════════════════════════════════════════════
const Hero = () => (
  <section style={{ position: "relative", overflow: "hidden", paddingTop: 148, paddingBottom: 112, background: "#121212" }}>
    {/* Background elements */}
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }} aria-hidden>
      <div style={{ position: "absolute", top: -100, left: "50%", transform: "translateX(-50%)", width: 900, height: 560, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(182,94,60,.16) 0%, transparent 66%)" }} />
      <div style={{ position: "absolute", bottom: -80, right: "8%", width: 380, height: 380, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(242,166,90,.07) 0%, transparent 65%)" }} />
      {/* Copper grid */}
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: .045 }}>
        <defs>
          <pattern id="tl-grid" width="50" height="50" patternUnits="userSpaceOnUse">
            <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#B65E3C" strokeWidth=".8" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#tl-grid)" />
      </svg>
    </div>

    <div style={{ position: "relative", maxWidth: 840, margin: "0 auto", padding: "0 24px", textAlign: "center" }}>
      {/* Badge */}
      <div className="tl-fu" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 14px 5px 7px", borderRadius: 99, background: "rgba(182,94,60,.1)", border: "1px solid rgba(182,94,60,.28)", marginBottom: 30 }}>
        <span style={{ background: "#B65E3C", borderRadius: 99, padding: "2px 9px", fontFamily: "DM Sans, sans-serif", fontSize: 10, fontWeight: 800, color: "#121212", letterSpacing: ".8px", textTransform: "uppercase" }}>New</span>
        <span style={{ fontFamily: "DM Sans, sans-serif", fontSize: 12, fontWeight: 500, color: "#F2A65A" }}>AI call summaries · Built for Indian SMBs · From ₹1,800/month</span>
      </div>

      {/* Headline */}
      <h1 className="tl-fu tl-d1 tl-h1"
        style={{ fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: 68, lineHeight: 1.04, letterSpacing: "-2.5px", color: "#F5F5F5", marginBottom: 10 }}>
        Beyond<br />
        <span style={{
          display: "inline-block",
          background: "linear-gradient(95deg, #B65E3C 0%, #F2A65A 45%, #B65E3C 100%)",
          backgroundSize: "200% auto",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          animation: "shimmer 4s linear infinite",
        }}>Every Limit.</span>
      </h1>

      {/* Subheadline */}
      <p className="tl-fu tl-d2" style={{ fontFamily: "DM Sans, sans-serif", fontSize: 18, color: "#AAAAAA", lineHeight: 1.72, maxWidth: 560, margin: "20px auto 0" }}>
        The telecalling CRM built for Indian SMBs — call recording, AI summaries, pipeline management, and a real human answering your support calls.
      </p>

      {/* CTAs */}
      <div className="tl-fu tl-d3 tl-hero-ctas" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginTop: 40, flexWrap: "wrap" }}>
        <a href="/login" className="tl-btn-primary"
          style={{ fontFamily: "DM Sans, sans-serif", display: "inline-flex", alignItems: "center", gap: 10, padding: "15px 34px", borderRadius: 10, background: "#B65E3C", color: "#121212", fontSize: 15, fontWeight: 800, textDecoration: "none", boxShadow: "0 6px 36px rgba(182,94,60,.35)", letterSpacing: ".2px" }}>
          Start Free Trial <Ic d={D.arrow} s={16} c="#121212" />
        </a>
        <a href="#features" className="tl-btn-ghost"
          style={{ fontFamily: "DM Sans, sans-serif", display: "inline-flex", alignItems: "center", gap: 8, padding: "15px 24px", borderRadius: 10, border: "1px solid #2C2C2C", background: "transparent", color: "#AAAAAA", fontSize: 15, fontWeight: 600, textDecoration: "none" }}>
          See features <Ic d={D.chevR} s={15} c="#888" />
        </a>
      </div>

      <p className="tl-fu tl-d4" style={{ fontFamily: "DM Sans, sans-serif", fontSize: 12, color: "#555", marginTop: 16 }}>
        No credit card required · Setup in 10 minutes · Cancel anytime
      </p>

      {/* Stats */}
      <div className="tl-fu tl-d5 tl-stats" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0, marginTop: 64, border: "1px solid #1E1E1E", borderRadius: 16, overflow: "hidden", background: "#141414", maxWidth: 680, marginLeft: "auto", marginRight: "auto" }}>
        {[
          { v: "₹1,800",  l: "per month, all features" },
          { v: "100%",    l: "auto call recording"      },
          { v: "3-line",  l: "AI summary per call"      },
          { v: "2 hrs",   l: "support response"         },
        ].map((s, i) => (
          <div key={i} style={{ padding: "20px 12px", borderRight: i < 3 ? "1px solid #1E1E1E" : "none", textAlign: "center" }}>
            <div style={{ fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: 22, color: "#F2A65A", letterSpacing: "-.4px", marginBottom: 5 }}>{s.v}</div>
            <div style={{ fontFamily: "DM Sans, sans-serif", fontSize: 11, color: "#666", lineHeight: 1.4 }}>{s.l}</div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

// ═══════════════════════════════════════════════════════════════════════════════
// TICKER STRIP
// ═══════════════════════════════════════════════════════════════════════════════
const TICK = ["Click-to-Call","Auto Recording","AI Call Summaries","Lead Scoring","Kanban Pipeline","WhatsApp Templates","Razorpay Links","Leaderboard","Support Tickets","Admin Dashboard","Follow-up Reminders","Android App"];

const Ticker = () => (
  <div style={{ overflow: "hidden", borderTop: "1px solid #1A1A1A", borderBottom: "1px solid #1A1A1A", background: "#0C0C0C", padding: "12px 0" }}>
    <div className="tl-ticker-track">
      {[...TICK, ...TICK].map((item, i) => (
        <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 12, paddingRight: 44, whiteSpace: "nowrap" }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#B65E3C", display: "inline-block" }} />
          <span style={{ fontFamily: "DM Sans, sans-serif", fontSize: 12, fontWeight: 600, color: "#555", letterSpacing: ".4px" }}>{item}</span>
        </span>
      ))}
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// VS NEODOVE COMPARISON
// ═══════════════════════════════════════════════════════════════════════════════
const COMPARE_ROWS = [
  { feature: "Monthly Price (10 agents)",  neo: "₹17,499/year forced",         tiras: "₹1,800/month (Basic)"          },
  { feature: "Mobile App Quality",         neo: "Broken — 2★ Play Store",      tiras: "Clean, tested before release"   },
  { feature: "Call Recording",             neo: "Third-party (TeleCMI)",        tiras: "Built-in via Plivo, direct link" },
  { feature: "AI Call Summary",            neo: "None",                         tiras: "3-line Claude AI per call"       },
  { feature: "Lead Scoring",               neo: "None",                         tiras: "Hot / Warm / Cold / Dead"        },
  { feature: "Anti-overlap Calling",       neo: "None",                         tiras: "2nd agent blocked instantly"     },
  { feature: "Customer Support",           neo: "Ticket-based, slow",           tiras: "WhatsApp — Tony in 2 hours"      },
  { feature: "Monthly Billing Option",     neo: "No — yearly lock-in only",     tiras: "Yes — monthly, half-yearly, yearly" },
  { feature: "On-site Support",            neo: "Never",                        tiras: "Tony visits your office"         },
  { feature: "Razorpay Payment Links",     neo: "None",                         tiras: "Generate inside any lead"        },
];

const Compare = () => {
  const [ref, vis] = useInView(.08);

  return (
    <section id="compare" style={{ padding: "96px 24px", background: "#0C0C0C" }}>
      <div style={{ maxWidth: 940, margin: "0 auto" }} ref={ref}>
        <Eyebrow>Why teams switch</Eyebrow>
        <SectionH2 sub="NeoDove has 79 employees and still has a broken mobile app. TIRAS is built by one engineer who picks up the phone when you call.">
          TIRAS vs NeoDove
        </SectionH2>
        <div style={{ marginTop: 48, borderRadius: 16, border: "1px solid #1C1C1C", overflow: "hidden" }} className="tl-cmp-grid">
          {/* Header row */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", background: "#111" }}>
            <div style={{ padding: "13px 20px", fontFamily: "DM Sans, sans-serif", fontSize: 11, fontWeight: 700, color: "#444", textTransform: "uppercase", letterSpacing: ".7px" }}>Feature</div>
            <div style={{ padding: "13px 20px", fontFamily: "DM Sans, sans-serif", fontSize: 12, fontWeight: 700, color: "#E05C5C", textAlign: "center", borderLeft: "1px solid #1C1C1C" }}>NeoDove</div>
            <div style={{ padding: "13px 20px", fontFamily: "DM Sans, sans-serif", fontSize: 12, fontWeight: 700, color: "#7DD87D", textAlign: "center", borderLeft: "1px solid #1C1C1C", background: "rgba(125,216,125,.04)" }}>TIRAS</div>
          </div>

          {COMPARE_ROWS.map((row, i) => (
            <div key={i}
              className={vis ? "tl-fu" : ""}
              style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", borderTop: "1px solid #181818", animationDelay: `${i * .04}s`, opacity: vis ? undefined : 0 }}>
              <div style={{ padding: "13px 20px", fontFamily: "DM Sans, sans-serif", fontSize: 13, fontWeight: 500, color: "#AAAAAA" }}>{row.feature}</div>
              <div style={{ padding: "13px 20px", display: "flex", alignItems: "flex-start", justifyContent: "center", gap: 6, fontFamily: "DM Sans, sans-serif", fontSize: 12.5, color: "#E05C5C", textAlign: "center", lineHeight: 1.4, borderLeft: "1px solid #181818" }}>
                <Ic d={D.x} s={12} c="#E05C5C" /><span>{row.neo}</span>
              </div>
              <div style={{ padding: "13px 20px", display: "flex", alignItems: "flex-start", justifyContent: "center", gap: 6, fontFamily: "DM Sans, sans-serif", fontSize: 12.5, color: "#7DD87D", textAlign: "center", background: "rgba(125,216,125,.025)", lineHeight: 1.4, borderLeft: "1px solid #181818" }}>
                <Ic d={D.check} s={12} c="#7DD87D" /><span>{row.tiras}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// FEATURES
// ═══════════════════════════════════════════════════════════════════════════════
const FEATURES = [
  { icon: D.phone,  col: "#7DD87D", title: "Click-to-Call + Auto Recording",  desc: "One tap from any lead dials through Plivo. Every call recorded automatically and linked to the lead in under 5 seconds. No manual steps, no missed recordings ever." },
  { icon: D.brain,  col: "#5AB4F2", title: "AI Call Summaries",               desc: "Claude AI reads every recording and writes a 3-line plain English summary. Managers understand 50 calls without listening to one. Objection tags applied automatically." },
  { icon: D.target, col: "#F2A65A", title: "Lead Scoring — Hot to Dead",       desc: "Calls over 3 min = Hot. 1–3 min = Warm. Under 30 sec = Cold. No answer 3 times = Dead. Scores update after every call automatically — zero manual work required." },
  { icon: D.wa,     col: "#25D366", title: "WhatsApp Integration",            desc: "One-tap WhatsApp button on every lead. Pre-filled message templates sent in one click. No Meta Business API approval — works from day one with zero monthly cost." },
  { icon: D.dash,   col: "#B65E3C", title: "Admin God View Dashboard",        desc: "Total pipeline value, calls vs yesterday, best agent today, overdue follow-ups, and open tickets — all on one screen. Everything your company needs at a glance." },
  { icon: D.ticket, col: "#E05C5C", title: "Support Tickets + Escalation",    desc: "Raise a ticket linked directly to a recording. Manager clicks play and hears the proof. 24-hour auto-escalation. Full activity timeline from open to closed." },
];

const Features = () => {
  const [ref, vis] = useInView();

  return (
    <section id="features" style={{ padding: "96px 24px", background: "#121212" }} ref={ref}>
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        <Eyebrow>Everything included</Eyebrow>
        <SectionH2 sub="No add-ons. No upsells. No paying extra for features that should have been included from day one.">
          One CRM. Every tool your telecallers need.
        </SectionH2>

        <div className="tl-col-1" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginTop: 48 }}>
          {FEATURES.map((f, i) => (
            <div key={i}
              className={`tl-feat-card ${vis ? "tl-fu" : ""}`}
              style={{
                "--cc": f.col,
                padding: "26px 22px", borderRadius: 14,
                border: "1px solid #1C1C1C", background: "#141414",
                display: "flex", flexDirection: "column", gap: 14,
                animationDelay: `${i * .08}s`, opacity: vis ? undefined : 0,
              }}>
              <div style={{ width: 44, height: 44, borderRadius: 11, background: `${f.col}1A`, border: `1px solid ${f.col}28`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Ic d={f.icon} s={20} c={f.col} />
              </div>
              <div>
                <h3 style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: 15.5, color: "#F5F5F5", marginBottom: 9, lineHeight: 1.3 }}>{f.title}</h3>
                <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 13.5, color: "#888", lineHeight: 1.72 }}>{f.desc}</p>
              </div>
              <div style={{ height: 2, borderRadius: 2, background: `linear-gradient(90deg, ${f.col}55, transparent)`, marginTop: "auto" }} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// WHY TIRAS
// ═══════════════════════════════════════════════════════════════════════════════
const WHY = [
  { icon: D.pin,    col: "#F2A65A", title: "Local-first support",  desc: "Tony visits your office, watches your agents use the app, and fixes bugs the same day. No other CRM on the planet offers this." },
  { icon: D.wa,     col: "#25D366", title: "Real human on WhatsApp", desc: "WhatsApp group per client. Response within 2 hours, 7 days a week. Not a ticket system with a bot answering you after 3 days." },
  { icon: D.shield, col: "#5AB4F2", title: "Strict data security",  desc: "Firestore security rules ensure every agent sees only their own data. No role can access another company's records — enforced at the database level." },
  { icon: D.trend,  col: "#7DD87D", title: "Grows with your business", desc: "Start with Basic. Upgrade as revenue grows. Phase 2 adds auto-dialer, email sequences, SMS nurture, multi-language, and Zapier webhooks." },
];

const WhySection = () => {
  const [ref, vis] = useInView();

  return (
    <section style={{ padding: "96px 24px", background: "#0C0C0C" }} ref={ref}>
      <div style={{ maxWidth: 940, margin: "0 auto" }}>
        <Eyebrow>Why TIRAS</Eyebrow>
        <SectionH2>
          Funded CRMs are built<br />for San Francisco. TIRAS is built for you.
        </SectionH2>

        <div className="tl-col-1" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
          {WHY.map((w, i) => (
            <div key={i}
              className={`tl-why-item ${vis ? "tl-fu" : ""}`}
              style={{ display: "flex", gap: 18, padding: "24px 22px", borderRadius: 14, background: "#141414", border: "1px solid #1C1C1C", animationDelay: `${i * .1}s`, opacity: vis ? undefined : 0 }}>
              <div className="tl-why-ico" style={{ width: 44, height: 44, borderRadius: 11, background: `${w.col}1A`, border: `1px solid ${w.col}28`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Ic d={w.icon} s={20} c={w.col} />
              </div>
              <div>
                <h3 style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: 15, color: "#F5F5F5", marginBottom: 8 }}>{w.title}</h3>
                <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 13.5, color: "#888", lineHeight: 1.72 }}>{w.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// TESTIMONIALS
// ═══════════════════════════════════════════════════════════════════════════════
const TESTIMONIALS = [
  { name: "Surya Kiran",  role: "MD, MAINDSOURCE LLP · Bengaluru",          stars: 5, text: "We moved from NeoDove after one demo. My callers were productive on day one. The AI summaries save me 2 hours of review every morning." },
  { name: "Ravi Shankar", role: "Sales Head, EdTech Startup · Hyderabad",   stars: 5, text: "Finally a CRM that doesn't treat small teams like second-class customers. Cleaner than Salesforce and costs 95% less." },
  { name: "Priya Menon",  role: "Operations Manager, Staffing Co. · Chennai", stars: 5, text: "Tony responded on WhatsApp in 45 minutes on a Sunday. That level of support simply doesn't exist anywhere else in this space." },
];

const Testimonials = () => {
  const [ref, vis] = useInView();

  return (
    <section id="testimonials" style={{ padding: "96px 24px", background: "#121212" }} ref={ref}>
      <div style={{ maxWidth: 940, margin: "0 auto" }}>
        <Eyebrow>Early customers</Eyebrow>
        <SectionH2>Teams already using TIRAS every day.</SectionH2>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16, marginTop: 48 }}>
          {TESTIMONIALS.map((t, i) => (
            <div key={i}
              className={vis ? "tl-fu" : ""}
              style={{ background: "#141414", border: "1px solid #1C1C1C", borderRadius: 16, padding: "26px 22px", display: "flex", flexDirection: "column", gap: 16, animationDelay: `${i * .1}s`, opacity: vis ? undefined : 0 }}>
              <Ic d={D.quote} s={20} c="#2A1810" fill="#1E1008" />
              <div style={{ display: "flex", gap: 3 }}>
                {Array(t.stars).fill(0).map((_, j) => <Ic key={j} d={D.star} s={13} c="#F2A65A" fill="#F2A65A" />)}
              </div>
              <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 14, fontStyle: "italic", color: "#AAAAAA", lineHeight: 1.8, flex: 1 }}>"{t.text}"</p>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: 9, background: "linear-gradient(140deg,#C46840,#7A2E10)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: 15, color: "#F5F5F5", flexShrink: 0 }}>{t.name[0]}</div>
                <div>
                  <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 13, fontWeight: 600, color: "#F5F5F5" }}>{t.name}</p>
                  <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 11, color: "#666", marginTop: 2 }}>{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// PRICING
// ═══════════════════════════════════════════════════════════════════════════════
const PLANS = [
  {
    name: "Basic",      price: "₹1,800",  cycle: "/month",
    retention: "7-day recording retention", hot: false,
    features: ["Unlimited leads & contacts","Click-to-call via Plivo","Auto call recording","AI call summaries","Lead scoring Hot/Warm/Cold","Sales pipeline Kanban","WhatsApp templates","Razorpay payment links","Support tickets module","Android app included"],
    cta: "Start with Basic",
  },
  {
    name: "Growth",     price: "₹3,000",  cycle: "/month",
    retention: "30-day recording retention", hot: true, popular: true,
    features: ["Everything in Basic","30-day recording history","Advanced reports & analytics","Agent target tracking","Custom pipeline stages","Follow-up calendar view","Side-by-side agent comparison","Priority WhatsApp support","Storage top-up eligible","Save ₹3,000 on half-yearly"],
    cta: "Start with Growth",
  },
  {
    name: "Enterprise", price: "Custom",  cycle: " pricing",
    retention: "365-day / lifetime retention", hot: false,
    features: ["Everything in Growth","Lifetime recording option","Dedicated support channel","Custom onboarding session","Multi-team setup help","API access (Phase 2)","White-label option (Phase 2)","Volume discounts","SLA guarantee","Quarterly review calls"],
    cta: "Contact us",
  },
];

const Pricing = () => {
  const [ref, vis] = useInView();

  return (
    <section id="pricing" style={{ padding: "96px 24px", background: "#0C0C0C" }} ref={ref}>
      <div style={{ maxWidth: 1020, margin: "0 auto" }}>
        <Eyebrow>Transparent pricing</Eyebrow>
        <SectionH2 sub="All plans include every Phase 1 feature. Save ₹1,800/year on half-yearly billing. Save ₹5,600/year on annual billing.">
          No hidden charges. No surprises.
        </SectionH2>
        <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 12, color: "#555", textAlign: "center", marginBottom: 48 }}>
          Storage top-up: +₹500/month for +100 GB · Razorpay 2% per transaction · Plivo pay-per-call
        </p>

        <div className="tl-col-1 tiras-plans-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, alignItems: "start" }} ref={ref}>
          {PLANS.map((p, i) => (
            <div key={i}
              className={`tl-plan-card ${vis ? "tl-fu" : ""}`}
              style={{
                borderRadius: 16, padding: "28px 24px", position: "relative",
                border: p.hot ? "1px solid rgba(182,94,60,.6)" : "1px solid #1C1C1C",
                background: p.hot ? "#170D07" : "#141414",
                boxShadow: p.hot ? "0 0 60px rgba(182,94,60,.1)" : "none",
                animationDelay: `${i * .1}s`, opacity: vis ? undefined : 0,
              }}>
              {p.popular && (
                <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: "#B65E3C", color: "#121212", fontFamily: "DM Sans, sans-serif", fontSize: 10, fontWeight: 800, padding: "3px 14px", borderRadius: 99, whiteSpace: "nowrap", letterSpacing: ".5px", textTransform: "uppercase" }}>
                  Most Popular
                </div>
              )}

              <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 10, fontWeight: 700, color: p.hot ? "#F2A65A" : "#555", textTransform: "uppercase", letterSpacing: "1.2px", marginBottom: 14 }}>{p.name}</p>

              <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 8 }}>
                <span style={{ fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: 34, color: p.hot ? "#F2A65A" : "#F5F5F5", letterSpacing: "-1px" }}>{p.price}</span>
                <span style={{ fontFamily: "DM Sans, sans-serif", fontSize: 13, color: "#666" }}>{p.cycle}</span>
              </div>

              <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 12, color: "#888", paddingBottom: 22, marginBottom: 22, borderBottom: "1px solid #1E1E1E" }}>{p.retention}</p>

              <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 26 }}>
                {p.features.map((f, j) => (
                  <div key={j} style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
                    <Ic d={D.check} s={13} c={p.hot ? "#F2A65A" : "#7DD87D"} />
                    <span style={{ fontFamily: "DM Sans, sans-serif", fontSize: 13, color: "#AAAAAA", lineHeight: 1.45 }}>{f}</span>
                  </div>
                ))}
              </div>

              <a href="/login" className="tl-plan-btn"
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                  padding: "12px 0", borderRadius: 9, width: "100%",
                  background: p.hot ? "#B65E3C" : "transparent",
                  color: p.hot ? "#121212" : "#AAAAAA",
                  border: p.hot ? "none" : "1px solid #2A2A2A",
                  fontFamily: "DM Sans, sans-serif", fontSize: 13, fontWeight: 700,
                  textDecoration: "none",
                }}>
                {p.cta} <Ic d={D.chevR} s={13} c={p.hot ? "#121212" : "#888"} />
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// FINAL CTA
// ═══════════════════════════════════════════════════════════════════════════════
const FinalCta = () => (
  <section style={{ padding: "110px 24px", background: "#121212", position: "relative", overflow: "hidden", textAlign: "center" }}>
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }} aria-hidden>
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 700, height: 400, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(182,94,60,.13) 0%, transparent 66%)" }} />
    </div>
    <div style={{ position: "relative", maxWidth: 600, margin: "0 auto" }}>
      <h2 className="tl-h2" style={{ fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: 46, color: "#F5F5F5", letterSpacing: "-1.5px", lineHeight: 1.1, marginBottom: 18 }}>
        Ready to move<br /><span style={{ color: "#B65E3C" }}>beyond NeoDove?</span>
      </h2>
      <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 16, color: "#888", marginBottom: 40, lineHeight: 1.7 }}>
        Start your free trial today. No credit card needed. Tony sets you up and you're live in 10 minutes.
      </p>
      <div style={{ display: "flex", justifyContent: "center", gap: 14, flexWrap: "wrap", marginBottom: 18 }}>
        <a href="/login" className="tl-btn-primary"
          style={{ fontFamily: "DM Sans, sans-serif", display: "inline-flex", alignItems: "center", gap: 10, padding: "15px 36px", borderRadius: 10, background: "#B65E3C", color: "#121212", fontSize: 15, fontWeight: 800, textDecoration: "none", boxShadow: "0 6px 40px rgba(182,94,60,.35)" }}>
          Get Started Free <Ic d={D.arrow} s={16} c="#121212" />
        </a>
      </div>
      <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 12, color: "#555" }}>
        Questions? WhatsApp Tony directly — response within 2 hours, 7 days a week.
      </p>
    </div>
  </section>
);

// ═══════════════════════════════════════════════════════════════════════════════
// FOOTER
// ═══════════════════════════════════════════════════════════════════════════════
const Footer = () => (
  <footer style={{ background: "#080808", borderTop: "1px solid #141414", padding: "56px 24px 30px" }}>
    <div className="tl-footer-row" style={{ maxWidth: 1100, margin: "0 auto", display: "flex", justifyContent: "space-between", gap: 40, flexWrap: "wrap", marginBottom: 44 }}>
      <div style={{ maxWidth: 240 }}>
        <Logo size={26} />
        <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 13, fontWeight: 600, color: "#AAAAAA", marginTop: 14, marginBottom: 7 }}>Beyond Every Limit.</p>
        <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 11, color: "#383838", lineHeight: 1.75 }}>
          Built in India · React + Firebase + Claude AI<br />
          Tony × MAINDSOURCE LLP · v1.0 · May 2026
        </p>
      </div>
      <div style={{ display: "flex", gap: 52, flexWrap: "wrap" }}>
        {[
          { title: "Product", links: ["Features","Pricing","Roadmap","Changelog"] },
          { title: "Company", links: ["About","Blog","Careers","Contact"] },
          { title: "Legal",   links: ["Privacy","Terms","Refunds","Security"] },
        ].map(col => (
          <div key={col.title} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 10, fontWeight: 700, color: "#444", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 4 }}>{col.title}</p>
            {col.links.map(l => (
              <a key={l} href="#" className="tl-footer-link"
                style={{ fontFamily: "DM Sans, sans-serif", fontSize: 13, color: "#484848", textDecoration: "none", transition: "color .15s" }}>{l}</a>
            ))}
          </div>
        ))}
      </div>
    </div>
    <div style={{ maxWidth: 1100, margin: "0 auto", borderTop: "1px solid #121212", paddingTop: 22, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
      <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 11, color: "#333" }}>© 2026 TIRAS CRM. All rights reserved.</p>
      <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 11, color: "#333" }}>Carbon Copper theme · Built with React + Firebase</p>
    </div>
  </footer>
);

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT EXPORT
// ═══════════════════════════════════════════════════════════════════════════════
export const LandingPage = () => (
  <div style={{ background: "#121212", minHeight: "100vh" }}>
    <Navbar />
    <Hero />
    <Ticker />
    <Compare />
    <Features />
    <WhySection />
    <Testimonials />
    <Pricing />
    <FinalCta />
    <Footer />
  </div>
);

export default LandingPage;
