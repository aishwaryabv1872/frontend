


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."calculate_project_verification_score"("p_commit_count" integer, "p_pull_request_count" integer, "p_contributor_count" integer) RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  score integer := 0;
BEGIN

  -- Commit activity: up to 50 points
  score := score + LEAST(p_commit_count * 2, 50);

  -- Pull requests: up to 30 points
  score := score + LEAST(p_pull_request_count * 5, 30);

  -- Contributors: up to 20 points
  score := score + LEAST(p_contributor_count * 5, 20);

  RETURN LEAST(score, 100);
END;
$$;


ALTER FUNCTION "public"."calculate_project_verification_score"("p_commit_count" integer, "p_pull_request_count" integer, "p_contributor_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_platform_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_admins
    WHERE user_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."is_platform_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_pod_member"("check_pod_id" "uuid", "check_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.pod_members
    WHERE pod_id = check_pod_id
      AND user_id = check_user_id
      AND status = 'active'
  );
$$;


ALTER FUNCTION "public"."is_pod_member"("check_pod_id" "uuid", "check_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_campus_interview_embeddings"("query_embedding" "extensions"."vector", "match_threshold" double precision DEFAULT 0.70, "match_count" integer DEFAULT 10) RETURNS TABLE("id" "uuid", "question_id" "uuid", "report_id" "uuid", "content" "text", "metadata" "jsonb", "similarity" double precision)
    LANGUAGE "sql" STABLE
    AS $$
  select
    e.id,
    e.question_id,
    e.report_id,
    e.content,
    e.metadata,
    1 - (e.embedding <=> query_embedding) as similarity
  from public.campus_interview_embeddings e
  where e.embedding is not null
    and 1 - (e.embedding <=> query_embedding) >= match_threshold
  order by e.embedding <=> query_embedding
  limit least(match_count, 50);
$$;


ALTER FUNCTION "public"."match_campus_interview_embeddings"("query_embedding" "extensions"."vector", "match_threshold" double precision, "match_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_accountability_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_accountability_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_campus_intel_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_campus_intel_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_mentor_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_mentor_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."academic_programs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "university_id" "uuid",
    "name" "text" NOT NULL,
    "degree" "text" DEFAULT 'B.E.'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."academic_programs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."academic_schemes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "university_id" "uuid",
    "name" "text" NOT NULL,
    "regulation_year" integer,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."academic_schemes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."accountability_pods" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "max_members" integer DEFAULT 5 NOT NULL,
    "target_role" "text",
    "skill_level" "text",
    "company_tier" "text",
    "timezone" "text",
    "preferred_checkin_day" "text",
    "preferred_checkin_time" time without time zone,
    "next_checkin_at" timestamp with time zone,
    "video_room_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "branch" "text",
    "semester_number" integer,
    CONSTRAINT "accountability_pods_max_members_check" CHECK ((("max_members" >= 2) AND ("max_members" <= 10))),
    CONSTRAINT "accountability_pods_status_check" CHECK (("status" = ANY (ARRAY['forming'::"text", 'active'::"text", 'completed'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."accountability_pods" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_interview_answers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid",
    "question_number" integer NOT NULL,
    "question" "text" NOT NULL,
    "answer" "text" NOT NULL,
    "score" numeric DEFAULT 0 NOT NULL,
    "feedback" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ai_interview_answers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_interview_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "role" "text" NOT NULL,
    "difficulty" "text" NOT NULL,
    "mode" "text" NOT NULL,
    "total_questions" integer DEFAULT 10 NOT NULL,
    "answered_questions" integer DEFAULT 0 NOT NULL,
    "total_score" numeric DEFAULT 0 NOT NULL,
    "percentage" integer DEFAULT 0 NOT NULL,
    "strengths" "text",
    "weaknesses" "text",
    "improvement_plan" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ai_interview_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_placement_plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "recommendation" "text" NOT NULL,
    "readiness_score" integer DEFAULT 0 NOT NULL,
    "cgpa_score" integer DEFAULT 0 NOT NULL,
    "skills_score" integer DEFAULT 0 NOT NULL,
    "dsa_score" integer DEFAULT 0 NOT NULL,
    "projects_score" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ai_placement_plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_roadmaps" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "summary" "text",
    "readiness_focus" "text",
    "roadmap" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ai_roadmaps" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."aptitude_attempts" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "category" "text" NOT NULL,
    "question_id" bigint,
    "selected_answer" "text",
    "is_correct" boolean DEFAULT false NOT NULL,
    "attempted_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."aptitude_attempts" OWNER TO "postgres";


ALTER TABLE "public"."aptitude_attempts" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."aptitude_attempts_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."aptitude_questions" (
    "id" bigint NOT NULL,
    "category" "text" NOT NULL,
    "question" "text" NOT NULL,
    "option_a" "text" NOT NULL,
    "option_b" "text" NOT NULL,
    "option_c" "text" NOT NULL,
    "option_d" "text" NOT NULL,
    "correct_answer" "text" NOT NULL,
    "explanation" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."aptitude_questions" OWNER TO "postgres";


ALTER TABLE "public"."aptitude_questions" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."aptitude_questions_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."branches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "short_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."branches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."campus_companies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "website" "text",
    "industry" "text",
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."campus_companies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."campus_company_visits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "college_id" "uuid" NOT NULL,
    "company_id" "uuid" NOT NULL,
    "visit_year" integer NOT NULL,
    "role" "text",
    "job_type" "text",
    "eligible_branch" "text",
    "minimum_cgpa" numeric(4,2),
    "placement_status" "text",
    "package_lpa" numeric(8,2),
    "visit_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "campus_company_visit_year_check" CHECK ((("visit_year" >= 2000) AND ("visit_year" <= 2100)))
);


ALTER TABLE "public"."campus_company_visits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."campus_intel_submissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "college_id" "uuid",
    "submission_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "content" "text" NOT NULL,
    "company_name" "text",
    "role" "text",
    "visit_year" integer,
    "moderation_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "moderator_notes" "text",
    "moderated_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "published_at" timestamp with time zone,
    "published_by" "uuid",
    "published_visit_id" "uuid",
    CONSTRAINT "campus_submission_status_check" CHECK (("moderation_status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"]))),
    CONSTRAINT "campus_submission_type_check" CHECK (("submission_type" = ANY (ARRAY['company_visit'::"text", 'interview_report'::"text", 'interview_question'::"text", 'cutoff'::"text", 'experience'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."campus_intel_submissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."campus_interview_embeddings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "question_id" "uuid",
    "report_id" "uuid",
    "content" "text" NOT NULL,
    "embedding" "extensions"."vector"(384),
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."campus_interview_embeddings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."campus_interview_questions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "report_id" "uuid" NOT NULL,
    "question" "text" NOT NULL,
    "category" "text" NOT NULL,
    "difficulty" "text",
    "round_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "interview_question_category_check" CHECK (("category" = ANY (ARRAY['DSA'::"text", 'Technical'::"text", 'SQL'::"text", 'OOP'::"text", 'DBMS'::"text", 'Computer Networks'::"text", 'Operating Systems'::"text", 'Web Development'::"text", 'HR'::"text", 'Aptitude'::"text", 'Managerial'::"text", 'Other'::"text"]))),
    CONSTRAINT "interview_question_difficulty_check" CHECK ((("difficulty" IS NULL) OR ("difficulty" = ANY (ARRAY['Easy'::"text", 'Medium'::"text", 'Hard'::"text"]))))
);


ALTER TABLE "public"."campus_interview_questions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."campus_interview_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "visit_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "result" "text",
    "rounds_count" integer,
    "overall_experience" "text",
    "preparation_advice" "text",
    "difficulty" "text",
    "anonymous" boolean DEFAULT true NOT NULL,
    "moderation_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "college_id" "uuid",
    "company_id" "uuid",
    "company_name" "text",
    "role" "text",
    "interview_year" integer,
    "moderator_notes" "text",
    "moderated_at" timestamp with time zone,
    "source_submission_id" "uuid",
    CONSTRAINT "interview_report_difficulty_check" CHECK ((("difficulty" IS NULL) OR ("difficulty" = ANY (ARRAY['Easy'::"text", 'Medium'::"text", 'Hard'::"text"])))),
    CONSTRAINT "interview_report_status_check" CHECK (("moderation_status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."campus_interview_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."career_goals" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "primary_goal" "text" NOT NULL,
    "target_role" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."career_goals" OWNER TO "postgres";


ALTER TABLE "public"."career_goals" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."career_goals_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."college_branches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "college_id" "uuid" NOT NULL,
    "branch_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."college_branches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."colleges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "university_id" "uuid",
    "name" "text" NOT NULL,
    "city" "text",
    "state" "text",
    "country" "text" DEFAULT 'India'::"text",
    "official_website" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."colleges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."curriculum_subjects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "branch" "text" NOT NULL,
    "semester" "text" NOT NULL,
    "subject_name" "text" NOT NULL,
    "subject_code" "text",
    "interview_relevance" "text" DEFAULT 'Medium'::"text" NOT NULL,
    "description" "text",
    "interview_topics" "text"[] DEFAULT '{}'::"text"[],
    "created_at" timestamp with time zone DEFAULT "now"(),
    "university" "text",
    "syllabus_scheme" "text",
    "college" "text",
    "regulation" "text"
);


ALTER TABLE "public"."curriculum_subjects" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dsa_problem_bank" (
    "id" bigint NOT NULL,
    "title" "text" NOT NULL,
    "difficulty" "text" NOT NULL,
    "description" "text" NOT NULL,
    "examples" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "starter_code" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "dsa_problem_bank_difficulty_check" CHECK (("difficulty" = ANY (ARRAY['Easy'::"text", 'Medium'::"text", 'Hard'::"text"])))
);


ALTER TABLE "public"."dsa_problem_bank" OWNER TO "postgres";


ALTER TABLE "public"."dsa_problem_bank" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."dsa_problem_bank_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."dsa_problem_library" (
    "id" bigint NOT NULL,
    "title" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "difficulty" "text" NOT NULL,
    "category" "text" NOT NULL,
    "description" "text" NOT NULL,
    "examples" "jsonb",
    "starter_code" "text",
    "constraints_text" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."dsa_problem_library" OWNER TO "postgres";


ALTER TABLE "public"."dsa_problem_library" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."dsa_problem_library_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."dsa_problems" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "problem_name" "text" NOT NULL,
    "difficulty" "text" NOT NULL,
    "solved_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "dsa_problems_difficulty_check" CHECK (("difficulty" = ANY (ARRAY['Easy'::"text", 'Medium'::"text", 'Hard'::"text"])))
);


ALTER TABLE "public"."dsa_problems" OWNER TO "postgres";


ALTER TABLE "public"."dsa_problems" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."dsa_problems_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."dsa_submissions" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "problem_id" bigint NOT NULL,
    "language" "text" NOT NULL,
    "source_code" "text" NOT NULL,
    "status" "text" DEFAULT 'Accepted'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."dsa_submissions" OWNER TO "postgres";


ALTER TABLE "public"."dsa_submissions" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."dsa_submissions_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."mentor_availability" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "mentor_id" "uuid" NOT NULL,
    "day_of_week" integer NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "timezone" "text" DEFAULT 'Asia/Kolkata'::"text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "mentor_availability_check" CHECK (("end_time" > "start_time")),
    CONSTRAINT "mentor_availability_day_of_week_check" CHECK ((("day_of_week" >= 0) AND ("day_of_week" <= 6)))
);


ALTER TABLE "public"."mentor_availability" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mentor_favorites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "mentor_id" "uuid" NOT NULL,
    "student_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."mentor_favorites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mentor_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "mentor_id" "uuid" NOT NULL,
    "student_id" "uuid" NOT NULL,
    "scheduled_at" timestamp with time zone NOT NULL,
    "duration_minutes" integer DEFAULT 30 NOT NULL,
    "session_type" "text" DEFAULT 'career_guidance'::"text" NOT NULL,
    "student_message" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "session_price" numeric(10,2) DEFAULT 0 NOT NULL,
    "currency" "text" DEFAULT 'INR'::"text",
    "payment_status" "text" DEFAULT 'not_required'::"text" NOT NULL,
    "razorpay_order_id" "text",
    "razorpay_payment_id" "text",
    "video_room_url" "text",
    "meeting_started_at" timestamp with time zone,
    "meeting_ended_at" timestamp with time zone,
    "mentor_notes" "text",
    "student_rating" integer,
    "student_review" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "mentor_sessions_duration_minutes_check" CHECK (("duration_minutes" = ANY (ARRAY[30, 45, 60]))),
    CONSTRAINT "mentor_sessions_payment_status_check" CHECK (("payment_status" = ANY (ARRAY['not_required'::"text", 'pending'::"text", 'paid'::"text", 'failed'::"text", 'refunded'::"text"]))),
    CONSTRAINT "mentor_sessions_session_price_check" CHECK (("session_price" >= (0)::numeric)),
    CONSTRAINT "mentor_sessions_session_type_check" CHECK (("session_type" = ANY (ARRAY['career_guidance'::"text", 'resume_review'::"text", 'mock_interview'::"text", 'dsa_guidance'::"text", 'project_review'::"text", 'placement_strategy'::"text", 'general'::"text"]))),
    CONSTRAINT "mentor_sessions_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'confirmed'::"text", 'completed'::"text", 'cancelled'::"text", 'no_show'::"text"]))),
    CONSTRAINT "mentor_sessions_student_rating_check" CHECK ((("student_rating" >= 1) AND ("student_rating" <= 5)))
);


ALTER TABLE "public"."mentor_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mentor_verifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "mentor_id" "uuid" NOT NULL,
    "document_type" "text" NOT NULL,
    "document_url" "text",
    "submitted_at" timestamp with time zone DEFAULT "now"(),
    "reviewed_at" timestamp with time zone,
    "reviewed_by" "uuid",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "reviewer_note" "text",
    CONSTRAINT "mentor_verifications_document_type_check" CHECK (("document_type" = ANY (ARRAY['college_id'::"text", 'graduation_proof'::"text", 'employment_proof'::"text", 'linkedin'::"text", 'other'::"text"]))),
    CONSTRAINT "mentor_verifications_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."mentor_verifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mentors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "full_name" "text" NOT NULL,
    "profile_photo_url" "text",
    "college" "text",
    "branch" "text",
    "graduation_year" integer,
    "current_company" "text",
    "job_role" "text",
    "bio" "text",
    "skills" "text"[] DEFAULT '{}'::"text"[],
    "years_experience" numeric(4,1) DEFAULT 0,
    "target_roles" "text"[] DEFAULT '{}'::"text"[],
    "company_tiers" "text"[] DEFAULT '{}'::"text"[],
    "linkedin_url" "text",
    "github_url" "text",
    "verification_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "verification_note" "text",
    "verified_at" timestamp with time zone,
    "verified_by" "uuid",
    "session_price" numeric(10,2) DEFAULT 0,
    "currency" "text" DEFAULT 'INR'::"text",
    "is_available" boolean DEFAULT true,
    "average_rating" numeric(3,2) DEFAULT 0,
    "total_reviews" integer DEFAULT 0,
    "total_sessions" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "mentors_average_rating_check" CHECK ((("average_rating" >= (0)::numeric) AND ("average_rating" <= (5)::numeric))),
    CONSTRAINT "mentors_session_price_check" CHECK (("session_price" >= (0)::numeric)),
    CONSTRAINT "mentors_total_reviews_check" CHECK (("total_reviews" >= 0)),
    CONSTRAINT "mentors_total_sessions_check" CHECK (("total_sessions" >= 0)),
    CONSTRAINT "mentors_verification_status_check" CHECK (("verification_status" = ANY (ARRAY['pending'::"text", 'under_review'::"text", 'verified'::"text", 'rejected'::"text", 'suspended'::"text"])))
);


ALTER TABLE "public"."mentors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."module_topics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "module_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "topic_number" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."module_topics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_admins" (
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."platform_admins" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pod_checkin_attendance" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "checkin_id" "uuid" NOT NULL,
    "pod_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "attended" boolean DEFAULT false NOT NULL,
    "joined_at" timestamp with time zone,
    "left_at" timestamp with time zone,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."pod_checkin_attendance" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pod_checkins" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pod_id" "uuid" NOT NULL,
    "scheduled_at" timestamp with time zone NOT NULL,
    "ended_at" timestamp with time zone,
    "status" "text" DEFAULT 'scheduled'::"text" NOT NULL,
    "video_room_url" "text",
    "meeting_notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "pod_checkins_status_check" CHECK (("status" = ANY (ARRAY['scheduled'::"text", 'live'::"text", 'completed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."pod_checkins" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pod_goal_checkins" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "goal_id" "uuid" NOT NULL,
    "pod_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "progress_value" integer DEFAULT 0,
    "note" "text",
    "completed" boolean DEFAULT false NOT NULL,
    "checked_in_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "pod_goal_checkins_progress_value_check" CHECK (("progress_value" >= 0))
);


ALTER TABLE "public"."pod_goal_checkins" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pod_goals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pod_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "category" "text" DEFAULT 'general'::"text" NOT NULL,
    "week_start" "date" NOT NULL,
    "week_end" "date" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "target_value" integer,
    "current_value" integer DEFAULT 0 NOT NULL,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "pod_goals_category_check" CHECK (("category" = ANY (ARRAY['dsa'::"text", 'project'::"text", 'skills'::"text", 'resume'::"text", 'interview'::"text", 'aptitude'::"text", 'general'::"text"]))),
    CONSTRAINT "pod_goals_check" CHECK (("week_end" >= "week_start")),
    CONSTRAINT "pod_goals_current_value_check" CHECK (("current_value" >= 0)),
    CONSTRAINT "pod_goals_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'in_progress'::"text", 'completed'::"text", 'missed'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "pod_goals_target_value_check" CHECK ((("target_value" IS NULL) OR ("target_value" >= 0)))
);


ALTER TABLE "public"."pod_goals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pod_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pod_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'member'::"text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "branch" "text",
    "target_role" "text",
    "skill_level" "text",
    "company_tier" "text",
    "readiness_score" numeric(5,2),
    "timezone" "text",
    "available_days" "text"[] DEFAULT '{}'::"text"[],
    "preferred_checkin_time" time without time zone,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "left_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "pod_members_readiness_score_check" CHECK ((("readiness_score" IS NULL) OR (("readiness_score" >= (0)::numeric) AND ("readiness_score" <= (100)::numeric)))),
    CONSTRAINT "pod_members_role_check" CHECK (("role" = ANY (ARRAY['member'::"text", 'leader'::"text"]))),
    CONSTRAINT "pod_members_status_check" CHECK (("status" = ANY (ARRAY['invited'::"text", 'active'::"text", 'left'::"text", 'removed'::"text"])))
);


