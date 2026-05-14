// TIRAS CRM — Companies List
// Role: platform_owner — full list of every company on the platform
// Features: search, filter by plan/status/industry, sort, bulk actions, CSV export, add company modal
// No companyId scoping — platform owner sees everything

import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  query,
  getDocs,
  doc,
  updateDoc,
  addDoc,
  serverTimestamp,
  orderBy,
  where,
} from "firebase/firestore";
import { db, COLLECTIONS } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import {
  COLORS, FONTS, SPACING, RADIUS, SHADOWS, STYLES, TRANSITIONS,
} from "../theme";

// ─── Constants ────────────────────────────────────────────────────────────────

const PLANS    = ["All Plans", "Basic", "Growth", "Enterprise"];
const STATUSES = ["All Status", "active", "suspended", "trial", "inactive"];
const INDUSTRIES = [
  "All Industries", "Staffing", "Real Estate", "Manufacturing", "EdTech",
  "Healthcare", "Retail", "Finance", "IT Services", "Logistics", "Other",
];

const PLAN_META = {
  Basic:      { color: COLORS.info,    bg: COLORS.infoMuted,    price: "₹1,800/mo"  },
  Growth:     { color: COLORS.accent,  bg: COLORS.accentMuted,  price: "₹3,000/mo"  },
  Enterprise: { color: COLORS.primary, bg: COLORS.primaryMuted, price: "Custom"      },
};

