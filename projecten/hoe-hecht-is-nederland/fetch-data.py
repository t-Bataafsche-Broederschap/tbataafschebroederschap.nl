#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "beautifulsoup4",
#   "niquests",
#   "pypdf",
# ]
# ///

from __future__ import annotations

import json
import math
from datetime import UTC, datetime
from io import BytesIO
from pathlib import Path
from typing import Any

import niquests as http
from bs4 import BeautifulSoup
from pypdf import PdfReader

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR.parents[2] / "static" / "projecten" / BASE_DIR.name
TABLES = {
    "participation": "85541NED",
    "participationHistorical": "60027NED",
    "integrationHistorical": "80270NED",
    "trust": "85533NED",
    "loneliness": "85766NED",
    "neighborhood": "85146NED",
}
MARGINS = {"MW00000": "value", "MOG0095": "lower", "MBG0095": "upper"}
SESSION = http.Session()
SCP_BELONGING_URL = "https://www.scp.nl/site/binaries/site-content/collections/documents/2025/06/19/burgerperspectieven-2025-bericht-2/Burgerperspectieven+bericht+2025-2+Thema+Sociale+Cohesie.pdf"
SCP_SCO_2023_URL = "https://www.scp.nl/site/binaries/site-content/collections/documents/2023/04/14/sociale-en-culturele-ontwikkelingen-2023/Sociale%2Ben%2BCulturele%2BOntwikkelingen%2B-%2BStand%2Bvan%2BNederland%2B2023.pdf"
SCP_SIM_2020_URL = "https://www.scp.nl/site/binaries/site-content/collections/documents/2022/10/11/gevestigd-maar-niet-thuis.-eerste-bevindingen-uit-de-survey-integratie-migranten-sim2020/gevestigd-maar-niet-thuis.pdf"
SCP_FUTURE_COHESION_URL = "https://www.scp.nl/site/binaries/site-content/collections/documents/2024/12/10/samenleven-in-de-toekomst/Onderzoek%2BSamenleven%2Bin%2Bde%2Btoekomst.pdf"
CBS_EXCLUSION_URL = "https://www.cbs.nl/nl-nl/longread/statistische-trends/2026/buitengesloten-voelen-in-de-samenleving/3-resultaten"

PROFILE_GROUPS = {
    "Leeftijd": ["53050", "53500", "53700", "53800", "53900", "53925", "21600"],
    "Opleiding": ["2018710", "2018720", "2018750", "2018800", "2018810"],
    "Huishouden": ["1015100", "1015110", "1015120", "1015130", "1016440"],
    "Stedelijkheid": ["1018850", "1018905", "1018955", "1019005", "1019052"],
}
PROVINCES = [f"PV{number}" for number in range(20, 32)]

PARTICIPATION_FIELDS = [
    "Dagelijks_1",
    "Minstens1xPerWeek_2",
    "Dagelijks_6",
    "Minstens1xPerWeek_7",
    "Dagelijks_11",
    "Minstens1xPerWeek_12",
    "InformeleHulp_16",
    "Totaal_33",
]
TRUST_FIELDS = [
    "VertrouwenInAndereMensen_1",
    "Kerken_2",
    "Rechters_3",
    "Politie_4",
    "Leger_5",
    "Gezondheidszorg_6",
    "Pers_7",
    "Ambtenaren_8",
    "Politici_9",
    "Gemeenteraad_10",
    "TweedeKamer_11",
    "EuropeseUnie_12",
    "Banken_13",
    "GroteBedrijven_14",
]
NEIGHBORHOOD_FIELDS = [
    "MensenKennenElkaarNauwelijks_7",
    "MensenGaanPrettigMetElkaarOm_8",
    "GezelligeBuurtWaarMenElkaarHelpt_9",
    "VoelMijThuisBijMensenInDezeBuurt_10",
    "VeelContactMetAndereBuurtbewoners_11",
    "TevredenMetSamenstellingBevolking_12",
    "DurfMijnHuissleutelTeGeven_13",
    "MensenSprekenElkaarAanOpGedrag_14",
    "SocialeCohesieSchaalscore_15",
]

# Landelijke trend uit de Veiligheidsmonitor 2025, tabel 2.1.4. De index is
# door CBS geharmoniseerd op de vier buurtcohesiestellingen die in alle
# meetjaren vanaf 2005 zijn gesteld (2005 = 100).
NEIGHBORHOOD_HISTORY_INDEX = {
    2005: 100.0,
    2006: 99.5,
    2007: 99.9,
    2008: 100.5,
    2009: 100.8,
    2010: 101.1,
    2011: 101.6,
    2012: 101.5,
    2013: 101.2,
    2014: 101.4,
    2015: 101.3,
    2016: 101.7,
    2017: 101.3,
    2019: 102.4,
    2021: 104.9,
    2023: 104.1,
    2025: 103.6,
}

