import { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  writeBatch,
  getDocs,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";

// ── Icon primitives ──────────────────────────────────────────────────────────
const Icon = ({ d, size = 18, color = "currentColor", ...rest }) => (
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
    {...rest}
  >
    <path d={d} />
  </svg>
);

const ICONS = {
  bell:       "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0",
  check:      "M20 6L9 17l-5-5",
  checkAll:   "M2 12l5 5L22 4M9 17l-5-5",
  phone:      "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13 19.79 19.79 0 0 1 1.61 4.37 2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.18 6.18l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 17v-.08z",
  userPlus:   "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M12 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM19 8v6M22 11h-6",
  ticket:     "M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z",
  calendar:   "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 0 2-2z",
  mic:        "M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8",
  dollar:     "M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  inbox:      "M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z",
  chevronRight: "M9 18l6-6-6-6",
};

// ── Category config ──────────────────────────────────────────────────────────
const CATEGORIES = {
  all:            { label: "All",          icon: ICONS.bell },
  follow_up:      { label: "Follow-ups",   icon: ICONS.calendar },
  lead_assigned:  { label: "Leads",        icon: ICONS.userPlus },
  ticket_update:  { label: "Tickets",      icon: ICONS.ticket },
  recording_ready:{ label: "Recordings",   icon: ICONS.mic },
  payment:        { label: "Payments",     icon: ICONS.dollar },
};

function categoryIcon(type) {
  switch (type) {
    case "follow_up":       return ICONS.calendar;
    case "lead_assigned":   return ICONS.userPlus;
    case "ticket_update":   return ICONS.ticket;
    case "recording_ready": return ICONS.mic;
    case "payment":         return ICONS.dollar;
    default:                return ICONS.bell;
  }
}

function categoryColor(type) {
  switch (type) {
    case "follow_up":       return "#F2A65A";
    case "lead_assigned":   return "#5AB4F2";
    case "ticket_update":   return "#E05C5C";
    case "recording_ready": return "#7DD87D";
    case "payment":         return "#B65E3C";
    default:                return "#AAAAAA";
  }
}

function timeAgo(ts) {
  if (!ts) return "";
  const date = ts?.toDate ? ts.toDate() : new Date(ts);
  const diff = Math.floor((Date.now() - date) / 1000);
  if (diff < 60)  return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ── Main Component ───────────────────────────────────────────────────────────
export const NotificationsCenter = () => {
  const { currentUser } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("all");
  const [markingAll, setMarkingAll] = useState(false);

  // ── Real-time listener ───────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUser?.uid) return;

    const q = query(
      collection(db, "notifications"),
      where("userId", "==", currentUser.uid),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(q, (snap) => {
      setNotifications(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    return () => unsub();
  }, [currentUser?.uid]);

  // ── Mark single as read ──────────────────────────────────────────────────
  const markRead = async (notifId) => {
    await updateDoc(doc(db, "notifications", notifId), { read: true });
  };

  // ── Mark all as read ─────────────────────────────────────────────────────
  const markAllRead = async () => {
    const unread = filtered.filter((n) => !n.read);
    if (!unread.length) return;
    setMarkingAll(true);
    try {
      const batch = writeBatch(db);
      unread.forEach((n) => batch.update(doc(db, "notifications", n.id), { read: true }));
      await batch.commit();
    } finally {
      setMarkingAll(false);
    }
  };

  // ── Filtered list ────────────────────────────────────────────────────────
  const filtered =
    activeCategory === "all"
      ? notifications
      : notifications.filter((n) => n.type === activeCategory);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const filteredUnread = filtered.filter((n) => !n.read).length;

  return (
    <div style={styles.page}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.headerIconWrap}>
            <Icon d={ICONS.bell} size={20} color="#F2A65A" />
          </div>
          <div>
            <h1 style={styles.title}>Notifications</h1>
            <p style={styles.subtitle}>
              {unreadCount > 0
                ? `${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}`
                : "You're all caught up"}
            </p>
          </div>
        </div>

        {unreadCount > 0 && (
          <button
            style={{ ...styles.markAllBtn, ...(markingAll ? styles.markAllBtnDisabled : {}) }}
            onClick={markAllRead}
            disabled={markingAll}
          >
            <Icon d={ICONS.checkAll} size={15} />
            {markingAll ? "Marking…" : "Mark all read"}
          </button>
        )}
      </div>

      {/* ── Category Tabs ───────────────────────────────────────────────── */}
      <div style={styles.tabs}>
        {Object.entries(CATEGORIES).map(([key, cat]) => {
          const count =
            key === "all"
              ? unreadCount
              : notifications.filter((n) => n.type === key && !n.read).length;
          const isActive = activeCategory === key;
          return (
            <button
              key={key}
              style={{
                ...styles.tab,
                ...(isActive ? styles.tabActive : styles.tabInactive),
              }}
              onClick={() => setActiveCategory(key)}
            >
              <Icon
                d={cat.icon}
                size={14}
                color={isActive ? "#F2A65A" : "#AAAAAA"}
              />
              <span>{cat.label}</span>
              {count > 0 && (
                <span
                  style={{
                    ...styles.tabBadge,
                    background: isActive ? "#B65E3C" : "#2A2420",
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <div style={styles.content}>
        {loading ? (
          <LoadingSkeleton />
        ) : filtered.length === 0 ? (
          <EmptyState category={activeCategory} />
        ) : (
          <div style={styles.list}>
            {/* Unread section */}
            {filteredUnread > 0 && (
              <>
                <div style={styles.sectionLabel}>
                  <span style={styles.sectionDot} />
                  Unread
                </div>
                {filtered
                  .filter((n) => !n.read)
                  .map((n) => (
                    <NotifCard key={n.id} notif={n} onRead={markRead} />
                  ))}
              </>
            )}

            {/* Read section */}
            {filtered.some((n) => n.read) && (
              <>
                <div style={{ ...styles.sectionLabel, marginTop: 24 }}>
                  <span style={{ ...styles.sectionDot, background: "#444" }} />
                  Earlier
                </div>
                {filtered
                  .filter((n) => n.read)
                  .map((n) => (
                    <NotifCard key={n.id} notif={n} onRead={markRead} />
                  ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ── NotifCard ────────────────────────────────────────────────────────────────
const NotifCard = ({ notif, onRead }) => {
  const [hovered, setHovered] = useState(false);
  const color = categoryColor(notif.type);
  const icon  = categoryIcon(notif.type);

  return (
    <div
      style={{
        ...styles.card,
        background: notif.read
          ? "#1A1A1A"
          : hovered
          ? "#201A16"
          : "#1C1510",
        borderLeft: `3px solid ${notif.read ? "#2A2A2A" : color}`,
        cursor: notif.read ? "default" : "pointer",
        opacity: notif.read ? 0.65 : 1,
        transform: hovered && !notif.read ? "translateX(3px)" : "none",
        transition: "all 0.18s ease",
      }}
      onClick={() => !notif.read && onRead(notif.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Icon bubble */}
      <div
        style={{
          ...styles.cardIcon,
          background: `${color}1A`,
          border: `1px solid ${color}33`,
        }}
      >
        <Icon d={icon} size={16} color={color} />
      </div>

      {/* Body */}
      <div style={styles.cardBody}>
        <div style={styles.cardTopRow}>
          <span
            style={{
              ...styles.cardCategory,
              color: notif.read ? "#666" : color,
            }}
          >
            {CATEGORIES[notif.type]?.label ?? "Notification"}
          </span>
          <span style={styles.cardTime}>{timeAgo(notif.createdAt)}</span>
        </div>
        <p
          style={{
            ...styles.cardMessage,
            color: notif.read ? "#888" : "#F5F5F5",
          }}
        >
          {notif.message}
        </p>
        {notif.meta && (
          <p style={styles.cardMeta}>{notif.meta}</p>
        )}
      </div>

      {/* Unread dot */}
      {!notif.read && (
        <div style={{ ...styles.unreadDot, background: color }} />
      )}
    </div>
  );
};

// ── Empty State ──────────────────────────────────────────────────────────────
const EmptyState = ({ category }) => (
  <div style={styles.empty}>
    <div style={styles.emptyIconRing}>
      <Icon
        d={CATEGORIES[category]?.icon ?? ICONS.inbox}
        size={32}
        color="#B65E3C"
      />
    </div>
    <p style={styles.emptyTitle}>No notifications</p>
    <p style={styles.emptyText}>
      {category === "all"
        ? "You're all caught up. New alerts will appear here."
        : `No ${CATEGORIES[category]?.label.toLowerCase()} notifications yet.`}
    </p>
  </div>
);

// ── Loading Skeleton ─────────────────────────────────────────────────────────
const LoadingSkeleton = () => (
  <div style={styles.list}>
    {[...Array(5)].map((_, i) => (
      <div key={i} style={{ ...styles.card, background: "#1A1A1A", borderLeft: "3px solid #2A2A2A" }}>
        <div style={{ ...styles.cardIcon, background: "#222", border: "1px solid #2A2A2A" }} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ height: 10, width: "30%", background: "#252525", borderRadius: 4 }} />
          <div style={{ height: 13, width: "80%", background: "#222", borderRadius: 4 }} />
          <div style={{ height: 11, width: "55%", background: "#1E1E1E", borderRadius: 4 }} />
        </div>
      </div>
    ))}
  </div>
);

// ── Styles ───────────────────────────────────────────────────────────────────
const styles = {
  page: {
    minHeight: "100vh",
    background: "#121212",
    color: "#F5F5F5",
    fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
    padding: "32px 24px",
    maxWidth: 760,
    margin: "0 auto",
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 28,
    flexWrap: "wrap",
    gap: 12,
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 14,
  },
  headerIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: "#1E1510",
    border: "1px solid #B65E3C33",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  title: {
    margin: 0,
    fontSize: 22,
    fontWeight: 700,
    letterSpacing: "-0.3px",
    color: "#F5F5F5",
  },
  subtitle: {
    margin: "3px 0 0",
    fontSize: 13,
    color: "#AAAAAA",
  },
  markAllBtn: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    padding: "8px 16px",
    borderRadius: 8,
    border: "1px solid #B65E3C44",
    background: "#1A1008",
    color: "#F2A65A",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    transition: "all 0.15s",
    whiteSpace: "nowrap",
  },
  markAllBtnDisabled: {
    opacity: 0.5,
    cursor: "not-allowed",
  },
  tabs: {
    display: "flex",
    gap: 6,
    marginBottom: 24,
    overflowX: "auto",
    paddingBottom: 4,
    scrollbarWidth: "none",
  },
  tab: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "7px 14px",
    borderRadius: 8,
    border: "1px solid transparent",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    whiteSpace: "nowrap",
    transition: "all 0.15s",
    flexShrink: 0,
  },
  tabActive: {
    background: "#1E1510",
    border: "1px solid #B65E3C55",
    color: "#F2A65A",
  },
  tabInactive: {
    background: "#1A1A1A",
    color: "#AAAAAA",
  },
  tabBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 11,
    fontWeight: 700,
    color: "#F5F5F5",
    padding: "0 5px",
  },
  content: {
    marginTop: 4,
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  sectionLabel: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 11,
    fontWeight: 600,
    color: "#888",
    textTransform: "uppercase",
    letterSpacing: "0.8px",
    marginBottom: 8,
  },
  sectionDot: {
    width: 7,
    height: 7,
    borderRadius: "50%",
    background: "#F2A65A",
    flexShrink: 0,
  },
  card: {
    display: "flex",
    alignItems: "flex-start",
    gap: 14,
    padding: "14px 16px",
    borderRadius: 10,
    position: "relative",
    userSelect: "none",
  },
  cardIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  cardBody: {
    flex: 1,
    minWidth: 0,
  },
  cardTopRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
    gap: 8,
  },
  cardCategory: {
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.6px",
  },
  cardTime: {
    fontSize: 11,
    color: "#666",
    flexShrink: 0,
  },
  cardMessage: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.5,
  },
  cardMeta: {
    margin: "5px 0 0",
    fontSize: 12,
    color: "#888",
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    flexShrink: 0,
    marginTop: 6,
  },
  empty: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "80px 24px",
    textAlign: "center",
    gap: 14,
  },
  emptyIconRing: {
    width: 72,
    height: 72,
    borderRadius: "50%",
    background: "#1E1510",
    border: "1px solid #B65E3C33",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyTitle: {
    margin: 0,
    fontSize: 17,
    fontWeight: 600,
    color: "#F5F5F5",
  },
  emptyText: {
    margin: 0,
    fontSize: 14,
    color: "#888",
    maxWidth: 300,
    lineHeight: 1.6,
  },
};

export default NotificationsCenter;
