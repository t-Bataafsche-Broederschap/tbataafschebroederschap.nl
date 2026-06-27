#!/usr/bin/env -S uv run --script
"""
Fetch CBS StatLine data for the project about birth rates among women of
Dutch origin.
"""
# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "niquests",
# ]
# ///

from __future__ import annotations

import json
import math
import re
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from urllib.parse import urlencode

import niquests as requests


BASE_DIR = Path(__file__).resolve().parent
OUTPUT_FILE = BASE_DIR / "data.json"
ODATA_BASE = "https://opendata.cbs.nl/ODataApi/OData"
BIRTHS_TABLE = "85497NED"
POPULATION_TABLE = "85384NED"
YEARS = [2022, 2023, 2024, 2025]
REPLACEMENT_TFR = 2.1


@dataclass(frozen=True)
class Group:
    id: str
    label: str
    short_label: str
    description: str
    births_filter: str
    population_filter: str
    main: bool = False


GROUPS = [
    Group(
        id="nederlandse_herkomst",
        label="Vrouwen van Nederlandse herkomst",
        short_label="Nederlandse herkomst",
        description="Zelf in Nederland geboren en via CBS-herkomstland Nederland: beide ouders in Nederland geboren.",
        births_filter="HerkomstlandMoeder eq '1012600' and GeboortelandMoeder eq 'A051735'",
        population_filter=(
            "Geslacht eq '4000   ' and BurgerlijkeStaat eq 'T001019' and Herkomstland eq '1012600' "
            "and Geboorteland eq 'A051735' and GeboortelandOuders eq 'A051737'"
        ),
        main=True,
    ),
    Group(
        id="totaal",
        label="Alle vrouwen in Nederland",
        short_label="Totaal",
        description="Totale vrouwelijke bevolking en alle levendgeborenen onder de Nederlandse bevolking.",
        births_filter="HerkomstlandMoeder eq 'T001040' and GeboortelandMoeder eq 'T001638'",
        population_filter=(
            "Geslacht eq '4000   ' and BurgerlijkeStaat eq 'T001019' and Herkomstland eq 'T001040' "
            "and Geboorteland eq 'T001638' and GeboortelandOuders eq 'T001638'"
        ),
    ),
    Group(
        id="herkomst_buiten_nederland",
        label="Vrouwen met herkomst buiten Nederland",
        short_label="Herkomst buiten NL",
        description="Vrouwen met CBS-herkomstland buiten Nederland, ongeacht of zij zelf in Nederland of buiten Nederland geboren zijn.",
        births_filter="HerkomstlandMoeder eq '2012605' and GeboortelandMoeder eq 'T001638'",
        population_filter=(
            "Geslacht eq '4000   ' and BurgerlijkeStaat eq 'T001019' and Herkomstland eq '2012605' "
            "and Geboorteland eq 'T001638' and GeboortelandOuders eq 'T001638'"
        ),
    ),
]


