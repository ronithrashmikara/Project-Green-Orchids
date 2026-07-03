# Project Green — Status & Focus Areas

_Last updated: 2026-07-04_

## Overall score: **76 / 100**

The backend is the strongest part of this project by a wide margin — modular,
zod-validated, covered by a real automated test suite (57/57 green), and wired
into CI. Product imagery — previously the biggest content gap — is now fully
wired (523/523 products have a real photo). The weakest part remaining is
frontend test coverage and a formal visual-consistency audit of the "glassy"
dark theme across every page. Nothing here is a functional blocker; it's
finish-line work.

| Area | Score | Why |
|---|---|---|
| Backend correctness & API design | 90/100 | Modular, validated, transactional where it matters, 30+ known bugs fixed and regression-tested |
| Automated test coverage (API) | 85/100 | 57 tests, real DB, covers golden paths + regressions + RBAC. Gap: `compat` module untested |
| CI/CD | 75/100 | GitHub Actions runs the suite on push/PR. Gap: no frontend tests, no lint/typecheck gate, no deploy step |
| Security / auth | 80/100 | JWT with ms-precision staleness checks, two-person rule on reversals, RBAC on every route, audit log + force-logout |
| Frontend correctness | 75/100 | Forms validate, destructive actions now require typed confirmation, register form mirrors backend rules |
| Frontend test coverage | 15/100 | Zero automated frontend tests — every UI check so far has been manual/live-browser |
| Visual design consistency | 55/100 | Dark glassmorphism theme covers portals + most public pages via cascade, but not audited page-by-page |
| Content / imagery | 85/100 | 523/523 catalogue products now have a real photo (70 AI-generated SDXL images + 10 named hero shots), wired via `seed.js` + a non-destructive backfill script. Gap: photos are AI-generated stand-ins, not real product photography |
| Documentation | 85/100 | docs/ is organized, QA reports + bugfix proofs + CI setup are all written down |

---

## What works

- **Core trade flows are solid and tested end-to-end**: RFQ → quote → accept → convert to order, RMA → approve → restock → credit note, price governance (3rd change in 24h needs admin approval), payments with two-person rule on large reversals.
- **RBAC is enforced everywhere it's been tested**: every module has a "non-admin/plain buyer cannot do X" regression test, and they all pass.
- **Auth is hardened**: JWT staleness uses a custom millisecond claim (fixed a real race condition this session), refresh tokens rotate, login history + audit log + force-logout all work and are tested.
- **Destructive admin actions are now guarded**: product delete, supplier deactivate, and user deactivate all require typing the exact SKU/name/email before the button unlocks.
- **Register form validation matches the backend exactly** — a buyer application can no longer get bounced by a 400 the UI didn't warn about.
- **CI is live**: every push/PR to this repo runs the full 57-test suite via GitHub Actions.
- **Docs are in decent shape**: `docs/` is split into engineering, QA reports, image assets, presentations, media — not a junk drawer anymore.
- **Product catalogue now has real images end to end.** All 523 products have a `product_images` row and render a real photo in both the public/buyer catalogue and the admin products table — no emoji fallbacks left on any page. 70 SDXL-generated photos (5 per category, 14 categories) plus 10 named hero shots for the flagship orchids, generated via a free Colab GPU notebook (`docs/image-assets/generate_catalogue_images_sdxl.ipynb`) and mapped in by category in `scripts/seed.js`, with `scripts/backfill_product_images.js` available to re-apply the mapping to an already-seeded DB without wiping data.

## What doesn't work / is incomplete

- **No frontend automated tests.** Every UI verification in this project (including everything done today) has been manual browser testing via preview tools. If a future change silently breaks a form or a dialog, nothing catches it automatically.
- **The `compat` module has no test file** — it's the one gap in an otherwise fully-covered API.
- **Glassy dark theme consistency hasn't been formally audited.** It was rolled out via a CSS cascade (`.portal-dark` in `globals.css`) plus individual rewrites of public pages, but no page-by-page pass has confirmed every page (contact, pricing, terms, trade-terms, help-centre, etc.) looks fully intentional rather than "inherited and probably fine."
- **No deploy pipeline.** CI runs tests but there's no staging/production deploy step — everything is still run locally.
- **No lint/typecheck gate in CI** — JS has no static type checking (project uses `jsconfig.json`, not TypeScript), so type-shaped bugs can only be caught by tests or manual review.

## Focus areas from here, in priority order

1. ~~**Product imagery**~~ — **done (2026-07-04).** All 523 products have a real photo wired via `product_images`; see the Catalogue section in the [README](../../README.md). Remaining follow-up, if there's appetite: swap the AI-generated stand-ins for real product photography, and spot-check image file sizes/CDN strategy before this goes anywhere near production traffic.

2. **Glassy UI revamp — consistency pass**
   - Page-by-page audit of every public + portal page against the dark glassmorphism reference (home, register, login already solid)
   - Specifically re-check: contact, pricing, privacy, terms, trade-terms, help-centre — confirm these aren't just "inheriting" acceptable styles by accident
   - Check responsive/mobile behavior of the glass effects (blur, backdrop) — not verified this session

3. **Frontend test coverage**
   - Stand up a frontend test runner (component tests at minimum; consider Playwright for a handful of critical-path E2E flows: login, register, RFQ create, checkout)
   - This is the single biggest reliability gap in the project right now

4. **Fill remaining small gaps**
   - Add a test file for the `compat` module
   - Add lint/format check to CI (even without full TypeScript, a lint gate catches real bugs)

5. **Bigger swings (discuss before starting)**
   - A real deploy pipeline (staging environment, one-click promote to prod)
   - File upload validation hardening (type/size limits) once product image upload is a regular workflow
   - Move catalogue images to a real CDN/object store instead of `apps/web/public/` if the repo size (currently +105MB of PNGs) becomes a problem
