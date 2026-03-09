-- Conscious Compass Database Schema
-- Run this in your Supabase SQL Editor (Database → SQL Editor)

-- 1. Create profiles table for user management
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  is_admin BOOLEAN DEFAULT FALSE,
  is_approved BOOLEAN DEFAULT FALSE,
  is_readonly BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- MIGRATION: If profiles table already exists, add is_readonly column:
-- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_readonly BOOLEAN DEFAULT FALSE;

-- 2. Create compass_results table (Results Grid)
CREATE TABLE compass_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_name TEXT NOT NULL,
  business_model TEXT,
  industry TEXT,
  total_score INTEGER,
  maturity_level TEXT,
  scores JSONB,
  services_recommended TEXT[],
  is_manual BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create saved_assessments table (Full Assessments)
CREATE TABLE saved_assessments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_name TEXT NOT NULL,
  project JSONB NOT NULL,
  assessments JSONB NOT NULL,
  scores JSONB,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE compass_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_assessments ENABLE ROW LEVEL SECURITY;

-- 5. Create policies for profiles
-- Users can read all profiles (to see team members)
CREATE POLICY "Users can view all profiles" ON profiles
  FOR SELECT TO authenticated USING (true);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Admins can update any profile (for approvals)
CREATE POLICY "Admins can update all profiles" ON profiles
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- 6. Create policies for compass_results (shared - all approved users can see all)
CREATE POLICY "Approved users can view all results" ON compass_results
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_approved = true)
  );

CREATE POLICY "Approved users can insert results" ON compass_results
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_approved = true)
  );

CREATE POLICY "Approved users can update results" ON compass_results
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_approved = true)
  );

CREATE POLICY "Approved users can delete results" ON compass_results
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_approved = true)
  );

-- 7. Create policies for saved_assessments (shared)
CREATE POLICY "Approved users can view all assessments" ON saved_assessments
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_approved = true)
  );

CREATE POLICY "Approved users can insert assessments" ON saved_assessments
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_approved = true)
  );

CREATE POLICY "Approved users can update assessments" ON saved_assessments
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_approved = true)
  );

CREATE POLICY "Approved users can delete assessments" ON saved_assessments
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_approved = true)
  );

-- 8. Function to handle new user signup (creates profile automatically)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, is_admin, is_approved)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    FALSE,
    FALSE
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Trigger to create profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 10. Create your admin user (run this AFTER you sign up)
-- Replace 'your-email@example.com' with your actual email
-- UPDATE profiles SET is_admin = true, is_approved = true WHERE email = 'your-email@example.com';

-- MIGRATION: Enable cascade delete so removing auth user also removes their profile
-- Run this if profiles table already exists:
-- ALTER TABLE profiles DROP CONSTRAINT profiles_id_fkey;
-- ALTER TABLE profiles ADD CONSTRAINT profiles_id_fkey
--   FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- NOTE: User deletion requires SUPABASE_SERVICE_ROLE_KEY in Vercel environment variables.
-- Find it in: Supabase Dashboard → Project Settings → API → service_role key (secret)
-- Add as: SUPABASE_SERVICE_ROLE_KEY = your-service-role-key