SCP_BELONGING_STATEMENTS = [
    {
        "key": "equalStanding",
        "label": "Ik tel voor de samenleving evenveel mee als andere Nederlanders",
        "disagree": 9,
        "neutral": 16,
        "agree": 74,
        "missing": 1,
    },
    {
        "key": "belongs",
        "label": "Ik hoor er helemaal bij in Nederland",
        "disagree": 8,
        "neutral": 20,
        "agree": 72,
        "missing": 1,
    },
    {
        "key": "involved",
        "label": "Ik voel mij betrokken bij de Nederlandse samenleving",
        "disagree": 9,
        "neutral": 20,
        "agree": 71,
        "missing": 1,
    },
    {
        "key": "effortless",
        "label": "Ik hoef geen moeite te doen om bij de samenleving te horen",
        "disagree": 19,
        "neutral": 18,
        "agree": 61,
        "missing": 2,
    },
    {
        "key": "avoidSociety",
        "label": "Ik heb liever niets te maken met de Nederlandse samenleving",
        "disagree": 85,
        "neutral": 10,
        "agree": 4,
        "missing": 1,
        "negative": True,
    },
    {
        "key": "notPart",
        "label": "Ik voel me geen onderdeel van de Nederlandse samenleving",
        "disagree": 80,
        "neutral": 11,
        "agree": 8,
        "missing": 1,
        "negative": True,
    },
    {
        "key": "notWanted",
        "label": "De samenleving zit niet op mij te wachten",
        "disagree": 69,
        "neutral": 17,
        "agree": 11,
        "missing": 3,
        "negative": True,
    },
]

SCP_BELONGING_PROFILES = [
    {"group": "Totaal", "label": "Alle inwoners", "value": 75, "order": 0},
    {"group": "Geslacht", "label": "Mannen", "value": 74, "order": 0},
    {"group": "Geslacht", "label": "Vrouwen", "value": 76, "order": 1},
    {"group": "Leeftijd", "label": "18–34 jaar", "value": 68, "order": 0},
    {"group": "Leeftijd", "label": "35–54 jaar", "value": 77, "order": 1},
    {"group": "Leeftijd", "label": "55 jaar of ouder", "value": 78, "order": 2},
    {"group": "Opleiding", "label": "Basisonderwijs, vmbo", "value": 64, "order": 0},
    {"group": "Opleiding", "label": "Havo, vwo, mbo", "value": 75, "order": 1},
    {"group": "Opleiding", "label": "Hbo, wo", "value": 82, "order": 2},
    {"group": "Inkomen", "label": "Laag inkomen", "value": 67, "order": 0},
    {"group": "Inkomen", "label": "Middeninkomen", "value": 70, "order": 1},
    {"group": "Inkomen", "label": "Hoog inkomen", "value": 84, "order": 2},
]

CBS_EXCLUSION_PROFILES = [
    {"group": "Geslacht", "label": "Mannen", "value": 13.0, "order": 0},
    {"group": "Geslacht", "label": "Vrouwen", "value": 17.0, "order": 1},
    {"group": "Opleiding", "label": "Basisonderwijs, vmbo", "value": 18.0, "order": 0},
    {"group": "Opleiding", "label": "Havo, vwo, mbo", "value": 15.0, "order": 1},
    {"group": "Opleiding", "label": "Hbo, wo", "value": 11.0, "order": 2},
    {"group": "Inkomen", "label": "Laagste helft", "value": 23.0, "order": 0},
    {"group": "Inkomen", "label": "Hoogste helft", "value": 13.0, "order": 1},
    {
        "group": "Herkomst",
        "label": "Geboren in NL, ouders in NL",
        "value": 13.0,
        "order": 0,
    },
    {
        "group": "Herkomst",
        "label": "Geboren in NL, ouder(s) uit Europa",
        "value": 11.0,
        "order": 1,
    },
    {
        "group": "Herkomst",
        "label": "Geboren in NL, ouder(s) buiten Europa",
        "value": 14.0,
        "order": 2,
    },
    {
        "group": "Herkomst",
        "label": "Geboren in Europa buiten NL",
        "value": 19.0,
        "order": 3,
    },
    {"group": "Herkomst", "label": "Geboren buiten Europa", "value": 24.0, "order": 4},
    {
        "group": "Positie",
        "label": "Werkend, student of gepensioneerd",
        "value": 13.0,
        "order": 0,
    },
    {
        "group": "Positie",
        "label": "Zonder waargenomen inkomen",
        "value": 19.6,
        "order": 1,
    },
    {
        "group": "Positie",
        "label": "Ontvanger sociale uitkering",
        "value": 32.2,
        "order": 2,
    },
]

