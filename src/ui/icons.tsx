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

// ---- blessings, life & death

export const IconHarvest = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 21V9" />
    <path d="M12 9c0-2.5 1.5-4.5 4-5-.2 2.6-1.7 4.6-4 5ZM12 9c0-2.5-1.5-4.5-4-5 .2 2.6 1.7 4.6 4 5Z" />
    <path d="M12 14c0-2.3 1.4-4 3.6-4.6-.2 2.4-1.5 4.1-3.6 4.6ZM12 14c0-2.3-1.4-4-3.6-4.6.2 2.4 1.5 4.1 3.6 4.6Z" />
    <path d="M12 19c0-2.3 1.4-4 3.6-4.6-.2 2.4-1.5 4.1-3.6 4.6ZM12 19c0-2.3-1.4-4-3.6-4.6.2 2.4 1.5 4.1 3.6 4.6Z" />
  </Icon>
);

export const IconHeal = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" />
    <path d="M12 9v5M9.5 11.5h5" />
  </Icon>
);

export const IconRevive = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 18h16M7 18a5 5 0 0 1 10 0" />
    <path d="M12 3v5M5.6 6.6l2.1 2.1M18.4 6.6l-2.1 2.1" />
    <path d="M12 21v-3" />
  </Icon>
);

export const IconCreatePeople = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="10" cy="8" r="3" />
    <path d="M4 20a6 6 0 0 1 12 0" />
    <path d="M19 7v6M16 10h6" />
  </Icon>
);

export const IconAnimals = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="7" cy="9" r="1.8" />
    <circle cx="12" cy="6.5" r="1.8" />
    <circle cx="17" cy="9" r="1.8" />
    <path d="M12 12c-3 0-5.5 3-5.5 5.2 0 1.6 1.3 2.3 2.8 2 1.1-.2 1.8-.6 2.7-.6s1.6.4 2.7.6c1.5.3 2.8-.4 2.8-2C17.5 15 15 12 12 12Z" />
  </Icon>
);

export const IconSmite = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7 3h10M7 21h10" />
    <path d="M8 3c0 4 4 5.5 4 9s-4 5-4 9M16 3c0 4-4 5.5-4 9s4 5 4 9" />
  </Icon>
);

export const IconPlague = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
  </Icon>
);

export const IconHand = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11M11 10V4.5a1.5 1.5 0 0 1 3 0V11M14 10.5V6a1.5 1.5 0 0 1 3 0v7.5c0 4-2.5 7-6.5 7-2.6 0-4-1.2-5.4-3.4L3.4 14a1.5 1.5 0 0 1 2.5-1.6L8 15" />
  </Icon>
);

export const IconFollow = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="7" />
    <circle cx="12" cy="12" r="2" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
  </Icon>
);

// ---------------------------------------------------------------- milestone 4

export const IconLuck = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 11.5c-1.8-1.8-4.8-2.4-5.6-.6-.8 1.9 1.6 3.6 5.6.6Z" />
    <path d="M12 11.5c1.8-1.8 4.8-2.4 5.6-.6.8 1.9-1.6 3.6-5.6.6Z" />
    <path d="M12 11.5c-1.8-1.8-2.4-4.8-.6-5.6 1.9-.8 3.6 1.6.6 5.6Z" />
    <path d="M12 11.5c-1.8 1.8-2.4 4.8-.6 5.6 1.9.8 3.6-1.6.6-5.6Z" />
    <path d="M12.5 13.5c.8 2.6 2.2 4.6 4.5 6" />
  </Icon>
);

export const IconFertility = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="7" r="3" />
    <path d="M6.5 20c0-4.5 2.5-7.5 5.5-7.5s5.5 3 5.5 7.5" />
    <path d="M9.5 16.5c.8.7 1.6 1 2.5 1s1.7-.3 2.5-1" />
  </Icon>
);

export const IconSign = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 18a9 9 0 0 1 18 0" />
    <path d="M6 18a6 6 0 0 1 12 0" />
    <path d="M9 18a3 3 0 0 1 6 0" />
  </Icon>
);

