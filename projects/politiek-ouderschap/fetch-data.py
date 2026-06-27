#!/usr/bin/env -S uv run --script
"""
Fetch current Dutch Senate and House members and classify public parenthood
mentions from Parlement.com biographies.
"""
# /// script
# requires-python = ">=3.13"
# dependencies = [
#     "beautifulsoup4>=4.12.3",
#     "niquests>=3.14.0",
# ]
# ///

from __future__ import annotations

import concurrent.futures
import argparse
import json
import re
from collections import Counter
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import niquests as http
from bs4 import BeautifulSoup, Tag


BASE_DIR = Path(__file__).resolve().parent
OUTPUT_FILE = BASE_DIR / "data.json"
READER_BASE = "https://r.jina.ai/http://"
HEADERS = {"user-agent": "thaumatorium-kamerleden-als-ouder/1.0"}
MAX_WORKERS = 4

CHAMBERS = [
    {
        "key": "tweede",
        "label": "Tweede Kamer",
        "listUrl": "https://www.parlement.com/de-huidige-tweede-kamer",
        "expectedSeats": 150,
    },
    {
        "key": "eerste",
        "label": "Eerste Kamer",
        "listUrl": "https://www.parlement.com/de-huidige-eerste-kamer",
        "expectedSeats": 75,
    },
]

NUMBER_WORDS = {
    "een": 1,
    "één": 1,
    "twee": 2,
    "drie": 3,
    "vier": 4,
    "vijf": 5,
    "zes": 6,
    "zeven": 7,
    "acht": 8,
    "negen": 9,
    "tien": 10,
}


@dataclass(frozen=True)
class MemberSeed:
    chamber: str
    chamber_key: str
    party: str
    display_name: str
    name: str
    url: str


