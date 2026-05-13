// TIRAS CRM — Plivo Service
// Handles: WebRTC calling via Plivo Browser SDK, call logging to Firestore, AI summary trigger
//
// SETUP REQUIRED:
//   npm install plivo-browser-sdk
//   Add to your .env file:
//     REACT_APP_PLIVO_USERNAME=your_plivo_sip_username
//     REACT_APP_PLIVO_PASSWORD=your_plivo_sip_password
//
// HOW PLIVO WORKS IN TIRAS:
//   Agent opens Lead Detail Page → clicks Call button → makeCall() fires
//   Plivo routes call through SIP → agent speaks via browser mic
//   Plivo auto-records every call (set in Plivo dashboard: Record = true)
//   On hangup → onCallTerminated fires → saves call log to Firestore
//   Cloud Function onCallEnd picks up the new Firestore doc → fetches recording URL
//   aiService.generateCallSummary() is triggered → summary saved to call doc

import Plivo from "plivo-browser-sdk";
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  query,
  where,
  getDocs,
  getDoc,
} from "firebase/firestore";
import { db, COLLECTIONS } from "../firebase";

// ─── State ──────────────────────────────────────────────────────────────────

let plivoClient = null;          // Plivo SDK instance
let activeCallUUID = null;       // Plivo call UUID for the current call
let callStartTime = null;        // JS Date when call was answered
let currentCallDocId = null;     // Firestore document ID of current call log
let currentLeadId = null;        // Lead this call belongs to
let currentAgentId = null;       // Agent making this call
let currentCompanyId = null;     // Company scope for Firestore rules
let isMuted = false;             // Mute toggle state
let isOnHold = false;            // Hold toggle state

// External event callbacks — set these from your React component
// plivoService.onRinging = () => setState({ callStatus: "ringing" })
export const callbacks = {
  onRinging: null,           // Call is ringing on remote end
  onAnswered: null,          // Remote party picked up
  onTerminated: null,        // Call ended — passes { duration, callDocId }
  onMediaPermissionError: null, // Microphone access denied
  onLoginSuccess: null,      // Plivo SIP registered successfully
  onLoginFailed: null,       // SIP registration failed
  onError: null,             // Generic SDK error
};

// ─── Init ────────────────────────────────────────────────────────────────────
// Call once when agent logs in — registers SIP endpoint with Plivo
// username/password come from Plivo dashboard → Endpoints section

export const initPlivo = (username, password) => {
  return new Promise((resolve, reject) => {
    try {
      const options = {
        debug: process.env.NODE_ENV === "development" ? "ALL" : "ERROR",
        permOnClick: true,          // Ask mic permission on first call click, not on init
        enableTracking: false,      // No Plivo analytics tracking
        closeProtection: false,     // Don't block page close
        maxAverageBitrate: 48000,   // Good quality for voice, low bandwidth
      };

      plivoClient = new Plivo(options);

      // ── SIP Registration events ─────────────────────────────────────────

      plivoClient.client.on("onLogin", () => {
        console.log("TIRAS Plivo: SIP registered ✓");
        if (callbacks.onLoginSuccess) callbacks.onLoginSuccess();
        resolve(plivoClient);
      });

      plivoClient.client.on("onLoginFailed", (reason) => {
        console.error("TIRAS Plivo: SIP registration failed:", reason);
        if (callbacks.onLoginFailed) callbacks.onLoginFailed(reason);
        reject(new Error(`Plivo login failed: ${reason}`));
      });

      // ── Call lifecycle events ────────────────────────────────────────────

      plivoClient.client.on("onCallRemoteRinging", (callInfo) => {
        console.log("TIRAS Plivo: Remote ringing", callInfo);
        activeCallUUID = callInfo?.callUUID || null;
        if (callbacks.onRinging) callbacks.onRinging(callInfo);
      });

      plivoClient.client.on("onCallAnswered", (callInfo) => {
        console.log("TIRAS Plivo: Call answered", callInfo);
        callStartTime = new Date();
        activeCallUUID = callInfo?.callUUID || activeCallUUID;

        // Update Firestore call doc status to "answered"
        if (currentCallDocId) {
          updateDoc(doc(db, COLLECTIONS.CALLS, currentCallDocId), {
            status: "answered",
            answeredAt: serverTimestamp(),
            callUUID: activeCallUUID,
          }).catch((err) => console.error("TIRAS: Failed to update call answered status:", err));
        }

        if (callbacks.onAnswered) callbacks.onAnswered(callInfo);
      });

      plivoClient.client.on("onCallTerminated", async (reason, callInfo) => {
        console.log("TIRAS Plivo: Call terminated. Reason:", reason);
        await _handleCallTerminated(reason, callInfo);
      });

      // ── Media / error events ─────────────────────────────────────────────

      plivoClient.client.on("onMediaPermissionError", (error) => {
        console.error("TIRAS Plivo: Microphone permission denied:", error);
        if (callbacks.onMediaPermissionError) callbacks.onMediaPermissionError(error);
      });

      plivoClient.client.on("onWebrtcNotSupported", () => {
        console.error("TIRAS Plivo: WebRTC not supported in this browser");
        if (callbacks.onError) callbacks.onError("WebRTC not supported. Use Chrome or Firefox.");
      });

      plivoClient.client.on("onConnectionChange", ({ state }) => {
        console.log("TIRAS Plivo: Network state changed:", state);
      });

      // Register SIP endpoint
      plivoClient.client.login(username, password);

    } catch (err) {
      console.error("TIRAS Plivo: initPlivo failed:", err);
      reject(err);
    }
  });
};