CBS_BRIDGING_CONTACT = [
    {
        "key": "age",
        "label": "Andere leeftijd",
        "weeklyContact": 88,
        "excludedWithContact": 13,
        "excludedWithoutContact": 24,
    },
    {
        "key": "education",
        "label": "Ander onderwijsniveau",
        "weeklyContact": 86,
        "excludedWithContact": 13,
        "excludedWithoutContact": 24,
    },
    {
        "key": "origin",
        "label": "Andere herkomst",
        "weeklyContact": 60,
        "excludedWithContact": 13,
        "excludedWithoutContact": 16,
    },
    {
        "key": "any",
        "label": "Minstens één verschil",
        "weeklyContact": 95,
        "excludedWithContact": 14,
        "excludedWithoutContact": 28,
    },
]

NATIONAL_CONNECTION_2022 = [
    {
        "group": "Leeftijd",
        "label": "20–34 jaar",
        "home": 79,
        "responsible": 35,
        "order": 0,
    },
    {
        "group": "Leeftijd",
        "label": "35–64 jaar",
        "home": 83,
        "responsible": 39,
        "order": 1,
    },
    {
        "group": "Leeftijd",
        "label": "65 jaar of ouder",
        "home": 90,
        "responsible": 32,
        "order": 2,
    },
    {
        "group": "Opleiding",
        "label": "Basis, vmbo",
        "home": 81,
        "responsible": 26,
        "order": 0,
    },
    {
        "group": "Opleiding",
        "label": "Havo, vwo, mbo",
        "home": 80,
        "responsible": 33,
        "order": 1,
    },
    {
        "group": "Opleiding",
        "label": "Hbo, wo",
        "home": 87,
        "responsible": 43,
        "order": 2,
    },
    {
        "group": "Herkomst",
        "label": "Nederlandse herkomst",
        "home": 87,
        "responsible": 37,
        "order": 0,
    },
    {
        "group": "Herkomst",
        "label": "Niet-Nederlandse herkomst",
        "home": 73,
        "responsible": 34,
        "order": 1,
    },
]

# Afgelezen als afgeronde hele percentages uit figuur 1.2 van SCO 2023.
HOME_FEELING_TREND = [
    {
        "group": "noMigrationBackground",
        "label": "Zonder migratieachtergrond",
        "year": 2006,
        "yes": 91,
        "sometimes": 8,
        "no": 1,
    },
    {
        "group": "noMigrationBackground",
        "label": "Zonder migratieachtergrond",
        "year": 2010,
        "yes": 85,
        "sometimes": 13,
        "no": 2,
    },
    {
        "group": "noMigrationBackground",
        "label": "Zonder migratieachtergrond",
        "year": 2015,
        "yes": 83,
        "sometimes": 16,
        "no": 1,
    },
    {
        "group": "noMigrationBackground",
        "label": "Zonder migratieachtergrond",
        "year": 2020,
        "yes": 83,
        "sometimes": 16,
        "no": 1,
    },
    {
        "group": "migrationBackground",
        "label": "Met migratieachtergrond",
        "year": 2006,
        "yes": 78,
        "sometimes": 18,
        "no": 4,
    },
    {
        "group": "migrationBackground",
        "label": "Met migratieachtergrond",
        "year": 2010,
        "yes": 67,
        "sometimes": 28,
        "no": 5,
    },
    {
        "group": "migrationBackground",
        "label": "Met migratieachtergrond",
        "year": 2015,
        "yes": 64,
        "sometimes": 32,
        "no": 4,
    },
    {
        "group": "migrationBackground",
        "label": "Met migratieachtergrond",
        "year": 2020,
        "yes": 67,
        "sometimes": 31,
        "no": 2,
    },
]

IDENTITY_PROFILES_2020 = [
    {
        "key": "turkish",
        "label": "Turks",
        "both": 43,
        "netherlandsOnly": 13,
        "originOnly": 35,
        "neither": 9,
    },
    {
        "key": "moroccan",
        "label": "Marokkaans",
        "both": 50,
        "netherlandsOnly": 16,
        "originOnly": 27,
        "neither": 7,
    },
    {
        "key": "surinamese",
        "label": "Surinaams",
        "both": 41,
        "netherlandsOnly": 38,
        "originOnly": 15,
        "neither": 6,
    },
    {
        "key": "caribbean",
        "label": "Caribisch-Nederlands",
        "both": 33,
        "netherlandsOnly": 33,
        "originOnly": 20,
        "neither": 14,
    },
    {
        "key": "somali",
        "label": "Somalisch",
        "both": 40,
        "netherlandsOnly": 13,
        "originOnly": 38,
        "neither": 8,
    },
    {
        "key": "iranian",
        "label": "Iraans",
        "both": 36,
        "netherlandsOnly": 27,
        "originOnly": 24,
        "neither": 13,
    },
    {
        "key": "polish",
        "label": "Pools",
        "both": 9,
        "netherlandsOnly": 6,
        "originOnly": 73,
        "neither": 12,
    },
]

