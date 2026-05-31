-- =====================================================
-- VIRAL STUDIO — Supabase Database Schema
-- Migration: 001_initial_schema.sql
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- PROFILES (extends auth.users)
-- =====================================================
CREATE TABLE IF NOT EXISTS profiles (
  id            UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email         TEXT NOT NULL,
  full_name     TEXT,
  avatar_url    TEXT,
  is_subscribed BOOLEAN DEFAULT FALSE,
  subscribed_at TIMESTAMPTZ,
  subscription_expires_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- DAILY USAGE (rate limiting: 10 gen/day)
-- =====================================================
CREATE TABLE IF NOT EXISTS daily_usage (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  date       DATE NOT NULL DEFAULT CURRENT_DATE,
  count      INT DEFAULT 0,
  UNIQUE(user_id, date)
);

-- =====================================================
-- CHARACTERS
-- =====================================================
CREATE TABLE IF NOT EXISTS characters (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  label_name    TEXT NOT NULL,
  anchor_phrase TEXT NOT NULL,
  anchor_hash   TEXT NOT NULL,        -- SHA256 hash, immutable lock
  image_urls    TEXT[] DEFAULT '{}',
  analysis      JSONB,                -- Gemini vision result
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- PRODUCTS
-- =====================================================
CREATE TABLE IF NOT EXISTS products (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  product_name  TEXT NOT NULL,
  category      TEXT,
  benefits      TEXT[] DEFAULT '{}',
  visual_desc   TEXT,
  image_urls    TEXT[] DEFAULT '{}',
  detected_niche JSONB,              -- cached niche detection result
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- STORYBOARDS
-- =====================================================
CREATE TABLE IF NOT EXISTS storyboards (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  character_id     UUID REFERENCES characters(id) ON DELETE SET NULL,
  product_id       UUID REFERENCES products(id) ON DELETE SET NULL,
  selected_angle   JSONB,
  selected_persona JSONB,
  selected_niche   TEXT,
  framework        TEXT,
  scenes           JSONB DEFAULT '[]', -- array of scene objects
  status           TEXT DEFAULT 'draft' CHECK (status IN ('draft','generating','complete','failed')),
  rating           SMALLINT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- NICHE PATTERNS (admin-managed content)
-- =====================================================
CREATE TABLE IF NOT EXISTS niche_patterns (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  niche_id            TEXT UNIQUE NOT NULL,
  display_name        TEXT NOT NULL,
  angles              JSONB DEFAULT '[]',
  personas            JSONB DEFAULT '[]',
  content_matrix      JSONB DEFAULT '[]',
  competitor_patterns JSONB,
  version             INT DEFAULT 1,
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TRENDING NICHES (weekly updated)
-- =====================================================
CREATE TABLE IF NOT EXISTS trending_niches (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  week       TEXT NOT NULL,           -- format: YYYY-WNN e.g. 2026-W22
  niches     JSONB DEFAULT '[]',      -- [{name, score, growth_pct, emoji}]
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_usage      ENABLE ROW LEVEL SECURITY;
ALTER TABLE characters       ENABLE ROW LEVEL SECURITY;
ALTER TABLE products         ENABLE ROW LEVEL SECURITY;
ALTER TABLE storyboards      ENABLE ROW LEVEL SECURITY;
ALTER TABLE niche_patterns   ENABLE ROW LEVEL SECURITY;
ALTER TABLE trending_niches  ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Daily usage policies
CREATE POLICY "Users can view own usage"
  ON daily_usage FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own usage"
  ON daily_usage FOR ALL USING (auth.uid() = user_id);

-- Characters policies
CREATE POLICY "Users can manage own characters"
  ON characters FOR ALL USING (auth.uid() = user_id);

-- Products policies
CREATE POLICY "Users can manage own products"
  ON products FOR ALL USING (auth.uid() = user_id);

-- Storyboards policies
CREATE POLICY "Users can manage own storyboards"
  ON storyboards FOR ALL USING (auth.uid() = user_id);

-- Niche patterns & trending: public read, admin write
CREATE POLICY "Anyone can read niche patterns"
  ON niche_patterns FOR SELECT USING (TRUE);
CREATE POLICY "Anyone can read trending niches"
  ON trending_niches FOR SELECT USING (TRUE);

-- =====================================================
-- TRIGGER: auto-create profile on user signup
-- =====================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =====================================================
-- SEED: Trending Niches (initial data)
-- =====================================================
INSERT INTO trending_niches (week, niches) VALUES (
  '2026-W22',
  '[
    {"name": "AI Tools", "score": 98, "growth_pct": 45, "emoji": "🤖"},
    {"name": "Side Hustle", "score": 94, "growth_pct": 32, "emoji": "💰"},
    {"name": "Skincare Lokal", "score": 91, "growth_pct": 28, "emoji": "✨"},
    {"name": "Fashion Pria Budget", "score": 88, "growth_pct": 22, "emoji": "👕"},
    {"name": "Gadget Under 200rb", "score": 85, "growth_pct": 19, "emoji": "📱"}
  ]'::jsonb
) ON CONFLICT DO NOTHING;
