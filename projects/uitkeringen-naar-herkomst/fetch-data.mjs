import { mkdir, writeFile } from "node:fs/promises";

const cbsBase = "https://opendata.cbs.nl/ODataApi/OData";
const pdokUrl = "https://service.pdok.nl/cbs/gebiedsindelingen/2025/wfs/v1_0?service=WFS&version=2.0.0&request=GetFeature&typeNames=gebiedsindelingen:gemeente_gegeneraliseerd&outputFormat=application/json&count=10000";

const tables = {
	benefits: "85692NED",
	population: "85721NED",
	regional: "80794NED",
};

const codes = {
	totalSex: "T001038",
	totalAgeBenefits: "10000",
	totalAgePopulation: "10000",
	totalOrigin: "T001040",
	dutchOrigin: "1012600",
	totalParentsBenefits: "T001638",
	totalParentsPopulation: "T001638",
	benefitBornInNetherlands: "A051735",
	benefitBornOutsideNetherlands: "A051736",
	benefitBornInNetherlandsParentsOutside: "A051742",
	benefitBornInNetherlandsParentsInNetherlands: "A051760",
	populationBornInNetherlands: "A051735",
	populationBornOutsideNetherlands: "A051736",
	populationTwoParentsBornInNetherlands: "A051737",
	populationOneParentBornOutside: "A051739",
	populationTwoParentsBornOutside: "A051740",
	totalBirthCountryPopulation: "T001638",
	nationalRegion: "NL01",
};

const topicKeys = ["UitkeringsontvangersTotaal_1", "Werkloosheid_2", "BijstandEnBijstandsgerelateerdTotaal_3", "Bijstandsuitkering_4", "ArbeidsongeschiktheidTotaal_7", "WAOUitkering_8", "WIAUitkeringRegelingWGA_9", "WIAUitkeringRegelingIVA_10", "WajongUitkering_12", "AlgemeneOuderdomswet_13"];

const regionalTopicMap = {
	UitkeringsontvangersTotaal_1: "UitkeringsontvangersTotaal_1",
	Werkloosheid_2: "Werkloosheid_4",
	BijstandEnBijstandsgerelateerdTotaal_3: "BijstandGerelateerdTotAOWLeeftijd_5",
	Bijstandsuitkering_4: "BijstandTotDeAOWLeeftijd_7",
	ArbeidsongeschiktheidTotaal_7: "ArbeidsongeschiktheidTotaal_8",
	WAOUitkering_8: "WAOUitkering_9",
	WIAUitkeringRegelingWGA_9: "WIAUitkeringWGARegeling_10",
	WajongUitkering_12: "WajongUitkering_11",
	AlgemeneOuderdomswet_13: "AlgemeneOuderdomswet_12",
};

