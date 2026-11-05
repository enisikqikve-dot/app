/**
 * Game time.
 *
 * Calendar (see KONZEPT.md, chapter 9): one year has 4 seasons of 10 days.
 * At 1× one game day lasts about one real minute.
 * Seasons are named for the northern hemisphere.
 */

export const MINUTES_PER_DAY = 1440;
export const DAYS_PER_SEASON = 10;
export const SEASONS_PER_YEAR = 4;
export const DAYS_PER_YEAR = DAYS_PER_SEASON * SEASONS_PER_YEAR;
export const MINUTES_PER_YEAR = MINUTES_PER_DAY * DAYS_PER_YEAR;

/** Game minutes per real second at speed 1× (1 day ≈ 60 s). */
export const GAME_MINUTES_PER_SECOND = 24;

/** Available speeds. Index 0 is pause. */
export const SPEEDS = [0, 1, 10, 100, 1000] as const;
export type SpeedIndex = 0 | 1 | 2 | 3 | 4;

/** From this speed on, days pass too fast to show a real sun (it would flicker). */
export const TIMELAPSE_SPEED_INDEX: SpeedIndex = 3;

/** Axial tilt of the planet in radians (Earth: 23.4°). */
export const AXIAL_TILT = (23.4 * Math.PI) / 180;

export type Season = 0 | 1 | 2 | 3; // spring, summer, autumn, winter (north)

export interface CalendarDate {
  /** 1-based year. */
  year: number;
  /** 0-based day of the year (0 … 39). */
  dayOfYear: number;
  season: Season;
  /** 1-based day within the season (1 … 10). */
  dayOfSeason: number;
  /** Minutes since midnight at longitude 0. */
  minuteOfDay: number;
}

export class Clock {
  /** Game minutes since the start of year 1. */
  minutes: number;
  speedIndex: SpeedIndex = 1;

  constructor(startMinutes = 6 * 60 + DAYS_PER_SEASON * 0.5 * MINUTES_PER_DAY) {
    this.minutes = startMinutes;
  }

  get speed(): number {
    return SPEEDS[this.speedIndex];
  }

  get paused(): boolean {
    return this.speedIndex === 0;
  }

  get timelapse(): boolean {
    return this.speedIndex >= TIMELAPSE_SPEED_INDEX;
  }

  /** Advances time by a real-time delta (seconds). Returns the game minutes that passed. */
  advance(realSeconds: number): number {
    const dt = Math.min(Math.max(realSeconds, 0), 0.25);
    const delta = dt * GAME_MINUTES_PER_SECOND * this.speed;
    this.minutes += delta;
    return delta;
  }

  date(): CalendarDate {
    return dateFromMinutes(this.minutes);
  }

  /** 0 … 1 through the current year. */
  yearFraction(): number {
    return (this.minutes % MINUTES_PER_YEAR) / MINUTES_PER_YEAR;
  }

  /** 0 … 1 through the current day at longitude 0 (0 = midnight). */
  dayFraction(): number {
    return (this.minutes % MINUTES_PER_DAY) / MINUTES_PER_DAY;
  }
}

export function dateFromMinutes(minutes: number): CalendarDate {
  const totalDays = Math.floor(minutes / MINUTES_PER_DAY);
  const year = Math.floor(totalDays / DAYS_PER_YEAR) + 1;
  const dayOfYear = totalDays % DAYS_PER_YEAR;
  const season = Math.floor(dayOfYear / DAYS_PER_SEASON) as Season;
  return {
    year,
    dayOfYear,
    season,
    dayOfSeason: (dayOfYear % DAYS_PER_SEASON) + 1,
    minuteOfDay: minutes % MINUTES_PER_DAY,
  };
}

/**
 * Seasonal signal from −1 to +1: +1 is the middle of the northern summer,
 * −1 the middle of the northern winter, 0 the middle of spring and autumn.
 */
export function seasonSignal(yearFraction: number): number {
  return Math.sin(2 * Math.PI * (yearFraction - 0.125));
}

/** Latitude (radians) where the sun stands directly overhead. */
export function sunDeclination(yearFraction: number): number {
  return AXIAL_TILT * seasonSignal(yearFraction);
}

/** Longitude (radians) where it is currently noon. Moves west as the day passes. */
export function sunLongitude(dayFraction: number): number {
  return Math.PI - 2 * Math.PI * dayFraction;
}

/** Local solar time in hours (0 … 24) at a longitude, given the sun's longitude. */
export function localSolarHours(longitude: number, sunLon: number): number {
  const hours = 12 + ((longitude - sunLon) * 24) / (2 * Math.PI);
  return ((hours % 24) + 24) % 24;
}
