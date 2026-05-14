// TIRAS CRM — CompanySettings.jsx
// Company Admin — 4 tabs: Profile · Pipeline Stages · WhatsApp Templates · Billing
//
// USAGE: In src/pages/index.js replace:
//   export const CompanySettings = () => <Placeholder name="Company Settings" />;
// with:
//   export { CompanySettings } from "./CompanySettings";

import React, { useState, useEffect, useCallback } from "react";
import {
  doc, getDoc, setDoc, updateDoc,
  collection, query, where, getDocs,
  addDoc, deleteDoc, orderBy, serverTimestamp,
} from "firebase/firestore";
import { db, COLLECTIONS } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import {
  COLORS, FONTS, SPACING, RADIUS, SHADOWS, STYLES, TRANSITIONS,
} from "../theme";
import {
  RiBuildingLine, RiFlowChart, RiWhatsappLine, RiMoneyDollarCircleLine,
  RiSaveLine, RiLoader4Line, RiAddLine, RiDeleteBinLine,
  RiArrowUpLine, RiArrowDownLine, RiEditLine, RiCloseLine,
  RiCheckLine, RiAlertLine, RiInformationLine,
} from "react-icons/ri";

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = [
  { id: "profile",    label: "Company Profile",     icon: RiBuildingLine },
  { id: "pipeline",   label: "Pipeline Stages",     icon: RiFlowChart },
  { id: "whatsapp",   label: "WhatsApp Templates",  icon: RiWhatsappLine },
  { id: "billing",    label: "Billing & Plan",      icon: RiMoneyDollarCircleLine },
];

const INDUSTRIES = [
  "Staffing & Recruitment", "Real Estate", "Manufacturing",
  "EdTech / Education", "Healthcare", "Financial Services",
  "Retail / E-commerce", "IT Services", "Construction",
  "Hospitality & Travel", "Logistics", "Other",
];

const TIMEZONES = [
  "Asia/Kolkata", "Asia/Dubai", "Asia/Singapore",
  "Europe/London", "America/New_York", "America/Los_Angeles",
];

const DEFAULT_STAGES = [
  "New", "Contacted", "Interested",
  "Follow-up", "Negotiation", "Closed Won", "Closed Lost",
];

