// TIRAS CRM — Razorpay Service
// Handles: payment link generation, payment record logging, invoice PDF, lead stage auto-update
//
// ARCHITECTURE DECISION (from master doc):
//   Payments collected via web dashboard ONLY — NOT through Play Store
//   This avoids Google's 15% commission on in-app purchases
//   Razorpay charges only 2% per transaction — far cheaper
//   Payment links sent via WhatsApp button or copy-paste — no checkout UI needed
//
// SETUP REQUIRED:
//   No npm install needed — uses Razorpay REST API via fetch
//   Add to your .env file:
//     REACT_APP_RAZORPAY_KEY_ID=rzp_live_XXXXXXXXXXXX
//
//   WARNING: Never put RAZORPAY_KEY_SECRET in frontend env vars
//   Payment link creation must go through a backend (Firebase Cloud Function)
//   This service calls your Cloud Function endpoint — not Razorpay directly
//   Your Cloud Function holds the secret key safely server-side
//
// HOW PAYMENT FLOW WORKS IN TIRAS:
//   Agent opens Lead Detail → enters amount → clicks Generate Link
//   razorpayService.createPaymentLink() → calls Firebase Cloud Function
//   Cloud Function uses secret key to hit Razorpay API → returns payment link URL
//   Agent copies link → sends via WhatsApp button to customer
//   Customer pays → Razorpay webhook fires → Cloud Function updates lead stage to Closed Won
//   Payment record saved in Firestore payments collection

import { jsPDF } from "jspdf";
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  query,
  where,
  getDocs,
  serverTimestamp,
  orderBy,
} from "firebase/firestore";
import { db, COLLECTIONS } from "../firebase";
import { getFunctions, httpsCallable } from "firebase/functions";
import { functions } from "../firebase";

// ─── Config ──────────────────────────────────────────────────────────────────

const RAZORPAY_KEY_ID = process.env.REACT_APP_RAZORPAY_KEY_ID;

// Cloud Function name — must match what you deploy in functions/index.js
const CF_CREATE_PAYMENT_LINK = "createRazorpayPaymentLink";
const CF_GET_PAYMENT_STATUS  = "getRazorpayPaymentStatus";

// ─── createPaymentLink ────────────────────────────────────────────────────────
// Generates a Razorpay payment link for a lead
// Calls Firebase Cloud Function (which holds the secret key server-side)
//
// @param amount        number   Amount in INR (full rupees, not paise) e.g. 15000
// @param description   string   What the payment is for e.g. "TIRAS CRM - Growth Plan 6 months"
// @param leadId        string   Firestore lead document ID
// @param leadName      string   Lead's full name — pre-fills Razorpay checkout
// @param phone         string   Lead's phone number (with country code) e.g. "+919876543210"
// @param email         string   Lead's email (optional) — Razorpay sends receipt
// @param agentId       string   Agent who generated this link
// @param companyId     string   Company scope
// @param notes         string   Internal note about this payment (not shown to customer)
//
// @returns { paymentLinkId, paymentLinkUrl, paymentDocId } | throws on failure

