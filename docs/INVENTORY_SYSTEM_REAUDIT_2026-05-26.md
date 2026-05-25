# Inventory System Re-Audit - 2026-05-26

This re-audit reviews the codebase after the planned hardening phases were completed. It is based on local code review and the latest regression pass only. No external security scan or production probing was performed.

## Executive Summary

The system is in better demo shape than the previous audit. The planned hardening list is marked complete, and the latest local checks passed:

- `npm run test -w apps/api`: 9 suites, 36 tests passed.
- `npm run api:build`: passed.
- `npm run web:build`: passed, with the existing `auth-gate.tsx` hook dependency warning.
- `git diff --check`: passed.

The most important remaining issue is location scoping on list endpoints. Detail endpoints were improved, but list endpoints still commonly return all locations when `locationId` is omitted. This is a data exposure risk for branch-level users and should be fixed before wider client testing.

## Patch Status

The following findings were patched immediately after this re-audit:

- High: list endpoint location scoping now defaults to the signed-in user's allowed locations for inventory, purchasing, branch operations, transfers, and menu pricing.
- High: ledger event detail now receives the signed-in user and checks event location access.
- Medium: public password reset placeholder endpoints were removed.
- Medium: Redis rate limiting now increments and applies TTL through one Redis script.

The remaining items were patched in a second pass:

- Medium: refresh tokens now use an HttpOnly API cookie, and access tokens are kept in session storage instead of `localStorage`.
- Low: report run locations are now stored in a queryable `scopeLocationIds` column so report run lists can be filtered in the database.

## Findings

### High - List endpoints can expose cross-location data when `locationId` is omitted

Status: Patched after this re-audit.

The `LocationAccessGuard` treats a missing query value as an empty list of locations to check, so it allows the request. Several services then use `undefined` or `{}` location filters, returning all records.

Evidence:

- `apps/api/src/rbac/guards/location-access.guard.ts:36-40` checks extracted IDs only.
- `apps/api/src/rbac/guards/location-access.guard.ts:45-50` returns `[]` for a missing query value.
- `apps/api/src/ledger/ledger.controller.ts:46-64` applies `@LocationAccess` to query `locationId`, but does not require it.
- `apps/api/src/ledger/ledger.service.ts:82-147` returns stock, movements, and adjustment requests with `locationId: query.locationId`.
- `apps/api/src/transfers/transfers.service.ts:52-70` lists transfers without user location filtering.
- `apps/api/src/purchasing/purchasing.service.ts:121-145` lists purchase orders without user location filtering when `query.locationId` is missing.
- `apps/api/src/branch-ops/branch-ops.service.ts:1005-1007` returns `{}` when query `locationId` is missing.
- `apps/api/src/menu-pricing/menu-pricing.service.ts:52-65` lists all menu prices when no location is provided.

Impact:

Branch/store users with read permissions may see records from branches or warehouses outside their assigned locations by using list screens or direct API calls without a location filter.

Recommended fix:

Pass `AuthenticatedUser` into list service methods and default list queries to `locationId: { in: user.locationIds }` when no location filter is supplied. For transfers, filter by source or target location in the user's allowed locations. Keep explicit `locationId` filters, but validate they are within the user's access.

### High - Ledger event detail endpoint does not enforce location access

Status: Patched after this re-audit.

The ledger event detail route accepts an event ID and does not pass the current user into the service. The service fetches by ID and returns the event without checking the event location.

Evidence:

- `apps/api/src/ledger/ledger.controller.ts:179-182` calls `ledgerService.list('ledger.events.detail', { id })` without `CurrentUser`.
- `apps/api/src/ledger/ledger.service.ts:150-159` returns the ledger event without location authorization.

Impact:

A user with `ledger.events:read` can open a ledger event from another location if they know or guess the UUID.

Recommended fix:

Update the controller to pass `CurrentUser`, then check `event.locationId` against `user.locationIds` before returning the event.