async function fetchJson(url) {
	const response = await fetch(url, {
		headers: { "user-agent": "thaumatorium-uitkeringen-naar-herkomst/1.0" },
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

function cleanKey(key) {
	return String(key || "").trim();
}

function cleanTitle(title) {
	return String(title || "")
		.replace(/\s+/g, " ")
		.trim();
}

function categoryMap(rows) {
	return new Map(
		rows.map((row) => [
			cleanKey(row.Key),
			{
				key: cleanKey(row.Key),
				title: cleanTitle(row.Title),
				group: row.CategoryGroupID ?? null,
			},
		])
	);
}

function periodDate(period) {
	const match = String(period || "").match(/^(\d{4})MM(\d{2})$/);
	if (!match) return null;
	return `${match[1]}-${match[2]}-01`;
}

function parseValue(value) {
	if (typeof value === "number") return Number.isFinite(value) ? value : null;
	const cleaned = String(value ?? "").trim();
	if (!cleaned || cleaned === ".") return null;
	const parsed = Number(cleaned);
	return Number.isFinite(parsed) ? parsed : null;
}

function isMunicipalityCode(code) {
	return /^GM\d{4}$/.test(code);
}

function regionLevel(code) {
	if (code === "NL01") return "Nederland";
	if (code.startsWith("LD")) return "Landsdeel";
	if (code.startsWith("PV")) return "Provincie";
	if (code.startsWith("GM")) return "Gemeente";
	return "Overig";
}

function compactFeature(feature) {
	return {
		type: "Feature",
		properties: {
			code: cleanKey(feature.properties.statcode),
			name: cleanTitle(feature.properties.statnaam),
		},
		geometry: feature.geometry,
	};
}

function encodeCombo({ sex, age, origin, parents, period }) {
	return [sex, age, origin, parents, period].map(cleanKey).join("|");
}

function statusForPeriod(periodRows, key) {
	const period = periodRows.find((row) => cleanKey(row.Key) === cleanKey(key));
	return {
		key: cleanKey(key),
		date: periodDate(key),
		title: cleanTitle(period?.Title || key),
		status: cleanTitle(period?.Status || ""),
	};
}

function latestDefinitivePeriod(periodRows) {
	const definitive = periodRows.filter((row) => cleanTitle(row.Status) === "Definitief");
	return cleanKey((definitive.at(-1) || periodRows.at(-1)).Key);
}

function recentMonthlyPeriods(benefitPeriods, populationPeriods) {
	const populationKeys = new Set(populationPeriods.map((row) => cleanKey(row.Key)));
	return benefitPeriods
		.map((row) => cleanKey(row.Key))
		.filter((key) => populationKeys.has(key) && periodDate(key))
		.filter((key) => key >= "2022MM01")
		.slice(-48);
}

async function fetchPeriodBatches(table, entity, { periods, filter, select }) {
	const rows = [];
	for (const period of periods) {
		const combinedFilter = filter ? `${filter} and Perioden eq '${period}'` : `Perioden eq '${period}'`;
		rows.push(
			...(await fetchOData(table, entity, {
				$filter: combinedFilter,
				$select: select,
			}))
		);
	}
	return rows;
}

function orFilter(field, values) {
	return `(${values.map((value) => `${field} eq '${value}'`).join(" or ")})`;
}

function ageToNumber(code) {
	if (code === "10010") return 0;
	const value = Number.parseInt(code, 10);
	if (!Number.isFinite(value)) return null;
	if (value >= 10100 && value <= 19900) return Math.round(value / 100) - 100;
	if (code === "22000" || code === "22200" || code === "72000") return 100;
	if (value >= 70000 && value <= 71900) return ((value - 70000) / 100) * 5;
	return null;
}

function aowAgeForPeriod(period) {
	const year = Number(String(period).slice(0, 4));
	if (year <= 2022) return 67;
	if (year === 2023) return 67;
	if (year <= 2027) return 67;
	return 68;
}

function benefitAgeIncludes(ageCode, benefitAge, period) {
	if (benefitAge === codes.totalAgeBenefits) return cleanKey(ageCode) === codes.totalAgeBenefits;
	if (cleanKey(ageCode) === codes.totalAgeBenefits) return false;
	const age = ageToNumber(ageCode);
	if (!Number.isFinite(age)) return false;
	const aowAge = aowAgeForPeriod(period);
	switch (benefitAge) {
		case "90210":
			return age < aowAge;
		case "41600":
			return age < 27;
		case "53050":
			return age >= 15 && age < 25;
		case "53400":
			return age >= 25 && age < 27;
		case "53610":
			return age >= 27 && age < 45;
		case "53600":
			return age >= 27 && age < 35;
		case "53700":
			return age >= 35 && age < 45;
		case "90150":
			return age >= 45 && age < aowAge;
		case "53800":
			return age >= 45 && age < 55;
		case "90170":
			return age >= 55 && age < aowAge;
		case "90200":
			return age >= aowAge;
		case "90230":
			return age >= aowAge && age < 75;
		case "53975":
			return age >= 75 && age < 85;
		case "21800":
			return age >= 85;
		default:
			return false;
	}
}

function populationParentsMatches(row, benefitParent) {
	const birthCountry = cleanKey(row.Geboorteland);
	const parents = cleanKey(row.GeboortelandOuders);
	switch (benefitParent) {
		case codes.totalParentsBenefits:
			return birthCountry === codes.totalBirthCountryPopulation && parents === codes.totalParentsPopulation;
		case codes.benefitBornInNetherlands:
			return birthCountry === codes.populationBornInNetherlands && parents === codes.totalParentsPopulation;
		case codes.benefitBornOutsideNetherlands:
			return birthCountry === codes.populationBornOutsideNetherlands && parents === codes.totalParentsPopulation;
		case codes.benefitBornInNetherlandsParentsOutside:
			return birthCountry === codes.populationBornInNetherlands && (parents === codes.populationOneParentBornOutside || parents === codes.populationTwoParentsBornOutside);
		case codes.benefitBornInNetherlandsParentsInNetherlands:
			return birthCountry === codes.populationBornInNetherlands && parents === codes.populationTwoParentsBornInNetherlands;
		default:
			return false;
	}
}

function buildPopulationByCombo(populationRows, { periods, benefitAges, benefitParents }) {
	const result = new Map();
	for (const row of populationRows) {
		const period = cleanKey(row.Perioden);
		if (!periods.includes(period)) continue;
		const value = parseValue(row.BevolkingOpDeEersteVanDeMaand_1);
		if (!Number.isFinite(value)) continue;
		for (const age of benefitAges) {
			if (!benefitAgeIncludes(cleanKey(row.Leeftijd), age, period)) continue;
			for (const parents of benefitParents) {
				if (!populationParentsMatches(row, parents)) continue;
				const key = encodeCombo({
					sex: row.Geslacht,
					age,
					origin: row.Herkomstland,
					parents,
					period,
				});
				result.set(key, (result.get(key) || 0) + value);
			}
		}
	}
	return result;
}

function rowsToOptions(rows) {
	return rows.map((row) => ({ key: cleanKey(row.Key), label: cleanTitle(row.Title), group: row.CategoryGroupID ?? null }));
}

function topicOptions(dataProperties) {
	const titles = new Map(dataProperties.filter((row) => row.Type === "Topic").map((row) => [row.Key, cleanTitle(row.Title)]));
	return topicKeys.map((key) => ({ key, label: titles.get(key) || key }));
}

function rowToNationalRecord(row, populationByCombo, meta) {
	const key = encodeCombo({
		sex: row.Geslacht,
		age: row.Leeftijd,
		origin: row.Herkomstland,
		parents: row.GeboortelandOuders,
		period: row.Perioden,
	});
	const population = populationByCombo.get(key) ?? null;
	const record = {
		period: cleanKey(row.Perioden),
		date: periodDate(row.Perioden),
		sex: cleanKey(row.Geslacht),
		age: cleanKey(row.Leeftijd),
		origin: cleanKey(row.Herkomstland),
		parents: cleanKey(row.GeboortelandOuders),
		population,
		values: {},
	};

	for (const topic of topicKeys) {
		const recipients = parseValue(row[topic]);
		record.values[topic] = {
			recipients,
			per1000: recipients !== null && population > 0 ? (recipients / population) * 1000 : null,
		};
	}

	const missingTopics = Object.values(record.values).every((value) => value.recipients === null);
	return missingTopics || !meta.originLabels.has(record.origin) || !meta.parentLabels.has(record.parents) ? null : record;
}

async function buildNational() {
	const [benefitPeriods, populationPeriods, benefitTopics, sexes, ages, origins, parents] = await Promise.all([
		fetchOData(tables.benefits, "Perioden"),
		fetchOData(tables.population, "Perioden"),
		fetchOData(tables.benefits, "DataProperties"),
		fetchOData(tables.benefits, "Geslacht"),
		fetchOData(tables.benefits, "Leeftijd"),
		fetchOData(tables.benefits, "Herkomstland"),
		fetchOData(tables.benefits, "GeboortelandOuders"),
	]);

	const periods = recentMonthlyPeriods(benefitPeriods, populationPeriods);
	const benefitAgeKeys = ages.map((row) => cleanKey(row.Key)).filter((key) => key !== "99999");
	const benefitParentKeys = parents.map((row) => cleanKey(row.Key)).filter((key) => key !== "A052139");
	const sexKeys = sexes.map((row) => cleanKey(row.Key));
	const originKeys = origins.map((row) => cleanKey(row.Key));
	const [benefitRows, populationRows] = await Promise.all([
		fetchPeriodBatches(tables.benefits, "TypedDataSet", {
			periods,
			select: ["Geslacht", "Leeftijd", "Herkomstland", "GeboortelandOuders", "Perioden", ...topicKeys].join(","),
		}),
		Promise.all(
			[codes.totalBirthCountryPopulation, codes.populationBornInNetherlands, codes.populationBornOutsideNetherlands].map((birthCountry) =>
				fetchPeriodBatches(tables.population, "TypedDataSet", {
					periods,
					filter: [`Geboorteland eq '${birthCountry}'`, orFilter("Geslacht", sexKeys), orFilter("Herkomstland", originKeys), orFilter("GeboortelandOuders", [codes.totalParentsPopulation, codes.populationTwoParentsBornInNetherlands, codes.populationOneParentBornOutside, codes.populationTwoParentsBornOutside])].join(
						" and "
					),
					select: "Geslacht,Leeftijd,Herkomstland,Geboorteland,GeboortelandOuders,Perioden,BevolkingOpDeEersteVanDeMaand_1",
				})
			)
		).then((groups) => groups.flat()),
	]);

	const originLabels = categoryMap(origins);
	const parentLabels = categoryMap(parents);
	const populationByCombo = buildPopulationByCombo(populationRows, { periods, benefitAges: benefitAgeKeys, benefitParents: benefitParentKeys });

	const records = benefitRows.map((row) => rowToNationalRecord(row, populationByCombo, { originLabels, parentLabels })).filter(Boolean);

	const validPeriods = periods.filter((period) => {
		const reference = records.find((row) => row.period === period && row.sex === codes.totalSex && row.age === codes.totalAgeBenefits && row.origin === codes.dutchOrigin && row.parents === codes.benefitBornInNetherlandsParentsInNetherlands);
		return reference && reference.population > 0 && reference.values.UitkeringsontvangersTotaal_1.recipients !== null;
	});
	if (!validPeriods.length) throw new Error("Missing Dutch reference group for all fetched periods.");
	const validPeriodSet = new Set(validPeriods);
	const validRecords = records.filter((row) => validPeriodSet.has(row.period));

	return {
		table: tables.benefits,
		populationTable: tables.population,
		periods: validPeriods.map((period) => statusForPeriod(benefitPeriods, period)),
		defaults: {
			period: validPeriods.at(-1),
			sex: codes.totalSex,
			age: codes.totalAgeBenefits,
			origin: codes.dutchOrigin,
			parents: codes.totalParentsBenefits,
			referenceOrigin: codes.dutchOrigin,
			referenceParents: codes.benefitBornInNetherlandsParentsInNetherlands,
			totalOrigin: codes.totalOrigin,
			totalParents: codes.totalParentsBenefits,
			topic: "UitkeringsontvangersTotaal_1",
		},
		dimensions: {
			sexes: rowsToOptions(sexes),
			ages: rowsToOptions(ages),
			origins: rowsToOptions(origins),
			parents: rowsToOptions(parents),
			topics: topicOptions(benefitTopics),
		},
		records: validRecords,
	};
}

async function buildRegional() {
	const [periodRows, regionRows, dataProperties, boundaries] = await Promise.all([fetchOData(tables.regional, "Perioden"), fetchOData(tables.regional, "RegioS"), fetchOData(tables.regional, "DataProperties"), fetchJson(pdokUrl)]);
	const period = latestDefinitivePeriod(periodRows);
	const regionalSelect = ["RegioS", "Perioden", ...new Set(Object.values(regionalTopicMap))].join(",");
	const rows = await fetchOData(tables.regional, "TypedDataSet", {
		$filter: `Perioden eq '${period}'`,
		$select: regionalSelect,
	});
	const regionNames = categoryMap(regionRows);
	const values = rows
		.map((row) => {
			const code = cleanKey(row.RegioS);
			const region = regionNames.get(code);
			if (!region) return null;
			return {
				code,
				name: region.title,
				level: regionLevel(code),
				values: Object.fromEntries(Object.entries(regionalTopicMap).map(([nationalTopic, regionalTopic]) => [nationalTopic, parseValue(row[regionalTopic])])),
			};
		})
		.filter((row) => row && ["Nederland", "Landsdeel", "Provincie", "Gemeente"].includes(row.level));

	const municipalityCodes = new Set(values.filter((row) => isMunicipalityCode(row.code)).map((row) => row.code));
	const features = boundaries.features.filter((feature) => municipalityCodes.has(cleanKey(feature.properties?.statcode))).map(compactFeature);

	return {
		table: tables.regional,
		period: statusForPeriod(periodRows, period),
		topics: topicOptions(dataProperties).filter((topic) => regionalTopicMap[topic.key]),
		regionalTopicMap,
		values,
		geojson: {
			type: "FeatureCollection",
			features,
		},
	};
}

async function main() {
	const [national, regional] = await Promise.all([buildNational(), buildRegional()]);
	const data = {
		metadata: {
			generatedAt: new Date().toISOString(),
			sources: ["https://opendata.cbs.nl/ODataApi/OData/85692NED", "https://opendata.cbs.nl/ODataApi/OData/85721NED", "https://opendata.cbs.nl/ODataApi/OData/80794NED", "https://service.pdok.nl/cbs/gebiedsindelingen/2025/wfs/v1_0"],
			note: "Nationale cijfers bevatten herkomst, leeftijd en geslacht; regionale cijfers bevatten geen herkomstuitsplitsing.",
		},
		national,
		regional,
	};

	const serialized = `${JSON.stringify(data)}\n`;
	await writeFile(new URL("./data.json", import.meta.url), serialized);
	await mkdir(new URL("../../../static/projects/uitkeringen-naar-herkomst/", import.meta.url), { recursive: true });
	await writeFile(new URL("../../../static/projects/uitkeringen-naar-herkomst/data.json", import.meta.url), serialized);
	console.log(`Wrote ${national.records.length.toLocaleString("nl-NL")} national rows and ${regional.values.length.toLocaleString("nl-NL")} regional rows.`);
	console.log(`National periods: ${national.periods[0].key} through ${national.periods.at(-1).key}. Regional period: ${regional.period.key}.`);
	console.log(`Map features: ${regional.geojson.features.length.toLocaleString("nl-NL")}.`);
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
