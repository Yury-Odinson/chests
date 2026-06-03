/**
 * Border + ring classes shared by every seat (desktop + mobile). Priority:
 *   - selected (you're picking this opponent as your target) → bright amber;
 *   - current (whose turn it is) → green glow;
 *   - target (the player being asked during a pending guess) → light yellow;
 *   - selectable (a valid pick this turn) → faint amber;
 *   - otherwise neutral.
 */
export function seatHighlightClass({
  isCurrent,
  isTarget,
  isSelectable = false,
  isSelected = false,
}: {
  isCurrent: boolean;
  isTarget: boolean;
  isSelectable?: boolean;
  isSelected?: boolean;
}): string {
  if (isSelected) return "border-amber-200 ring-2 ring-amber-200/70";
  if (isCurrent)
    return "border-emerald-400 ring-2 ring-emerald-400/55 shadow-[0_0_22px_rgba(52,211,153,0.45)]";
  if (isTarget)
    return "border-yellow-200 ring-2 ring-yellow-200/60 shadow-[0_0_22px_rgba(254,240,138,0.4)]";
  if (isSelectable)
    return "border-amber-200/60 ring-2 ring-amber-200/30 hover:border-amber-100 hover:ring-amber-100/50";
  return "border-amber-100/18";
}
