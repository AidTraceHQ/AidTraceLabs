# Multi-Operation Transaction Coverage

**Complexity:** high

## Context

Verification accepts a transaction when one payment-like operation fully matches the record; it does not combine fields across operations. Expand coverage and make the supported semantics explicit for multi-operation transactions.

## Acceptance criteria

- Document which operation types count as eligible payments and why.
- Keep all matched fields tied to one operation; never combine unrelated operations to create a match.
- Define behavior for repeated matching payments, unrelated operations, and incomplete operation pagination.
- Keep incomplete reads pending rather than reporting a final mismatch.

## Files to touch

- `server/stellar-verification.ts`
- `tests/backend.test.ts`
- `docs/security.md` or `docs/architecture.md`

## Test expectations

- Cover multiple eligible operations, split-field near-matches, unrelated operations, and page-bound behavior with Horizon mocks.
- Run `npm run check`.
