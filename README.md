# Garden release candidate — v0.23 RC1

This repository snapshot is the release-candidate source for the static Garden presentation/calculator site.

## Current authority

- Presentation/calculator UX: human-approved Garden v0.21 R2.
- Security/deployment hardening candidate: Garden v0.22 R1; automated static/unit gates pass, with final visible Firefox review still required.
- Release candidate: Garden v0.23 RC1, pending the final visible Firefox runtime gate.
- Spatial/model authority remains the protected accepted model lineage; v0.22/v0.23 do not alter garden geometry.
- Solar authority remains the adopted Garden v0.15 R4 result set; no solar rerun occurred.
- Protected primary GLB SHA-256: `37721f8b5d4c650cc4314a90f31887998cbbe080acff58c81fd2980562d06845`.

## Deployment boundary

The final public publication must use the allowlisted public-site payload only. Development-only `.git`, tests, tools, local launchers, logs and workstation metadata are not publication content.

The RC publication derivative also strips Blender text/EXIF metadata from the linked realistic PNG copies without changing decoded pixels, and replaces the older v0.18 R1 downloadable ZIP with the newly named metadata-clean R2 package. Canonical/source renders are not overwritten.

The page uses only same-origin runtime assets. `@google/model-viewer` 4.3.1 is vendored locally and pinned; its license is included under `licenses/` and its embedded notices are retained.

A restrictive page Content Security Policy and Subresource Integrity hashes protect the executable/style asset set. The CSP deliberately permits same-origin content plus the `blob:`/`data:` forms required by the local 3D runtime; it does not permit arbitrary remote script execution.

## Local review

Use an HTTP server rather than opening `index.html` directly with `file://`, because the site loads its JSON evidence through same-origin `fetch()`.

The existing `Run-Garden-v0_21.ps1` launcher remains suitable for the source worktree because it binds Python's HTTP server to `127.0.0.1` only. It is a local-review tool and is excluded from the public RC payload.

## Evidence

See:

- `records/garden_v0_22_security_deployment_audit_r1.md`
- `records/garden_v0_22_validation_r1.json`
- `records/garden_v0_23_rc1_public_manifest_r1.json`
- `records/garden_v0_23_rc1_SHA256SUMS_R1.txt`
