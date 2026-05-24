import { useState, useEffect, useRef } from "react";

/* ─────────────────────────────────────────────────────────────────────────────
   TIRAS CRM — LandingPage
   Production-ready public marketing page
   Theme: Obsidian Gold · Playfair Display + DM Sans
   Export: export const LandingPage
───────────────────────────────────────────────────────────────────────────── */

// ── Inject global styles ──────────────────────────────────────────────────────
const STYLE_ID = "tiras-lp-v2-prod";
if (typeof document !== "undefined" && !document.getElementById(STYLE_ID)) {
  const el = document.createElement("style");
  el.id = STYLE_ID;
  el.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,800;1,700&family=DM+Sans:wght@400;500;600;700&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; }
    body { background: #121212; }

    @keyframes tlp-fadeUp  { from { opacity:0; transform:translateY(22px); } to { opacity:1; transform:translateY(0); } }
    @keyframes tlp-shine   { 0%{background-position:-200% center} 100%{background-position:200% center} }
    @keyframes tlp-ticker  { from{transform:translateX(0)} to{transform:translateX(-50%)} }
    @keyframes tlp-pulse   { 0%,100%{opacity:.6;transform:scale(1)} 50%{opacity:1;transform:scale(1.04)} }
    @keyframes tlp-float   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
    @keyframes tlp-particle {
      0%   { transform: translate(0,0) scale(1); opacity: .7; }
      100% { transform: translate(var(--tx,30px), var(--ty,-60px)) scale(0); opacity: 0; }
    }

    .tlp-fadeUp { animation: tlp-fadeUp .6s cubic-bezier(.22,.68,0,1.1) both; }
    .tlp-d1 { animation-delay:.08s; } .tlp-d2 { animation-delay:.16s; }
    .tlp-d3 { animation-delay:.24s; } .tlp-d4 { animation-delay:.32s; }
    .tlp-d5 { animation-delay:.40s; } .tlp-d6 { animation-delay:.48s; }

    .tlp-ticker-track { display:flex; width:max-content; animation:tlp-ticker 28s linear infinite; }
    .tlp-ticker-track:hover { animation-play-state:paused; }

    .tlp-nav-link { transition:color .15s; }
    .tlp-nav-link:hover { color:#D4AF37 !important; }

    .tlp-cta-gold { transition:all .18s ease; }
    .tlp-cta-gold:hover { filter:brightness(1.1); transform:translateY(-2px); box-shadow:0 12px 44px rgba(212,175,55,.42) !important; }

    .tlp-cta-ghost { transition:all .18s ease; }
    .tlp-cta-ghost:hover { border-color:#D4AF37 !important; color:#D4AF37 !important; }

    .tlp-feat-card { transition:all .22s ease; border:1px solid #2A2A2B; }
    .tlp-feat-card:hover { border-color:rgba(212,175,55,.55) !important; transform:translateY(-5px); box-shadow:0 12px 40px rgba(212,175,55,.1); }

    .tlp-step-card { transition:all .2s ease; }
    .tlp-step-card:hover { transform:translateY(-3px); }

    .tlp-plan-card { transition:all .2s ease; }
    .tlp-plan-card:hover { transform:translateY(-5px); }

    .tlp-review-card { transition:all .2s ease; }
    .tlp-review-card:hover { border-color:rgba(212,175,55,.35) !important; }

    .tlp-footer-link { transition:color .15s; }
    .tlp-footer-link:hover { color:#D4AF37 !important; }

    .tlp-pill { transition:all .15s; cursor:default; }
    .tlp-pill:hover { background:rgba(212,175,55,.18) !important; border-color:rgba(212,175,55,.4) !important; color:#D4AF37 !important; }

    @media (max-width:780px) {
      .tlp-hide-mobile { display:none !important; }
      .tlp-show-mobile { display:flex !important; }
      .tlp-hero-ctas   { flex-direction:column; align-items:stretch !important; }
      .tlp-h1          { font-size:38px !important; letter-spacing:-1px !important; }
      .tlp-h2          { font-size:26px !important; }
      .tlp-feats-grid  { grid-template-columns:1fr !important; }
      .tlp-steps-grid  { grid-template-columns:1fr !important; }
      .tlp-plans-grid  { grid-template-columns:1fr !important; max-width:380px; margin-left:auto; margin-right:auto; }
      .tlp-reviews-grid{ grid-template-columns:1fr !important; }
      .tlp-stats-grid  { grid-template-columns:1fr 1fr !important; }
      .tlp-footer-inner{ flex-direction:column !important; gap:36px !important; }
      .tlp-footer-bottom{ flex-direction:column !important; gap:8px !important; align-items:flex-start !important; }
    }
    @media (min-width:781px) { .tlp-show-mobile { display:none !important; } }
  `;
  document.head.appendChild(el);
}

// ── SVG Icon ──────────────────────────────────────────────────────────────────
const Ic = ({ d, s = 18, c = "currentColor", fill = "none" }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill={fill}
    stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
    style={{ flexShrink: 0 }} aria-hidden="true">
    <path d={d} />
  </svg>
);

const ICONS = {
  arrow:   "M5 12h14M12 5l7 7-7 7",
  chevR:   "M9 18l6-6-6-6",
  menu:    "M3 12h18M3 6h18M3 18h18",
  x:       "M18 6L6 18M6 6l12 12",
  check:   "M20 6L9 17l-5-5",
  star:    "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
  phone:   "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13 19.79 19.79 0 0 1 1.61 4.37 2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.18 6.18",
  mic:     "M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8",
  brain:   "M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-1.98-3 2.5 2.5 0 0 1-1.32-4.24 3 3 0 0 1 .34-5.58 2.5 2.5 0 0 1 1.96-3.1A2.5 2.5 0 0 1 9.5 2zM14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 1.98-3 2.5 2.5 0 0 0 1.32-4.24 3 3 0 0 0-.34-5.58 2.5 2.5 0 0 0-1.96-3.1A2.5 2.5 0 0 0 14.5 2z",
  target:  "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM8.56 2.75c4.37 6.03 6.02 9.42 8.03 17.72m2.54-15.38c-3.72 4.35-8.94 5.66-16.88 5.85m19.5 1.9c-3.5-.93-6.63-.82-8.94 0-2.58.92-5.01 2.86-7.44 6.32",
  bell:    "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0",
  trophy:  "M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2z",
  quote:   "M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1zM15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z",
  wa:      "M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z",
  building:"M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 22V12h6v10",
  users:   "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  upload:  "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12",
};

// ── useInView ─────────────────────────────────────────────────────────────────
const useInView = (threshold = 0.1) => {
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
const Logo = ({ size = 32 }) => (
  <a href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
    <div style={{
      width: size, height: size, borderRadius: Math.round(size * 0.28),
      background: "linear-gradient(140deg, #D4AF37 0%, #8A7020 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Playfair Display', serif", fontWeight: 800,
      fontSize: Math.round(size * 0.55), color: "#000",
      boxShadow: "0 0 20px rgba(212,175,55,.35)", flexShrink: 0,
    }}>T</div>
    <span style={{
      fontFamily: "'Playfair Display', serif", fontWeight: 700,
      fontSize: Math.round(size * 0.65), color: "#F5F5F5", letterSpacing: "1px",
    }}>TIRAS</span>
  </a>
);

// ── Gold Particles Background ──────────────────────────────────────────────────
const ParticleBg = () => {
  const particles = Array.from({ length: 18 }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    top: `${20 + Math.random() * 60}%`,
    size: 2 + Math.random() * 3,
    delay: `${Math.random() * 6}s`,
    duration: `${4 + Math.random() * 5}s`,
    tx: `${(Math.random() - 0.5) * 80}px`,
    ty: `${-40 - Math.random() * 60}px`,
  }));
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }} aria-hidden>
      {/* Gradient glow */}
      <div style={{ position: "absolute", top: "-15%", left: "50%", transform: "translateX(-50%)", width: "80%", height: "60%", background: "radial-gradient(ellipse, rgba(212,175,55,.13) 0%, transparent 68%)", borderRadius: "50%" }} />
      {/* Grid */}
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: .04 }}>
        <defs>
          <pattern id="tlp-grid" width="52" height="52" patternUnits="userSpaceOnUse">
            <path d="M 52 0 L 0 0 0 52" fill="none" stroke="#D4AF37" strokeWidth=".8" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#tlp-grid)" />
      </svg>
      {/* Particles */}
      {particles.map(p => (
        <div key={p.id} style={{
          position: "absolute", left: p.left, top: p.top,
          width: p.size, height: p.size, borderRadius: "50%",
          background: "#D4AF37", opacity: 0,
          "--tx": p.tx, "--ty": p.ty,
          animation: `tlp-particle ${p.duration} ${p.delay} ease-out infinite`,
        }} />
      ))}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// NAVBAR
// ═══════════════════════════════════════════════════════════════════════════════
const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 48);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const NAV_LINKS = [
    { label: "Features",    href: "#features"    },
    { label: "How It Works",href: "#how-it-works" },
    { label: "Pricing",     href: "#pricing"      },
  ];

  return (
    <header style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 300,
      background: scrolled ? "rgba(10,10,10,.93)" : "transparent",
      borderBottom: scrolled ? "1px solid #2A2A2B" : "1px solid transparent",
      backdropFilter: scrolled ? "blur(20px)" : "none",
      WebkitBackdropFilter: scrolled ? "blur(20px)" : "none",
      transition: "background .3s, border-color .3s, backdrop-filter .3s",
    }}>
      <div style={{ maxWidth: 1140, margin: "0 auto", padding: "0 24px", height: 66, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Logo />

        {/* Desktop nav */}
        <nav className="tlp-hide-mobile" style={{ display: "flex", gap: 36 }}>
          {NAV_LINKS.map(({ label, href }) => (
            <a key={label} href={href} className="tlp-nav-link"
              style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 500, color: "#9A9A9A", textDecoration: "none" }}>
              {label}
            </a>
          ))}
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <a href="/register" className="tlp-cta-gold tlp-hide-mobile"
            style={{ fontFamily: "'DM Sans', sans-serif", display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 700, color: "#000", background: "#D4AF37", padding: "9px 22px", borderRadius: 8, textDecoration: "none", boxShadow: "0 4px 18px rgba(212,175,55,.28)" }}>
            Start Free Trial <Ic d={ICONS.arrow} s={13} c="#000" />
          </a>
          {/* Hamburger */}
          <button className="tlp-show-mobile"
            onClick={() => setMenuOpen(o => !o)}
            style={{ background: "none", border: "1px solid #2A2A2B", borderRadius: 8, padding: "8px 9px", cursor: "pointer", display: "none", alignItems: "center" }}>
            <Ic d={menuOpen ? ICONS.x : ICONS.menu} s={20} c="#F5F5F5" />
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div style={{ background: "#111", borderTop: "1px solid #1A1A1B", padding: "16px 24px 24px", display: "flex", flexDirection: "column" }}>
          {NAV_LINKS.map(({ label, href }) => (
            <a key={label} href={href}
              onClick={() => setMenuOpen(false)}
              style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 500, color: "#CCCCCC", textDecoration: "none", padding: "13px 0", borderBottom: "1px solid #1A1A1B" }}>
              {label}
            </a>
          ))}
          <a href="/register"
            style={{ marginTop: 16, fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 700, color: "#000", background: "#D4AF37", padding: "13px 0", borderRadius: 9, textAlign: "center", textDecoration: "none" }}>
            Start Free Trial →
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
  <section style={{ position: "relative", overflow: "hidden", paddingTop: 152, paddingBottom: 108, background: "#121212" }}>
    <ParticleBg />
    <div style={{ position: "relative", maxWidth: 860, margin: "0 auto", padding: "0 24px", textAlign: "center" }}>

      {/* Eyebrow */}
      <div className="tlp-fadeUp"
        style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 14px 5px 7px", borderRadius: 99, background: "rgba(212,175,55,.1)", border: "1px solid rgba(212,175,55,.3)", marginBottom: 30 }}>
        <span style={{ background: "#D4AF37", borderRadius: 99, padding: "2px 10px", fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 800, color: "#000", letterSpacing: ".8px", textTransform: "uppercase" }}>Free 14-Day Trial</span>
        <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 500, color: "#D4AF37" }}>No credit card required</span>
      </div>

      {/* Headline */}
      <h1 className="tlp-fadeUp tlp-d1 tlp-h1"
        style={{ fontFamily: "'Playfair Display', serif", fontWeight: 800, fontSize: 66, lineHeight: 1.06, letterSpacing: "-2px", color: "#F5F5F5", marginBottom: 10 }}>
        Your Sales Team.<br />
        <em style={{
          fontStyle: "italic",
          background: "linear-gradient(92deg, #D4AF37 0%, #F0D060 48%, #D4AF37 100%)",
          backgroundSize: "200% auto",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          animation: "tlp-shine 4.5s linear infinite",
        }}>Supercharged.</em>
      </h1>

      {/* Subheadline */}
      <p className="tlp-fadeUp tlp-d2"
        style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 18, color: "#9A9A9A", lineHeight: 1.72, maxWidth: 580, margin: "22px auto 0" }}>
        AI-powered telecalling CRM with automatic call recording, smart lead scoring, and real-time team dashboards. Built for Indian businesses.
      </p>

      {/* CTAs */}
      <div className="tlp-fadeUp tlp-d3 tlp-hero-ctas"
        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginTop: 42, flexWrap: "wrap" }}>
        <a href="/register" className="tlp-cta-gold"
          style={{ fontFamily: "'DM Sans', sans-serif", display: "inline-flex", alignItems: "center", gap: 10, padding: "15px 34px", borderRadius: 10, background: "#D4AF37", color: "#000", fontSize: 15, fontWeight: 800, textDecoration: "none", boxShadow: "0 6px 36px rgba(212,175,55,.32)", letterSpacing: ".2px" }}>
          Start Free Trial <Ic d={ICONS.arrow} s={16} c="#000" />
        </a>
        <a href="#pricing" className="tlp-cta-ghost"
          style={{ fontFamily: "'DM Sans', sans-serif", display: "inline-flex", alignItems: "center", gap: 8, padding: "15px 26px", borderRadius: 10, border: "1px solid #2A2A2B", background: "transparent", color: "#CCCCCC", fontSize: 15, fontWeight: 600, textDecoration: "none" }}>
          See Pricing <Ic d={ICONS.chevR} s={15} c="#888" />
        </a>
      </div>

      {/* Trust line */}
      <p className="tlp-fadeUp tlp-d4"
        style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#555", marginTop: 18 }}>
        14-day free trial · No credit card required · Works for any industry
      </p>

      {/* Stats strip */}
      <div className="tlp-fadeUp tlp-d5 tlp-stats-grid"
        style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 0, marginTop: 66, border: "1px solid #2A2A2B", borderRadius: 14, overflow: "hidden", background: "#1A1A1B", maxWidth: 700, marginLeft: "auto", marginRight: "auto" }}>
        {[
          { v: "500+",    l: "businesses onboarded" },
          { v: "100%",    l: "auto call recording"  },
          { v: "3-line",  l: "AI summary per call"  },
          { v: "14 days", l: "free to explore"      },
        ].map((s, i) => (
          <div key={i} style={{ padding: "20px 10px", borderRight: i < 3 ? "1px solid #2A2A2B" : "none", textAlign: "center" }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 21, color: "#D4AF37", marginBottom: 5 }}>{s.v}</div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "#555", lineHeight: 1.4 }}>{s.l}</div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

// ═══════════════════════════════════════════════════════════════════════════════
// TICKER
// ═══════════════════════════════════════════════════════════════════════════════
const TICKER_ITEMS = [
  "AI Call Summaries", "Auto Recording", "Lead Scoring",
  "WhatsApp Integration", "Team Leaderboard", "Follow-up Reminders",
  "Real-time Dashboard", "14-Day Free Trial",
];

const Ticker = () => (
  <div style={{ overflow: "hidden", borderTop: "1px solid #1A1A1B", borderBottom: "1px solid #1A1A1B", background: "#0E0E0E", padding: "13px 0" }}>
    <div className="tlp-ticker-track">
      {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
        <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 12, paddingRight: 48, whiteSpace: "nowrap" }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#D4AF37", display: "inline-block", flexShrink: 0 }} />
          <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 600, color: "#D4AF37", letterSpacing: ".5px" }}>{item}</span>
        </span>
      ))}
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// FEATURES
// ═══════════════════════════════════════════════════════════════════════════════
const FEATURES = [
  { icon: ICONS.phone,  color: "#10B981", title: "Click to Call",         desc: "Call any lead directly from your browser. No phone, no SIM, no setup required." },
  { icon: ICONS.mic,    color: "#3B82F6", title: "Auto Recording",         desc: "Every call recorded automatically and stored securely in the cloud. Access anytime." },
  { icon: ICONS.brain,  color: "#D4AF37", title: "AI Call Summary",        desc: "Get a 3-line AI summary after every call. Know the outcome and next steps instantly." },
  { icon: ICONS.target, color: "#E63946", title: "Smart Lead Scoring",     desc: "Leads automatically scored Hot, Warm, Cold, or Dead after every call. No manual input." },
  { icon: ICONS.bell,   color: "#F59E0B", title: "Follow-up Reminders",   desc: "Smart alerts before every scheduled callback. Never miss a follow-up again." },
  { icon: ICONS.trophy, color: "#8B5CF6", title: "Team Leaderboard",       desc: "Live performance rankings that motivate your telecalling team to perform better daily." },
];

const Features = () => {
  const [ref, vis] = useInView(.08);
  return (
    <section id="features" style={{ padding: "100px 24px", background: "#121212" }} ref={ref}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        {/* Section header */}
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 700, color: "#D4AF37", textTransform: "uppercase", letterSpacing: "1.6px", marginBottom: 14 }}>Features</p>
          <h2 className="tlp-h2" style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 36, color: "#F5F5F5", letterSpacing: "-.7px", lineHeight: 1.16 }}>
            Everything your sales team needs
          </h2>
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, color: "#9A9A9A", marginTop: 14, maxWidth: 500, marginLeft: "auto", marginRight: "auto", lineHeight: 1.72 }}>
            One platform for calls, recordings, follow-ups, and team performance. No integrations needed.
          </p>
        </div>

        {/* Cards */}
        <div className="tlp-feats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
          {FEATURES.map((f, i) => (
            <div key={i} className={`tlp-feat-card ${vis ? "tlp-fadeUp" : ""}`}
              style={{ padding: "28px 24px", borderRadius: 14, background: "#1A1A1B", display: "flex", flexDirection: "column", gap: 14, animationDelay: `${i * .08}s`, opacity: vis ? undefined : 0 }}>
              <div style={{ width: 46, height: 46, borderRadius: 12, background: `${f.color}1A`, border: `1px solid ${f.color}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Ic d={f.icon} s={21} c={f.color} />
              </div>
              <div>
                <h3 style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 16, color: "#F5F5F5", marginBottom: 9, lineHeight: 1.3 }}>{f.title}</h3>
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13.5, color: "#9A9A9A", lineHeight: 1.72 }}>{f.desc}</p>
              </div>
              <div style={{ height: 2, borderRadius: 2, background: `linear-gradient(90deg, ${f.color}55, transparent)`, marginTop: "auto" }} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// HOW IT WORKS
// ═══════════════════════════════════════════════════════════════════════════════
const HOW_STEPS = [
  { n: "01", icon: ICONS.upload, color: "#D4AF37", title: "Add Your Leads",   desc: "Import from Excel or add manually. Start calling immediately — no complex setup required." },
  { n: "02", icon: ICONS.phone,  color: "#10B981", title: "Call and Record",   desc: "One-click calling from your browser. Every call auto-recorded and saved to your cloud dashboard." },
  { n: "03", icon: ICONS.brain,  color: "#3B82F6", title: "Review and Close",  desc: "AI summaries, smart follow-up alerts, and team insights at a glance. Close more deals, faster." },
];

const HowItWorks = () => {
  const [ref, vis] = useInView(.08);
  return (
    <section id="how-it-works" style={{ padding: "100px 24px", background: "#0C0C0C" }} ref={ref}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 60 }}>
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 700, color: "#D4AF37", textTransform: "uppercase", letterSpacing: "1.6px", marginBottom: 14 }}>How It Works</p>
          <h2 className="tlp-h2" style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 36, color: "#F5F5F5", letterSpacing: "-.7px", lineHeight: 1.16 }}>
            Get started in minutes
          </h2>
        </div>

        {/* Steps */}
        <div className="tlp-steps-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 0, position: "relative" }}>
          {/* Dotted connector — desktop only */}
          <div className="tlp-hide-mobile" style={{ position: "absolute", top: 36, left: "17%", right: "17%", height: 1, background: "repeating-linear-gradient(90deg, #D4AF37 0px, #D4AF37 6px, transparent 6px, transparent 14px)", zIndex: 0 }} />

          {HOW_STEPS.map((step, i) => (
            <div key={i} className={`tlp-step-card ${vis ? "tlp-fadeUp" : ""}`}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "0 28px", position: "relative", zIndex: 1, animationDelay: `${i * .12}s`, opacity: vis ? undefined : 0 }}>
              {/* Step number */}
              <div style={{ width: 72, height: 72, borderRadius: "50%", background: `${step.color}18`, border: `2px solid ${step.color}55`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20, position: "relative" }}>
                <span style={{ fontFamily: "'Playfair Display', serif", fontWeight: 800, fontSize: 26, color: step.color, letterSpacing: "-1px" }}>{step.n}</span>
              </div>
              <h3 style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 17, color: "#F5F5F5", marginBottom: 12 }}>{step.title}</h3>
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13.5, color: "#9A9A9A", lineHeight: 1.72, maxWidth: 240 }}>{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// INDUSTRIES
// ═══════════════════════════════════════════════════════════════════════════════
const INDUSTRIES = [
  "Staffing", "Real Estate", "EdTech", "Healthcare", "Manufacturing",
  "Pharma", "Finance", "Insurance", "IT Services", "Retail", "Construction", "Logistics",
];

const Industries = () => {
  const [ref, vis] = useInView(.08);
  return (
    <section style={{ padding: "80px 24px", background: "#121212" }} ref={ref}>
      <div style={{ maxWidth: 860, margin: "0 auto", textAlign: "center" }}>
        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 700, color: "#D4AF37", textTransform: "uppercase", letterSpacing: "1.6px", marginBottom: 14 }}>Industries</p>
        <h2 className="tlp-h2" style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 30, color: "#F5F5F5", letterSpacing: "-.6px", lineHeight: 1.2, marginBottom: 36 }}>
          Trusted across industries
        </h2>
        <div className={vis ? "tlp-fadeUp" : ""} style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", opacity: vis ? undefined : 0 }}>
          {INDUSTRIES.map((ind) => (
            <span key={ind} className="tlp-pill"
              style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, padding: "8px 18px", borderRadius: 99, background: "rgba(212,175,55,.08)", border: "1px solid rgba(212,175,55,.22)", color: "#CCCCCC" }}>
              {ind}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// PRICING PREVIEW
// ═══════════════════════════════════════════════════════════════════════════════
const PLANS = [
  { name: "Starter",  price: "₹5,499",  cycle: "/year", agents: "3 agents",   hot: false, popular: false, feats: ["3 agents · 1 manager", "5 GB recording storage", "15-day retention", "All core features", "Standard support"] },
  { name: "Basic",    price: "₹9,999",  cycle: "/year", agents: "10 agents",  hot: false, popular: false, feats: ["10 agents · 2 managers","15 GB recording storage","30-day retention","All core features","Priority support"] },
  { name: "Growth",   price: "₹15,999", cycle: "/year", agents: "Unlimited",  hot: true,  popular: true,  feats: ["Unlimited agents & managers","50 GB recording storage","90-day retention","All core features","Dedicated support"] },
];

const PricingPreview = () => {
  const [ref, vis] = useInView(.08);
  return (
    <section id="pricing" style={{ padding: "100px 24px", background: "#0C0C0C" }} ref={ref}>
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 700, color: "#D4AF37", textTransform: "uppercase", letterSpacing: "1.6px", marginBottom: 14 }}>Pricing</p>
          <h2 className="tlp-h2" style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 36, color: "#F5F5F5", letterSpacing: "-.7px", lineHeight: 1.16, marginBottom: 12 }}>
            Simple, transparent pricing
          </h2>
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, color: "#9A9A9A", maxWidth: 460, marginLeft: "auto", marginRight: "auto", lineHeight: 1.7, marginBottom: 48 }}>
            One flat annual fee. Pay only for the calls you make.
          </p>
        </div>

        <div className="tlp-plans-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, alignItems: "start" }}>
          {PLANS.map((plan, i) => (
            <div key={plan.name} className={`tlp-plan-card ${vis ? "tlp-fadeUp" : ""}`}
              style={{ borderRadius: 16, padding: "28px 24px", position: "relative", border: plan.hot ? "1px solid rgba(212,175,55,.55)" : "1px solid #2A2A2B", background: plan.hot ? "#1C1608" : "#1A1A1B", boxShadow: plan.hot ? "0 0 60px rgba(212,175,55,.1)" : "none", animationDelay: `${i * .1}s`, opacity: vis ? undefined : 0 }}>
              {plan.popular && (
                <div style={{ position: "absolute", top: -13, left: "50%", transform: "translateX(-50%)", background: "#D4AF37", color: "#000", fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 800, padding: "3px 16px", borderRadius: 99, whiteSpace: "nowrap", letterSpacing: ".6px", textTransform: "uppercase", boxShadow: "0 2px 12px rgba(212,175,55,.35)" }}>
                  Most Popular
                </div>
              )}
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 700, color: plan.hot ? "#D4AF37" : "#666", textTransform: "uppercase", letterSpacing: "1.3px", marginBottom: 16 }}>{plan.name}</p>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 6 }}>
                <span style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 34, color: plan.hot ? "#D4AF37" : "#F5F5F5", letterSpacing: "-1px" }}>{plan.price}</span>
                <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#666" }}>{plan.cycle}</span>
              </div>
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#888", marginBottom: 18, paddingBottom: 18, borderBottom: "1px solid #2A2A2B" }}>{plan.agents}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 24 }}>
                {plan.feats.map((f, j) => (
                  <div key={j} style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
                    <Ic d={ICONS.check} s={13} c={plan.hot ? "#D4AF37" : "#10B981"} />
                    <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#CCCCCC", lineHeight: 1.45 }}>{f}</span>
                  </div>
                ))}
              </div>
              <a href="/register"
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "12px 0", borderRadius: 9, width: "100%", background: plan.hot ? "#D4AF37" : "transparent", color: plan.hot ? "#000" : "#CCCCCC", border: plan.hot ? "none" : "1px solid #2A2A2B", fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 700, textDecoration: "none" }}>
                Get Started <Ic d={ICONS.chevR} s={13} c={plan.hot ? "#000" : "#888"} />
              </a>
            </div>
          ))}
        </div>

        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#666", textAlign: "center", marginTop: 22 }}>
          Calling charged at ₹1/minute. Recharge your wallet anytime. No hidden fees.
        </p>
        <div style={{ textAlign: "center", marginTop: 14 }}>
          <a href="/pricing" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: "#D4AF37", textDecoration: "none" }}>
            See full pricing →
          </a>
        </div>
      </div>
    </section>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// TESTIMONIALS
