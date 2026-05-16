import { useState, useEffect, useRef } from "react";

/* ─────────────────────────────────────────────────────────────────────────────
   TIRAS CRM V2 — LandingPage
   Theme: Obsidian Gold  |  Public route — no auth
   Fonts: Playfair Display + DM Sans
   All CTAs → /login
───────────────────────────────────────────────────────────────────────────── */

const STYLE_ID = "tiras-v2-lp";
if (typeof document !== "undefined" && !document.getElementById(STYLE_ID)) {
  const s = document.createElement("style");
  s.id = STYLE_ID;
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,800;1,700&family=DM+Sans:wght@400;500;600;700&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin:0; padding:0; }
    html { scroll-behavior:smooth; }

    @keyframes lp-up    { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
    @keyframes lp-shine { 0%{background-position:-200% center} 100%{background-position:200% center} }
    @keyframes lp-tick  { from{transform:translateX(0)} to{transform:translateX(-50%)} }

    .lp-up  { animation:lp-up .55s cubic-bezier(.22,.68,0,1.1) both; }
    .lp-d1  { animation-delay:.08s; } .lp-d2 { animation-delay:.16s; }
    .lp-d3  { animation-delay:.24s; } .lp-d4 { animation-delay:.32s; }

    .lp-nav-link:hover   { color:#D4AF37 !important; }
    .lp-nav-link         { transition:color .14s; }
    .lp-cta-gold:hover   { filter:brightness(1.1); transform:translateY(-2px); box-shadow:0 12px 44px rgba(212,175,55,.38) !important; }
    .lp-cta-gold         { transition:all .18s; }
    .lp-cta-ghost:hover  { border-color:#D4AF37 !important; color:#D4AF37 !important; }
    .lp-cta-ghost        { transition:all .15s; }
    .lp-feat-card:hover  { border-color:var(--cc,#D4AF37) !important; transform:translateY(-4px); }
    .lp-feat-card        { transition:all .2s; }
    .lp-footer-link:hover{ color:#D4AF37 !important; }
    .lp-footer-link      { transition:color .14s; }
    .lp-plan-card:hover  { transform:translateY(-3px); }
    .lp-plan-card        { transition:transform .2s; }

    .lp-ticker { display:flex; width:max-content; animation:lp-tick 32s linear infinite; }
    .lp-ticker:hover { animation-play-state:paused; }

    @media(max-width:780px){
      .lp-hide-mob   { display:none !important; }
      .lp-show-mob   { display:flex !important; }
      .lp-h1         { font-size:38px !important; letter-spacing:-1px !important; }
      .lp-h2         { font-size:26px !important; }
      .lp-hero-ctas  { flex-direction:column; align-items:stretch !important; }
      .lp-stats      { grid-template-columns:1fr 1fr !important; }
      .lp-feats-grid { grid-template-columns:1fr !important; }
      .lp-why-grid   { grid-template-columns:1fr !important; }
      .lp-plans-grid { grid-template-columns:1fr !important; max-width:380px; margin:0 auto; }
      .lp-cmp-wrap   { overflow-x:auto; display:block; }
      .lp-footer-row { flex-direction:column; gap:36px !important; }
    }
    @media(min-width:781px){ .lp-show-mob { display:none !important; } }
  `;
  document.head.appendChild(s);
}

// ── Icon ──────────────────────────────────────────────────────────────────────
const Ic = ({ d, s = 18, c = "currentColor", fill = "none" }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill={fill}
    stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
    style={{ flexShrink: 0 }} aria-hidden="true"><path d={d} /></svg>
);

const D = {
  check:  "M20 6L9 17l-5-5",
  x:      "M18 6L6 18M6 6l12 12",
  arrow:  "M5 12h14M12 5l7 7-7 7",
  chevR:  "M9 18l6-6-6-6",
  menu:   "M3 12h18M3 6h18M3 18h18",
  phone:  "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13 19.79 19.79 0 0 1 1.61 4.37 2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.18 6.18",
  mic:    "M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8",
  brain:  "M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-1.98-3 2.5 2.5 0 0 1-1.32-4.24 3 3 0 0 1 .34-5.58 2.5 2.5 0 0 1 1.96-3.1A2.5 2.5 0 0 1 9.5 2zM14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 1.98-3 2.5 2.5 0 0 0 1.32-4.24 3 3 0 0 0-.34-5.58 2.5 2.5 0 0 0-1.96-3.1A2.5 2.5 0 0 0 14.5 2z",
  target: "M22 12h-4M6 12H2M12 6V2M12 22v-4m6.36-9.64-2.83 2.83M8.47 15.53l-2.83 2.83M17.64 17.64l-2.83-2.83M8.47 8.47 5.64 5.64M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  wa:     "M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z",
  dash:   "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 22V12h6v10",
  ticket: "M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z",
  dollar: "M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  star:   "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
  trend:  "M23 6l-9.5 9.5-5-5L1 18M17 6h6v6",
  pin:    "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0zM12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  quote:  "M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1zM15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z",
  wallet: "M21 12V7H5a2 2 0 0 1 0-4h14v4M21 12a2 2 0 0 1 0 4H5a2 2 0 0 1 0-4h16v4",
};

// ── useInView ─────────────────────────────────────────────────────────────────
const useInView = (t = 0.12) => {
  const ref = useRef(null);
  const [v, setV] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setV(true); io.disconnect(); } }, { threshold: t });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [t]);
  return [ref, v];
};

// ── Logo ──────────────────────────────────────────────────────────────────────
const Logo = ({ size = 30 }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
    <div style={{ width: size, height: size, borderRadius: size * 0.28, background: "linear-gradient(140deg,#D4AF37 0%,#8A7020 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Playfair Display,serif", fontWeight: 700, fontSize: size * 0.55, color: "#000", boxShadow: "0 0 20px rgba(212,175,55,.35)" }}>T</div>
    <span style={{ fontFamily: "Playfair Display,serif", fontWeight: 700, fontSize: size * 0.67, color: "#F5F5F5", letterSpacing: "1px" }}>TIRAS</span>
  </div>
);

// ── Section helpers ───────────────────────────────────────────────────────────
const Eyebrow = ({ children }) => (
  <p style={{ fontFamily: "DM Sans,sans-serif", fontSize: 11, fontWeight: 700, color: "#D4AF37", textTransform: "uppercase", letterSpacing: "1.5px", textAlign: "center", marginBottom: 14 }}>{children}</p>
);
const SH2 = ({ children, sub }) => (
  <div style={{ textAlign: "center", marginBottom: sub ? 12 : 52 }}>
    <h2 className="lp-h2" style={{ fontFamily: "Playfair Display,serif", fontWeight: 700, fontSize: 36, color: "#F5F5F5", letterSpacing: "-.8px", lineHeight: 1.18, marginBottom: sub ? 14 : 0 }}>{children}</h2>
    {sub && <p style={{ fontFamily: "DM Sans,sans-serif", fontSize: 15, color: "#9A9A9A", maxWidth: 500, margin: "0 auto", lineHeight: 1.72 }}>{sub}</p>}
  </div>
);

// ── NAVBAR ────────────────────────────────────────────────────────────────────
const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);
  const links = [{ l: "Features", h: "#features" }, { l: "vs NeoDove", h: "#compare" }, { l: "Pricing", h: "#pricing" }, { l: "Reviews", h: "#reviews" }];
  return (
    <header style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 200, background: scrolled ? "rgba(10,10,10,.94)" : "transparent", borderBottom: scrolled ? "1px solid #2A2A2B" : "1px solid transparent", backdropFilter: scrolled ? "blur(20px)" : "none", transition: "all .3s" }}>
      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "0 24px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <a href="/" style={{ textDecoration: "none" }}><Logo /></a>
        <nav className="lp-hide-mob" style={{ display: "flex", gap: 32 }}>
          {links.map(({ l, h }) => <a key={l} href={h} className="lp-nav-link" style={{ fontFamily: "DM Sans,sans-serif", fontSize: 14, fontWeight: 500, color: "#9A9A9A", textDecoration: "none" }}>{l}</a>)}
        </nav>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <a href="/login" className="lp-cta-ghost lp-hide-mob" style={{ fontFamily: "DM Sans,sans-serif", fontSize: 13, fontWeight: 600, color: "#9A9A9A", padding: "8px 16px", borderRadius: 8, border: "1px solid #2A2A2B", textDecoration: "none" }}>Sign In</a>
          <a href="/login" className="lp-cta-gold" style={{ fontFamily: "DM Sans,sans-serif", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "#000", background: "#D4AF37", padding: "9px 20px", borderRadius: 8, textDecoration: "none", boxShadow: "0 4px 18px rgba(212,175,55,.28)" }}>
            Get Started <Ic d={D.arrow} s={13} c="#000" />
          </a>
          <button className="lp-show-mob" onClick={() => setOpen(o => !o)} style={{ background: "none", border: "1px solid #2A2A2B", borderRadius: 7, padding: "7px 8px", cursor: "pointer", alignItems: "center", display: "none" }}>
            <Ic d={open ? D.x : D.menu} s={18} c="#F5F5F5" />
          </button>
        </div>
      </div>
      {open && (
        <div style={{ background: "#111", borderTop: "1px solid #1A1A1B", padding: "14px 24px 22px", display: "flex", flexDirection: "column" }}>
          {links.map(({ l, h }) => <a key={l} href={h} onClick={() => setOpen(false)} style={{ fontFamily: "DM Sans,sans-serif", fontSize: 15, fontWeight: 500, color: "#9A9A9A", textDecoration: "none", padding: "12px 0", borderBottom: "1px solid #1A1A1B" }}>{l}</a>)}
          <a href="/login" style={{ marginTop: 14, fontFamily: "DM Sans,sans-serif", fontSize: 14, fontWeight: 700, color: "#000", background: "#D4AF37", padding: "12px 0", borderRadius: 9, textAlign: "center", textDecoration: "none" }}>Get Started →</a>
        </div>
      )}
    </header>
  );
};

// ── HERO ──────────────────────────────────────────────────────────────────────
const Hero = () => (
  <section style={{ position: "relative", overflow: "hidden", paddingTop: 148, paddingBottom: 110, background: "#121212" }}>
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }} aria-hidden>
      <div style={{ position: "absolute", top: -100, left: "50%", transform: "translateX(-50%)", width: 800, height: 540, borderRadius: "50%", background: "radial-gradient(ellipse,rgba(212,175,55,.13) 0%,transparent 68%)" }} />
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: .035 }}>
        <defs><pattern id="v2grid" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M 50 0 L 0 0 0 50" fill="none" stroke="#D4AF37" strokeWidth=".8" /></pattern></defs>
        <rect width="100%" height="100%" fill="url(#v2grid)" />
      </svg>
    </div>
    <div style={{ position: "relative", maxWidth: 840, margin: "0 auto", padding: "0 24px", textAlign: "center" }}>
      <div className="lp-up" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 14px 5px 7px", borderRadius: 99, background: "rgba(212,175,55,.1)", border: "1px solid rgba(212,175,55,.28)", marginBottom: 30 }}>
        <span style={{ background: "#D4AF37", borderRadius: 99, padding: "2px 9px", fontFamily: "DM Sans,sans-serif", fontSize: 10, fontWeight: 800, color: "#000", letterSpacing: ".8px", textTransform: "uppercase" }}>V2</span>
        <span style={{ fontFamily: "DM Sans,sans-serif", fontSize: 12, fontWeight: 500, color: "#D4AF37" }}>AI call summaries · Wallet system · Built for Indian SMBs</span>
      </div>
      <h1 className="lp-up lp-d1 lp-h1" style={{ fontFamily: "Playfair Display,serif", fontWeight: 700, fontSize: 64, lineHeight: 1.06, letterSpacing: "-2px", color: "#F5F5F5", marginBottom: 10 }}>
        Beyond<br />
        <em style={{ fontStyle: "italic", background: "linear-gradient(92deg,#D4AF37 0%,#F0D060 50%,#D4AF37 100%)", backgroundSize: "200% auto", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", animation: "lp-shine 4s linear infinite" }}>Every Limit.</em>
      </h1>
      <p className="lp-up lp-d2" style={{ fontFamily: "DM Sans,sans-serif", fontSize: 18, color: "#9A9A9A", maxWidth: 560, margin: "20px auto 0", lineHeight: 1.72 }}>
        The telecalling CRM built for Indian SMBs — call recording, AI summaries, pipeline, wallet-based calling, and a real human answering your support messages.
      </p>
      <div className="lp-up lp-d3 lp-hero-ctas" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginTop: 40, flexWrap: "wrap" }}>
        <a href="/login" className="lp-cta-gold" style={{ fontFamily: "DM Sans,sans-serif", display: "inline-flex", alignItems: "center", gap: 10, padding: "15px 34px", borderRadius: 10, background: "#D4AF37", color: "#000", fontSize: 15, fontWeight: 800, textDecoration: "none", boxShadow: "0 6px 36px rgba(212,175,55,.3)", letterSpacing: ".2px" }}>
          Start Free Trial <Ic d={D.arrow} s={16} c="#000" />
        </a>
        <a href="#features" className="lp-cta-ghost" style={{ fontFamily: "DM Sans,sans-serif", display: "inline-flex", alignItems: "center", gap: 8, padding: "15px 24px", borderRadius: 10, border: "1px solid #2A2A2B", background: "transparent", color: "#9A9A9A", fontSize: 15, fontWeight: 600, textDecoration: "none" }}>
          See features <Ic d={D.chevR} s={15} c="#666" />
        </a>
      </div>
      <p className="lp-up lp-d4" style={{ fontFamily: "DM Sans,sans-serif", fontSize: 12, color: "#555", marginTop: 16 }}>No credit card · Setup in 10 min · Cancel anytime</p>
      <div className="lp-up lp-stats" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 0, marginTop: 64, border: "1px solid #2A2A2B", borderRadius: 14, overflow: "hidden", background: "#1A1A1B", maxWidth: 680, marginLeft: "auto", marginRight: "auto" }}>
        {[{ v: "₹1,800", l: "per month, all features" }, { v: "100%", l: "auto call recording" }, { v: "3-line", l: "AI summary per call" }, { v: "2 hrs", l: "support response" }].map((s, i) => (
          <div key={i} style={{ padding: "20px 12px", borderRight: i < 3 ? "1px solid #2A2A2B" : "none", textAlign: "center" }}>
            <div style={{ fontFamily: "Playfair Display,serif", fontWeight: 700, fontSize: 22, color: "#D4AF37", marginBottom: 5 }}>{s.v}</div>
            <div style={{ fontFamily: "DM Sans,sans-serif", fontSize: 11, color: "#555", lineHeight: 1.4 }}>{s.l}</div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

// ── TICKER ────────────────────────────────────────────────────────────────────
const TICK = ["Click-to-Call", "Auto Recording", "AI Call Summaries", "Lead Scoring", "Kanban Pipeline", "WhatsApp Templates", "Razorpay Links", "Wallet System", "Leaderboard", "Support Tickets", "Admin Dashboard", "Android App"];
const Ticker = () => (
  <div style={{ overflow: "hidden", borderTop: "1px solid #1A1A1B", borderBottom: "1px solid #1A1A1B", background: "#0C0C0C", padding: "12px 0" }}>
    <div className="lp-ticker">
      {[...TICK, ...TICK].map((item, i) => (
        <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 12, paddingRight: 44, whiteSpace: "nowrap" }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#D4AF37", display: "inline-block" }} />
          <span style={{ fontFamily: "DM Sans,sans-serif", fontSize: 12, fontWeight: 600, color: "#555", letterSpacing: ".4px" }}>{item}</span>
        </span>
      ))}
    </div>
  </div>
);

// ── COMPARE ───────────────────────────────────────────────────────────────────
const CMP_ROWS = [
  { f: "Monthly Price (10 agents)",  neo: "₹17,499/year forced",       tiras: "₹1,800/month (Basic)"          },
  { f: "Mobile App Quality",         neo: "Broken — 2★ Play Store",    tiras: "Clean, tested before release"   },
  { f: "Call Recording",             neo: "Third-party (TeleCMI)",      tiras: "Built-in via Plivo, direct link" },
  { f: "AI Call Summary",            neo: "None",                       tiras: "3-line Claude AI per call"       },
  { f: "Lead Scoring",               neo: "None",                       tiras: "Hot / Warm / Cold / Dead"        },
  { f: "Anti-overlap Calling",       neo: "None",                       tiras: "Second agent blocked instantly"  },
  { f: "Wallet / Pre-paid Calling",  neo: "None",                       tiras: "Wallet system — recharge online" },
  { f: "Customer Support",           neo: "Ticket-based, slow",         tiras: "WhatsApp — Tony in 2 hours"      },
  { f: "Monthly Billing Option",     neo: "Yearly lock-in only",        tiras: "Monthly, half-yearly, yearly"    },
  { f: "On-site Support",            neo: "Never",                      tiras: "Tony visits your office"         },
];

const Compare = () => {
  const [ref, vis] = useInView(.08);
  return (
    <section id="compare" style={{ padding: "96px 24px", background: "#0C0C0C" }}>
      <div style={{ maxWidth: 920, margin: "0 auto" }} ref={ref}>
        <Eyebrow>Why teams switch</Eyebrow>
        <SH2 sub="NeoDove has 79 employees and still has a broken mobile app. TIRAS is built by one engineer who picks up the phone.">TIRAS vs NeoDove</SH2>
        <div className="lp-cmp-wrap" style={{ borderRadius: 14, border: "1px solid #2A2A2B", overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", background: "#111", borderBottom: "1px solid #2A2A2B" }}>
            <div style={{ padding: "12px 18px", fontFamily: "DM Sans,sans-serif", fontSize: 10, fontWeight: 700, color: "#444", textTransform: "uppercase", letterSpacing: ".7px" }}>Feature</div>
            <div style={{ padding: "12px 18px", fontFamily: "DM Sans,sans-serif", fontSize: 12, fontWeight: 700, color: "#E63946", textAlign: "center", borderLeft: "1px solid #2A2A2B" }}>NeoDove</div>
            <div style={{ padding: "12px 18px", fontFamily: "DM Sans,sans-serif", fontSize: 12, fontWeight: 700, color: "#10B981", textAlign: "center", borderLeft: "1px solid #2A2A2B", background: "rgba(16,185,129,.03)" }}>TIRAS</div>
          </div>
          {CMP_ROWS.map((row, i) => (
            <div key={i} className={vis ? "lp-up" : ""} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", borderTop: "1px solid #181818", animationDelay: `${i * .04}s`, opacity: vis ? undefined : 0 }}>
              <div style={{ padding: "12px 18px", fontFamily: "DM Sans,sans-serif", fontSize: 13, color: "#9A9A9A" }}>{row.f}</div>
              <div style={{ padding: "12px 18px", display: "flex", alignItems: "flex-start", justifyContent: "center", gap: 6, fontFamily: "DM Sans,sans-serif", fontSize: 12, color: "#E63946", textAlign: "center", lineHeight: 1.4, borderLeft: "1px solid #181818" }}>
                <Ic d={D.x} s={12} c="#E63946" /><span>{row.neo}</span>
              </div>
              <div style={{ padding: "12px 18px", display: "flex", alignItems: "flex-start", justifyContent: "center", gap: 6, fontFamily: "DM Sans,sans-serif", fontSize: 12, color: "#10B981", textAlign: "center", background: "rgba(16,185,129,.025)", lineHeight: 1.4, borderLeft: "1px solid #181818" }}>
                <Ic d={D.check} s={12} c="#10B981" /><span>{row.tiras}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ── FEATURES ──────────────────────────────────────────────────────────────────
const FEATS = [
  { icon: D.phone,  col: "#10B981", title: "Click-to-Call + Auto Recording",  desc: "One tap dials through Plivo. Every call recorded automatically, linked to the lead in seconds. No manual steps ever." },
  { icon: D.brain,  col: "#3B82F6", title: "AI Call Summaries",               desc: "Claude AI writes a 3-line plain English summary after every call. Managers understand 50 calls without listening to one." },
  { icon: D.target, col: "#D4AF37", title: "Lead Scoring — Hot to Dead",       desc: "Calls over 3 min = Hot. 1–3 min = Warm. Under 30 sec = Cold. No answer 3× = Dead. Automatic after every call." },
  { icon: D.wallet, col: "#E63946", title: "Wallet-Based Calling",             desc: "Pre-pay Plivo credits via Razorpay. Low-balance alerts fire in the app and in Notifications before calling stops." },
  { icon: D.dash,   col: "#D4AF37", title: "Admin God View Dashboard",        desc: "Pipeline value, calls vs yesterday, best agent, overdue follow-ups, open tickets — all on one screen." },
  { icon: D.ticket, col: "#E63946", title: "Support Tickets + Escalation",    desc: "Raise a ticket linked to a recording. Manager clicks play and hears the proof. 24-hour auto-escalation with red flag." },
];

const Features = () => {
  const [ref, vis] = useInView();
  return (
    <section id="features" style={{ padding: "96px 24px", background: "#121212" }} ref={ref}>
      <div style={{ maxWidth: 1060, margin: "0 auto" }}>
        <Eyebrow>Everything included</Eyebrow>
        <SH2 sub="No add-ons. No upsells. Every Phase 1 feature included from day one.">One CRM. Every tool your telecallers need.</SH2>
        <div className="lp-feats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
          {FEATS.map((f, i) => (
            <div key={i} className={`lp-feat-card ${vis ? "lp-up" : ""}`}
              style={{ "--cc": f.col, padding: "26px 22px", borderRadius: 14, border: "1px solid #2A2A2B", background: "#1A1A1B", display: "flex", flexDirection: "column", gap: 14, animationDelay: `${i * .08}s`, opacity: vis ? undefined : 0 }}>
              <div style={{ width: 44, height: 44, borderRadius: 11, background: `${f.col}1A`, border: `1px solid ${f.col}28`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Ic d={f.icon} s={20} c={f.col} />
              </div>
              <div>
                <h3 style={{ fontFamily: "Playfair Display,serif", fontWeight: 700, fontSize: 15.5, color: "#F5F5F5", marginBottom: 9, lineHeight: 1.3 }}>{f.title}</h3>
                <p style={{ fontFamily: "DM Sans,sans-serif", fontSize: 13.5, color: "#9A9A9A", lineHeight: 1.72 }}>{f.desc}</p>
              </div>
              <div style={{ height: 2, borderRadius: 2, background: `linear-gradient(90deg,${f.col}55,transparent)`, marginTop: "auto" }} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ── WHY ───────────────────────────────────────────────────────────────────────
const WHY = [
  { icon: D.pin,    col: "#D4AF37", title: "Local-first support",     desc: "Tony visits your office, watches your agents use the app, and fixes bugs the same day. No other CRM on the planet offers this." },
  { icon: D.wa,     col: "#25D366", title: "Real human on WhatsApp",  desc: "WhatsApp group per client. Response within 2 hours, 7 days a week. Not a ticket system with a bot." },
  { icon: D.shield, col: "#3B82F6", title: "Strict data security",   desc: "Firestore security rules mean each agent sees only their own data. No role can access another company's records." },
  { icon: D.trend,  col: "#10B981", title: "Grows with your business",desc: "Start with Basic. Phase 2 adds auto-dialer, email sequences, SMS nurture, multi-language, and Zapier webhooks." },
];

const Why = () => {
  const [ref, vis] = useInView();
  return (
    <section style={{ padding: "96px 24px", background: "#0C0C0C" }} ref={ref}>
      <div style={{ maxWidth: 920, margin: "0 auto" }}>
        <Eyebrow>Why TIRAS</Eyebrow>
        <SH2>Funded CRMs are built for San Francisco.<br />TIRAS is built for you.</SH2>
        <div className="lp-why-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 16 }}>
          {WHY.map((w, i) => (
            <div key={i} className={vis ? "lp-up" : ""} style={{ display: "flex", gap: 18, padding: "24px 22px", borderRadius: 14, background: "#1A1A1B", border: "1px solid #2A2A2B", animationDelay: `${i * .1}s`, opacity: vis ? undefined : 0 }}>
              <div style={{ width: 44, height: 44, borderRadius: 11, background: `${w.col}1A`, border: `1px solid ${w.col}28`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Ic d={w.icon} s={20} c={w.col} />
              </div>
              <div>
                <h3 style={{ fontFamily: "Playfair Display,serif", fontWeight: 700, fontSize: 15, color: "#F5F5F5", marginBottom: 8 }}>{w.title}</h3>
                <p style={{ fontFamily: "DM Sans,sans-serif", fontSize: 13.5, color: "#9A9A9A", lineHeight: 1.72 }}>{w.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ── REVIEWS ───────────────────────────────────────────────────────────────────
const REVIEWS = [
  { name: "Surya Kiran",  role: "MD, MAINDSOURCE LLP · Bengaluru",           stars: 5, text: "We moved from NeoDove after one demo. My callers were productive on day one. The AI summaries save me 2 hours of review every morning." },
  { name: "Ravi Shankar", role: "Sales Head, EdTech Startup · Hyderabad",    stars: 5, text: "Cleaner than Salesforce and 95% cheaper. The wallet system for Plivo calling is genius — I always know exactly what we're spending." },
  { name: "Priya Menon",  role: "Operations Manager, Staffing Co. · Chennai",stars: 5, text: "Tony responded on WhatsApp in 45 minutes on a Sunday. That level of support doesn't exist anywhere else in this space." },
];

const Reviews = () => {
  const [ref, vis] = useInView();
  return (
    <section id="reviews" style={{ padding: "96px 24px", background: "#121212" }} ref={ref}>
      <div style={{ maxWidth: 920, margin: "0 auto" }}>
        <Eyebrow>Early customers</Eyebrow>
        <SH2>Teams already using TIRAS every day.</SH2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 16 }}>
          {REVIEWS.map((r, i) => (
            <div key={i} className={vis ? "lp-up" : ""} style={{ background: "#1A1A1B", border: "1px solid #2A2A2B", borderRadius: 16, padding: "26px 22px", display: "flex", flexDirection: "column", gap: 16, animationDelay: `${i * .1}s`, opacity: vis ? undefined : 0 }}>
              <Ic d={D.quote} s={20} c="#2A1E06" fill="#1A1508" />
              <div style={{ display: "flex", gap: 3 }}>
                {Array(r.stars).fill(0).map((_, j) => <Ic key={j} d={D.star} s={13} c="#D4AF37" fill="#D4AF37" />)}
              </div>
              <p style={{ fontFamily: "DM Sans,sans-serif", fontSize: 14, fontStyle: "italic", color: "#9A9A9A", lineHeight: 1.78, flex: 1 }}>"{r.text}"</p>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: 9, background: "linear-gradient(140deg,#D4AF37,#8A7020)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Playfair Display,serif", fontWeight: 700, fontSize: 15, color: "#000", flexShrink: 0 }}>{r.name[0]}</div>
                <div>
                  <p style={{ fontFamily: "DM Sans,sans-serif", fontSize: 13, fontWeight: 600, color: "#F5F5F5", margin: 0 }}>{r.name}</p>
                  <p style={{ fontFamily: "DM Sans,sans-serif", fontSize: 11, color: "#555", margin: "3px 0 0" }}>{r.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ── PRICING TEASER ────────────────────────────────────────────────────────────
const PLANS = [
  { name: "Basic",      price: "₹1,800", cycle: "/month", retention: "7-day recording", hot: false, feats: ["Up to 5 agents", "All Phase 1 features", "Click-to-call + recording", "AI summaries", "Wallet system", "Android app"] },
  { name: "Growth",     price: "₹3,000", cycle: "/month", retention: "30-day recording", hot: true, popular: true, feats: ["Up to 20 agents", "Everything in Basic", "30-day recordings", "Advanced reports", "Agent targets", "Priority support"] },
  { name: "Enterprise", price: "Custom", cycle: " pricing", retention: "365-day recording", hot: false, feats: ["Unlimited agents", "Everything in Growth", "365-day recordings", "Dedicated support", "Custom onboarding", "SLA guarantee"] },
];

const Pricing = () => {
  const [ref, vis] = useInView();
  return (
    <section id="pricing" style={{ padding: "96px 24px", background: "#0C0C0C" }} ref={ref}>
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <Eyebrow>Simple pricing</Eyebrow>
        <SH2 sub="All plans include every Phase 1 feature. Save with half-yearly or yearly billing.">No hidden charges. No surprises.</SH2>
        <div className="lp-plans-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, alignItems: "start" }}>
          {PLANS.map((p, i) => (
            <div key={i} className={`lp-plan-card ${vis ? "lp-up" : ""}`}
              style={{ borderRadius: 16, padding: "28px 24px", position: "relative", border: p.hot ? "1px solid rgba(212,175,55,.55)" : "1px solid #2A2A2B", background: p.hot ? "#1C1708" : "#1A1A1B", boxShadow: p.hot ? "0 0 60px rgba(212,175,55,.1)" : "none", animationDelay: `${i * .1}s`, opacity: vis ? undefined : 0 }}>
              {p.popular && <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: "#D4AF37", color: "#000", fontFamily: "DM Sans,sans-serif", fontSize: 10, fontWeight: 800, padding: "3px 14px", borderRadius: 99, whiteSpace: "nowrap", letterSpacing: ".5px", textTransform: "uppercase" }}>Most Popular</div>}
              <p style={{ fontFamily: "DM Sans,sans-serif", fontSize: 10, fontWeight: 700, color: p.hot ? "#D4AF37" : "#555", textTransform: "uppercase", letterSpacing: "1.2px", marginBottom: 14 }}>{p.name}</p>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 8 }}>
                <span style={{ fontFamily: "Playfair Display,serif", fontWeight: 700, fontSize: 32, color: p.hot ? "#D4AF37" : "#F5F5F5", letterSpacing: "-1px" }}>{p.price}</span>
                <span style={{ fontFamily: "DM Sans,sans-serif", fontSize: 13, color: "#666" }}>{p.cycle}</span>
              </div>
              <p style={{ fontFamily: "DM Sans,sans-serif", fontSize: 12, color: "#9A9A9A", paddingBottom: 18, marginBottom: 18, borderBottom: "1px solid #2A2A2B" }}>{p.retention}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 24 }}>
                {p.feats.map((f, j) => (
                  <div key={j} style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
                    <Ic d={D.check} s={13} c={p.hot ? "#D4AF37" : "#10B981"} />
                    <span style={{ fontFamily: "DM Sans,sans-serif", fontSize: 13, color: "#AAAAAA", lineHeight: 1.4 }}>{f}</span>
                  </div>
                ))}
              </div>
              <a href="/login" className="lp-cta-gold"
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "12px 0", borderRadius: 9, width: "100%", background: p.hot ? "#D4AF37" : "transparent", color: p.hot ? "#000" : "#9A9A9A", border: p.hot ? "none" : "1px solid #2A2A2B", fontFamily: "DM Sans,sans-serif", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
                {p.name === "Enterprise" ? "Contact Tony" : "Get started"} <Ic d={D.chevR} s={13} c={p.hot ? "#000" : "#666"} />
              </a>
            </div>
          ))}
        </div>
        <p style={{ fontFamily: "DM Sans,sans-serif", fontSize: 12, color: "#444", textAlign: "center", marginTop: 24 }}>
          Save ₹1,800/year on half-yearly · Save ₹5,600/year on yearly · Storage top-up ₹500/month for +100 GB
        </p>
      </div>
    </section>
  );
};

// ── FINAL CTA ─────────────────────────────────────────────────────────────────
const FinalCta = () => (
  <section style={{ padding: "110px 24px", background: "#121212", position: "relative", overflow: "hidden", textAlign: "center" }}>
    <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 600, height: 360, borderRadius: "50%", background: "radial-gradient(ellipse,rgba(212,175,55,.12) 0%,transparent 66%)", pointerEvents: "none" }} />
    <div style={{ position: "relative", maxWidth: 580, margin: "0 auto" }}>
      <h2 className="lp-h2" style={{ fontFamily: "Playfair Display,serif", fontWeight: 700, fontSize: 44, color: "#F5F5F5", letterSpacing: "-1.2px", lineHeight: 1.12, marginBottom: 18 }}>
        Ready to move beyond<br /><em style={{ fontStyle: "italic", color: "#D4AF37" }}>NeoDove?</em>
      </h2>
      <p style={{ fontFamily: "DM Sans,sans-serif", fontSize: 16, color: "#9A9A9A", marginBottom: 40, lineHeight: 1.7 }}>Start your free trial today. No credit card. Tony sets you up and you're live in 10 minutes.</p>
      <a href="/login" className="lp-cta-gold" style={{ fontFamily: "DM Sans,sans-serif", display: "inline-flex", alignItems: "center", gap: 10, padding: "15px 36px", borderRadius: 10, background: "#D4AF37", color: "#000", fontSize: 15, fontWeight: 800, textDecoration: "none", boxShadow: "0 6px 40px rgba(212,175,55,.3)" }}>
        Get Started Free <Ic d={D.arrow} s={16} c="#000" />
      </a>
      <p style={{ fontFamily: "DM Sans,sans-serif", fontSize: 12, color: "#444", marginTop: 20 }}>Questions? WhatsApp Tony directly — response within 2 hours, 7 days a week.</p>
    </div>
  </section>
);

// ── FOOTER ────────────────────────────────────────────────────────────────────
const Footer = () => (
  <footer style={{ background: "#080808", borderTop: "1px solid #141414", padding: "52px 24px 28px" }}>
    <div className="lp-footer-row" style={{ maxWidth: 1100, margin: "0 auto", display: "flex", justifyContent: "space-between", gap: 40, flexWrap: "wrap", marginBottom: 40 }}>
      <div style={{ maxWidth: 240 }}>
        <Logo size={26} />
        <p style={{ fontFamily: "DM Sans,sans-serif", fontSize: 13, fontWeight: 600, color: "#9A9A9A", marginTop: 14, marginBottom: 7 }}>Beyond Every Limit.</p>
        <p style={{ fontFamily: "DM Sans,sans-serif", fontSize: 11, color: "#333", lineHeight: 1.75 }}>Built in India · React + Firebase + Claude AI<br />Tony × MAINDSOURCE LLP · V2 · 2026</p>
      </div>
      <div style={{ display: "flex", gap: 48, flexWrap: "wrap" }}>
        {[{ t: "Product", l: ["Features","Pricing","Roadmap","Changelog"] }, { t: "Company", l: ["About","Blog","Careers","Contact"] }, { t: "Legal", l: ["Privacy","Terms","Refunds","Security"] }].map(col => (
          <div key={col.t} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <p style={{ fontFamily: "DM Sans,sans-serif", fontSize: 10, fontWeight: 700, color: "#444", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 4 }}>{col.t}</p>
            {col.l.map(l => <a key={l} href="#" className="lp-footer-link" style={{ fontFamily: "DM Sans,sans-serif", fontSize: 13, color: "#444", textDecoration: "none" }}>{l}</a>)}
          </div>
        ))}
      </div>
    </div>
    <div style={{ maxWidth: 1100, margin: "0 auto", borderTop: "1px solid #111", paddingTop: 22, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
      <p style={{ fontFamily: "DM Sans,sans-serif", fontSize: 11, color: "#2A2A2B" }}>© 2026 TIRAS CRM. All rights reserved.</p>
      <p style={{ fontFamily: "DM Sans,sans-serif", fontSize: 11, color: "#2A2A2B" }}>Obsidian Gold theme · V2</p>
    </div>
  </footer>
);

// ── ROOT EXPORT ───────────────────────────────────────────────────────────────
export const LandingPage = () => (
  <div style={{ background: "#121212", minHeight: "100vh" }}>
    <Navbar />
    <Hero />
    <Ticker />
    <Compare />
    <Features />
    <Why />
    <Reviews />
    <Pricing />
    <FinalCta />
    <Footer />
  </div>
);

export default LandingPage;
