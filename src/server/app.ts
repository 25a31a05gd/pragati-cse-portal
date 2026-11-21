import 'dotenv/config';
import dns from 'dns';
import express, { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import helmet from 'helmet';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { and, asc, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  checkDatabaseReadiness,
  requireDb,
  schema,
} from '../db/index.js';
import {
  createSupabaseAuthUser,
  deleteSupabaseAuthUser,
  isSupabaseConfigured,
  signInSupabasePassword,
  signOutSupabaseJwt,
  updateSupabaseAuthUser,
  verifySupabaseJwt,
} from './supabase.js';
import {
  CODING_STATS_CACHE_TTL_MS,
  CODING_SYNC_COOLDOWN_MS,
  fetchCodingProfileBio,
  fetchGithubRepoCount,
  fetchHackerrankFiveStars,
  fetchLeetcodeCounts,
  isWithinVerificationTtl,
  parseCodingPlatformInput,
  type CodingPlatform,
} from './codingStats.js';
import {
  canManageAdminsRecord,
  computeUserProgress,
  findUserByIdentifierAndRole,
  getAdminAnalyticsSummary,
  getAdminProfilesListSafe,
  getAppById,
  getAuthenticatedBootstrapPayload,
  getCourseById,
  getHackathonById,
  getInterviewById,
  getInterviewsList,
  getFacultyDirectoryList,
  getNormalizedInitialAdminEmail,
  getPersonalRemindersForUser,
  getPlacementDriveById,
  getProblemById,
  getProjectById,
  getPublicBootstrapPayload,
  getSpotlightById,
  getUserWithProfilesById,
  hasAdminRecordPermission,
  isSuperAdminRecord,
  mapFacultyDirectoryRow,
  mapReminderRow,
  resolveAdminPermissions,
  searchStudentsDirectory,
  toPublicProfile,
  type HydratedUserRecord,
} from './portalQueries.js';
import type { AdminModulePermission, UserRole } from '../types.js';

dns.setDefaultResultOrder('ipv4first');

type AuthTokenStatus = 'none' | 'valid' | 'invalid_or_expired';

interface AuthedRequest extends Request {
  userRecord?: HydratedUserRecord;
  accessToken?: string;
  authTokenStatus?: AuthTokenStatus;
}

const uuidSchema = z.string().uuid('Invalid record identifier.');
const EPHEMERAL_HMAC_FALLBACK = crypto.randomBytes(32).toString('hex');
const CODING_OWNER_CODE_TTL_SEC = 30 * 60;
const MAX_CONSUMED_CHALLENGES = 2000;
const consumedCodingChallenges = new Map<string, number>();

function pruneConsumedCodingChallenges(nowMs = Date.now()): void {
  for (const [key, expiresAtMs] of consumedCodingChallenges.entries()) {
    if (expiresAtMs <= nowMs) {
      consumedCodingChallenges.delete(key);
    }
  }
}

function getConsumedChallengeKey(
  userId: string,
  platform: CodingPlatform,
  normalizedCode: string
): string {
  return `${userId}:${platform}:${normalizedCode}`;
}

function isCodingChallengeConsumed(
  userId: string,
  platform: CodingPlatform,
  normalizedCode: string
): boolean {
  const nowMs = Date.now();
  pruneConsumedCodingChallenges(nowMs);
  const expiresAtMs = consumedCodingChallenges.get(
    getConsumedChallengeKey(userId, platform, normalizedCode)
  );
  return typeof expiresAtMs === 'number' && expiresAtMs > nowMs;
}

function markCodingChallengeConsumed(
  userId: string,
  platform: CodingPlatform,
  normalizedCode: string,
  expSec: number
): void {
  const nowMs = Date.now();
  pruneConsumedCodingChallenges(nowMs);
  if (consumedCodingChallenges.size >= MAX_CONSUMED_CHALLENGES) {
    const oldestKey = consumedCodingChallenges.keys().next().value;
    if (oldestKey !== undefined) {
      consumedCodingChallenges.delete(oldestKey);
    }
  }
  consumedCodingChallenges.set(
    getConsumedChallengeKey(userId, platform, normalizedCode),
    expSec * 1000
  );
}

function getCodingVerifyHmacKey(): Buffer {
  const persistentSeed =
    (process.env.CODING_VERIFY_HMAC_SECRET || '').trim() ||
    (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim() ||
    (process.env.DATABASE_URL || '').trim();

  if (!persistentSeed && process.env.NODE_ENV === 'production') {
    throw new Error(
      'Coding verification HMAC secret is unavailable in production environment.'
    );
  }

  return crypto
    .createHmac('sha256', persistentSeed || EPHEMERAL_HMAC_FALLBACK)
    .update('cse-portal-coding-ownership-v1')
    .digest();
}

function signCodingOwnershipCode(
  userId: string,
  platform: CodingPlatform,
  username: string,
  expSec: number,
  nonce = crypto.randomBytes(3).toString('hex').toUpperCase()
): string {
  const payload = `${userId}|${platform}|${username.toLowerCase()}|${expSec}|${nonce}`;
  const mac = crypto
    .createHmac('sha256', getCodingVerifyHmacKey())
    .update(payload)
    .digest('hex')
    .slice(0, 16)
    .toUpperCase();
  return `CSE-VERIFY-${expSec.toString(36).toUpperCase()}-${nonce}-${mac}`;
}

function verifyCodingOwnershipCodeSignature(
  userId: string,
  platform: CodingPlatform,
  username: string,
  rawCode: unknown
): { ok: true; expSec: number; normalizedCode: string } | { ok: false; error: string } {
  if (typeof rawCode !== 'string' || !rawCode.trim()) {
    return { ok: false, error: 'Verification code is required.' };
  }
  const normalized = rawCode.trim().toUpperCase();
  const match = /^CSE-VERIFY-([A-Z0-9]+)-([A-F0-9]{6})-([A-F0-9]{16})$/.exec(normalized);
  if (!match) {
    return { ok: false, error: 'Invalid verification code format.' };
  }
  const expSec = Number.parseInt(match[1], 36);
  const nonce = match[2];
  const nowSec = Math.floor(Date.now() / 1000);
  if (
    !Number.isFinite(expSec) ||
    expSec < nowSec ||
    expSec > nowSec + CODING_OWNER_CODE_TTL_SEC + 300
  ) {
    return { ok: false, error: 'Verification code has expired. Please generate a fresh code.' };
  }
  const expected = signCodingOwnershipCode(userId, platform, username, expSec, nonce);
  const a = Buffer.from(normalized, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return {
      ok: false,
      error: 'Verification code does not match your account or current profile handle.',
    };
  }
  if (isCodingChallengeConsumed(userId, platform, normalized)) {
    return {
      ok: false,
      error: 'This verification code has already been used. Please generate a fresh verification code.',
    };
  }
  return { ok: true, expSec, normalizedCode: normalized };
}

function normalizeHttpUrlInput(
  raw: unknown,
  options: { required?: boolean; label: string }
): { ok: true; value: string } | { ok: false; error: string } {
  if (raw === undefined || raw === null) {
    if (options.required) {
      return { ok: false, error: `${options.label} is required.` };
    }
    return { ok: true, value: '' };
  }
  if (typeof raw !== 'string') {
    return { ok: false, error: `${options.label} must be a valid URL text string.` };
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    if (options.required) {
      return { ok: false, error: `${options.label} is required.` };
    }
    return { ok: true, value: '' };
  }
  const hasScheme = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed);
  const candidate = hasScheme ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return {
        ok: false,
        error: `${options.label} must use an http:// or https:// web address.`,
      };
    }
    return { ok: true, value: parsed.toString() };
  } catch {
    return {
      ok: false,
      error: `Please enter a valid ${options.label} URL (e.g. https://...).`,
    };
  }
}

function asNonEmptyTrimmedString(
  raw: unknown,
  fallback = ''
): string | null {
  if (raw === undefined) return fallback;
  if (typeof raw !== 'string') return null;
  return raw.trim();
}

function parseUuidParam(raw: string | string[] | undefined): string | null {
  const val = Array.isArray(raw) ? raw[0] : raw;
  const parsed = uuidSchema.safeParse((val || '').trim());
  return parsed.success ? parsed.data : null;
}

