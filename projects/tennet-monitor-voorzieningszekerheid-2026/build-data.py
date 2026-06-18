#!/usr/bin/env -S uv run --script
"""
Build the TenneT monitor data bundle from the CSV exports in data/.
"""
# /// script
# requires-python = ">=3.13"
# ///

from __future__ import annotations

import csv
import json
import math
import re
from datetime import UTC, datetime
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
OUTPUT_FILE = BASE_DIR / "data.json"
ADEQUACY_NORM_HOURS = 4
ADEQUACY_NORM_OPTIONS = [1, 2, 4, 8]
DURATION_CURVE_MAX_POINTS = 650

SCENARIO_LABELS = {
    "high-demand": "High Demand",
    "low-demand": "Low Demand",
    "low-demand-europe-sensitivity": "Low Demand Europe sensitivity",
    "reference": "Reference",
}


def read_csv(file: str) -> list[dict[str, str]]:
    with (DATA_DIR / file).open(encoding="utf-8-sig", newline="") as handle:
        return [
            row
            for row in csv.DictReader(handle)
            if any(str(value or "").strip() for value in row.values())
        ]


def csv_files() -> list[str]:
    return sorted(path.name for path in DATA_DIR.iterdir() if path.suffix == ".csv")


def number(value: object) -> float | int | None:
    if value is None or value == "":
        return None
    try:
        parsed = float(str(value).replace(",", "."))
    except ValueError:
        return None
    if not math.isfinite(parsed):
        return None
    return int(parsed) if parsed.is_integer() else parsed


def is_finite(value: object) -> bool:
    return isinstance(value, int | float) and math.isfinite(value)


def normalize_scenario(value: object) -> str:
    text = str(value or "").lower()
    if "europe sensitivity" in text or "whole europe" in text:
        return "low-demand-europe-sensitivity"
    if "high demand" in text:
        return "high-demand"
    if "low demand" in text:
        return "low-demand"
    if text in {"ref", "reference"}:
        return "reference"
    normalized = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    return normalized or "unknown"


def year_from_file(file: str) -> int | None:
    match = re.search(r"(?:^| - )(\d{4,5})(?: - |\.csv$)", file)
    if not match:
        return None
    raw = match.group(1)
    return 2030 if raw == "20230" else int(raw)


def compact_value(value: object) -> object:
    if not is_finite(value):
        return value
    rounded = round(float(value), 3)
    return int(rounded) if rounded.is_integer() else rounded


def downsample(rows: list[dict[str, object]], max_points: int) -> list[dict[str, object]]:
    if len(rows) <= max_points:
        return rows
    step = math.ceil(len(rows) / max_points)
    sampled = [row for index, row in enumerate(rows) if index % step == 0]
    if sampled[-1] is not rows[-1]:
        sampled.append(rows[-1])
    return sampled


def sort_years(row: dict[str, object]) -> tuple[object, str]:
    return (row.get("year") if row.get("year") is not None else -1, str(row.get("scenario") or ""))


def year_from_scenario_code(value: object) -> int | None:
    match = re.search(r"(\d{4})", str(value or ""))
    return int(match.group(1)) if match else None


def build_main_results() -> list[dict[str, object]]:
    by_key: dict[str, dict[str, object]] = {}

    for row in read_csv("Results - Main results - LOLE.csv"):
        year = number(row.get("Year"))
        scenario = normalize_scenario(row.get("ScenarioDetail"))
        by_key[f"{year}:{scenario}"] = {
            "year": year,
            "scenario": scenario,
            "scenarioLabel": SCENARIO_LABELS.get(scenario) or row.get("ScenarioDetail"),
            "lole": number(row.get("LOLE")),
            "eens": None,
        }

    for row in read_csv("Results - Main results - EENS.csv"):
        year = number(row.get("Year"))
        scenario = normalize_scenario(row.get("ScenarioDetail"))
        key = f"{year}:{scenario}"
        item = by_key.get(
            key,
            {
                "year": year,
                "scenario": scenario,
                "scenarioLabel": SCENARIO_LABELS.get(scenario) or row.get("ScenarioDetail"),
                "lole": None,
            },
        )
        item["eens"] = number(row.get("ENS"))
        by_key[key] = item

    return sorted(by_key.values(), key=sort_years)