def iso_now() -> str:
    return datetime.now(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def fetch_text(url: str, *, reader: bool = False, timeout: int = 20, attempts: int = 2) -> str:
    target = f"{READER_BASE}{url}" if reader else url
    last_error: Exception | None = None
    for attempt in range(attempts):
        session = http.Session()
        session.headers.update(HEADERS)
        try:
            response = session.get(target, timeout=timeout)
            if response.status_code == 429:
                raise RuntimeError(f"rate limited by {target}")
            response.raise_for_status()
            return response.text
        except Exception as error:  # noqa: BLE001 - keep retry logic simple for network fetches.
            last_error = error
            if attempt == attempts - 1:
                break
        finally:
            session.close()
    raise RuntimeError(f"Kon {url} niet ophalen: {last_error}") from last_error


def normalize_whitespace(value: str) -> str:
    return re.sub(r"\s+", " ", value.replace("\xa0", " ")).strip()


def normalize_name(display_name: str) -> str:
    display_name = normalize_whitespace(display_name)
    match = re.match(r"^(?P<surname>[^,]+),\s*(?P<initials>[^()]*)\s*\((?P<call>[^)]+)\)\s*(?P<prefix>.*)$", display_name)
    if match:
        surname = match.group("surname").strip()
        call = match.group("call").strip()
        prefix = match.group("prefix").strip()
        return normalize_whitespace(" ".join(part for part in (call, prefix, surname) if part))

    match = re.match(r"^(?P<surname>[^,]+),\s*(?P<rest>.+)$", display_name)
    if match:
        return normalize_whitespace(f"{match.group('rest')} {match.group('surname')}")

    return display_name


def parse_member_list(chamber_config: dict[str, Any]) -> list[MemberSeed]:
    markdown = fetch_text(chamber_config["listUrl"], reader=True)
    members: list[MemberSeed] = []
    party: str | None = None

    for line in markdown.splitlines():
        heading = re.match(r"^##\s+(.+?)\s*\((\d+)\)\s*$", line)
        if heading:
            party = heading.group(1).strip()
            continue

        if not party or not line.startswith("|"):
            continue

        match = re.search(r"(?<!!)\[([^\]]+)\]\((https://www\.parlement\.com/biografie/[^)]+)\)", line)
        if not match:
            continue

        display_name = normalize_whitespace(match.group(1))
        members.append(
            MemberSeed(
                chamber=chamber_config["label"],
                chamber_key=chamber_config["key"],
                party=party,
                display_name=display_name,
                name=normalize_name(display_name),
                url=match.group(2),
            )
        )

    expected = chamber_config["expectedSeats"]
    if len(members) != expected:
        raise RuntimeError(f"{chamber_config['label']}: verwacht {expected} leden, vond {len(members)}")
    return members


def text_of(node: Tag) -> str:
    return normalize_whitespace(node.get_text(" ", strip=True))


def sibling_section(heading: Tag, stop_names: set[str]) -> list[Tag]:
    nodes: list[Tag] = []
    for sibling in heading.next_siblings:
        if not isinstance(sibling, Tag):
            continue
        if sibling.name in stop_names:
            break
        nodes.append(sibling)
    return nodes


def children_text_from_html(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    family_heading = soup.find(lambda tag: isinstance(tag, Tag) and tag.name == "h2" and text_of(tag).lower() == "familie/gezin")
    if not isinstance(family_heading, Tag):
        return ""

    for node in sibling_section(family_heading, {"h2"}):
        if node.name == "h3" and text_of(node).lower() == "kinderen":
            values = [text_of(item) for item in sibling_section(node, {"h2", "h3"}) if text_of(item)]
            return normalize_whitespace("; ".join(values))
        nested = node.find(lambda tag: isinstance(tag, Tag) and tag.name == "h3" and text_of(tag).lower() == "kinderen")
        if isinstance(nested, Tag):
            values = [text_of(item) for item in sibling_section(nested, {"h2", "h3"}) if text_of(item)]
            return normalize_whitespace("; ".join(values))
    return ""


def children_text_from_markdown(markdown: str) -> str:
    family = re.search(r"(?ims)^## Familie/gezin\s*(.*?)(?=^##\s|\Z)", markdown)
    if not family:
        return ""
    children = re.search(r"(?ims)^### kinderen\s*(.*?)(?=^###\s|^##\s|\Z)", family.group(1))
    if not children:
        return ""
    values = []
    for line in children.group(1).splitlines():
        line = normalize_whitespace(line.lstrip("*- "))
        if line and not line.startswith("["):
            values.append(line)
    return normalize_whitespace("; ".join(values))


def classify_children(evidence: str) -> tuple[str, int | None]:
    lower = evidence.lower()
    if not evidence:
        return "unknown", None
    if re.search(r"\bgeen\b|kinderloos|zonder kinderen", lower):
        return "no", 0
    if re.search(r"\bkind\b|\bkinderen\b|\bdochter\b|\bdochters\b|\bzoon\b|\bzonen\b", lower):
        numbers = [int(value) for value in re.findall(r"\b\d+\b", lower)]
        if not numbers:
            for word, number in NUMBER_WORDS.items():
                if re.search(rf"\b{word}\b", lower):
                    numbers.append(number)
        return "yes", sum(numbers) if numbers else None
    return "unknown", None


def enrich_member(seed: MemberSeed) -> dict[str, Any]:
    try:
        html = fetch_text(seed.url, timeout=10, attempts=1)
        evidence = children_text_from_html(html)
    except Exception:
        markdown = fetch_text(seed.url, reader=True, timeout=25, attempts=1)
        evidence = children_text_from_markdown(markdown)
    parent_status, child_count = classify_children(evidence)
    return {
        "name": seed.name,
        "displayName": seed.display_name,
        "chamber": seed.chamber,
        "chamberKey": seed.chamber_key,
        "party": seed.party,
        "parentStatus": parent_status,
        "childCount": child_count,
        "evidence": evidence,
        "sourceUrl": seed.url,
    }


def summarize(members: list[dict[str, Any]]) -> dict[str, Any]:
    status_counts = Counter(member["parentStatus"] for member in members)
    chamber_counts: dict[str, dict[str, int]] = {}
    party_counts: dict[str, dict[str, int]] = {}

    for member in members:
        for bucket, key in ((chamber_counts, member["chamber"]), (party_counts, member["party"])):
            if key not in bucket:
                bucket[key] = {"total": 0, "yes": 0, "no": 0, "unknown": 0}
            bucket[key]["total"] += 1
            bucket[key][member["parentStatus"]] += 1

    return {
        "total": len(members),
        "statusCounts": {
            "yes": status_counts["yes"],
            "no": status_counts["no"],
            "unknown": status_counts["unknown"],
        },
        "chambers": chamber_counts,
        "parties": party_counts,
    }


def load_existing() -> bool:
    if not OUTPUT_FILE.exists():
        return False
    data = json.loads(OUTPUT_FILE.read_text(encoding="utf-8"))
    print(f"Bestaande {OUTPUT_FILE.relative_to(BASE_DIR.parents[2])}: {data['summary']['total']} leden")
    print(json.dumps(data["summary"]["statusCounts"], ensure_ascii=False))
    print("Gebruik --refresh om de externe bronnen opnieuw op te halen.")
    return True


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--refresh", action="store_true", help="Haal de externe Parlement.com-bronnen opnieuw op.")
    args = parser.parse_args()

    if not args.refresh and load_existing():
        return

    seeds: list[MemberSeed] = []
    for chamber in CHAMBERS:
        seeds.extend(parse_member_list(chamber))

    members: list[dict[str, Any]] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = [executor.submit(enrich_member, seed) for seed in seeds]
        for index, future in enumerate(concurrent.futures.as_completed(futures), start=1):
            members.append(future.result())
            if index % 25 == 0:
                print(f"Opgehaald: {index}/{len(seeds)}")

    members.sort(key=lambda member: (member["chamberKey"], member["party"], member["name"]))
    data = {
        "generatedAt": iso_now(),
        "method": {
            "parentStatus": "yes/no alleen wanneer Parlement.com bij Familie/gezin onder kinderen een expliciete vermelding geeft; ontbrekende vermelding is unknown.",
            "listSource": "Actuele Kamerledenlijsten van Parlement.com, opgehaald via Jina Reader omdat de directe lijstpagina lokaal regelmatig timeout.",
        },
        "sources": {
            "tweedeKamer": CHAMBERS[0]["listUrl"],
            "eersteKamer": CHAMBERS[1]["listUrl"],
            "biographies": "https://www.parlement.com/biografie",
        },
        "summary": summarize(members),
        "members": members,
    }
    OUTPUT_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Schreef {OUTPUT_FILE.relative_to(BASE_DIR.parents[2])}: {len(members)} leden")
    print(json.dumps(data["summary"]["statusCounts"], ensure_ascii=False))


if __name__ == "__main__":
    main()
