import { useState, useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";

/* ─────────────────────────────────────────────────────────────────────────────
   TIRAS CRM V2 — HelpCenter
   Theme: Obsidian Gold  |  Route: /help  |  All roles
   Static content — no Firestore needed
   Live search · Category chips · Accordion FAQs · Contact strip
───────────────────────────────────────────────────────────────────────────── */

const C = {
  bg:        "#121212",
  surface:   "#1A1A1B",
  surfaceHov:"#222223",
  border:    "#2A2A2B",
  gold:      "#D4AF37",
  goldMuted: "rgba(212,175,55,0.12)",
  red:       "#E63946",
  green:     "#10B981",
  text:      "#F5F5F5",
  textSec:   "#9A9A9A",
  textMuted: "#555555",
};

const STYLE_ID = "tiras-v2-hc";
if (typeof document !== "undefined" && !document.getElementById(STYLE_ID)) {
  const s = document.createElement("style");
  s.id = STYLE_ID;
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:wght@400;500;600;700&display=swap');
    @keyframes hc-up { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
    .hc-up { animation: hc-up .42s ease both; }
    .hc-chip { transition:all .14s; border:none; cursor:pointer; }
    .hc-chip:hover { color:${C.gold} !important; }
    .hc-faq  { transition:background .14s, border-color .14s; }
    .hc-faq:hover { border-color:#3A3A3B !important; }
    .hc-faq-btn { transition:background .14s; cursor:pointer; border:none; }
    .hc-search:focus { border-color:${C.gold} !important; outline:none; box-shadow:0 0 0 3px rgba(212,175,55,0.12); }
    .hc-contact-btn:hover { filter:brightness(1.08); transform:translateY(-1px); }
    .hc-contact-btn { transition:all .15s; }
    mark.hc-mark { background:rgba(212,175,55,0.25); color:${C.gold}; border-radius:3px; padding:0 2px; }
    @media(max-width:640px){
      .hc-chips { overflow-x:auto; scrollbar-width:none; flex-wrap:nowrap !important; }
      .hc-hero  { padding:40px 20px 32px !important; }
      .hc-contact-inner { flex-direction:column !important; gap:16px !important; }
    }
  `;
  document.head.appendChild(s);
}

const Ic = ({ d, s = 16, c = "currentColor", fill = "none" }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill={fill}
    stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
    style={{ flexShrink: 0 }} aria-hidden="true">
    <path d={d} />
  </svg>
);

const D = {
  search:  "M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z",
  x:       "M18 6L6 18M6 6l12 12",
  chevD:   "M6 9l6 6 6-6",
  chevU:   "M18 15l-6-6-6 6",
  book:    "M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15z",
  phone:   "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13 19.79 19.79 0 0 1 1.61 4.37 2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.18 6.18",
  users:   "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  ticket:  "M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z",
  pipeline:"M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z",
  mic:     "M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8",
  zap:     "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
  dollar:  "M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  bell:    "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0",
  settings:"M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z",
  wa:      "M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z",
  helpCirc:"M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01",
  extLink: "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3",
};

// ── FAQ content ───────────────────────────────────────────────────────────────
const CATEGORIES = [
  {
    key: "getting-started", label: "Getting Started", icon: D.zap, color: C.gold,
    faqs: [
      { q: "How do I log in to TIRAS?", a: "Open the TIRAS web app or Android app and enter your email and password on the login screen. Credentials are set by your Company Admin when your account is created. Use Forgot Password if you can't log in — a reset link is sent to your email within seconds." },
      { q: "What is my role and what can I access?", a: "TIRAS has 5 roles: Platform Owner, Company Admin, Manager, Agent, and Support Agent. Agents see only their own leads and calls. Managers see their team. Company Admins see the entire company. Your role badge is shown at the top of Profile Settings." },
      { q: "Can I use TIRAS on my phone?", a: "Yes. The Android app is on Google Play Store. You can also use the full web app in any mobile browser — it's fully responsive. The Android app is built with Capacitor and wraps the same React web app, so features are identical." },
      { q: "How do I change my name or phone number?", a: "Go to Profile Settings → Profile tab. Update your Full Name and Phone Number, then tap Save Changes. Changes save instantly to Firestore and appear across the app immediately." },
    ],
  },
  {
    key: "leads", label: "Lead Management", icon: D.users, color: "#3B82F6",
    faqs: [
      { q: "How do I add a new lead?", a: "Go to My Leads → tap + Add Lead. Fill in name, phone, source (IndiaMART, Referral, etc.), and any other details. Save Lead assigns it to you immediately. Custom fields added by your Admin (e.g. Property Type for real estate) will also appear on this form." },
      { q: "How do I import leads from Excel or CSV?", a: "From the Leads page, tap Import → Upload CSV/Excel. Download the sample template first to see the required columns. Fill your leads into the template, upload the file, and TIRAS imports all valid rows. Duplicate phone numbers are flagged before the import completes so you can review them." },
      { q: "What does lead scoring mean?", a: "TIRAS auto-scores leads based on call duration: calls over 3 minutes = Hot, 1–3 minutes = Warm, under 30 seconds = Cold, and no answer on 3 consecutive attempts = Dead. Scores update automatically after every call — no manual input needed." },
      { q: "Why is TIRAS showing a duplicate warning?", a: "When you save a lead, TIRAS checks the phone number against all leads in your company. If the number exists — even assigned to a different agent — you'll see a warning. You can still save the new lead or cancel and open the existing record instead." },
      { q: "How do I transfer a lead to another agent?", a: "Open the lead detail page → tap the menu (⋯) → Transfer Lead. Select the agent and confirm. The transfer is logged in the lead's full history timeline automatically, along with the reason if you add one." },
    ],
  },
  {
    key: "calling", label: "Calling & Recordings", icon: D.phone, color: C.green,
    faqs: [
      { q: "How do I make a call from TIRAS?", a: "Open any lead's detail page and tap the Call button. TIRAS dials through Plivo automatically. Ensure your internet connection is stable before calling for best audio quality. You don't need to dial manually — the lead's number is used directly." },
      { q: "Where do call recordings go after a call ends?", a: "Every call is recorded automatically — you don't press anything. After the call ends, the recording is processed and linked directly to the lead's timeline within seconds. Tap Play inside the lead detail page to listen without downloading anything." },
      { q: "What is the AI call summary?", a: "After each call, TIRAS sends the recording to Claude AI which generates a 3-line plain English summary covering what was discussed, the outcome, and the suggested next step. The summary is saved to the lead automatically. Managers can read 50 summaries instead of listening to 50 calls." },
      { q: "What happens if two agents try to call the same lead at the same time?", a: "TIRAS detects the overlap in real time. The second agent gets an instant alert that the lead is already on a call. The call is blocked for the second agent until the first call ends — preventing confusion and double-calling." },
      { q: "How long are recordings kept?", a: "Storage depends on your plan: Basic keeps recordings for 7 days, Growth for 30 days, Enterprise for 365 days or lifetime. When a recording expires, the lead record shows 'Recording Expired' — the call log and AI summary remain permanently. Use Self-Archive in Company Settings to export recordings to Google Drive before expiry." },
    ],
  },
  {
    key: "pipeline", label: "Sales Pipeline", icon: D.pipeline, color: "#B65E3C",
    faqs: [
      { q: "How does the Kanban pipeline board work?", a: "The Pipeline page shows all leads as cards organised by stage. Default stages are New → Contacted → Interested → Follow-up → Negotiation → Closed Won → Closed Lost. Drag and drop any lead card to move it to a new stage. The change saves instantly and is logged in the lead's timeline." },
      { q: "Can I add custom stages?", a: "Yes — Company Admins can add, rename, and reorder stages from Company Settings → Pipeline Stages. Custom stages appear immediately for all team members in the company." },
      { q: "What is the Deal Value field?", a: "Each lead has an optional Deal Value (₹) field. When filled, these amounts are summed by stage on the pipeline board and on the Admin God View Dashboard, giving you a live view of total pipeline value. This helps prioritise which leads to close first." },
    ],
  },
  {
    key: "follow-ups", label: "Follow-ups", icon: D.bell, color: C.gold,
    faqs: [
      { q: "How do I schedule a follow-up?", a: "On any lead detail page, tap Schedule Follow-up. Pick a date and time. TIRAS sends a push notification before the follow-up is due and shows it on your Follow-up Calendar. Your Manager can also see all upcoming follow-ups across their team." },
      { q: "What happens when a follow-up is overdue?", a: "If a follow-up passes its scheduled time without being marked complete, it glows red on your dashboard and your Manager's dashboard. After 24 hours overdue, an escalation notification is sent to your Manager automatically. Complete it by logging a call or marking it done from the lead page." },
    ],
  },
  {
    key: "tickets", label: "Support Tickets", icon: D.ticket, color: C.red,
    faqs: [
      { q: "How do I raise a support ticket?", a: "Go to Support Tickets → New Ticket. Fill in subject, category, priority, and description. Optionally link a lead and a call recording. Submit — your Manager and any assigned Support Agent is notified. Every ticket gets a full activity timeline that logs all changes." },
      { q: "Who can resolve my ticket?", a: "Managers, Company Admins, Support Agents, and the Platform Owner can change ticket stage. You can add comments at any time from the ticket detail view. If a ticket is not resolved within 24 hours, it is flagged red and an escalation alert goes to the Company Admin." },
      { q: "What do the ticket stages mean?", a: "Open — just raised. Assigned — a support agent has been assigned. In Progress — actively being worked on. Resolved — the issue is fixed, awaiting confirmation. Closed — fully resolved. Every stage change is logged in the activity timeline with timestamp and actor." },
    ],
  },
  {
    key: "payments", label: "Payments", icon: D.dollar, color: C.green,
    faqs: [
      { q: "How do I collect a payment from a customer?", a: "Open the lead detail page → tap Generate Payment Link. Enter the amount in ₹. TIRAS creates a Razorpay link instantly. Share via WhatsApp or copy-paste. When the customer pays, the lead stage auto-moves to Closed Won and the payment is logged in the lead timeline." },
      { q: "How are subscription payments collected?", a: "All TIRAS subscription payments are collected on the web dashboard via Razorpay — never through the Android app. This avoids Google Play Store's 15% commission. Razorpay charges 2% per transaction. Your customers pay through Razorpay links you generate inside TIRAS." },
    ],
  },
  {
    key: "settings", label: "Settings & Admin", icon: D.settings, color: C.textSec,
    faqs: [
      { q: "How do I add a new agent or manager?", a: "Company Admins go to Team Management → Add Member. Enter their name, email, and select their role. TIRAS creates the account and sends login credentials by email. The new member can log in immediately." },
      { q: "How does recording storage and self-archive work?", a: "From Company Settings, Company Admins can tap Self-Archive → Export to Google Drive. This exports all recordings from the selected month to your connected Google Drive folder. Once exported, recordings are deleted from TIRAS storage — keeping costs at zero. Lead records update to show the archive location." },
      { q: "I am a Platform Owner — how do I onboard a new company?", a: "Log in as Platform Owner → Companies → Add Company. Fill in company name, admin email, and plan. TIRAS creates the company workspace and the Company Admin account automatically. The admin receives login credentials by email and can immediately add their team." },
    ],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "");

const Highlight = ({ text, query }) => {
  if (!query.trim()) return <>{text}</>;
  const re    = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  const parts = text.split(re);
  return (
    <>
      {parts.map((p, i) =>
        re.test(p) ? <mark key={i} className="hc-mark">{p}</mark> : p
      )}
    </>
  );
};

// ── Sub-components ────────────────────────────────────────────────────────────
const CategoryChip = ({ cat, active, onClick }) => (
  <button className="hc-chip" onClick={onClick}
    style={{
      display: "flex", alignItems: "center", gap: 6,
      padding: "7px 14px", minHeight: 34, borderRadius: 8,
      border: `1px solid ${active ? cat.color + "55" : C.border}`,
      background: active ? `${cat.color}14` : C.surface,
      color: active ? cat.color : C.textSec,
      fontFamily: "DM Sans, sans-serif", fontSize: 12, fontWeight: 600,
      whiteSpace: "nowrap",
    }}>
    <Ic d={cat.icon} s={13} c={active ? cat.color : C.textSec} />
    {cat.label}
  </button>
);

const FaqItem = ({ faq, catColor, search, isOpen, onToggle }) => (
  <div className="hc-faq"
    style={{
      borderRadius: 10, overflow: "hidden",
      border: `1px solid ${isOpen ? catColor + "44" : C.border}`,
      background: isOpen ? `${catColor}07` : C.surface,
    }}>
    <button className="hc-faq-btn"
      onClick={onToggle}
      aria-expanded={isOpen}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        width: "100%", padding: "14px 16px", background: "none", gap: 12, textAlign: "left",
      }}>
      <span style={{ fontFamily: "DM Sans, sans-serif", fontSize: 14, fontWeight: 500, color: isOpen ? C.text : "#CCCCCC", flex: 1, lineHeight: 1.45 }}>
        <Highlight text={faq.q} query={search} />
      </span>
      <span style={{ color: isOpen ? catColor : C.textMuted, flexShrink: 0, transition: "transform .2s", transform: isOpen ? "rotate(180deg)" : "none", display: "flex" }}>
        <Ic d={D.chevD} s={16} c="currentColor" />
      </span>
    </button>
    {isOpen && (
      <div style={{ padding: "0 16px 16px", borderTop: `1px solid ${C.border}` }}>
        <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 13.5, color: C.textSec, lineHeight: 1.78, margin: "14px 0 0" }}>
          <Highlight text={faq.a} query={search} />
        </p>
      </div>
    )}
  </div>
);

const FaqSection = ({ cat, search, openMap, onToggle }) => (
  <div>
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: `${cat.color}18`, border: `1px solid ${cat.color}28`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Ic d={cat.icon} s={16} c={cat.color} />
      </div>
      <h2 style={{ fontFamily: "Playfair Display, serif", fontWeight: 700, fontSize: 16, color: C.text, margin: 0 }}>
        {cat.label}
      </h2>
      <span style={{ fontFamily: "DM Sans, sans-serif", fontSize: 11, color: C.textMuted, background: C.surfaceHov, border: `1px solid ${C.border}`, borderRadius: 6, padding: "2px 8px", fontWeight: 600 }}>
        {cat.faqs.length}
      </span>
    </div>
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {cat.faqs.map((faq, i) => {
        const key = `${cat.key}-${i}`;
        return (
          <FaqItem key={key} faq={faq} catColor={cat.color}
            search={search} isOpen={!!openMap[key]} onToggle={() => onToggle(key)} />
        );
      })}
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════════════════
export const HelpCenter = () => {
  useAuth(); // context available but not needed for static content
  const [search,  setSearch]  = useState("");
  const [activeCat, setActiveCat] = useState("all");
  const [openMap, setOpenMap] = useState({});

  const toggle = (key) => setOpenMap((m) => ({ ...m, [key]: !m[key] }));

  const results = useMemo(() => {
    const q = norm(search);
    return CATEGORIES
      .map((cat) => ({
        ...cat,
        faqs: cat.faqs.filter(
          (f) => !q || norm(f.q).includes(q) || norm(f.a).includes(q)
        ),
      }))
      .filter((cat) =>
        (activeCat === "all" || cat.key === activeCat) && cat.faqs.length > 0
      );
  }, [search, activeCat]);

  const totalResults = results.reduce((n, c) => n + c.faqs.length, 0);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "DM Sans, sans-serif", paddingBottom: 80 }}>

      {/* Hero */}
      <div className="hc-hero" style={{
        padding: "56px 24px 44px", textAlign: "center",
        borderBottom: `1px solid ${C.border}`,
        background: "linear-gradient(180deg, rgba(212,175,55,0.04) 0%, transparent 100%)",
      }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: C.goldMuted, border: `1px solid ${C.gold}30`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
          <Ic d={D.helpCirc} s={28} c={C.gold} />
        </div>
        <h1 style={{ fontFamily: "Playfair Display, serif", fontWeight: 700, fontSize: 28, color: C.text, margin: "0 0 10px", letterSpacing: "-.4px" }}>
          How can we help?
        </h1>
        <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 15, color: C.textSec, margin: "0 auto 28px", maxWidth: 420, lineHeight: 1.65 }}>
          Search guides and FAQs for every feature in TIRAS.
        </p>

        {/* Search */}
        <div style={{ position: "relative", maxWidth: 540, margin: "0 auto" }}>
          <span style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
            <Ic d={D.search} s={17} c={C.textMuted} />
          </span>
          <input className="hc-search"
            style={{
              width: "100%", padding: "13px 48px", boxSizing: "border-box",
              background: C.surface, border: `1px solid ${C.border}`,
              borderRadius: 12, color: C.text,
              fontFamily: "DM Sans, sans-serif", fontSize: 15,
              transition: "border-color .15s",
            }}
            placeholder={'Search — e.g. "add lead", "call recording", "payment link"'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          {search && (
            <button onClick={() => setSearch("")}
              style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", display: "flex", padding: 4, borderRadius: 4 }}>
              <Ic d={D.x} s={14} c={C.textMuted} />
            </button>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 820, margin: "0 auto", padding: "24px 20px 0" }}>

        {/* Category chips */}
        <div className="hc-chips" style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
          <CategoryChip
            cat={{ key: "all", label: "All Topics", icon: D.book, color: C.gold }}
            active={activeCat === "all"}
            onClick={() => setActiveCat("all")}
          />
          {CATEGORIES.map((cat) => (
            <CategoryChip key={cat.key} cat={cat}
              active={activeCat === cat.key}
              onClick={() => setActiveCat(cat.key)} />
          ))}
        </div>

        {/* Result count */}
        {search && (
          <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 13, color: C.textSec, marginBottom: 20 }}>
            {totalResults === 0
              ? "No results found — try different keywords."
              : `${totalResults} result${totalResults !== 1 ? "s" : ""} for "${search}"`}
          </p>
        )}

        {/* Empty */}
        {results.length === 0 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "60px 24px", gap: 12, textAlign: "center" }}>
            <Ic d={D.helpCirc} s={36} c={C.gold} />
            <p style={{ fontFamily: "Playfair Display, serif", fontWeight: 700, fontSize: 16, color: C.text, margin: 0 }}>Nothing matches your search.</p>
            <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 13, color: C.textSec, margin: 0 }}>Try different keywords or browse all topics.</p>
          </div>
        )}

        {/* FAQ sections */}
        <div style={{ display: "flex", flexDirection: "column", gap: 36 }}>
          {results.map((cat) => (
            <FaqSection key={cat.key} cat={cat} search={search} openMap={openMap} onToggle={toggle} />
          ))}
        </div>

        {/* Contact strip */}
        <div style={{ marginTop: 56, padding: "24px 28px", borderRadius: 14, background: "rgba(37,211,102,0.06)", border: "1px solid rgba(37,211,102,0.2)" }}>
          <div className="hc-contact-inner" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 46, height: 46, borderRadius: 12, background: "rgba(37,211,102,0.1)", border: "1px solid rgba(37,211,102,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Ic d={D.wa} s={22} c="#25D366" />
              </div>
              <div>
                <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 14, fontWeight: 600, color: C.text, margin: 0 }}>Still need help?</p>
                <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 12, color: C.textSec, margin: "3px 0 0" }}>
                  Tony responds personally on WhatsApp — usually within 2 hours.
                </p>
              </div>
            </div>
            <a className="hc-contact-btn"
              href="https://wa.me/91XXXXXXXXXX?text=Hi%20Tony%2C%20I%20need%20help%20with%20TIRAS%20CRM"
              target="_blank" rel="noreferrer"
              style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 22px", borderRadius: 9, background: "#25D366", color: "#121212", fontFamily: "DM Sans, sans-serif", fontSize: 13, fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap" }}>
              <Ic d={D.wa} s={15} c="#121212" />
              Chat on WhatsApp
              <Ic d={D.extLink} s={12} c="#121212" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HelpCenter;
