import { readFile, writeFile } from "node:fs/promises";

const cbsBase = "https://opendata.cbs.nl/ODataApi/OData";
const capacityBase = "https://data.partnersinenergie.nl/api/download";

const datasets = {
	demographics: "85524NED",
	population: "85496NED",
	migration: "85451NED",
	migrationOrigin: "85671NED",
	migrationBirthCountry: "85468NED",
	migrationNationality: "85848NED",
	migrationPurposeEu: "84808ned",
	migrationPurposeNonEu: "84809NED",
	compositionLong: "70787NED",
	compositionAgeHistorical: "37325",
	compositionHistorical: "70751NED",
	compositionCurrent: "85384NED",
	compositionFlows: "85369NED",
	housing: "82235NED",
};

const compositionCodes = {
	total: "T001040",
	nativeBackground: "1012600",
	migrationBackground: "2012605",
	firstGeneration: "2013356",
	secondGeneration: "2013357",
	totalBirthCountry: "T001638",
	bornInNetherlands: "A051735",
	bornOutsideNetherlands: "A051736",
	bothParentsBornInNetherlands: "A051737",
	oneParentBornAbroad: "A051739",
	bothParentsBornAbroad: "A051740",
};

const migrationPurposeCodes = {
	total: "T001056",
	work: "A009232",
	family: "A009234",
	study: "A009235",
	noDerivedGoal: "A009236",
	asylum: "A009233",
	temporaryProtection: "A052135",
	other: "A009238",
};

const ageBuckets = [
	{ key: "0-20", label: "0 tot 20 jaar", codes5: ["70100", "70200", "70300", "70400"] },
	{ key: "20-40", label: "20 tot 40 jaar", codes5: ["70500", "70600", "70700", "70800"] },
	{ key: "40-65", label: "40 tot 65 jaar", codes5: ["70900", "71000", "71100", "71200", "71300"] },
	{ key: "65+", label: "65 jaar of ouder", codes5: ["71400", "71500", "71600", "71700", "71800", "71900", "72000", "22000", "22200"] },
];

const ageCodeToBucket = new Map(ageBuckets.flatMap((bucket) => bucket.codes5.map((code) => [code, bucket.key])));

const housingShortage = [
	{ year: 1947, shortage: 272000, percentage: 12.8, source: "ABF Evaluatie woningtekort / CBS Woningtelling 1947" },
	{ year: 1948, shortage: 313000, percentage: null, source: "ABF Evaluatie woningtekort / Woningtelling 1956" },
	{ year: 1949, shortage: 308000, percentage: null, source: "ABF Evaluatie woningtekort / Woningtelling 1956" },
	{ year: 1950, shortage: 308000, percentage: null, source: "ABF Evaluatie woningtekort / Woningtelling 1956" },
	{ year: 1951, shortage: 295000, percentage: null, source: "ABF Evaluatie woningtekort / Woningtelling 1956" },
	{ year: 1952, shortage: 283000, percentage: null, source: "ABF Evaluatie woningtekort / Woningtelling 1956" },
	{ year: 1953, shortage: 270000, percentage: null, source: "ABF Evaluatie woningtekort / Woningtelling 1956" },
	{ year: 1954, shortage: 256000, percentage: null, source: "ABF Evaluatie woningtekort / Woningtelling 1956" },
	{ year: 1955, shortage: 251000, percentage: null, source: "ABF Evaluatie woningtekort / Woningtelling 1956" },
	{ year: 1956, shortage: 247000, percentage: 9.7, source: "ABF Evaluatie woningtekort / Woningtelling 1956" },
	{ year: 1964, shortage: 185100, percentage: null, source: "ABF Evaluatie woningtekort / CBS Woningbehoefteonderzoek 1965" },
	{ year: 1967, shortage: 101700, percentage: null, source: "ABF Evaluatie woningtekort / Tweede Kamer 1972" },
	{ year: 1970, shortage: 77100, percentage: null, source: "ABF Evaluatie woningtekort / Tweede Kamer 1972" },
	{ year: 1977, shortage: 82000, percentage: null, source: "ABF Evaluatie woningtekort / Tweede Kamer 1984" },
	{ year: 1981, shortage: 130000, percentage: 2.6, source: "ABF Evaluatie woningtekort / Tweede Kamer 1984" },
	{ year: 1985, shortage: 127000, percentage: 2.4, source: "ABF Evaluatie woningtekort / Tweede Kamer 1984" },
	{ year: 1989, shortage: 127000, percentage: 2.2, source: "ABF Evaluatie woningtekort / Tweede Kamer 1991" },
	{ year: 1998, shortage: 95600, percentage: null, source: "ABF Evaluatie woningtekort / WBO 1998" },
	{ year: 2002, shortage: 166000, percentage: 2.5, source: "ABF Evaluatie woningtekort / VROM 2003" },
	{ year: 2006, shortage: 167000, percentage: 2.4, source: "Primos Prognose 2011, ABF Research / BZK" },
	{ year: 2010, shortage: 139000, percentage: 1.9, source: "Primos Prognose 2011, ABF Research / BZK" },
	{ year: 2012, shortage: 162000, percentage: 2.2, source: "Overheid.nl / Primos, ABF" },
	{ year: 2015, shortage: 134000, percentage: 1.8, source: "Overheid.nl / Primos, ABF" },
	{ year: 2017, shortage: 242000, percentage: 3.2, source: "Overheid.nl / Primos, ABF" },
	{ year: 2018, shortage: 279000, percentage: 3.6, source: "Overheid.nl / Primos, ABF" },
	{ year: 2019, shortage: 294000, percentage: 3.8, source: "Overheid.nl / Primos, ABF" },
	{ year: 2020, shortage: 331000, percentage: 4.2, source: "Overheid.nl / Primos, ABF" },
	{ year: 2021, shortage: 279000, percentage: 3.5, source: "Overheid.nl / Primos, ABF" },
	{ year: 2022, shortage: 315000, percentage: 3.9, source: "ABF Research / Primos 2022" },
	{ year: 2023, shortage: 390000, percentage: 4.8, source: "ABF Research / Primos 2023" },
	{ year: 2024, shortage: 401000, percentage: 4.9, source: "ABF Research / VRO, Woningmarktverkenning 2024-2039" },
	{ year: 2025, shortage: 396000, percentage: 4.8, source: "Staat van de Volkshuisvesting 2025 / Primos 2025" },
];

const gridQueue = [
	{ year: 2022, afnameRequests: 668, afnameMw: 811, invoedingRequests: 1991, invoedingMw: 1278, source: "Netbeheer Nederland, Stand van de Uitvoering Q1 2025" },
	{ year: 2023, afnameRequests: 6065, afnameMw: 3472, invoedingRequests: 6423, invoedingMw: 3108, source: "Netbeheer Nederland, Stand van de Uitvoering Q1 2025" },
	{ year: 2024, afnameRequests: 11922, afnameMw: 6739, invoedingRequests: 8440, invoedingMw: 4123, source: "Netbeheer Nederland, Stand van de Uitvoering Q1 2025" },
	{ year: 2025, afnameRequests: 15014, afnameMw: 9305, invoedingRequests: 8687, invoedingMw: 5027, source: "Netbeheer Nederland, Feiten en cijfers" },
];

async function fetchJson(url) {
	const response = await fetch(url, {
		headers: { "user-agent": "thaumatorium-de-autochtoonse-nederlander/1.0" },
	});
	if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
	return response.json();
}

async function fetchText(url) {
	const response = await fetch(url, {
		headers: { "user-agent": "thaumatorium-de-autochtoonse-nederlander/1.0" },
	});
	if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
	return response.text();
}

