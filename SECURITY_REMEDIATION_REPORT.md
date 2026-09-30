# Project Green — Security Remediation Report

**Repository:** `ronithrashmikara/Project-Green-Orchids`  
**Completed:** 18 July 2026  
**Primary pull requests:** [#61](https://github.com/ronithrashmikara/Project-Green-Orchids/pull/61) and [#62](https://github.com/ronithrashmikara/Project-Green-Orchids/pull/62)

## Executive summary

Project Green received a full security review and remediation pass across the API, web application, database scripts, file handling, payment integration, dependencies, and GitHub Actions configuration. The completed changes remove the known dependency vulnerabilities and code-scanning findings while strengthening access control and protecting sensitive operations.

At completion, the `main` branch passed the production build, all 63 API integration tests (the suite has since grown to 69), CodeQL analysis, CodeRabbit review, and the repository CI workflow.

## Work completed

### Authentication and session security

- Reloaded each authenticated user's current account status, role, and permissions from the database on every protected request.
- Prevented disabled or changed accounts from continuing to use stale token privileges.
- Added same-origin checks for state-changing requests to reduce cross-site request forgery risk.
- Restricted cross-origin access to explicitly configured origins and rejected unsafe mutation requests.

### Authorization and data isolation

- Tightened role-based access control for administrators, buyers, sales managers, inventory staff, and security-panel routes.
- Corrected buyer endpoints to require the appropriate resource-specific permissions.
- Ensured delivery records and proof-of-delivery files are visible only to the owning buyer or authorized staff.
- Restricted proof-of-delivery uploads to staff members holding the required upload permission.
- Aligned pricing approval tests with the final two-person approval policy: inventory staff may request changes, while a separate administrator approves them.

### File-upload protection

- Restricted uploads to approved destination folders.
- Validated file extensions, MIME types, and file signatures instead of trusting the browser-supplied filename or content type.
- Resolved uploaded paths to canonical absolute paths and verified that they remain inside the intended upload directory before reading or deleting files.
- Replaced public proof-of-delivery file exposure with an authenticated delivery route.

### Payment security

- Changed PayHere verification to fail closed when required verification settings are missing.
- Added constant-time checksum comparison to reduce timing side-channel exposure.
- Preserved the checksum format required by the PayHere protocol while strengthening the surrounding validation.

### Email and template safety

- Restricted outgoing email templates to a trusted allowlist stored in the repository.
- Prevented arbitrary template-path selection.
- Validated template renderer lookups before invocation.
- Sanitized mail headers and stopped development logs from printing complete email contents.

### Database and seed-script safety

- Restricted migrations to the repository-owned migration directory.
- Validated migration paths before execution.
- Applied migrations transactionally while holding a PostgreSQL advisory lock, preventing concurrent migration runs.
- Limited destructive seed resets to test databases or an explicitly authorized local reset.
- Removed runtime execution of migration SQL from the seed script.
- Preserved migration-owned roles, permissions, and role-permission assignments during fixture resets.

### Frontend and API hardening

- Removed the server-side status proxy that could be used to request unintended network locations.
- Removed browser-configurable API origins and standardized browser requests on same-origin API routes.
- Replaced unsafe dynamic object-property writes with controlled mappings.
- Improved error handling for protected file delivery and service-status responses.

### Dependency remediation

The affected packages and lockfile were upgraded, including:

- Next.js `15.5.20`
- React `19.2.3`
- Multer `2.2.0`
- Nodemailer `9.0.3`
- UUID `11.1.1`
- node-cron `4.6.0`
- PostCSS `8.5.x`

After the upgrades, `npm audit` reported no known vulnerabilities.

### GitHub Actions and repository security

- Applied least-privilege workflow permissions.
- Disabled persisted checkout credentials where they were unnecessary.
- Added workflow concurrency controls.
- Updated the checkout and Node setup actions to version 5.
- Enabled and validated CodeQL scanning for GitHub Actions and JavaScript/TypeScript.
- Reviewed CodeRabbit feedback and implemented the actionable findings.
- Documented justified false positives where the scanner could not recognize application-specific validation controls.

### Final CodeRabbit follow-up

- Guaranteed closure of the upload signature-check file descriptor with `try`/`finally`, including when a read fails.
- Added a seed preflight check that lists and rejects missing fixture roles, including `SALES_MANAGER`, before any role identifier is used.
- Added a production-dependency audit to CI so future `npm audit` results are preserved in an independently accessible workflow log.

## Validation results

Validation baseline: commit [`70d2a54138421bd24b647fe13c06ecafad1b1a69`](https://github.com/ronithrashmikara/Project-Green-Orchids/commit/70d2a54138421bd24b647fe13c06ecafad1b1a69), checked on **18 July 2026 at 10:16 Asia/Colombo (04:46 UTC)**. The follow-up fixes in this report are validated by [PR #63 checks](https://github.com/ronithrashmikara/Project-Green-Orchids/pull/63/checks).

| Security or quality check | Final result | Auditable evidence |
|---|---:|---|
| Code-scanning alerts | **0 open** | [Code scanning dashboard](https://github.com/ronithrashmikara/Project-Green-Orchids/security/code-scanning) |
| Dependabot alerts | **0 open** | [Dependabot dashboard](https://github.com/ronithrashmikara/Project-Green-Orchids/security/dependabot) |
| Secret-scanning alerts | **0 open** | [Secret-scanning dashboard](https://github.com/ronithrashmikara/Project-Green-Orchids/security/secret-scanning) |
| `npm audit` vulnerabilities | **0** | [CI audit step and logs](https://github.com/ronithrashmikara/Project-Green-Orchids/actions/workflows/ci.yml) |
| API integration tests | **63/63 passed** | [Main CI run](https://github.com/ronithrashmikara/Project-Green-Orchids/actions/runs/29631048286) |
| Production web build | **Passed** | [Main CI run](https://github.com/ronithrashmikara/Project-Green-Orchids/actions/runs/29631048286) |
| CodeQL — GitHub Actions | **Passed** | [Main CodeQL run](https://github.com/ronithrashmikara/Project-Green-Orchids/actions/runs/29631048135) |
| CodeQL — JavaScript/TypeScript | **Passed** | [Main CodeQL run](https://github.com/ronithrashmikara/Project-Green-Orchids/actions/runs/29631048135) |
| CodeRabbit review | **Passed after follow-up fixes** | [PR #63 review and checks](https://github.com/ronithrashmikara/Project-Green-Orchids/pull/63) |
| Main-branch CI | **Passed** | [Main CI run](https://github.com/ronithrashmikara/Project-Green-Orchids/actions/runs/29631048286) |

## Pull-request record

### PR #61 — Primary security remediation

Implemented the broad security hardening work across authentication, authorization, uploads, payments, email, database operations, dependencies, and CI configuration.

**Merged commit:** `20422b66361a1787b8699df6a413ba070801b74b`

### PR #62 — Final scanner cleanup

Closed the remaining upload-path and seed-script findings, then corrected the pricing integration test so a fresh database follows the final authorization matrix.

**Merged commit:** `70d2a54138421bd24b647fe13c06ecafad1b1a69`

## Ongoing recommendations

- Keep Dependabot, CodeQL, secret scanning, and private vulnerability reporting enabled.
- Review new security alerts before every release.
- Rotate production secrets regularly and keep them in the deployment platform's encrypted secret store.
- Run the complete CI workflow for every pull request targeting `main`.
- Reassess permissions whenever a role, workspace, or privileged API route is introduced.
- Add regression tests alongside every security-sensitive bug fix.

## Final status

All security problems identified during this remediation cycle were fixed, reviewed, merged, and verified on the `main` branch. No open CodeQL, Dependabot, secret-scanning, or npm audit findings remained at the time this report was completed.