// ─── makeCall ────────────────────────────────────────────────────────────────
// Dials a lead's phone number via Plivo
// Checks for anti-overlap: if another agent is already calling this lead, blocks
//
// @param destinationNumber  string  Phone number in E.164 format e.g. "+919876543210"
// @param leadId             string  Firestore lead document ID
// @param agentId            string  UID of the agent making the call
// @param companyId          string  Company this call belongs to
// @param leadName           string  Display name for the call log

export const makeCall = async (destinationNumber, leadId, agentId, companyId, leadName = "") => {
  if (!plivoClient) {
    throw new Error("Plivo not initialised. Call initPlivo() first.");
  }

  if (!destinationNumber || !leadId || !agentId || !companyId) {
    throw new Error("makeCall: destinationNumber, leadId, agentId, companyId are all required.");
  }

  // ── Anti-overlap check ──────────────────────────────────────────────────
  // Blocks second agent from calling same lead simultaneously
  // Checks Firestore for any "in-progress" call on this lead

  const activeCallQuery = query(
    collection(db, COLLECTIONS.CALLS),
    where("leadId", "==", leadId),
    where("companyId", "==", companyId),
    where("status", "==", "in-progress")
  );

  const activeCallSnap = await getDocs(activeCallQuery);

  if (!activeCallSnap.empty) {
    const activeCall = activeCallSnap.docs[0].data();
    throw new Error(
      `Anti-overlap: ${activeCall.agentName || "Another agent"} is already on a call with this lead. Try again after their call ends.`
    );
  }

  // ── Create Firestore call log doc (status: initiated) ───────────────────

  currentLeadId = leadId;
  currentAgentId = agentId;
  currentCompanyId = companyId;
  callStartTime = null;

  const callDoc = await addDoc(collection(db, COLLECTIONS.CALLS), {
    leadId,
    agentId,
    companyId,
    leadName,
    destinationNumber,
    status: "initiated",         // initiated → in-progress → answered → terminated
    direction: "outbound",
    initiatedAt: serverTimestamp(),
    answeredAt: null,
    terminatedAt: null,
    duration: 0,                 // seconds, filled on termination
    callUUID: null,              // filled by Plivo after connect
    recordingUrl: null,          // filled by Cloud Function after Plivo processes recording
    outcome: null,               // Interested / Not Interested / Call Back / etc — set by agent
    aiSummary: null,             // filled by AI service after recording ready
    objectionTag: null,          // Price / Timing / Not Interested / Need More Info / Wrong Person
    suggestedNextAction: null,   // AI recommendation
    notes: "",                   // Agent manual notes added during/after call
    temperature: null,           // Hot / Warm / Cold / Dead — set on termination
  });

  currentCallDocId = callDoc.id;

  // Update call status to in-progress
  await updateDoc(doc(db, COLLECTIONS.CALLS, currentCallDocId), {
    status: "in-progress",
  });

  // ── Plivo dial ───────────────────────────────────────────────────────────

  const extraHeaders = {
    "X-PH-LeadId": leadId,
    "X-PH-AgentId": agentId,
    "X-PH-CallDocId": currentCallDocId,
  };

  try {
    plivoClient.client.call(destinationNumber, extraHeaders);
    console.log(`TIRAS Plivo: Dialing ${destinationNumber} for lead ${leadId}`);
    return { callDocId: currentCallDocId };
  } catch (err) {
    // Clean up call doc on dial failure
    await updateDoc(doc(db, COLLECTIONS.CALLS, currentCallDocId), {
      status: "failed",
      terminatedAt: serverTimestamp(),
      failureReason: err.message,
    });
    throw err;
  }
};