function asyncHandler(
  fn: (req: AuthedRequest, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function getPgErrorCode(err: unknown, depth = 0): string | undefined {
  if (depth > 5 || !err || typeof err !== 'object') {
    return undefined;
  }
  const candidate = err as { code?: unknown; cause?: unknown; errors?: unknown };
  if (typeof candidate.code === 'string' && candidate.code.trim()) {
    return candidate.code.trim();
  }
  if (Array.isArray(candidate.errors)) {
    for (const inner of candidate.errors) {
      const innerCode = getPgErrorCode(inner, depth + 1);
      if (innerCode) return innerCode;
    }
  }
  if (candidate.cause) {
    return getPgErrorCode(candidate.cause, depth + 1);
  }
  return undefined;
}

const TRANSIENT_DB_ERROR_CODES = new Set([
  'ENETUNREACH',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ECONNRESET',
  'EHOSTUNREACH',
  'EPIPE',
  'CONNECT_TIMEOUT',
  'CONNECTION_CLOSED',
  'CONNECTION_ENDED',
  'CONNECTION_DESTROYED',
  '08000',
  '08001',
  '08003',
  '08004',
  '08006',
  '08007',
  '53300',
  '53400',
  '57014',
  '57P01',
  '57P02',
  '57P03',
  '08P01',
  '28P01',
  'XX000',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'CERT_HAS_EXPIRED',
]);

function isDbConnectivityError(err: unknown): boolean {
  const code = getPgErrorCode(err);
  if (code && TRANSIENT_DB_ERROR_CODES.has(code)) {
    return true;
  }
  if (
    err instanceof Error &&
    /Database connection is not configured|connect\s+E|connect_timeout|connection\s+(closed|ended|terminated)|timeout expired|Tenant or user not found|password authentication failed|remaining connection slots are reserved|MaxClientsInSessionMode/i.test(
      err.message
    )
  ) {
    return true;
  }
  return false;
}

function sanitizeForLog(raw: string): string {
  return raw
    .replace(/postgres(?:ql)?:\/\/[^\s'"]+/gi, 'postgresql://[REDACTED]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[JWT_REDACTED]')
    .replace(/(password|secret|service_role|token|api[_-]?key)\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[EMAIL_REDACTED]');
}

function getErrorCauseSummary(err: unknown, depth = 0): string | undefined {
  if (depth > 3 || !err || typeof err !== 'object') return undefined;
  const candidate = err as { cause?: unknown; message?: unknown; name?: unknown; code?: unknown };
  if (depth > 0) {
    const label = [
      typeof candidate.name === 'string' ? candidate.name : 'Error',
      typeof candidate.code === 'string' ? `(${candidate.code})` : '',
      typeof candidate.message === 'string' ? sanitizeForLog(candidate.message) : '',
    ]
      .filter(Boolean)
      .join(' ');
    return label || undefined;
  }
  return candidate.cause ? getErrorCauseSummary(candidate.cause, depth + 1) : undefined;
}

function logApiError(label: string, req: Request, err: unknown): void {
  const pgCode = getPgErrorCode(err);
  const constraint = getPgConstraintName(err);
  const errorName = err instanceof Error ? err.name : typeof err;
  const rawMessage = err instanceof Error ? err.message : String(err);
  const causeSummary = getErrorCauseSummary(err);
  const stack =
    err instanceof Error && err.stack
      ? sanitizeForLog(err.stack.split('\n').slice(0, 8).join('\n'))
      : undefined;

  console.error(`[${label}] ${req.method} ${req.path}`, {
    errorName,
    pgCode: pgCode || undefined,
    constraint: constraint || undefined,
    message: sanitizeForLog(rawMessage),
    cause: causeSummary,
    stack,
  });
}

function isUniqueViolation(err: unknown): boolean {
  return getPgErrorCode(err) === '23505';
}

function getPgConstraintName(err: unknown): string | undefined {
  let current: unknown = err;
  for (let depth = 0; depth < 5 && current && typeof current === 'object'; depth++) {
    const candidate = current as { constraint_name?: unknown; constraint?: unknown; cause?: unknown };
    if (typeof candidate.constraint_name === 'string' && candidate.constraint_name.trim()) {
      return candidate.constraint_name;
    }
    if (typeof candidate.constraint === 'string' && candidate.constraint.trim()) {
      return candidate.constraint;
    }
    current = candidate.cause;
  }
  return undefined;
}

function isMissingTableOrRelation(err: unknown): boolean {
  const code = getPgErrorCode(err);
  return code === '42P01' || code === '42703';
}

function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice(7).trim();
  return token || null;
}

async function attachUser(
  req: AuthedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const rawAuthHeader = req.headers.authorization;
  if (!rawAuthHeader || !rawAuthHeader.trim()) {
    req.authTokenStatus = 'none';
    next();
    return;
  }

  const token = extractBearerToken(req);
  if (!token) {
    req.authTokenStatus = 'invalid_or_expired';
    next();
    return;
  }

  try {
    const authUser = await verifySupabaseJwt(token);
    if (!authUser) {
      req.authTokenStatus = 'invalid_or_expired';
      next();
      return;
    }

    const db = requireDb();
    const record = await getUserWithProfilesById(db, authUser.id);
    if (record && record.user.isActive) {
      req.userRecord = record;
      req.accessToken = token;
      req.authTokenStatus = 'valid';
    } else {
      req.authTokenStatus = 'invalid_or_expired';
    }
  } catch (err) {
    req.authTokenStatus = 'invalid_or_expired';
    logApiError('Auth Middleware Error', req, err);
  }
  next();
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (!req.userRecord) {
    res.status(401).json({
      error:
        req.authTokenStatus === 'invalid_or_expired'
          ? 'Your session has expired or is invalid. Please sign in again.'
          : 'Please sign in at the top right to perform this action.',
    });
    return;
  }
  next();
}

const ADMIN_MODULE_LABELS: Record<AdminModulePermission, string> = {
  students: 'Students',
  faculty: 'Faculty',
  placements: 'Placements',
  coding_verification: 'Coding & Verification',
  dashboard_analytics: 'Dashboard & Analytics',
};

function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (!req.userRecord) {
    res.status(401).json({
      error:
        req.authTokenStatus === 'invalid_or_expired'
          ? 'Your administrator session has expired or is invalid. Please sign in again.'
          : 'Please sign in as Administrator to perform this action.',
    });
    return;
  }
  if (req.userRecord.user.role !== 'admin') {
    res.status(403).json({
      error: 'Access denied: Administrator privileges required.',
    });
    return;
  }
  next();
}

function requireAdminManagementAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (!req.userRecord) {
    res.status(401).json({
      error:
        req.authTokenStatus === 'invalid_or_expired'
          ? 'Your administrator session has expired or is invalid. Please sign in again.'
          : 'Please sign in as Super Administrator to perform this action.',
    });
    return;
  }
  if (req.userRecord.user.role !== 'admin') {
    res.status(403).json({
      error: 'Access denied: Administrator privileges required.',
    });
    return;
  }
  if (!canManageAdminsRecord(req.userRecord)) {
    res.status(403).json({
      error:
        'Access denied: Only Super Admin or an explicitly authorized Administrator can manage admin accounts.',
    });
    return;
  }
  next();
}

function requireAdminModule(module: AdminModulePermission) {
  return (req: AuthedRequest, res: Response, next: NextFunction): void => {
    if (!req.userRecord) {
      res.status(401).json({
        error:
          req.authTokenStatus === 'invalid_or_expired'
            ? 'Your administrator session has expired or is invalid. Please sign in again.'
            : 'Please sign in as Administrator to perform this action.',
      });
      return;
    }
    if (req.userRecord.user.role !== 'admin') {
      res.status(403).json({
        error: 'Access denied: Administrator privileges required.',
      });
      return;
    }
    if (!hasAdminRecordPermission(req.userRecord, module)) {
      res.status(403).json({
        error: `Access denied: Requires '${ADMIN_MODULE_LABELS[module]}' administrator permission.`,
      });
      return;
    }
    next();
  };
}

async function generateUniqueAdminMemberId(db: ReturnType<typeof requireDb>): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = `ADM-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
    const [existing] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(sql`upper(${schema.users.memberId}) = upper(${candidate})`)
      .limit(1);
    if (!existing) return candidate;
  }
  return `ADM-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

const TRUSTED_PORTAL_VERCEL_ORIGIN_RE =
  /^https:\/\/pragati-cse-portal(?:-[a-z0-9-]+)*\.vercel\.app$/i;
const TRUSTED_AISTUDIO_ORIGIN_RE =
  /^https:\/\/ais-(?:dev|pre)-[a-z0-9-]+(?:\.[a-z0-9-]+)*\.run\.app$/i;

function getConfiguredCorsEntries(): string[] {
  const raw = [
    process.env.CORS_ORIGINS,
    process.env.FRONTEND_URL,
    process.env.CLIENT_URL,
    process.env.APP_URL,
    process.env.RENDER_EXTERNAL_URL,
    process.env.RENDER_EXTERNAL_HOSTNAME,
  ]
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .join(',');

  if (!raw) return [];
  return raw
    .split(/[,\s]+/)
    .map((entry) => entry.trim().replace(/^['"]+|['"]+$/g, '').replace(/\/+$/, ''))
    .filter((entry) => entry.length > 0 && entry !== 'MY_APP_URL' && entry !== '*');
}

function isAllowedCorsOrigin(origin: string, configuredEntries: string[]): boolean {
  let parsedOrigin: URL;
  try {
    parsedOrigin = new URL(origin);
  } catch {
    return false;
  }

  if (parsedOrigin.protocol !== 'http:' && parsedOrigin.protocol !== 'https:') {
    return false;
  }

  const normalizedOrigin = parsedOrigin.origin.toLowerCase();

  // Development localhost origins
  if (
    process.env.NODE_ENV !== 'production' &&
    (parsedOrigin.hostname === 'localhost' || parsedOrigin.hostname === '127.0.0.1')
  ) {
    return true;
  }

  // Project-scoped Vercel production & preview deployments and AI Studio preview sandboxes
  if (
    TRUSTED_PORTAL_VERCEL_ORIGIN_RE.test(normalizedOrigin) ||
    TRUSTED_AISTUDIO_ORIGIN_RE.test(normalizedOrigin)
  ) {
    return true;
  }

  for (const rawEntry of configuredEntries) {
    const entry = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(rawEntry)
      ? rawEntry
      : `https://${rawEntry}`;

    if (entry.includes('*')) {
      const escaped = entry
        .toLowerCase()
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '[a-z0-9-]+');
      if (new RegExp(`^${escaped}$`).test(normalizedOrigin)) {
        return true;
      }
      continue;
    }

    try {
      const parsedEntry = new URL(entry);
      if (parsedEntry.origin.toLowerCase() === normalizedOrigin) {
        return true;
      }
    } catch {
      if (entry.toLowerCase() === normalizedOrigin) {
        return true;
      }
    }
  }

  return false;
}

export interface BuildExpressAppOptions {
  mountFrontend?: (app: express.Express) => Promise<void> | void;
}

let cachedAppPromise: Promise<express.Express> | null = null;

async function buildExpressApp(options?: BuildExpressAppOptions): Promise<express.Express> {
  const app = express();
  const configuredCorsEntries = getConfiguredCorsEntries();

  app.set('trust proxy', 1);
  app.use((req: Request, res: Response, next: NextFunction) => {
    const requestOrigin = req.headers.origin;
    if (requestOrigin) {
      res.setHeader('Vary', 'Origin');
      if (isAllowedCorsOrigin(requestOrigin, configuredCorsEntries)) {
        res.setHeader('Access-Control-Allow-Origin', requestOrigin);
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
        res.setHeader(
          'Access-Control-Allow-Headers',
          'Content-Type, Authorization, Accept, Cache-Control, X-Requested-With, Pragma'
        );
        res.setHeader('Access-Control-Max-Age', '86400');
      } else {
        console.warn(
          `[CORS Blocked] Origin=${sanitizeForLog(requestOrigin)} Method=${req.method} Path=${req.path}`
        );
        if (req.method === 'OPTIONS') {
          res.status(403).json({ error: 'Origin not allowed by CORS policy.' });
          return;
        }
      }
    }

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );
  app.use(express.json({ limit: '2mb' }));

  const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 40,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many authentication requests. Please try again shortly.' },
  });

  const apiRateLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 180,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Rate limit exceeded. Please slow down requests.' },
  });

  const codingVerificationRateLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      const authedReq = req as AuthedRequest;
      if (authedReq.userRecord?.user.id) {
        return `user:${authedReq.userRecord.user.id}`;
      }
      return ipKeyGenerator(req.ip || 'unknown');
    },
    skip: (req) => {
      const authedReq = req as AuthedRequest;
      if (authedReq.userRecord?.user.role !== 'student') return true;
      if (req.method === 'PUT') {
        const body = req.body as Record<string, unknown> | undefined;
        if (body?.syncCodingLinks) return false;
        const sp = authedReq.userRecord.studentProfile;
        const lcChanged =
          typeof body?.leetcodeUrl === 'string' &&
          body.leetcodeUrl.trim() !== (sp?.leetcodeUrl || '');
        const hrChanged =
          typeof body?.hackerrankUrl === 'string' &&
          body.hackerrankUrl.trim() !== (sp?.hackerrankUrl || '');
        const ghChanged =
          typeof body?.githubUrl === 'string' &&
          body.githubUrl.trim() !== (sp?.githubUrl || '');
        return !lcChanged && !hrChanged && !ghChanged;
      }
      return false;
    },
    message: {
      error: 'Too many coding verification requests. Please wait a few minutes before retrying.',
    },
  });

  app.use('/api/auth', authRateLimiter);
  app.use('/api', apiRateLimiter);
  app.use(attachUser);

  // 0. Health check (production returns safe DB readiness 200/503; dev includes non-secret env config booleans)
  app.get(
    '/api/health',
    asyncHandler(async (_req: Request, res: Response) => {
      res.setHeader('Cache-Control', 'no-store');
      const dbReadiness = await checkDatabaseReadiness();
      const supabaseConfigured = isSupabaseConfigured();
      const initialAdminEmailConfigured = Boolean(getNormalizedInitialAdminEmail());
      if (process.env.NODE_ENV === 'production') {
        const allReady = dbReadiness.connected && supabaseConfigured;
        res.status(allReady ? 200 : 503).json({
          ok: allReady,
          status: allReady ? 'ok' : 'degraded',
          environment: 'production',
          supabaseConfigured,
          initialAdminEmailConfigured,
          database: dbReadiness,
        });
        return;
      }

      res.json({
        ok: dbReadiness.connected && supabaseConfigured,
        status: dbReadiness.connected && supabaseConfigured ? 'ok' : 'degraded',
        environment: process.env.NODE_ENV || 'development',
        databaseConfigured: Boolean(process.env.DATABASE_URL),
        supabaseUrlConfigured: Boolean(process.env.SUPABASE_URL),
        supabaseSecretConfigured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
        supabaseConfigured,
        initialAdminEmailConfigured,
        codingVerifySecretConfigured: Boolean(
          (process.env.CODING_VERIFY_HMAC_SECRET || '').trim()
        ),
        githubTokenConfigured: Boolean((process.env.GITHUB_TOKEN || '').trim()),
        database: dbReadiness,
      });
    })
  );

  // 1. Bootstrap portal data (public overview vs authenticated full portal)
  app.get(
    '/api/bootstrap',
    asyncHandler(async (req: AuthedRequest, res: Response) => {
      const db = requireDb();
      if (!req.userRecord) {
        const publicPayload = await getPublicBootstrapPayload(db);
        res.json(publicPayload);
        return;
      }
      const payload = await getAuthenticatedBootstrapPayload(db, req.userRecord.user, {
        viewerHasAdminPlacementAccess:
          req.userRecord.user.role === 'admin'
            ? hasAdminRecordPermission(req.userRecord, 'placements')
            : true,
      });
      res.json(payload);
    })
  );

  // 2a. Auth: Check Admin Setup Status & Current Caller Admin/SuperAdmin Recognition
  app.get(
    '/api/auth/admin-status',
    asyncHandler(async (req: AuthedRequest, res: Response) => {
      res.setHeader('Cache-Control', 'no-store');
      const db = requireDb();
      const [settings] = await db
        .select()
        .from(schema.portalSettings)
        .where(eq(schema.portalSettings.id, 1))
        .limit(1);

      let adminExists = Boolean(settings?.adminInitialized);
      if (!adminExists) {
        const [existingAdmin] = await db
          .select({ id: schema.users.id })
          .from(schema.users)
          .where(eq(schema.users.role, 'admin'))
          .limit(1);
        adminExists = Boolean(existingAdmin);
      }

      const viewer = req.userRecord;
      const isAdmin = Boolean(viewer && viewer.user.role === 'admin');
      const isSuperAdmin = Boolean(viewer && isSuperAdminRecord(viewer));
      const canCreateAdmins = Boolean(viewer && canManageAdminsRecord(viewer));

      res.json({
        initialized: adminExists,
        adminExists,
        superAdminConfigured: Boolean(getNormalizedInitialAdminEmail()) || adminExists,
        authenticated: Boolean(viewer),
        tokenStatus: req.authTokenStatus ?? 'none',
        role: viewer ? viewer.user.role : null,
        isAdmin,
        isSuperAdmin,
        canCreateAdmins,
      });
    })
  );

  // 2b. Auth: One-Time Admin Setup (Protected by server INITIAL_ADMIN_EMAIL + atomic DB lock)
  app.post(
    '/api/auth/admin-setup',
    asyncHandler(async (req: Request, res: Response) => {
      const db = requireDb();

      const allowedAdminEmail = getNormalizedInitialAdminEmail();
      if (!allowedAdminEmail) {
        res.status(403).json({
          error:
            'Administrator bootstrap is locked. Configure INITIAL_ADMIN_EMAIL in backend environment secrets to authorize initial setup.',
        });
        return;
      }

      const parsed = z
        .object({
          name: z.string().trim().min(1),
          memberId: z.string().trim().min(1),
          email: z.string().trim().email(),
          password: z.string().min(6),
          confirmPassword: z.string(),
        })
        .safeParse(req.body);

      if (!parsed.success) {
        res.status(400).json({
          error:
            'All fields (Admin Full Name, Admin ID, valid Email Address, Password min 6 chars, Confirm Password) are compulsory.',
        });
        return;
      }

      const cleanName = parsed.data.name;
      const cleanMemberId = parsed.data.memberId.toUpperCase();
      const cleanEmail = parsed.data.email.toLowerCase();
      const cleanPassword = parsed.data.password;

      if (cleanPassword !== parsed.data.confirmPassword) {
        res.status(400).json({ error: 'Password and Confirm Password do not match.' });
        return;
      }

      if (cleanEmail !== allowedAdminEmail) {
        res.status(403).json({
          error:
            'This email address is not authorized for initial administrator setup.',
        });
        return;
      }

      // Pre-check lock before creating Supabase Auth user
      const [settingsPre] = await db
        .select()
        .from(schema.portalSettings)
        .where(eq(schema.portalSettings.id, 1))
        .limit(1);

      const [existingAdminPre] = await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.role, 'admin'))
        .limit(1);

      if (settingsPre?.adminInitialized || existingAdminPre) {
        res.status(400).json({
          error: 'Admin account has already been initialized. Please use Admin Login.',
        });
        return;
      }

      const [dupUser] = await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(
          or(
            sql`lower(${schema.users.email}) = lower(${cleanEmail})`,
            sql`upper(${schema.users.memberId}) = upper(${cleanMemberId})`
          )
        )
        .limit(1);

      if (dupUser) {
        res.status(409).json({ error: 'An account with this email or Admin ID already exists.' });
        return;
      }

      const authResult = await createSupabaseAuthUser({
        email: cleanEmail,
        password: cleanPassword,
        role: 'admin',
        name: cleanName,
        memberId: cleanMemberId,
      });

      if ('error' in authResult) {
        res.status(authResult.status ?? 400).json({ error: authResult.error });
        return;
      }

      const newUserId = authResult.user.id;

      try {
        await db.transaction(async (tx) => {
          await tx
            .insert(schema.portalSettings)
            .values({ id: 1, adminInitialized: false })
            .onConflictDoNothing();

          const lockedRows = await tx.execute(
            sql`SELECT id, admin_initialized FROM public.portal_settings WHERE id = 1 FOR UPDATE`
          );
          const lockedRow = lockedRows[0] as { admin_initialized?: boolean } | undefined;
          if (lockedRow?.admin_initialized) {
            throw new Error('ADMIN_ALREADY_INITIALIZED');
          }

          const [adminCheck] = await tx
            .select({ id: schema.users.id })
            .from(schema.users)
            .where(eq(schema.users.role, 'admin'))
            .limit(1);
          if (adminCheck) {
            throw new Error('ADMIN_ALREADY_INITIALIZED');
          }

          await tx.insert(schema.users).values({
            id: newUserId,
            memberId: cleanMemberId,
            name: cleanName,
            email: cleanEmail,
            role: 'admin',
            department: 'Administration',
            batchOrDesignation: 'University Portal Administrator',
            phone: '',
            bio: 'Chief Administrator for Pragati University Portal.',
            skills: 'Portal Administration, Faculty Management, Security',
            isActive: true,
            canManageSpotlights: true,
          });

          await tx.insert(schema.adminProfiles).values({
            userId: newUserId,
            title: 'University Portal Administrator',
            createdBySystemSetup: true,
            isSuperAdmin: true,
            adminRoleLabel: 'Super Administrator',
            permStudents: true,
            permFaculty: true,
            permPlacements: true,
            permCodingVerification: true,
            permDashboardAnalytics: true,
            canCreateAdmins: true,
            createdByAdminId: null,
          });

          await tx
            .update(schema.portalSettings)
            .set({ adminInitialized: true })
            .where(eq(schema.portalSettings.id, 1));
        });
      } catch (err) {
        const authCleanup = await deleteSupabaseAuthUser(newUserId);
        if (authCleanup.error && !authCleanup.notFound) {
          console.error('[Admin Setup] Rollback Auth cleanup failed:', newUserId, authCleanup.error);
        }
        if (err instanceof Error && err.message === 'ADMIN_ALREADY_INITIALIZED') {
          res.status(400).json({
            error: 'Admin account has already been initialized. Please use Admin Login.',
          });
          return;
        }
        throw err;
      }

      const sessionResult = await signInSupabasePassword(cleanEmail, cleanPassword);
      if ('error' in sessionResult) {
        const status = sessionResult.unavailable ? 503 : 500;
        res.status(status).json({
          error: sessionResult.unavailable
            ? sessionResult.error
            : 'Admin created, but session initialization failed. Please log in.',
        });
        return;
      }

      const record = await getUserWithProfilesById(db, newUserId);
      const progress = await computeUserProgress(db, newUserId);
      res.status(201).json({
        token: sessionResult.accessToken,
        profile: toPublicProfile(record!, { includePhone: true }),
        progress,
        message: 'Admin account created and initialized successfully.',
      });
    })
  );

  // 2c. Auth: Admin Change Password
  app.post(
    '/api/auth/admin/change-password',
    requireAdmin,
    asyncHandler(async (req: AuthedRequest, res: Response) => {
      const user = req.userRecord!.user;
      const { currentPassword, newPassword, confirmPassword } = req.body as {
        currentPassword?: string;
        newPassword?: string;
        confirmPassword?: string;
      };

      const cleanCurrent = typeof currentPassword === 'string' ? currentPassword : '';
      const cleanNew = typeof newPassword === 'string' ? newPassword : '';
      const cleanConfirm = typeof confirmPassword === 'string' ? confirmPassword : '';

      if (!cleanCurrent || !cleanNew || !cleanConfirm) {
        res.status(400).json({
          error: 'Current Password, New Password, and Confirm New Password are all compulsory.',
        });
        return;
      }
      if (cleanNew.length < 6) {
        res.status(400).json({ error: 'New password must be at least 6 characters in length.' });
        return;
      }
      if (cleanNew !== cleanConfirm) {
        res.status(400).json({ error: 'New Password and Confirm New Password do not match.' });
        return;
      }
      if (cleanNew === cleanCurrent) {
        res.status(400).json({ error: 'New password must be different from your current password.' });
        return;
      }

      const verifyCurrent = await signInSupabasePassword(user.email, cleanCurrent);
      if ('error' in verifyCurrent) {
        if (verifyCurrent.unavailable) {
          res.status(503).json({ error: verifyCurrent.error });
          return;
        }
        res.status(401).json({ error: 'Incorrect current password. Please verify and try again.' });
        return;
      }

      const updated = await updateSupabaseAuthUser(user.id, { password: cleanNew });
      if (updated.error) {
        res.status(400).json({ error: updated.error });
        return;
      }

      res.json({ ok: true, message: 'Admin password changed successfully.' });
    })
  );

  // Shared student registration handler
  async function handleStudentRegistration(req: Request, res: Response): Promise<void> {
    const db = requireDb();
    const {
      name,
      memberId,
      email,
      department = 'Computer Science & Engineering (CSE)',
      year = '1st Year',
      section = 'A',
      password,
      confirmPassword,
    } = req.body as {
      name?: string;
      memberId?: string;
      email?: string;
      department?: string;
      year?: string;
      section?: string;
      password?: string;
      confirmPassword?: string;
    };

    const cleanName = typeof name === 'string' ? name.trim() : '';
    const cleanMemberId = typeof memberId === 'string' ? memberId.trim().toUpperCase() : '';
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const cleanDept = typeof department === 'string' ? department.trim() : '';
    const cleanYear = typeof year === 'string' ? year.trim() : '';
    const cleanSection = typeof section === 'string' ? section.trim().toUpperCase() : '';
    const cleanPassword = typeof password === 'string' ? password : '';
    const cleanConfirm =
      confirmPassword !== undefined
        ? typeof confirmPassword === 'string'
          ? confirmPassword
          : ''
        : cleanPassword;

    if (
      !cleanName ||
      !cleanMemberId ||
      !cleanEmail ||
      !cleanDept ||
      !cleanYear ||
      !cleanSection ||
      !cleanPassword
    ) {
      res.status(400).json({
        error:
          'All fields (Full Name, Student ID / Roll Number, Email, Department, Year, Section, Password, Confirm Password) are compulsory.',
      });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }
    if (cleanPassword.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters in length.' });
      return;
    }
    if (cleanPassword !== cleanConfirm) {
      res.status(400).json({ error: 'Password and Confirm Password do not match.' });
      return;
    }

    const [dupEmail] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(sql`lower(${schema.users.email}) = lower(${cleanEmail})`)
      .limit(1);
    if (dupEmail) {
      res.status(409).json({
        error: 'An account with this Email Address already exists. Please log in.',
      });
      return;
    }

    const [dupMember] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(sql`upper(${schema.users.memberId}) = upper(${cleanMemberId})`)
      .limit(1);
    if (dupMember) {
      res.status(409).json({
        error: 'An account with this Student ID / Roll Number already exists. Please log in.',
      });
      return;
    }

    const authResult = await createSupabaseAuthUser({
      email: cleanEmail,
      password: cleanPassword,
      role: 'student',
      name: cleanName,
      memberId: cleanMemberId,
    });
    if ('error' in authResult) {
      res.status(authResult.status ?? 400).json({ error: authResult.error });
      return;
    }

    const newUserId = authResult.user.id;
    try {
      await db.transaction(async (tx) => {
        await tx.insert(schema.users).values({
          id: newUserId,
          memberId: cleanMemberId,
          name: cleanName,
          email: cleanEmail,
          role: 'student',
          department: cleanDept,
          batchOrDesignation: `${cleanYear} B.Tech ${cleanDept} · Section ${cleanSection}`,
          phone: '',
          bio: `Student at Pragati University, ${cleanDept}.`,
          skills: '',
          isActive: true,
          canManageSpotlights: false,
        });

        await tx.insert(schema.studentProfiles).values({
          userId: newUserId,
          year: cleanYear,
          section: cleanSection,
          cgpa: '0.00',
        });
      });
    } catch (err) {
      const authCleanup = await deleteSupabaseAuthUser(newUserId);
      if (authCleanup.error && !authCleanup.notFound) {
        console.error('[Student Register] Rollback Auth cleanup failed:', newUserId, authCleanup.error);
      }
      if (isUniqueViolation(err)) {
        res.status(409).json({ error: 'Student Email or Student ID already exists.' });
        return;
      }
      throw err;
    }

    const sessionResult = await signInSupabasePassword(cleanEmail, cleanPassword);
    if ('error' in sessionResult) {
      const status = sessionResult.unavailable ? 503 : 500;
      res.status(status).json({
        error: sessionResult.unavailable
          ? sessionResult.error
          : 'Account created, but auto-login failed. Please sign in.',
      });
      return;
    }

    const record = await getUserWithProfilesById(db, newUserId);
    const progress = await computeUserProgress(db, newUserId);
    res.status(201).json({
      token: sessionResult.accessToken,
      profile: toPublicProfile(record!, { includePhone: true }),
      progress,
      message: 'Student account created successfully! Welcome to Pragati University Portal.',
    });
  }

  // 2d. Auth: Student Registration
  app.post('/api/auth/student-register', asyncHandler(handleStudentRegistration));

  // 2e. Auth: Generic Register (disallows public faculty/admin registration)
  app.post(
    '/api/auth/register',
    asyncHandler(async (req: Request, res: Response) => {
      const { role } = req.body as { role?: UserRole };
      if (role === 'faculty') {
        res.status(403).json({
          error:
            'Faculty accounts cannot be self-registered. Please contact the University Administrator to obtain your faculty credentials.',
        });
        return;
      }
      if (role === 'admin') {
        res.status(403).json({
          error:
            'Admin accounts cannot be registered publicly. If this is first-time setup, use the initial Admin setup flow.',
        });
        return;
      }
      await handleStudentRegistration(req, res);
    })
  );

  // 3. Auth: Login (Student, Faculty, Admin — supports Email or Member ID)
  app.post(
    '/api/auth/login',
    asyncHandler(async (req: Request, res: Response) => {
      const db = requireDb();
      const { identifier, password, role } = req.body as {
        identifier?: string;
        password?: string;
        role?: UserRole;
      };

      const cleanId = typeof identifier === 'string' ? identifier.trim() : '';
      const cleanPassword = typeof password === 'string' ? password : '';
      const expectedRole: UserRole =
        role === 'admin' ? 'admin' : role === 'faculty' ? 'faculty' : 'student';

      if (!cleanId || !cleanPassword) {
        res.status(400).json({ error: 'Please enter your ID / Email and password.' });
        return;
      }

      const userRow = await findUserByIdentifierAndRole(db, cleanId, expectedRole);
      if (!userRow) {
        if (expectedRole === 'faculty') {
          res.status(401).json({
            error:
              'No faculty account found with these credentials. Faculty accounts must be created by the University Administrator.',
          });
          return;
        }
        res.status(401).json({
          error: `No ${expectedRole} account matched those credentials. Please check your details or sign up.`,
        });
        return;
      }

      if (!userRow.isActive) {
        res.status(403).json({
          error:
            'Your account has been deactivated by the portal administrator. Please contact university admin.',
        });
        return;
      }

      const authResult = await signInSupabasePassword(userRow.email, cleanPassword);
      if ('error' in authResult) {
        if (authResult.unavailable) {
          res.status(503).json({ error: authResult.error });
          return;
        }
        res.status(401).json({ error: 'Invalid password. Please try again.' });
        return;
      }

      if (authResult.user.id !== userRow.id) {
        console.error(
          '[Auth Login] Supabase Auth user ID mismatch for role:',
          expectedRole
        );
        res.status(409).json({
          error:
            'Account identity record is out of sync between Authentication and Portal database. Please contact the Super Administrator.',
        });
        return;
      }

      const record = await getUserWithProfilesById(db, userRow.id);
      if (!record) {
        res.status(404).json({ error: 'User profile record could not be loaded.' });
        return;
      }
      const progress = await computeUserProgress(db, userRow.id);

      res.json({
        token: authResult.accessToken,
        profile: toPublicProfile(record, { includePhone: true }),
        progress,
      });
    })
  );

  // 3a. Admin Management: Analytics Overview & Multi-Admin Hierarchy
  app.get(
    '/api/admin/analytics',
    requireAdminModule('dashboard_analytics'),
    asyncHandler(async (_req: AuthedRequest, res: Response) => {
      const db = requireDb();
      const analytics = await getAdminAnalyticsSummary(db);
      res.json({ analytics });
    })
  );

  app.get(
    '/api/admin/admins',
    requireAdminManagementAuth,
    asyncHandler(async (_req: AuthedRequest, res: Response) => {
      const db = requireDb();
      const adminRows = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.role, 'admin'))
        .orderBy(desc(schema.users.createdAt));

      const adminProfiles = await getAdminProfilesListSafe(db);
      const profileMap = new Map(adminProfiles.map((p) => [p.userId, p]));

      const list = adminRows
        .map((u) =>
          toPublicProfile(
            {
              user: u,
              studentProfile: null,
              facultyProfile: null,
              adminProfile: profileMap.get(u.id) ?? null,
            },
            { includePhone: true }
          )
        )
        .sort((a, b) => Number(Boolean(b.isSuperAdmin)) - Number(Boolean(a.isSuperAdmin)));

      res.json({ admins: list });
    })
  );

  app.post(
    '/api/admin/admins',
    requireAdminManagementAuth,
    asyncHandler(async (req: AuthedRequest, res: Response) => {
      const db = requireDb();
      const actorRecord = req.userRecord!;
      const actorIsSuperAdmin = isSuperAdminRecord(actorRecord);

      const body = req.body as {
        name?: unknown;
        memberId?: unknown;
        email?: unknown;
        adminRoleLabel?: unknown;
        department?: unknown;
        phone?: unknown;
        password?: unknown;
        confirmPassword?: unknown;
        isSuperAdmin?: unknown;
        permissions?: {
          students?: unknown;
          faculty?: unknown;
          placements?: unknown;
          codingVerification?: unknown;
          dashboardAnalytics?: unknown;
          canCreateAdmins?: unknown;
        };
      };

      if (body.isSuperAdmin === true) {
        res.status(403).json({
          error: 'Newly created administrator accounts can never be elevated to Super Admin.',
        });
        return;
      }

      const cleanName = typeof body.name === 'string' ? body.name.trim() : '';
      const cleanEmail = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      const cleanRoleLabel =
        typeof body.adminRoleLabel === 'string' && body.adminRoleLabel.trim()
          ? body.adminRoleLabel.trim().slice(0, 120)
          : 'Department Admin';
      const cleanDept =
        typeof body.department === 'string' && body.department.trim()
          ? body.department.trim()
          : 'Administration';
      const cleanPhone = typeof body.phone === 'string' ? body.phone.trim() : '';
      const cleanPassword = typeof body.password === 'string' ? body.password : '';
      const cleanConfirm = typeof body.confirmPassword === 'string' ? body.confirmPassword : '';
      const rawMemberId =
        typeof body.memberId === 'string' ? body.memberId.trim().toUpperCase() : '';

      if (!cleanName || !cleanEmail || !cleanPassword || !cleanConfirm) {
        res.status(400).json({
          error:
            'Full Name, Email Address, Password, and Confirm Password are all compulsory.',
        });
        return;
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        res.status(400).json({ error: 'Please enter a valid email address.' });
        return;
      }
      if (cleanPassword.length < 6) {
        res.status(400).json({
          error: 'Administrator password must be at least 6 characters in length.',
        });
        return;
      }
      if (cleanPassword !== cleanConfirm) {
        res.status(400).json({ error: 'Password and Confirm Password do not match.' });
        return;
      }

      const requestedPerms = body.permissions ?? {};
      const wantsCanCreateAdmins = Boolean(requestedPerms.canCreateAdmins);
      if (wantsCanCreateAdmins && !actorIsSuperAdmin) {
        res.status(403).json({
          error:
            'Only the Super Admin can authorize another Administrator to create or manage admin accounts.',
        });
        return;
      }

      const permStudents = Boolean(requestedPerms.students);
      const permFaculty = Boolean(requestedPerms.faculty);
      const permPlacements = Boolean(requestedPerms.placements);
      const permCodingVerification = Boolean(requestedPerms.codingVerification);
      const permDashboardAnalytics = Boolean(requestedPerms.dashboardAnalytics);
      const canCreateAdmins = actorIsSuperAdmin ? wantsCanCreateAdmins : false;

      if (
        !permStudents &&
        !permFaculty &&
        !permPlacements &&
        !permCodingVerification &&
        !permDashboardAnalytics &&
        !canCreateAdmins
      ) {
        res.status(400).json({
          error: 'Please assign at least one module permission for this Administrator account.',
        });
        return;
      }

      const [dupEmail] = await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(sql`lower(${schema.users.email}) = lower(${cleanEmail})`)
        .limit(1);
      if (dupEmail) {
        res.status(409).json({
          error: 'A user account with this email address already exists.',
        });
        return;
      }

      const cleanMemberId = rawMemberId || (await generateUniqueAdminMemberId(db));
      if (rawMemberId) {
        const [dupMember] = await db
          .select({ id: schema.users.id })
          .from(schema.users)
          .where(sql`upper(${schema.users.memberId}) = upper(${cleanMemberId})`)
          .limit(1);
        if (dupMember) {
          res.status(409).json({
            error: 'A user account with this Admin ID already exists.',
          });
          return;
        }
      }

      const authResult = await createSupabaseAuthUser({
        email: cleanEmail,
        password: cleanPassword,
        role: 'admin',
        name: cleanName,
        memberId: cleanMemberId,
      });

      if ('error' in authResult) {
        res.status(authResult.status ?? 400).json({ error: authResult.error });
        return;
      }

      const newAdminId = authResult.user.id;
      try {
        await db.transaction(async (tx) => {
          await tx.insert(schema.users).values({
            id: newAdminId,
            memberId: cleanMemberId,
            name: cleanName,
            email: cleanEmail,
            role: 'admin',
            department: cleanDept,
            phone: cleanPhone,
            batchOrDesignation: cleanRoleLabel,
            bio: `${cleanRoleLabel} at Pragati University Portal.`,
            skills: 'Portal Administration',
            isActive: true,
            canManageSpotlights: permDashboardAnalytics,
          });

          await tx.insert(schema.adminProfiles).values({
            userId: newAdminId,
            title: cleanRoleLabel,
            createdBySystemSetup: false,
            isSuperAdmin: false,
            adminRoleLabel: cleanRoleLabel,
            permStudents,
            permFaculty,
            permPlacements,
            permCodingVerification,
            permDashboardAnalytics,
            canCreateAdmins,
            createdByAdminId: actorRecord.user.id,
          });
        });
      } catch (err) {
        const authCleanup = await deleteSupabaseAuthUser(newAdminId);
        if (authCleanup.error && !authCleanup.notFound) {
          console.error('[Create Admin] Rollback Auth cleanup failed:', newAdminId, authCleanup.error);
        }
        if (isUniqueViolation(err)) {
          res.status(409).json({ error: 'An administrator account with this email or ID already exists.' });
          return;
        }
        throw err;
      }

      const createdRecord = await getUserWithProfilesById(db, newAdminId);
      res.status(201).json({
        ok: true,
        message: `Administrator account created for ${cleanName} (${cleanMemberId}). They can log in immediately using ${cleanEmail}.`,
        admin: toPublicProfile(createdRecord!, { includePhone: true }),
      });
    })
  );

  app.put(
    '/api/admin/admins/:id',
    requireAdminManagementAuth,
    asyncHandler(async (req: AuthedRequest, res: Response) => {
      const id = parseUuidParam(req.params.id);
      if (!id) {
        res.status(404).json({ error: 'Administrator account not found.' });
        return;
      }

      const db = requireDb();
      const actorRecord = req.userRecord!;
      const actorIsSuperAdmin = isSuperAdminRecord(actorRecord);

      const existing = await getUserWithProfilesById(db, id);
      if (!existing || existing.user.role !== 'admin') {
        res.status(404).json({ error: 'Administrator account not found.' });
        return;
      }

      if (isSuperAdminRecord(existing)) {
        res.status(403).json({
          error:
            'Super Admin account is protected and cannot be modified, demoted, or deactivated from Admin Management.',
        });
        return;
      }

      const body = req.body as {
        name?: unknown;
        email?: unknown;
        adminRoleLabel?: unknown;
        department?: unknown;
        phone?: unknown;
        bio?: unknown;
        isSuperAdmin?: unknown;
        permissions?: {
          students?: unknown;
          faculty?: unknown;
          placements?: unknown;
          codingVerification?: unknown;
          dashboardAnalytics?: unknown;
          canCreateAdmins?: unknown;
        };
      };

      if (body.isSuperAdmin === true) {
        res.status(403).json({
          error: 'Super Admin privileges cannot be granted through admin management.',
        });
        return;
      }

      const nextName =
        typeof body.name === 'string' && body.name.trim() ? body.name.trim() : existing.user.name;
      const nextEmail =
        typeof body.email === 'string' && body.email.trim()
          ? body.email.trim().toLowerCase()
          : existing.user.email;
      const nextRoleLabel =
        typeof body.adminRoleLabel === 'string' && body.adminRoleLabel.trim()
          ? body.adminRoleLabel.trim().slice(0, 120)
          : existing.adminProfile?.adminRoleLabel || 'Department Admin';
      const nextDept =
        typeof body.department === 'string' ? body.department.trim() : existing.user.department;
      const nextPhone = typeof body.phone === 'string' ? body.phone.trim() : existing.user.phone;
      const nextBio = typeof body.bio === 'string' ? body.bio.trim() : existing.user.bio;

      const currentPerms = resolveAdminPermissions(existing);
      const nextPerms = {
        students:
          body.permissions?.students !== undefined
            ? Boolean(body.permissions.students)
            : currentPerms.students,
        faculty:
          body.permissions?.faculty !== undefined
            ? Boolean(body.permissions.faculty)
            : currentPerms.faculty,
        placements:
          body.permissions?.placements !== undefined
            ? Boolean(body.permissions.placements)
            : currentPerms.placements,
        codingVerification:
          body.permissions?.codingVerification !== undefined
            ? Boolean(body.permissions.codingVerification)
            : currentPerms.codingVerification,
        dashboardAnalytics:
          body.permissions?.dashboardAnalytics !== undefined
            ? Boolean(body.permissions.dashboardAnalytics)
            : currentPerms.dashboardAnalytics,
        canCreateAdmins: currentPerms.canCreateAdmins,
      };

      if (body.permissions?.canCreateAdmins !== undefined) {
        const requestedAdminMgmt = Boolean(body.permissions.canCreateAdmins);
        if (requestedAdminMgmt !== currentPerms.canCreateAdmins && !actorIsSuperAdmin) {
          res.status(403).json({
            error:
              'Only the Super Admin can grant or revoke Admin Management authorization.',
          });
          return;
        }
        if (actorIsSuperAdmin) {
          nextPerms.canCreateAdmins = requestedAdminMgmt;
        }
      }

      if (
        !nextPerms.students &&
        !nextPerms.faculty &&
        !nextPerms.placements &&
        !nextPerms.codingVerification &&
        !nextPerms.dashboardAnalytics &&
        !nextPerms.canCreateAdmins
      ) {
        res.status(400).json({
          error: 'An administrator must retain at least one assigned module permission (or deactivate instead).',
        });
        return;
      }

      const emailChanged = nextEmail !== existing.user.email;
      const nameChanged = nextName !== existing.user.name;

      if (emailChanged) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
          res.status(400).json({ error: 'Please enter a valid email address.' });
          return;
        }
        const [dupEmail] = await db
          .select({ id: schema.users.id })
          .from(schema.users)
          .where(
            and(
              sql`lower(${schema.users.email}) = lower(${nextEmail})`,
              sql`${schema.users.id} <> ${id}`
            )
          )
          .limit(1);
        if (dupEmail) {
          res.status(409).json({ error: 'Another user account already uses this email address.' });
          return;
        }
      }

      if (emailChanged || nameChanged) {
        const authUpdate = await updateSupabaseAuthUser(id, {
          ...(emailChanged ? { email: nextEmail } : {}),
          ...(nameChanged ? { name: nextName, memberId: existing.user.memberId } : {}),
        });
        if (authUpdate.error) {
          res.status(400).json({ error: authUpdate.error });
          return;
        }
      }

      try {
        await db.transaction(async (tx) => {
          await tx
            .update(schema.users)
            .set({
              name: nextName,
              email: nextEmail,
              department: nextDept,
              phone: nextPhone,
              bio: nextBio,
              batchOrDesignation: nextRoleLabel,
              canManageSpotlights: nextPerms.dashboardAnalytics,
            })
            .where(and(eq(schema.users.id, id), eq(schema.users.role, 'admin')));

          await tx
            .insert(schema.adminProfiles)
            .values({
              userId: id,
              title: nextRoleLabel,
              createdBySystemSetup: false,
              isSuperAdmin: false,
              adminRoleLabel: nextRoleLabel,
              permStudents: nextPerms.students,
              permFaculty: nextPerms.faculty,
              permPlacements: nextPerms.placements,
              permCodingVerification: nextPerms.codingVerification,
              permDashboardAnalytics: nextPerms.dashboardAnalytics,
              canCreateAdmins: nextPerms.canCreateAdmins,
              createdByAdminId: existing.adminProfile?.createdByAdminId ?? actorRecord.user.id,
            })
            .onConflictDoUpdate({
              target: schema.adminProfiles.userId,
              set: {
                title: nextRoleLabel,
                isSuperAdmin: false,
                adminRoleLabel: nextRoleLabel,
                permStudents: nextPerms.students,
                permFaculty: nextPerms.faculty,
                permPlacements: nextPerms.placements,
                permCodingVerification: nextPerms.codingVerification,
                permDashboardAnalytics: nextPerms.dashboardAnalytics,
                canCreateAdmins: nextPerms.canCreateAdmins,
              },
            });
        });
      } catch (err) {
        if (emailChanged || nameChanged) {
          await updateSupabaseAuthUser(id, {
            email: existing.user.email,
            name: existing.user.name,
            memberId: existing.user.memberId,
          });
        }
        if (isUniqueViolation(err)) {
          res.status(409).json({ error: 'Another user account already uses this email address.' });
          return;
        }
        throw err;
      }

      const updated = await getUserWithProfilesById(db, id);
      res.json({
        ok: true,
        message: `Updated administrator details and permissions for ${nextName}.`,
        admin: toPublicProfile(updated!, { includePhone: true }),
      });
    })
  );

  app.post(
    '/api/admin/admins/:id/change-password',
    requireAdminManagementAuth,
    asyncHandler(async (req: AuthedRequest, res: Response) => {
      const id = parseUuidParam(req.params.id);
      if (!id) {
        res.status(404).json({ error: 'Administrator account not found.' });
        return;
      }

      const db = requireDb();
      const target = await getUserWithProfilesById(db, id);
      if (!target || target.user.role !== 'admin') {
        res.status(404).json({ error: 'Administrator account not found.' });
        return;
      }

      if (isSuperAdminRecord(target)) {
        res.status(403).json({
          error: 'Super Admin password cannot be modified from Admin Management.',
        });
        return;
      }

      const { newPassword, confirmPassword } = req.body as {
        newPassword?: string;
        confirmPassword?: string;
      };
      const cleanNew = typeof newPassword === 'string' ? newPassword : '';
      const cleanConfirm = typeof confirmPassword === 'string' ? confirmPassword : '';

      if (!cleanNew || !cleanConfirm) {
        res.status(400).json({ error: 'Both New Password and Confirm Password are required.' });
        return;
      }
      if (cleanNew.length < 6) {
        res.status(400).json({ error: 'Password must be at least 6 characters in length.' });
        return;
      }
      if (cleanNew !== cleanConfirm) {
        res.status(400).json({ error: 'Passwords do not match.' });
        return;
      }

      const updated = await updateSupabaseAuthUser(target.user.id, { password: cleanNew });
      if (updated.error) {
        res.status(400).json({ error: updated.error });
        return;
      }

      res.json({
        ok: true,
        message: `Password updated successfully for administrator ${target.user.name}.`,
      });
    })
  );

  app.post(
    '/api/admin/admins/:id/toggle-status',
    requireAdminManagementAuth,
    asyncHandler(async (req: AuthedRequest, res: Response) => {
      const id = parseUuidParam(req.params.id);
      if (!id) {
        res.status(404).json({ error: 'Administrator account not found.' });
        return;
      }

      const actor = req.userRecord!.user;
      if (id === actor.id) {
        res.status(400).json({
          error: 'You cannot deactivate your own active administrator account.',
        });
        return;
      }

      const db = requireDb();
      const target = await getUserWithProfilesById(db, id);
      if (!target || target.user.role !== 'admin') {
        res.status(404).json({ error: 'Administrator account not found.' });
        return;
      }

      if (isSuperAdminRecord(target)) {
        res.status(403).json({
          error: 'Super Admin account is protected and cannot be deactivated.',
        });
        return;
      }

      const nextActive = !target.user.isActive;
      const authRes = await updateSupabaseAuthUser(id, { banned: !nextActive });
      if (authRes.error) {
        res.status(400).json({ error: authRes.error });
        return;
      }

      await db
        .update(schema.users)
        .set({ isActive: nextActive })
        .where(and(eq(schema.users.id, id), eq(schema.users.role, 'admin')));

      res.json({
        ok: true,
        isActive: nextActive,
        message: `Administrator account for ${target.user.name} has been ${
          nextActive ? 'activated' : 'deactivated'
        }.`,
      });
    })
  );

  app.delete(
    '/api/admin/admins/:id',
    requireAdminManagementAuth,
    asyncHandler(async (req: AuthedRequest, res: Response) => {
      const id = parseUuidParam(req.params.id);
      if (!id) {
        res.status(404).json({ error: 'Administrator account not found.' });
        return;
      }

      const actor = req.userRecord!.user;
      if (id === actor.id) {
        res.status(400).json({
          error: 'You cannot delete your own active administrator account.',
        });
        return;
      }

      const db = requireDb();
      const target = await getUserWithProfilesById(db, id);
      if (!target || target.user.role !== 'admin') {
        res.status(404).json({ error: 'Administrator account not found.' });
        return;
      }

      if (isSuperAdminRecord(target)) {
        res.status(403).json({
          error: 'Super Admin account is permanently protected and cannot be deleted.',
        });
        return;
      }

      const deletedUser = await db.transaction(async (tx) => {
        await tx.delete(schema.adminProfiles).where(eq(schema.adminProfiles.userId, id));
        const [removed] = await tx
          .delete(schema.users)
          .where(and(eq(schema.users.id, id), eq(schema.users.role, 'admin')))
          .returning({ id: schema.users.id, name: schema.users.name });
        return removed ?? null;
      });

      if (!deletedUser) {
        res.status(404).json({ error: 'Administrator account not found.' });
        return;
      }

      const authDeleteResult = await deleteSupabaseAuthUser(id);
      if (authDeleteResult.error && !authDeleteResult.notFound) {
        console.error('[Admin Delete Admin] Supabase Auth cleanup failed:', id, authDeleteResult.error);
        res.status(502).json({
          error: `Portal administrator records for ${deletedUser.name} were removed, but Supabase Auth cleanup failed: ${authDeleteResult.error}`,
          deletedUserId: deletedUser.id,
        });
        return;
      }

      res.json({
        ok: true,
        message: `Administrator account for ${deletedUser.name} has been revoked and removed.`,
        deletedUserId: deletedUser.id,
      });
    })
  );

  // 3b. Admin Management: Manage Faculty Endpoints
  app.get(
    '/api/admin/faculty',
    requireAdminModule('faculty'),
    asyncHandler(async (_req: AuthedRequest, res: Response) => {
      const db = requireDb();
      const facultyRows = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.role, 'faculty'))
        .orderBy(desc(schema.users.createdAt));

      const profiles = await db.select().from(schema.facultyProfiles);
      const profileMap = new Map(profiles.map((p) => [p.userId, p]));

      const list = facultyRows.map((u) =>
        toPublicProfile(
          {
            user: u,
            studentProfile: null,
            facultyProfile: profileMap.get(u.id) ?? null,
            adminProfile: null,
          },
          { includePhone: true }
        )
      );

      res.json({ faculty: list });
    })
  );

  app.post(
    '/api/admin/faculty',
    requireAdminModule('faculty'),
    asyncHandler(async (req: AuthedRequest, res: Response) => {
      const db = requireDb();
      const adminUser = req.userRecord!.user;

      const {
        name,
        memberId,
        email,
        department,
        designation,
        phone,
        password,
        confirmPassword,
      } = req.body as {
        name?: string;
        memberId?: string;
        email?: string;
        department?: string;
        designation?: string;
        phone?: string;
        password?: string;
        confirmPassword?: string;
      };

      const cleanName = typeof name === 'string' ? name.trim() : '';
      const cleanMemberId = typeof memberId === 'string' ? memberId.trim().toUpperCase() : '';
      const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
      const cleanDept = typeof department === 'string' ? department.trim() : '';
      const cleanDesignation = typeof designation === 'string' ? designation.trim() : '';
      const cleanPhone = typeof phone === 'string' ? phone.trim() : '';
      const cleanPassword = typeof password === 'string' ? password : '';
      const cleanConfirm = typeof confirmPassword === 'string' ? confirmPassword : '';

      if (
        !cleanName ||
        !cleanMemberId ||
        !cleanEmail ||
        !cleanDept ||
        !cleanDesignation ||
        !cleanPhone ||
        !cleanPassword ||
        !cleanConfirm
      ) {
        res.status(400).json({
          error:
            'All fields (Faculty Full Name, Faculty ID, Email Address, Department, Designation, Phone Number, Password, Confirm Password) are compulsory.',
        });
        return;
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        res.status(400).json({ error: 'Please enter a valid email address.' });
        return;
      }
      if (cleanPassword.length < 6) {
        res.status(400).json({
          error: 'Faculty password must be at least 6 characters in length.',
        });
        return;
      }
      if (cleanPassword !== cleanConfirm) {
        res.status(400).json({ error: 'Password and Confirm Password do not match.' });
        return;
      }

      const [dupEmail] = await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(sql`lower(${schema.users.email}) = lower(${cleanEmail})`)
        .limit(1);
      if (dupEmail) {
        res.status(409).json({
          error: 'A user account with this email address already exists.',
        });
        return;
      }

      const [dupMember] = await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(sql`upper(${schema.users.memberId}) = upper(${cleanMemberId})`)
        .limit(1);
      if (dupMember) {
        res.status(409).json({
          error: 'A user account with this Faculty ID already exists.',
        });
        return;
      }

      const authResult = await createSupabaseAuthUser({
        email: cleanEmail,
        password: cleanPassword,
        role: 'faculty',
        name: cleanName,
        memberId: cleanMemberId,
      });

      if ('error' in authResult) {
        res.status(authResult.status ?? 400).json({ error: authResult.error });
        return;
      }

      const newFacultyId = authResult.user.id;
      try {
        await db.transaction(async (tx) => {
          await tx.insert(schema.users).values({
            id: newFacultyId,
            memberId: cleanMemberId,
            name: cleanName,
            email: cleanEmail,
            role: 'faculty',
            department: cleanDept,
            phone: cleanPhone,
            batchOrDesignation: `${cleanDesignation}, ${cleanDept}`,
            bio: `${cleanDesignation} in ${cleanDept} at Pragati University.`,
            skills: cleanDept,
            isActive: true,
            canManageSpotlights: true,
          });

          await tx.insert(schema.facultyProfiles).values({
            userId: newFacultyId,
            designation: cleanDesignation,
            specialization: cleanDept,
            qualification: 'M.Tech / Ph.D',
            experienceYears: 5,
            phoneOrCabin: cleanPhone,
          });

          const [existingDir] = await tx
            .select()
            .from(schema.facultyDirectory)
            .where(sql`lower(${schema.facultyDirectory.email}) = lower(${cleanEmail})`)
            .limit(1);

          if (!existingDir) {
            await tx.insert(schema.facultyDirectory).values({
              linkedUserId: newFacultyId,
              name: cleanName,
              designation: cleanDesignation,
              specialization: cleanDept,
              email: cleanEmail,
              phoneOrCabin: cleanPhone,
              qualification: 'M.Tech / Ph.D',
              experienceYears: 5,
              bio: `${cleanDesignation} in ${cleanDept}`,
              authorId: adminUser.id,
            });
          } else if (existingDir.linkedUserId === null) {
            await tx
              .update(schema.facultyDirectory)
              .set({
                linkedUserId: newFacultyId,
                authorId: newFacultyId,
                name: cleanName,
                designation: cleanDesignation,
                specialization: cleanDept,
                phoneOrCabin: cleanPhone,
              })
              .where(eq(schema.facultyDirectory.id, existingDir.id));
          } else {
            throw new Error('FACULTY_DIRECTORY_EMAIL_CONFLICT');
          }
        });
      } catch (err) {
        const authCleanup = await deleteSupabaseAuthUser(newFacultyId);
        if (authCleanup.error && !authCleanup.notFound) {
          console.error('[Admin Create Faculty] Rollback Auth cleanup failed:', newFacultyId, authCleanup.error);
        }
        if (err instanceof Error && err.message === 'FACULTY_DIRECTORY_EMAIL_CONFLICT') {
          res.status(409).json({
            error: 'A faculty directory profile linked to another account already uses this email.',
          });
          return;
        }
        if (isUniqueViolation(err)) {
          res.status(409).json({ error: 'Faculty account with this email or ID already exists.' });
          return;
        }
        throw err;
      }

      const record = await getUserWithProfilesById(db, newFacultyId);
      res.status(201).json({
        ok: true,
        message: `Faculty account created successfully for ${cleanName} (${cleanMemberId}).`,
        faculty: toPublicProfile(record!, { includePhone: true }),
      });
    })
  );

  app.put(
    '/api/admin/faculty/:id',
    requireAdminModule('faculty'),
    asyncHandler(async (req: AuthedRequest, res: Response) => {
      const id = parseUuidParam(req.params.id);
      if (!id) {
        res.status(404).json({ error: 'Faculty account not found.' });
        return;
      }

      const db = requireDb();
      const existing = await getUserWithProfilesById(db, id);
      if (!existing || existing.user.role !== 'faculty') {
        res.status(404).json({ error: 'Faculty account not found.' });
        return;
      }

      const {
        name,
        email,
        department,
        designation,
        phone,
        bio,
        skills,
        qualification,
        experienceYears,
      } = req.body as {
        name?: string;
        email?: string;
        department?: string;
        designation?: string;
        phone?: string;
        bio?: string;
        skills?: string;
        qualification?: string;
        experienceYears?: number;
      };

      const nextName =
        typeof name === 'string' && name.trim() ? name.trim() : existing.user.name;
      const nextEmail =
        typeof email === 'string' && email.trim()
          ? email.trim().toLowerCase()
          : existing.user.email;
      const nextDept =
        typeof department === 'string' ? department.trim() : existing.user.department;
      if (phone !== undefined && typeof phone !== 'string') {
        res.status(400).json({ error: 'Phone must be a valid text string.' });
        return;
      }
      if (qualification !== undefined && typeof qualification !== 'string') {
        res.status(400).json({ error: 'Qualification must be a valid text string.' });
        return;
      }
      if (bio !== undefined && typeof bio !== 'string') {
        res.status(400).json({ error: 'Bio must be a valid text string.' });
        return;
      }
      if (skills !== undefined && typeof skills !== 'string') {
        res.status(400).json({ error: 'Skills must be a valid text string.' });
        return;
      }
      const nextPhone = typeof phone === 'string' ? phone.trim() : existing.user.phone;
      const nextDesignation =
        typeof designation === 'string' && designation.trim()
          ? designation.trim()
          : existing.facultyProfile?.designation ||
            existing.user.batchOrDesignation.split(',')[0] ||
            'Faculty';
      const nextSpecialization =
        nextDept || existing.facultyProfile?.specialization || 'CSE';
      const nextQualification =
        typeof qualification === 'string'
          ? qualification.trim()
          : existing.facultyProfile?.qualification || 'M.Tech / Ph.D';
      const nextExperienceYears =
        experienceYears !== undefined
          ? Math.max(0, Math.min(60, Number(experienceYears) || 0))
          : existing.facultyProfile?.experienceYears ?? 5;
      const nextBio = typeof bio === 'string' ? bio.trim() : existing.user.bio;
      const nextSkills = typeof skills === 'string' ? skills.trim() : existing.user.skills;
      const nextBatchOrDesignation =
        designation !== undefined || department !== undefined
          ? `${nextDesignation}, ${nextDept || 'CSE'}`
          : existing.user.batchOrDesignation;

      if (nextEmail !== existing.user.email) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
          res.status(400).json({ error: 'Please enter a valid email address.' });
          return;
        }
        const [dupEmail] = await db
          .select({ id: schema.users.id })
          .from(schema.users)
          .where(
            and(
              sql`lower(${schema.users.email}) = lower(${nextEmail})`,
              sql`${schema.users.id} <> ${id}`
            )
          )
          .limit(1);
        if (dupEmail) {
          res.status(409).json({ error: 'Another user account already uses this email address.' });
          return;
        }
        const authUpdate = await updateSupabaseAuthUser(id, {
          email: nextEmail,
          name: nextName,
          memberId: existing.user.memberId,
        });
        if (authUpdate.error) {
          res.status(400).json({ error: authUpdate.error });
          return;
        }
      } else if (nextName !== existing.user.name) {
        const authUpdate = await updateSupabaseAuthUser(id, {
          name: nextName,
          memberId: existing.user.memberId,
        });
        if (authUpdate.error) {
          res.status(400).json({ error: authUpdate.error });
          return;
        }
      }

      try {
        await db.transaction(async (tx) => {
          await tx
            .update(schema.users)
            .set({
              name: nextName,
              email: nextEmail,
              department: nextDept,
              phone: nextPhone,
              bio: nextBio,
              skills: nextSkills,
              batchOrDesignation: nextBatchOrDesignation,
            })
            .where(eq(schema.users.id, id));

          await tx
            .insert(schema.facultyProfiles)
            .values({
              userId: id,
              designation: nextDesignation,
              specialization: nextSpecialization,
              qualification: nextQualification,
              experienceYears: nextExperienceYears,
              phoneOrCabin: nextPhone,
            })
            .onConflictDoUpdate({
              target: schema.facultyProfiles.userId,
              set: {
                designation: nextDesignation,
                specialization: nextSpecialization,
                qualification: nextQualification,
                experienceYears: nextExperienceYears,
                phoneOrCabin: nextPhone,
              },
            });

          await tx
            .update(schema.facultyDirectory)
            .set({
              name: nextName,
              email: nextEmail,
              designation: nextDesignation,
              specialization: nextSpecialization,
              phoneOrCabin: nextPhone,
              qualification: nextQualification,
              experienceYears: nextExperienceYears,
              bio: nextBio,
            })
            .where(eq(schema.facultyDirectory.linkedUserId, id));
        });
      } catch (err) {
        if (nextEmail !== existing.user.email || nextName !== existing.user.name) {
          await updateSupabaseAuthUser(id, {
            email: existing.user.email,
            name: existing.user.name,
            memberId: existing.user.memberId,
          });
        }
        if (isUniqueViolation(err)) {
          res.status(409).json({ error: 'Another user or faculty profile already uses this email.' });
          return;
        }
        throw err;
      }

      const updated = await getUserWithProfilesById(db, id);
      res.json({
        ok: true,
        faculty: toPublicProfile(updated!, { includePhone: true }),
      });
    })
  );

  app.post(
    '/api/admin/faculty/:id/change-password',
    requireAdminModule('faculty'),
    asyncHandler(async (req: AuthedRequest, res: Response) => {
      const id = parseUuidParam(req.params.id);
      if (!id) {
        res.status(404).json({ error: 'Faculty account not found.' });
        return;
      }

      const db = requireDb();
      const [target] = await db
        .select()
        .from(schema.users)
        .where(and(eq(schema.users.id, id), eq(schema.users.role, 'faculty')))
        .limit(1);

      if (!target) {
        res.status(404).json({ error: 'Faculty account not found.' });
        return;
      }

      const { newPassword, confirmPassword } = req.body as {
        newPassword?: string;
        confirmPassword?: string;
      };
      const cleanNew = typeof newPassword === 'string' ? newPassword : '';
      const cleanConfirm = typeof confirmPassword === 'string' ? confirmPassword : '';

      if (!cleanNew || !cleanConfirm) {
        res.status(400).json({ error: 'Both New Password and Confirm Password are required.' });
        return;
      }
      if (cleanNew.length < 6) {
        res.status(400).json({ error: 'Password must be at least 6 characters in length.' });
        return;
      }
      if (cleanNew !== cleanConfirm) {
        res.status(400).json({ error: 'Passwords do not match.' });
        return;
      }

      const updated = await updateSupabaseAuthUser(target.id, { password: cleanNew });
      if (updated.error) {
        res.status(400).json({ error: updated.error });
        return;
      }

      res.json({ ok: true, message: `Password updated successfully for ${target.name}.` });
    })
  );

  app.post(
    '/api/admin/faculty/:id/toggle-status',
    requireAdminModule('faculty'),
    asyncHandler(async (req: AuthedRequest, res: Response) => {
      const id = parseUuidParam(req.params.id);
      if (!id) {
        res.status(404).json({ error: 'Faculty account not found.' });
        return;
      }

      const db = requireDb();
      const [target] = await db
        .select()
        .from(schema.users)
        .where(and(eq(schema.users.id, id), eq(schema.users.role, 'faculty')))
        .limit(1);

      if (!target) {
        res.status(404).json({ error: 'Faculty account not found.' });
        return;
      }

      const nextActive = !target.isActive;
      await db
        .update(schema.users)
        .set({ isActive: nextActive })
        .where(eq(schema.users.id, id));

      await updateSupabaseAuthUser(id, { banned: !nextActive });

      res.json({
        ok: true,
        isActive: nextActive,
        message: `Faculty account ${nextActive ? 'activated' : 'deactivated'} successfully.`,
      });
    })
  );

  app.delete(
    '/api/admin/faculty/:id',
    requireAdminModule('faculty'),
    asyncHandler(async (req: AuthedRequest, res: Response) => {
      const id = parseUuidParam(req.params.id);
      if (!id) {
        res.status(404).json({ error: 'Faculty account not found.' });
        return;
      }

      const db = requireDb();

      const deletionResult = await db.transaction(async (tx) => {
        const [target] = await tx
          .select({
            id: schema.users.id,
            name: schema.users.name,
            role: schema.users.role,
          })
          .from(schema.users)
          .where(and(eq(schema.users.id, id), eq(schema.users.role, 'faculty')))
          .limit(1);

        if (!target) {
          return null;
        }

        const deletedDirRows = await tx
          .delete(schema.facultyDirectory)
          .where(eq(schema.facultyDirectory.linkedUserId, id))
          .returning({ id: schema.facultyDirectory.id });

        const deletedProfileRows = await tx
          .delete(schema.facultyProfiles)
          .where(eq(schema.facultyProfiles.userId, id))
          .returning({ userId: schema.facultyProfiles.userId });

        const deletedUserRows = await tx
          .delete(schema.users)
          .where(and(eq(schema.users.id, id), eq(schema.users.role, 'faculty')))
          .returning({ id: schema.users.id, name: schema.users.name });

        if (deletedUserRows.length === 0) {
          return null;
        }

        return {
          deletedUser: deletedUserRows[0],
          deletedDirectoryIds: deletedDirRows.map((row) => row.id),
          deletedProfileCount: deletedProfileRows.length,
        };
      });

      if (!deletionResult) {
        res.status(404).json({ error: 'Faculty account not found.' });
        return;
      }

      const authDeleteResult = await deleteSupabaseAuthUser(id);
      if (authDeleteResult.error && !authDeleteResult.notFound) {
        console.error(
          '[Admin Delete Faculty] Supabase Auth cleanup failed for user:',
          id,
          authDeleteResult.error
        );
        res.status(502).json({
          error: `Portal account records for ${deletionResult.deletedUser.name} were deleted, but Supabase Auth cleanup failed: ${authDeleteResult.error}`,
          deletedUserId: deletionResult.deletedUser.id,
          deletedDirectoryIds: deletionResult.deletedDirectoryIds,
        });
        return;
      }

      res.json({
        ok: true,
        message: `Faculty account for ${deletionResult.deletedUser.name} has been removed.`,
        deletedUserId: deletionResult.deletedUser.id,
        deletedDirectoryIds: deletionResult.deletedDirectoryIds,
      });
    })
  );

  app.get(
    '/api/admin/students',
    requireAdminModule('students'),
    asyncHandler(async (_req: AuthedRequest, res: Response) => {
      const db = requireDb();
      const rows = await db
        .select({
          user: schema.users,
          studentProfile: schema.studentProfiles,
        })
        .from(schema.users)
        .leftJoin(schema.studentProfiles, eq(schema.users.id, schema.studentProfiles.userId))
        .where(eq(schema.users.role, 'student'))
        .orderBy(desc(schema.users.createdAt));

      const students = rows.map((r) =>
        toPublicProfile(
          {
            user: r.user,
            studentProfile: r.studentProfile,
            facultyProfile: null,
            adminProfile: null,
          },
          { includePhone: true }
        )
      );

      res.json({ students });
    })
  );

  async function handleStaffStudentUpdate(req: AuthedRequest, res: Response): Promise<void> {
    const actor = req.userRecord!.user;
    if (actor.role !== 'faculty' && actor.role !== 'admin') {
      res.status(403).json({
        error: 'Only Faculty or Administrator accounts can update student profiles.',
      });
      return;
    }
    if (actor.role === 'admin' && !hasAdminRecordPermission(req.userRecord, 'students')) {
      res.status(403).json({
        error: "Access denied: Requires 'Students' administrator permission.",
      });
      return;
    }

    const id = parseUuidParam(req.params.id);
    if (!id) {
      res.status(404).json({ error: 'Student account not found.' });
      return;
    }

    const db = requireDb();
    const existing = await getUserWithProfilesById(db, id);
    if (!existing || existing.user.role !== 'student') {
      res.status(404).json({ error: 'Student account not found.' });
      return;
    }

    const {
      name,
      email,
      department,
      year,
      section,
      phone,
      cgpa,
      skills,
      bio,
      batchOrDesignation,
      isActive,
    } = req.body as {
      name?: string;
      email?: string;
      department?: string;
      year?: string;
      section?: string;
      phone?: string;
      cgpa?: number;
      skills?: string;
      bio?: string;
      batchOrDesignation?: string;
      isActive?: boolean;
    };

    const nextEmail =
      typeof email === 'string' && email.trim()
        ? email.trim().toLowerCase()
        : existing.user.email;
    const nextIsActive =
      typeof isActive === 'boolean' ? isActive : existing.user.isActive;

    if (
      actor.role !== 'admin' &&
      (nextEmail !== existing.user.email || nextIsActive !== existing.user.isActive)
    ) {
      res.status(403).json({
        error: 'Only an Administrator can modify a student login email or account status.',
      });
      return;
    }

    if (typeof name === 'string' && !name.trim()) {
      res.status(400).json({ error: 'Student full name cannot be empty.' });
      return;
    }
    for (const [fieldVal, label] of [
      [department, 'Department'],
      [year, 'Year'],
      [section, 'Section'],
      [phone, 'Phone'],
      [bio, 'Bio'],
      [skills, 'Skills'],
    ] as Array<[unknown, string]>) {
      if (fieldVal !== undefined && typeof fieldVal !== 'string') {
        res.status(400).json({ error: `${label} must be a valid text string.` });
        return;
      }
    }

    const nextName =
      typeof name === 'string' && name.trim() ? name.trim() : existing.user.name;
    const nextDept =
      typeof department === 'string' ? department.trim() : existing.user.department;
    const nextYear =
      typeof year === 'string' ? year.trim() : existing.studentProfile?.year || '';
    const nextSection =
      typeof section === 'string'
        ? section.trim().toUpperCase()
        : existing.studentProfile?.section || '';
    const nextPhone = typeof phone === 'string' ? phone.trim() : existing.user.phone;
    const nextBio = typeof bio === 'string' ? bio.trim() : existing.user.bio;
    const nextSkills = typeof skills === 'string' ? skills.trim() : existing.user.skills;
    const nextCgpaNum =
      cgpa !== undefined
        ? Math.max(0, Math.min(10, Number(cgpa) || 0))
        : existing.studentProfile
        ? Number(existing.studentProfile.cgpa)
        : 0;

    let nextBatch = existing.user.batchOrDesignation;
    if (typeof batchOrDesignation === 'string' && batchOrDesignation.trim()) {
      nextBatch = batchOrDesignation.trim();
    } else if (
      year !== undefined ||
      section !== undefined ||
      department !== undefined
    ) {
      const deptLabel = nextDept || 'CSE';
      nextBatch = nextYear
        ? `${nextYear} B.Tech ${deptLabel}${nextSection ? ` · Section ${nextSection}` : ''}`
        : deptLabel;
    }

    const emailChanged = nextEmail !== existing.user.email;
    const nameChanged = nextName !== existing.user.name;
    const activeChanged = nextIsActive !== existing.user.isActive;

    if (emailChanged) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
        res.status(400).json({ error: 'Please enter a valid email address.' });
        return;
      }
      const [dupEmail] = await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(
          and(
            sql`lower(${schema.users.email}) = lower(${nextEmail})`,
            sql`${schema.users.id} <> ${id}`
          )
        )
        .limit(1);
      if (dupEmail) {
        res.status(409).json({ error: 'Another user account already uses this email address.' });
        return;
      }
    }

    if (emailChanged || nameChanged || activeChanged) {
      const authUpdate = await updateSupabaseAuthUser(id, {
        ...(emailChanged ? { email: nextEmail } : {}),
        ...(nameChanged ? { name: nextName, memberId: existing.user.memberId } : {}),
        ...(activeChanged ? { banned: !nextIsActive } : {}),
      });
      if (authUpdate.error) {
        res.status(400).json({ error: authUpdate.error });
        return;
      }
    }

    try {
      await db.transaction(async (tx) => {
        await tx
          .update(schema.users)
          .set({
            name: nextName,
            email: nextEmail,
            department: nextDept,
            phone: nextPhone,
            bio: nextBio,
            skills: nextSkills,
            batchOrDesignation: nextBatch,
            isActive: nextIsActive,
          })
          .where(and(eq(schema.users.id, id), eq(schema.users.role, 'student')));

        await tx
          .insert(schema.studentProfiles)
          .values({
            userId: id,
            year: nextYear,
            section: nextSection,
            cgpa: nextCgpaNum.toFixed(2),
          })
          .onConflictDoUpdate({
            target: schema.studentProfiles.userId,
            set: {
              year: nextYear,
              section: nextSection,
              cgpa: nextCgpaNum.toFixed(2),
            },
          });
      });
    } catch (err) {
      if (emailChanged || nameChanged || activeChanged) {
        await updateSupabaseAuthUser(id, {
          email: existing.user.email,
          name: existing.user.name,
          memberId: existing.user.memberId,
          banned: !existing.user.isActive,
        });
      }
      if (isUniqueViolation(err)) {
        res.status(409).json({ error: 'Another user account already uses this email address.' });
        return;
      }
      throw err;
    }

    const updatedRecord = await getUserWithProfilesById(db, id);
    res.json({
      ok: true,
      student: toPublicProfile(updatedRecord!, { includePhone: true }),
    });
  }

  app.put(
    '/api/admin/students/:id',
    requireAdminModule('students'),
    asyncHandler(async (req: AuthedRequest, res: Response) => {
      await handleStaffStudentUpdate(req, res);
    })
  );

  app.put(
    '/api/students/:id',
    requireAuth,
    asyncHandler(async (req: AuthedRequest, res: Response) => {
      await handleStaffStudentUpdate(req, res);
    })
  );

  app.post(
    '/api/students/:id/verify-coding-owner',
    requireAuth,
    asyncHandler(async (req: AuthedRequest, res: Response) => {
      const actor = req.userRecord!.user;
      if (actor.role !== 'faculty' && actor.role !== 'admin') {
        res.status(403).json({
          error: 'Only Faculty or Administrator coordinators can verify coding handle ownership.',
        });
        return;
      }
      if (
        actor.role === 'admin' &&
        !hasAdminRecordPermission(req.userRecord, 'coding_verification')
      ) {
        res.status(403).json({
          error: "Access denied: Requires 'Coding & Verification' administrator permission.",
        });
        return;
      }

      const id = parseUuidParam(req.params.id);
      if (!id) {
        res.status(404).json({ error: 'Student account not found.' });
        return;
      }

      const { platform, verified } = req.body as {
        platform?: unknown;
        verified?: unknown;
      };
      if (platform !== 'leetcode' && platform !== 'hackerrank' && platform !== 'github') {
        res.status(400).json({ error: 'Platform must be leetcode, hackerrank, or github.' });
        return;
      }
      if (typeof verified !== 'boolean') {
        res.status(400).json({ error: 'Verified status must be a boolean.' });
        return;
      }

      const db = requireDb();
      const existing = await getUserWithProfilesById(db, id);
      if (!existing || existing.user.role !== 'student') {
        res.status(404).json({ error: 'Student account not found.' });
        return;
      }

      const sp = existing.studentProfile;
      const handleForPlatform =
        platform === 'leetcode'
          ? sp?.leetcodeUsername || ''
          : platform === 'hackerrank'
          ? sp?.hackerrankUsername || ''
          : sp?.githubUsername || '';

      if (verified && !handleForPlatform) {
        res.status(400).json({
          error: `Student has not linked a valid ${platform} handle yet.`,
        });
        return;
      }

      const nextTimestamp = verified ? new Date() : null;
      const updateFields: Partial<typeof schema.studentProfiles.$inferInsert> =
        platform === 'leetcode'
          ? { leetcodeOwnerVerifiedAt: nextTimestamp }
          : platform === 'hackerrank'
          ? { hackerrankOwnerVerifiedAt: nextTimestamp }
          : { githubOwnerVerifiedAt: nextTimestamp };

      await db
        .update(schema.studentProfiles)
        .set(updateFields)
        .where(eq(schema.studentProfiles.userId, id));

      const updatedRecord = await getUserWithProfilesById(db, id);
      res.json({
        ok: true,
        student: toPublicProfile(updatedRecord!, { includePhone: true }),
      });
    })
  );

  // 4. Auth: Logout
  app.post(
    '/api/auth/logout',
    asyncHandler(async (req: AuthedRequest, res: Response) => {
      const token = extractBearerToken(req);
      if (token) {
        await signOutSupabaseJwt(token);
      }
      res.json({ ok: true });
    })
  );

  // 5. Auth: Individual My Profile
  app.get(
    '/api/auth/me',
    requireAuth,
    asyncHandler(async (req: AuthedRequest, res: Response) => {
      const db = requireDb();
      const record = req.userRecord!;
      const progress = await computeUserProgress(db, record.user.id);
      res.json({
        profile: toPublicProfile(record, { includePhone: true }),
        progress,
      });
    })
  );

  // Legacy PIN-based endpoints permanently disabled
  app.get('/api/auth/staff-accounts', (_req: Request, res: Response) => {
    res.status(410).json({ error: 'Legacy staff account directory disabled. Please use role-based login.' });
  });
  app.post('/api/auth/staff-login', (_req: Request, res: Response) => {
    res.status(410).json({ error: 'Legacy PIN login disabled. Please sign in with your registered credentials.' });
  });
  app.post('/api/auth/setup-admin-pin', (_req: Request, res: Response) => {
    res.status(410).json({ error: 'Legacy PIN setup disabled. Please use Admin Login / One-Time Setup.' });
  });
  app.post('/api/auth/add-coordinator', (_req: Request, res: Response) => {
    res.status(410).json({ error: 'Legacy endpoint disabled. Manage faculty from the Admin Dashboard.' });
  });
  app.post('/api/auth/remove-coordinator', (_req: Request, res: Response) => {
    res.status(410).json({ error: 'Legacy endpoint disabled. Manage faculty from the Admin Dashboard.' });
  });

  // 6. Update My Profile & Sync Coding Links
  app.put(
    '/api/profile',
    requireAuth,
    codingVerificationRateLimiter,
    asyncHandler(async (req: AuthedRequest, res: Response) => {
      const db = requireDb();
      const record = req.userRecord!;
      const user = record.user;
      const sp = record.studentProfile;
      const fp = record.facultyProfile;
      const ap = record.adminProfile;

      const {
        name,
        email,
        department,
        phone,
        batchOrDesignation,
        year,
        section,
        cgpa,
        designation,
        specialization,
        qualification,
        experienceYears,
        bio,
        skills,
        leetcodeUrl,
        hackerrankUrl,
        githubUrl,
        syncCodingLinks,
      } = req.body as {
        name?: string;
        email?: string;
        department?: string;
        phone?: string;
        batchOrDesignation?: string;
        year?: unknown;
        section?: unknown;
        cgpa?: unknown;
        designation?: string;
        specialization?: string;
        qualification?: string;
        experienceYears?: number;
        bio?: string;
        skills?: string;
        leetcodeUrl?: unknown;
        hackerrankUrl?: unknown;
        githubUrl?: unknown;
        syncCodingLinks?: boolean;
      };

      if (typeof name === 'string' && !name.trim()) {
        res.status(400).json({ error: 'Full Name cannot be empty.' });
        return;
      }

      const nextName = typeof name === 'string' && name.trim() ? name.trim() : user.name;
      const nextDept =
        typeof department === 'string' ? department.trim() : user.department;
      const nextPhone = typeof phone === 'string' ? phone.trim() : user.phone;
      const nextBio = typeof bio === 'string' ? bio.trim() : user.bio;
      const nextSkills = typeof skills === 'string' ? skills.trim() : user.skills;

      let nextEmail = user.email;
      if (typeof email === 'string' && email.trim() && email.trim().toLowerCase() !== user.email) {
        if (user.role !== 'admin') {
          res.status(403).json({
            error: 'Only Administrators can change their own login email from profile settings.',
          });
          return;
        }
        nextEmail = email.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
          res.status(400).json({ error: 'Please enter a valid email address.' });
          return;
        }
        const [dupEmail] = await db
          .select({ id: schema.users.id })
          .from(schema.users)
          .where(
            and(
              sql`lower(${schema.users.email}) = lower(${nextEmail})`,
              sql`${schema.users.id} <> ${user.id}`
            )
          )
          .limit(1);
        if (dupEmail) {
          res.status(409).json({ error: 'Another account already uses this email address.' });
          return;
        }
      }

      if (year !== undefined && typeof year !== 'string') {
        res.status(400).json({ error: 'Year must be a valid text string.' });
        return;
      }
      if (section !== undefined && typeof section !== 'string') {
        res.status(400).json({ error: 'Section must be a valid text string.' });
        return;
      }
      if (leetcodeUrl !== undefined && typeof leetcodeUrl !== 'string') {
        res.status(400).json({ error: 'LeetCode URL must be a valid text string.' });
        return;
      }
      if (hackerrankUrl !== undefined && typeof hackerrankUrl !== 'string') {
        res.status(400).json({ error: 'HackerRank URL must be a valid text string.' });
        return;
      }
      if (githubUrl !== undefined && typeof githubUrl !== 'string') {
        res.status(400).json({ error: 'GitHub URL must be a valid text string.' });
        return;
      }
      if (specialization !== undefined && typeof specialization !== 'string') {
        res.status(400).json({ error: 'Specialization must be a valid text string.' });
        return;
      }
      if (qualification !== undefined && typeof qualification !== 'string') {
        res.status(400).json({ error: 'Qualification must be a valid text string.' });
        return;
      }
      if (designation !== undefined && typeof designation !== 'string') {
        res.status(400).json({ error: 'Designation must be a valid text string.' });
        return;
      }
      if (batchOrDesignation !== undefined && typeof batchOrDesignation !== 'string') {
        res.status(400).json({ error: 'Batch or designation must be a valid text string.' });
        return;
      }

      const nextYear = typeof year === 'string' ? year.trim() : sp?.year || '';
      const nextSection =
        typeof section === 'string' ? section.trim().toUpperCase() : sp?.section || '';

      const nextDesignation =
        typeof designation === 'string' && designation.trim()
          ? designation.trim()
          : fp?.designation ||
            ap?.title ||
            user.batchOrDesignation.split(',')[0]?.trim() ||
            (user.role === 'faculty' ? 'Faculty' : 'System Administrator');
      const nextSpecialization =
        typeof specialization === 'string'
          ? specialization.trim()
          : fp?.specialization || nextDept || 'CSE';
      const nextQualification =
        typeof qualification === 'string'
          ? qualification.trim()
          : fp?.qualification || 'M.Tech / Ph.D';
      const parsedExp = Number(experienceYears);
      const nextExperienceYears =
        experienceYears !== undefined
          ? Math.max(0, Math.min(60, Number.isFinite(parsedExp) ? parsedExp : 0))
          : fp?.experienceYears ?? 5;

      let nextBatch =
        typeof batchOrDesignation === 'string' && batchOrDesignation.trim()
          ? batchOrDesignation.trim()
          : user.batchOrDesignation;

      if (user.role === 'student') {
        if (
          typeof batchOrDesignation !== 'string' &&
          (year !== undefined || section !== undefined || department !== undefined)
        ) {
          const deptLabel = nextDept || 'CSE';
          nextBatch = nextYear
            ? `${nextYear} B.Tech ${deptLabel}${nextSection ? ` · Section ${nextSection}` : ''}`
            : deptLabel;
        }
      } else if (user.role === 'faculty') {
        if (
          typeof batchOrDesignation !== 'string' &&
          (designation !== undefined || department !== undefined)
        ) {
          nextBatch = `${nextDesignation}, ${nextDept || 'CSE'}`;
        } else if (typeof batchOrDesignation === 'string' && batchOrDesignation.trim() && designation === undefined) {
          // keep nextBatch as explicitly edited
        }
      }

      let studentProfileUpdatePayload:
        | {
            year: string;
            section: string;
            cgpa: string;
            leetcodeUrl: string;
            leetcodeUsername: string;
            leetcodeSolved: number;
            leetcodeEasy: number;
            leetcodeMedium: number;
            leetcodeHard: number;
            hackerrankUrl: string;
            hackerrankUsername: string;
            hackerrankFiveStars: number;
            githubUrl: string;
            githubUsername: string;
            githubProjects: number;
            lastSyncedAt: Date | null;
            leetcodeVerifiedAt: Date | null;
            hackerrankVerifiedAt: Date | null;
            githubVerifiedAt: Date | null;
            leetcodeOwnerVerifiedAt: Date | null;
            hackerrankOwnerVerifiedAt: Date | null;
            githubOwnerVerifiedAt: Date | null;
          }
        | null = null;

      let syncWarnings: string[] = [];

      if (user.role === 'student') {
        if (cgpa !== undefined) {
          res.status(403).json({
            error:
              'Students cannot modify their own CGPA. Please contact Faculty or Admin to update verified CGPA.',
          });
          return;
        }
        const preservedCgpa = sp ? sp.cgpa : '0.00';

        const currentLeetUrl = sp?.leetcodeUrl || '';
        const currentHrUrl = sp?.hackerrankUrl || '';
        const currentGhUrl = sp?.githubUrl || '';

        const nextLeetUrl =
          typeof leetcodeUrl === 'string' ? leetcodeUrl.trim() : currentLeetUrl;
        const nextHrUrl =
          typeof hackerrankUrl === 'string' ? hackerrankUrl.trim() : currentHrUrl;
        const nextGhUrl = typeof githubUrl === 'string' ? githubUrl.trim() : currentGhUrl;

        const urlsChanged =
          nextLeetUrl !== currentLeetUrl ||
          nextHrUrl !== currentHrUrl ||
          nextGhUrl !== currentGhUrl;

        let leetcodeUsername = sp?.leetcodeUsername || '';
        let hackerrankUsername = sp?.hackerrankUsername || '';
        let githubUsername = sp?.githubUsername || '';
        let leetcodeSolved = sp?.leetcodeSolved || 0;
        let leetcodeEasy = sp?.leetcodeEasy || 0;
        let leetcodeMedium = sp?.leetcodeMedium || 0;
        let leetcodeHard = sp?.leetcodeHard || 0;
        let hackerrankFiveStars = sp?.hackerrankFiveStars || 0;
        let githubProjects = sp?.githubProjects || 0;
        let lastSyncedAt = sp?.lastSyncedAt || null;
        let leetcodeVerifiedAt = sp?.leetcodeVerifiedAt ?? null;
        let hackerrankVerifiedAt = sp?.hackerrankVerifiedAt ?? null;
        let githubVerifiedAt = sp?.githubVerifiedAt ?? null;
        let leetcodeOwnerVerifiedAt = sp?.leetcodeOwnerVerifiedAt ?? null;
        let hackerrankOwnerVerifiedAt = sp?.hackerrankOwnerVerifiedAt ?? null;
        let githubOwnerVerifiedAt = sp?.githubOwnerVerifiedAt ?? null;

        if (leetcodeUrl !== undefined || urlsChanged || syncCodingLinks) {
          const parsedLeet = parseCodingPlatformInput(nextLeetUrl, 'leetcode');
          if (!parsedLeet.ok && (leetcodeUrl !== undefined || syncCodingLinks)) {
            res.status(400).json({ error: parsedLeet.error });
            return;
          }
          const parsedHr = parseCodingPlatformInput(nextHrUrl, 'hackerrank');
          if (!parsedHr.ok && (hackerrankUrl !== undefined || syncCodingLinks)) {
            res.status(400).json({ error: parsedHr.error });
            return;
          }
          const parsedGh = parseCodingPlatformInput(nextGhUrl, 'github');
          if (!parsedGh.ok && (githubUrl !== undefined || syncCodingLinks)) {
            res.status(400).json({ error: parsedGh.error });
            return;
          }

          if (syncCodingLinks || urlsChanged) {
            const nextLeetUsername = parsedLeet.ok ? parsedLeet.username : '';
            const nextHrUsername = parsedHr.ok ? parsedHr.username : '';
            const nextGhUsername = parsedGh.ok ? parsedGh.username : '';

            const lcHandleChanged =
              nextLeetUsername.toLowerCase() !== (sp?.leetcodeUsername || '').toLowerCase();
            const hrHandleChanged =
              nextHrUsername.toLowerCase() !== (sp?.hackerrankUsername || '').toLowerCase();
            const ghHandleChanged =
              nextGhUsername.toLowerCase() !== (sp?.githubUsername || '').toLowerCase();

            const hasAnyHandleToSync = Boolean(
              nextLeetUsername || nextHrUsername || nextGhUsername
            );

            if (!hasAnyHandleToSync) {
              leetcodeUsername = '';
              hackerrankUsername = '';
              githubUsername = '';
              leetcodeSolved = 0;
              leetcodeEasy = 0;
              leetcodeMedium = 0;
              leetcodeHard = 0;
              hackerrankFiveStars = 0;
              githubProjects = 0;
              lastSyncedAt = null;
              leetcodeVerifiedAt = null;
              hackerrankVerifiedAt = null;
              githubVerifiedAt = null;
              leetcodeOwnerVerifiedAt = null;
              hackerrankOwnerVerifiedAt = null;
              githubOwnerVerifiedAt = null;
            } else {
              const cooldownCutoff = new Date(Date.now() - CODING_SYNC_COOLDOWN_MS);
              const syncAttemptNow = new Date();
              if (!sp) {
                await db
                  .insert(schema.studentProfiles)
                  .values({
                    userId: user.id,
                    year: nextYear,
                    section: nextSection,
                    cgpa: preservedCgpa,
                  })
                  .onConflictDoNothing({ target: schema.studentProfiles.userId });
              }
              const claimedSyncRows = await db
                .update(schema.studentProfiles)
                .set({ codingSyncAttemptedAt: syncAttemptNow })
                .where(
                  and(
                    eq(schema.studentProfiles.userId, user.id),
                    or(
                      isNull(schema.studentProfiles.codingSyncAttemptedAt),
                      sql`${schema.studentProfiles.codingSyncAttemptedAt} <= ${cooldownCutoff}`
                    )
                  )
                )
                .returning({ userId: schema.studentProfiles.userId });

              const canPerformLiveSync = claimedSyncRows.length > 0;
              const isPureCodingSyncRequest =
                name === undefined &&
                department === undefined &&
                phone === undefined &&
                bio === undefined &&
                skills === undefined &&
                year === undefined &&
                section === undefined;

              if (!canPerformLiveSync) {
                if (urlsChanged || isPureCodingSyncRequest) {
                  res.status(429).json({
                    error: 'Please wait 15 seconds before syncing coding profiles again.',
                  });
                  return;
                }
                syncWarnings.push(
                  'Coding stats were not re-synced because a sync ran less than 15 seconds ago; existing stats were preserved.'
                );
              } else {
                leetcodeUsername = nextLeetUsername;
                hackerrankUsername = nextHrUsername;
                githubUsername = nextGhUsername;

                if (lcHandleChanged) {
                  leetcodeVerifiedAt = null;
                  leetcodeOwnerVerifiedAt = null;
                }
                if (hrHandleChanged) {
                  hackerrankVerifiedAt = null;
                  hackerrankOwnerVerifiedAt = null;
                }
                if (ghHandleChanged) {
                  githubVerifiedAt = null;
                  githubOwnerVerifiedAt = null;
                }

                const [liveLc, liveHr, liveGh] = await Promise.all([
                  leetcodeUsername
                    ? fetchLeetcodeCounts(leetcodeUsername)
                    : Promise.resolve({
                        status: 'empty' as const,
                        total: 0,
                        easy: 0,
                        medium: 0,
                        hard: 0,
                      }),
                  hackerrankUsername
                    ? fetchHackerrankFiveStars(hackerrankUsername)
                    : Promise.resolve({ status: 'empty' as const, count: 0 }),
                  githubUsername
                    ? fetchGithubRepoCount(githubUsername)
                    : Promise.resolve({ status: 'empty' as const, count: 0 }),
                ]);

                const verifiedAtNow = new Date();
                let anyLiveVerified = false;

                if (liveLc.status === 'empty') {
                  leetcodeSolved = 0;
                  leetcodeEasy = 0;
                  leetcodeMedium = 0;
                  leetcodeHard = 0;
                  leetcodeVerifiedAt = null;
                  leetcodeOwnerVerifiedAt = null;
                } else if (liveLc.status === 'ok') {
                  leetcodeSolved = liveLc.total;
                  leetcodeEasy = liveLc.easy;
                  leetcodeMedium = liveLc.medium;
                  leetcodeHard = liveLc.hard;
                  leetcodeVerifiedAt = verifiedAtNow;
                  anyLiveVerified = true;
                } else if (liveLc.status === 'not_found') {
                  leetcodeSolved = 0;
                  leetcodeEasy = 0;
                  leetcodeMedium = 0;
                  leetcodeHard = 0;
                  leetcodeVerifiedAt = null;
                  leetcodeOwnerVerifiedAt = null;
                  syncWarnings.push(
                    `LeetCode profile "@${leetcodeUsername}" was not found; LeetCode stats set to 0.`
                  );
                } else if (lcHandleChanged) {
                  leetcodeSolved = 0;
                  leetcodeEasy = 0;
                  leetcodeMedium = 0;
                  leetcodeHard = 0;
                  leetcodeVerifiedAt = null;
                  leetcodeOwnerVerifiedAt = null;
                  syncWarnings.push(
                    `LeetCode verification is temporarily unavailable for "@${leetcodeUsername}"; stats set to 0 until verified.`
                  );
                } else {
                  leetcodeVerifiedAt = sp?.leetcodeVerifiedAt ?? null;
                  leetcodeOwnerVerifiedAt = sp?.leetcodeOwnerVerifiedAt ?? null;
                  syncWarnings.push(
                    `LeetCode is temporarily unavailable; existing stats for "@${leetcodeUsername}" were preserved.`
                  );
                }

                if (liveHr.status === 'empty') {
                  hackerrankFiveStars = 0;
                  hackerrankVerifiedAt = null;
                  hackerrankOwnerVerifiedAt = null;
                } else if (liveHr.status === 'ok') {
                  hackerrankFiveStars = liveHr.count;
                  hackerrankVerifiedAt = verifiedAtNow;
                  anyLiveVerified = true;
                } else if (liveHr.status === 'not_found') {
                  hackerrankFiveStars = 0;
                  hackerrankVerifiedAt = null;
                  hackerrankOwnerVerifiedAt = null;
                  syncWarnings.push(
                    `HackerRank profile "@${hackerrankUsername}" was not found; HackerRank 5-star badges set to 0.`
                  );
                } else if (hrHandleChanged) {
                  hackerrankFiveStars = 0;
                  hackerrankVerifiedAt = null;
                  hackerrankOwnerVerifiedAt = null;
                  syncWarnings.push(
                    `HackerRank verification is temporarily unavailable for "@${hackerrankUsername}"; badge count set to 0 until verified.`
                  );
                } else {
                  hackerrankVerifiedAt = sp?.hackerrankVerifiedAt ?? null;
                  hackerrankOwnerVerifiedAt = sp?.hackerrankOwnerVerifiedAt ?? null;
                  syncWarnings.push(
                    `HackerRank is temporarily unavailable; existing badge count for "@${hackerrankUsername}" was preserved.`
                  );
                }

                if (liveGh.status === 'empty') {
                  githubProjects = 0;
                  githubVerifiedAt = null;
                  githubOwnerVerifiedAt = null;
                } else if (liveGh.status === 'ok') {
                  githubProjects = liveGh.count;
                  githubVerifiedAt = verifiedAtNow;
                  anyLiveVerified = true;
                } else if (liveGh.status === 'not_found') {
                  githubProjects = 0;
                  githubVerifiedAt = null;
                  githubOwnerVerifiedAt = null;
                  syncWarnings.push(
                    `GitHub profile "@${githubUsername}" was not found; GitHub project count set to 0.`
                  );
                } else if (ghHandleChanged) {
                  githubProjects = 0;
                  githubVerifiedAt = null;
                  githubOwnerVerifiedAt = null;
                  syncWarnings.push(
                    `GitHub verification is temporarily unavailable for "@${githubUsername}"; project count set to 0 until verified.`
                  );
                } else {
                  githubVerifiedAt = sp?.githubVerifiedAt ?? null;
                  githubOwnerVerifiedAt = sp?.githubOwnerVerifiedAt ?? null;
                  syncWarnings.push(
                    `GitHub is temporarily unavailable; existing project count for "@${githubUsername}" was preserved.`
                  );
                }

                if (anyLiveVerified) {
                  lastSyncedAt = verifiedAtNow;
                }
              }
            }
          }
        }

        studentProfileUpdatePayload = {
          year: nextYear,
          section: nextSection,
          cgpa: preservedCgpa,
          leetcodeUrl: nextLeetUrl,
          leetcodeUsername,
          leetcodeSolved,
          leetcodeEasy,
          leetcodeMedium,
          leetcodeHard,
          hackerrankUrl: nextHrUrl,
          hackerrankUsername,
          hackerrankFiveStars,
          githubUrl: nextGhUrl,
          githubUsername,
          githubProjects,
          lastSyncedAt,
          leetcodeVerifiedAt,
          hackerrankVerifiedAt,
          githubVerifiedAt,
          leetcodeOwnerVerifiedAt,
          hackerrankOwnerVerifiedAt,
          githubOwnerVerifiedAt,
        };
      }

      const authEmailChanged = nextEmail !== user.email;
      const authNameChanged = nextName !== user.name;
      if (authEmailChanged || authNameChanged) {
        const authUpdate = await updateSupabaseAuthUser(user.id, {
          ...(authEmailChanged ? { email: nextEmail } : {}),
          ...(authNameChanged ? { name: nextName, memberId: user.memberId } : {}),
        });
        if (authUpdate.error) {
          res.status(400).json({ error: authUpdate.error });
          return;
        }
      }

      try {
        await db.transaction(async (tx) => {
          await tx
            .update(schema.users)
            .set({
              name: nextName,
              email: nextEmail,
              department: nextDept,
              phone: nextPhone,
              batchOrDesignation: nextBatch,
              bio: nextBio,
              skills: nextSkills,
            })
            .where(eq(schema.users.id, user.id));

          if (user.role === 'student' && studentProfileUpdatePayload) {
            await tx
              .insert(schema.studentProfiles)
              .values({
                userId: user.id,
                ...studentProfileUpdatePayload,
              })
              .onConflictDoUpdate({
                target: schema.studentProfiles.userId,
                set: studentProfileUpdatePayload,
              });
          } else if (user.role === 'faculty') {
            await tx
              .insert(schema.facultyProfiles)
              .values({
                userId: user.id,
                designation: nextDesignation,
                specialization: nextSpecialization,
                qualification: nextQualification,
                experienceYears: nextExperienceYears,
                phoneOrCabin: nextPhone,
              })
              .onConflictDoUpdate({
                target: schema.facultyProfiles.userId,
                set: {
                  designation: nextDesignation,
                  specialization: nextSpecialization,
                  qualification: nextQualification,
                  experienceYears: nextExperienceYears,
                  phoneOrCabin: nextPhone,
                },
              });

            await tx
              .update(schema.facultyDirectory)
              .set({
                name: nextName,
                designation: nextDesignation,
                specialization: nextSpecialization,
                phoneOrCabin: nextPhone,
                qualification: nextQualification,
                experienceYears: nextExperienceYears,
                bio: nextBio,
              })
              .where(eq(schema.facultyDirectory.linkedUserId, user.id));
          } else if (user.role === 'admin') {
            await tx
              .insert(schema.adminProfiles)
              .values({
                userId: user.id,
                title: nextBatch || nextDesignation,
                createdBySystemSetup: Boolean(ap?.createdBySystemSetup),
                isSuperAdmin: Boolean(ap?.isSuperAdmin),
                adminRoleLabel: ap?.adminRoleLabel || 'Department Admin',
              })
              .onConflictDoUpdate({
                target: schema.adminProfiles.userId,
                set: {
                  title: nextBatch || nextDesignation,
                },
              });
          }
        });
      } catch (err) {
        if (authEmailChanged || authNameChanged) {
          await updateSupabaseAuthUser(user.id, {
            email: user.email,
            name: user.name,
            memberId: user.memberId,
          });
        }
        if (isUniqueViolation(err)) {
          res.status(409).json({ error: 'Another account already uses this email address.' });
          return;
        }
        throw err;
      }

      const refreshed = await getUserWithProfilesById(db, user.id);
      const progress = await computeUserProgress(db, user.id);

      res.json({
        profile: toPublicProfile(refreshed!, { includePhone: true }),
        progress,
        ...(syncWarnings.length > 0 ? { syncWarnings } : {}),
      });
    })
  );

  // 6b. Priority 4: Student Coding Handle Ownership Verification (HMAC bio challenge)
  app.post(
    '/api/profile/coding-ownership/challenge',
    requireAuth,
    codingVerificationRateLimiter,
    asyncHandler(async (req: AuthedRequest, res: Response) => {
      const record = req.userRecord!;
      const user = record.user;
      if (user.role !== 'student') {
        res.status(403).json({
          error: 'Coding profile ownership verification applies only to Student accounts.',
        });
        return;
      }

      const { platform } = req.body as { platform?: unknown };
      if (platform !== 'leetcode' && platform !== 'hackerrank' && platform !== 'github') {
        res.status(400).json({ error: 'Platform must be leetcode, hackerrank, or github.' });
        return;
      }

      const sp = record.studentProfile;
      const storedUrl =
        platform === 'leetcode'
          ? sp?.leetcodeUrl || ''
          : platform === 'hackerrank'
          ? sp?.hackerrankUrl || ''
          : sp?.githubUrl || '';
      const storedHandle =
        platform === 'leetcode'
          ? sp?.leetcodeUsername || ''
          : platform === 'hackerrank'
          ? sp?.hackerrankUsername || ''
          : sp?.githubUsername || '';

      const parsed = storedUrl
        ? parseCodingPlatformInput(storedUrl, platform)
        : storedHandle
        ? parseCodingPlatformInput(storedHandle, platform)
        : { ok: true as const, username: '' };

      const handle = parsed.ok ? parsed.username : '';
      if (!handle) {
        res.status(400).json({
          error: `Please save and sync a valid ${platform} profile URL in Edit Profile first.`,
        });
        return;
      }

      const expSec = Math.floor(Date.now() / 1000) + CODING_OWNER_CODE_TTL_SEC;
      const verificationCode = signCodingOwnershipCode(user.id, platform, handle, expSec);
      const instructions =
        platform === 'github'
          ? `Add "${verificationCode}" anywhere in your GitHub profile Bio (github.com/settings/profile), save it, and click Check Bio & Verify.`
          : platform === 'leetcode'
          ? `Add "${verificationCode}" anywhere in your LeetCode Summary / Bio (leetcode.com/profile), save it, and click Check Bio & Verify.`
          : `Add "${verificationCode}" to your HackerRank public About / Bio or Website headline, save it, and click Check Bio & Verify. (If HackerRank rate-limits automated checks, ask Faculty/Admin to verify your handle.)`;

      res.json({
        platform,
        username: handle,
        verificationCode,
        expiresAt: new Date(expSec * 1000).toISOString(),
        instructions,
      });
    })
  );

  app.post(
    '/api/profile/coding-ownership/verify',
    requireAuth,
    codingVerificationRateLimiter,
    asyncHandler(async (req: AuthedRequest, res: Response) => {
      const db = requireDb();
      const record = req.userRecord!;
      const user = record.user;
      if (user.role !== 'student') {
        res.status(403).json({
          error: 'Coding profile ownership verification applies only to Student accounts.',
        });
        return;
      }

      const { platform, verificationCode } = req.body as {
        platform?: unknown;
        verificationCode?: unknown;
      };
      if (platform !== 'leetcode' && platform !== 'hackerrank' && platform !== 'github') {
        res.status(400).json({ error: 'Platform must be leetcode, hackerrank, or github.' });
        return;
      }

      const sp = record.studentProfile;
      const storedUrl =
        platform === 'leetcode'
          ? sp?.leetcodeUrl || ''
          : platform === 'hackerrank'
          ? sp?.hackerrankUrl || ''
          : sp?.githubUrl || '';
      const storedHandle =
        platform === 'leetcode'
          ? sp?.leetcodeUsername || ''
          : platform === 'hackerrank'
          ? sp?.hackerrankUsername || ''
          : sp?.githubUsername || '';

      const parsed = storedUrl
        ? parseCodingPlatformInput(storedUrl, platform)
        : storedHandle
        ? parseCodingPlatformInput(storedHandle, platform)
        : { ok: true as const, username: '' };

      const handle = parsed.ok ? parsed.username : '';
      if (!handle) {
        res.status(400).json({
          error: `Please save and sync a valid ${platform} profile URL before verifying ownership.`,
        });
        return;
      }

      const sigCheck = verifyCodingOwnershipCodeSignature(
        user.id,
        platform,
        handle,
        verificationCode
      );
      if (!sigCheck.ok) {
        res.status(400).json({ error: sigCheck.error });
        return;
      }

      const cleanCode = sigCheck.normalizedCode;
      const bioResult = await fetchCodingProfileBio(platform, handle);

      if (bioResult.status === 'not_found') {
        const clearFields: Partial<typeof schema.studentProfiles.$inferInsert> =
          platform === 'leetcode'
            ? {
                leetcodeSolved: 0,
                leetcodeEasy: 0,
                leetcodeMedium: 0,
                leetcodeHard: 0,
                leetcodeVerifiedAt: null,
                leetcodeOwnerVerifiedAt: null,
              }
            : platform === 'hackerrank'
            ? {
                hackerrankFiveStars: 0,
                hackerrankVerifiedAt: null,
                hackerrankOwnerVerifiedAt: null,
              }
            : {
                githubProjects: 0,
                githubVerifiedAt: null,
                githubOwnerVerifiedAt: null,
              };
        await db
          .update(schema.studentProfiles)
          .set(clearFields)
          .where(eq(schema.studentProfiles.userId, user.id));
        res.status(404).json({
          error: `Public ${platform} profile "@${handle}" was not found. Please check your URL in My Profile.`,
        });
        return;
      }

      if (bioResult.status !== 'ok') {
        res.status(503).json({
          error: `Could not retrieve your public ${platform} bio right now. Please retry shortly or request Faculty/Admin coordinator verification.`,
        });
        return;
      }

      if (!bioResult.bioText.toUpperCase().includes(cleanCode)) {
        res.status(400).json({
          error: `Verification code "${cleanCode}" was not found in "@${handle}"'s public ${platform} bio yet. Save the bio publicly, wait a few seconds, and retry.`,
        });
        return;
      }

      const verifiedNow = new Date();
      const ownerFields: Partial<typeof schema.studentProfiles.$inferInsert> =
        platform === 'leetcode'
          ? { leetcodeUsername: handle, leetcodeOwnerVerifiedAt: verifiedNow }
          : platform === 'hackerrank'
          ? { hackerrankUsername: handle, hackerrankOwnerVerifiedAt: verifiedNow }
          : { githubUsername: handle, githubOwnerVerifiedAt: verifiedNow };

      await db
        .update(schema.studentProfiles)
        .set(ownerFields)
        .where(eq(schema.studentProfiles.userId, user.id));

      markCodingChallengeConsumed(user.id, platform, cleanCode, sigCheck.expSec);

      const refreshed = await getUserWithProfilesById(db, user.id);
      const progress = await computeUserProgress(db, user.id);
      res.json({
        ok: true,
        platform,
        message: `${platform} handle "@${handle}" ownership verified! You can remove the code from your bio now if you wish.`,
        profile: toPublicProfile(refreshed!, { includePhone: true }),
        progress,
      });
    })
  );

  // 7. Search Students by ID or Name (Authenticated active members only)
  app.get(
    '/api/students/search',
    requireAuth,
    asyncHandler(async (req: AuthedRequest, res: Response) => {
      const db = requireDb();
      const query = String(req.query.q || '');
      const actorRole = req.userRecord!.user.role;
      const results = await searchStudentsDirectory(db, query, {
        includePhone:
          actorRole === 'faculty' ||
          (actorRole === 'admin' && hasAdminRecordPermission(req.userRecord, 'students')),
      });
      res.json({ results });
    })
  );

  // 8. Notifications: Mark as Read
  app.post(
    '/api/notifications/read',
    requireAuth,
    asyncHandler(async (req: AuthedRequest, res: Response) => {
      const db = requireDb();
      const userId = req.userRecord!.user.id;
      const { notificationId } = req.body as { notificationId?: string };

      if (notificationId) {
        const validId = parseUuidParam(notificationId);
        if (!validId) {
          res.status(400).json({ error: 'Invalid notification ID.' });
          return;
        }
        const [visibleNotif] = await db
          .select({ id: schema.notifications.id })
          .from(schema.notifications)
          .where(
            and(
              eq(schema.notifications.id, validId),
              or(
                isNull(schema.notifications.recipientUserId),
                eq(schema.notifications.recipientUserId, userId)
              )
            )
          )
          .limit(1);

        if (!visibleNotif) {
          res.status(404).json({ error: 'Notification not found.' });
          return;
        }

        await db
          .insert(schema.notificationReads)
          .values({ notificationId: validId, userId })
          .onConflictDoNothing();
      } else {
        const visible = await db
          .select({ id: schema.notifications.id })
          .from(schema.notifications)
          .where(
            or(
              isNull(schema.notifications.recipientUserId),
              eq(schema.notifications.recipientUserId, userId)
            )
          );
        if (visible.length > 0) {
          await db
            .insert(schema.notificationReads)
            .values(visible.map((n) => ({ notificationId: n.id, userId })))
            .onConflictDoNothing();
        }
      }

      res.json({ ok: true });
    })
  );

  // 8b. Personal Reminders API
  app.get(
    '/api/reminders',
    requireAuth,
    asyncHandler(async (req: AuthedRequest, res: Response) => {
      const db = requireDb();
      const reminders = await getPersonalRemindersForUser(db, req.userRecord!.user.id);
      res.json({ reminders });
    })
  );

  app.post(
    '/api/reminders',
    requireAuth,
    asyncHandler(async (req: AuthedRequest, res: Response) => {
      const db = requireDb();
      const user = req.userRecord!.user;
      const { title, note, dueDate, category, priority } = req.body as {
        title?: string;
        note?: string;
        dueDate?: string;
        category?: string;
        priority?: string;
      };

      if (typeof title !== 'string' || !title.trim()) {
        res.status(400).json({ error: 'Reminder title is required.' });
        return;
      }

      const validCategories = [
        'problem_statement',
        'placement',
        'hackathon',
        'interview',
        'exam_lab',
        'general',
      ] as const;
      const safeCategory = (validCategories as readonly string[]).includes(
        typeof category === 'string' ? category : ''
      )
        ? (category as (typeof validCategories)[number])
        : 'general';
      const safePriority =
        priority === 'High' ? 'High' : priority === 'Low' ? 'Low' : 'Normal';

      const [created] = await db
        .insert(schema.personalReminders)
        .values({
          userId: user.id,
          title: title.trim(),
          note: typeof note === 'string' ? note.trim() : '',
          dueDate: typeof dueDate === 'string' ? dueDate.trim() : '',
          category: safeCategory,
          priority: safePriority,
          completed: false,
        })
        .returning();

      res.status(201).json(mapReminderRow(created));
    })
  );

  app.patch(
    '/api/reminders/:id/toggle',
    requireAuth,
    asyncHandler(async (req: AuthedRequest, res: Response) => {
      const id = parseUuidParam(req.params.id);
      if (!id) {
        res.status(404).json({ error: 'Reminder not found.' });
        return;
      }
      const db = requireDb();
      const userId = req.userRecord!.user.id;
      const [existing] = await db
        .select()
        .from(schema.personalReminders)
        .where(
          and(
            eq(schema.personalReminders.id, id),
            eq(schema.personalReminders.userId, userId)
          )
        )
        .limit(1);

      if (!existing) {
        res.status(404).json({ error: 'Reminder not found.' });
        return;
      }

      const [updated] = await db
        .update(schema.personalReminders)
        .set({ completed: !existing.completed })
        .where(eq(schema.personalReminders.id, id))
        .returning();

      res.json(mapReminderRow(updated));
    })
  );

  app.delete(
    '/api/reminders/:id',
    requireAuth,
    asyncHandler(async (req: AuthedRequest, res: Response) => {
      const id = parseUuidParam(req.params.id);
      if (!id) {
        res.status(404).json({ error: 'Reminder not found.' });
        return;
      }
      const db = requireDb();
      const deleted = await db
        .delete(schema.personalReminders)
        .where(
          and(
            eq(schema.personalReminders.id, id),
            eq(schema.personalReminders.userId, req.userRecord!.user.id)
          )
        )
        .returning({ id: schema.personalReminders.id });

      if (deleted.length === 0) {
        res.status(404).json({ error: 'Reminder not found.' });
        return;
      }
      res.json({ ok: true });
    })
  );

  // 9. Dashboard Spotlights
  app.post(
    '/api/spotlights',
    requireAuth,
    asyncHandler(async (req: AuthedRequest, res: Response) => {
      const user = req.userRecord!.user;
      const adminCanManageSpotlights =
        user.role === 'admin' && hasAdminRecordPermission(req.userRecord, 'dashboard_analytics');
      if (!adminCanManageSpotlights && !(user.role === 'faculty' && user.canManageSpotlights)) {
        res.status(403).json({
          error:
            user.role === 'admin'
              ? "Access denied: Requires 'Dashboard & Analytics' administrator permission."
              : 'Only authorized Administrators and Faculty coordinators can publish Dashboard Spotlights.',
        });
        return;
      }

      const { category, headlineValue, title, recipients, description } = req.body as {
        category?: string;
        headlineValue?: string;
        title?: string;
        recipients?: string;
        description?: string;
      };

      if (
        typeof headlineValue !== 'string' ||
        !headlineValue.trim() ||
        typeof title !== 'string' ||
        !title.trim()
      ) {
        res.status(400).json({ error: 'Headline amount/prize and title are required.' });
        return;
      }

      const db = requireDb();
      const [inserted] = await db
        .insert(schema.spotlights)
        .values({
          category:
            typeof category === 'string' && category.trim()
              ? category.trim()
              : 'Department Spotlight',
          headlineValue: headlineValue.trim(),
          title: title.trim(),
          recipients: typeof recipients === 'string' ? recipients.trim() : '',
          description: typeof description === 'string' ? description.trim() : '',
          authorId: user.id,
          authorNameSnapshot: user.name,
        })
        .returning();

      const item = await getSpotlightById(db, inserted.id);
      res.status(201).json(item);
    })
  );

  app.put(
    '/api/spotlights/:id',
    requireAuth,
    asyncHandler(async (req: AuthedRequest, res: Response) => {
      const user = req.userRecord!.user;
      const adminCanManageSpotlights =
        user.role === 'admin' && hasAdminRecordPermission(req.userRecord, 'dashboard_analytics');
      if (!adminCanManageSpotlights && !(user.role === 'faculty' && user.canManageSpotlights)) {
        res.status(403).json({
          error:
            user.role === 'admin'
              ? "Access denied: Requires 'Dashboard & Analytics' administrator permission."
              : 'Not authorized to edit Dashboard Spotlights.',
        });
        return;
      }

      const id = parseUuidParam(req.params.id);
      if (!id) {
        res.status(404).json({ error: 'Spotlight not found.' });
        return;
      }

      const { category, headlineValue, title, recipients, description } = req.body as {
        category?: string;
        headlineValue?: string;
        title?: string;
        recipients?: string;
        description?: string;
      };

      const db = requireDb();
      const result = await db.transaction(async (tx) => {
        const [existing] = await tx
          .select()
          .from(schema.spotlights)
          .where(eq(schema.spotlights.id, id))
          .limit(1);

        if (!existing) {
          return { status: 404 as const, error: 'Spotlight not found.' };
        }
        if (user.role !== 'admin' && existing.authorId !== user.id) {
          return {
            status: 403 as const,
            error: 'Only the original author or Admin can edit this Dashboard Spotlight.',
          };
        }

        const nextCategory = asNonEmptyTrimmedString(category, existing.category);
        const nextHeadline = asNonEmptyTrimmedString(headlineValue, existing.headlineValue);
        const nextTitle = asNonEmptyTrimmedString(title, existing.title);
        const nextRecipients = asNonEmptyTrimmedString(recipients, existing.recipients);
        const nextDescription = asNonEmptyTrimmedString(description, existing.description);
        if (
          nextCategory === null ||
          nextHeadline === null ||
          nextTitle === null ||
          nextRecipients === null ||
          nextDescription === null
        ) {
          return { status: 400 as const, error: 'Spotlight fields must be valid text strings.' };
        }

        const updatedRows = await tx
          .update(schema.spotlights)
          .set({
            category: nextCategory || existing.category,
            headlineValue: nextHeadline || existing.headlineValue,
            title: nextTitle || existing.title,
            recipients: nextRecipients,
            description: nextDescription,
          })
          .where(eq(schema.spotlights.id, id))
          .returning({ id: schema.spotlights.id });

        if (updatedRows.length === 0) {
          return { status: 404 as const, error: 'Spotlight not found.' };
        }

        return { status: 200 as const };
      });

      if (result.status !== 200) {
        res.status(result.status).json({ error: result.error });
        return;
      }

      const updated = await getSpotlightById(db, id);
      res.json(updated);
    })
  );

  app.delete(
    '/api/spotlights/:id',
    requireAuth,
    asyncHandler(async (req: AuthedRequest, res: Response) => {
      const user = req.userRecord!.user;
      const adminCanManageSpotlights =
        user.role === 'admin' && hasAdminRecordPermission(req.userRecord, 'dashboard_analytics');
      if (!adminCanManageSpotlights && !(user.role === 'faculty' && user.canManageSpotlights)) {
        res.status(403).json({
          error:
            user.role === 'admin'
              ? "Access denied: Requires 'Dashboard & Analytics' administrator permission."
              : 'Not authorized to remove Dashboard Spotlights.',
        });
        return;
      }

      const id = parseUuidParam(req.params.id);
      if (!id) {
        res.status(404).json({ error: 'Spotlight not found.' });
        return;
      }

      const db = requireDb();
      const result = await db.transaction(async (tx) => {
        const [existing] = await tx
          .select({ id: schema.spotlights.id, authorId: schema.spotlights.authorId })
          .from(schema.spotlights)
          .where(eq(schema.spotlights.id, id))
          .limit(1);

        if (!existing) {
          return { status: 404 as const, error: 'Spotlight not found.' };
        }
        if (user.role !== 'admin' && existing.authorId !== user.id) {
          return {
            status: 403 as const,
            error: 'Only the original author or Admin can delete this Dashboard Spotlight.',
          };
        }

        const deletedRows = await tx
          .delete(schema.spotlights)
          .where(eq(schema.spotlights.id, id))
          .returning({ id: schema.spotlights.id });

        if (deletedRows.length === 0) {
          return { status: 404 as const, error: 'Spotlight not found.' };
        }

        return { status: 200 as const };
      });

      if (result.status !== 200) {
        res.status(result.status).json({ error: result.error });
        return;
      }

      res.json({ ok: true });
    })
  );

  // 10. Hackathon Experiences
  app.post(
    '/api/hackathons',
    requireAuth,
    asyncHandler(async (req: AuthedRequest, res: Response) => {
      const user = req.userRecord!.user;
      const {
        hackathonName,
        organizer,
        eventDate,
        teamAndRole,
        outcome,
        technologies,
        overallExperience,
      } = req.body as {
        hackathonName?: string;
        organizer?: string;
        eventDate?: string;
        teamAndRole?: string;
        outcome?: string;
        technologies?: string;
        overallExperience?: string;
      };

      if (
        typeof hackathonName !== 'string' ||
        !hackathonName.trim() ||
        typeof overallExperience !== 'string' ||
        !overallExperience.trim()
      ) {
        res.status(400).json({
          error: 'Hackathon name and overall experience are required.',
        });
        return;
      }

      const db = requireDb();
      const [inserted] = await db
        .insert(schema.hackathons)
        .values({
          hackathonName: hackathonName.trim(),
          organizer: typeof organizer === 'string' ? organizer.trim() : '',
          eventDate: typeof eventDate === 'string' ? eventDate.trim() : '',
          teamAndRole: typeof teamAndRole === 'string' ? teamAndRole.trim() : '',
          outcome:
            typeof outcome === 'string' && outcome.trim() ? outcome.trim() : 'Participant',
          technologies: typeof technologies === 'string' ? technologies.trim() : '',
          overallExperience: overallExperience.trim(),
          authorId: user.id,
        })
        .returning();

      const item = await getHackathonById(db, inserted.id);
      res.status(201).json(item);
    })
  );

  app.put(
    '/api/hackathons/:id',
    requireAuth,
    asyncHandler(async (req: AuthedRequest, res: Response) => {
      const id = parseUuidParam(req.params.id);
      if (!id) {
        res.status(404).json({ error: 'Hackathon experience not found.' });
        return;
      }

      const db = requireDb();
      const user = req.userRecord!.user;
      const [existing] = await db
        .select()
        .from(schema.hackathons)
        .where(eq(schema.hackathons.id, id))
        .limit(1);

      if (!existing) {
        res.status(404).json({ error: 'Hackathon experience not found.' });
        return;
      }
      const canAdminModerate =
        user.role === 'admin' &&
        hasAdminRecordPermission(req.userRecord, 'dashboard_analytics');
      if (!canAdminModerate && existing.authorId !== user.id) {
        res.status(403).json({
          error: 'Only the original author or authorized Admin can edit this experience.',
        });
        return;
      }

      const {
        hackathonName,
        organizer,
        eventDate,
        teamAndRole,
        outcome,
        technologies,
        overallExperience,
      } = req.body as {
        hackathonName?: string;
        organizer?: string;
        eventDate?: string;
        teamAndRole?: string;
        outcome?: string;
        technologies?: string;
        overallExperience?: string;
      };

      const nextHackName = asNonEmptyTrimmedString(hackathonName, existing.hackathonName);
      const nextOrg = asNonEmptyTrimmedString(organizer, existing.organizer);
      const nextDate = asNonEmptyTrimmedString(eventDate, existing.eventDate);
      const nextTeam = asNonEmptyTrimmedString(teamAndRole, existing.teamAndRole);
      const nextOutcome = asNonEmptyTrimmedString(outcome, existing.outcome);
      const nextTech = asNonEmptyTrimmedString(technologies, existing.technologies);
      const nextExp = asNonEmptyTrimmedString(overallExperience, existing.overallExperience);
      if (
        nextHackName === null ||
        nextOrg === null ||
        nextDate === null ||
        nextTeam === null ||
        nextOutcome === null ||
        nextTech === null ||
        nextExp === null
      ) {
        res.status(400).json({ error: 'Hackathon fields must be valid text strings.' });
        return;
      }

      await db
        .update(schema.hackathons)
        .set({
          hackathonName: nextHackName || existing.hackathonName,
          organizer: nextOrg,
          eventDate: nextDate,
          teamAndRole: nextTeam,
          outcome: nextOutcome || existing.outcome,
          technologies: nextTech,
          overallExperience: nextExp || existing.overallExperience,
        })
        .where(eq(schema.hackathons.id, id));

      const updated = await getHackathonById(db, id);
      res.json(updated);
    })
  );

  app.delete(
    '/api/hackathons/:id',
    requireAuth,
    asyncHandler(async (req: AuthedRequest, res: Response) => {
      const id = parseUuidParam(req.params.id);
      if (!id) {
        res.status(404).json({ error: 'Not found.' });
        return;
      }

      const db = requireDb();
      const user = req.userRecord!.user;
      const [existing] = await db
        .select()
        .from(schema.hackathons)
        .where(eq(schema.hackathons.id, id))
        .limit(1);

      if (!existing) {
        res.status(404).json({ error: 'Not found.' });
        return;
      }
      const canAdminModerate =
        user.role === 'admin' &&
        hasAdminRecordPermission(req.userRecord, 'dashboard_analytics');
      if (!canAdminModerate && existing.authorId !== user.id) {
        res.status(403).json({
          error: 'Only the original author or authorized Admin can delete this entry.',
        });
        return;
      }

      await db.delete(schema.hackathons).where(eq(schema.hackathons.id, id));
      res.json({ ok: true });
    })
  );

  // 10b. Interview Experiences (Authenticated members only)
  app.get(
    '/api/interviews',
    requireAuth,
    asyncHandler(async (_req: AuthedRequest, res: Response) => {
      const db = requireDb();
      const list = await getInterviewsList(db);
      res.json({ interviews: list });
    })
  );

  app.post(
    '/api/interviews',
    requireAuth,
    asyncHandler(async (req: AuthedRequest, res: Response) => {
      const db = requireDb();
      const user = req.userRecord!.user;
      const {
        companyName,
        roleTitle,
        companyDomain,
        skillsNeeded,
        hiringType,
        packageOrStipend,
        interviewDate,
        resultStatus,
        overallDifficulty,
        overallExperience,
        rounds,
        keyPreparationTips,
        resourcesUsed,
      } = req.body as {
        companyName?: string;
        roleTitle?: string;
        companyDomain?: string;
        skillsNeeded?: string;
        hiringType?: 'On-Campus' | 'Off-Campus' | 'Internship' | 'Full-Time';
        packageOrStipend?: string;
        interviewDate?: string;
        resultStatus?: 'Selected / Offered' | 'Rejected' | 'In Progress / Final Round';
        overallDifficulty?: 'Easy' | 'Medium' | 'Hard';
        overallExperience?: string;
        rounds?: Array<{
          roundNumber?: number;
          roundTitle?: string;
          topicsCovered?: string;
          questionsAsked?: string;
          difficulty?: 'Easy' | 'Medium' | 'Hard';
        }>;
        keyPreparationTips?: string;
        resourcesUsed?: string;
      };

      if (
        typeof companyName !== 'string' ||
        !companyName.trim() ||
        typeof roleTitle !== 'string' ||
        !roleTitle.trim() ||
        typeof overallExperience !== 'string' ||
        !overallExperience.trim()
      ) {
        res.status(400).json({
          error: 'Company Name, Role Title, and Overall Experience are required.',
        });
        return;
      }

      const validHiringTypes = ['On-Campus', 'Off-Campus', 'Internship', 'Full-Time'] as const;
      const safeHiringType = (validHiringTypes as readonly string[]).includes(
        typeof hiringType === 'string' ? hiringType : ''
      )
        ? hiringType!
        : 'On-Campus';

      const validResults = [
        'Selected / Offered',
        'Rejected',
        'In Progress / Final Round',
      ] as const;
      const safeResult = (validResults as readonly string[]).includes(
        typeof resultStatus === 'string' ? resultStatus : ''
      )
        ? resultStatus!
        : 'Selected / Offered';

      const validDiff = ['Easy', 'Medium', 'Hard'] as const;
      const safeDifficulty = (validDiff as readonly string[]).includes(
        typeof overallDifficulty === 'string' ? overallDifficulty : ''
      )
        ? overallDifficulty!
        : 'Medium';

      const createdId = await db.transaction(async (tx) => {
        const [inserted] = await tx
          .insert(schema.interviews)
          .values({
            companyName: companyName.trim(),
            roleTitle: roleTitle.trim(),
            companyDomain:
              typeof companyDomain === 'string' && companyDomain.trim()
                ? companyDomain.trim()
                : 'Technology & Software',
            skillsNeeded: typeof skillsNeeded === 'string' ? skillsNeeded.trim() : '',
            hiringType: safeHiringType,
            packageOrStipend:
              typeof packageOrStipend === 'string' ? packageOrStipend.trim() : '',
            interviewDate:
              typeof interviewDate === 'string' && interviewDate.trim()
                ? interviewDate.trim()
                : '2026',
            resultStatus: safeResult,
            overallDifficulty: safeDifficulty,
            overallExperience: overallExperience.trim(),
            keyPreparationTips:
              typeof keyPreparationTips === 'string' ? keyPreparationTips.trim() : '',
            resourcesUsed: typeof resourcesUsed === 'string' ? resourcesUsed.trim() : '',
            authorId: user.id,
          })
          .returning();

        if (Array.isArray(rounds) && rounds.length > 0) {
          await tx.insert(schema.interviewRounds).values(
            rounds.map((r, idx) => ({
              interviewId: inserted.id,
              roundNumber: Number(r.roundNumber) || idx + 1,
              roundTitle:
                typeof r.roundTitle === 'string' && r.roundTitle.trim()
                  ? r.roundTitle.trim()
                  : `Round ${idx + 1}`,
              topicsCovered:
                typeof r.topicsCovered === 'string' ? r.topicsCovered.trim() : '',
              questionsAsked:
                typeof r.questionsAsked === 'string' ? r.questionsAsked.trim() : '',
              difficulty: (validDiff as readonly string[]).includes(
                typeof r.difficulty === 'string' ? r.difficulty : ''
              )
                ? r.difficulty!
                : 'Medium',
            }))
          );
        }

        const [notif] = await tx
          .insert(schema.notifications)
          .values({
            type: 'interview_posted',
            title: `Interview Experience Shared: ${inserted.companyName} (${inserted.roleTitle})`,
            message: `${user.name} (${user.memberId}) shared an interview breakdown for ${inserted.companyName} [${inserted.resultStatus}].`,
            targetSection: 'interview-experience',
            targetItemId: inserted.id,
            actorId: user.id,
            actorNameSnapshot: user.name,
          })
          .returning();

        await tx
          .insert(schema.notificationReads)
          .values({ notificationId: notif.id, userId: user.id })
          .onConflictDoNothing();

        return inserted.id;
      });

      const item = await getInterviewById(db, createdId);
      res.status(201).json(item);
    })
  );

  app.put(
    '/api/interviews/:id',
    requireAuth,
    asyncHandler(async (req: AuthedRequest, res: Response) => {
      const id = parseUuidParam(req.params.id);
      if (!id) {
        res.status(404).json({ error: 'Interview experience not found.' });
        return;
      }

      const db = requireDb();
      const user = req.userRecord!.user;
      const [existing] = await db
        .select()
        .from(schema.interviews)
        .where(eq(schema.interviews.id, id))
        .limit(1);

      if (!existing) {
        res.status(404).json({ error: 'Interview experience not found.' });
        return;
      }
      const canAdminModerate =
        user.role === 'admin' &&
        (hasAdminRecordPermission(req.userRecord, 'placements') ||
          hasAdminRecordPermission(req.userRecord, 'dashboard_analytics'));
      if (!canAdminModerate && existing.authorId !== user.id) {
        res.status(403).json({
          error: 'Only the author or authorized Admin can edit this interview experience.',
        });
        return;
      }

      const {
        companyName,
        roleTitle,
        companyDomain,
        skillsNeeded,
        hiringType,
        packageOrStipend,
        interviewDate,
        resultStatus,
        overallDifficulty,
        overallExperience,
        rounds,
        keyPreparationTips,
        resourcesUsed,
      } = req.body as {
        companyName?: string;
        roleTitle?: string;
        companyDomain?: string;
        skillsNeeded?: string;
        hiringType?: 'On-Campus' | 'Off-Campus' | 'Internship' | 'Full-Time';
        packageOrStipend?: string;
        interviewDate?: string;
        resultStatus?: 'Selected / Offered' | 'Rejected' | 'In Progress / Final Round';
        overallDifficulty?: 'Easy' | 'Medium' | 'Hard';
        overallExperience?: string;
        rounds?: Array<{
          roundNumber?: number;
          roundTitle?: string;
          topicsCovered?: string;
          questionsAsked?: string;
          difficulty?: 'Easy' | 'Medium' | 'Hard';
        }>;
        keyPreparationTips?: string;
        resourcesUsed?: string;
      };

      const validHiringTypes = ['On-Campus', 'Off-Campus', 'Internship', 'Full-Time'] as const;
      const validResults = [
        'Selected / Offered',
        'Rejected',
        'In Progress / Final Round',
      ] as const;
      const validDiff = ['Easy', 'Medium', 'Hard'] as const;

      if (
        hiringType !== undefined &&
        !(validHiringTypes as readonly string[]).includes(String(hiringType))
      ) {
        res.status(400).json({ error: 'Invalid hiringType selection.' });
        return;
      }
      if (
        resultStatus !== undefined &&
        !(validResults as readonly string[]).includes(String(resultStatus))
      ) {
        res.status(400).json({ error: 'Invalid resultStatus selection.' });
        return;
      }
      if (
        overallDifficulty !== undefined &&
        !(validDiff as readonly string[]).includes(String(overallDifficulty))
      ) {
        res.status(400).json({ error: 'Invalid overallDifficulty selection.' });
        return;
      }

      const nextCompanyName = asNonEmptyTrimmedString(companyName, existing.companyName);
      const nextRoleTitle = asNonEmptyTrimmedString(roleTitle, existing.roleTitle);
      const nextCompanyDomain = asNonEmptyTrimmedString(companyDomain, existing.companyDomain);
      const nextSkillsNeeded = asNonEmptyTrimmedString(skillsNeeded, existing.skillsNeeded);
      const nextPackage = asNonEmptyTrimmedString(packageOrStipend, existing.packageOrStipend);
      const nextDate = asNonEmptyTrimmedString(interviewDate, existing.interviewDate);
      const nextOverallExp = asNonEmptyTrimmedString(overallExperience, existing.overallExperience);
      const nextTips = asNonEmptyTrimmedString(keyPreparationTips, existing.keyPreparationTips);
      const nextResUsed = asNonEmptyTrimmedString(resourcesUsed, existing.resourcesUsed);

      if (
        nextCompanyName === null ||
        nextRoleTitle === null ||
        nextCompanyDomain === null ||
        nextSkillsNeeded === null ||
        nextPackage === null ||
        nextDate === null ||
        nextOverallExp === null ||
        nextTips === null ||
        nextResUsed === null
      ) {
        res.status(400).json({ error: 'All text fields must be valid text strings.' });
        return;
      }

      await db.transaction(async (tx) => {
        await tx
          .update(schema.interviews)
          .set({
            companyName: nextCompanyName || existing.companyName,
            roleTitle: nextRoleTitle || existing.roleTitle,
            companyDomain: nextCompanyDomain,
            skillsNeeded: nextSkillsNeeded,
            hiringType: hiringType ?? existing.hiringType,
            packageOrStipend: nextPackage,
            interviewDate: nextDate,
            resultStatus: resultStatus ?? existing.resultStatus,
            overallDifficulty: overallDifficulty ?? existing.overallDifficulty,
            overallExperience: nextOverallExp || existing.overallExperience,
            keyPreparationTips: nextTips,
            resourcesUsed: nextResUsed,
          })
          .where(eq(schema.interviews.id, id));

        if (Array.isArray(rounds)) {
          await tx
            .delete(schema.interviewRounds)
            .where(eq(schema.interviewRounds.interviewId, id));

          if (rounds.length > 0) {
            await tx.insert(schema.interviewRounds).values(
              rounds.map((r, idx) => ({
                interviewId: id,
                roundNumber: Number(r.roundNumber) || idx + 1,
                roundTitle:
                  (typeof r.roundTitle === 'string' && r.roundTitle.trim()) ||
                  `Round ${idx + 1}`,
                topicsCovered:
                  typeof r.topicsCovered === 'string' ? r.topicsCovered.trim() : '',
                questionsAsked:
                  typeof r.questionsAsked === 'string' ? r.questionsAsked.trim() : '',
                difficulty: (validDiff as readonly string[]).includes(r.difficulty || '')
                  ? r.difficulty!
                  : 'Medium',
              }))
            );
          }
        }
      });

      const updated = await getInterviewById(db, id);
      res.json(updated);
    })
  );

  app.delete(
    '/api/interviews/:id',
    requireAuth,
    asyncHandler(async (req: AuthedRequest, res: Response) => {
      const id = parseUuidParam(req.params.id);
      if (!id) {
        res.status(404).json({ error: 'Interview experience not found.' });
        return;
      }

      const db = requireDb();
      const user = req.userRecord!.user;
      const [existing] = await db
        .select()
        .from(schema.interviews)
        .where(eq(schema.interviews.id, id))
        .limit(1);

      if (!existing) {
        res.status(404).json({ error: 'Interview experience not found.' });
        return;
      }
      const canAdminModerate =
        user.role === 'admin' &&
        (hasAdminRecordPermission(req.userRecord, 'placements') ||
          hasAdminRecordPermission(req.userRecord, 'dashboard_analytics'));
      if (!canAdminModerate && existing.authorId !== user.id) {
        res.status(403).json({
          error: 'Only the author or authorized Admin can delete this entry.',
        });
        return;
      }

      await db.delete(schema.interviews).where(eq(schema.interviews.id, id));
      res.json({ ok: true });
    })
  );

  // 11. Our Projects
  app.post(
    '/api/projects',
    requireAuth,
    asyncHandler(async (req: AuthedRequest, res: Response) => {
      const db = requireDb();
      const user = req.userRecord!.user;
      const { projectName, websiteType, projectLink, technologies, description } =
        req.body as {
          projectName?: string;
          websiteType?: string;
          projectLink?: string;
          technologies?: string;
          description?: string;
        };

      if (
        typeof projectName !== 'string' ||
        !projectName.trim() ||
        typeof description !== 'string' ||
        !description.trim()
      ) {
        res.status(400).json({
          error: 'Project name, link, and description are required.',
        });
        return;
      }

      const safeLink = normalizeHttpUrlInput(projectLink, {
        required: true,
        label: 'Project Link',
      });
      if (!safeLink.ok) {
        res.status(400).json({ error: safeLink.error });
        return;
      }

      const [inserted] = await db
        .insert(schema.projects)
        .values({
          projectName: projectName.trim(),
          websiteType:
            typeof websiteType === 'string' && websiteType.trim()
              ? websiteType.trim()
              : 'Web Application',
          projectLink: safeLink.value,
          technologies: typeof technologies === 'string' ? technologies.trim() : '',
          description: description.trim(),
          authorId: user.id,
        })
        .returning();

      const item = await getProjectById(db, inserted.id);
      res.status(201).json(item);
    })
  );

  app.put(
    '/api/projects/:id',
    requireAuth,
    asyncHandler(async (req: AuthedRequest, res: Response) => {
      const id = parseUuidParam(req.params.id);
      if (!id) {
        res.status(404).json({ error: 'Project not found.' });
        return;
      }

      const db = requireDb();
      const user = req.userRecord!.user;
      const [existing] = await db
        .select()
        .from(schema.projects)
        .where(eq(schema.projects.id, id))
        .limit(1);

      if (!existing) {
        res.status(404).json({ error: 'Project not found.' });
        return;
      }
      const canAdminModerate =
        user.role === 'admin' &&
        hasAdminRecordPermission(req.userRecord, 'dashboard_analytics');
      if (!canAdminModerate && existing.authorId !== user.id) {
        res.status(403).json({
          error: 'Only the original author or authorized Admin can edit this project.',
        });
        return;
      }

      const { projectName, websiteType, projectLink, technologies, description } =
        req.body as {
          projectName?: string;
          websiteType?: string;
          projectLink?: string;
          technologies?: string;
          description?: string;
        };

      let nextProjectLink = existing.projectLink;
      if (projectLink !== undefined) {
        const safeLink = normalizeHttpUrlInput(projectLink, {
          required: true,
          label: 'Project Link',
        });
        if (!safeLink.ok) {
          res.status(400).json({ error: safeLink.error });
          return;
        }
        nextProjectLink = safeLink.value;
      }

      const nextName = asNonEmptyTrimmedString(projectName, existing.projectName);
      const nextType = asNonEmptyTrimmedString(websiteType, existing.websiteType);
      const nextTech = asNonEmptyTrimmedString(technologies, existing.technologies);
      const nextDesc = asNonEmptyTrimmedString(description, existing.description);
      if (nextName === null || nextType === null || nextTech === null || nextDesc === null) {
        res.status(400).json({ error: 'Project fields must be valid text strings.' });
        return;
      }

      await db
        .update(schema.projects)
        .set({
          projectName: nextName || existing.projectName,
          websiteType: nextType,
          projectLink: nextProjectLink,
          technologies: nextTech,
          description: nextDesc || existing.description,
        })
        .where(eq(schema.projects.id, id));

      const updated = await getProjectById(db, id);
      res.json(updated);
    })
  );

  app.delete(
    '/api/projects/:id',
    requireAuth,
    asyncHandler(async (req: AuthedRequest, res: Response) => {
      const id = parseUuidParam(req.params.id);
      if (!id) {
        res.status(404).json({ error: 'Project not found.' });
        return;
      }

      const db = requireDb();
      const user = req.userRecord!.user;
      const [existing] = await db
        .select()
        .from(schema.projects)
        .where(eq(schema.projects.id, id))
        .limit(1);

      if (!existing) {
        res.status(404).json({ error: 'Project not found.' });
        return;
      }
      const canAdminModerate =
        user.role === 'admin' &&
        hasAdminRecordPermission(req.userRecord, 'dashboard_analytics');
      if (!canAdminModerate && existing.authorId !== user.id) {
        res.status(403).json({
          error: 'Only the original author or authorized Admin can delete this project.',
        });
        return;
      }

      await db.delete(schema.projects).where(eq(schema.projects.id, id));
      res.json({ ok: true });
    })
  );

  // 12. Problem Statements
  app.post(
    '/api/problems',
    requireAuth,
    asyncHandler(async (req: AuthedRequest, res: Response) => {
      const db = requireDb();
      const user = req.userRecord!.user;
      const { title, applicationName, category, description, contactInfo, contactEmail } =
        req.body as {
          title?: string;
          applicationName?: string;
          category?: string;
          description?: string;
          contactInfo?: string;
          contactEmail?: string;
        };

      if (
        typeof title !== 'string' ||
        !title.trim() ||
        typeof description !== 'string' ||
        !description.trim() ||
        typeof contactInfo !== 'string' ||
        !contactInfo.trim()
      ) {
        res.status(400).json({
          error: 'Problem title, description, and contact information are required.',
        });
        return;
      }

      const createdId = await db.transaction(async (tx) => {
        const [inserted] = await tx
          .insert(schema.problems)
          .values({
            title: title.trim(),
            applicationName:
              typeof applicationName === 'string' && applicationName.trim()
                ? applicationName.trim()
                : 'General Application',
            category:
              typeof category === 'string' && category.trim()
                ? category.trim()
                : 'Software Issue',
            description: description.trim(),
            contactInfo: contactInfo.trim(),
            contactEmail:
              typeof contactEmail === 'string' && contactEmail.trim()
                ? contactEmail.trim()
                : user.email,
            status: 'open',
            authorId: user.id,
          })
          .returning();

        const [notif] = await tx
          .insert(schema.notifications)
          .values({
            type: 'problem_posted',
            title: `New Problem Statement: ${inserted.title}`,
            message: `${user.name} (${user.memberId}) posted a problem in ${inserted.applicationName}. Open to message or propose a fix.`,
            targetSection: 'problems',
            targetItemId: inserted.id,
            actorId: user.id,
            actorNameSnapshot: user.name,
          })
          .returning();

        await tx
          .insert(schema.notificationReads)
          .values({ notificationId: notif.id, userId: user.id })
          .onConflictDoNothing();

        return inserted.id;
      });

      const item = await getProblemById(db, createdId);
      res.status(201).json(item);
    })
  );

  app.put(
    '/api/problems/:id',
    requireAuth,
    asyncHandler(async (req: AuthedRequest, res: Response) => {
      const id = parseUuidParam(req.params.id);
      if (!id) {
        res.status(404).json({ error: 'Problem statement not found.' });
        return;
      }

      const db = requireDb();
      const user = req.userRecord!.user;
      const [existing] = await db
        .select()
        .from(schema.problems)
        .where(eq(schema.problems.id, id))
        .limit(1);

      if (!existing) {
        res.status(404).json({ error: 'Problem statement not found.' });
        return;
      }
      const canAdminModerate =
        user.role === 'admin' &&
        hasAdminRecordPermission(req.userRecord, 'dashboard_analytics');
      if (!canAdminModerate && existing.authorId !== user.id) {
        res.status(403).json({
          error: 'Only the original author or authorized Admin can edit this problem statement.',
        });
        return;
      }

      const {
        title,
        applicationName,
        category,
        description,
        contactInfo,
        contactEmail,
        status,
      } = req.body as {
        title?: string;
        applicationName?: string;
        category?: string;
        description?: string;
        contactInfo?: string;
        contactEmail?: string;
        status?: 'open' | 'solved';
      };

      const nextTitle = asNonEmptyTrimmedString(title, existing.title);
      const nextAppName = asNonEmptyTrimmedString(applicationName, existing.applicationName);
      const nextCat = asNonEmptyTrimmedString(category, existing.category);
      const nextDesc = asNonEmptyTrimmedString(description, existing.description);
      const nextContactInfo = asNonEmptyTrimmedString(contactInfo, existing.contactInfo);
      const nextContactEmail = asNonEmptyTrimmedString(contactEmail, existing.contactEmail);
      if (
        nextTitle === null ||
        nextAppName === null ||
        nextCat === null ||
        nextDesc === null ||
        nextContactInfo === null ||
        nextContactEmail === null
      ) {
        res.status(400).json({ error: 'Problem fields must be valid text strings.' });
        return;
      }

      await db
        .update(schema.problems)
        .set({
          title: nextTitle || existing.title,
          applicationName: nextAppName || existing.applicationName,
          category: nextCat || existing.category,
          description: nextDesc || existing.description,
          contactInfo: nextContactInfo || existing.contactInfo,
          contactEmail: nextContactEmail || existing.contactEmail,
          status: status === 'open' || status === 'solved' ? status : existing.status,
        })
        .where(eq(schema.problems.id, id));

      const updated = await getProblemById(db, id);
      res.json(updated);
    })
  );

  app.delete(
    '/api/problems/:id',
    requireAuth,
    asyncHandler(async (req: AuthedRequest, res: Response) => {
      const id = parseUuidParam(req.params.id);
      if (!id) {
        res.status(404).json({ error: 'Problem statement not found.' });
        return;
      }

      const db = requireDb();
      const user = req.userRecord!.user;
      const [existing] = await db
        .select()
        .from(schema.problems)
        .where(eq(schema.problems.id, id))
        .limit(1);

      if (!existing) {
        res.status(404).json({ error: 'Problem statement not found.' });
        return;
      }
      const canAdminModerate =
        user.role === 'admin' &&
        hasAdminRecordPermission(req.userRecord, 'dashboard_analytics');
      if (!canAdminModerate && existing.authorId !== user.id) {
        res.status(403).json({
          error: 'Only the original author or authorized Admin can delete this post.',
        });
        return;
      }

      await db.delete(schema.problems).where(eq(schema.problems.id, id));
      res.json({ ok: true });
    })
  );

  app.post(
    '/api/problems/:id/respond',
    requireAuth,
    asyncHandler(async (req: AuthedRequest, res: Response) => {
      const id = parseUuidParam(req.params.id);
      if (!id) {
        res.status(404).json({ error: 'Problem statement not found.' });
        return;
      }

      const db = requireDb();
      const user = req.userRecord!.user;
      const [existing] = await db
        .select()
        .from(schema.problems)
        .where(eq(schema.problems.id, id))
        .limit(1);

      if (!existing) {
        res.status(404).json({ error: 'Problem statement not found.' });
        return;
      }

      const { message, solutionLink, marksSolved } = req.body as {
        message?: string;
        solutionLink?: string;
        marksSolved?: boolean;
      };
      if (typeof message !== 'string' || !message.trim()) {
        res.status(400).json({ error: 'Please enter a message or solution note.' });
        return;
      }

      const safeSolLink = normalizeHttpUrlInput(solutionLink, {
        required: false,
        label: 'Solution Link',
      });
      if (!safeSolLink.ok) {
        res.status(400).json({ error: safeSolLink.error });
        return;
      }

      const trimmedMessage = message.trim();
      const solvedFlag = Boolean(marksSolved);
      const canMarkProblemSolved =
        (user.role === 'admin' &&
          hasAdminRecordPermission(req.userRecord, 'dashboard_analytics')) ||
        existing.authorId === user.id;

      await db.transaction(async (tx) => {
        await tx.insert(schema.problemResponses).values({
          problemId: id,
          senderId: user.id,
          message: trimmedMessage,
          solutionLink: safeSolLink.value,
          marksSolved: solvedFlag,
        });

        if (solvedFlag) {
          if (canMarkProblemSolved) {
            await tx
              .update(schema.problems)
              .set({ status: 'solved' })
              .where(eq(schema.problems.id, id));
          }

          if (user.role === 'student' && user.isActive) {
            await tx
              .insert(schema.problemSolvers)
              .values({ problemId: id, userId: user.id })
              .onConflictDoNothing();
          }
        }

        if (existing.authorId !== user.id) {
          await tx.insert(schema.notifications).values({
            type: 'problem_message',
            title: `Message on "${existing.title}"`,
            message: `${user.name} (${user.memberId}) sent a ${
              solvedFlag ? 'working solution' : 'direct message'
            }: "${trimmedMessage.slice(0, 90)}"`,
            targetSection: 'problems',
            targetItemId: id,
            recipientUserId: existing.authorId,
            actorId: user.id,
            actorNameSnapshot: user.name,
          });
        }
      });

      const [problem, progress] = await Promise.all([
        getProblemById(db, id),
        computeUserProgress(db, user.id),
      ]);

      res.status(201).json({ problem, progress });
    })
  );

  // 13. Apps & Technologies
  app.post(
    '/api/apps',
    requireAuth,
    asyncHandler(async (req: AuthedRequest, res: Response) => {
      const db = requireDb();
      const user = req.userRecord!.user;
      const { appName, usedTechnologies, description, appType, appLink } = req.body as {
        appName?: string;
        usedTechnologies?: string;
        description?: string;
        appType?: string;
        appLink?: string;
      };

      if (
        typeof appName !== 'string' ||
        !appName.trim() ||
        typeof usedTechnologies !== 'string' ||
        !usedTechnologies.trim()
      ) {
        res.status(400).json({
          error: 'App Name, Used Technologies, and App Link are required.',
        });
        return;
      }

      const safeAppLink = normalizeHttpUrlInput(appLink, {
        required: true,
        label: 'App Link',
      });
      if (!safeAppLink.ok) {
        res.status(400).json({ error: safeAppLink.error });
        return;
      }

      const [inserted] = await db
        .insert(schema.appTechnologies)
        .values({
          appName: appName.trim(),
          usedTechnologies: usedTechnologies.trim(),
          description: typeof description === 'string' ? description.trim() : '',
          appType:
            typeof appType === 'string' && appType.trim()
              ? appType.trim()
              : 'Web Application',
          appLink: safeAppLink.value,
          authorId: user.id,
        })
        .returning();

      const item = await getAppById(db, inserted.id);
      res.status(201).json(item);
    })
  );

  app.put(
    '/api/apps/:id',
    requireAuth,
    asyncHandler(async (req: AuthedRequest, res: Response) => {
      const id = parseUuidParam(req.params.id);
      if (!id) {
        res.status(404).json({ error: 'App entry not found.' });
        return;
      }

      const db = requireDb();
      const user = req.userRecord!.user;
      const [existing] = await db
        .select()
        .from(schema.appTechnologies)
        .where(eq(schema.appTechnologies.id, id))
        .limit(1);

      if (!existing) {
        res.status(404).json({ error: 'App entry not found.' });
        return;
      }
      const canAdminModerate =
        user.role === 'admin' &&
        hasAdminRecordPermission(req.userRecord, 'dashboard_analytics');
      if (!canAdminModerate && existing.authorId !== user.id) {
        res.status(403).json({
          error: 'Only the original uploader or authorized Admin can edit this app.',
        });
        return;
      }

      const { appName, usedTechnologies, description, appType, appLink } = req.body as {
        appName?: string;
        usedTechnologies?: string;
        description?: string;
        appType?: string;
        appLink?: string;
      };

      let nextAppLink = existing.appLink;
      if (appLink !== undefined) {
        const safeAppLink = normalizeHttpUrlInput(appLink, {
          required: true,
          label: 'App Link',
        });
        if (!safeAppLink.ok) {
          res.status(400).json({ error: safeAppLink.error });
          return;
        }
        nextAppLink = safeAppLink.value;
      }

      const nextAppName = asNonEmptyTrimmedString(appName, existing.appName);
      const nextUsedTech = asNonEmptyTrimmedString(usedTechnologies, existing.usedTechnologies);
      const nextDesc = asNonEmptyTrimmedString(description, existing.description);
      const nextType = asNonEmptyTrimmedString(appType, existing.appType);
      if (
        nextAppName === null ||
        nextUsedTech === null ||
        nextDesc === null ||
        nextType === null
      ) {
        res.status(400).json({ error: 'App fields must be valid text strings.' });
        return;
      }

      await db
        .update(schema.appTechnologies)
        .set({
          appName: nextAppName || existing.appName,
          usedTechnologies: nextUsedTech || existing.usedTechnologies,
          description: nextDesc,
          appType: nextType,
          appLink: nextAppLink,
        })
        .where(eq(schema.appTechnologies.id, id));

      const updated = await getAppById(db, id);
      res.json(updated);
    })
  );

  app.delete(
    '/api/apps/:id',
    requireAuth,
    asyncHandler(async (req: AuthedRequest, res: Response) => {
      const id = parseUuidParam(req.params.id);
      if (!id) {
        res.status(404).json({ error: 'App entry not found.' });
        return;
      }

      const db = requireDb();
      const user = req.userRecord!.user;
      const [existing] = await db
        .select()
        .from(schema.appTechnologies)
        .where(eq(schema.appTechnologies.id, id))
        .limit(1);

      if (!existing) {
        res.status(404).json({ error: 'App entry not found.' });
        return;
      }
      const canAdminModerate =
        user.role === 'admin' &&
        hasAdminRecordPermission(req.userRecord, 'dashboard_analytics');
      if (!canAdminModerate && existing.authorId !== user.id) {
        res.status(403).json({
          error: 'Only the original uploader or authorized Admin can delete this app.',
        });
        return;
      }

      await db.delete(schema.appTechnologies).where(eq(schema.appTechnologies.id, id));
      res.json({ ok: true });
    })
  );

  // 14. Placements
  app.post(
    '/api/placements',
    requireAuth,
    asyncHandler(async (req: AuthedRequest, res: Response) => {
      const db = requireDb();
      const user = req.userRecord!.user;
      if (user.role !== 'faculty' && user.role !== 'admin') {
        res.status(403).json({
          error: 'Students do not have permission to add Placement Drives.',
        });
        return;
      }
      if (user.role === 'admin' && !hasAdminRecordPermission(req.userRecord, 'placements')) {
        res.status(403).json({
          error: "Access denied: Requires 'Placements' administrator permission.",
        });
        return;
      }

      const {
        companyName,
        roleTitle,
        packageCtc,
        location,
        deadline,
        applyLink,
        description,
        criteria,
      } = req.body as {
        companyName?: string;
        roleTitle?: string;
        packageCtc?: string;
        location?: string;
        deadline?: string;
        applyLink?: string;
        description?: string;
        criteria?: {
          requireCgpa?: boolean;
          minCgpa?: number;
          requireLeetcode?: boolean;
          minLeetcodeProblems?: number;
          requireHackerrank?: boolean;
          minHackerrankFiveStars?: number;
          requireGithub?: boolean;
          minGithubProjects?: number;
        };
      };

      if (
        typeof companyName !== 'string' ||
        !companyName.trim() ||
        typeof roleTitle !== 'string' ||
        !roleTitle.trim() ||
        typeof packageCtc !== 'string' ||
        !packageCtc.trim()
      ) {
        res.status(400).json({
          error: 'Company name, role title, and package CTC are required.',
        });
        return;
      }

      const safeApplyLink = normalizeHttpUrlInput(applyLink, {
        required: false,
        label: 'Apply / Company Notice Link',
      });
      if (!safeApplyLink.ok) {
        res.status(400).json({ error: safeApplyLink.error });
        return;
      }

      const createdId = await db.transaction(async (tx) => {
        const [inserted] = await tx
          .insert(schema.placementDrives)
          .values({
            companyName: companyName.trim(),
            roleTitle: roleTitle.trim(),
            packageCtc: packageCtc.trim(),
            location:
              typeof location === 'string' && location.trim()
                ? location.trim()
                : 'On-Campus / Hybrid',
            deadline:
              typeof deadline === 'string' && deadline.trim()
                ? deadline.trim()
                : '2026-12-15',
            applyLink: safeApplyLink.value,
            description: typeof description === 'string' ? description.trim() : '',
            requireCgpa: Boolean(criteria?.requireCgpa),
            minCgpa: Math.max(0, Math.min(10, Number(criteria?.minCgpa) || 0)).toFixed(2),
            requireLeetcode: Boolean(criteria?.requireLeetcode),
            minLeetcodeProblems: Math.max(0, Number(criteria?.minLeetcodeProblems) || 0),
            requireHackerrank: Boolean(criteria?.requireHackerrank),
            minHackerrankFiveStars: Math.max(0, Number(criteria?.minHackerrankFiveStars) || 0),
            requireGithub: Boolean(criteria?.requireGithub),
            minGithubProjects: Math.max(0, Number(criteria?.minGithubProjects) || 0),
            authorId: user.id,
            authorNameSnapshot: user.name,
          })
          .returning();

        const [notif] = await tx
          .insert(schema.notifications)
          .values({
            type: 'placement_posted',
            title: `New Placement Drive: ${inserted.companyName} (${inserted.packageCtc})`,
            message: `${inserted.roleTitle} applications are open until ${inserted.deadline}. Check your eligibility criteria.`,
            targetSection: 'placements',
            targetItemId: inserted.id,
            actorId: user.id,
            actorNameSnapshot: user.name,
          })
          .returning();

        await tx
          .insert(schema.notificationReads)
          .values({ notificationId: notif.id, userId: user.id })
          .onConflictDoNothing();

        return inserted.id;
      });

      const item = await getPlacementDriveById(db, createdId, user, {
        viewerHasAdminPlacementAccess:
          user.role === 'admin' ? hasAdminRecordPermission(req.userRecord, 'placements') : true,
      });
      res.status(201).json(item);
    })
  );

  app.put(
    '/api/placements/:id',
    requireAuth,
    asyncHandler(async (req: AuthedRequest, res: Response) => {
      const user = req.userRecord!.user;
      if (user.role !== 'faculty' && user.role !== 'admin') {
        res.status(403).json({ error: 'Only Faculty and Admin can modify Placement Drives.' });
        return;
      }
      if (user.role === 'admin' && !hasAdminRecordPermission(req.userRecord, 'placements')) {
        res.status(403).json({
          error: "Access denied: Requires 'Placements' administrator permission.",
        });
        return;
      }

      const id = parseUuidParam(req.params.id);
      if (!id) {
        res.status(404).json({ error: 'Placement drive not found.' });
        return;
      }

      const db = requireDb();
      const [existing] = await db
        .select()
        .from(schema.placementDrives)
        .where(eq(schema.placementDrives.id, id))
        .limit(1);

      if (!existing) {
        res.status(404).json({ error: 'Placement drive not found.' });
        return;
      }
      if (user.role !== 'admin' && existing.authorId !== user.id) {
        res.status(403).json({
          error: 'Only the posting Faculty coordinator or Admin can edit this drive.',
        });
        return;
      }

      const {
        companyName,
        roleTitle,
        packageCtc,
        location,
        deadline,
        applyLink,
        description,
        criteria,
      } = req.body as {
        companyName?: string;
        roleTitle?: string;
        packageCtc?: string;
        location?: string;
        deadline?: string;
        applyLink?: string;
        description?: string;
        criteria?: {
          requireCgpa?: boolean;
          minCgpa?: number;
          requireLeetcode?: boolean;
          minLeetcodeProblems?: number;
          requireHackerrank?: boolean;
          minHackerrankFiveStars?: number;
          requireGithub?: boolean;
          minGithubProjects?: number;
        };
      };

      let nextApplyLink = existing.applyLink;
      if (applyLink !== undefined) {
        const safeApplyLink = normalizeHttpUrlInput(applyLink, {
          required: false,
          label: 'Apply / Company Notice Link',
        });
        if (!safeApplyLink.ok) {
          res.status(400).json({ error: safeApplyLink.error });
          return;
        }
        nextApplyLink = safeApplyLink.value;
      }

      const nextCompany = asNonEmptyTrimmedString(companyName, existing.companyName);
      const nextRole = asNonEmptyTrimmedString(roleTitle, existing.roleTitle);
      const nextCtc = asNonEmptyTrimmedString(packageCtc, existing.packageCtc);
      const nextLoc = asNonEmptyTrimmedString(location, existing.location);
      const nextDeadline = asNonEmptyTrimmedString(deadline, existing.deadline);
      const nextDesc = asNonEmptyTrimmedString(description, existing.description);
      if (
        nextCompany === null ||
        nextRole === null ||
        nextCtc === null ||
        nextLoc === null ||
        nextDeadline === null ||
        nextDesc === null
      ) {
        res.status(400).json({ error: 'Placement fields must be valid text strings.' });
        return;
      }

      await db
        .update(schema.placementDrives)
        .set({
          companyName: nextCompany || existing.companyName,
          roleTitle: nextRole || existing.roleTitle,
          packageCtc: nextCtc || existing.packageCtc,
          location: nextLoc,
          deadline: nextDeadline,
          applyLink: nextApplyLink,
          description: nextDesc,
          ...(criteria !== undefined
            ? {
                requireCgpa: Boolean(criteria.requireCgpa),
                minCgpa: Math.max(0, Math.min(10, Number(criteria.minCgpa) || 0)).toFixed(2),
                requireLeetcode: Boolean(criteria.requireLeetcode),
                minLeetcodeProblems: Math.max(0, Number(criteria.minLeetcodeProblems) || 0),
                requireHackerrank: Boolean(criteria.requireHackerrank),
                minHackerrankFiveStars: Math.max(
                  0,
                  Number(criteria.minHackerrankFiveStars) || 0
                ),
                requireGithub: Boolean(criteria.requireGithub),
                minGithubProjects: Math.max(0, Number(criteria.minGithubProjects) || 0),
              }
            : {}),
        })
        .where(eq(schema.placementDrives.id, id));

      const updated = await getPlacementDriveById(db, id, user, {
        viewerHasAdminPlacementAccess: true,
      });
      res.json(updated);
    })
  );

  app.delete(
    '/api/placements/:id',
    requireAuth,
    asyncHandler(async (req: AuthedRequest, res: Response) => {
      const user = req.userRecord!.user;
      if (user.role !== 'faculty' && user.role !== 'admin') {
        res.status(403).json({ error: 'Only Faculty and Admin can delete Placement Drives.' });
        return;
      }
      if (user.role === 'admin' && !hasAdminRecordPermission(req.userRecord, 'placements')) {
        res.status(403).json({
          error: "Access denied: Requires 'Placements' administrator permission.",
        });
        return;
      }

      const id = parseUuidParam(req.params.id);
      if (!id) {
        res.status(404).json({ error: 'Placement drive not found.' });
        return;
      }

      const db = requireDb();
      const [existing] = await db
        .select()
        .from(schema.placementDrives)
        .where(eq(schema.placementDrives.id, id))
        .limit(1);

      if (!existing) {
        res.status(404).json({ error: 'Placement drive not found.' });
        return;
      }
      if (user.role !== 'admin' && existing.authorId !== user.id) {
        res.status(403).json({
          error: 'Only the posting Faculty coordinator or Admin can delete this drive.',
        });
        return;
      }

      await db.delete(schema.placementDrives).where(eq(schema.placementDrives.id, id));
      res.json({ ok: true });
    })
  );

  app.post(
    '/api/placements/:id/apply',
    requireAuth,
    codingVerificationRateLimiter,
    asyncHandler(async (req: AuthedRequest, res: Response) => {
      const record = req.userRecord!;
      const user = record.user;
      const sp = record.studentProfile;

      if (user.role !== 'student') {
        res.status(403).json({
          error: 'Placement applications are strictly for Student accounts.',
        });
        return;
      }

      const id = parseUuidParam(req.params.id);
      if (!id) {
        res.status(404).json({ error: 'Placement drive not found.' });
        return;
      }

      const db = requireDb();
      const [driveRow] = await db
        .select()
        .from(schema.placementDrives)
        .where(eq(schema.placementDrives.id, id))
        .limit(1);

      if (!driveRow) {
        res.status(404).json({ error: 'Placement drive not found.' });
        return;
      }

      const [existingApp] = await db
        .select({ id: schema.placementApplications.id })
        .from(schema.placementApplications)
        .where(
          and(
            eq(schema.placementApplications.driveId, id),
            eq(schema.placementApplications.studentId, user.id)
          )
        )
        .limit(1);

      if (existingApp) {
        res.status(409).json({ error: 'You have already applied to this placement drive.' });
        return;
      }

      const studentCgpa = sp ? Number(sp.cgpa) : 0;

      const parsedLcInput = sp?.leetcodeUrl
        ? parseCodingPlatformInput(sp.leetcodeUrl, 'leetcode')
        : sp?.leetcodeUsername
        ? parseCodingPlatformInput(sp.leetcodeUsername, 'leetcode')
        : { ok: true as const, username: '' };
      const parsedHrInput = sp?.hackerrankUrl
        ? parseCodingPlatformInput(sp.hackerrankUrl, 'hackerrank')
        : sp?.hackerrankUsername
        ? parseCodingPlatformInput(sp.hackerrankUsername, 'hackerrank')
        : { ok: true as const, username: '' };
      const parsedGhInput = sp?.githubUrl
        ? parseCodingPlatformInput(sp.githubUrl, 'github')
        : sp?.githubUsername
        ? parseCodingPlatformInput(sp.githubUsername, 'github')
        : { ok: true as const, username: '' };

      const lcHandle = parsedLcInput.ok ? parsedLcInput.username : '';
      const hrHandle = parsedHrInput.ok ? parsedHrInput.username : '';
      const ghHandle = parsedGhInput.ok ? parsedGhInput.username : '';

      const nowMs = Date.now();
      let lcStatsVerified = Boolean(
        lcHandle &&
          sp?.leetcodeVerifiedAt &&
          isWithinVerificationTtl(sp.leetcodeVerifiedAt, nowMs) &&
          sp.leetcodeUsername.toLowerCase() === lcHandle.toLowerCase()
      );
      let hrStatsVerified = Boolean(
        hrHandle &&
          sp?.hackerrankVerifiedAt &&
          isWithinVerificationTtl(sp.hackerrankVerifiedAt, nowMs) &&
          sp.hackerrankUsername.toLowerCase() === hrHandle.toLowerCase()
      );
      let ghStatsVerified = Boolean(
        ghHandle &&
          sp?.githubVerifiedAt &&
          isWithinVerificationTtl(sp.githubVerifiedAt, nowMs) &&
          sp.githubUsername.toLowerCase() === ghHandle.toLowerCase()
      );

      let lcOwnerVerified = Boolean(
        lcHandle &&
          sp?.leetcodeOwnerVerifiedAt &&
          sp.leetcodeUsername.toLowerCase() === lcHandle.toLowerCase()
      );
      let hrOwnerVerified = Boolean(
        hrHandle &&
          sp?.hackerrankOwnerVerifiedAt &&
          sp.hackerrankUsername.toLowerCase() === hrHandle.toLowerCase()
      );
      let ghOwnerVerified = Boolean(
        ghHandle &&
          sp?.githubOwnerVerifiedAt &&
          sp.githubUsername.toLowerCase() === ghHandle.toLowerCase()
      );

      let studentLc = lcStatsVerified ? sp?.leetcodeSolved ?? 0 : 0;
      let studentHr = hrStatsVerified ? sp?.hackerrankFiveStars ?? 0 : 0;
      let studentGh = ghStatsVerified ? sp?.githubProjects ?? 0 : 0;

      const shouldFetchLc =
        driveRow.requireLeetcode &&
        Boolean(lcHandle) &&
        lcOwnerVerified &&
        !(
          lcStatsVerified &&
          sp?.leetcodeVerifiedAt &&
          nowMs - sp.leetcodeVerifiedAt.getTime() <= CODING_STATS_CACHE_TTL_MS
        );
      const shouldFetchHr =
        driveRow.requireHackerrank &&
        Boolean(hrHandle) &&
        hrOwnerVerified &&
        !(
          hrStatsVerified &&
          sp?.hackerrankVerifiedAt &&
          nowMs - sp.hackerrankVerifiedAt.getTime() <= CODING_STATS_CACHE_TTL_MS
        );
      const shouldFetchGh =
        driveRow.requireGithub &&
        Boolean(ghHandle) &&
        ghOwnerVerified &&
        !(
          ghStatsVerified &&
          sp?.githubVerifiedAt &&
          nowMs - sp.githubVerifiedAt.getTime() <= CODING_STATS_CACHE_TTL_MS
        );

      let canPerformLiveSync = false;
      if (sp && (shouldFetchLc || shouldFetchHr || shouldFetchGh)) {
        const cooldownCutoff = new Date(nowMs - CODING_SYNC_COOLDOWN_MS);
        const claimedRows = await db
          .update(schema.studentProfiles)
          .set({ codingSyncAttemptedAt: new Date(nowMs) })
          .where(
            and(
              eq(schema.studentProfiles.userId, user.id),
              or(
                isNull(schema.studentProfiles.codingSyncAttemptedAt),
                sql`${schema.studentProfiles.codingSyncAttemptedAt} <= ${cooldownCutoff}`
              )
            )
          )
          .returning({ userId: schema.studentProfiles.userId });
        canPerformLiveSync = claimedRows.length > 0;
      }

      const [liveLcCheck, liveHrCheck, liveGhCheck] = await Promise.all([
        shouldFetchLc && canPerformLiveSync ? fetchLeetcodeCounts(lcHandle) : Promise.resolve(null),
        shouldFetchHr && canPerformLiveSync
          ? fetchHackerrankFiveStars(hrHandle)
          : Promise.resolve(null),
        shouldFetchGh && canPerformLiveSync ? fetchGithubRepoCount(ghHandle) : Promise.resolve(null),
      ]);

      if (sp) {
        const verifiedAtNow = new Date();
        const profileRefreshFields: Partial<typeof schema.studentProfiles.$inferInsert> = {};
        if (liveLcCheck?.status === 'ok') {
          studentLc = liveLcCheck.total;
          lcStatsVerified = true;
          profileRefreshFields.leetcodeUsername = lcHandle;
          profileRefreshFields.leetcodeSolved = liveLcCheck.total;
          profileRefreshFields.leetcodeEasy = liveLcCheck.easy;
          profileRefreshFields.leetcodeMedium = liveLcCheck.medium;
          profileRefreshFields.leetcodeHard = liveLcCheck.hard;
          profileRefreshFields.leetcodeVerifiedAt = verifiedAtNow;
          profileRefreshFields.lastSyncedAt = verifiedAtNow;
        } else if (liveLcCheck?.status === 'not_found') {
          studentLc = 0;
          lcStatsVerified = false;
          lcOwnerVerified = false;
          profileRefreshFields.leetcodeSolved = 0;
          profileRefreshFields.leetcodeEasy = 0;
          profileRefreshFields.leetcodeMedium = 0;
          profileRefreshFields.leetcodeHard = 0;
          profileRefreshFields.leetcodeVerifiedAt = null;
          profileRefreshFields.leetcodeOwnerVerifiedAt = null;
        }
        if (liveHrCheck?.status === 'ok') {
          studentHr = liveHrCheck.count;
          hrStatsVerified = true;
          profileRefreshFields.hackerrankUsername = hrHandle;
          profileRefreshFields.hackerrankFiveStars = liveHrCheck.count;
          profileRefreshFields.hackerrankVerifiedAt = verifiedAtNow;
          profileRefreshFields.lastSyncedAt = verifiedAtNow;
        } else if (liveHrCheck?.status === 'not_found') {
          studentHr = 0;
          hrStatsVerified = false;
          hrOwnerVerified = false;
          profileRefreshFields.hackerrankFiveStars = 0;
          profileRefreshFields.hackerrankVerifiedAt = null;
          profileRefreshFields.hackerrankOwnerVerifiedAt = null;
        }
        if (liveGhCheck?.status === 'ok') {
          studentGh = liveGhCheck.count;
          ghStatsVerified = true;
          profileRefreshFields.githubUsername = ghHandle;
          profileRefreshFields.githubProjects = liveGhCheck.count;
          profileRefreshFields.githubVerifiedAt = verifiedAtNow;
          profileRefreshFields.lastSyncedAt = verifiedAtNow;
        } else if (liveGhCheck?.status === 'not_found') {
          studentGh = 0;
          ghStatsVerified = false;
          ghOwnerVerified = false;
          profileRefreshFields.githubProjects = 0;
          profileRefreshFields.githubVerifiedAt = null;
          profileRefreshFields.githubOwnerVerifiedAt = null;
        }
        if (Object.keys(profileRefreshFields).length > 0) {
          await db
            .update(schema.studentProfiles)
            .set(profileRefreshFields)
            .where(eq(schema.studentProfiles.userId, user.id));
        }
      }

      const unmet: string[] = [];
      if (driveRow.requireCgpa && studentCgpa < Number(driveRow.minCgpa)) {
        unmet.push(`CGPA ${Number(driveRow.minCgpa)}+ required (yours: ${studentCgpa})`);
      }

      if (driveRow.requireLeetcode) {
        if (!lcHandle) {
          unmet.push(
            `LeetCode ${driveRow.minLeetcodeProblems}+ problems required (no valid LeetCode profile linked)`
          );
        } else if (!lcOwnerVerified) {
          unmet.push(
            `LeetCode profile "@${lcHandle}" ownership verification is required before applying to LeetCode-gated drives`
          );
        } else if (liveLcCheck?.status === 'not_found') {
          unmet.push(
            `LeetCode profile "@${lcHandle}" could not be found; please update a valid URL in My Profile`
          );
        } else if (shouldFetchLc && (!liveLcCheck || liveLcCheck.status === 'unavailable')) {
          if (lcStatsVerified && isWithinVerificationTtl(sp?.leetcodeVerifiedAt, nowMs)) {
            if (studentLc < driveRow.minLeetcodeProblems) {
              unmet.push(
                `LeetCode ${driveRow.minLeetcodeProblems}+ problems required (verified: ${studentLc})`
              );
            }
          } else {
            unmet.push(
              canPerformLiveSync || !shouldFetchLc
                ? `LeetCode live verification is currently unavailable for "@${lcHandle}"; please try again shortly`
                : `LeetCode verification cooldown is active; please wait 15 seconds and try again`
            );
          }
        } else if (!lcStatsVerified || studentLc < driveRow.minLeetcodeProblems) {
          unmet.push(
            `LeetCode ${driveRow.minLeetcodeProblems}+ problems required (verified: ${studentLc})`
          );
        }
      }

      if (driveRow.requireHackerrank) {
        if (!hrHandle) {
          unmet.push(
            `HackerRank ${driveRow.minHackerrankFiveStars}+ 5-star badges required (no valid HackerRank profile linked)`
          );
        } else if (!hrOwnerVerified) {
          unmet.push(
            `HackerRank profile "@${hrHandle}" ownership verification is required before applying to HackerRank-gated drives`
          );
        } else if (liveHrCheck?.status === 'not_found') {
          unmet.push(
            `HackerRank profile "@${hrHandle}" could not be found; please update a valid URL in My Profile`
          );
        } else if (shouldFetchHr && (!liveHrCheck || liveHrCheck.status === 'unavailable')) {
          if (hrStatsVerified && isWithinVerificationTtl(sp?.hackerrankVerifiedAt, nowMs)) {
            if (studentHr < driveRow.minHackerrankFiveStars) {
              unmet.push(
                `HackerRank ${driveRow.minHackerrankFiveStars}+ 5-star badges required (verified: ${studentHr})`
              );
            }
          } else {
            unmet.push(
              canPerformLiveSync || !shouldFetchHr
                ? `HackerRank live verification is currently unavailable for "@${hrHandle}"; please try again shortly`
                : `HackerRank verification cooldown is active; please wait 15 seconds and try again`
            );
          }
        } else if (!hrStatsVerified || studentHr < driveRow.minHackerrankFiveStars) {
          unmet.push(
            `HackerRank ${driveRow.minHackerrankFiveStars}+ 5-star badges required (verified: ${studentHr})`
          );
        }
      }

      if (driveRow.requireGithub) {
        if (!ghHandle) {
          unmet.push(
            `GitHub ${driveRow.minGithubProjects}+ projects required (no valid GitHub profile linked)`
          );
        } else if (!ghOwnerVerified) {
          unmet.push(
            `GitHub profile "@${ghHandle}" ownership verification is required before applying to GitHub-gated drives`
          );
        } else if (liveGhCheck?.status === 'not_found') {
          unmet.push(
            `GitHub profile "@${ghHandle}" could not be found; please update a valid URL in My Profile`
          );
        } else if (shouldFetchGh && (!liveGhCheck || liveGhCheck.status === 'unavailable')) {
          if (ghStatsVerified && isWithinVerificationTtl(sp?.githubVerifiedAt, nowMs)) {
            if (studentGh < driveRow.minGithubProjects) {
              unmet.push(
                `GitHub ${driveRow.minGithubProjects}+ projects required (verified: ${studentGh})`
              );
            }
          } else {
            unmet.push(
              canPerformLiveSync || !shouldFetchGh
                ? `GitHub live verification is currently unavailable for "@${ghHandle}"; please try again shortly`
                : `GitHub verification cooldown is active; please wait 15 seconds and try again`
            );
          }
        } else if (!ghStatsVerified || studentGh < driveRow.minGithubProjects) {
          unmet.push(
            `GitHub ${driveRow.minGithubProjects}+ projects required (verified: ${studentGh})`
          );
        }
      }

      if (unmet.length > 0) {
        res.status(400).json({
          error: `Eligibility criteria not met: ${unmet.join(' · ')}. Sync your coding links in My Profile or contact Faculty/Admin to update your verified CGPA.`,
        });
        return;
      }

      const { resumeLink } = req.body as { resumeLink?: string };
      const safeResumeLink = normalizeHttpUrlInput(resumeLink, {
        required: false,
        label: 'Resume Link',
      });
      if (!safeResumeLink.ok) {
        res.status(400).json({ error: safeResumeLink.error });
        return;
      }

      try {
        await db.insert(schema.placementApplications).values({
          driveId: id,
          studentId: user.id,
          cgpaSnapshot: studentCgpa.toFixed(2),
          leetcodeSolvedSnapshot: lcStatsVerified ? studentLc : 0,
          hackerrankFiveStarsSnapshot: hrStatsVerified ? studentHr : 0,
          githubProjectsSnapshot: ghStatsVerified ? studentGh : 0,
          leetcodeSnapshotVerified: Boolean(lcStatsVerified && lcOwnerVerified),
          hackerrankSnapshotVerified: Boolean(hrStatsVerified && hrOwnerVerified),
          githubSnapshotVerified: Boolean(ghStatsVerified && ghOwnerVerified),
          resumeLink: safeResumeLink.value || sp?.githubUrl || '',
        });
      } catch (err) {
        if (isUniqueViolation(err)) {
          res.status(409).json({ error: 'You have already applied to this placement drive.' });
          return;
        }
        throw err;
      }

      const [drive, progress] = await Promise.all([
        getPlacementDriveById(db, id, user),
        computeUserProgress(db, user.id),
      ]);

      res.status(201).json({ drive, progress });
    })
  );

  // 15. Courses
  app.post(
    '/api/courses',
    requireAuth,
    asyncHandler(async (req: AuthedRequest, res: Response) => {
      const db = requireDb();
      const user = req.userRecord!.user;
      const canAdminManageCourses =
        user.role === 'admin' &&
        (hasAdminRecordPermission(req.userRecord, 'faculty') ||
          hasAdminRecordPermission(req.userRecord, 'dashboard_analytics'));
      if (user.role !== 'faculty' && !canAdminManageCourses) {
        res.status(403).json({
          error:
            user.role === 'admin'
              ? "Access denied: Requires 'Faculty' or 'Dashboard & Analytics' administrator permission."
              : 'Students do not have permission to create Department Courses.',
        });
        return;
      }

      const {
        courseCode,
        title,
        instructorName,
        semester,
        credits,
        schedule,
        prerequisites,
        description,
        resourceLink,
      } = req.body as {
        courseCode?: string;
        title?: string;
        instructorName?: string;
        semester?: string;
        credits?: number;
        schedule?: string;
        prerequisites?: string;
        description?: string;
        resourceLink?: string;
      };

      if (
        typeof courseCode !== 'string' ||
        !courseCode.trim() ||
        typeof title !== 'string' ||
        !title.trim()
      ) {
        res.status(400).json({ error: 'Course code and course title are required.' });
        return;
      }

      const safeResLink = normalizeHttpUrlInput(resourceLink, {
        required: false,
        label: 'Course Resource Link',
      });
      if (!safeResLink.ok) {
        res.status(400).json({ error: safeResLink.error });
        return;
      }

      const [inserted] = await db
        .insert(schema.courses)
        .values({
          courseCode: courseCode.trim().toUpperCase(),
          title: title.trim(),
          instructorName:
            typeof instructorName === 'string' && instructorName.trim()
              ? instructorName.trim()
              : user.name,
          semester:
            typeof semester === 'string' && semester.trim()
              ? semester.trim()
              : 'Current Semester',
          credits: Math.max(1, Math.min(12, Number(credits) || 3)),
          schedule: typeof schedule === 'string' && schedule.trim() ? schedule.trim() : 'TBA',
          prerequisites:
            typeof prerequisites === 'string' && prerequisites.trim()
              ? prerequisites.trim()
              : 'None',
          description: typeof description === 'string' ? description.trim() : '',
          resourceLink: safeResLink.value,
          authorId: user.id,
        })
        .returning();

      const item = await getCourseById(db, inserted.id, user);
      res.status(201).json(item);
    })
  );

  app.put(
    '/api/courses/:id',
    requireAuth,
    asyncHandler(async (req: AuthedRequest, res: Response) => {
      const user = req.userRecord!.user;
      const canAdminManageCourses =
        user.role === 'admin' &&
        (hasAdminRecordPermission(req.userRecord, 'faculty') ||
          hasAdminRecordPermission(req.userRecord, 'dashboard_analytics'));
      if (user.role !== 'faculty' && !canAdminManageCourses) {
        res.status(403).json({
          error:
            user.role === 'admin'
              ? "Access denied: Requires 'Faculty' or 'Dashboard & Analytics' administrator permission."
              : 'Only Faculty and authorized Admin can edit Courses.',
        });
        return;
      }

      const id = parseUuidParam(req.params.id);
      if (!id) {
        res.status(404).json({ error: 'Course not found.' });
        return;
      }

      const db = requireDb();
      const [existing] = await db
        .select()
        .from(schema.courses)
        .where(eq(schema.courses.id, id))
        .limit(1);

      if (!existing) {
        res.status(404).json({ error: 'Course not found.' });
        return;
      }
      if (!canAdminManageCourses && existing.authorId !== user.id) {
        res.status(403).json({
          error: 'Only the course instructor or authorized Admin can edit this course.',
        });
        return;
      }

      const {
        courseCode,
        title,
        instructorName,
        semester,
        credits,
        schedule,
        prerequisites,
        description,
        resourceLink,
      } = req.body as {
        courseCode?: string;
        title?: string;
        instructorName?: string;
        semester?: string;
        credits?: number;
        schedule?: string;
        prerequisites?: string;
        description?: string;
        resourceLink?: string;
      };

      let nextResLink = existing.resourceLink;
      if (resourceLink !== undefined) {
        const safeResLink = normalizeHttpUrlInput(resourceLink, {
          required: false,
          label: 'Course Resource Link',
        });
        if (!safeResLink.ok) {
          res.status(400).json({ error: safeResLink.error });
          return;
        }
        nextResLink = safeResLink.value;
      }

      const nextCode = asNonEmptyTrimmedString(courseCode, existing.courseCode);
      const nextTitle = asNonEmptyTrimmedString(title, existing.title);
      const nextInstructor = asNonEmptyTrimmedString(instructorName, existing.instructorName);
      const nextSemester = asNonEmptyTrimmedString(semester, existing.semester);
      const nextSchedule = asNonEmptyTrimmedString(schedule, existing.schedule);
      const nextPrereq = asNonEmptyTrimmedString(prerequisites, existing.prerequisites);
      const nextDesc = asNonEmptyTrimmedString(description, existing.description);
      if (
        nextCode === null ||
        nextTitle === null ||
        nextInstructor === null ||
        nextSemester === null ||
        nextSchedule === null ||
        nextPrereq === null ||
        nextDesc === null
      ) {
        res.status(400).json({ error: 'Course fields must be valid text strings.' });
        return;
      }

      await db
        .update(schema.courses)
        .set({
          courseCode: (nextCode || existing.courseCode).toUpperCase(),
          title: nextTitle || existing.title,
          instructorName: nextInstructor,
          semester: nextSemester,
          credits: credits !== undefined ? Math.max(1, Math.min(12, Number(credits) || 3)) : existing.credits,
          schedule: nextSchedule,
          prerequisites: nextPrereq,
          description: nextDesc,
          resourceLink: nextResLink,
        })
        .where(eq(schema.courses.id, id));

      const updated = await getCourseById(db, id, user);
      res.json(updated);
    })
  );

  app.delete(
    '/api/courses/:id',
    requireAuth,
    asyncHandler(async (req: AuthedRequest, res: Response) => {
      const user = req.userRecord!.user;
      const canAdminManageCourses =
        user.role === 'admin' &&
        (hasAdminRecordPermission(req.userRecord, 'faculty') ||
          hasAdminRecordPermission(req.userRecord, 'dashboard_analytics'));
      if (user.role !== 'faculty' && !canAdminManageCourses) {
        res.status(403).json({
          error:
            user.role === 'admin'
              ? "Access denied: Requires 'Faculty' or 'Dashboard & Analytics' administrator permission."
              : 'Only Faculty and authorized Admin can delete Courses.',
        });
        return;
      }

      const id = parseUuidParam(req.params.id);
      if (!id) {
        res.status(404).json({ error: 'Course not found.' });
        return;
      }

      const db = requireDb();
      const [existing] = await db
        .select()
        .from(schema.courses)
        .where(eq(schema.courses.id, id))
        .limit(1);

      if (!existing) {
        res.status(404).json({ error: 'Course not found.' });
        return;
      }
      if (!canAdminManageCourses && existing.authorId !== user.id) {
        res.status(403).json({
          error: 'Only the course instructor or authorized Admin can delete this course.',
        });
        return;
      }

      await db.delete(schema.courses).where(eq(schema.courses.id, id));
      res.json({ ok: true });
    })
  );

  app.post(
    '/api/courses/:id/enroll',
    requireAuth,
    asyncHandler(async (req: AuthedRequest, res: Response) => {
      const user = req.userRecord!.user;
      if (user.role !== 'student') {
        res.status(403).json({
          error: 'Course enrollment is strictly for Student accounts.',
        });
        return;
      }

      const id = parseUuidParam(req.params.id);
      if (!id) {
        res.status(404).json({ error: 'Course not found.' });
        return;
      }

      const db = requireDb();
      const [existingCourse] = await db
        .select({ id: schema.courses.id })
        .from(schema.courses)
        .where(eq(schema.courses.id, id))
        .limit(1);

      if (!existingCourse) {
        res.status(404).json({ error: 'Course not found.' });
        return;
      }

      try {
        await db.insert(schema.courseEnrollments).values({
          courseId: id,
          studentId: user.id,
        });
      } catch (err) {
        if (isUniqueViolation(err)) {
          res.status(409).json({ error: 'You are already enrolled in this course.' });
          return;
        }
        throw err;
      }

      const [course, progress] = await Promise.all([
        getCourseById(db, id, user),
        computeUserProgress(db, user.id),
      ]);

      res.status(201).json({ course, progress });
    })
  );

  // 16. Faculty Directory (Authenticated members only)
  app.get(
    '/api/faculty',
    requireAuth,
    asyncHandler(async (_req: AuthedRequest, res: Response) => {
      const db = requireDb();
      const facultyMembers = await getFacultyDirectoryList(db);
      res.json({ facultyMembers });
    })
  );

  app.post(
    '/api/faculty',
    requireAuth,
    asyncHandler(async (req: AuthedRequest, res: Response) => {
      const db = requireDb();
      const user = req.userRecord!.user;
      if (user.role === 'student') {
        res.status(403).json({
          error: 'Faculty directory editing is disabled for student accounts.',
        });
        return;
      }
      if (user.role === 'admin' && !hasAdminRecordPermission(req.userRecord, 'faculty')) {
        res.status(403).json({
          error: "Access denied: Requires 'Faculty' administrator permission.",
        });
        return;
      }

      const {
        linkedUserId,
        name,
        designation,
        specialization,
        email,
        phoneOrCabin,
        qualification,
        experienceYears,
        bio,
      } = req.body as {
        linkedUserId?: string | null;
        name?: string;
        designation?: string;
        specialization?: string;
        email?: string;
        phoneOrCabin?: string;
        qualification?: string;
        experienceYears?: number;
        bio?: string;
      };

      if (
        typeof name !== 'string' ||
        !name.trim() ||
        typeof designation !== 'string' ||
        !designation.trim()
      ) {
        res.status(400).json({
          error: 'Faculty name and designation (e.g. Professor, HOD) are required.',
        });
        return;
      }

      const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
      let resolvedLinkedUserId: string | null = null;

      if (linkedUserId !== undefined && linkedUserId !== null && linkedUserId !== '') {
        const parsedLinkedId = parseUuidParam(linkedUserId);
        if (!parsedLinkedId) {
          res.status(400).json({ error: 'Invalid linked faculty user ID.' });
          return;
        }
        if (user.role !== 'admin' && parsedLinkedId !== user.id) {
          res.status(403).json({
            error: 'Faculty members can only link a directory listing to their own account.',
          });
          return;
        }
        const [linkedFaculty] = await db
          .select({ id: schema.users.id })
          .from(schema.users)
          .where(and(eq(schema.users.id, parsedLinkedId), eq(schema.users.role, 'faculty')))
          .limit(1);
        if (!linkedFaculty) {
          res.status(404).json({ error: 'Linked faculty account not found.' });
          return;
        }
        const [existingLink] = await db
          .select({ id: schema.facultyDirectory.id })
          .from(schema.facultyDirectory)
          .where(eq(schema.facultyDirectory.linkedUserId, parsedLinkedId))
          .limit(1);
        if (existingLink) {
          res.status(409).json({
            error: 'This faculty account already has a linked directory profile.',
          });
          return;
        }
        resolvedLinkedUserId = parsedLinkedId;
      } else if (cleanEmail) {
        const [matchedFaculty] = await db
          .select({ id: schema.users.id })
          .from(schema.users)
          .where(
            and(
              sql`lower(${schema.users.email}) = lower(${cleanEmail})`,
              eq(schema.users.role, 'faculty')
            )
          )
          .limit(1);

        if (matchedFaculty && (user.role === 'admin' || matchedFaculty.id === user.id)) {
          const [existingLink] = await db
            .select({ id: schema.facultyDirectory.id })
            .from(schema.facultyDirectory)
            .where(eq(schema.facultyDirectory.linkedUserId, matchedFaculty.id))
            .limit(1);
          if (!existingLink) {
            resolvedLinkedUserId = matchedFaculty.id;
          }
        }
      }

      try {
        const [inserted] = await db
          .insert(schema.facultyDirectory)
          .values({
            linkedUserId: resolvedLinkedUserId,
            name: name.trim(),
            designation: designation.trim(),
            specialization:
              (typeof specialization === 'string' && specialization.trim()) ||
              'Computer Science & Engineering',
            email: cleanEmail || null,
            phoneOrCabin: typeof phoneOrCabin === 'string' ? phoneOrCabin.trim() : '',
            qualification: typeof qualification === 'string' ? qualification.trim() : '',
            experienceYears:
              experienceYears !== undefined
                ? Math.max(0, Math.min(60, Number(experienceYears) || 0))
                : 0,
            bio: typeof bio === 'string' ? bio.trim() : '',
            authorId: user.id,
          })
          .returning();

        res.status(201).json(mapFacultyDirectoryRow(inserted));
      } catch (err) {
        if (isUniqueViolation(err)) {
          const constraint = getPgConstraintName(err);
          res.status(409).json({
            error:
              constraint === 'uq_faculty_dir_linked_user'
                ? 'This faculty account already has a linked directory profile.'
                : 'A faculty directory profile with this email already exists.',
          });
          return;
        }
        throw err;
      }
    })
  );

  app.put(
    '/api/faculty/:id',
    requireAuth,
    asyncHandler(async (req: AuthedRequest, res: Response) => {
      const user = req.userRecord!.user;
      if (user.role === 'student') {
        res.status(403).json({ error: 'Students cannot modify faculty details.' });
        return;
      }
      if (user.role === 'admin' && !hasAdminRecordPermission(req.userRecord, 'faculty')) {
        res.status(403).json({
          error: "Access denied: Requires 'Faculty' administrator permission.",
        });
        return;
      }

      const id = parseUuidParam(req.params.id);
      if (!id) {
        res.status(404).json({ error: 'Faculty member not found.' });
        return;
      }

      const {
        linkedUserId,
        name,
        designation,
        specialization,
        email,
        phoneOrCabin,
        qualification,
        experienceYears,
        bio,
      } = req.body as {
        linkedUserId?: string | null;
        name?: string;
        designation?: string;
        specialization?: string;
        email?: string;
        phoneOrCabin?: string;
        qualification?: string;
        experienceYears?: number;
        bio?: string;
      };

      const db = requireDb();

      try {
        const result = await db.transaction(async (tx) => {
          const [existing] = await tx
            .select()
            .from(schema.facultyDirectory)
            .where(eq(schema.facultyDirectory.id, id))
            .limit(1);

          if (!existing) {
            return { status: 404 as const, error: 'Faculty member not found.' };
          }

          const isAuthorized =
            (user.role === 'admin' && hasAdminRecordPermission(req.userRecord, 'faculty')) ||
            (existing.linkedUserId
              ? existing.linkedUserId === user.id
              : existing.authorId === user.id);

          if (!isAuthorized) {
            return {
              status: 403 as const,
              error: 'Faculty members cannot modify profiles of other faculty members.',
            };
          }

          if (
            (name !== undefined && typeof name !== 'string') ||
            (designation !== undefined && typeof designation !== 'string') ||
            (specialization !== undefined && typeof specialization !== 'string') ||
            (email !== undefined && typeof email !== 'string') ||
            (phoneOrCabin !== undefined && typeof phoneOrCabin !== 'string') ||
            (qualification !== undefined && typeof qualification !== 'string') ||
            (bio !== undefined && typeof bio !== 'string')
          ) {
            return { status: 400 as const, error: 'Faculty text fields must be valid strings.' };
          }

          const nextEmail =
            typeof email === 'string' ? email.trim().toLowerCase() || null : existing.email;

          let nextLinkedUserId: string | null = existing.linkedUserId ?? null;
          if (linkedUserId !== undefined) {
            if (user.role !== 'admin') {
              return {
                status: 403 as const,
                error: 'Only Admin can change the linked faculty login account.',
              };
            }
            if (linkedUserId === null || linkedUserId === '') {
              nextLinkedUserId = null;
            } else {
              const parsedLinkedId = parseUuidParam(linkedUserId);
              if (!parsedLinkedId) {
                return { status: 400 as const, error: 'Invalid linked faculty user ID.' };
              }
              const [linkedFaculty] = await tx
                .select({ id: schema.users.id })
                .from(schema.users)
                .where(and(eq(schema.users.id, parsedLinkedId), eq(schema.users.role, 'faculty')))
                .limit(1);
              if (!linkedFaculty) {
                return { status: 404 as const, error: 'Linked faculty account not found.' };
              }
              const [existingLink] = await tx
                .select({ id: schema.facultyDirectory.id })
                .from(schema.facultyDirectory)
                .where(
                  and(
                    eq(schema.facultyDirectory.linkedUserId, parsedLinkedId),
                    sql`${schema.facultyDirectory.id} <> ${id}`
                  )
                )
                .limit(1);
              if (existingLink) {
                return {
                  status: 409 as const,
                  error: 'This faculty account is already linked to another directory profile.',
                };
              }
              nextLinkedUserId = parsedLinkedId;
            }
          } else if (!nextLinkedUserId && nextEmail) {
            const [matchedFaculty] = await tx
              .select({ id: schema.users.id })
              .from(schema.users)
              .where(
                and(
                  sql`lower(${schema.users.email}) = lower(${nextEmail})`,
                  eq(schema.users.role, 'faculty')
                )
              )
              .limit(1);

            if (matchedFaculty && (user.role === 'admin' || matchedFaculty.id === user.id)) {
              const [existingLink] = await tx
                .select({ id: schema.facultyDirectory.id })
                .from(schema.facultyDirectory)
                .where(
                  and(
                    eq(schema.facultyDirectory.linkedUserId, matchedFaculty.id),
                    sql`${schema.facultyDirectory.id} <> ${id}`
                  )
                )
                .limit(1);
              if (!existingLink) {
                nextLinkedUserId = matchedFaculty.id;
              }
            }
          }

          const nextAuthorId = nextLinkedUserId ?? existing.authorId;

          const [row] = await tx
            .update(schema.facultyDirectory)
            .set({
              linkedUserId: nextLinkedUserId,
              authorId: nextAuthorId,
              name: typeof name === 'string' && name.trim() ? name.trim() : existing.name,
              designation:
                typeof designation === 'string' && designation.trim()
                  ? designation.trim()
                  : existing.designation,
              specialization:
                typeof specialization === 'string'
                  ? specialization.trim()
                  : existing.specialization,
              email: nextEmail,
              phoneOrCabin:
                typeof phoneOrCabin === 'string' ? phoneOrCabin.trim() : existing.phoneOrCabin,
              qualification:
                typeof qualification === 'string' ? qualification.trim() : existing.qualification,
              experienceYears:
                experienceYears !== undefined
                  ? Math.max(0, Math.min(60, Number(experienceYears) || 0))
                  : existing.experienceYears,
              bio: typeof bio === 'string' ? bio.trim() : existing.bio,
            })
            .where(eq(schema.facultyDirectory.id, id))
            .returning();

          if (!row) {
            return { status: 404 as const, error: 'Faculty member not found.' };
          }

          if (row.linkedUserId) {
            const [linkedAccount] = await tx
              .select({
                id: schema.users.id,
                department: schema.users.department,
                memberId: schema.users.memberId,
                name: schema.users.name,
              })
              .from(schema.users)
              .where(
                and(
                  eq(schema.users.id, row.linkedUserId),
                  eq(schema.users.role, 'faculty')
                )
              )
              .limit(1);

            if (linkedAccount) {
              const deptForBatch = linkedAccount.department || row.specialization || 'CSE';
              await tx
                .update(schema.users)
                .set({
                  name: row.name,
                  phone: row.phoneOrCabin,
                  bio: row.bio,
                  batchOrDesignation: `${row.designation}, ${deptForBatch}`,
                })
                .where(eq(schema.users.id, linkedAccount.id));

              await tx
                .insert(schema.facultyProfiles)
                .values({
                  userId: linkedAccount.id,
                  designation: row.designation,
                  specialization: row.specialization,
                  qualification: row.qualification,
                  experienceYears: row.experienceYears,
                  phoneOrCabin: row.phoneOrCabin,
                })
                .onConflictDoUpdate({
                  target: schema.facultyProfiles.userId,
                  set: {
                    designation: row.designation,
                    specialization: row.specialization,
                    qualification: row.qualification,
                    experienceYears: row.experienceYears,
                    phoneOrCabin: row.phoneOrCabin,
                  },
                });
            }
          }

          return {
            status: 200 as const,
            updated: row,
            nameChanged: row.name !== existing.name,
          };
        });

        if (result.status !== 200) {
          res.status(result.status).json({ error: result.error });
          return;
        }

        if (result.updated.linkedUserId && result.nameChanged) {
          const [linkedUserMeta] = await db
            .select({ memberId: schema.users.memberId })
            .from(schema.users)
            .where(eq(schema.users.id, result.updated.linkedUserId))
            .limit(1);
          if (linkedUserMeta) {
            await updateSupabaseAuthUser(result.updated.linkedUserId, {
              name: result.updated.name,
              memberId: linkedUserMeta.memberId,
            });
          }
        }

        res.json(mapFacultyDirectoryRow(result.updated));
      } catch (err) {
        if (isUniqueViolation(err)) {
          const constraint = getPgConstraintName(err);
          res.status(409).json({
            error:
              constraint === 'uq_faculty_dir_linked_user'
                ? 'This faculty account is already linked to another directory profile.'
                : 'Another faculty directory record already uses this email.',
          });
          return;
        }
        throw err;
      }
    })
  );

  app.delete(
    '/api/faculty/:id',
    requireAuth,
    asyncHandler(async (req: AuthedRequest, res: Response) => {
      const id = parseUuidParam(req.params.id);
      if (!id) {
        res.status(404).json({ error: 'Faculty member not found.' });
        return;
      }

      const db = requireDb();
      const user = req.userRecord!.user;
      if (user.role !== 'faculty' && user.role !== 'admin') {
        res.status(403).json({
          error: 'Students cannot delete Faculty Directory profiles.',
        });
        return;
      }
      if (user.role === 'admin' && !hasAdminRecordPermission(req.userRecord, 'faculty')) {
        res.status(403).json({
          error: "Access denied: Requires 'Faculty' administrator permission.",
        });
        return;
      }

      const result = await db.transaction(async (tx) => {
        const [existing] = await tx
          .select()
          .from(schema.facultyDirectory)
          .where(eq(schema.facultyDirectory.id, id))
          .limit(1);

        if (!existing) {
          return { status: 404 as const, error: 'Faculty member not found.' };
        }

        const isAuthorized =
          (user.role === 'admin' && hasAdminRecordPermission(req.userRecord, 'faculty')) ||
          (existing.linkedUserId
            ? existing.linkedUserId === user.id
            : existing.authorId === user.id);

        if (!isAuthorized) {
          return {
            status: 403 as const,
            error: 'Only the linked faculty member, unlinked entry author, or Admin can remove this record.',
          };
        }

        const deletedRows = await tx
          .delete(schema.facultyDirectory)
          .where(eq(schema.facultyDirectory.id, id))
          .returning({ id: schema.facultyDirectory.id });

        if (deletedRows.length === 0) {
          return { status: 404 as const, error: 'Faculty member not found.' };
        }

        return { status: 200 as const, deletedId: deletedRows[0].id };
      });

      if (result.status !== 200) {
        res.status(result.status).json({ error: result.error });
        return;
      }

      res.json({ ok: true, deletedId: result.deletedId });
    })
  );

  // 17. Lab & Dept Academic Resources
  app.post(
    '/api/resources',
    requireAuth,
    asyncHandler(async (req: AuthedRequest, res: Response) => {
      const db = requireDb();
      const user = req.userRecord!.user;
      const canAdminManageResources =
        user.role === 'admin' &&
        (hasAdminRecordPermission(req.userRecord, 'faculty') ||
          hasAdminRecordPermission(req.userRecord, 'dashboard_analytics'));
      if (user.role !== 'faculty' && !canAdminManageResources) {
        res.status(403).json({
          error:
            user.role === 'admin'
              ? "Access denied: Requires 'Faculty' or 'Dashboard & Analytics' administrator permission."
              : 'Only Faculty and authorized Admin can publish official Academic Resources.',
        });
        return;
      }

      const { title, resourceType, subjectOrLab, description, resourceLink } = req.body as {
        title?: string;
        resourceType?: string;
        subjectOrLab?: string;
        description?: string;
        resourceLink?: string;
      };

      if (typeof title !== 'string' || !title.trim()) {
        res.status(400).json({ error: 'Resource title and link are required.' });
        return;
      }

      const safeResLink = normalizeHttpUrlInput(resourceLink, {
        required: true,
        label: 'Resource Link',
      });
      if (!safeResLink.ok) {
        res.status(400).json({ error: safeResLink.error });
        return;
      }

      const [inserted] = await db
        .insert(schema.academicResources)
        .values({
          title: title.trim(),
          resourceType:
            typeof resourceType === 'string' && resourceType.trim()
              ? resourceType.trim()
              : 'Lab Manual',
          subjectOrLab:
            typeof subjectOrLab === 'string' && subjectOrLab.trim()
              ? subjectOrLab.trim()
              : 'CSE Department',
          description: typeof description === 'string' ? description.trim() : '',
          resourceLink: safeResLink.value,
          authorId: user.id,
          authorNameSnapshot: user.name,
        })
        .returning();

      res.status(201).json({
        id: inserted.id,
        title: inserted.title,
        resourceType: inserted.resourceType,
        subjectOrLab: inserted.subjectOrLab,
        description: inserted.description,
        resourceLink: inserted.resourceLink,
        authorId: inserted.authorId ?? '',
        authorName: user.name,
        createdAt: inserted.createdAt.toISOString(),
      });
    })
  );

  app.delete(
    '/api/resources/:id',
    requireAuth,
    asyncHandler(async (req: AuthedRequest, res: Response) => {
      const id = parseUuidParam(req.params.id);
      if (!id) {
        res.status(404).json({ error: 'Resource not found.' });
        return;
      }

      const db = requireDb();
      const user = req.userRecord!.user;
      const canAdminManageResources =
        user.role === 'admin' &&
        (hasAdminRecordPermission(req.userRecord, 'faculty') ||
          hasAdminRecordPermission(req.userRecord, 'dashboard_analytics'));
      if (user.role !== 'faculty' && !canAdminManageResources) {
        res.status(403).json({
          error:
            user.role === 'admin'
              ? "Access denied: Requires 'Faculty' or 'Dashboard & Analytics' administrator permission."
              : 'Only Faculty and authorized Admin can delete Academic Resources.',
        });
        return;
      }

      const [existing] = await db
        .select()
        .from(schema.academicResources)
        .where(eq(schema.academicResources.id, id))
        .limit(1);

      if (!existing) {
        res.status(404).json({ error: 'Resource not found.' });
        return;
      }
      if (!canAdminManageResources && existing.authorId !== user.id) {
        res.status(403).json({
          error: 'Only the uploader or authorized Admin can remove this resource.',
        });
        return;
      }

      await db.delete(schema.academicResources).where(eq(schema.academicResources.id, id));
      res.json({ ok: true });
    })
  );

  // Return clean JSON 404 for unknown API endpoints instead of falling through to SPA HTML
  app.all('/api/*', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  // Global safe API error handler (never expose internal credentials or stack traces)
  app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      next(err);
      return;
    }
    if (!req.path.startsWith('/api')) {
      next(err);
      return;
    }

    if (isMissingTableOrRelation(err)) {
      logApiError('API Schema Error', req, err);
      res.status(503).json({
        error:
          'Database schema migrations have not been applied to Supabase PostgreSQL yet.',
      });
      return;
    }

    if (isDbConnectivityError(err)) {
      logApiError('API DB Connectivity Error', req, err);
      res.status(503).json({
        error:
          'Database service is temporarily unreachable. Please verify database configuration and try again shortly.',
      });
      return;
    }

    logApiError('API Error', req, err);
    const message =
      err instanceof Error &&
      !/failed query|postgres|supabase|key|password|secret/i.test(err.message)
        ? err.message
        : 'Internal server error while processing database request.';

    res.status(500).json({ error: message });
  });


  if (options?.mountFrontend) {
    await options.mountFrontend(app);
  }

  return app;
}

export function getExpressApp(options?: BuildExpressAppOptions): Promise<express.Express> {
  if (!cachedAppPromise) {
    cachedAppPromise = buildExpressApp(options).catch((err) => {
      cachedAppPromise = null;
      throw err;
    });
  }
  return cachedAppPromise;
}
