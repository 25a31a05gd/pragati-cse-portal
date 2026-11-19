export type CodingPlatform = 'leetcode' | 'hackerrank' | 'github';

export type CodingMetricStatus = 'ok' | 'empty' | 'not_found' | 'unavailable';

export interface ParsedCodingPlatformInput {
  ok: true;
  username: string;
}

export interface InvalidCodingPlatformInput {
  ok: false;
  error: string;
}

export interface LeetcodeFetchResult {
  status: CodingMetricStatus;
  total: number;
  easy: number;
  medium: number;
  hard: number;
}

export interface ScalarMetricFetchResult {
  status: CodingMetricStatus;
  count: number;
}

const PLATFORM_META: Record<
  CodingPlatform,
  {
    label: string;
    hosts: readonly string[];
    example: string;
    reservedSegments: ReadonlySet<string>;
  }
> = {
  leetcode: {
    label: 'LeetCode',
    hosts: ['leetcode.com', 'www.leetcode.com'],
    example: 'https://leetcode.com/u/username',
    reservedSegments: new Set([
      'u',
      'profile',
      'problems',
      'problemset',
      'explore',
      'discuss',
      'contest',
      'submissions',
      'login',
      'accounts',
      'graphql',
    ]),
  },
  hackerrank: {
    label: 'HackerRank',
    hosts: ['hackerrank.com', 'www.hackerrank.com'],
    example: 'https://www.hackerrank.com/profile/username',
    reservedSegments: new Set([
      'profile',
      'domains',
      'challenges',
      'contests',
      'leaderboard',
      'jobs',
      'dashboard',
      'auth',
      'login',
      'rest',
    ]),
  },
  github: {
    label: 'GitHub',
    hosts: ['github.com', 'www.github.com'],
    example: 'https://github.com/username',
    reservedSegments: new Set([
      'settings',
      'features',
      'marketplace',
      'explore',
      'topics',
      'orgs',
      'login',
      'signup',
      'apps',
      'sponsors',
      'notifications',
      'pulls',
      'issues',
    ]),
  },
};

function isValidUsernameFormat(username: string, platform: CodingPlatform): boolean {
  if (!username) return false;
  if (platform === 'github') {
    return /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/.test(username);
  }
  if (platform === 'leetcode') {
    return /^[a-zA-Z0-9_-]{1,64}$/.test(username);
  }
  return (
    username !== '.' &&
    !username.includes('..') &&
    /^[a-zA-Z0-9_.-]{1,64}$/.test(username)
  );
}

export function parseCodingPlatformInput(
  input: string,
  platform: CodingPlatform
): ParsedCodingPlatformInput | InvalidCodingPlatformInput {
  const trimmed = (input || '').trim();
  if (!trimmed) {
    return { ok: true, username: '' };
  }

  const meta = PLATFORM_META[platform];
  const looksLikeUrl =
    /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed) ||
    trimmed.includes('/') ||
    /\.(com|org|net|io|dev|in)(?:$|[/?#])/i.test(trimmed);

  if (!looksLikeUrl) {
    const candidate = trimmed.replace(/^@/, '');
    if (!isValidUsernameFormat(candidate, platform)) {
      return {
        ok: false,
        error: `Please enter a valid ${meta.label} username or profile URL (e.g. ${meta.example}).`,
      };
    }
    return { ok: true, username: candidate };
  }

  let parsed: URL;
  try {
    const withProto = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    parsed = new URL(withProto);
  } catch {
    return {
      ok: false,
      error: `Please enter a valid ${meta.label} profile URL (e.g. ${meta.example}).`,
    };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      ok: false,
      error: `${meta.label} URL must use http:// or https://.`,
    };
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!meta.hosts.includes(hostname)) {
    return {
      ok: false,
      error: `Invalid ${meta.label} URL host "${hostname}". Expected ${meta.hosts[0]}.`,
    };
  }

  const segments = parsed.pathname.split('/').filter(Boolean);
  if (segments.length === 0) {
    return {
      ok: false,
      error: `Please include your ${meta.label} username in the URL (e.g. ${meta.example}).`,
    };
  }

  let username = '';
  if (platform === 'leetcode') {
    if ((segments[0] === 'u' || segments[0] === 'profile') && segments.length === 2) {
      username = segments[1];
    } else if (segments.length === 1 && !meta.reservedSegments.has(segments[0].toLowerCase())) {
      username = segments[0];
    }
  } else if (platform === 'hackerrank') {
    if (segments[0] === 'profile' && segments.length === 2) {
      username = segments[1];
    } else if (segments.length === 1 && !meta.reservedSegments.has(segments[0].toLowerCase())) {
      username = segments[0];
    }
  } else if (segments.length === 1 && !meta.reservedSegments.has(segments[0].toLowerCase())) {
    username = segments[0];
  }

  username = username.replace(/^@/, '');
  if (!isValidUsernameFormat(username, platform)) {
    return {
      ok: false,
      error: `Could not extract a valid ${meta.label} username from URL (expected e.g. ${meta.example}).`,
    };
  }

  return { ok: true, username };
}

