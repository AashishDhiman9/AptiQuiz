-- Profiles already exist in 0000_aptiquiz_core. New accounts remain players by default.
ALTER TABLE public.profiles
  ADD COLUMN role text NOT NULL DEFAULT 'player'
  CHECK (role IN ('player', 'host'));

-- Keep profile edits limited to display preferences. role is only changed by a trusted
-- database administrator after reviewing a Host request.
REVOKE INSERT, UPDATE ON public.profiles FROM authenticated;
GRANT INSERT (id, display_name, college_id) ON public.profiles TO authenticated;
GRANT UPDATE (display_name, college_id) ON public.profiles TO authenticated;
DROP POLICY IF EXISTS "own profile update" ON public.profiles;
CREATE POLICY "own profile update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE TABLE public.host_requests (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);
ALTER TABLE public.host_requests ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.host_requests TO authenticated;
GRANT INSERT (user_id) ON public.host_requests TO authenticated;
CREATE POLICY "users read own host request" ON public.host_requests
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users create own host request" ON public.host_requests
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
GRANT ALL ON public.host_requests TO service_role;

CREATE OR REPLACE FUNCTION public.is_current_user_host()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid()) AND role = 'host'
  )
$$;
REVOKE ALL ON FUNCTION public.is_current_user_host() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_current_user_host() TO authenticated;

-- A Host may author only their own sets. Existing sample sets stay publicly readable.
DROP POLICY IF EXISTS "sets insert own" ON public.question_sets;
DROP POLICY IF EXISTS "sets update own" ON public.question_sets;
DROP POLICY IF EXISTS "sets delete own" ON public.question_sets;
CREATE POLICY "hosts insert own sets" ON public.question_sets
  FOR INSERT TO authenticated
  WITH CHECK (public.is_current_user_host() AND owner_id = auth.uid() AND is_sample = false);
CREATE POLICY "hosts update own sets" ON public.question_sets
  FOR UPDATE TO authenticated
  USING (public.is_current_user_host() AND owner_id = auth.uid())
  WITH CHECK (public.is_current_user_host() AND owner_id = auth.uid() AND is_sample = false);
CREATE POLICY "hosts delete own sets" ON public.question_sets
  FOR DELETE TO authenticated
  USING (public.is_current_user_host() AND owner_id = auth.uid());

DROP POLICY IF EXISTS "questions write" ON public.questions;
DROP POLICY IF EXISTS "questions update" ON public.questions;
DROP POLICY IF EXISTS "questions delete" ON public.questions;
CREATE POLICY "hosts write questions" ON public.questions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_current_user_host() AND public.owns_set(set_id));
CREATE POLICY "hosts update questions" ON public.questions
  FOR UPDATE TO authenticated
  USING (public.is_current_user_host() AND public.owns_set(set_id))
  WITH CHECK (public.is_current_user_host() AND public.owns_set(set_id));
CREATE POLICY "hosts delete questions" ON public.questions
  FOR DELETE TO authenticated
  USING (public.is_current_user_host() AND public.owns_set(set_id));

DROP POLICY IF EXISTS "keys owner all" ON public.question_keys;
CREATE OR REPLACE FUNCTION public.is_sample_question(_question uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.questions AS q
    JOIN public.question_sets AS s ON s.id = q.set_id
    WHERE q.id = _question AND s.is_sample
  )
$$;
REVOKE ALL ON FUNCTION public.is_sample_question(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_sample_question(uuid) TO authenticated;

CREATE POLICY "hosts read own or sample answer keys" ON public.question_keys
  FOR SELECT TO authenticated
  USING (
    public.is_current_user_host()
    AND (public.owns_question(question_id) OR public.is_sample_question(question_id))
  );
CREATE POLICY "hosts create own answer keys" ON public.question_keys
  FOR INSERT TO authenticated
  WITH CHECK (public.is_current_user_host() AND public.owns_question(question_id));
CREATE POLICY "hosts update own answer keys" ON public.question_keys
  FOR UPDATE TO authenticated
  USING (public.is_current_user_host() AND public.owns_question(question_id))
  WITH CHECK (public.is_current_user_host() AND public.owns_question(question_id));
CREATE POLICY "hosts delete own answer keys" ON public.question_keys
  FOR DELETE TO authenticated
  USING (public.is_current_user_host() AND public.owns_question(question_id));

NOTIFY pgrst, 'reload schema';
