import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectDir = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.join(projectDir, "source-files", "F00016619-CulturalMapFinalEVSWVS_2023.xlsx");
const outputPath = path.join(projectDir, "cultural-map-data.json");

function readZipEntry(entryName) {
	return execFileSync("unzip", ["-p", sourcePath, entryName], {
		encoding: "utf8",
		maxBuffer: 12 * 1024 * 1024,
	});
}

function decodeXml(value) {
	return value.replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&").replaceAll("&quot;", '"').replaceAll("&apos;", "'");
}

function parseSharedStrings(xml) {
	return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((match) => [...match[1].matchAll(/<t(?: [^>]*)?>([\s\S]*?)<\/t>/g)].map((textMatch) => decodeXml(textMatch[1])).join(""));
}

function parseRows(xml, sharedStrings) {
	const rows = [];

	for (const rowMatch of xml.matchAll(/<row\b[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
		const row = { rowNumber: Number(rowMatch[1]) };
		for (const cellMatch of rowMatch[2].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>|<c\b([^>]*)\/>/g)) {
			const attrs = cellMatch[1] || cellMatch[3];
			const body = cellMatch[2] || "";
			const column = attrs.match(/r="([A-Z]+)\d+"/)?.[1];
			if (!column) continue;

			const rawValue = body.match(/<v>([\s\S]*?)<\/v>/)?.[1];
			if (rawValue === undefined) continue;

			const type = attrs.match(/t="([^"]+)"/)?.[1];
			row[column] = type === "s" ? sharedStrings[Number(rawValue)] : Number(rawValue);
		}
		rows.push(row);
	}

	return rows;
}

function parseCountryYear(label) {
	if (!label || label === "Total") return null;

	const match = label.match(/^(\d+?)(\d{4})\s+(.+)\s+\((\d{4})\)$/);
	if (!match) {
		throw new Error(`Cannot parse country-year label: ${label}`);
	}

	return {
		key: `${match[1]}-${match[2]}`,
		countryCode: match[1],
		year: Number(match[2]),
		country: match[3],
	};
}

function addMeasure(recordsByKey, label, values) {
	const parsed = parseCountryYear(label);
	if (!parsed) return;

	const record = recordsByKey.get(parsed.key) || parsed;
	recordsByKey.set(parsed.key, { ...record, ...parsed, ...values });
}

function roundRecord(record) {
	const rounded = {};
	for (const [key, value] of Object.entries(record)) {
		rounded[key] = typeof value === "number" && !Number.isInteger(value) ? Number(value.toFixed(6)) : value;
	}
	return rounded;
}

function distance(a, b, xKey, yKey) {
	if (![a?.[xKey], a?.[yKey], b?.[xKey], b?.[yKey]].every(Number.isFinite)) return null;
	return Math.hypot(a[xKey] - b[xKey], a[yKey] - b[yKey]);
}

function buildMetadata(records) {
	const latestStandard = new Map();
	const latestWelzel = new Map();

	for (const record of records) {
		if (Number.isFinite(record.tradAgg) && Number.isFinite(record.survSAgg)) {
			const current = latestStandard.get(record.countryCode);
			if (!current || record.year > current.year) latestStandard.set(record.countryCode, record);
		}
		if (Number.isFinite(record.secularValue) && Number.isFinite(record.emancipativeValue)) {
			const current = latestWelzel.get(record.countryCode);
			if (!current || record.year > current.year) latestWelzel.set(record.countryCode, record);
		}
	}

	const netherlands = [...latestStandard.values()].find((record) => record.country === "Netherlands");
	const nearestToNetherlands = [...latestStandard.values()]
		.filter((record) => record.country !== "Netherlands")
		.map((record) => ({
			country: record.country,
			year: record.year,
			distance: distance(netherlands, record, "tradAgg", "survSAgg"),
		}))
		.filter((record) => Number.isFinite(record.distance))
		.sort((a, b) => a.distance - b.distance)
		.slice(0, 8);

	return {
		generatedFrom: "F00016619-CulturalMapFinalEVSWVS_2023.xlsx",
		recordCount: records.length,
		standardCount: [...latestStandard.values()].length,
		welzelCount: [...latestWelzel.values()].length,
		yearExtent: [Math.min(...records.map((record) => record.year)), Math.max(...records.map((record) => record.year))],
		defaultCountryCode: netherlands?.countryCode || "528",
		nearestToNetherlands: nearestToNetherlands.map(roundRecord),
	};
}

const sharedStrings = parseSharedStrings(readZipEntry("xl/sharedStrings.xml"));
const rows = parseRows(readZipEntry("xl/worksheets/sheet1.xml"), sharedStrings);
const recordsByKey = new Map();

for (const row of rows.slice(1)) {
	addMeasure(recordsByKey, row.A, {
		tradAgg: row.B,
		survSAgg: row.C,
	});
	addMeasure(recordsByKey, row.E, {
		secularValue: row.F,
		emancipativeValue: row.G,
	});
}

const records = [...recordsByKey.values()]
	.filter((record) => Number.isFinite(record.year))
	.sort((a, b) => a.country.localeCompare(b.country) || a.year - b.year)
	.map(roundRecord);

await fs.writeFile(
	outputPath,
	`${JSON.stringify(
		{
			metadata: buildMetadata(records),
			records,
		},
		null,
		2
	)}\n`
);

console.log(`Wrote ${records.length} records to ${path.relative(process.cwd(), outputPath)}`);
