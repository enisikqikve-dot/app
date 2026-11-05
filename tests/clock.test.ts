import { describe, expect, it } from 'vitest';
import {
  AXIAL_TILT,
  Clock,
  dateFromMinutes,
  DAYS_PER_YEAR,
  localSolarHours,
  MINUTES_PER_DAY,
  MINUTES_PER_YEAR,
  sunDeclination,
  sunLongitude,
} from '../src/sim/clock';

describe('calendar', () => {
  it('starts in year 1, spring', () => {
    const d = dateFromMinutes(0);
    expect(d).toMatchObject({ year: 1, dayOfYear: 0, season: 0, dayOfSeason: 1 });
  });

  it('has 4 seasons of 10 days', () => {
    expect(DAYS_PER_YEAR).toBe(40);
    expect(dateFromMinutes(10 * MINUTES_PER_DAY).season).toBe(1);
    expect(dateFromMinutes(39 * MINUTES_PER_DAY).season).toBe(3);
    expect(dateFromMinutes(40 * MINUTES_PER_DAY)).toMatchObject({ year: 2, season: 0, dayOfSeason: 1 });
  });
});

describe('clock speeds', () => {
  it('runs one day per minute at 1×', () => {
    const clock = new Clock(0);
    clock.speedIndex = 1;
    for (let i = 0; i < 240; i++) clock.advance(0.25); // 60 real seconds
    expect(clock.minutes).toBeCloseTo(MINUTES_PER_DAY, 6);
  });

  it('runs a year in about 2.4 s at 1000×', () => {
    const clock = new Clock(0);
    clock.speedIndex = 4;
    for (let i = 0; i < 24; i++) clock.advance(0.1);
    expect(clock.minutes).toBeCloseTo(MINUTES_PER_YEAR, 6);
  });

  it('does not move when paused and ignores huge frame gaps', () => {
    const clock = new Clock(100);
    clock.speedIndex = 0;
    clock.advance(5);
    expect(clock.minutes).toBe(100);
    clock.speedIndex = 1;
    clock.advance(30); // e.g. tab was in background
    expect(clock.minutes).toBe(100 + 0.25 * 24);
  });

  it('switches to timelapse from 100×', () => {
    const clock = new Clock();
    clock.speedIndex = 2;
    expect(clock.timelapse).toBe(false);
    clock.speedIndex = 3;
    expect(clock.timelapse).toBe(true);
  });
});

describe('sun', () => {
  it('stands over the tropic of the north in mid-summer', () => {
    expect(sunDeclination(0.375)).toBeCloseTo(AXIAL_TILT, 6); // day 15 = mid-summer
    expect(sunDeclination(0.875)).toBeCloseTo(-AXIAL_TILT, 6); // day 35 = mid-winter
    expect(sunDeclination(0.125)).toBeCloseTo(0, 6); // mid-spring = equinox
  });

  it('makes noon at longitude 0 at mid-day', () => {
    const lon = sunLongitude(0.5);
    expect(lon).toBeCloseTo(0, 6);
    expect(localSolarHours(0, lon)).toBeCloseTo(12, 6);
    // 90° east is 6 hours later.
    expect(localSolarHours(Math.PI / 2, lon)).toBeCloseTo(18, 6);
    expect(localSolarHours(-Math.PI / 2, lon)).toBeCloseTo(6, 6);
  });

  it('is midnight at longitude 0 when the day starts', () => {
    expect(localSolarHours(0, sunLongitude(0))).toBeCloseTo(0, 6);
  });
});
