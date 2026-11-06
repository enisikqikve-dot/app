/**
 * Politics. How a people is governed grows out of its situation and culture:
 * a chief or a council of elders in small groups, a king who passes the crown
 * to his children, priests where faith is strong, a republic or a democracy
 * where there is writing, wealth and open-minded people, and a dictator after
 * war and crisis. Rulers die and are followed; elections are held; unhappy
 * peoples rise up. Once there is writing, laws are made, and they change how
 * people live.
 */
import { MINUTES_PER_YEAR } from '../clock';
import type { Life } from './life';
import type { GovForm, LawId, Person, Tribe } from './types';
import { T_AGGRESSIVE, T_AMBITIOUS, T_BRAVE, T_CLEVER, T_KIND, T_PIOUS } from './types';

const YEAR = MINUTES_PER_YEAR;

/** Forms where the office is filled by the leader of the largest group. */
const CHIEF_FORMS = new Set<GovForm>(['band', 'elders']);

export class PoliticsSystem {
  constructor(private readonly life: Life) {}

  gov(tribe: Tribe | undefined): GovForm {
    return tribe?.gov ?? 'band';
  }

  hasLaw(tribe: Tribe | undefined, law: LawId): boolean {
    return !!tribe?.laws?.includes(law);
  }

  /** Does the leader of the largest group lead the people? (Otherwise politics picks the ruler.) */
  chiefByGroups(tribe: Tribe): boolean {
    return CHIEF_FORMS.has(this.gov(tribe));
  }

  /** The adults of a people. */
  private adults(tribe: Tribe): Person[] {
    const life = this.life;
    const out: Person[] = [];
    for (const b of life.bands) {
      if (b.tribe !== tribe.id) continue;
      for (const p of life.members(b.id)) if (life.ageOf(p) >= 18) out.push(p);
    }
    return out;
  }

  /** What the people think of someone (average opinion of the adults who know them). */
  private standing(tribe: Tribe, p: Person): number {
    let sum = 0;
    let n = 0;
    for (const q of this.adults(tribe)) {
      if (q === p) continue;
      const r = q.rels.find((e) => e[0] === p.id);
      if (!r) continue;
      sum += r[1];
      n++;
    }
    return n ? sum / n : 0;
  }

  /** Once a day: a ruler who died is followed. */
  daily(): void {
    const life = this.life;
    for (const tribe of life.tribes.living()) {
      if (this.chiefByGroups(tribe)) continue;
      const ruler = life.person(tribe.chief);
      if (ruler?.alive && life.band(ruler.band)?.tribe === tribe.id) continue;
      this.succession(tribe, ruler);
    }
  }

  private setRuler(tribe: Tribe, p: Person, how: 'heir' | 'chosen' | 'elected' | 'seized'): void {
    const life = this.life;
    tribe.chief = p.id;
    life.log(p, how === 'elected' ? 'elected' : 'ruler');
    life.chron('ruler', { a: p.id, x: tribe.id, s: `${this.gov(tribe)}:${how}`, major: 1 });
  }

  private succession(tribe: Tribe, dead: Person | undefined): void {
    const gov = this.gov(tribe);
    const adults = this.adults(tribe);
    if (adults.length === 0) return;
    if (gov === 'monarchy' && dead) {
      // The crown goes to the eldest living child, else to the closest relative.
      const kin = adults
        .filter((p) => p.mother === dead.id || p.father === dead.id)
        .sort((a, b) => a.born - b.born);
      const sibling = adults.filter((p) => (p.mother >= 0 && p.mother === dead.mother) || (p.father >= 0 && p.father === dead.father)).sort((a, b) => a.born - b.born);
      const heir = kin[0] ?? sibling[0];
      if (heir) return this.setRuler(tribe, heir, 'heir');
      // The line has died out: a new dynasty.
      const next = this.best(adults, (p) => p.traits[T_AMBITIOUS] + p.traits[T_BRAVE] * 0.5 + this.standing(tribe, p));
      tribe.dynasty = next.id;
      return this.setRuler(tribe, next, 'chosen');
    }
    if (gov === 'theocracy') {
      const priest = this.best(adults, (p) => (p.shaman ? 100 : 0) + (p.faith ?? 0) * 60 + p.traits[T_PIOUS] * 0.5);
      return this.setRuler(tribe, priest, 'chosen');
    }
    if (gov === 'republic' || gov === 'democracy') return this.election(tribe);
    if (gov === 'ai') {
      // Another mind takes over; without one, the people govern themselves again.
      const mind = adults.find((p) => p.kind === 'ai');
      if (mind) return this.setRuler(tribe, mind, 'chosen');
      this.change(tribe, 'republic', 'reform');
      return;
    }
    if (gov === 'dictatorship') {
      // Without the dictator, the people choose again.
      this.change(tribe, this.knowsWriting(tribe) ? 'republic' : 'monarchy', 'dictatorEnd');
      return;
    }
    const chief = this.best(adults, (p) => p.traits[T_AMBITIOUS] + this.standing(tribe, p));
    this.setRuler(tribe, chief, 'chosen');
  }

