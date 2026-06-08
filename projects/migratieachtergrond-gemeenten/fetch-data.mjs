import { writeFile } from "node:fs/promises";

const cbsBase = "https://opendata.cbs.nl/ODataApi/OData/85458NED";
const pdokUrl = "https://service.pdok.nl/cbs/gebiedsindelingen/2025/wfs/v1_0?service=WFS&version=2.0.0&request=GetFeature&typeNames=gebiedsindelingen:gemeente_gegeneraliseerd&outputFormat=application/json&count=10000";

const periods = ["2022JJ00", "2023JJ00", "2024JJ00", "2025JJ00"];

const dimensions = {
	sexTotal: "T001038",
	ageTotal: "10000",
	originTotal: "T001040",
	birthTotal: "T001638",
	originNetherlands: "1012600",
	originEuropeExceptNetherlands: "H007933",
	originOutsideEurope: "H008859",
	bornInsideNetherlands: "A051735",
	bornOutsideNetherlands: "A051736",
};

const metrics = [
	{
		id: "buiten-europa-geboren-buiten-nl",
		label: "Buiten Nederland geboren, buiten-Europese herkomst",
		shortLabel: "Buiten Europa, geboren buiten NL",
		description: "Personen die buiten Nederland zijn geboren en een buiten-Europese herkomst hebben.",
		herkomstland: dimensions.originOutsideEurope,
		geboorteland: dimensions.bornOutsideNetherlands,
		leeftijd: dimensions.ageTotal,
	},
	{
		id: "herkomst-buiten-europa",
		label: "Herkomstland buiten Europa",
		shortLabel: "Herkomst buiten Europa",
		description: "Alle inwoners met een herkomstland buiten Europa, ongeacht geboorteland.",
		herkomstland: dimensions.originOutsideEurope,
		geboorteland: dimensions.birthTotal,
		leeftijd: dimensions.ageTotal,
	},
	{
		id: "herkomst-europa-excl-nl",
		label: "Herkomstland Europa exclusief Nederland",
		shortLabel: "Herkomst Europa excl. NL",
		description: "Alle inwoners met een herkomstland in Europa, exclusief Nederland.",
		herkomstland: dimensions.originEuropeExceptNetherlands,
		geboorteland: dimensions.birthTotal,
		leeftijd: dimensions.ageTotal,
	},
	{
		id: "geboren-buiten-nl",
		label: "Geboren buiten Nederland",
		shortLabel: "Geboren buiten NL",
		description: "Alle inwoners die buiten Nederland zijn geboren, ongeacht herkomstland.",
		herkomstland: dimensions.originTotal,
		geboorteland: dimensions.bornOutsideNetherlands,
		leeftijd: dimensions.ageTotal,
	},
	{
		id: "geboren-in-nl-herkomst-buiten-europa",
		label: "Geboren in Nederland, buiten-Europese herkomst",
		shortLabel: "Geboren in NL, buiten-Europa",
		description: "Inwoners die in Nederland zijn geboren en een buiten-Europese herkomst hebben.",
		herkomstland: dimensions.originOutsideEurope,
		geboorteland: dimensions.bornInsideNetherlands,
		leeftijd: dimensions.ageTotal,
	},
	{
		id: "herkomst-nederland",
		label: "Herkomstland Nederland",
		shortLabel: "Herkomst Nederland",
		description: "Inwoners met herkomstland Nederland.",
		herkomstland: dimensions.originNetherlands,
		geboorteland: dimensions.birthTotal,
		leeftijd: dimensions.ageTotal,
	},
];

async function fetchJson(url) {
	const response = await fetch(url, {
		headers: { "user-agent": "thaumatorium-migratieachtergrond-gemeenten/1.0" },
	});
	if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
	return response.json();
}

