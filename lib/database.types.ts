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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      academic_programs: {
        Row: {
          created_at: string | null
          degree: string | null
          id: string
          name: string
          university_id: string | null
        }
        Insert: {
          created_at?: string | null
          degree?: string | null
          id?: string
          name: string
          university_id?: string | null
        }
        Update: {
          created_at?: string | null
          degree?: string | null
          id?: string
          name?: string
          university_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "academic_programs_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      academic_schemes: {
        Row: {
          created_at: string | null
          id: string
          name: string
          regulation_year: number | null
          university_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          regulation_year?: number | null
          university_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          regulation_year?: number | null
          university_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "academic_schemes_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      accountability_pods: {
        Row: {
          branch: string | null
          company_tier: string | null
          created_at: string
          description: string | null
          id: string
          max_members: number
          name: string
          next_checkin_at: string | null
          preferred_checkin_day: string | null
          preferred_checkin_time: string | null
          semester_number: number | null
          skill_level: string | null
          status: string
          target_role: string | null
          timezone: string | null
          updated_at: string
          video_room_url: string | null
        }
        Insert: {
          branch?: string | null
          company_tier?: string | null
          created_at?: string
          description?: string | null
          id?: string
          max_members?: number
          name: string
          next_checkin_at?: string | null
          preferred_checkin_day?: string | null
          preferred_checkin_time?: string | null
          semester_number?: number | null
          skill_level?: string | null
          status?: string
          target_role?: string | null
          timezone?: string | null
          updated_at?: string
          video_room_url?: string | null
        }
        Update: {
          branch?: string | null
          company_tier?: string | null
          created_at?: string
          description?: string | null
          id?: string
          max_members?: number
          name?: string
          next_checkin_at?: string | null
          preferred_checkin_day?: string | null
          preferred_checkin_time?: string | null
          semester_number?: number | null
          skill_level?: string | null
          status?: string
          target_role?: string | null
          timezone?: string | null
          updated_at?: string
          video_room_url?: string | null
        }
        Relationships: []
      }
      ai_interview_answers: {
        Row: {
          answer: string
          created_at: string
          feedback: string | null
          id: string
          question: string
          question_number: number
          score: number
          session_id: string | null
        }
        Insert: {
          answer: string
          created_at?: string
          feedback?: string | null
          id?: string
          question: string
          question_number: number
          score?: number
          session_id?: string | null
        }
        Update: {
          answer?: string
          created_at?: string
          feedback?: string | null
          id?: string
          question?: string
          question_number?: number
          score?: number
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_interview_answers_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ai_interview_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_interview_sessions: {
        Row: {
          answered_questions: number
          created_at: string
          difficulty: string
          id: string
          improvement_plan: string | null
          mode: string
          percentage: number
          role: string
          strengths: string | null
          total_questions: number
          total_score: number
          user_id: string | null
          weaknesses: string | null
        }
        Insert: {
          answered_questions?: number
          created_at?: string
          difficulty: string
          id?: string
          improvement_plan?: string | null
          mode: string
          percentage?: number
          role: string
          strengths?: string | null
          total_questions?: number
          total_score?: number
          user_id?: string | null
          weaknesses?: string | null
        }
        Update: {
          answered_questions?: number
          created_at?: string
          difficulty?: string
          id?: string
          improvement_plan?: string | null
          mode?: string
          percentage?: number
          role?: string
          strengths?: string | null
          total_questions?: number
          total_score?: number
          user_id?: string | null
          weaknesses?: string | null
        }
        Relationships: []
      }
      ai_placement_plans: {
        Row: {
          cgpa_score: number
          created_at: string
          dsa_score: number
          id: string
          projects_score: number
          readiness_score: number
          recommendation: string
          skills_score: number
          user_id: string
        }
        Insert: {
          cgpa_score?: number
          created_at?: string
          dsa_score?: number
          id?: string
          projects_score?: number
          readiness_score?: number
          recommendation: string
          skills_score?: number
          user_id: string
        }
        Update: {
          cgpa_score?: number
          created_at?: string
          dsa_score?: number
          id?: string
          projects_score?: number
          readiness_score?: number
          recommendation?: string
          skills_score?: number
          user_id?: string
        }
        Relationships: []
      }
      ai_roadmaps: {
        Row: {
          created_at: string
          id: string
          readiness_focus: string | null
          roadmap: Json
          summary: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          readiness_focus?: string | null
          roadmap: Json
          summary?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          readiness_focus?: string | null
          roadmap?: Json
          summary?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      aptitude_attempts: {
        Row: {
          attempted_at: string | null
          category: string
          id: number
          is_correct: boolean
          question_id: number | null
          selected_answer: string | null
          user_id: string
        }
        Insert: {
          attempted_at?: string | null
          category: string
          id?: number
          is_correct?: boolean
          question_id?: number | null
          selected_answer?: string | null
          user_id: string
        }
        Update: {
          attempted_at?: string | null
          category?: string
          id?: number
          is_correct?: boolean
          question_id?: number | null
          selected_answer?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "aptitude_attempts_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "aptitude_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      aptitude_questions: {
        Row: {
          category: string
          correct_answer: string
          created_at: string | null
          explanation: string | null
          id: number
          option_a: string
          option_b: string
          option_c: string
          option_d: string
          question: string
        }
        Insert: {
          category: string
          correct_answer: string
          created_at?: string | null
          explanation?: string | null
          id?: number
          option_a: string
          option_b: string
          option_c: string
          option_d: string
          question: string
        }
        Update: {
          category?: string
          correct_answer?: string
          created_at?: string | null
          explanation?: string | null
          id?: number
          option_a?: string
          option_b?: string
          option_c?: string
          option_d?: string
          question?: string
        }
        Relationships: []
      }
      branches: {
        Row: {
          created_at: string | null
          id: string
          name: string
          short_name: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          short_name?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          short_name?: string | null
        }
        Relationships: []
      }
      campus_companies: {
        Row: {
          created_at: string
          description: string | null
          id: string
          industry: string | null
          name: string
          updated_at: string
          website: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          industry?: string | null
          name: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          industry?: string | null
          name?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      campus_company_visits: {
        Row: {
          college_id: string
          company_id: string
          created_at: string
          eligible_branch: string | null
          id: string
          job_type: string | null
          minimum_cgpa: number | null
          package_lpa: number | null
          placement_status: string | null
          role: string | null
          updated_at: string
          visit_notes: string | null
          visit_year: number
        }
        Insert: {
          college_id: string
          company_id: string
          created_at?: string
          eligible_branch?: string | null
          id?: string
          job_type?: string | null
          minimum_cgpa?: number | null
          package_lpa?: number | null
          placement_status?: string | null
          role?: string | null
          updated_at?: string
          visit_notes?: string | null
          visit_year: number
        }
        Update: {
          college_id?: string
          company_id?: string
          created_at?: string
          eligible_branch?: string | null
          id?: string
          job_type?: string | null
          minimum_cgpa?: number | null
          package_lpa?: number | null
          placement_status?: string | null
          role?: string | null
          updated_at?: string
          visit_notes?: string | null
          visit_year?: number
        }
        Relationships: [
          {
            foreignKeyName: "campus_company_visits_college_id_fkey"
            columns: ["college_id"]
            isOneToOne: false
            referencedRelation: "colleges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campus_company_visits_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "campus_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      campus_intel_submissions: {
        Row: {
          college_id: string | null
          company_name: string | null
          content: string
          created_at: string
          id: string
          moderated_at: string | null
          moderation_status: string
          moderator_notes: string | null
          published_at: string | null
          published_by: string | null
          published_visit_id: string | null
          role: string | null
          submission_type: string
          title: string
          updated_at: string
          user_id: string
          visit_year: number | null
        }
        Insert: {
          college_id?: string | null
          company_name?: string | null
          content: string
          created_at?: string
          id?: string
          moderated_at?: string | null
          moderation_status?: string
          moderator_notes?: string | null
          published_at?: string | null
          published_by?: string | null
          published_visit_id?: string | null
          role?: string | null
          submission_type: string
          title: string
          updated_at?: string
          user_id: string
          visit_year?: number | null
        }
        Update: {
          college_id?: string | null
          company_name?: string | null
          content?: string
          created_at?: string
          id?: string
          moderated_at?: string | null
          moderation_status?: string
          moderator_notes?: string | null
          published_at?: string | null
          published_by?: string | null
          published_visit_id?: string | null
          role?: string | null
          submission_type?: string
          title?: string
          updated_at?: string
          user_id?: string
          visit_year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "campus_intel_submissions_college_id_fkey"
            columns: ["college_id"]
            isOneToOne: false
            referencedRelation: "colleges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campus_intel_submissions_published_visit_id_fkey"
            columns: ["published_visit_id"]
            isOneToOne: false
            referencedRelation: "campus_company_visits"
            referencedColumns: ["id"]
          },
        ]
      }
      campus_interview_embeddings: {
        Row: {
          content: string
          created_at: string
          embedding: string | null
          id: string
          metadata: Json
          question_id: string | null
          report_id: string | null
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          embedding?: string | null
          id?: string
          metadata?: Json
          question_id?: string | null
          report_id?: string | null
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          embedding?: string | null
          id?: string
          metadata?: Json
          question_id?: string | null
          report_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campus_interview_embeddings_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "campus_interview_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campus_interview_embeddings_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "campus_interview_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      campus_interview_questions: {
        Row: {
          category: string
          created_at: string
          difficulty: string | null
          id: string
          question: string
          report_id: string
          round_name: string | null
        }
        Insert: {
          category: string
          created_at?: string
          difficulty?: string | null
          id?: string
          question: string
          report_id: string
          round_name?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          difficulty?: string | null
          id?: string
          question?: string
          report_id?: string
          round_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campus_interview_questions_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "campus_interview_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      campus_interview_reports: {
        Row: {
          anonymous: boolean
          college_id: string | null
          company_id: string | null
          company_name: string | null
          created_at: string
          difficulty: string | null
          id: string
          interview_year: number | null
          moderated_at: string | null
          moderation_status: string
          moderator_notes: string | null
          overall_experience: string | null
          preparation_advice: string | null
          result: string | null
          role: string | null
          rounds_count: number | null
          source_submission_id: string | null
          updated_at: string
          user_id: string
          visit_id: string
        }
        Insert: {
          anonymous?: boolean
          college_id?: string | null
          company_id?: string | null
          company_name?: string | null
          created_at?: string
          difficulty?: string | null
          id?: string
          interview_year?: number | null
          moderated_at?: string | null
          moderation_status?: string
          moderator_notes?: string | null
          overall_experience?: string | null
          preparation_advice?: string | null
          result?: string | null
          role?: string | null
          rounds_count?: number | null
          source_submission_id?: string | null
          updated_at?: string
          user_id: string
          visit_id: string
        }
        Update: {
          anonymous?: boolean
          college_id?: string | null
          company_id?: string | null
          company_name?: string | null
          created_at?: string
          difficulty?: string | null
          id?: string
          interview_year?: number | null
          moderated_at?: string | null
          moderation_status?: string
          moderator_notes?: string | null
          overall_experience?: string | null
          preparation_advice?: string | null
          result?: string | null
          role?: string | null
          rounds_count?: number | null
          source_submission_id?: string | null
          updated_at?: string
          user_id?: string
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campus_interview_reports_college_id_fkey"
            columns: ["college_id"]
            isOneToOne: false
            referencedRelation: "colleges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campus_interview_reports_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "campus_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campus_interview_reports_source_submission_id_fkey"
            columns: ["source_submission_id"]
            isOneToOne: false
            referencedRelation: "campus_intel_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campus_interview_reports_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "campus_company_visits"
            referencedColumns: ["id"]
          },
        ]
      }
      career_goals: {
        Row: {
          created_at: string | null
          id: number
          primary_goal: string
          target_role: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: number
          primary_goal: string
          target_role: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: number
          primary_goal?: string
          target_role?: string
          user_id?: string
        }
        Relationships: []
      }
      college_branches: {
        Row: {
          branch_id: string
          college_id: string
          created_at: string | null
          id: string
        }
        Insert: {
          branch_id: string
          college_id: string
          created_at?: string | null
          id?: string
        }
        Update: {
          branch_id?: string
          college_id?: string
          created_at?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "college_branches_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "college_branches_college_id_fkey"
            columns: ["college_id"]
            isOneToOne: false
            referencedRelation: "colleges"
            referencedColumns: ["id"]
          },
        ]
      }
      colleges: {
        Row: {
          city: string | null
          country: string | null
          created_at: string | null
          id: string
          name: string
          official_website: string | null
          state: string | null
          university_id: string | null
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string | null
          id?: string
          name: string
          official_website?: string | null
          state?: string | null
          university_id?: string | null
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string | null
          id?: string
          name?: string
          official_website?: string | null
          state?: string | null
          university_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "colleges_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      curriculum_subjects: {
        Row: {
          branch: string
          college: string | null
          created_at: string | null
          description: string | null
          id: string
          interview_relevance: string
          interview_topics: string[] | null
          regulation: string | null
          semester: string
          subject_code: string | null
          subject_name: string
          syllabus_scheme: string | null
          university: string | null
        }
        Insert: {
          branch: string
          college?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          interview_relevance?: string
          interview_topics?: string[] | null
          regulation?: string | null
          semester: string
          subject_code?: string | null
          subject_name: string
          syllabus_scheme?: string | null
          university?: string | null
        }
        Update: {
          branch?: string
          college?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          interview_relevance?: string
          interview_topics?: string[] | null
          regulation?: string | null
          semester?: string
          subject_code?: string | null
          subject_name?: string
          syllabus_scheme?: string | null
          university?: string | null
        }
        Relationships: []
      }
      dsa_problem_bank: {
        Row: {
          created_at: string
          description: string
          difficulty: string
          examples: Json
          id: number
          starter_code: Json
          title: string
        }
        Insert: {
          created_at?: string
          description: string
          difficulty: string
          examples?: Json
          id?: number
          starter_code?: Json
          title: string
        }
        Update: {
          created_at?: string
          description?: string
          difficulty?: string
          examples?: Json
          id?: number
          starter_code?: Json
          title?: string
        }
        Relationships: []
      }
      dsa_problem_library: {
        Row: {
          category: string
          constraints_text: string | null
          created_at: string | null
          description: string
          difficulty: string
          examples: Json | null
          id: number
          slug: string
          starter_code: string | null
          title: string
        }
        Insert: {
          category: string
          constraints_text?: string | null
          created_at?: string | null
          description: string
          difficulty: string
          examples?: Json | null
          id?: number
          slug: string
          starter_code?: string | null
          title: string
        }
        Update: {
          category?: string
          constraints_text?: string | null
          created_at?: string | null
          description?: string
          difficulty?: string
          examples?: Json | null
          id?: number
          slug?: string
          starter_code?: string | null
          title?: string
        }
        Relationships: []
      }
      dsa_problems: {
        Row: {
          created_at: string
          difficulty: string
          id: number
          problem_name: string
          solved_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          difficulty: string
          id?: number
          problem_name: string
          solved_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          difficulty?: string
          id?: number
          problem_name?: string
          solved_at?: string
          user_id?: string
        }
        Relationships: []
      }
      dsa_submissions: {
        Row: {
          created_at: string
          id: number
          language: string
          problem_id: number
          source_code: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: number
          language: string
          problem_id: number
          source_code: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: number
          language?: string
          problem_id?: number
          source_code?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dsa_submissions_problem_id_fkey"
            columns: ["problem_id"]
            isOneToOne: false
            referencedRelation: "dsa_problem_bank"
            referencedColumns: ["id"]
          },
        ]
      }
      mentor_availability: {
        Row: {
          created_at: string | null
          day_of_week: number
          end_time: string
          id: string
          is_active: boolean | null
          mentor_id: string
          start_time: string
          timezone: string | null
        }
        Insert: {
          created_at?: string | null
          day_of_week: number
          end_time: string
          id?: string
          is_active?: boolean | null
          mentor_id: string
          start_time: string
          timezone?: string | null
        }
        Update: {
          created_at?: string | null
          day_of_week?: number
          end_time?: string
          id?: string
          is_active?: boolean | null
          mentor_id?: string
          start_time?: string
          timezone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mentor_availability_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "mentors"
            referencedColumns: ["id"]
          },
        ]
      }
      mentor_favorites: {
        Row: {
          created_at: string | null
          id: string
          mentor_id: string
          student_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          mentor_id: string
          student_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          mentor_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mentor_favorites_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "mentors"
            referencedColumns: ["id"]
          },
        ]
      }
      mentor_sessions: {
        Row: {
          created_at: string | null
          currency: string | null
          duration_minutes: number
          id: string
          meeting_ended_at: string | null
          meeting_started_at: string | null
          mentor_id: string
          mentor_notes: string | null
          payment_status: string
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          scheduled_at: string
          session_price: number
          session_type: string
          status: string
          student_id: string
          student_message: string | null
          student_rating: number | null
          student_review: string | null
          updated_at: string | null
          video_room_url: string | null
        }
        Insert: {
          created_at?: string | null
          currency?: string | null
          duration_minutes?: number
          id?: string
          meeting_ended_at?: string | null
          meeting_started_at?: string | null
          mentor_id: string
          mentor_notes?: string | null
          payment_status?: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          scheduled_at: string
          session_price?: number
          session_type?: string
          status?: string
          student_id: string
          student_message?: string | null
          student_rating?: number | null
          student_review?: string | null
          updated_at?: string | null
          video_room_url?: string | null
        }
        Update: {
          created_at?: string | null
          currency?: string | null
          duration_minutes?: number
          id?: string
          meeting_ended_at?: string | null
          meeting_started_at?: string | null
          mentor_id?: string
          mentor_notes?: string | null
          payment_status?: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          scheduled_at?: string
          session_price?: number
          session_type?: string
          status?: string
          student_id?: string
          student_message?: string | null
          student_rating?: number | null
          student_review?: string | null
          updated_at?: string | null
          video_room_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mentor_sessions_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "mentors"
            referencedColumns: ["id"]
          },
        ]
      }
      mentor_verifications: {
        Row: {
          document_type: string
          document_url: string | null
          id: string
          mentor_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_note: string | null
          status: string
          submitted_at: string | null
        }
        Insert: {
          document_type: string
          document_url?: string | null
          id?: string
          mentor_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_note?: string | null
          status?: string
          submitted_at?: string | null
        }
        Update: {
          document_type?: string
          document_url?: string | null
          id?: string
          mentor_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_note?: string | null
          status?: string
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mentor_verifications_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "mentors"
            referencedColumns: ["id"]
          },
        ]
      }
      mentors: {
        Row: {
          average_rating: number | null
          bio: string | null
          branch: string | null
          college: string | null
          company_tiers: string[] | null
          created_at: string | null
          currency: string | null
          current_company: string | null
          full_name: string
          github_url: string | null
          graduation_year: number | null
          id: string
          is_available: boolean | null
          job_role: string | null
          linkedin_url: string | null
          profile_photo_url: string | null
          session_price: number | null
          skills: string[] | null
          target_roles: string[] | null
          total_reviews: number | null
          total_sessions: number | null
          updated_at: string | null
          user_id: string
          verification_note: string | null
          verification_status: string
          verified_at: string | null
          verified_by: string | null
          years_experience: number | null
        }
        Insert: {
          average_rating?: number | null
          bio?: string | null
          branch?: string | null
          college?: string | null
          company_tiers?: string[] | null
          created_at?: string | null
          currency?: string | null
          current_company?: string | null
          full_name: string
          github_url?: string | null
          graduation_year?: number | null
          id?: string
          is_available?: boolean | null
          job_role?: string | null
          linkedin_url?: string | null
          profile_photo_url?: string | null
          session_price?: number | null
          skills?: string[] | null
          target_roles?: string[] | null
          total_reviews?: number | null
          total_sessions?: number | null
          updated_at?: string | null
          user_id: string
          verification_note?: string | null
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
          years_experience?: number | null
        }
        Update: {
          average_rating?: number | null
          bio?: string | null
          branch?: string | null
          college?: string | null
          company_tiers?: string[] | null
          created_at?: string | null
          currency?: string | null
          current_company?: string | null
          full_name?: string
          github_url?: string | null
          graduation_year?: number | null
          id?: string
          is_available?: boolean | null
          job_role?: string | null
          linkedin_url?: string | null
          profile_photo_url?: string | null
          session_price?: number | null
          skills?: string[] | null
          target_roles?: string[] | null
          total_reviews?: number | null
          total_sessions?: number | null
          updated_at?: string | null
          user_id?: string
          verification_note?: string | null
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
          years_experience?: number | null
        }
        Relationships: []
      }
      module_topics: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          module_id: string
          title: string
          topic_number: number
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          module_id: string
          title: string
          topic_number: number
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          module_id?: string
          title?: string
          topic_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "module_topics_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "subject_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pod_checkin_attendance: {
        Row: {
          attended: boolean
          checkin_id: string
          created_at: string
          id: string
          joined_at: string | null
          left_at: string | null
          note: string | null
          pod_id: string
          user_id: string
        }
        Insert: {
          attended?: boolean
          checkin_id: string
          created_at?: string
          id?: string
          joined_at?: string | null
          left_at?: string | null
          note?: string | null
          pod_id: string
          user_id: string
        }
        Update: {
          attended?: boolean
          checkin_id?: string
          created_at?: string
          id?: string
          joined_at?: string | null
          left_at?: string | null
          note?: string | null
          pod_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pod_checkin_attendance_checkin_id_fkey"
            columns: ["checkin_id"]
            isOneToOne: false
            referencedRelation: "pod_checkins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pod_checkin_attendance_pod_id_fkey"
            columns: ["pod_id"]
            isOneToOne: false
            referencedRelation: "accountability_pods"
            referencedColumns: ["id"]
          },
        ]
      }
      pod_checkins: {
        Row: {
          created_at: string
          created_by: string | null
          ended_at: string | null
          id: string
          meeting_notes: string | null
          pod_id: string
          scheduled_at: string
          status: string
          video_room_url: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ended_at?: string | null
          id?: string
          meeting_notes?: string | null
          pod_id: string
          scheduled_at: string
          status?: string
          video_room_url?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ended_at?: string | null
          id?: string
          meeting_notes?: string | null
          pod_id?: string
          scheduled_at?: string
          status?: string
          video_room_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pod_checkins_pod_id_fkey"
            columns: ["pod_id"]
            isOneToOne: false
            referencedRelation: "accountability_pods"
            referencedColumns: ["id"]
          },
        ]
      }
      pod_goal_checkins: {
        Row: {
          checked_in_at: string
          completed: boolean
          goal_id: string
          id: string
          note: string | null
          pod_id: string
          progress_value: number | null
          user_id: string
        }
        Insert: {
          checked_in_at?: string
          completed?: boolean
          goal_id: string
          id?: string
          note?: string | null
          pod_id: string
          progress_value?: number | null
          user_id: string
        }
        Update: {
          checked_in_at?: string
          completed?: boolean
          goal_id?: string
          id?: string
          note?: string | null
          pod_id?: string
          progress_value?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pod_goal_checkins_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "pod_goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pod_goal_checkins_pod_id_fkey"
            columns: ["pod_id"]
            isOneToOne: false
            referencedRelation: "accountability_pods"
            referencedColumns: ["id"]
          },
        ]
      }
      pod_goals: {
        Row: {
          category: string
          completed_at: string | null
          created_at: string
          current_value: number
          description: string | null
          id: string
          pod_id: string
          status: string
          target_value: number | null
          title: string
          updated_at: string
          user_id: string
          week_end: string
          week_start: string
        }
        Insert: {
          category?: string
          completed_at?: string | null
          created_at?: string
          current_value?: number
          description?: string | null
          id?: string
          pod_id: string
          status?: string
          target_value?: number | null
          title: string
          updated_at?: string
          user_id: string
          week_end: string
          week_start: string
        }
        Update: {
          category?: string
          completed_at?: string | null
          created_at?: string
          current_value?: number
          description?: string | null
          id?: string
          pod_id?: string
          status?: string
          target_value?: number | null
          title?: string
          updated_at?: string
          user_id?: string
          week_end?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "pod_goals_pod_id_fkey"
            columns: ["pod_id"]
            isOneToOne: false
            referencedRelation: "accountability_pods"
            referencedColumns: ["id"]
          },
        ]
      }
      pod_members: {
        Row: {
          available_days: string[] | null
          branch: string | null
          company_tier: string | null
          created_at: string
          id: string
          joined_at: string
          left_at: string | null
          pod_id: string
          preferred_checkin_time: string | null
          readiness_score: number | null
          role: string
          skill_level: string | null
          status: string
          target_role: string | null
          timezone: string | null
          user_id: string
        }
        Insert: {
          available_days?: string[] | null
          branch?: string | null
          company_tier?: string | null
          created_at?: string
          id?: string
          joined_at?: string
          left_at?: string | null
          pod_id: string
          preferred_checkin_time?: string | null
          readiness_score?: number | null
          role?: string
          skill_level?: string | null
          status?: string
          target_role?: string | null
          timezone?: string | null
          user_id: string
        }
        Update: {
          available_days?: string[] | null
          branch?: string | null
          company_tier?: string | null
          created_at?: string
          id?: string
          joined_at?: string
          left_at?: string | null
          pod_id?: string
          preferred_checkin_time?: string | null
          readiness_score?: number | null
          role?: string
          skill_level?: string | null
          status?: string
          target_role?: string | null
          timezone?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pod_members_pod_id_fkey"
            columns: ["pod_id"]
            isOneToOne: false
            referencedRelation: "accountability_pods"
            referencedColumns: ["id"]
          },
        ]
      }
      pod_streaks: {
        Row: {
          current_streak: number
          id: string
          last_completed_week: string | null
          longest_streak: number
          pod_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          current_streak?: number
          id?: string
          last_completed_week?: string | null
          longest_streak?: number
          pod_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          current_streak?: number
          id?: string
          last_completed_week?: string | null
          longest_streak?: number
          pod_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pod_streaks_pod_id_fkey"
            columns: ["pod_id"]
            isOneToOne: false
            referencedRelation: "accountability_pods"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          branch: string | null
          cgpa: number | null
          college_name: string | null
          created_at: string | null
          full_name: string | null
          graduation_year: number | null
          id: string
          year_of_study: number | null
        }
        Insert: {
          branch?: string | null
          cgpa?: number | null
          college_name?: string | null
          created_at?: string | null
          full_name?: string | null
          graduation_year?: number | null
          id: string
          year_of_study?: number | null
        }
        Update: {
          branch?: string | null
          cgpa?: number | null
          college_name?: string | null
          created_at?: string | null
          full_name?: string | null
          graduation_year?: number | null
          id?: string
          year_of_study?: number | null
        }
        Relationships: []
      }
      project_reviews: {
        Row: {
          created_at: string
          feedback: string | null
          id: string
          project_id: number
          reviewed_at: string | null
          reviewer_id: string
          reviewer_role: string
          score: number | null
          status: string
        }
        Insert: {
          created_at?: string
          feedback?: string | null
          id?: string
          project_id: number
          reviewed_at?: string | null
          reviewer_id: string
          reviewer_role: string
          score?: number | null
          status?: string
        }
        Update: {
          created_at?: string
          feedback?: string | null
          id?: string
          project_id?: number
          reviewed_at?: string | null
          reviewer_id?: string
          reviewer_role?: string
          score?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_reviews_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_verification_events: {
        Row: {
          actor_id: string | null
          created_at: string
          event_type: string
          id: string
          metadata: Json
          project_id: number
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          project_id: number
          user_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          project_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_verification_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_verification_evidence: {
        Row: {
          commit_count: number
          contributor_count: number
          created_at: string
          default_branch: string | null
          evidence_json: Json
          evidence_type: string | null
          fetched_at: string
          first_commit_at: string | null
          github_owner: string
          github_repo: string
          github_repo_id: number
          github_url: string
          id: string
          last_commit_at: string | null
          metadata: Json | null
          project_id: number
          pull_request_count: number
          user_id: string
        }
        Insert: {
          commit_count?: number
          contributor_count?: number
          created_at?: string
          default_branch?: string | null
          evidence_json?: Json
          evidence_type?: string | null
          fetched_at?: string
          first_commit_at?: string | null
          github_owner: string
          github_repo: string
          github_repo_id: number
          github_url: string
          id?: string
          last_commit_at?: string | null
          metadata?: Json | null
          project_id: number
          pull_request_count?: number
          user_id: string
        }
        Update: {
          commit_count?: number
          contributor_count?: number
          created_at?: string
          default_branch?: string | null
          evidence_json?: Json
          evidence_type?: string | null
          fetched_at?: string
          first_commit_at?: string | null
          github_owner?: string
          github_repo?: string
          github_repo_id?: number
          github_url?: string
          id?: string
          last_commit_at?: string | null
          metadata?: Json | null
          project_id?: number
          pull_request_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_verification_evidence_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          description: string | null
          github_owner: string | null
          github_repo: string | null
          github_repo_id: number | null
          github_url: string | null
          id: number
          project_name: string
          project_url: string | null
          tech_stack: string | null
          user_id: string
          verification_score: number | null
          verification_status: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          github_owner?: string | null
          github_repo?: string | null
          github_repo_id?: number | null
          github_url?: string | null
          id?: number
          project_name: string
          project_url?: string | null
          tech_stack?: string | null
          user_id: string
          verification_score?: number | null
          verification_status?: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          github_owner?: string | null
          github_repo?: string | null
          github_repo_id?: number | null
          github_url?: string | null
          id?: number
          project_name?: string
          project_url?: string | null
          tech_stack?: string | null
          user_id?: string
          verification_score?: number | null
          verification_status?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      resume_reviews: {
        Row: {
          company_tier: string
          created_at: string
          id: string
          resume_score: number | null
          review: string
          target_role: string | null
          user_id: string
        }
        Insert: {
          company_tier: string
          created_at?: string
          id?: string
          resume_score?: number | null
          review: string
          target_role?: string | null
          user_id: string
        }
        Update: {
          company_tier?: string
          created_at?: string
          id?: string
          resume_score?: number | null
          review?: string
          target_role?: string | null
          user_id?: string
        }
        Relationships: []
      }
      resume_versions: {
        Row: {
          created_at: string
          id: string
          resume_name: string
          resume_score: number | null
          resume_text: string
          source: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          resume_name: string
          resume_score?: number | null
          resume_text: string
          source?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          resume_name?: string
          resume_score?: number | null
          resume_text?: string
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      student_profiles: {
        Row: {
          academic_program: string | null
          branch: string
          branch_id: string | null
          college: string
          college_id: string | null
          company_tier: string
          created_at: string
          id: string
          program_id: string | null
          regulation: string | null
          scheme_id: string | null
          semester: number
          semester_number: number | null
          skill_level: string
          syllabus_scheme: string | null
          syllabus_scheme_id: string | null
          target_role: string
          university: string | null
          university_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          academic_program?: string | null
          branch: string
          branch_id?: string | null
          college: string
          college_id?: string | null
          company_tier: string
          created_at?: string
          id?: string
          program_id?: string | null
          regulation?: string | null
          scheme_id?: string | null
          semester: number
          semester_number?: number | null
          skill_level?: string
          syllabus_scheme?: string | null
          syllabus_scheme_id?: string | null
          target_role: string
          university?: string | null
          university_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          academic_program?: string | null
          branch?: string
          branch_id?: string | null
          college?: string
          college_id?: string | null
          company_tier?: string
          created_at?: string
          id?: string
          program_id?: string | null
          regulation?: string | null
          scheme_id?: string | null
          semester?: number
          semester_number?: number | null
          skill_level?: string
          syllabus_scheme?: string | null
          syllabus_scheme_id?: string | null
          target_role?: string
          university?: string | null
          university_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_profiles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_profiles_college_id_fkey"
            columns: ["college_id"]
            isOneToOne: false
            referencedRelation: "colleges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_profiles_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "academic_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_profiles_scheme_id_fkey"
            columns: ["scheme_id"]
            isOneToOne: false
            referencedRelation: "academic_schemes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_profiles_syllabus_scheme_id_fkey"
            columns: ["syllabus_scheme_id"]
            isOneToOne: false
            referencedRelation: "syllabus_schemes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_profiles_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      student_skills: {
        Row: {
          created_at: string | null
          id: number
          skill_name: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: number
          skill_name: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: number
          skill_name?: string
          user_id?: string
        }
        Relationships: []
      }
      student_topic_progress: {
        Row: {
          completed: boolean
          completed_at: string | null
          created_at: string | null
          id: string
          topic_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string | null
          id?: string
          topic_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string | null
          id?: string
          topic_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_topic_progress_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "module_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      subject_modules: {
        Row: {
          created_at: string | null
          description: string | null
          estimated_hours: number | null
          id: string
          module_number: number
          subject_id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          estimated_hours?: number | null
          id?: string
          module_number: number
          subject_id: string
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          estimated_hours?: number | null
          id?: string
          module_number?: number
          subject_id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subject_modules_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "syllabus_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      subject_progress: {
        Row: {
          completed_topics: string[] | null
          created_at: string | null
          id: string
          subject_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          completed_topics?: string[] | null
          created_at?: string | null
          id?: string
          subject_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          completed_topics?: string[] | null
          created_at?: string | null
          id?: string
          subject_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subject_progress_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "syllabus_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      syllabi: {
        Row: {
          college_id: string | null
          created_at: string | null
          id: string
          program_id: string | null
          scheme_id: string | null
          semester: number
          source_type: string | null
          status: string | null
          title: string | null
          university_id: string | null
        }
        Insert: {
          college_id?: string | null
          created_at?: string | null
          id?: string
          program_id?: string | null
          scheme_id?: string | null
          semester: number
          source_type?: string | null
          status?: string | null
          title?: string | null
          university_id?: string | null
        }
        Update: {
          college_id?: string | null
          created_at?: string | null
          id?: string
          program_id?: string | null
          scheme_id?: string | null
          semester?: number
          source_type?: string | null
          status?: string | null
          title?: string | null
          university_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "syllabi_college_id_fkey"
            columns: ["college_id"]
            isOneToOne: false
            referencedRelation: "colleges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "syllabi_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "academic_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "syllabi_scheme_id_fkey"
            columns: ["scheme_id"]
            isOneToOne: false
            referencedRelation: "syllabus_schemes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "syllabi_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      syllabus_schemes: {
        Row: {
          academic_year: string | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          regulation: string | null
          university_id: string | null
        }
        Insert: {
          academic_year?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          regulation?: string | null
          university_id?: string | null
        }
        Update: {
          academic_year?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          regulation?: string | null
          university_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "syllabus_schemes_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      syllabus_subjects: {
        Row: {
          created_at: string | null
          credits: number | null
          description: string | null
          id: string
          interview_relevance: string | null
          interview_topics: string[] | null
          source_verified: boolean | null
          subject_code: string | null
          subject_name: string
          subject_type: string | null
          syllabus_id: string | null
        }
        Insert: {
          created_at?: string | null
          credits?: number | null
          description?: string | null
          id?: string
          interview_relevance?: string | null
          interview_topics?: string[] | null
          source_verified?: boolean | null
          subject_code?: string | null
          subject_name: string
          subject_type?: string | null
          syllabus_id?: string | null
        }
        Update: {
          created_at?: string | null
          credits?: number | null
          description?: string | null
          id?: string
          interview_relevance?: string | null
          interview_topics?: string[] | null
          source_verified?: boolean | null
          subject_code?: string | null
          subject_name?: string
          subject_type?: string | null
          syllabus_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "syllabus_subjects_syllabus_id_fkey"
            columns: ["syllabus_id"]
            isOneToOne: false
            referencedRelation: "syllabi"
            referencedColumns: ["id"]
          },
        ]
      }
      syllabus_uploads: {
        Row: {
          college_id: string | null
          created_at: string | null
          error_message: string | null
          extracted_data: Json | null
          file_name: string
          file_path: string
          file_type: string | null
          id: string
          program_id: string | null
          scheme_name: string | null
          semester: number | null
          university_id: string | null
          upload_status: string | null
          uploaded_by: string | null
        }
        Insert: {
          college_id?: string | null
          created_at?: string | null
          error_message?: string | null
          extracted_data?: Json | null
          file_name: string
          file_path: string
          file_type?: string | null
          id?: string
          program_id?: string | null
          scheme_name?: string | null
          semester?: number | null
          university_id?: string | null
          upload_status?: string | null
          uploaded_by?: string | null
        }
        Update: {
          college_id?: string | null
          created_at?: string | null
          error_message?: string | null
          extracted_data?: Json | null
          file_name?: string
          file_path?: string
          file_type?: string | null
          id?: string
          program_id?: string | null
          scheme_name?: string | null
          semester?: number | null
          university_id?: string | null
          upload_status?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "syllabus_uploads_college_id_fkey"
            columns: ["college_id"]
            isOneToOne: false
            referencedRelation: "colleges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "syllabus_uploads_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "academic_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "syllabus_uploads_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      universities: {
        Row: {
          country: string | null
          created_at: string | null
          id: string
          name: string
          official_website: string | null
          short_name: string | null
          state: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string | null
          id?: string
          name: string
          official_website?: string | null
          short_name?: string | null
          state?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string | null
          id?: string
          name?: string
          official_website?: string | null
          short_name?: string | null
          state?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_project_verification_score: {
        Args: {
          p_commit_count: number
          p_contributor_count: number
          p_pull_request_count: number
        }
        Returns: number
      }
      is_platform_admin: { Args: never; Returns: boolean }
      is_pod_member: {
        Args: { check_pod_id: string; check_user_id: string }
        Returns: boolean
      }
      match_campus_interview_embeddings:
        | {
            Args: {
              match_count?: number
              match_threshold?: number
              query_embedding: string
              target_college_id?: string
            }
            Returns: {
              content: string
              id: string
              metadata: Json
              question_id: string
              report_id: string
              similarity: number
            }[]
          }
        | {
            Args: {
              match_count?: number
              match_threshold?: number
              query_embedding: string
            }
            Returns: {
              content: string
              id: string
              metadata: Json
              question_id: string
              report_id: string
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
