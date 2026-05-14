// TIRAS CRM — Validators
// All validation logic in one place — used by forms across all 31 pages

// ─── validatePhone ────────────────────────────────────────────────────────────
// Validates Indian mobile number
// Accepts: "9876543210", "+919876543210", "09876543210"
// Indian mobile numbers: start with 6, 7, 8, or 9 — exactly 10 digits

export const validatePhone = (phone) => {
  if (!phone) return false;

  const digits = phone.replace(/[\s\-()]/g, "");

  let number = digits;

  if (digits.startsWith("+91")) {
    number = digits.slice(3);
  } else if (digits.startsWith("91") && digits.length === 12) {
    number = digits.slice(2);
  } else if (digits.startsWith("0") && digits.length === 11) {
    number = digits.slice(1);
  }

  return /^[6-9]\d{9}$/.test(number);
};

// ─── validateEmail ────────────────────────────────────────────────────────────

export const validateEmail = (email) => {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
};

// ─── validateRequired ─────────────────────────────────────────────────────────

export const validateRequired = (value) => {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return true;
  if (Array.isArray(value)) return value.length > 0;
  return Boolean(value);
};

// ─── validateMinLength ────────────────────────────────────────────────────────

export const validateMinLength = (value, min) => {
  if (!value) return false;
  return String(value).trim().length >= min;
};

// ─── validateMaxLength ────────────────────────────────────────────────────────

export const validateMaxLength = (value, max) => {
  if (!value) return true;
  return String(value).trim().length <= max;
};

// ─── validateAmount ───────────────────────────────────────────────────────────

export const validateAmount = (amount) => {
  const num = parseFloat(amount);
  if (isNaN(num)) return false;
  return num >= 100;
};

// ─── validatePassword ─────────────────────────────────────────────────────────

export const validatePassword = (password) => {
  if (!password) return false;
  return password.length >= 8;
};

// ─── validateGSTIN ────────────────────────────────────────────────────────────

export const validateGSTIN = (gstin) => {
  if (!gstin) return true;
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(
    gstin.trim().toUpperCase()
  );
};

// ─── validatePAN ──────────────────────────────────────────────────────────────

export const validatePAN = (pan) => {
  if (!pan) return true;
  return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan.trim().toUpperCase());
};

// ─── validateURL ──────────────────────────────────────────────────────────────

