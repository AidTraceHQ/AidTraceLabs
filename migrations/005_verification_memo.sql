-- Capture-only Stellar transaction memo evidence (issue #67). The memo never affects matching.
ALTER TABLE verification_results ADD COLUMN IF NOT EXISTS memo TEXT;
ALTER TABLE verification_results ADD COLUMN IF NOT EXISTS memo_type TEXT;

ALTER TABLE verification_results DROP CONSTRAINT IF EXISTS verification_results_memo_type_check;
ALTER TABLE verification_results
  ADD CONSTRAINT verification_results_memo_type_check
  CHECK (memo_type IS NULL OR memo_type IN ('text', 'id', 'hash', 'return'));

ALTER TABLE verification_results DROP CONSTRAINT IF EXISTS verification_results_memo_pair_check;
ALTER TABLE verification_results
  ADD CONSTRAINT verification_results_memo_pair_check
  CHECK ((memo IS NULL) = (memo_type IS NULL));