const PLAN_CONFIG = {
  basic:      { label: "Basic",      price: "₹1,800/mo",  color: COLORS.info,    retention: "7 days" },
  growth:     { label: "Growth",     price: "₹3,000/mo",  color: COLORS.primary, retention: "30 days" },
  enterprise: { label: "Enterprise", price: "Custom",     color: COLORS.accent,  retention: "365 days" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const Toast = ({ msg, type = "success" }) => {
  const color = type === "error" ? COLORS.danger : COLORS.success;
  return (
    <div style={{
      position: "fixed", bottom: SPACING.xl, right: SPACING.xl,
      backgroundColor: COLORS.surfaceActive,
      border: `1px solid ${color}50`,
      borderLeft: `3px solid ${color}`,
      borderRadius: RADIUS.md,
      padding: `${SPACING.sm} ${SPACING.lg}`,
      display: "flex", alignItems: "center", gap: SPACING.sm,
      boxShadow: SHADOWS.lg, zIndex: 2000,
      fontSize: FONTS.size.sm, color: COLORS.textPrimary,
      animation: "tirasSlideIn 0.2s ease",
    }}>
      {type === "error" ? <RiAlertLine size={16} color={color} /> : <RiCheckLine size={16} color={color} />}
      {msg}
    </div>
  );
};

const FormField = ({ label, hint, error, required, children }) => (
  <div style={{ marginBottom: SPACING.lg }}>
    <label style={{
      display: "block", fontSize: FONTS.size.sm,
      fontWeight: FONTS.weight.medium, color: COLORS.textSecondary,
      marginBottom: SPACING.xs,
    }}>
      {label}
      {required && <span style={{ color: COLORS.danger, marginLeft: "3px" }}>*</span>}
    </label>
    {children}
    {hint && !error && (
      <div style={{ fontSize: FONTS.size.xs, color: COLORS.textMuted, marginTop: "4px", display: "flex", alignItems: "center", gap: "3px" }}>
        <RiInformationLine size={11} /> {hint}
      </div>
    )}
    {error && (
      <div style={{ fontSize: FONTS.size.xs, color: COLORS.danger, marginTop: "4px", display: "flex", alignItems: "center", gap: "3px" }}>
        <RiAlertLine size={11} /> {error}
      </div>
    )}
  </div>
);

// ─── Tab: Profile ─────────────────────────────────────────────────────────────

const ProfileTab = ({ companyId, onToast }) => {
  const [form, setForm]     = useState({ name: "", industry: "", timezone: "Asia/Kolkata", contactEmail: "", address: "" });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, COLLECTIONS.COMPANIES, companyId));
        if (snap.exists()) {
          const d = snap.data();
          setForm({
            name:         d.name         || "",
            industry:     d.industry     || "",
            timezone:     d.timezone     || "Asia/Kolkata",
            contactEmail: d.contactEmail || "",
            address:      d.address      || "",
          });
        }
      } catch (err) { console.error("ProfileTab load:", err); }
      finally { setLoading(false); }
    };
    load();
  }, [companyId]);

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Company name is required";
    if (form.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail)) e.contactEmail = "Invalid email";
    return e;
  };

  const save = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    try {
      await setDoc(doc(db, COLLECTIONS.COMPANIES, companyId), {
        ...form, updatedAt: serverTimestamp(),
      }, { merge: true });
      onToast("Company profile saved");
    } catch (err) {
      console.error("ProfileTab save:", err);
      onToast("Failed to save. Try again.", "error");
    } finally { setSaving(false); }
  };

  if (loading) return (
    <div style={{ padding: SPACING["5xl"], textAlign: "center" }}>
      <RiLoader4Line size={24} color={COLORS.textMuted} style={{ animation: "tirasSpinKf 1s linear infinite" }} />
    </div>
  );

  const inp = { ...STYLES.input };
  const sel = { ...STYLES.input, appearance: "none", cursor: "pointer" };

  return (
    <div style={{ maxWidth: "580px" }}>
      <FormField label="Company Name" error={errors.name} required>
        <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
          placeholder="e.g. MAINDSOURCE LLP" style={{ ...inp, borderColor: errors.name ? COLORS.danger : COLORS.inputBorder }} />
      </FormField>

      <FormField label="Industry">
        <select value={form.industry} onChange={e => setForm(p => ({ ...p, industry: e.target.value }))} style={sel}>
          <option value="">— Select industry —</option>
          {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
        </select>
      </FormField>

      <FormField label="Timezone">
        <select value={form.timezone} onChange={e => setForm(p => ({ ...p, timezone: e.target.value }))} style={sel}>
          {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
        </select>
      </FormField>

      <FormField label="Contact Email" error={errors.contactEmail}
        hint="Used for billing receipts and platform notifications">
        <input type="email" value={form.contactEmail} onChange={e => setForm(p => ({ ...p, contactEmail: e.target.value }))}
          placeholder="admin@yourcompany.com"
          style={{ ...inp, borderColor: errors.contactEmail ? COLORS.danger : COLORS.inputBorder }} />
      </FormField>

      <FormField label="Office Address" hint="Optional — shown on invoices">
        <textarea value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
          placeholder="123 MG Road, Bangalore 560001"
          rows={3}
          style={{ ...inp, resize: "vertical", lineHeight: "1.6" }} />
      </FormField>

      <button onClick={save} disabled={saving} style={{
        ...STYLES.buttonPrimary, display: "flex", alignItems: "center",
        gap: SPACING.xs, opacity: saving ? 0.6 : 1,
      }}>
        {saving
          ? <><RiLoader4Line size={15} style={{ animation: "tirasSpinKf 0.8s linear infinite" }} /> Saving…</>
          : <><RiSaveLine size={15} /> Save Profile</>
        }
      </button>
    </div>
  );
};

// ─── Tab: Pipeline Stages ─────────────────────────────────────────────────────

const PipelineTab = ({ companyId, onToast }) => {
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [newStageName, setNewStageName] = useState("");
  const [addError, setAddError]         = useState("");

  // Load custom stages; if none, seed from defaults
  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDocs(query(
          collection(db, COLLECTIONS.PIPELINE_STAGES),
          where("companyId", "==", companyId),
          orderBy("order", "asc"),
        ));
        if (snap.empty) {
          // Seed defaults — not yet persisted, user must save
          setStages(DEFAULT_STAGES.map((name, order) => ({ id: null, name, order, isDefault: true })));
        } else {
          setStages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        }
      } catch (err) { console.error("PipelineTab load:", err); }
      finally { setLoading(false); }
    };
    load();
  }, [companyId]);

  const moveStage = (idx, dir) => {
    const next = [...stages];
    const swap = idx + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    setStages(next.map((s, i) => ({ ...s, order: i })));
  };

  const removeStage = (idx) => {
    setStages(prev => prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i })));
  };

  const addStage = () => {
    const name = newStageName.trim();
    if (!name) { setAddError("Enter a stage name"); return; }
    if (stages.some(s => s.name.toLowerCase() === name.toLowerCase())) {
      setAddError("Stage already exists"); return;
    }
    setStages(prev => [...prev, { id: null, name, order: prev.length }]);
    setNewStageName("");
    setAddError("");
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      // Delete all existing custom stages for this company, then re-create
      const existing = await getDocs(query(
        collection(db, COLLECTIONS.PIPELINE_STAGES),
        where("companyId", "==", companyId),
      ));
      await Promise.all(existing.docs.map(d => deleteDoc(d.ref)));
      await Promise.all(stages.map((s, i) =>
        addDoc(collection(db, COLLECTIONS.PIPELINE_STAGES), {
          name: s.name, order: i, companyId,
          createdAt: serverTimestamp(),
        })
      ));
      onToast("Pipeline stages saved");
    } catch (err) {
      console.error("PipelineTab save:", err);
      onToast("Failed to save stages.", "error");
    } finally { setSaving(false); }
  };

  if (loading) return (
    <div style={{ padding: SPACING["5xl"], textAlign: "center" }}>
      <RiLoader4Line size={24} color={COLORS.textMuted} style={{ animation: "tirasSpinKf 1s linear infinite" }} />
    </div>
  );

  return (
    <div style={{ maxWidth: "480px" }}>
      <div style={{ fontSize: FONTS.size.sm, color: COLORS.textSecondary, marginBottom: SPACING.lg, lineHeight: 1.6 }}>
        Customise the stages in your sales pipeline. Drag order matters — leads move left to right.
        Agents and managers will see these stages on the Kanban board.
      </div>

      {/* Stage list */}
      <div style={{ display: "flex", flexDirection: "column", gap: SPACING.sm, marginBottom: SPACING.base }}>
        {stages.map((stage, idx) => (
          <div key={idx} style={{
            display: "flex", alignItems: "center", gap: SPACING.sm,
            backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}`,
            borderRadius: RADIUS.md, padding: `${SPACING.sm} ${SPACING.md}`,
          }}>
            {/* Order number */}
            <span style={{
              width: "22px", height: "22px", borderRadius: "50%",
              backgroundColor: COLORS.primaryMuted, display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: FONTS.size.xs,
              fontWeight: FONTS.weight.bold, color: COLORS.primary, flexShrink: 0,
            }}>
              {idx + 1}
            </span>

            <span style={{ flex: 1, fontSize: FONTS.size.base, color: COLORS.textPrimary, fontWeight: FONTS.weight.medium }}>
              {stage.name}
            </span>

            {/* Move up/down */}
            <button onClick={() => moveStage(idx, -1)} disabled={idx === 0}
              style={{ background: "none", border: "none", color: idx === 0 ? COLORS.textMuted : COLORS.textSecondary, cursor: idx === 0 ? "not-allowed" : "pointer", padding: "2px", display: "flex" }}>
              <RiArrowUpLine size={15} />
            </button>
            <button onClick={() => moveStage(idx, 1)} disabled={idx === stages.length - 1}
              style={{ background: "none", border: "none", color: idx === stages.length - 1 ? COLORS.textMuted : COLORS.textSecondary, cursor: idx === stages.length - 1 ? "not-allowed" : "pointer", padding: "2px", display: "flex" }}>
              <RiArrowDownLine size={15} />
            </button>

            {/* Delete */}
            <button onClick={() => removeStage(idx)}
              style={{ background: "none", border: "none", color: COLORS.danger, cursor: "pointer", padding: "2px", display: "flex", opacity: 0.6 }}
              onMouseEnter={e => e.currentTarget.style.opacity = "1"}
              onMouseLeave={e => e.currentTarget.style.opacity = "0.6"}
            >
              <RiDeleteBinLine size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Add stage */}
      <div style={{ display: "flex", gap: SPACING.sm, marginBottom: SPACING.lg }}>
        <div style={{ flex: 1 }}>
          <input
            value={newStageName}
            onChange={e => { setNewStageName(e.target.value); setAddError(""); }}
            onKeyDown={e => e.key === "Enter" && addStage()}
            placeholder="New stage name…"
            style={{ ...STYLES.input, borderColor: addError ? COLORS.danger : COLORS.inputBorder }}
          />
          {addError && <div style={{ fontSize: FONTS.size.xs, color: COLORS.danger, marginTop: "4px" }}>{addError}</div>}
        </div>
        <button onClick={addStage} style={{ ...STYLES.buttonSecondary, display: "flex", alignItems: "center", gap: SPACING.xs, flexShrink: 0 }}>
          <RiAddLine size={15} /> Add
        </button>
      </div>

      <button onClick={saveAll} disabled={saving} style={{ ...STYLES.buttonPrimary, display: "flex", alignItems: "center", gap: SPACING.xs, opacity: saving ? 0.6 : 1 }}>
        {saving ? <><RiLoader4Line size={15} style={{ animation: "tirasSpinKf 0.8s linear infinite" }} /> Saving…</> : <><RiSaveLine size={15} /> Save Stages</>}
      </button>
    </div>
  );
};

// ─── Tab: WhatsApp Templates ──────────────────────────────────────────────────

const WhatsAppTab = ({ companyId, onToast }) => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [editingId, setEditingId] = useState(null); // null = new, string = existing id
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState({ name: "", message: "" });
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving]         = useState(false);

  const load = useCallback(async () => {
    try {
      const snap = await getDocs(query(
        collection(db, COLLECTIONS.WHATSAPP_TEMPLATES),
        where("companyId", "==", companyId),
        orderBy("createdAt", "asc"),
      ));
      setTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) { console.error("WhatsAppTab load:", err); }
    finally { setLoading(false); }
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setEditingId(null);
    setForm({ name: "", message: "" });
    setFormErrors({});
    setShowForm(true);
  };

  const openEdit = (t) => {
    setEditingId(t.id);
    setForm({ name: t.name, message: t.message });
    setFormErrors({});
    setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); setEditingId(null); };

  const validateForm = () => {
    const e = {};
    if (!form.name.trim())    e.name    = "Template name is required";
    if (!form.message.trim()) e.message = "Message text is required";
    return e;
  };

  const saveTemplate = async () => {
    const e = validateForm();
    if (Object.keys(e).length) { setFormErrors(e); return; }
    setSaving(true);
    try {
      if (editingId) {
        await updateDoc(doc(db, COLLECTIONS.WHATSAPP_TEMPLATES, editingId), {
          name: form.name.trim(), message: form.message.trim(), updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, COLLECTIONS.WHATSAPP_TEMPLATES), {
          name: form.name.trim(), message: form.message.trim(),
          companyId, createdAt: serverTimestamp(),
        });
      }
      await load();
      closeForm();
      onToast(editingId ? "Template updated" : "Template created");
    } catch (err) {
      console.error("WhatsAppTab save:", err);
      onToast("Failed to save template.", "error");
    } finally { setSaving(false); }
  };

  const deleteTemplate = async (id) => {
    try {
      await deleteDoc(doc(db, COLLECTIONS.WHATSAPP_TEMPLATES, id));
      await load();
      onToast("Template deleted");
    } catch (err) { onToast("Failed to delete.", "error"); }
  };

  if (loading) return (
    <div style={{ padding: SPACING["5xl"], textAlign: "center" }}>
      <RiLoader4Line size={24} color={COLORS.textMuted} style={{ animation: "tirasSpinKf 1s linear infinite" }} />
    </div>
  );

  return (
    <div style={{ maxWidth: "600px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: SPACING.base }}>
        <div style={{ fontSize: FONTS.size.sm, color: COLORS.textSecondary }}>
          {templates.length} template{templates.length !== 1 ? "s" : ""}
        </div>
        <button onClick={openAdd} style={{ ...STYLES.buttonPrimary, display: "flex", alignItems: "center", gap: SPACING.xs }}>
          <RiAddLine size={15} /> New Template
        </button>
      </div>

      {/* Template list */}
      {templates.length === 0 && !showForm && (
        <div style={{ textAlign: "center", padding: `${SPACING["3xl"]} 0`, color: COLORS.textSecondary }}>
          <RiWhatsappLine size={32} color={COLORS.textMuted} style={{ marginBottom: SPACING.sm }} />
          <div style={{ fontWeight: FONTS.weight.semibold, color: COLORS.textPrimary, marginBottom: SPACING.xs }}>No templates yet</div>
          <div style={{ fontSize: FONTS.size.sm }}>Create message templates agents can send with one tap.</div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: SPACING.sm, marginBottom: showForm ? SPACING.xl : 0 }}>
        {templates.map(t => (
          <div key={t.id} style={{
            backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}`,
            borderRadius: RADIUS.md, padding: SPACING.md,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: SPACING.xs }}>
              <div style={{ display: "flex", alignItems: "center", gap: SPACING.xs }}>
                <RiWhatsappLine size={15} color="#25D366" />
                <span style={{ fontSize: FONTS.size.sm, fontWeight: FONTS.weight.semibold, color: COLORS.textPrimary }}>{t.name}</span>
              </div>
              <div style={{ display: "flex", gap: SPACING.xs }}>
                <button onClick={() => openEdit(t)} style={{ background: "none", border: "none", color: COLORS.textSecondary, cursor: "pointer", padding: "2px", display: "flex" }}>
                  <RiEditLine size={14} />
                </button>
                <button onClick={() => deleteTemplate(t.id)} style={{ background: "none", border: "none", color: COLORS.danger, cursor: "pointer", padding: "2px", display: "flex", opacity: 0.6 }}
                  onMouseEnter={e => e.currentTarget.style.opacity = "1"} onMouseLeave={e => e.currentTarget.style.opacity = "0.6"}>
                  <RiDeleteBinLine size={14} />
                </button>
              </div>
            </div>
            <div style={{ fontSize: FONTS.size.sm, color: COLORS.textSecondary, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
              {t.message}
            </div>
          </div>
        ))}
      </div>

      {/* Inline form */}
      {showForm && (
        <div style={{ backgroundColor: COLORS.surface, border: `1px solid ${COLORS.primary}40`, borderRadius: RADIUS.lg, padding: SPACING.xl }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: SPACING.lg }}>
            <div style={{ fontSize: FONTS.size.base, fontWeight: FONTS.weight.bold, color: COLORS.textPrimary }}>
              {editingId ? "Edit Template" : "New Template"}
            </div>
            <button onClick={closeForm} style={{ background: "none", border: "none", color: COLORS.textSecondary, cursor: "pointer", display: "flex" }}>
              <RiCloseLine size={18} />
            </button>
          </div>

          <FormField label="Template Name" error={formErrors.name} required>
            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Introduction Message"
              style={{ ...STYLES.input, borderColor: formErrors.name ? COLORS.danger : COLORS.inputBorder }} />
          </FormField>

          <FormField label="Message Text" error={formErrors.message} hint="Use {{name}} for the lead's name, {{company}} for your company name" required>
            <textarea value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
              placeholder="Hi {{name}}, I'm calling from TIRAS regarding your inquiry…"
              rows={5}
              style={{ ...STYLES.input, resize: "vertical", lineHeight: 1.6, borderColor: formErrors.message ? COLORS.danger : COLORS.inputBorder }} />
          </FormField>

          {form.message && (
            <div style={{ backgroundColor: COLORS.successMuted, border: `1px solid ${COLORS.success}30`, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.base }}>
              <div style={{ fontSize: FONTS.size.xs, color: COLORS.success, marginBottom: "4px", fontWeight: FONTS.weight.semibold }}>Preview</div>
              <div style={{ fontSize: FONTS.size.sm, color: COLORS.textSecondary, lineHeight: 1.6 }}>
                {form.message.replace(/\{\{name\}\}/g, "Rahul").replace(/\{\{company\}\}/g, "TIRAS CRM")}
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: SPACING.md }}>
            <button onClick={closeForm} style={{ ...STYLES.buttonSecondary }}>Cancel</button>
            <button onClick={saveTemplate} disabled={saving} style={{ ...STYLES.buttonPrimary, display: "flex", alignItems: "center", gap: SPACING.xs, opacity: saving ? 0.6 : 1 }}>
              {saving ? <><RiLoader4Line size={15} style={{ animation: "tirasSpinKf 0.8s linear infinite" }} /> Saving…</> : <><RiCheckLine size={15} /> {editingId ? "Save Changes" : "Create Template"}</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Tab: Billing ─────────────────────────────────────────────────────────────

const BillingTab = ({ companyId, onToast }) => {
  const [billing, setBilling] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, COLLECTIONS.COMPANIES, companyId));
        if (snap.exists()) setBilling(snap.data());
      } catch (err) { console.error("BillingTab load:", err); }
      finally { setLoading(false); }
    };
    load();
  }, [companyId]);

  if (loading) return (
    <div style={{ padding: SPACING["5xl"], textAlign: "center" }}>
      <RiLoader4Line size={24} color={COLORS.textMuted} style={{ animation: "tirasSpinKf 1s linear infinite" }} />
    </div>
  );

  const plan    = billing?.plan || "basic";
  const planCfg = PLAN_CONFIG[plan] || PLAN_CONFIG.basic;
  const renewal = billing?.renewalDate?.toDate?.();

  return (
    <div style={{ maxWidth: "560px" }}>
      {/* Current plan card */}
      <div style={{
        backgroundColor: COLORS.surface,
        border: `1px solid ${planCfg.color}40`,
        borderRadius: RADIUS.xl, padding: SPACING.xl,
        marginBottom: SPACING.xl,
        background: `linear-gradient(135deg, ${COLORS.surface} 0%, ${planCfg.color}12 100%)`,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: SPACING.base }}>
          <div>
            <div style={{ fontSize: FONTS.size.xs, fontWeight: FONTS.weight.semibold, color: planCfg.color, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "4px" }}>
              Current Plan
            </div>
            <div style={{ fontSize: FONTS.size["3xl"], fontWeight: FONTS.weight.bold, color: COLORS.textPrimary, letterSpacing: "-0.5px" }}>
              {planCfg.label}
            </div>
          </div>
          <div style={{
            backgroundColor: planCfg.color + "22", border: `1px solid ${planCfg.color}40`,
            borderRadius: RADIUS.lg, padding: `${SPACING.sm} ${SPACING.base}`,
            textAlign: "right",
          }}>
            <div style={{ fontSize: FONTS.size.xl, fontWeight: FONTS.weight.bold, color: planCfg.color }}>{planCfg.price}</div>
            <div style={{ fontSize: FONTS.size.xs, color: COLORS.textSecondary, marginTop: "2px" }}>+ 2% per transaction</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: SPACING.sm }}>
          {[
            { label: "Call Recording Retention", value: planCfg.retention },
            { label: "Renewal Date",             value: renewal ? renewal.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "—" },
            { label: "Billing Cycle",            value: billing?.billingCycle || "Monthly" },
            { label: "Storage",                  value: billing?.storageGB ? `${billing.storageGB} GB` : "Standard" },
          ].map(row => (
            <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: `${SPACING.xs} 0`, borderBottom: `1px solid ${COLORS.border}` }}>
              <span style={{ fontSize: FONTS.size.sm, color: COLORS.textSecondary }}>{row.label}</span>
              <span style={{ fontSize: FONTS.size.sm, fontWeight: FONTS.weight.semibold, color: COLORS.textPrimary }}>{row.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Plan comparison */}
      <div style={{ fontSize: FONTS.size.base, fontWeight: FONTS.weight.semibold, color: COLORS.textPrimary, marginBottom: SPACING.md }}>
        Available Plans
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: SPACING.sm, marginBottom: SPACING.xl }}>
        {Object.entries(PLAN_CONFIG).map(([key, cfg]) => (
          <div key={key} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: SPACING.md, borderRadius: RADIUS.md,
            backgroundColor: key === plan ? cfg.color + "12" : "transparent",
            border: `1px solid ${key === plan ? cfg.color + "50" : COLORS.border}`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: SPACING.sm }}>
              {key === plan && <RiCheckLine size={14} color={cfg.color} />}
              <div>
                <div style={{ fontSize: FONTS.size.sm, fontWeight: FONTS.weight.semibold, color: key === plan ? cfg.color : COLORS.textPrimary }}>
                  {cfg.label} {key === plan && <span style={{ fontSize: FONTS.size.xs, color: COLORS.textMuted }}>(Current)</span>}
                </div>
                <div style={{ fontSize: FONTS.size.xs, color: COLORS.textSecondary }}>
                  Recording retention: {cfg.retention}
                </div>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: FONTS.size.sm, fontWeight: FONTS.weight.bold, color: cfg.color }}>{cfg.price}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Upgrade note */}
      <div style={{
        backgroundColor: COLORS.accentMuted, border: `1px solid ${COLORS.accent}30`,
        borderRadius: RADIUS.md, padding: SPACING.md,
        fontSize: FONTS.size.sm, color: COLORS.textSecondary, lineHeight: 1.6,
        display: "flex", gap: SPACING.sm,
      }}>
        <RiInformationLine size={16} color={COLORS.accent} style={{ flexShrink: 0, marginTop: "2px" }} />
        <span>
          To upgrade your plan or add storage, contact Tony directly via WhatsApp or email.
          All payments are collected via a Razorpay payment link — never through the app.
        </span>
      </div>
    </div>
  );
};