TRUST_LABELS = {
    "VertrouwenInAndereMensen_1": "Andere mensen",
    "Kerken_2": "Kerken",
    "Rechters_3": "Rechters",
    "Politie_4": "Politie",
    "Leger_5": "Leger",
    "Gezondheidszorg_6": "Gezondheidszorg",
    "Pers_7": "Pers",
    "Ambtenaren_8": "Ambtenaren",
    "Politici_9": "Politici",
    "Gemeenteraad_10": "Gemeenteraad",
    "TweedeKamer_11": "Tweede Kamer",
    "EuropeseUnie_12": "Europese Unie",
    "Banken_13": "Banken",
    "GroteBedrijven_14": "Grote bedrijven",
}
NEIGHBORHOOD_LABELS = {
    "MensenKennenElkaarNauwelijks_7": "Kennen elkaar nauwelijks",
    "MensenGaanPrettigMetElkaarOm_8": "Gaan prettig met elkaar om",
    "GezelligeBuurtWaarMenElkaarHelpt_9": "Gezellige, behulpzame buurt",
    "VoelMijThuisBijMensenInDezeBuurt_10": "Voelt zich thuis",
    "VeelContactMetAndereBuurtbewoners_11": "Veel contact",
    "TevredenMetSamenstellingBevolking_12": "Tevreden over samenstelling",
    "DurfMijnHuissleutelTeGeven_13": "Vertrouwt buren de sleutel toe",
    "MensenSprekenElkaarAanOpGedrag_14": "Spreekt elkaar aan",
}


def iso_now() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def fetch(
    table: str, entity: str, params: dict[str, str] | None = None
) -> list[dict[str, Any]]:
    url = f"https://opendata.cbs.nl/ODataApi/OData/{table}/{entity}"
    rows: list[dict[str, Any]] = []
    while url:
        response = SESSION.get(
            url,
            params=params,
            timeout=120,
            headers={"User-Agent": "tbb-data-project/1.0"},
        )
        response.raise_for_status()
        payload = response.json()
        rows.extend(payload.get("value", []))
        url = payload.get("odata.nextLink") or payload.get("@odata.nextLink")
        params = None
    return rows


def dimension_map(table: str, entity: str) -> dict[str, str]:
    return {
        str(row["Key"]).strip(): str(row.get("Title") or row["Key"]).strip()
        for row in fetch(table, entity)
    }


def raw_dimension_keys(table: str, entity: str) -> dict[str, str]:
    return {str(row["Key"]).strip(): str(row["Key"]) for row in fetch(table, entity)}


def dimension_filter(field: str, keys: list[str], raw_keys: dict[str, str]) -> str:
    return " or ".join(f"{field} eq '{raw_keys[key]}'" for key in keys)


def year(period: Any) -> int:
    return int(str(period)[:4])


def finite(value: Any) -> float | None:
    return (
        float(value)
        if isinstance(value, int | float) and math.isfinite(value)
        else None
    )


def social_contact(row: dict[str, Any]) -> float | None:
    contacts = []
    for daily, weekly in [
        ("Dagelijks_1", "Minstens1xPerWeek_2"),
        ("Dagelijks_6", "Minstens1xPerWeek_7"),
        ("Dagelijks_11", "Minstens1xPerWeek_12"),
    ]:
        if finite(row.get(daily)) is not None and finite(row.get(weekly)) is not None:
            contacts.append(float(row[daily]) + float(row[weekly]))
    return round(sum(contacts) / len(contacts), 1) if contacts else None


def value_only(
    intervals: dict[tuple[str, int], dict[str, float | None]],
) -> dict[tuple[str, int], dict[str, float | None]]:
    return {key: {"value": values.get("value")} for key, values in intervals.items()}


def interval_rows(
    rows: list[dict[str, Any]], value_getter
) -> dict[tuple[str, int], dict[str, float | None]]:
    result: dict[tuple[str, int], dict[str, float | None]] = {}
    for row in rows:
        key = str(row.get("Kenmerken") or row.get("RegioS") or "").strip()
        margin = MARGINS.get(str(row.get("Marges")))
        if not key or not margin:
            continue
        result.setdefault((key, year(row["Perioden"])), {})[margin] = finite(
            value_getter(row)
        )
    return result


def metric_intervals(
    rows: list[dict[str, Any]], fields: dict[str, str]
) -> dict[tuple[str, int], dict[str, dict[str, float | None]]]:
    result: dict[tuple[str, int], dict[str, dict[str, float | None]]] = {}
    for metric, field in fields.items():
        for key, values in interval_rows(
            rows, lambda row, field=field: row.get(field)
        ).items():
            result.setdefault(key, {})[metric] = values
    return result