ALTER TABLE "public"."pod_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pod_streaks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "pod_id" "uuid" NOT NULL,
    "current_streak" integer DEFAULT 0 NOT NULL,
    "longest_streak" integer DEFAULT 0 NOT NULL,
    "last_completed_week" "date",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "pod_streaks_current_streak_check" CHECK (("current_streak" >= 0)),
    CONSTRAINT "pod_streaks_longest_streak_check" CHECK (("longest_streak" >= 0))
);


ALTER TABLE "public"."pod_streaks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text",
    "college_name" "text",
    "branch" "text",
    "year_of_study" integer,
    "cgpa" numeric,
    "graduation_year" integer,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" bigint NOT NULL,
    "reviewer_id" "uuid" NOT NULL,
    "reviewer_role" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "score" integer,
    "feedback" "text",
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "project_reviews_reviewer_role_check" CHECK (("reviewer_role" = ANY (ARRAY['peer'::"text", 'senior'::"text"]))),
    CONSTRAINT "project_reviews_score_check" CHECK ((("score" IS NULL) OR (("score" >= 0) AND ("score" <= 100)))),
    CONSTRAINT "project_reviews_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."project_reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_verification_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "actor_id" "uuid",
    CONSTRAINT "project_verification_events_event_type_check" CHECK (("event_type" = ANY (ARRAY['verification_started'::"text", 'github_connected'::"text", 'github_repository_selected'::"text", 'evidence_fetched'::"text", 'peer_review_requested'::"text", 'peer_review_approved'::"text", 'peer_review_rejected'::"text", 'senior_review_requested'::"text", 'senior_review_approved'::"text", 'senior_review_rejected'::"text", 'project_verified'::"text", 'project_rejected'::"text"])))
);


ALTER TABLE "public"."project_verification_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_verification_evidence" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "github_repo_id" bigint NOT NULL,
    "github_owner" "text" NOT NULL,
    "github_repo" "text" NOT NULL,
    "github_url" "text" NOT NULL,
    "default_branch" "text",
    "commit_count" integer DEFAULT 0 NOT NULL,
    "pull_request_count" integer DEFAULT 0 NOT NULL,
    "contributor_count" integer DEFAULT 0 NOT NULL,
    "first_commit_at" timestamp with time zone,
    "last_commit_at" timestamp with time zone,
    "evidence_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "fetched_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "evidence_type" "text",
    "metadata" "jsonb",
    CONSTRAINT "project_verification_evidence_commit_count_check" CHECK (("commit_count" >= 0)),
    CONSTRAINT "project_verification_evidence_contributor_count_check" CHECK (("contributor_count" >= 0)),
    CONSTRAINT "project_verification_evidence_pull_request_count_check" CHECK (("pull_request_count" >= 0))
);


