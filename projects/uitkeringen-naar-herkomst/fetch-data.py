#!/usr/bin/env -S uv run --script
"""
Fetch CBS benefit data and write the project data bundles.
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
STATIC_DIR = BASE_DIR.parents[2] / "static" / "projects" / "uitkeringen-naar-herkomst"
CBS_BASE = "https://opendata.cbs.nl/ODataApi/OData"
PDOK_URL = "https://service.pdok.nl/cbs/gebiedsindelingen/2025/wfs/v1_0?service=WFS&version=2.0.0&request=GetFeature&typeNames=gebiedsindelingen:gemeente_gegeneraliseerd&outputFormat=application/json&count=10000"

TABLES = {
    "benefits": "85692NED",
    "population": "85721NED",
    "regional": "80794NED",
}

CODES = {
    "totalSex": "T001038",
    "totalAgeBenefits": "10000",
    "totalAgePopulation": "10000",
    "totalOrigin": "T001040",
    "dutchOrigin": "1012600",
    "totalParentsBenefits": "T001638",
    "totalParentsPopulation": "T001638",
    "benefitBornInNetherlands": "A051735",
    "benefitBornOutsideNetherlands": "A051736",
    "benefitBornInNetherlandsParentsOutside": "A051742",
    "benefitBornInNetherlandsParentsInNetherlands": "A051760",
    "unknownOrigin": "2012659",
    "unknownParents": "A052139",
    "populationBornInNetherlands": "A051735",
    "populationBornOutsideNetherlands": "A051736",
    "populationTwoParentsBornInNetherlands": "A051737",
    "populationOneParentBornOutside": "A051739",
    "populationTwoParentsBornOutside": "A051740",
    "totalBirthCountryPopulation": "T001638",
    "nationalRegion": "NL01",
}

TOPIC_KEYS = [
    "UitkeringsontvangersTotaal_1",
    "Werkloosheid_2",
    "BijstandEnBijstandsgerelateerdTotaal_3",
    "Bijstandsuitkering_4",
    "ArbeidsongeschiktheidTotaal_7",
    "WAOUitkering_8",
    "WIAUitkeringRegelingWGA_9",
    "WIAUitkeringRegelingIVA_10",
    "WajongUitkering_12",
    "AlgemeneOuderdomswet_13",
]

REGIONAL_TOPIC_MAP = {
    "UitkeringsontvangersTotaal_1": "UitkeringsontvangersTotaal_1",
    "Werkloosheid_2": "Werkloosheid_4",
    "BijstandEnBijstandsgerelateerdTotaal_3": "BijstandGerelateerdTotAOWLeeftijd_5",
    "Bijstandsuitkering_4": "BijstandTotDeAOWLeeftijd_7",
    "ArbeidsongeschiktheidTotaal_7": "ArbeidsongeschiktheidTotaal_8",
    "WAOUitkering_8": "WAOUitkering_9",
    "WIAUitkeringRegelingWGA_9": "WIAUitkeringWGARegeling_10",
    "WajongUitkering_12": "WajongUitkering_11",
    "AlgemeneOuderdomswet_13": "AlgemeneOuderdomswet_12",
}

SESSION = requests.Session()
SESSION.headers.update({"user-agent": "thaumatorium-uitkeringen-naar-herkomst/1.0"})


def iso_now() -> str:
    return datetime.now(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def fetch_json(url: str) -> Any:
    response = SESSION.get(url, timeout=60)
    response.raise_for_status()
    return response.json()


def fetch_odata(table: str, entity: str, params: dict[str, str] | None = None) -> list[dict[str, Any]]:
    query = f"?{urlencode(params)}" if params else ""
    next_url: str | None = f"{CBS_BASE}/{table}/{entity}{query}"
    rows: list[dict[str, Any]] = []
    while next_url:
        page = fetch_json(next_url)
        rows.extend(page["value"])
        next_url = page.get("odata.nextLink")
    return rows


def clean_key(key: Any) -> str:
    return str(key or "").strip()


def clean_title(title: Any) -> str:
    return re.sub(r"\s+", " ", str(title or "")).strip()


def category_map(rows: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    return {
        clean_key(row.get("Key")): {
            "key": clean_key(row.get("Key")),
            "title": clean_title(row.get("Title")),
            "group": row.get("CategoryGroupID"),
        }
        for row in rows
    }


def period_date(period: Any) -> str | None:
    match = re.match(r"^(\d{4})MM(\d{2})$", str(period or ""))
    return f"{match.group(1)}-{match.group(2)}-01" if match else None


def parse_value(value: Any) -> float | int | None:
    if isinstance(value, int | float):
        return value if math.isfinite(value) else None
    cleaned = str(value if value is not None else "").strip()
    if not cleaned or cleaned == ".":
        return None
    try:
        parsed = float(cleaned)
    except ValueError:
        return None
    if not math.isfinite(parsed):
        return None
    return int(parsed) if parsed.is_integer() else parsed


def is_finite(value: Any) -> bool:
    return isinstance(value, int | float) and math.isfinite(value)


def is_municipality_code(code: str) -> bool:
    return re.match(r"^GM\d{4}$", code) is not None


def region_level(code: str) -> str:
    if code == "NL01":
        return "Nederland"
    if code.startswith("LD"):
        return "Landsdeel"
    if code.startswith("PV"):
        return "Provincie"
    if code.startswith("GM"):
        return "Gemeente"
    return "Overig"


def compact_feature(feature: dict[str, Any]) -> dict[str, Any]:
    properties = feature.get("properties") or {}
    return {
        "type": "Feature",
        "properties": {
            "code": clean_key(properties.get("statcode")),
            "name": clean_title(properties.get("statnaam")),
        },
        "geometry": feature.get("geometry"),
    }


def encode_combo(sex: Any, age: Any, origin: Any, parents: Any, period: Any) -> str:
    return "|".join(clean_key(value) for value in [sex, age, origin, parents, period])


def status_for_period(period_rows: list[dict[str, Any]], key: str) -> dict[str, Any]:
    period = next((row for row in period_rows if clean_key(row.get("Key")) == clean_key(key)), None)
    return {
        "key": clean_key(key),
        "date": period_date(key),
        "title": clean_title((period or {}).get("Title") or key),
        "status": clean_title((period or {}).get("Status") or ""),
    }


def latest_definitive_period(period_rows: list[dict[str, Any]]) -> str:
    definitive = [row for row in period_rows if clean_title(row.get("Status")) == "Definitief"]
    return clean_key((definitive[-1] if definitive else period_rows[-1])["Key"])


def recent_monthly_periods(benefit_periods: list[dict[str, Any]], population_periods: list[dict[str, Any]]) -> list[str]:
    population_keys = {clean_key(row.get("Key")) for row in population_periods}
    return [
        key
        for key in [clean_key(row.get("Key")) for row in benefit_periods]
        if key in population_keys and period_date(key) and key >= "2022MM01"
    ][-48:]


def fetch_period_batches(table: str, entity: str, periods: list[str], filter_text: str | None, select: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for period in periods:
        combined_filter = f"{filter_text} and Perioden eq '{period}'" if filter_text else f"Perioden eq '{period}'"
        rows.extend(fetch_odata(table, entity, {"$filter": combined_filter, "$select": select}))
    return rows


def or_filter(field: str, values: list[str]) -> str:
    return "(" + " or ".join(f"{field} eq '{value}'" for value in values) + ")"


def age_to_number(code: str) -> float | int | None:
    if code == "10010":
        return 0
    try:
        value = int(code)
    except ValueError:
        return None
    if 10100 <= value <= 19900:
        return round(value / 100) - 100
    if code in {"22000", "22200", "72000"}:
        return 100
    if 70000 <= value <= 71900:
        return ((value - 70000) / 100) * 5
    return None


def aow_age_for_period(period: str) -> int:
    year = int(str(period)[:4])
    if year <= 2027:
        return 67
    return 68


def benefit_age_includes(age_code: str, benefit_age: str, period: str) -> bool:
    if benefit_age == CODES["totalAgeBenefits"]:
        return clean_key(age_code) == CODES["totalAgeBenefits"]
    if clean_key(age_code) == CODES["totalAgeBenefits"]:
        return False
    age = age_to_number(age_code)
    if not is_finite(age):
        return False
    aow_age = aow_age_for_period(period)
    return {
        "90210": age < aow_age,
        "41600": age < 27,
        "53050": 15 <= age < 25,
        "53400": 25 <= age < 27,
        "53610": 27 <= age < 45,
        "53600": 27 <= age < 35,
        "53700": 35 <= age < 45,
        "90150": 45 <= age < aow_age,
        "53800": 45 <= age < 55,
        "90170": 55 <= age < aow_age,
        "90200": age >= aow_age,
        "90230": aow_age <= age < 75,
        "53975": 75 <= age < 85,
        "21800": age >= 85,
    }.get(benefit_age, False)


def population_parents_matches(row: dict[str, Any], benefit_parent: str) -> bool:
    birth_country = clean_key(row.get("Geboorteland"))
    parents = clean_key(row.get("GeboortelandOuders"))
    if benefit_parent == CODES["totalParentsBenefits"]:
        return birth_country == CODES["totalBirthCountryPopulation"] and parents == CODES["totalParentsPopulation"]
    if benefit_parent == CODES["benefitBornInNetherlands"]:
        return birth_country == CODES["populationBornInNetherlands"] and parents == CODES["totalParentsPopulation"]
    if benefit_parent == CODES["benefitBornOutsideNetherlands"]:
        return birth_country == CODES["populationBornOutsideNetherlands"] and parents == CODES["totalParentsPopulation"]
    if benefit_parent == CODES["benefitBornInNetherlandsParentsOutside"]:
        return birth_country == CODES["populationBornInNetherlands"] and parents in {
            CODES["populationOneParentBornOutside"],
            CODES["populationTwoParentsBornOutside"],
        }
    if benefit_parent == CODES["benefitBornInNetherlandsParentsInNetherlands"]:
        return birth_country == CODES["populationBornInNetherlands"] and parents == CODES["populationTwoParentsBornInNetherlands"]
    return False


def build_population_by_combo(
    population_rows: list[dict[str, Any]],
    periods: list[str],
    benefit_ages: list[str],
    benefit_parents: list[str],
) -> dict[str, float | int]:
    result: dict[str, float | int] = {}
    for row in population_rows:
        period = clean_key(row.get("Perioden"))
        if period not in periods:
            continue
        value = parse_value(row.get("BevolkingOpDeEersteVanDeMaand_1"))
        if not is_finite(value):
            continue
        for age in benefit_ages:
            if not benefit_age_includes(clean_key(row.get("Leeftijd")), age, period):
                continue
            for parents in benefit_parents:
                if not population_parents_matches(row, parents):
                    continue
                key = encode_combo(row.get("Geslacht"), age, row.get("Herkomstland"), parents, period)
                result[key] = result.get(key, 0) + value
    return result


def rows_to_options(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [{"key": clean_key(row.get("Key")), "label": clean_title(row.get("Title")), "group": row.get("CategoryGroupID")} for row in rows]


def topic_options(data_properties: list[dict[str, Any]]) -> list[dict[str, Any]]:
    titles = {row["Key"]: clean_title(row.get("Title")) for row in data_properties if row.get("Type") == "Topic"}
    return [{"key": key, "label": titles.get(key) or key} for key in TOPIC_KEYS]


def row_to_national_record(row: dict[str, Any], population_by_combo: dict[str, Any], meta: dict[str, Any]) -> dict[str, Any] | None:
    key = encode_combo(row.get("Geslacht"), row.get("Leeftijd"), row.get("Herkomstland"), row.get("GeboortelandOuders"), row.get("Perioden"))
    population = population_by_combo.get(key)
    record = {
        "period": clean_key(row.get("Perioden")),
        "date": period_date(row.get("Perioden")),
        "sex": clean_key(row.get("Geslacht")),
        "age": clean_key(row.get("Leeftijd")),
        "origin": clean_key(row.get("Herkomstland")),
        "parents": clean_key(row.get("GeboortelandOuders")),
        "population": population,
        "values": {},
    }
    for topic in TOPIC_KEYS:
        recipients = parse_value(row.get(topic))
        record["values"][topic] = {
            "recipients": recipients,
            "per1000": (recipients / population) * 1000 if recipients is not None and population and population > 0 else None,
        }
    missing_topics = all(value["recipients"] is None for value in record["values"].values())
    if missing_topics or record["origin"] not in meta["originLabels"] or record["parents"] not in meta["parentLabels"]:
        return None
    return record


def build_national() -> dict[str, Any]:
    benefit_periods = fetch_odata(TABLES["benefits"], "Perioden")
    population_periods = fetch_odata(TABLES["population"], "Perioden")
    benefit_topics = fetch_odata(TABLES["benefits"], "DataProperties")
    sexes = fetch_odata(TABLES["benefits"], "Geslacht")
    ages = fetch_odata(TABLES["benefits"], "Leeftijd")
    origins = fetch_odata(TABLES["benefits"], "Herkomstland")
    parents = fetch_odata(TABLES["benefits"], "GeboortelandOuders")

    periods = recent_monthly_periods(benefit_periods, population_periods)
    benefit_age_keys = [clean_key(row.get("Key")) for row in ages if clean_key(row.get("Key")) != "99999"]
    comparison_parent_keys = [
        CODES["benefitBornOutsideNetherlands"],
        CODES["benefitBornInNetherlandsParentsOutside"],
        CODES["benefitBornInNetherlandsParentsInNetherlands"],
    ]
    benefit_parent_keys = comparison_parent_keys
    sex_keys = [clean_key(row.get("Key")) for row in sexes]
    origin_keys = [clean_key(row.get("Key")) for row in origins if clean_key(row.get("Key")) != CODES["unknownOrigin"]]

    benefit_rows = fetch_period_batches(
        TABLES["benefits"],
        "TypedDataSet",
        periods,
        " and ".join(
            [
                or_filter("Geslacht", sex_keys),
                or_filter("Leeftijd", benefit_age_keys),
                or_filter("Herkomstland", origin_keys),
                or_filter("GeboortelandOuders", benefit_parent_keys),
            ]
        ),
        ",".join(["Geslacht", "Leeftijd", "Herkomstland", "GeboortelandOuders", "Perioden", *TOPIC_KEYS]),
    )

    population_rows: list[dict[str, Any]] = []
    for birth_country in [
        CODES["totalBirthCountryPopulation"],
        CODES["populationBornInNetherlands"],
        CODES["populationBornOutsideNetherlands"],
    ]:
        population_rows.extend(
            fetch_period_batches(
                TABLES["population"],
                "TypedDataSet",
                periods,
                " and ".join(
                    [
                        f"Geboorteland eq '{birth_country}'",
                        or_filter("Geslacht", sex_keys),
                        or_filter("Herkomstland", origin_keys),
                        or_filter(
                            "GeboortelandOuders",
                            [
                                CODES["totalParentsPopulation"],
                                CODES["populationTwoParentsBornInNetherlands"],
                                CODES["populationOneParentBornOutside"],
                                CODES["populationTwoParentsBornOutside"],
                            ],
                        ),
                    ]
                ),
                "Geslacht,Leeftijd,Herkomstland,Geboorteland,GeboortelandOuders,Perioden,BevolkingOpDeEersteVanDeMaand_1",
            )
        )

    origin_labels = category_map(origins)
    parent_labels = category_map(parents)
    population_by_combo = build_population_by_combo(population_rows, periods, benefit_age_keys, benefit_parent_keys)
    records = [
        record
        for row in benefit_rows
        if (record := row_to_national_record(row, population_by_combo, {"originLabels": origin_labels, "parentLabels": parent_labels}))
    ]

    valid_periods = []
    for period in periods:
        reference = next(
            (
                row
                for row in records
                if row["period"] == period
                and row["sex"] == CODES["totalSex"]
                and row["age"] == CODES["totalAgeBenefits"]
                and row["origin"] == CODES["dutchOrigin"]
                and row["parents"] == CODES["benefitBornInNetherlandsParentsInNetherlands"]
            ),
            None,
        )
        if reference and reference["population"] and reference["values"]["UitkeringsontvangersTotaal_1"]["recipients"] is not None:
            valid_periods.append(period)
    if not valid_periods:
        raise RuntimeError("Missing Dutch reference group for all fetched periods.")
    valid_period_set = set(valid_periods)

    return {
        "table": TABLES["benefits"],
        "populationTable": TABLES["population"],
        "periods": [status_for_period(benefit_periods, period) for period in valid_periods],
        "defaults": {
            "period": valid_periods[-1],
            "sex": CODES["totalSex"],
            "age": CODES["totalAgeBenefits"],
            "origin": CODES["dutchOrigin"],
            "parents": CODES["benefitBornInNetherlandsParentsInNetherlands"],
            "referenceOrigin": CODES["dutchOrigin"],
            "referenceParents": CODES["benefitBornInNetherlandsParentsInNetherlands"],
            "totalOrigin": CODES["totalOrigin"],
            "totalParents": CODES["totalParentsBenefits"],
            "comparisonParents": comparison_parent_keys,
            "topic": "UitkeringsontvangersTotaal_1",
        },
        "dimensions": {
            "sexes": rows_to_options(sexes),
            "ages": rows_to_options(ages),
            "origins": [row for row in rows_to_options(origins) if row["key"] != CODES["unknownOrigin"]],
            "parents": [row for row in rows_to_options(parents) if row["key"] in comparison_parent_keys],
            "topics": topic_options(benefit_topics),
        },
        "records": [row for row in records if row["period"] in valid_period_set],
    }


def build_regional() -> dict[str, Any]:
    period_rows = fetch_odata(TABLES["regional"], "Perioden")
    region_rows = fetch_odata(TABLES["regional"], "RegioS")
    data_properties = fetch_odata(TABLES["regional"], "DataProperties")
    boundaries = fetch_json(PDOK_URL)
    period = latest_definitive_period(period_rows)
    regional_select = ",".join(["RegioS", "Perioden", *dict.fromkeys(REGIONAL_TOPIC_MAP.values())])
    rows = fetch_odata(TABLES["regional"], "TypedDataSet", {"$filter": f"Perioden eq '{period}'", "$select": regional_select})
    region_names = category_map(region_rows)
    values = []
    for row in rows:
        code = clean_key(row.get("RegioS"))
        region = region_names.get(code)
        if not region:
            continue
        item = {
            "code": code,
            "name": region["title"],
            "level": region_level(code),
            "values": {national_topic: parse_value(row.get(regional_topic)) for national_topic, regional_topic in REGIONAL_TOPIC_MAP.items()},
        }
        if item["level"] in {"Nederland", "Landsdeel", "Provincie", "Gemeente"}:
            values.append(item)

    municipality_codes = {row["code"] for row in values if is_municipality_code(row["code"])}
    features = [
        compact_feature(feature)
        for feature in boundaries.get("features", [])
        if clean_key((feature.get("properties") or {}).get("statcode")) in municipality_codes
    ]

    return {
        "table": TABLES["regional"],
        "period": status_for_period(period_rows, period),
        "topics": [topic for topic in topic_options(data_properties) if topic["key"] in REGIONAL_TOPIC_MAP],
        "regionalTopicMap": REGIONAL_TOPIC_MAP,
        "values": values,
        "geojson": {"type": "FeatureCollection", "features": features},
    }


def main() -> None:
    national = build_national()
    regional = build_regional()
    data = {
        "metadata": {
            "generatedAt": iso_now(),
            "sources": [
                "https://opendata.cbs.nl/ODataApi/OData/85692NED",
                "https://opendata.cbs.nl/ODataApi/OData/85721NED",
                "https://opendata.cbs.nl/ODataApi/OData/80794NED",
                "https://service.pdok.nl/cbs/gebiedsindelingen/2025/wfs/v1_0",
            ],
            "note": "Nationale cijfers bevatten herkomst, leeftijd en geslacht; regionale cijfers bevatten geen herkomstuitsplitsing.",
        },
        "national": national,
        "regional": regional,
    }
    serialized = json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n"
    (BASE_DIR / "data.json").write_text(serialized, encoding="utf-8")
    STATIC_DIR.mkdir(parents=True, exist_ok=True)
    (STATIC_DIR / "data.json").write_text(serialized, encoding="utf-8")
    print(f"Wrote {national['records'].__len__():,} national rows and {regional['values'].__len__():,} regional rows.".replace(",", "."))
    print(f"National periods: {national['periods'][0]['key']} through {national['periods'][-1]['key']}. Regional period: {regional['period']['key']}.")
    print(f"Map features: {regional['geojson']['features'].__len__():,}.".replace(",", "."))


if __name__ == "__main__":
    main()