def query_rows(
    table: str, *, filter_text: str, fields: list[str], dimensions: list[str]
) -> list[dict[str, Any]]:
    select = [*dimensions, "Marges", "Perioden", *fields]
    return fetch(
        table, "TypedDataSet", {"$filter": filter_text, "$select": ",".join(select)}
    )


def build_national() -> tuple[
    list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]
]:
    participation = query_rows(
        TABLES["participation"],
        filter_text="Kenmerken eq 'T009002'",
        fields=PARTICIPATION_FIELDS,
        dimensions=["Kenmerken"],
    )
    trust = query_rows(
        TABLES["trust"],
        filter_text="Kenmerken eq 'T009002'",
        fields=TRUST_FIELDS,
        dimensions=["Kenmerken"],
    )
    # De contactindicator is een afgeleid gemiddelde. De componentintervallen
    # mogen statistisch niet tot een nieuw 95%-interval worden gemiddeld.
    contact = value_only(interval_rows(participation, social_contact))
    participation_metrics = metric_intervals(
        participation, {"informalHelp": "InformeleHulp_16", "volunteering": "Totaal_33"}
    )
    trust_metrics = metric_intervals(
        trust,
        {
            "peopleTrust": "VertrouwenInAndereMensen_1",
            "politicians": "Politici_9",
            "secondChamber": "TweedeKamer_11",
            "police": "Politie_4",
            "judges": "Rechters_3",
        },
    )
    years = sorted({year(row["Perioden"]) for row in participation})
    trend = []
    for item_year in years:
        key = ("T009002", item_year)
        trend.append(
            {
                "year": item_year,
                "socialContact": contact.get(key),
                **participation_metrics.get(key, {}),
                **trust_metrics.get(key, {}),
            }
        )

    trust_2025 = []
    trust_intervals = {
        field: interval_rows(trust, lambda row, field=field: row.get(field))
        for field in TRUST_FIELDS
    }
    for field in TRUST_FIELDS:
        values = trust_intervals[field].get(("T009002", 2025), {})
        if values.get("value") is not None:
            trust_2025.append({"key": field, "label": TRUST_LABELS[field], **values})

    trust_trend = []
    trust_years = sorted({year(row["Perioden"]) for row in trust})
    for item_year in trust_years:
        for field in TRUST_FIELDS:
            values = trust_intervals[field].get(("T009002", item_year), {})
            if values.get("value") is not None:
                trust_trend.append(
                    {
                        "year": item_year,
                        "key": field,
                        "label": TRUST_LABELS[field],
                        **values,
                    }
                )
    return trend, trust_2025, trust_trend


def build_history() -> dict[str, list[dict[str, Any]]]:
    historical_fields = {
        "familyContact": "EenKeerPerWeekOfVaker_1",
        "neighborContact": "EenKeerPerWeekOfVaker_7",
        "friendContact": "EenKeerPerWeekOfVaker_11",
        "volunteering": "TotaalParticipantenVrijwilligerswerk_59",
        "informalHelp": "InformeleHulp_71",
    }
    rows = fetch(
        TABLES["participationHistorical"],
        "TypedDataSet",
        {
            "$filter": "Persoonskenmerken eq '10'",
            "$select": ",".join(
                ["Persoonskenmerken", "Perioden", *historical_fields.values()]
            ),
        },
    )
    participation = [
        {
            "year": year(row["Perioden"]),
            **{
                metric: finite(row.get(field))
                for metric, field in historical_fields.items()
            },
        }
        for row in rows
    ]
    neighborhood = [
        {"year": item_year, "index": value}
        for item_year, value in NEIGHBORHOOD_HISTORY_INDEX.items()
    ]
    return {"participation": participation, "neighborhood": neighborhood}


def validate_publication_text(
    text: str, source: str, required_fragments: list[str]
) -> None:
    normalized = " ".join(text.split())
    missing = [
        fragment for fragment in required_fragments if fragment not in normalized
    ]
    if missing:
        raise RuntimeError(f"Bronvalidatie mislukt voor {source}: {', '.join(missing)}")


def pdf_publication_text(url: str) -> str:
    response = SESSION.get(
        url, timeout=120, headers={"User-Agent": "tbb-data-project/1.0"}
    )
    response.raise_for_status()
    reader = PdfReader(BytesIO(response.content))
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def build_scp_belonging() -> dict[str, Any]:
    publication_text = pdf_publication_text(SCP_BELONGING_URL)
    validate_publication_text(
        publication_text,
        "SCP Burgerperspectieven 2025 bericht 2",
        [
            "Ik hoor er helemaal bij in Nederland",
            "Ik voel mij betrokken bij de Nederlandse samenleving",
            "basisonderwijs, vmbo",
            "hoog inkomen",
        ],
    )
    return {
        "year": 2024,
        "population": "Inwoners van Nederland van 18 jaar of ouder",
        "statements": SCP_BELONGING_STATEMENTS,
        "profiles": SCP_BELONGING_PROFILES,
        "profileDefinition": "Aandeel met een gemiddelde schaalscore van 3,5 of hoger op de zeven stellingen.",
        "sourceUrl": SCP_BELONGING_URL,
    }


