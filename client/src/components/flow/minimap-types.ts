// Factorio-inspired minimap — shared type definitions

export interface MinimapState {
  /** Is the minimap visible */
  visible: boolean;
  /** Position on screen (CSS left/top in px). -1 = use default bottom-right */
  x: number;
  y: number;
  /** Dimensions in px */
  width: number;
  height: number;
  /** Independent minimap zoom level (1.0 = auto-fit, >1 = zoomed in) */
  minimapZoom: number;
  /** Whether pinned (persisted absolute screen position) */
  pinned: boolean;
  /** Whether collapsed to just the title bar */
  collapsed: boolean;
}

export const MINIMAP_DEFAULTS: MinimapState = {
  visible: true,
  x: -1,
  y: -1,
  width: 220,
  height: 140,
  minimapZoom: 1.0,
  pinned: false,
  collapsed: false,
};

export const MINIMAP_MIN_WIDTH = 120;
export const MINIMAP_MIN_HEIGHT = 80;
export const MINIMAP_MAX_WIDTH = 400;
export const MINIMAP_MAX_HEIGHT = 300;
export const MINIMAP_HEADER_HEIGHT = 22;
export const MINIMAP_STORAGE_KEY = "provocations-flow-minimap";
