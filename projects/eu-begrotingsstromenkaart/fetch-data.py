#!/usr/bin/env -S uv run --script
"""
Fetch EU budget ranking pages and build budget-flows.json.
"""
# /// script
# requires-python = ">=3.13"
# dependencies = [
#     "niquests",
# ]
# ///

from __future__ import annotations

import html
import json
import math
import re
from datetime import UTC, datetime
from pathlib import Path

import niquests as requests


BASE_DIR = Path(__file__).resolve().parent
YEARS = list(range(2000, 2025))
PUBLISHED_YEARS = [2000, *range(2007, 2025)]
ENDPOINT = "https://eubudget.com/ranking"
FIELDS = [
    "contribution_m_eur",
    "receipts_m_eur",
    "net_balance_m_eur",
    "net_balance_per_capita_eur",
    "net_balance_pct_gni",
]


def iso_now() -> str:
    return datetime.now(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def text_between(value: str, start: str, end: str) -> str:
    from_index = value.find(start)
    if from_index == -1:
        return ""
    to_index = value.find(end, from_index + len(start))
    if to_index == -1:
        return ""
    return value[from_index + len(start) : to_index]


def clean_html(value: str) -> str:
    value = re.sub(r"<script[\s\S]*?</script>", "", value, flags=re.I)
    value = re.sub(r"<style[\s\S]*?</style>", "", value, flags=re.I)
    value = re.sub(r"<[^>]+>", " ", value)
    return re.sub(r"\s+", " ", html.unescape(value).replace("\xa0", " ")).strip()


def parse_number(value: str) -> float | int:
    parsed = float(value.replace(",", "").replace("%", "").replace("+", "").strip())
    return int(parsed) if parsed.is_integer() else parsed


def parse_rows(page_html: str, year: int) -> list[dict[str, object]]:
    tbody = text_between(page_html, "<tbody>", "</tbody>")
    rows = re.findall(r"<tr[\s\S]*?</tr>", tbody, flags=re.I)
    result = []
    for row in rows:
        country = clean_html(text_between(row, '<div class="country-name">', "</div>"))
        code = clean_html(text_between(row, '<div class="small">', "</div>"))
        cells = [clean_html(match) for match in re.findall(r"<td[^>]*>([\s\S]*?)</td>", row, flags=re.I)]
        numeric = cells[2:7]
        result.append(
            {
                "year": year,
                "code": code,
                "country": country,
                "contribution_m_eur": parse_number(numeric[0]),
                "receipts_m_eur": parse_number(numeric[1]),
                "net_balance_m_eur": parse_number(numeric[2]),
                "net_balance_per_capita_eur": parse_number(numeric[3]),
                "net_balance_pct_gni": parse_number(numeric[4]),
            }
        )
    return result


def interpolate_missing_years(rows: list[dict[str, object]]) -> list[dict[str, object]]:
    result = [*rows]
    rows_by_code_year = {(row["code"], row["year"]): row for row in rows}
    codes = sorted({row["code"] for row in rows})
    for code in codes:
        start = rows_by_code_year.get((code, 2000))
        end = rows_by_code_year.get((code, 2007))
        if not start or not end:
            continue
        for missing_year in range(2001, 2007):
            ratio = (missing_year - 2000) / 7
            interpolated: dict[str, object] = {
                "year": missing_year,
                "code": code,
                "country": start["country"],
                "estimated": True,
            }
            for field in FIELDS:
                interpolated[field] = round((start[field] + (end[field] - start[field]) * ratio) * 100) / 100
            result.append(interpolated)
    return sorted(result, key=lambda row: (row["year"], row["country"]))


def main() -> None:
    session = requests.Session()
    session.headers.update({"user-agent": "thaumatorium-eu-budget-flow-map/1.0"})
    published_rows: list[dict[str, object]] = []
    for year in PUBLISHED_YEARS:
        print(f"Fetching {year}")
        response = session.get(ENDPOINT, params={"year": year, "sort": "net_balance_pct_gni", "dir": "asc"}, timeout=60)
        response.raise_for_status()
        rows = parse_rows(response.text, year)
        if len(rows) < 20:
            raise RuntimeError(f"Unexpectedly few rows for {year}: {len(rows)}")
        published_rows.extend(rows)

    all_rows = interpolate_missing_years(published_rows)
    by_year = {str(year): [row for row in all_rows if row["year"] == year] for year in YEARS}
    countries = sorted(
        [{"code": code, "country": country} for code, country in {row["code"]: row["country"] for row in all_rows}.items()],
        key=lambda row: row["country"],
    )
    max_abs_net_balance = max(abs(row["net_balance_m_eur"]) for row in all_rows if math.isfinite(row["net_balance_m_eur"]))
    max_abs_pct_gni = max(abs(row["net_balance_pct_gni"]) for row in all_rows if math.isfinite(row["net_balance_pct_gni"]))

    payload = {
        "source": "https://eubudget.com/ranking",
        "fetched_at": iso_now(),
        "note": "EUBudget publiceert ranglijstpagina's voor 2000 en 2007 tot en met 2024. De jaren 2001 tot en met 2006 zijn lineair geinterpoleerd tussen 2000 en 2007 zodat de animatie doorlopend kan afspelen.",
        "units": {
            "contribution_m_eur": "miljoen euro",
            "receipts_m_eur": "miljoen euro",
            "net_balance_m_eur": "miljoen euro",
            "net_balance_per_capita_eur": "euro per inwoner",
            "net_balance_pct_gni": "procentpunten van bruto nationaal inkomen",
        },
        "years": YEARS,
        "publishedYears": PUBLISHED_YEARS,
        "estimatedYears": [2001, 2002, 2003, 2004, 2005, 2006],
        "countries": countries,
        "extent": {"maxAbsNetBalance": max_abs_net_balance, "maxAbsPctGni": max_abs_pct_gni},
        "byYear": by_year,
    }
    (BASE_DIR / "budget-flows.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(all_rows)} rows for {len(YEARS)} years.")


if __name__ == "__main__":
    main()
