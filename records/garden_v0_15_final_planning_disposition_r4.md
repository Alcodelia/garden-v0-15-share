# Garden v0.15 R4 — Final Planning Disposition

**Disposition:** `PLANNING_SOLAR_COMPLETE_WITH_BRACKETED_OFFSITE_UNCERTAINTY__MATERIAL_SCENARIO_SENSITIVITY_PRESENT`

The completion reset is implemented as a scenario-bracketed planning solar model. The protected v0.14 geometry is retained unchanged; unresolved off-site structures and vegetation are represented by explicitly approximate lower/likely/upper angular skyline envelopes rather than fabricated XY geometry.

## What is now closed for planning

- rear-bearing sensitivity remains 325/330/335° around the protected 330° ±5° relation;
- opaque off-site structures are evaluated as angular horizon blockers;
- gum scenarios remain 10/12/14 m user-estimated with open-sky fractions 0.75/0.60/0.45;
- gum/palm/foliage occupancy remains porous, deterministic and non-opaque;
- overlapping photo fields of view are merged as repeated evidence and never stacked;
- unresolved off-site distance/XY/roof dimensions remain uncertainty brackets, not completion blockers.

## Remaining claim boundary

This is **planning-complete scenario solar evidence**, not survey-grade off-site geometry. `ordering_ready` remains `false`. Plant ordering or fabrication still requires its own product/clearance/selection gates where applicable.

## Scenario sensitivity

R3 materiality screen used for sensitivity reporting only: **0.50 h/day**. This is not a plant-suitability threshold.

Material baseline-to-conservative sensitivity present: **YES**.

Detailed receiver, zone and scenario evidence is in `garden_v0_15_receiver_results_r4.csv`, `garden_v0_15_zone_summary_r4.csv` and `garden_v0_15_scenario_comparison_r4.csv`.