def build_national_connection() -> dict[str, Any]:
    publication_text = pdf_publication_text(SCP_FUTURE_COHESION_URL)
    validate_publication_text(
        publication_text,
        "SCP Samenleven in de toekomst",
        [
            "zich thuis voelen in en verantwoordelijk voelen voor Nederland",
            "totaal 67 84 36",
            "hbo, wo 84 87 43",
        ],
    )
    return {
        "year": 2022,
        "population": "Inwoners van Nederland van 20 jaar of ouder",
        "metrics": {
            "home": {"label": "Voelt zich thuis in Nederland", "overall": 84},
            "responsible": {
                "label": "Voelt zich verantwoordelijk voor Nederland",
                "overall": 36,
            },
        },
        "profiles": NATIONAL_CONNECTION_2022,
        "sourceUrl": SCP_FUTURE_COHESION_URL,
    }


def build_home_feeling_trend() -> dict[str, Any]:
    publication_text = pdf_publication_text(SCP_SCO_2023_URL)
    validate_publication_text(
        publication_text,
        "SCP Sociale en Culturele Ontwikkelingen 2023",
        [
            "Figuur 1.2",
            "2006-2020",
            "SIM’06, ’10, ’15, ’20",
        ],
    )
    return {
        "population": "Personen van 15 jaar of ouder",
        "definition": "Aandeel dat ja antwoordt op de vraag ‘Voelt u zich thuis in Nederland?’",
        "rounding": "Afgeronde hele percentages, afgelezen uit figuur 1.2.",
        "rows": HOME_FEELING_TREND,
        "sourceUrl": SCP_SCO_2023_URL,
    }


def build_identity_profiles() -> dict[str, Any]:
    publication_text = pdf_publication_text(SCP_SIM_2020_URL)
    validate_publication_text(
        publication_text,
        "SCP Gevestigd, maar niet thuis",
        [
            "Tabel 4.5",
            "43 50 41 33 40 36 9",
            "13 16 38 33 13 27 6",
        ],
    )
    return {
        "year": 2020,
        "population": "Personen van 15 jaar of ouder met een migratieachtergrond",
        "categories": [
            {"key": "both", "label": "Sterk Nederlander én herkomstgroep"},
            {"key": "netherlandsOnly", "label": "Vooral sterk Nederlander"},
            {"key": "originOnly", "label": "Vooral sterk herkomstgroep"},
            {"key": "neither", "label": "Geen van beide sterk"},
        ],
        "profiles": IDENTITY_PROFILES_2020,
        "sourceUrl": SCP_SIM_2020_URL,
    }


def build_cbs_exclusion() -> dict[str, Any]:
    response = SESSION.get(
        CBS_EXCLUSION_URL, timeout=120, headers={"User-Agent": "tbb-data-project/1.0"}
    )
    response.raise_for_status()
    publication_text = BeautifulSoup(response.text, "html.parser").get_text(
        " ", strip=True
    )
    validate_publication_text(
        publication_text,
        "CBS Buitengesloten voelen in de samenleving",
        [
            "15 procent zich enigszins tot helemaal buitengesloten",
            "Uitkeringsontvanger 32,2",
            "95 procent minstens wekelijks contact",
        ],
    )
    return {
        "year": 2024,
        "population": "Inwoners van Nederland van 15 jaar of ouder",
        "overall": 15.0,
        "threshold": "Score 6 of hoger op een schaal van 0 tot 10",
        "profiles": CBS_EXCLUSION_PROFILES,
        "bridgingContact": CBS_BRIDGING_CONTACT,
        "sourceUrl": CBS_EXCLUSION_URL,
    }


