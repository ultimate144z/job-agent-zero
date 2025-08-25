// lib/summarize.ts

// Decode a few common HTML entities (enough for job postings)
function decodeEntities(s: string): string {
  if (!s) return '';
  const map: Record<string, string> = {
    '&lt;': '<',
    '&gt;': '>',
    '&amp;': '&',
    '&quot;': '"',
    '&#39;': "'"
  };
  // Replace repeatedly in case of double-encoded text
  let out = s;
  for (let i = 0; i < 2; i++) {
    out = out.replace(/&(lt|gt|amp|quot|#39);/g, (m) => map[m] ?? m);
  }
  return out;
}

export function summarizeHtml(html: string, maxBullets = 5): string[] {
  if (!html) return [];

  // 1) Decode entities first so tags like &lt;li&gt; become <li>
  const decoded = decodeEntities(html);

  // 2) Convert <li> into bullets & remove all other HTML tags
  const text = decoded
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // 3) Prefer real bullets if present
  const bullets = text.split('• ').map(s => s.trim()).filter(Boolean);
  if (bullets.length) return bullets.slice(0, maxBullets).map(s => safeTruncate(s, 160));

  // 4) Fallback: key sentences (responsibilities/requirements)
  const paras = text.split(/(?<=\.)\s+/);
  const picked = paras.filter(p => /(responsib|require|qualif|skills|experience|you will)/i.test(p));
  const chosen = picked.length ? picked : paras;
  return chosen.slice(0, maxBullets).map(s => safeTruncate(s, 160));
}

function safeTruncate(s: string, n: number) {
  if (s.length <= n) return s;
  return s.slice(0, n - 1).trimEnd() + '…';
}
