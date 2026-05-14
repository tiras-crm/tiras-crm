// TIRAS CRM — useLeads Hook
// Fetches leads from Firestore scoped automatically by the logged-in user's role
//
// Role behaviour (from master doc Section 6):
//   platform_owner  → all leads across all companies (use sparingly — high read cost)
//   company_admin   → all leads in their company
//   manager         → all leads in their company (sees full team)
//   agent           → only leads assigned to them (assignedTo == uid)
//   support_agent   → all leads in their company (needs context for tickets)

import { useState, useEffect, useCallback, useRef } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  getDocs,
  startAfter,
  getCountFromServer,
} from "firebase/firestore";
import { db, COLLECTIONS, ROLES } from "../firebase";
import { useAuth } from "../contexts/AuthContext";

// Default page size for paginated queries
const DEFAULT_PAGE_SIZE = 50;

const useLeads = (options = {}) => {
  const {
    pageSize     = DEFAULT_PAGE_SIZE,
    sortField    = "createdAt",
    sortDir      = "desc",
    stageFilter  = null,    // Filter by pipeline stage e.g. "Interested"
    sourceFilter = null,    // Filter by lead source e.g. "IndiaMART"
    agentFilter  = null,    // Manager filtering by specific agent uid
    searchTerm   = null,    // Not used in Firestore query — filtered client-side
    realtime     = true,    // true = onSnapshot, false = one-time getDocs
  } = options;

  const { currentUser, role, companyId } = useAuth();

  const [leads,       setLeads]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [totalCount,  setTotalCount]  = useState(0);
  const [hasMore,     setHasMore]     = useState(false);
  const [lastDoc,     setLastDoc]     = useState(null);

  // Store unsubscribe function for cleanup
  const unsubscribeRef = useRef(null);

  // ── Build Firestore query based on role ─────────────────────────────────────

  const buildQuery = useCallback((pageCursor = null) => {
    if (!currentUser?.uid || !role) return null;

    const leadsRef = collection(db, COLLECTIONS.LEADS);
    const constraints = [];

    // ── Role-based scoping ───────────────────────────────────────────────────

    switch (role) {
      case ROLES.PLATFORM_OWNER:
        // Platform owner sees all leads — no companyId filter
        // Only used in Company Detail View — always pass stageFilter or agentFilter
        break;

      case ROLES.COMPANY_ADMIN:
        constraints.push(where("companyId", "==", companyId));
        break;

      case ROLES.MANAGER:
        // Manager sees all leads in their company
        // They can also filter by a specific agent using agentFilter
        constraints.push(where("companyId", "==", companyId));
        if (agentFilter) {
          constraints.push(where("assignedTo", "==", agentFilter));
        }
        break;

      case ROLES.AGENT:
        // Agent sees ONLY their own assigned leads — enforced here AND in Firestore rules
        constraints.push(where("companyId",  "==", companyId));
        constraints.push(where("assignedTo", "==", currentUser.uid));
        break;

      case ROLES.SUPPORT_AGENT:
        // Support agent needs company leads for ticket context
        constraints.push(where("companyId", "==", companyId));
        break;

      default:
        return null;
    }

    // ── Optional filters ─────────────────────────────────────────────────────

    if (stageFilter) {
      constraints.push(where("stage", "==", stageFilter));
    }

    if (sourceFilter) {
      constraints.push(where("source", "==", sourceFilter));
    }

    // ── Sorting and pagination ───────────────────────────────────────────────

    constraints.push(orderBy(sortField, sortDir));
    constraints.push(limit(pageSize));

    if (pageCursor) {
      constraints.push(startAfter(pageCursor));
    }

    return query(leadsRef, ...constraints);
  }, [currentUser?.uid, role, companyId, stageFilter, sourceFilter, agentFilter, sortField, sortDir, pageSize]);

  // ── Subscribe or fetch leads ─────────────────────────────────────────────────

  const subscribe = useCallback(() => {
    const q = buildQuery();
    if (!q) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    if (realtime) {
      // Real-time listener — auto-updates when Firestore changes
      const unsub = onSnapshot(
        q,
        (snapshot) => {
          const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
          setLeads(items);
          setHasMore(items.length === pageSize);
          setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null);
          setLoading(false);
        },
        (err) => {
          console.error("TIRAS useLeads: Snapshot error:", err);
          setError(err.message);
          setLoading(false);
        }
      );
      unsubscribeRef.current = unsub;
    } else {
      // One-time fetch — used for reports and exports
      getDocs(q)
        .then((snapshot) => {
          const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
          setLeads(items);
          setHasMore(items.length === pageSize);
          setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null);
          setLoading(false);
        })
        .catch((err) => {
          console.error("TIRAS useLeads: getDocs error:", err);
          setError(err.message);
          setLoading(false);
        });
    }
  }, [buildQuery, realtime, pageSize]);

  // ── Initial load and re-subscribe on filter change ───────────────────────────

  useEffect(() => {
    // Clean up previous listener before creating a new one
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    setLeads([]);
    setLastDoc(null);
    setHasMore(false);
    subscribe();

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [subscribe]);

  // ── loadMore — pagination ────────────────────────────────────────────────────
  // Fetches next page and appends to existing leads list

  const loadMore = useCallback(async () => {
    if (!hasMore || !lastDoc || loading) return;

    const q = buildQuery(lastDoc);
    if (!q) return;

    setLoading(true);

    try {
      const snapshot = await getDocs(q);
      const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

      setLeads((prev) => {
        // Deduplicate by id in case of real-time overlap
        const existingIds = new Set(prev.map((l) => l.id));
        const newItems = items.filter((l) => !existingIds.has(l.id));
        return [...prev, ...newItems];
      });

      setHasMore(items.length === pageSize);
      setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null);
    } catch (err) {
      console.error("TIRAS useLeads: loadMore error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [hasMore, lastDoc, loading, buildQuery, pageSize]);

  // ── refetch — manual refresh ─────────────────────────────────────────────────

  const refetch = useCallback(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    setLeads([]);
    setLastDoc(null);
    setHasMore(false);
    subscribe();
  }, [subscribe]);

  // ── clientSearch — filters loaded leads by search term ───────────────────────
  // Firestore doesn't support full-text search — filter client-side on loaded data
  // Searches: name, phone, email, company

  const clientSearch = useCallback(
    (term) => {
      if (!term || !term.trim()) return leads;

      const lower = term.toLowerCase().trim();
      return leads.filter((lead) => {
        return (
          lead.name?.toLowerCase().includes(lower)     ||
          lead.phone?.includes(lower)                   ||
          lead.email?.toLowerCase().includes(lower)     ||
          lead.company?.toLowerCase().includes(lower)
        );
      });
    },
    [leads]
  );

  // ── getLeadsByStage — groups leads by pipeline stage ────────────────────────
  // Used by Kanban board — returns { [stage]: Lead[] }

  const getLeadsByStage = useCallback(
    (stages = []) => {
      const grouped = {};

      stages.forEach((stage) => {
        grouped[stage] = [];
      });

      leads.forEach((lead) => {
        const stage = lead.stage || "New";
        if (!grouped[stage]) grouped[stage] = [];
        grouped[stage].push(lead);
      });

      return grouped;
    },
    [leads]
  );

  // ── getStats — summary counts derived from loaded leads ──────────────────────

  const getStats = useCallback(() => {
    const total    = leads.length;
    const hot      = leads.filter((l) => l.temperature === "Hot").length;
    const warm     = leads.filter((l) => l.temperature === "Warm").length;
    const cold     = leads.filter((l) => l.temperature === "Cold").length;
    const dead     = leads.filter((l) => l.temperature === "Dead").length;
    const closedWon  = leads.filter((l) => l.stage === "Closed Won").length;
    const closedLost = leads.filter((l) => l.stage === "Closed Lost").length;
    const pipelineValue = leads
      .filter((l) => l.stage !== "Closed Won" && l.stage !== "Closed Lost")
      .reduce((sum, l) => sum + (l.dealValue || 0), 0);

    return { total, hot, warm, cold, dead, closedWon, closedLost, pipelineValue };
  }, [leads]);

  return {
    // Data
    leads,
    loading,
    error,
    totalCount,
    hasMore,

    // Actions
    loadMore,
    refetch,

    // Helpers
    clientSearch,
    getLeadsByStage,
    getStats,
  };
};

export default useLeads;