ALTER TABLE "public"."project_verification_evidence" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."projects" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "project_name" "text" NOT NULL,
    "description" "text",
    "tech_stack" "text",
    "project_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "verification_status" "text" DEFAULT 'unverified'::"text" NOT NULL,
    "github_owner" "text",
    "github_repo" "text",
    "github_repo_id" bigint,
    "github_url" "text",
    "verified_at" timestamp with time zone,
    "verification_score" integer,
    CONSTRAINT "projects_verification_score_check" CHECK ((("verification_score" IS NULL) OR (("verification_score" >= 0) AND ("verification_score" <= 100)))),
    CONSTRAINT "projects_verification_status_check" CHECK (("verification_status" = ANY (ARRAY['unverified'::"text", 'pending'::"text", 'peer_review'::"text", 'senior_review'::"text", 'verified'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."projects" OWNER TO "postgres";


ALTER TABLE "public"."projects" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."projects_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."resume_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "target_role" "text",
    "company_tier" "text" NOT NULL,
    "resume_score" integer,
    "review" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."resume_reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."resume_versions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "resume_name" "text" NOT NULL,
    "source" "text" DEFAULT 'vertex'::"text" NOT NULL,
    "resume_text" "text" NOT NULL,
    "resume_score" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."resume_versions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."student_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "college" "text" NOT NULL,
    "branch" "text" NOT NULL,
    "semester" integer NOT NULL,
    "target_role" "text" NOT NULL,
    "company_tier" "text" NOT NULL,
    "skill_level" "text" DEFAULT 'Beginner'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "university" "text",
    "syllabus_scheme" "text",
    "regulation" "text",
    "university_id" "uuid",
    "college_id" "uuid",
    "program_id" "uuid",
    "syllabus_scheme_id" "uuid",
    "branch_id" "uuid",
    "scheme_id" "uuid",
    "semester_number" integer,
    CONSTRAINT "student_profiles_semester_check" CHECK ((("semester" >= 1) AND ("semester" <= 8)))
);


ALTER TABLE "public"."student_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."student_skills" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "skill_name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."student_skills" OWNER TO "postgres";


ALTER TABLE "public"."student_skills" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."student_skills_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."student_topic_progress" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "topic_id" "uuid" NOT NULL,
    "completed" boolean DEFAULT false NOT NULL,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."student_topic_progress" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subject_modules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "subject_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "module_number" integer NOT NULL,
    "estimated_hours" numeric,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."subject_modules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subject_progress" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "subject_id" "uuid",
    "completed_topics" "text"[] DEFAULT '{}'::"text"[],
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."subject_progress" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."syllabi" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "university_id" "uuid",
    "college_id" "uuid",
    "program_id" "uuid",
    "scheme_id" "uuid",
    "semester" integer NOT NULL,
    "title" "text",
    "source_type" "text" DEFAULT 'official'::"text",
    "status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "syllabi_semester_check" CHECK ((("semester" >= 1) AND ("semester" <= 12))),
    CONSTRAINT "syllabi_source_type_check" CHECK (("source_type" = ANY (ARRAY['official'::"text", 'college_upload'::"text", 'student_upload'::"text", 'ai_generated'::"text"]))),
    CONSTRAINT "syllabi_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'verified'::"text", 'published'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."syllabi" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."syllabus_schemes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "university_id" "uuid",
    "name" "text" NOT NULL,
    "regulation" "text",
    "academic_year" "text",
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."syllabus_schemes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."syllabus_subjects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "syllabus_id" "uuid",
    "subject_name" "text" NOT NULL,
    "subject_code" "text",
    "credits" numeric,
    "subject_type" "text",
    "description" "text",
    "interview_relevance" "text" DEFAULT 'Medium'::"text",
    "interview_topics" "text"[] DEFAULT '{}'::"text"[],
    "source_verified" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "syllabus_subjects_interview_relevance_check" CHECK (("interview_relevance" = ANY (ARRAY['High'::"text", 'Medium'::"text", 'Low'::"text"])))
);


ALTER TABLE "public"."syllabus_subjects" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."syllabus_uploads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "uploaded_by" "uuid",
    "university_id" "uuid",
    "college_id" "uuid",
    "program_id" "uuid",
    "semester" integer,
    "scheme_name" "text",
    "file_name" "text" NOT NULL,
    "file_path" "text" NOT NULL,
    "file_type" "text",
    "upload_status" "text" DEFAULT 'uploaded'::"text",
    "extracted_data" "jsonb",
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "syllabus_uploads_upload_status_check" CHECK (("upload_status" = ANY (ARRAY['uploaded'::"text", 'extracting'::"text", 'completed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."syllabus_uploads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."universities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "short_name" "text",
    "country" "text" DEFAULT 'India'::"text",
    "state" "text",
    "official_website" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."universities" OWNER TO "postgres";


ALTER TABLE ONLY "public"."academic_programs"
    ADD CONSTRAINT "academic_programs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."academic_schemes"
    ADD CONSTRAINT "academic_schemes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."accountability_pods"
    ADD CONSTRAINT "accountability_pods_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_interview_answers"
    ADD CONSTRAINT "ai_interview_answers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_interview_sessions"
    ADD CONSTRAINT "ai_interview_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_placement_plans"
    ADD CONSTRAINT "ai_placement_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_roadmaps"
    ADD CONSTRAINT "ai_roadmaps_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."aptitude_attempts"
    ADD CONSTRAINT "aptitude_attempts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."aptitude_questions"
    ADD CONSTRAINT "aptitude_questions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."branches"
    ADD CONSTRAINT "branches_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."branches"
    ADD CONSTRAINT "branches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."campus_companies"
    ADD CONSTRAINT "campus_companies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."campus_company_visits"
    ADD CONSTRAINT "campus_company_visits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."campus_intel_submissions"
    ADD CONSTRAINT "campus_intel_submissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."campus_interview_embeddings"
    ADD CONSTRAINT "campus_interview_embeddings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."campus_interview_questions"
    ADD CONSTRAINT "campus_interview_questions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."campus_interview_reports"
    ADD CONSTRAINT "campus_interview_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."career_goals"
    ADD CONSTRAINT "career_goals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."college_branches"
    ADD CONSTRAINT "college_branches_college_id_branch_id_key" UNIQUE ("college_id", "branch_id");



ALTER TABLE ONLY "public"."college_branches"
    ADD CONSTRAINT "college_branches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."colleges"
    ADD CONSTRAINT "colleges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."curriculum_subjects"
    ADD CONSTRAINT "curriculum_subjects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dsa_problem_bank"
    ADD CONSTRAINT "dsa_problem_bank_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dsa_problem_library"
    ADD CONSTRAINT "dsa_problem_library_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dsa_problem_library"
    ADD CONSTRAINT "dsa_problem_library_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."dsa_problems"
    ADD CONSTRAINT "dsa_problems_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dsa_submissions"
    ADD CONSTRAINT "dsa_submissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dsa_submissions"
    ADD CONSTRAINT "dsa_submissions_user_id_problem_id_key" UNIQUE ("user_id", "problem_id");



ALTER TABLE ONLY "public"."mentor_availability"
    ADD CONSTRAINT "mentor_availability_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mentor_favorites"
    ADD CONSTRAINT "mentor_favorites_mentor_id_student_id_key" UNIQUE ("mentor_id", "student_id");



ALTER TABLE ONLY "public"."mentor_favorites"
    ADD CONSTRAINT "mentor_favorites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mentor_sessions"
    ADD CONSTRAINT "mentor_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mentor_verifications"
    ADD CONSTRAINT "mentor_verifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mentors"
    ADD CONSTRAINT "mentors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mentors"
    ADD CONSTRAINT "mentors_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."module_topics"
    ADD CONSTRAINT "module_topics_module_id_topic_number_key" UNIQUE ("module_id", "topic_number");



ALTER TABLE ONLY "public"."module_topics"
    ADD CONSTRAINT "module_topics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_admins"
    ADD CONSTRAINT "platform_admins_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."pod_checkin_attendance"
    ADD CONSTRAINT "pod_checkin_attendance_checkin_id_user_id_key" UNIQUE ("checkin_id", "user_id");



ALTER TABLE ONLY "public"."pod_checkin_attendance"
    ADD CONSTRAINT "pod_checkin_attendance_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pod_checkins"
    ADD CONSTRAINT "pod_checkins_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pod_goal_checkins"
    ADD CONSTRAINT "pod_goal_checkins_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pod_goals"
    ADD CONSTRAINT "pod_goals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pod_members"
    ADD CONSTRAINT "pod_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pod_members"
    ADD CONSTRAINT "pod_members_pod_id_user_id_key" UNIQUE ("pod_id", "user_id");



ALTER TABLE ONLY "public"."pod_streaks"
    ADD CONSTRAINT "pod_streaks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pod_streaks"
    ADD CONSTRAINT "pod_streaks_user_id_pod_id_key" UNIQUE ("user_id", "pod_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_reviews"
    ADD CONSTRAINT "project_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_verification_events"
    ADD CONSTRAINT "project_verification_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_verification_evidence"
    ADD CONSTRAINT "project_verification_evidence_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_verification_evidence"
    ADD CONSTRAINT "project_verification_evidence_project_id_key" UNIQUE ("project_id");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."resume_reviews"
    ADD CONSTRAINT "resume_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."resume_versions"
    ADD CONSTRAINT "resume_versions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."student_profiles"
    ADD CONSTRAINT "student_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."student_profiles"
    ADD CONSTRAINT "student_profiles_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."student_skills"
    ADD CONSTRAINT "student_skills_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."student_skills"
    ADD CONSTRAINT "student_skills_user_id_skill_name_key" UNIQUE ("user_id", "skill_name");



ALTER TABLE ONLY "public"."student_topic_progress"
    ADD CONSTRAINT "student_topic_progress_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."student_topic_progress"
    ADD CONSTRAINT "student_topic_progress_user_id_topic_id_key" UNIQUE ("user_id", "topic_id");



ALTER TABLE ONLY "public"."subject_modules"
    ADD CONSTRAINT "subject_modules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subject_modules"
    ADD CONSTRAINT "subject_modules_subject_id_module_number_key" UNIQUE ("subject_id", "module_number");



ALTER TABLE ONLY "public"."subject_progress"
    ADD CONSTRAINT "subject_progress_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subject_progress"
    ADD CONSTRAINT "subject_progress_user_id_subject_id_key" UNIQUE ("user_id", "subject_id");



ALTER TABLE ONLY "public"."syllabi"
    ADD CONSTRAINT "syllabi_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."syllabi"
    ADD CONSTRAINT "syllabi_university_id_program_id_scheme_id_semester_key" UNIQUE ("university_id", "program_id", "scheme_id", "semester");



ALTER TABLE ONLY "public"."syllabus_schemes"
    ADD CONSTRAINT "syllabus_schemes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."syllabus_subjects"
    ADD CONSTRAINT "syllabus_subjects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."syllabus_uploads"
    ADD CONSTRAINT "syllabus_uploads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."universities"
    ADD CONSTRAINT "universities_pkey" PRIMARY KEY ("id");



CREATE INDEX "ai_roadmaps_created_at_idx" ON "public"."ai_roadmaps" USING "btree" ("created_at" DESC);



CREATE INDEX "ai_roadmaps_user_id_idx" ON "public"."ai_roadmaps" USING "btree" ("user_id");



CREATE INDEX "campus_interview_embeddings_embedding_idx" ON "public"."campus_interview_embeddings" USING "hnsw" ("embedding" "extensions"."vector_cosine_ops");



CREATE UNIQUE INDEX "campus_interview_embeddings_question_unique" ON "public"."campus_interview_embeddings" USING "btree" ("question_id") WHERE ("question_id" IS NOT NULL);



CREATE UNIQUE INDEX "campus_interview_embeddings_report_unique" ON "public"."campus_interview_embeddings" USING "btree" ("report_id") WHERE ("report_id" IS NOT NULL);



CREATE INDEX "idx_accountability_pods_skill_level" ON "public"."accountability_pods" USING "btree" ("skill_level");



CREATE INDEX "idx_accountability_pods_status" ON "public"."accountability_pods" USING "btree" ("status");



CREATE INDEX "idx_accountability_pods_target_role" ON "public"."accountability_pods" USING "btree" ("target_role");



CREATE INDEX "idx_campus_company_visits_college" ON "public"."campus_company_visits" USING "btree" ("college_id");



CREATE INDEX "idx_campus_company_visits_company" ON "public"."campus_company_visits" USING "btree" ("company_id");



CREATE INDEX "idx_campus_company_visits_year" ON "public"."campus_company_visits" USING "btree" ("visit_year");



CREATE INDEX "idx_campus_interview_questions_category" ON "public"."campus_interview_questions" USING "btree" ("category");



CREATE INDEX "idx_campus_interview_questions_report" ON "public"."campus_interview_questions" USING "btree" ("report_id");



CREATE INDEX "idx_campus_interview_reports_college" ON "public"."campus_interview_reports" USING "btree" ("college_id");



CREATE INDEX "idx_campus_interview_reports_company" ON "public"."campus_interview_reports" USING "btree" ("company_id");



CREATE INDEX "idx_campus_interview_reports_source_submission" ON "public"."campus_interview_reports" USING "btree" ("source_submission_id");



CREATE INDEX "idx_campus_interview_reports_status" ON "public"."campus_interview_reports" USING "btree" ("moderation_status");



CREATE INDEX "idx_campus_interview_reports_user" ON "public"."campus_interview_reports" USING "btree" ("user_id");



CREATE INDEX "idx_campus_interview_reports_visit" ON "public"."campus_interview_reports" USING "btree" ("visit_id");



CREATE INDEX "idx_campus_interview_reports_year" ON "public"."campus_interview_reports" USING "btree" ("interview_year");



CREATE INDEX "idx_campus_submissions_college" ON "public"."campus_intel_submissions" USING "btree" ("college_id");



CREATE INDEX "idx_campus_submissions_status" ON "public"."campus_intel_submissions" USING "btree" ("moderation_status");



CREATE INDEX "idx_campus_submissions_user" ON "public"."campus_intel_submissions" USING "btree" ("user_id");



CREATE INDEX "idx_colleges_university" ON "public"."colleges" USING "btree" ("university_id");



CREATE INDEX "idx_mentor_availability_day" ON "public"."mentor_availability" USING "btree" ("day_of_week");



CREATE INDEX "idx_mentor_availability_mentor" ON "public"."mentor_availability" USING "btree" ("mentor_id");



CREATE INDEX "idx_mentor_favorites_student" ON "public"."mentor_favorites" USING "btree" ("student_id");



CREATE INDEX "idx_mentor_sessions_mentor" ON "public"."mentor_sessions" USING "btree" ("mentor_id");



CREATE INDEX "idx_mentor_sessions_scheduled" ON "public"."mentor_sessions" USING "btree" ("scheduled_at");



CREATE INDEX "idx_mentor_sessions_status" ON "public"."mentor_sessions" USING "btree" ("status");



CREATE INDEX "idx_mentor_sessions_student" ON "public"."mentor_sessions" USING "btree" ("student_id");



CREATE INDEX "idx_mentor_verifications_mentor" ON "public"."mentor_verifications" USING "btree" ("mentor_id");



CREATE INDEX "idx_mentors_available" ON "public"."mentors" USING "btree" ("is_available");



CREATE INDEX "idx_mentors_branch" ON "public"."mentors" USING "btree" ("branch");



CREATE INDEX "idx_mentors_college" ON "public"."mentors" USING "btree" ("college");



CREATE INDEX "idx_mentors_company" ON "public"."mentors" USING "btree" ("current_company");



CREATE INDEX "idx_mentors_job_role" ON "public"."mentors" USING "btree" ("job_role");



CREATE INDEX "idx_mentors_user_id" ON "public"."mentors" USING "btree" ("user_id");



CREATE INDEX "idx_mentors_verification_status" ON "public"."mentors" USING "btree" ("verification_status");



CREATE INDEX "idx_module_topics_module_id" ON "public"."module_topics" USING "btree" ("module_id");



CREATE INDEX "idx_pod_checkin_attendance_user_id" ON "public"."pod_checkin_attendance" USING "btree" ("user_id");



CREATE INDEX "idx_pod_checkins_pod_id" ON "public"."pod_checkins" USING "btree" ("pod_id");



CREATE INDEX "idx_pod_checkins_scheduled_at" ON "public"."pod_checkins" USING "btree" ("scheduled_at");



CREATE INDEX "idx_pod_goal_checkins_goal_id" ON "public"."pod_goal_checkins" USING "btree" ("goal_id");



CREATE INDEX "idx_pod_goals_pod_id" ON "public"."pod_goals" USING "btree" ("pod_id");



CREATE INDEX "idx_pod_goals_user_id" ON "public"."pod_goals" USING "btree" ("user_id");



CREATE INDEX "idx_pod_goals_week" ON "public"."pod_goals" USING "btree" ("week_start", "week_end");



CREATE INDEX "idx_pod_members_pod_id" ON "public"."pod_members" USING "btree" ("pod_id");



CREATE INDEX "idx_pod_members_status" ON "public"."pod_members" USING "btree" ("status");



CREATE INDEX "idx_pod_members_user_id" ON "public"."pod_members" USING "btree" ("user_id");



CREATE INDEX "idx_pod_streaks_user_id" ON "public"."pod_streaks" USING "btree" ("user_id");



CREATE INDEX "idx_programs_university" ON "public"."academic_programs" USING "btree" ("university_id");



CREATE INDEX "idx_project_reviews_project" ON "public"."project_reviews" USING "btree" ("project_id");



CREATE INDEX "idx_project_reviews_reviewer" ON "public"."project_reviews" USING "btree" ("reviewer_id");



CREATE INDEX "idx_project_verification_events_project" ON "public"."project_verification_events" USING "btree" ("project_id");



CREATE INDEX "idx_project_verification_events_user" ON "public"."project_verification_events" USING "btree" ("user_id");



CREATE INDEX "idx_project_verification_evidence_user" ON "public"."project_verification_evidence" USING "btree" ("user_id");



CREATE INDEX "idx_projects_verification_status" ON "public"."projects" USING "btree" ("verification_status");



CREATE INDEX "idx_student_topic_progress_topic_id" ON "public"."student_topic_progress" USING "btree" ("topic_id");



CREATE INDEX "idx_student_topic_progress_user_id" ON "public"."student_topic_progress" USING "btree" ("user_id");



CREATE INDEX "idx_subject_modules_subject_id" ON "public"."subject_modules" USING "btree" ("subject_id");



CREATE INDEX "idx_subjects_syllabus" ON "public"."syllabus_subjects" USING "btree" ("syllabus_id");



CREATE INDEX "idx_syllabi_lookup" ON "public"."syllabi" USING "btree" ("university_id", "program_id", "semester");



CREATE INDEX "idx_uploads_status" ON "public"."syllabus_uploads" USING "btree" ("upload_status");



CREATE INDEX "project_verification_events_project_id_idx" ON "public"."project_verification_events" USING "btree" ("project_id");



CREATE INDEX "project_verification_evidence_project_id_idx" ON "public"."project_verification_evidence" USING "btree" ("project_id");



CREATE OR REPLACE TRIGGER "accountability_pods_updated_at" BEFORE UPDATE ON "public"."accountability_pods" FOR EACH ROW EXECUTE FUNCTION "public"."update_accountability_updated_at"();



CREATE OR REPLACE TRIGGER "campus_companies_updated_at" BEFORE UPDATE ON "public"."campus_companies" FOR EACH ROW EXECUTE FUNCTION "public"."update_campus_intel_updated_at"();



CREATE OR REPLACE TRIGGER "campus_company_visits_updated_at" BEFORE UPDATE ON "public"."campus_company_visits" FOR EACH ROW EXECUTE FUNCTION "public"."update_campus_intel_updated_at"();



CREATE OR REPLACE TRIGGER "campus_intel_submissions_updated_at" BEFORE UPDATE ON "public"."campus_intel_submissions" FOR EACH ROW EXECUTE FUNCTION "public"."update_campus_intel_updated_at"();



CREATE OR REPLACE TRIGGER "campus_interview_reports_updated_at" BEFORE UPDATE ON "public"."campus_interview_reports" FOR EACH ROW EXECUTE FUNCTION "public"."update_campus_intel_updated_at"();



CREATE OR REPLACE TRIGGER "mentor_sessions_updated_at" BEFORE UPDATE ON "public"."mentor_sessions" FOR EACH ROW EXECUTE FUNCTION "public"."update_mentor_updated_at"();



CREATE OR REPLACE TRIGGER "mentors_updated_at" BEFORE UPDATE ON "public"."mentors" FOR EACH ROW EXECUTE FUNCTION "public"."update_mentor_updated_at"();



CREATE OR REPLACE TRIGGER "pod_goals_updated_at" BEFORE UPDATE ON "public"."pod_goals" FOR EACH ROW EXECUTE FUNCTION "public"."update_accountability_updated_at"();



ALTER TABLE ONLY "public"."academic_programs"
    ADD CONSTRAINT "academic_programs_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "public"."universities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."academic_schemes"
    ADD CONSTRAINT "academic_schemes_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "public"."universities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_interview_answers"
    ADD CONSTRAINT "ai_interview_answers_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."ai_interview_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_interview_sessions"
    ADD CONSTRAINT "ai_interview_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_placement_plans"
    ADD CONSTRAINT "ai_placement_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_roadmaps"
    ADD CONSTRAINT "ai_roadmaps_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."aptitude_attempts"
    ADD CONSTRAINT "aptitude_attempts_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."aptitude_questions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."aptitude_attempts"
    ADD CONSTRAINT "aptitude_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."campus_company_visits"
    ADD CONSTRAINT "campus_company_visits_college_id_fkey" FOREIGN KEY ("college_id") REFERENCES "public"."colleges"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."campus_company_visits"
    ADD CONSTRAINT "campus_company_visits_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."campus_companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."campus_intel_submissions"
    ADD CONSTRAINT "campus_intel_submissions_college_id_fkey" FOREIGN KEY ("college_id") REFERENCES "public"."colleges"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."campus_intel_submissions"
    ADD CONSTRAINT "campus_intel_submissions_published_by_fkey" FOREIGN KEY ("published_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."campus_intel_submissions"
    ADD CONSTRAINT "campus_intel_submissions_published_visit_id_fkey" FOREIGN KEY ("published_visit_id") REFERENCES "public"."campus_company_visits"("id");



ALTER TABLE ONLY "public"."campus_intel_submissions"
    ADD CONSTRAINT "campus_intel_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."campus_interview_embeddings"
    ADD CONSTRAINT "campus_interview_embeddings_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."campus_interview_questions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."campus_interview_embeddings"
    ADD CONSTRAINT "campus_interview_embeddings_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "public"."campus_interview_reports"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."campus_interview_questions"
    ADD CONSTRAINT "campus_interview_questions_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "public"."campus_interview_reports"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."campus_interview_reports"
    ADD CONSTRAINT "campus_interview_reports_college_id_fkey" FOREIGN KEY ("college_id") REFERENCES "public"."colleges"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."campus_interview_reports"
    ADD CONSTRAINT "campus_interview_reports_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."campus_companies"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."campus_interview_reports"
    ADD CONSTRAINT "campus_interview_reports_source_submission_id_fkey" FOREIGN KEY ("source_submission_id") REFERENCES "public"."campus_intel_submissions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."campus_interview_reports"
    ADD CONSTRAINT "campus_interview_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."campus_interview_reports"
    ADD CONSTRAINT "campus_interview_reports_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "public"."campus_company_visits"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."career_goals"
    ADD CONSTRAINT "career_goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."college_branches"
    ADD CONSTRAINT "college_branches_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."college_branches"
    ADD CONSTRAINT "college_branches_college_id_fkey" FOREIGN KEY ("college_id") REFERENCES "public"."colleges"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."colleges"
    ADD CONSTRAINT "colleges_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "public"."universities"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."dsa_problems"
    ADD CONSTRAINT "dsa_problems_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dsa_submissions"
    ADD CONSTRAINT "dsa_submissions_problem_id_fkey" FOREIGN KEY ("problem_id") REFERENCES "public"."dsa_problem_bank"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dsa_submissions"
    ADD CONSTRAINT "dsa_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mentor_availability"
    ADD CONSTRAINT "mentor_availability_mentor_id_fkey" FOREIGN KEY ("mentor_id") REFERENCES "public"."mentors"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mentor_favorites"
    ADD CONSTRAINT "mentor_favorites_mentor_id_fkey" FOREIGN KEY ("mentor_id") REFERENCES "public"."mentors"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mentor_favorites"
    ADD CONSTRAINT "mentor_favorites_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mentor_sessions"
    ADD CONSTRAINT "mentor_sessions_mentor_id_fkey" FOREIGN KEY ("mentor_id") REFERENCES "public"."mentors"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mentor_sessions"
    ADD CONSTRAINT "mentor_sessions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mentor_verifications"
    ADD CONSTRAINT "mentor_verifications_mentor_id_fkey" FOREIGN KEY ("mentor_id") REFERENCES "public"."mentors"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mentor_verifications"
    ADD CONSTRAINT "mentor_verifications_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."mentors"
    ADD CONSTRAINT "mentors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mentors"
    ADD CONSTRAINT "mentors_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."module_topics"
    ADD CONSTRAINT "module_topics_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "public"."subject_modules"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."platform_admins"
    ADD CONSTRAINT "platform_admins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pod_checkin_attendance"
    ADD CONSTRAINT "pod_checkin_attendance_checkin_id_fkey" FOREIGN KEY ("checkin_id") REFERENCES "public"."pod_checkins"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pod_checkin_attendance"
    ADD CONSTRAINT "pod_checkin_attendance_pod_id_fkey" FOREIGN KEY ("pod_id") REFERENCES "public"."accountability_pods"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pod_checkin_attendance"
    ADD CONSTRAINT "pod_checkin_attendance_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pod_checkins"
    ADD CONSTRAINT "pod_checkins_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pod_checkins"
    ADD CONSTRAINT "pod_checkins_pod_id_fkey" FOREIGN KEY ("pod_id") REFERENCES "public"."accountability_pods"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pod_goal_checkins"
    ADD CONSTRAINT "pod_goal_checkins_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "public"."pod_goals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pod_goal_checkins"
    ADD CONSTRAINT "pod_goal_checkins_pod_id_fkey" FOREIGN KEY ("pod_id") REFERENCES "public"."accountability_pods"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pod_goal_checkins"
    ADD CONSTRAINT "pod_goal_checkins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pod_goals"
    ADD CONSTRAINT "pod_goals_pod_id_fkey" FOREIGN KEY ("pod_id") REFERENCES "public"."accountability_pods"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pod_goals"
    ADD CONSTRAINT "pod_goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pod_members"
    ADD CONSTRAINT "pod_members_pod_id_fkey" FOREIGN KEY ("pod_id") REFERENCES "public"."accountability_pods"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pod_members"
    ADD CONSTRAINT "pod_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pod_streaks"
    ADD CONSTRAINT "pod_streaks_pod_id_fkey" FOREIGN KEY ("pod_id") REFERENCES "public"."accountability_pods"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pod_streaks"
    ADD CONSTRAINT "pod_streaks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_reviews"
    ADD CONSTRAINT "project_reviews_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_verification_events"
    ADD CONSTRAINT "project_verification_events_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_verification_evidence"
    ADD CONSTRAINT "project_verification_evidence_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."resume_reviews"
    ADD CONSTRAINT "resume_reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."resume_versions"
    ADD CONSTRAINT "resume_versions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_profiles"
    ADD CONSTRAINT "student_profiles_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."student_profiles"
    ADD CONSTRAINT "student_profiles_college_id_fkey" FOREIGN KEY ("college_id") REFERENCES "public"."colleges"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."student_profiles"
    ADD CONSTRAINT "student_profiles_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "public"."academic_programs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."student_profiles"
    ADD CONSTRAINT "student_profiles_scheme_id_fkey" FOREIGN KEY ("scheme_id") REFERENCES "public"."academic_schemes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."student_profiles"
    ADD CONSTRAINT "student_profiles_syllabus_scheme_id_fkey" FOREIGN KEY ("syllabus_scheme_id") REFERENCES "public"."syllabus_schemes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."student_profiles"
    ADD CONSTRAINT "student_profiles_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "public"."universities"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."student_profiles"
    ADD CONSTRAINT "student_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_skills"
    ADD CONSTRAINT "student_skills_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_topic_progress"
    ADD CONSTRAINT "student_topic_progress_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "public"."module_topics"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_topic_progress"
    ADD CONSTRAINT "student_topic_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subject_modules"
    ADD CONSTRAINT "subject_modules_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "public"."syllabus_subjects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subject_progress"
    ADD CONSTRAINT "subject_progress_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "public"."syllabus_subjects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subject_progress"
    ADD CONSTRAINT "subject_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."syllabi"
    ADD CONSTRAINT "syllabi_college_id_fkey" FOREIGN KEY ("college_id") REFERENCES "public"."colleges"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."syllabi"
    ADD CONSTRAINT "syllabi_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "public"."academic_programs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."syllabi"
    ADD CONSTRAINT "syllabi_scheme_id_fkey" FOREIGN KEY ("scheme_id") REFERENCES "public"."syllabus_schemes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."syllabi"
    ADD CONSTRAINT "syllabi_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "public"."universities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."syllabus_schemes"
    ADD CONSTRAINT "syllabus_schemes_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "public"."universities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."syllabus_subjects"
    ADD CONSTRAINT "syllabus_subjects_syllabus_id_fkey" FOREIGN KEY ("syllabus_id") REFERENCES "public"."syllabi"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."syllabus_uploads"
    ADD CONSTRAINT "syllabus_uploads_college_id_fkey" FOREIGN KEY ("college_id") REFERENCES "public"."colleges"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."syllabus_uploads"
    ADD CONSTRAINT "syllabus_uploads_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "public"."academic_programs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."syllabus_uploads"
    ADD CONSTRAINT "syllabus_uploads_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "public"."universities"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."syllabus_uploads"
    ADD CONSTRAINT "syllabus_uploads_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



CREATE POLICY "Admins can insert campus companies" ON "public"."campus_companies" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_platform_admin"());



CREATE POLICY "Admins can insert company visits" ON "public"."campus_company_visits" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_platform_admin"());



CREATE POLICY "Admins can moderate campus intel" ON "public"."campus_intel_submissions" FOR UPDATE TO "authenticated" USING ("public"."is_platform_admin"()) WITH CHECK ("public"."is_platform_admin"());



CREATE POLICY "Admins can moderate interview reports" ON "public"."campus_interview_reports" FOR UPDATE TO "authenticated" USING ("public"."is_platform_admin"()) WITH CHECK ("public"."is_platform_admin"());



CREATE POLICY "Admins can update campus companies" ON "public"."campus_companies" FOR UPDATE TO "authenticated" USING ("public"."is_platform_admin"()) WITH CHECK ("public"."is_platform_admin"());



CREATE POLICY "Admins can update company visits" ON "public"."campus_company_visits" FOR UPDATE TO "authenticated" USING ("public"."is_platform_admin"()) WITH CHECK ("public"."is_platform_admin"());



CREATE POLICY "Admins can view admin records" ON "public"."platform_admins" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Admins can view all campus intel submissions" ON "public"."campus_intel_submissions" FOR SELECT TO "authenticated" USING ("public"."is_platform_admin"());



CREATE POLICY "Admins can view all interview reports" ON "public"."campus_interview_reports" FOR SELECT TO "authenticated" USING ("public"."is_platform_admin"());



CREATE POLICY "Anyone authenticated can read colleges" ON "public"."colleges" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Anyone authenticated can read programs" ON "public"."academic_programs" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Anyone authenticated can read syllabus schemes" ON "public"."syllabus_schemes" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Anyone authenticated can read universities" ON "public"."universities" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Anyone can read DSA problem library" ON "public"."dsa_problem_library" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Anyone can view DSA problems" ON "public"."dsa_problem_bank" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can insert interview questions" ON "public"."campus_interview_questions" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."campus_interview_reports" "r"
  WHERE (("r"."id" = "campus_interview_questions"."report_id") AND ("r"."user_id" = "auth"."uid"())))));



CREATE POLICY "Authenticated users can insert interview reports" ON "public"."campus_interview_reports" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Authenticated users can read campus embeddings" ON "public"."campus_interview_embeddings" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can read interview questions" ON "public"."campus_interview_questions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can upload syllabus metadata" ON "public"."syllabus_uploads" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "uploaded_by"));



CREATE POLICY "Authenticated users can view approved campus intel submissions" ON "public"."campus_intel_submissions" FOR SELECT TO "authenticated" USING ((("moderation_status" = 'approved'::"text") OR ("user_id" = "auth"."uid"())));



CREATE POLICY "Authenticated users can view approved campus submissions" ON "public"."campus_intel_submissions" FOR SELECT TO "authenticated" USING (("moderation_status" = 'approved'::"text"));



CREATE POLICY "Authenticated users can view approved interview reports" ON "public"."campus_interview_reports" FOR SELECT TO "authenticated" USING ((("moderation_status" = 'approved'::"text") OR ("user_id" = "auth"."uid"())));



CREATE POLICY "Authenticated users can view approved question-linked reports" ON "public"."campus_interview_reports" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."campus_intel_submissions" "s"
  WHERE (("s"."id" = "campus_interview_reports"."source_submission_id") AND ("s"."submission_type" = 'interview_question'::"text") AND ("s"."moderation_status" = 'approved'::"text")))));



