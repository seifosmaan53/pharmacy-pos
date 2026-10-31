# Review: `security/deps-and-e2e`

Reviewer: independent review in a Claude Code session, 2026-10-25. I did not write the change.
Scope: `git diff main..security/deps-and-e2e` (main = `6f04341`, original tip = `3dd465f`, 4 commits).
I used the author's report (`docs/security/2026-10-25-deps-and-e2e.md`) only as a map.
Every result below comes from a command I ran myself.

This review does **not** say the application is production-ready or that it meets any
healthcare, pharmacy or data-protection requirement. A clean `npm audit` only means that no
*known* advisory matches the lockfile today.

## Verdict

**Mergeable once the two review commits are included and CI has run green.**

- **Upgrades.** I found no regression: build, lint, typecheck, unit tests, the e2e suite,
  a page/CSV smoke test, and a zod differential test all pass.
- **Lockfile.** It is complete and consistent.
- **Audit.** Before and after both match the report exactly.
- **Isolation.** The browser suite is isolated from `dev.db`.
- **Suite strength.** As delivered, the suite was weaker than the report implied. Two
  server-side protections could be deleted without any test failing. One was the
  manager-only Server Action check. The other was the server-side oversell check. Fixed in
  `7d26977`.
- **Report accuracy.** The report had factual errors: commit ids, the mbox path and the
  commit count. Fixed in `3e78b55`.
- **CI.** The CI `e2e` job's `playwright install --with-deps` step has never run anywhere.
  It is still unverified.

## Findings

| ID | Severity | Location | Finding and evidence | Status |
|---|---|---|---|---|
| R1 | Medium | `e2e/pharmacy.spec.ts:196-219` (original), guard at `app/(app)/stock/actions.ts:72` | The "denied permission" test only checks page redirects and that the Delete button is hidden. Mutant M2 replaces `requireManager()` with `requireUser()` in `deleteStock`, so any signed-in pharmacist could delete stock with a direct POST. Result: **8/8 passed**, so the suite does not test the server-side role check. The report admits this under "Not exercised", but its summary row calls this the "Denied permission" test. | **CONFIRMED**. Fixed in `7d26977`: new test 10 captures the real Server Action request, replays it as the pharmacist (the batch must survive) and then as the manager as a control (the batch must be deleted). M2 now fails at `pharmacy.spec.ts:296` (`Expected: 1, Received: 0`). |
| R2 | Medium | `e2e/pharmacy.spec.ts:116-133` (original), check at `lib/fefo.ts:37` | The "oversell blocked" test stops at the client-side cart check in `pos-terminal.tsx:84-87`; `completeSale` is never called. Mutant M4 disables `if (total < qty) throw INSUFFICIENT_STOCK`. Result: **8/8 passed**. | **CONFIRMED**. Fixed in `7d26977`: new test 6 fills the cart to the available quantity, takes one unit out in the DB, then checks out. It checks the server error message, the stock level after a reload, an unchanged sale count in Prisma, and that the change was restored. M4 now fails at `pharmacy.spec.ts:157`. |
| R3 | Low | `docs/security/2026-10-25-deps-and-e2e.md:68,85,93,209,217,218,237` | The report cites commits `b2b1536`, `b567786` and `bdd76cd`. None of them exist; the real ones are `f19de16`, `e1f3974` and `430ce7f`. It also says an mbox exists at `docs/security/deps-and-e2e.mbox` (it does not), says the branch has an "empty probe commit" (it does not) and gives "5 commits" (there were 4). The apply steps as written would not have worked. | **CONFIRMED**. Fixed in `3e78b55`. |
| R4 | Low | `README.md:147` | The README said "Each workflow is checked after a fresh page load and with a direct Prisma query". That is not true for tests 1, 2 and 5: tests 1 and 2 have no Prisma check, and test 5 has no reload. | **CONFIRMED**. Wording made accurate in `3e78b55`. |
| R5 | Info | git refs | The checkout had no `security/deps-and-e2e` ref; `git branch -a` listed only `main`. The 4 commits existed as unreachable objects (`git fsck --unreachable` found tip `3dd465f`). I restored the ref with `git branch security/deps-and-e2e 3dd465f` before reviewing. | CONFIRMED. Process note only; no code change. |
| R6 | Info | `playwright.config.ts:24-32`, `e2e/global-teardown.ts` | If the web server fails to start, global teardown does not run, so `prisma/e2e.db` is left behind. I reproduced this by holding port 3100 with another process. The good part: the run refused to start rather than test against the foreign server. The leftover file is gitignored and deleted or recreated by `setup-db.ts` on the next run, so it carries no data risk. | CONFIRMED. Not fixed (harmless). |
| R7 | Info | `.github/workflows/ci.yml:59-103` | The `e2e` job has never run on GitHub Actions. I could not test `npx playwright install --with-deps chromium`: the proxy refused `cdn.playwright.dev` with a 403. Every other step of the job ran clean in a fresh clone on Node 20.20.0 / npm 10.8.2, including a build with no DB file. The engine ranges of vite and rolldown (`^20.19.0`), next and sharp (`>=20.9.0`) and playwright (`>=20`) all accept current Node 20. | PLAUSIBLE that CI passes. Unverified. |
| R8 | Info (pre-existing, not part of this diff) | `app/(app)/stock/actions.ts:26`, `app/(app)/drugs/actions.ts:23,40`, `app/(app)/stock/page.tsx:44` | `createStock`, `createDrug` and `updateDrug` only call `requireUser()`, and the "+ Receive stock" button is shown to every role. So a pharmacist can receive stock, which also changes the drug's price, and can create or edit drugs. The README (`README.md:156`) says pharmacists only get "viewing drugs & stock". The code is unambiguous; whether this is intended is a product decision. | CONFIRMED that the code and the README disagree. Not fixed (out of scope; changes behaviour). **Resolved later in PR #3 (`b64db2a`)**: these actions now call `requireManager()` and the receive button is manager-only. |
| R9 | Info (pre-existing) | `package-lock.json` | `npm ls --all` flags 6 optional wasm32 packages as `extraneous` (`@emnapi/*`, `@img/sharp-wasm32`, `@napi-rs/wasm-runtime`, `@tybys/wasm-util`). The same 6 appear on `main`. `npm ls` exits 0, with no `invalid` or `missing` entries; the only `UNMET OPTIONAL` entries are other platforms' binaries. | CONFIRMED that this is pre-existing. Not introduced by this branch. |