// ─── hangupCall ─────────────────────────────────────────────────────────────
// Ends the active call — onCallTerminated fires automatically after this

export const hangupCall = () => {
  if (!plivoClient) return;
  try {
    plivoClient.client.hangup();
    console.log("TIRAS Plivo: Hangup initiated");
  } catch (err) {
    console.error("TIRAS Plivo: hangupCall error:", err);
  }
};

// ─── muteCall / unmuteCall ───────────────────────────────────────────────────

export const muteCall = () => {
  if (!plivoClient) return;
  plivoClient.client.mute();
  isMuted = true;
  console.log("TIRAS Plivo: Muted");
};

export const unmuteCall = () => {
  if (!plivoClient) return;
  plivoClient.client.unmute();
  isMuted = false;
  console.log("TIRAS Plivo: Unmuted");
};

export const toggleMute = () => {
  isMuted ? unmuteCall() : muteCall();
  return !isMuted;
};

export const getMuteState = () => isMuted;

// ─── holdCall / resumeCall ───────────────────────────────────────────────────
// Note: Plivo hold works by muting + playing hold music via PHLO flow
// For Phase 1: hold = mute (no music). Real hold music is a Phase 2 PHLO feature.

export const holdCall = () => {
  if (!plivoClient) return;
  muteCall();
  isOnHold = true;
  console.log("TIRAS Plivo: On hold (muted)");
};

export const resumeCall = () => {
  if (!plivoClient) return;
  unmuteCall();
  isOnHold = false;
  console.log("TIRAS Plivo: Resumed from hold");
};

export const toggleHold = () => {
  isOnHold ? resumeCall() : holdCall();
  return !isOnHold;
};

export const getHoldState = () => isOnHold;

// ─── setCallOutcome ──────────────────────────────────────────────────────────
// Agent tags the call result — called from the Call Interface UI
// Outcome: "Interested" | "Not Interested" | "Call Back" | "No Answer" | "Wrong Number" | "Busy" | "Voicemail"

export const setCallOutcome = async (outcome) => {
  if (!currentCallDocId) return;
  try {
    await updateDoc(doc(db, COLLECTIONS.CALLS, currentCallDocId), { outcome });
    console.log("TIRAS Plivo: Outcome set to:", outcome);
  } catch (err) {
    console.error("TIRAS Plivo: setCallOutcome error:", err);
  }
};

// ─── addCallNotes ────────────────────────────────────────────────────────────
// Agent types notes during or after call — used by AI summary as context

export const addCallNotes = async (notes) => {
  if (!currentCallDocId) return;
  try {
    await updateDoc(doc(db, COLLECTIONS.CALLS, currentCallDocId), { notes });
  } catch (err) {
    console.error("TIRAS Plivo: addCallNotes error:", err);
  }
};

// ─── getCurrentCallDocId ─────────────────────────────────────────────────────
// Exposes current call doc ID to UI components

export const getCurrentCallDocId = () => currentCallDocId;

// ─── _handleCallTerminated (private) ─────────────────────────────────────────
// Fires when call ends for any reason
// Calculates duration, scores lead temperature, saves to Firestore
// Triggers AI summary via Cloud Function (via Firestore write)

