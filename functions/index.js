/**
 * TIRAS CRM V2 — Firebase Cloud Functions
 * =========================================
 * Runtime : Node 20, firebase-functions v2, firebase-admin v12
 * Deploy  : firebase deploy --only functions
 *
 * Functions:
 *  1. onWalletRecharge       HTTP  — Razorpay wallet top-up webhook
 *  2. onCallEnd              HTTP  — Plivo call hangup webhook
 *  3. onTrialExpiry          CRON  — Daily 06:00 IST trial expiry check
 *  4. onSubscriptionActivated HTTP  — Razorpay subscription payment webhook
 *  5. scheduledTTLCleanup    CRON  — Daily 02:00 IST recording retention cleanup
 */

"use strict";

// ─── Firebase Imports ────────────────────────────────────────────────────────
const { onRequest }  = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger }     = require("firebase-functions/v2");
const admin          = require("firebase-admin");
const crypto         = require("crypto");

// ─── Admin Init (idempotent) ──────────────────────────────────────────────────
if (!admin.apps.length) {
  admin.initializeApp();
}

const db  = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

// ─── Environment Config ────────────────────────────────────────────────────────
// Set via: firebase functions:config:set razorpay.webhook_secret="YOUR_SECRET"
// Access : process.env.RAZORPAY_WEBHOOK_SECRET  (functions v2 uses .env or Secret Manager)
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || "";

// ─── Plan Retention Config ────────────────────────────────────────────────────
// Prompt 1 & 2 spec — scheduledTTLCleanup uses these
const RETENTION_DAYS = {
  starter:    15,
  basic:      30,
  growth:     90,
  enterprise: 365,
};

// Cost per minute billed to company wallet (Plivo rate pass-through)
const COST_PER_MINUTE = 1.00; // ₹1.00 per minute

// Low-balance thresholds (Prompt 2 spec)
const LOW_BALANCE_THRESHOLD     = 200; // ₹200 — warning notification
const CRITICAL_BALANCE_THRESHOLD = 0;  // ₹0   — calling disabled notification

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Verify Razorpay webhook signature.
 * Razorpay sends X-Razorpay-Signature = HMAC-SHA256(rawBody, webhookSecret)
 */
