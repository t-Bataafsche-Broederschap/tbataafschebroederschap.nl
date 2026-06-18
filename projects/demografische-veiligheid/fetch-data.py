#!/usr/bin/env -S uv run --script
"""
Fetch CBS demographic safety data.
"""
# /// script
# requires-python = ">=3.13"
# dependencies = [
#     "niquests",
# ]
# ///

from __future__ import annotations

import json
import re
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from urllib.parse import urlencode

import niquests as requests


BASE_DIR = Path(__file__).resolve().parent
TABLES = {"demographic": "85844NED"}
PERIOD = "2025JJ00"
VALUE_MARGIN = "MW00000"
METRICS = [
    {"key": "socialCohesion", "sourceKey": "SocialeCohesieSchaalscore_15", "label": "Sociale cohesie", "shortLabel": "Cohesie", "unit": "score", "direction": "higher-better", "description": "Schaalscore van sociale cohesie in de woonbuurt."},
    {"key": "neighborhoodUnsafe", "sourceKey": "VoeltZichWeleensOnveiligInBuurt_50", "label": "Onveilig in buurt", "shortLabel": "Buurt-onveiligheid", "unit": "%", "direction": "higher-worse", "description": "Aandeel 15-plussers dat zich weleens onveilig voelt in de eigen buurt."},
    {"key": "generalUnsafe", "sourceKey": "VoeltZichWeleensOnveilig_43", "label": "Onveilig algemeen", "shortLabel": "Algemeen onveilig", "unit": "%", "direction": "higher-worse", "description": "Aandeel 15-plussers dat zich weleens onveilig voelt in het algemeen."},
    {"key": "safetyGrade", "sourceKey": "RapportcijferVeiligheidInBuurt_60", "label": "Rapportcijfer veiligheid", "shortLabel": "Veiligheidscijfer", "unit": "score", "direction": "higher-better", "description": "Gemiddeld rapportcijfer voor veiligheid in de buurt."},
    {"key": "streetDisrespect", "sourceKey": "DoorOnbekendenOpStraat_61", "label": "Respectloos op straat", "shortLabel": "Respectloos", "unit": "%", "direction": "higher-worse", "description": "Aandeel dat vaak of soms respectloos gedrag door onbekenden op straat ervaart."},
    {"key": "discrimination", "sourceKey": "GediscrimineerdGevoeld_66", "label": "Discriminatie ervaren", "shortLabel": "Discriminatie", "unit": "%", "direction": "higher-worse", "description": "Aandeel dat zich in de afgelopen twaalf maanden gediscrimineerd voelde."},
    {"key": "traditionalVictim", "sourceKey": "Slachtoffers_68", "label": "Slachtoffer traditioneel", "shortLabel": "Traditioneel", "unit": "%", "direction": "higher-worse", "description": "Aandeel slachtoffers van geweldsdelicten, vermogensdelicten of vernielingen."},
    {"key": "violenceVictim", "sourceKey": "Slachtoffers_72", "label": "Slachtoffer geweld", "shortLabel": "Geweld", "unit": "%", "direction": "higher-worse", "description": "Aandeel slachtoffers van geweldsdelicten."},
    {"key": "onlineVictim", "sourceKey": "Slachtoffers_132", "label": "Slachtoffer online", "shortLabel": "Online", "unit": "%", "direction": "higher-worse", "description": "Aandeel slachtoffers van een of meer vormen van online criminaliteit."},
    {"key": "onlineFraud", "sourceKey": "Slachtoffers_136", "label": "Online oplichting/fraude", "shortLabel": "Online fraude", "unit": "%", "direction": "higher-worse", "description": "Aandeel slachtoffers van online oplichting en fraude."},
    {"key": "onlineThreat", "sourceKey": "Slachtoffers_166", "label": "Online bedreiging/intimidatie", "shortLabel": "Online bedreiging", "unit": "%", "direction": "higher-worse", "description": "Aandeel slachtoffers van online bedreiging en intimidatie."},
    {"key": "policeContact", "sourceKey": "ContactMetPolitie_188", "label": "Contact met politie", "shortLabel": "Politiecontact", "unit": "%", "direction": "neutral", "description": "Aandeel dat in de afgelopen twaalf maanden contact had met de politie."},
]
DEMOGRAPHIC_GROUPS = {1, 2, 3, 5, 7, 9, 10, 11, 12, 13, 14}