CREATE POLICY "Authenticated users can view approved questions" ON "public"."campus_interview_questions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."campus_interview_reports" "r"
  WHERE (("r"."id" = "campus_interview_questions"."report_id") AND (("r"."moderation_status" = 'approved'::"text") OR ("r"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Authenticated users can view aptitude questions" ON "public"."aptitude_questions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view campus companies" ON "public"."campus_companies" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view campus company visits" ON "public"."campus_company_visits" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view company visits" ON "public"."campus_company_visits" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view curriculum" ON "public"."curriculum_subjects" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view curriculum subjects" ON "public"."curriculum_subjects" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view interview questions" ON "public"."campus_interview_questions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."campus_interview_reports" "r"
  WHERE (("r"."id" = "campus_interview_questions"."report_id") AND (("r"."moderation_status" = 'approved'::"text") OR ("r"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Project owners can create peer review requests" ON "public"."project_reviews" FOR INSERT TO "authenticated" WITH CHECK ((("reviewer_role" = 'peer'::"text") AND ("status" = 'pending'::"text") AND ("reviewer_id" <> "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."projects" "p"
  WHERE (("p"."id" = "project_reviews"."project_id") AND ("p"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Project owners can create senior review requests" ON "public"."project_reviews" FOR INSERT TO "authenticated" WITH CHECK ((("reviewer_role" = 'senior'::"text") AND ("status" = 'pending'::"text") AND ("reviewer_id" <> "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."projects" "p"
  WHERE (("p"."id" = "project_reviews"."project_id") AND ("p"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Project owners can view their reviews" ON "public"."project_reviews" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."projects" "p"
  WHERE (("p"."id" = "project_reviews"."project_id") AND ("p"."user_id" = "auth"."uid"())))));



CREATE POLICY "Reviewers can update their reviews" ON "public"."project_reviews" FOR UPDATE TO "authenticated" USING (("reviewer_id" = "auth"."uid"())) WITH CHECK (("reviewer_id" = "auth"."uid"()));



CREATE POLICY "Reviewers can view assigned reviews" ON "public"."project_reviews" FOR SELECT TO "authenticated" USING (("reviewer_id" = "auth"."uid"()));



CREATE POLICY "Senior reviewers can verify assigned projects" ON "public"."projects" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."project_reviews" "pr"
  WHERE (("pr"."project_id" = "projects"."id") AND ("pr"."reviewer_id" = "auth"."uid"()) AND ("pr"."reviewer_role" = 'senior'::"text") AND ("pr"."status" = 'pending'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."project_reviews" "pr"
  WHERE (("pr"."project_id" = "projects"."id") AND ("pr"."reviewer_id" = "auth"."uid"()) AND ("pr"."reviewer_role" = 'senior'::"text") AND ("pr"."status" = 'pending'::"text")))));



CREATE POLICY "Students can read published syllabi" ON "public"."syllabi" FOR SELECT TO "authenticated" USING (("status" = ANY (ARRAY['verified'::"text", 'published'::"text"])));



CREATE POLICY "Students can read syllabus subjects" ON "public"."syllabus_subjects" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can add their own DSA problems" ON "public"."dsa_problems" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can add their own aptitude attempts" ON "public"."aptitude_attempts" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can add their own projects" ON "public"."projects" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create their own AI roadmaps" ON "public"."ai_roadmaps" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create their own campus submissions" ON "public"."campus_intel_submissions" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can create their own interview reports" ON "public"."campus_interview_reports" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can create their own placement plans" ON "public"."ai_placement_plans" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create their own profile" ON "public"."student_profiles" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create their own submissions" ON "public"."dsa_submissions" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create their project verification events" ON "public"."project_verification_events" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create their project verification evidence" ON "public"."project_verification_evidence" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own AI roadmaps" ON "public"."ai_roadmaps" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own DSA problems" ON "public"."dsa_problems" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own aptitude attempts" ON "public"."aptitude_attempts" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own placement plans" ON "public"."ai_placement_plans" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own projects" ON "public"."projects" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own resume versions" ON "public"."resume_versions" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own skills" ON "public"."student_skills" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert campus interview questions" ON "public"."campus_interview_questions" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."campus_interview_reports" "r"
  WHERE (("r"."id" = "campus_interview_questions"."report_id") AND ("r"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can insert campus interview reports" ON "public"."campus_interview_reports" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their interview answers" ON "public"."ai_interview_answers" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."ai_interview_sessions" "s"
  WHERE (("s"."id" = "ai_interview_answers"."session_id") AND ("s"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can insert their interview sessions" ON "public"."ai_interview_sessions" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own DSA problems" ON "public"."dsa_problems" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own career goals" ON "public"."career_goals" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own profile" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can insert their own resume reviews" ON "public"."resume_reviews" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own resume versions" ON "public"."resume_versions" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own skills" ON "public"."student_skills" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own student profile" ON "public"."student_profiles" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert verification events for own projects" ON "public"."project_verification_events" FOR INSERT TO "authenticated" WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."projects" "p"
  WHERE (("p"."id" = "project_verification_events"."project_id") AND ("p"."user_id" = "auth"."uid"())))) AND ("actor_id" = "auth"."uid"())));



CREATE POLICY "Users can insert verification evidence for own projects" ON "public"."project_verification_evidence" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."projects" "p"
  WHERE (("p"."id" = "project_verification_evidence"."project_id") AND ("p"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can read own interview reports" ON "public"."campus_interview_reports" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can submit campus intel" ON "public"."campus_intel_submissions" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can submit interview reports" ON "public"."campus_interview_reports" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update own pending campus intel" ON "public"."campus_intel_submissions" FOR UPDATE TO "authenticated" USING ((("user_id" = "auth"."uid"()) AND ("moderation_status" = 'pending'::"text"))) WITH CHECK ((("user_id" = "auth"."uid"()) AND ("moderation_status" = 'pending'::"text")));



CREATE POLICY "Users can update pending interview reports" ON "public"."campus_interview_reports" FOR UPDATE TO "authenticated" USING ((("user_id" = "auth"."uid"()) AND ("moderation_status" = 'pending'::"text"))) WITH CHECK ((("user_id" = "auth"."uid"()) AND ("moderation_status" = 'pending'::"text")));



CREATE POLICY "Users can update their interview sessions" ON "public"."ai_interview_sessions" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own AI roadmaps" ON "public"."ai_roadmaps" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own career goals" ON "public"."career_goals" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own pending reports" ON "public"."campus_interview_reports" FOR UPDATE TO "authenticated" USING ((("user_id" = "auth"."uid"()) AND ("moderation_status" = 'pending'::"text"))) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update their own pending submissions" ON "public"."campus_intel_submissions" FOR UPDATE TO "authenticated" USING ((("user_id" = "auth"."uid"()) AND ("moderation_status" = 'pending'::"text"))) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update their own profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can update their own profile" ON "public"."student_profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own projects" ON "public"."projects" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own resume versions" ON "public"."resume_versions" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own student profile" ON "public"."student_profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own submissions" ON "public"."dsa_submissions" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their project verification evidence" ON "public"."project_verification_evidence" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update verification evidence for own projects" ON "public"."project_verification_evidence" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."projects" "p"
  WHERE (("p"."id" = "project_verification_evidence"."project_id") AND ("p"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."projects" "p"
  WHERE (("p"."id" = "project_verification_evidence"."project_id") AND ("p"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view campus interview questions" ON "public"."campus_interview_questions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."campus_interview_reports" "r"
  WHERE (("r"."id" = "campus_interview_questions"."report_id") AND ("r"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view interview reports" ON "public"."campus_interview_reports" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR ("moderation_status" = 'approved'::"text")));



CREATE POLICY "Users can view own campus intel" ON "public"."campus_intel_submissions" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR ("moderation_status" = 'approved'::"text")));



CREATE POLICY "Users can view own campus interview reports" ON "public"."campus_interview_reports" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view reviews for their projects" ON "public"."project_reviews" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."projects" "p"
  WHERE (("p"."id" = "project_reviews"."project_id") AND ("p"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view their interview answers" ON "public"."ai_interview_answers" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."ai_interview_sessions" "s"
  WHERE (("s"."id" = "ai_interview_answers"."session_id") AND ("s"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view their interview sessions" ON "public"."ai_interview_sessions" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own AI roadmaps" ON "public"."ai_roadmaps" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own DSA problems" ON "public"."dsa_problems" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own aptitude attempts" ON "public"."aptitude_attempts" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own campus submissions" ON "public"."campus_intel_submissions" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own career goals" ON "public"."career_goals" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own placement plans" ON "public"."ai_placement_plans" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own profile" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view their own profile" ON "public"."student_profiles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own projects" ON "public"."projects" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own resume reviews" ON "public"."resume_reviews" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own resume versions" ON "public"."resume_versions" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own skills" ON "public"."student_skills" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own student profile" ON "public"."student_profiles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own submissions" ON "public"."dsa_submissions" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their project verification events" ON "public"."project_verification_events" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their project verification evidence" ON "public"."project_verification_evidence" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their uploads" ON "public"."syllabus_uploads" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "uploaded_by"));



CREATE POLICY "Users can view verification events for own projects" ON "public"."project_verification_events" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."projects" "p"
  WHERE (("p"."id" = "project_verification_events"."project_id") AND ("p"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view verification evidence for own projects" ON "public"."project_verification_evidence" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."projects" "p"
  WHERE (("p"."id" = "project_verification_evidence"."project_id") AND ("p"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."academic_programs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."academic_schemes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."accountability_pods" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "accountability_pods_select_member" ON "public"."accountability_pods" FOR SELECT TO "authenticated" USING ("public"."is_pod_member"("id", "auth"."uid"()));



ALTER TABLE "public"."ai_interview_answers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_interview_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_placement_plans" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_roadmaps" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."aptitude_attempts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."aptitude_questions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "availability_delete_own" ON "public"."mentor_availability" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."mentors" "m"
  WHERE (("m"."id" = "mentor_availability"."mentor_id") AND ("m"."user_id" = "auth"."uid"())))));



CREATE POLICY "availability_insert_own" ON "public"."mentor_availability" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."mentors" "m"
  WHERE (("m"."id" = "mentor_availability"."mentor_id") AND ("m"."user_id" = "auth"."uid"())))));



CREATE POLICY "availability_select_verified" ON "public"."mentor_availability" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."mentors" "m"
  WHERE (("m"."id" = "mentor_availability"."mentor_id") AND (("m"."verification_status" = 'verified'::"text") OR ("m"."user_id" = "auth"."uid"()))))));



CREATE POLICY "availability_update_own" ON "public"."mentor_availability" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."mentors" "m"
  WHERE (("m"."id" = "mentor_availability"."mentor_id") AND ("m"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."branches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."campus_companies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."campus_company_visits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."campus_intel_submissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."campus_interview_embeddings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."campus_interview_questions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."campus_interview_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."career_goals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."college_branches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."colleges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."curriculum_subjects" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."dsa_problem_bank" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."dsa_problem_library" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."dsa_problems" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."dsa_submissions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "favorites_delete_own" ON "public"."mentor_favorites" FOR DELETE TO "authenticated" USING (("student_id" = "auth"."uid"()));



CREATE POLICY "favorites_insert_own" ON "public"."mentor_favorites" FOR INSERT TO "authenticated" WITH CHECK (("student_id" = "auth"."uid"()));



CREATE POLICY "favorites_select_own" ON "public"."mentor_favorites" FOR SELECT TO "authenticated" USING (("student_id" = "auth"."uid"()));



ALTER TABLE "public"."mentor_availability" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mentor_favorites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mentor_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mentor_verifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mentors" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "mentors_insert_own" ON "public"."mentors" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "mentors_select_verified" ON "public"."mentors" FOR SELECT TO "authenticated" USING ((("verification_status" = 'verified'::"text") OR ("user_id" = "auth"."uid"())));



CREATE POLICY "mentors_update_own" ON "public"."mentors" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."module_topics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."platform_admins" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pod_attendance_insert_own" ON "public"."pod_checkin_attendance" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND "public"."is_pod_member"("pod_id", "auth"."uid"())));



CREATE POLICY "pod_attendance_select_member" ON "public"."pod_checkin_attendance" FOR SELECT TO "authenticated" USING ("public"."is_pod_member"("pod_id", "auth"."uid"()));



CREATE POLICY "pod_attendance_update_own" ON "public"."pod_checkin_attendance" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."pod_checkin_attendance" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pod_checkins" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pod_checkins_select_member" ON "public"."pod_checkins" FOR SELECT TO "authenticated" USING ("public"."is_pod_member"("pod_id", "auth"."uid"()));



ALTER TABLE "public"."pod_goal_checkins" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pod_goal_checkins_insert_own" ON "public"."pod_goal_checkins" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND "public"."is_pod_member"("pod_id", "auth"."uid"())));



CREATE POLICY "pod_goal_checkins_select_member" ON "public"."pod_goal_checkins" FOR SELECT TO "authenticated" USING ("public"."is_pod_member"("pod_id", "auth"."uid"()));



ALTER TABLE "public"."pod_goals" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pod_goals_delete_own" ON "public"."pod_goals" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "pod_goals_insert_own" ON "public"."pod_goals" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND "public"."is_pod_member"("pod_id", "auth"."uid"())));



CREATE POLICY "pod_goals_select_member" ON "public"."pod_goals" FOR SELECT TO "authenticated" USING ("public"."is_pod_member"("pod_id", "auth"."uid"()));



CREATE POLICY "pod_goals_update_own" ON "public"."pod_goals" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."pod_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pod_members_insert_own" ON "public"."pod_members" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "pod_members_select_own" ON "public"."pod_members" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "pod_members_select_same_pod" ON "public"."pod_members" FOR SELECT TO "authenticated" USING ("public"."is_pod_member"("pod_id", "auth"."uid"()));



CREATE POLICY "pod_members_update_own" ON "public"."pod_members" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."pod_streaks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pod_streaks_insert_own" ON "public"."pod_streaks" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "pod_streaks_select_own" ON "public"."pod_streaks" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "pod_streaks_update_own" ON "public"."pod_streaks" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_reviews" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_verification_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_verification_evidence" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."projects" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."resume_reviews" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."resume_versions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sessions_insert_student" ON "public"."mentor_sessions" FOR INSERT TO "authenticated" WITH CHECK (("student_id" = "auth"."uid"()));



CREATE POLICY "sessions_select_participant" ON "public"."mentor_sessions" FOR SELECT TO "authenticated" USING ((("student_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."mentors" "m"
  WHERE (("m"."id" = "mentor_sessions"."mentor_id") AND ("m"."user_id" = "auth"."uid"()))))));



CREATE POLICY "sessions_update_participant" ON "public"."mentor_sessions" FOR UPDATE TO "authenticated" USING ((("student_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."mentors" "m"
  WHERE (("m"."id" = "mentor_sessions"."mentor_id") AND ("m"."user_id" = "auth"."uid"()))))));



ALTER TABLE "public"."student_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."student_skills" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."student_topic_progress" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subject_modules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subject_progress" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."syllabi" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."syllabus_schemes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."syllabus_subjects" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."syllabus_uploads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."universities" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "verification_insert_own" ON "public"."mentor_verifications" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."mentors" "m"
  WHERE (("m"."id" = "mentor_verifications"."mentor_id") AND ("m"."user_id" = "auth"."uid"())))));



CREATE POLICY "verification_select_own" ON "public"."mentor_verifications" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."mentors" "m"
  WHERE (("m"."id" = "mentor_verifications"."mentor_id") AND ("m"."user_id" = "auth"."uid"())))));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";












































































































































































































































































































































































































































































































REVOKE ALL ON FUNCTION "public"."is_platform_admin"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_platform_admin"() TO "authenticated";



GRANT ALL ON FUNCTION "public"."is_pod_member"("check_pod_id" "uuid", "check_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_pod_member"("check_pod_id" "uuid", "check_user_id" "uuid") TO "service_role";

































GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."academic_programs" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."academic_programs" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."academic_programs" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."academic_schemes" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."academic_schemes" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."academic_schemes" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."accountability_pods" TO "anon";
GRANT ALL ON TABLE "public"."accountability_pods" TO "authenticated";
GRANT ALL ON TABLE "public"."accountability_pods" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."ai_interview_answers" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."ai_interview_answers" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."ai_interview_answers" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."ai_interview_sessions" TO "anon";
GRANT ALL ON TABLE "public"."ai_interview_sessions" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."ai_interview_sessions" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."ai_placement_plans" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."ai_placement_plans" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."ai_placement_plans" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."ai_roadmaps" TO "anon";
GRANT ALL ON TABLE "public"."ai_roadmaps" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_roadmaps" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."aptitude_attempts" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."aptitude_attempts" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."aptitude_attempts" TO "service_role";



GRANT SELECT,USAGE ON SEQUENCE "public"."aptitude_attempts_id_seq" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."aptitude_questions" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."aptitude_questions" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."aptitude_questions" TO "service_role";



GRANT SELECT,USAGE ON SEQUENCE "public"."aptitude_questions_id_seq" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."branches" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."branches" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."branches" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."campus_companies" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."campus_companies" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."campus_companies" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."campus_company_visits" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."campus_company_visits" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."campus_company_visits" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."campus_intel_submissions" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."campus_intel_submissions" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."campus_intel_submissions" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."campus_interview_embeddings" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."campus_interview_embeddings" TO "authenticated";
GRANT ALL ON TABLE "public"."campus_interview_embeddings" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."campus_interview_questions" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."campus_interview_questions" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."campus_interview_questions" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."campus_interview_reports" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."campus_interview_reports" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."campus_interview_reports" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."career_goals" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."career_goals" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."career_goals" TO "service_role";



GRANT SELECT,USAGE ON SEQUENCE "public"."career_goals_id_seq" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."college_branches" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."college_branches" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."college_branches" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."colleges" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."colleges" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."colleges" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."curriculum_subjects" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."curriculum_subjects" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."curriculum_subjects" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."dsa_problem_bank" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."dsa_problem_bank" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."dsa_problem_bank" TO "service_role";



GRANT SELECT,USAGE ON SEQUENCE "public"."dsa_problem_bank_id_seq" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."dsa_problem_library" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."dsa_problem_library" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."dsa_problem_library" TO "service_role";



GRANT SELECT,USAGE ON SEQUENCE "public"."dsa_problem_library_id_seq" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."dsa_problems" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."dsa_problems" TO "authenticated";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."dsa_problems" TO "service_role";



GRANT SELECT,USAGE ON SEQUENCE "public"."dsa_problems_id_seq" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."dsa_submissions" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."dsa_submissions" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."dsa_submissions" TO "service_role";



GRANT SELECT,USAGE ON SEQUENCE "public"."dsa_submissions_id_seq" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."mentor_availability" TO "anon";
GRANT ALL ON TABLE "public"."mentor_availability" TO "authenticated";
GRANT ALL ON TABLE "public"."mentor_availability" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."mentor_favorites" TO "anon";
GRANT ALL ON TABLE "public"."mentor_favorites" TO "authenticated";
GRANT ALL ON TABLE "public"."mentor_favorites" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."mentor_sessions" TO "anon";
GRANT ALL ON TABLE "public"."mentor_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."mentor_sessions" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."mentor_verifications" TO "anon";
GRANT ALL ON TABLE "public"."mentor_verifications" TO "authenticated";
GRANT ALL ON TABLE "public"."mentor_verifications" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."mentors" TO "anon";
GRANT ALL ON TABLE "public"."mentors" TO "authenticated";
GRANT ALL ON TABLE "public"."mentors" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."module_topics" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."module_topics" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."module_topics" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."platform_admins" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."platform_admins" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."platform_admins" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."pod_checkin_attendance" TO "anon";
GRANT ALL ON TABLE "public"."pod_checkin_attendance" TO "authenticated";
GRANT ALL ON TABLE "public"."pod_checkin_attendance" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."pod_checkins" TO "anon";
GRANT ALL ON TABLE "public"."pod_checkins" TO "authenticated";
GRANT ALL ON TABLE "public"."pod_checkins" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."pod_goal_checkins" TO "anon";
GRANT ALL ON TABLE "public"."pod_goal_checkins" TO "authenticated";
GRANT ALL ON TABLE "public"."pod_goal_checkins" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."pod_goals" TO "anon";
GRANT ALL ON TABLE "public"."pod_goals" TO "authenticated";
GRANT ALL ON TABLE "public"."pod_goals" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."pod_members" TO "anon";
GRANT ALL ON TABLE "public"."pod_members" TO "authenticated";
GRANT ALL ON TABLE "public"."pod_members" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."pod_streaks" TO "anon";
GRANT ALL ON TABLE "public"."pod_streaks" TO "authenticated";
GRANT ALL ON TABLE "public"."pod_streaks" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profiles" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."profiles" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profiles" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."project_reviews" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."project_reviews" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."project_reviews" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."project_verification_events" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."project_verification_events" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."project_verification_events" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."project_verification_evidence" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."project_verification_evidence" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."project_verification_evidence" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."projects" TO "anon";
GRANT ALL ON TABLE "public"."projects" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."projects" TO "service_role";



GRANT SELECT,USAGE ON SEQUENCE "public"."projects_id_seq" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."resume_reviews" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."resume_reviews" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."resume_reviews" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."resume_versions" TO "anon";
GRANT ALL ON TABLE "public"."resume_versions" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."resume_versions" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."student_profiles" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."student_profiles" TO "authenticated";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."student_profiles" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."student_skills" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."student_skills" TO "authenticated";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."student_skills" TO "service_role";



GRANT SELECT,USAGE ON SEQUENCE "public"."student_skills_id_seq" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."student_topic_progress" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."student_topic_progress" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."student_topic_progress" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."subject_modules" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."subject_modules" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."subject_modules" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."subject_progress" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."subject_progress" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."subject_progress" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."syllabi" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."syllabi" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."syllabi" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."syllabus_schemes" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."syllabus_schemes" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."syllabus_schemes" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."syllabus_subjects" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."syllabus_subjects" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."syllabus_subjects" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."syllabus_uploads" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."syllabus_uploads" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."syllabus_uploads" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."universities" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."universities" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."universities" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "service_role";



































drop extension if exists "pg_net";

drop policy "Anyone can read DSA problem library" on "public"."dsa_problem_library";

revoke delete on table "public"."academic_programs" from "anon";

revoke insert on table "public"."academic_programs" from "anon";

revoke select on table "public"."academic_programs" from "anon";

revoke update on table "public"."academic_programs" from "anon";

revoke delete on table "public"."academic_programs" from "authenticated";

revoke insert on table "public"."academic_programs" from "authenticated";

revoke update on table "public"."academic_programs" from "authenticated";

revoke delete on table "public"."academic_programs" from "service_role";

revoke insert on table "public"."academic_programs" from "service_role";

revoke select on table "public"."academic_programs" from "service_role";

revoke update on table "public"."academic_programs" from "service_role";

revoke delete on table "public"."academic_schemes" from "anon";

revoke insert on table "public"."academic_schemes" from "anon";

revoke select on table "public"."academic_schemes" from "anon";

revoke update on table "public"."academic_schemes" from "anon";

revoke delete on table "public"."academic_schemes" from "authenticated";

revoke insert on table "public"."academic_schemes" from "authenticated";

revoke select on table "public"."academic_schemes" from "authenticated";

revoke update on table "public"."academic_schemes" from "authenticated";

revoke delete on table "public"."academic_schemes" from "service_role";

revoke insert on table "public"."academic_schemes" from "service_role";

revoke select on table "public"."academic_schemes" from "service_role";

revoke update on table "public"."academic_schemes" from "service_role";

revoke delete on table "public"."accountability_pods" from "anon";

revoke insert on table "public"."accountability_pods" from "anon";

revoke select on table "public"."accountability_pods" from "anon";

revoke update on table "public"."accountability_pods" from "anon";

revoke delete on table "public"."ai_interview_answers" from "anon";

revoke insert on table "public"."ai_interview_answers" from "anon";

revoke select on table "public"."ai_interview_answers" from "anon";

revoke update on table "public"."ai_interview_answers" from "anon";

revoke update on table "public"."ai_interview_answers" from "authenticated";

revoke delete on table "public"."ai_interview_answers" from "service_role";

revoke insert on table "public"."ai_interview_answers" from "service_role";

revoke select on table "public"."ai_interview_answers" from "service_role";

revoke update on table "public"."ai_interview_answers" from "service_role";

revoke delete on table "public"."ai_interview_sessions" from "anon";

revoke insert on table "public"."ai_interview_sessions" from "anon";

revoke select on table "public"."ai_interview_sessions" from "anon";

revoke update on table "public"."ai_interview_sessions" from "anon";

revoke delete on table "public"."ai_interview_sessions" from "service_role";

revoke insert on table "public"."ai_interview_sessions" from "service_role";

revoke select on table "public"."ai_interview_sessions" from "service_role";

revoke update on table "public"."ai_interview_sessions" from "service_role";

revoke delete on table "public"."ai_placement_plans" from "anon";

revoke insert on table "public"."ai_placement_plans" from "anon";

revoke select on table "public"."ai_placement_plans" from "anon";

revoke update on table "public"."ai_placement_plans" from "anon";

revoke delete on table "public"."ai_placement_plans" from "authenticated";

revoke update on table "public"."ai_placement_plans" from "authenticated";

revoke delete on table "public"."ai_placement_plans" from "service_role";

revoke insert on table "public"."ai_placement_plans" from "service_role";

revoke select on table "public"."ai_placement_plans" from "service_role";

revoke update on table "public"."ai_placement_plans" from "service_role";

revoke delete on table "public"."ai_roadmaps" from "anon";

revoke insert on table "public"."ai_roadmaps" from "anon";

revoke select on table "public"."ai_roadmaps" from "anon";

revoke update on table "public"."ai_roadmaps" from "anon";

revoke delete on table "public"."aptitude_attempts" from "anon";

revoke insert on table "public"."aptitude_attempts" from "anon";

revoke select on table "public"."aptitude_attempts" from "anon";

revoke update on table "public"."aptitude_attempts" from "anon";

revoke update on table "public"."aptitude_attempts" from "authenticated";

revoke delete on table "public"."aptitude_attempts" from "service_role";

revoke insert on table "public"."aptitude_attempts" from "service_role";

revoke select on table "public"."aptitude_attempts" from "service_role";

revoke update on table "public"."aptitude_attempts" from "service_role";

revoke delete on table "public"."aptitude_questions" from "anon";

revoke insert on table "public"."aptitude_questions" from "anon";

revoke select on table "public"."aptitude_questions" from "anon";

revoke update on table "public"."aptitude_questions" from "anon";

revoke delete on table "public"."aptitude_questions" from "authenticated";

revoke insert on table "public"."aptitude_questions" from "authenticated";

revoke update on table "public"."aptitude_questions" from "authenticated";

revoke delete on table "public"."aptitude_questions" from "service_role";

revoke insert on table "public"."aptitude_questions" from "service_role";

revoke select on table "public"."aptitude_questions" from "service_role";

revoke update on table "public"."aptitude_questions" from "service_role";

revoke delete on table "public"."branches" from "anon";

revoke insert on table "public"."branches" from "anon";

revoke select on table "public"."branches" from "anon";

revoke update on table "public"."branches" from "anon";

revoke delete on table "public"."branches" from "authenticated";

revoke insert on table "public"."branches" from "authenticated";

revoke select on table "public"."branches" from "authenticated";

revoke update on table "public"."branches" from "authenticated";

revoke delete on table "public"."branches" from "service_role";

revoke insert on table "public"."branches" from "service_role";

revoke select on table "public"."branches" from "service_role";

revoke update on table "public"."branches" from "service_role";

revoke delete on table "public"."campus_companies" from "anon";

revoke insert on table "public"."campus_companies" from "anon";

revoke select on table "public"."campus_companies" from "anon";

revoke update on table "public"."campus_companies" from "anon";

revoke delete on table "public"."campus_companies" from "authenticated";

revoke delete on table "public"."campus_companies" from "service_role";

revoke insert on table "public"."campus_companies" from "service_role";

revoke select on table "public"."campus_companies" from "service_role";

revoke update on table "public"."campus_companies" from "service_role";

revoke delete on table "public"."campus_company_visits" from "anon";

revoke insert on table "public"."campus_company_visits" from "anon";

revoke select on table "public"."campus_company_visits" from "anon";

revoke update on table "public"."campus_company_visits" from "anon";

revoke delete on table "public"."campus_company_visits" from "authenticated";

revoke delete on table "public"."campus_company_visits" from "service_role";

revoke insert on table "public"."campus_company_visits" from "service_role";

revoke select on table "public"."campus_company_visits" from "service_role";

revoke update on table "public"."campus_company_visits" from "service_role";

revoke delete on table "public"."campus_intel_submissions" from "anon";

revoke insert on table "public"."campus_intel_submissions" from "anon";

revoke select on table "public"."campus_intel_submissions" from "anon";

revoke update on table "public"."campus_intel_submissions" from "anon";

revoke delete on table "public"."campus_intel_submissions" from "authenticated";

revoke delete on table "public"."campus_intel_submissions" from "service_role";

revoke insert on table "public"."campus_intel_submissions" from "service_role";

revoke select on table "public"."campus_intel_submissions" from "service_role";

revoke update on table "public"."campus_intel_submissions" from "service_role";

revoke delete on table "public"."campus_interview_embeddings" from "anon";

revoke insert on table "public"."campus_interview_embeddings" from "anon";

revoke select on table "public"."campus_interview_embeddings" from "anon";

revoke update on table "public"."campus_interview_embeddings" from "anon";

revoke delete on table "public"."campus_interview_embeddings" from "authenticated";

revoke insert on table "public"."campus_interview_embeddings" from "authenticated";

revoke update on table "public"."campus_interview_embeddings" from "authenticated";

revoke delete on table "public"."campus_interview_questions" from "anon";

revoke insert on table "public"."campus_interview_questions" from "anon";

revoke select on table "public"."campus_interview_questions" from "anon";

revoke update on table "public"."campus_interview_questions" from "anon";

revoke delete on table "public"."campus_interview_questions" from "authenticated";

revoke update on table "public"."campus_interview_questions" from "authenticated";

revoke delete on table "public"."campus_interview_questions" from "service_role";

revoke insert on table "public"."campus_interview_questions" from "service_role";

revoke select on table "public"."campus_interview_questions" from "service_role";

revoke update on table "public"."campus_interview_questions" from "service_role";

revoke delete on table "public"."campus_interview_reports" from "anon";

revoke insert on table "public"."campus_interview_reports" from "anon";

revoke select on table "public"."campus_interview_reports" from "anon";

revoke update on table "public"."campus_interview_reports" from "anon";

revoke delete on table "public"."campus_interview_reports" from "authenticated";

revoke delete on table "public"."campus_interview_reports" from "service_role";

revoke insert on table "public"."campus_interview_reports" from "service_role";

revoke select on table "public"."campus_interview_reports" from "service_role";

revoke update on table "public"."campus_interview_reports" from "service_role";

revoke delete on table "public"."career_goals" from "anon";

revoke insert on table "public"."career_goals" from "anon";

revoke select on table "public"."career_goals" from "anon";

revoke update on table "public"."career_goals" from "anon";

revoke delete on table "public"."career_goals" from "authenticated";

revoke delete on table "public"."career_goals" from "service_role";

revoke insert on table "public"."career_goals" from "service_role";

revoke select on table "public"."career_goals" from "service_role";

revoke update on table "public"."career_goals" from "service_role";

revoke delete on table "public"."college_branches" from "anon";

revoke insert on table "public"."college_branches" from "anon";

revoke select on table "public"."college_branches" from "anon";

revoke update on table "public"."college_branches" from "anon";

revoke delete on table "public"."college_branches" from "authenticated";

revoke insert on table "public"."college_branches" from "authenticated";

revoke select on table "public"."college_branches" from "authenticated";

revoke update on table "public"."college_branches" from "authenticated";

revoke delete on table "public"."college_branches" from "service_role";

revoke insert on table "public"."college_branches" from "service_role";

revoke select on table "public"."college_branches" from "service_role";

revoke update on table "public"."college_branches" from "service_role";

revoke delete on table "public"."colleges" from "anon";

revoke insert on table "public"."colleges" from "anon";

revoke select on table "public"."colleges" from "anon";

revoke update on table "public"."colleges" from "anon";

revoke delete on table "public"."colleges" from "authenticated";

revoke insert on table "public"."colleges" from "authenticated";

revoke update on table "public"."colleges" from "authenticated";

revoke delete on table "public"."colleges" from "service_role";

revoke insert on table "public"."colleges" from "service_role";

revoke select on table "public"."colleges" from "service_role";

revoke update on table "public"."colleges" from "service_role";

revoke delete on table "public"."curriculum_subjects" from "anon";

revoke insert on table "public"."curriculum_subjects" from "anon";

revoke select on table "public"."curriculum_subjects" from "anon";

revoke update on table "public"."curriculum_subjects" from "anon";

revoke delete on table "public"."curriculum_subjects" from "authenticated";

revoke insert on table "public"."curriculum_subjects" from "authenticated";

revoke update on table "public"."curriculum_subjects" from "authenticated";

revoke delete on table "public"."curriculum_subjects" from "service_role";

revoke insert on table "public"."curriculum_subjects" from "service_role";

revoke select on table "public"."curriculum_subjects" from "service_role";

revoke update on table "public"."curriculum_subjects" from "service_role";

revoke delete on table "public"."dsa_problem_bank" from "anon";

revoke insert on table "public"."dsa_problem_bank" from "anon";

revoke select on table "public"."dsa_problem_bank" from "anon";

revoke update on table "public"."dsa_problem_bank" from "anon";

revoke delete on table "public"."dsa_problem_bank" from "authenticated";

revoke insert on table "public"."dsa_problem_bank" from "authenticated";

revoke select on table "public"."dsa_problem_bank" from "authenticated";

revoke update on table "public"."dsa_problem_bank" from "authenticated";

revoke delete on table "public"."dsa_problem_bank" from "service_role";

revoke insert on table "public"."dsa_problem_bank" from "service_role";

revoke select on table "public"."dsa_problem_bank" from "service_role";

revoke update on table "public"."dsa_problem_bank" from "service_role";

revoke delete on table "public"."dsa_problem_library" from "anon";

revoke insert on table "public"."dsa_problem_library" from "anon";

revoke update on table "public"."dsa_problem_library" from "anon";

revoke delete on table "public"."dsa_problem_library" from "authenticated";

revoke insert on table "public"."dsa_problem_library" from "authenticated";

revoke update on table "public"."dsa_problem_library" from "authenticated";

revoke delete on table "public"."dsa_problem_library" from "service_role";

revoke insert on table "public"."dsa_problem_library" from "service_role";

revoke select on table "public"."dsa_problem_library" from "service_role";

revoke update on table "public"."dsa_problem_library" from "service_role";

revoke delete on table "public"."dsa_problems" from "anon";

revoke insert on table "public"."dsa_problems" from "anon";

revoke select on table "public"."dsa_problems" from "anon";

revoke update on table "public"."dsa_problems" from "anon";

revoke update on table "public"."dsa_problems" from "authenticated";

revoke delete on table "public"."dsa_problems" from "service_role";

revoke insert on table "public"."dsa_problems" from "service_role";

revoke update on table "public"."dsa_problems" from "service_role";

revoke delete on table "public"."dsa_submissions" from "anon";

revoke insert on table "public"."dsa_submissions" from "anon";

revoke select on table "public"."dsa_submissions" from "anon";

revoke update on table "public"."dsa_submissions" from "anon";

revoke delete on table "public"."dsa_submissions" from "authenticated";

revoke insert on table "public"."dsa_submissions" from "authenticated";

revoke select on table "public"."dsa_submissions" from "authenticated";

revoke update on table "public"."dsa_submissions" from "authenticated";

revoke delete on table "public"."dsa_submissions" from "service_role";

revoke insert on table "public"."dsa_submissions" from "service_role";

revoke select on table "public"."dsa_submissions" from "service_role";

revoke update on table "public"."dsa_submissions" from "service_role";

revoke delete on table "public"."mentor_availability" from "anon";

revoke insert on table "public"."mentor_availability" from "anon";

revoke select on table "public"."mentor_availability" from "anon";

revoke update on table "public"."mentor_availability" from "anon";

revoke delete on table "public"."mentor_favorites" from "anon";

revoke insert on table "public"."mentor_favorites" from "anon";

revoke select on table "public"."mentor_favorites" from "anon";

revoke update on table "public"."mentor_favorites" from "anon";

revoke delete on table "public"."mentor_sessions" from "anon";

revoke insert on table "public"."mentor_sessions" from "anon";

revoke select on table "public"."mentor_sessions" from "anon";

revoke update on table "public"."mentor_sessions" from "anon";

revoke delete on table "public"."mentor_verifications" from "anon";

revoke insert on table "public"."mentor_verifications" from "anon";

revoke select on table "public"."mentor_verifications" from "anon";

revoke update on table "public"."mentor_verifications" from "anon";

revoke delete on table "public"."mentors" from "anon";

revoke insert on table "public"."mentors" from "anon";

revoke select on table "public"."mentors" from "anon";

revoke update on table "public"."mentors" from "anon";

revoke delete on table "public"."module_topics" from "anon";

revoke insert on table "public"."module_topics" from "anon";

revoke select on table "public"."module_topics" from "anon";

revoke update on table "public"."module_topics" from "anon";

revoke delete on table "public"."module_topics" from "authenticated";

revoke insert on table "public"."module_topics" from "authenticated";

revoke select on table "public"."module_topics" from "authenticated";

revoke update on table "public"."module_topics" from "authenticated";

revoke delete on table "public"."module_topics" from "service_role";

revoke insert on table "public"."module_topics" from "service_role";

revoke select on table "public"."module_topics" from "service_role";

revoke update on table "public"."module_topics" from "service_role";

revoke delete on table "public"."platform_admins" from "anon";

revoke insert on table "public"."platform_admins" from "anon";

revoke select on table "public"."platform_admins" from "anon";

revoke update on table "public"."platform_admins" from "anon";

revoke delete on table "public"."platform_admins" from "authenticated";

revoke insert on table "public"."platform_admins" from "authenticated";

revoke update on table "public"."platform_admins" from "authenticated";

revoke delete on table "public"."platform_admins" from "service_role";

revoke insert on table "public"."platform_admins" from "service_role";

revoke select on table "public"."platform_admins" from "service_role";

revoke update on table "public"."platform_admins" from "service_role";

revoke delete on table "public"."pod_checkin_attendance" from "anon";

revoke insert on table "public"."pod_checkin_attendance" from "anon";

revoke select on table "public"."pod_checkin_attendance" from "anon";

revoke update on table "public"."pod_checkin_attendance" from "anon";

revoke delete on table "public"."pod_checkins" from "anon";

revoke insert on table "public"."pod_checkins" from "anon";

revoke select on table "public"."pod_checkins" from "anon";

revoke update on table "public"."pod_checkins" from "anon";

revoke delete on table "public"."pod_goal_checkins" from "anon";

revoke insert on table "public"."pod_goal_checkins" from "anon";

revoke select on table "public"."pod_goal_checkins" from "anon";

revoke update on table "public"."pod_goal_checkins" from "anon";

revoke delete on table "public"."pod_goals" from "anon";

revoke insert on table "public"."pod_goals" from "anon";

revoke select on table "public"."pod_goals" from "anon";

revoke update on table "public"."pod_goals" from "anon";

revoke delete on table "public"."pod_members" from "anon";

revoke insert on table "public"."pod_members" from "anon";

revoke select on table "public"."pod_members" from "anon";

revoke update on table "public"."pod_members" from "anon";

revoke delete on table "public"."pod_streaks" from "anon";

revoke insert on table "public"."pod_streaks" from "anon";

revoke select on table "public"."pod_streaks" from "anon";

revoke update on table "public"."pod_streaks" from "anon";

revoke delete on table "public"."profiles" from "anon";

revoke insert on table "public"."profiles" from "anon";

revoke select on table "public"."profiles" from "anon";

revoke update on table "public"."profiles" from "anon";

revoke delete on table "public"."profiles" from "authenticated";

revoke delete on table "public"."profiles" from "service_role";

revoke insert on table "public"."profiles" from "service_role";

revoke select on table "public"."profiles" from "service_role";

revoke update on table "public"."profiles" from "service_role";

revoke delete on table "public"."project_reviews" from "anon";

revoke insert on table "public"."project_reviews" from "anon";

revoke select on table "public"."project_reviews" from "anon";

revoke update on table "public"."project_reviews" from "anon";

revoke delete on table "public"."project_reviews" from "authenticated";

revoke delete on table "public"."project_reviews" from "service_role";

revoke delete on table "public"."project_verification_events" from "anon";

revoke insert on table "public"."project_verification_events" from "anon";

revoke select on table "public"."project_verification_events" from "anon";

revoke update on table "public"."project_verification_events" from "anon";

revoke delete on table "public"."project_verification_events" from "authenticated";

revoke update on table "public"."project_verification_events" from "authenticated";

revoke delete on table "public"."project_verification_events" from "service_role";

revoke insert on table "public"."project_verification_events" from "service_role";

revoke select on table "public"."project_verification_events" from "service_role";

revoke update on table "public"."project_verification_events" from "service_role";

revoke delete on table "public"."project_verification_evidence" from "anon";

revoke insert on table "public"."project_verification_evidence" from "anon";

revoke select on table "public"."project_verification_evidence" from "anon";

revoke update on table "public"."project_verification_evidence" from "anon";

revoke delete on table "public"."project_verification_evidence" from "authenticated";

revoke delete on table "public"."project_verification_evidence" from "service_role";

revoke delete on table "public"."projects" from "anon";

revoke insert on table "public"."projects" from "anon";

revoke select on table "public"."projects" from "anon";

revoke update on table "public"."projects" from "anon";

revoke delete on table "public"."projects" from "service_role";

revoke delete on table "public"."resume_reviews" from "anon";

revoke insert on table "public"."resume_reviews" from "anon";

revoke select on table "public"."resume_reviews" from "anon";

revoke update on table "public"."resume_reviews" from "anon";

revoke delete on table "public"."resume_reviews" from "authenticated";

revoke update on table "public"."resume_reviews" from "authenticated";

revoke delete on table "public"."resume_reviews" from "service_role";

revoke insert on table "public"."resume_reviews" from "service_role";

revoke select on table "public"."resume_reviews" from "service_role";

revoke update on table "public"."resume_reviews" from "service_role";

revoke delete on table "public"."resume_versions" from "anon";

revoke insert on table "public"."resume_versions" from "anon";

revoke select on table "public"."resume_versions" from "anon";

revoke update on table "public"."resume_versions" from "anon";

revoke delete on table "public"."resume_versions" from "service_role";

revoke insert on table "public"."resume_versions" from "service_role";

revoke select on table "public"."resume_versions" from "service_role";

revoke update on table "public"."resume_versions" from "service_role";

revoke delete on table "public"."student_profiles" from "anon";

revoke insert on table "public"."student_profiles" from "anon";

revoke select on table "public"."student_profiles" from "anon";

revoke update on table "public"."student_profiles" from "anon";

revoke delete on table "public"."student_profiles" from "authenticated";

revoke delete on table "public"."student_profiles" from "service_role";

revoke insert on table "public"."student_profiles" from "service_role";

revoke update on table "public"."student_profiles" from "service_role";

revoke delete on table "public"."student_skills" from "anon";

revoke insert on table "public"."student_skills" from "anon";

revoke select on table "public"."student_skills" from "anon";

revoke update on table "public"."student_skills" from "anon";

revoke update on table "public"."student_skills" from "authenticated";

revoke delete on table "public"."student_skills" from "service_role";

revoke insert on table "public"."student_skills" from "service_role";

revoke update on table "public"."student_skills" from "service_role";

revoke delete on table "public"."student_topic_progress" from "anon";

revoke insert on table "public"."student_topic_progress" from "anon";

revoke select on table "public"."student_topic_progress" from "anon";

revoke update on table "public"."student_topic_progress" from "anon";

revoke delete on table "public"."student_topic_progress" from "authenticated";

revoke insert on table "public"."student_topic_progress" from "authenticated";

revoke select on table "public"."student_topic_progress" from "authenticated";

revoke update on table "public"."student_topic_progress" from "authenticated";

revoke delete on table "public"."student_topic_progress" from "service_role";

revoke insert on table "public"."student_topic_progress" from "service_role";

revoke select on table "public"."student_topic_progress" from "service_role";

revoke update on table "public"."student_topic_progress" from "service_role";

revoke delete on table "public"."subject_modules" from "anon";

revoke insert on table "public"."subject_modules" from "anon";

revoke select on table "public"."subject_modules" from "anon";

revoke update on table "public"."subject_modules" from "anon";

revoke delete on table "public"."subject_modules" from "authenticated";

revoke insert on table "public"."subject_modules" from "authenticated";

revoke select on table "public"."subject_modules" from "authenticated";

revoke update on table "public"."subject_modules" from "authenticated";

revoke delete on table "public"."subject_modules" from "service_role";

revoke insert on table "public"."subject_modules" from "service_role";

revoke select on table "public"."subject_modules" from "service_role";

revoke update on table "public"."subject_modules" from "service_role";

revoke delete on table "public"."subject_progress" from "anon";

revoke insert on table "public"."subject_progress" from "anon";

revoke select on table "public"."subject_progress" from "anon";

revoke update on table "public"."subject_progress" from "anon";

revoke delete on table "public"."subject_progress" from "authenticated";

revoke insert on table "public"."subject_progress" from "authenticated";

revoke select on table "public"."subject_progress" from "authenticated";

revoke update on table "public"."subject_progress" from "authenticated";

revoke delete on table "public"."subject_progress" from "service_role";

revoke insert on table "public"."subject_progress" from "service_role";

revoke select on table "public"."subject_progress" from "service_role";

revoke update on table "public"."subject_progress" from "service_role";

revoke delete on table "public"."syllabi" from "anon";

revoke insert on table "public"."syllabi" from "anon";

revoke select on table "public"."syllabi" from "anon";

revoke update on table "public"."syllabi" from "anon";

revoke delete on table "public"."syllabi" from "authenticated";

revoke insert on table "public"."syllabi" from "authenticated";

revoke update on table "public"."syllabi" from "authenticated";

revoke delete on table "public"."syllabi" from "service_role";

revoke insert on table "public"."syllabi" from "service_role";

revoke select on table "public"."syllabi" from "service_role";

revoke update on table "public"."syllabi" from "service_role";

revoke delete on table "public"."syllabus_schemes" from "anon";

revoke insert on table "public"."syllabus_schemes" from "anon";

revoke select on table "public"."syllabus_schemes" from "anon";

revoke update on table "public"."syllabus_schemes" from "anon";

revoke delete on table "public"."syllabus_schemes" from "authenticated";

revoke insert on table "public"."syllabus_schemes" from "authenticated";

revoke update on table "public"."syllabus_schemes" from "authenticated";

revoke delete on table "public"."syllabus_schemes" from "service_role";

revoke insert on table "public"."syllabus_schemes" from "service_role";

revoke select on table "public"."syllabus_schemes" from "service_role";

revoke update on table "public"."syllabus_schemes" from "service_role";

revoke delete on table "public"."syllabus_subjects" from "anon";

revoke insert on table "public"."syllabus_subjects" from "anon";

revoke select on table "public"."syllabus_subjects" from "anon";

revoke update on table "public"."syllabus_subjects" from "anon";

revoke delete on table "public"."syllabus_subjects" from "authenticated";

revoke insert on table "public"."syllabus_subjects" from "authenticated";

revoke update on table "public"."syllabus_subjects" from "authenticated";

revoke delete on table "public"."syllabus_subjects" from "service_role";

revoke insert on table "public"."syllabus_subjects" from "service_role";

revoke select on table "public"."syllabus_subjects" from "service_role";

revoke update on table "public"."syllabus_subjects" from "service_role";

revoke delete on table "public"."syllabus_uploads" from "anon";

revoke insert on table "public"."syllabus_uploads" from "anon";

revoke select on table "public"."syllabus_uploads" from "anon";

revoke update on table "public"."syllabus_uploads" from "anon";

revoke delete on table "public"."syllabus_uploads" from "authenticated";

revoke insert on table "public"."syllabus_uploads" from "authenticated";

revoke select on table "public"."syllabus_uploads" from "authenticated";

revoke update on table "public"."syllabus_uploads" from "authenticated";

revoke delete on table "public"."syllabus_uploads" from "service_role";

revoke insert on table "public"."syllabus_uploads" from "service_role";

revoke select on table "public"."syllabus_uploads" from "service_role";

revoke update on table "public"."syllabus_uploads" from "service_role";

revoke delete on table "public"."universities" from "anon";

revoke insert on table "public"."universities" from "anon";

revoke select on table "public"."universities" from "anon";

revoke update on table "public"."universities" from "anon";

revoke delete on table "public"."universities" from "authenticated";

revoke insert on table "public"."universities" from "authenticated";

revoke update on table "public"."universities" from "authenticated";

revoke delete on table "public"."universities" from "service_role";

revoke insert on table "public"."universities" from "service_role";

revoke select on table "public"."universities" from "service_role";

revoke update on table "public"."universities" from "service_role";


  create policy "Anyone can read DSA problem library"
  on "public"."dsa_problem_library"
  as permissive
  for select
  to anon, authenticated
using (true);
