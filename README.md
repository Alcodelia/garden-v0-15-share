# Garden v0.23.1 — current source release

This repository snapshot is the current source release for the static Garden presentation/calculator site.

## Current authority

- Presentation/calculator UX: Garden v0.21 R2, human-approved.
- Security/deployment hardening: Garden v0.22 R1, automated validation passed.
- Garden v0.23 RC1 completed visible Firefox acceptance, workstation validation and live GitHub Pages byte verification.
- Garden v0.23.1 is a presentation-only correction to the local and true-north top-down render framing. Both corrected views received human visual approval.
- v0.23.1 does not alter garden XY/Z geometry, the protected GLB, calculator maths or adopted solar results.
- Solar authority remains the adopted Garden v0.15 R4 result set; no solar rerun occurred.
- Protected primary GLB SHA-256: `37721f8b5d4c650cc4314a90f31887998cbbe080acff58c81fd2980562d06845`.

## Deployment boundary

The public website is published from the dedicated `gh-pages` branch using an allowlisted public payload. Development-only `.git`, tests, tools, local launchers, raw photographs, source Blender files, logs and workstation metadata are not publication content.

Publication PNG copies have Blender ancillary metadata removed without altering image data. For v0.23.1, the reviewed local and true-north R3 renders remain preserved separately while the Git/publication copies are metadata-sanitised.

The page uses only same-origin runtime assets. `@google/model-viewer` 4.3.1 is vendored locally and pinned; its Apache-2.0 license and embedded notices are retained.

A restrictive page Content Security Policy and Subresource Integrity hashes protect the executable/style asset set. The calculator uses bounded deterministic numeric validation.

## Local review

Use an HTTP server rather than opening `index.html` directly with `file://`, because the site loads its JSON evidence through same-origin `fetch()`.

`Run-Garden-v0_21.ps1` remains the validated local-review launcher and binds Python's HTTP server to `127.0.0.1`. The legacy filename is retained because its bytes and behaviour were already validated.

## Evidence

See:

- `records/garden_v0_22_security_deployment_audit_r1.md`
- `records/garden_v0_22_validation_r1.json`
- `records/garden_v0_23_rc1_public_manifest_r1.json`
- `records/garden_v0_23_rc1_SHA256SUMS_R1.txt`
- `records/garden_v0_23_1_topdown_framing_r1.json`