export const validateURL = (url) => {
  if (!url) return true;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// FORM VALIDATORS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── validateLoginForm ────────────────────────────────────────────────────────

export const validateLoginForm = (formData = {}) => {
  const errors = {};

  if (!validateRequired(formData.email)) {
    errors.email = "Email is required.";
  } else if (!validateEmail(formData.email)) {
    errors.email = "Enter a valid email address.";
  }

  if (!validateRequired(formData.password)) {
    errors.password = "Password is required.";
  } else if (!validatePassword(formData.password)) {
    errors.password = "Password must be at least 8 characters.";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

// ─── validateForgotPasswordForm ───────────────────────────────────────────────

export const validateForgotPasswordForm = (formData = {}) => {
  const errors = {};

  if (!validateRequired(formData.email)) {
    errors.email = "Email is required.";
  } else if (!validateEmail(formData.email)) {
    errors.email = "Enter a valid email address.";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

// ─── validateLeadForm ─────────────────────────────────────────────────────────
// Used on: Add Lead / Edit Lead page
// Required: name, phone
// Optional: email, source, stage, dealValue, notes, customFields

export const validateLeadForm = (formData = {}) => {
  const errors = {};

  // Name — required, 2–100 chars
  if (!validateRequired(formData.name)) {
    errors.name = "Lead name is required.";
  } else if (!validateMinLength(formData.name, 2)) {
    errors.name = "Name must be at least 2 characters.";
  } else if (!validateMaxLength(formData.name, 100)) {
    errors.name = "Name must be under 100 characters.";
  }

  // Phone — required, valid Indian number
  if (!validateRequired(formData.phone)) {
    errors.phone = "Phone number is required.";
  } else if (!validatePhone(formData.phone)) {
    errors.phone = "Enter a valid 10-digit Indian mobile number.";
  }

  // Email — optional but must be valid if provided
  if (formData.email && formData.email.trim()) {
    if (!validateEmail(formData.email)) {
      errors.email = "Enter a valid email address.";
    }
  }

  // Deal value — optional but must be a positive number if provided
  if (formData.dealValue !== undefined && formData.dealValue !== "") {
    const num = parseFloat(formData.dealValue);
    if (isNaN(num) || num < 0) {
      errors.dealValue = "Deal value must be a positive number.";
    }
  }

  // Lead source — optional, but must be from the allowed list if provided
  const validSources = [
    "IndiaMART",
    "Website",
    "Cold Call",
    "Referral",
    "Walk-in",
    "Social Media",
    "WhatsApp",
    "Trade Show",
  ];
  if (formData.source && !validSources.includes(formData.source)) {
    errors.source = "Select a valid lead source.";
  }

  // Notes — optional, max 2000 chars
  if (formData.notes && !validateMaxLength(formData.notes, 2000)) {
    errors.notes = "Notes must be under 2000 characters.";
  }

  // Company name — optional, max 150 chars
  if (formData.company && !validateMaxLength(formData.company, 150)) {
    errors.company = "Company name must be under 150 characters.";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

// ─── validateAddUserForm ──────────────────────────────────────────────────────
// Used on: Team Management page (Company Admin adds agent/manager)

export const validateAddUserForm = (formData = {}) => {
  const errors = {};

  if (!validateRequired(formData.displayName)) {
    errors.displayName = "Full name is required.";
  } else if (!validateMinLength(formData.displayName, 2)) {
    errors.displayName = "Name must be at least 2 characters.";
  }

  if (!validateRequired(formData.email)) {
    errors.email = "Email is required.";
  } else if (!validateEmail(formData.email)) {
    errors.email = "Enter a valid email address.";
  }

  if (!validateRequired(formData.role)) {
    errors.role = "Role is required.";
  } else if (!["agent", "manager", "support_agent"].includes(formData.role)) {
    errors.role = "Select a valid role.";
  }

  if (!validateRequired(formData.password)) {
    errors.password = "Password is required.";
  } else if (!validatePassword(formData.password)) {
    errors.password = "Password must be at least 8 characters.";
  }

  if (formData.phone && !validatePhone(formData.phone)) {
    errors.phone = "Enter a valid 10-digit Indian mobile number.";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

// ─── validateTicketForm ───────────────────────────────────────────────────────
// Used on: Support Ticket Create page

export const validateTicketForm = (formData = {}) => {
  const errors = {};

  if (!validateRequired(formData.subject)) {
    errors.subject = "Ticket subject is required.";
  } else if (!validateMinLength(formData.subject, 5)) {
    errors.subject = "Subject must be at least 5 characters.";
  } else if (!validateMaxLength(formData.subject, 200)) {
    errors.subject = "Subject must be under 200 characters.";
  }

  if (!validateRequired(formData.description)) {
    errors.description = "Please describe the issue.";
  } else if (!validateMinLength(formData.description, 10)) {
    errors.description = "Description must be at least 10 characters.";
  } else if (!validateMaxLength(formData.description, 3000)) {
    errors.description = "Description must be under 3000 characters.";
  }

  if (!validateRequired(formData.leadId)) {
    errors.leadId = "Please link this ticket to a lead.";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

// ─── validateFollowUpForm ─────────────────────────────────────────────────────
// Used on: Lead Detail Page — schedule follow-up

export const validateFollowUpForm = (formData = {}) => {
  const errors = {};

  if (!validateRequired(formData.scheduledAt)) {
    errors.scheduledAt = "Follow-up date and time are required.";
  } else {
    const scheduled = new Date(formData.scheduledAt);
    const now = new Date();
    if (isNaN(scheduled.getTime())) {
      errors.scheduledAt = "Enter a valid date and time.";
    } else if (scheduled <= now) {
      errors.scheduledAt = "Follow-up must be scheduled in the future.";
    }
  }

  if (formData.note && !validateMaxLength(formData.note, 500)) {
    errors.note = "Note must be under 500 characters.";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

// ─── validatePaymentForm ──────────────────────────────────────────────────────
// Used on: Lead Detail Page — generate payment link

export const validatePaymentForm = (formData = {}) => {
  const errors = {};

  if (!validateRequired(formData.amount)) {
    errors.amount = "Amount is required.";
  } else if (!validateAmount(formData.amount)) {
    errors.amount = "Minimum payment amount is ₹100.";
  }

  if (!validateRequired(formData.description)) {
    errors.description = "Payment description is required.";
  } else if (!validateMaxLength(formData.description, 200)) {
    errors.description = "Description must be under 200 characters.";
  }

  if (formData.email && !validateEmail(formData.email)) {
    errors.email = "Enter a valid email address.";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

// ─── validateCompanySettingsForm ──────────────────────────────────────────────
// Used on: Company Settings page

export const validateCompanySettingsForm = (formData = {}) => {
  const errors = {};

  if (!validateRequired(formData.companyName)) {
    errors.companyName = "Company name is required.";
  } else if (!validateMaxLength(formData.companyName, 150)) {
    errors.companyName = "Company name must be under 150 characters.";
  }

  if (formData.email && !validateEmail(formData.email)) {
    errors.email = "Enter a valid email address.";
  }

  if (formData.phone && !validatePhone(formData.phone)) {
    errors.phone = "Enter a valid 10-digit Indian mobile number.";
  }

  if (formData.gstin && !validateGSTIN(formData.gstin)) {
    errors.gstin = "Enter a valid GSTIN (e.g. 22AAAAA0000A1Z5).";
  }

  if (formData.website && !validateURL(formData.website)) {
    errors.website = "Enter a valid website URL (e.g. https://example.com).";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

// ─── validateWhatsAppTemplate ─────────────────────────────────────────────────
// Used on: Company Settings — WhatsApp template editor

export const validateWhatsAppTemplate = (formData = {}) => {
  const errors = {};

  if (!validateRequired(formData.name)) {
    errors.name = "Template name is required.";
  } else if (!validateMaxLength(formData.name, 60)) {
    errors.name = "Template name must be under 60 characters.";
  }

  if (!validateRequired(formData.body)) {
    errors.body = "Template message is required.";
  } else if (!validateMinLength(formData.body, 10)) {
    errors.body = "Template message must be at least 10 characters.";
  } else if (!validateMaxLength(formData.body, 1000)) {
    errors.body = "Template message must be under 1000 characters.";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

// ─── getFieldError ────────────────────────────────────────────────────────────
// Helper — returns error message for a field or null
// Used in JSX: {getFieldError(errors, "phone") && <span>{getFieldError(errors, "phone")}</span>}

export const getFieldError = (errors = {}, field) => {
  return errors[field] || null;
};

// ─── hasErrors ────────────────────────────────────────────────────────────────
// Quick check — are there any errors in the errors object?

export const hasErrors = (errors = {}) => {
  return Object.keys(errors).length > 0;
};
