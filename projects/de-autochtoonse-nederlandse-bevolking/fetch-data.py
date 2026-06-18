#!/usr/bin/env -S uv run --script
"""
Fetch and refresh the data bundle for de autochtoonse Nederlandse bevolking.

This is a native Python entrypoint. It does not shell out to Node or run the old
JavaScript fetcher.
"""
# /// script
# requires-python = ">=3.13"
# dependencies = [
#     "niquests",
# ]
# ///

from __future__ import annotations

import csv
import json
import math
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import niquests as requests


BASE_DIR = Path(__file__).resolve().parent
OUTPUT_FILE = BASE_DIR / "data.json"
CAPACITY_URL = "https://data.partnersinenergie.nl/api/download/voedingsgebieden.csv"

HOUSING_SHORTAGE = [
    {"year": 1947, "shortage": 272000, "percentage": 12.8, "source": "ABF Evaluatie woningtekort / CBS Woningtelling 1947"},
    {"year": 1948, "shortage": 313000, "percentage": None, "source": "ABF Evaluatie woningtekort / Woningtelling 1956"},
    {"year": 1949, "shortage": 308000, "percentage": None, "source": "ABF Evaluatie woningtekort / Woningtelling 1956"},
    {"year": 1950, "shortage": 308000, "percentage": None, "source": "ABF Evaluatie woningtekort / Woningtelling 1956"},
    {"year": 1951, "shortage": 295000, "percentage": None, "source": "ABF Evaluatie woningtekort / Woningtelling 1956"},
    {"year": 1952, "shortage": 283000, "percentage": None, "source": "ABF Evaluatie woningtekort / Woningtelling 1956"},
    {"year": 1953, "shortage": 270000, "percentage": None, "source": "ABF Evaluatie woningtekort / Woningtelling 1956"},
    {"year": 1954, "shortage": 256000, "percentage": None, "source": "ABF Evaluatie woningtekort / Woningtelling 1956"},
    {"year": 1955, "shortage": 251000, "percentage": None, "source": "ABF Evaluatie woningtekort / Woningtelling 1956"},
    {"year": 1956, "shortage": 247000, "percentage": 9.7, "source": "ABF Evaluatie woningtekort / Woningtelling 1956"},
    {"year": 1964, "shortage": 185100, "percentage": None, "source": "ABF Evaluatie woningtekort / CBS Woningbehoefteonderzoek 1965"},
    {"year": 1967, "shortage": 101700, "percentage": None, "source": "ABF Evaluatie woningtekort / Tweede Kamer 1972"},
    {"year": 1970, "shortage": 77100, "percentage": None, "source": "ABF Evaluatie woningtekort / Tweede Kamer 1972"},
    {"year": 1977, "shortage": 82000, "percentage": None, "source": "ABF Evaluatie woningtekort / Tweede Kamer 1984"},
    {"year": 1981, "shortage": 130000, "percentage": 2.6, "source": "ABF Evaluatie woningtekort / Tweede Kamer 1984"},
    {"year": 1985, "shortage": 127000, "percentage": 2.4, "source": "ABF Evaluatie woningtekort / Tweede Kamer 1984"},
    {"year": 1989, "shortage": 127000, "percentage": 2.2, "source": "ABF Evaluatie woningtekort / Tweede Kamer 1991"},
    {"year": 1998, "shortage": 95600, "percentage": None, "source": "ABF Evaluatie woningtekort / WBO 1998"},
    {"year": 2002, "shortage": 166000, "percentage": 2.5, "source": "ABF Evaluatie woningtekort / VROM 2003"},
    {"year": 2006, "shortage": 167000, "percentage": 2.4, "source": "Primos Prognose 2011, ABF Research / BZK"},
    {"year": 2010, "shortage": 139000, "percentage": 1.9, "source": "Primos Prognose 2011, ABF Research / BZK"},
    {"year": 2012, "shortage": 162000, "percentage": 2.2, "source": "Overheid.nl / Primos, ABF"},
    {"year": 2015, "shortage": 134000, "percentage": 1.8, "source": "Overheid.nl / Primos, ABF"},
    {"year": 2017, "shortage": 242000, "percentage": 3.2, "source": "Overheid.nl / Primos, ABF"},
    {"year": 2018, "shortage": 279000, "percentage": 3.6, "source": "Overheid.nl / Primos, ABF"},
    {"year": 2019, "shortage": 294000, "percentage": 3.8, "source": "Overheid.nl / Primos, ABF"},
    {"year": 2020, "shortage": 331000, "percentage": 4.2, "source": "Overheid.nl / Primos, ABF"},
    {"year": 2021, "shortage": 279000, "percentage": 3.5, "source": "Overheid.nl / Primos, ABF"},
    {"year": 2022, "shortage": 315000, "percentage": 3.9, "source": "ABF Research / Primos 2022"},
    {"year": 2023, "shortage": 390000, "percentage": 4.8, "source": "ABF Research / Primos 2023"},
    {"year": 2024, "shortage": 401000, "percentage": 4.9, "source": "ABF Research / VRO, Woningmarktverkenning 2024-2039"},
    {"year": 2025, "shortage": 396000, "percentage": 4.8, "source": "Staat van de Volkshuisvesting 2025 / Primos 2025"},
]

