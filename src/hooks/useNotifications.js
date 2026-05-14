// TIRAS CRM — useNotifications Hook
// Subscribes to Firestore notifications in real-time for the logged-in user
// Used by Navbar to show unread count badge and Notifications Center page

import { useState, useEffect, useCallback } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  doc,
  updateDoc,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { db, COLLECTIONS } from "../firebase";
import { useAuth } from "../contexts/AuthContext";

// How many notifications to load at once — keeps Firestore reads low
const NOTIFICATION_LIMIT = 50;

const useNotifications = () => {
  const { currentUser, companyId } = useAuth();

  const [notifications, setNotifications]   = useState([]);
  const [unreadCount,   setUnreadCount]      = useState(0);
  const [loading,       setLoading]          = useState(true);
  const [error,         setError]            = useState(null);

  // ── Real-time subscription ─────────────────────────────────────────────────
  // Listens for notifications where recipientUid == currentUser.uid
  // Ordered by newest first — unread count derived from the result

  useEffect(() => {
    if (!currentUser?.uid) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const q = query(
      collection(db, COLLECTIONS.NOTIFICATIONS),
      where("recipientUid", "==", currentUser.uid),
      orderBy("createdAt", "desc"),
      limit(NOTIFICATION_LIMIT)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        setNotifications(items);
        setUnreadCount(items.filter((n) => !n.isRead).length);
        setLoading(false);
      },
      (err) => {
        console.error("TIRAS useNotifications: Snapshot error:", err);
        setError(err.message);
        setLoading(false);
      }
    );

    // Cleanup listener when user logs out or component unmounts
    return () => unsubscribe();
  }, [currentUser?.uid]);

  // ── markAsRead ─────────────────────────────────────────────────────────────
  // Marks a single notification as read
  // Called when user clicks a notification item

  const markAsRead = useCallback(async (notificationId) => {
    if (!notificationId) return;

    try {
      await updateDoc(doc(db, COLLECTIONS.NOTIFICATIONS, notificationId), {
        isRead: true,
        readAt: serverTimestamp(),
      });
    } catch (err) {
      console.error("TIRAS useNotifications: markAsRead error:", err);
    }
  }, []);

  // ── markAllRead ────────────────────────────────────────────────────────────
  // Marks all unread notifications as read in a single Firestore batch
  // Called from "Mark all as read" button in Notifications Center

  const markAllRead = useCallback(async () => {
    const unread = notifications.filter((n) => !n.isRead);
    if (unread.length === 0) return;

    try {
      // Firestore batch max 500 writes — safe for NOTIFICATION_LIMIT = 50
      const batch = writeBatch(db);

      unread.forEach((n) => {
        const ref = doc(db, COLLECTIONS.NOTIFICATIONS, n.id);
        batch.update(ref, {
          isRead: true,
          readAt: serverTimestamp(),
        });
      });

      await batch.commit();
    } catch (err) {
      console.error("TIRAS useNotifications: markAllRead error:", err);
    }
  }, [notifications]);

  // ── getByType ──────────────────────────────────────────────────────────────
  // Filter helper — returns notifications of a specific type
  // Types: "followup_reminder" | "followup_overdue" | "ai_summary_ready" |
  //        "payment_received" | "new_ticket" | "ticket_escalated" | "new_lead_assigned"

  const getByType = useCallback(
    (type) => notifications.filter((n) => n.type === type),
    [notifications]
  );

  // ── getUnread ──────────────────────────────────────────────────────────────

  const getUnread = useCallback(
    () => notifications.filter((n) => !n.isRead),
    [notifications]
  );

  // ── getIcon ────────────────────────────────────────────────────────────────
  // Returns an emoji icon per notification type — used in notification list items

  const getNotificationIcon = (type) => {
    const map = {
      followup_reminder:       "🔔",
      followup_overdue:        "⚠️",
      followup_escalated:      "🚨",
      ai_summary_ready:        "🤖",
      payment_received:        "💰",
      payment_received_admin:  "💰",
      new_ticket:              "🎫",
      ticket_escalated:        "🚨",
      new_lead_assigned:       "👤",
      call_recording_ready:    "📞",
    };
    return map[type] || "🔔";
  };

  return {
    // Data
    notifications,
    unreadCount,
    loading,
    error,

    // Actions
    markAsRead,
    markAllRead,

    // Helpers
    getByType,
    getUnread,
    getNotificationIcon,
  };
};

export default useNotifications;