def build_weather_distributions(files: list[str], warnings: list[str]) -> list[dict[str, object]]:
    items: list[dict[str, object]] = []
    for file in [item for item in files if item.startswith("Results - Distribution across weather scenarios")]:
        metric = "lole" if " - LOLE - " in file else "eens"
        year = year_from_file(file)
        scenario = normalize_scenario(file)
        if "20230" in file:
            warnings.append("Bestandsnaam met jaar 20230 geimporteerd als 2030.")

        for row in read_csv(file):
            items.append(
                {
                    "metric": metric,
                    "year": year,
                    "scenario": scenario,
                    "scenarioLabel": SCENARIO_LABELS.get(scenario) or scenario,
                    "weatherScenario": row.get("WeatherScenario") or row.get("Weather Scenario") or "",
                    "iteration": row.get("Iteration") or "",
                    "value": number(row.get("Sum of ENShours") if row.get("Sum of ENShours") is not None else row.get("Sum of ENS-GW-ifshortage")),
                }
            )
    return sorted(items, key=sort_years)


def build_event_distributions(files: list[str]) -> list[dict[str, object]]:
    items: list[dict[str, object]] = []
    for file in [item for item in files if item.startswith("Results - Event distribution")]:
        year = year_from_file(file)
        scenario = normalize_scenario(file)
        for row in read_csv(file):
            items.append(
                {
                    "year": year,
                    "scenario": scenario,
                    "scenarioLabel": SCENARIO_LABELS.get(scenario) or scenario,
                    "eventSizeGwh": number(row.get("Event size [GWh]")),
                    "durationHours": number(row.get("event_duration")),
                    "count": number(row.get("Count of event_size")),
                }
            )
    return sorted(items, key=sort_years)


def build_duration_curves(files: list[str]) -> list[dict[str, object]]:
    items: list[dict[str, object]] = []
    for file in [item for item in files if item.startswith("Results - ENS duration curve")]:
        scenario = normalize_scenario(file)
        rows_by_year: dict[object, list[dict[str, object]]] = {}
        for row in read_csv(file):
            year = number(row.get("Year"))
            rows_by_year.setdefault(year, []).append(
                {"hour": number(row.get("Hour")), "ensGw": number(row.get("Sum of RegionENSGW"))}
            )

        for year, rows in rows_by_year.items():
            sorted_rows = sorted(
                [row for row in rows if is_finite(row.get("ensGw"))],
                key=lambda row: row.get("hour") if row.get("hour") is not None else -1,
            )
            items.append(
                {
                    "year": year,
                    "scenario": scenario,
                    "scenarioLabel": SCENARIO_LABELS.get(scenario) or scenario,
                    "totalPoints": len(sorted_rows),
                    "points": [
                        {"hour": row["hour"], "ensGw": compact_value(row["ensGw"])}
                        for row in downsample(sorted_rows, DURATION_CURVE_MAX_POINTS)
                    ],
                }
            )
    return sorted(items, key=sort_years)


def append_capacity(
    target: list[dict[str, object]],
    rows: list[dict[str, str]],
    type_label: str,
    value_key: str = "Sum of Value numbers only",
) -> None:
    for row in rows:
        scenario = normalize_scenario(row.get("Scenario") or "high demand")
        target.append(
            {
                "year": number(row.get("Target Year")),
                "scenario": scenario,
                "scenarioLabel": SCENARIO_LABELS.get(scenario) or row.get("Scenario") or "High Demand",
                "type": type_label,
                "category": row.get("Sector") or row.get("Subsector") or row.get("Category") or "",
                "value": number(row.get(value_key)),
            }
        )


def build_system_mix() -> dict[str, list[dict[str, object]]]:
    demand = []
    for row in read_csv("Scenario - Demand - Overview yearly.csv"):
        scenario = normalize_scenario(row.get("Scenario"))
        demand.append(
            {
                "year": number(row.get("Target Year")),
                "scenario": scenario,
                "scenarioLabel": SCENARIO_LABELS.get(scenario) or row.get("Scenario"),
                "sector": row.get("Sector"),
                "value": number(row.get("Sum of Value numbers only")),
            }
        )

    capacity: list[dict[str, object]] = []
    append_capacity(capacity, read_csv("Scenario - Generation - Installed capacity conventional.csv"), "Conventioneel")
    append_capacity(capacity, read_csv("Scenario - Generation - Installed capacity renewable.csv"), "Hernieuwbaar")
    append_capacity(capacity, read_csv("Scenario - Flexibility - Battery capacity.csv"), "Batterijvermogen")
    append_capacity(capacity, read_csv("Scenario - Flexibility - Battery storage volume.csv"), "Batterijopslag")
    append_capacity(capacity, read_csv("Scenario - Flexibility - Power-to-x capacity.csv"), "Power-to-x")
    append_capacity(capacity, read_csv("Scenario - Flexibility  - DSR shifting capacity.csv"), "DSR shifting")
    append_capacity(capacity, read_csv("Scenario - Flexibility - DSR shedding capacity.csv"), "DSR shedding")

    imports: list[dict[str, object]] = []
    for file in [
        "Results - Net import average - High demand.csv",
        "Results - Net import average - Low demand.csv",
        "Results - Net import average - Low demand Europe sensitivity.csv",
    ]:
        for row in read_csv(file):
            scenario = normalize_scenario(row.get("ScenarioDetail") or file)
            imports.append(
                {
                    "year": number(row.get("Year")),
                    "scenario": scenario,
                    "scenarioLabel": SCENARIO_LABELS.get(scenario) or row.get("ScenarioDetail"),
                    "state": row.get("SHortage"),
                    "value": number(row.get("Average of exch-GW")),
                }
            )

    return {
        "demand": sorted(demand, key=sort_years),
        "capacity": sorted(capacity, key=sort_years),
        "imports": sorted(imports, key=sort_years),
    }