def build_integration_history() -> list[dict[str, Any]]:
    table = TABLES["integrationHistorical"]
    raw_total = raw_dimension_keys(table, "Persoonskenmerken")["1100"]
    labels = dimension_map(table, "Migratieachtergrond")
    fields = ["ZowelLandVanMigAlsNederland_2", "MeerNederland_3", "Ja_6", "Ja_18"]
    rows = fetch(
        table,
        "TypedDataSet",
        {
            "$filter": f"Persoonskenmerken eq '{raw_total}'",
            "$select": ",".join(
                ["Migratieachtergrond", "Persoonskenmerken", "Perioden", *fields]
            ),
        },
    )
    result = []
    for row in rows:
        origin_key = str(row["Migratieachtergrond"]).strip()
        is_dutch_background = origin_key == "6030"
        balanced = finite(row.get("ZowelLandVanMigAlsNederland_2"))
        more_dutch = finite(row.get("MeerNederland_3"))
        result.append(
            {
                "key": origin_key,
                "label": labels.get(origin_key, origin_key),
                "year": year(row["Perioden"]),
                "feelsAtHome": finite(
                    row.get("Ja_18" if is_dutch_background else "Ja_6")
                ),
                "identifiesAtLeastEquallyWithNetherlands": (
                    round(balanced + more_dutch, 1)
                    if balanced is not None and more_dutch is not None
                    else None
                ),
            }
        )
    return result


def build_belonging() -> dict[str, Any]:
    return {
        "scp": build_scp_belonging(),
        "cbsExclusion": build_cbs_exclusion(),
        "nationalConnection": build_national_connection(),
        "homeFeelingTrend": build_home_feeling_trend(),
        "identityProfiles": build_identity_profiles(),
        "integrationHistory": build_integration_history(),
    }


def build_profiles() -> list[dict[str, Any]]:
    keys = [key for group_keys in PROFILE_GROUPS.values() for key in group_keys]
    participation_filter = dimension_filter(
        "Kenmerken", keys, raw_dimension_keys(TABLES["participation"], "Kenmerken")
    )
    trust_filter = dimension_filter(
        "Kenmerken", keys, raw_dimension_keys(TABLES["trust"], "Kenmerken")
    )
    loneliness_filter = dimension_filter(
        "Kenmerken", keys, raw_dimension_keys(TABLES["loneliness"], "Kenmerken")
    )
    participation = query_rows(
        TABLES["participation"],
        filter_text=f"Perioden eq '2025JJ00' and ({participation_filter})",
        fields=PARTICIPATION_FIELDS,
        dimensions=["Kenmerken"],
    )
    trust = query_rows(
        TABLES["trust"],
        filter_text=f"Perioden eq '2025JJ00' and ({trust_filter})",
        fields=TRUST_FIELDS,
        dimensions=["Kenmerken"],
    )
    loneliness = query_rows(
        TABLES["loneliness"],
        filter_text=f"Perioden eq '2025JJ00' and MateVanEenzaamheid eq 'A052503' and ({loneliness_filter})",
        fields=["Eenzaamheid_1", "SocialeEenzaamheid_2", "EmotioneleEenzaamheid_3"],
        dimensions=["Kenmerken", "MateVanEenzaamheid"],
    )
    labels = dimension_map(TABLES["participation"], "Kenmerken")
    contact = value_only(interval_rows(participation, social_contact))
    participation_metrics = metric_intervals(
        participation, {"informalHelp": "InformeleHulp_16", "volunteering": "Totaal_33"}
    )
    trust_metrics = metric_intervals(
        trust,
        {
            "peopleTrust": "VertrouwenInAndereMensen_1",
            "politicians": "Politici_9",
            "secondChamber": "TweedeKamer_11",
        },
    )
    loneliness_metrics = metric_intervals(
        loneliness,
        {
            "loneliness": "Eenzaamheid_1",
            "socialLoneliness": "SocialeEenzaamheid_2",
            "emotionalLoneliness": "EmotioneleEenzaamheid_3",
        },
    )
    profiles = []
    for group, group_keys in PROFILE_GROUPS.items():
        for order, key in enumerate(group_keys):
            lookup = (key, 2025)
            profiles.append(
                {
                    "key": key,
                    "group": group,
                    "order": order,
                    "label": labels.get(key, key).split(":", 1)[-1].strip(),
                    "metrics": {
                        "socialContact": contact.get(lookup, {}),
                        **participation_metrics.get(lookup, {}),
                        **trust_metrics.get(lookup, {}),
                        **loneliness_metrics.get(lookup, {}),
                    },
                }
            )
    return profiles


def build_neighborhood() -> list[dict[str, Any]]:
    region_keys = ["NL01", *PROVINCES]
    region_filter = dimension_filter(
        "RegioS", region_keys, raw_dimension_keys(TABLES["neighborhood"], "RegioS")
    )
    rows = query_rows(
        TABLES["neighborhood"],
        filter_text=f"({region_filter})",
        fields=NEIGHBORHOOD_FIELDS,
        dimensions=["RegioS"],
    )
    labels = dimension_map(TABLES["neighborhood"], "RegioS")
    metric_fields = {
        "score": "SocialeCohesieSchaalscore_15",
        **{field: field for field in NEIGHBORHOOD_LABELS},
    }
    metrics = metric_intervals(rows, metric_fields)
    result = []
    for region_key in region_keys:
        region = {
            "key": region_key,
            "label": labels.get(region_key, region_key).replace(" (PV)", ""),
            "years": [],
        }
        for item_year in [2021, 2023, 2025]:
            values = metrics.get((region_key, item_year), {})
            region["years"].append(
                {
                    "year": item_year,
                    "score": values.get("score", {}),
                    "items": [
                        {"key": field, "label": label, **values.get(field, {})}
                        for field, label in NEIGHBORHOOD_LABELS.items()
                    ],
                }
            )
        result.append(region)
    return result


