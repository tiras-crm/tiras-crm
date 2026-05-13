import { useState, useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";

// ── Icon primitive ───────────────────────────────────────────────────────────
const Icon = ({ d, size = 18, color = "currentColor" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d={d} />
  </svg>
);

const ICONS = {
  search:    "M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z",
  chevDown:  "M6 9l6 6 6-6",
  chevUp:    "M18 15l-6-6-6 6",
  chevRight: "M9 18l6-6-6-6",
  book:      "M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15z",
  phone:     "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13 19.79 19.79 0 0 1 1.61 4.37 2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.18 6.18",
  users:     "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  ticket:    "M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z",
  pipeline:  "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z",
  mic:       "M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8",
  zap:       "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
  dollar:    "M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  bell:      "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0",
  settings:  "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z",
  whatsapp:  "M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z",
  x:         "M18 6L6 18M6 6l12 12",
  check:     "M20 6L9 17l-5-5",
  helpCircle:"M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01",
  externalLink: "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3",
};

// ── Help content ─────────────────────────────────────────────────────────────
const CATEGORIES = [
  {
    key:   "getting-started",
    label: "Getting Started",
    icon:  ICONS.zap,
    color: "#F2A65A",
    faqs: [
      {
        q: "How do I log in to TIRAS?",
        a: "Open the TIRAS web app or Android app. Enter your email and password on the login screen and tap Sign In. Your credentials are provided by your Company Admin or Manager when your account is created. If you cannot log in, use Forgot Password to reset via your email.",
      },
      {
        q: "What is my role and what can I access?",
        a: "TIRAS has 5 roles — Platform Owner, Company Admin, Manager, Agent, and Support Agent. Your role controls exactly what you see. Agents see only their own leads and calls. Managers see their team's data. Company Admins see the entire company. You can check your role under Profile Settings → your role badge is displayed at the top.",
      },
      {
        q: "Can I use TIRAS on my phone?",
        a: "Yes. TIRAS has a full Android app available on Google Play Store. You can also open the web app in any mobile browser — it is fully responsive and works on all screen sizes. The Android app is optimised for field agents making calls on the go.",
      },
      {
        q: "How do I change my display name or phone number?",
        a: "Go to Profile Settings (tap your avatar or the profile icon). Under the Profile tab, update your Full Name and Phone Number, then tap Save Profile. Changes are saved instantly.",
      },
    ],
  },
  {
    key:   "leads",
    label: "Lead Management",
    icon:  ICONS.users,
    color: "#5AB4F2",
    faqs: [
      {
        q: "How do I add a new lead?",
        a: "Go to My Leads → tap the + Add Lead button in the top right. Fill in the lead's name, phone number, source (e.g. IndiaMART, Referral), and any other details. Tap Save Lead. The lead is immediately assigned to you and appears in your list.",
      },
      {
        q: "How do I import leads from Excel or CSV?",
        a: "From the Leads page, tap Import → Upload CSV/Excel. Download the sample template to see the required column format. Fill your leads into the template, upload the file, and TIRAS will import all valid rows. Duplicate phone numbers are automatically detected and flagged before import completes.",
      },
      {
        q: "What does lead scoring (Hot / Warm / Cold / Dead) mean?",
        a: "TIRAS automatically scores every lead based on call duration: calls over 3 minutes = Hot, 1–3 minutes = Warm, under 30 seconds = Cold. If a lead has no answer on 3 consecutive calls, it is marked Dead. Scores update automatically after every call — you do not need to set them manually.",
      },
      {
        q: "How do I transfer a lead to another agent?",
        a: "Open the lead's detail page. Tap the ⋯ menu (top right of the lead card) → Transfer Lead. Select the agent you want to transfer to and confirm. A transfer entry is logged in the lead's history timeline automatically.",
      },
      {
        q: "Why does TIRAS show a duplicate warning when I add a lead?",
        a: "TIRAS checks phone numbers across all leads in your company when you save a new lead. If the number already exists — even if assigned to a different agent — you will see a warning. You can choose to still save the lead or cancel and open the existing record instead.",
      },
    ],
  },
  {
    key:   "calling",
    label: "Calling & Recordings",
    icon:  ICONS.phone,
    color: "#7DD87D",
    faqs: [
      {
        q: "How do I make a call from TIRAS?",
        a: "Open any lead's detail page and tap the Call button (green phone icon). TIRAS dials the lead through Plivo automatically. You do not need to dial manually. Make sure your internet connection is stable before initiating calls for best audio quality.",
      },
      {
        q: "Where do call recordings go after a call ends?",
        a: "Every call is recorded automatically — you don't have to press anything. After the call ends, the recording is processed and linked directly to the lead's timeline within a few seconds. You can tap Play inside the lead detail page to listen without downloading.",
      },
      {
        q: "What is the AI call summary?",
        a: "After each call, TIRAS sends the recording to Claude AI which generates a 3-line plain English summary — what was discussed, outcome, and next step. The summary is saved automatically to the lead and is visible in the lead timeline. Managers can read summaries without listening to every full recording.",
      },
      {
        q: "What happens if two agents try to call the same lead at the same time?",
        a: "TIRAS detects overlap in real time. The second agent attempting to dial will receive an instant alert saying the lead is already on a call with another agent. The call is blocked for the second agent until the first call ends.",
      },
      {
        q: "How long are recordings stored?",
        a: "Storage depends on your plan: Basic plan keeps recordings for 7 days, Growth plan for 30 days, Enterprise plan for 365 days or longer. When a recording expires, the lead record is updated to show 'Recording Expired' — the call log and AI summary remain permanently. You can also use Self-Archive from Company Settings to export recordings to Google Drive before they expire.",
      },
    ],
  },
  {
    key:   "pipeline",
    label: "Sales Pipeline",
    icon:  ICONS.pipeline,
    color: "#B65E3C",
    faqs: [
      {
        q: "How does the Kanban pipeline board work?",
        a: "The Pipeline page shows all your leads as cards organised by stage. Default stages are: New → Contacted → Interested → Follow-up → Negotiation → Closed Won → Closed Lost. Drag and drop any lead card to move it to the next stage. The stage change is saved instantly and logged in the lead's timeline.",
      },
      {
        q: "Can I add custom pipeline stages?",
        a: "Yes — Company Admins can add, rename, and reorder stages from Company Settings → Pipeline Stages. Custom stages appear on the board for everyone in the company immediately after saving.",
      },
      {
        q: "What is the Deal Value field?",
        a: "Each lead has an optional Deal Value field (in ₹). When filled, these values are summed up by stage on the Pipeline board and on the Admin Dashboard — giving you a live view of your total pipeline value. It helps prioritise which leads to close first.",
      },
    ],
  },
  {
    key:   "follow-ups",
    label: "Follow-ups",
    icon:  ICONS.bell,
    color: "#F2A65A",
    faqs: [
      {
        q: "How do I schedule a follow-up?",
        a: "On any lead's detail page, tap Schedule Follow-up. Pick a date and time. TIRAS will send you a push notification before the follow-up is due. The follow-up also appears on your Follow-up Calendar and your Manager's dashboard.",
      },
      {
        q: "What happens when a follow-up is overdue?",
        a: "If a follow-up passes its scheduled time without being completed, it glows red on your dashboard and your Manager's dashboard. After 24 hours overdue, an escalation notification is automatically sent to your Manager. Complete the follow-up by logging a call or marking it done from the lead page.",
      },
      {
        q: "Where can I see all my upcoming follow-ups?",
        a: "Tap My Follow-ups from the main menu. You can switch between Day, Week, and Month calendar views. Overdue follow-ups are highlighted in red at the top of the list.",
      },
    ],
  },
  {
    key:   "tickets",
    label: "Support Tickets",
    icon:  ICONS.ticket,
    color: "#E05C5C",
    faqs: [
      {
        q: "How do I raise a support ticket?",
        a: "Go to Support Tickets → tap New Ticket. Fill in the subject, category, priority, and description. You can optionally link the ticket to a specific lead or call recording. Tap Submit Ticket — the ticket is created instantly and your Manager or Support Agent is notified.",
      },
      {
        q: "Who can see and resolve my ticket?",
        a: "Once raised, your ticket is visible to you, your Manager, Company Admin, and any Support Agent assigned to it. Only Managers, Company Admins, Support Agents, and Platform Owner can change the ticket stage. You can add comments at any time from the ticket detail view.",
      },
      {
        q: "What do the ticket stages mean?",
        a: "Open — just raised, not yet picked up. Assigned — a support agent has been assigned. In Progress — actively being worked on. Resolved — the issue is fixed, awaiting your confirmation. Closed — fully resolved and closed. If a ticket is not resolved within 24 hours, it is automatically flagged red and an escalation alert is sent to the Company Admin.",
      },
    ],
  },
  {
    key:   "payments",
    label: "Payments",
    icon:  ICONS.dollar,
    color: "#B65E3C",
    faqs: [
      {
        q: "How do I collect a payment from a customer?",
        a: "Open the lead's detail page → tap Generate Payment Link. Enter the amount in ₹. TIRAS creates a Razorpay payment link instantly. Copy the link and share it via the WhatsApp button or any other method. When the customer pays, the lead stage automatically updates to Closed Won.",
      },
      {
        q: "Where are payments collected — app or web?",
        a: "All subscription payments for TIRAS itself are collected via the web dashboard only — not through the Android app. This is intentional to avoid Google Play Store's 15% commission. Razorpay charges only 2% per transaction. For your customers paying you, links are generated via the app and web both.",
      },
      {
        q: "Can I get an invoice for payments?",
        a: "Yes. After a payment is recorded against a lead, TIRAS generates a basic PDF invoice automatically using the lead's details and payment amount. The invoice is accessible from the lead's payment history section.",
      },
    ],
  },
  {
    key:   "whatsapp",
    label: "WhatsApp",
    icon:  ICONS.whatsapp,
    color: "#25D366",
    faqs: [
      {
        q: "How does WhatsApp work inside TIRAS?",
        a: "Every lead detail page has a WhatsApp button. Tapping it opens WhatsApp on your phone with the lead's number pre-filled and a message template ready. You just tap Send. No Meta Business API approval is required — it works from day one.",
      },
      {
        q: "Can I customise the WhatsApp message templates?",
        a: "Yes — Company Admins can create and save custom templates from Company Settings → WhatsApp Templates. Default templates include: Introduction, Follow-up, Thank You, Payment Reminder, and Meeting Confirmation. Agents select from these templates before opening WhatsApp.",
      },
    ],
  },
  {
    key:   "settings",
    label: "Settings & Admin",
    icon:  ICONS.settings,
    color: "#AAAAAA",
    faqs: [
      {
        q: "How do I add a new agent or manager to my company?",
        a: "Company Admins go to Team Management → Add Member. Enter their name, email, and select their role (Agent or Manager). TIRAS creates their account and sends a login email. The new member can log in immediately with the credentials from their email.",
      },
      {
        q: "How do I change notification preferences?",
        a: "Go to Profile Settings → Notifications tab. Toggle each notification type on or off — follow-up reminders, new lead assigned, ticket updates, recording ready, payment received, and overdue alerts. Changes are saved immediately.",
      },
      {
        q: "How does recording storage and the self-archive feature work?",
        a: "From Company Settings, Admins can tap Self-Archive → Export to Google Drive. This exports all recordings from the current month to your connected Google Drive folder. Once exported successfully, those recordings are deleted from TIRAS storage — saving costs. The lead records are updated to show where the recording was archived.",
      },
      {
        q: "I am a Platform Owner — how do I onboard a new company?",
        a: "Log in as Platform Owner → Companies → Add Company. Fill in the company name, admin email, and plan. TIRAS creates the company workspace and the Company Admin account automatically. The new admin receives login credentials by email and can immediately start adding their team.",
      },
    ],
  },
];

// ── Search helpers ────────────────────────────────────────────────────────────
const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "");

const highlight = (text, query) => {
  if (!query.trim()) return text;
  const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  const parts = text.split(re);
  return parts.map((p, i) =>
    re.test(p)
      ? <mark key={i} style={styles.mark}>{p}</mark>
      : p
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
export const HelpCenter = () => {
  const { userProfile } = useAuth();
  const [search,      setSearch]      = useState("");
  const [activeCategory, setActiveCat] = useState("all");
  const [openFaqs,    setOpenFaqs]    = useState({});

  const toggleFaq = (key) =>
    setOpenFaqs((s) => ({ ...s, [key]: !s[key] }));

  // ── Filtered results ────────────────────────────────────────────────────
  const results = useMemo(() => {
    const q = normalize(search);
    return CATEGORIES.map((cat) => ({
      ...cat,
      faqs: cat.faqs.filter(
        (faq) =>
          !q ||
          normalize(faq.q).includes(q) ||
          normalize(faq.a).includes(q)
      ),
    })).filter(
      (cat) =>
        (activeCategory === "all" || cat.key === activeCategory) &&
        cat.faqs.length > 0
    );
  }, [search, activeCategory]);

  const totalResults = results.reduce((n, c) => n + c.faqs.length, 0);

  return (
    <div style={styles.page}>
      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <div style={styles.hero}>
        <div style={styles.heroIcon}>
          <Icon d={ICONS.helpCircle} size={28} color="#F2A65A" />
        </div>
        <h1 style={styles.heroTitle}>How can we help?</h1>
        <p style={styles.heroSub}>
          Search guides and FAQs for every feature in TIRAS.
        </p>

        {/* Search bar */}
        <div style={styles.searchWrap}>
          <span style={styles.searchIcon}>
            <Icon d={ICONS.search} size={18} color="#888" />
          </span>
          <input
            style={styles.searchInput}
            placeholder="Search — e.g. "add lead", "call recording", "payment link""
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          {search && (
            <button style={styles.searchClear} onClick={() => setSearch("")}>
              <Icon d={ICONS.x} size={14} color="#888" />
            </button>
          )}
        </div>
      </div>

      {/* ── Category chips ─────────────────────────────────────────────── */}
      <div style={styles.chips}>
        <CategoryChip
          cat={{ key: "all", label: "All Topics", icon: ICONS.book, color: "#F2A65A" }}
          active={activeCategory === "all"}
          onClick={() => setActiveCat("all")}
        />
        {CATEGORIES.map((cat) => (
          <CategoryChip
            key={cat.key}
            cat={cat}
            active={activeCategory === cat.key}
            onClick={() => setActiveCat(cat.key)}
          />
        ))}
      </div>

      {/* ── Results summary ────────────────────────────────────────────── */}
      {search && (
        <p style={styles.resultCount}>
          {totalResults === 0
            ? "No results found — try different keywords."
            : `${totalResults} result${totalResults !== 1 ? "s" : ""} for "${search}"`}
        </p>
      )}

      {/* ── FAQ sections ───────────────────────────────────────────────── */}
      {results.length === 0 && !search && (
        <EmptyState />
      )}

      <div style={styles.sections}>
        {results.map((cat) => (
          <FaqSection
            key={cat.key}
            cat={cat}
            search={search}
            openFaqs={openFaqs}
            onToggle={toggleFaq}
          />
        ))}
      </div>

      {/* ── Contact strip ──────────────────────────────────────────────── */}
      <ContactStrip userProfile={userProfile} />
    </div>
  );
};

// ── CategoryChip ─────────────────────────────────────────────────────────────
const CategoryChip = ({ cat, active, onClick }) => (
  <button
    onClick={onClick}
    style={{
      ...styles.chip,
      background: active ? "#1E1510" : "#1A1A1A",
      border: `1px solid ${active ? "#B65E3C55" : "#2A2A2A"}`,
      color: active ? cat.color : "#888",
    }}
  >
    <Icon d={cat.icon} size={13} color={active ? cat.color : "#888"} />
    {cat.label}
  </button>
);

// ── FaqSection ────────────────────────────────────────────────────────────────
const FaqSection = ({ cat, search, openFaqs, onToggle }) => (
  <div style={styles.section}>
    <div style={styles.sectionHeader}>
      <div
        style={{
          ...styles.sectionIconWrap,
          background: `${cat.color}18`,
          border: `1px solid ${cat.color}33`,
        }}
      >
        <Icon d={cat.icon} size={16} color={cat.color} />
      </div>
      <h2 style={styles.sectionTitle}>{cat.label}</h2>
      <span style={styles.sectionCount}>{cat.faqs.length}</span>
    </div>

    <div style={styles.faqList}>
      {cat.faqs.map((faq, i) => {
        const key = `${cat.key}-${i}`;
        const open = !!openFaqs[key];
        return (
          <FaqItem
            key={key}
            faq={faq}
            isOpen={open}
            search={search}
            catColor={cat.color}
            onToggle={() => onToggle(key)}
          />
        );
      })}
    </div>
  </div>
);

// ── FaqItem ───────────────────────────────────────────────────────────────────
const FaqItem = ({ faq, isOpen, search, catColor, onToggle }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{
        ...styles.faqItem,
        borderLeft: `2px solid ${isOpen ? catColor : hovered ? "#333" : "transparent"}`,
        background: isOpen ? "#1C1610" : hovered ? "#1C1C1C" : "#1A1A1A",
        transition: "all 0.15s",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        style={styles.faqQuestion}
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        <span style={{ ...styles.faqQText, color: isOpen ? "#F5F5F5" : "#D0D0D0" }}>
          {highlight(faq.q, search)}
        </span>
        <span
          style={{
            ...styles.faqChevron,
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            color: isOpen ? catColor : "#666",
          }}
        >
          <Icon d={ICONS.chevDown} size={16} color="currentColor" />
        </span>
      </button>

      {isOpen && (
        <div style={styles.faqAnswer}>
          <p style={styles.faqAnswerText}>{highlight(faq.a, search)}</p>
        </div>
      )}
    </div>
  );
};

// ── Contact Strip ─────────────────────────────────────────────────────────────
const ContactStrip = ({ userProfile }) => (
  <div style={styles.contact}>
    <div style={styles.contactLeft}>
      <div style={styles.contactIconWrap}>
        <Icon d={ICONS.whatsapp} size={22} color="#25D366" />
      </div>
      <div>
        <p style={styles.contactTitle}>Still need help?</p>
        <p style={styles.contactSub}>
          Tony responds personally on WhatsApp — usually within 2 hours.
        </p>
      </div>
    </div>
    <a
      href="https://wa.me/91XXXXXXXXXX?text=Hi%20Tony%2C%20I%20need%20help%20with%20TIRAS%20CRM"
      target="_blank"
      rel="noreferrer"
      style={styles.contactBtn}
    >
      <Icon d={ICONS.whatsapp} size={15} color="#121212" />
      Chat on WhatsApp
      <Icon d={ICONS.externalLink} size={13} color="#121212" />
    </a>
  </div>
);

// ── Empty state ───────────────────────────────────────────────────────────────
const EmptyState = () => (
  <div style={styles.empty}>
    <Icon d={ICONS.helpCircle} size={36} color="#B65E3C" />
    <p style={styles.emptyTitle}>No articles match your search.</p>
    <p style={styles.emptyText}>Try different keywords or browse all topics above.</p>
  </div>
);

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = {
  page: {
    minHeight: "100vh",
    background: "#121212",
    color: "#F5F5F5",
    fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
    padding: "0 0 80px",
    maxWidth: 820,
    margin: "0 auto",
  },

  // Hero
  hero: {
    padding: "48px 24px 36px",
    textAlign: "center",
    borderBottom: "1px solid #1E1E1E",
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: "50%",
    background: "#1E1510",
    border: "1px solid #B65E3C33",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 20px",
  },
  heroTitle: {
    margin: "0 0 10px",
    fontSize: 28,
    fontWeight: 800,
    letterSpacing: "-0.5px",
    color: "#F5F5F5",
  },
  heroSub: {
    margin: "0 0 28px",
    fontSize: 15,
    color: "#888",
  },
  searchWrap: {
    position: "relative",
    maxWidth: 560,
    margin: "0 auto",
    display: "flex",
    alignItems: "center",
  },
  searchIcon: {
    position: "absolute",
    left: 16,
    display: "flex",
    alignItems: "center",
    pointerEvents: "none",
  },
  searchInput: {
    width: "100%",
    padding: "14px 48px 14px 48px",
    background: "#1A1A1A",
    border: "1px solid #2A2A2A",
    borderRadius: 12,
    color: "#F5F5F5",
    fontSize: 15,
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "inherit",
    transition: "border-color 0.15s",
  },
  searchClear: {
    position: "absolute",
    right: 14,
    background: "none",
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    padding: 4,
    borderRadius: 4,
  },

  // Chips
  chips: {
    display: "flex",
    gap: 6,
    padding: "20px 24px 0",
    overflowX: "auto",
    scrollbarWidth: "none",
    flexWrap: "wrap",
  },
  chip: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "7px 13px",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 500,
    cursor: "pointer",
    whiteSpace: "nowrap",
    transition: "all 0.15s",
  },

  // Result count
  resultCount: {
    padding: "16px 24px 0",
    fontSize: 13,
    color: "#888",
    margin: 0,
  },

  // Sections
  sections: {
    padding: "24px 24px 0",
    display: "flex",
    flexDirection: "column",
    gap: 32,
  },
  section: {},
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  sectionIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  sectionTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 700,
    color: "#F5F5F5",
    flex: 1,
  },
  sectionCount: {
    fontSize: 12,
    color: "#666",
    background: "#1E1E1E",
    border: "1px solid #2A2A2A",
    borderRadius: 6,
    padding: "2px 8px",
    fontWeight: 600,
  },

  // FAQ
  faqList: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  faqItem: {
    borderRadius: 10,
    overflow: "hidden",
    border: "1px solid #222",
  },
  faqQuestion: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    padding: "14px 16px",
    background: "none",
    border: "none",
    cursor: "pointer",
    textAlign: "left",
    gap: 12,
  },
  faqQText: {
    fontSize: 14,
    fontWeight: 500,
    lineHeight: 1.5,
    flex: 1,
  },
  faqChevron: {
    flexShrink: 0,
    transition: "transform 0.2s ease",
    display: "flex",
    alignItems: "center",
  },
  faqAnswer: {
    padding: "0 16px 16px",
    borderTop: "1px solid #252525",
    paddingTop: 14,
  },
  faqAnswerText: {
    margin: 0,
    fontSize: 14,
    color: "#AAAAAA",
    lineHeight: 1.75,
  },

  // Highlight
  mark: {
    background: "#B65E3C44",
    color: "#F2A65A",
    borderRadius: 2,
    padding: "0 2px",
  },

  // Contact
  contact: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 16,
    margin: "40px 24px 0",
    padding: "20px 24px",
    borderRadius: 12,
    background: "#0F1A12",
    border: "1px solid #25D36633",
  },
  contactLeft: {
    display: "flex",
    alignItems: "center",
    gap: 14,
  },
  contactIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 12,
    background: "#0A2210",
    border: "1px solid #25D36633",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  contactTitle: {
    margin: 0,
    fontSize: 15,
    fontWeight: 600,
    color: "#F5F5F5",
  },
  contactSub: {
    margin: "3px 0 0",
    fontSize: 13,
    color: "#888",
  },
  contactBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 20px",
    borderRadius: 8,
    background: "#25D366",
    color: "#121212",
    fontSize: 13,
    fontWeight: 700,
    textDecoration: "none",
    whiteSpace: "nowrap",
  },

  // Empty
  empty: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "60px 24px",
    gap: 12,
    textAlign: "center",
  },
  emptyTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 600,
    color: "#F5F5F5",
  },
  emptyText: {
    margin: 0,
    fontSize: 14,
    color: "#888",
  },
};

export default HelpCenter;