def build_weekly_demand(files: list[str]) -> list[dict[str, object]]:
    items: list[dict[str, object]] = []
    for file in [item for item in files if item.startswith("Scenario - Demand - Weekly average")]:
        year = year_from_file(file)
        scenario = normalize_scenario(file)
        for row in read_csv(file):
            week_hour = number(row.get("WeekHour"))
            if not is_finite(week_hour):
                continue
            items.append(
                {
                    "year": year,
                    "scenario": scenario,
                    "scenarioLabel": SCENARIO_LABELS.get(scenario) or scenario,
                    "weekHour": week_hour,
                    "day": math.floor((float(week_hour) - 1) / 24),
                    "hour": (int(week_hour) - 1) % 24,
                    "load": number(row.get("Load")),
                    "nativeLoad": number(row.get("Native Load")),
                }
            )
    return sorted(items, key=lambda row: (row["year"], row["scenario"], row["weekHour"]))


def build_simultaneity() -> list[dict[str, object]]:
    rows = [
        {
            "year": year_from_scenario_code(row.get("Scenario")),
            "objectA": row.get("Object A"),
            "objectB": row.get("Object B"),
            "probability": number(row.get("Probability")),
        }
        for row in read_csv("Results - Simultaneity analysis.csv")
    ]
    return sorted(
        [row for row in rows if is_finite(row.get("year")) and row.get("objectA") and row.get("objectB")],
        key=lambda row: (row["year"], row["objectA"], row["objectB"]),
    )


def build_missing_capacity() -> list[dict[str, object]]:
    items: list[dict[str, object]] = []
    for file in [
        "Results - Missing capacity analysis - 2030 - High demand.csv",
        "Results - Missing capacity analysis - 2035 - High demand.csv",
    ]:
        year = year_from_file(file)
        for row in read_csv(file):
            items.append(
                {
                    "year": year,
                    "scenario": "high-demand",
                    "scenarioLabel": SCENARIO_LABELS["high-demand"],
                    "case": row.get("Scenario"),
                    "iteration": row.get("Iteration") or "",
                    "attribute": row.get("Attribute"),
                    "addedCapacityGw": number(row.get("Average of Value")),
                    "resultingLole": number(row.get("Average of Resulting LOLE") or row.get("Sum of LOLE 2")),
                }
            )
    return sorted(items, key=lambda row: (row["year"], row["case"], row["attribute"]))


def main() -> None:
    files = csv_files()
    warnings: list[str] = []
    data = {
        "meta": {
            "title": "TenneT Monitor Voorzieningszekerheid 2026",
            "generatedAt": datetime.now(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z"),
            "adequacyNormHours": ADEQUACY_NORM_HOURS,
            "adequacyNormOptions": ADEQUACY_NORM_OPTIONS,
            "sourceFiles": files,
            "warnings": warnings,
        },
        "scenarios": [{"key": key, "label": label} for key, label in SCENARIO_LABELS.items()],
        "mainResults": build_main_results(),
        "weatherDistributions": build_weather_distributions(files, warnings),
        "eventDistributions": build_event_distributions(files),
        "durationCurves": build_duration_curves(files),
        "systemMix": build_system_mix(),
        "weeklyDemand": build_weekly_demand(files),
        "simultaneity": build_simultaneity(),
        "missingCapacity": build_missing_capacity(),
    }

    OUTPUT_FILE.write_text(
        json.dumps(data, ensure_ascii=False, indent="\t", separators=(",", ": ")) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
