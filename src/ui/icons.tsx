/** Small line icons, drawn on a 24×24 grid with the current text color. */
import type { ComponentChildren, JSX } from 'preact';

type IconProps = { size?: number } & JSX.SVGAttributes<SVGSVGElement>;

function Icon({ size = 20, children, ...rest }: IconProps & { children: ComponentChildren }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.7"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconNature = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7 15a4 4 0 0 1 .5-8 5.5 5.5 0 0 1 10.4 1.6A3.5 3.5 0 0 1 17.5 15" />
    <path d="M12.5 12 10 16.5h3.5L11 21" />
  </Icon>
);

export const IconBlessing = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3c.6 3.9 2.1 5.4 6 6-3.9.6-5.4 2.1-6 6-.6-3.9-2.1-5.4-6-6 3.9-.6 5.4-2.1 6-6Z" />
    <path d="M18.5 15.5c.3 1.6.9 2.2 2.5 2.5-1.6.3-2.2.9-2.5 2.5-.3-1.6-.9-2.2-2.5-2.5 1.6-.3 2.2-.9 2.5-2.5Z" />
  </Icon>
);

export const IconWhisper = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 12a7 7 0 1 1 3.2 5.9L4 19l1.1-3.1A7 7 0 0 1 4 12Z" />
    <path d="M9 10.5c1.2-1 2.8-1 4 0M8 13.5c2 1.6 4 1.6 6 0" />
  </Icon>
);

export const IconLife = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 4v16M8 20h8M5 7h14" />
    <path d="M5 7 2.5 13a2.5 2.5 0 0 0 5 0L5 7ZM19 7l-2.5 6a2.5 2.5 0 0 0 5 0L19 7Z" />
  </Icon>
);

export const IconMenu = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Icon>
);

export const IconClose = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icon>
);

export const IconPause = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 6v12M15 6v12" />
  </Icon>
);

export const IconPlus = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);

export const IconMinus = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 12h14" />
  </Icon>
);

export const IconSun = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
  </Icon>
);

export const IconMoon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5Z" />
  </Icon>
);

export const IconLock = (p: IconProps) => (
  <Icon {...p}>
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </Icon>
);

export const IconCopy = (p: IconProps) => (
  <Icon {...p}>
    <rect x="8" y="8" width="12" height="12" rx="2" />
    <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
  </Icon>
);

export const IconDice = (p: IconProps) => (
  <Icon {...p}>
    <rect x="4" y="4" width="16" height="16" rx="3" />
    <circle cx="9" cy="9" r="1" fill="currentColor" />
    <circle cx="15" cy="15" r="1" fill="currentColor" />
    <circle cx="15" cy="9" r="1" fill="currentColor" />
    <circle cx="9" cy="15" r="1" fill="currentColor" />
  </Icon>
);

export const IconPerson = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="8" r="3.2" />
    <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
  </Icon>
);

// ---- nature powers

export const IconLightning = (p: IconProps) => (
  <Icon {...p}>
    <path d="M13 2 5 13.5h6L10 22l8-11.5h-6L13 2Z" />
  </Icon>
);

export const IconRain = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7 14a4 4 0 0 1 .5-8 5.5 5.5 0 0 1 10.4 1.6A3.5 3.5 0 0 1 17.5 14H7Z" />
    <path d="M8 17l-1 3M12 17l-1 3M16 17l-1 3" />
  </Icon>
);

export const IconDrought = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="9" r="3.5" />
    <path d="M12 2.5v1.5M5.5 9H4M20 9h-1.5M7.4 4.4l1 1M16.6 4.4l-1 1" />
    <path d="M4 20l3-3 2 2 3-4 2 3 2-2 4 4" />
  </Icon>
);

export const IconFire = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 21c-3.9 0-6.5-2.7-6.5-6.2 0-3.2 2.2-5.1 3.6-7.3.5 1.8 1.5 3 2.6 3.4-.3-3.1.9-5.9 3.3-7.9.2 3 1.2 4.6 2.6 6.4 1 1.3 1.9 2.9 1.9 5.2 0 3.6-2.6 6.4-7.5 6.4Z" />
    <path d="M12 21c-1.7 0-2.9-1.2-2.9-2.8 0-1.8 1.4-2.6 2.2-4 .4 1 1 1.6 1.7 1.8.6.7 1.9 1.3 1.9 2.4 0 1.5-1.2 2.6-2.9 2.6Z" />
  </Icon>
);

export const IconStorm = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0" />
    <path d="M14 4.5A8 8 0 0 0 4.5 12M10 19.5A8 8 0 0 0 19.5 12" />
    <path d="M17 7.5A6 6 0 0 0 9 6.2M7 16.5a6 6 0 0 0 8 1.3" />
  </Icon>
);

export const IconQuake = (p: IconProps) => (
  <Icon {...p}>
    <path d="M2 18h5l2-3 2 5 2-8 2 6 2-3h5" />
    <path d="M9 4l2 3-2 2 2 3" />
  </Icon>
);

export const IconVolcano = (p: IconProps) => (
  <Icon {...p}>
    <path d="M2.5 21 9 10h6l6.5 11H2.5Z" />
    <path d="M10.5 10 12 13l1.5-3" />
    <path d="M12 7V4M9 6.5 7.5 4.5M15 6.5l1.5-2" />
  </Icon>
);

export const IconWave = (p: IconProps) => (
  <Icon {...p}>
    <path d="M2 17c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2" />
    <path d="M3 12c1-4 4-7 8.5-7 3 0 5 1.8 5 4.2 0 1.6-1.2 2.8-2.8 2.8-1.4 0-2.2-.9-2.2-2" />
  </Icon>
);

export const IconMeteor = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="15.5" cy="15.5" r="4.5" />
    <path d="M12.3 12.3 3 3M15 8.5 8 2M8.5 15 2 8" />
  </Icon>
);

export const IconSnow = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7" />
    <path d="M9.5 3.5 12 6l2.5-2.5M9.5 20.5 12 18l2.5 2.5" />
  </Icon>
);

export const IconHeat = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10 14.5V5a2 2 0 1 1 4 0v9.5a4 4 0 1 1-4 0Z" />
    <path d="M12 9v7" />
    <path d="M18 5h3M18 9h3" />
  </Icon>
);

export const IconRaise = (p: IconProps) => (
  <Icon {...p}>
    <path d="M2 20h20M5 20l7-10 7 10" />
    <path d="M12 7V2M9.5 4.5 12 2l2.5 2.5" />
  </Icon>
);

export const IconLower = (p: IconProps) => (
  <Icon {...p}>
    <path d="M2 9h5l5 8 5-8h5" />
    <path d="M12 2v6M9.5 5.5 12 8l2.5-2.5" />
    <path d="M2 21h20" />
  </Icon>
);

export const IconForest = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8 3 3.5 11h3L4 16h8l-2.5-5h3L8 3Z" />
    <path d="M8 16v5M17 21v-4" />
    <circle cx="17" cy="12" r="4.5" />
  </Icon>
);

export const IconRewind = (p: IconProps) => (
  <Icon {...p}>
    <path d="M11 6 4 12l7 6V6ZM20 6l-7 6 7 6V6Z" />
  </Icon>
);

export const IconSoundOn = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4v-5Z" />
    <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
  </Icon>
);

export const IconSoundOff = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4v-5Z" />
    <path d="M16 9.5l5 5M21 9.5l-5 5" />
  </Icon>
);
