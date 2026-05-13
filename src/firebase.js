// TIRAS CRM — Firebase Configuration
// Replace ALL dummy values below with your real Firebase project config
// Get these from: Firebase Console → Project Settings → Your Apps → Web App → Config

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

// ─── REPLACE THESE VALUES WITH YOUR REAL FIREBASE CONFIG ───────────────────
const firebaseConfig = {
  apiKey: "AIzaSy-REPLACE-WITH-YOUR-REAL-API-KEY",
  authDomain: "tiras-crm-REPLACE.firebaseapp.com",
  projectId: "tiras-crm-REPLACE",
  storageBucket: "tiras-crm-REPLACE.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:REPLACE-WITH-YOUR-APP-ID",
};
// ───────────────────────────────────────────────────────────────────────────

// Initialize Firebase app
const app = initializeApp(firebaseConfig);

// Auth — email/password only (no phone OTP — costs ₹150-900/month at scale)
export const auth = getAuth(app);

// Firestore — main database for leads, users, tickets, calls, companies
export const db = getFirestore(app);

// Storage — stores call recordings, uploaded CSVs, invoice PDFs
export const storage = getStorage(app);

// Cloud Functions — serverless automation (TTL cleanup, AI triggers, escalation alerts)
export const functions = getFunctions(app, "asia-south1"); // Mumbai region — lowest latency for India

export default app;


// ─── FIRESTORE COLLECTION NAMES ────────────────────────────────────────────
// Centralised here so all files import from one place — change once, works everywhere

export const COLLECTIONS = {
  USERS: "users",                     // All user profiles + roles
  COMPANIES: "companies",             // All onboarded companies
  LEADS: "leads",                     // All leads (scoped by companyId)
  CALLS: "calls",                     // Call logs linked to leads
  TICKETS: "tickets",                 // Support tickets
  FOLLOW_UPS: "followups",            // Follow-up schedules per lead
  NOTIFICATIONS: "notifications",     // Per-user notification queue
  PAYMENTS: "payments",               // Payment records linked to leads
  WHATSAPP_TEMPLATES: "wa_templates", // Custom WhatsApp message templates per company
  PIPELINE_STAGES: "pipeline_stages", // Custom pipeline stages per company
};


// ─── FIRESTORE ROLE VALUES ─────────────────────────────────────────────────
// These strings are stored in users/{uid}/role in Firestore
// Must match exactly — AuthContext reads these to decide what each user can see

export const ROLES = {
  PLATFORM_OWNER: "platform_owner",   // Tony — sees all companies, all data
  COMPANY_ADMIN: "company_admin",     // Surya / business owner — his company only
  MANAGER: "manager",                 // Team lead — his agents only
  AGENT: "agent",                     // Sales caller — his own leads only
  SUPPORT_AGENT: "support_agent",     // Support team — assigned tickets only
};


// ─── FIRESTORE USER DOCUMENT SHAPE ────────────────────────────────────────
// Reference only — actual creation happens in AuthContext and onboarding flow
//
// users/{uid} = {
//   uid: string,
//   email: string,
//   displayName: string,
//   role: ROLES.*,
//   companyId: string | null,    // null only for platform_owner
//   managerId: string | null,    // set for agents — points to their manager uid
//   isActive: boolean,
//   createdAt: Timestamp,
//   lastLoginAt: Timestamp,
// }