SESSION = requests.Session()


def iso_now() -> str:
    return datetime.now(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def cbs_all(table: str, endpoint: str) -> list[dict[str, Any]]:
    next_url: str | None = f"https://opendata.cbs.nl/ODataApi/OData/{table}/{endpoint}"
    rows: list[dict[str, Any]] = []
    while next_url:
        response = SESSION.get(next_url, timeout=60)
        response.raise_for_status()
        data = response.json()
        rows.extend(data["value"])
        next_url = data.get("odata.nextLink")
    return rows


def cbs(table: str, endpoint: str) -> dict[str, Any]:
    response = SESSION.get(f"https://opendata.cbs.nl/ODataApi/OData/{table}/{endpoint}", timeout=60)
    response.raise_for_status()
    return response.json()


def values_from(row: dict[str, Any]) -> dict[str, Any]:
    return {metric["key"]: row.get(metric["sourceKey"]) for metric in METRICS}


def clean_title(title: str) -> str:
    for prefix in [
        "Geslacht: ",
        "Leeftijd: ",
        "Herkomst: ",
        "Onderwijsniveau: ",
        "Genderidentiteit: ",
        "Seks. oriëntatie: ",
        "Intersekse zijn: ",
        "Inkomen: ",
        "Welvaart: ",
        "Gemeente: ",
    ]:
        title = title.replace(prefix, "", 1)
    return title


def demographic_data() -> list[dict[str, Any]]:
    table = TABLES["demographic"]
    groups = cbs_all(table, "CategoryGroups")
    characteristics = cbs_all(table, "Kenmerken")
    params = urlencode({"$filter": f"Marges eq '{VALUE_MARGIN}' and Perioden eq '{PERIOD}'"})
    rows = cbs_all(table, f"TypedDataSet?{params}")
    group_by_id = {group["ID"]: group for group in groups}
    characteristic_by_key = {item["Key"]: item for item in characteristics}

    result = []
    for row in rows:
        characteristic = characteristic_by_key.get(row.get("Kenmerken"))
        group = group_by_id.get((characteristic or {}).get("CategoryGroupID"))
        if not characteristic or not group or group["ID"] not in DEMOGRAPHIC_GROUPS:
            continue
        result.append(
            {
                "key": row["Kenmerken"].strip(),
                "sourceKey": row["Kenmerken"],
                "label": clean_title(characteristic["Title"]),
                "fullLabel": characteristic["Title"],
                "groupId": group["ID"],
                "group": group["Title"],
                "values": values_from(row),
            }
        )
    return result


def main() -> None:
    table_info = cbs(TABLES["demographic"], "TableInfos")
    data = {
        "meta": {
            "title": "Demografische veiligheid",
            "period": PERIOD,
            "periodLabel": "2025",
            "generatedAt": iso_now(),
            "tables": {"demographic": TABLES["demographic"]},
            "sourceModified": (table_info.get("value") or [{}])[0].get("Modified"),
        },
        "metrics": [{key: value for key, value in metric.items() if key != "sourceKey"} for metric in METRICS],
        "demographic": demographic_data(),
        "defaults": {
            "group": "Leeftijdsklasse beknopt",
            "xMetric": "traditionalVictim",
            "yMetric": "neighborhoodUnsafe",
            "selectedKey": "53050",
        },
    }
    (BASE_DIR / "data.json").write_text(json.dumps(data, ensure_ascii=False, indent="\t") + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
