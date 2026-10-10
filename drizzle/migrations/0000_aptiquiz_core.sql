
CREATE TABLE public.colleges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  short_name text NOT NULL,
  city text NOT NULL DEFAULT ''
);
GRANT SELECT ON public.colleges TO anon, authenticated;
GRANT ALL ON public.colleges TO service_role;
ALTER TABLE public.colleges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "colleges readable" ON public.colleges FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT 'Player',
  college_id uuid REFERENCES public.colleges(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1), 'Player'))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.question_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  is_sample boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.question_sets TO authenticated;
GRANT SELECT ON public.question_sets TO anon;
GRANT ALL ON public.question_sets TO service_role;
ALTER TABLE public.question_sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sets read own or sample" ON public.question_sets FOR SELECT TO anon, authenticated USING (is_sample OR owner_id = auth.uid());
CREATE POLICY "sets insert own" ON public.question_sets FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid() AND is_sample = false);
CREATE POLICY "sets update own" ON public.question_sets FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid() AND is_sample = false);
CREATE POLICY "sets delete own" ON public.question_sets FOR DELETE TO authenticated USING (owner_id = auth.uid());

CREATE TABLE public.questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id uuid NOT NULL REFERENCES public.question_sets(id) ON DELETE CASCADE,
  position int NOT NULL DEFAULT 0,
  text text NOT NULL,
  options jsonb NOT NULL,
  topic text NOT NULL CHECK (topic IN ('quant','logical','verbal','di')),
  difficulty text NOT NULL CHECK (difficulty IN ('easy','medium','hard')),
  time_limit_sec int NOT NULL DEFAULT 20 CHECK (time_limit_sec BETWEEN 5 AND 120),
  explanation text NOT NULL DEFAULT '',
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.questions TO authenticated;
GRANT SELECT ON public.questions TO anon;
GRANT ALL ON public.questions TO service_role;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.owns_set(_set uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.question_sets WHERE id=_set AND owner_id=auth.uid())
$$;
CREATE OR REPLACE FUNCTION public.is_sample_set(_set uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.question_sets WHERE id=_set AND is_sample)
$$;
CREATE POLICY "questions read" ON public.questions FOR SELECT TO anon, authenticated USING (public.is_sample_set(set_id) OR public.owns_set(set_id));
CREATE POLICY "questions write" ON public.questions FOR INSERT TO authenticated WITH CHECK (public.owns_set(set_id));
CREATE POLICY "questions update" ON public.questions FOR UPDATE TO authenticated USING (public.owns_set(set_id));
CREATE POLICY "questions delete" ON public.questions FOR DELETE TO authenticated USING (public.owns_set(set_id));