### Medium - Public password reset placeholder endpoints are still mounted

Status: Patched after this re-audit.

Public password reset endpoints remain available and return a deferred message instead of performing a real workflow.

Evidence:

- `apps/api/src/auth/auth.controller.ts:84-100` exposes `POST /api/auth/password-reset/request` and `POST /api/auth/password-reset/confirm`.

Impact:

This is not a direct account takeover path, but it can confuse users or client testers into believing password reset is functional. It also leaves unnecessary public API surface.

Recommended fix:

Remove or hide these endpoints until a secure reset workflow exists. Admin-driven reset already exists through Admin > Users.

### Medium - Redis rate limit operations are not fully atomic

Status: Patched after this re-audit.

Redis-backed rate limiting uses `INCR`, then `PEXPIRE` when count is `1`. If the process crashes or Redis errors between those two commands, a key could remain without an expiry.

Evidence:

- `apps/api/src/common/rate-limit.ts:65-71` performs `incr` and `pexpire` as separate calls.

Impact:

Rare operational edge case. A client could be rate-limited longer than intended for a given key, or stale keys could accumulate.

Recommended fix:

Use a single Redis Lua script or transaction that increments and sets expiry atomically for new keys.

### Medium - Tokens are still stored in browser localStorage

Status: Patched after this re-audit.

The frontend stores both access and refresh tokens in `localStorage`.

Evidence:

- `apps/web/lib/api-client.ts:10-11` defines `ogfi.accessToken` and `ogfi.refreshToken`.
- `apps/web/components/auth-gate.tsx:211-216` stores login tokens in `localStorage`.

Impact:

Revocable sessions and refresh rotation improved server-side control, but any successful XSS can still read tokens from browser storage.

Patch:

Refresh tokens are now set as an HttpOnly cookie by the API and are no longer returned to the browser response body. The frontend keeps the access token in session storage and clears legacy localStorage token keys during logout/session cleanup.

### Low - Report run list filters after reading from database

Status: Patched after this re-audit.

Report run listing fetches recent runs, then filters readability in memory.

Evidence:

- `apps/api/src/reports/reports.service.ts:145-148` filters `canReadRun()` after `findMany()`.

Impact:

This does not expose data in the response, but users with narrow location access may see fewer than the requested number of rows because inaccessible runs are removed after `take`. It can also waste database/application work as report history grows.

Patch:

Report runs now persist `scopeLocationIds`, and report run listing filters by that stored scope before applying the legacy parameter fallback for old rows.

## Improvements Confirmed Since Previous Audit

- Detail checks were added for transfer, purchasing, and stock count detail paths.
- High-risk document and ledger posting paths were moved into shared transactions.
- Upload file type, size, and row limits were added for Excel imports.
- Used item Base UOM changes are blocked.
- Duplicate opening/EOD count controls were added at the service layer.
- Standalone receiving now supports selected UOM conversion.
- Invalid nonblank opening inventory unit cost is treated as an import error.
- Placeholder `/api/sales` is no longer mounted in `AppModule`.
- Focused API regression tests were added.
- Sessions are revocable and refresh tokens rotate.
- Document numbers now use database-backed document sequences.
- Ledger postings use advisory locks per location/item.
- Demo reset preserves audit logs and records reset audit entries.
- Report output is stored on report runs and downloaded as a snapshot.
- Temporary passwords are generated per create/reset action.
- Login identifier is empty by default.
- Redis-backed rate limiting and health/readiness endpoints were added.

## Demo Readiness

Demo readiness is good if the tester uses expected UI paths and assigned filters. However, before sending to broader client testers, fix the list-location scoping issue because it can reveal other branch/warehouse records through normal read permissions.

## Production Readiness

Production readiness still requires deployment validation:

- Configure Redis rate limiting in deployment.
- Run database migrations and smoke tests on VPS after deployment.
