import type { SVGProps } from "react";

/**
 * ProvoIcon — Primary brand icon for Provocations.
 * A 4-pointed star with small plus (+) symbols at the cardinal points,
 * representing AI-enhanced human productivity.
 *
 * Accepts the same props as a standard SVG element (className, width, height, etc.)
 * Uses currentColor so it inherits text-primary or any Tailwind text color class.
 */
export function ProvoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      fill="currentColor"
      {...props}
    >
      {/* 4-pointed star — smooth tapered points */}
      <path
        d="M32 2 C34 16, 38 26, 62 32 C38 38, 34 48, 32 62 C30 48, 26 38, 2 32 C26 26, 30 16, 32 2Z"
        fill="currentColor"
      />
      {/* Top-right plus */}
      <rect x="46" y="9" width="2.5" height="8" rx="1.25" fill="currentColor" opacity="0.6" />
      <rect x="43.75" y="11.75" width="7" height="2.5" rx="1.25" fill="currentColor" opacity="0.6" />
      {/* Top-left plus */}
      <rect x="14.5" y="9" width="2.5" height="8" rx="1.25" fill="currentColor" opacity="0.6" />
      <rect x="12.25" y="11.75" width="7" height="2.5" rx="1.25" fill="currentColor" opacity="0.6" />
      {/* Bottom-right plus */}
      <rect x="46" y="47" width="2.5" height="8" rx="1.25" fill="currentColor" opacity="0.6" />
      <rect x="43.75" y="49.75" width="7" height="2.5" rx="1.25" fill="currentColor" opacity="0.6" />
      {/* Bottom-left plus */}
      <rect x="14.5" y="47" width="2.5" height="8" rx="1.25" fill="currentColor" opacity="0.6" />
      <rect x="12.25" y="49.75" width="7" height="2.5" rx="1.25" fill="currentColor" opacity="0.6" />
    </svg>
  );
}
