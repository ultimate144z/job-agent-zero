import { fetchWithRetry } from '../lib/fetcher.js';
import type { Job } from '../lib/types.js';

export async function fetchGreenhouse(boardUrl: string): Promise<Job[]> {
  // Expect e.g. https://boards.greenhouse.io/stripe
  let slug = '';
  try {
    const u = new URL(boardUrl);
    const segs = u.pathname.split('/').filter(Boolean);
    slug = segs.pop() || '';
    if (!slug) throw new Error('Missing Greenhouse board slug');
  } catch {
    throw new Error('Invalid Greenhouse URL');
  }

  const api = `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`;
  const res = await fetchWithRetry(api, { headers: { 'Accept': 'application/json' }});
  if (!res.ok) {
    throw new Error(`Greenhouse ${slug} responded ${res.status}`);
  }
  const data = await res.json();
  const jobs = Array.isArray(data?.jobs) ? data.jobs : [];

  return jobs.map((j: any): Job => ({
    id: `greenhouse:${slug}:${j.id}`,
    provider: 'greenhouse',
    company: j?.company?.name || slug,
    title: j?.title || 'Untitled',
    location: j?.location?.name || '',
    remote: /remote/i.test(j?.location?.name || '') || /remote/i.test(j?.title || ''),
    salary: undefined,
    url: j?.absolute_url || '',
    postedAt: j?.updated_at || j?.created_at || null,
    descriptionHtml: j?.content || '',
    tags: extractTags(j)
  }));
}

function extractTags(j: any): string[] {
  const set = new Set<string>();
  const add = (s?: string) => { if (s) s.split(/[,\s/]+/).forEach(x => x && set.add(x.toLowerCase())); };
  add(j?.title);
  add(j?.location?.name);
  // Greenhouse content is HTML; tags will be added later from summary/description if needed
  return Array.from(set).slice(0, 15);
}