def main() -> None:
    trend, trust, trust_trend = build_national()
    data = {
        "metadata": {
            "generatedAt": iso_now(),
            "period": 2025,
            "population": "Inwoners van Nederland van 15 jaar of ouder",
            "sources": [f"cbs-{table.lower()}" for table in TABLES.values()]
            + [
                "cbs-veiligheidsmonitor-2025",
                "scp-burgerperspectieven-2025-2",
                "scp-sco-2023",
                "scp-sim-2020",
                "scp-samenleven-toekomst-2024",
                "cbs-buitensluiting-2024",
            ],
            "notes": [
                "CBS-enquêteschattingen met 95%-betrouwbaarheidsintervallen.",
                "Wekelijks sociaal contact is het gemiddelde van dagelijks plus wekelijks contact met familie, vrienden en buren.",
                "Eenzaamheid is een afzonderlijke indicator en niet het omgekeerde van sociale cohesie.",
                "De historische participatiereeks 1997–2011 heeft een andere onderzoeksopzet en populatie dan de reeks vanaf 2012 en wordt daarom afzonderlijk getoond.",
                "De lange buurtcohesietrend is een CBS-index (2005 = 100) op basis van vier stellingen die in alle meetjaren zijn gesteld.",
                "Verbondenheid en buitensluiting komen uit afzonderlijke SCP- en CBS-metingen uit 2024 en vormen geen doorlopende reeks.",
                "De SIM-reeks gebruikt voor 2020 vanwege corona een afwijkende veldwerkmethode; de thuisgevoelcijfers uit figuur 1.2 zijn afgerond afgelezen.",
                "Identificatie in SIM 2020 is tweedimensionaal gemeten en wordt niet aan de relatieve identificatiemaat uit StatLine 80270NED gekoppeld.",
            ],
        },
        "metricInfo": {
            "socialContact": {
                "label": "Wekelijks sociaal contact",
                "shortLabel": "Sociaal contact",
                "direction": "higher",
            },
            "informalHelp": {
                "label": "Informele hulp",
                "shortLabel": "Informele hulp",
                "direction": "higher",
            },
            "volunteering": {
                "label": "Vrijwilligerswerk",
                "shortLabel": "Vrijwilligerswerk",
                "direction": "higher",
            },
            "peopleTrust": {
                "label": "Vertrouwen in andere mensen",
                "shortLabel": "Vertrouwen",
                "direction": "higher",
            },
            "politicians": {
                "label": "Vertrouwen in politici",
                "shortLabel": "Politici",
                "direction": "higher",
            },
            "secondChamber": {
                "label": "Vertrouwen in Tweede Kamer",
                "shortLabel": "Tweede Kamer",
                "direction": "higher",
            },
            "police": {
                "label": "Vertrouwen in politie",
                "shortLabel": "Politie",
                "direction": "higher",
            },
            "judges": {
                "label": "Vertrouwen in rechters",
                "shortLabel": "Rechters",
                "direction": "higher",
            },
            "loneliness": {
                "label": "Sterk eenzaam",
                "shortLabel": "Eenzaam",
                "direction": "lower",
            },
            "socialLoneliness": {
                "label": "Sterk sociaal eenzaam",
                "shortLabel": "Sociaal eenzaam",
                "direction": "lower",
            },
            "emotionalLoneliness": {
                "label": "Sterk emotioneel eenzaam",
                "shortLabel": "Emotioneel eenzaam",
                "direction": "lower",
            },
        },
        "nationalTrend": trend,
        "history": build_history(),
        "belonging": build_belonging(),
        "trust2025": trust,
        "trustTrend": trust_trend,
        "profiles2025": build_profiles(),
        "neighborhood": build_neighborhood(),
    }
    serialized = json.dumps(data, ensure_ascii=False, indent="\t") + "\n"
    (BASE_DIR / "data.json").write_text(serialized, encoding="utf-8")
    STATIC_DIR.mkdir(parents=True, exist_ok=True)
    (STATIC_DIR / "data.json").write_text(serialized, encoding="utf-8")
    print(
        f"Geschreven: {len(data['nationalTrend'])} jaren, {len(data['profiles2025'])} profielen en {len(data['neighborhood'])} regio's."
    )
    SESSION.close()


if __name__ == "__main__":
    main()
