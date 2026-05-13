// TIRAS CRM — Authentication Context
// Handles: login state, current user profile, role detection from Firestore
// All components access auth state via useAuth() hook — never import auth directly

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
} from "firebase/auth";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { auth, db, ROLES } from "../firebase";

// ─── Context Setup ──────────────────────────────────────────────────────────

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
};

// ─── AuthProvider ───────────────────────────────────────────────────────────

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);   // Firebase Auth user object
  const [userProfile, setUserProfile] = useState(null);   // Firestore user document
  const [role, setRole] = useState(null);                 // Role string from Firestore
  const [companyId, setCompanyId] = useState(null);       // Company this user belongs to
  const [loading, setLoading] = useState(true);           // True until auth state resolved

  // ─── Login ────────────────────────────────────────────────────────────────

  const login = async (email, password) => {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    return credential;
  };

  // ─── Logout ───────────────────────────────────────────────────────────────

  const logout = async () => {
    await signOut(auth);
    setCurrentUser(null);
    setUserProfile(null);
    setRole(null);
    setCompanyId(null);
  };

  // ─── Password Reset ───────────────────────────────────────────────────────

  const resetPassword = async (email) => {
    await sendPasswordResetEmail(auth, email);
  };

  // ─── Fetch Firestore profile after Firebase Auth resolves ─────────────────

  const fetchUserProfile = async (firebaseUser) => {
    try {
      const userRef = doc(db, "users", firebaseUser.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        // User record missing in Firestore — log out and surface error
        console.error("TIRAS: No Firestore profile found for uid:", firebaseUser.uid);
        await signOut(auth);
        setLoading(false);
        return;
      }

      const profile = { id: userSnap.id, ...userSnap.data() };

      // Block deactivated accounts from logging in
      if (profile.isActive === false) {
        await signOut(auth);
        setLoading(false);
        throw new Error("Your account has been deactivated. Contact your admin.");
      }

      // Update last login timestamp
      await updateDoc(userRef, { lastLoginAt: serverTimestamp() });

      setUserProfile(profile);
      setRole(profile.role);
      setCompanyId(profile.companyId || null);
    } catch (err) {
      console.error("TIRAS: fetchUserProfile error:", err);
    } finally {
      setLoading(false);
    }
  };

  // ─── Auth State Listener ──────────────────────────────────────────────────

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setCurrentUser(firebaseUser);
        await fetchUserProfile(firebaseUser);
      } else {
        setCurrentUser(null);
        setUserProfile(null);
        setRole(null);
        setCompanyId(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // ─── Role Helper Booleans ─────────────────────────────────────────────────
  // Use these in components instead of comparing role strings directly

  const isPlatformOwner = role === ROLES.PLATFORM_OWNER;
  const isCompanyAdmin = role === ROLES.COMPANY_ADMIN;
  const isManager = role === ROLES.MANAGER;
  const isAgent = role === ROLES.AGENT;
  const isSupportAgent = role === ROLES.SUPPORT_AGENT;

  // Convenience: can this role see company-wide data?
  const canSeeAllCompanyData = isPlatformOwner || isCompanyAdmin;

  // Convenience: can this role manage agents?
  const canManageAgents = isPlatformOwner || isCompanyAdmin || isManager;

  // ─── Default Route Per Role ───────────────────────────────────────────────
  // Used by App.jsx to redirect after login

  const getDefaultRoute = () => {
    switch (role) {
      case ROLES.PLATFORM_OWNER:
        return "/platform/dashboard";
      case ROLES.COMPANY_ADMIN:
        return "/admin/dashboard";
      case ROLES.MANAGER:
        return "/manager/dashboard";
      case ROLES.AGENT:
        return "/agent/dashboard";
      case ROLES.SUPPORT_AGENT:
        return "/agent/dashboard";
      default:
        return "/login";
    }
  };

  // ─── Context Value ────────────────────────────────────────────────────────

  const value = {
    // State
    currentUser,
    userProfile,
    role,
    companyId,
    loading,

    // Actions
    login,
    logout,
    resetPassword,

    // Role booleans
    isPlatformOwner,
    isCompanyAdmin,
    isManager,
    isAgent,
    isSupportAgent,
    canSeeAllCompanyData,
    canManageAgents,

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
