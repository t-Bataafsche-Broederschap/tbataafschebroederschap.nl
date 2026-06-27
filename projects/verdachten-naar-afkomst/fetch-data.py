#!/usr/bin/env -S uv run --script
"""
Fetch CBS suspect data by origin.
"""
# /// script
# requires-python = ">=3.13"
# dependencies = [
#     "niquests",
# ]
# ///

from __future__ import annotations

import json
import math
import re
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from urllib.parse import urlencode

import niquests as requests


BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR.parents[2] / "static" / "projects" / "verdachten-naar-herkomst"
CBS_BASE = "https://opendata.cbs.nl/ODataApi/OData"
TABLES = {"legacy": "81959NED", "current": "85658NED"}
CODES = {
    "totalSexLegacy": "T001038",
    "totalSexCurrent": "T001038",
    "totalAgeLegacy": "10000",
    "totalAgeCurrent": "10000",
    "totalGeneration": "T001040",
    "totalBirthCountry": "T001638",
    "totalEducation": "T001143",
    "totalIncome": "T001164",
    "legacyPeriod": "2022JJ00",
}
AGGREGATE_LEGACY_KEYS = {"T001040", "1012600", "2012605", "2012657", "2012655", "1012950", "2012659"}
SESSION = requests.Session()
SESSION.headers.update({"user-agent": "thaumatorium-verdachten-naar-herkomst/1.0"})


