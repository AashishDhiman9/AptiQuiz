export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      answers: {
        Row: {
          choice_index: number | null
          correct: boolean
          created_at: string
          difficulty: string
          elapsed_ms: number
          id: string
          participant_id: string
          points: number
          question_id: string | null
          question_index: number
          room_id: string
          topic: string
          user_id: string | null
        }
        Insert: {
          choice_index?: number | null
          correct?: boolean
          created_at?: string
          difficulty: string
          elapsed_ms?: number
          id?: string
          participant_id: string
          points?: number
          question_id?: string | null
          question_index: number
          room_id: string
          topic: string
          user_id?: string | null
        }
        Update: {
          choice_index?: number | null
          correct?: boolean
          created_at?: string
          difficulty?: string
          elapsed_ms?: number
          id?: string
          participant_id?: string
          points?: number
          question_id?: string | null
          question_index?: number
          room_id?: string
          topic?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "answers_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answers_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      colleges: {
        Row: {
          city: string
          id: string
          name: string
          short_name: string
        }
        Insert: {
          city?: string
          id?: string
          name: string
          short_name: string
        }
        Update: {
          city?: string
          id?: string
          name?: string
          short_name?: string
        }
        Relationships: []
      }
      participant_secrets: {
        Row: {
          participant_id: string
          token_hash: string
        }
        Insert: {
          participant_id: string
          token_hash: string
        }
        Update: {
          participant_id?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "participant_secrets_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: true
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      participants: {
        Row: {
          answered_count: number
          college_id: string | null
          correct_count: number
          display_name: string
          id: string
          joined_at: string
          last_seen: string
          prev_rank: number | null
          rank: number | null
          room_id: string
          score: number
          token_hash: string
          total_time_ms: number
          user_id: string | null
        }
        Insert: {
          answered_count?: number
          college_id?: string | null
          correct_count?: number
          display_name: string
          id?: string
          joined_at?: string
          last_seen?: string
          prev_rank?: number | null
          rank?: number | null
          room_id: string
          score?: number
          token_hash?: string
          total_time_ms?: number
          user_id?: string | null
        }
        Update: {
          answered_count?: number
          college_id?: string | null
          correct_count?: number
          display_name?: string
          id?: string
          joined_at?: string
          last_seen?: string
          prev_rank?: number | null
          rank?: number | null
          room_id?: string
          score?: number
          token_hash?: string
          total_time_ms?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "participants_college_id_fkey"
            columns: ["college_id"]
            isOneToOne: false
            referencedRelation: "colleges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participants_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          college_id: string | null
          created_at: string
          display_name: string
          id: string
          role: "player" | "host"
        }
        Insert: {
          college_id?: string | null
          created_at?: string
          display_name?: string
          id: string
          role?: never
        }
        Update: {
          college_id?: string | null
          created_at?: string
          display_name?: string
          id?: string
          role?: never
        }
        Relationships: [
          {
            foreignKeyName: "profiles_college_id_fkey"
            columns: ["college_id"]
            isOneToOne: false
            referencedRelation: "colleges"
            referencedColumns: ["id"]
          },
        ]
      }
      host_requests: {
        Row: {
          requested_at: string
          reviewed_at: string | null
          status: "pending" | "approved" | "rejected"
          user_id: string
        }
        Insert: {
          requested_at?: string
          reviewed_at?: never
          status?: never
          user_id: string
        }
        Update: {
          requested_at?: never
          reviewed_at?: never
          status?: never
          user_id?: never
        }
        Relationships: []
      }
      question_keys: {
        Row: {
          correct_index: number
          question_id: string
        }
        Insert: {
          correct_index: number
          question_id: string
        }
        Update: {
          correct_index?: number
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_keys_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: true
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      question_sets: {
        Row: {
          created_at: string
          description: string
          id: string
          is_sample: boolean
          owner_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          is_sample?: boolean
          owner_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          is_sample?: boolean
          owner_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      questions: {
        Row: {
          created_at: string
          difficulty: string
          explanation: string
          id: string
          image_url: string | null
          options: Json
          position: number
          set_id: string
          text: string
          time_limit_sec: number
          topic: string
        }
        Insert: {
          created_at?: string
          difficulty: string
          explanation?: string
          id?: string
          image_url?: string | null
          options: Json
          position?: number
          set_id: string
          text: string
          time_limit_sec?: number
          topic: string
        }
        Update: {
          created_at?: string
          difficulty?: string
          explanation?: string
          id?: string
          image_url?: string | null
          options?: Json
          position?: number
          set_id?: string
          text?: string
          time_limit_sec?: number
          topic?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_set_id_fkey"
            columns: ["set_id"]
            isOneToOne: false
            referencedRelation: "question_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          answered_count: number
          code: string
          created_at: string
          current_index: number
          current_question: Json | null
          finished_at: string | null
          host_id: string | null
          id: string
          is_demo: boolean
          max_players: number
          name: string
          phase_ends_at: string | null
          phase_started_at: string | null
          question_duration_ms: number
          quiz_title: string
          reveal: Json | null
          set_id: string | null
          status: string
          total_questions: number
        }
        Insert: {
          answered_count?: number
          code: string
          created_at?: string
          current_index?: number
          current_question?: Json | null
          finished_at?: string | null
          host_id?: string | null
          id?: string
          is_demo?: boolean
          max_players?: number
          name: string
          phase_ends_at?: string | null
          phase_started_at?: string | null
          question_duration_ms?: number
          quiz_title?: string
          reveal?: Json | null
          set_id?: string | null
          status?: string
          total_questions?: number
        }
        Update: {
          answered_count?: number
          code?: string
          created_at?: string
          current_index?: number
          current_question?: Json | null
          finished_at?: string | null
          host_id?: string | null
          id?: string
          is_demo?: boolean
          max_players?: number
          name?: string
          phase_ends_at?: string | null
          phase_started_at?: string | null
          question_duration_ms?: number
          quiz_title?: string
          reveal?: Json | null
          set_id?: string | null
          status?: string
          total_questions?: number
        }
        Relationships: [
          {
            foreignKeyName: "rooms_set_id_fkey"
            columns: ["set_id"]
            isOneToOne: false
            referencedRelation: "question_sets"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_sample_set: { Args: { _set: string }; Returns: boolean }
      owns_question: { Args: { _q: string }; Returns: boolean }
      owns_set: { Args: { _set: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
