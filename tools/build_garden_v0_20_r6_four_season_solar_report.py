#!/usr/bin/env python3
"""Build the v0.20 R6 four-season solar report from frozen existing outputs.

This script does not execute any solar-analysis code. It validates and arranges
the adopted v0.15 R4 results and the existing v0.18 likely B330 heatmaps.
"""

from __future__ import annotations

import hashlib
import json
import argparse
from pathlib import Path
from typing import Any

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas


SITE = Path(__file__).resolve().parents[1]
WORKSPACE = SITE.parents[1]
RESULTS = SITE / "data" / "garden_v0_15_solar_results_r4.json"
PRESENTATION_MANIFEST = WORKSPACE / "garden_v0_18" / "records" / "garden_v0_18_solar_presentation_manifest_r1.json"
DEFAULT_OUTPUT = SITE / "documents" / "garden_v0_20_four_season_solar_summary_r6.pdf"

EXPECTED_RESULTS_SHA256 = "28fcbf0a11912c02be0abeb19d426b0e83b2becc35ff22340e3aabe2a6b49ad0"
EXPECTED_MANIFEST_SHA256 = "a575eca991a410b4669eccccdb144cee0592d21038a33688a5a22f1be420f4f3"
EXPECTED_RECEIVER_COUNT = 5220
METRIC = "expected_open_sky_weighted_hours"

SEASONS: list[dict[str, Any]] = [
    {
        "id": "SUMMER",
        "date": "2026-12-21",
        "filename": "garden_v0_18_solar_summer_likely_b330_r1.png",
        "sha256": "473c16e6bc92c815bada70ded36d12fd2e896f91c8f10034e57eec04894a4fae",
        "hours": 6.384828,
        "summary": "The strongest seasonal light estimate. Compare the warmest areas with places that remain shaded even in summer.",
    },
    {
        "id": "AUTUMN",
        "date": "2026-03-21",
        "filename": "garden_v0_18_solar_autumn_likely_b330_r1.png",
        "sha256": "4a505ddea88d1d8f77f576067ecdcbf5c77dc0b1794f5569a804222cd0500042",
        "hours": 5.438295,
        "summary": "Useful light remains moderate overall, while boundaries and taller obstructions continue to create local shade.",
    },
    {
        "id": "WINTER",
        "date": "2026-06-21",
        "filename": "garden_v0_18_solar_winter_likely_b330_r1.png",
        "sha256": "ee7e21d2ab1f6fd6eb941ad83a5fe8afaba5968f22ee50a00629a455af0c39bc",
        "hours": 2.311082,
        "summary": "The limiting season. Use this map when comparing locations for planting that needs reliable useful sunlight.",
    },
    {
        "id": "SPRING",
        "date": "2026-09-21",
        "filename": "garden_v0_18_solar_spring_likely_b330_r1.png",
        "sha256": "626fa2a167776b932d9685e639d86feafa1b14ca5893d878e58dbba70bd1f652",
        "hours": 5.376839,
        "summary": "Useful light returns across much of the garden, with the same persistent shade patterns still important.",
    },
]

INK = colors.HexColor("#17211c")
FOREST = colors.HexColor("#0c2d25")
FOREST_MID = colors.HexColor("#285444")
SAGE = colors.HexColor("#b9c9aa")
PAPER = colors.HexColor("#f7f3ea")
WHITE = colors.HexColor("#fffdf8")
MUTED = colors.HexColor("#647068")
CLAY = colors.HexColor("#b66743")
LINE = colors.HexColor("#d5cebf")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def wrap(text: str, width: float, font_name: str, font_size: float) -> list[str]:
    lines: list[str] = []
    current: list[str] = []
    for word in text.split():
        candidate = " ".join([*current, word])
        if current and stringWidth(candidate, font_name, font_size) > width:
            lines.append(" ".join(current))
            current = [word]
        else:
            current.append(word)
    if current:
        lines.append(" ".join(current))
    return lines


def draw_wrapped(
    pdf: canvas.Canvas,
    text: str,
    x: float,
    y: float,
    width: float,
    font_name: str = "Helvetica",
    font_size: float = 10,
    leading: float = 14,
    colour: colors.Color = INK,
) -> float:
    pdf.setFillColor(colour)
    pdf.setFont(font_name, font_size)
    for line in wrap(text, width, font_name, font_size):
        pdf.drawString(x, y, line)
        y -= leading
    return y


