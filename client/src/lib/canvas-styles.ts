import type { PaletteId } from "./theme-utils";

export interface CanvasStyleDef {
  key: string;
  label: string;
  description: string;
  background: string | null;  // CSS background value, null = theme default
  gridOpacity: number;        // 0-1
  gridColor: string;          // CSS color
  heroVisible: boolean;       // show BG Labs hero animation
  swatchColor: string;        // swatch preview color
  isDark: boolean;            // true = adds .dark class, false = removes it
  paletteId: PaletteId;
  cssClass?: string;          // Optional class applied to <html> for theme-specific styles
}

export const CANVAS_STYLES: CanvasStyleDef[] = [
  // ── Default ──
  {
    key: "aurora",
    label: "Aurora",
    description: "Shifting aurora glow",
    background: null,
    gridOpacity: 0.2,
    gridColor: "currentColor",
    heroVisible: true,
    swatchColor: "#1a1040",
    isDark: true,
    paletteId: "dusk",
    cssClass: "canvas-aurora",
  },
  // ── Light themes ──
  {
    key: "paper",
    label: "Paper",
    description: "Warm notebook, aged paper",
    background: `linear-gradient(180deg, hsl(38, 40%, 96%) 0%, hsl(35, 35%, 93%) 100%), url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='200' height='200' fill='%23f5efe6'/%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E")`,
    gridOpacity: 0.2,
    gridColor: "#c8b89a",
    heroVisible: false,
    swatchColor: "#f5efe6",
    isDark: false,
    paletteId: "ember",
  },
  {
    key: "daylight",
    label: "Daylight",
    description: "Clean, bright, professional",
    background: "linear-gradient(180deg, hsl(210, 30%, 98%) 0%, hsl(210, 25%, 95%) 100%)",
    gridOpacity: 0.15,
    gridColor: "#94b8d4",
    heroVisible: false,
    swatchColor: "#eef4fa",
    isDark: false,
    paletteId: "ocean",
  },
  {
    key: "blueprint",
    label: "Blueprint",
    description: "Technical drafting board",
    background: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Crect width='80' height='80' fill='%23dce6f0'/%3E%3Cpath d='M80 0L0 0 0 80' fill='none' stroke='%23a0b8cc44' stroke-width='0.5'/%3E%3C/svg%3E")`,
    gridOpacity: 0.35,
    gridColor: "#6a9ec0",
    heroVisible: false,
    swatchColor: "#dce6f0",
    isDark: false,
    paletteId: "slate",
  },
  // ── Dark themes ──
  {
    key: "midnight",
    label: "Midnight",
    description: "Deep space, starry night",
    background: `radial-gradient(ellipse at 30% 20%, hsl(240, 40%, 12%) 0%, hsl(230, 35%, 6%) 70%, hsl(225, 30%, 4%) 100%), url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Ccircle cx='23' cy='67' r='0.6' fill='%23ffffff20'/%3E%3Ccircle cx='187' cy='23' r='0.5' fill='%23ffffff18'/%3E%3Ccircle cx='321' cy='89' r='0.7' fill='%23ffffff1a'/%3E%3Ccircle cx='67' cy='234' r='0.4' fill='%23ffffff14'/%3E%3Ccircle cx='289' cy='178' r='0.6' fill='%23ffffff1c'/%3E%3Ccircle cx='134' cy='312' r='0.5' fill='%23ffffff16'/%3E%3Ccircle cx='356' cy='267' r='0.6' fill='%23ffffff18'/%3E%3Ccircle cx='78' cy='378' r='0.4' fill='%23ffffff12'/%3E%3Ccircle cx='234' cy='345' r='0.7' fill='%23ffffff1e'/%3E%3Ccircle cx='167' cy='145' r='0.5' fill='%23ffffff16'/%3E%3Ccircle cx='390' cy='390' r='0.4' fill='%23ffffff14'/%3E%3Ccircle cx='45' cy='156' r='0.6' fill='%23ffffff1a'/%3E%3C/svg%3E")`,
    gridOpacity: 0,
    gridColor: "currentColor",
    heroVisible: false,
    swatchColor: "#0c0c22",
    isDark: true,
    paletteId: "dusk",
  },
  {
    key: "forest",
    label: "Forest",
    description: "Deep emerald, organic calm",
    background: "radial-gradient(ellipse at 40% 30%, hsl(150, 35%, 10%) 0%, hsl(155, 30%, 5%) 70%, hsl(160, 25%, 3%) 100%)",
    gridOpacity: 0.15,
    gridColor: "#2d6b4a",
    heroVisible: false,
    swatchColor: "#0a1f14",
    isDark: true,
    paletteId: "forest",
  },
  {
    key: "void",
    label: "Void",
    description: "Pure black, zero distraction",
    background: "radial-gradient(ellipse at 50% 50%, #0e0e12 0%, #060608 70%, #020203 100%)",
    gridOpacity: 0,
    gridColor: "currentColor",
    heroVisible: false,
    swatchColor: "#050508",
    isDark: true,
    paletteId: "slate",
  },
];