-- private answer keys: only the set owner can read/write, never players
CREATE TABLE public.question_keys (
  question_id uuid PRIMARY KEY REFERENCES public.questions(id) ON DELETE CASCADE,
  correct_index int NOT NULL
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.question_keys TO authenticated;
GRANT ALL ON public.question_keys TO service_role;
ALTER TABLE public.question_keys ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.owns_question(_q uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.questions q JOIN public.question_sets s ON s.id=q.set_id WHERE q.id=_q AND s.owner_id=auth.uid())
$$;
CREATE POLICY "keys owner all" ON public.question_keys FOR ALL TO authenticated USING (public.owns_question(question_id)) WITH CHECK (public.owns_question(question_id));

CREATE TABLE public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  host_id uuid,
  set_id uuid REFERENCES public.question_sets(id) ON DELETE SET NULL,
  name text NOT NULL,
  quiz_title text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'lobby' CHECK (status IN ('lobby','countdown','question','reveal','finished')),
  current_index int NOT NULL DEFAULT -1,
  total_questions int NOT NULL DEFAULT 0,
  phase_started_at timestamptz,
  phase_ends_at timestamptz,
  question_duration_ms int NOT NULL DEFAULT 0,
  current_question jsonb,
  reveal jsonb,
  answered_count int NOT NULL DEFAULT 0,
  max_players int NOT NULL DEFAULT 50,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
GRANT SELECT ON public.rooms TO anon, authenticated;
GRANT ALL ON public.rooms TO service_role;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rooms public read" ON public.rooms FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id uuid,
  display_name text NOT NULL,
  college_id uuid REFERENCES public.colleges(id),
  token_hash text NOT NULL,
  score int NOT NULL DEFAULT 0,
  correct_count int NOT NULL DEFAULT 0,
  answered_count int NOT NULL DEFAULT 0,
  total_time_ms bigint NOT NULL DEFAULT 0,
  rank int,
  prev_rank int,
  last_seen timestamptz NOT NULL DEFAULT now(),
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, display_name)
);
GRANT SELECT (id, room_id, user_id, display_name, college_id, score, correct_count, answered_count, total_time_ms, rank, prev_rank, last_seen, joined_at) ON public.participants TO anon, authenticated;
GRANT ALL ON public.participants TO service_role;
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "participants public read" ON public.participants FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  user_id uuid,
  question_id uuid,
  question_index int NOT NULL,
  choice_index int,
  correct boolean NOT NULL DEFAULT false,
  elapsed_ms int NOT NULL DEFAULT 0,
  points int NOT NULL DEFAULT 0,
  topic text NOT NULL,
  difficulty text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (participant_id, question_index)
);
GRANT SELECT ON public.answers TO authenticated;
GRANT ALL ON public.answers TO service_role;
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own answers read" ON public.answers FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE INDEX ON public.participants(room_id);
CREATE INDEX ON public.answers(room_id, question_index);
CREATE INDEX ON public.answers(user_id);
CREATE INDEX ON public.questions(set_id, position);

ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.participants;

-- SEED (demonstration data)
INSERT INTO public.colleges (id, name, short_name, city) VALUES
('11111111-0000-0000-0000-000000000001','NIET Greater Noida','NIET','Greater Noida'),
('11111111-0000-0000-0000-000000000002','Delhi Technological University','DTU','Delhi'),
('11111111-0000-0000-0000-000000000003','Jamia Millia Islamia','JMI','Delhi'),
('11111111-0000-0000-0000-000000000004','Aligarh Muslim University','AMU','Aligarh'),
('11111111-0000-0000-0000-000000000005','VIT Vellore','VIT','Vellore'),
('11111111-0000-0000-0000-000000000006','IIIT Hyderabad','IIITH','Hyderabad');

INSERT INTO public.question_sets (id, owner_id, title, description, status, is_sample) VALUES
('22222222-0000-0000-0000-000000000001', NULL, 'Placement Warm-up (Sample)', 'A mixed 10-question demo set across all four aptitude topics.', 'published', true);

INSERT INTO public.questions (id, set_id, position, text, options, topic, difficulty, time_limit_sec, explanation) VALUES
('33333333-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000001',0,'If 3x + 5 = 20, what is the value of x?','["3","5","7","10"]','quant','easy',20,'3x = 15, so x = 5.'),
('33333333-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000001',1,'A train 120 m long passes a pole in 6 seconds. What is its speed in km/h?','["60","72","80","90"]','quant','medium',25,'Speed = 120/6 = 20 m/s = 20 × 18/5 = 72 km/h.'),
('33333333-0000-0000-0000-000000000003','22222222-0000-0000-0000-000000000001',2,'Find the next number: 2, 6, 12, 20, 30, ?','["40","42","44","36"]','logical','easy',20,'Differences are 4, 6, 8, 10, 12 → 30 + 12 = 42.'),
('33333333-0000-0000-0000-000000000004','22222222-0000-0000-0000-000000000001',3,'All roses are flowers. Some flowers fade quickly. Which conclusion definitely follows?','["All roses fade quickly","Some roses fade quickly","No rose fades quickly","None of these"]','logical','medium',25,'Nothing links roses to the flowers that fade, so no conclusion follows.'),
('33333333-0000-0000-0000-000000000005','22222222-0000-0000-0000-000000000001',4,'Choose the synonym of "BENEVOLENT".','["Cruel","Kind","Lazy","Proud"]','verbal','easy',15,'Benevolent means well-meaning and kind.'),
('33333333-0000-0000-0000-000000000006','22222222-0000-0000-0000-000000000001',5,'Pick the correctly spelled word.','["Accomodate","Acommodate","Accommodate","Acomodate"]','verbal','medium',15,'Accommodate has a double c and a double m.'),
('33333333-0000-0000-0000-000000000007','22222222-0000-0000-0000-000000000001',6,'Sales: Jan 40, Feb 50, Mar 60, Apr 50 (units). What is the average monthly sales?','["45","50","55","52.5"]','di','easy',20,'(40+50+60+50)/4 = 200/4 = 50.'),
('33333333-0000-0000-0000-000000000008','22222222-0000-0000-0000-000000000001',7,'Using the same data (Jan 40 → Mar 60), what is the percentage growth from Jan to Mar?','["20%","33%","50%","60%"]','di','medium',20,'(60−40)/40 × 100 = 50%.'),
('33333333-0000-0000-0000-000000000009','22222222-0000-0000-0000-000000000001',8,'A can finish a job in 12 days and B in 6 days. Together, how many days?','["3","4","6","9"]','quant','hard',30,'1/12 + 1/6 = 3/12 = 1/4 → 4 days.'),
('33333333-0000-0000-0000-000000000010','22222222-0000-0000-0000-000000000001',9,'If CAT is coded as DBU, how is DOG coded?','["EPH","EPG","DPH","FQI"]','logical','hard',25,'Each letter shifts +1: D→E, O→P, G→H.');

