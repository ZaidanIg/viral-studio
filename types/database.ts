export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          is_subscribed: boolean
          subscribed_at: string | null
          subscription_expires_at: string | null
          created_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          is_subscribed?: boolean
          subscribed_at?: string | null
          subscription_expires_at?: string | null
          created_at?: string
        }
        Update: {
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          is_subscribed?: boolean
          subscribed_at?: string | null
          subscription_expires_at?: string | null
        }
      }
      daily_usage: {
        Row: {
          id: string
          user_id: string
          date: string
          count: number
        }
        Insert: {
          id?: string
          user_id: string
          date?: string
          count?: number
        }
        Update: {
          count?: number
        }
      }
      characters: {
        Row: {
          id: string
          user_id: string
          label_name: string
          anchor_phrase: string
          anchor_hash: string
          image_urls: string[]
          analysis: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          label_name: string
          anchor_phrase: string
          anchor_hash: string
          image_urls?: string[]
          analysis?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          label_name?: string
          image_urls?: string[]
          analysis?: Json | null
          updated_at?: string
        }
      }
      products: {
        Row: {
          id: string
          user_id: string
          product_name: string
          category: string | null
          benefits: string[]
          visual_desc: string | null
          image_urls: string[]
          detected_niche: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          product_name: string
          category?: string | null
          benefits?: string[]
          visual_desc?: string | null
          image_urls?: string[]
          detected_niche?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          product_name?: string
          category?: string | null
          benefits?: string[]
          visual_desc?: string | null
          image_urls?: string[]
          detected_niche?: Json | null
          updated_at?: string
        }
      }
      storyboards: {
        Row: {
          id: string
          user_id: string
          character_id: string | null
          product_id: string | null
          selected_angle: Json | null
          selected_persona: Json | null
          selected_niche: string | null
          framework: string | null
          scenes: Json[]
          status: 'draft' | 'generating' | 'complete' | 'failed'
          rating: number | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          character_id?: string | null
          product_id?: string | null
          selected_angle?: Json | null
          selected_persona?: Json | null
          selected_niche?: string | null
          framework?: string | null
          scenes?: Json[]
          status?: 'draft' | 'generating' | 'complete' | 'failed'
          rating?: number | null
          created_at?: string
        }
        Update: {
          character_id?: string | null
          product_id?: string | null
          selected_angle?: Json | null
          selected_persona?: Json | null
          selected_niche?: string | null
          framework?: string | null
          scenes?: Json[]
          status?: 'draft' | 'generating' | 'complete' | 'failed'
          rating?: number | null
        }
      }
      niche_patterns: {
        Row: {
          id: string
          niche_id: string
          display_name: string
          angles: Json[]
          personas: Json[]
          content_matrix: Json[]
          competitor_patterns: Json | null
          version: number
          updated_at: string
        }
        Insert: {
          id?: string
          niche_id: string
          display_name: string
          angles?: Json[]
          personas?: Json[]
          content_matrix?: Json[]
          competitor_patterns?: Json | null
          version?: number
          updated_at?: string
        }
        Update: {
          display_name?: string
          angles?: Json[]
          personas?: Json[]
          content_matrix?: Json[]
          competitor_patterns?: Json | null
          version?: number
          updated_at?: string
        }
      }
      trending_niches: {
        Row: {
          id: string
          week: string
          niches: Json[]
          updated_at: string
        }
        Insert: {
          id?: string
          week: string
          niches?: Json[]
          updated_at?: string
        }
        Update: {
          niches?: Json[]
          updated_at?: string
        }
      }
    }
  }
}

// =====================================================
// Domain Types
// =====================================================

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Character = Database['public']['Tables']['characters']['Row']
export type Product = Database['public']['Tables']['products']['Row']
export type Storyboard = Database['public']['Tables']['storyboards']['Row']

export interface TrendingNiche {
  name: string
  score: number
  growth_pct: number
  emoji: string
}

export interface NicheDetectionResult {
  primary_niche: string
  secondary_niche: string
  sub_niches: Array<{ name: string; description: string }>
  opportunity_scores: Array<{
    niche: string
    score: number
    reason: string
    difficulty: 'Mudah' | 'Medium' | 'Sulit'
  }>
  content_angles: Array<{
    type: string
    name: string
    hook_example: string
    why_effective: string
    estimated_ctr: 'Sangat Tinggi' | 'Tinggi' | 'Medium-Tinggi' | 'Medium'
  }>
  creator_personas: Array<{
    name: string
    description: string
    content_style: string
  }>
  platform_scores: {
    tiktok: number
    reels: number
    shorts: number
    facebook: number
  }
  content_matrix: Array<{
    niche: string
    angle: string
    hook_ready_to_use: string
  }>
  competitor_pattern: {
    hook_pattern: string
    body_pattern: string
    cta_pattern: string
  }
}

export interface StoryboardScene {
  scene_type: string
  scene_label: string
  scene_description: string
  video_prompt: string
  flow_prompt: string
  narasi_script: string
  camera_suggestion: string
  image_base64?: string | null
  image_urls?: string[]
  selected_image_url?: string
}
