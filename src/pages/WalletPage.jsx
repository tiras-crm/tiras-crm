// TIRAS CRM V2 — Wallet Page
// Route: /admin/wallet
// Company Admin only — agents and managers cannot access
// Features: live balance, recharge buttons, custom amount, transaction history, low balance warning

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  doc, onSnapshot, collection, query, where,
  orderBy, limit, getDocs,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, COLLECTIONS, functions } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import {
  COLORS, FONTS, SPACING, RADIUS, SHADOWS,
  TRANSITIONS, STYLES, WALLET,
} from "../theme";

// ─── Inject styles ────────────────────────────────────────────────────────────

const injectStyles = () => {
  if (document.getElementById("tiras-wallet-styles")) return;
  const s = document.createElement("style");
  s.id = "tiras-wallet-styles";
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:wght@400;500;600;700&display=swap');
    @keyframes w-fade  { from{opacity:0;transform:translateY(10px);} to{opacity:1;transform:translateY(0);} }
    @keyframes w-spin  { 0%{transform:rotate(0deg);} 100%{transform:rotate(360deg);} }
    @keyframes w-count { from{opacity:0;} to{opacity:1;} }
    @keyframes w-shimmer {
      0%   { background-position: -600px 0; }
      100% { background-position:  600px 0; }
    }
    .w-topup-btn { transition: all 0.2s ease; }
    .w-topup-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(212,175,55,0.3) !important; }
    .w-topup-btn:active { transform: translateY(0); }
    .w-input:focus { border-color: ${COLORS.primary} !important; outline: none; box-shadow: 0 0 0 2px rgba(212,175,55,0.15); }
    .w-input::placeholder { color: ${COLORS.textMuted}; }
    .w-row:hover { background-color: ${COLORS.surfaceHover} !important; }
  `;
  document.head.appendChild(s);
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatINR = (n = 0) =>
  "₹" + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n);

const formatDate = (ts) => {
  if (!ts) return "—";
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true });
};

// ─── Shimmer skeleton ─────────────────────────────────────────────────────────

const Shimmer = ({ w = "100%", h = "16px" }) => (
  <div style={{
    width: w, height: h, borderRadius: RADIUS.base,
    background: `linear-gradient(90deg,${COLORS.surface} 0%,${COLORS.surfaceHover} 40%,${COLORS.surface} 80%)`,
    backgroundSize: "600px 100%",
    animation: "w-shimmer 1.4s ease-in-out infinite",
  }} />
);

// ─── Balance Card ─────────────────────────────────────────────────────────────

const BalanceCard = ({ balance, loading }) => {
  const isLow = balance !== null && balance <= WALLET.lowBalanceAlert;
  const isCritical = balance !== null && balance < WALLET.minCallBalance;

  return (
    <div style={{
      ...STYLES.card,
      background: `linear-gradient(135deg, ${COLORS.surface} 0%, rgba(212,175,55,0.06) 100%)`,
      border: `1px solid ${isLow ? COLORS.accent : COLORS.primary}40`,
      borderRadius: RADIUS.xl,
      padding: SPACING["2xl"],
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Gold shimmer bar top */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: `linear-gradient(90deg, transparent, ${COLORS.primary}, transparent)` }} />

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: SPACING.base }}>
        <div>
          <div style={{ fontFamily: FONTS.body, fontSize: FONTS.size.sm, fontWeight: FONTS.weight.medium, color: COLORS.textSecondary, marginBottom: SPACING.sm, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Wallet Balance
          </div>

          {loading ? (
            <Shimmer w="160px" h="52px" />
          ) : (
            <div style={{ fontFamily: FONTS.heading, fontSize: "clamp(36px, 6vw, 52px)", fontWeight: 700, color: isCritical ? COLORS.accent : isLow ? COLORS.warning : COLORS.primary, lineHeight: 1, animation: "w-count 0.4s ease" }}>
              {formatINR(balance ?? 0)}
            </div>
          )}

          <div style={{ fontFamily: FONTS.body, fontSize: FONTS.size.sm, color: COLORS.textMuted, marginTop: SPACING.sm }}>
            {loading ? <Shimmer w="180px" h="14px" /> : (
              balance !== null
                ? `≈ ${Math.floor((balance ?? 0) / WALLET.ratePerMinute).toLocaleString("en-IN")} minutes of calling remaining`
                : ""
            )}
          </div>
        </div>

        {/* Status indicator */}
        <div style={{
          padding: `${SPACING.sm} ${SPACING.base}`,
          borderRadius: RADIUS.full,
          backgroundColor: isCritical ? COLORS.accentMuted : isLow ? COLORS.warningMuted : COLORS.primaryMuted,
          border: `1px solid ${isCritical ? COLORS.accent : isLow ? COLORS.warning : COLORS.primary}40`,
          fontFamily: FONTS.body,
          fontSize: FONTS.size.sm,
          fontWeight: FONTS.weight.semibold,
          color: isCritical ? COLORS.accent : isLow ? COLORS.warning : COLORS.primary,
          display: "flex",
          alignItems: "center",
          gap: SPACING.xs,
        }}>
          <span>{isCritical ? "🚨" : isLow ? "⚠️" : "✓"}</span>
          {isCritical ? "Calling Blocked" : isLow ? "Low Balance" : "Active"}
        </div>
      </div>

      {/* Critical warning */}
      {isCritical && (
        <div style={{ marginTop: SPACING.lg, padding: SPACING.base, backgroundColor: COLORS.accentMuted, border: `1px solid ${COLORS.accent}30`, borderRadius: RADIUS.md, fontFamily: FONTS.body, fontSize: FONTS.size.sm, color: COLORS.accent, lineHeight: 1.5 }}>
          🚨 Calling is disabled. Balance is below ₹{WALLET.minCallBalance}. Recharge immediately to resume calling.
        </div>
      )}

      {/* Low balance warning */}
      {!isCritical && isLow && (
        <div style={{ marginTop: SPACING.lg, padding: SPACING.base, backgroundColor: COLORS.warningMuted, border: `1px solid ${COLORS.warning}30`, borderRadius: RADIUS.md, fontFamily: FONTS.body, fontSize: FONTS.size.sm, color: COLORS.warning, lineHeight: 1.5 }}>
          ⚠️ Balance below ₹{WALLET.lowBalanceAlert}. Recharge soon to avoid disruption to your calling team.
        </div>
      )}
    </div>
  );
};

// ─── Rate Info Cards ──────────────────────────────────────────────────────────

const RateCard = ({ label, value, sub, color }) => (
  <div style={{ ...STYLES.card, textAlign: "center", padding: SPACING.lg }}>
    <div style={{ fontFamily: FONTS.heading, fontSize: "26px", fontWeight: 700, color: color || COLORS.primary }}>{value}</div>
    <div style={{ fontFamily: FONTS.body, fontSize: FONTS.size.sm, fontWeight: FONTS.weight.semibold, color: COLORS.textPrimary, marginTop: SPACING.xs }}>{label}</div>
    {sub && <div style={{ fontFamily: FONTS.body, fontSize: FONTS.size.xs, color: COLORS.textMuted, marginTop: "2px" }}>{sub}</div>}
  </div>
);

// ─── Top-up Section ───────────────────────────────────────────────────────────

const TOP_UP_OPTIONS = [
  { amount: 1000, minutes: "1,000", label: "₹1,000" },
  { amount: 2000, minutes: "2,000", label: "₹2,000" },
  { amount: 5000, minutes: "5,000", label: "₹5,000" },
];

const TopUpSection = ({ companyId, companyName, adminEmail, onSuccess }) => {
  const [customAmt,  setCustomAmt]  = useState("");
  const [loading,    setLoading]    = useState(null);  // amount being processed
  const [error,      setError]      = useState(null);

  const handleTopUp = async (amount) => {
    if (!amount || amount < WALLET.minTopUp) {
      setError(`Minimum top-up amount is ₹${WALLET.minTopUp.toLocaleString("en-IN")}.`);
      return;
    }
    setLoading(amount);
    setError(null);

    try {
      const createLink = httpsCallable(functions, "createRazorpayPaymentLink");
      const result = await createLink({
        amount_inr:      amount,
        description:     `TIRAS CRM Wallet Top-up — ₹${amount.toLocaleString("en-IN")}`,
        customer_name:   companyName || "Company",
        customer_email:  adminEmail  || "",
        customer_phone:  "",
        lead_id:         "",
        company_id:      companyId,
        agent_id:        "",
        notes:           `Wallet top-up: ₹${amount} | Company: ${companyName}`,
        type:            "wallet_topup",
      });

      const url = result.data?.payment_link_url || result.data?.short_url;
      if (url) {
        window.open(url, "_blank");
        if (onSuccess) onSuccess(amount);
      } else {
        throw new Error("No payment link returned from server.");
      }
    } catch (err) {
      setError(err.message?.includes("deployed") ? err.message : "Failed to create payment link. Please contact Tony on WhatsApp.");
    } finally {
      setLoading(null);
    }
  };

  const handleCustomSubmit = () => {
    const amt = parseInt(customAmt.replace(/[^0-9]/g, ""), 10);
    if (isNaN(amt) || amt < WALLET.minTopUp) {
      setError(`Enter a valid amount of at least ₹${WALLET.minTopUp.toLocaleString("en-IN")}.`);
      return;
    }
    handleTopUp(amt);
  };

  return (
    <div style={{ ...STYLES.card, display: "flex", flexDirection: "column", gap: SPACING.xl }}>
      <div>
        <h3 style={{ fontFamily: FONTS.heading, fontSize: "18px", fontWeight: 700, color: COLORS.textPrimary, margin: 0 }}>
          Recharge Wallet
        </h3>
        <p style={{ fontFamily: FONTS.body, fontSize: FONTS.size.sm, color: COLORS.textSecondary, margin: `${SPACING.xs} 0 0` }}>
          Secure payment via Razorpay · UPI, cards, net banking accepted
        </p>
      </div>

      {/* Quick top-up buttons */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: SPACING.base }}>
        {TOP_UP_OPTIONS.map(({ amount, minutes, label }) => {
          const isLoading = loading === amount;
          return (
            <button
              key={amount}
              className="w-topup-btn"
              onClick={() => handleTopUp(amount)}
              disabled={!!loading}
              style={{
                backgroundColor: COLORS.primaryMuted,
                border:          `1px solid ${COLORS.primary}40`,
                borderRadius:    RADIUS.lg,
                padding:         `${SPACING.lg} ${SPACING.base}`,
                cursor:          loading ? "not-allowed" : "pointer",
                textAlign:       "center",
                opacity:         loading && !isLoading ? 0.5 : 1,
              }}
            >
              {isLoading ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: SPACING.xs }}>
                  <span style={{ width: "14px", height: "14px", borderRadius: "50%", border: `2px solid transparent`, borderTop: `2px solid ${COLORS.primary}`, display: "inline-block", animation: "w-spin 0.65s linear infinite" }} />
                  <span style={{ fontFamily: FONTS.body, fontSize: FONTS.size.sm, color: COLORS.primary }}>Opening…</span>
                </div>
              ) : (
                <>
                  <div style={{ fontFamily: FONTS.heading, fontSize: "22px", fontWeight: 700, color: COLORS.primary }}>{label}</div>
                  <div style={{ fontFamily: FONTS.body, fontSize: FONTS.size.xs, color: COLORS.textMuted, marginTop: "4px" }}>{minutes} minutes</div>
                </>
              )}
            </button>
          );
        })}
      </div>

      {/* Custom amount */}
      <div>
        <div style={{ fontFamily: FONTS.body, fontSize: FONTS.size.sm, fontWeight: FONTS.weight.medium, color: COLORS.textSecondary, marginBottom: SPACING.sm }}>
          Custom Amount
        </div>
        <div style={{ display: "flex", gap: SPACING.sm }}>
          <div style={{ position: "relative", flex: 1 }}>
            <span style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", fontFamily: FONTS.mono, fontSize: FONTS.size.base, color: COLORS.textSecondary, pointerEvents: "none" }}>₹</span>
            <input
              className="w-input"
              type="number"
              min={WALLET.minTopUp}
              step={100}
              placeholder={`Minimum ₹${WALLET.minTopUp.toLocaleString("en-IN")}`}
              value={customAmt}
              onChange={(e) => { setCustomAmt(e.target.value); setError(null); }}
              style={{ ...STYLES.input, fontFamily: FONTS.mono, paddingLeft: "32px" }}
            />
          </div>
          <button
            className="w-topup-btn"
            onClick={handleCustomSubmit}
            disabled={!!loading}
            style={{ ...STYLES.buttonPrimary, flexShrink: 0, opacity: loading ? 0.6 : 1 }}
          >
            {loading === "custom" ? "…" : "Pay →"}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: SPACING.md, backgroundColor: COLORS.accentMuted, border: `1px solid ${COLORS.accent}30`, borderRadius: RADIUS.md, fontFamily: FONTS.body, fontSize: FONTS.size.sm, color: COLORS.accent }}>
          {error}
        </div>
      )}
    </div>
  );
};

// ─── Transaction History ──────────────────────────────────────────────────────

const TransactionHistory = ({ companyId }) => {
  const [txns,    setTxns]    = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) return;

    const fetch = async () => {
      try {
        const q = query(
          collection(db, COLLECTIONS.PAYMENTS),
          where("companyId", "==", companyId),
          where("type",      "==", "wallet_topup"),
          orderBy("createdAt", "desc"),
          limit(20)
        );
        const snap = await getDocs(q);
        setTxns(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("WalletPage: txn history error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetch();
  }, [companyId]);

  return (
    <div style={{ ...STYLES.card, display: "flex", flexDirection: "column", gap: SPACING.base }}>
      <h3 style={{ fontFamily: FONTS.heading, fontSize: "18px", fontWeight: 700, color: COLORS.textPrimary, margin: 0 }}>
        Recharge History
      </h3>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: SPACING.sm }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: `${SPACING.sm} 0` }}>
              <Shimmer w="140px" h="14px" />
              <Shimmer w="80px"  h="14px" />
            </div>
          ))}
        </div>
      ) : txns.length === 0 ? (
        <div style={{ textAlign: "center", padding: SPACING["2xl"], fontFamily: FONTS.body, fontSize: FONTS.size.base, color: COLORS.textMuted }}>
          No recharge history yet. Make your first top-up above.
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "460px" }}>
            <thead>
              <tr>
                {["Date", "Amount", "Razorpay ID", "Status"].map((h) => (
                  <th key={h} style={{ ...STYLES.tableHeader, textAlign: "left", padding: `${SPACING.sm} ${SPACING.base}`, borderBottom: `1px solid ${COLORS.border}` }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {txns.map((txn, i) => (
                <tr
                  key={txn.id}
                  className="w-row"
                  style={{
                    borderBottom:    `1px solid ${COLORS.border}`,
                    backgroundColor: i % 2 === 0 ? "transparent" : `${COLORS.surfaceActive}40`,
                    transition:      TRANSITIONS.fast,
                  }}
                >
                  <td style={{ padding: `${SPACING.sm} ${SPACING.base}`, fontFamily: FONTS.body, fontSize: FONTS.size.sm, color: COLORS.textSecondary }}>
                    {formatDate(txn.createdAt)}
                  </td>
                  <td style={{ padding: `${SPACING.sm} ${SPACING.base}`, fontFamily: FONTS.mono, fontSize: FONTS.size.base, fontWeight: 600, color: COLORS.primary }}>
                    +{formatINR(txn.amount)}
                  </td>
                  <td style={{ padding: `${SPACING.sm} ${SPACING.base}`, fontFamily: FONTS.mono, fontSize: FONTS.size.xs, color: COLORS.textMuted }}>
                    {txn.razorpayPaymentId || "—"}
                  </td>
                  <td style={{ padding: `${SPACING.sm} ${SPACING.base}` }}>
                    <span style={{
                      fontFamily:      FONTS.body,
                      fontSize:        "11px",
                      fontWeight:      700,
                      padding:         "3px 10px",
                      borderRadius:    RADIUS.full,
                      backgroundColor: txn.status === "paid" ? COLORS.successMuted : COLORS.warningMuted,
                      color:           txn.status === "paid" ? COLORS.success : COLORS.warning,
                    }}>
                      {txn.status === "paid" ? "Credited" : "Pending"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ─── WalletPage ───────────────────────────────────────────────────────────────

export const WalletPage = () => {
  injectStyles();

  const { companyId, currentUser, isCompanyAdmin } = useAuth();
  const navigate = useNavigate();

  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);

  // Guard — only company admin
  useEffect(() => {
    if (!isCompanyAdmin) { navigate("/agent/dashboard"); return; }
  }, [isCompanyAdmin, navigate]);

  // Real-time company subscription
  useEffect(() => {
    if (!companyId) return;
    const unsub = onSnapshot(
      doc(db, COLLECTIONS.COMPANIES, companyId),
      (snap) => { if (snap.exists()) { setCompany({ id: snap.id, ...snap.data() }); setLoading(false); } },
      () => setLoading(false)
    );
    return () => unsub();
  }, [companyId]);

  const balance         = company?.wallet?.balance ?? null;
  const minutesThisMonth = company?.minutesUsedThisMonth ?? 0;

  return (
    <div style={{ minHeight: "calc(100vh - 56px)", backgroundColor: COLORS.background, padding: SPACING.xl, fontFamily: FONTS.body }}>
      <div style={{ maxWidth: "900px", margin: "0 auto", animation: "w-fade 0.35s ease" }}>

        {/* ── Page header ─────────────────────────────────────────────────── */}
        <div style={{ marginBottom: SPACING["2xl"] }}>
          <h1 style={{ fontFamily: FONTS.heading, fontSize: "22px", fontWeight: 700, color: COLORS.textPrimary, margin: 0 }}>
            Calling Wallet
          </h1>
          <p style={{ fontFamily: FONTS.body, fontSize: FONTS.size.sm, color: COLORS.textSecondary, marginTop: SPACING.xs }}>
            Manage your calling balance · ₹1 per minute · Billed in 60-second pulses
          </p>
        </div>

        {/* ── Balance card ─────────────────────────────────────────────────── */}
        <div style={{ marginBottom: SPACING.xl }}>
          <BalanceCard balance={balance} loading={loading} />
        </div>

        {/* ── Rate info cards ──────────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: SPACING.base, marginBottom: SPACING.xl }}>
          <RateCard label="Rate per Minute"  value="₹1.00"  sub="Charged to you"      color={COLORS.primary} />
          <RateCard label="Minutes Used"     value={minutesThisMonth.toLocaleString("en-IN")} sub="This month" color={COLORS.info} />
          <RateCard label="Cost This Month"  value={formatINR(minutesThisMonth * WALLET.ratePerMinute)} sub="At ₹1/min" color={COLORS.warning} />
          <RateCard label="Min Top-up"       value="₹1,000" sub="≈ 1,000 minutes"      color={COLORS.success} />
        </div>

        {/* ── Top-up + History ─────────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: SPACING.xl }}>
          <TopUpSection
            companyId={companyId}
            companyName={company?.name}
            adminEmail={currentUser?.email}
          />
          <TransactionHistory companyId={companyId} />
        </div>

        {/* ── How billing works ────────────────────────────────────────────── */}
        <div style={{ ...STYLES.card, marginTop: SPACING.xl }}>
          <h3 style={{ fontFamily: FONTS.heading, fontSize: "16px", fontWeight: 700, color: COLORS.textPrimary, margin: `0 0 ${SPACING.base}` }}>
            How Wallet Billing Works
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: SPACING.base }}>
            {[
              { icon: "💳", title: "Recharge", desc: "Top up your wallet using UPI, card, or net banking via Razorpay." },
              { icon: "📞", title: "Call", desc: "Your agents call leads. Each call deducts from the wallet in real-time." },
              { icon: "⏱️", title: "60-Second Pulse", desc: "Billing rounds up to nearest minute. A 61-second call = 2 minutes billed." },
              { icon: "⚠️", title: "Low Balance", desc: "You get notified at ₹200. Calls are blocked below ₹5." },
            ].map(({ icon, title, desc }) => (
              <div key={title} style={{ display: "flex", flexDirection: "column", gap: SPACING.xs }}>
                <div style={{ fontSize: "22px" }}>{icon}</div>
                <div style={{ fontFamily: FONTS.body, fontSize: FONTS.size.sm, fontWeight: FONTS.weight.semibold, color: COLORS.textPrimary }}>{title}</div>
                <div style={{ fontFamily: FONTS.body, fontSize: FONTS.size.sm, color: COLORS.textSecondary, lineHeight: 1.5 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WalletPage;