def iso_now() -> str:
    return datetime.now(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def fetch_json(url: str) -> Any:
    response = SESSION.get(url, timeout=60)
    response.raise_for_status()
    return response.json()


def fetch_odata(table: str, entity: str, params: dict[str, str] | None = None) -> list[dict[str, Any]]:
    next_url: str | None = f"{CBS_BASE}/{table}/{entity}" + (f"?{urlencode(params)}" if params else "")
    rows: list[dict[str, Any]] = []
    while next_url:
        page = fetch_json(next_url)
        rows.extend(page["value"])
        next_url = page.get("odata.nextLink")
    return rows


def clean_title(title: Any) -> str:
    return re.sub(r"\s+", " ", str(title or "")).strip()


def category_map(rows: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    return {
        str(row.get("Key", "")).strip(): {
            "key": str(row.get("Key", "")).strip(),
            "title": clean_title(row.get("Title")),
            "description": clean_title(row.get("Description")),
            "group": row.get("CategoryGroupID"),
        }
        for row in rows
    }


def year_from_period(period: Any) -> int | None:
    match = re.match(r"^(\d{4})", str(period or ""))
    return int(match.group(1)) if match else None


def status_for_period(period_rows: list[dict[str, Any]], key: str) -> dict[str, Any]:
    period = next((row for row in period_rows if row.get("Key") == key), None)
    return {
        "key": key,
        "year": year_from_period(key),
        "title": (period or {}).get("Title") or str(year_from_period(key)),
        "status": (period or {}).get("Status") or "",
        "description": clean_title((period or {}).get("Description") or ""),
    }


def quantile(values: list[float], q: float) -> float | None:
    sorted_values = sorted(value for value in values if isinstance(value, int | float) and math.isfinite(value))
    if not sorted_values:
        return None
    position = (len(sorted_values) - 1) * q
    base = math.floor(position)
    rest = position - base
    if base + 1 >= len(sorted_values):
        return sorted_values[base]
    return sorted_values[base] + rest * (sorted_values[base + 1] - sorted_values[base])


def estimate_population(suspects_with_dutch_address: Any, suspects_per_10000: Any) -> int | None:
    if isinstance(suspects_with_dutch_address, int | float) and isinstance(suspects_per_10000, int | float) and suspects_per_10000 > 0:
        return round((suspects_with_dutch_address / suspects_per_10000) * 10000)
    return None


def is_finite(value: Any) -> bool:
    return isinstance(value, int | float) and math.isfinite(value)


def build_legacy(period_rows: list[dict[str, Any]]) -> dict[str, Any]:
    migration_categories = category_map(fetch_odata(TABLES["legacy"], "Migratieachtergrond"))
    rows = fetch_odata(
        TABLES["legacy"],
        "TypedDataSet",
        {
            "$filter": " and ".join(
                [
                    f"Geslacht eq '{CODES['totalSexLegacy']}'",
                    f"Leeftijd eq '{CODES['totalAgeLegacy']}'",
                    f"Generatie eq '{CODES['totalGeneration']}'",
                    f"Perioden eq '{CODES['legacyPeriod']}'",
                ]
            ),
            "$select": "Migratieachtergrond,Perioden,TotaalVerdachtenVanMisdrijven_1,VerdachtenMetWoonadresInNederland_2,VerdachtenPer10000Inwoners_3",
        },
    )
    points = []
    for row in rows:
        category = migration_categories.get(str(row.get("Migratieachtergrond", "")).strip())
        if not category:
            continue
        point = {
            "key": category["key"],
            "label": category["title"],
            "group": category["group"],
            "isAggregate": category["key"] in AGGREGATE_LEGACY_KEYS,
            "totalSuspects": row.get("TotaalVerdachtenVanMisdrijven_1"),
            "suspectsWithDutchAddress": row.get("VerdachtenMetWoonadresInNederland_2"),
            "suspectsPer10000": row.get("VerdachtenPer10000Inwoners_3"),
            "populationEstimate": estimate_population(row.get("VerdachtenMetWoonadresInNederland_2"), row.get("VerdachtenPer10000Inwoners_3")),
            "year": 2022,
            "source": TABLES["legacy"],
        }
        if is_finite(point["totalSuspects"]) and point["totalSuspects"] > 0 and is_finite(point["suspectsPer10000"]):
            points.append(point)
    non_aggregate_values = [point["suspectsPer10000"] for point in points if not point["isAggregate"]]
    quartiles = {
        "q1": round(quantile(non_aggregate_values, 0.25)),
        "median": round(quantile(non_aggregate_values, 0.5)),
        "q3": round(quantile(non_aggregate_values, 0.75)),
    }
    return {
        "table": TABLES["legacy"],
        "title": "Verdachten; geslacht, leeftijd, migratieachtergrond en generatie 1999-2022",
        "period": status_for_period(period_rows, CODES["legacyPeriod"]),
        "selection": {"geslacht": "Totaal mannen en vrouwen", "leeftijd": "Totaal", "generatie": "Totaal"},
        "quartiles": quartiles,
        "points": sorted(points, key=lambda row: row["totalSuspects"], reverse=True),
    }


def build_current(period_rows: list[dict[str, Any]]) -> dict[str, Any]:
    herkomst_categories = category_map(fetch_odata(TABLES["current"], "Herkomst"))
    current_periods = [row for row in period_rows if (year_from_period(row.get("Key")) or 0) >= 2022]
    period_filter = " or ".join(f"Perioden eq '{row['Key']}'" for row in current_periods)
    rows = fetch_odata(
        TABLES["current"],
        "TypedDataSet",
        {
            "$filter": " and ".join(
                [
                    "Geslacht eq 'T001038 '",
                    "Leeftijd eq '10000  '",
                    f"Geboorteland eq '{CODES['totalBirthCountry']}'",
                    f"Opleiding eq '{CODES['totalEducation']}'",
                    f"Huishoudensinkomen eq '{CODES['totalIncome']}'",
                    f"({period_filter})",
                ]
            ),
            "$select": "Herkomst,Perioden,TotaalVerdachtenVanMisdrijven_1,TotaalVerdachtenVanMisdrijven_8",
        },
    )
    series = []
    for row in rows:
        category = herkomst_categories.get(str(row.get("Herkomst", "")).strip())
        if not category:
            continue
        period = status_for_period(period_rows, row["Perioden"])
        item = {
            "key": category["key"],
            "label": category["title"],
            "group": category["group"],
            "year": period["year"],
            "status": period["status"],
            "statusDescription": period["description"],
            "totalSuspects": row.get("TotaalVerdachtenVanMisdrijven_1"),
            "suspectsPer10000": row.get("TotaalVerdachtenVanMisdrijven_8"),
            "source": TABLES["current"],
        }
        if is_finite(item["year"]) and is_finite(item["totalSuspects"]) and is_finite(item["suspectsPer10000"]):
            series.append(item)
    return {
        "table": TABLES["current"],
        "title": "Verdachten; geslacht, leeftijd, herkomst, opleiding, huishoudensinkomen",
        "selection": {
            "geslacht": "Totaal mannen en vrouwen",
            "leeftijd": "Totaal",
            "geboorteland": "Totaal",
            "opleiding": "Totaal opleidingen",
            "huishoudensinkomen": "Totaal",
        },
        "periods": [status_for_period(period_rows, row["Key"]) for row in current_periods],
        "series": sorted(series, key=lambda row: (row["year"], -row["totalSuspects"])),
    }


def main() -> None:
    legacy_periods = fetch_odata(TABLES["legacy"], "Perioden")
    current_periods = fetch_odata(TABLES["current"], "Perioden")
    data = {
        "generatedAt": iso_now(),
        "legacy2022": build_legacy(legacy_periods),
        "currentSeries": build_current(current_periods),
        "notes": [
            "Dit bestand bevat CBS-cijfers over geregistreerde verdachten van misdrijven, niet veroordeelden.",
            "81959NED gebruikt de oude migratieachtergrondindeling en heeft de volledige landenlijst voor 2022.",
            "85658NED gebruikt de nieuwe herkomstindeling en loopt tot 2025, maar bevat minder gedetailleerde herkomstpunten.",
        ],
    }
    serialized = json.dumps(data, ensure_ascii=False, indent="\t") + "\n"
    (BASE_DIR / "data.json").write_text(serialized, encoding="utf-8")
    STATIC_DIR.mkdir(parents=True, exist_ok=True)
    (STATIC_DIR / "data.json").write_text(serialized, encoding="utf-8")
    print(f"Wrote {len(data['legacy2022']['points'])} legacy points and {len(data['currentSeries']['series'])} current rows.")


if __name__ == "__main__":
    main()