GRID_QUEUE = [
    {"year": 2022, "afnameRequests": 668, "afnameMw": 811, "invoedingRequests": 1991, "invoedingMw": 1278, "source": "Netbeheer Nederland, Stand van de Uitvoering Q1 2025"},
    {"year": 2023, "afnameRequests": 6065, "afnameMw": 3472, "invoedingRequests": 6423, "invoedingMw": 3108, "source": "Netbeheer Nederland, Stand van de Uitvoering Q1 2025"},
    {"year": 2024, "afnameRequests": 11922, "afnameMw": 6739, "invoedingRequests": 8440, "invoedingMw": 4123, "source": "Netbeheer Nederland, Stand van de Uitvoering Q1 2025"},
    {"year": 2025, "afnameRequests": 15014, "afnameMw": 9305, "invoedingRequests": 8687, "invoedingMw": 5027, "source": "Netbeheer Nederland, Feiten en cijfers"},
]


def iso_now() -> str:
    return datetime.now(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def parse_dutch_number(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        parsed = float(str(value).strip().replace(".", "").replace(",", "."))
    except ValueError:
        return None
    return parsed if math.isfinite(parsed) else None


def read_existing_output() -> dict[str, Any]:
    if not OUTPUT_FILE.exists():
        raise FileNotFoundError(
            "data.json is required until the full CBS pipeline is ported; refusing to synthesize a partial dataset."
        )
    return json.loads(OUTPUT_FILE.read_text(encoding="utf-8"))


def fetch_capacity_csv() -> str | None:
    try:
        response = requests.get(CAPACITY_URL, headers={"user-agent": "thaumatorium-de-autochtoonse-nederlander/1.0"}, timeout=60)
        response.raise_for_status()
        return response.text
    except requests.RequestException:
        return None


def parse_capacity_csv(text: str) -> list[dict[str, str]]:
    return list(csv.DictReader(text.splitlines(), delimiter=";"))


def sum_field(rows: list[dict[str, str]], field: str) -> float:
    return sum(parse_dutch_number(row.get(field)) or 0 for row in rows)


def known_capacity_rows(rows: list[dict[str, str]], direction: str) -> list[dict[str, str]]:
    return [
        row
        for row in rows
        if parse_dutch_number(row.get(f"aanwezige_transportcapaciteit_{direction}")) is not None
        and parse_dutch_number(row.get(f"benodigde_transportcapaciteit_{direction}")) is not None
    ]


def aggregate_capacity(rows: list[dict[str, str]], direction: str) -> dict[str, Any]:
    known_rows = known_capacity_rows(rows, direction)
    available_mw = sum_field(known_rows, f"aanwezige_transportcapaciteit_{direction}")
    required_mw = sum_field(known_rows, f"benodigde_transportcapaciteit_{direction}")
    waitlist_mw = sum_field(rows, f"wachtrij_{direction}")
    requests = sum_field(rows, f"unieke_verzoeken_{direction}")
    return {
        "availableMw": round(available_mw, 1),
        "requiredMw": round(required_mw, 1),
        "headroomMw": round(available_mw - required_mw, 1),
        "waitlistMw": round(waitlist_mw, 1),
        "niquests": round(requests),
        "knownAreas": len(known_rows),
        "areasWithWaitlist": len([row for row in rows if (parse_dutch_number(row.get(f"wachtrij_{direction}")) or 0) > 0]),
    }


def aggregate_capacity_by_province(rows: list[dict[str, str]]) -> list[dict[str, Any]]:
    by_province: dict[str, list[dict[str, str]]] = {}
    for row in rows:
        by_province.setdefault(row.get("provincie") or "Onbekend", []).append(row)
    result = [
        {
            "province": province,
            "afname": aggregate_capacity(province_rows, "afname"),
            "invoeding": aggregate_capacity(province_rows, "invoeding"),
        }
        for province, province_rows in by_province.items()
    ]
    return sorted(result, key=lambda row: row["afname"]["waitlistMw"] + row["invoeding"]["waitlistMw"], reverse=True)


def refresh_grid_current(existing: dict[str, Any]) -> dict[str, Any]:
    capacity_csv = fetch_capacity_csv()
    if not capacity_csv:
        return existing.get(
            "gridCurrent",
            {
                "year": 2026,
                "source": "Netbeheer Nederland capaciteitskaart tijdelijk niet beschikbaar; laatst bekende gridCurrent uit data.json ontbreekt ook, daarom zijn null-waarden ingevuld.",
                "afname": {"availableMw": 0, "requiredMw": 0, "headroomMw": 0, "waitlistMw": 0, "niquests": 0, "knownAreas": 0, "areasWithWaitlist": 0},
                "invoeding": {"availableMw": 0, "requiredMw": 0, "headroomMw": 0, "waitlistMw": 0, "niquests": 0, "knownAreas": 0, "areasWithWaitlist": 0},
                "byProvince": [],
            },
        )
    rows = [row for row in parse_capacity_csv(capacity_csv) if row.get("jaar") == "2026"]
    return {
        "year": 2026,
        "source": "Netbeheer Nederland capaciteitskaart, brondata per RNB voedingsgebied",
        "afname": aggregate_capacity(rows, "afname"),
        "invoeding": aggregate_capacity(rows, "invoeding"),
        "byProvince": aggregate_capacity_by_province(rows),
    }


def main() -> None:
    data = read_existing_output()
    data["fetchedAt"] = iso_now()
    data.setdefault("derivedSources", {})["housingShortage"] = HOUSING_SHORTAGE
    data.setdefault("derivedSources", {})["gridQueue"] = GRID_QUEUE
    data["gridCurrent"] = refresh_grid_current(data)
    OUTPUT_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(data.get('timeline', []))} yearly rows and {len(data.get('gridCurrent', {}).get('byProvince', []))} grid province rows.")


if __name__ == "__main__":
    main()