// ═══════════════════════════════════════════════════════════════════════════════
const REVIEWS = [
  {
    name:    "Aditya Menon",
    role:    "CEO, Meridian Staffing Solutions · Bengaluru",
    quote:   "Our call volume doubled within the first month. The AI summaries alone save my managers three hours of review work every day.",
  },
  {
    name:    "Prachi Desai",
    role:    "Head of Sales, Greenfield Realty · Pune",
    quote:   "Lead scoring changed how we prioritise. Our conversion rate improved by 38% because agents know exactly who to call next.",
  },
  {
    name:    "Rajesh Nair",
    role:    "Operations Manager, Apex Edtech · Hyderabad",
    quote:   "Setup took less than a day. We were calling leads and recording conversations from day one. The follow-up reminders are a game-changer.",
  },
];

const Testimonials = () => {
  const [ref, vis] = useInView(.08);
  return (
    <section style={{ padding: "100px 24px", background: "#121212" }} ref={ref}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 52 }}>
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 700, color: "#D4AF37", textTransform: "uppercase", letterSpacing: "1.6px", marginBottom: 14 }}>Reviews</p>
          <h2 className="tlp-h2" style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 36, color: "#F5F5F5", letterSpacing: "-.7px" }}>
            Sales teams love TIRAS
          </h2>
        </div>
        <div className="tlp-reviews-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 18 }}>
          {REVIEWS.map((r, i) => (
            <div key={i} className={`tlp-review-card ${vis ? "tlp-fadeUp" : ""}`}
              style={{ background: "#1A1A1B", border: "1px solid #2A2A2B", borderRadius: 16, padding: "28px 24px", display: "flex", flexDirection: "column", gap: 16, animationDelay: `${i * .1}s`, opacity: vis ? undefined : 0 }}>
              <Ic d={ICONS.quote} s={22} c="rgba(212,175,55,.2)" fill="rgba(212,175,55,.06)" />
              <div style={{ display: "flex", gap: 3 }}>
                {Array(5).fill(0).map((_, j) => <Ic key={j} d={ICONS.star} s={14} c="#D4AF37" fill="#D4AF37" />)}
              </div>
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontStyle: "italic", color: "#CCCCCC", lineHeight: 1.78, flex: 1 }}>"{r.quote}"</p>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(140deg,#D4AF37,#8A7020)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Playfair Display',serif", fontWeight: 700, fontSize: 16, color: "#000", flexShrink: 0 }}>
                  {r.name[0]}
                </div>
                <div>
                  <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: "#F5F5F5", margin: 0 }}>{r.name}</p>
                  <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "#666", margin: "3px 0 0" }}>{r.role}</p>
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
// FINAL CTA
// ═══════════════════════════════════════════════════════════════════════════════
const FinalCta = () => (
  <section style={{ padding: "110px 24px", background: "#0C0C0C", position: "relative", overflow: "hidden", textAlign: "center" }}>
    <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 600, height: 360, borderRadius: "50%", background: "radial-gradient(ellipse,rgba(212,175,55,.12) 0%,transparent 66%)", pointerEvents: "none" }} />
    <div style={{ position: "relative", maxWidth: 600, margin: "0 auto" }}>
      <h2 className="tlp-h2" style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 44, color: "#F5F5F5", letterSpacing: "-1.2px", lineHeight: 1.12, marginBottom: 18 }}>
        Ready to supercharge<br />your sales team?
      </h2>
      <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 16, color: "#9A9A9A", marginBottom: 42, lineHeight: 1.72 }}>
        Start your free 14-day trial today. No credit card required.
      </p>
      <a href="/register" className="tlp-cta-gold"
        style={{ fontFamily: "'DM Sans', sans-serif", display: "inline-flex", alignItems: "center", gap: 10, padding: "16px 38px", borderRadius: 10, background: "#D4AF37", color: "#000", fontSize: 15, fontWeight: 800, textDecoration: "none", boxShadow: "0 6px 40px rgba(212,175,55,.32)" }}>
        Start Free Trial → <Ic d={ICONS.arrow} s={16} c="#000" />
      </a>
      <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#444", marginTop: 20 }}>
        14-day free trial · No credit card · Cancel anytime
      </p>
    </div>
  </section>
);

