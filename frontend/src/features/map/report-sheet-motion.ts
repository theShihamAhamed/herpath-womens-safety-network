const SNAP_VELOCITY = 650;

/** Keeps the sheet within its expanded (0) and collapsed travel bounds. */
export function clampReportSheetOffset(offset: number, collapsedOffset: number) {
  'worklet';

  return Math.min(Math.max(offset, 0), collapsedOffset);
}

/** Chooses the closest resting position, favouring the user's release direction. */
export function resolveReportSheetSnapOffset(offset: number, velocityY: number, collapsedOffset: number) {
  if (velocityY <= -SNAP_VELOCITY) return 0;
  if (velocityY >= SNAP_VELOCITY) return collapsedOffset;

  return offset < collapsedOffset / 2 ? 0 : collapsedOffset;
}
