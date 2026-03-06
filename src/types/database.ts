export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Assistant {
  id: string
  name: string
  slug: string
  description: string | null
  icon_url: string | null
  system_prompt: string
  model: string
  temperature: number
  max_tokens: number
  is_active: boolean
  sort_order: number
  sample_questions: string[] | null
  created_at: string
  updated_at: string
}

export interface KnowledgeBase {
  id: string
  content: string
  metadata: Json
  embedding: number[] | null
  assistant_slug: string | null
  created_at: string
  created_by: string | null
}

export type Database = {
  public: {
    Tables: {
      assistants: {
        Row: {
          id: string
          name: string
          slug: string
          description: string | null
          icon_url: string | null
          system_prompt: string
          model: string
          temperature: number
          max_tokens: number
          is_active: boolean
          sort_order: number
          sample_questions: string[] | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          description?: string | null
          icon_url?: string | null
          system_prompt: string
          model?: string
          temperature?: number
          max_tokens?: number
          is_active?: boolean
          sort_order?: number
          sample_questions?: string[] | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          description?: string | null
          icon_url?: string | null
          system_prompt?: string
          model?: string
          temperature?: number
          max_tokens?: number
          is_active?: boolean
          sort_order?: number
          sample_questions?: string[] | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      knowledge_base: {
        Row: {
          id: string
          content: string
          metadata: Json
          embedding: number[] | null
          assistant_slug: string | null
          created_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          content: string
          metadata?: Json
          embedding?: number[] | null
          assistant_slug?: string | null
          created_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          content?: string
          metadata?: Json
          embedding?: number[] | null
          assistant_slug?: string | null
          created_at?: string
          created_by?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      match_knowledge: {
        Args: {
          query_embedding: number[]
          match_threshold?: number
          match_count?: number
          filter_assistant?: string | null
        }
        Returns: {
          id: string
          content: string
          metadata: Json
          assistant_slug: string | null
          similarity: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