def fit_image(pdf: canvas.Canvas, path: Path, x: float, y: float, width: float, height: float) -> None:
    image = ImageReader(str(path))
    source_width, source_height = image.getSize()
    scale = min(width / source_width, height / source_height)
    draw_width = source_width * scale
    draw_height = source_height * scale
    pdf.drawImage(
        image,
        x + (width - draw_width) / 2,
        y + (height - draw_height) / 2,
        width=draw_width,
        height=draw_height,
        preserveAspectRatio=True,
        mask="auto",
    )


def page_footer(pdf: canvas.Canvas, page_number: int) -> None:
    page_width, _ = A4
    pdf.setStrokeColor(LINE)
    pdf.line(36, 28, page_width - 36, 28)
    pdf.setFillColor(MUTED)
    pdf.setFont("Helvetica", 7.5)
    pdf.drawString(36, 16, "Garden v0.20 R6 - existing R4 solar results, no solar rerun")
    pdf.drawRightString(page_width - 36, 16, str(page_number))


def validate_sources() -> tuple[dict[str, Any], dict[str, Any], list[dict[str, Any]]]:
    if sha256(RESULTS) != EXPECTED_RESULTS_SHA256:
        raise RuntimeError("Adopted R4 result JSON hash changed; report build refused.")
    if sha256(PRESENTATION_MANIFEST) != EXPECTED_MANIFEST_SHA256:
        raise RuntimeError("v0.18 presentation manifest hash changed; report build refused.")

    results = json.loads(RESULTS.read_text(encoding="utf-8"))
    manifest = json.loads(PRESENTATION_MANIFEST.read_text(encoding="utf-8"))
    if manifest.get("status") != "PASS" or manifest.get("authority") != "garden_v0_15_R4_unchanged":
        raise RuntimeError("Presentation manifest does not retain the adopted R4 authority.")
    if manifest.get("seasonal_rerun_performed") is not False:
        raise RuntimeError("Presentation manifest does not prove that no seasonal rerun occurred.")

    validated: list[dict[str, Any]] = []
    for season in SEASONS:
        case_key = f"{season['id']}_B330"
        cases = [row for row in results["analysis_cases"] if row["case_key"] == case_key]
        if len(cases) != 1 or cases[0]["date"] != season["date"]:
            raise RuntimeError(f"Unexpected analysis case for {case_key}.")
        rows = [
            row
            for row in results["zone_summaries"]
            if row["case_key"] == case_key and row["scenario"] == "likely" and row["metric"] == METRIC
        ]
        if len(rows) != 7:
            raise RuntimeError(f"Expected seven adopted likely zone rows for {case_key}; found {len(rows)}.")
        receiver_count = sum(int(row["receiver_count"]) for row in rows)
        if receiver_count != EXPECTED_RECEIVER_COUNT:
            raise RuntimeError(f"Unexpected receiver count for {case_key}: {receiver_count}.")
        weighted_hours = sum(float(row["mean"]) * int(row["receiver_count"]) for row in rows) / receiver_count
        if abs(weighted_hours - float(season["hours"])) > 0.000001:
            raise RuntimeError(f"Unexpected likely whole-field value for {case_key}: {weighted_hours}.")

        records = [
            record
            for record in manifest["season_scenario_maps"]
            if record["season"] == season["id"] and record["scenario"] == "likely" and int(record["bearing"]) == 330
        ]
        if len(records) != 1 or records[0]["filename"] != season["filename"]:
            raise RuntimeError(f"Missing or ambiguous presentation-map record for {case_key} / likely.")
        map_path = SITE / "solar" / "v0_18" / season["filename"]
        map_hash = sha256(map_path)
        if map_hash != season["sha256"]:
            raise RuntimeError(f"Heatmap hash changed for {season['id']}: {map_hash}.")
        validated.append({**season, "case_key": case_key, "receiver_count": receiver_count, "map_path": map_path})
    return results, manifest, validated