INSERT INTO public.question_keys (question_id, correct_index) VALUES
('33333333-0000-0000-0000-000000000001',1),('33333333-0000-0000-0000-000000000002',1),
('33333333-0000-0000-0000-000000000003',1),('33333333-0000-0000-0000-000000000004',3),
('33333333-0000-0000-0000-000000000005',1),('33333333-0000-0000-0000-000000000006',2),
('33333333-0000-0000-0000-000000000007',1),('33333333-0000-0000-0000-000000000008',2),
('33333333-0000-0000-0000-000000000009',1),('33333333-0000-0000-0000-000000000010',0);

-- Demo finished match (clearly labeled demo)
INSERT INTO public.rooms (id, code, name, quiz_title, status, current_index, total_questions, is_demo, finished_at)
VALUES ('44444444-0000-0000-0000-000000000001','DEMO01','Demo Inter-College Showdown','Placement Warm-up (Sample)','finished',9,10,true, now() - interval '2 days');

INSERT INTO public.participants (room_id, display_name, college_id, token_hash, score, correct_count, answered_count, total_time_ms, rank, prev_rank) VALUES
('44444444-0000-0000-0000-000000000001','Apex_Designer','11111111-0000-0000-0000-000000000002','demo',12850,10,10,61000,1,1),
('44444444-0000-0000-0000-000000000001','Creative_Guru','11111111-0000-0000-0000-000000000001','demo',11920,9,10,70000,2,3),
('44444444-0000-0000-0000-000000000001','Pixel_Prodigy','11111111-0000-0000-0000-000000000003','demo',11400,9,10,82000,3,2),
('44444444-0000-0000-0000-000000000001','UIUX_Innovator','11111111-0000-0000-0000-000000000001','demo',10480,8,10,74000,4,6),
('44444444-0000-0000-0000-000000000001','CodeMaster','11111111-0000-0000-0000-000000000005','demo',9870,8,9,90000,5,4),
('44444444-0000-0000-0000-000000000001','Logic_Lord','11111111-0000-0000-0000-000000000004','demo',9120,7,10,85000,6,5),
('44444444-0000-0000-0000-000000000001','BrainyBee','11111111-0000-0000-0000-000000000002','demo',8340,7,9,99000,7,7),
('44444444-0000-0000-0000-000000000001','Data_Driven','11111111-0000-0000-0000-000000000006','demo',7650,6,10,101000,8,8),
('44444444-0000-0000-0000-000000000001','QuizWhiz','11111111-0000-0000-0000-000000000003','demo',6900,6,8,95000,9,9),
('44444444-0000-0000-0000-000000000001','MathNinja','11111111-0000-0000-0000-000000000005','demo',5800,5,9,110000,10,10);
