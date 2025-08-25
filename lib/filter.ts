import type { Filters, Job } from './types.js';

const DEG_ORDER: Record<string, number> = { 'none': 0, 'bachelors': 1, 'masters': 2, 'phd': 3 };

function norm(s: string) { return s.toLowerCase(); }

export function applyFilters(all: Job[], f: Filters): Job[] {
  const kw = (f.keywords ?? []).map(norm);     // OR within keywords
  const locs = (f.locations ?? []).map(norm);  // OR within locations
  const tech = (f.tech ?? []).map(norm);       // OR within tech

  const postedCutoff = f.postedWithinDays
    ? Date.now() - f.postedWithinDays * 24 * 60 * 60 * 1000
    : null;

  return all.filter(j => {
    const title = norm(j.title);
    const loc   = norm(j.location || '');
    const hay   = norm([title, loc, j.descriptionHtml].join(' '));

    // Remote
    if (typeof f.remote === 'boolean' && j.remote !== f.remote) return false;

    // Posted time
    if (postedCutoff && j.postedAt) {
      const t = Date.parse(j.postedAt);
      if (!Number.isNaN(t) && t < postedCutoff) return false;
    }

    // Locations (OR) – if none provided, don't filter
    if (locs.length && !locs.some(L => loc.includes(L))) return false;

    // Keywords (OR) – if none provided, don't filter
    if (kw.length && !kw.some(k => title.includes(k) || hay.includes(k))) return false;

    // Tech (OR) – if none provided, don't filter
    if (tech.length && !tech.some(tk => title.includes(tk) || hay.includes(tk))) return false;

    // Degree ceiling – only enforce if we parsed one
    if (f.degreeAtMost) {
      const need = j.requirements?.degree ?? null;
      if (need && DEG_ORDER[need] > DEG_ORDER[f.degreeAtMost]) return false;
    }

    // Max years – only enforce if we parsed one
    if (typeof f.maxYearsExperience === 'number') {
      const need = j.requirements?.minYears;
      if (typeof need === 'number' && need > f.maxYearsExperience) return false;
    }

    // Seniority allow-list – if provided and job has a seniority signal, it must match
    if (Array.isArray(f.seniorityInclude) && f.seniorityInclude.length) {
      const sr = j.requirements?.seniority ?? null;
      if (sr && !f.seniorityInclude.map(norm).includes(sr)) return false;
    }

    return true;
  });
}

export function scoreJobs(arr: Job[], f: Filters): Job[] {
  const kw = (f.keywords ?? []).map(k => k.toLowerCase());
  const tech = (f.tech ?? []).map(t => t.toLowerCase());

  return arr
    .map(j => {
      let s = 0;
      const title = j.title.toLowerCase();
      const desc = j.descriptionHtml.toLowerCase();
      const loc  = j.location.toLowerCase();

      for (const k of kw) {
        if (title.includes(k)) s += 6;
        if (desc.includes(k)) s += 2;
      }
      for (const t of tech) {
        if (title.includes(t)) s += 4;
        if (desc.includes(t)) s += 2;
      }
      if (j.remote) s += 1;
      if (/pakistan|islamabad|lahore|karachi/.test(loc)) s += 1;

      // Light bonus for entry-friendly roles
      const yrs = j.requirements?.minYears ?? null;
      if (yrs != null && yrs <= 2) s += 3;
      if (j.requirements?.seniority === 'intern' || j.requirements?.seniority === 'junior') s += 2;

      const ts = j.postedAt ? Date.parse(j.postedAt) : 0;
      if (ts) {
        const days = (Date.now() - ts) / 864e5;
        s += Math.max(0, 6 - Math.floor(days / 3));
      }
      return { j, s };
    })
    .sort((a, b) => b.s - a.s)
    .map(x => x.j);
}

export function dedupe(arr: Job[]): Job[] {
  const seen = new Set<string>();
  const out: Job[] = [];
  for (const j of arr) {
    const key = `${norm(j.company)}|${norm(j.title)}|${norm(j.location)}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(j);
    }
  }
  return out;
}
