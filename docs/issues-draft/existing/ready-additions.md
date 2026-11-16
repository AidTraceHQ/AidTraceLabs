# Wave-ready additions: missing sections

The seven Wave-ready issues (`#11`, `#12`, `#14`, `#15`, `#17`, `#22`, `#23`) already carry
`**Complexity:**`, `## Context`, `## Acceptance criteria`, `## Files to touch` and
`## Test expectations`. The only sections they are missing are `## Out of scope` and
`## Depends on`. Each block below contains exactly those two sections, ready to append to the
issue body. Nothing here has been pushed to GitHub yet — this file is for review first.

### #11 — Testnet Context Banner

## Out of scope

Removing or disabling the mainnet option; changing record data, verification, or network
semantics; any server-side change; changing the stored network-preference format.

## Depends on

None

### #12 — CSV Export Tests

## Out of scope

Changing the CSV export UI or adding new export formats; changing which fields are withheld
from an export; any server-side change.

## Depends on

None

### #14 — Record Receipt Export

## Out of scope

Server-side PDF generation or new endpoints; changing verification logic or the public
projection; including session tokens or withheld wallet/beneficiary fields in the output.

## Depends on

None

### #15 — Admin Audit Viewer Filters

## Out of scope

Changing admin authorization or the audit API's access rules; adding new audit event types;
changing pagination or cursor semantics.

## Depends on

None

### #17 — Multi-Operation Transaction Coverage

## Out of scope

Combining fields across operations to force a match; counting non-payment operation types
without a documented decision; changing the verification cache TTL.

## Depends on

None

### #22 — Cursor Pagination UI

## Out of scope

Changing the server pagination contract or cursor signing; changing the default page size;
removing the existing collect-all-pages helper where it is still used.

## Depends on

None

### #23 — Accessibility Pass

## Out of scope

Visual redesign or branding changes; changing authorization behaviour; a full WCAG
conformance claim or third-party audit.

## Depends on

None
