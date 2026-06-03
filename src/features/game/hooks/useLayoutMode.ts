"use client";

import { useEffect, useState } from "react";

export type LayoutMode = "desktop" | "mobile-portrait" | "mobile-landscape";

const PORTRAIT_QUERY = "(max-width: 767px) and (orientation: portrait)";
// Phones lying down are best detected by a short viewport height, not width —
// an iPhone in landscape can be ~932px wide but only ~430px tall, so a
// width-based check would misclassify it as desktop.
const LANDSCAPE_QUERY = "(orientation: landscape) and (max-height: 600px)";

/**
 * Picks exactly one of three play-area layouts. We render only the matching one
 * (never all three hidden) so the shared card-flight anchors (`seat-${id}`,
 * `deck`) exist exactly once and resolve to real, non-zero rects.
 */
export function useLayoutMode(): LayoutMode {
  // Default to desktop on the server; corrected on mount before paint.
  const [mode, setMode] = useState<LayoutMode>("desktop");

  useEffect(() => {
    const portrait = window.matchMedia(PORTRAIT_QUERY);
    const landscape = window.matchMedia(LANDSCAPE_QUERY);

    const update = () => {
      if (landscape.matches) setMode("mobile-landscape");
      else if (portrait.matches) setMode("mobile-portrait");
      else setMode("desktop");
    };

    update();
    portrait.addEventListener("change", update);
    landscape.addEventListener("change", update);
    return () => {
      portrait.removeEventListener("change", update);
      landscape.removeEventListener("change", update);
    };
  }, []);

  return mode;
}
