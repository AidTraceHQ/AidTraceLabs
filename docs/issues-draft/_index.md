# Backlog Draft Index

Maps every draft to its title, complexity and release day. Replace the numbers in the first column
with the real GitHub issue numbers after the drafts are filed. Draft titles are the source
for the cross-references written into each draft (references use titles, not numbers).

| Draft | Title                                                                          | Complexity | Release day    |
| ----- | ------------------------------------------------------------------------------ | ---------- | -------------- |
| 001   | Use the Local Calendar Date for New Records                                    | Trivial    | Day 1          |
| 002   | Persist the Theme Choice                                                       | Trivial    | Day 1          |
| 003   | Prevent Older Toast Timers Clearing Newer Messages                             | Trivial    | Day 1          |
| 004   | Reconcile the Active Wallet Role                                               | Medium     | Day 1          |
| 005   | Let Organizations Set a Display Name                                           | Medium     | Day 1          |
| 006   | Add Filters to the Beneficiary Record View                                     | Medium     | Day 1          |
| 007   | Make Role Changes Traceable in the Audit View                                  | Medium     | Day 1          |
| 008   | Add a Database Readiness Probe                                                 | Medium     | Day 1          |
| 009   | Audit Security-Relevant Rejections                                             | Medium     | Day 1          |
| 010   | Clean Up Expired Authentication and Rate-Limit Rows                            | Medium     | Day 1          |
| 011   | Prevent Removing the Last Active Administrator                                 | Medium     | Day 1          |
| 012   | Share Per-IP Rate Limits Across Serverless Instances                           | High       | Day 1          |
| 013   | Separate Runtime and Migration Database Roles                                  | High       | Day 1          |
| 014   | Document and Verify PostgreSQL Network Restrictions                            | Medium     | Day 1          |
| 015   | Require Explicit Target Confirmation for Admin Seeding                         | Medium     | Day 1          |
| 016   | Serialize Concurrent Migration Runs                                            | Medium     | Day 3          |
| 017   | Define Security Headers for API and Static Responses                           | Medium     | Day 3          |
| 018   | Use Configured Horizon Endpoints in Browser Activity                           | Medium     | Day 3          |
| 019   | Bound the Account Activity Request Lifecycle                                   | Medium     | Day 3          |
| 020   | Restore Ledger Filters from the URL                                            | Medium     | Day 3          |
| 021   | Add an HTTP Smoke Check for a Deployed Demo URL                                | Medium     | Day 3          |
| 022   | Add Correlated, Redacted API Error Logs                                        | Medium     | Day 3          |
| 023   | Show the Last Verification Check Time                                          | Medium     | Day 3          |
| 024   | Enforce Append-Only Audit Access                                               | High       | Day 3          |
| 025   | Document and Exercise Database Backup Restoration                              | Medium     | Day 3          |
| 026   | Reconcile General and Demo Deployment Status                                   | Medium     | Legacy backlog |
| 027   | Make Record Creation Retry-Safe After Commit                                   | High       | Day 1          |
| 028   | Preserve the Original Error When Transaction Rollback Fails                    | Medium     | Day 3          |
| 029   | Bound the Local Server Graceful Shutdown                                       | Medium     | Day 2          |
| 030   | Apply One Transient Retry to Remaining Safe Read Routes                        | Medium     | Day 2          |
| 031   | Reject Reuse of Session and Pseudonym Secrets                                  | Trivial    | Day 1          |
| 032   | Validate CORS Configuration as Canonical Origins                               | Medium     | Day 3          |
| 033   | Lock Down Horizon Failure-State Contracts                                      | Medium     | Day 3          |
| 034   | Enforce Hash and Asset-Issuer Invariants in PostgreSQL                         | Medium     | Day 1          |
| 035   | Detect Changes to Applied Migration Files                                      | Medium     | Day 2          |
| 036   | Default New Records to the Selected Network                                    | Trivial    | Day 1          |
| 037   | Separate Activity Search from Ledger Search                                    | Medium     | Day 3          |
| 038   | Prevent Record-Form Changes During Submission                                  | Medium     | Day 4          |
| 039   | Validate Reversed Date-Filter Ranges                                           | Medium     | Day 4          |
| 040   | Bound Browser API Request Time                                                 | Medium     | Day 4          |
| 041   | Avoid Recomputing Ledger Aggregates for Every Cursor Page                      | High       | Day 2          |
| 042   | Load Older Horizon Wallet Activity Pages                                       | High       | Day 2          |
| 043   | Add Concrete API Contract Examples                                             | Medium     | Day 4          |
| 044   | Stabilize the Serverless Handler Import Test in the Full Suite                 | Medium     | Day 5          |
| 045   | Test the Hosted Node 22 Runtime in CI                                          | Medium     | Day 5          |
| 046   | Route Admin Role Mutations Through the Shared Transaction Helper               | Medium     | Day 1          |
| 047   | Handle Unhandled Rejections and Uncaught Exceptions                            | Medium     | Day 1          |
| 048   | Configure Explicit HTTP Server Timeouts                                        | Medium     | Day 3          |
| 049   | Broaden Transient Database Error Classification                                | Medium     | Day 1          |
| 050   | Return 4xx for Unsupported Request Encodings                                   | Trivial    | Day 4          |
| 051   | Bound the Total Duration of a Verification Request                             | Medium     | Day 1          |
| 052   | Add Timeouts to the Migration Pool                                             | Medium     | Day 3          |
| 053   | Bound Idle Transactions Held by the Pool                                       | Medium     | Day 2          |
| 054   | Abort Server-Side Horizon and Database Work When the Client Disconnects        | High       | Day 2          |
| 055   | Centralize Database Error-to-Response Mapping                                  | High       | Day 2          |
| 056   | Bound How Long a Request Waits for a Pooled Database Client                    | Medium     | Day 1          |
| 057   | Handle idle database-client errors on the connection pool                      | Medium     | Day 2          |
| 058   | Reject the Example Placeholder Session Secret at Startup                       | Medium     | Day 2          |
| 059   | Test CSRF Rejection on Every Mutating Route                                    | High       | Day 2          |
| 060   | Test Forged Wallet Signatures and Challenge Mismatches                         | Medium     | Day 1          |
| 061   | Test Expired Session Rejection                                                 | Medium     | Day 4          |
| 062   | Test Logout-Everywhere Revokes All Wallet Sessions                             | Medium     | Day 3          |
| 063   | Test Database-Backed Per-Address Rate Limits                                   | High       | Day 2          |
| 064   | Test Record Input Validation and Amount Bounds                                 | Medium     | Day 3          |
| 065   | Test Filter Input Handling and Control-Character Stripping                     | Medium     | Day 3          |
| 066   | Test Request Body Size and Malformed-JSON Handling                             | Trivial    | Day 4          |
| 067   | Test Audit Events for Every Successful Mutation                                | High       | Day 1          |
| 068   | Test the Authorization Matrix for Every Protected Route                        | High       | Day 2          |
| 069   | Test Pagination Cursor Integrity and Bounds                                    | High       | Day 2          |
| 070   | Cache Negative Verification Outcomes to Stop Repeat Horizon Lookups            | Medium     | Day 3          |
| 071   | Support Muxed-Account (M-Address) Aid Recipients                               | High       | Day 2          |
| 072   | Bound Horizon Verification With Bounded Retries and a Total Deadline           | High       | Day 2          |
| 073   | Capture and Surface the Transaction Memo for Reconciliation                    | High       | Day 1          |
| 074   | Assert Mainnet Horizon and Explorer Selection in Verification                  | Trivial    | Day 4          |
| 075   | Align and Bound Operation-Amount Parsing With Record Amounts                   | Medium     | Day 3          |
| 076   | Bound the Horizon Response Size Before Parsing                                 | Medium     | Day 4          |
| 077   | Add an index for the admin roles list ordering                                 | Trivial    | Day 1          |
| 078   | Reject unrecognized and non-sequential migration files                         | Medium     | Day 2          |
| 079   | Populate structured metadata on audit events                                   | Medium     | Day 3          |
| 080   | Record and index session last-seen activity                                    | Medium     | Day 4          |
| 081   | Align filtered record pagination with an ordering index                        | Medium     | Day 3          |
| 082   | Add a schema drift test for the documented data model                          | Medium     | Day 1          |
| 083   | Clamp the ledger page number when the filtered result set shrinks              | Medium     | Day 1          |
| 084   | Show empty and error states for the wallet-activity table                      | Medium     | Day 1          |
| 085   | Warn before discarding unsaved record-form input                               | Medium     | Day 4          |
| 086   | Add a retry action to the ledger load error                                    | Trivial    | Day 4          |
| 087   | Re-validate or warn when the network is switched with an active session        | Medium     | Day 3          |
| 088   | Add a single-record endpoint and stop refetching the ledger to refresh one row | High       | Day 1          |
| 089   | Return a bounded total so the ledger can page without loading every record     | High       | Day 1          |
| 090   | Format record amounts consistently                                             | Trivial    | Day 5          |
| 091   | Coalesce the ledger reloads triggered by a single mutation                     | Medium     | Day 3          |
| 092   | Sort the ledger on the server and bind cursors to the sort                     | High       | Day 2          |
| 093   | Guard the CSV export against spreadsheet formula injection                     | Medium     | Day 3          |
| 095   | Add an admin audit-log CSV export                                              | High       | Day 2          |
| 096   | Include verification status, reason and last-checked time in the CSV export    | Medium     | Day 4          |
| 097   | Export a beneficiary's own records as CSV                                      | Medium     | Day 4          |
| 098   | Document the API error and status-code contract                                | Medium     | Day 5          |
| 099   | Document the cursor pagination contract and its limits                         | Medium     | Day 5          |
| 100   | Pin and verify the Node runtime                                                | Medium     | Day 3          |
| 101   | Log request duration and status for the API                                    | Medium     | Day 2          |
| 102   | Log a startup configuration summary without secrets                            | Trivial    | Day 5          |
| 103   | Trap and Restore Focus in the Record and Disbursement Dialogs                  | Medium     | Day 1          |
| 104   | Add Table Semantics and Keyboard Scrolling to the Data Tables                  | Medium     | Day 1          |
| 105   | Associate Record-Form Validation Errors with Their Fields                      | Medium     | Day 2          |
| 108   | Announce Activity Stream and Verification Status Changes                       | Medium     | Day 3          |
| 109   | Enlarge Touch Targets for Compact Controls                                     | Medium     | Day 4          |
| 111   | Add a Favicon and Declare the Supported Color Scheme                           | Trivial    | Day 3          |
| 112   | Add a Skip-to-Content Link for Keyboard Users                                  | Trivial    | Day 3          |
| 113   | Cancel Superseded CI Runs With a Concurrency Group                             | Trivial    | Day 5          |
| 114   | Make Docker Compose and the `.env` Bootstrap Agree                             | Medium     | Day 5          |
| 115   | Measure and Enforce Test Coverage in CI                                        | Medium     | Day 1          |
| 116   | Serve Hashed Static Assets With Long-Lived Cache Headers                       | Medium     | Day 1          |
| 117   | Align the Rate-Limit Response With the Documented Error Contract               | Medium     | Day 2          |
| 118   | Adopt Type-Aware ESLint to Catch Floating Promises                             | High       | Day 2          |
| 119   | Wrap the Application in an Error Boundary With a Recoverable Fallback          | Medium     | Day 2          |
| 120   | Replace Millisecond-Timestamp Concurrency With a Version Column                | High       | Day 1          |
| 121   | Cap and Report Active Sessions per Wallet                                      | Medium     | Day 1          |
| 122   | Add a Migration Status and Dry-Run Report                                      | Medium     | Day 1          |
