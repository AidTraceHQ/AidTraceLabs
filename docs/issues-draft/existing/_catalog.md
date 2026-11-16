# Existing Issue Catalogue (AidTraceHQ/AidTraceLabs)

Read-only audit of every issue in the repository. Source: `gh issue list --state all`
plus `gh issue view N --comments`, cross-checked against all pull requests and the
current `origin/main` tree. No issue or pull request was edited, closed, labelled or
commented on.

## Counts

| Group                             | Count |
| --------------------------------- | ----- |
| Total issues (all states)         | 18    |
| Wave-ready                        | 7     |
| Needs rewriting                   | 8     |
| Keep out of Wave                  | 3     |
| Closed / done                     | 0     |
| Resolved by a merged pull request | 0     |

All 18 issues (`#11`–`#28`) are **OPEN**. The repository has 22 pull requests: 10 merged
and 12 closed, and none of them references or closes any of `#11`–`#28`. The merged
feature PRs (`#30` Vercel demo, `#34` live-demo docs, `#29` line-ending policy, `#10`
mismatch details) predate these issues and do not resolve them.

## Catalogue

| #   | Title                                                  | State | Labels                                                                                  | Complexity | Summary                                                                 | Resolved by merged PR | Draft overlap                                   |
| --- | ------------------------------------------------------ | ----- | --------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------- | --------------------- | ----------------------------------------------- |
| 11  | Testnet Context Banner                                 | OPEN  | good first issue, area: frontend, difficulty: trivial, type: enhancement, Stellar Wave  | trivial    | Persistent accessible indicator when testnet is selected                | No                    | 036, 087 (distinct)                             |
| 12  | CSV Export Tests                                       | OPEN  | area: frontend, area: testing, difficulty: medium, type: enhancement                    | medium     | Regression coverage for CSV escaping, filtering, privacy                | No                    | 093/096/097 (overlap, narrowed), 094 (distinct) |
| 13  | Public Verification Page                               | OPEN  | area: frontend, area: backend, difficulty: high, type: enhancement                      | high       | Shareable read-only single-record view with the public projection       | No                    | none                                            |
| 14  | Record Receipt Export                                  | OPEN  | area: frontend, difficulty: medium, type: enhancement                                   | medium     | Print/download receipt distinguishing entered vs Horizon-checked fields | No                    | none                                            |
| 15  | Admin Audit Viewer Filters                             | OPEN  | area: frontend, area: backend, difficulty: medium, type: enhancement                    | medium     | Direct address and record-ID filters on the audit view                  | No                    | none                                            |
| 16  | Dashboard Totals                                       | OPEN  | area: frontend, difficulty: medium, type: enhancement                                   | medium     | Grouped totals by asset and status using active filters                 | No                    | none                                            |
| 17  | Multi-Operation Transaction Coverage                   | OPEN  | area: backend, difficulty: high, type: enhancement                                      | high       | Document and expand payment matching across operations                  | No                    | 033, 071 (distinct)                             |
| 18  | Scheduled Re-Verification                              | OPEN  | area: backend, area: infrastructure, difficulty: high, type: enhancement                | high       | Bounded background job to refresh stale verifications                   | No                    | 023, 051, 070 (distinct)                        |
| 19  | Beneficiary Wallet Acknowledgment                      | OPEN  | area: backend, area: security, difficulty: high, type: enhancement                      | high       | Wallet-signed consent evidence with versioning/expiry/revocation        | No                    | none                                            |
| 20  | Webhook or Email Alerts                                | OPEN  | area: backend, area: infrastructure, difficulty: high, type: enhancement                | high       | Opt-in outbound notification delivery                                   | No                    | none                                            |
| 21  | Playwright End-to-End Tests                            | OPEN  | area: testing, area: infrastructure, difficulty: high, type: enhancement                | high       | Browser coverage with a mocked Freighter provider                       | No                    | 021, 044 (distinct)                             |
| 22  | Cursor Pagination UI                                   | OPEN  | area: frontend, difficulty: medium, type: enhancement, Stellar Wave                     | medium     | Explicit next-page loading for ledger and admin lists                   | No                    | 042, 081, 083, 088, 089, 092, 099               |
| 23  | Accessibility Pass                                     | OPEN  | area: frontend, difficulty: medium, type: enhancement, Stellar Wave                     | medium     | Keyboard/assistive-tech audit across core flows                         | No                    | 103–112 (overlap, sub-tasks)                    |
| 24  | Internationalization Groundwork                        | OPEN  | area: frontend, difficulty: medium, type: enhancement                                   | medium     | Message keys and locale-aware formatting foundation                     | No                    | none                                            |
| 25  | Deferred: TypeScript 7 major upgrade                   | OPEN  | area: infrastructure, difficulty: high, type: enhancement                               | high       | Hand-performed TS 7 + tooling upgrade                                   | No                    | 045 (distinct)                                  |
| 26  | Deferred: Vite 8 major upgrade                         | OPEN  | area: infrastructure, difficulty: high, type: enhancement, Stellar Wave                 | high       | Hand-performed Vite 8 + React plugin upgrade                            | No                    | none                                            |
| 27  | Deferred: Tailwind CSS 4 major upgrade                 | OPEN  | area: frontend, area: infrastructure, difficulty: high, type: enhancement, Stellar Wave | high       | Hand-performed Tailwind 4 / PostCSS migration                           | No                    | none                                            |
| 28  | Design: re-entering a payment after a record is voided | OPEN  | area: backend, difficulty: medium, type: enhancement, Stellar Wave                      | medium     | Decide and document re-entry behaviour after a mistaken void            | No                    | none                                            |