async function readExistingOutput() {
	try {
		return JSON.parse(await readFile(new URL("./data.json", import.meta.url), "utf8"));
	} catch {
		return null;
	}
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

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchODataPeriodBatches(table, entity, { periods, filter, select, delayMs = 150 }) {
	const rows = [];
	for (const period of periods) {
		if (rows.length) await sleep(delayMs);
		const periodFilter = `Perioden eq '${period}'`;
		const combinedFilter = filter ? `${filter} and ${periodFilter}` : periodFilter;
		rows.push(
			...(await fetchOData(table, entity, {
				$filter: combinedFilter,
				$select: select,
			}))
		);
	}
	return rows;
}

function yearFromPeriod(period) {
	const match = String(period).match(/^(\d{4})/);
	return match ? Number(match[1]) : null;
}

function indexByYear(rows, mapRow) {
	const result = new Map();
	for (const row of rows) {
		const year = yearFromPeriod(row.Perioden);
		if (!year) continue;
		result.set(year, mapRow(row, year));
	}
	return result;
}

function cleanTitle(title) {
	const cleaned = String(title || "")
		.replace(/\s+/g, " ")
		.trim();
	return cleaned === "Burger van Bondsrepubliek Duitsland" ? "Duits" : cleaned;
}

function categoryMap(rows) {
	return new Map(
		rows.map((row) => [
			row.Key,
			{
				key: row.Key,
				title: cleanTitle(row.Title),
				group: row.CategoryGroupID,
			},
		])
	);
}

function keyedMigrationByYear(rows, keyField, valueField) {
	const result = new Map();
	for (const row of rows) {
		const year = yearFromPeriod(row.Perioden);
		const key = row[keyField];
		const value = row[valueField];
		if (!year || !key || !Number.isFinite(value)) continue;
		if (!result.has(year)) result.set(year, new Map());
		result.get(year).set(key, value);
	}
	return result;
}

function keyedValueByYear(rows, keyBuilder, valueField) {
	const result = new Map();
	for (const row of rows) {
		const year = yearFromPeriod(row.Perioden);
		const key = keyBuilder(row);
		const value = row[valueField];
		if (!year || !key || !Number.isFinite(value)) continue;
		if (!result.has(year)) result.set(year, new Map());
		result.get(year).set(key, value);
	}
	return result;
}

function purposeByYear(rows, keyField, valueField) {
	const result = new Map();
	for (const row of rows) {
		const year = yearFromPeriod(row.JaarVanImmigratie);
		const key = row[keyField];
		const value = row[valueField];
		if (!year || !key || !Number.isFinite(value)) continue;
		if (!result.has(year)) result.set(year, new Map());
		result.get(year).set(key, value);
	}
	return result;
}

function ratio(value, total, multiplier = 1) {
	return Number.isFinite(value) && Number.isFinite(total) && total !== 0 ? (value / total) * multiplier : null;
}

function latestCountryTrends(rows, keyField, categories, valueField, isCandidate, limit = 8) {
	const byCountry = new Map();
	for (const row of rows) {
		const year = yearFromPeriod(row.Perioden);
		const category = categories.get(row[keyField]);
		const value = row[valueField];
		if (!year || !category || !Number.isFinite(value) || !isCandidate(category, row)) continue;
		if (!byCountry.has(category.key)) byCountry.set(category.key, { key: category.key, label: category.title, values: [] });
		byCountry.get(category.key).values.push({ year, value });
	}

	const latestYears = [...new Set([...byCountry.values()].flatMap((country) => country.values.map((row) => row.year)))].sort((a, b) => b - a).slice(0, 5);
	const latestYearSet = new Set(latestYears);

	return [...byCountry.values()]
		.map((country) => {
			const values = country.values.sort((a, b) => a.year - b.year);
			const latestWindowTotal = values.filter((row) => latestYearSet.has(row.year)).reduce((total, row) => total + row.value, 0);
			const peak = values.reduce((best, row) => (!best || row.value > best.value ? row : best), null);
			const latest = values.at(-1);
			return {
				...country,
				values,
				latestWindowTotal,
				latestValue: latest?.value ?? null,
				peakYear: peak?.year ?? null,
				peakValue: peak?.value ?? null,
			};
		})
		.sort((a, b) => b.latestWindowTotal - a.latestWindowTotal)
		.slice(0, limit)
		.map(({ latestWindowTotal, ...country }) => country);
}

function addAgeValue(container, year, bucketKey, field, value) {
	if (!Number.isFinite(value)) return;
	if (!container.has(year)) container.set(year, new Map());
	const yearMap = container.get(year);
	if (!yearMap.has(bucketKey)) yearMap.set(bucketKey, {});
	const bucket = yearMap.get(bucketKey);
	bucket[field] = (bucket[field] ?? 0) + value;
}

function ageStructureFromMaps(ageMaps) {
	const years = [...new Set(ageMaps.flatMap((map) => [...map.keys()]))].sort((a, b) => a - b);
	return years.map((year) => {
		const byBucket = new Map();
		for (const map of ageMaps) {
			const buckets = map.get(year);
			if (!buckets) continue;
			for (const [bucketKey, values] of buckets) {
				byBucket.set(bucketKey, { ...(byBucket.get(bucketKey) || {}), ...values });
			}
		}

		return {
			year,
			buckets: ageBuckets.map((bucket) => {
				const values = byBucket.get(bucket.key) || {};
				return {
					key: bucket.key,
					label: bucket.label,
					population: values.population ?? null,
					nativeBackgroundProxy: values.nativeBackgroundProxy ?? null,
					migrationBackgroundTotal: values.migrationBackgroundTotal ?? null,
					firstGenerationMigrationBackground: values.firstGenerationMigrationBackground ?? null,
					secondGenerationMigrationBackground: values.secondGenerationMigrationBackground ?? null,
				};
			}),
		};
	});
}

function topMigrationByYear(rows, keyField, categories, valueField, isCandidate, limit = 7) {
	const byYear = new Map();
	for (const row of rows) {
		const year = yearFromPeriod(row.Perioden);
		const category = categories.get(row[keyField]);
		const value = row[valueField];
		if (!year || !category || !Number.isFinite(value) || !isCandidate(category, row)) continue;
		if (!byYear.has(year)) byYear.set(year, []);
		byYear.get(year).push({
			key: category.key,
			label: category.title,
			value,
		});
	}

	for (const [year, items] of byYear) {
		byYear.set(
			year,
			items
				.sort((a, b) => b.value - a.value)
				.slice(0, limit)
				.map((item) => ({ label: item.label, value: item.value }))
		);
	}

	return byYear;
}

function isCurrentNamedCategory(category) {
	const title = category.title.toLowerCase();
	return !title.includes("voormalig") && !title.includes("(oud)") && !title.includes("europese unie") && !title.includes("gips") && !title.includes("midden- en oost");
}

function parseCsv(text) {
	const rows = [];
	let field = "";
	let row = [];
	let quoted = false;

	for (let index = 0; index < text.length; index += 1) {
		const char = text[index];
		const next = text[index + 1];

		if (quoted) {
			if (char === '"' && next === '"') {
				field += '"';
				index += 1;
			} else if (char === '"') {
				quoted = false;
			} else {
				field += char;
			}
			continue;
		}

		if (char === '"') {
			quoted = true;
		} else if (char === ";") {
			row.push(field);
			field = "";
		} else if (char === "\n") {
			row.push(field.replace(/\r$/, ""));
			rows.push(row);
			row = [];
			field = "";
		} else {
			field += char;
		}
	}

	if (field || row.length) {
		row.push(field.replace(/\r$/, ""));
		rows.push(row);
	}

	const [headers, ...dataRows] = rows.filter((csvRow) => csvRow.length > 1);
	return dataRows.map((csvRow) => Object.fromEntries(headers.map((header, index) => [header, csvRow[index] ?? ""])));
}

function parseDutchNumber(value) {
	if (value === null || value === undefined || value === "") return null;
	const parsed = Number(String(value).trim().replace(/\./g, "").replace(",", "."));
	return Number.isFinite(parsed) ? parsed : null;
}

function shareOfTotal(value, total) {
	return Number.isFinite(value) && Number.isFinite(total) && total !== 0 ? (value / total) * 100 : null;
}

function thousands(value) {
	return Number.isFinite(value) ? value * 1000 : null;
}

function interpolateHousingShortage(rows) {
	const sorted = [...rows].sort((a, b) => a.year - b.year);
	const byYear = new Map(sorted.map((row) => [row.year, { ...row, interpolated: false }]));
	const interpolatedYears = [];

	for (let index = 0; index < sorted.length - 1; index += 1) {
		const start = sorted[index];
		const end = sorted[index + 1];
		const gap = end.year - start.year;
		if (gap <= 1) continue;

		for (let year = start.year + 1; year < end.year; year += 1) {
			const ratio = (year - start.year) / gap;
			const row = {
				year,
				shortage: Math.round(start.shortage + (end.shortage - start.shortage) * ratio),
				percentage: Number.isFinite(start.percentage) && Number.isFinite(end.percentage) ? Math.round((start.percentage + (end.percentage - start.percentage) * ratio) * 10) / 10 : null,
				source: `Lineair geinterpoleerd tussen ${start.year} en ${end.year}`,
				interpolated: true,
				basis: [start.year, end.year],
			};
			byYear.set(year, row);
			interpolatedYears.push({ year, basis: row.basis });
		}
	}

	return {
		byYear,
		observedYears: sorted.map((row) => row.year),
		interpolatedYears,
		method: "Lineaire interpolatie tussen opeenvolgende bekende ABF/Primos-punten; geen extrapolatie buiten de bekende reeks.",
	};
}

function sumField(rows, field) {
	return rows.reduce((total, row) => total + (parseDutchNumber(row[field]) || 0), 0);
}

function knownCapacityRows(rows, direction) {
	return rows.filter((row) => {
		const available = parseDutchNumber(row[`aanwezige_transportcapaciteit_${direction}`]);
		const required = parseDutchNumber(row[`benodigde_transportcapaciteit_${direction}`]);
		return Number.isFinite(available) && Number.isFinite(required);
	});
}

function aggregateCapacity(rows, direction) {
	const knownRows = knownCapacityRows(rows, direction);
	const availableMw = sumField(knownRows, `aanwezige_transportcapaciteit_${direction}`);
	const requiredMw = sumField(knownRows, `benodigde_transportcapaciteit_${direction}`);
	const waitlistMw = sumField(rows, `wachtrij_${direction}`);
	const requests = sumField(rows, `unieke_verzoeken_${direction}`);

	return {
		availableMw: Math.round(availableMw * 10) / 10,
		requiredMw: Math.round(requiredMw * 10) / 10,
		headroomMw: Math.round((availableMw - requiredMw) * 10) / 10,
		waitlistMw: Math.round(waitlistMw * 10) / 10,
		requests: Math.round(requests),
		knownAreas: knownRows.length,
		areasWithWaitlist: rows.filter((row) => (parseDutchNumber(row[`wachtrij_${direction}`]) || 0) > 0).length,
	};
}

function aggregateCapacityByProvince(rows) {
	const byProvince = new Map();
	for (const row of rows) {
		const province = row.provincie || "Onbekend";
		if (!byProvince.has(province)) byProvince.set(province, []);
		byProvince.get(province).push(row);
	}

	return [...byProvince.entries()]
		.map(([province, provinceRows]) => ({
			province,
			afname: aggregateCapacity(provinceRows, "afname"),
			invoeding: aggregateCapacity(provinceRows, "invoeding"),
		}))
		.sort((a, b) => b.afname.waitlistMw + b.invoeding.waitlistMw - (a.afname.waitlistMw + a.invoeding.waitlistMw));
}

async function main() {
	const [
		demographicsInfo,
		populationInfo,
		migrationInfo,
		migrationOriginInfo,
		migrationBirthCountryInfo,
		migrationNationalityInfo,
		migrationPurposeEuInfo,
		migrationPurposeNonEuInfo,
		compositionLongInfo,
		compositionAgeHistoricalInfo,
		compositionHistoricalInfo,
		compositionCurrentInfo,
		compositionFlowsInfo,
		housingInfo,
		demographicsRows,
		populationRows,
		migrationRows,
		migrationOriginPeriods,
		migrationOriginCategories,
		migrationBirthCountryRows,
		migrationBirthCountryCategories,
		migrationNationalityRows,
		migrationNationalityCategories,
		migrationPurposeEuRows,
		migrationPurposeNonEuRows,
		compositionLongAgeRows,
		compositionLongRows,
		compositionAgeHistoricalPeriods,
		compositionCurrentPeriods,
		compositionHistoricalRows,
		compositionCurrentRows,
		compositionFlowsRows,
		housingRows,
		capacityCsv,
	] = await Promise.all([
		fetchOData(datasets.demographics, "TableInfos"),
		fetchOData(datasets.population, "TableInfos"),
		fetchOData(datasets.migration, "TableInfos"),
		fetchOData(datasets.migrationOrigin, "TableInfos"),
		fetchOData(datasets.migrationBirthCountry, "TableInfos"),
		fetchOData(datasets.migrationNationality, "TableInfos"),
		fetchOData(datasets.migrationPurposeEu, "TableInfos"),
		fetchOData(datasets.migrationPurposeNonEu, "TableInfos"),
		fetchOData(datasets.compositionLong, "TableInfos"),
		fetchOData(datasets.compositionAgeHistorical, "TableInfos"),
		fetchOData(datasets.compositionHistorical, "TableInfos"),
		fetchOData(datasets.compositionCurrent, "TableInfos"),
		fetchOData(datasets.compositionFlows, "TableInfos"),
		fetchOData(datasets.housing, "TableInfos"),
		fetchOData(datasets.demographics, "TypedDataSet", {
			$select: "Perioden,TotaalBevolking_4,LevendGeborenKinderen_73,Overledenen_74,Geboorteoverschot_75,Immigratie_76,EmigratieInclusiefAdministratieveC_77,MigratiesaldoInclusiefAdministrati_78,TotaleBevolkingsgroei_79",
		}),
		fetchOData(datasets.population, "TypedDataSet", {
			$select: "Perioden,TotaleBevolking_1,TotaleBevolkingsgroei_65",
		}),
		fetchOData(datasets.migration, "TypedDataSet", {
			$filter: "Geslacht eq 'T001038' and Leeftijd eq '10000' and Nationaliteit eq 'T001059' and RegioS eq 'NL01  '",
			$select: "Perioden,Immigratie_1,EmigratieInclusiefAdministratieveC_2,MigratiesaldoInclusiefAdministratie_3",
		}),
		fetchOData(datasets.migrationOrigin, "Perioden"),
		fetchOData(datasets.migrationOrigin, "LandVanVertrekBestemming"),
		fetchOData(datasets.migrationBirthCountry, "TypedDataSet", {
			$filter: "Geslacht eq 'T001038' and Leeftijd eq '10000' and RegioS eq 'NL01  '",
			$select: "Perioden,Geboorteland,Immigratie_1,EmigratieInclusiefAdministratieveC_2,AdministratieveAfvoeringen_5",
		}),
		fetchOData(datasets.migrationBirthCountry, "Geboorteland"),
		fetchOData(datasets.migrationNationality, "TypedDataSet", {
			$filter: "Geslacht eq 'T001038' and LeeftijdOp31December eq '10000' and BurgerlijkeStaat eq 'T001019'",
			$select: "Perioden,Nationaliteit,Immigratie_1,EmigratieInclusiefAdministratieveC_2,AdministratieveAfvoeringen_5",
		}),
		fetchOData(datasets.migrationNationality, "Nationaliteit"),
		fetchOData(datasets.migrationPurposeEu, "TypedDataSet", {
			$filter: "Geslacht eq 'T001038' and Leeftijd eq '10000  ' and Nationaliteit eq 'T001059' and SociaaleconomischeCategorie eq 'T001083' and Verblijfsduur eq 'A027954'",
			$select: "JaarVanImmigratie,AfgeleidMigratiedoel,ImmigrantenUitEUEFTALanden_1",
		}),
		fetchOData(datasets.migrationPurposeNonEu, "TypedDataSet", {
			$filter: "Geslacht eq 'T001038' and Leeftijd eq '10000  ' and Nationaliteit eq 'T001059' and SociaaleconomischeCategorie eq 'T001083' and Verblijfsduur eq 'A027954'",
			$select: "JaarVanImmigratie,Migratiemotief,ImmigrantenExclusiefEUEFTA_1",
		}),
		fetchOData(datasets.compositionLong, "TypedDataSet", {
			$filter: `Geslacht eq 'T001038' and Migratieachtergrond eq '${compositionCodes.migrationBackground}'`,
			$select: "Perioden,Leeftijd,k_1eEn2eGeneratieMigratieachtergrond_1,k_1eGeneratieMigratieachtergrond_2,k_2eGeneratieMigratieachtergrond_3",
		}),
		fetchOData(datasets.compositionLong, "TypedDataSet", {
			$filter: `Geslacht eq 'T001038' and Leeftijd eq '10000' and Migratieachtergrond eq '${compositionCodes.migrationBackground}'`,
			$select: "Perioden,k_1eEn2eGeneratieMigratieachtergrond_1,k_1eGeneratieMigratieachtergrond_2,k_2eGeneratieMigratieachtergrond_3",
		}),
		fetchOData(datasets.compositionAgeHistorical, "Perioden"),
		fetchOData(datasets.compositionCurrent, "Perioden"),
		fetchOData(datasets.compositionHistorical, "TypedDataSet", {
			$filter: `(Migratieachtergrond eq '${compositionCodes.nativeBackground}' or Migratieachtergrond eq '${compositionCodes.migrationBackground}') and (Generatie eq '${compositionCodes.total}' or Generatie eq '${compositionCodes.firstGeneration}' or Generatie eq '${compositionCodes.secondGeneration}')`,
			$select: "Perioden,Migratieachtergrond,Generatie,BevolkingOp1Januari_1",
		}),
		fetchOData(datasets.compositionCurrent, "TypedDataSet", {
			$filter: `Geslacht eq 'T001038' and Leeftijd eq '10000' and BurgerlijkeStaat eq 'T001019' and Herkomstland eq '${compositionCodes.total}' and (Geboorteland eq '${compositionCodes.totalBirthCountry}' or Geboorteland eq '${compositionCodes.bornInNetherlands}' or Geboorteland eq '${compositionCodes.bornOutsideNetherlands}') and (GeboortelandOuders eq '${compositionCodes.totalBirthCountry}' or GeboortelandOuders eq '${compositionCodes.bothParentsBornInNetherlands}' or GeboortelandOuders eq '${compositionCodes.oneParentBornAbroad}' or GeboortelandOuders eq '${compositionCodes.bothParentsBornAbroad}')`,
			$select: "Perioden,Geboorteland,GeboortelandOuders,Bevolking_1",
		}),
		fetchOData(datasets.compositionFlows, "TypedDataSet", {
			$filter: `Geslacht eq 'T001038' and Leeftijd eq '10000' and BurgerlijkeStaat eq 'T001019' and Herkomstland eq '${compositionCodes.total}' and Geboorteland eq '${compositionCodes.totalBirthCountry}' and (GeboortelandOuders eq '${compositionCodes.totalBirthCountry}' or GeboortelandOuders eq '${compositionCodes.bothParentsBornInNetherlands}' or GeboortelandOuders eq '${compositionCodes.oneParentBornAbroad}' or GeboortelandOuders eq '${compositionCodes.bothParentsBornAbroad}')`,
			$select: "Perioden,GeboortelandOuders,Overledenen_3,Geboorteoverschot_4",
		}),
		fetchOData(datasets.housing, "TypedDataSet", {
			$select: "Perioden,Nieuwbouw_2,Woningbouw_5,SaldoVoorraad_8,EindstandVoorraad_9",
		}),
		fetchText(`${capacityBase}/voedingsgebieden.csv`).catch(() => null),
	]);

	const migrationOriginRows = await fetchODataPeriodBatches(datasets.migrationOrigin, "TypedDataSet", {
		periods: migrationOriginPeriods.map((row) => row.Key),
		filter: "Geslacht eq 'T001038' and Leeftijd eq '10000'",
		select: "Perioden,LandVanVertrekBestemming,Geboorteland,Immigratie_1,EmigratieExclusiefAdministratieveC_2",
		delayMs: 150,
	});
	const compositionAgeHistoricalRows = await fetchODataPeriodBatches(datasets.compositionAgeHistorical, "TypedDataSet", {
		periods: compositionAgeHistoricalPeriods.map((row) => row.Key),
		filter: `Geslacht eq 'T001038' and BurgerlijkeStaat eq 'T001019' and (Migratieachtergrond eq '${compositionCodes.total}' or Migratieachtergrond eq '${compositionCodes.nativeBackground}' or Migratieachtergrond eq '${compositionCodes.migrationBackground}') and (Generatie eq '${compositionCodes.total}' or Generatie eq '${compositionCodes.nativeBackground}' or Generatie eq '${compositionCodes.migrationBackground}' or Generatie eq '${compositionCodes.firstGeneration}' or Generatie eq '${compositionCodes.secondGeneration}')`,
		select: "Perioden,Leeftijd,Migratieachtergrond,Generatie,Bevolking_1",
		delayMs: 80,
	});
	const compositionCurrentAgeRows = await fetchODataPeriodBatches(datasets.compositionCurrent, "TypedDataSet", {
		periods: compositionCurrentPeriods.map((row) => row.Key),
		filter: `Geslacht eq 'T001038' and BurgerlijkeStaat eq 'T001019' and Herkomstland eq '${compositionCodes.total}' and (Geboorteland eq '${compositionCodes.totalBirthCountry}' or Geboorteland eq '${compositionCodes.bornInNetherlands}' or Geboorteland eq '${compositionCodes.bornOutsideNetherlands}') and (GeboortelandOuders eq '${compositionCodes.totalBirthCountry}' or GeboortelandOuders eq '${compositionCodes.bothParentsBornInNetherlands}' or GeboortelandOuders eq '${compositionCodes.oneParentBornAbroad}' or GeboortelandOuders eq '${compositionCodes.bothParentsBornAbroad}')`,
		select: "Perioden,Leeftijd,Geboorteland,GeboortelandOuders,Bevolking_1",
		delayMs: 80,
	});

	const historicalPopulationByYear = indexByYear(demographicsRows, (row) => ({
		population: thousands(row.TotaalBevolking_4),
	}));
	const historicalMigrationByYear = indexByYear(demographicsRows, (row) => ({
		liveBirths: thousands(row.LevendGeborenKinderen_73),
		deaths: thousands(row.Overledenen_74),
		birthSurplus: thousands(row.Geboorteoverschot_75),
		immigration: thousands(row.Immigratie_76),
		emigration: thousands(row.EmigratieInclusiefAdministratieveC_77),
		netMigration: thousands(row.MigratiesaldoInclusiefAdministrati_78),
		populationGrowth: thousands(row.TotaleBevolkingsgroei_79),
	}));

	const migrationByYear = new Map(historicalMigrationByYear);
	const populationByYear = new Map(historicalPopulationByYear);
	for (const [year, row] of indexByYear(populationRows, (sourceRow) => ({ population: sourceRow.TotaleBevolking_1, populationGrowth: sourceRow.TotaleBevolkingsgroei_65 }))) {
		populationByYear.set(year, { population: row.population });
		if (Number.isFinite(row.populationGrowth)) {
			migrationByYear.set(year, {
				...migrationByYear.get(year),
				populationGrowth: row.populationGrowth,
			});
		}
	}

	for (const [year, row] of indexByYear(migrationRows, (sourceRow) => ({
		immigration: sourceRow.Immigratie_1,
		emigration: sourceRow.EmigratieInclusiefAdministratieveC_2,
		netMigration: sourceRow.MigratiesaldoInclusiefAdministratie_3,
	}))) {
		migrationByYear.set(year, {
			...migrationByYear.get(year),
			...row,
		});
	}

	const originCategories = categoryMap(migrationOriginCategories);
	const birthCountryCategories = categoryMap(migrationBirthCountryCategories);
	const nationalityCategories = categoryMap(migrationNationalityCategories);
	const originTotalRows = migrationOriginRows.filter((row) => row.Geboorteland === "T001175");
	const originByYear = keyedMigrationByYear(originTotalRows, "LandVanVertrekBestemming", "Immigratie_1");
	const destinationByYear = keyedMigrationByYear(originTotalRows, "LandVanVertrekBestemming", "EmigratieExclusiefAdministratieveC_2");
	const birthCountryByYear = keyedMigrationByYear(migrationBirthCountryRows, "Geboorteland", "Immigratie_1");
	const birthCountryEmigrationByYear = keyedMigrationByYear(migrationBirthCountryRows, "Geboorteland", "EmigratieInclusiefAdministratieveC_2");
	const birthCountryAdminRemovalByYear = keyedMigrationByYear(migrationBirthCountryRows, "Geboorteland", "AdministratieveAfvoeringen_5");
	const nationalityByYear = keyedMigrationByYear(migrationNationalityRows, "Nationaliteit", "Immigratie_1");
	const nationalityEmigrationByYear = keyedMigrationByYear(migrationNationalityRows, "Nationaliteit", "EmigratieInclusiefAdministratieveC_2");
	const migrationPurposeEuByYear = purposeByYear(migrationPurposeEuRows, "AfgeleidMigratiedoel", "ImmigrantenUitEUEFTALanden_1");
	const migrationPurposeNonEuByYear = purposeByYear(migrationPurposeNonEuRows, "Migratiemotief", "ImmigrantenExclusiefEUEFTA_1");
	const topDepartureByYear = topMigrationByYear(originTotalRows, "LandVanVertrekBestemming", originCategories, "Immigratie_1", (category) => category.group !== 1 && category.group !== 4 && isCurrentNamedCategory(category));
	const topDestinationByYear = topMigrationByYear(originTotalRows, "LandVanVertrekBestemming", originCategories, "EmigratieExclusiefAdministratieveC_2", (category) => category.group !== 1 && category.group !== 4 && isCurrentNamedCategory(category));
	const topBirthCountryByYear = topMigrationByYear(migrationBirthCountryRows, "Geboorteland", birthCountryCategories, "Immigratie_1", (category) => Number(category.group) >= 4 && isCurrentNamedCategory(category));
	const topEmigrationBirthCountryByYear = topMigrationByYear(migrationBirthCountryRows, "Geboorteland", birthCountryCategories, "EmigratieInclusiefAdministratieveC_2", (category) => Number(category.group) >= 4 && isCurrentNamedCategory(category));
	const topNationalityByYear = topMigrationByYear(migrationNationalityRows, "Nationaliteit", nationalityCategories, "Immigratie_1", (category) => Number(category.group) >= 4 && isCurrentNamedCategory(category));
	const topEmigrationNationalityByYear = topMigrationByYear(migrationNationalityRows, "Nationaliteit", nationalityCategories, "EmigratieInclusiefAdministratieveC_2", (category) => Number(category.group) >= 4 && isCurrentNamedCategory(category));
	const originYears = [...new Set([...originByYear.keys(), ...birthCountryByYear.keys(), ...nationalityByYear.keys()])].sort((a, b) => a - b);
	const migrationOriginBreakdown = originYears.map((year) => ({
		year,
		departureTop: topDepartureByYear.get(year) || [],
		birthCountryTop: topBirthCountryByYear.get(year) || [],
		nationalityTop: topNationalityByYear.get(year) || [],
	}));
	const emigrationYears = [...new Set([...destinationByYear.keys(), ...birthCountryEmigrationByYear.keys(), ...nationalityEmigrationByYear.keys()])].sort((a, b) => a - b);
	const migrationEmigrationBreakdown = emigrationYears.map((year) => ({
		year,
		destinationTop: topDestinationByYear.get(year) || [],
		birthCountryTop: topEmigrationBirthCountryByYear.get(year) || [],
		nationalityTop: topEmigrationNationalityByYear.get(year) || [],
	}));
	const migrationOriginCountryTrends = latestCountryTrends(originTotalRows, "LandVanVertrekBestemming", originCategories, "Immigratie_1", (category) => category.group !== 1 && category.group !== 4 && isCurrentNamedCategory(category));
	const migrationEmigrationCountryTrends = latestCountryTrends(originTotalRows, "LandVanVertrekBestemming", originCategories, "EmigratieExclusiefAdministratieveC_2", (category) => category.group !== 1 && category.group !== 4 && isCurrentNamedCategory(category));

	const housingByYear = indexByYear(housingRows, (row) => ({
		newHomes: row.Nieuwbouw_2,
		totalHomeBuilding: row.Woningbouw_5,
		netHousingStockGrowth: row.SaldoVoorraad_8,
		housingStock: row.EindstandVoorraad_9 ? row.EindstandVoorraad_9 * 1000 : null,
	}));
	const compositionHistoricalByYear = keyedValueByYear(compositionHistoricalRows, (row) => `${row.Migratieachtergrond}|${row.Generatie}`, "BevolkingOp1Januari_1");
	const compositionLongByYear = indexByYear(compositionLongRows, (row) => ({
		migrationBackgroundTotal: row.k_1eEn2eGeneratieMigratieachtergrond_1,
		firstGenerationMigrationBackground: row.k_1eGeneratieMigratieachtergrond_2,
		secondGenerationMigrationBackground: row.k_2eGeneratieMigratieachtergrond_3,
		reconstructed: yearFromPeriod(row.Perioden) < 1996,
	}));
	const compositionCurrentByYear = keyedValueByYear(compositionCurrentRows, (row) => `${row.Geboorteland}|${row.GeboortelandOuders}`, "Bevolking_1");
	const compositionFlowDeathsByYear = keyedValueByYear(compositionFlowsRows, (row) => row.GeboortelandOuders, "Overledenen_3");
	const compositionFlowBirthSurplusByYear = keyedValueByYear(compositionFlowsRows, (row) => row.GeboortelandOuders, "Geboorteoverschot_4");
	const bornAbroadDutchParentsDirectOffsets = [...compositionCurrentByYear.values()].map((rows) => rows.get(`${compositionCodes.bornOutsideNetherlands}|${compositionCodes.bothParentsBornInNetherlands}`)).filter((value) => Number.isFinite(value));
	const bornAbroadDutchParentsBackcastOffset = bornAbroadDutchParentsDirectOffsets.length ? Math.round(bornAbroadDutchParentsDirectOffsets.reduce((total, value) => total + value, 0) / bornAbroadDutchParentsDirectOffsets.length) : null;
	const interpolatedHousingShortage = interpolateHousingShortage(housingShortage);
	const shortageByYear = interpolatedHousingShortage.byYear;
	const queueByYear = new Map(gridQueue.map((row) => [row.year, row]));

	const ageLongByYear = new Map();
	for (const row of compositionLongAgeRows) {
		const year = yearFromPeriod(row.Perioden);
		const bucket = ageCodeToBucket.get(row.Leeftijd);
		if (!year || !bucket || row.Leeftijd === "10000") continue;
		addAgeValue(ageLongByYear, year, bucket, "migrationBackgroundTotal", row.k_1eEn2eGeneratieMigratieachtergrond_1);
		addAgeValue(ageLongByYear, year, bucket, "firstGenerationMigrationBackground", row.k_1eGeneratieMigratieachtergrond_2);
		addAgeValue(ageLongByYear, year, bucket, "secondGenerationMigrationBackground", row.k_2eGeneratieMigratieachtergrond_3);
	}

	const ageHistoricalByYear = new Map();
	for (const row of compositionAgeHistoricalRows) {
		const year = yearFromPeriod(row.Perioden);
		const bucket = ageCodeToBucket.get(row.Leeftijd);
		if (!year || !bucket || row.Leeftijd === "10000") continue;
		const key = `${row.Migratieachtergrond}|${row.Generatie}`;
		const field =
			key === `${compositionCodes.total}|${compositionCodes.total}`
				? "population"
				: key === `${compositionCodes.nativeBackground}|${compositionCodes.nativeBackground}`
					? "nativeBackgroundProxy"
					: key === `${compositionCodes.migrationBackground}|${compositionCodes.migrationBackground}`
						? "migrationBackgroundTotal"
						: key === `${compositionCodes.migrationBackground}|${compositionCodes.firstGeneration}`
							? "firstGenerationMigrationBackground"
							: key === `${compositionCodes.migrationBackground}|${compositionCodes.secondGeneration}`
								? "secondGenerationMigrationBackground"
								: null;
		if (field) addAgeValue(ageHistoricalByYear, year, bucket, field, row.Bevolking_1);
	}

	const currentAgeByRawKey = keyedValueByYear(compositionCurrentAgeRows, (row) => `${row.Leeftijd}|${row.Geboorteland}|${row.GeboortelandOuders}`, "Bevolking_1");
	const ageCurrentByYear = new Map();
	for (const [year, values] of currentAgeByRawKey) {
		for (const ageCode of new Set([...values.keys()].map((key) => key.split("|")[0]))) {
			const bucket = ageCodeToBucket.get(ageCode);
			if (!bucket || ageCode === "10000") continue;
			const population = values.get(`${ageCode}|${compositionCodes.totalBirthCountry}|${compositionCodes.totalBirthCountry}`) ?? null;
			const nativeBackgroundProxy = values.get(`${ageCode}|${compositionCodes.totalBirthCountry}|${compositionCodes.bothParentsBornInNetherlands}`) ?? null;
			const bornAbroadCurrent = values.get(`${ageCode}|${compositionCodes.bornOutsideNetherlands}|${compositionCodes.totalBirthCountry}`) ?? null;
			const bornAbroadDutchParentsCurrent = values.get(`${ageCode}|${compositionCodes.bornOutsideNetherlands}|${compositionCodes.bothParentsBornInNetherlands}`) ?? null;
			const secondGenerationOneParentAbroad = values.get(`${ageCode}|${compositionCodes.bornInNetherlands}|${compositionCodes.oneParentBornAbroad}`) ?? null;
			const secondGenerationBothParentsAbroad = values.get(`${ageCode}|${compositionCodes.bornInNetherlands}|${compositionCodes.bothParentsBornAbroad}`) ?? null;
			addAgeValue(ageCurrentByYear, year, bucket, "population", population);
			addAgeValue(ageCurrentByYear, year, bucket, "nativeBackgroundProxy", nativeBackgroundProxy);
			addAgeValue(ageCurrentByYear, year, bucket, "migrationBackgroundTotal", Number.isFinite(population) && Number.isFinite(nativeBackgroundProxy) ? population - nativeBackgroundProxy : null);
			addAgeValue(ageCurrentByYear, year, bucket, "firstGenerationMigrationBackground", Number.isFinite(bornAbroadCurrent) && Number.isFinite(bornAbroadDutchParentsCurrent) ? bornAbroadCurrent - bornAbroadDutchParentsCurrent : null);
			addAgeValue(ageCurrentByYear, year, bucket, "secondGenerationMigrationBackground", Number.isFinite(secondGenerationOneParentAbroad) && Number.isFinite(secondGenerationBothParentsAbroad) ? secondGenerationOneParentAbroad + secondGenerationBothParentsAbroad : null);
		}
	}
	const ageStructureByYear = ageStructureFromMaps([ageLongByYear, ageHistoricalByYear, ageCurrentByYear]);

	const years = [];
	for (let year = 1899; year <= 2026; year += 1) years.push(year);

	let cumulativeImmigrationTotal = 0;
	let hasCumulativeImmigration = false;
	let cumulativeNetMigrationTotal = 0;
	let hasCumulativeNetMigration = false;
	let cumulativeLiveBirthsTotal = 0;
	let hasCumulativeLiveBirths = false;
	let cumulativeDeathsTotal = 0;
	let hasCumulativeDeaths = false;
	let cumulativeBirthSurplusTotal = 0;
	let hasCumulativeBirthSurplus = false;

	const rawTimeline = years.map((year) => {
		const population = populationByYear.get(year)?.population ?? null;
		const migration = migrationByYear.get(year) || {};
		const housing = housingByYear.get(year) || {};
		const shortage = shortageByYear.get(year) || {};
		const queue = queueByYear.get(year) || {};
		const liveBirths = migration.liveBirths ?? null;
		const deaths = migration.deaths ?? null;
		const birthSurplus = migration.birthSurplus ?? null;
		const populationGrowth = migration.populationGrowth ?? null;
		const immigration = migration.immigration ?? null;
		const netMigration = migration.netMigration ?? null;
		const otherCorrections = Number.isFinite(populationGrowth) && Number.isFinite(birthSurplus) && Number.isFinite(netMigration) ? populationGrowth - birthSurplus - netMigration : null;
		const origin = originByYear.get(year) || new Map();
		const destination = destinationByYear.get(year) || new Map();
		const birthCountry = birthCountryByYear.get(year) || new Map();
		const birthCountryEmigration = birthCountryEmigrationByYear.get(year) || new Map();
		const birthCountryAdminRemoval = birthCountryAdminRemovalByYear.get(year) || new Map();
		const nationality = nationalityByYear.get(year) || new Map();
		const nationalityEmigration = nationalityEmigrationByYear.get(year) || new Map();
		const purposeEu = migrationPurposeEuByYear.get(year) || new Map();
		const purposeNonEu = migrationPurposeNonEuByYear.get(year) || new Map();
		const historicalComposition = compositionHistoricalByYear.get(year) || new Map();
		const longComposition = compositionLongByYear.get(year) || {};
		const currentComposition = compositionCurrentByYear.get(year) || new Map();
		const compositionFlowDeaths = compositionFlowDeathsByYear.get(year) || new Map();
		const compositionFlowBirthSurplus = compositionFlowBirthSurplusByYear.get(year) || new Map();
		const nativeBackgroundHistorical = historicalComposition.get(`${compositionCodes.nativeBackground}|${compositionCodes.total}`) ?? null;
		const migrationBackgroundTotalHistorical = historicalComposition.get(`${compositionCodes.migrationBackground}|${compositionCodes.total}`) ?? null;
		const firstGenerationHistorical = historicalComposition.get(`${compositionCodes.migrationBackground}|${compositionCodes.firstGeneration}`) ?? null;
		const secondGenerationHistorical = historicalComposition.get(`${compositionCodes.migrationBackground}|${compositionCodes.secondGeneration}`) ?? null;
		const migrationBackgroundTotalLong = longComposition.migrationBackgroundTotal ?? null;
		const firstGenerationLong = longComposition.firstGenerationMigrationBackground ?? null;
		const secondGenerationLong = longComposition.secondGenerationMigrationBackground ?? null;
		const nativeBackgroundLong = Number.isFinite(population) && Number.isFinite(migrationBackgroundTotalLong) ? population - migrationBackgroundTotalLong : null;
		const nativeBackgroundCurrent = currentComposition.get(`${compositionCodes.totalBirthCountry}|${compositionCodes.bothParentsBornInNetherlands}`) ?? null;
		const bornAbroadCurrent = currentComposition.get(`${compositionCodes.bornOutsideNetherlands}|${compositionCodes.totalBirthCountry}`) ?? null;
		const bornAbroadDutchParentsCurrent = currentComposition.get(`${compositionCodes.bornOutsideNetherlands}|${compositionCodes.bothParentsBornInNetherlands}`) ?? null;
		const secondGenerationOneParentAbroad = currentComposition.get(`${compositionCodes.bornInNetherlands}|${compositionCodes.oneParentBornAbroad}`) ?? null;
		const secondGenerationBothParentsAbroad = currentComposition.get(`${compositionCodes.bornInNetherlands}|${compositionCodes.bothParentsBornAbroad}`) ?? null;
		const firstGenerationCurrent = Number.isFinite(bornAbroadCurrent) && Number.isFinite(bornAbroadDutchParentsCurrent) ? bornAbroadCurrent - bornAbroadDutchParentsCurrent : null;
		const secondGenerationCurrent = Number.isFinite(secondGenerationOneParentAbroad) && Number.isFinite(secondGenerationBothParentsAbroad) ? secondGenerationOneParentAbroad + secondGenerationBothParentsAbroad : null;
		const migrationBackgroundTotalCurrent = Number.isFinite(population) && Number.isFinite(nativeBackgroundCurrent) ? population - nativeBackgroundCurrent : Number.isFinite(firstGenerationCurrent) && Number.isFinite(secondGenerationCurrent) ? firstGenerationCurrent + secondGenerationCurrent : null;
		const nativeBackgroundProxy = nativeBackgroundCurrent ?? nativeBackgroundHistorical ?? nativeBackgroundLong;
		const migrationBackgroundTotal = migrationBackgroundTotalCurrent ?? migrationBackgroundTotalHistorical ?? migrationBackgroundTotalLong;
		const firstGenerationMigrationBackground = firstGenerationCurrent ?? firstGenerationHistorical ?? firstGenerationLong;
		const secondGenerationMigrationBackground = secondGenerationCurrent ?? secondGenerationHistorical ?? secondGenerationLong;
		const bornAbroadDutchParents = bornAbroadDutchParentsCurrent ?? (Number.isFinite(firstGenerationMigrationBackground) ? bornAbroadDutchParentsBackcastOffset : null);
		const bornAbroadPopulation = bornAbroadCurrent ?? (Number.isFinite(firstGenerationMigrationBackground) && Number.isFinite(bornAbroadDutchParentsBackcastOffset) ? firstGenerationMigrationBackground + bornAbroadDutchParentsBackcastOffset : null);
		const bornAbroadPopulationEstimated = !Number.isFinite(bornAbroadCurrent) && Number.isFinite(bornAbroadPopulation);
		const directBirthsTotal =
			Number.isFinite(compositionFlowDeaths.get(compositionCodes.totalBirthCountry)) && Number.isFinite(compositionFlowBirthSurplus.get(compositionCodes.totalBirthCountry)) ? compositionFlowDeaths.get(compositionCodes.totalBirthCountry) + compositionFlowBirthSurplus.get(compositionCodes.totalBirthCountry) : null;
		const nativeProxyBirths =
			Number.isFinite(compositionFlowDeaths.get(compositionCodes.bothParentsBornInNetherlands)) && Number.isFinite(compositionFlowBirthSurplus.get(compositionCodes.bothParentsBornInNetherlands))
				? compositionFlowDeaths.get(compositionCodes.bothParentsBornInNetherlands) + compositionFlowBirthSurplus.get(compositionCodes.bothParentsBornInNetherlands)
				: null;
		const nativeProxyBirthsPctLiveBirths = shareOfTotal(nativeProxyBirths, directBirthsTotal ?? liveBirths);
		const compositionMethod = Number.isFinite(nativeBackgroundCurrent)
			? "geboorteland_en_ouders"
			: Number.isFinite(nativeBackgroundHistorical)
				? "migratieachtergrond_en_generatie"
				: Number.isFinite(nativeBackgroundLong)
					? longComposition.reconstructed
						? "migratieachtergrond_reconstructie"
						: "migratieachtergrond_lange_reeks"
					: null;
		const qualityMethod = compositionMethod === "migratieachtergrond_reconstructie" ? "cbs_reconstruction" : compositionMethod === "migratieachtergrond_en_generatie" ? "direct_cbs" : compositionMethod === "geboorteland_en_ouders" ? "derived_bridge" : null;

		if (Number.isFinite(immigration)) {
			cumulativeImmigrationTotal += immigration;
			hasCumulativeImmigration = true;
		}

		if (Number.isFinite(liveBirths)) {
			cumulativeLiveBirthsTotal += liveBirths;
			hasCumulativeLiveBirths = true;
		}

		if (Number.isFinite(deaths)) {
			cumulativeDeathsTotal += deaths;
			hasCumulativeDeaths = true;
		}

		if (Number.isFinite(birthSurplus)) {
			cumulativeBirthSurplusTotal += birthSurplus;
			hasCumulativeBirthSurplus = true;
		}

		if (Number.isFinite(netMigration)) {
			cumulativeNetMigrationTotal += netMigration;
			hasCumulativeNetMigration = true;
		}

		const cumulativeImmigration = hasCumulativeImmigration ? cumulativeImmigrationTotal : null;
		const cumulativeLiveBirths = hasCumulativeLiveBirths ? cumulativeLiveBirthsTotal : null;
		const cumulativeDeaths = hasCumulativeDeaths ? cumulativeDeathsTotal : null;
		const cumulativeBirthSurplus = hasCumulativeBirthSurplus ? cumulativeBirthSurplusTotal : null;
		const cumulativeNetMigration = hasCumulativeNetMigration ? cumulativeNetMigrationTotal : null;

		return {
			year,
			population,
			liveBirths,
			deaths,
			birthSurplus,
			naturalGrowth: birthSurplus,
			populationGrowth,
			otherCorrections,
			cumulativeLiveBirths,
			cumulativeDeaths,
			cumulativeBirthSurplus,
			immigration,
			emigration: migration.emigration ?? null,
			netMigration,
			netMigrationPctPopulation: Number.isFinite(netMigration) && Number.isFinite(population) && population !== 0 ? (netMigration / population) * 100 : null,
			cumulativeImmigration,
			cumulativeNetMigration,
			bornAbroadPopulation,
			bornAbroadPopulationPctPopulation: shareOfTotal(bornAbroadPopulation, population),
			bornAbroadPopulationEstimated,
			nativeBackgroundProxy,
			nativeBackgroundProxyPctPopulation: shareOfTotal(nativeBackgroundProxy, population),
			migrationBackgroundTotal,
			migrationBackgroundTotalPctPopulation: shareOfTotal(migrationBackgroundTotal, population),
			firstGenerationMigrationBackground,
			firstGenerationMigrationBackgroundPctPopulation: shareOfTotal(firstGenerationMigrationBackground, population),
			secondGenerationMigrationBackground,
			secondGenerationMigrationBackgroundPctPopulation: shareOfTotal(secondGenerationMigrationBackground, population),
			secondGenerationOneParentAbroad,
			secondGenerationBothParentsAbroad,
			bornAbroadDutchParents,
			nativeProxyBirths,
			nativeProxyBirthsPctLiveBirths,
			compositionMethod,
			qualityMethod,
			migrationPurposeEuTotal: purposeEu.get(migrationPurposeCodes.total) ?? null,
			migrationPurposeEuWork: purposeEu.get(migrationPurposeCodes.work) ?? null,
			migrationPurposeEuFamily: purposeEu.get(migrationPurposeCodes.family) ?? null,
			migrationPurposeEuStudy: purposeEu.get(migrationPurposeCodes.study) ?? null,
			migrationPurposeEuNoDerivedGoal: purposeEu.get(migrationPurposeCodes.noDerivedGoal) ?? null,
			migrationPurposeEuOther: purposeEu.get(migrationPurposeCodes.other) ?? null,
			migrationPurposeNonEuTotal: purposeNonEu.get(migrationPurposeCodes.total) ?? null,
			migrationPurposeNonEuWork: purposeNonEu.get(migrationPurposeCodes.work) ?? null,
			migrationPurposeNonEuFamily: purposeNonEu.get(migrationPurposeCodes.family) ?? null,
			migrationPurposeNonEuAsylum: purposeNonEu.get(migrationPurposeCodes.asylum) ?? null,
			migrationPurposeNonEuStudy: purposeNonEu.get(migrationPurposeCodes.study) ?? null,
			migrationPurposeNonEuTemporaryProtection: purposeNonEu.get(migrationPurposeCodes.temporaryProtection) ?? null,
			migrationPurposeNonEuOther: purposeNonEu.get(migrationPurposeCodes.other) ?? null,
			originImmigrationTotal: birthCountry.get("T001175") ?? nationality.get("T001059") ?? origin.get("T001040") ?? null,
			originDepartureKnown: origin.get("2012605") ?? null,
			originDepartureEurope: origin.get("H007933") ?? null,
			originDepartureOutsideEurope: origin.get("H008859") ?? null,
			originBornNetherlands: birthCountry.get("G008691") ?? null,
			originBornOutsideNetherlands: birthCountry.get("G008806") ?? null,
			originDutchNationality: nationality.get("NAT9267") ?? null,
			originNonDutchNationality: nationality.get("NAT9489") ?? null,
			emigrationTotalDetailed: birthCountryEmigration.get("T001175") ?? nationalityEmigration.get("T001059") ?? null,
			emigrationDestinationReported: destination.get("T001040") ?? null,
			emigrationDestinationKnown: destination.get("2012605") ?? null,
			emigrationDestinationEurope: destination.get("H007933") ?? null,
			emigrationDestinationOutsideEurope: destination.get("H008859") ?? null,
			emigrationBornNetherlands: birthCountryEmigration.get("G008691") ?? null,
			emigrationBornOutsideNetherlands: birthCountryEmigration.get("G008806") ?? null,
			emigrationDutchNationality: nationalityEmigration.get("NAT9267") ?? null,
			emigrationNonDutchNationality: nationalityEmigration.get("NAT9489") ?? null,
			emigrationAdministrativeRemovals: birthCountryAdminRemoval.get("T001175") ?? null,
			newHomes: housing.newHomes ?? null,
			totalHomeBuilding: housing.totalHomeBuilding ?? null,
			netHousingStockGrowth: housing.netHousingStockGrowth ?? null,
			housingStock: housing.housingStock ?? null,
			housingShortage: shortage.shortage ?? null,
			housingShortagePct: shortage.percentage ?? null,
			personsPerHome: ratio(population, housing.housingStock),
			populationGrowthPerNetHome: ratio(populationGrowth, housing.netHousingStockGrowth),
			netHousingStockGrowthPer1000Residents: ratio(housing.netHousingStockGrowth, population, 1000),
			housingShortageInterpolated: shortage.interpolated ?? false,
			housingShortageInterpolationBasis: shortage.basis ?? null,
			gridAfnameRequests: queue.afnameRequests ?? null,
			gridAfnameMw: queue.afnameMw ?? null,
			gridInvoedingRequests: queue.invoedingRequests ?? null,
			gridInvoedingMw: queue.invoedingMw ?? null,
		};
	});

	const populationMinusNetMigrationAnchor = rawTimeline.find((row) => Number.isFinite(row.cumulativeNetMigration) && Number.isFinite(row.bornAbroadPopulation));
	const populationMinusNetMigrationBaseStock = populationMinusNetMigrationAnchor ? populationMinusNetMigrationAnchor.bornAbroadPopulation - populationMinusNetMigrationAnchor.cumulativeNetMigration : null;
	const timeline = rawTimeline.map((row) => {
		const calibratedMigrationStock = Number.isFinite(row.bornAbroadPopulation) ? row.bornAbroadPopulation : Number.isFinite(row.cumulativeNetMigration) && Number.isFinite(populationMinusNetMigrationBaseStock) ? row.cumulativeNetMigration + populationMinusNetMigrationBaseStock : null;

		return {
			...row,
			populationMinusNetMigration: Number.isFinite(row.population) && Number.isFinite(calibratedMigrationStock) ? row.population - calibratedMigrationStock : null,
		};
	});

	const previousOutput = capacityCsv ? null : await readExistingOutput();
	const emptyGridCapacity = {
		availableMw: 0,
		requiredMw: 0,
		headroomMw: 0,
		waitlistMw: 0,
		requests: 0,
		knownAreas: 0,
		areasWithWaitlist: 0,
	};
	const capacityRows = capacityCsv ? parseCsv(capacityCsv).filter((row) => row.jaar === "2026") : [];
	const gridCurrent = capacityCsv
		? {
				year: 2026,
				source: "Netbeheer Nederland capaciteitskaart, brondata per RNB voedingsgebied",
				afname: aggregateCapacity(capacityRows, "afname"),
				invoeding: aggregateCapacity(capacityRows, "invoeding"),
				byProvince: aggregateCapacityByProvince(capacityRows),
			}
		: (previousOutput?.gridCurrent ?? {
				year: 2026,
				source: "Netbeheer Nederland capaciteitskaart tijdelijk niet beschikbaar; laatst bekende gridCurrent uit data.json ontbreekt ook, daarom zijn null-waarden ingevuld.",
				afname: emptyGridCapacity,
				invoeding: emptyGridCapacity,
				byProvince: [],
			});

	const output = {
		fetchedAt: new Date().toISOString(),
		note: "CBS StatLine is gebruikt voor bevolking, migratie en woningbouw. Woningtekort komt uit ABF/Primos-publicaties via overheidspublicaties. Stroomnetdata komt uit Netbeheer Nederland publicaties en de actuele capaciteitskaart.",
		units: {
			population: "personen",
			liveBirths: "personen per jaar",
			deaths: "personen per jaar",
			birthSurplus: "personen per jaar",
			naturalGrowth: "personen per jaar; gelijk aan geboorteoverschot",
			populationGrowth: "personen per jaar; totale bevolkingsgroei",
			otherCorrections: "personen per jaar; totale bevolkingsgroei minus geboorteoverschot en nettomigratie",
			cumulativeLiveBirths: "personen; cumulatieve som van levend geboren kinderen vanaf het eerste beschikbare CBS-jaar in deze reeks",
			cumulativeDeaths: "personen; cumulatieve som van sterfte vanaf het eerste beschikbare CBS-jaar in deze reeks",
			cumulativeBirthSurplus: "personen; cumulatieve som van geboorteoverschot vanaf het eerste beschikbare CBS-jaar in deze reeks",
			immigration: "personen per jaar",
			emigration: "personen per jaar",
			netMigration: "personen per jaar",
			netMigrationPctPopulation: "percentage van de bevolking op 1 januari",
			populationMinusNetMigration: "personen; totale bevolking min een aan de voorraad geboren buiten Nederland geankerde migratievoorraad; vanaf het eerste overlapjaar gebruikt de lijn de voorraad geboren buiten Nederland direct, daarvoor een gekalibreerde cumulatieve nettomigratie",
			cumulativeImmigration: "personen; cumulatieve som van immigratie vanaf het eerste beschikbare CBS-jaar in deze reeks",
			cumulativeNetMigration: "personen; cumulatieve som van nettomigratie vanaf het eerste beschikbare CBS-jaar in deze reeks",
			bornAbroadPopulation: "personen; bevolking geboren buiten Nederland, direct uit CBS geboortelandtabellen vanaf 2022; oudere jaren in deze pagina benaderd uit 1e generatie migratieachtergrond plus een vaste offset",
			bornAbroadPopulationPctPopulation: "percentage van de bevolking op 1 januari",
			nativeBackgroundProxy: "personen; 1972-1995 afgeleid uit CBS-reconstructie migratieachtergrond, 1996-2021 CBS Nederlandse achtergrond, vanaf 2022 benaderd als personen met twee in Nederland geboren ouders",
			nativeBackgroundProxyPctPopulation: "percentage van de bevolking op 1 januari",
			migrationBackgroundTotal: "personen; 1972-1995 CBS-reconstructie, 1996-2021 CBS migratieachtergrond totaal, vanaf 2022 afgeleid uit geboorteland van persoon en ouders",
			migrationBackgroundTotalPctPopulation: "percentage van de bevolking op 1 januari",
			firstGenerationMigrationBackground: "personen; 1972-1995 CBS-reconstructie, 1996-2021 CBS 1e generatie migratieachtergrond, vanaf 2022 afgeleid als geboren buiten Nederland met ten minste een buiten Nederland geboren ouder",
			firstGenerationMigrationBackgroundPctPopulation: "percentage van de bevolking op 1 januari",
			secondGenerationMigrationBackground: "personen; 1972-1995 CBS-reconstructie, 1996-2021 CBS 2e generatie migratieachtergrond, vanaf 2022 afgeleid als geboren in Nederland met ten minste een buiten Nederland geboren ouder",
			secondGenerationMigrationBackgroundPctPopulation: "percentage van de bevolking op 1 januari",
			secondGenerationOneParentAbroad: "personen; geboren in Nederland met een ouder geboren in Nederland en een ouder geboren buiten Nederland, beschikbaar vanaf 2022",
			secondGenerationBothParentsAbroad: "personen; geboren in Nederland met twee buiten Nederland geboren ouders, beschikbaar vanaf 2022",
			bornAbroadDutchParents: "personen; geboren buiten Nederland met twee in Nederland geboren ouders, beschikbaar vanaf 2022",
			nativeProxyBirths: "personen per jaar; vanaf 2022 afgeleid uit 85369NED als overledenen plus geboorteoverschot voor personen met twee in Nederland geboren ouders",
			nativeProxyBirthsPctLiveBirths: "percentage van alle levend geboren kinderen in het jaar",
			migrationPurposeEuTotal: "personen per immigratiejaar; EU/EFTA-immigranten naar afgeleid migratiedoel",
			migrationPurposeEuWork: "personen per immigratiejaar; EU/EFTA arbeid",
			migrationPurposeEuFamily: "personen per immigratiejaar; EU/EFTA gezin",
			migrationPurposeEuStudy: "personen per immigratiejaar; EU/EFTA studie",
			migrationPurposeEuNoDerivedGoal: "personen per immigratiejaar; EU/EFTA geen afgeleid migratiedoel",
			migrationPurposeEuOther: "personen per immigratiejaar; EU/EFTA overig en onbekend",
			migrationPurposeNonEuTotal: "personen per immigratiejaar; niet-EU/EFTA immigranten naar IND-migratiemotief",
			migrationPurposeNonEuWork: "personen per immigratiejaar; niet-EU/EFTA arbeid",
			migrationPurposeNonEuFamily: "personen per immigratiejaar; niet-EU/EFTA gezin",
			migrationPurposeNonEuAsylum: "personen per immigratiejaar; niet-EU/EFTA asiel",
			migrationPurposeNonEuStudy: "personen per immigratiejaar; niet-EU/EFTA studie",
			migrationPurposeNonEuTemporaryProtection: "personen per immigratiejaar; niet-EU/EFTA tijdelijke bescherming",
			migrationPurposeNonEuOther: "personen per immigratiejaar; niet-EU/EFTA overige migratiemotieven",
			originImmigrationTotal: "personen per jaar; immigratie totaal binnen de CBS-herkomsttabellen",
			originDepartureKnown: "personen per jaar; immigranten met bekend vertrekland buiten Nederland",
			originDepartureEurope: "personen per jaar; vertrekland in Europa, exclusief Nederland",
			originDepartureOutsideEurope: "personen per jaar; vertrekland buiten Europa",
			originBornNetherlands: "personen per jaar; immigranten met geboorteland Nederland, gebruikt als proxy voor terugkomers",
			originBornOutsideNetherlands: "personen per jaar; immigranten met geboorteland buiten Nederland",
			originDutchNationality: "personen per jaar; immigranten met Nederlandse nationaliteit bij immigratie",
			originNonDutchNationality: "personen per jaar; immigranten zonder Nederlandse nationaliteit bij immigratie",
			emigrationTotalDetailed: "personen per jaar; emigratie totaal binnen de CBS-detailtabellen, inclusief administratieve correcties",
			emigrationDestinationReported: "personen per jaar; gemelde emigratie exclusief administratieve correcties",
			emigrationDestinationKnown: "personen per jaar; emigranten met gepubliceerd bestemmingsland buiten Nederland, exclusief administratieve correcties",
			emigrationDestinationEurope: "personen per jaar; bestemmingsland in Europa, exclusief Nederland en exclusief administratieve correcties",
			emigrationDestinationOutsideEurope: "personen per jaar; bestemmingsland buiten Europa, exclusief administratieve correcties",
			emigrationBornNetherlands: "personen per jaar; emigranten met geboorteland Nederland, inclusief administratieve correcties",
			emigrationBornOutsideNetherlands: "personen per jaar; emigranten met geboorteland buiten Nederland, inclusief administratieve correcties",
			emigrationDutchNationality: "personen per jaar; emigranten met Nederlandse nationaliteit, inclusief administratieve correcties",
			emigrationNonDutchNationality: "personen per jaar; emigranten zonder Nederlandse nationaliteit, inclusief administratieve correcties",
			emigrationAdministrativeRemovals: "personen per jaar; administratieve afvoeringen uit de bevolkingsregisters",
			newHomes: "woningen per jaar",
			totalHomeBuilding: "woningen per jaar",
			netHousingStockGrowth: "woningen per jaar",
			housingShortage: "woningen",
			housingShortagePct: "percentage van de woningvoorraad",
			personsPerHome: "personen per woning",
			populationGrowthPerNetHome: "personen bevolkingsgroei per netto toegevoegde woning",
			netHousingStockGrowthPer1000Residents: "netto toegevoegde woningen per 1000 inwoners",
			gridRequests: "unieke transportverzoeken in de wachtrij",
			gridMw: "MW transportvermogen in de wachtrij",
			gridCapacity: "MW",
		},
		cbs: {
			demographics: demographicsInfo[0],
			population: populationInfo[0],
			migration: migrationInfo[0],
			migrationOrigin: migrationOriginInfo[0],
			migrationBirthCountry: migrationBirthCountryInfo[0],
			migrationNationality: migrationNationalityInfo[0],
			migrationPurposeEu: migrationPurposeEuInfo[0],
			migrationPurposeNonEu: migrationPurposeNonEuInfo[0],
			compositionLong: compositionLongInfo[0],
			compositionAgeHistorical: compositionAgeHistoricalInfo[0],
			compositionHistorical: compositionHistoricalInfo[0],
			compositionCurrent: compositionCurrentInfo[0],
			compositionFlows: compositionFlowsInfo[0],
			housing: housingInfo[0],
		},
		derivedSources: {
			housingShortage,
			housingShortageInterpolation: {
				method: interpolatedHousingShortage.method,
				observedYears: interpolatedHousingShortage.observedYears,
				interpolatedYears: interpolatedHousingShortage.interpolatedYears,
			},
			bornAbroadPopulationBackcast: {
				method: "Voor jaren zonder directe CBS-voorraad geboren buiten Nederland wordt 1e generatie migratieachtergrond vermeerderd met een vaste offset voor buiten Nederland geboren personen met twee in Nederland geboren ouders. Voor 1972-1995 gebruikt de 1e generatie-reeks de CBS-reconstructie uit 70787NED.",
				offsetPersons: bornAbroadDutchParentsBackcastOffset,
				directYears: [2022, 2023, 2024, 2025],
			},
			nativeBackgroundProxyBackcast: {
				method: "Voor 1972-1995 wordt de inheemse proxy afgeleid als totale bevolking minus bevolking met migratieachtergrond uit CBS 70787NED. CBS markeert die jaren als geschat op basis van een reconstructie van het verleden.",
				reconstructedYears: [...compositionLongByYear.entries()]
					.filter(([, row]) => row.reconstructed)
					.map(([year]) => year)
					.sort((a, b) => a - b),
				source: "CBS StatLine 70787NED.",
			},
			nativeProxyBirthsRecent: {
				method: "Vanaf 2022 afgeleid uit CBS 85369NED als overledenen plus geboorteoverschot voor de categorie 'twee ouders geboren in Nederland'. Oudere jaren zijn nog niet teruggeschat.",
				directYears: [...compositionFlowDeathsByYear.keys()].sort((a, b) => a - b),
			},
			populationMinusNetMigrationCalibration: {
				method: "De lijn 'bevolking min cum. nettomigratie' sluit vanaf het eerste overlapjaar aan op de voorraad geboren buiten Nederland; voor eerdere jaren wordt een niet-nul basisvoorraad gebruikt bovenop de cumulatieve nettomigratie zodat de reeks niet impliciet op nul migranten start.",
				anchorYear: populationMinusNetMigrationAnchor?.year ?? null,
				baseStockPersons: populationMinusNetMigrationBaseStock,
			},
			gridQueue,
		},
		qualityRules: {
			direct_cbs: { label: "direct", description: "Directe CBS-publicatie voor deze definitie en periode." },
			cbs_reconstruction: { label: "CBS-reconstructie", description: "CBS markeert deze jaren als reconstructie van het verleden." },
			derived_bridge: { label: "brugdefinitie", description: "Afgeleid om de oude reeks na een CBS-definitiewijziging door te trekken." },
			backcast: { label: "teruggeschat", description: "Teruggeschat uit een verwante reeks met vaste kalibratie." },
			interpolated: { label: "geinterpoleerd", description: "Lineair ingevuld tussen bekende bronpunten." },
			proxy: { label: "proxy", description: "Benadering van een niet direct gepubliceerde grootheid." },
		},
		timeline,
		ageStructureByYear,
		migrationOriginBreakdown,
		migrationEmigrationBreakdown,
		migrationOriginCountryTrends,
		migrationEmigrationCountryTrends,
		gridCurrent,
	};

	await writeFile(new URL("./data.json", import.meta.url), JSON.stringify(output, null, 2));
	console.log(`Wrote ${timeline.length} yearly rows and ${gridCurrent.byProvince.length} grid province rows.`);
}

await main();
