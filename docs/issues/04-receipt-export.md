# Record Receipt Export

**Complexity:** medium

## Context

Organizations may need a portable receipt for a saved aid record. The receipt must distinguish entered record data from independently checked Stellar fields.

## Acceptance criteria

- Add a print-friendly or downloadable receipt for an authorized record view.
- Label user-entered and Horizon-derived values distinctly.
- Respect record permissions and beneficiary consent projection.
- Include network, verification state, and a plain-language limitation notice.

## Files to touch

- `src/App.tsx`
- `src/fullstack.css`
- `tests/` for the export formatting behavior

## Test expectations

- Cover consent-off data, mismatch status, missing transaction hash, and formatting.
- Verify no session token or hidden wallet data enters the output.
- Run `npm run check`.