// ═══════════════════════════════════════════════════════════════════════════════
// FOOTER
// ═══════════════════════════════════════════════════════════════════════════════
const Footer = () => (
  <footer style={{ background: "#080808", borderTop: "1px solid #111", padding: "52px 24px 28px" }}>
    <div className="tlp-footer-inner" style={{ maxWidth: 1100, margin: "0 auto", display: "flex", justifyContent: "space-between", gap: 40, flexWrap: "wrap", marginBottom: 44 }}>
      {/* Brand */}
      <div>
        <Logo size={28} />
        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: "#9A9A9A", marginTop: 14 }}>Beyond Every Limit.</p>
      </div>

      {/* Links */}
      <div style={{ display: "flex", gap: 52, flexWrap: "wrap" }}>
        {[
          { title: "Product",  links: ["Features", "Pricing", "Help"] },
          { title: "Company",  links: ["Contact",  "Privacy", "Terms"] },
        ].map(col => (
          <div key={col.title} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 700, color: "#444", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 4 }}>{col.title}</p>
            {col.links.map(l => (
              <a key={l} href="#" className="tlp-footer-link"
                style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#444", textDecoration: "none" }}>{l}</a>
            ))}
          </div>
        ))}
      </div>
    </div>

    <div className="tlp-footer-bottom" style={{ maxWidth: 1100, margin: "0 auto", borderTop: "1px solid #111", paddingTop: 22, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
      <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "#333" }}>© 2026 TIRAS CRM. All rights reserved. Made in India 🇮🇳</p>
      <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "#333" }}>AI-powered telecalling for Indian businesses</p>
    </div>
  </footer>
);

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT EXPORT
// ═══════════════════════════════════════════════════════════════════════════════
export const LandingPage = () => (
  <div style={{ background: "#121212", minHeight: "100vh", fontFamily: "'DM Sans', sans-serif" }}>
    <Navbar />
    <Hero />
    <Ticker />
    <Features />
    <HowItWorks />
    <Industries />
    <PricingPreview />
    <Testimonials />
    <FinalCta />
    <Footer />
  </div>
);

export default LandingPage;
