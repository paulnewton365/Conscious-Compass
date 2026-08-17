import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://zkordpfxdekmubtjsbkr.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inprb3JkcGZ4ZGVrbXVidGpzYmtyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1OTY4MDcsImV4cCI6MjA4NzE3MjgwN30.rClRdKrK9X5kPALmkPLmBbZYdEObzBQBhF13NdIhCv0';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Auth helpers
export const signUp = async (email, password, fullName) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName }
    }
  });
  return { data, error };
};

export const signIn = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  // Stamp last_login on successful sign-in
  if (data?.user && !error) {
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ last_login: new Date().toISOString() })
      .eq('id', data.user.id);
    if (updateError) {
      console.error('last_login update failed:', updateError.message, updateError.code);
    }
  }
  return { data, error };
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  return { error };
};

export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

export const getProfile = async (userId) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  return { data, error };
};

// Compass Results (Results Grid)
export const fetchCompassResults = async () => {
  const { data, error } = await supabase
    .from('compass_results')
    .select('*')
    .order('created_at', { ascending: false });
  return { data, error };
};

export const saveCompassResult = async (result) => {
  // Always create a new record to allow tracking improvements over time
  // Multiple assessments for same brand with different timestamps are allowed
  const resultData = {
    brand_name: result.brandName,
    business_model: result.businessModel,
    industry: result.industry,
    total_score: result.totalScore,
    maturity_level: result.maturityLevel,
    scores: result.scores,
    services_recommended: result.servicesRecommended || [],
    is_manual: result.isManual || false,
    assessor_name: result.assessorName || null,
    rubric_version: result.rubricVersion || '2.4',
    updated_at: new Date().toISOString(),
  };

  // Insert new record (allows multiple assessments per brand over time)
  const { data, error } = await supabase
    .from('compass_results')
    .insert(resultData)
    .select()
    .single();
  return { data, error };
};

export const deleteCompassResult = async (id) => {
  const { error } = await supabase
    .from('compass_results')
    .delete()
    .eq('id', id);
  return { error };
};

// Saved Assessments
export const fetchSavedAssessments = async () => {
  const { data, error } = await supabase
    .from('saved_assessments')
    .select('*')
    .order('created_at', { ascending: false });
  return { data, error };
};

export const saveAssessment = async (assessment) => {
  // Check if assessment with same brand name exists
  const { data: existing } = await supabase
    .from('saved_assessments')
    .select('id')
    .eq('brand_name', assessment.project.brandName)
    .single();

  const assessmentData = {
    brand_name: assessment.project.brandName,
    project: assessment.project,
    assessments: assessment.assessments,
    scores: assessment.scores,
    updated_at: new Date().toISOString(),
  };

  if (existing?.id) {
    const { data, error } = await supabase
      .from('saved_assessments')
      .update(assessmentData)
      .eq('id', existing.id)
      .select()
      .single();
    return { data, error };
  } else {
    const { data, error } = await supabase
      .from('saved_assessments')
      .insert(assessmentData)
      .select()
      .single();
    return { data, error };
  }
};

export const deleteAssessment = async (id) => {
  const { error } = await supabase
    .from('saved_assessments')
    .delete()
    .eq('id', id);
  return { error };
};

// Admin functions
export const fetchAllProfiles = async () => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });
  return { data, error };
};

export const updateProfile = async (userId, updates) => {
  const { data, error } = await supabase
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single();
  return { data, error };
};

export const approveUser = async (userId) => {
  return updateProfile(userId, { is_approved: true });
};

export const revokeUser = async (userId) => {
  return updateProfile(userId, { is_approved: false });
};

export const makeAdmin = async (userId) => {
  return updateProfile(userId, { is_admin: true });
};

export const removeAdmin = async (userId) => {
  return updateProfile(userId, { is_admin: false });
};

export const setReadonly = async (userId, isReadonly) => {
  return updateProfile(userId, { is_readonly: isReadonly });
};

export const deleteUser = async (userId) => {
  const response = await fetch('/api/delete-user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  const data = await response.json();
  if (!response.ok) return { error: data.error || 'Delete failed' };
  return { error: null };
};

// ─────────────────────────────────────────────────────────────
// CLIENT REPORTS (gated share links)
//
// The existing share link base64-encodes the whole payload into the URL, so a
// password on top of that would be decorative: anyone could decode the URL and
// read everything. These links work differently.
//
// The payload is encrypted IN THE BROWSER with a key derived from the password
// (PBKDF2, 250k iterations, AES-GCM). Supabase only ever stores ciphertext.
// The password is never sent anywhere and is not recoverable, including by us.
// A leaked row is useless without it.
// ─────────────────────────────────────────────────────────────

const enc = new TextEncoder();
const dec = new TextDecoder();
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (str) => Uint8Array.from(atob(str), (c) => c.charCodeAt(0));

async function deriveKey(password, salt) {
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 250000, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptPayload(payload, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const data = enc.encode(JSON.stringify(payload));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  return { cipher: b64(cipher), salt: b64(salt), iv: b64(iv) };
}

export async function decryptPayload({ cipher, salt, iv }, password) {
  const key = await deriveKey(password, unb64(salt));
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: unb64(iv) }, key, unb64(cipher)
  );
  return JSON.parse(dec.decode(plain));
}

const makeToken = () => b64(crypto.getRandomValues(new Uint8Array(12)))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export const createClientReport = async ({ brandName, payload, password }) => {
  const token = makeToken();
  const { cipher, salt, iv } = await encryptPayload(payload, password);
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from('client_reports').insert({
    token,
    brand_name: brandName,
    cipher,
    salt,
    iv,
    created_by: user?.id || null,
  });
  return { token, error };
};

export const fetchClientReport = async (token) => {
  const { data, error } = await supabase
    .from('client_reports')
    .select('token, brand_name, cipher, salt, iv, created_at')
    .eq('token', token)
    .maybeSingle();
  return { data, error };
};

export const listClientReports = async () => {
  const { data, error } = await supabase
    .from('client_reports')
    .select('token, brand_name, created_at')
    .order('created_at', { ascending: false });
  return { data, error };
};

export const revokeClientReport = async (token) =>
  supabase.from('client_reports').delete().eq('token', token);
