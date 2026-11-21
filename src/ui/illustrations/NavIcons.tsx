import type { ReactElement, ReactNode } from 'react';
import type { Screen } from '../types.ts';

/** The four navigation icons, one per Screen. Each is decoration beside a visible label, so it is hidden from assistive technology. */
const ICON_SIZE = 24;

type IconProps = { className?: string };

function Frame({ className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width={ICON_SIZE}
      height={ICON_SIZE}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      data-nav-icon=""
    >
      {children}
    </svg>
  );
}

/** Weave: two warp ends and two weft passes crossing, one weft over and one under. */
export function WeaveIcon({ className }: IconProps) {
  return (
    <Frame className={className}>
      <path d="M8 3v18M16 3v18" />
      <path d="M3 8h3M10 8h4M18 8h3" />
      <path d="M3 16h5M16 16h5" />
    </Frame>
  );
}

/** Keep: a drawer of saved cards. */
export function KeepIcon({ className }: IconProps) {
  return (
    <Frame className={className}>
      <rect x="3" y="4" width="18" height="6" rx="1" />
      <rect x="3" y="14" width="18" height="6" rx="1" />
      <path d="M10 7h4M10 17h4" />
    </Frame>
  );
}

/** Scan: four corner brackets round a dot, like the guide frame over a card. */
export function ScanIcon({ className }: IconProps) {
  return (
    <Frame className={className}>
      <path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4" />
      <circle cx="12" cy="12" r="2" />
    </Frame>
  );
}

/** Code: angle brackets round a slash. */
export function CodeIcon({ className }: IconProps) {
  return (
    <Frame className={className}>
      <path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 5l-4 14" />
    </Frame>
  );
}

/** Three bars, on the button that opens the header menu at the narrowest widths. Decoration beside the visible word "Menu". */
export function MenuIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width={ICON_SIZE}
      height={ICON_SIZE}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

const ICONS: Record<Screen, (props: IconProps) => ReactElement> = {
  weave: WeaveIcon,
  keep: KeepIcon,
  scan: ScanIcon,
  code: CodeIcon,
};

/** The icon of one Screen. */
export function NavIcon({ screen, className }: IconProps & { screen: Screen }) {
  const Icon = ICONS[screen];
  return <Icon className={className} />;
}
