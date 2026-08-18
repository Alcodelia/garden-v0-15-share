GARDEN v0.23.1 — PUBLIC RELEASE
================================

This is the public Garden presentation/calculator release derived from the
human-approved v0.21 R2 interface, v0.22 R1 security/deployment hardening and
the live-verified v0.23 RC1 publication.

v0.23.1 changes presentation framing only: the local and true-north top-down
views were rerendered with wider orthographic framing and visually approved.
No garden geometry, protected 3D model, calculator maths or solar result was
changed.

USE
---
Publish only the allowlisted public payload via HTTPS, or serve the directory
through a local HTTP server for review. Do not rely on file:// for full
functionality.

AUTHORITY
---------
- Presentation/calculator UX: v0.21 R2 human-approved.
- Security/deployment hardening: v0.22 R1 validated.
- v0.23 RC1: Firefox, workstation and live-publication gates passed.
- v0.23.1: top-down framing correction visually approved.
- Protected primary GLB remains byte-identical:
  37721f8b5d4c650cc4314a90f31887998cbbe080acff58c81fd2980562d06845
- Adopted v0.15 R4 solar results and four likely seasonal maps remain unchanged.
- No geometry/model mutation or solar rerun is part of v0.23.1.

PUBLICATION BOUNDARY
--------------------
The public payload excludes `.git`, development tests/tools, PowerShell
launchers, raw photographs, source `.blend` files, runtime logs, credentials
and workstation paths.

Linked realistic PNG publication copies have Blender text/EXIF/time metadata
removed without altering the encoded image data. The raw reviewed v0.23.1 R3
top-down renders remain local evidence and are not published with Blender
metadata.

Runtime JavaScript is same-origin. @google/model-viewer 4.3.1 is vendored and
pinned locally. Its Apache-2.0 license is included under `licenses/`, and
embedded third-party notices remain in the vendored bundle.

SECURITY
--------
The HTML carries a restrictive Content Security Policy, no-referrer policy and
Subresource Integrity hashes for executable/style assets. The calculator uses
bounded numeric validation; user-entered text is rendered as text rather than
HTML.

See `records/` for the security audit, RC publication evidence and v0.23.1
top-down framing/sanitisation record.
