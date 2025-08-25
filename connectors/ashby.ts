// connectors/ashby.ts
import { fetchWithRetry } from '../lib/fetcher.js';
import type { Job } from '../lib/types.js';

// Try list → if description missing, fetch details for that posting.
export async function fetchAshby(boardUrl: string): Promise<Job[]> {
  let org = '';
  try {
    const u = new URL(boardUrl);
    if (!/ashbyhq\.com$/i.test(u.hostname)) throw new Error('Not an Ashby board');
    const segs = u.pathname.split('/').filter(Boolean);
    org = segs[0] || '';
    if (!org) throw new Error('Missing Ashby org slug');
  } catch {
    throw new Error('Invalid Ashby URL');
  }

  // Public JSON used by Ashby’s own board UI
  const listApi = `https://jobs.ashbyhq.com/api/posting/${org}`;
  const res = await fetchWithRetry(listApi, { headers: { 'Accept': 'application/json' } });
  if (!res.ok) throw new Error(`Ashby ${org} responded ${res.status}`);
  const data = await res.json();

  // The list can be at data, data.jobs, or data.postings depending on board config
  const postings = normalizeList(data);

  // Map to our Job type
  const jobs: Job[] = postings.map((p: any) => mapPosting(org, p));

  // Some boards omit description in the list; fetch details only where needed
  const needDetails = jobs.filter(j => !j.descriptionHtml);
  if (needDetails.length) {
    await Promise.all(needDetails.map(async (j) => {
      try {
        const d = await fetchDetails(org, extractId(j.id));
        j.descriptionHtml = d?.descriptionHtml || d?.description || j.descriptionHtml || '';
        if (!j.location && d?.location) j.location = d.location;
        if (!j.url && d?.jobUrl) j.url = d.jobUrl;
        if (j.postedAt == null && d?.createdAt) j.postedAt = toISO(d.createdAt);
      } catch (e) {
        // swallow; keep partial job
        console.error('Ashby detail error:', org, j.id, e);
      }
    }));
  }

  return jobs;
}

function normalizeList(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.jobs)) return data.jobs;
  if (Array.isArray(data?.postings)) return data.postings;
  if (Array.isArray(data?.data?.postings)) return data.data.postings;
  return [];
}

function mapPosting(org: string, p: any): Job {
  const id = p?.id ?? p?.jobId ?? p?._id ?? String(Math.random());
  const loc = pickLocation(p);
  return {
    id: `ashby:${org}:${id}`,
    provider: 'ashby',
    company: p?.companyName || org,
    title: p?.title || 'Untitled',
    location: loc,
    remote: /remote|anywhere|global/i.test([loc, p?.workType, p?.employmentType, p?.title].filter(Boolean).join(' ')),
    salary: undefined,
    url: p?.jobUrl || p?.url || `https://jobs.ashbyhq.com/${org}/job/${id}`,
    postedAt: toISO(p?.createdAt || p?.updatedAt || null),
    descriptionHtml: p?.descriptionHtml || p?.description || ''
  };
}

function pickLocation(p: any): string {
  // Ashby may expose locations in several shapes
  if (typeof p?.location === 'string') return p.location;
  if (Array.isArray(p?.locations) && p.locations.length) {
    const names = p.locations.map((x: any) => x?.name || x).filter(Boolean);
    return names.join(', ');
  }
  if (p?.primaryLocation?.name) return p.primaryLocation.name;
  return '';
}

function extractId(compoundId: string): string {
  // from "ashby:org:12345" → "12345"
  const parts = compoundId.split(':');
  return parts[parts.length - 1];
}

async function fetchDetails(org: string, id: string): Promise<any> {
  const url = `https://jobs.ashbyhq.com/api/posting/${org}/${id}`;
  const res = await fetchWithRetry(url, { headers: { 'Accept': 'application/json' } });
  if (!res.ok) throw new Error(`Ashby detail ${org}/${id} ${res.status}`);
  return await res.json();
}

function toISO(x: any): string | null {
  if (!x) return null;
  // Ashby sometimes returns ms epoch numbers
  if (typeof x === 'number') return new Date(x).toISOString();
  const t = Date.parse(String(x));
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}
