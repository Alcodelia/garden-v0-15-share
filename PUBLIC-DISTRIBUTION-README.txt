GARDEN v0.23 RC1 — PUBLICATION CANDIDATE R1
============================================

This is the clean public-site candidate derived from the human-approved
v0.21 R2 presentation/calculator and the v0.22 R1 security/deployment
hardening candidate. Automated static/unit gates pass; final visible Firefox
runtime acceptance remains required before publication.

USE
---
Publish the allowlisted payload via HTTPS, or serve this directory through a
local HTTP server for review. Do not rely on file:// for full functionality.

AUTHORITY
---------
- Presentation/calculator UX: v0.21 R2 human-approved.
- Security/deployment hardening candidate: v0.22 R1.
- RC packaging: v0.23 RC1; visible Firefox runtime gate pending.
- Protected primary GLB remains byte-identical:
  37721f8b5d4c650cc4314a90f31887998cbbe080acff58c81fd2980562d06845
- Adopted v0.15 R4 solar results and four likely seasonal maps remain unchanged.
- No Blender or solar rerun is part of this candidate.

PUBLICATION BOUNDARY
--------------------
The public RC payload excludes `.git`, development tests/tools, PowerShell
launchers, raw photographs, source `.blend` files, runtime logs, credentials
and workstation paths.

Linked realistic PNG copies have Blender text/EXIF/time metadata removed in
the publication derivative with decoded pixels verified identical. The old
v0.18 R1 downloadable ZIP is not published by this RC; its corrected, newly
named R2 replacement is used instead.

Runtime JavaScript is same-origin. @google/model-viewer 4.3.1 is vendored and
pinned locally. Its Apache-2.0 license is included in `licenses/`, and embedded
third-party notices remain in the vendored bundle.

SECURITY
--------
The HTML carries a restrictive Content Security Policy, no-referrer policy and
Subresource Integrity hashes for executable/style assets. The calculator uses
bounded numeric validation; user-entered text is rendered as text rather than
HTML.

See the v0.22 audit/validation and v0.23 RC manifest/checksum ledger in
`records/` for exact evidence and remaining limitations.
