// PARALLEL Supabase client - shared across all pages
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

export const SUPABASE_URL = 'https://rzgsjqpjsfbpeqjffvpy.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_N6pcmFQdRJ__h01z00etEw_XDq2etzr';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getProfile() {
  const user = await getCurrentUser();
  if (!user) return null;
  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  return data;
}

export async function isAdmin() {
  const p = await getProfile();
  return !!p?.is_admin;
}

export async function requireAuth(redirectTo = '/login.html') {
  const user = await getCurrentUser();
  if (!user) { window.location.href = redirectTo + '?next=' + encodeURIComponent(window.location.pathname); return null; }
  return user;
}

export async function signOut() {
  await supabase.auth.signOut();
  window.location.href = '/';
}