  private best(list: Person[], score: (p: Person) => number): Person {
    let best = list[0];
    let bestScore = -Infinity;
    for (const p of list) {
      const s = score(p) + this.life.rng.next() * 5;
      if (s > bestScore) {
        bestScore = s;
        best = p;
      }
    }
    return best;
  }

  private knowsWriting(tribe: Tribe): boolean {
    return this.life.civ.knows(tribe, 'writing');
  }

  /** The people vote: the most respected of the ambitious wins. */
  private election(tribe: Tribe): void {
    const life = this.life;
    const adults = this.adults(tribe);
    if (adults.length === 0) return;
    const candidates = [...adults]
      .filter((p) => p.traits[T_AMBITIOUS] > 45 && life.ageOf(p) >= 25)
      .sort((a, b) => b.traits[T_AMBITIOUS] + b.traits[T_CLEVER] - (a.traits[T_AMBITIOUS] + a.traits[T_CLEVER]))
      .slice(0, 3);
    if (candidates.length === 0) candidates.push(adults[0]);
    const votes = candidates.map(() => 0);
    for (const voter of adults) {
      let best = 0;
      let bestScore = -Infinity;
      candidates.forEach((c, i) => {
        const r = voter === c ? 100 : (voter.rels.find((e) => e[0] === c.id)?.[1] ?? 0);
        const s = r + c.traits[T_KIND] * 0.2 + c.traits[T_CLEVER] * 0.2 + life.rng.next() * 15;
        if (s > bestScore) {
          bestScore = s;
          best = i;
        }
      });
      votes[best]++;
    }
    let win = 0;
    for (let i = 1; i < votes.length; i++) if (votes[i] > votes[win]) win = i;
    const before = tribe.chief;
    tribe.chief = candidates[win].id;
    tribe.nextElection = life.t + (this.gov(tribe) === 'democracy' ? 4 : 6) * YEAR;
    life.log(candidates[win], 'elected');
    // The chronicle notes a new head; a re-election goes unremarked.
    if (before !== candidates[win].id) life.chron('election', { a: candidates[win].id, x: tribe.id, n: Math.round((votes[win] / adults.length) * 100) });
  }

  private change(tribe: Tribe, to: GovForm, why: string, by?: Person): void {
    const life = this.life;
    if (this.gov(tribe) === to) return;
    tribe.gov = to;
    tribe.govSince = life.t;
    if (to === 'monarchy') tribe.dynasty = by?.id ?? tribe.chief;
    life.chron('government', { x: tribe.id, s: `${to}:${why}`, ...(by ? { a: by.id } : {}), major: 1 });
    if (by) tribe.chief = by.id;
    if (to === 'republic' || to === 'democracy') this.election(tribe);
    else if (!by) {
      const ruler = life.person(tribe.chief);
      if (!ruler?.alive) this.succession(tribe, ruler);
    }
  }

