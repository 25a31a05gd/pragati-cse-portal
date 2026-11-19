import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { UserRole } from '../types';

let cachedAdminClient: SupabaseClient | null = null;

function getSupabaseCredentials(): { url: string; serviceRoleKey: string } {
  const url = (process.env.SUPABASE_URL || '').trim();
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url || !serviceRoleKey) {
    throw new Error(
      'Supabase backend configuration missing: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.'
    );
  }
  return { url, serviceRoleKey };
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    (process.env.SUPABASE_URL || '').trim() &&
      (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  );
}

/**
 * Shared service-role admin client used ONLY for auth.admin.* and auth.getUser(jwt).
 * Never call signInWithPassword on this instance so its service-role headers remain isolated.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (cachedAdminClient) {
    return cachedAdminClient;
  }
  const { url, serviceRoleKey } = getSupabaseCredentials();
  cachedAdminClient = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
  return cachedAdminClient;
}

/**
 * Ephemeral stateless auth client used strictly for password-grant sign-in so
 * per-user sessions never mutate the shared admin client state.
 */
function createEphemeralAuthClient(): SupabaseClient {
  const { url, serviceRoleKey } = getSupabaseCredentials();
  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

export async function verifySupabaseJwt(accessToken: string): Promise<User | null> {
  if (!accessToken || !isSupabaseConfigured()) {
    return null;
  }
  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.auth.getUser(accessToken);
    if (error || !data?.user) {
      return null;
    }
    return data.user;
  } catch {
    return null;
  }
}

export async function signInSupabasePassword(
  email: string,
  password: string
): Promise<{ accessToken: string; user: User } | { error: string }> {
  const authClient = createEphemeralAuthClient();
  const { data, error } = await authClient.auth.signInWithPassword({
    email,
    password,
  });
  if (error || !data.session?.access_token || !data.user) {
    return { error: error?.message || 'Invalid login credentials.' };
  }
  return {
    accessToken: data.session.access_token,
    user: data.user,
  };
}

export async function createSupabaseAuthUser(params: {
  email: string;
  password: string;
  role: UserRole;
  name: string;
  memberId: string;
}): Promise<{ user: User } | { error: string; status?: number }> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.auth.admin.createUser({
    email: params.email,
    password: params.password,
    email_confirm: true,
    app_metadata: {
      role: params.role,
    },
    user_metadata: {
      name: params.name,
      memberId: params.memberId,
    },
  });
  if (error || !data?.user) {
    const msg = error?.message || 'Unable to create authentication account.';
    const status = /already|exists|registered/i.test(msg) ? 409 : 400;
    return { error: msg, status };
  }
  return { user: data.user };
}

export async function updateSupabaseAuthUser(
  userId: string,
  updates: {
    email?: string;
    password?: string;
    role?: UserRole;
    name?: string;
    memberId?: string;
    banned?: boolean;
  }
): Promise<{ error?: string }> {
  const admin = getSupabaseAdmin();
  const payload: Parameters<typeof admin.auth.admin.updateUserById>[1] = {};

  if (updates.email !== undefined) {
    payload.email = updates.email;
    payload.email_confirm = true;
  }
  if (updates.password !== undefined) {
    payload.password = updates.password;
  }
  if (updates.role !== undefined) {
    payload.app_metadata = { role: updates.role };
  }
  if (updates.name !== undefined || updates.memberId !== undefined) {
    payload.user_metadata = {
      ...(updates.name !== undefined ? { name: updates.name } : {}),
      ...(updates.memberId !== undefined ? { memberId: updates.memberId } : {}),
    };
  }
  if (updates.banned !== undefined) {
    payload.ban_duration = updates.banned ? '876000h' : 'none';
  }

  const { error } = await admin.auth.admin.updateUserById(userId, payload);
  if (error) {
    return { error: error.message };
  }
  return {};
}

export async function deleteSupabaseAuthUser(
  userId: string
): Promise<{ error?: string; notFound?: boolean }> {
  try {
    const admin = getSupabaseAdmin();
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) {
      const status = (error as { status?: number }).status;
      const isNotFound = status === 404 || /user not found/i.test(error.message);
      return {
        error: error.message || 'Failed to delete Supabase Auth user.',
        notFound: isNotFound,
      };
    }
    return {};
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Failed to delete Supabase Auth user.',
    };
  }
}

export async function signOutSupabaseJwt(accessToken: string): Promise<void> {
  if (!accessToken || !isSupabaseConfigured()) return;
  try {
    const admin = getSupabaseAdmin();
    await admin.auth.admin.signOut(accessToken, 'global');
  } catch {
    // Best-effort revocation
  }
}
