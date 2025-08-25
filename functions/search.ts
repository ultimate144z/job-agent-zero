// search.ts

import type { Handler } from '@netlify/functions';
import { fetchGreenhouse } from '../connectors/greenhouse.js';
import { fetchLever } from '../connectors/lever.js';
import { fetchAshby } from '../connectors/ashby.js';
import { summarizeHtml } from '../lib/summarize.js';
import { applyFilters, scoreJobs, dedupe } from '../lib/filter.js';
import type { Filters, ApiResponse, Job } from '../lib/types.js';
import { extractRequirements } from '../lib/extract.js';


const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const MAX_SOURCES = 30;
const MAX_RETURN = 200;

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors, body: '' };
  }

  try {
    const filters = parseFilters(event);
    if (!filters.sources?.length) {
      return json({ ok: false, error: 'No sources provided' }, 400);
    }
    if (filters.sources.length > MAX_SOURCES) {
      return json({ ok: false, error: `Too many sources (max ${MAX_SOURCES})` }, 400);
    }

    // Fan-out per source (simple concurrency; each connector is a single request)
    const tasks = filters.sources.map(async (src) => {
      try {
        if (src.type === 'greenhouse') return await fetchGreenhouse(src.url);
        if (src.type === 'lever') return await fetchLever(src.url);
        if (src.type === 'ashby') return await fetchAshby(src.url);

        return [];
      } catch (e) {
        // swallow per-source errors but log; keep others
        console.error('Source error:', src, e);
        return [];
      }
    });

    const results = (await Promise.all(tasks)).flat();

    // Summaries (cheap extractive)
    for (const j of results) {
      j.summary = summarizeHtml(j.descriptionHtml);
      j.requirements = extractRequirements(j.descriptionHtml); // NEW
    }

    // Dedupe + filter + score
    const deduped = dedupe(results);
    const filtered = applyFilters(deduped, filters);
    const scored = scoreJobs(filtered, filters);

    // Pagination
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(Math.max(10, filters.pageSize ?? 50), 100);
    const total = Math.min(scored.length, MAX_RETURN);
    const pageStart = (page - 1) * pageSize;
    const pageEnd = Math.min(pageStart + pageSize, total);
    const jobs = scored.slice(pageStart, pageEnd);

    const payload: ApiResponse = {
      ok: true,
      count: jobs.length,
      page,
      pageSize,
      total,
      jobs
    };

    return json(payload, 200);
  } catch (err: any) {
    console.error(err);
    return json({ ok: false, error: err?.message || 'Internal error' }, 500);
  }
};

function parseFilters(event: any): Filters {
  // Accept POST body JSON OR GET ?q=<urlencoded JSON>
  let obj: any = {};
  if (event.httpMethod === 'POST' && event.body) {
    obj = safeJson(event.body);
  } else {
    const q = event.queryStringParameters?.q;
    if (q) obj = safeJson(decodeURIComponent(q));
  }

  // Normalize minimal defaults
  const filters: Filters = {
    keywords: arrOrEmpty(obj.keywords).map(toLower),
    remote: typeof obj.remote === 'boolean' ? obj.remote : null,
    locations: arrOrEmpty(obj.locations),

    minSalaryUSD: isNum(obj.minSalaryUSD) ? Number(obj.minSalaryUSD) : null,
    seniority: arrOrEmpty(obj.seniority), // kept for compat; unused
    tech: arrOrEmpty(obj.tech).map(toLower),
    postedWithinDays: isNum(obj.postedWithinDays) ? Number(obj.postedWithinDays) : null,

    // ✅ Correct fields + normalization
    maxYearsExperience: isNum(obj.maxYearsExperience) ? Number(obj.maxYearsExperience) : null,
    degreeAtMost: normalizeDegree(obj.degreeAtMost),
    seniorityInclude: normalizeSeniorityList(obj.seniorityInclude),

    sources: Array.isArray(obj.sources) ? obj.sources.filter(validSource) : [],
    page: isNum(obj.page) ? Number(obj.page) : 1,
    pageSize: isNum(obj.pageSize) ? Number(obj.pageSize) : 50
  };
  return filters;
}

function validSource(s: any) {
  return s && typeof s === 'object' && typeof s.type === 'string' && typeof s.url === 'string'
    && (s.type === 'greenhouse' || s.type === 'lever' || s.type === 'ashby'); // 👈
}

function arrOrEmpty(x: any): string[] {
  if (!x) return [];
  if (Array.isArray(x)) return x.map(String).filter(Boolean);
  return String(x).split(',').map(s => s.trim()).filter(Boolean);
}

function toLower(s: string) { return s.toLowerCase(); }

function isNum(x: any) {
  return x !== null && x !== undefined && !isNaN(Number(x));
}

function safeJson(s: string) {
  try { return JSON.parse(s); } catch { return {}; }
}

function json(body: ApiResponse, statusCode = 200) {
  return { statusCode, headers: cors, body: JSON.stringify(body) };
}

// ✅ Normalize & validate degree
function normalizeDegree(deg: any): Filters['degreeAtMost'] {
  if (!deg) return null;
  const d = String(deg).toLowerCase();
  return (['none', 'bachelors', 'masters', 'phd'] as const).includes(d as any) ? (d as any) : null;
}

// ✅ Read *seniorityInclude* (not 'seniority'), normalize, and validate
function normalizeSeniorityList(val: any): Filters['seniorityInclude'] {
  const valid = ['intern','junior','mid','senior','staff','principal','lead'];
  const list = arrOrEmpty(val).map(v => v.toLowerCase()).filter(v => valid.includes(v));
  return list.length ? (list as any) : undefined;
}