def build_pdf(validated: list[dict[str, Any]], output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    pdf = canvas.Canvas(
        str(output),
        pagesize=A4,
        pageCompression=1,
        invariant=1,
    )
    pdf.setTitle("Garden v0.20 R6 - Four-season solar guide")
    pdf.setAuthor("Garden v0.20 R6 report builder")
    pdf.setSubject("Existing likely B330 seasonal solar results; no solar rerun")
    page_width, page_height = A4

    pdf.setFillColor(PAPER)
    pdf.rect(0, 0, page_width, page_height, fill=1, stroke=0)
    pdf.setFillColor(FOREST)
    pdf.rect(0, page_height - 220, page_width, 220, fill=1, stroke=0)
    pdf.setFillColor(SAGE)
    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawString(42, page_height - 54, "GARDEN v0.20 R6")
    pdf.setFillColor(WHITE)
    pdf.setFont("Helvetica-Bold", 29)
    pdf.drawString(42, page_height - 95, "Four-season solar guide")
    pdf.setFont("Helvetica", 15)
    pdf.drawString(42, page_height - 124, "Likely planning case at B330")
    draw_wrapped(
        pdf,
        "These maps estimate useful direct-sun-equivalent light through the year. Neighbouring trees and buildings introduce uncertainty, so this likely case is a practical planning baseline rather than measured reality.",
        42,
        page_height - 158,
        page_width - 84,
        font_size=10.5,
        leading=15,
        colour=colors.HexColor("#dbe5d5"),
    )

    card_width = (page_width - 102) / 2
    card_height = 104
    start_y = page_height - 255
    for index, season in enumerate(validated):
        column = index % 2
        row = index // 2
        x = 42 + column * (card_width + 18)
        y = start_y - row * (card_height + 16) - card_height
        pdf.setFillColor(WHITE)
        pdf.roundRect(x, y, card_width, card_height, 10, fill=1, stroke=0)
        pdf.setFillColor(CLAY)
        pdf.setFont("Helvetica-Bold", 9)
        pdf.drawString(x + 16, y + card_height - 22, season["id"].title())
        pdf.setFillColor(FOREST)
        pdf.setFont("Helvetica-Bold", 25)
        pdf.drawString(x + 16, y + card_height - 54, f"{season['hours']:.2f} h/day")
        pdf.setFillColor(MUTED)
        pdf.setFont("Helvetica", 8)
        pdf.drawString(x + 16, y + 18, "Whole-field average - likely B330")

    y = 320
    pdf.setFillColor(FOREST)
    pdf.setFont("Helvetica-Bold", 15)
    pdf.drawString(42, y, "How to read the maps")
    y = draw_wrapped(
        pdf,
        "All four maps use the same 0 to 9 hours/day scale. Warmer colours indicate more useful direct-sun-equivalent light; cooler colours indicate less. Compare relative patterns and seasons rather than treating a cell as an exact daily promise.",
        42,
        y - 23,
        page_width - 84,
        font_size=10,
        leading=15,
        colour=MUTED,
    )
    pdf.setFillColor(colors.HexColor("#e2e9dc"))
    pdf.roundRect(42, 105, page_width - 84, 95, 10, fill=1, stroke=0)
    pdf.setFillColor(FOREST_MID)
    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawString(58, 177, "Evidence boundary")
    draw_wrapped(
        pdf,
        "This report arranges existing adopted R4 results and existing v0.18 presentation maps. It did not rerun solar analysis. Calculator mode retains the assumptions, alternate scenarios and orientation detail.",
        58,
        158,
        page_width - 116,
        font_size=9.5,
        leading=14,
        colour=INK,
    )
    page_footer(pdf, 1)
    pdf.showPage()

    for page_number, season in enumerate(validated, start=2):
        pdf.setFillColor(PAPER)
        pdf.rect(0, 0, page_width, page_height, fill=1, stroke=0)
        pdf.setFillColor(FOREST)
        pdf.rect(0, page_height - 118, page_width, 118, fill=1, stroke=0)
        pdf.setFillColor(SAGE)
        pdf.setFont("Helvetica-Bold", 9)
        pdf.drawString(42, page_height - 42, "LIKELY PLANNING CASE - B330")
        pdf.setFillColor(WHITE)
        pdf.setFont("Helvetica-Bold", 26)
        pdf.drawString(42, page_height - 78, season["id"].title())
        pdf.setFont("Helvetica", 11)
        pdf.drawRightString(page_width - 42, page_height - 75, f"Whole-field average {season['hours']:.2f} h/day")

        map_x, map_y, map_width, map_height = 70, 150, page_width - 140, page_height - 298
        pdf.setFillColor(colors.HexColor("#101b18"))
        pdf.roundRect(map_x - 8, map_y - 8, map_width + 16, map_height + 16, 11, fill=1, stroke=0)
        fit_image(pdf, season["map_path"], map_x, map_y, map_width, map_height)
        draw_wrapped(
            pdf,
            season["summary"],
            42,
            118,
            page_width - 84,
            font_size=9.5,
            leading=13,
            colour=MUTED,
        )
        pdf.setFillColor(CLAY)
        pdf.setFont("Helvetica", 7)
        pdf.drawString(42, 60, f"Source result: {season['case_key']} / likely / {METRIC} / {season['receiver_count']} receivers")
        pdf.drawString(42, 48, f"Map SHA-256: {season['sha256']}")
        page_footer(pdf, page_number)
        pdf.showPage()

    pdf.setFillColor(PAPER)
    pdf.rect(0, 0, page_width, page_height, fill=1, stroke=0)
    pdf.setFillColor(FOREST)
    pdf.rect(0, page_height - 118, page_width, 118, fill=1, stroke=0)
    pdf.setFillColor(SAGE)
    pdf.setFont("Helvetica-Bold", 9)
    pdf.drawString(42, page_height - 42, "PROVENANCE")
    pdf.setFillColor(WHITE)
    pdf.setFont("Helvetica-Bold", 25)
    pdf.drawString(42, page_height - 79, "Evidence and interpretation boundary")

    y = page_height - 150
    pdf.setFillColor(FOREST)
    pdf.setFont("Helvetica-Bold", 13)
    pdf.drawString(42, y, "Authoritative result source")
    y = draw_wrapped(
        pdf,
        "data/garden_v0_15_solar_results_r4.json",
        42,
        y - 22,
        page_width - 84,
        font_size=8.5,
        leading=12,
        colour=MUTED,
    )
    y = draw_wrapped(pdf, f"SHA-256: {EXPECTED_RESULTS_SHA256}", 42, y - 3, page_width - 84, font_size=8.5, leading=12, colour=INK)
    y -= 15
    pdf.setFillColor(FOREST)
    pdf.setFont("Helvetica-Bold", 13)
    pdf.drawString(42, y, "Presentation-map authority")
    y = draw_wrapped(
        pdf,
        "garden_v0_18/records/garden_v0_18_solar_presentation_manifest_r1.json",
        42,
        y - 22,
        page_width - 84,
        font_size=8.5,
        leading=12,
        colour=MUTED,
    )
    y = draw_wrapped(pdf, f"SHA-256: {EXPECTED_MANIFEST_SHA256}", 42, y - 3, page_width - 84, font_size=8.5, leading=12, colour=INK)
    y = draw_wrapped(pdf, "Manifest status: PASS; authority: garden_v0_15_R4_unchanged; seasonal_rerun_performed: false.", 42, y - 3, page_width - 84, font_size=8.5, leading=12, colour=INK)
    y -= 15
    pdf.setFillColor(FOREST)
    pdf.setFont("Helvetica-Bold", 13)
    pdf.drawString(42, y, "Season records")
    y -= 21
    for season in validated:
        pdf.setFillColor(CLAY)
        pdf.setFont("Helvetica-Bold", 8.5)
        pdf.drawString(42, y, f"{season['id'].title()} - {season['case_key']} - likely B330 - {season['hours']:.6f} h/day")
        y -= 13
        pdf.setFillColor(MUTED)
        pdf.setFont("Helvetica", 7.2)
        pdf.drawString(54, y, season["filename"])
        y -= 11
        pdf.drawString(54, y, season["sha256"])
        y -= 20

    pdf.setFillColor(colors.HexColor("#e2e9dc"))
    pdf.roundRect(42, 77, page_width - 84, 82, 10, fill=1, stroke=0)
    pdf.setFillColor(FOREST_MID)
    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawString(58, 136, "No solar rerun")
    draw_wrapped(
        pdf,
        "The report builder validates frozen hashes and existing seasonal records, then places the existing maps into this PDF. It contains no solar calculation or geometry-generation step.",
        58,
        117,
        page_width - 116,
        font_size=9,
        leading=13,
        colour=INK,
    )
    page_footer(pdf, 6)
    pdf.save()

    # ReportLab writes a four-byte binary marker in an otherwise ASCII-safe PDF.
    # Replacing only that comment marker (with the same byte length) keeps every
    # PDF object/xref offset unchanged and makes the revision artifact portable
    # through the repository's text-only patch boundary.
    content = output.read_bytes()
    binary_marker = b"%\x93\x8c\x8b\x9e"
    ascii_marker = b"%####"
    if content.count(binary_marker) != 1:
        raise RuntimeError("Unexpected PDF binary marker count; report build refused.")
    output.write_bytes(content.replace(binary_marker, ascii_marker, 1))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    output = args.output.resolve()
    _, manifest, validated = validate_sources()
    build_pdf(validated, output)
    result = {
        "status": "PASS",
        "output": str(output),
        "bytes": output.stat().st_size,
        "sha256": sha256(output),
        "pages": 6,
        "seasons": [season["id"] for season in validated],
        "source_results_sha256": EXPECTED_RESULTS_SHA256,
        "source_manifest_sha256": EXPECTED_MANIFEST_SHA256,
        "source_manifest_status": manifest["status"],
        "solar_rerun": False,
    }
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
