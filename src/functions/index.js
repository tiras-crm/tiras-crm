// TIRAS CRM — Firebase Cloud Functions
// Version 1.0 | May 2026
//
// SETUP REQUIRED:
//   cd functions
//   npm install firebase-admin firebase-functions axios
//
//   Set environment secrets (never hardcode these):
//   firebase functions:secrets:set RAZORPAY_KEY_ID
//   firebase functions:secrets:set RAZORPAY_KEY_SECRET
//   firebase functions:secrets:set PLIVO_AUTH_ID
//   firebase functions:secrets:set PLIVO_AUTH_TOKEN
//   firebase functions:secrets:set GEMINI_API_KEY
//
// DEPLOY:
//   firebase deploy --only functions
//
// FUNCTIONS IN THIS FILE:
//   1. scheduledTTLCleanup         — runs daily 2AM IST, deletes recordings past plan limit
//   2. onCallEnd                   — Firestore trigger, fetches Plivo recording, saves to Storage, triggers AI summary
//   3. sendFollowUpReminders       — runs every 15 min, checks overdue follow-ups, creates notifications
//   4. createRazorpayPaymentLink   — HTTPS callable, creates Razorpay payment link (holds secret key)
//   5. razorpayWebhook             — HTTPS endpoint, receives Razorpay payment confirmation
//   6. onNewTicket                 — Firestore trigger, notifies manager when ticket raised
//   7. onTicketEscalation          — scheduled every hour, escalates unresolved tickets after 24h

const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { onCall, onRequest }                    = require("firebase-functions/v2/https");
const { onSchedule }                           = require("firebase-functions/v2/scheduler");
const { defineSecret }                         = require("firebase-functions/params");
const { initializeApp }                        = require("firebase-admin/app");
const { getFirestore, FieldValue, Timestamp }  = require("firebase-admin/firestore");
const { getStorage }                           = require("firebase-admin/storage");
const axios                                    = require("axios");
const crypto                                   = require("crypto");

initializeApp();

const db      = getFirestore();
const storage = getStorage();

// ─── Secrets (stored in Google Secret Manager — never in source code) ─────────

const RAZORPAY_KEY_ID     = defineSecret("RAZORPAY_KEY_ID");
const RAZORPAY_KEY_SECRET = defineSecret("RAZORPAY_KEY_SECRET");
const PLIVO_AUTH_ID       = defineSecret("PLIVO_AUTH_ID");
const PLIVO_AUTH_TOKEN    = defineSecret("PLIVO_AUTH_TOKEN");
const GEMINI_API_KEY      = defineSecret("GEMINI_API_KEY");

// ─── Collection names (mirror of firebase.js COLLECTIONS) ────────────────────

const C = {
  USERS:             "users",
  COMPANIES:         "companies",
  LEADS:             "leads",
  CALLS:             "calls",
  TICKETS:           "tickets",
  FOLLOW_UPS:        "followups",
  NOTIFICATIONS:     "notifications",
  PAYMENTS:          "payments",
  PIPELINE_STAGES:   "pipeline_stages",
  WA_TEMPLATES:      "wa_templates",
  LEAD_TIMELINE:     "lead_timeline",
};

// ─── Plan retention limits (master doc Section 10) ────────────────────────────
// Basic: 7 days | Growth: 30 days | Enterprise: 365 days

const PLAN_RETENTION_DAYS = {
  basic:      7,
  growth:     30,
  enterprise: 365,
};

// ═══════════════════════════════════════════════════════════════════════════════
// FUNCTION 1 — scheduledTTLCleanup
// Runs: daily at 2:00 AM IST (20:30 UTC previous day)
// Job: delete call recordings in Firebase Storage past the company's plan limit
//      update Firestore call doc to say "Recording Expired" — transparent to customer
// Master doc ref: Section 10 "TTL automation: Firebase Cloud Function runs at 2AM daily"
// ═══════════════════════════════════════════════════════════════════════════════