async function fetchOData(entity, params = {}) {
	const url = new URL(`${cbsBase}/${entity}`);
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

function yearFromPeriod(period) {
	const match = String(period).match(/^(\d{4})/);
	return match ? Number(match[1]) : null;
}

function cleanRegionCode(code) {
	return String(code || "").trim();
}

function isMunicipalityCode(code) {
	return /^GM\d{4}$/.test(cleanRegionCode(code));
}

async function fetchMetricRows({ herkomstland, geboorteland, leeftijd = dimensions.ageTotal }) {
	const allRows = [];
	for (const period of periods) {
		const filter = [`Geslacht eq '${dimensions.sexTotal}'`, `Leeftijd eq '${leeftijd}'`, `Herkomstland eq '${herkomstland}'`, `Geboorteland eq '${geboorteland}'`, `Perioden eq '${period}'`, "substringof('GM',RegioS)"].join(" and ");
		allRows.push(
			...(await fetchOData("TypedDataSet", {
				$filter: filter,
				$select: "RegioS,Perioden,Bevolking_1",
			}))
		);
	}
	return allRows;
}

async function fetchNationalNumerator2025() {
	const rows = await fetchOData("TypedDataSet", {
		$filter: [`Geslacht eq '${dimensions.sexTotal}'`, `Leeftijd eq '${dimensions.ageTotal}'`, `Herkomstland eq '${dimensions.originOutsideEurope}'`, `Geboorteland eq '${dimensions.bornOutsideNetherlands}'`, "RegioS eq 'NL01  '", "Perioden eq '2025JJ00'"].join(" and "),
		$select: "RegioS,Perioden,Bevolking_1",
	});
	return rows[0]?.Bevolking_1 ?? null;
}

function rowsByRegionYear(rows) {
	const result = new Map();
	for (const row of rows) {
		const code = cleanRegionCode(row.RegioS);
		const year = yearFromPeriod(row.Perioden);
		if (!isMunicipalityCode(code) || !year || !Number.isFinite(row.Bevolking_1)) continue;
		result.set(`${code}:${year}`, row.Bevolking_1);
	}
	return result;
}

function compactFeature(feature) {
	return {
		type: "Feature",
		properties: {
			code: feature.properties.statcode,
			name: feature.properties.statnaam,
		},
		geometry: feature.geometry,
	};
}

async function main() {
	const [regionRows, totalRows, metricRows, boundaries, nationalNumerator2025] = await Promise.all([
		fetchOData("RegioS"),
		fetchMetricRows({ herkomstland: dimensions.originTotal, geboorteland: dimensions.birthTotal }),
		Promise.all(metrics.map(async (metric) => [metric.id, rowsByRegionYear(await fetchMetricRows(metric))])),
		fetchJson(pdokUrl),
		fetchNationalNumerator2025(),
	]);

	const regionNames = new Map(regionRows.filter((row) => isMunicipalityCode(row.Key)).map((row) => [cleanRegionCode(row.Key), row.Title]));
	const totalByRegionYear = rowsByRegionYear(totalRows);
	const metricRowsById = new Map(metricRows);

	const rawMunicipalities = [...regionNames.entries()]
		.map(([code, name]) => ({
			code,
			name,
			years: Object.fromEntries(
				periods.map((period) => {
					const year = yearFromPeriod(period);
					const totalPopulation = totalByRegionYear.get(`${code}:${year}`) ?? null;
					const metricValues = Object.fromEntries(
						metrics.map((metric) => {
							const count = metricRowsById.get(metric.id)?.get(`${code}:${year}`) ?? null;
							const percentage = totalPopulation && Number.isFinite(count) ? (count / totalPopulation) * 100 : null;
							return [metric.id, { count, percentage }];
						})
					);
					return [
						year,
						{
							totalPopulation,
							metrics: metricValues,
						},
					];
				})
			),
		}))
		.filter((municipality) => Object.values(municipality.years).some((row) => metrics.some((metric) => Number.isFinite(row.metrics?.[metric.id]?.percentage))))
		.sort((a, b) => a.name.localeCompare(b.name, "nl-NL"));

	const rawMunicipalityCodes = new Set(rawMunicipalities.map((row) => row.code));
	const features = boundaries.features.filter((feature) => rawMunicipalityCodes.has(feature.properties?.statcode)).map(compactFeature);
	const featureCodes = new Set(features.map((feature) => feature.properties.code));
	const municipalities = rawMunicipalities.filter((row) => featureCodes.has(row.code));
	const omittedNoBoundaryCodes = rawMunicipalities.filter((row) => !featureCodes.has(row.code)).map((row) => row.code);

	const output = {
		metadata: {
			generatedAt: new Date().toISOString(),
			cbsTable: "85458NED",
			mapYear: 2025,
			periods: periods.map((period) => ({ key: period, year: yearFromPeriod(period) })),
			defaultMetric: "buiten-europa-geboren-buiten-nl",
			metrics: metrics.map((metric) => ({
				id: metric.id,
				label: metric.label,
				shortLabel: metric.shortLabel,
				description: metric.description,
				numerator: {
					Geslacht: dimensions.sexTotal,
					Leeftijd: metric.leeftijd,
					Herkomstland: metric.herkomstland,
					Geboorteland: metric.geboorteland,
				},
				denominator: {
					Geslacht: dimensions.sexTotal,
					Leeftijd: dimensions.ageTotal,
					Herkomstland: dimensions.originTotal,
					Geboorteland: dimensions.birthTotal,
				},
			})),
			sources: ["https://www.vzinfo.nl/bevolking/regionaal/migratieachtergrond", "https://opendata.cbs.nl/ODataApi/OData/85458NED", "https://service.pdok.nl/cbs/gebiedsindelingen/2025/wfs/v1_0"],
			omittedNoBoundaryCodes,
			nationalNumerator2025,
		},
		municipalities,
		geojson: {
			type: "FeatureCollection",
			features,
		},
	};

	await writeFile(new URL("./data.json", import.meta.url), `${JSON.stringify(output, null, "\t")}\n`);

	console.log(`Wrote ${municipalities.length} municipalities and ${features.length} boundary features.`);
	if (omittedNoBoundaryCodes.length) console.warn(`Omitted rows without 2025 boundary: ${omittedNoBoundaryCodes.join(", ")}`);
	console.log(`Sanity: national 2025 numerator ${nationalNumerator2025?.toLocaleString("nl-NL") ?? "not fetched"}.`);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
