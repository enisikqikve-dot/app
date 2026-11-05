import { formatNumber, t, type MessageKey } from '../i18n';
import { BIOME_KEYS } from '../sim/planet/biomes';

export function formatHours(hours: number): string {
  const total = Math.floor(hours * 60) % (24 * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function formatLatLon(lat: number, lon: number): string {
  const latDeg = (lat * 180) / Math.PI;
  const lonDeg = (lon * 180) / Math.PI;
  const ns = latDeg >= 0 ? t('info.north') : t('info.south');
  const ew = lonDeg >= 0 ? t('info.east') : t('info.west');
  return `${formatNumber(Math.abs(latDeg), 1)}° ${ns} · ${formatNumber(Math.abs(lonDeg), 1)}° ${ew}`;
}

export function formatTemperature(celsius: number): string {
  const rounded = Math.round(celsius);
  return `${rounded === 0 ? 0 : rounded} °C`;
}

export function biomeName(biome: number): string {
  return t(`biome.${BIOME_KEYS[biome]}` as MessageKey);
}

export function biomeInfo(biome: number): string {
  return t(`biomeInfo.${BIOME_KEYS[biome]}` as MessageKey);
}

export function moistureLabel(m: number): string {
  const level = Math.min(4, Math.floor(m * 5));
  return t(`moisture.${level}` as MessageKey);
}

export function climateZone(lat: number): string {
  const deg = Math.abs((lat * 180) / Math.PI);
  if (deg < 23.5) return t('zone.tropical');
  if (deg < 35) return t('zone.subtropical');
  if (deg < 55) return t('zone.temperate');
  if (deg < 66.5) return t('zone.subpolar');
  return t('zone.polar');
}