const STATUS_META = {
  active:    { color: COLORS.success,     bg: COLORS.successMuted,  label: "Active"    },
  suspended: { color: COLORS.danger,      bg: COLORS.dangerMuted,   label: "Suspended" },
  trial:     { color: COLORS.warning,     bg: COLORS.warningMuted,  label: "Trial"     },
  inactive:  { color: COLORS.textMuted,   bg: COLORS.surfaceActive, label: "Inactive"  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtDate = (ts) => {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

const fmtDateShort = (ts) => {
  if (!ts) return "—";
  const d  = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7)  return `${diff}d ago`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

const exportCSV = (rows) => {
  const headers = ["Name", "Industry", "Plan", "Status", "Admin Email", "Agents", "Leads", "Joined", "Last Active"];
  const lines   = rows.map((c) => [
    `"${c.name || ""}"`,
    `"${c.industry || ""}"`,
    c.plan || "",
    c.status || "",
    `"${c.adminEmail || ""}"`,
    c.agentCount || 0,
    c.leadCount || 0,
    fmtDate(c.createdAt),
    fmtDateShort(c.lastActiveAt),
  ].join(","));
  const blob = new Blob([[headers.join(","), ...lines].join("\n")], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `tiras-companies-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const Shimmer = ({ w = "100%", h = "14px", r = RADIUS.base }) => (
  <div style={{
    width: w, height: h, borderRadius: r,
    background: `linear-gradient(90deg,${COLORS.surface} 25%,#2a2a2a 50%,${COLORS.surface} 75%)`,
    backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite",
  }} />
);

const PlanBadge = ({ plan }) => {
  const m = PLAN_META[plan] || { color: COLORS.textMuted, bg: COLORS.surfaceActive };
  return (
    <span style={{ ...STYLES.badge, backgroundColor: m.bg, color: m.color, border: `1px solid ${m.color}33`, fontSize: FONTS.size.xs }}>
      {plan || "—"}
    </span>
  );
};

const StatusBadge = ({ status }) => {
  const m = STATUS_META[status] || STATUS_META.inactive;
  return (
    <span style={{ ...STYLES.badge, backgroundColor: m.bg, color: m.color, fontSize: FONTS.size.xs }}>
      <span style={{ width: "5px", height: "5px", borderRadius: "50%", backgroundColor: m.color, display: "inline-block" }} />
      {m.label}
    </span>
  );
};

const FilterChip = ({ label, active, onClick }) => (
  <button onClick={onClick} style={{
    padding: `${SPACING.xs} ${SPACING.md}`, borderRadius: RADIUS.full, fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.semibold, cursor: "pointer", transition: TRANSITIONS.fast, fontFamily: FONTS.family,
    border: `1px solid ${active ? COLORS.primary : COLORS.border}`,
    backgroundColor: active ? COLORS.primaryMuted : "transparent",
    color: active ? COLORS.primary : COLORS.textSecondary,
    whiteSpace: "nowrap",
  }}>
    {label}
  </button>
);

// ─── Add Company Modal ────────────────────────────────────────────────────────

const AddCompanyModal = ({ onClose, onAdded }) => {
  const [form, setForm] = useState({
    name: "", adminEmail: "", industry: "Staffing", plan: "Basic", city: "", phone: "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState("");

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.adminEmail.trim()) {
      setErr("Company name and admin email are required.");
      return;
    }
    setSaving(true);
    try {
      const ref = await addDoc(collection(db, COLLECTIONS.COMPANIES), {
        name:        form.name.trim(),
        adminEmail:  form.adminEmail.trim(),
        industry:    form.industry,
        plan:        form.plan,
        city:        form.city.trim(),
        phone:       form.phone.trim(),
        status:      "trial",
        agentCount:  0,
        leadCount:   0,
        createdAt:   serverTimestamp(),
        lastActiveAt: serverTimestamp(),
      });
      onAdded({ id: ref.id, ...form, status: "trial", agentCount: 0, leadCount: 0, createdAt: { toDate: () => new Date() } });
      onClose();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  const field = (label, key, type = "text", opts) => (
    <div>
      <label style={{ fontSize: FONTS.size.xs, color: COLORS.textMuted, display: "block", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</label>
      {opts ? (
        <select value={form[key]} onChange={set(key)} style={{ ...STYLES.input }}>
          {opts.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input type={type} value={form[key]} onChange={set(key)} style={{ ...STYLES.input }} />
      )}
    </div>
  );

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.65)", zIndex: 200 }} />
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
        backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}`,
        borderRadius: RADIUS.xl, padding: SPACING["2xl"], width: "480px",
        boxShadow: SHADOWS.lg, zIndex: 201, fontFamily: FONTS.family, maxHeight: "90vh", overflowY: "auto",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: SPACING.xl }}>
          <div>
            <div style={{ fontSize: FONTS.size.xl, fontWeight: FONTS.weight.bold, color: COLORS.textPrimary }}>Add New Company</div>
            <div style={{ fontSize: FONTS.size.xs, color: COLORS.textMuted, marginTop: "2px" }}>Company will be created with Trial status</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: COLORS.textMuted, cursor: "pointer", fontSize: FONTS.size["2xl"], lineHeight: 1, padding: 0 }}>×</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: SPACING.base }}>
          {field("Company Name *", "name")}
          {field("Admin Email *", "adminEmail", "email")}
          {field("Industry", "industry", "text", INDUSTRIES.slice(1))}
          {field("Plan", "plan", "text", ["Basic", "Growth", "Enterprise"])}
          {field("City", "city")}
          {field("Phone", "phone", "tel")}
        </div>

        {err && (
          <div style={{ marginTop: SPACING.base, padding: SPACING.sm, backgroundColor: COLORS.dangerMuted, border: `1px solid ${COLORS.danger}`, borderRadius: RADIUS.base, fontSize: FONTS.size.xs, color: COLORS.danger }}>
            {err}
          </div>
        )}

        <div style={{ display: "flex", gap: SPACING.sm, marginTop: SPACING.xl }}>
          <button onClick={onClose} style={{ ...STYLES.buttonSecondary, flex: 1, padding: SPACING.sm }}>Cancel</button>
          <button onClick={handleSubmit} disabled={saving} style={{ ...STYLES.buttonPrimary, flex: 1, padding: SPACING.sm, opacity: saving ? 0.7 : 1 }}>
            {saving ? "Adding…" : "Add Company"}
          </button>
        </div>
      </div>
    </>
  );
};

// ─── Bulk Action Bar ──────────────────────────────────────────────────────────

const BulkBar = ({ count, onSuspend, onChangePlan, onClear, saving }) => (
  <div style={{
    position: "fixed", bottom: SPACING.xl, left: "50%", transform: "translateX(-50%)",
    backgroundColor: COLORS.surface, border: `1px solid ${COLORS.primary}55`,
    borderRadius: RADIUS.xl, padding: `${SPACING.sm} ${SPACING.xl}`,
    display: "flex", alignItems: "center", gap: SPACING.base,
    boxShadow: SHADOWS.lg, zIndex: 50, fontFamily: FONTS.family,
  }}>
    <div style={{ fontSize: FONTS.size.sm, color: COLORS.textPrimary, fontWeight: FONTS.weight.semibold }}>
      {count} selected
    </div>
    <div style={{ width: "1px", height: "20px", backgroundColor: COLORS.border }} />
    <button onClick={onChangePlan} style={{ ...STYLES.buttonSecondary, padding: `${SPACING.xs} ${SPACING.md}`, fontSize: FONTS.size.sm }}>
      Change Plan
    </button>
    <button onClick={onSuspend} disabled={saving} style={{ padding: `${SPACING.xs} ${SPACING.md}`, fontSize: FONTS.size.sm, fontFamily: FONTS.family, border: `1px solid ${COLORS.danger}44`, borderRadius: RADIUS.base, backgroundColor: COLORS.dangerMuted, color: COLORS.danger, cursor: "pointer" }}>
      {saving ? "Working…" : "Suspend All"}
    </button>
    <button onClick={onClear} style={{ background: "none", border: "none", color: COLORS.textMuted, cursor: "pointer", fontSize: FONTS.size.lg, padding: 0 }}>×</button>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

export const CompaniesList = () => {
  const { isPlatformOwner } = useAuth();
  const navigate = useNavigate();

  const [companies, setCompanies] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [showAdd, setShowAdd]     = useState(false);

  // Filters
  const [search, setSearch]         = useState("");
  const [planFilter, setPlanFilter] = useState("All Plans");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [industryFilter, setIndustryFilter] = useState("All Industries");

  // Sort
  const [sortCol, setSortCol] = useState("createdAt");
  const [sortDir, setSortDir] = useState("desc");

  // Selection
  const [selected, setSelected] = useState(new Set());
  const [bulkSaving, setBulkSaving] = useState(false);

  // View
  const [viewMode, setViewMode] = useState("table"); // table | cards

  // ─── Fetch ─────────────────────────────────────────────────────────────

  const fetchCompanies = useCallback(async () => {
    try {
      setLoading(true);
      const snap = await getDocs(
        query(collection(db, COLLECTIONS.COMPANIES), orderBy("createdAt", "desc"))
      );
      setCompanies(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCompanies(); }, [fetchCompanies]);

  // ─── Derived ───────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let r = [...companies];

    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter((c) =>
        (c.name || "").toLowerCase().includes(q) ||
        (c.adminEmail || "").toLowerCase().includes(q) ||
        (c.industry || "").toLowerCase().includes(q) ||
        (c.city || "").toLowerCase().includes(q)
      );
    }
    if (planFilter !== "All Plans")       r = r.filter((c) => c.plan === planFilter);
    if (statusFilter !== "All Status")    r = r.filter((c) => (c.status || "active") === statusFilter);
    if (industryFilter !== "All Industries") r = r.filter((c) => c.industry === industryFilter);

    r.sort((a, b) => {
      let aV, bV;
      if (sortCol === "name")       { aV = (a.name||"").toLowerCase(); bV = (b.name||"").toLowerCase(); return sortDir === "asc" ? aV.localeCompare(bV) : bV.localeCompare(aV); }
      if (sortCol === "agentCount") { aV = a.agentCount||0; bV = b.agentCount||0; }
      else if (sortCol === "leadCount") { aV = a.leadCount||0; bV = b.leadCount||0; }
      else                          { aV = a.createdAt?.seconds||0; bV = b.createdAt?.seconds||0; }
      return sortDir === "asc" ? aV - bV : bV - aV;
    });
    return r;
  }, [companies, search, planFilter, statusFilter, industryFilter, sortCol, sortDir]);

  const handleSort = (col) => {
    if (sortCol === col) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("desc"); }
  };

  // ─── Selection ─────────────────────────────────────────────────────────

  const toggleOne = (id) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((c) => c.id)));
  };

  // ─── Bulk suspend ───────────────────────────────────────────────────────

  const handleBulkSuspend = async () => {
    setBulkSaving(true);
    try {
      await Promise.all(
        [...selected].map((id) => updateDoc(doc(db, COLLECTIONS.COMPANIES, id), { status: "suspended" }))
      );
      setCompanies((prev) => prev.map((c) => selected.has(c.id) ? { ...c, status: "suspended" } : c));
      setSelected(new Set());
    } catch (e) { console.error(e); }
    finally { setBulkSaving(false); }
  };

  // ─── Toggle single status ───────────────────────────────────────────────

  const toggleStatus = async (company) => {
    const next = company.status === "suspended" ? "active" : "suspended";
    await updateDoc(doc(db, COLLECTIONS.COMPANIES, company.id), { status: next });
    setCompanies((prev) => prev.map((c) => c.id === company.id ? { ...c, status: next } : c));
  };

  const SortArrow = ({ col }) =>
    sortCol !== col
      ? <span style={{ color: COLORS.textMuted, fontSize: "10px", marginLeft: "3px" }}>↕</span>
      : <span style={{ color: COLORS.primary, fontSize: "10px", marginLeft: "3px" }}>{sortDir === "asc" ? "↑" : "↓"}</span>;

  // ─── Access guard ───────────────────────────────────────────────────────

  if (!isPlatformOwner) return (
    <div style={{ minHeight: "100vh", backgroundColor: COLORS.background, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONTS.family }}>
      <div style={{ textAlign: "center", color: COLORS.textMuted }}><div style={{ fontSize: "40px" }}>🔒</div><div style={{ marginTop: SPACING.base }}>Platform Owner access required.</div></div>
    </div>
  );

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
        ::-webkit-scrollbar{width:6px;height:6px}
        ::-webkit-scrollbar-track{background:${COLORS.scrollbarTrack}}
        ::-webkit-scrollbar-thumb{background:${COLORS.scrollbarThumb};border-radius:3px}
        .co-row:hover{background-color:${COLORS.surfaceHover}!important}
        .co-card:hover{border-color:${COLORS.primary}55!important;transform:translateY(-1px)}
        .icon-btn:hover{color:${COLORS.primary}!important;border-color:${COLORS.primary}!important}
      `}</style>

      <div style={{ minHeight: "100vh", backgroundColor: COLORS.background, padding: `${SPACING.xl} ${SPACING["2xl"]}`, fontFamily: FONTS.family, color: COLORS.textPrimary }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: SPACING.xl }}>
          <div>
            <div style={{ fontSize: FONTS.size.xs, color: COLORS.accent, fontWeight: FONTS.weight.semibold, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: SPACING.xs }}>
              Platform Owner
            </div>
            <h1 style={{ fontSize: FONTS.size["4xl"], fontWeight: FONTS.weight.bold, margin: 0, lineHeight: 1.1 }}>Companies</h1>
            <div style={{ fontSize: FONTS.size.sm, color: COLORS.textSecondary, marginTop: SPACING.xs }}>
              {loading ? "Loading…" : `${filtered.length} of ${companies.length} companies`}
            </div>
          </div>
          <div style={{ display: "flex", gap: SPACING.sm, alignItems: "center" }}>
            <button onClick={() => exportCSV(filtered)} style={{ ...STYLES.buttonSecondary, fontSize: FONTS.size.sm, padding: `${SPACING.sm} ${SPACING.base}` }}>
              ↓ Export CSV
            </button>
            <button onClick={fetchCompanies} style={{ ...STYLES.buttonSecondary, fontSize: FONTS.size.sm, padding: `${SPACING.sm} ${SPACING.base}` }}>
              ↻
            </button>
            <button onClick={() => setShowAdd(true)} style={{ ...STYLES.buttonPrimary, fontSize: FONTS.size.sm, padding: `${SPACING.sm} ${SPACING.base}` }}>
              + Add Company
            </button>
          </div>
        </div>

        {/* ── Error ── */}
        {error && (
          <div style={{ backgroundColor: COLORS.dangerMuted, border: `1px solid ${COLORS.danger}`, borderRadius: RADIUS.md, padding: SPACING.base, color: COLORS.danger, fontSize: FONTS.size.sm, marginBottom: SPACING.xl }}>⚠ {error}</div>
        )}

        {/* ── Filters ── */}
        <div style={{ ...STYLES.card, padding: `${SPACING.base} ${SPACING.xl}`, marginBottom: SPACING.base }}>
          {/* Search */}
          <div style={{ position: "relative", marginBottom: SPACING.base }}>
            <span style={{ position: "absolute", left: SPACING.md, top: "50%", transform: "translateY(-50%)", color: COLORS.textMuted, pointerEvents: "none" }}>🔍</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, city, or industry…"
              style={{ ...STYLES.input, paddingLeft: "36px", backgroundColor: COLORS.surfaceHover }}
            />
            {search && (
              <button onClick={() => setSearch("")} style={{ position: "absolute", right: SPACING.md, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: COLORS.textMuted, cursor: "pointer", fontSize: FONTS.size.xl, lineHeight: 1, padding: 0 }}>×</button>
            )}
          </div>

          {/* Filter chips */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: SPACING.xs, alignItems: "center" }}>
            {/* Plan */}
            {PLANS.map((p) => <FilterChip key={p} label={p} active={planFilter === p} onClick={() => setPlanFilter(p)} />)}
            <div style={{ width: "1px", height: "18px", backgroundColor: COLORS.border, margin: `0 ${SPACING.xs}` }} />
            {/* Status */}
            {STATUSES.map((s) => (
              <FilterChip key={s} label={s === "All Status" ? s : (STATUS_META[s]?.label || s)} active={statusFilter === s} onClick={() => setStatusFilter(s)} />
            ))}
            <div style={{ width: "1px", height: "18px", backgroundColor: COLORS.border, margin: `0 ${SPACING.xs}` }} />
            {/* Industry — dropdown for space */}
            <select
              value={industryFilter}
              onChange={(e) => setIndustryFilter(e.target.value)}
              style={{ ...STYLES.input, width: "auto", padding: `${SPACING.xs} ${SPACING.md}`, fontSize: FONTS.size.xs, cursor: "pointer" }}
            >
              {INDUSTRIES.map((i) => <option key={i}>{i}</option>)}
            </select>

            <div style={{ marginLeft: "auto", display: "flex", gap: SPACING.xs }}>
              {/* View toggle */}
              {["table", "cards"].map((v) => (
                <button key={v} onClick={() => setViewMode(v)} style={{
                  padding: `${SPACING.xs} ${SPACING.sm}`, fontSize: FONTS.size.sm, fontFamily: FONTS.family,
                  cursor: "pointer", border: `1px solid ${viewMode === v ? COLORS.primary : COLORS.border}`,
                  borderRadius: RADIUS.base, backgroundColor: viewMode === v ? COLORS.primaryMuted : "transparent",
                  color: viewMode === v ? COLORS.primary : COLORS.textSecondary, transition: TRANSITIONS.fast,
                }}>
                  {v === "table" ? "⊟" : "⊞"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── TABLE VIEW ── */}
        {viewMode === "table" && (
          <div style={{ ...STYLES.card, padding: 0, overflow: "hidden" }}>
            {/* Table header */}
            <div style={{ display: "grid", gridTemplateColumns: "40px 2.5fr 1fr 1.2fr 80px 80px 110px 100px 160px", backgroundColor: COLORS.surfaceActive, borderBottom: `1px solid ${COLORS.border}` }}>
              {/* Select all */}
              <div style={{ ...STYLES.tableHeader, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <input
                  type="checkbox"
                  checked={filtered.length > 0 && selected.size === filtered.length}
                  onChange={toggleAll}
                  style={{ cursor: "pointer", accentColor: COLORS.primary }}
                />
              </div>
              {[
                { label: "Company",    col: "name",       pl: SPACING.sm  },
                { label: "Industry",   col: null                           },
                { label: "Plan",       col: null                           },
                { label: "Agents",     col: "agentCount"                  },
                { label: "Leads",      col: "leadCount"                   },
                { label: "Status",     col: null                           },
                { label: "Joined",     col: "createdAt"                   },
                { label: "Actions",    col: null, center: true             },
              ].map(({ label, col, pl, center }) => (
                <div key={label} onClick={col ? () => handleSort(col) : undefined}
                  style={{ ...STYLES.tableHeader, paddingLeft: pl || SPACING.base, cursor: col ? "pointer" : "default", textAlign: center ? "center" : "left" }}>
                  {label}{col && <SortArrow col={col} />}
                </div>
              ))}
            </div>

            {/* Loading */}
            {loading && Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "40px 2.5fr 1fr 1.2fr 80px 80px 110px 100px 160px", borderBottom: `1px solid ${COLORS.border}`, padding: `${SPACING.md} ${SPACING.base}`, gap: SPACING.base, alignItems: "center" }}>
                <Shimmer w="16px" h="16px" r="3px" />
                <div><Shimmer h="13px" w="60%" /><div style={{ marginTop: "4px" }}><Shimmer h="11px" w="40%" /></div></div>
                <Shimmer h="11px" w="70%" />
                <Shimmer h="20px" w="65px" r={RADIUS.full} />
                <Shimmer h="13px" w="25px" />
                <Shimmer h="13px" w="25px" />
                <Shimmer h="20px" w="72px" r={RADIUS.full} />
                <Shimmer h="11px" w="55px" />
                <div style={{ display: "flex", gap: "6px" }}><Shimmer h="26px" w="50px" /><Shimmer h="26px" w="50px" /></div>
              </div>
            ))}

            {/* Empty */}
            {!loading && filtered.length === 0 && (
              <div style={{ textAlign: "center", padding: `${SPACING["5xl"]} 0`, color: COLORS.textMuted }}>
                <div style={{ fontSize: "36px", marginBottom: SPACING.base }}>🏢</div>
                <div>No companies match these filters.</div>
                <button onClick={() => { setSearch(""); setPlanFilter("All Plans"); setStatusFilter("All Status"); setIndustryFilter("All Industries"); }}
                  style={{ ...STYLES.buttonSecondary, marginTop: SPACING.base, fontSize: FONTS.size.sm }}>Clear all filters</button>
              </div>
            )}

            {/* Rows */}
            {!loading && filtered.map((company, idx) => (
              <div key={company.id} className="co-row" style={{
                display: "grid", gridTemplateColumns: "40px 2.5fr 1fr 1.2fr 80px 80px 110px 100px 160px",
                borderBottom: `1px solid ${COLORS.border}`,
                backgroundColor: selected.has(company.id) ? COLORS.primaryMuted + "33" : (idx % 2 === 0 ? "transparent" : COLORS.surface + "55"),
                transition: TRANSITIONS.fast, alignItems: "center",
              }}>
                {/* Checkbox */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: SPACING.sm }}>
                  <input type="checkbox" checked={selected.has(company.id)} onChange={() => toggleOne(company.id)} style={{ cursor: "pointer", accentColor: COLORS.primary }} />
                </div>

                {/* Name */}
                <div style={{ padding: `${SPACING.md} ${SPACING.sm}`, cursor: "pointer" }} onClick={() => navigate(`/platform/companies/${company.id}`)}>
                  <div style={{ fontSize: FONTS.size.base, fontWeight: FONTS.weight.medium, color: COLORS.textPrimary, display: "flex", alignItems: "center", gap: SPACING.xs }}>
                    {company.name || "Unnamed"}
                    {company.status === "suspended" && <span style={{ fontSize: "10px", color: COLORS.danger }}>⊘</span>}
                  </div>
                  <div style={{ fontSize: FONTS.size.xs, color: COLORS.textMuted, marginTop: "2px" }}>
                    {company.adminEmail || "—"}{company.city ? ` · ${company.city}` : ""}
                  </div>
                </div>

                {/* Industry */}
                <div style={{ padding: `${SPACING.md} ${SPACING.base}`, fontSize: FONTS.size.xs, color: COLORS.textSecondary }}>{company.industry || "—"}</div>

                {/* Plan */}
                <div style={{ padding: `${SPACING.md} ${SPACING.base}` }}><PlanBadge plan={company.plan} /></div>

                {/* Agents */}
                <div style={{ padding: `${SPACING.md} ${SPACING.base}`, textAlign: "center", fontSize: FONTS.size.sm, fontWeight: FONTS.weight.semibold, color: COLORS.textPrimary }}>{company.agentCount || 0}</div>

                {/* Leads */}
                <div style={{ padding: `${SPACING.md} ${SPACING.base}`, textAlign: "center", fontSize: FONTS.size.sm, color: COLORS.textSecondary }}>{company.leadCount || 0}</div>

                {/* Status */}
                <div style={{ padding: `${SPACING.md} ${SPACING.base}` }}><StatusBadge status={company.status || "active"} /></div>

                {/* Joined */}
                <div style={{ padding: `${SPACING.md} ${SPACING.base}`, fontSize: FONTS.size.xs, color: COLORS.textMuted }}>{fmtDate(company.createdAt)}</div>

                {/* Actions */}
                <div style={{ padding: `${SPACING.md} ${SPACING.base}`, display: "flex", gap: "6px", justifyContent: "center" }}>
                  <button className="icon-btn" onClick={() => navigate(`/platform/companies/${company.id}`)}
                    style={{ padding: `4px ${SPACING.sm}`, fontSize: FONTS.size.xs, border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.base, backgroundColor: "transparent", color: COLORS.textSecondary, cursor: "pointer", fontFamily: FONTS.family, transition: TRANSITIONS.fast }}>
                    View
                  </button>
                  <button className="icon-btn" onClick={() => toggleStatus(company)}
                    style={{ padding: `4px ${SPACING.sm}`, fontSize: FONTS.size.xs,
                      border: `1px solid ${company.status === "suspended" ? COLORS.success + "77" : COLORS.danger + "55"}`,
                      borderRadius: RADIUS.base, backgroundColor: "transparent",
                      color: company.status === "suspended" ? COLORS.success : COLORS.danger,
                      cursor: "pointer", fontFamily: FONTS.family, transition: TRANSITIONS.fast }}>
                    {company.status === "suspended" ? "↑ On" : "⊘ Off"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── CARDS VIEW ── */}
        {viewMode === "cards" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: SPACING.base }}>
            {loading ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{ ...STYLES.card, padding: 0, overflow: "hidden" }}>
                <div style={{ padding: SPACING.xl, borderBottom: `1px solid ${COLORS.border}` }}>
                  <Shimmer h="16px" w="60%" />
                  <div style={{ marginTop: SPACING.xs }}><Shimmer h="12px" w="40%" /></div>
                </div>
                <div style={{ padding: SPACING.base, display: "flex", gap: SPACING.sm }}>
                  <Shimmer h="40px" /><Shimmer h="40px" /><Shimmer h="40px" />
                </div>
              </div>
            )) : filtered.map((company) => (
              <div key={company.id} className="co-card" style={{
                ...STYLES.card, padding: 0, overflow: "hidden", cursor: "pointer",
                transition: "transform 0.15s ease, border-color 0.15s ease",
                border: selected.has(company.id) ? `1px solid ${COLORS.primary}77` : `1px solid ${COLORS.border}`,
              }}>
                {/* Card header */}
                <div style={{ padding: SPACING.base, borderBottom: `1px solid ${COLORS.border}`, background: `linear-gradient(135deg,${COLORS.surface},${COLORS.surfaceHover})` }}
                  onClick={() => navigate(`/platform/companies/${company.id}`)}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: SPACING.sm }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: FONTS.size.base, fontWeight: FONTS.weight.bold, color: COLORS.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{company.name || "Unnamed"}</div>
                      <div style={{ fontSize: FONTS.size.xs, color: COLORS.textMuted, marginTop: "2px" }}>{company.industry || "—"} · {company.city || "India"}</div>
                    </div>
                    <StatusBadge status={company.status || "active"} />
                  </div>
                  <div style={{ marginTop: SPACING.sm, display: "flex", gap: SPACING.xs, alignItems: "center" }}>
                    <PlanBadge plan={company.plan} />
                    {PLAN_META[company.plan] && (
                      <span style={{ fontSize: FONTS.size.xs, color: COLORS.textMuted }}>{PLAN_META[company.plan].price}</span>
                    )}
                  </div>
                </div>

                {/* Stats row */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", padding: SPACING.sm, gap: "1px", backgroundColor: COLORS.border }}
                  onClick={() => navigate(`/platform/companies/${company.id}`)}>
                  {[
                    { label: "Agents",  value: company.agentCount || 0  },
                    { label: "Leads",   value: company.leadCount  || 0  },
                    { label: "Joined",  value: fmtDate(company.createdAt).split(" ").slice(0,2).join(" ") },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ backgroundColor: COLORS.surface, padding: `${SPACING.sm} ${SPACING.xs}`, textAlign: "center" }}>
                      <div style={{ fontSize: FONTS.size.sm, fontWeight: FONTS.weight.bold, color: COLORS.textPrimary }}>{value}</div>
                      <div style={{ fontSize: "10px", color: COLORS.textMuted }}>{label}</div>
                    </div>
                  ))}
                </div>

                {/* Card actions */}
                <div style={{ padding: `${SPACING.sm} ${SPACING.base}`, display: "flex", gap: SPACING.xs }}>
                  <button onClick={() => navigate(`/platform/companies/${company.id}`)} style={{ ...STYLES.buttonSecondary, flex: 1, padding: `${SPACING.xs} 0`, fontSize: FONTS.size.xs }}>View</button>
                  <button onClick={() => navigate(`/platform/billing?company=${company.id}`)} style={{ ...STYLES.buttonSecondary, flex: 1, padding: `${SPACING.xs} 0`, fontSize: FONTS.size.xs }}>Plan</button>
                  <button onClick={() => toggleStatus(company)} style={{
                    flex: 1, padding: `${SPACING.xs} 0`, fontSize: FONTS.size.xs,
                    border: `1px solid ${company.status === "suspended" ? COLORS.success + "77" : COLORS.danger + "44"}`,
                    borderRadius: RADIUS.base, backgroundColor: "transparent",
                    color: company.status === "suspended" ? COLORS.success : COLORS.danger,
                    cursor: "pointer", fontFamily: FONTS.family,
                  }}>
                    {company.status === "suspended" ? "Restore" : "Suspend"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Count footer ── */}
        {!loading && filtered.length > 0 && (
          <div style={{ textAlign: "center", padding: `${SPACING.xl} 0`, fontSize: FONTS.size.xs, color: COLORS.textMuted }}>
            Showing {filtered.length} {filtered.length === 1 ? "company" : "companies"}
            {selected.size > 0 && ` · ${selected.size} selected`}
          </div>
        )}
      </div>

      {/* ── Bulk action bar ── */}
      {selected.size > 0 && (
        <BulkBar
          count={selected.size}
          onSuspend={handleBulkSuspend}
          onChangePlan={() => navigate(`/platform/billing?bulk=${[...selected].join(",")}`)}
          onClear={() => setSelected(new Set())}
          saving={bulkSaving}
        />
      )}

      {/* ── Add company modal ── */}
      {showAdd && (
        <AddCompanyModal
          onClose={() => setShowAdd(false)}
          onAdded={(c) => setCompanies((prev) => [c, ...prev])}
        />
      )}
    </>
  );
};

export default CompaniesList;
