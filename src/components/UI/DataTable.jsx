// TIRAS CRM — DataTable Component
// Reusable across all 31 pages — leads list, calls, tickets, agents, payments
//
// Usage:
//   const columns = [
//     { key: "name",   label: "Lead Name", sortable: true },
//     { key: "phone",  label: "Phone",     sortable: false },
//     { key: "stage",  label: "Stage",     render: (row) => <StageBadge stage={row.stage} /> },
//     { key: "actions",label: "",          render: (row) => <ActionsMenu row={row} /> },
//   ];
//
//   <DataTable
//     columns={columns}
//     data={leads}
//     loading={loading}
//     onRowClick={(row) => navigate(`/agent/lead/${row.id}`)}
//     emptyMessage="No leads found. Add your first lead to get started."
//   />

import React, { useState, useMemo, useCallback } from "react";
import {
  MdArrowUpward,
  MdArrowDownward,
  MdUnfoldMore,
  MdChevronLeft,
  MdChevronRight,
  MdFirstPage,
  MdLastPage,
  MdInbox,
} from "react-icons/md";
import { COLORS, FONTS, SPACING, RADIUS, TRANSITIONS } from "../../theme";

// ─── Keyframe injection ───────────────────────────────────────────────────────

const injectTableKeyframes = () => {
  if (document.getElementById("tiras-table-keyframes")) return;
  const style = document.createElement("style");
  style.id = "tiras-table-keyframes";
  style.textContent = `
    @keyframes tiras-shimmer {
      0%   { background-position: -600px 0; }
      100% { background-position:  600px 0; }
    }
    @keyframes tiras-row-in {
      from { opacity: 0; transform: translateY(4px); }
      to   { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(style);
};

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_PAGE_SIZE = 20;
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

// ─── SkeletonRow ──────────────────────────────────────────────────────────────
// Shimmer placeholder row shown while data loads

const SkeletonCell = ({ width = "80%" }) => {
  injectTableKeyframes();

  return (
    <td style={{ padding: `${SPACING.md} ${SPACING.base}` }}>
      <div
        style={{
          height:     "14px",
          width,
          borderRadius: RADIUS.sm,
          background: `linear-gradient(
            90deg,
            ${COLORS.surface}      0%,
            ${COLORS.surfaceHover} 40%,
            ${COLORS.surface}      80%
          )`,
          backgroundSize: "600px 100%",
          animation:  "tiras-shimmer 1.4s ease-in-out infinite",
        }}
      />
    </td>
  );
};

const SkeletonRow = ({ columnCount }) => {
  // Vary widths so skeleton looks natural, not robotic
  const widths = ["75%", "60%", "85%", "50%", "70%", "40%", "65%", "55%"];

  return (
    <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
      {Array.from({ length: columnCount }).map((_, i) => (
        <SkeletonCell key={i} width={widths[i % widths.length]} />
      ))}
    </tr>
  );
};

// ─── SortIcon ─────────────────────────────────────────────────────────────────

const SortIcon = ({ columnKey, sortKey, sortDir }) => {
  const isActive = sortKey === columnKey;

  if (!isActive) {
    return (
      <MdUnfoldMore
        size={14}
        color={COLORS.textMuted}
        style={{ flexShrink: 0, opacity: 0.5 }}
      />
    );
  }

  return sortDir === "asc" ? (
    <MdArrowUpward size={14} color={COLORS.primary} style={{ flexShrink: 0 }} />
  ) : (
    <MdArrowDownward size={14} color={COLORS.primary} style={{ flexShrink: 0 }} />
  );
};

// ─── EmptyRow ─────────────────────────────────────────────────────────────────

const EmptyRow = ({ columnCount, message }) => (
  <tr>
    <td colSpan={columnCount}>
      <div
        style={{
          display:        "flex",
          flexDirection:  "column",
          alignItems:     "center",
          justifyContent: "center",
          gap:            SPACING.md,
          padding:        `${SPACING["4xl"]} ${SPACING.xl}`,
          color:          COLORS.textMuted,
        }}
      >
        <MdInbox size={40} color={COLORS.border} />
        <span style={{ fontSize: FONTS.size.base, color: COLORS.textSecondary }}>
          {message}
        </span>
      </div>
    </td>
  </tr>
);

// ─── Pagination ───────────────────────────────────────────────────────────────

const Pagination = ({
  currentPage,
  totalPages,
  totalRows,
  pageSize,
  onPageChange,
  onPageSizeChange,
  startRow,
  endRow,
}) => {
  // Build visible page numbers — always show first, last, current ± 1
  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages = new Set([1, totalPages, currentPage]);
    if (currentPage > 1) pages.add(currentPage - 1);
    if (currentPage < totalPages) pages.add(currentPage + 1);

    return Array.from(pages).sort((a, b) => a - b);
  };

  const pageNumbers = getPageNumbers();

  const btnStyle = (active = false, disabled = false) => ({
    display:         "flex",
    alignItems:      "center",
    justifyContent:  "center",
    minWidth:        "32px",
    height:          "32px",
    padding:         `0 ${SPACING.sm}`,
    borderRadius:    RADIUS.base,
    border:          `1px solid ${active ? COLORS.primary : COLORS.border}`,
    backgroundColor: active ? COLORS.primary : "transparent",
    color:           active
      ? COLORS.textInverse
      : disabled
      ? COLORS.textMuted
      : COLORS.textSecondary,
    fontSize:        FONTS.size.sm,
    fontWeight:      active ? FONTS.weight.semibold : FONTS.weight.regular,
    cursor:          disabled ? "not-allowed" : "pointer",
    transition:      TRANSITIONS.fast,
    opacity:         disabled ? 0.4 : 1,
    fontFamily:      FONTS.family,
  });

  return (
    <div
      style={{
        display:         "flex",
        alignItems:      "center",
        justifyContent:  "space-between",
        flexWrap:        "wrap",
        gap:             SPACING.sm,
        padding:         `${SPACING.md} ${SPACING.base}`,
        borderTop:       `1px solid ${COLORS.border}`,
        backgroundColor: COLORS.surface,
      }}
    >
      {/* Left — row count info */}
      <div
        style={{
          color:    COLORS.textMuted,
          fontSize: FONTS.size.sm,
          display:  "flex",
          alignItems: "center",
          gap: SPACING.sm,
        }}
      >
        <span>
          {totalRows === 0
            ? "No records"
            : `${startRow}–${endRow} of ${totalRows}`}
        </span>

        {/* Page size selector */}
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          style={{
            backgroundColor: COLORS.surfaceHover,
            border:          `1px solid ${COLORS.border}`,
            borderRadius:    RADIUS.sm,
            color:           COLORS.textSecondary,
            fontSize:        FONTS.size.sm,
            padding:         `2px ${SPACING.xs}`,
            cursor:          "pointer",
            fontFamily:      FONTS.family,
          }}
          title="Rows per page"
        >
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size} / page
            </option>
          ))}
        </select>
      </div>

      {/* Right — page navigation */}
      {totalPages > 1 && (
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>

          {/* First page */}
          <button
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1}
            style={btnStyle(false, currentPage === 1)}
            title="First page"
            onMouseEnter={(e) => {
              if (currentPage !== 1) e.currentTarget.style.borderColor = COLORS.primary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = COLORS.border;
            }}
          >
            <MdFirstPage size={16} />
          </button>

          {/* Prev */}
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            style={btnStyle(false, currentPage === 1)}
            title="Previous page"
            onMouseEnter={(e) => {
              if (currentPage !== 1) e.currentTarget.style.borderColor = COLORS.primary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = COLORS.border;
            }}
          >
            <MdChevronLeft size={16} />
          </button>

          {/* Page numbers */}
          {pageNumbers.map((page, idx) => {
            const prevPage = pageNumbers[idx - 1];
            const showEllipsis = prevPage && page - prevPage > 1;

            return (
              <React.Fragment key={page}>
                {showEllipsis && (
                  <span
                    style={{
                      color:    COLORS.textMuted,
                      fontSize: FONTS.size.sm,
                      padding:  `0 ${SPACING.xs}`,
                    }}
                  >
                    …
                  </span>
                )}
                <button
                  onClick={() => onPageChange(page)}
                  style={btnStyle(page === currentPage, false)}
                  onMouseEnter={(e) => {
                    if (page !== currentPage) {
                      e.currentTarget.style.borderColor = COLORS.primary;
                      e.currentTarget.style.color = COLORS.textPrimary;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (page !== currentPage) {
                      e.currentTarget.style.borderColor = COLORS.border;
                      e.currentTarget.style.color = COLORS.textSecondary;
                    }
                  }}
                >
                  {page}
                </button>
              </React.Fragment>
            );
          })}

          {/* Next */}
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            style={btnStyle(false, currentPage === totalPages)}
            title="Next page"
            onMouseEnter={(e) => {
              if (currentPage !== totalPages) e.currentTarget.style.borderColor = COLORS.primary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = COLORS.border;
            }}
          >
            <MdChevronRight size={16} />
          </button>

          {/* Last page */}
          <button
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage === totalPages}
            style={btnStyle(false, currentPage === totalPages)}
            title="Last page"
            onMouseEnter={(e) => {
              if (currentPage !== totalPages) e.currentTarget.style.borderColor = COLORS.primary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = COLORS.border;
            }}
          >
            <MdLastPage size={16} />
          </button>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// DataTable — Main Component
// ═══════════════════════════════════════════════════════════════════════════════

export const DataTable = ({
  columns      = [],
  data         = [],
  loading      = false,
  emptyMessage = "No data found.",
  onRowClick   = null,
  pageSize: initialPageSize = DEFAULT_PAGE_SIZE,
  skeletonRows = 5,
  stickyHeader = true,
}) => {
  injectTableKeyframes();

  const [sortKey,     setSortKey]     = useState(null);
  const [sortDir,     setSortDir]     = useState("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize,    setPageSize]    = useState(initialPageSize);

  // ── Sort handler ───────────────────────────────────────────────────────────

  const handleSort = useCallback((columnKey) => {
    setSortKey((prev) => {
      if (prev === columnKey) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return columnKey;
      }
      setSortDir("asc");
      return columnKey;
    });
    setCurrentPage(1);
  }, []);

  // ── Sorted data ────────────────────────────────────────────────────────────

  const sortedData = useMemo(() => {
    if (!sortKey) return data;

    return [...data].sort((a, b) => {
      let aVal = a[sortKey];
      let bVal = b[sortKey];

      // Handle Firestore Timestamps
      if (aVal?.toDate) aVal = aVal.toDate().getTime();
      if (bVal?.toDate) bVal = bVal.toDate().getTime();

      // Nulls always last
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      // Numeric
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDir === "asc" ? aVal - bVal : bVal - aVal;
      }

      // String — case-insensitive
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      if (aStr < bStr) return sortDir === "asc" ? -1 : 1;
      if (aStr > bStr) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [data, sortKey, sortDir]);

  // ── Pagination ─────────────────────────────────────────────────────────────

  const totalRows  = sortedData.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));

  // Clamp current page when data shrinks
  const safePage   = Math.min(currentPage, totalPages);
  const startIdx   = (safePage - 1) * pageSize;
  const endIdx     = Math.min(startIdx + pageSize, totalRows);
  const pageData   = sortedData.slice(startIdx, endIdx);

  const startRow   = totalRows === 0 ? 0 : startIdx + 1;
  const endRow     = endIdx;

  const handlePageChange = useCallback((page) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  }, [totalPages]);

  const handlePageSizeChange = useCallback((size) => {
    setPageSize(size);
    setCurrentPage(1);
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        backgroundColor: COLORS.surface,
        border:          `1px solid ${COLORS.border}`,
        borderRadius:    RADIUS.lg,
        overflow:        "hidden",
        width:           "100%",
      }}
    >
      {/* Horizontal scroll wrapper for mobile */}
      <div
        style={{
          overflowX:           "auto",
          WebkitOverflowScrolling: "touch",
          scrollbarWidth:      "thin",
          scrollbarColor:      `${COLORS.scrollbarThumb} ${COLORS.scrollbarTrack}`,
        }}
      >
        <table
          style={{
            width:           "100%",
            minWidth:        "600px",
            borderCollapse:  "collapse",
            tableLayout:     "auto",
          }}
        >
          {/* ── Column headers ───────────────────────────────────────────── */}
          <thead
            style={
              stickyHeader
                ? { position: "sticky", top: 0, zIndex: 10 }
                : {}
            }
          >
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                  style={{
                    backgroundColor: COLORS.surfaceActive,
                    borderBottom:    `2px solid ${COLORS.border}`,
                    borderRight:     `1px solid ${COLORS.border}`,
                    padding:         `${SPACING.sm} ${SPACING.base}`,
                    textAlign:       "left",
                    whiteSpace:      "nowrap",
                    cursor:          col.sortable ? "pointer" : "default",
                    userSelect:      "none",
                    transition:      TRANSITIONS.fast,
                  }}
                  onMouseEnter={(e) => {
                    if (col.sortable) {
                      e.currentTarget.style.backgroundColor = COLORS.surfaceHover;
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = COLORS.surfaceActive;
                  }}
                >
                  <div
                    style={{
                      display:     "flex",
                      alignItems:  "center",
                      gap:         SPACING.xs,
                    }}
                  >
                    {/* Left accent bar on sorted column */}
                    {sortKey === col.key && (
                      <div
                        style={{
                          width:           "3px",
                          height:          "14px",
                          borderRadius:    "2px",
                          backgroundColor: COLORS.primary,
                          flexShrink:      0,
                        }}
                      />
                    )}

                    <span
                      style={{
                        fontSize:      FONTS.size.xs,
                        fontWeight:    FONTS.weight.semibold,
                        color:         sortKey === col.key
                          ? COLORS.primary
                          : COLORS.textSecondary,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                      }}
                    >
                      {col.label}
                    </span>

                    {col.sortable && (
                      <SortIcon
                        columnKey={col.key}
                        sortKey={sortKey}
                        sortDir={sortDir}
                      />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          {/* ── Body ────────────────────────────────────────────────────── */}
          <tbody>

            {/* Loading skeleton */}
            {loading && Array.from({ length: skeletonRows }).map((_, i) => (
              <SkeletonRow key={`skeleton-${i}`} columnCount={columns.length} />
            ))}

            {/* Empty state */}
            {!loading && pageData.length === 0 && (
              <EmptyRow columnCount={columns.length} message={emptyMessage} />
            )}

            {/* Data rows */}
            {!loading && pageData.map((row, rowIdx) => (
              <DataRow
                key={row.id || rowIdx}
                row={row}
                columns={columns}
                rowIdx={rowIdx}
                onRowClick={onRowClick}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Pagination bar ───────────────────────────────────────────────── */}
      {!loading && (
        <Pagination
          currentPage={safePage}
          totalPages={totalPages}
          totalRows={totalRows}
          pageSize={pageSize}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          startRow={startRow}
          endRow={endRow}
        />
      )}
    </div>
  );
};

// ─── DataRow ──────────────────────────────────────────────────────────────────
// Extracted to its own component so hover state is isolated per row

const DataRow = ({ row, columns, rowIdx, onRowClick }) => {
  const [hovered, setHovered] = useState(false);
  const isClickable = typeof onRowClick === "function";

  return (
    <tr
      onClick={isClickable ? () => onRowClick(row) : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        backgroundColor: hovered
          ? COLORS.surfaceHover
          : rowIdx % 2 === 0
          ? COLORS.surface
          : `${COLORS.surfaceActive}60`,
        borderBottom:    `1px solid ${COLORS.border}`,
        cursor:          isClickable ? "pointer" : "default",
        transition:      "background-color 0.12s ease",
        animation:       `tiras-row-in 0.2s ease ${Math.min(rowIdx * 0.03, 0.3)}s both`,
      }}
    >
      {columns.map((col) => (
        <td
          key={col.key}
          style={{
            padding:      `${SPACING.md} ${SPACING.base}`,
            fontSize:     FONTS.size.base,
            color:        COLORS.textPrimary,
            whiteSpace:   "nowrap",
            maxWidth:     "280px",
            overflow:     "hidden",
            textOverflow: "ellipsis",
            borderRight:  `1px solid ${COLORS.border}30`,
            verticalAlign: "middle",
          }}
        >
          {col.render
            ? col.render(row)
            : row[col.key] !== null && row[col.key] !== undefined
            ? String(row[col.key])
            : <span style={{ color: COLORS.textMuted }}>—</span>
          }
        </td>
      ))}
    </tr>
  );
};

export default DataTable;
