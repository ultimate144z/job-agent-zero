import type { DegreeLevel, Seniority } from './types.js';

function decodeEntities(s: string): string {
  if (!s) return '';
  const map: Record<string,string> = {'&lt;':'<','&gt;':'>','&amp;':'&','&quot;':'"','&#39;':"'"};
  return s.replace(/&(lt|gt|amp|quot|#39);/g, m => map[m] ?? m);
}

// order helpers for min-degree logic
const DEG_ORDER: Record<DegreeLevel, number> = { none: 0, bachelors: 1, masters: 2, phd: 3 };
function minDegree(a: DegreeLevel | null, b: DegreeLevel): DegreeLevel {
  if (a === null) return b;
  return DEG_ORDER[b] < DEG_ORDER[a] ? b : a;
}

export function extractRequirements(html: string): {
  minYears?: number | null;
  degree?: DegreeLevel | null;
  seniority?: Seniority | null;
} {
  const text = decodeEntities(html)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase();

  // === years of experience ===
  // Find *all* occurrences and keep the *minimum* (best-case requirement)
  let years: number | null = null;
  const yrRe = /(\d+)\s*\+?\s*(?:years?|yrs?)[^\.]{0,40}?(?:experience|exp)/g;
  for (const m of text.matchAll(yrRe)) {
    const n = parseInt(m[1], 10);
    if (!Number.isNaN(n)) years = (years == null) ? n : Math.min(years, n);
  }

  // === degree (minimum acceptable) ===
  let degree: DegreeLevel | null = null;
  if (/\bphd\b|doctorate|doctoral/.test(text)) degree = minDegree(degree, 'phd');
  if (/\bmaster'?s\b|\bms\b|\bmsc\b|\bgraduate\b/.test(text)) degree = minDegree(degree, 'masters');
  if (/\bbachelor'?s\b|\bbs\b|\bba\b|\bbsc\b|\bundergraduate\b/.test(text)) degree = minDegree(degree, 'bachelors');
  if (/\bno degree\b|\bdegree not required\b|\bhigh school\b|\bhs diploma\b|\bassociate'?s\b/.test(text)) degree = minDegree(degree, 'none');

  // If we matched multiple (e.g., "PhD or MS or BS"), the above reduces to the *lowest* (e.g., bachelors)

  // === seniority (most indicative) ===
  let seniority: Seniority | null = null;
  if (/\bprincipal\b/.test(text)) seniority = 'principal';
  else if (/\bstaff\b/.test(text)) seniority = 'staff';
  else if (/\bsenior\b/.test(text)) seniority = 'senior';
  else if (/\blead\b/.test(text)) seniority = 'lead';
  else if (/\bmid[-\s]?level\b|\bmid\b/.test(text)) seniority = 'mid';
  else if (/\bjunior\b/.test(text)) seniority = 'junior';
  else if (/\b(intern|internship)\b/.test(text)) seniority = 'intern';

  return { minYears: years ?? null, degree, seniority };
}
