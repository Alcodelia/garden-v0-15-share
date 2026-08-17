# Garden v0.22 R1 — Security and deployment-hardening audit

Date: 2026-08-17 (AEST)

## Disposition

**AUTOMATED HARDENING PASS; FINAL VISIBLE FIREFOX RUNTIME GATE PENDING.**

This audit starts from the uploaded human-approved v0.21 R2 worktree snapshot. It does not alter protected garden geometry, Blender assets, adopted solar results or seasonal maps.

The clean public release-candidate payload is packaged separately as **Garden v0.23 RC1**. Publication is not accepted until that exact RC is visibly exercised in ordinary Firefox on the workstation.

## Source reconciliation

- Uploaded source archive: `web_publish_r5_r1.zip`
- Uploaded archive SHA-256: `a61a063fb6b38cfd8dd847bd7b174c260a75316a2a2f0b65a955628be8c1a3be`
- Git branch in archive: `codex/garden-v0.20-final-ui`
- Git HEAD in archive: `7bb91ec8b48bd9219789febe5e360f23c7bfb461`
- The expected v0.21 R2 application changes were present.
- `records/SHA256SUMS.txt` arrived with a ZIP/working-tree line-ending/stat discrepancy. Its working bytes normalised to the exact HEAD blob (`16c0c2389753059e8601b73dedaa86534beb4b25`); there was no logical ledger-content change. The candidate keeps the HEAD content.

## Findings

| ID | Severity | Finding | Disposition | Evidence / treatment |
|---|---|---|---|---|
| SD-00 | Medium / privacy | The currently linked realistic PNGs and the downloadable `garden_v0_18_public_distribution_r1.zip` retained Blender PNG text/EXIF metadata containing local T-drive Garden source-file paths. This contradicted the R1 privacy statement. | **FIXED** | The v0.23 public copies strip PNG text/EXIF/time metadata while preserving decoded pixels exactly. The downloadable archive is replaced by the newly named `garden_v0_18_public_distribution_r2_sanitised_metadata.zip`, with seven render pixels verified identical and a regenerated ledger/correction record. Source/canonical renders are not overwritten. |
| SD-01 | Medium | Publishing the development worktree directly would expose development-only repository/test/tool/launcher material that is not required by the static site. | **FIXED BY PACKAGING** | v0.23 RC1 is built from an explicit public allowlist. `.git`, `tests/`, `tools/`, PowerShell launchers, logs and source-only material are excluded. |
| SD-02 | Low | The application had no explicit page CSP or subresource integrity binding for its executable/style assets. | **FIXED** | Added restrictive same-origin CSP, exact SHA-256 allowance for the single inline bootstrap, no-referrer policy and byte-matching SHA-384 SRI for local CSS/JS resources. |
| SD-03 | Low | A first-party table fallback used `innerHTML`, although only with a fixed literal and no user-controlled value. | **FIXED / HARDENED** | Replaced with DOM construction plus `textContent`/`replaceChildren`; automated sink scan now rejects first-party `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `eval`, `new Function` and `document.write`. |
| SD-04 | Low / compliance | The vendored `@google/model-viewer` 4.3.1 bundle retained embedded notices but the worktree did not carry a clear standalone upstream license record for publication. | **FIXED** | Added `THIRD-PARTY-NOTICES.txt` and `licenses/model-viewer-4.3.1-Apache-2.0.txt`; no source maps are distributed. |
| SD-05 | Low / operational | Public/source README text was stale (v0.16-era) and could misdescribe the current calculator/publication boundary. | **FIXED** | Replaced with v0.23 RC1 authority, security, deployment and review boundaries. |
| SD-06 | Informational | Runtime user input and URL state were reviewed for injection/path abuse. | **PASS** | Mode/hash selection is constrained to known values; calculator numeric inputs are finite/bounded; unsupported profiles/order modes and generic settlement/compaction fail closed; first-party rendering uses text/DOM APIs rather than HTML sinks. |
| SD-07 | Informational | The local review launcher could accidentally expose the site to the LAN if broadly bound. | **PASS** | Existing approved launcher explicitly serves on `127.0.0.1` and opens a `127.0.0.1` URL. It is excluded from the public payload. |
| SD-08 | Informational | Runtime could leak data through arbitrary third-party endpoints/telemetry. | **PASS** | First-party runtime sources declare no external network endpoint; shared JSON/model/images are same-origin. CSP also restricts connections/scripts to the same origin (plus required local blob forms). |
| SD-09 | Informational | Protected spatial/solar artifacts could be changed during hardening. | **PASS** | Independent hashes for the primary GLB, adopted solar JSON, four likely seasonal maps and four-season solar PDF remain exact. |
| SD-10 | Deployment-dependent | Response headers such as `X-Content-Type-Options`, `Permissions-Policy`, HSTS and CSP `frame-ancestors` cannot be established by this static HTML package alone. | **ACCEPTED / DEPLOYMENT-DEPENDENT** | No authenticated/private action exists in this static site. Page-level CSP covers executable/content loading. Production host headers may be added where the final host supports them. |
| SD-11 | Runtime | Exact post-hardening Firefox/model-viewer behaviour has not been visibly exercised in this sandbox. | **UNVALIDATED HERE** | Firefox is unavailable in the sandbox. Managed Chromium local navigation is blocked by administrator policy; direct local HTTP retrieval with `curl` succeeds. The exact RC must therefore receive one workstation Firefox review before publication. |
| SD-12 | Supply-chain provenance | Exact byte identity of the vendored minified model-viewer bundle against an independently fetched upstream distribution was not proven in this run. | **UNVALIDATED / LOW IMPACT** | Version is pinned in the filename/site; SRI locks the RC to the audited local bytes; license/notices are included. No dependency update is performed by v0.22. |

## Automated validation performed

- Calculator engineering tests: **15/15 PASS**.
- Site contract tests: **16/16 PASS**.
- New security/deployment tests: **9/9 PASS**.
- Node syntax checks for first-party JS and both browser/security test scripts: **PASS**.
- `git diff --check` on v0.22 text changes: **PASS**.
- Local HTTP retrieval through Python server + `curl`: **PASS**.
- Protected model/solar hashes: **PASS**.
- Publication privacy scan, including current presentation PNG metadata and the downloadable nested ZIP: **PASS after metadata sanitisation**.
- Clean-public-payload boundary and archive integrity: recorded separately in the v0.23 RC1 manifest/ledger.

## Explicitly not done

- No Blender run.
- No solar rerun.
- No garden geometry/model modification.
- No Git commit, merge, push or publication.
- No claim of visible Firefox acceptance.
- No remote/CDN dependency substitution.

## Release gate

The only remaining release-blocking action is a **visible Firefox review of the exact v0.23 RC1 local-review bundle**. It must confirm normal Presentation/Calculator rendering, 3D model load/orbit/zoom/reset, seasonal maps, calculator operation and absence of CSP/SRI resource failures. If that passes, the clean public RC archive is the publication candidate; no further source changes are required unless the review finds a defect.
