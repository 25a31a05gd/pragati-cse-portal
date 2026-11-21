import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres, { type Sql } from 'postgres';
import * as schema from './schema.js';

export type AppDatabase = PostgresJsDatabase<typeof schema>;

export type DatabaseConnectionMode =
  | 'transaction_pooler'
  | 'session_pooler'
  | 'direct'
  | 'custom';

export interface DatabaseConnectionMetadata {
  configured: boolean;
  connectionMode: DatabaseConnectionMode | 'unconfigured' | 'invalid_url';
  port: string | null;
  prepareDisabled: boolean;
  sslMode: 'require' | 'verify-full' | 'disabled';
  ipv4PoolerRecommended?: boolean;
  transactionPoolerRecommended?: boolean;
}

export interface DatabaseReadinessStatus extends DatabaseConnectionMetadata {
  connected: boolean;
  latencyMs?: number;
  errorCode?: string;
}

interface ResolvedConfig {
  connectionString: string;
  prepare: boolean;
  ssl: 'require' | 'verify-full' | false;
  metadata: DatabaseConnectionMetadata;
}

function resolveDatabaseConfig(rawUrl: string | undefined): ResolvedConfig | null {
  const trimmed = (rawUrl || '').trim().replace(/^['"]+|['"]+$/g, '');
  if (!trimmed) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  const hostname = parsed.hostname.toLowerCase();
  const port = parsed.port || '5432';
  const pgbouncerParam = parsed.searchParams.get('pgbouncer') === 'true';
  const sslmodeParam = (parsed.searchParams.get('sslmode') || '').toLowerCase();
  const isPoolerHost = hostname.endsWith('.pooler.supabase.com');
  const isLocal =
    hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';

  let connectionMode: DatabaseConnectionMode;
  if (port === '6543' || pgbouncerParam) {
    connectionMode = 'transaction_pooler';
  } else if (isPoolerHost && port === '5432') {
    connectionMode = 'session_pooler';
  } else if (hostname.endsWith('.supabase.co') || hostname.endsWith('.supabase.com')) {
    connectionMode = 'direct';
  } else {
    connectionMode = 'custom';
  }

  // Supabase Transaction Pooler (Supavisor on port 6543) does not support
  // protocol-level prepared statements, so prepare MUST be false.
  const prepare = connectionMode !== 'transaction_pooler';

  let ssl: 'require' | 'verify-full' | false = 'require';
  let sslMode: 'require' | 'verify-full' | 'disabled' = 'require';
  if (isLocal || sslmodeParam === 'disable') {
    ssl = false;
    sslMode = 'disabled';
  } else if (sslmodeParam === 'verify-full' || sslmodeParam === 'verify-ca') {
    ssl = 'verify-full';
    sslMode = 'verify-full';
  }

  return {
    connectionString: trimmed,
    prepare,
    ssl,
    metadata: {
      configured: true,
      connectionMode,
      port,
      prepareDisabled: !prepare,
      sslMode,
      ipv4PoolerRecommended: connectionMode === 'direct',
      transactionPoolerRecommended:
        Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) &&
        connectionMode === 'session_pooler',
    },
  };
}

let cachedSql: Sql | null = null;
let cachedDb: AppDatabase | null = null;
let cachedMetadata: DatabaseConnectionMetadata | null = null;

function ensureInitialized(): boolean {
  if (cachedDb && cachedSql && cachedMetadata) {
    return true;
  }

  const rawUrl = process.env.DATABASE_URL;
  const resolved = resolveDatabaseConfig(rawUrl);
  if (!resolved) {
    cachedMetadata = {
      configured: Boolean((rawUrl || '').trim()),
      connectionMode: (rawUrl || '').trim() ? 'invalid_url' : 'unconfigured',
      port: null,
      prepareDisabled: false,
      sslMode: 'disabled',
    };
    return false;
  }

  const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  cachedSql = postgres(resolved.connectionString, {
    prepare: resolved.prepare,
    ssl: resolved.ssl,
    max: isServerless ? 1 : 5,
    idle_timeout: isServerless ? 10 : 20,
    connect_timeout: 10,
  });
  cachedDb = drizzle(cachedSql, { schema });
  cachedMetadata = resolved.metadata;
  return true;
}

export function getDb(): AppDatabase | null {
  if (!ensureInitialized()) return null;
  return cachedDb;
}

export function requireDb(): AppDatabase {
  const db = getDb();
  if (!db) {
    throw new Error('Database connection is not configured (DATABASE_URL missing or invalid).');
  }
  return db;
}

export function getConnectionMetadata(): DatabaseConnectionMetadata {
  ensureInitialized();
  return (
    cachedMetadata ?? {
      configured: false,
      connectionMode: 'unconfigured',
      port: null,
      prepareDisabled: false,
      sslMode: 'disabled',
    }
  );
}

function extractDatabaseErrorCode(err: unknown, depth = 0): string | undefined {
  if (depth > 5 || !err || typeof err !== 'object') {
    return undefined;
  }
  const candidate = err as {
    code?: unknown;
    name?: unknown;
    cause?: unknown;
    errors?: unknown;
  };
  if (typeof candidate.code === 'string' && candidate.code.trim()) {
    return candidate.code.trim();
  }
  if (Array.isArray(candidate.errors)) {
    for (const inner of candidate.errors) {
      const innerCode = extractDatabaseErrorCode(inner, depth + 1);
      if (innerCode) return innerCode;
    }
  }
  if (candidate.cause) {
    const causeCode = extractDatabaseErrorCode(candidate.cause, depth + 1);
    if (causeCode) return causeCode;
  }
  if (
    typeof candidate.name === 'string' &&
    candidate.name.trim() &&
    candidate.name !== 'Error' &&
    candidate.name !== 'AggregateError'
  ) {
    return candidate.name.trim();
  }
  return undefined;
}

export async function checkDatabaseReadiness(): Promise<DatabaseReadinessStatus> {
  const ready = ensureInitialized();
  const metadata = getConnectionMetadata();

  if (!ready || !cachedSql) {
    return {
      ...metadata,
      connected: false,
      errorCode: metadata.configured ? 'INVALID_DATABASE_URL' : 'DATABASE_URL_MISSING',
    };
  }

  const startedAt = Date.now();
  try {
    await cachedSql`SELECT 1 AS readiness_check`;
    return {
      ...metadata,
      connected: true,
      latencyMs: Date.now() - startedAt,
    };
  } catch (err) {
    const errorCode = extractDatabaseErrorCode(err) || 'CONNECTION_FAILED';
    return {
      ...metadata,
      connected: false,
      latencyMs: Date.now() - startedAt,
      errorCode,
    };
  }
}

export async function closeDb(): Promise<void> {
  if (cachedSql) {
    const sqlClient = cachedSql;
    cachedSql = null;
    cachedDb = null;
    await sqlClient.end({ timeout: 5 }).catch(() => undefined);
  }
}

export { schema };
