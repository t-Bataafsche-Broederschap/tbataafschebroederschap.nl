#!/usr/bin/env -S uv run --script
"""
# run this as if it's a regular script from the command line:
$ ./fetch_population.py

Use this script to update data/
"""
# /// script
# requires-python = ">=3.13"
# dependencies = [
#     "beautifulsoup4",
#     "requests",
# ]
# ///

from __future__ import annotations

import json
import time
from pathlib import Path

import requests
from bs4 import BeautifulSoup, Tag

BASE_URL = "https://www.worldometers.info"
COUNTRIES_URL = f"{BASE_URL}/world-population/population-by-country/"
SERIES_OUTPUT_PATH = (
    Path(__file__).resolve().parents[3]
    / "static"
    / "projects"
    / "world-population"
    / "world-population-series.json"
)

FIELDNAMES = [
    "Year",
    "Population",
    "Yearly % Change",
    "Yearly Change",
    "Migrants (net)",
    "Median Age",
    "Fertility Rate",
    "Density (P/Km²)",
    "Urban Pop %",
    "Urban Population",
    "Country's Share of World Pop",
    "World Population",
    "Global Rank",
]

CONTINENT_SLUGS = {
    "africa-population": "Africa",
    "asia-population": "Asia",
    "europe-population": "Europe",
    "northern-america-population": "North America",
    "latin-america-and-the-caribbean-population": "Latin America and the Caribbean",
    "oceania-population": "Oceania",
}


def normalize_text(text: str) -> str:
    return " ".join(text.replace("\xa0", " ").replace("−", "-").split())


def normalize_header(header: str) -> str:
    header = normalize_text(header)
    header = header.replace("KmÂ²", "Km²")
    if header.endswith(" Global Rank"):
        return "Global Rank"
    return header


def fetch_html(session: requests.Session, url: str) -> BeautifulSoup:
    response = session.get(url, timeout=30)
    response.raise_for_status()
    response.encoding = "utf-8"
    return BeautifulSoup(response.text, "html.parser")


def parse_integer(value: str) -> int:
    digits = "".join(character for character in value if character.isdigit() or character == "-")
    return int(digits)


def parse_float(value: str) -> float | None:
    cleaned = normalize_text(value).replace("%", "").replace(",", "")
    if cleaned in {"", "-", "–"}:
        return None
    return float(cleaned)


def parse_optional_integer(value: str) -> int | None:
    cleaned = normalize_text(value)
    if cleaned in {"", "-", "–"}:
        return None
    return parse_integer(cleaned)


def find_country_rows(soup: BeautifulSoup) -> list[tuple[str, str]]:
    rows: list[tuple[str, str]] = []
    seen: set[str] = set()

    for link in soup.select('table tbody tr td a[href^="/world-population/"]'):
        href = link.get("href")
        if not href or href == "/world-population/population-by-country/":
            continue
        if not href.endswith("-population/"):
            continue
        slug = href.removeprefix("/world-population/").removesuffix("-population/")
        if slug in seen:
            continue
        seen.add(slug)
        rows.append((normalize_text(link.get_text()), f"{BASE_URL}{href}"))

    return rows


def heading_text(heading: Tag) -> str:
    return normalize_text(heading.get_text(" ", strip=True))


def extract_continent(soup: BeautifulSoup) -> str | None:
    for link in soup.select('a[href^="/world-population/"]'):
        href = link.get("href", "").strip("/")
        slug = href.removeprefix("world-population/")
        continent = CONTINENT_SLUGS.get(slug)
        if continent:
            return continent
    return None


def extract_table_after_heading(soup: BeautifulSoup, predicate) -> list[dict[str, str]]:
    heading = next(
        (
            candidate
            for candidate in soup.find_all(["h2", "h3"])
            if predicate(heading_text(candidate))
        ),
        None,
    )
    if heading is None:
        raise ValueError("expected table heading was not found")

    table = heading.find_next("table")
    if table is None:
        raise ValueError(f"table not found after heading: {heading_text(heading)}")

    headers = [
        normalize_header(th.get_text(" ", strip=True))
        for th in table.select("thead th")
    ]
    missing = [field for field in FIELDNAMES if field not in headers]
    if missing:
        raise ValueError(f"table is missing expected headers: {missing}")

    rows: list[dict[str, str]] = []
    for tr in table.select("tbody tr"):
        values = [
            normalize_text(td.get_text(" ", strip=True)) for td in tr.select("td")
        ]
        if not values:
            continue
        row = dict(zip(headers, values, strict=True))
        rows.append({field: row[field] for field in FIELDNAMES})

    if not rows:
        raise ValueError(f"table is empty after heading: {heading_text(heading)}")

    return rows

def write_series_file(series: list[dict[str, object]]) -> None:
    SERIES_OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "countries": series,
    }
    SERIES_OUTPUT_PATH.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )


def main() -> None:
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": (
                "Mozilla/5.0 (X11; Linux x86_64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/135.0.0.0 Safari/537.36"
            )
        }
    )

    countries_page = fetch_html(session, COUNTRIES_URL)
    countries = find_country_rows(countries_page)

    if not countries:
        raise ValueError(
            "no country links were found on the population-by-country page"
        )

    series: list[dict[str, object]] = []

    for index, (country_name, country_url) in enumerate(countries, start=1):
        country_slug = country_url.removeprefix(
            f"{BASE_URL}/world-population/"
        ).removesuffix("-population/")
        country_page = fetch_html(session, country_url)
        continent = extract_continent(country_page)

        historical_rows = extract_table_after_heading(
            country_page,
            lambda text: text.startswith("Population of ") and "and historical" in text,
        )
        forecast_rows = extract_table_after_heading(
            country_page,
            lambda text: text.endswith("Population Forecast"),
        )

        all_rows = historical_rows + forecast_rows

        points = sorted(
            (
                {
                    "year": int(row["Year"]),
                    "population": parse_integer(row["Population"]),
                    "yearlyPercentChange": parse_float(row["Yearly % Change"]),
                    "yearlyChange": parse_optional_integer(row["Yearly Change"]),
                    "migrantsNet": parse_optional_integer(row["Migrants (net)"]),
                    "medianAge": parse_float(row["Median Age"]),
                    "fertilityRate": parse_float(row["Fertility Rate"]),
                    "densityPerKm2": parse_float(row["Density (P/Km²)"]),
                    "urbanPopulationPercent": parse_float(row["Urban Pop %"]),
                    "urbanPopulation": parse_optional_integer(row["Urban Population"]),
                    "countryShareOfWorldPop": parse_float(row["Country's Share of World Pop"]),
                    "worldPopulation": parse_optional_integer(row["World Population"]),
                    "globalRank": parse_optional_integer(row["Global Rank"]),
                }
                for row in all_rows
            ),
            key=lambda point: point["year"],
        )
        population_2026 = next(
            (point["population"] for point in points if point["year"] == 2026),
            points[-1]["population"],
        )
        series.append(
            {
                "name": country_name,
                "slug": country_slug,
                "continent": continent,
                "population_2026": population_2026,
                "points": points,
            }
        )
        print(f"[{index}/{len(countries)}] processed {country_slug} for {country_name}")
        time.sleep(0.15)

    write_series_file(
        sorted(series, key=lambda country: (-country["population_2026"], country["name"]))
    )


if __name__ == "__main__":
    main()