const _handleCallTerminated = async (reason, callInfo) => {
  const terminatedAt = new Date();
  const duration = callStartTime
    ? Math.round((terminatedAt - callStartTime) / 1000)  // seconds
    : 0;

  // ── Lead temperature scoring (master doc Section 8 AI Features) ──────────
  // Call over 3 min = Hot | 1–3 min = Warm | Under 30 sec = Cold
  // No answer 3 times = Dead (handled separately in lead scoring)

  let temperature = "cold";
  if (duration >= 180) temperature = "hot";        // 3+ minutes
  else if (duration >= 60) temperature = "warm";   // 1–3 minutes
  else temperature = "cold";                       // under 1 minute

  // ── Save call termination to Firestore ───────────────────────────────────

  const updatePayload = {
    status: "terminated",
    terminatedAt: serverTimestamp(),
    duration,          // seconds
    temperature,
    terminationReason: reason || "normal",
  };

  if (currentCallDocId) {
    try {
      await updateDoc(doc(db, COLLECTIONS.CALLS, currentCallDocId), updatePayload);
      console.log(`TIRAS Plivo: Call ended. Duration: ${duration}s | Temp: ${temperature}`);

      // ── AI Summary trigger ────────────────────────────────────────────────
      // The Cloud Function onCallEnd listens for status == "terminated"
      // It fetches the Plivo recording URL and kicks off AI summary
      // We set aiSummaryPending = true as the trigger signal
      await updateDoc(doc(db, COLLECTIONS.CALLS, currentCallDocId), {
        aiSummaryPending: true,
      });

    } catch (err) {
      console.error("TIRAS Plivo: Failed to save call termination:", err);
    }
  }

  // ── Update lead's last called timestamp ──────────────────────────────────

  if (currentLeadId) {
    try {
      const leadRef = doc(db, COLLECTIONS.LEADS, currentLeadId);
      await updateDoc(leadRef, {
        lastCalledAt: serverTimestamp(),
        lastCallDuration: duration,
        lastCallTemperature: temperature,
        temperature,               // Current temperature always reflects last call
      });
    } catch (err) {
      console.error("TIRAS Plivo: Failed to update lead last called:", err);
    }
  }

  // ── Reset internal state ─────────────────────────────────────────────────

  const terminatedCallDocId = currentCallDocId;
  activeCallUUID = null;
  callStartTime = null;
  currentCallDocId = null;
  currentLeadId = null;
  currentAgentId = null;
  currentCompanyId = null;
  isMuted = false;
  isOnHold = false;

  // ── Fire external callback ────────────────────────────────────────────────

  if (callbacks.onTerminated) {
    callbacks.onTerminated({
      duration,
      temperature,
      callDocId: terminatedCallDocId,
      reason,
    });
  }
};

// ─── Logout / Cleanup ────────────────────────────────────────────────────────
// Call when agent logs out of TIRAS — deregisters SIP endpoint

export const logoutPlivo = () => {
  if (!plivoClient) return;
  try {
    plivoClient.client.logout();
    plivoClient = null;
    console.log("TIRAS Plivo: SIP deregistered");
  } catch (err) {
    console.error("TIRAS Plivo: logoutPlivo error:", err);
  }
};

// ─── getCallHistory (utility) ─────────────────────────────────────────────────
// Fetches all calls for a lead from Firestore — used in Lead Detail Page timeline

export const getCallHistory = async (leadId, companyId) => {
  try {
    const q = query(
      collection(db, COLLECTIONS.CALLS),
      where("leadId", "==", leadId),
      where("companyId", "==", companyId)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error("TIRAS Plivo: getCallHistory error:", err);
    return [];
  }
};

// ─── formatDuration (utility) ────────────────────────────────────────────────
// Converts seconds to mm:ss string for display in UI

export const formatDuration = (seconds = 0) => {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
};

// ─── isPlivoReady (utility) ───────────────────────────────────────────────────
// Check if SDK is initialised before attempting a call

export const isPlivoReady = () => !!plivoClient;

export default {
  initPlivo,
  makeCall,
  hangupCall,
  muteCall,
  unmuteCall,
  toggleMute,
  getMuteState,
  holdCall,
  resumeCall,
  toggleHold,
  getHoldState,
  setCallOutcome,
  addCallNotes,
  getCurrentCallDocId,
  logoutPlivo,
  getCallHistory,
  formatDuration,
  isPlivoReady,
  callbacks,
};
