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
