#!/usr/bin/env -S uv run --script
"""
Fetch CBS municipality migration-background data.
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
CBS_BASE = "https://opendata.cbs.nl/ODataApi/OData/85458NED"
PDOK_URL = "https://service.pdok.nl/cbs/gebiedsindelingen/2025/wfs/v1_0?service=WFS&version=2.0.0&request=GetFeature&typeNames=gebiedsindelingen:gemeente_gegeneraliseerd&outputFormat=application/json&count=10000"
PERIODS = ["2022JJ00", "2023JJ00", "2024JJ00", "2025JJ00"]
DIMENSIONS = {
    "sexTotal": "T001038",
    "ageTotal": "10000",
    "originTotal": "T001040",
    "birthTotal": "T001638",
    "originNetherlands": "1012600",
    "originEuropeExceptNetherlands": "H007933",
    "originOutsideEurope": "H008859",
    "bornInsideNetherlands": "A051735",
    "bornOutsideNetherlands": "A051736",
}
METRICS = [
    {"id": "buiten-europa-geboren-buiten-nl", "label": "Buiten Nederland geboren, buiten-Europese herkomst", "shortLabel": "Buiten Europa, geboren buiten Nederland", "description": "Personen die buiten Nederland zijn geboren en een buiten-Europese herkomst hebben.", "herkomstland": DIMENSIONS["originOutsideEurope"], "geboorteland": DIMENSIONS["bornOutsideNetherlands"], "leeftijd": DIMENSIONS["ageTotal"]},
    {"id": "herkomst-buiten-europa", "label": "Herkomstland buiten Europa", "shortLabel": "Herkomst buiten Europa", "description": "Alle inwoners met een herkomstland buiten Europa, ongeacht geboorteland.", "herkomstland": DIMENSIONS["originOutsideEurope"], "geboorteland": DIMENSIONS["birthTotal"], "leeftijd": DIMENSIONS["ageTotal"]},
    {"id": "herkomst-europa-excl-nl", "label": "Herkomstland Europa exclusief Nederland", "shortLabel": "Herkomst Europa exclusief Nederland", "description": "Alle inwoners met een herkomstland in Europa, exclusief Nederland.", "herkomstland": DIMENSIONS["originEuropeExceptNetherlands"], "geboorteland": DIMENSIONS["birthTotal"], "leeftijd": DIMENSIONS["ageTotal"]},
    {"id": "geboren-buiten-nl", "label": "Geboren buiten Nederland", "shortLabel": "Geboren buiten Nederland", "description": "Alle inwoners die buiten Nederland zijn geboren, ongeacht herkomstland.", "herkomstland": DIMENSIONS["originTotal"], "geboorteland": DIMENSIONS["bornOutsideNetherlands"], "leeftijd": DIMENSIONS["ageTotal"]},
    {"id": "geboren-in-nl-herkomst-buiten-europa", "label": "Geboren in Nederland, buiten-Europese herkomst", "shortLabel": "Geboren in Nederland, buiten-Europa", "description": "Inwoners die in Nederland zijn geboren en een buiten-Europese herkomst hebben.", "herkomstland": DIMENSIONS["originOutsideEurope"], "geboorteland": DIMENSIONS["bornInsideNetherlands"], "leeftijd": DIMENSIONS["ageTotal"]},
    {"id": "herkomst-nederland", "label": "Herkomstland Nederland", "shortLabel": "Herkomst Nederland", "description": "Inwoners met herkomstland Nederland.", "herkomstland": DIMENSIONS["originNetherlands"], "geboorteland": DIMENSIONS["birthTotal"], "leeftijd": DIMENSIONS["ageTotal"]},
]

SESSION = requests.Session()
SESSION.headers.update({"user-agent": "thaumatorium-migratieachtergrond-gemeenten/1.0"})


def iso_now() -> str:
    return datetime.now(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def fetch_json(url: str) -> Any:
    response = SESSION.get(url, timeout=60)
    response.raise_for_status()
    return response.json()


def fetch_odata(entity: str, params: dict[str, str] | None = None) -> list[dict[str, Any]]:
    next_url: str | None = f"{CBS_BASE}/{entity}" + (f"?{urlencode(params)}" if params else "")
    rows: list[dict[str, Any]] = []
    while next_url:
        page = fetch_json(next_url)
        rows.extend(page["value"])
        next_url = page.get("odata.nextLink")
    return rows


def year_from_period(period: str) -> int | None:
    match = re.match(r"^(\d{4})", str(period))
    return int(match.group(1)) if match else None


def clean_region_code(code: Any) -> str:
    return str(code or "").strip()


def is_municipality_code(code: str) -> bool:
    return re.match(r"^GM\d{4}$", clean_region_code(code)) is not None


def is_finite(value: Any) -> bool:
    return isinstance(value, int | float) and math.isfinite(value)


def fetch_metric_rows(metric: dict[str, str]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for period in PERIODS:
        filter_text = " and ".join(
            [
                f"Geslacht eq '{DIMENSIONS['sexTotal']}'",
                f"Leeftijd eq '{metric.get('leeftijd', DIMENSIONS['ageTotal'])}'",
                f"Herkomstland eq '{metric['herkomstland']}'",
                f"Geboorteland eq '{metric['geboorteland']}'",
                f"Perioden eq '{period}'",
                "substringof('GM',RegioS)",
            ]
        )
        rows.extend(fetch_odata("TypedDataSet", {"$filter": filter_text, "$select": "RegioS,Perioden,Bevolking_1"}))
    return rows


def fetch_national_numerator_2025() -> Any:
    rows = fetch_odata(
        "TypedDataSet",
        {
            "$filter": " and ".join(
                [
                    f"Geslacht eq '{DIMENSIONS['sexTotal']}'",
                    f"Leeftijd eq '{DIMENSIONS['ageTotal']}'",
                    f"Herkomstland eq '{DIMENSIONS['originOutsideEurope']}'",
                    f"Geboorteland eq '{DIMENSIONS['bornOutsideNetherlands']}'",
                    "RegioS eq 'NL01  '",
                    "Perioden eq '2025JJ00'",
                ]
            ),
            "$select": "RegioS,Perioden,Bevolking_1",
        },
    )
    return rows[0].get("Bevolking_1") if rows else None


def rows_by_region_year(rows: list[dict[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for row in rows:
        code = clean_region_code(row.get("RegioS"))
        year = year_from_period(row.get("Perioden"))
        if not is_municipality_code(code) or not year or not is_finite(row.get("Bevolking_1")):
            continue
        result[f"{code}:{year}"] = row["Bevolking_1"]
    return result


def compact_feature(feature: dict[str, Any]) -> dict[str, Any]:
    properties = feature.get("properties") or {}
    return {
        "type": "Feature",
        "properties": {"code": properties.get("statcode"), "name": properties.get("statnaam")},
        "geometry": feature.get("geometry"),
    }


def main() -> None:
    region_rows = fetch_odata("RegioS")
    total_rows = fetch_metric_rows({"herkomstland": DIMENSIONS["originTotal"], "geboorteland": DIMENSIONS["birthTotal"], "leeftijd": DIMENSIONS["ageTotal"]})
    metric_rows = [(metric["id"], rows_by_region_year(fetch_metric_rows(metric))) for metric in METRICS]
    boundaries = fetch_json(PDOK_URL)
    national_numerator_2025 = fetch_national_numerator_2025()

    region_names = {clean_region_code(row["Key"]): row["Title"] for row in region_rows if is_municipality_code(row["Key"])}
    total_by_region_year = rows_by_region_year(total_rows)
    metric_rows_by_id = dict(metric_rows)

    raw_municipalities = []
    for code, name in region_names.items():
        years = {}
        for period in PERIODS:
            year = year_from_period(period)
            total_population = total_by_region_year.get(f"{code}:{year}")
            metric_values = {}
            for metric in METRICS:
                count = metric_rows_by_id.get(metric["id"], {}).get(f"{code}:{year}")
                percentage = (count / total_population) * 100 if total_population and is_finite(count) else None
                metric_values[metric["id"]] = {"count": count, "percentage": percentage}
            years[str(year)] = {"totalPopulation": total_population, "metrics": metric_values}
        if any(is_finite(row["metrics"][metric["id"]]["percentage"]) for row in years.values() for metric in METRICS):
            raw_municipalities.append({"code": code, "name": name, "years": years})
    raw_municipalities.sort(key=lambda row: row["name"])

    raw_codes = {row["code"] for row in raw_municipalities}
    features = [compact_feature(feature) for feature in boundaries.get("features", []) if (feature.get("properties") or {}).get("statcode") in raw_codes]
    feature_codes = {feature["properties"]["code"] for feature in features}
    municipalities = [row for row in raw_municipalities if row["code"] in feature_codes]
    omitted_no_boundary_codes = [row["code"] for row in raw_municipalities if row["code"] not in feature_codes]

    output = {
        "metadata": {
            "generatedAt": iso_now(),
            "cbsTable": "85458NED",
            "mapYear": 2025,
            "periods": [{"key": period, "year": year_from_period(period)} for period in PERIODS],
            "defaultMetric": "buiten-europa-geboren-buiten-nl",
            "metrics": [
                {
                    "id": metric["id"],
                    "label": metric["label"],
                    "shortLabel": metric["shortLabel"],
                    "description": metric["description"],
                    "numerator": {
                        "Geslacht": DIMENSIONS["sexTotal"],
                        "Leeftijd": metric["leeftijd"],
                        "Herkomstland": metric["herkomstland"],
                        "Geboorteland": metric["geboorteland"],
                    },
                    "denominator": {
                        "Geslacht": DIMENSIONS["sexTotal"],
                        "Leeftijd": DIMENSIONS["ageTotal"],
                        "Herkomstland": DIMENSIONS["originTotal"],
                        "Geboorteland": DIMENSIONS["birthTotal"],
                    },
                }
                for metric in METRICS
            ],
            "sources": [
                "https://www.vzinfo.nl/bevolking/regionaal/migratieachtergrond",
                "https://opendata.cbs.nl/ODataApi/OData/85458NED",
                "https://service.pdok.nl/cbs/gebiedsindelingen/2025/wfs/v1_0",
            ],
            "omittedNoBoundaryCodes": omitted_no_boundary_codes,
            "nationalNumerator2025": national_numerator_2025,
        },
        "municipalities": municipalities,
        "geojson": {"type": "FeatureCollection", "features": features},
    }
    (BASE_DIR / "data.json").write_text(json.dumps(output, ensure_ascii=False, indent="\t") + "\n", encoding="utf-8")
    print(f"Wrote {len(municipalities)} municipalities and {len(features)} boundary features.")
    if omitted_no_boundary_codes:
        print(f"Omitted rows without 2025 boundary: {', '.join(omitted_no_boundary_codes)}")
    print(f"Sanity: national 2025 numerator {national_numerator_2025 if national_numerator_2025 is not None else 'not fetched'}.")


if __name__ == "__main__":
    main()
