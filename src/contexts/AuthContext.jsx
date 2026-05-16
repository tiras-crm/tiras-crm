// TIRAS CRM V2 — AuthContext
// Provides: currentUser, userProfile, role, companyId, companyData (wallet, subscription),
//           subscriptionStatus, trialEndDate, isTrialExpired, isSubscriptionActive
// Import ALWAYS from: ../contexts/AuthContext — never from ../hooks/useAuth

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "firebase/auth";
import {
  doc,
  getDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db, COLLECTIONS, ROLES } from "../firebase";

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};

// ─── AuthProvider ─────────────────────────────────────────────────────────────

export const AuthProvider = ({ children }) => {
  // ── Auth state ─────────────────────────────────────────────────────────────
  const [currentUser,    setCurrentUser]    = useState(null);   // Firebase Auth user
  const [userProfile,    setUserProfile]    = useState(null);   // Firestore users/{uid}
  const [role,           setRole]           = useState(null);   // Role string
  const [companyId,      setCompanyId]      = useState(null);   // companyId from user doc

  // ── Company state (real-time) ──────────────────────────────────────────────
  const [companyData,       setCompanyData]       = useState(null);   // Full company doc
  const [subscriptionStatus,setSubscriptionStatus] = useState(null);  // trial|active|expired|suspended
  const [trialEndDate,      setTrialEndDate]       = useState(null);  // JS Date | null

  // ── Loading ────────────────────────────────────────────────────────────────
  const [authLoading,    setAuthLoading]    = useState(true);   // Auth resolver running
  const [companyLoading, setCompanyLoading] = useState(false);  // Company doc loading

  // ── Company unsubscribe ref ────────────────────────────────────────────────
  const [companyUnsub, setCompanyUnsub] = useState(null);

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPUTED BOOLEANS
  // ═══════════════════════════════════════════════════════════════════════════

  // True if trial has ended by date (regardless of subscriptionStatus field)
  const isTrialExpired = (() => {
    if (!trialEndDate) return false;
    if (subscriptionStatus !== "trial") return false;
    return new Date() > trialEndDate;
  })();

  // True if user can access the app normally (not expired/suspended)
  // Platform Owner bypasses subscription checks — always active
  const isSubscriptionActive = (() => {
    if (role === ROLES.PLATFORM_OWNER) return true;
    if (!subscriptionStatus) return false;
    if (subscriptionStatus === "active") return true;
    if (subscriptionStatus === "trial" && !isTrialExpired) return true;
    return false;
  })();

  // Days remaining in trial (0 if expired)
  const trialDaysRemaining = (() => {
    if (!trialEndDate || subscriptionStatus !== "trial") return null;
    const diff = trialEndDate - new Date();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  })();

  // Wallet balance shortcut
  const walletBalance = companyData?.wallet?.balance ?? null;

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPANY REAL-TIME LISTENER
  // ═══════════════════════════════════════════════════════════════════════════

  const subscribeToCompany = useCallback((cid) => {
    if (!cid) return;

    setCompanyLoading(true);

    const unsub = onSnapshot(
      doc(db, COLLECTIONS.COMPANIES, cid),
      (snap) => {
        if (!snap.exists()) {
          setCompanyData(null);
          setSubscriptionStatus(null);
          setTrialEndDate(null);
          setCompanyLoading(false);
          return;
        }

        const data = { id: snap.id, ...snap.data() };
        setCompanyData(data);

        // Subscription status
        setSubscriptionStatus(data.subscriptionStatus || null);

        // Trial end date — convert Firestore Timestamp to JS Date
        if (data.trialEndDate?.toDate) {
          setTrialEndDate(data.trialEndDate.toDate());
        } else if (data.trialEndDate instanceof Date) {
          setTrialEndDate(data.trialEndDate);
        } else {
          setTrialEndDate(null);
        }

        setCompanyLoading(false);
      },
      (err) => {
        console.error("TIRAS AuthContext: Company snapshot error:", err);
        setCompanyLoading(false);
      }
    );

    setCompanyUnsub(() => unsub);
    return unsub;
  }, []);

  // Cleanup company listener
  const unsubscribeCompany = useCallback(() => {
    if (companyUnsub) {
      companyUnsub();
      setCompanyUnsub(null);
    }
  }, [companyUnsub]);

  // ═══════════════════════════════════════════════════════════════════════════
  // USER PROFILE FETCH
  // ═══════════════════════════════════════════════════════════════════════════

  const fetchUserProfile = useCallback(async (firebaseUser) => {
    try {
      const userRef  = doc(db, COLLECTIONS.USERS, firebaseUser.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        console.error("TIRAS AuthContext: No Firestore profile for uid:", firebaseUser.uid);
        await signOut(auth);
        setAuthLoading(false);
        return;
      }

      const profile = { id: userSnap.id, ...userSnap.data() };

      // Block deactivated accounts
      if (profile.isActive === false) {
        await signOut(auth);
        setAuthLoading(false);
        return;
      }

      // Update last login (non-blocking)
      updateDoc(userRef, { lastLoginAt: serverTimestamp() }).catch(() => {});

      setUserProfile(profile);
      setRole(profile.role || null);
      setCompanyId(profile.companyId || null);

      // Subscribe to company document if user belongs to one
      if (profile.companyId) {
        subscribeToCompany(profile.companyId);
      } else {
        // Platform owner has no companyId — mark subscription as active
        setSubscriptionStatus("active");
        setCompanyLoading(false);
      }

    } catch (err) {
      console.error("TIRAS AuthContext: fetchUserProfile error:", err);
    } finally {
      setAuthLoading(false);
    }
  }, [subscribeToCompany]);

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTH STATE LISTENER
  // ═══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setCurrentUser(firebaseUser);
        await fetchUserProfile(firebaseUser);
      } else {
        // Signed out — clear everything
        setCurrentUser(null);
        setUserProfile(null);
        setRole(null);
        setCompanyId(null);
        setCompanyData(null);
        setSubscriptionStatus(null);
        setTrialEndDate(null);
        unsubscribeCompany();
        setAuthLoading(false);
      }
    });

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTH ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  // Login — email/password only (no phone OTP — master doc rule)
  const login = async (email, password) => {
    const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
    return credential;
  };

  // Logout — clears all state and company listener
  const logout = useCallback(async () => {
    unsubscribeCompany();
    await signOut(auth);
    setCurrentUser(null);
    setUserProfile(null);
    setRole(null);
    setCompanyId(null);
    setCompanyData(null);
    setSubscriptionStatus(null);
    setTrialEndDate(null);
  }, [unsubscribeCompany]);

  // Password reset email
  const resetPassword = async (email) => {
    await sendPasswordResetEmail(auth, email.trim());
  };

  // Update display name
  const updateDisplayName = async (name) => {
    if (!currentUser) throw new Error("No user logged in");
    await updateProfile(currentUser, { displayName: name });
    await updateDoc(doc(db, COLLECTIONS.USERS, currentUser.uid), { displayName: name });
    setUserProfile((prev) => ({ ...prev, displayName: name }));
  };

  // Change password (requires re-auth)
  const changePassword = async (currentPassword, newPassword) => {
    if (!currentUser) throw new Error("No user logged in");
    const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
    await reauthenticateWithCredential(currentUser, credential);
    await updatePassword(currentUser, newPassword);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // ROLE HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  const isPlatformOwner = role === ROLES.PLATFORM_OWNER;
  const isCompanyAdmin  = role === ROLES.COMPANY_ADMIN;
  const isManager       = role === ROLES.MANAGER;
  const isAgent         = role === ROLES.AGENT;
  const isSupportAgent  = role === ROLES.SUPPORT_AGENT;

  const canSeeAllCompanyData = isPlatformOwner || isCompanyAdmin;
  const canManageAgents      = isPlatformOwner || isCompanyAdmin || isManager;
  const canSeeWallet         = isCompanyAdmin || isManager;   // Agents see nothing

  // Default route per role — used by SmartRoot after login
  const getDefaultRoute = useCallback(() => {
    switch (role) {
      case ROLES.PLATFORM_OWNER: return "/platform/dashboard";
      case ROLES.COMPANY_ADMIN:  return "/admin/dashboard";
      case ROLES.MANAGER:        return "/manager/dashboard";
      case ROLES.AGENT:          return "/agent/dashboard";
      case ROLES.SUPPORT_AGENT:  return "/agent/dashboard";
      default:                   return "/login";
    }
  }, [role]);

  // ═══════════════════════════════════════════════════════════════════════════
  // CONTEXT VALUE
  // ═══════════════════════════════════════════════════════════════════════════

  const value = {
    // Auth state
    currentUser,
    userProfile,
    role,
    companyId,

    // Company state (real-time)
    companyData,
    subscriptionStatus,
    trialEndDate,
    walletBalance,

    // Loading
    authLoading,
    companyLoading,
    loading: authLoading,       // Alias for backward compat with V1 components

    // Computed booleans
    isTrialExpired,
    isSubscriptionActive,
    trialDaysRemaining,

    // Role booleans
    isPlatformOwner,
    isCompanyAdmin,
    isManager,
    isAgent,
    isSupportAgent,
    canSeeAllCompanyData,
    canManageAgents,
    canSeeWallet,

    // Actions
    login,
    logout,
    resetPassword,
    updateDisplayName,
    changePassword,

    // Helpers
    getDefaultRoute,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