export const CODING_STATS_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const CODING_STATS_CACHE_TTL_MS = 60 * 1000; // 60 seconds
export const CODING_SYNC_COOLDOWN_MS = 15 * 1000; // 15 seconds

const MAX_CACHE_ENTRIES = 500;

interface CacheEntry<T> {
  expiresAt: number;
  value: T;
}

const leetcodeOkCache = new Map<string, CacheEntry<LeetcodeFetchResult>>();
const scalarOkCache = new Map<string, CacheEntry<ScalarMetricFetchResult>>();

function getCachedValue<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return { ...entry.value };
}

function setCachedOkValue<T>(cache: Map<string, CacheEntry<T>>, key: string, value: T): void {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) {
      cache.delete(oldestKey);
    }
  }
  cache.set(key, {
    expiresAt: Date.now() + CODING_STATS_CACHE_TTL_MS,
    value: { ...value },
  });
}

export function isWithinVerificationTtl(
  verifiedAt: Date | null | undefined,
  nowMs = Date.now()
): boolean {
  if (!verifiedAt) return false;
  const verifiedMs = verifiedAt.getTime();
  return (
    Number.isFinite(verifiedMs) &&
    nowMs - verifiedMs >= 0 &&
    nowMs - verifiedMs <= CODING_STATS_VERIFICATION_TTL_MS
  );
}

export function extractUsernameFromUrl(input: string, platform: CodingPlatform): string {
  const parsed = parseCodingPlatformInput(input, platform);
  return parsed.ok ? parsed.username : '';
}

function buildGithubApiHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'CSE-Department-Portal',
  };
  const githubToken = (process.env.GITHUB_TOKEN || '').trim();
  if (githubToken) {
    headers.Authorization = `Bearer ${githubToken}`;
  }
  return headers;
}

export async function fetchGithubRepoCount(
  username: string
): Promise<ScalarMetricFetchResult> {
  if (!username) {
    return { status: 'empty', count: 0 };
  }
  const cacheKey = `github:${username.toLowerCase()}`;
  const cached = getCachedValue(scalarOkCache, cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}`, {
      headers: buildGithubApiHeaders(),
      signal: AbortSignal.timeout(4000),
    });
    if (res.status === 404) {
      return { status: 'not_found', count: 0 };
    }
    if (!res.ok) {
      return { status: 'unavailable', count: 0 };
    }
    const data = (await res.json()) as { public_repos?: unknown };
    if (typeof data.public_repos === 'number' && Number.isFinite(data.public_repos)) {
      const result: ScalarMetricFetchResult = {
        status: 'ok',
        count: Math.max(0, Math.trunc(data.public_repos)),
      };
      setCachedOkValue(scalarOkCache, cacheKey, result);
      return result;
    }
    return { status: 'unavailable', count: 0 };
  } catch {
    return { status: 'unavailable', count: 0 };
  }
}

export async function fetchLeetcodeCounts(username: string): Promise<LeetcodeFetchResult> {
  if (!username) {
    return { status: 'empty', total: 0, easy: 0, medium: 0, hard: 0 };
  }
  const cacheKey = `leetcode:${username.toLowerCase()}`;
  const cached = getCachedValue(leetcodeOkCache, cacheKey);
  if (cached) return cached;

  try {
    const query = `
      query userProblemsSolved($username: String!) {
        matchedUser(username: $username) {
          submitStatsGlobal {
            acSubmissionNum {
              difficulty
              count
            }
          }
        }
      }
    `;
    const res = await fetch('https://leetcode.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Referer: 'https://leetcode.com',
        'User-Agent': 'CSE-Department-Portal',
      },
      body: JSON.stringify({ query, variables: { username } }),
      signal: AbortSignal.timeout(4000),
    });
    if (res.status === 404) {
      return { status: 'not_found', total: 0, easy: 0, medium: 0, hard: 0 };
    }
    if (!res.ok) {
      return { status: 'unavailable', total: 0, easy: 0, medium: 0, hard: 0 };
    }
    const payload = (await res.json()) as {
      data?: {
        matchedUser?: {
          submitStatsGlobal?: {
            acSubmissionNum?: Array<{ difficulty: string; count: number }>;
          };
        } | null;
      };
    };
    if (payload?.data && payload.data.matchedUser === null) {
      return { status: 'not_found', total: 0, easy: 0, medium: 0, hard: 0 };
    }
    const arr = payload?.data?.matchedUser?.submitStatsGlobal?.acSubmissionNum;
    if (!Array.isArray(arr)) {
      return { status: 'unavailable', total: 0, easy: 0, medium: 0, hard: 0 };
    }
    const findDiff = (d: string) =>
      Math.max(0, Math.trunc(Number(arr.find((x) => x.difficulty === d)?.count ?? 0) || 0));
    const result: LeetcodeFetchResult = {
      status: 'ok',
      total: findDiff('All'),
      easy: findDiff('Easy'),
      medium: findDiff('Medium'),
      hard: findDiff('Hard'),
    };
    setCachedOkValue(leetcodeOkCache, cacheKey, result);
    return result;
  } catch {
    return { status: 'unavailable', total: 0, easy: 0, medium: 0, hard: 0 };
  }
}

export async function fetchHackerrankFiveStars(
  username: string
): Promise<ScalarMetricFetchResult> {
  if (!username) {
    return { status: 'empty', count: 0 };
  }
  const cacheKey = `hackerrank:${username.toLowerCase()}`;
  const cached = getCachedValue(scalarOkCache, cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(
      `https://www.hackerrank.com/rest/hackers/${encodeURIComponent(username)}/badges`,
      {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'CSE-Department-Portal',
        },
        signal: AbortSignal.timeout(4000),
      }
    );
    if (res.status === 404) {
      return { status: 'not_found', count: 0 };
    }
    if (!res.ok) {
      return { status: 'unavailable', count: 0 };
    }
    const data = (await res.json()) as { models?: Array<{ stars?: number }> };
    if (!Array.isArray(data.models)) {
      return { status: 'unavailable', count: 0 };
    }
    const result: ScalarMetricFetchResult = {
      status: 'ok',
      count: data.models.filter((b) => (b.stars ?? 0) >= 5).length,
    };
    setCachedOkValue(scalarOkCache, cacheKey, result);
    return result;
  } catch {
    return { status: 'unavailable', count: 0 };
  }
}