These parts of the report I checked and found **accurate**:

- **Advisories.** The per-advisory table matches. At `main`, `npm audit --json` reports 8
  packages (1 critical, 5 high, 2 moderate): next, sharp, zod, vite, source-map-js,
  brace-expansion, @vitest/mocker and vitest. That is 28 via-entries and 25 distinct GHSA
  ids, and every id, severity and range matches the report's table.
- **Final audit.** After the change, both `npm audit` and `npm audit --omit=dev` print
  `found 0 vulnerabilities`.
- **CI build job.** The existing `build` job is unchanged; the diff only appends lines after
  line 58.
- **Unused dependency.** No app code changed, and `playwright` was not imported anywhere on
  `main`, so replacing it with `@playwright/test` is safe.
- **Override.** The `deepmerge-ts` override is pre-existing (its justification is in commit
  `6f04341`) and untouched. `prisma generate` and `migrate deploy` both work with it.

## Upgrade regression checks

These are the actual lockfile version changes between `main` and the branch:

| Package | Before → after | Check performed | Result |
|---|---|---|---|
| next (+ @next/*, eslint-config-next) | 16.3.4 → 16.4.3; eslint-config-next 16.2.9 → 16.4.3 | Production build: 14 routes, only `/` and `/_not-found` static. Server Actions (login, sale, stock create and delete, logout) run in e2e. A temporary smoke spec, not committed, signed in as manager and loaded `/dashboard /pos /drugs /stock /debtors /suppliers /staff /reports`: all returned 200, with no error boundary, page errors or console errors. `GET /reports/export` returned 200 `text/csv` with the expected header row and the sale row. `GET /api/receipt/:id` returned 200 `application/pdf` with a session and 401 without. Lint passes with the new eslint-config-next. | No regression found |
| zod | 4.5.4 → 4.6.7 | Differential test: I copied the app's 8 schemas (Sale, Stock, DebtAdd, Repay, Drug, Supplier, StaffNew, StaffEdit) and ran 1,270 inputs (empty, whitespace, coercion edge cases, Infinity/NaN, bad e-mail, bad enum, missing keys) through `safeParse` under both versions. I compared `data`, or `[code, path, message]` for each issue. | **Byte-identical output** (893 errors, 377 successes) |
| vitest / vite / @vitest/* | 4.1.11 → 4.1.12; vite 8.2.2 → 8.3.5 | `npm test` | 2 files, 24/24 passed |
| sharp (+ @img/*) | 0.35.4 → 0.35.5 | No app code uses sharp (no `next/image`); it is only reachable through `/_next/image`. The build passes. | Not exercised at runtime (see "Not checked") |
| source-map-js, postcss, brace-expansion, nanoid, rolldown, chai, tinyrainbow | patch/minor | Build, lint and tests | Pass |
| prisma / @prisma/client | 6.19.3 → 6.19.3 (**not upgraded**) | `prisma generate` and `migrate deploy` under Node 20 | Pass |

`package.json` and the lockfile root agree on `dependencies` and `devDependencies`
(compared programmatically), the lockfile is still `lockfileVersion: 3`, and `npm ci` passes
under both npm 10.8.2 (Node 20.20.0) and npm 10.9.4 (Node 22.22.0).

## Browser-test isolation

- **Fixed path.** The DB path is fixed in `e2e/db.ts:11-12` as `prisma/e2e.db`, an absolute
  path built from `__dirname`. It is not read from the environment, and
  `assertE2EDatabase` refuses any other URL.
- **Server env.** The server gets `DATABASE_URL` and `SESSION_SECRET` from
  `webServer.env`, which take precedence over any `.env` file.
- **Probe: `.env`.** I put a sentinel `prisma/dev.db` in place and ran the suite twice: once
  with shell `DATABASE_URL=file:./ci.db`, and once with no shell variable and a `.env` file
  containing `DATABASE_URL="file:./dev.db"`. The sha256 of `dev.db` (and of `ci.db`) was
  identical before and after both runs, and `e2e.db` was removed at the end.
- **Probe: port.** The port is fixed at 3100 with `reuseExistingServer: false`. While
  another process held 3100, the run aborted ("Process from config.webServer was not able
  to start") instead of testing against the foreign server (see R6).
- **CI.** The `e2e` job uses its own `DATABASE_URL=file:./ci.db` only for `next build`.
  Prisma reads the URL at runtime, so the server under test uses `e2e.db`. I built with no
  `ci.db` file at all, and the suite passed.
- **Ordering.** `workers: 1` and `fullyParallel: false`. Tests share one DB and depend on
  file order: test 5 reads the stock level left by test 4. That is acceptable for a serial
  suite, but a single test cannot be run on its own with a stable expectation.

## Mutation testing (do the tests check real persisted behaviour?)

For each mutant: apply a one-line change, rebuild with `next build`, run the full suite,
then revert with `git checkout`. Script: a scratchpad `runmut.sh`/`mutate.py` (not
committed).

| Mutant | Change | Original suite (8 tests) | With review tests (10 tests) |
|---|---|---|---|
| M1 | skip `decrementStockFEFO` in `completeSale` | **killed**: test 4 failed | killed: tests 4 and 6 failed |
| M2 | `deleteStock`: `requireManager()` → `requireUser()` | **survived (8/8 passed)** | killed: test 10 failed |
| M3 | `/staff` page guard → `requireUser` | killed: role test failed | killed: test 9 failed |
| M4 | disable the server `INSUFFICIENT_STOCK` check (`lib/fefo.ts`) | **survived (8/8 passed)** | killed: test 6 failed |
| M5 | sign-out stops bumping `tokenVersion` | killed: test 3 failed | killed: test 3 failed |
| M6 | `createStock` stops updating the drug price | killed: receive test failed | killed: test 7 failed |
| M7 | receipt PDF route drops its auth check | killed: test 4 failed (expected 401) | killed: test 4 failed |
| M8 | sale persisted with `paid: 0` | killed: test 4 failed | killed: test 4 failed |

The denied-permission check is now real and server-side (test 10). The page-level guard was
already enforced on the server, since `requireManager()` runs in the server component
(M3 is killed). But the original suite never exercised the Server Action guard.

## Commands and counts

Final state, fresh `git clone` of `3e78b55`, Node 20.20.0 / npm 10.8.2, CI env values:

| Command | Result |
|---|---|
| `npm ci` | exit 0, 453 packages, "found 0 vulnerabilities" |
| `npx prisma generate` / `npx prisma migrate deploy` | exit 0 / exit 0 |
| `npm run lint` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm test` (Vitest) | 2 files, **24/24 passed** |
| `npm run build` | exit 0 (Next.js 16.4.3), with and without an existing DB file |
| `npm run test:e2e` | **10/10 passed** (≈13 s); 3 consecutive runs, 10/10 each, in the working checkout |
| `npm audit` | found 0 vulnerabilities |
| `npm audit --omit=dev` | found 0 vulnerabilities |
| `npm ls --all` | exit 0; 0 invalid, 0 missing; 6 extraneous (pre-existing, R9) |

Before my commits, the original tip `3dd465f` passed: e2e 8/8, Vitest 24/24, lint, typecheck,
build and audit 0, on Node 20.20.0. `npm ci` and audit 0 also passed on Node 22.22.0 / npm 10.9.4.

## Commits added in review

- `7d26977` test(e2e): cover the server-side oversell and manager-only action checks (R1, R2)
- `3e78b55` docs: correct the deps-and-e2e report against the delivered branch (R3, R4)
- (this file, committed last)

## What I could not check

- **GitHub Actions** has not run either job. There is no remote in this session.
- **`npx playwright install --with-deps chromium`**: the CDN was blocked (403). I used the
  preinstalled Chromium 1243, which is what `@playwright/test` 1.63.0 expects.
- **`/_next/image` / sharp at runtime**: I did not check whether the endpoint is reachable
  or whether the sharp/libvips fix is effective. The SVG/SSRF advisories were not tested.
- **Changelogs:** I did not read upstream Next 16.4 / zod 4.6 changelogs; WebFetch was not
  used. The regression evidence is behavioural: build, e2e, smoke and the zod
  differential test.
- **Behaviour outside the tested paths:** debtors, drug, supplier and staff CRUD as UI
  workflows (the smoke test only loaded those pages); cash-sale mode; discounts; printing.
- **Direct-POST role checks** on the other manager-only actions (staff, suppliers,
  `deleteDrug`).
- **Concurrent sales** against the real DB. The README claims "two concurrent sales can't
  oversell the same batch"; I did not test that.
- **Other targets:** browsers other than Chromium, macOS/Windows installs, and
  `scripts/test-sale.mjs`.
- **The npm 10.9.4 resolver crash** the author describes. I did not try to reproduce it by
  re-resolving dependencies.
