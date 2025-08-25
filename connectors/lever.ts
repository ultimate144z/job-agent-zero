import { fetchWithRetry } from '../lib/fetcher.js';
import type { Job } from '../lib/types.js';

export async function fetchLever(jobsUrl: string): Promise<Job[]> {
  // Expect e.g. https://jobs.lever.co/acme
  let account = '';
  try {
    const u = new URL(jobsUrl);
    // hostname: jobs.lever.co ; pathname: /{account}
    const segs = u.pathname.split('/').filter(Boolean);
    account = segs[0] || '';
    if (!account) throw new Error('Missing Lever account');
  } catch {
    throw new Error('Invalid Lever URL');
  }

  const api = `https://api.lever.co/v0/postings/${account}?mode=json`;
  const res = await fetchWithRetry(api, { headers: { 'Accept': 'application/json' }});
  if (!res.ok) {
    throw new Error(`Lever ${account} responded ${res.status}`);
  }
  const data = await res.json();
  const postings = Array.isArray(data) ? data : [];

  return postings.map((p: any): Job => ({
    id: `lever:${account}:${p.id}`,
    provider: 'lever',
    company: account,
    title: p?.text || 'Untitled',
    location: p?.categories?.location || '',
    remote: /remote/i.test(p?.categories?.location || '') || p?.workplaceType === 'remote',
    salary: undefined,
    url: p?.hostedUrl || '',
    postedAt: p?.createdAt ? new Date(p.createdAt).toISOString() : null,
    descriptionHtml: p?.description || '',
    tags: leverTags(p)
  }));
}

function leverTags(p: any): string[] {
  const set = new Set<string>();
  const add = (s?: string) => { if (s) s.split(/[,\s/]+/).forEach(x => x && set.add(x.toLowerCase())); };
  add(p?.text);
  add(p?.categories?.team);
  add(p?.categories?.location);
  add(p?.categories?.commitment);
  return Array.from(set).slice(0, 15);
}
