import { mkdir, writeFile } from "node:fs/promises";

const cbsBase = "https://opendata.cbs.nl/ODataApi/OData";

const tables = {
	legacy: "81959NED",
	current: "85658NED",
};

const codes = {
	totalSexLegacy: "T001038",
	totalSexCurrent: "T001038",
	totalAgeLegacy: "10000",
	totalAgeCurrent: "10000",
	totalGeneration: "T001040",
	totalBirthCountry: "T001638",
	totalEducation: "T001143",
	totalIncome: "T001164",
	legacyPeriod: "2022JJ00",
};

const aggregateLegacyKeys = new Set(["T001040", "1012600", "2012605", "2012657", "2012655", "1012950", "2012659"]);

async function fetchJson(url) {
	const response = await fetch(url, {
		headers: { "user-agent": "thaumatorium-verdachten-naar-herkomst/1.0" },
	});
	if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
	return response.json();
}

async function fetchOData(table, entity, params = {}) {
	const url = new URL(`${cbsBase}/${table}/${entity}`);
	for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

	const rows = [];
	let next = url.href;
	while (next) {
		const page = await fetchJson(next);
		rows.push(...page.value);
		next = page["odata.nextLink"] || null;
	}
	return rows;
}

function cleanTitle(title) {
	return String(title || "")
		.replace(/\s+/g, " ")
		.trim();
}

function categoryMap(rows) {
	return new Map(
		rows.map((row) => [
			String(row.Key).trim(),
			{
				key: String(row.Key).trim(),
				title: cleanTitle(row.Title),
				description: cleanTitle(row.Description),
				group: row.CategoryGroupID,
			},
		])
	);
}

function yearFromPeriod(period) {
	const match = String(period || "").match(/^(\d{4})/);
	return match ? Number(match[1]) : null;
}

function statusForPeriod(periodRows, key) {
	const period = periodRows.find((row) => row.Key === key);
	return {
		key,
		year: yearFromPeriod(key),
		title: period?.Title || String(yearFromPeriod(key)),
		status: period?.Status || "",
		description: cleanTitle(period?.Description || ""),
	};
}

function quantile(values, q) {
	const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
	if (!sorted.length) return null;
	const position = (sorted.length - 1) * q;
	const base = Math.floor(position);
	const rest = position - base;
	const next = sorted[base + 1];
	return next === undefined ? sorted[base] : sorted[base] + rest * (next - sorted[base]);
}

function estimatePopulation(suspectsWithDutchAddress, suspectsPer10000) {
	return Number.isFinite(suspectsWithDutchAddress) && Number.isFinite(suspectsPer10000) && suspectsPer10000 > 0 ? Math.round((suspectsWithDutchAddress / suspectsPer10000) * 10000) : null;
}

async function buildLegacy(periodRows) {
	const migrationCategories = categoryMap(await fetchOData(tables.legacy, "Migratieachtergrond"));
	const rows = await fetchOData(tables.legacy, "TypedDataSet", {
		$filter: [`Geslacht eq '${codes.totalSexLegacy}'`, `Leeftijd eq '${codes.totalAgeLegacy}'`, `Generatie eq '${codes.totalGeneration}'`, `Perioden eq '${codes.legacyPeriod}'`].join(" and "),
		$select: "Migratieachtergrond,Perioden,TotaalVerdachtenVanMisdrijven_1,VerdachtenMetWoonadresInNederland_2,VerdachtenPer10000Inwoners_3",
	});

	const points = rows
		.map((row) => {
			const category = migrationCategories.get(String(row.Migratieachtergrond).trim());
			if (!category) return null;
			return {
				key: category.key,
				label: category.title,
				group: category.group,
				isAggregate: aggregateLegacyKeys.has(category.key),
				totalSuspects: row.TotaalVerdachtenVanMisdrijven_1,
				suspectsWithDutchAddress: row.VerdachtenMetWoonadresInNederland_2,
				suspectsPer10000: row.VerdachtenPer10000Inwoners_3,
				populationEstimate: estimatePopulation(row.VerdachtenMetWoonadresInNederland_2, row.VerdachtenPer10000Inwoners_3),
				year: 2022,
				source: tables.legacy,
			};
		})
		.filter((row) => row && Number.isFinite(row.totalSuspects) && row.totalSuspects > 0 && Number.isFinite(row.suspectsPer10000));

	const nonAggregateValues = points.filter((point) => !point.isAggregate).map((point) => point.suspectsPer10000);
	const quartiles = {
		q1: Math.round(quantile(nonAggregateValues, 0.25)),
		median: Math.round(quantile(nonAggregateValues, 0.5)),
		q3: Math.round(quantile(nonAggregateValues, 0.75)),
	};

	return {
		table: tables.legacy,
		title: "Verdachten; geslacht, leeftijd, migratieachtergrond en generatie 1999-2022",
		period: statusForPeriod(periodRows, codes.legacyPeriod),
		selection: {
			geslacht: "Totaal mannen en vrouwen",
			leeftijd: "Totaal",
			generatie: "Totaal",
		},
		quartiles,
		points: points.sort((a, b) => b.totalSuspects - a.totalSuspects),
	};
}