export interface ProfileBioFetchResult {
  status: 'ok' | 'empty' | 'not_found' | 'unavailable';
  bioText: string;
}

export async function fetchCodingProfileBio(
  platform: CodingPlatform,
  username: string
): Promise<ProfileBioFetchResult> {
  if (!username) {
    return { status: 'empty', bioText: '' };
  }

  try {
    if (platform === 'github') {
      const res = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}`, {
        headers: buildGithubApiHeaders(),
        signal: AbortSignal.timeout(4500),
      });
      if (res.status === 404) {
        return { status: 'not_found', bioText: '' };
      }
      if (!res.ok) {
        return { status: 'unavailable', bioText: '' };
      }
      const data = (await res.json()) as { bio?: unknown; blog?: unknown };
      const combined = [
        typeof data.bio === 'string' ? data.bio : '',
        typeof data.blog === 'string' ? data.blog : '',
      ]
        .filter(Boolean)
        .join('\n');
      return { status: 'ok', bioText: combined };
    }

    if (platform === 'leetcode') {
      const query = `
        query userPublicBio($username: String!) {
          matchedUser(username: $username) {
            username
            profile {
              aboutMe
              websites
            }
          }
        }
      `;
      const res = await fetch('https://leetcode.com/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Referer: 'https://leetcode.com',
          'User-Agent': 'CSE-Department-Portal',
        },
        body: JSON.stringify({ query, variables: { username } }),
        signal: AbortSignal.timeout(4500),
      });
      if (res.status === 404) {
        return { status: 'not_found', bioText: '' };
      }
      if (!res.ok) {
        return { status: 'unavailable', bioText: '' };
      }
      const payload = (await res.json()) as {
        data?: {
          matchedUser?: {
            username?: string;
            profile?: {
              aboutMe?: string | null;
              websites?: string[] | null;
            } | null;
          } | null;
        };
      };
      if (payload?.data && payload.data.matchedUser === null) {
        return { status: 'not_found', bioText: '' };
      }
      const matched = payload?.data?.matchedUser;
      if (!matched) {
        return { status: 'unavailable', bioText: '' };
      }
      const combined = [
        typeof matched.profile?.aboutMe === 'string' ? matched.profile.aboutMe : '',
        ...(Array.isArray(matched.profile?.websites)
          ? matched.profile!.websites.filter((w): w is string => typeof w === 'string')
          : []),
      ]
        .filter(Boolean)
        .join('\n');
      return { status: 'ok', bioText: combined };
    }

    // HackerRank public profile endpoint (no official consumer OAuth; falls back to staff verification if blocked/private)
    const res = await fetch(
      `https://www.hackerrank.com/rest/contests/master/hackers/${encodeURIComponent(username)}/profile`,
      {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'CSE-Department-Portal',
        },
        signal: AbortSignal.timeout(4500),
      }
    );
    if (res.status === 404) {
      return { status: 'not_found', bioText: '' };
    }
    if (!res.ok) {
      return { status: 'unavailable', bioText: '' };
    }
    const payload = (await res.json()) as {
      model?: {
        short_bio?: unknown;
        jobs_headline?: unknown;
        website?: unknown;
      } | null;
    };
    if (!payload?.model) {
      return { status: 'unavailable', bioText: '' };
    }
    const combined = [
      typeof payload.model.short_bio === 'string' ? payload.model.short_bio : '',
      typeof payload.model.jobs_headline === 'string' ? payload.model.jobs_headline : '',
      typeof payload.model.website === 'string' ? payload.model.website : '',
    ]
      .filter(Boolean)
      .join('\n');
    return { status: 'ok', bioText: combined };
  } catch {
    return { status: 'unavailable', bioText: '' };
  }
}

