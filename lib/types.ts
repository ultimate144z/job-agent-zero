export type SourceInput =
  | { type: 'greenhouse'; url: string }
  | { type: 'lever'; url: string }
  | { type: 'ashby'; url: string };

export type DegreeLevel = 'none' | 'bachelors' | 'masters' | 'phd';
export type Seniority =
  | 'intern' | 'junior' | 'mid' | 'senior' | 'staff' | 'principal' | 'lead';

export type Filters = {
  keywords?: string[];
  remote?: boolean | null;
  locations?: string[];
  // NEW:
  maxYearsExperience?: number | null;   // e.g., 2 means keep jobs that ask <= 2 years (or unspecified)
  degreeAtMost?: DegreeLevel | null;    // e.g., 'masters' means keep jobs asking up to masters; drop PhD-only
  seniorityInclude?: Seniority[];       // optional whitelist (if set, must match)
  postedWithinDays?: number | null;
  minSalaryUSD?: number | null;
  seniority?: string[]; // (kept for compatibility if you used it earlier)
  tech?: string[];
  sources: SourceInput[];
  page?: number;
  pageSize?: number;
};

export type Job = {
  id: string;
  provider: 'greenhouse' | 'lever' | 'ashby';
  company: string;
  title: string;
  location: string;
  remote: boolean;
  salary?: { min: number | null; max: number | null; currency?: string | null };
  url: string;
  postedAt?: string|null;
  descriptionHtml: string;
  summary?: string[];
  tags?: string[];
  // NEW:
  requirements?: {
    minYears?: number | null;
    degree?: DegreeLevel | null;
    seniority?: Seniority | null;
  };
  sourceMeta?: Record<string, unknown>;
};

export type ApiResponse = {
  ok: true;
  count: number;
  page: number;
  pageSize: number;
  total: number;
  jobs: Job[];
} | {
  ok: false;
  error: string;
  details?: unknown;
};