## Wave-ready (7)

`#11`, `#12`, `#14`, `#15`, `#17`, `#22`, `#23`.

Section check requested in the task: **all 7 already carry `**Complexity:**`, `## Context`,
`## Acceptance criteria`, `## Files to touch` and `## Test expectations`, and all 7 are
**missing `## Out of scope` and `## Depends on`**. No other section is missing.

## Needs rewriting (8)

`#13`, `#16`, `#18`, `#19`, `#20`, `#21`, `#24`, `#28` — rewrites written to this folder.

## Keep out of Wave (3)

`#25` (TypeScript 7), `#26` (Vite 8), `#27` (Tailwind CSS 4) — hand-performed,
semver-major dependency migrations that require a coordinated tooling bump. Not touched
by this task.

## Closed / done (0)

None. Every issue in the repository is open.

## Unexpected findings

1. **External Wave enquiry on the Testnet Context Banner (`#11`).** The only comment on
   any issue is from `@flyflarre1` (a contributor, PNLEE Studio) on `#11`, asking whether
   `#11` is included in "Stellar Wave 11 (18–25 November)" before they apply via Drips.
   It is an unanswered Wave/Program question and is unrelated to the issue's body. No
   reply was posted (read-only).
2. **Dashboard Totals (`#16`) is already substantially implemented.** The transparency
   handler returns `summary.byStatus` (`transparencyHandler`, `server/records.ts:692`;
   SQL at `server/records.ts:704`; typed at `src/api.ts:20`) and the UI renders a totals
   tile in the `.summary-grid` (`src/App.tsx:1125`, fed by `ledgerTotals` at
   `src/App.tsx:200` and `verifiedTotals`/`otherStatusTotals` at `src/App.tsx:862`). Only
   the labelling/breakdown delta remains, so this issue is a candidate for **closing or
   narrowing**, not a fresh build.
3. **Design-first issue (`#28`).** "Design: re-entering a payment after a record is
   voided" is not directly implementable: it requires a documented decision (options A/B/C
   in its body) before any code. It should stay gated on that decision.
4. **No closed issues, no off-topic or duplicate issues.** All 18 are legitimate and
   unique; there is nothing stale or unexpected beyond the above.

## Complexity wording

The repository's difficulty labels are `difficulty: trivial`, `difficulty: medium` and
`difficulty: high`. This catalogue and the rewrites use those exact words and invent no
new label.
