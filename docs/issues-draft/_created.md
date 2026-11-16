# Created Issues

Maps each filed draft to its GitHub issue. This file lets follow-up prompts
(for example, Wave labelling) work from real issue numbers instead of draft
numbers.

Pilot run: three Day 1 drafts (one trivial, one medium, one high), each with
`Depends on: None`.

| Draft | Title                                         | GitHub issue | URL                                                  | Labels applied                                                                           |
| ----- | --------------------------------------------- | ------------ | ---------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 001   | Use the Local Calendar Date for New Records   | #41          | https://github.com/AidTraceHQ/AidTraceLabs/issues/41 | area: frontend, type: bug, difficulty: trivial                                           |
| 008   | Add a Database Readiness Probe                | #42          | https://github.com/AidTraceHQ/AidTraceLabs/issues/42 | area: backend, area: infrastructure, type: enhancement, difficulty: medium               |
| 013   | Separate Runtime and Migration Database Roles | #43          | https://github.com/AidTraceHQ/AidTraceLabs/issues/43 | area: backend, area: security, area: infrastructure, type: enhancement, difficulty: high |

Note: `_index.md` does not record an area or type per draft, so the area and
type labels above were inferred from each draft's "Files to touch" and context.

- `001` — files `src/App.tsx`, `src/date.ts`, `tests/date.test.ts`; a defect that
  shows the wrong calendar day, so `area: frontend` and `type: bug`.
- `008` — files `server/app.ts`, `server/database-errors.ts`,
  `tests/backend.test.ts`, `docs/deployment.md`; a new readiness route for
  orchestrators, so `area: backend`, `area: infrastructure` and
  `type: enhancement`.
- `013` — files `server/environment.ts`, `server/db.ts`, `scripts/migrate.ts`,
  `scripts/seed-admin.ts`, `docs/deployment.md`, `tests/environment.test.ts`;
  least-privilege credential separation, so `area: backend`, `area: security`,
  `area: infrastructure` and `type: enhancement`.

## Day 1 batch

The remaining Day 1 drafts (every draft marked Day 1 in `_index.md` except the three
pilots 001, 008 and 013). Same rules as the pilots: title = the draft H1, body = the
draft without the H1 line, existing labels only, no Wave/Program label, no assignees and
no comments. No draft title collided with an existing issue, so nothing was skipped.

