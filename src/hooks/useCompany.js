// TIRAS CRM V2 — useCompany Hook
// Real-time subscription to the company Firestore document
// Used by: WalletPage, UsagePage, AdminDashboard, CompanySettings, SubscribePage
//
// Returns everything a component needs about the company in one hook call:
//   company, walletBalance, subscriptionStatus, isTrialExpired,
//   isSubscriptionActive, trialDaysRemaining, planLimits, loading
//
// Platform Owner: returns null company — they see all companies separately
// All other roles: scoped to their companyId from AuthContext

import { useState, useEffect, useRef } from "react";
import { doc, onSnapshot }             from "firebase/firestore";
import { db, COLLECTIONS }             from "../firebase";
import { useAuth }                     from "../contexts/AuthContext";
import {
  getPlanLimits,
  getTrialDaysRemaining,
  isTrialExpiredByDate,
  isSubscriptionActive as checkSubscriptionActive,
  isCallingBlocked,
  isWalletLow,
  getWalletStatusColor,
  getWalletStatusLabel,
  formatWalletBalance,
  getMinutesFromBalance,
  getStorageUsagePercent,
  getDaysUntilRenewal,
} from "../utils/subscriptionUtils";

const useCompany = () => {
  const { currentUser, companyId, isPlatformOwner } = useAuth();

  const [company,     setCompany]     = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);

  const unsubRef = useRef(null);

  // ── Subscribe to company document ─────────────────────────────────────────

  useEffect(() => {
    // Platform owner sees all companies — no single company to subscribe to
    if (isPlatformOwner) {
      setCompany(null);
      setLoading(false);
      return;
    }

    if (!companyId) {
      setCompany(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsub = onSnapshot(
      doc(db, COLLECTIONS.COMPANIES, companyId),
      (snap) => {
        if (!snap.exists()) {
          setCompany(null);
          setError("Company not found. Contact support.");
          setLoading(false);
          return;
        }
        setCompany({ id: snap.id, ...snap.data() });
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("useCompany: Firestore snapshot error:", err);
        setError("Failed to load company data.");
        setLoading(false);
      }
    );

    unsubRef.current = unsub;

    return () => {
      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
      }
    };
  }, [companyId, isPlatformOwner]);

  // ── Derived values — computed fresh from company doc on every render ───────

  // Subscription
  const subscriptionStatus = company?.subscriptionStatus || null;
  const plan               = (company?.plan || "starter").toLowerCase();

  // Trial dates — convert Firestore Timestamp to JS Date
  const trialEndDate = (() => {
    if (!company?.trialEndDate) return null;
    return company.trialEndDate?.toDate
      ? company.trialEndDate.toDate()
      : new Date(company.trialEndDate);
  })();

  const subscriptionEndDate = (() => {
    if (!company?.subscriptionEndDate) return null;
    return company.subscriptionEndDate?.toDate
      ? company.subscriptionEndDate.toDate()
      : new Date(company.subscriptionEndDate);
  })();

  const isTrialExpired       = isTrialExpiredByDate(trialEndDate);
  const isSubscriptionActive = checkSubscriptionActive(subscriptionStatus, trialEndDate);
  const trialDaysRemaining   = getTrialDaysRemaining(trialEndDate);
  const daysUntilRenewal     = getDaysUntilRenewal(subscriptionEndDate);

  // Plan limits
  const planLimits = getPlanLimits(plan);

  // Wallet
  const walletBalance         = company?.wallet?.balance ?? 0;
  const walletFormatted       = formatWalletBalance(walletBalance);
  const walletColor           = getWalletStatusColor(walletBalance);
  const walletStatusLabel     = getWalletStatusLabel(walletBalance);
  const walletMinutesLeft     = getMinutesFromBalance(walletBalance);
  const callingBlocked        = isCallingBlocked(walletBalance);
  const walletLow             = isWalletLow(walletBalance);

  // Storage
  const storageUsedGB         = company?.storage?.usedGB   ?? 0;
  const storageLimitGB        = company?.storage?.limitGB  ?? planLimits.storageGB ?? 5;
  const storageUsedPercent    = getStorageUsagePercent(storageUsedGB, plan);
  const storageNearLimit      = storageUsedPercent >= 80;

  // Usage
  const minutesUsedThisMonth  = company?.minutesUsedThisMonth ?? 0;
  const callCostThisMonth     = minutesUsedThisMonth * 1.00;   // ₹1 per minute

  // Company meta
  const companyName           = company?.name || "";
  const companyGST            = company?.gstNumber || "";
  const companyCity           = company?.city || "";
  const companyIndustry       = company?.industry || "";

  // ── Refresh helper (for manual re-fetch in edge cases) ────────────────────
  // onSnapshot auto-updates so this is rarely needed —
  // exposed for pull-to-refresh on mobile

  const refetch = () => {
    if (!companyId || isPlatformOwner) return;

    if (unsubRef.current) unsubRef.current();

    setLoading(true);
    setError(null);

    const unsub = onSnapshot(
      doc(db, COLLECTIONS.COMPANIES, companyId),
      (snap) => {
        if (snap.exists()) {
          setCompany({ id: snap.id, ...snap.data() });
        } else {
          setCompany(null);
        }
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    unsubRef.current = unsub;
  };

  // ── Return ────────────────────────────────────────────────────────────────

  return {
    // Raw company document
    company,
    loading,
    error,

    // Identity
    companyName,
    companyGST,
    companyCity,
    companyIndustry,
    plan,

    // Subscription
    subscriptionStatus,
    isTrialExpired,
    isSubscriptionActive,
    trialDaysRemaining,
    trialEndDate,
    subscriptionEndDate,
    daysUntilRenewal,

    // Plan limits
    planLimits,
    // Individual limit shortcuts for convenience
    maxAgents:    planLimits.maxAgents,
    maxManagers:  planLimits.maxManagers,
    maxLeads:     planLimits.maxLeads,
    retentionDays:planLimits.retentionDays,

    // Wallet
    walletBalance,
    walletFormatted,
    walletColor,
    walletStatusLabel,
    walletMinutesLeft,
    callingBlocked,
    walletLow,

    // Storage
    storageUsedGB,
    storageLimitGB,
    storageUsedPercent,
    storageNearLimit,

    // Usage
    minutesUsedThisMonth,
    callCostThisMonth,

    // Actions
    refetch,
  };
};

export default useCompany;