def iso_now() -> str:
    return datetime.now(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def cbs_get(table: str, endpoint: str, params: dict[str, str] | None = None) -> list[dict[str, Any]]:
    url = f"{ODATA_BASE}/{table}/{endpoint}"
    if params:
        url = f"{url}?{urlencode(params)}"

    rows: list[dict[str, Any]] = []
    while url:
        response = requests.get(url, headers={"User-Agent": "tbb-geboortecijfers-nederlandse-herkomst/1.0"}, timeout=90)
        response.raise_for_status()
        payload = response.json()
        rows.extend(payload.get("value", []))
        url = payload.get("odata.nextLink")
    return rows


def category_map(table: str, endpoint: str) -> dict[str, dict[str, Any]]:
    return {row["Key"]: row for row in cbs_get(table, endpoint)}


def year_key(year: int) -> str:
    return f"{year}JJ00"


def exact_population_age(row: dict[str, Any]) -> int | None:
    title = row["Title"]
    if re.fullmatch(r"\d+ jaar", title):
        return int(title.split(" ", 1)[0])
    if title == "100 jaar of ouder":
        return 100
    return None


def birth_age(row: dict[str, Any]) -> int | None:
    title = row["Title"]
    if title == "15 jaar of jonger":
        return 15
    if title == "49 jaar of ouder":
        return 49
    if re.fullmatch(r"\d+ jaar", title):
        return int(title.split(" ", 1)[0])
    return None


def round_or_none(value: float | None, digits: int = 1) -> float | None:
    if value is None or not math.isfinite(value):
        return None
    return round(value, digits)


def population_rows_for(group: Group) -> list[dict[str, Any]]:
    return population_rows_for_sex(group, "4000   ")


def population_rows_for_sex(group: Group, sex_key: str) -> list[dict[str, Any]]:
    population_filter = group.population_filter.replace("Geslacht eq '4000   '", f"Geslacht eq '{sex_key}'")
    return cbs_get(
        POPULATION_TABLE,
        "TypedDataSet",
        {
            "$filter": population_filter,
            "$select": "Leeftijd,Perioden,Bevolking_1",
        },
    )


def birth_rows_for(group: Group) -> list[dict[str, Any]]:
    return cbs_get(
        BIRTHS_TABLE,
        "TypedDataSet",
        {
            "$filter": group.births_filter,
            "$select": "LeeftijdVanDeMoederOp31December,Perioden,LevendGeborenKinderen_1",
        },
    )


def value_by(rows: list[dict[str, Any]], key_field: str, key: str, period: str, value_field: str) -> float:
    for row in rows:
        if row[key_field] == key and row["Perioden"] == period:
            value = row.get(value_field)
            return float(value or 0)
    return 0.0


def sum_population(pop_rows: list[dict[str, Any]], period: str, age_keys: list[str]) -> float:
    return sum(value_by(pop_rows, "Leeftijd", key, period, "Bevolking_1") for key in age_keys)


def avg_population(pop_rows: list[dict[str, Any]], year: int, age_keys: list[str]) -> float:
    return (sum_population(pop_rows, year_key(year), age_keys) + sum_population(pop_rows, year_key(year + 1), age_keys)) / 2


def age_bucket(age: int) -> str:
    if age < 15:
        return "0-14"
    if age < 25:
        return "15-24"
    if age < 35:
        return "25-34"
    if age < 45:
        return "35-44"
    if age < 50:
        return "45-49"
    if age < 65:
        return "50-64"
    return "65+"


def pyramid_bucket(age: int) -> tuple[int, int, str]:
    if age >= 95:
        return 95, 120, "95+"
    start = age - (age % 5)
    end = start + 4
    return start, end, f"{start}-{end}"


def build_age_tree(
    group: Group,
    men_rows: list[dict[str, Any]],
    women_rows: list[dict[str, Any]],
    exact_pop_ages: list[tuple[str, int | None]],
) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    for year in YEARS:
        buckets: dict[str, dict[str, Any]] = {}
        for key, age in exact_pop_ages:
            if age is None:
                continue
            start, end, label = pyramid_bucket(age)
            bucket = buckets.setdefault(
                label,
                {
                    "year": year,
                    "group": group.id,
                    "bucket": label,
                    "startAge": start,
                    "endAge": end,
                    "menAvg": 0.0,
                    "womenAvg": 0.0,
                },
            )
            bucket["menAvg"] += avg_population(men_rows, year, [key])
            bucket["womenAvg"] += avg_population(women_rows, year, [key])
        for bucket in buckets.values():
            men = bucket["menAvg"]
            women = bucket["womenAvg"]
            total = men + women
            result.append(
                {
                    **bucket,
                    "menAvg": round(men),
                    "womenAvg": round(women),
                    "totalAvg": round(total),
                    "womenSharePct": round_or_none(women / total * 100 if total else None, 1),
                }
            )
    return result


def build_group_data(
    group: Group,
    birth_age_rows: dict[str, dict[str, Any]],
    population_age_rows: dict[str, dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    birth_rows = birth_rows_for(group)
    pop_rows = population_rows_for(group)
    men_pop_rows = population_rows_for_sex(group, "3000   ")

    exact_pop_ages = [
        (key, exact_population_age(row))
        for key, row in population_age_rows.items()
        if exact_population_age(row) is not None
    ]
    all_age_keys = [key for key, _age in exact_pop_ages]
    fertile_age_keys = [key for key, age in exact_pop_ages if age is not None and 15 <= age <= 49]
    birth_age_keys = [
        (key, birth_age(row), row["Title"])
        for key, row in birth_age_rows.items()
        if birth_age(row) is not None and row["Key"] != "10000"
    ]

    age_tree = build_age_tree(group, men_pop_rows, pop_rows, exact_pop_ages)
    metrics: list[dict[str, Any]] = []
    age_structure: list[dict[str, Any]] = []
    age_specific: list[dict[str, Any]] = []

    for year in YEARS:
        births_total = value_by(birth_rows, "LeeftijdVanDeMoederOp31December", "10000", year_key(year), "LevendGeborenKinderen_1")
        women_all = avg_population(pop_rows, year, all_age_keys)
        women_15_49 = avg_population(pop_rows, year, fertile_age_keys)
        rate_all = births_total / women_all * 1000 if women_all else None
        rate_15_49 = births_total / women_15_49 * 1000 if women_15_49 else None

        tfr = 0.0
        for birth_key, age, label in birth_age_keys:
            if age is None or not (15 <= age <= 49):
                continue
            pop_key = next((key for key, pop_age in exact_pop_ages if pop_age == age), None)
            if not pop_key:
                continue
            births = value_by(birth_rows, "LeeftijdVanDeMoederOp31December", birth_key, year_key(year), "LevendGeborenKinderen_1")
            women = avg_population(pop_rows, year, [pop_key])
            per_1000 = births / women * 1000 if women else None
            tfr_contribution = per_1000 / 1000 if per_1000 is not None else None
            if per_1000 is not None:
                tfr += tfr_contribution
            age_specific.append(
                {
                    "year": year,
                    "group": group.id,
                    "age": age,
                    "ageLabel": label,
                    "births": round(births),
                    "womenAvg": round(women),
                    "birthsPer1000": round_or_none(per_1000, 2),
                    "tfrContribution": round_or_none(tfr_contribution, 4),
                    "isBoundaryAge": label in {"15 jaar of jonger", "49 jaar of ouder"},
                }
            )

        metrics.append(
            {
                "year": year,
                "group": group.id,
                "geboorten": round(births_total),
                "vrouwen_alles_avg": round(women_all),
                "vrouwen_15_49_avg": round(women_15_49),
                "geboorten_per_1000_alles": round_or_none(rate_all, 2),
                "geboorten_per_1000_15_49": round_or_none(rate_15_49, 2),
                "tfr_benadering": round_or_none(tfr, 3),
                "vervangingsniveau": REPLACEMENT_TFR,
                "vervangingsratio": round_or_none(tfr / REPLACEMENT_TFR if REPLACEMENT_TFR else None, 3),
                "vervangingstekort": round_or_none(REPLACEMENT_TFR - tfr, 3),
                "geboorten_voor_vervanging": round_or_none(births_total * REPLACEMENT_TFR / tfr if tfr else None, 0),
                "extra_geboorten_voor_vervanging": round_or_none((births_total * REPLACEMENT_TFR / tfr - births_total) if tfr else None, 0),
                "ouderdomseffect": round_or_none((rate_15_49 or 0) - (rate_all or 0), 2),
                "ouderdomsfactor": round_or_none((rate_15_49 / rate_all) if rate_all else None, 2),
                "aandeel_15_49": round_or_none(women_15_49 / women_all * 100 if women_all else None, 1),
            }
        )

        buckets: dict[str, float] = {}
        for key, age in exact_pop_ages:
            if age is None:
                continue
            buckets[age_bucket(age)] = buckets.get(age_bucket(age), 0.0) + avg_population(pop_rows, year, [key])
        age_structure.extend(
            {
                "year": year,
                "group": group.id,
                "bucket": bucket,
                "womenAvg": round(value),
                "sharePct": round_or_none(value / women_all * 100 if women_all else None, 1),
            }
            for bucket, value in buckets.items()
        )

    return metrics, age_structure, age_specific, age_tree


def main() -> None:
    birth_age_rows = category_map(BIRTHS_TABLE, "LeeftijdVanDeMoederOp31December")
    population_age_rows = category_map(POPULATION_TABLE, "Leeftijd")
    birth_periods = cbs_get(BIRTHS_TABLE, "Perioden")
    population_periods = cbs_get(POPULATION_TABLE, "Perioden")

    metrics: list[dict[str, Any]] = []
    age_structure: list[dict[str, Any]] = []
    age_specific: list[dict[str, Any]] = []
    age_tree: list[dict[str, Any]] = []
    for group in GROUPS:
        group_metrics, group_age_structure, group_age_specific, group_age_tree = build_group_data(group, birth_age_rows, population_age_rows)
        metrics.extend(group_metrics)
        age_structure.extend(group_age_structure)
        age_specific.extend(group_age_specific)
        age_tree.extend(group_age_tree)

    target_2025 = next(row for row in metrics if row["group"] == "nederlandse_herkomst" and row["year"] == 2025)
    total_2024 = next(row for row in metrics if row["group"] == "totaal" and row["year"] == 2024)
    validations = {
        "targetBirths2025": {
            "expected": 106415,
            "actual": target_2025["geboorten"],
            "passed": target_2025["geboorten"] == 106415,
        },
        "targetRates2025Probe": {
            "expectedApproxAllAges": 16.5,
            "actualAllAges": target_2025["geboorten_per_1000_alles"],
            "expectedApprox15To49": 43.1,
            "actual15To49": target_2025["geboorten_per_1000_15_49"],
            "passed": abs(target_2025["geboorten_per_1000_alles"] - 16.5) < 0.15
            and abs(target_2025["geboorten_per_1000_15_49"] - 43.1) < 0.15,
        },
        "nationalTfr2024OrderOfMagnitude": {
            "cbsPublished": 1.43,
            "actualApprox": total_2024["tfr_benadering"],
            "passed": abs(total_2024["tfr_benadering"] - 1.43) < 0.04,
        },
        "periodStatus": {
            "births2025": next((row.get("Status") for row in birth_periods if row["Key"] == "2025JJ00"), None),
            "population2025": next((row.get("Status") for row in population_periods if row["Key"] == "2025JJ00"), None),
            "population2026": next((row.get("Status") for row in population_periods if row["Key"] == "2026JJ00"), None),
        },
    }

    payload = {
        "fetchedAt": iso_now(),
        "years": YEARS,
        "groups": [
            {
                "id": group.id,
                "label": group.label,
                "shortLabel": group.short_label,
                "description": group.description,
                "main": group.main,
            }
            for group in GROUPS
        ],
        "metrics": sorted(metrics, key=lambda row: (row["group"], row["year"])),
        "ageStructure": sorted(age_structure, key=lambda row: (row["group"], row["year"], row["bucket"])),
        "ageTree": sorted(age_tree, key=lambda row: (row["group"], row["year"], row["startAge"])),
        "ageSpecific": sorted(age_specific, key=lambda row: (row["group"], row["year"], row["age"])),
        "validations": validations,
        "notes": [
            "Gemiddelde bevolking is berekend als de helft van 1 januari in het verslagjaar plus de helft van 1 januari in het volgende jaar.",
            "De TFR-benadering gebruikt openbare CBS-randleeftijden: '15 jaar of jonger' wordt gekoppeld aan 15 jaar en '49 jaar of ouder' aan 49 jaar.",
            f"De vervangingsratio is hier TFR gedeeld door het referentieniveau {REPLACEMENT_TFR:.1f}; 1,00 betekent vervanging, onder 1,00 betekent onder vervanging.",
            "Bij vrouwen van Nederlandse herkomst impliceert CBS-herkomstland Nederland in combinatie met geboren in Nederland dat beide ouders in Nederland geboren zijn.",
        ],
        "sources": {
            "births": f"https://www.cbs.nl/nl-nl/cijfers/detail/{BIRTHS_TABLE}",
            "population": f"https://www.cbs.nl/nl-nl/cijfers/detail/{POPULATION_TABLE}",
        },
    }
    OUTPUT_FILE.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(metrics)} metric rows, {len(age_structure)} age-structure rows and {len(age_specific)} age-specific rows.")


if __name__ == "__main__":
    main()