async function buildCurrent(periodRows) {
	const herkomstCategories = categoryMap(await fetchOData(tables.current, "Herkomst"));
	const currentPeriods = periodRows.filter((row) => yearFromPeriod(row.Key) >= 2022);
	const periodFilter = currentPeriods.map((row) => `Perioden eq '${row.Key}'`).join(" or ");
	const rows = await fetchOData(tables.current, "TypedDataSet", {
		$filter: [`Geslacht eq 'T001038 '`, `Leeftijd eq '10000  '`, `Geboorteland eq '${codes.totalBirthCountry}'`, `Opleiding eq '${codes.totalEducation}'`, `Huishoudensinkomen eq '${codes.totalIncome}'`, `(${periodFilter})`].join(" and "),
		$select: "Herkomst,Perioden,TotaalVerdachtenVanMisdrijven_1,TotaalVerdachtenVanMisdrijven_8",
	});

	const series = rows
		.map((row) => {
			const category = herkomstCategories.get(String(row.Herkomst).trim());
			if (!category) return null;
			const period = statusForPeriod(periodRows, row.Perioden);
			return {
				key: category.key,
				label: category.title,
				group: category.group,
				year: period.year,
				status: period.status,
				statusDescription: period.description,
				totalSuspects: row.TotaalVerdachtenVanMisdrijven_1,
				suspectsPer10000: row.TotaalVerdachtenVanMisdrijven_8,
				source: tables.current,
			};
		})
		.filter((row) => row && Number.isFinite(row.year) && Number.isFinite(row.totalSuspects) && Number.isFinite(row.suspectsPer10000))
		.sort((a, b) => a.year - b.year || b.totalSuspects - a.totalSuspects);

	return {
		table: tables.current,
		title: "Verdachten; geslacht, leeftijd, herkomst, opleiding, huishoudensinkomen",
		selection: {
			geslacht: "Totaal mannen en vrouwen",
			leeftijd: "Totaal",
			geboorteland: "Totaal",
			opleiding: "Totaal opleidingen",
			huishoudensinkomen: "Totaal",
		},
		periods: currentPeriods.map((row) => statusForPeriod(periodRows, row.Key)),
		series,
	};
}

async function main() {
	const [legacyPeriods, currentPeriods] = await Promise.all([fetchOData(tables.legacy, "Perioden"), fetchOData(tables.current, "Perioden")]);
	const data = {
		generatedAt: new Date().toISOString(),
		legacy2022: await buildLegacy(legacyPeriods),
		currentSeries: await buildCurrent(currentPeriods),
		notes: [
			"Dit bestand bevat CBS-cijfers over geregistreerde verdachten van misdrijven, niet veroordeelden.",
			"81959NED gebruikt de oude migratieachtergrondindeling en heeft de volledige landenlijst voor 2022.",
			"85658NED gebruikt de nieuwe herkomstindeling en loopt tot 2025, maar bevat minder gedetailleerde herkomstpunten.",
		],
	};

	const serialized = `${JSON.stringify(data, null, "\t")}\n`;
	await writeFile(new URL("./data.json", import.meta.url), serialized);
	await mkdir(new URL("../../../static/projects/verdachten-naar-herkomst/", import.meta.url), { recursive: true });
	await writeFile(new URL("../../../static/projects/verdachten-naar-herkomst/data.json", import.meta.url), serialized);
	console.log(`Wrote ${data.legacy2022.points.length} legacy points and ${data.currentSeries.series.length} current rows.`);
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
