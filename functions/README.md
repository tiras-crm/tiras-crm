# TIRAS CRM V2 — Cloud Functions

## Functions Overview

| Function | Trigger | Schedule | Purpose |
|---|---|---|---|
| `onWalletRecharge` | HTTP POST | On demand | Razorpay wallet top-up webhook |
| `onCallEnd` | HTTP POST | On demand | Plivo call hangup webhook |
| `onTrialExpiry` | Scheduled | 06:00 IST daily | Expire trial companies |
| `onSubscriptionActivated` | HTTP POST | On demand | Razorpay subscription webhook |
| `scheduledTTLCleanup` | Scheduled | 02:00 IST daily | Delete expired call recordings |

---

## Folder Structure

```
functions/
├── index.js          ← All 5 Cloud Functions
├── package.json      ← Dependencies (firebase-admin, firebase-functions v2)
├── .env.example      ← Environment variable template
└── README.md         ← This file
```

---

## Setup

### 1. Install dependencies
```bash
cd functions
npm install
```

### 2. Set environment secrets (production)
```bash
# Set Razorpay webhook secret in Firebase Secret Manager
firebase functions:secrets:set RAZORPAY_WEBHOOK_SECRET

# Verify
firebase functions:secrets:access RAZORPAY_WEBHOOK_SECRET
```

### 3. Local testing with emulator
```bash
# Copy env template
cp .env.example .env
# Fill in your values in .env

# Start emulator
firebase emulators:start --only functions
```

### 4. Deploy
```bash
# Deploy all functions
firebase deploy --only functions

# Deploy a single function
firebase deploy --only functions:onWalletRecharge
```

---

## Firestore Collections Used

| Collection | Purpose |
|---|---|
| `companies` | Company docs — wallet, plan, subscription status |
| `companies/{id}/notifications` | Per-company admin notifications |
| `calls` | Call logs with billing, duration, recording URLs |
| `payments` | Payment logs — wallet recharges, subscriptions |

### companies document fields (relevant to functions)

```js
{
  adminUid:            "firebase_uid_of_company_admin",
  plan:                "basic" | "growth" | "enterprise" | "starter",
  subscriptionStatus:  "trial" | "active" | "expired",
  trialEndDate:        Timestamp,
  subscriptionStartDate: Timestamp,
  subscriptionEndDate:   Timestamp,
  wallet: {
    balance:            500,    // ₹ balance
    minutesUsedThisMonth: 120,
    totalMinutesUsed:   340,
    lastTopUpAt:        Timestamp,
  }
}
```

---

## Webhook Configuration

### Razorpay Dashboard Setup

**onWalletRecharge**
- Event: `payment.captured`
- URL: `https://asia-south1-YOUR_PROJECT.cloudfunctions.net/onWalletRecharge`
- Ensure `notes.companyId` is passed when creating the Razorpay order

**onSubscriptionActivated**
- Event: `subscription.charged`
- URL: `https://asia-south1-YOUR_PROJECT.cloudfunctions.net/onSubscriptionActivated`
- Ensure `notes.companyId` and `notes.plan` are set on the subscription

### Plivo Setup

**onCallEnd**
- Set as the Answer URL hangup callback on your Plivo application
- URL: `https://asia-south1-YOUR_PROJECT.cloudfunctions.net/onCallEnd?companyId=COMPANY_ID&agentId=AGENT_ID&leadId=LEAD_ID`
- Pass `companyId`, `agentId`, `leadId` as query params when initiating the call

---

## Billing Logic

### Call cost
```
billedMinutes  = Math.ceil(durationSeconds / 60)   // minimum 1 minute
costToCustomer = billedMinutes × ₹1.00
newBalance     = max(0, currentBalance - costToCustomer)
```

### Low balance alerts
| Balance | Notification |
|---|---|
| ≤ ₹200 | Warning — "Low wallet balance: ₹X remaining" |
| ≤ ₹0 | Urgent — "Calling disabled — wallet empty. Recharge now." |

---

## Recording Retention (TTL Cleanup)

| Plan | Retention |
|---|---|
| Starter | 15 days |
| Basic | 30 days |
| Growth | 90 days |
| Enterprise | 365 days |

The cleanup function runs at **02:00 IST daily**. It:
1. Deletes the recording file from Firebase Storage
2. Sets `recordingUrl: null` on the call document
3. Sets `recordingExpired: true` on the call document

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `RAZORPAY_WEBHOOK_SECRET` | Yes | From Razorpay Dashboard > Webhooks |
| `RAZORPAY_KEY_ID` | Optional | For server-side Razorpay API calls |
| `RAZORPAY_KEY_SECRET` | Optional | For server-side Razorpay API calls |
| `PLIVO_AUTH_ID` | Optional | For Plivo webhook verification |
| `PLIVO_AUTH_TOKEN` | Optional | For Plivo webhook verification |

---

## Function URLs (after deploy)

```
Region: asia-south1

onWalletRecharge:
  https://asia-south1-PROJECT_ID.cloudfunctions.net/onWalletRecharge

onCallEnd:
  https://asia-south1-PROJECT_ID.cloudfunctions.net/onCallEnd

onSubscriptionActivated:
  https://asia-south1-PROJECT_ID.cloudfunctions.net/onSubscriptionActivated

onTrialExpiry:      (scheduled — no URL)
scheduledTTLCleanup: (scheduled — no URL)
```

Replace `PROJECT_ID` with your Firebase project ID.

---

## Logs

```bash
# Stream all function logs
firebase functions:log

# Logs for a specific function
firebase functions:log --only onCallEnd

# Last 100 lines
firebase functions:log --lines 100
```
