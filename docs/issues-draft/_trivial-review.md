# Trivial Issues and Drafts Review

Audit of every GitHub issue and draft specification labeled or categorized as `trivial` (`difficulty: trivial` / `Complexity: trivial`).

Each item is evaluated to distinguish between:

1. **Real, independently useful changes**: Changes that solve genuine defects, address security/concurrency edge cases, or add meaningful test/observability coverage with real learning value.
2. **Low-effort items**: Cosmetic adjustments (such as color tweaks, single-line CSS adjustments, or isolated attribute additions) that offer minimal learning or impact as standalone issues.

## Summary

| Classification                                   | Count                                                                       |
| :----------------------------------------------- | :-------------------------------------------------------------------------- |
| **Total items reviewed**                         | **20**                                                                      |
| - Open GitHub issues                             | 7 (#11, #41, #44, #45, #57, #59, #68)                                       |
| - Unfiled drafts                                 | 13 (Drafts 050, 066, 074, 086, 090, 094, 102, 106, 107, 110, 111, 112, 113) |
| **Judgement: Real, independently useful change** | **16**                                                                      |
| **Judgement: Low-effort item**                   | **4** (Drafts 094, 106, 107, 110)                                           |
| **Recommendation: Keep**                         | **16**                                                                      |
| **Recommendation: Merge into other issue**       | **4** (094 → #12; 106, 107, 110 → #23)                                      |
| **Recommendation: Drop**                         | **0**                                                                       |

---

## Catalogue and Recommendations

| Number              | Title                                                                         | Judgement                         | Recommendation     | One-Line Reason                                                                                                                        |
| :------------------ | :---------------------------------------------------------------------------- | :-------------------------------- | :----------------- | :------------------------------------------------------------------------------------------------------------------------------------- |
| **#11**             | Testnet Context Banner                                                        | Real, independently useful change | **keep**           | Essential visual safeguard that prevents confusing testnet activity with real aid disbursements and includes network transition tests. |
| **#41** (Draft 001) | Use the Local Calendar Date for New Records                                   | Real, independently useful change | **keep**           | Resolves a timezone-offset defect where new record dates shift ±1 day for international users, backed by vitest coverage.              |
| **#44** (Draft 002) | Persist the Theme Choice                                                      | Real, independently useful change | **keep**           | Implements theme persistence via browser storage with safe fallbacks and unit tests matching project patterns.                         |
| **#45** (Draft 003) | Prevent Older Toast Timers Clearing Newer Messages                            | Real, independently useful change | **keep**           | Solves an asynchronous UI race condition and unmount memory leak using fake-timer test assertions.                                     |
| **#57** (Draft 031) | Reject Reuse of Session and Pseudonym Secrets                                 | Real, independently useful change | **keep**           | Enforces critical cryptographic separation between session management and beneficiary pseudonymization at server startup.              |
| **#59** (Draft 036) | Default New Records to the Selected Network                                   | Real, independently useful change | **keep**           | Corrects state desynchronization between top-level network switching and the new record creation form.                                 |
| **#68** (Draft 077) | Add an index for the admin roles list ordering                                | Real, independently useful change | **keep**           | Adds a targeted database migration and composite B-tree index optimizing admin roles list queries.                                     |
| **Draft 050**       | Return 4xx for Unsupported Request Encodings                                  | Real, independently useful change | **keep**           | Replaces unhandled 500 crashes with standard 415 HTTP client responses for unsupported body-parser charsets.                           |
| **Draft 066**       | Test Request Body Size and Malformed-JSON Handling                            | Real, independently useful change | **keep**           | Closes a security regression testing gap by asserting 413 payload-too-large rejection on express JSON routes.                          |
| **Draft 074**       | Assert Mainnet Horizon and Explorer Selection in Verification                 | Real, independently useful change | **keep**           | Hardens the Horizon URL and block explorer routing contract with explicit unit test coverage.                                          |
| **Draft 086**       | Add a Retry Action to the Ledger Load Error                                   | Real, independently useful change | **keep**           | Enables seamless error recovery by adding a retry handler directly to the ledger error display.                                        |
| **Draft 090**       | Format Record Amounts Consistently                                            | Real, independently useful change | **keep**           | Standardizes number formatting across tables and detail views with unit tests covering large and fractional amounts.                   |
| **Draft 094**       | Add a UTF-8 BOM to the Exported CSV So Excel Renders Non-ASCII Text Correctly | Low-effort item                   | **merge into #12** | A single-line string prepend (`\uFEFF`) that fits naturally into #12 (CSV Export Tests) regression coverage.                           |
| **Draft 102**       | Log a Startup Configuration Summary Without Secrets                           | Real, independently useful change | **keep**           | Provides safe operational observability at server startup by printing a sanitized configuration summary.                               |
| **Draft 106**       | Respect prefers-reduced-motion for the Skeleton Shimmer and Smooth Scroll     | Low-effort item                   | **merge into #23** | Narrow CSS/JS motion media query adjustment that is best resolved as part of issue #23 (Accessibility Pass).                           |
| **Draft 107**       | Raise the Contrast of Muted Secondary Text                                    | Low-effort item                   | **merge into #23** | A single hex token tweak in CSS with minimal complexity that belongs inside issue #23 (Accessibility Pass).                            |
| **Draft 110**       | Indicate the Active Section in the Tab Bar                                    | Low-effort item                   | **merge into #23** | A minor `aria-current="page"` attribute addition that should be bundled into issue #23 (Accessibility Pass).                           |
| **Draft 111**       | Add a Favicon and Declare the Supported Color Scheme                          | Real, independently useful change | **keep**           | Eliminates continuous 404 console errors for `/favicon.ico` while declaring native browser color scheme support.                       |
| **Draft 112**       | Add a Skip-to-Content Link for Keyboard Users                                 | Real, independently useful change | **keep**           | Implements WCAG 2.4.1 bypass block functionality with dedicated DOM structure, keyboard focus management, and CSS.                     |
| **Draft 113**       | Cancel Superseded CI Runs With a Concurrency Group                            | Real, independently useful change | **keep**           | High-impact workflow enhancement that prevents wasted GitHub Actions runner minutes by canceling outdated branch runs.                 |

---

## Detailed Assessment

### 1. Open Issues in GitHub

#### #11: Testnet Context Banner

- **Context:** Testnet is default, but mainnet is allowed. Users can mistake mock disbursements for live blockchain records without a persistent badge.
- **Evaluation:** Touches UI banner, styling, and preference listeners. Provides genuine clarity for auditors and reviewers.
- **Decision:** **keep**.

#### #41 (Draft 001): Use the Local Calendar Date for New Records

- **Context:** Date input defaults to `new Date().toISOString().slice(0, 10)`, causing users in non-UTC offsets to create records with the wrong day.
- **Evaluation:** Genuine logic bug in date handling requiring unit tests simulating multiple timezone offsets.
- **Decision:** **keep**.

#### #44 (Draft 002): Persist the Theme Choice

- **Context:** Theme toggle is in-memory only and resets on reload.
- **Evaluation:** Requires resilient localStorage abstraction with graceful degradation for privacy/restricted browsing modes.
- **Decision:** **keep**.

#### #45 (Draft 003): Prevent Older Toast Timers Clearing Newer Messages

- **Context:** Rapid toasts cause timer conflicts where an earlier toast's timer dismisses a newer message.
- **Evaluation:** Real async timer collision and unmount memory leak bug requiring Vitest fake-timer verification.
- **Decision:** **keep**.

#### #57 (Draft 031): Reject Reuse of Session and Pseudonym Secrets

- **Context:** `validateEnvironment` only checked lengths, permitting reuse of the same secret for both sessions and pseudonym hashes.
- **Evaluation:** Important security hardening enforcing cryptographic domain separation.
- **Decision:** **keep**.

#### #59 (Draft 036): Default New Records to the Selected Network

- **Context:** Record creation modal doesn't synchronize when switching between testnet and mainnet.
- **Evaluation:** Solves form state synchronization bug and prevents unintentional cross-network submissions.
- **Decision:** **keep**.

#### #68 (Draft 077): Add an index for the admin roles list ordering

- **Context:** `GET /api/admin/roles` orders by `(updated_at DESC, wallet_address DESC)` without a backing composite index.
- **Evaluation:** Creates a clean database migration, adds an index, and verifies schema query plans.
- **Decision:** **keep**.

---

### 2. Unfiled Drafts

#### Draft 050: Return 4xx for Unsupported Request Encodings

- **Context:** Body parser unhandled encoding errors crash to 500 instead of 415.
- **Evaluation:** Improves HTTP API specification compliance and client error diagnosis.
- **Decision:** **keep**.

#### Draft 066: Test Request Body Size and Malformed-JSON Handling

- **Context:** 32 KB payload limit is configured but lacked negative test coverage for 413 responses.
- **Evaluation:** Solid security regression test coverage for API Denial of Service bounds.
- **Decision:** **keep**.

#### Draft 074: Assert Mainnet Horizon and Explorer Selection in Verification

- **Context:** Verifies that verification endpoints select correct Horizon servers and block explorer links per network.
- **Evaluation:** Prevents network confusion and broken external links during mainnet verifications.
- **Decision:** **keep**.

#### Draft 086: Add a Retry Action to the Ledger Load Error

- **Context:** Failed ledger fetches display an error with only a Dismiss button, forcing a full page reload.
- **Evaluation:** Improves UX resiliency by adding in-place retry capabilities.
- **Decision:** **keep**.

#### Draft 090: Format Record Amounts Consistently

- **Context:** Some tables display formatted numbers while others print raw unformatted floats.
- **Evaluation:** Extracts a reusable numeric formatter with unit test coverage for edge cases.
- **Decision:** **keep**.

#### Draft 094: Add a UTF-8 BOM to the Exported CSV So Excel Renders Non-ASCII Text Correctly

- **Context:** Excel for Windows defaults to ANSI unless a UTF-8 BOM (`\uFEFF`) is present.
- **Evaluation:** The change is a one-line string prepend (`'\uFEFF' + content`). As an independent issue, it is a five-minute edit with minimal learning; however, it fits perfectly as part of the broader CSV test suite in #12.
- **Decision:** **merge into #12**.

#### Draft 102: Log a Startup Configuration Summary Without Secrets

- **Context:** Server starts without outputting active configuration flags or origin counts.
- **Evaluation:** Safe operational observability feature that redacts secrets while logging config health.
- **Decision:** **keep**.

#### Draft 106: Respect prefers-reduced-motion for the Skeleton Shimmer and Smooth Scroll

- **Context:** Loading skeleton animation and scroll behaviors ignore accessibility motion preferences.
- **Evaluation:** Isolated CSS/JS media query tweak. Narrow in scope, naturally belongs in the repository's open Accessibility Pass.
- **Decision:** **merge into #23**.

#### Draft 107: Raise the Contrast of Muted Secondary Text

- **Context:** `--muted` text token is `#7d8493` on `#fff` (3.75:1), below WCAG AA 4.5:1.
- **Evaluation:** A single CSS hex code adjustment. A classic low-effort color tweak that should be consolidated with the general accessibility audit.
- **Decision:** **merge into #23**.

#### Draft 110: Indicate the Active Section in the Tab Bar

- **Context:** Active navigation tab relies only on `.active` CSS class without `aria-current="page"`.
- **Evaluation:** Adding a single ARIA attribute to a button element is too low-effort as a standalone task.
- **Decision:** **merge into #23**.

#### Draft 111: Add a Favicon and Declare the Supported Color Scheme

- **Context:** Missing favicon generates 404 network errors; missing `color-scheme` meta tag breaks browser native form styling in dark mode.
- **Evaluation:** Fixes 404 noise in browser consoles and resolves native browser UI rendering issues.
- **Decision:** **keep**.

#### Draft 112: Add a Skip-to-Content Link for Keyboard Users

- **Context:** Keyboard and screen-reader users must tab through top navigation bars on every view.
- **Evaluation:** While accessibility-related, implementing an accessible skip link involves distinct DOM positioning, focus management, CSS visibility states, and WCAG 2.4.1 compliance.
- **Decision:** **keep**.

#### Draft 113: Cancel Superseded CI Runs With a Concurrency Group

- **Context:** Successive pushes to pull requests run redundant full CI pipelines in parallel.
- **Evaluation:** Substantially cuts down shared GitHub Actions usage and developer turnaround time.
- **Decision:** **keep**.
