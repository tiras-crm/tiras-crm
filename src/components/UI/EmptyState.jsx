// TIRAS CRM — EmptyState Component
// Shown whenever a list, table, or section has no data to display
//
// Usage examples:
//   <EmptyState
//     icon={MdPeople}
//     title="No leads yet"
//     message="Add your first lead or import a CSV to get started."
//     actionLabel="Add Lead"
//     onAction={() => navigate("/agent/add-lead")}
//   />
//
//   <EmptyState
//     icon={MdNotifications}
//     title="You're all caught up"
//     message="No new notifications."
//   />
//
//   <EmptyState
//     icon={MdAssignment}
//     title="No open tickets"
//     message="All support tickets have been resolved."
//     variant="success"
//   />

import React from "react";
import { MdInbox } from "react-icons/md";
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS, STYLES, TRANSITIONS } from "../../theme";

// ─── EmptyState ───────────────────────────────────────────────────────────────
// Props:
//   icon         React icon component   Icon to display (from react-icons/md)
//   title        string                 Bold heading
//   message      string                 Subtext description
//   actionLabel  string                 CTA button label (optional)
//   onAction     function               CTA button handler (optional)
//   secondaryLabel  string              Secondary button label (optional)
//   onSecondary     function            Secondary button handler (optional)
//   variant      string                 "default" | "success" | "search"
//   size         string                 "sm" | "md" | "lg" (default: "md")
//   fullPage     bool                   If true, takes full viewport height

export const EmptyState = ({
  icon: Icon = MdInbox,
  title       = "Nothing here yet",
  message     = "",
  actionLabel = null,
  onAction    = null,
  secondaryLabel = null,
  onSecondary    = null,
  variant     = "default",
  size        = "md",
  fullPage    = false,
}) => {

  // ── Size scale ─────────────────────────────────────────────────────────────

  const scale = {
    sm: {
      iconBox:   "52px",
      iconSize:  24,
      titleSize: FONTS.size.md,
      msgSize:   FONTS.size.sm,
      padding:   SPACING["2xl"],
    },
    md: {
      iconBox:   "72px",
      iconSize:  32,
      titleSize: FONTS.size.xl,
      msgSize:   FONTS.size.base,
      padding:   SPACING["4xl"],
    },
    lg: {
      iconBox:   "96px",
      iconSize:  44,
      titleSize: FONTS.size["3xl"],
      msgSize:   FONTS.size.md,
      padding:   SPACING["5xl"],
    },
  }[size] || {};

  // ── Variant colors ─────────────────────────────────────────────────────────

  const variantConfig = {
    default: {
      iconBg:     COLORS.primaryMuted,
      iconColor:  COLORS.primary,
      iconBorder: `1px solid ${COLORS.primary}30`,
    },
    success: {
      iconBg:     COLORS.successMuted,
      iconColor:  COLORS.success,
      iconBorder: `1px solid ${COLORS.success}30`,
    },
    search: {
      iconBg:     COLORS.infoMuted,
      iconColor:  COLORS.info,
      iconBorder: `1px solid ${COLORS.info}30`,
    },
  }[variant] || {};

  return (
    <div
      style={{
        display:        "flex",
        flexDirection:  "column",
        alignItems:     "center",
        justifyContent: "center",
        textAlign:      "center",
        padding:        scale.padding,
        minHeight:      fullPage ? "calc(100vh - 60px)" : "auto",
        width:          "100%",
        boxSizing:      "border-box",
      }}
    >
      {/* Icon container */}
      <div
        style={{
          width:           scale.iconBox,
          height:          scale.iconBox,
          borderRadius:    RADIUS.xl,
          backgroundColor: variantConfig.iconBg,
          border:          variantConfig.iconBorder,
          display:         "flex",
          alignItems:      "center",
          justifyContent:  "center",
          marginBottom:    SPACING.xl,
          flexShrink:      0,
        }}
      >
        <Icon size={scale.iconSize} color={variantConfig.iconColor} />
      </div>

      {/* Title */}
      <h3
        style={{
          color:        COLORS.textPrimary,
          fontSize:     scale.titleSize,
          fontWeight:   FONTS.weight.semibold,
          margin:       0,
          marginBottom: message ? SPACING.sm : 0,
          lineHeight:   FONTS.lineHeight.tight,
          maxWidth:     "400px",
        }}
      >
        {title}
      </h3>

      {/* Message */}
      {message && (
        <p
          style={{
            color:      COLORS.textSecondary,
            fontSize:   scale.msgSize,
            margin:     0,
            lineHeight: FONTS.lineHeight.relaxed,
            maxWidth:   "360px",
          }}
        >
          {message}
        </p>
      )}

      {/* Action buttons */}
      {(actionLabel || secondaryLabel) && (
        <div
          style={{
            display:    "flex",
            gap:        SPACING.sm,
            marginTop:  SPACING.xl,
            flexWrap:   "wrap",
            justifyContent: "center",
          }}
        >
          {/* Primary CTA */}
          {actionLabel && onAction && (
            <button
              onClick={onAction}
              style={{
                ...STYLES.buttonPrimary,
                fontSize:   FONTS.size.base,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = COLORS.primaryHover;
                e.currentTarget.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = COLORS.primary;
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              {actionLabel}
            </button>
          )}

          {/* Secondary action */}
          {secondaryLabel && onSecondary && (
            <button
              onClick={onSecondary}
              style={{
                ...STYLES.buttonSecondary,
                fontSize: FONTS.size.base,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = COLORS.surfaceHover;
                e.currentTarget.style.borderColor = COLORS.primary;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
                e.currentTarget.style.borderColor = COLORS.border;
              }}
            >
              {secondaryLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// ─── SearchEmptyState ─────────────────────────────────────────────────────────
// Shorthand for "no search results" — very common pattern

export const SearchEmptyState = ({ searchTerm = "", onClear }) => {
  const { MdSearchOff } = require("react-icons/md");

  return (
    <EmptyState
      icon={MdSearchOff}
      title="No results found"
      message={
        searchTerm
          ? `No results for "${searchTerm}". Try a different name, phone, or email.`
          : "No results match your current filters."
      }
      actionLabel={onClear ? "Clear search" : null}
      onAction={onClear}
      variant="search"
      size="md"
    />
  );
};

export default EmptyState;
