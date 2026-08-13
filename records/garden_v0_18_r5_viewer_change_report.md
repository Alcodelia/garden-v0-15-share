# Garden v0.18 R5 viewer cleanup

Status: `R5_VIEWER_CLEANUP_PASS__R4_MODEL_BYTES_PRESERVED__RHIZOME_HOTSPOT_NON_PERSISTENT__AWAITING_FINAL_HUMAN_VIEWER_APPROVAL`

## Change

The existing Rhizome hotspot remains a keyboard-focusable button at `5.05m 0.34m -8.25m`, with the permanent accessible name `Rhizome bed location` and the inherited activation behavior. R5 changes only its presentation: the default is a 20 px marker, while the visible `Rhizome bed` label appears on fine-pointer hover, keyboard focus-visible, or the brief active interaction state. It hides when hover/focus leaves.

R5 source edits are limited to `index.html` and `assets/site.css`. The inherited R4 `assets/site.js` activation code was inspected and not changed by R5. No Blender, GLB, garden geometry, solar asset, camera framing, publication, or repository-history action occurred.

## Validation

- Browser QA passed at 1280×900 and 360×800.
- Default, hover, keyboard-focus, focus-leave, activation, compact dismissal, orbit, zoom, console and overflow checks passed.
- Static fallback, direct R4 GLB download and reduced-motion paths remain present.
- JavaScript syntax, diff whitespace and the existing calculator regression test passed.
- The R4 primary GLB remains byte-identical at `37721f8b5d4c650cc4314a90f31887998cbbe080acff58c81fd2980562d06845`.
- The R2 context GLB remains byte-identical at `31a107097f98672d9686931904babdd6723d0edb54cc7a7175faecf157b6f27c`.

Automated QA is separate from Dav's final human judgement. Open `http://127.0.0.1:8765/#model` for that final local check.