export const IconLove = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" />
  </Icon>
);

export const IconCourage = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3Z" />
    <path d="M12 8v5M9.5 10.5h5" />
  </Icon>
);

export const IconFear = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 20V10a6 6 0 0 1 12 0v10l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5L6 20Z" />
    <circle cx="10" cy="10.5" r="0.8" fill="currentColor" />
    <circle cx="14" cy="10.5" r="0.8" fill="currentColor" />
    <path d="M10.5 14.5c.9-.7 2.1-.7 3 0" />
  </Icon>
);

export const IconAnger = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M8 9.5 10.5 11M16 9.5 13.5 11" />
    <path d="M9 16.5c1.8-1.3 4.2-1.3 6 0" />
  </Icon>
);

export const IconForgive = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 14c3-1 5-3.5 6-7 1 2 1.2 4 .5 6 2-1 4.5-1.5 7.5-1" />
    <path d="M4 14c2 3 5 4.5 9 4.5 3 0 5.5-1.5 7-4" />
    <circle cx="16.5" cy="7.5" r="1" fill="currentColor" />
  </Icon>
);

export const IconComfort = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="9" cy="7" r="2.5" />
    <circle cx="15.5" cy="8" r="2.2" />
    <path d="M4.5 20c0-3.8 2-6.5 4.5-6.5 1.4 0 2.6.8 3.4 2" />
    <path d="M10.5 20c.3-3.3 2.2-5.5 5-5.5s4.5 2.2 4.5 5.5" />
    <path d="M10.5 15.5c1.5.3 3 .2 4.2-.5" />
  </Icon>
);

export const IconEmigrate = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 19c3-1 4-3 4-5s1.5-4 4-4h6" />
    <path d="m16 7 3 3-3 3" />
    <circle cx="5" cy="19" r="1.2" fill="currentColor" />
  </Icon>
);

export const IconPeace = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 12.5 7 9l3 1.5 3-2 4 1 4 3" />
    <path d="M7 9v4l3 3c.8.8 2 .8 2.8 0L17 11.5" />
    <path d="M10 10.5 13 13" />
  </Icon>
);

export const IconLead = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 17 3 7l5 4 4-6 4 6 5-4-1 10H4Z" />
    <path d="M4 20h16" />
  </Icon>
);

export const IconBook = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 6.5C10.5 5 8 4.5 4 4.5v13c4 0 6.5.5 8 2 1.5-1.5 4-2 8-2v-13c-4 0-6.5.5-8 2Z" />
    <path d="M12 6.5v13" />
  </Icon>
);

export const IconStats = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 4v16h16" />
    <path d="m7 15 4-5 3 3 5-6" />
  </Icon>
);

export const IconTree = (p: IconProps) => (
  <Icon {...p}>
    <rect x="9" y="3" width="6" height="4" rx="1" />
    <rect x="3" y="16" width="6" height="4" rx="1" />
    <rect x="15" y="16" width="6" height="4" rx="1" />
    <path d="M12 7v4.5M6 16v-2.5h12V16" />
  </Icon>
);

// ---------------------------------------------------------------- milestone 5

export const IconIdea = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 17h6M10 20.5h4" />
    <path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.3 1 2.2h5.2c0-.9.4-1.7 1-2.2A6 6 0 0 0 12 3Z" />
  </Icon>
);

export const IconTeach = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="7" cy="7" r="2.5" />
    <path d="M3 20c0-3.9 1.8-6.5 4-6.5 1.5 0 2.6.9 3.3 2.3" />
    <path d="M12 5h9v8h-9z" />
    <path d="M14 8h5M14 10.5h3" />
  </Icon>
);

export const IconSkip = (p: IconProps) => (
  <Icon {...p}>
    <path d="m4 6 7 6-7 6V6Z" />
    <path d="m12 6 7 6-7 6V6Z" />
    <path d="M21 5v14" />
  </Icon>
);
