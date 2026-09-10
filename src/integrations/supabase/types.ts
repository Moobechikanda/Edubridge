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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      announcement_reads: {
        Row: {
          announcement_id: string
          id: string
          read_at: string
          user_id: string
        }
        Insert: {
          announcement_id: string
          id?: string
          read_at?: string
          user_id: string
        }
        Update: {
          announcement_id?: string
          id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_reads_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          body: string
          class_id: string
          created_at: string
          id: string
          notified_at: string | null
          publish_at: string
          teacher_id: string
          title: string
        }
        Insert: {
          body: string
          class_id: string
          created_at?: string
          id?: string
          notified_at?: string | null
          publish_at?: string
          teacher_id: string
          title: string
        }
        Update: {
          body?: string
          class_id?: string
          created_at?: string
          id?: string
          notified_at?: string | null
          publish_at?: string
          teacher_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_scores: {
        Row: {
          assessment_id: string
          created_at: string
          feedback: string | null
          graded_by: string
          id: string
          score: number
          student_id: string
          updated_at: string
        }
        Insert: {
          assessment_id: string
          created_at?: string
          feedback?: string | null
          graded_by: string
          id?: string
          score: number
          student_id: string
          updated_at?: string
        }
        Update: {
          assessment_id?: string
          created_at?: string
          feedback?: string | null
          graded_by?: string
          id?: string
          score?: number
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_scores_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      assessments: {
        Row: {
          class_id: string
          coverage: string | null
          created_at: string
          created_by: string
          id: string
          points: number
          scheduled_at: string
          title: string
        }
        Insert: {
          class_id: string
          coverage?: string | null
          created_at?: string
          created_by: string
          id?: string
          points?: number
          scheduled_at: string
          title: string
        }
        Update: {
          class_id?: string
          coverage?: string | null
          created_at?: string
          created_by?: string
          id?: string
          points?: number
          scheduled_at?: string
          title?: string
        }
        Relationships: []
      }
      assignments: {
        Row: {
          assignment_type: string
          class_id: string
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          points: number
          title: string
          updated_at: string
        }
        Insert: {
          assignment_type?: string
          class_id: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          points?: number
          title: string
          updated_at?: string
        }
        Update: {
          assignment_type?: string
          class_id?: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          points?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          created_at: string
          description: string | null
          grade_level: number | null
          id: string
          join_code: string
          name: string
          subject: string | null
          teacher_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          grade_level?: number | null
          id?: string
          join_code?: string
          name: string
          subject?: string | null
          teacher_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          grade_level?: number | null
          id?: string
          join_code?: string
          name?: string
          subject?: string | null
          teacher_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      enrollments: {
        Row: {
          class_id: string
          created_at: string
          id: string
          student_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          student_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_rsvps: {
        Row: {
          created_at: string
          id: string
          meeting_id: string
          note: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          meeting_id: string
          note?: string | null
          status: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          meeting_id?: string
          note?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_rsvps_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          location: string | null
          scheduled_at: string
          title: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          location?: string | null
          scheduled_at: string
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          location?: string | null
          scheduled_at?: string
          title?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string
          created_at: string
          id: string
          read_at: string | null
          recipient_id: string
          sender_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id: string
          sender_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      notification_audit_log: {
        Row: {
          created_at: string
          delivered: boolean
          id: string
          kind: string
          reason: string | null
          source_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          delivered: boolean
          id?: string
          kind: string
          reason?: string | null
          source_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          delivered?: boolean
          id?: string
          kind?: string
          reason?: string | null
          source_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          announcements: boolean
          grades: boolean
          messages: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          announcements?: boolean
          grades?: boolean
          messages?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          announcements?: boolean
          grades?: boolean
          messages?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      parent_links: {
        Row: {
          created_at: string
          id: string
          parent_id: string
          student_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          parent_id: string
          student_id: string
        }
        Update: {
          created_at?: string
          id?: string
          parent_id?: string
          student_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          contact_email: string | null
          contact_phone: string | null
          contact_socials: string | null
          contact_whatsapp: string | null
          created_at: string
          full_name: string | null
          id: string
          parent_code: string
          updated_at: string
        }
        Insert: {
          contact_email?: string | null
          contact_phone?: string | null
          contact_socials?: string | null
          contact_whatsapp?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          parent_code?: string
          updated_at?: string
        }
        Update: {
          contact_email?: string | null
          contact_phone?: string | null
          contact_socials?: string | null
          contact_whatsapp?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          parent_code?: string
          updated_at?: string
        }
        Relationships: []
      }
      school_announcements: {
        Row: {
          body: string
          category: string
          created_at: string
          id: string
          notified_at: string | null
          pinned: boolean
          posted_by: string
          publish_at: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          title: string
        }
        Insert: {
          body: string
          category: string
          created_at?: string
          id?: string
          notified_at?: string | null
          pinned?: boolean
          posted_by: string
          publish_at?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          title: string
        }
        Update: {
          body?: string
          category?: string
          created_at?: string
          id?: string
          notified_at?: string | null
          pinned?: boolean
          posted_by?: string
          publish_at?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          title?: string
        }
        Relationships: []
      }
      student_fees: {
        Row: {
          amount: number
          amount_paid: number
          created_at: string
          created_by: string
          currency: string
          description: string | null
          due_date: string
          id: string
          status: string
          student_id: string
          title: string
          updated_at: string
        }
        Insert: {
          amount: number
          amount_paid?: number
          created_at?: string
          created_by: string
          currency?: string
          description?: string | null
          due_date: string
          id?: string
          status?: string
          student_id: string
          title: string
          updated_at?: string
        }
        Update: {
          amount?: number
          amount_paid?: number
          created_at?: string
          created_by?: string
          currency?: string
          description?: string | null
          due_date?: string
          id?: string
          status?: string
          student_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_fees_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_fees_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          code: string | null
          created_at: string
          description: string | null
          id: string
          max_grade: number | null
          min_grade: number | null
          name: string
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          max_grade?: number | null
          min_grade?: number | null
          name: string
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          max_grade?: number | null
          min_grade?: number | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      class_subjects: {
        Row: {
          class_id: string
          created_at: string
          id: string
          subject_id: string
          teacher_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          subject_id: string
          teacher_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          subject_id?: string
          teacher_id?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          audience: string
          created_at: string
          created_by: string
          description: string | null
          end_at: string | null
          event_type: string
          id: string
          location: string | null
          start_at: string
          title: string
          updated_at: string
        }
        Insert: {
          audience?: string
          created_at?: string
          created_by: string
          description?: string | null
          end_at?: string | null
          event_type?: string
          id?: string
          location?: string | null
          start_at: string
          title: string
          updated_at?: string
        }
        Update: {
          audience?: string
          created_at?: string
          created_by?: string
          description?: string | null
          end_at?: string | null
          event_type?: string
          id?: string
          location?: string | null
          start_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      submissions: {
        Row: {
          assignment_id: string
          content: string | null
          feedback: string | null
          grade: number | null
          graded_at: string | null
          id: string
          student_id: string
          submitted_at: string
        }
        Insert: {
          assignment_id: string
          content?: string | null
          feedback?: string | null
          grade?: number | null
          graded_at?: string | null
          id?: string
          student_id: string
          submitted_at?: string
        }
        Update: {
          assignment_id?: string
          content?: string | null
          feedback?: string | null
          grade?: number | null
          graded_at?: string | null
          id?: string
          student_id?: string
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_delete_user: {
        Args: { _user_id: string }
        Returns: undefined
      }
      admin_set_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: undefined
      }
      can_message: {
        Args: { _recipient: string; _sender: string }
        Returns: boolean
      }
      get_message_contacts: {
        Args: never
        Returns: {
          contact_email: string
          contact_phone: string
          contact_socials: string
          contact_whatsapp: string
          full_name: string
          id: string
          related_class_names: string
          related_student_names: string
          role: string
        }[]
      }
      get_class_rankings: {
        Args: { _class_id: string }
        Returns: {
          full_name: string
          graded_count: number
          rank: number
          student_id: string
          total_points: number
        }[]
      }
      get_meeting_attendees: {
        Args: { _meeting_id: string }
        Returns: {
          full_name: string
          note: string
          status: string
          updated_at: string
          user_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_assignment_teacher: {
        Args: { _assignment_id: string; _user_id: string }
        Returns: boolean
      }
      is_class_student: {
        Args: { _class_id: string; _user_id: string }
        Returns: boolean
      }
      is_class_teacher: {
        Args: { _class_id: string; _user_id: string }
        Returns: boolean
      }
      is_linked_parent: {
        Args: { _parent_id: string; _student_id: string }
        Returns: boolean
      }
      is_parent_of_class_student: {
        Args: { _class_id: string; _parent_id: string }
        Returns: boolean
      }
      is_parent_of_my_student: {
        Args: { _parent_id: string; _teacher_id: string }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      join_class_by_code: {
        Args: { _code: string }
        Returns: {
          class_id: string
          class_name: string
        }[]
      }
      link_child_by_code: { Args: { _code: string }; Returns: string }
      notif_pref: {
        Args: { _kind: string; _user_id: string }
        Returns: boolean
      }
      notify_announcement_row: { Args: { _id: string }; Returns: undefined }
      notify_school_announcement_row: {
        Args: { _id: string }
        Returns: undefined
      }
      preview_student_by_code: {
        Args: { _code: string }
        Returns: {
          full_name: string
          student_id: string
        }[]
      }
      publish_due_announcements: { Args: never; Returns: number }
      rsvp_meeting: {
        Args: { _meeting_id: string; _note?: string; _status: string }
        Returns: undefined
      }
      get_announcement_seen_stats: {
        Args: { _announcement_id: string }
        Returns: {
          seen_count: number
          total_recipients: number
        }[]
      }
      get_assignment_status: {
        Args: { _assignment_id: string; _student_id: string }
        Returns: string
      }
      get_assignment_stats: {
        Args: { _assignment_id: string; _class_id: string }
        Returns: {
          total_students: number
          attempted: number
          completed: number
          in_progress: number
          not_attempted: number
          missed: number
          late: number
          pending_marking: number
          marked: number
          avg_score: number
          highest_score: number
          lowest_score: number
          completion_percentage: number
        }[]
      }
    }
    Enums: {
      app_role: "student" | "teacher" | "parent" | "admin"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["student", "teacher", "parent", "admin"],
    },
  },
} as const