export const createPaymentLink = async ({
  amount,
  description,
  leadId,
  leadName,
  phone,
  email = "",
  agentId,
  companyId,
  notes = "",
}) => {
  // ── Input validation ────────────────────────────────────────────────────

  if (!amount || isNaN(amount) || amount <= 0) {
    throw new Error("Amount must be a positive number in INR.");
  }

  if (amount < 100) {
    throw new Error("Minimum payment amount is ₹100.");
  }

  if (!leadId || !agentId || !companyId) {
    throw new Error("leadId, agentId, and companyId are required.");
  }

  if (!phone) {
    throw new Error("Lead phone number is required to generate a payment link.");
  }

  // Normalise phone — strip spaces and dashes, ensure + prefix
  const normalizedPhone = phone.replace(/[\s\-()]/g, "");
  const e164Phone = normalizedPhone.startsWith("+")
    ? normalizedPhone
    : `+91${normalizedPhone}`;  // Default to India if no country code

  if (!/^\+\d{10,15}$/.test(e164Phone)) {
    throw new Error(`Invalid phone number format: ${phone}. Use E.164 format e.g. +919876543210`);
  }

  // ── Call Cloud Function to create Razorpay payment link ─────────────────
  // The Cloud Function holds RAZORPAY_KEY_SECRET — never expose that in frontend

  const createLink = httpsCallable(functions, CF_CREATE_PAYMENT_LINK);

  let razorpayResponse;

  try {
    const result = await createLink({
      amount_inr: amount,          // Cloud Function converts to paise (×100) for Razorpay
      description,
      customer_name: leadName,
      customer_phone: e164Phone,
      customer_email: email,
      lead_id: leadId,
      company_id: companyId,
      agent_id: agentId,
      notes,
    });

    razorpayResponse = result.data;

    if (!razorpayResponse?.payment_link_url) {
      throw new Error("Cloud Function returned invalid Razorpay response");
    }

  } catch (err) {
    if (err.code === "functions/not-found") {
      throw new Error(
        "Cloud Function 'createRazorpayPaymentLink' not deployed yet. Deploy functions/index.js first."
      );
    }
    throw new Error(`Payment link creation failed: ${err.message}`);
  }

  const { payment_link_id, payment_link_url, short_url } = razorpayResponse;

  // ── Save payment record to Firestore ─────────────────────────────────────

  const paymentDoc = await addDoc(collection(db, COLLECTIONS.PAYMENTS), {
    leadId,
    agentId,
    companyId,
    leadName,
    phone: e164Phone,
    email,
    amount,                           // INR
    amountPaise: amount * 100,        // Razorpay works in paise
    description,
    notes,
    paymentLinkId: payment_link_id,
    paymentLinkUrl: payment_link_url,
    shortUrl: short_url || payment_link_url,
    status: "created",                // created → sent → paid → expired | failed
    razorpayPaymentId: null,          // filled when customer pays (via webhook)
    paidAt: null,
    expiresAt: null,                  // Razorpay default: 15 minutes if not set
    invoiceGenerated: false,
    invoicePdfUrl: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // ── Update lead timeline with payment link event ──────────────────────────

  await _addLeadTimelineEvent(leadId, {
    type: "payment_link_created",
    amount,
    paymentLinkUrl: short_url || payment_link_url,
    paymentDocId: paymentDoc.id,
    agentId,
    note: `Payment link of ₹${formatINR(amount)} created`,
  });

  console.log(`TIRAS Razorpay: Payment link created — ₹${amount} for lead ${leadId}`);

  return {
    paymentLinkId: payment_link_id,
    paymentLinkUrl: payment_link_url,
    shortUrl: short_url || payment_link_url,
    paymentDocId: paymentDoc.id,
  };
};

// ─── markPaymentReceived ──────────────────────────────────────────────────────
// Called by Cloud Function webhook when Razorpay confirms payment
// Also callable manually by admin if needed
// Auto-updates lead stage to "Closed Won"
//
// @param paymentDocId     string   Firestore payments document ID
// @param razorpayPaymentId string  Razorpay payment ID from webhook
// @param leadId           string   Lead to auto-close

export const markPaymentReceived = async ({
  paymentDocId,
  razorpayPaymentId,
  leadId,
  amount,
  companyId,
}) => {
  if (!paymentDocId) throw new Error("paymentDocId is required.");

  // ── Update payment record ─────────────────────────────────────────────────

  await updateDoc(doc(db, COLLECTIONS.PAYMENTS, paymentDocId), {
    status: "paid",
    razorpayPaymentId,
    paidAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // ── Auto-move lead to Closed Won ──────────────────────────────────────────
  // Master doc Section 8: "When customer pays — lead stage auto-updates to Closed Won"

  if (leadId) {
    await updateDoc(doc(db, COLLECTIONS.LEADS, leadId), {
      stage: "Closed Won",
      closedAt: serverTimestamp(),
      closedReason: `Payment received — ₹${formatINR(amount || 0)}`,
      updatedAt: serverTimestamp(),
    });

    await _addLeadTimelineEvent(leadId, {
      type: "payment_received",
      amount,
      razorpayPaymentId,
      note: `Payment of ₹${formatINR(amount || 0)} received. Lead moved to Closed Won.`,
    });
  }

  // ── Create notification for agent and admin ───────────────────────────────

  if (leadId && companyId) {
    await addDoc(collection(db, COLLECTIONS.NOTIFICATIONS), {
      companyId,
      type: "payment_received",
      title: "Payment Received",
      body: `₹${formatINR(amount || 0)} payment confirmed for lead.`,
      leadId,
      paymentDocId,
      isRead: false,
      createdAt: serverTimestamp(),
    });
  }

  console.log(`TIRAS Razorpay: Payment marked received — ${razorpayPaymentId}`);
};

// ─── getPaymentHistory ────────────────────────────────────────────────────────
// Returns all payment records for a lead — shown in Lead Detail Page timeline
//
// @returns Array of payment objects sorted by newest first

export const getPaymentHistory = async (leadId, companyId) => {
  if (!leadId || !companyId) return [];

  try {
    const q = query(
      collection(db, COLLECTIONS.PAYMENTS),
      where("leadId", "==", leadId),
      where("companyId", "==", companyId),
      orderBy("createdAt", "desc")
    );

    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error("TIRAS Razorpay: getPaymentHistory error:", err);
    return [];
  }
};

// ─── getCompanyPaymentSummary ─────────────────────────────────────────────────
// Admin dashboard — total revenue collected this month vs pipeline value
//
// @returns { totalCollected, totalPending, paymentCount }

export const getCompanyPaymentSummary = async (companyId) => {
  if (!companyId) return { totalCollected: 0, totalPending: 0, paymentCount: 0 };

  try {
    const q = query(
      collection(db, COLLECTIONS.PAYMENTS),
      where("companyId", "==", companyId)
    );

    const snap = await getDocs(q);
    const payments = snap.docs.map((d) => d.data());

    const totalCollected = payments
      .filter((p) => p.status === "paid")
      .reduce((sum, p) => sum + (p.amount || 0), 0);

    const totalPending = payments
      .filter((p) => p.status === "created" || p.status === "sent")
      .reduce((sum, p) => sum + (p.amount || 0), 0);

    return {
      totalCollected,
      totalPending,
      paymentCount: payments.filter((p) => p.status === "paid").length,
    };
  } catch (err) {
    console.error("TIRAS Razorpay: getCompanyPaymentSummary error:", err);
    return { totalCollected: 0, totalPending: 0, paymentCount: 0 };
  }
};

// ─── generateInvoicePDF ───────────────────────────────────────────────────────
// Generates a basic invoice PDF using jsPDF — free, no external service needed
// Master doc Section 8: "Basic invoice PDF generated using jsPDF library — free"
// Downloads directly to user's browser
//
// @param payment   object   Payment record from Firestore
// @param company   object   Company details { name, address, gstin, phone, email }

export const generateInvoicePDF = async (payment, company = {}) => {
  if (!payment) throw new Error("Payment object is required to generate invoice.");

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;

  // ── Color helpers ──────────────────────────────────────────────────────────
  // Carbon Copper palette — #B65E3C primary, #121212 background (not in PDF — use on paper)
  const setCopper = () => pdf.setTextColor(182, 94, 60);   // #B65E3C
  const setDark   = () => pdf.setTextColor(30, 30, 30);    // near-black for body text
  const setGray   = () => pdf.setTextColor(120, 120, 120); // secondary text

  // ── Invoice number ─────────────────────────────────────────────────────────
  const invoiceNumber = `INV-${payment.razorpayPaymentId?.slice(-8)?.toUpperCase() || Date.now().toString().slice(-8)}`;
  const invoiceDate = payment.paidAt?.toDate
    ? payment.paidAt.toDate().toLocaleDateString("en-IN", {
        day: "2-digit", month: "long", year: "numeric",
      })
    : new Date().toLocaleDateString("en-IN", {
        day: "2-digit", month: "long", year: "numeric",
      });

  let y = margin;

  // ── Header — TIRAS branding ────────────────────────────────────────────────

  // Logo block (coloured rectangle as placeholder)
  pdf.setFillColor(182, 94, 60); // primary copper
  pdf.roundedRect(margin, y, 14, 14, 2, 2, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(255, 255, 255);
  pdf.text("T", margin + 4.5, y + 9.5);

  // App name
  setCopper();
  pdf.setFontSize(20);
  pdf.setFont("helvetica", "bold");
  pdf.text("TIRAS CRM", margin + 18, y + 10);

  // Company info (top right)
  setGray();
  pdf.setFontSize(8);
  pdf.setFont("helvetica", "normal");
  const companyLines = [
    company.name || "TIRAS CRM Platform",
    company.address || "",
    company.gstin ? `GSTIN: ${company.gstin}` : "",
    company.phone || "",
    company.email || "",
  ].filter(Boolean);

  let companyY = y + 3;
  companyLines.forEach((line) => {
    pdf.text(line, pageWidth - margin, companyY, { align: "right" });
    companyY += 4;
  });

  y += 22;

  // Horizontal divider
  pdf.setDrawColor(182, 94, 60);
  pdf.setLineWidth(0.5);
  pdf.line(margin, y, pageWidth - margin, y);
  y += 8;

  // ── Invoice title ──────────────────────────────────────────────────────────

  setCopper();
  pdf.setFontSize(16);
  pdf.setFont("helvetica", "bold");
  pdf.text("INVOICE", margin, y);

  setGray();
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.text(`Invoice No: ${invoiceNumber}`, pageWidth - margin, y - 4, { align: "right" });
  pdf.text(`Date: ${invoiceDate}`, pageWidth - margin, y + 1, { align: "right" });

  y += 12;

  // ── Bill To ────────────────────────────────────────────────────────────────

  setGray();
  pdf.setFontSize(8);
  pdf.setFont("helvetica", "bold");
  pdf.text("BILL TO", margin, y);

  y += 5;
  setDark();
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  pdf.text(payment.leadName || "Customer", margin, y);

  y += 5;
  setGray();
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  if (payment.phone) { pdf.text(`Phone: ${payment.phone}`, margin, y); y += 4; }
  if (payment.email) { pdf.text(`Email: ${payment.email}`, margin, y); y += 4; }

  y += 6;

  // ── Line item table ────────────────────────────────────────────────────────

  // Table header row
  pdf.setFillColor(245, 245, 245);
  pdf.rect(margin, y, contentWidth, 8, "F");

  setGray();
  pdf.setFontSize(8);
  pdf.setFont("helvetica", "bold");
  pdf.text("DESCRIPTION", margin + 3, y + 5.5);
  pdf.text("AMOUNT (₹)", pageWidth - margin - 3, y + 5.5, { align: "right" });

  y += 8;

  // Single line item
  setDark();
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  pdf.text(payment.description || "CRM Subscription", margin + 3, y + 6);
  pdf.text(formatINR(payment.amount || 0), pageWidth - margin - 3, y + 6, { align: "right" });

  y += 12;

  // Subtotal row
  pdf.setDrawColor(220, 220, 220);
  pdf.setLineWidth(0.3);
  pdf.line(margin, y, pageWidth - margin, y);
  y += 5;

  setGray();
  pdf.setFontSize(9);
  pdf.text("Subtotal", pageWidth - margin - 50, y);
  setDark();
  pdf.text(`₹${formatINR(payment.amount || 0)}`, pageWidth - margin - 3, y, { align: "right" });

  y += 5;

  // Platform fee note (2% Razorpay — absorbed, not charged to customer)
  setGray();
  pdf.setFontSize(8);
  pdf.text("Processing fee", pageWidth - margin - 50, y);
  pdf.text("Included", pageWidth - margin - 3, y, { align: "right" });

  y += 6;

  // Total
  pdf.setFillColor(182, 94, 60);
  pdf.rect(margin, y, contentWidth, 10, "F");

  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(255, 255, 255);
  pdf.text("TOTAL PAID", margin + 3, y + 7);
  pdf.text(`₹${formatINR(payment.amount || 0)}`, pageWidth - margin - 3, y + 7, { align: "right" });

  y += 18;

  // ── Payment details block ──────────────────────────────────────────────────

  pdf.setFillColor(252, 250, 248);  // Light warm background
  pdf.roundedRect(margin, y, contentWidth, 20, 2, 2, "F");

  setGray();
  pdf.setFontSize(8);
  pdf.setFont("helvetica", "bold");
  pdf.text("PAYMENT DETAILS", margin + 4, y + 5);

  pdf.setFont("helvetica", "normal");
  setDark();
  const paymentDetails = [
    ["Payment ID", payment.razorpayPaymentId || "N/A"],
    ["Method", "Razorpay"],
    ["Status", "PAID ✓"],
  ];

  let detailY = y + 10;
  paymentDetails.forEach(([label, value]) => {
    setGray();
    pdf.text(`${label}:`, margin + 4, detailY);
    setDark();
    pdf.text(value, margin + 35, detailY);
    detailY += 4;
  });

  y += 28;

  // ── Notes / Terms ──────────────────────────────────────────────────────────

  if (payment.notes) {
    setGray();
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "italic");
    const noteLines = pdf.splitTextToSize(`Note: ${payment.notes}`, contentWidth);
    pdf.text(noteLines, margin, y);
    y += noteLines.length * 4 + 4;
  }

  // ── Footer ─────────────────────────────────────────────────────────────────

  const footerY = 275;
  pdf.setDrawColor(220, 220, 220);
  pdf.setLineWidth(0.3);
  pdf.line(margin, footerY, pageWidth - margin, footerY);

  setGray();
  pdf.setFontSize(7.5);
  pdf.setFont("helvetica", "normal");
  pdf.text(
    "This is a computer-generated invoice. No signature required.",
    pageWidth / 2,
    footerY + 5,
    { align: "center" }
  );
  pdf.text(
    "Powered by TIRAS CRM — Beyond Every Limit",
    pageWidth / 2,
    footerY + 10,
    { align: "center" }
  );

  // ── Save / Download ────────────────────────────────────────────────────────

  const fileName = `TIRAS_Invoice_${invoiceNumber}_${payment.leadName?.replace(/\s+/g, "_") || "Customer"}.pdf`;
  pdf.save(fileName);

  // Mark invoice as generated in Firestore
  if (payment.id) {
    await updateDoc(doc(db, COLLECTIONS.PAYMENTS, payment.id), {
      invoiceGenerated: true,
      invoiceGeneratedAt: serverTimestamp(),
      invoiceFileName: fileName,
    });
  }

  console.log(`TIRAS Razorpay: Invoice PDF downloaded — ${fileName}`);
  return fileName;
};

// ─── copyPaymentLink ──────────────────────────────────────────────────────────
// Copies payment link to clipboard — convenience helper for the UI button

export const copyPaymentLink = async (url) => {
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch (err) {
    // Fallback for browsers that block clipboard API without user gesture
    const el = document.createElement("textarea");
    el.value = url;
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
    return true;
  }
};

// ─── buildWhatsAppPaymentMessage ──────────────────────────────────────────────
// Builds the pre-filled WhatsApp message that opens when agent taps the button
// No Meta API — just opens wa.me with encoded message text

export const buildWhatsAppPaymentMessage = (leadName, amount, paymentUrl, agentName = "") => {
  const message = [
    `Dear ${leadName},`,
    ``,
    `Please find your payment link below for ₹${formatINR(amount)}:`,
    ``,
    paymentUrl,
    ``,
    `This link is secure and generated via Razorpay.`,
    agentName ? `\nBest regards,\n${agentName}` : "",
  ]
    .filter((line) => line !== undefined)
    .join("\n");

  return encodeURIComponent(message);
};

// ─── openWhatsAppWithPayment ──────────────────────────────────────────────────
// Opens WhatsApp on the agent's phone with the payment message pre-filled
// Works on both mobile (wa.me) and desktop (web.whatsapp.com)

export const openWhatsAppWithPayment = (phone, leadName, amount, paymentUrl, agentName = "") => {
  const normalizedPhone = phone.replace(/[^0-9]/g, ""); // Strip all non-digits
  const encodedMessage = buildWhatsAppPaymentMessage(leadName, amount, paymentUrl, agentName);
  const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);

  const waUrl = isMobile
    ? `whatsapp://send?phone=${normalizedPhone}&text=${encodedMessage}`
    : `https://web.whatsapp.com/send?phone=${normalizedPhone}&text=${encodedMessage}`;

  window.open(waUrl, "_blank");
};

// ─── formatINR (utility) ──────────────────────────────────────────────────────
// Formats number as Indian currency string e.g. 150000 → "1,50,000"

export const formatINR = (amount = 0) => {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(amount);
};

// ─── _addLeadTimelineEvent (private) ─────────────────────────────────────────
// Logs payment events to lead's activity timeline
// Shared timeline collection used by calls, notes, stage changes, and payments

const _addLeadTimelineEvent = async (leadId, event) => {
  try {
    await addDoc(collection(db, "lead_timeline"), {
      leadId,
      ...event,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.error("TIRAS Razorpay: Failed to log lead timeline event:", err);
  }
};

export default {
  createPaymentLink,
  markPaymentReceived,
  getPaymentHistory,
  getCompanyPaymentSummary,
  generateInvoicePDF,
  copyPaymentLink,
  openWhatsAppWithPayment,
  buildWhatsAppPaymentMessage,
  formatINR,
};
