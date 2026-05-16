import { useState, useEffect, useCallback } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db, COLLECTIONS } from "../firebase";
import { useAuth } from "../contexts/AuthContext";

/* ─────────────────────────────────────────────────────────────────────────────
   TIRAS CRM V2 — NotificationsCenter
   Theme: Obsidian Gold  |  Route: /notifications  |  All roles
   Real-time Firestore · Category tabs · Mark read · Low-balance alert banner
───────────────────────────────────────────────────────────────────────────── */

const C = {
  bg:         "#121212",
  surface:    "#1A1A1B",
  surfaceHov: "#222223",
  border:     "#2A2A2B",
  gold:       "#D4AF37",
  goldMuted:  "rgba(212,175,55,0.12)",
  red:        "#E63946",
  redMuted:   "rgba(230,57,70,0.12)",
  green:      "#10B981",
  greenMuted: "rgba(16,185,129,0.12)",
  blue:       "#3B82F6",
  blueMuted:  "rgba(59,130,246,0.12)",
  text:       "#F5F5F5",
  textSec:    "#9A9A9A",
  textMuted:  "#555555",
};

// ── Inject global styles once ─────────────────────────────────────────────────
const STYLE_ID = "tiras-v2-nc";
if (typeof document !== "undefined" && !document.getElementById(STYLE_ID)) {
  const s = document.createElement("style");
  s.id = STYLE_ID;
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:wght@400;500;600;700&display=swap');

    @keyframes nc-up { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
    @keyframes nc-shimmer { 0% { background-position:-400px 0; } 100% { background-position:400px 0; } }
    @keyframes nc-toast-in  { from { transform:translateX(110%); opacity:0; } to { transform:translateX(0); opacity:1; } }
    @keyframes nc-toast-out { from { transform:translateX(0); opacity:1; } to { transform:translateX(110%); opacity:0; } }

    .nc-skel {
      background: linear-gradient(90deg,#1A1A1B 25%,#222223 50%,#1A1A1B 75%);
      background-size:400px 100%; animation:nc-shimmer 1.4s infinite; border-radius:6px;
    }
    .nc-up { animation: nc-up .42s ease both; }

    .nc-row { transition: background .14s, transform .14s, box-shadow .14s; }
    .nc-row:hover { background: #222223 !important; }
    .nc-row.unread:hover { transform: translateX(3px); }
    .nc-row:focus-visible { outline: 2px solid #D4AF37; outline-offset: 2px; }

    .nc-tab { transition: all .14s; border:none; cursor:pointer; }
    .nc-tab:hover { color:#D4AF37 !important; }

    .nc-mark { transition: all .14s; }
    .nc-mark:hover { background:rgba(212,175,55,0.12) !important; color:#D4AF37 !important; border-color:#D4AF37 !important; }

    .nc-toast {
      position:fixed; bottom:24px; right:24px; z-index:9999;
      display:flex; align-items:center; gap:10px;
      padding:12px 18px; border-radius:10px;
      font-family:'DM Sans',sans-serif; font-size:13px; font-weight:600;
      box-shadow:0 8px 32px rgba(0,0,0,.5);
      animation:nc-toast-in .3s ease both;
    }

    @media (max-width:640px) {
      .nc-tabs { overflow-x:auto; scrollbar-width:none; flex-wrap:nowrap !important; padding-bottom:4px; }
      .nc-header { flex-direction:column !important; align-items:flex-start !important; }
    }
  `;
  document.head.appendChild(s);
}

// ── Icon ──────────────────────────────────────────────────────────────────────
const Ic = ({ d, s = 16, c = "currentColor", fill = "none" }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill={fill}
    stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
    style={{ flexShrink: 0 }} aria-hidden="true">
    <path d={d} />
  </svg>
);

const D = {
  bell:      "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0",
  check:     "M20 6L9 17l-5-5",
  checkAll:  "M2 12l5 5L22 4M9 17l-5-5",
  calendar:  "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 0 2-2z",
  user:      "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
  ticket:    "M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z",
  mic:       "M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8",
  dollar:    "M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  alert:     "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01",
  inbox:     "M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z",
  wallet:    "M21 12V7H5a2 2 0 0 1 0-4h14v4M21 12a2 2 0 0 1 0 4H5a2 2 0 0 1 0-4h16v4",
  zap:       "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
  x:         "M18 6L6 18M6 6l12 12",
};

// ── Type config ───────────────────────────────────────────────────────────────
const TYPE_CFG = {
  follow_up:       { label: "Follow-up",   icon: D.calendar, color: C.gold,  bg: C.goldMuted  },
  lead_assigned:   { label: "Lead",        icon: D.user,     color: C.blue,  bg: C.blueMuted  },
  ticket_update:   { label: "Ticket",      icon: D.ticket,   color: C.red,   bg: C.redMuted   },
  recording_ready: { label: "Recording",   icon: D.mic,      color: C.green, bg: C.greenMuted },
  payment:         { label: "Payment",     icon: D.dollar,   color: C.green, bg: C.greenMuted },
  low_balance:     { label: "Wallet",      icon: D.wallet,   color: C.red,   bg: C.redMuted   },
  system:          { label: "System",      icon: D.zap,      color: C.gold,  bg: C.goldMuted  },
};

const TABS = [
  { key: "all",             label: "All",        icon: D.bell     },
  { key: "follow_up",       label: "Follow-ups", icon: D.calendar },
  { key: "lead_assigned",   label: "Leads",      icon: D.user     },
  { key: "ticket_update",   label: "Tickets",    icon: D.ticket   },
  { key: "recording_ready", label: "Recordings", icon: D.mic      },
  { key: "low_balance",     label: "Wallet",     icon: D.wallet   },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const timeAgo = (ts) => {
  if (!ts) return "";
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  const diff = Math.floor((Date.now() - d) / 1000);
  if (diff < 60)     return "just now";
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

// ── Toast hook ────────────────────────────────────────────────────────────────
const useToast = () => {
  const [t, setT] = useState(null);
  const show = useCallback((msg, type = "success") => {
    setT({ msg, type });
    setTimeout(() => setT(null), 3200);
  }, []);
  return [t, show];
};

// ── Sub-components ────────────────────────────────────────────────────────────
const Toast = ({ t }) => {
  if (!t) return null;
  const err = t.type === "error";
  return (
    <div className="nc-toast" style={{
      background: err ? "#2A1215" : "#0F2A1E",
      border: `1px solid ${err ? C.red : C.green}44`,
      color: err ? C.red : C.green,
    }}>
      <Ic d={err ? D.alert : D.check} s={14} c={err ? C.red : C.green} />
      {t.msg}
    </div>
  );
};

const SectionLabel = ({ label, dot }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, paddingLeft: 2 }}>
    <span style={{ width: 7, height: 7, borderRadius: "50%", background: dot, flexShrink: 0 }} />
    <span style={{
      fontFamily: "DM Sans, sans-serif", fontSize: 10, fontWeight: 700,
      color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.8px",
    }}>{label}</span>
  </div>
);

const Skeleton = () => (
  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
    {[...Array(6)].map((_, i) => (
      <div key={i} style={{
        display: "flex", alignItems: "center", gap: 14,
        padding: "16px 18px", borderRadius: 12,
        background: C.surface, border: `1px solid ${C.border}`,
      }}>
        <div className="nc-skel" style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0 }} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="nc-skel" style={{ height: 10, width: "26%" }} />
          <div className="nc-skel" style={{ height: 13, width: "70%" }} />
          <div className="nc-skel" style={{ height: 10, width: "38%" }} />
        </div>
        <div className="nc-skel" style={{ width: 9, height: 9, borderRadius: "50%", flexShrink: 0 }} />
      </div>
    ))}
  </div>
);

const EmptyState = ({ tab }) => {
  const cfg = TYPE_CFG[tab];
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "80px 24px", gap: 14, textAlign: "center",
    }}>
      <div style={{
        width: 70, height: 70, borderRadius: "50%",
        background: C.goldMuted, border: `1px solid ${C.gold}30`,
        display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 6,
      }}>
        <Ic d={cfg?.icon ?? D.inbox} s={30} c={C.gold} />
      </div>
      <p style={{ fontFamily: "Playfair Display, serif", fontWeight: 700, fontSize: 17, color: C.text, margin: 0 }}>
        No notifications
      </p>
      <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 13, color: C.textSec, maxWidth: 280, lineHeight: 1.6, margin: 0 }}>
        {tab === "all"
          ? "You're all caught up. New alerts appear here automatically."
          : `No ${cfg?.label?.toLowerCase() ?? ""} notifications yet.`}
      </p>
    </div>
  );
};

const NotifRow = ({ notif, onRead, delay }) => {
  const cfg = TYPE_CFG[notif.type] ?? TYPE_CFG.system;
  const isLowBal = notif.type === "low_balance";

  return (
    <div
      className={`nc-row nc-up ${notif.read ? "" : "unread"}`}
      role={notif.read ? "listitem" : "button"}
      tabIndex={notif.read ? -1 : 0}
      onClick={() => !notif.read && onRead(notif.id)}
      onKeyDown={(e) => e.key === "Enter" && !notif.read && onRead(notif.id)}
      style={{
        display: "flex", alignItems: "flex-start", gap: 14,
        padding: "14px 18px", borderRadius: 12,
        background: notif.read
          ? C.surface
          : isLowBal
          ? "rgba(230,57,70,0.07)"
          : "rgba(212,175,55,0.05)",
        border: `1px solid ${notif.read ? C.border : isLowBal ? C.red + "33" : C.gold + "33"}`,
        opacity: notif.read ? 0.55 : 1,
        cursor: notif.read ? "default" : "pointer",
        userSelect: "none",
        animationDelay: `${delay * 0.05}s`,
      }}>

      {/* Icon */}
      <div style={{
        width: 38, height: 38, borderRadius: 10, flexShrink: 0,
        background: cfg.bg, border: `1px solid ${cfg.color}33`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Ic d={cfg.icon} s={17} c={cfg.color} />
      </div>

      {/* Body */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{
            fontFamily: "DM Sans, sans-serif", fontSize: 10, fontWeight: 700,
            textTransform: "uppercase", letterSpacing: "0.7px",
            color: notif.read ? C.textMuted : cfg.color,
          }}>{cfg.label}</span>
          <span style={{ fontFamily: "DM Sans, sans-serif", fontSize: 11, color: C.textMuted, flexShrink: 0 }}>
            {timeAgo(notif.createdAt)}
          </span>
        </div>
        <p style={{
          fontFamily: "DM Sans, sans-serif", fontSize: 13.5, lineHeight: 1.52,
          color: notif.read ? C.textSec : C.text, margin: 0,
        }}>{notif.message}</p>
        {notif.meta && (
          <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 11, color: C.textMuted, margin: "4px 0 0" }}>
            {notif.meta}
          </p>
        )}
        {isLowBal && !notif.read && (
          <a href="/admin/wallet" style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            marginTop: 9, padding: "4px 10px", borderRadius: 6,
            background: C.redMuted, border: `1px solid ${C.red}30`,
            fontFamily: "DM Sans, sans-serif", fontSize: 11, fontWeight: 700,
            color: C.red, textDecoration: "none",
          }}>
            <Ic d={D.wallet} s={11} c={C.red} /> Recharge wallet →
          </a>
        )}
      </div>

      {/* Unread dot */}
      {!notif.read && (
        <span style={{
          width: 8, height: 8, borderRadius: "50%",
          background: isLowBal ? C.red : C.gold,
          flexShrink: 0, marginTop: 5,
        }} />
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════════════════
export const NotificationsCenter = () => {
  const { currentUser } = useAuth();
  const [notifs,     setNotifs]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [activeTab,  setActiveTab]  = useState("all");
  const [markingAll, setMarkingAll] = useState(false);
  const [toast, showToast]          = useToast();

  // Real-time listener — scoped to currentUser.uid
  useEffect(() => {
    if (!currentUser?.uid) return;
    const q = query(
      collection(db, COLLECTIONS.NOTIFICATIONS),
      where("userId", "==", currentUser.uid),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q,
      (snap) => { setNotifs(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); setLoading(false); },
      ()      => setLoading(false)
    );
    return () => unsub();
  }, [currentUser?.uid]);

  const markRead = async (id) => {
    try {
      await updateDoc(doc(db, COLLECTIONS.NOTIFICATIONS, id), { read: true });
    } catch {
      showToast("Could not mark as read", "error");
    }
  };

  const markAllRead = async () => {
    const unread = filtered.filter((n) => !n.read);
    if (!unread.length) return;
    setMarkingAll(true);
    try {
      const batch = writeBatch(db);
      unread.forEach((n) =>
        batch.update(doc(db, COLLECTIONS.NOTIFICATIONS, n.id), { read: true })
      );
      await batch.commit();
      showToast(`Marked ${unread.length} as read`);
    } catch {
      showToast("Failed to mark all as read", "error");
    } finally {
      setMarkingAll(false);
    }
  };

  const filtered       = activeTab === "all" ? notifs : notifs.filter((n) => n.type === activeTab);
  const totalUnread    = notifs.filter((n) => !n.read).length;
  const filtUnread     = filtered.filter((n) => !n.read).length;
  const hasLowBal      = notifs.some((n) => n.type === "low_balance" && !n.read);
  const tabCount = (k) => k === "all" ? totalUnread : notifs.filter((n) => n.type === k && !n.read).length;
  const unreadRows     = filtered.filter((n) => !n.read);
  const readRows       = filtered.filter((n) => n.read);

  return (
    <div style={{
      minHeight: "100vh", background: C.bg,
      fontFamily: "DM Sans, sans-serif",
      padding: "28px 20px 64px",
      maxWidth: 760, margin: "0 auto",
    }}>

      {/* Header */}
      <div className="nc-header" style={{
        display: "flex", alignItems: "flex-start",
        justifyContent: "space-between", gap: 14, marginBottom: 22,
      }}>
        <div>
          <h1 style={{
            fontFamily: "Playfair Display, serif", fontWeight: 700,
            fontSize: 22, color: C.text, margin: 0, letterSpacing: "-.3px",
          }}>Notifications</h1>
          <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 13, color: C.textSec, margin: "4px 0 0" }}>
            {loading ? "Loading…" : totalUnread > 0
              ? `${totalUnread} unread notification${totalUnread !== 1 ? "s" : ""}`
              : "You're all caught up"}
          </p>
        </div>

        {filtUnread > 0 && (
          <button className="nc-mark"
            disabled={markingAll}
            onClick={markAllRead}
            style={{
              display: "flex", alignItems: "center", gap: 7,
              padding: "9px 16px", minHeight: 44, borderRadius: 8,
              border: `1px solid ${C.border}`, background: "transparent",
              color: C.textSec, fontFamily: "DM Sans, sans-serif",
              fontSize: 12, fontWeight: 600,
              cursor: markingAll ? "not-allowed" : "pointer",
              opacity: markingAll ? 0.5 : 1, whiteSpace: "nowrap",
            }}>
            <Ic d={D.checkAll} s={14} c="currentColor" />
            {markingAll ? "Marking…" : "Mark all read"}
          </button>
        )}
      </div>

      {/* Low-balance banner */}
      {hasLowBal && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "12px 16px", borderRadius: 10, marginBottom: 20,
          background: C.redMuted, border: `1px solid ${C.red}44`,
        }}>
          <Ic d={D.alert} s={16} c={C.red} />
          <span style={{ fontFamily: "DM Sans, sans-serif", fontSize: 13, fontWeight: 600, color: C.red, flex: 1 }}>
            Wallet balance is low — calling will stop when balance drops below ₹5.
          </span>
          <a href="/admin/wallet" style={{
            fontFamily: "DM Sans, sans-serif", fontSize: 12, fontWeight: 700,
            color: "#000", background: C.red, padding: "6px 14px",
            borderRadius: 7, textDecoration: "none", minHeight: 32,
            display: "flex", alignItems: "center", whiteSpace: "nowrap",
          }}>Recharge now</a>
        </div>
      )}

      {/* Tabs */}
      <div className="nc-tabs" style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
        {TABS.map((tab) => {
          const active = activeTab === tab.key;
          const count  = tabCount(tab.key);
          return (
            <button key={tab.key} className="nc-tab"
              onClick={() => setActiveTab(tab.key)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "7px 14px", minHeight: 36, borderRadius: 8,
                border: `1px solid ${active ? C.gold + "55" : C.border}`,
                background: active ? C.goldMuted : C.surface,
                color: active ? C.gold : C.textSec,
                fontFamily: "DM Sans, sans-serif", fontSize: 12, fontWeight: 600,
                whiteSpace: "nowrap",
              }}>
              <Ic d={tab.icon} s={13} c={active ? C.gold : C.textSec} />
              {tab.label}
              {count > 0 && (
                <span style={{
                  minWidth: 18, height: 18, borderRadius: 9, padding: "0 5px",
                  background: active ? C.gold : C.border,
                  color: active ? "#000" : C.textSec,
                  fontFamily: "DM Sans, sans-serif", fontSize: 10, fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Body */}
      {loading ? (
        <Skeleton />
      ) : filtered.length === 0 ? (
        <EmptyState tab={activeTab} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {unreadRows.length > 0 && (
            <>
              <SectionLabel label="Unread" dot={C.gold} />
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: readRows.length ? 24 : 0 }}>
                {unreadRows.map((n, i) => <NotifRow key={n.id} notif={n} onRead={markRead} delay={i} />)}
              </div>
            </>
          )}
          {readRows.length > 0 && (
            <>
              <SectionLabel label="Earlier" dot={C.border} />
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {readRows.map((n, i) => <NotifRow key={n.id} notif={n} onRead={markRead} delay={i} />)}
              </div>
            </>
          )}
        </div>
      )}

      <Toast t={toast} />
    </div>
  );
};

export default NotificationsCenter;
