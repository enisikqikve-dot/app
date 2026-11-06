import { t, type MessageKey } from '../i18n';
import type { ChronicleLine } from '../game/peopleInfo';
import { civName, deityName, inventionName, rulerTitle, speciesName } from './names';

/** One line of the world chronicle, written like a history book. */
export function chronicleText(l: ChronicleLine, planet: string): string {
  const a = l.a ?? '?';
  const b = l.b ?? '?';
  const c = l.c ?? '?';
  const n = l.n ?? 0;
  const near = l.a ? t('chron.near', { a: l.a }) : '';
  switch (l.key) {
    case 'founders':
      return t('chron.founders', { n, planet, a });
    case 'newcomers':
      return t('chron.newcomers', { n, a });
    case 'birth':
      return l.c ? t('chron.birth', { a, b, c }) : t('chron.birthOf', { a, b });
    case 'twins':
      return t('chron.twins', { a, b, c });
    case 'couple':
      return t('chron.couple', { a, b });
    case 'separated':
      return t('chron.separated', { a, b });
    case 'death':
      return t('chron.death', { a, n, cause: l.s ? t(`cause.${l.s}` as MessageKey) : '' });
    case 'leader':
      return t('chron.leader', { a });
    case 'emigrate':
      return n <= 1 ? t('chron.emigrateAlone', { a }) : t('chron.emigrate', { a, m: n - 1 });
    case 'moved':
      return t('chron.moved', { a });
    case 'population':
      return t('chron.population', { n, planet });
    case 'extinct':
      return t('chron.extinct');
    case 'power':
      return l.s === 'revive' ? t('chron.power.revive', { a }) : t(`chron.power.${l.s}` as MessageKey, { near });
    case 'sign':
      return t(`chron.sign.${Math.max(0, Math.min(2, n))}` as MessageKey, { near });
    case 'invention':
      return t(n ? 'chron.reinvention' : 'chron.invention', { a, invention: inventionName(l.s ?? '') });
    case 'lost':
      return t('chron.lost', { invention: inventionName(l.s ?? '') });
    case 'species': {
      const species = l.species ? speciesName(l.species.base, l.species.prefix) : '?';
      return l.s === 'god' ? t('chron.speciesGod', { species }) : t('chron.species', { species, near });
    }
    case 'shaman':
      return t('chron.shaman', { a });
    case 'religion':
      return t('chron.religion', { a, deity: deityName(l.s ?? 'ancestors', true) });
    case 'religionGone':
      return t('chron.religionGone', { deity: deityName(l.s ?? 'ancestors', true) });
    case 'answered':
      return t(`chron.answered.${l.s ?? 'food'}` as MessageKey, { a });
    case 'tribe':
      return t(`chron.tribe.${l.s ?? 'appeared'}` as MessageKey, { a, tribe: l.tribe ?? '?', parent: l.other ?? '?' });
    case 'tribeGone':
      return t('chron.tribeGone', { tribe: l.tribe ?? '?' });
    case 'contact':
      return t('chron.contact', { tribe: l.tribe ?? '?', other: l.other ?? '?' });
    case 'trade':
      return t('chron.trade', { tribe: l.tribe ?? '?', other: l.other ?? '?' });
    case 'chief':
      return t('chron.chief', { a, tribe: l.tribe ?? '?' });
    case 'theft':
      return t('chron.theft', { a });
    case 'murder':
      return t('chron.murder', { a, b });
    case 'banished':
      return t('chron.banished', { a, b });
    case 'war':
      return t('chron.war', { tribe: l.tribe ?? '?', other: l.other ?? '?', reason: t(`chron.warReason.${l.s ?? 'land'}` as MessageKey) });
    case 'battle':
      return t('chron.battle', { tribe: l.tribe ?? '?', other: l.other ?? '?', n });
    case 'peace': {
      const base = l.a ? t('chron.peaceBy', { a, tribe: l.tribe ?? '?', other: l.other ?? '?', n }) : t('chron.peace', { tribe: l.tribe ?? '?', other: l.other ?? '?', n });
      return l.winner ? `${base} ${t('chron.peaceWinner', { winner: l.winner })}` : base;
    }
    case 'conquered':
      return l.place ? t('chron.conqueredTown', { place: l.place, tribe: l.tribe ?? '?' }) : t('chron.conquered', { a, tribe: l.tribe ?? '?' });
    case 'civTech':
      return l.other
        ? t('chron.civTechFrom', { tribe: l.tribe ?? '?', other: l.other, tech: civName(l.s ?? '') })
        : l.a
          ? t('chron.civTech', { a, tribe: l.tribe ?? '?', tech: civName(l.s ?? '') })
          : t('chron.civTechPeople', { tribe: l.tribe ?? '?', tech: civName(l.s ?? '') });
    case 'settled':
      return t('chron.settled', { a, place: l.place ?? '?', tribe: l.tribe ?? '?' });
    case 'colony':
      return t('chron.colony', { place: l.place ?? '?', from: l.from ?? '?' });
    case 'grew':
      return t(`chron.grew.${l.s ?? '1'}` as MessageKey, { place: l.place ?? '?' });
    case 'abandoned':
      return t('chron.abandoned', { place: l.place ?? '?' });
    case 'government': {
      const [form, why] = (l.s ?? 'band:').split(':');
      return t(`chron.gov.${why}` as MessageKey, { a, tribe: l.tribe ?? '?', form: t(`gov.${form}` as MessageKey) });
    }
    case 'ruler': {
      const [form, how] = (l.s ?? 'band:chosen').split(':');
      return t(`chron.ruler.${how}` as MessageKey, { a, tribe: l.tribe ?? '?', title: rulerTitle(form, l.sex ?? 'm') });
    }
    case 'election':
      return t('chron.election', { a, tribe: l.tribe ?? '?', n });
    case 'revolt':
      return t('chron.revolt', { a, tribe: l.tribe ?? '?' });
    case 'law':
      return t('chron.law', { tribe: l.tribe ?? '?', law: t(`law.${l.s ?? 'theft'}` as MessageKey) });
    case 'machine':
      return t(l.s === 'ai' ? 'chron.machine.ai' : 'chron.machine.robot', { a, place: l.place ?? '?' });
    case 'clone':
      return t('chron.clone', { a, b });
    case 'flyingCity':
      return t('chron.flyingCity', { place: l.place ?? '?' });
    case 'weatherShield':
      return t('chron.weatherShield', { place: l.place ?? '?', power: t(`power.${l.s ?? 'storm'}` as MessageKey) });
    case 'timeTraveler':
      return l.s
        ? t('chron.timeTravelerGift', { a, tribe: l.tribe ?? '?', other: l.other ?? '?', tech: civName(l.s) })
        : t('chron.timeTraveler', { a, tribe: l.tribe ?? '?', other: l.other ?? '?' });
    case 'godFound':
      return t('chron.godFound', { tribe: l.tribe ?? '?' });
    case 'uprising':
      return t('chron.uprising', { tribe: l.tribe ?? '?', other: l.other ?? '?', place: l.place ?? '?' });
    case 'dream':
      return t('chron.dream', { a, dream: t(`dream.${l.s ?? 'family'}` as MessageKey) });
    case 'feast':
      return t('chron.feast', { a, tribe: l.tribe ?? '?' });
    case 'feud':
      return t('chron.feud', { a, b, reason: t(`feud.reason.${l.s ?? 'fight'}` as MessageKey) });
    case 'feudEnd':
      return t(`chron.feudEnd.${l.s ?? 'time'}` as MessageKey, { a, b, c });
    case 'overseas':
      return t('chron.overseas', { place: l.place ?? '?', from: l.from ?? '?', tribe: l.tribe ?? '?' });
    case 'epoch':
      return t(`chron.epoch.${l.s ?? 'bronze'}` as MessageKey, { tribe: l.tribe ?? '?' });
    case 'speciesGone':
      return t('chron.speciesGone', { species: l.species ? speciesName(l.species.base, l.species.prefix) : '?' });
    default:
      return '';
  }
}
