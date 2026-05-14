import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAuVDfnBrdnGHeLG4VEjFNR9TxxMhh0S14",
  authDomain: "tiras-crm.firebaseapp.com",
  projectId: "tiras-crm",
  storageBucket: "tiras-crm.firebasestorage.app",
  messagingSenderId: "711986340115",
  appId: "1:711986340115:web:61b31f9196d4b13ffffae6"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export const COLLECTIONS = {
  USERS: "users",
  COMPANIES: "companies",
  LEADS: "leads",
  CALLS: "calls",
  FOLLOWUPS: "followups",
  TICKETS: "tickets",
  NOTIFICATIONS: "notifications",
  PAYMENTS: "payments",
  RECORDINGS: "recordings",
  PIPELINE_STAGES: "pipeline_stages",
  WHATSAPP_TEMPLATES: "wa_templates",
};

export const ROLES = {
  PLATFORM_OWNER: "platform_owner",
  COMPANY_ADMIN: "company_admin",
  MANAGER: "manager",
  AGENT: "agent",
  SUPPORT_AGENT: "support_agent",
};

export default app;
export const functions = null;
