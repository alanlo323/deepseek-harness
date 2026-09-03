/**
 * Pure concession-chain column solver for the AppFrame. Chain order is fixed
 * by contract: keep center >= CENTER_MIN by shrinking details, then the
 * browser track, then auto-closing details (derived zero width — preferred
 * width preferences are never rewritten, so widening the window restores
 * them). The sidebar never concedes: its rendered width is always the drag
 * preference (or the collapsed rail), and center absorbs any remaining
 * deficit as the last resort. Inputs are the layout store's plain width
 * preferences (0 = closed); a closed sidebar resolves to the fixed
 * SIDEBAR_COLLAPSED control rail while closed details and a closed browser
 * resolve to zero width. The SIDEBAR_AUTO_COLLAPSE breakpoint is consumed by
 * AppFrame; the four-column gate {@link BROWSER_FOUR_COLUMN_MIN} is the only
 * breakpoint the solver itself applies. Below that gate an open browser
 * preference still yields a zero grid track so AppFrame can present a
 * strip overlay without rewriting details.
 */

/** Resolved widths for one frame; center may drop below CENTER_MIN only at the final fallback. */
export interface Columns { sidebar: number; center: number; details: number; browser: number }

// Contract-frozen geometry: the three-column concession chain's fixed points.
/** Center column floor; only the final fallback may go below it. */
export const CENTER_MIN = 640
/** Sidebar drag clamp floor. */
export const SIDEBAR_MIN = 264
/** Sidebar drag clamp ceiling. */
export const SIDEBAR_MAX = 420
/** Sidebar width before any user drag. */
export const SIDEBAR_DEFAULT = 280
/** Closed-sidebar rail: a 24px icon column between 16px horizontal paddings. */
export const SIDEBAR_COLLAPSED = 56
/** Viewport width below which the sidebar auto-collapses to the rail (deepsuite
 * LG breakpoint); a manual toggle below it re-expands over the squeezed center
 * (stores.ts narrowExpanded). */
export const SIDEBAR_AUTO_COLLAPSE = 1024
/** Details drag clamp floor. */
export const DETAILS_MIN = 300
/** Details drag clamp ceiling. */
export const DETAILS_MAX = 520
/** Details width before any user drag. */
export const DETAILS_DEFAULT = 360
/** Browser track floor while the four-column grid is active. */
export const BROWSER_MIN = 160
/** Browser drag clamp ceiling. */
export const BROWSER_MAX = 520
/** Browser width before any user drag. */
export const BROWSER_DEFAULT = 240
/**
 * Overlay strip width when the browser preference is open but the viewport
 * is below {@link BROWSER_FOUR_COLUMN_MIN}. Not a grid track.
 */
export const BROWSER_STRIP_WIDTH = 80
/**
 * Viewport floor at which an open browser preference receives a fourth grid
 * track. Arithmetic: SIDEBAR_DEFAULT + CENTER_MIN + DETAILS_MIN + BROWSER_MIN.
 * Below this, AppFrame keeps the three-column solve and shows a strip overlay.
 */
export const BROWSER_FOUR_COLUMN_MIN = SIDEBAR_DEFAULT + CENTER_MIN + DETAILS_MIN + BROWSER_MIN

/**
 * Clamp a panel width into its contract range.
 * @param px - requested width.
 * @param min - range lower bound.
 * @param max - range upper bound.
 * @returns the clamped width.
 */
export function clampWidth(px: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(px)))
}

/**
 * Solve column widths for one viewport frame. Pure: no hysteresis — the
 * output is a function of (viewport, preferences) only, so recovery on
 * re-widening is automatic. Preferences re-clamp here because they cross the
 * store boundary and callers may still supply stale ranges.
 * @param viewport - available frame width in px.
 * @param sidebar - sidebar width preference in px (0 = closed).
 * @param details - details width preference in px (0 = closed).
 * @param browser - browser width preference in px (0 = closed).
 * @returns resolved widths; details/browser 0 means visually closed (never
 *   unmounted), while a closed sidebar keeps its compact rail. Below
 *   {@link BROWSER_FOUR_COLUMN_MIN} an open browser preference still resolves
 *   `browser` to 0 so the occupant can render as a strip overlay.
 */
export function computeColumns(
  viewport: number,
  sidebar: number,
  details: number,
  browser = 0,
): Columns {
  const s = sidebar === 0 ? SIDEBAR_COLLAPSED : clampWidth(sidebar, SIDEBAR_MIN, SIDEBAR_MAX)
  const d0 = details === 0 ? 0 : clampWidth(details, DETAILS_MIN, DETAILS_MAX)
  const b0 = browser === 0 ? 0 : clampWidth(browser, BROWSER_MIN, BROWSER_MAX)
  if (b0 === 0 || viewport < BROWSER_FOUR_COLUMN_MIN) {
    return { ...solveThree(viewport, s, d0), browser: 0 }
  }
  return solveFour(viewport, s, d0, b0)
}

/**
 * Three-column concession chain (sidebar never yields).
 * @param viewport - available frame width in px.
 * @param s - resolved sidebar width.
 * @param d0 - preferred details width, or 0 when closed.
 * @returns sidebar, center, and details widths.
 */
function solveThree(viewport: number, s: number, d0: number): Omit<Columns, 'browser'> {
  if (s + d0 + CENTER_MIN <= viewport) return { sidebar: s, center: viewport - s - d0, details: d0 }
  const d1 = d0 === 0 ? 0 : Math.max(DETAILS_MIN, viewport - s - CENTER_MIN)
  if (s + d1 + CENTER_MIN <= viewport) return { sidebar: s, center: CENTER_MIN, details: d1 }
  return { sidebar: s, center: Math.max(0, viewport - s), details: 0 }
}

/**
 * Four-column concession: shrink details toward DETAILS_MIN, then browser
 * toward BROWSER_MIN, never dropping CENTER_MIN until the final fallback.
 * @param viewport - available frame width in px.
 * @param s - resolved sidebar width.
 * @param d0 - preferred details width, or 0 when closed.
 * @param b0 - preferred browser width (already clamped, never 0).
 * @returns all four resolved widths.
 */
function solveFour(viewport: number, s: number, d0: number, b0: number): Columns {
  if (s + d0 + b0 + CENTER_MIN <= viewport) {
    return { sidebar: s, center: viewport - s - d0 - b0, details: d0, browser: b0 }
  }
  const d1 = d0 === 0 ? 0 : Math.max(DETAILS_MIN, viewport - s - CENTER_MIN - b0)
  if (s + d1 + b0 + CENTER_MIN <= viewport) {
    return { sidebar: s, center: CENTER_MIN, details: d1, browser: b0 }
  }
  const d2 = d0 === 0 ? 0 : DETAILS_MIN
  const b1 = Math.max(BROWSER_MIN, viewport - s - CENTER_MIN - d2)
  if (s + d2 + b1 + CENTER_MIN <= viewport) {
    return { sidebar: s, center: CENTER_MIN, details: d2, browser: b1 }
  }
  return {
    sidebar: s,
    center: Math.max(0, viewport - s - d2 - BROWSER_MIN),
    details: d2,
    browser: BROWSER_MIN,
  }
}