| Draft | Title                                                                          | GitHub issue | URL                                                  | Labels applied                                                             |
| ----- | ------------------------------------------------------------------------------ | ------------ | ---------------------------------------------------- | -------------------------------------------------------------------------- |
| 002   | Persist the Theme Choice                                                       | #44          | https://github.com/AidTraceHQ/AidTraceLabs/issues/44 | area: frontend, difficulty: trivial, type: enhancement                     |
| 003   | Prevent Older Toast Timers Clearing Newer Messages                             | #45          | https://github.com/AidTraceHQ/AidTraceLabs/issues/45 | area: frontend, difficulty: trivial, type: bug                             |
| 004   | Reconcile the Active Wallet Role                                               | #46          | https://github.com/AidTraceHQ/AidTraceLabs/issues/46 | area: frontend, difficulty: medium, type: bug                              |
| 005   | Let Organizations Set a Display Name                                           | #47          | https://github.com/AidTraceHQ/AidTraceLabs/issues/47 | area: backend, area: frontend, difficulty: medium, type: enhancement       |
| 006   | Add Filters to the Beneficiary Record View                                     | #48          | https://github.com/AidTraceHQ/AidTraceLabs/issues/48 | area: frontend, difficulty: medium, type: enhancement                      |
| 007   | Make Role Changes Traceable in the Audit View                                  | #49          | https://github.com/AidTraceHQ/AidTraceLabs/issues/49 | area: backend, area: frontend, difficulty: medium, type: enhancement       |
| 009   | Audit Security-Relevant Rejections                                             | #50          | https://github.com/AidTraceHQ/AidTraceLabs/issues/50 | area: backend, area: security, difficulty: medium, type: enhancement       |
| 010   | Clean Up Expired Authentication and Rate-Limit Rows                            | #51          | https://github.com/AidTraceHQ/AidTraceLabs/issues/51 | area: backend, area: infrastructure, difficulty: medium, type: enhancement |
| 011   | Prevent Removing the Last Active Administrator                                 | #52          | https://github.com/AidTraceHQ/AidTraceLabs/issues/52 | area: backend, area: security, difficulty: medium, type: enhancement       |
| 012   | Share Per-IP Rate Limits Across Serverless Instances                           | #53          | https://github.com/AidTraceHQ/AidTraceLabs/issues/53 | area: backend, area: infrastructure, difficulty: high, type: enhancement   |
| 014   | Document and Verify PostgreSQL Network Restrictions                            | #54          | https://github.com/AidTraceHQ/AidTraceLabs/issues/54 | area: docs, area: infrastructure, difficulty: medium, type: documentation  |
| 015   | Require Explicit Target Confirmation for Admin Seeding                         | #55          | https://github.com/AidTraceHQ/AidTraceLabs/issues/55 | area: backend, area: infrastructure, difficulty: medium, type: enhancement |
| 027   | Make Record Creation Retry-Safe After Commit                                   | #56          | https://github.com/AidTraceHQ/AidTraceLabs/issues/56 | area: backend, difficulty: high, type: enhancement                         |
| 031   | Reject Reuse of Session and Pseudonym Secrets                                  | #57          | https://github.com/AidTraceHQ/AidTraceLabs/issues/57 | area: backend, area: security, difficulty: trivial, type: enhancement      |
| 034   | Enforce Hash and Asset-Issuer Invariants in PostgreSQL                         | #58          | https://github.com/AidTraceHQ/AidTraceLabs/issues/58 | area: backend, difficulty: medium, type: enhancement                       |
| 036   | Default New Records to the Selected Network                                    | #59          | https://github.com/AidTraceHQ/AidTraceLabs/issues/59 | area: frontend, difficulty: trivial, type: bug                             |
| 046   | Route Admin Role Mutations Through the Shared Transaction Helper               | #60          | https://github.com/AidTraceHQ/AidTraceLabs/issues/60 | area: backend, difficulty: medium, type: enhancement                       |
| 047   | Handle Unhandled Rejections and Uncaught Exceptions                            | #61          | https://github.com/AidTraceHQ/AidTraceLabs/issues/61 | area: backend, difficulty: medium, type: enhancement                       |
| 049   | Broaden Transient Database Error Classification                                | #62          | https://github.com/AidTraceHQ/AidTraceLabs/issues/62 | area: backend, difficulty: medium, type: enhancement                       |
| 051   | Bound the Total Duration of a Verification Request                             | #63          | https://github.com/AidTraceHQ/AidTraceLabs/issues/63 | area: backend, difficulty: medium, type: enhancement                       |
| 056   | Bound How Long a Request Waits for a Pooled Database Client                    | #64          | https://github.com/AidTraceHQ/AidTraceLabs/issues/64 | area: backend, difficulty: medium, type: enhancement                       |
| 060   | Test Forged Wallet Signatures and Challenge Mismatches                         | #65          | https://github.com/AidTraceHQ/AidTraceLabs/issues/65 | area: security, area: testing, difficulty: medium, type: enhancement       |
| 067   | Test Audit Events for Every Successful Mutation                                | #66          | https://github.com/AidTraceHQ/AidTraceLabs/issues/66 | area: backend, area: testing, difficulty: high, type: enhancement          |
| 073   | Capture and Surface the Transaction Memo for Reconciliation                    | #67          | https://github.com/AidTraceHQ/AidTraceLabs/issues/67 | area: backend, area: frontend, difficulty: high, type: enhancement         |
| 077   | Add an index for the admin roles list ordering                                 | #68          | https://github.com/AidTraceHQ/AidTraceLabs/issues/68 | area: backend, difficulty: trivial, type: enhancement                      |
| 082   | Add a Schema Drift Test for the Documented Data Model                          | #69          | https://github.com/AidTraceHQ/AidTraceLabs/issues/69 | area: backend, area: testing, difficulty: medium, type: enhancement        |
| 083   | Clamp the Ledger Page Number When the Filtered Result Set Shrinks              | #70          | https://github.com/AidTraceHQ/AidTraceLabs/issues/70 | area: frontend, difficulty: medium, type: bug                              |
| 084   | Show Empty and Error States for the Wallet-Activity Table                      | #71          | https://github.com/AidTraceHQ/AidTraceLabs/issues/71 | area: frontend, difficulty: medium, type: enhancement                      |
| 088   | Add a Single-Record Endpoint and Stop Refetching the Ledger to Refresh One Row | #72          | https://github.com/AidTraceHQ/AidTraceLabs/issues/72 | area: backend, area: frontend, difficulty: high, type: enhancement         |
| 089   | Return a Bounded Total So the Ledger Can Page Without Loading Every Record     | #73          | https://github.com/AidTraceHQ/AidTraceLabs/issues/73 | area: backend, area: frontend, difficulty: high, type: enhancement         |
| 103   | Trap and Restore Focus in the Record and Disbursement Dialogs                  | #74          | https://github.com/AidTraceHQ/AidTraceLabs/issues/74 | accessibility, area: frontend, difficulty: medium, type: enhancement       |
| 104   | Add Table Semantics and Keyboard Scrolling to the Data Tables                  | #75          | https://github.com/AidTraceHQ/AidTraceLabs/issues/75 | accessibility, area: frontend, difficulty: medium, type: enhancement       |
| 115   | Measure and Enforce Test Coverage in CI                                        | #76          | https://github.com/AidTraceHQ/AidTraceLabs/issues/76 | area: infrastructure, area: testing, difficulty: medium, type: enhancement |
| 116   | Serve Hashed Static Assets With Long-Lived Cache Headers                       | #77          | https://github.com/AidTraceHQ/AidTraceLabs/issues/77 | area: infrastructure, difficulty: medium, type: enhancement                |
| 120   | Replace Millisecond-Timestamp Concurrency With a Version Column                | #78          | https://github.com/AidTraceHQ/AidTraceLabs/issues/78 | area: backend, difficulty: high, type: bug                                 |
| 121   | Cap and Report Active Sessions per Wallet                                      | #79          | https://github.com/AidTraceHQ/AidTraceLabs/issues/79 | area: backend, area: security, difficulty: medium, type: enhancement       |
| 122   | Add a Migration Status and Dry-Run Report                                      | #80          | https://github.com/AidTraceHQ/AidTraceLabs/issues/80 | area: backend, area: infrastructure, difficulty: medium, type: enhancement |

Inference rules used (same as the pilots). `area:` comes from the draft's
"Files to touch": `src/*` → `area: frontend`; `server/*`, `migrations/*`, `scripts/*` →
`area: backend`; `docs/*` only → `area: docs`; CI/deploy/build files →
`area: infrastructure`; test-only files → `area: testing`; auth, secret or privacy
surfaces additionally get `area: security`; the dialog/table accessibility drafts also
get `accessibility`. `difficulty:` is the draft's `**Complexity:**` value.

- `type: bug` — the draft fixes incorrect current behavior: 003 (toast timer race), 004
  (stale role after a role change), 036 (form network not tracking the selected network),
  083 (page number not clamped), 120 (millisecond-timestamp lost update).
- `type: documentation` — 014, a docs-only runbook with no behavior change.
- `type: enhancement` — every other draft (new capability, guard, endpoint, refactor, or
  test coverage). The repo has no `type: testing` label, so the test-only drafts 060, 067
  and 082 carry `area: testing` with `type: enhancement`.
- Only existing repo labels were used. No draft received the `Stellar Wave` or any other
  Wave/Program label, and no draft had a title that already existed as an issue.