exports.scheduledTTLCleanup = onSchedule(
  {
    schedule:  "30 20 * * *",   // 20:30 UTC = 02:00 IST
    timeZone:  "UTC",
    region:    "asia-south1",   // Mumbai — lowest latency for India
    memory:    "256MiB",
    timeoutSeconds: 300,
  },
  async () => {
    console.log("TIRAS TTL: Starting daily recording cleanup —", new Date().toISOString());

    let totalDeleted  = 0;
    let totalErrored  = 0;

    try {
      // 1. Fetch all active companies and their plans
      const companiesSnap = await db.collection(C.COMPANIES)
        .where("billingStatus", "==", "active")
        .get();

      if (companiesSnap.empty) {
        console.log("TIRAS TTL: No active companies found. Exiting.");
        return;
      }

      // 2. Process each company in sequence (avoid memory spike)
      for (const companyDoc of companiesSnap.docs) {
        const company   = companyDoc.data();
        const companyId = companyDoc.id;
        const plan      = (company.plan || "basic").toLowerCase();
        const retentionDays = PLAN_RETENTION_DAYS[plan] ?? PLAN_RETENTION_DAYS.basic;

        // Calculate cutoff timestamp
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
        const cutoffTimestamp = Timestamp.fromDate(cutoffDate);

        console.log(`TIRAS TTL: Company ${companyId} | Plan: ${plan} | Retention: ${retentionDays} days | Cutoff: ${cutoffDate.toDateString()}`);

        // 3. Find calls older than retention limit that still have a recording
        const expiredCallsSnap = await db.collection(C.CALLS)
          .where("companyId",    "==", companyId)
          .where("recordingUrl", "!=", null)
          .where("terminatedAt", "<=", cutoffTimestamp)
          .get();

        if (expiredCallsSnap.empty) {
          console.log(`TIRAS TTL: No expired recordings for company ${companyId}`);
          continue;
        }

        console.log(`TIRAS TTL: Found ${expiredCallsSnap.size} expired recordings for company ${companyId}`);

        // 4. Delete each recording from Firebase Storage
        for (const callDoc of expiredCallsSnap.docs) {
          const call   = callDoc.data();
          const callId = callDoc.id;

          try {
            // Delete from Firebase Storage if path is stored
            if (call.recordingStoragePath) {
              const fileRef = storage.bucket().file(call.recordingStoragePath);
              const [exists] = await fileRef.exists();
              if (exists) {
                await fileRef.delete();
                console.log(`TIRAS TTL: Deleted recording — ${call.recordingStoragePath}`);
              }
            }

            // Update call doc — mark recording as expired (transparent to customer)
            await db.collection(C.CALLS).doc(callId).update({
              recordingUrl:         null,
              recordingStoragePath: null,
              recordingExpired:     true,
              recordingExpiredAt:   FieldValue.serverTimestamp(),
              recordingExpiredNote: `Recording automatically deleted after ${retentionDays}-day retention limit (${plan} plan).`,
            });

            totalDeleted++;

          } catch (deleteErr) {
            console.error(`TIRAS TTL: Failed to delete recording for call ${callId}:`, deleteErr.message);
            totalErrored++;
          }
        }
      }

      console.log(`TIRAS TTL: Cleanup complete — Deleted: ${totalDeleted} | Errors: ${totalErrored}`);

    } catch (err) {
      console.error("TIRAS TTL: scheduledTTLCleanup fatal error:", err);
      throw err;
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// FUNCTION 2 — onCallEnd
// Trigger: Firestore write to /calls/{callId} where aiSummaryPending becomes true
// Job 1: Fetch Plivo recording URL using callUUID
// Job 2: Download recording and save to Firebase Storage
// Job 3: Call Gemini API to generate AI summary
// Job 4: Save summary, objection tag, next action back to call doc
// Master doc ref: Section 8 "AI Features — AI call summary after call ends"
// ═══════════════════════════════════════════════════════════════════════════════

exports.onCallEnd = onDocumentUpdated(
  {
    document:  "calls/{callId}",
    region:    "asia-south1",
    memory:    "512MiB",
    timeoutSeconds: 120,
    secrets:   [PLIVO_AUTH_ID, PLIVO_AUTH_TOKEN, GEMINI_API_KEY],
  },
  async (event) => {
    const before = event.data.before.data();
    const after  = event.data.after.data();
    const callId = event.params.callId;

    // Only trigger when aiSummaryPending flips to true
    // and it wasn't already true before (prevent re-runs)
    if (!after.aiSummaryPending || before.aiSummaryPending === true) {
      return null;
    }

    // Skip if call has no UUID (was never answered / dial failed)
    if (!after.callUUID && !after.duration) {
      console.log(`TIRAS onCallEnd: Call ${callId} has no UUID or duration — skipping.`);
      await db.collection(C.CALLS).doc(callId).update({ aiSummaryPending: false });
      return null;
    }

    console.log(`TIRAS onCallEnd: Processing call ${callId} | Duration: ${after.duration}s`);

    try {
      // ── Step 1: Fetch Plivo recording URL ────────────────────────────────
      let recordingUrl    = null;
      let storagePath     = null;

      if (after.callUUID && PLIVO_AUTH_ID.value() && PLIVO_AUTH_TOKEN.value()) {
        try {
          // Plivo recording API — wait 10s after call ends for recording to process
          await _sleep(10000);

          const plivoResponse = await axios.get(
            `https://api.plivo.com/v1/Account/${PLIVO_AUTH_ID.value()}/Recording/`,
            {
              auth: {
                username: PLIVO_AUTH_ID.value(),
                password: PLIVO_AUTH_TOKEN.value(),
              },
              params: { call_uuid: after.callUUID },
            }
          );

          const recordings = plivoResponse.data?.objects || [];

          if (recordings.length > 0) {
            recordingUrl = recordings[0].recording_url;
            console.log(`TIRAS onCallEnd: Plivo recording URL fetched — ${recordingUrl}`);

            // ── Step 2: Download recording and save to Firebase Storage ────
            storagePath = await _downloadAndSaveRecording(
              recordingUrl,
              callId,
              after.companyId,
              after.agentId,
              PLIVO_AUTH_ID.value(),
              PLIVO_AUTH_TOKEN.value()
            );

          } else {
            console.log(`TIRAS onCallEnd: No recording found on Plivo for UUID ${after.callUUID} — call may have been too short`);
          }

        } catch (plivoErr) {
          console.error("TIRAS onCallEnd: Plivo recording fetch error:", plivoErr.message);
          // Non-fatal — continue to AI summary even without recording
        }
      }

      // ── Step 3: Generate AI summary via Gemini ────────────────────────────

      let aiSummary          = null;
      let objectionTag       = null;
      let suggestedNextAction = null;

      if (GEMINI_API_KEY.value()) {
        const summaryResult = await _generateAISummaryServer({
          callNotes:    after.notes   || "",
          leadName:     after.leadName || "the lead",
          callDuration: after.duration || 0,
          callOutcome:  after.outcome  || "Unknown",
          apiKey:       GEMINI_API_KEY.value(),
        });

        if (summaryResult) {
          aiSummary           = summaryResult.summary;
          objectionTag        = summaryResult.objectionTag;
          suggestedNextAction = summaryResult.suggestedNextAction;
        }
      } else {
        console.warn("TIRAS onCallEnd: GEMINI_API_KEY not set — skipping AI summary.");
      }

      // ── Step 4: Save everything back to call document ─────────────────────

      const updatePayload = {
        aiSummaryPending:    false,
        aiSummaryGeneratedAt: FieldValue.serverTimestamp(),
      };

      if (recordingUrl)        updatePayload.recordingUrl         = recordingUrl;
      if (storagePath)         updatePayload.recordingStoragePath = storagePath;
      if (aiSummary)           updatePayload.aiSummary            = aiSummary;
      if (objectionTag)        updatePayload.objectionTag         = objectionTag;
      if (suggestedNextAction) updatePayload.suggestedNextAction  = suggestedNextAction;

      await db.collection(C.CALLS).doc(callId).update(updatePayload);

      // ── Step 5: Update lead temperature in lead document ──────────────────

      if (after.leadId && after.temperature) {
        await db.collection(C.LEADS).doc(after.leadId).update({
          temperature:         after.temperature,
          lastCallTemperature: after.temperature,
          lastCalledAt:        FieldValue.serverTimestamp(),
          lastCallDuration:    after.duration || 0,
        });
      }

      // ── Step 6: Create notification for agent — summary ready ─────────────

      if (after.agentId) {
        await db.collection(C.NOTIFICATIONS).add({
          recipientUid: after.agentId,
          companyId:    after.companyId,
          type:         "ai_summary_ready",
          title:        "AI Summary Ready",
          body:         `Call summary for ${after.leadName || "your lead"} is ready. ${objectionTag ? `Objection: ${objectionTag}` : ""}`,
          leadId:       after.leadId  || null,
          callId:       callId,
          isRead:       false,
          createdAt:    FieldValue.serverTimestamp(),
        });
      }

      console.log(`TIRAS onCallEnd: Call ${callId} fully processed ✓`);
      return null;

    } catch (err) {
      console.error(`TIRAS onCallEnd: Fatal error for call ${callId}:`, err);

      // Mark as not pending so it doesn't retry infinitely
      await db.collection(C.CALLS).doc(callId).update({
        aiSummaryPending: false,
        aiSummaryError:   err.message,
      });

      return null;
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// FUNCTION 3 — sendFollowUpReminders
// Runs: every 15 minutes
// Job: checks for follow-ups due in the next 30 minutes or already overdue
//      creates notification documents for agents and highlights overdue on manager dashboard
// Master doc ref: Section 8 "Auto escalation: follow-up overdue by 24 hours → glows red"
// ═══════════════════════════════════════════════════════════════════════════════

exports.sendFollowUpReminders = onSchedule(
  {
    schedule:  "*/15 * * * *",   // Every 15 minutes
    timeZone:  "Asia/Kolkata",
    region:    "asia-south1",
    memory:    "256MiB",
    timeoutSeconds: 60,
  },
  async () => {
    const now        = new Date();
    const in30min    = new Date(now.getTime() + 30 * 60 * 1000);
    const before24h  = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    console.log(`TIRAS Reminders: Checking follow-ups at ${now.toISOString()}`);

    try {
      // ── 1. Upcoming follow-ups — due in next 30 minutes ───────────────────

      const upcomingSnap = await db.collection(C.FOLLOW_UPS)
        .where("isCompleted", "==",  false)
        .where("scheduledAt", ">=",  Timestamp.fromDate(now))
        .where("scheduledAt", "<=",  Timestamp.fromDate(in30min))
        .where("reminderSent", "!=", true)   // Only send once
        .get();

      for (const followUpDoc of upcomingSnap.docs) {
        const fu = followUpDoc.data();

        await db.collection(C.NOTIFICATIONS).add({
          recipientUid: fu.agentId,
          companyId:    fu.companyId,
          type:         "followup_reminder",
          title:        "Follow-up Due Soon",
          body:         `You have a follow-up scheduled with ${fu.leadName || "a lead"} in 30 minutes.`,
          leadId:       fu.leadId     || null,
          followUpId:   followUpDoc.id,
          isRead:       false,
          createdAt:    FieldValue.serverTimestamp(),
        });

        // Mark reminder as sent — prevents duplicate notifications
        await followUpDoc.ref.update({ reminderSent: true });

        console.log(`TIRAS Reminders: Reminder sent to agent ${fu.agentId} for lead ${fu.leadId}`);
      }

      // ── 2. Overdue follow-ups — past scheduled time, not completed ─────────

      const overdueSnap = await db.collection(C.FOLLOW_UPS)
        .where("isCompleted", "==",  false)
        .where("isOverdue",   "!=",  true)   // Not already marked overdue
        .where("scheduledAt", "<",   Timestamp.fromDate(now))
        .get();

      for (const followUpDoc of overdueSnap.docs) {
        const fu = followUpDoc.data();

        // Mark as overdue in Firestore — manager dashboard uses this to highlight red
        await followUpDoc.ref.update({
          isOverdue:   true,
          overdueAt:   FieldValue.serverTimestamp(),
        });

        // Notify the agent
        await db.collection(C.NOTIFICATIONS).add({
          recipientUid: fu.agentId,
          companyId:    fu.companyId,
          type:         "followup_overdue",
          title:        "Follow-up Overdue",
          body:         `Your follow-up with ${fu.leadName || "a lead"} was due ${_timeAgo(fu.scheduledAt?.toDate())} ago. Please take action.`,
          leadId:       fu.leadId     || null,
          followUpId:   followUpDoc.id,
          isRead:       false,
          createdAt:    FieldValue.serverTimestamp(),
        });

        console.log(`TIRAS Reminders: Marked overdue — follow-up ${followUpDoc.id}`);
      }

      // ── 3. 24-hour escalation — notify manager ─────────────────────────────
      // Master doc: "follow-up overdue by 24 hours → glows red on manager dashboard,
      //              notification sent"

      const escalationSnap = await db.collection(C.FOLLOW_UPS)
        .where("isCompleted",        "==",  false)
        .where("isOverdue",          "==",  true)
        .where("managerNotified",    "!=",  true)
        .where("scheduledAt",        "<",   Timestamp.fromDate(before24h))
        .get();

      for (const followUpDoc of escalationSnap.docs) {
        const fu = followUpDoc.data();

        // Find this agent's manager
        const agentDoc = await db.collection(C.USERS).doc(fu.agentId).get();
        const managerId = agentDoc.exists ? agentDoc.data().managerId : null;

        if (managerId) {
          await db.collection(C.NOTIFICATIONS).add({
            recipientUid: managerId,
            companyId:    fu.companyId,
            type:         "followup_escalated",
            title:        "⚠️ Follow-up Escalated",
            body:         `${agentDoc.data()?.displayName || "An agent"}'s follow-up with ${fu.leadName || "a lead"} is 24+ hours overdue. Immediate action required.`,
            leadId:       fu.leadId     || null,
            agentId:      fu.agentId,
            followUpId:   followUpDoc.id,
            isRead:       false,
            createdAt:    FieldValue.serverTimestamp(),
          });
        }

        // Notify company admin too
        const adminSnap = await db.collection(C.USERS)
          .where("companyId", "==",  fu.companyId)
          .where("role",      "==",  "company_admin")
          .limit(1)
          .get();

        if (!adminSnap.empty) {
          const adminId = adminSnap.docs[0].id;
          await db.collection(C.NOTIFICATIONS).add({
            recipientUid: adminId,
            companyId:    fu.companyId,
            type:         "followup_escalated_admin",
            title:        "⚠️ Overdue Follow-up",
            body:         `Follow-up with ${fu.leadName || "a lead"} is 24+ hours overdue (assigned to ${agentDoc.data()?.displayName || "agent"}).`,
            leadId:       fu.leadId  || null,
            followUpId:   followUpDoc.id,
            isRead:       false,
            createdAt:    FieldValue.serverTimestamp(),
          });
        }

        await followUpDoc.ref.update({ managerNotified: true });

        console.log(`TIRAS Reminders: 24h escalation fired for follow-up ${followUpDoc.id}`);
      }

      console.log("TIRAS Reminders: Cycle complete ✓");

    } catch (err) {
      console.error("TIRAS Reminders: sendFollowUpReminders error:", err);
      throw err;
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// FUNCTION 4 — createRazorpayPaymentLink
// Type: HTTPS Callable (called from razorpayService.js in the frontend)
// Job: holds Razorpay secret key server-side, creates payment link via Razorpay API
//      returns payment_link_url to the frontend
// Master doc ref: "Razorpay payment link generator inside lead detail page"
// ═══════════════════════════════════════════════════════════════════════════════

exports.createRazorpayPaymentLink = onCall(
  {
    region:  "asia-south1",
    memory:  "256MiB",
    secrets: [RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET],
  },
  async (request) => {
    // Auth check — must be logged in
    if (!request.auth) {
      throw new Error("Unauthenticated. You must be logged in to create a payment link.");
    }

    const {
      amount_inr,
      description,
      customer_name,
      customer_phone,
      customer_email,
      lead_id,
      company_id,
      agent_id,
      notes,
    } = request.data;

    // Input validation
    if (!amount_inr || amount_inr <= 0) {
      throw new Error("Invalid amount. Must be a positive number in INR.");
    }

    if (!customer_phone) {
      throw new Error("Customer phone number is required.");
    }

    // Build Razorpay payment link request
    const razorpayPayload = {
      amount:      Math.round(amount_inr * 100),    // Razorpay uses paise
      currency:    "INR",
      accept_partial: false,
      description: description || "TIRAS CRM Payment",
      customer: {
        name:    customer_name  || "",
        contact: customer_phone,
        email:   customer_email || "",
      },
      notify: {
        sms:   true,
        email: !!customer_email,
      },
      reminder_enable: true,
      notes: {
        lead_id:    lead_id    || "",
        company_id: company_id || "",
        agent_id:   agent_id   || "",
        notes:      notes      || "",
      },
      callback_url:    "https://asia-south1-YOUR_PROJECT_ID.cloudfunctions.net/razorpayWebhook",
      callback_method: "get",
    };

    try {
      const response = await axios.post(
        "https://api.razorpay.com/v1/payment_links",
        razorpayPayload,
        {
          auth: {
            username: RAZORPAY_KEY_ID.value(),
            password: RAZORPAY_KEY_SECRET.value(),
          },
          headers: { "Content-Type": "application/json" },
        }
      );

      const rzpData = response.data;

      console.log(`TIRAS Razorpay: Payment link created — ${rzpData.id} for ₹${amount_inr}`);

      return {
        payment_link_id:  rzpData.id,
        payment_link_url: rzpData.short_url || rzpData.payment_link_url,
        short_url:        rzpData.short_url,
        amount:           amount_inr,
        status:           rzpData.status,
      };

    } catch (err) {
      const rzpError = err.response?.data?.error?.description || err.message;
      console.error("TIRAS Razorpay: Payment link creation failed:", rzpError);
      throw new Error(`Razorpay error: ${rzpError}`);
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// FUNCTION 5 — razorpayWebhook
// Type: HTTPS endpoint (public URL — registered in Razorpay dashboard)
// Job: receives payment confirmation from Razorpay
//      verifies webhook signature, marks payment as paid in Firestore
//      auto-moves lead to Closed Won
// Register this URL in Razorpay Dashboard → Settings → Webhooks
// ═══════════════════════════════════════════════════════════════════════════════

exports.razorpayWebhook = onRequest(
  {
    region:  "asia-south1",
    memory:  "256MiB",
    secrets: [RAZORPAY_KEY_SECRET],
  },
  async (req, res) => {
    // Only accept POST
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    // ── Signature verification ─────────────────────────────────────────────
    // Prevents fake webhooks — NEVER skip this in production

    const webhookSignature = req.headers["x-razorpay-signature"];
    const webhookSecret    = RAZORPAY_KEY_SECRET.value();

    if (!webhookSignature || !webhookSecret) {
      console.error("TIRAS Webhook: Missing signature or secret");
      res.status(400).send("Bad Request");
      return;
    }

    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(JSON.stringify(req.body))
      .digest("hex");

    if (expectedSignature !== webhookSignature) {
      console.error("TIRAS Webhook: Signature mismatch — possible fake webhook");
      res.status(403).send("Forbidden");
      return;
    }

    // ── Process event ──────────────────────────────────────────────────────

    const event = req.body;
    console.log(`TIRAS Webhook: Received event — ${event.event}`);

    try {
      if (event.event === "payment_link.paid") {
        const paymentLinkId = event.payload?.payment_link?.entity?.id;
        const razorpayPaymentId = event.payload?.payment?.entity?.id;
        const amount = (event.payload?.payment?.entity?.amount || 0) / 100; // paise to INR

        if (!paymentLinkId) {
          console.error("TIRAS Webhook: No payment_link_id in event payload");
          res.status(200).send("OK");
          return;
        }

        // Find payment doc in Firestore by paymentLinkId
        const paymentSnap = await db.collection(C.PAYMENTS)
          .where("paymentLinkId", "==", paymentLinkId)
          .limit(1)
          .get();

        if (paymentSnap.empty) {
          console.warn(`TIRAS Webhook: No payment doc found for link ${paymentLinkId}`);
          res.status(200).send("OK");
          return;
        }

        const paymentDoc  = paymentSnap.docs[0];
        const payment     = paymentDoc.data();
        const paymentDocId = paymentDoc.id;

        // Mark payment as paid
        await paymentDoc.ref.update({
          status:             "paid",
          razorpayPaymentId:  razorpayPaymentId,
          paidAt:             FieldValue.serverTimestamp(),
          updatedAt:          FieldValue.serverTimestamp(),
        });

        // Auto-move lead to Closed Won
        if (payment.leadId) {
          await db.collection(C.LEADS).doc(payment.leadId).update({
            stage:        "Closed Won",
            closedAt:     FieldValue.serverTimestamp(),
            closedReason: `Payment received — ₹${amount}`,
            updatedAt:    FieldValue.serverTimestamp(),
          });

          // Log to lead timeline
          await db.collection(C.LEAD_TIMELINE).add({
            leadId:    payment.leadId,
            companyId: payment.companyId,
            agentId:   payment.agentId,
            type:      "payment_received",
            note:      `Payment of ₹${amount} confirmed via Razorpay. Lead moved to Closed Won.`,
            amount,
            razorpayPaymentId,
            createdAt: FieldValue.serverTimestamp(),
          });
        }

        // Notify agent and admin
        const notifications = [];

        if (payment.agentId) {
          notifications.push(
            db.collection(C.NOTIFICATIONS).add({
              recipientUid: payment.agentId,
              companyId:    payment.companyId,
              type:         "payment_received",
              title:        "💰 Payment Received",
              body:         `₹${amount} received from ${payment.leadName || "your lead"}. Lead moved to Closed Won!`,
              leadId:       payment.leadId || null,
              paymentDocId,
              isRead:       false,
              createdAt:    FieldValue.serverTimestamp(),
            })
          );
        }

        // Notify company admin
        const adminSnap = await db.collection(C.USERS)
          .where("companyId", "==",  payment.companyId)
          .where("role",      "==",  "company_admin")
          .limit(1)
          .get();

        if (!adminSnap.empty) {
          notifications.push(
            db.collection(C.NOTIFICATIONS).add({
              recipientUid: adminSnap.docs[0].id,
              companyId:    payment.companyId,
              type:         "payment_received_admin",
              title:        "💰 Payment Confirmed",
              body:         `₹${amount} received from ${payment.leadName || "a lead"}.`,
              leadId:       payment.leadId || null,
              paymentDocId,
              isRead:       false,
              createdAt:    FieldValue.serverTimestamp(),
            })
          );
        }

        await Promise.all(notifications);

        console.log(`TIRAS Webhook: Payment confirmed — ₹${amount} | Lead moved to Closed Won`);
      }

      // Always return 200 to Razorpay — any non-200 triggers retries
      res.status(200).send("OK");

    } catch (err) {
      console.error("TIRAS Webhook: Processing error:", err);
      // Still return 200 to prevent Razorpay retry flood
      res.status(200).send("OK");
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// FUNCTION 6 — onNewTicket
// Trigger: new document created in /tickets/{ticketId}
// Job: notifies the company manager(s) and admin that a new ticket was raised
//      master doc: "Ticket stages: Open → Assigned → In Progress → Resolved → Closed"
// ═══════════════════════════════════════════════════════════════════════════════

exports.onNewTicket = onDocumentCreated(
  {
    document: "tickets/{ticketId}",
    region:   "asia-south1",
    memory:   "256MiB",
  },
  async (event) => {
    const ticket   = event.data.data();
    const ticketId = event.params.ticketId;

    if (!ticket.companyId) return null;

    console.log(`TIRAS onNewTicket: New ticket ${ticketId} raised in company ${ticket.companyId}`);

    try {
      // Find manager(s) in this company to notify
      const managersSnap = await db.collection(C.USERS)
        .where("companyId", "==", ticket.companyId)
        .where("role",      "in", ["manager", "company_admin"])
        .get();

      const notificationPromises = managersSnap.docs.map((managerDoc) =>
        db.collection(C.NOTIFICATIONS).add({
          recipientUid: managerDoc.id,
          companyId:    ticket.companyId,
          type:         "new_ticket",
          title:        "🎫 New Support Ticket",
          body:         `A new ticket has been raised${ticket.leadName ? ` for ${ticket.leadName}` : ""}. Assign it to a support agent.`,
          leadId:       ticket.leadId  || null,
          callId:       ticket.callId  || null,
          ticketId,
          isRead:       false,
          createdAt:    FieldValue.serverTimestamp(),
        })
      );

      await Promise.all(notificationPromises);

      console.log(`TIRAS onNewTicket: Notified ${managersSnap.size} managers/admins ✓`);
      return null;

    } catch (err) {
      console.error("TIRAS onNewTicket: Error:", err);
      return null;
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// FUNCTION 7 — onTicketEscalation
// Runs: every hour
// Job: finds tickets unresolved after 24 hours → notifies admin → glows red in UI
// Master doc ref: "Red alert escalation: ticket unresolved after 24 hours → admin notified"
// ═══════════════════════════════════════════════════════════════════════════════

exports.onTicketEscalation = onSchedule(
  {
    schedule:  "0 * * * *",   // Every hour at :00
    timeZone:  "Asia/Kolkata",
    region:    "asia-south1",
    memory:    "256MiB",
    timeoutSeconds: 60,
  },
  async () => {
    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    console.log("TIRAS Escalation: Checking for unresolved tickets older than 24h");

    try {
      const overdueTicketsSnap = await db.collection(C.TICKETS)
        .where("status",          "in",  ["Open", "Assigned", "In Progress"])
        .where("isEscalated",     "!=",  true)
        .where("createdAt",       "<",   Timestamp.fromDate(cutoff24h))
        .get();

      if (overdueTicketsSnap.empty) {
        console.log("TIRAS Escalation: No overdue tickets found ✓");
        return;
      }

      console.log(`TIRAS Escalation: Found ${overdueTicketsSnap.size} overdue tickets`);

      for (const ticketDoc of overdueTicketsSnap.docs) {
        const ticket   = ticketDoc.data();
        const ticketId = ticketDoc.id;

        try {
          // Mark ticket as escalated — UI uses this to glow red
          await ticketDoc.ref.update({
            isEscalated:   true,
            escalatedAt:   FieldValue.serverTimestamp(),
          });

          // Find company admin to notify
          const adminSnap = await db.collection(C.USERS)
            .where("companyId", "==",  ticket.companyId)
            .where("role",      "==",  "company_admin")
            .limit(1)
            .get();

          if (!adminSnap.empty) {
            await db.collection(C.NOTIFICATIONS).add({
              recipientUid: adminSnap.docs[0].id,
              companyId:    ticket.companyId,
              type:         "ticket_escalated",
              title:        "🚨 Ticket Unresolved 24h+",
              body:         `Ticket${ticket.leadName ? ` for ${ticket.leadName}` : ""} has been unresolved for over 24 hours. Immediate attention required.`,
              leadId:       ticket.leadId  || null,
              ticketId,
              isRead:       false,
              createdAt:    FieldValue.serverTimestamp(),
            });
          }

          console.log(`TIRAS Escalation: Ticket ${ticketId} escalated ✓`);

        } catch (ticketErr) {
          console.error(`TIRAS Escalation: Failed to escalate ticket ${ticketId}:`, ticketErr.message);
        }
      }

    } catch (err) {
      console.error("TIRAS Escalation: onTicketEscalation error:", err);
      throw err;
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// PRIVATE HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

// Download Plivo recording and store in Firebase Storage
// Returns the storage path string or null on failure

const _downloadAndSaveRecording = async (
  recordingUrl, callId, companyId, agentId, plivoAuthId, plivoAuthToken
) => {
  try {
    const recordingResponse = await axios.get(recordingUrl, {
      auth:         { username: plivoAuthId, password: plivoAuthToken },
      responseType: "arraybuffer",
    });

    const buffer      = Buffer.from(recordingResponse.data);
    const storagePath = `recordings/${companyId}/${agentId}/${callId}.mp3`;
    const fileRef     = storage.bucket().file(storagePath);

    await fileRef.save(buffer, {
      contentType: "audio/mpeg",
      metadata: {
        cacheControl: "private,max-age=3600",
        customMetadata: { callId, companyId, agentId },
      },
    });

    // Make file accessible via signed URL for 7 days (Basic plan default)
    const [signedUrl] = await fileRef.getSignedUrl({
      action:  "read",
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });

    // Update call doc with both storage path and playback URL
    await db.collection(C.CALLS).doc(callId).update({
      recordingStoragePath: storagePath,
      recordingUrl:         signedUrl,
    });

    console.log(`TIRAS Storage: Recording saved — ${storagePath}`);
    return storagePath;

  } catch (err) {
    console.error("TIRAS Storage: _downloadAndSaveRecording failed:", err.message);
    return null;
  }
};

// Gemini API call (server-side version — uses secret, not env var)

const _generateAISummaryServer = async ({ callNotes, leadName, callDuration, callOutcome, apiKey }) => {
  const durationText = callDuration >= 60
    ? `${Math.floor(callDuration / 60)} minutes ${callDuration % 60} seconds`
    : `${callDuration} seconds`;

  const prompt = `
You are an AI assistant for TIRAS CRM, a sales CRM used by Indian small and medium businesses.
A sales agent just completed a call with ${leadName}.
Call details:
- Duration: ${durationText}
- Outcome: ${callOutcome}
- Agent notes: ${callNotes || "No notes provided"}

Respond ONLY with a valid JSON object. No explanation. No markdown. Just JSON.
{
  "summary": "3 sentences summarising the call in plain English for the sales manager",
  "objectionTag": "exactly one of: Price, Timing, Not Interested, Need More Info, Wrong Person, No Objection",
  "suggestedNextAction": "one specific actionable sentence for the agent"
}`;

  const response = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 300, temperature: 0.3 },
    },
    { headers: { "Content-Type": "application/json" } }
  );

  const raw  = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const clean = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();

  try {
    const parsed = JSON.parse(clean);
    const VALID_TAGS = ["Price", "Timing", "Not Interested", "Need More Info", "Wrong Person", "No Objection"];
    if (parsed.summary && parsed.objectionTag && parsed.suggestedNextAction) {
      return {
        summary:            parsed.summary,
        objectionTag:       VALID_TAGS.includes(parsed.objectionTag) ? parsed.objectionTag : "Need More Info",
        suggestedNextAction: parsed.suggestedNextAction,
      };
    }
  } catch (_) {}

  return null;
};

// Sleep helper for Plivo recording delay

const _sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Human-readable time-ago string for notification bodies

const _timeAgo = (date) => {
  if (!date) return "some time";
  const diffMs  = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH   = Math.floor(diffMin / 60);
  if (diffH >= 24) return `${Math.floor(diffH / 24)} day(s)`;
  if (diffH >= 1)  return `${diffH} hour(s)`;
  return `${diffMin} minute(s)`;
};