  /** Once a year: the form of government may change, elections are held, laws are made, unhappy peoples rise up. */
  yearly(): void {
    const life = this.life;
    for (const tribe of life.tribes.living()) {
      const adults = this.adults(tribe);
      if (adults.length === 0) continue;
      const civ = life.civ;
      const homes = civ.living().filter((s) => s.tribe === tribe.id);
      const pop = adults.length + homes.reduce((s, h) => s + h.crowd, 0);
      const gov = this.gov(tribe);
      const ruler = life.person(tribe.chief);
      const writing = this.knowsWriting(tribe);
      const money = civ.knows(tribe, 'money');
      const [warlike, pious, open] = tribe.culture;
      // Unrest: poverty, hunger, lost wars, an unloved ruler.
      const gini = civ.inequality(tribe);
      let hunger = 0;
      for (const p of adults) hunger += p.hunger;
      hunger /= adults.length;
      const lostWar = life.tribes.wars.some((w) => w.end !== undefined && life.t - w.end < 5 * YEAR && w.winner !== undefined && w.winner !== tribe.id && (w.a === tribe.id || w.b === tribe.id));
      const loved = ruler?.alive ? this.standing(tribe, ruler) : 0;
      let unrest = gini * 0.35 + Math.max(0, hunger - 0.3) + (lostWar ? 0.25 : 0) + (loved < -10 ? 0.25 : loved < 5 ? 0.1 : 0) - (this.hasLaw(tribe, 'equality') ? 0.15 : 0) - (this.hasLaw(tribe, 'faith') && pious > 60 ? 0.1 : 0);
      unrest = Math.max(0, Math.min(1, unrest));
      tribe.unrest = Math.round(unrest * 100) / 100;

      // Elections when the term is over.
      if ((gov === 'republic' || gov === 'democracy') && (tribe.nextElection ?? 0) <= life.t) this.election(tribe);

      // Uprisings.
      if (unrest > 0.55 && life.rng.chance(0.1)) {
        const rebel = this.best(adults, (p) => p.traits[T_AMBITIOUS] + p.traits[T_BRAVE] * 0.6 + p.traits[T_AGGRESSIVE] * 0.4 - (p.id === tribe.chief ? 500 : 0));
        if (writing && open > 50 && gov !== 'democracy') this.change(tribe, gov === 'republic' ? 'democracy' : 'republic', 'revolution');
        else this.change(tribe, 'dictatorship', 'coup', rebel);
        life.chron('revolt', { x: tribe.id, a: rebel.id, n: Math.round(unrest * 100) });
        continue;
      }

      // Peaceful changes as the people grows.
      const settled = homes.length > 0;
      if (gov === 'band') {
        if (settled && pop >= 60 && pious > 72 && life.rng.chance(0.15)) this.change(tribe, 'theocracy', 'faith');
        else if (settled && pop >= 60 && ruler?.alive && ruler.traits[T_AMBITIOUS] > 55 && life.rng.chance(0.12)) this.change(tribe, 'monarchy', 'crown', ruler);
        else if (pop >= 25 && open > 55 && warlike < 50 && life.rng.chance(0.08)) this.change(tribe, 'elders', 'council');
      } else if (gov === 'elders') {
        if (settled && pop >= 120 && ruler?.alive && ruler.traits[T_AMBITIOUS] > 60 && life.rng.chance(0.08)) this.change(tribe, 'monarchy', 'crown', ruler);
        else if (writing && money && open > 52 && life.rng.chance(0.06)) this.change(tribe, 'republic', 'reform');
      } else if (gov === 'monarchy' || gov === 'theocracy') {
        if (writing && money && open > 55 && pop >= 200 && life.rng.chance(0.03)) this.change(tribe, 'republic', 'reform');
      } else if (gov === 'republic') {
        if (open > 58 && gini < 0.45 && life.rng.chance(0.04)) this.change(tribe, 'democracy', 'vote');
      }

      // Laws, once things are written down.
      if (writing && life.rng.chance(0.2)) this.makeLaw(tribe, money);
    }
  }

  private makeLaw(tribe: Tribe, money: boolean): void {
    const life = this.life;
    const has = new Set(tribe.laws ?? []);
    const options: LawId[] = [];
    const crimes = life.chronicle.slice(-400);
    if (!has.has('theft') && crimes.some((c) => c.key === 'theft')) options.push('theft');
    if (!has.has('murder')) options.push('murder');
    if (!has.has('peace')) options.push('peace');
    if (money && !has.has('tax')) options.push('tax');
    if (money && !has.has('market') && life.civ.living().some((s) => s.tribe === tribe.id && life.civ.sizeOf(s) >= 1)) options.push('market');
    if (!has.has('faith') && (this.gov(tribe) === 'theocracy' || tribe.culture[1] > 62) && life.tribes.mainBelief(tribe) >= 0) options.push('faith');
    if (!has.has('equality') && this.gov(tribe) === 'democracy') options.push('equality');
    if (options.length === 0) return;
    const law = options[life.rng.int(0, options.length - 1)];
    tribe.laws = [...(tribe.laws ?? []), law];
    const ruler = life.person(tribe.chief);
    life.chron('law', { x: tribe.id, s: law, ...(ruler ? { a: ruler.id } : {}) });
  }

  /** A people hands power to someone (an artificial intelligence). */
  handTo(tribe: Tribe, form: GovForm, ruler: Person): void {
    this.change(tribe, form, form === 'ai' ? 'ai' : 'reform', ruler);
  }

  /** A whispered wish to lead, given to someone in a people ruled by a crown, priests or a dictator: a coup. */
  onLeadWhisper(p: Person): void {
    const tribe = this.life.tribes.tribeOfBand(p.band);
    if (!tribe || this.chiefByGroups(tribe) || tribe.chief === p.id) return;
    const gov = this.gov(tribe);
    if (gov === 'republic' || gov === 'democracy') {
      tribe.chief = p.id;
      this.life.chron('ruler', { a: p.id, x: tribe.id, s: `${gov}:elected`, major: 1 });
      return;
    }
    this.change(tribe, gov === 'monarchy' ? 'monarchy' : 'dictatorship', 'coup', p);
    if (gov === 'monarchy') {
      tribe.chief = p.id;
      tribe.dynasty = p.id;
      this.life.chron('ruler', { a: p.id, x: tribe.id, s: 'monarchy:seized', major: 1 });
    }
  }
}

export const RULER_TITLES: Record<GovForm, string> = {
  band: 'chief',
  elders: 'elder',
  monarchy: 'king',
  theocracy: 'priest',
  republic: 'consul',
  democracy: 'president',
  dictatorship: 'dictator',
  ai: 'ai',
};

