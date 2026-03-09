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
  const { error } = await supabase
    .from('profiles')
    .delete()
    .eq('id', userId);
  return { error };
};