// ─── CompanySettings ──────────────────────────────────────────────────────────

export const CompanySettings = () => {
  const { companyId } = useAuth();
  const [activeTab, setActiveTab] = useState("profile");
  const [toast, setToast]         = useState(null); // { msg, type }

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div style={{
      backgroundColor: COLORS.background, minHeight: "calc(100vh - 60px)",
      padding: `${SPACING["2xl"]} ${SPACING["2xl"]}`,
      fontFamily: FONTS.family, boxSizing: "border-box",
    }}>
      <style>{`
        @keyframes tirasSpinKf { from{transform:rotate(0)} to{transform:rotate(360deg)} }
        @keyframes tirasSlideIn { from{transform:translateY(8px);opacity:0} to{transform:translateY(0);opacity:1} }
        select option { background: ${COLORS.surface}; color: ${COLORS.textPrimary}; }
        textarea { font-family: ${FONTS.family}; }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: SPACING["2xl"] }}>
        <h1 style={{ margin: 0, fontSize: FONTS.size["4xl"], fontWeight: FONTS.weight.bold, color: COLORS.textPrimary, letterSpacing: "-0.5px" }}>
          Company Settings
        </h1>
        <p style={{ margin: `${SPACING.xs} 0 0`, fontSize: FONTS.size.base, color: COLORS.textSecondary }}>
          Configure your company profile, pipeline, WhatsApp templates, and billing.
        </p>
      </div>

      <div style={{ display: "flex", gap: SPACING["2xl"], alignItems: "flex-start" }}>
        {/* Sidebar nav */}
        <div style={{
          width: "210px", flexShrink: 0,
          backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}`,
          borderRadius: RADIUS.lg, overflow: "hidden",
        }}>
          {TABS.map(tab => {
            const active = activeTab === tab.id;
            const Icon   = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  width: "100%", background: "none", border: "none",
                  borderLeft: `3px solid ${active ? COLORS.primary : "transparent"}`,
                  backgroundColor: active ? COLORS.sidebarActive : "transparent",
                  padding: `${SPACING.sm} ${SPACING.base}`,
                  display: "flex", alignItems: "center", gap: SPACING.sm,
                  cursor: "pointer", textAlign: "left", transition: TRANSITIONS.fast,
                  fontFamily: FONTS.family,
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.backgroundColor = COLORS.surfaceHover; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.backgroundColor = "transparent"; }}
              >
                <Icon size={16} color={active ? COLORS.primary : COLORS.textSecondary} />
                <span style={{
                  fontSize: FONTS.size.sm,
                  fontWeight: active ? FONTS.weight.semibold : FONTS.weight.regular,
                  color: active ? COLORS.primary : COLORS.textSecondary,
                }}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Content area */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {activeTab === "profile"  && <ProfileTab  companyId={companyId} onToast={showToast} />}
          {activeTab === "pipeline" && <PipelineTab companyId={companyId} onToast={showToast} />}
          {activeTab === "whatsapp" && <WhatsAppTab companyId={companyId} onToast={showToast} />}
          {activeTab === "billing"  && <BillingTab  companyId={companyId} onToast={showToast} />}
        </div>
      </div>

      {/* Toast */}
      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </div>
  );
};
