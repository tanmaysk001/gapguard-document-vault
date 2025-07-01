CREATE TYPE public.rule_status AS ENUM ('active', 'suggested', 'archived');

ALTER TABLE public.document_rules
ADD COLUMN status public.rule_status NOT NULL DEFAULT 'active';

ALTER TABLE public.document_rules
ADD COLUMN reason TEXT;

COMMENT ON COLUMN public.document_rules.status IS 'The status of the rule (e.g., active, suggested by AI, archived).';
COMMENT ON COLUMN public.document_rules.reason IS 'The reasoning provided by the AI for suggesting this rule.';