function verifyRazorpaySignature(rawBody, signature, secret) {
  if (!secret || !signature) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

/**
 * Create a notification document in the notifications sub-collection of a company.
 * @param {string} companyId
 * @param {string} recipientUid  - adminUid of the company
 * @param {object} payload       - { type, message, extra? }
 */
async function createNotification(companyId, recipientUid, payload) {
  try {
    await db
      .collection("companies")
      .doc(companyId)
      .collection("notifications")
      .add({
        recipientUid,
        type:      payload.type,
        message:   payload.message,
        extra:     payload.extra || null,
        read:      false,
        createdAt: FieldValue.serverTimestamp(),
      });
  } catch (err) {
    logger.error("createNotification failed", { companyId, err: err.message });
  }
}

/**
 * Fetch a company document and return its data.
 * Throws if company does not exist.
 */
async function getCompany(companyId) {
  const snap = await db.collection("companies").doc(companyId).get();
  if (!snap.exists) throw new Error(`Company ${companyId} not found`);
  return { id: snap.id, ...snap.data() };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. onWalletRecharge — Razorpay wallet top-up webhook
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Prompt 1: Verify Razorpay signature, update wallet, create notification, log payment
 * Prompt 2: Use FieldValue.increment, create structured payment doc
 *
 * Expected Razorpay webhook body (payment.captured event):
 * {
 *   event: "payment.captured",
 *   payload: {
 *     payment: {
 *       entity: {
 *         id: "pay_xxx",
 *         amount: 50000,          // in paise
 *         notes: { companyId: "abc123" }
 *       }
 *     }
 *   }
 * }
 *
 * Alternatively (custom body for direct top-up):
 * { companyId: "abc123", amount: 500 }  // amount in ₹
 */
exports.onWalletRecharge = onRequest(
  { region: "asia-south1", timeoutSeconds: 30 },
  async (req, res) => {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    // ── Signature verification ────────────────────────────────────────────
    const signature = req.headers["x-razorpay-signature"] || "";
    const rawBody   = JSON.stringify(req.body); // req.body is already parsed

    if (RAZORPAY_WEBHOOK_SECRET) {
      const valid = verifyRazorpaySignature(rawBody, signature, RAZORPAY_WEBHOOK_SECRET);
      if (!valid) {
        logger.warn("onWalletRecharge: invalid Razorpay signature");
        return res.status(401).json({ error: "Invalid signature" });
      }
    }

    // ── Extract companyId + amount ────────────────────────────────────────
    let companyId, amountRupees, razorpayPaymentId;

    try {
      const body = req.body;

      // Handle standard Razorpay payment.captured webhook structure
      if (body.event === "payment.captured" && body.payload?.payment?.entity) {
        const entity = body.payload.payment.entity;
        razorpayPaymentId = entity.id;
        // Razorpay amount is in paise — convert to rupees
        amountRupees = Math.floor((entity.amount || 0) / 100);
        companyId    = entity.notes?.companyId || entity.description;
      } else {
        // Direct POST: { companyId, amount }
        companyId    = body.companyId;
        amountRupees = Number(body.amount) || 0;
        razorpayPaymentId = body.razorpayPaymentId || null;
      }

      if (!companyId || !amountRupees || amountRupees <= 0) {
        return res.status(400).json({ error: "Missing or invalid companyId / amount" });
      }
    } catch (err) {
      logger.error("onWalletRecharge: parse error", err.message);
      return res.status(400).json({ error: "Bad request body" });
    }

    // ── Idempotency check — prevent double-crediting same payment ─────────
    if (razorpayPaymentId) {
      const existing = await db
        .collection("payments")
        .where("razorpayPaymentId", "==", razorpayPaymentId)
        .limit(1)
        .get();
      if (!existing.empty) {
        logger.info("onWalletRecharge: duplicate payment, skipping", { razorpayPaymentId });
        return res.status(200).json({ status: "already_processed" });
      }
    }

    try {
      const company = await getCompany(companyId);

      // ── 1. Increment wallet balance ───────────────────────────────────────
      await db.collection("companies").doc(companyId).update({
        "wallet.balance":    FieldValue.increment(amountRupees),
        "wallet.lastTopUpAt": FieldValue.serverTimestamp(),
      });

      // ── 2. Log to payments collection ─────────────────────────────────────
      await db.collection("payments").add({
        companyId,
        amount:            amountRupees,
        type:              "wallet_recharge",
        status:            "completed",
        razorpayPaymentId: razorpayPaymentId || null,
        createdAt:         FieldValue.serverTimestamp(),
      });

      // ── 3. Notification to company admin ──────────────────────────────────
      if (company.adminUid) {
        await createNotification(companyId, company.adminUid, {
          type:    "payment",
          message: `Wallet recharged ₹${amountRupees.toLocaleString("en-IN")} successfully`,
          extra:   { amount: amountRupees, razorpayPaymentId },
        });
      }

      logger.info("onWalletRecharge: success", { companyId, amountRupees });
      return res.status(200).json({ status: "ok", companyId, amountRupees });
    } catch (err) {
      logger.error("onWalletRecharge: Firestore error", err.message);
      return res.status(500).json({ error: "Internal error" });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// 2. onCallEnd — Plivo call hangup webhook
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Prompt 1 spec:
 *   - billedMinutes = Math.ceil(durationSeconds / 60)
 *   - costToCustomer = billedMinutes * ₹1.00
 *   - Deduct from wallet.balance
 *   - Increment minutesUsedThisMonth
 *
 * Prompt 2 adds:
 *   - If balance <= 200 after deduction → low balance notification
 *   - If balance <= 0 → urgent notification, set balance to 0
 *
 * Plivo sends these fields on hangup:
 *   CallUUID, Duration (seconds), Direction, To, From, AnswerTime, HangupCause
 *   We store companyId in the outbound call's extra headers (X-PH-CompanyId)
 *   or pass it as a query param: ?companyId=xxx
 */
exports.onCallEnd = onRequest(
  { region: "asia-south1", timeoutSeconds: 30 },
  async (req, res) => {
    if (req.method !== "POST") {
      return res.status(405).send("Method not allowed");
    }

    // ── Extract call data from Plivo webhook body ─────────────────────────
    const body = req.body;

    const callUUID       = body.CallUUID || body.call_uuid || null;
    const durationStr    = body.Duration || body.duration || "0";
    const durationSeconds = parseInt(durationStr, 10) || 0;
    const direction      = body.Direction || body.direction || "outbound";
    const hangupCause    = body.HangupCause || body.hangup_cause || "unknown";

    // companyId passed as query param or custom header or body field
    const companyId =
      req.query.companyId ||
      req.headers["x-ph-companyid"] ||
      body.companyId ||
      null;

    // agentId for call logging
    const agentId  = req.query.agentId  || body.agentId  || null;
    const leadId   = req.query.leadId   || body.leadId   || null;
    const toNumber = body.To            || body.to        || null;

    if (!companyId) {
      logger.warn("onCallEnd: missing companyId", { callUUID });
      return res.status(400).send("Missing companyId");
    }

    // ── Billing calculation (Prompt 1 spec) ──────────────────────────────
    // Minimum 1 minute for answered calls; 0 cost for no-answer / busy
    const billableCall   = durationSeconds > 0 && hangupCause !== "NO_ANSWER" && hangupCause !== "USER_BUSY";
    const billedMinutes  = billableCall ? Math.ceil(durationSeconds / 60) : 0;
    const costToCustomer = billedMinutes * COST_PER_MINUTE; // ₹1.00 per min

    try {
      const company = await getCompany(companyId);
      const currentBalance = company.wallet?.balance ?? 0;
      const updatedBalance = Math.max(0, currentBalance - costToCustomer);

      // ── Firestore batch: update company + create call record ─────────────
      const batch = db.batch();

      // 2a. Deduct wallet and update usage stats
      const companyRef = db.collection("companies").doc(companyId);
      const walletUpdate = {
        "wallet.balance": updatedBalance, // explicit value to avoid going below 0
        updatedAt:        FieldValue.serverTimestamp(),
      };
      if (billedMinutes > 0) {
        walletUpdate["wallet.minutesUsedThisMonth"] = FieldValue.increment(billedMinutes);
        walletUpdate["wallet.totalMinutesUsed"]     = FieldValue.increment(billedMinutes);
      }
      batch.update(companyRef, walletUpdate);

      // 2b. Log call record
      const callRef = db.collection("calls").doc();
      batch.set(callRef, {
        companyId,
        agentId:          agentId   || null,
        leadId:           leadId    || null,
        callUUID:         callUUID  || null,
        toNumber:         toNumber  || null,
        direction,
        durationSeconds,
        billedMinutes,
        costToCustomer,
        hangupCause,
        balanceAfter:     updatedBalance,
        createdAt:        FieldValue.serverTimestamp(),
      });

      await batch.commit();

      // ── Low-balance notifications (Prompt 2 spec) ─────────────────────
      if (company.adminUid && costToCustomer > 0) {
        if (updatedBalance <= CRITICAL_BALANCE_THRESHOLD) {
          // Urgent — calling disabled
          await createNotification(companyId, company.adminUid, {
            type:    "wallet_critical",
            message: "Calling disabled — wallet empty. Recharge now.",
            extra:   { balance: updatedBalance },
          });
        } else if (updatedBalance <= LOW_BALANCE_THRESHOLD) {
          // Warning — low balance
          await createNotification(companyId, company.adminUid, {
            type:    "wallet_low",
            message: `Low wallet balance: ₹${updatedBalance.toFixed(2)} remaining. Recharge to keep calling.`,
            extra:   { balance: updatedBalance },
          });
        }
      }

      logger.info("onCallEnd: processed", {
        companyId, callUUID, durationSeconds, billedMinutes, costToCustomer, updatedBalance,
      });

      // Plivo expects 200 text/xml or text/plain
      return res.status(200).send("OK");
    } catch (err) {
      logger.error("onCallEnd: error", { companyId, err: err.message });
      return res.status(500).send("Internal error");
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// 3. onTrialExpiry — Daily scheduled function (06:00 IST = 00:30 UTC)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Prompt 1 spec:
 *   - Find companies where subscriptionStatus == "trial" AND trialEndDate < now
 *   - Update subscriptionStatus → "expired"
 *   - Create admin notification
 *   - Disable calling by setting wallet.balance to 0
 *
 * Prompt 2 names it checkTrialExpiry — merged into one function.
 * Schedule "30 0 * * *" = 00:30 UTC = 06:00 IST
 */
exports.onTrialExpiry = onSchedule(
  {
    schedule:  "30 0 * * *",   // 06:00 AM IST every day
    timeZone:  "Asia/Kolkata",
    region:    "asia-south1",
    timeoutSeconds: 120,
  },
  async () => {
    const now = new Date();
    logger.info("onTrialExpiry: running", { now: now.toISOString() });

    try {
      // Query all companies still on trial
      const trialSnap = await db
        .collection("companies")
        .where("subscriptionStatus", "==", "trial")
        .get();

      if (trialSnap.empty) {
        logger.info("onTrialExpiry: no trial companies found");
        return;
      }

      let expired = 0;
      const batchSize = 400; // Firestore batch limit is 500
      let batch = db.batch();
      let opCount = 0;

      for (const compDoc of trialSnap.docs) {
        const company = compDoc.data();

        // Check if trialEndDate has passed
        const trialEndDate = company.trialEndDate?.toDate
          ? company.trialEndDate.toDate()
          : null;

        if (!trialEndDate || trialEndDate > now) {
          // Trial still active — skip
          continue;
        }

        // ── Expire the company ─────────────────────────────────────────────
        batch.update(compDoc.ref, {
          subscriptionStatus:    "expired",
          trialExpiredAt:        FieldValue.serverTimestamp(),
          "wallet.balance":      0,           // Disable calling (Prompt 1)
          updatedAt:             FieldValue.serverTimestamp(),
        });
        opCount++;
        expired++;

        // ── Queue notification (outside batch — sub-collection write) ──────
        // We'll do notifications after committing the batch
        // Store notification data temporarily
        company._id       = compDoc.id;
        company._expiring = true;

        // Commit batch if approaching limit
        if (opCount >= batchSize) {
          await batch.commit();
          batch   = db.batch();
          opCount = 0;
        }
      }

      // Commit remaining batch
      if (opCount > 0) {
        await batch.commit();
      }

      // ── Create notifications for expired companies ──────────────────────
      const notifPromises = trialSnap.docs
        .filter(d => {
          const te = d.data().trialEndDate?.toDate ? d.data().trialEndDate.toDate() : null;
          return te && te <= now;
        })
        .map(d => {
          const data = d.data();
          if (!data.adminUid) return Promise.resolve();
          return createNotification(d.id, data.adminUid, {
            type:    "trial_expired",
            message: "Your 14-day trial has ended. Subscribe to continue using TIRAS.",
            extra:   { trialEndDate: data.trialEndDate },
          });
        });

      await Promise.allSettled(notifPromises);

      logger.info("onTrialExpiry: complete", { expired });
    } catch (err) {
      logger.error("onTrialExpiry: error", err.message);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// 4. onSubscriptionActivated — Razorpay subscription payment webhook
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Prompt 1 spec:
 *   - Triggered when subscription payment succeeds
 *   - Updates subscriptionStatus → "active"
 *   - Sets subscriptionStartDate and subscriptionEndDate (now + 1 year)
 *   - Creates welcome notification
 *
 * Prompt 2 spec:
 *   - Gets companyId, plan, amount from body
 *   - Updates company: subscriptionStatus "active", plan, dates
 *   - Notification: "Subscription activated. Welcome to TIRAS!"
 *
 * Razorpay subscription.charged webhook:
 * {
 *   event: "subscription.charged",
 *   payload: {
 *     subscription: { entity: { id: "sub_xxx", plan_id: "plan_xxx", notes: { companyId } } },
 *     payment:      { entity: { id: "pay_xxx", amount: 300000 } }
 *   }
 * }
 */
exports.onSubscriptionActivated = onRequest(
  { region: "asia-south1", timeoutSeconds: 30 },
  async (req, res) => {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    // ── Signature verification ────────────────────────────────────────────
    const signature = req.headers["x-razorpay-signature"] || "";
    const rawBody   = JSON.stringify(req.body);

    if (RAZORPAY_WEBHOOK_SECRET) {
      const valid = verifyRazorpaySignature(rawBody, signature, RAZORPAY_WEBHOOK_SECRET);
      if (!valid) {
        logger.warn("onSubscriptionActivated: invalid signature");
        return res.status(401).json({ error: "Invalid signature" });
      }
    }

    // ── Extract data ──────────────────────────────────────────────────────
    let companyId, plan, amountRupees, razorpaySubscriptionId, razorpayPaymentId;

    try {
      const body = req.body;

      if (body.event === "subscription.charged" && body.payload?.subscription?.entity) {
        const subEntity  = body.payload.subscription.entity;
        const payEntity  = body.payload.payment?.entity || {};
        razorpaySubscriptionId = subEntity.id;
        razorpayPaymentId      = payEntity.id || null;
        companyId              = subEntity.notes?.companyId || null;
        plan                   = subEntity.notes?.plan      || null;
        amountRupees           = Math.floor((payEntity.amount || 0) / 100);
      } else {
        // Direct POST for testing: { companyId, plan, amount }
        companyId              = body.companyId;
        plan                   = body.plan;
        amountRupees           = Number(body.amount) || 0;
        razorpaySubscriptionId = body.razorpaySubscriptionId || null;
        razorpayPaymentId      = body.razorpayPaymentId      || null;
      }

      if (!companyId) {
        return res.status(400).json({ error: "Missing companyId" });
      }
    } catch (err) {
      logger.error("onSubscriptionActivated: parse error", err.message);
      return res.status(400).json({ error: "Bad request body" });
    }

    // ── Idempotency check ─────────────────────────────────────────────────
    if (razorpayPaymentId) {
      const existing = await db
        .collection("payments")
        .where("razorpayPaymentId", "==", razorpayPaymentId)
        .limit(1)
        .get();
      if (!existing.empty) {
        logger.info("onSubscriptionActivated: duplicate, skipping", { razorpayPaymentId });
        return res.status(200).json({ status: "already_processed" });
      }
    }

    try {
      const company = await getCompany(companyId);

      const now   = new Date();
      const oneYearLater = new Date(now);
      oneYearLater.setFullYear(now.getFullYear() + 1);

      // ── 1. Update company subscription fields ─────────────────────────
      const updatePayload = {
        subscriptionStatus:    "active",
        subscriptionStartDate: admin.firestore.Timestamp.fromDate(now),
        subscriptionEndDate:   admin.firestore.Timestamp.fromDate(oneYearLater),
        updatedAt:             FieldValue.serverTimestamp(),
      };
      if (plan) updatePayload.plan = plan;

      await db.collection("companies").doc(companyId).update(updatePayload);

      // ── 2. Log payment ────────────────────────────────────────────────
      if (amountRupees > 0) {
        await db.collection("payments").add({
          companyId,
          amount:                amountRupees,
          type:                  "subscription",
          status:                "completed",
          plan:                  plan || company.plan || null,
          razorpaySubscriptionId: razorpaySubscriptionId || null,
          razorpayPaymentId:     razorpayPaymentId      || null,
          subscriptionStartDate: admin.firestore.Timestamp.fromDate(now),
          subscriptionEndDate:   admin.firestore.Timestamp.fromDate(oneYearLater),
          createdAt:             FieldValue.serverTimestamp(),
        });
      }

      // ── 3. Welcome notification ───────────────────────────────────────
      if (company.adminUid) {
        await createNotification(companyId, company.adminUid, {
          type:    "subscription_active",
          message: "Subscription activated. Welcome to TIRAS! Your team can now make calls.",
          extra:   {
            plan,
            subscriptionEndDate: oneYearLater.toISOString(),
          },
        });
      }

      logger.info("onSubscriptionActivated: success", { companyId, plan, amountRupees });
      return res.status(200).json({ status: "ok", companyId, plan, subscriptionEndDate: oneYearLater });
    } catch (err) {
      logger.error("onSubscriptionActivated: error", { companyId, err: err.message });
      return res.status(500).json({ error: "Internal error" });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// 5. scheduledTTLCleanup — Daily 02:00 IST recording retention cleanup
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Prompt 1 spec — verify retention days match plans:
 *   Starter:    15 days
 *   Basic:      30 days
 *   Growth:     90 days
 *   Enterprise: 365 days
 *
 * For each company:
 *   - Find calls where recordingUrl is set AND createdAt < (now - retentionDays)
 *   - Delete recording from Firebase Storage
 *   - Clear recordingUrl from call document
 *   - Set recordingExpired = true on call
 *
 * Schedule: 02:00 IST = 20:30 UTC previous day → use "30 20 * * *"
 */
exports.scheduledTTLCleanup = onSchedule(
  {
    schedule:  "30 20 * * *",  // 02:00 AM IST every day
    timeZone:  "Asia/Kolkata",
    region:    "asia-south1",
    timeoutSeconds: 540,        // 9 minutes — allow large cleanup
    memory:    "512MiB",
  },
  async () => {
    const now = new Date();
    logger.info("scheduledTTLCleanup: running", { now: now.toISOString() });

    try {
      // Fetch all companies to know their plan → retention days
      const companiesSnap = await db.collection("companies").get();

      let totalDeleted = 0;

      for (const compDoc of companiesSnap.docs) {
        const company   = compDoc.data();
        const companyId = compDoc.id;

        // Determine plan — normalise to lowercase
        const planKey        = (company.plan || "basic").toLowerCase();
        const retentionDays  = RETENTION_DAYS[planKey] || RETENTION_DAYS.basic;
        const cutoffDate     = new Date(now);
        cutoffDate.setDate(now.getDate() - retentionDays);
        const cutoffTimestamp = admin.firestore.Timestamp.fromDate(cutoffDate);

        // Find expired recordings for this company
        const expiredCallsSnap = await db
          .collection("calls")
          .where("companyId",      "==", companyId)
          .where("recordingExpired", "==", false)
          .where("createdAt",      "<",  cutoffTimestamp)
          .limit(200) // process in chunks to avoid timeout
          .get();

        if (expiredCallsSnap.empty) continue;

        const bucket = admin.storage().bucket();
        let batch    = db.batch();
        let opCount  = 0;

        for (const callDoc of expiredCallsSnap.docs) {
          const callData    = callDoc.data();
          const recordingUrl = callData.recordingUrl || null;

          // ── Delete from Firebase Storage if path is stored ───────────
          if (recordingUrl) {
            try {
              // recordingUrl can be a gs:// path or a storage path like recordings/xxx.mp3
              let storagePath = recordingUrl;
              if (recordingUrl.startsWith("gs://")) {
                // Extract path after bucket name
                storagePath = recordingUrl.split("/").slice(3).join("/");
              } else if (recordingUrl.startsWith("https://")) {
                // Extract path from download URL
                const match = recordingUrl.match(/\/o\/(.+?)\?/);
                storagePath = match ? decodeURIComponent(match[1]) : null;
              }

              if (storagePath) {
                await bucket.file(storagePath).delete({ ignoreNotFound: true });
              }
            } catch (storageErr) {
              logger.warn("scheduledTTLCleanup: storage delete failed", {
                callId: callDoc.id,
                err: storageErr.message,
              });
            }
          }

          // ── Mark call recording as expired in Firestore ──────────────
          batch.update(callDoc.ref, {
            recordingUrl:     null,
            recordingExpired: true,
            recordingDeletedAt: FieldValue.serverTimestamp(),
          });

          opCount++;
          totalDeleted++;

          // Commit batch at 400 to stay under Firestore limit
          if (opCount >= 400) {
            await batch.commit();
            batch   = db.batch();
            opCount = 0;
          }
        }

        if (opCount > 0) {
          await batch.commit();
        }

        logger.info("scheduledTTLCleanup: company done", {
          companyId, plan: planKey, retentionDays, deleted: expiredCallsSnap.size,
        });
      }

      logger.info("scheduledTTLCleanup: complete", { totalDeleted });
    } catch (err) {
      logger.error("scheduledTTLCleanup: error", err.message);
    }
  }
);
