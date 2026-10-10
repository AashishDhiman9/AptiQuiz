
CREATE TABLE public.participant_secrets (
  participant_id uuid PRIMARY KEY REFERENCES public.participants(id) ON DELETE CASCADE,
  token_hash text NOT NULL
);
GRANT ALL ON public.participant_secrets TO service_role;
ALTER TABLE public.participant_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participants ALTER COLUMN token_hash SET DEFAULT '';
UPDATE public.participants SET token_hash = '';
COMMENT ON COLUMN public.participants.token_hash IS 'DEPRECATED: replaced by participant_secrets';
