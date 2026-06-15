import { readdir, readFile, writeFile } from "node:fs/promises";

const dataDir = new URL("./data/", import.meta.url);
const outputFile = new URL("./data.json", import.meta.url);
const adequacyNormHours = 4;
const durationCurveMaxPoints = 650;

const scenarioLabels = {
	"high-demand": "High Demand",
	"low-demand": "Low Demand",
	"low-demand-europe-sensitivity": "Low Demand Europe sensitivity",
	reference: "Reference",
};

function parseCsv(text) {
	const source = text.replace(/^\uFEFF/, "").trim();
	if (!source) return [];

	const rows = [];
	let row = [];
	let field = "";
	let quoted = false;

	for (let index = 0; index < source.length; index += 1) {
		const char = source[index];
		const next = source[index + 1];

		if (quoted) {
			if (char === "\"" && next === "\"") {
				field += "\"";
				index += 1;
			} else if (char === "\"") {
				quoted = false;
			} else {
				field += char;
			}
			continue;
		}

		if (char === "\"") {
			quoted = true;
		} else if (char === ",") {
			row.push(field);
			field = "";
		} else if (char === "\n") {
			row.push(field);
			rows.push(row);
			row = [];
			field = "";
		} else if (char !== "\r") {
			field += char;
		}
	}

	row.push(field);
	rows.push(row);

	const headers = rows.shift().map((header) => header.trim());
	return rows
		.filter((values) => values.some((value) => String(value).trim() !== ""))
		.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

async function csvFiles() {
	return (await readdir(dataDir)).filter((file) => file.endsWith(".csv")).sort();
}

async function readCsv(file) {
	return parseCsv(await readFile(new URL(file, dataDir), "utf8"));
}

function number(value) {
	if (value === null || value === undefined || value === "") return null;
	const parsed = Number(String(value).replace(",", "."));
	return Number.isFinite(parsed) ? parsed : null;
}

function normalizeScenario(value) {
	const text = String(value || "").toLowerCase();
	if (text.includes("europe sensitivity") || text.includes("whole europe")) return "low-demand-europe-sensitivity";
	if (text.includes("high demand")) return "high-demand";
	if (text.includes("low demand")) return "low-demand";
	if (text === "ref" || text === "reference") return "reference";
	return text.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "unknown";
}

function yearFromFile(file) {
	const raw = file.match(/(?:^| - )(\d{4,5})(?: - |\.csv$)/)?.[1];
	if (!raw) return null;
	return raw === "20230" ? 2030 : Number(raw);
}

function compactValue(value) {
	return Number.isFinite(value) ? Number(value.toFixed(3)) : value;
}

function downsample(rows, maxPoints) {
	if (rows.length <= maxPoints) return rows;
	const step = Math.ceil(rows.length / maxPoints);
	const sampled = rows.filter((_, index) => index % step === 0);
	const last = rows.at(-1);
	if (sampled.at(-1) !== last) sampled.push(last);
	return sampled;
}

function sortYears(a, b) {
	return a.year - b.year || a.scenario.localeCompare(b.scenario);
}

async function buildMainResults() {
	const loleRows = await readCsv("Results - Main results - LOLE.csv");
	const eensRows = await readCsv("Results - Main results - EENS.csv");
	const byKey = new Map();

	for (const row of loleRows) {
		const year = number(row.Year);
		const scenario = normalizeScenario(row.ScenarioDetail);
		byKey.set(`${year}:${scenario}`, {
			year,
			scenario,
			scenarioLabel: scenarioLabels[scenario] || row.ScenarioDetail,
			lole: number(row.LOLE),
			eens: null,
		});
	}

	for (const row of eensRows) {
		const year = number(row.Year);
		const scenario = normalizeScenario(row.ScenarioDetail);
		const key = `${year}:${scenario}`;
		const item = byKey.get(key) || {
			year,
			scenario,
			scenarioLabel: scenarioLabels[scenario] || row.ScenarioDetail,
			lole: null,
		};
		item.eens = number(row.ENS);
		byKey.set(key, item);
	}

	return [...byKey.values()].sort(sortYears);
}

async function buildWeatherDistributions(files, warnings) {
	const items = [];
	for (const file of files.filter((item) => item.startsWith("Results - Distribution across weather scenarios"))) {
		const metric = file.includes(" - LOLE - ") ? "lole" : "eens";
		const year = yearFromFile(file);
		const scenario = normalizeScenario(file);
		if (file.includes("20230")) warnings.push("Bestandsnaam met jaar 20230 geimporteerd als 2030.");

		for (const row of await readCsv(file)) {
			items.push({
				metric,
				year,
				scenario,
				scenarioLabel: scenarioLabels[scenario] || scenario,
				weatherScenario: row.WeatherScenario || row["Weather Scenario"] || "",
				iteration: row.Iteration || "",
				value: number(row["Sum of ENShours"] ?? row["Sum of ENS-GW-ifshortage"]),
			});
		}
	}
	return items.sort(sortYears);
}

async function buildEventDistributions(files) {
	const items = [];
	for (const file of files.filter((item) => item.startsWith("Results - Event distribution"))) {
		const year = yearFromFile(file);
		const scenario = normalizeScenario(file);
		for (const row of await readCsv(file)) {
			items.push({
				year,
				scenario,
				scenarioLabel: scenarioLabels[scenario] || scenario,
				eventSizeGwh: number(row["Event size [GWh]"]),
				durationHours: number(row.event_duration),
				count: number(row["Count of event_size"]),
			});
		}
	}
	return items.sort(sortYears);
}

async function buildDurationCurves(files) {
	const items = [];
	for (const file of files.filter((item) => item.startsWith("Results - ENS duration curve"))) {
		const scenario = normalizeScenario(file);
		const rowsByYear = new Map();
		for (const row of await readCsv(file)) {
			const year = number(row.Year);
			if (!rowsByYear.has(year)) rowsByYear.set(year, []);
			rowsByYear.get(year).push({
				hour: number(row.Hour),
				ensGw: number(row["Sum of RegionENSGW"]),
			});
		}

		for (const [year, rows] of rowsByYear) {
			const sorted = rows.filter((row) => Number.isFinite(row.ensGw)).sort((a, b) => a.hour - b.hour);
			items.push({
				year,
				scenario,
				scenarioLabel: scenarioLabels[scenario] || scenario,
				totalPoints: sorted.length,
				points: downsample(sorted, durationCurveMaxPoints).map((row) => ({
					hour: row.hour,
					ensGw: compactValue(row.ensGw),
				})),
			});
		}
	}
	return items.sort(sortYears);
}

function appendCapacity(target, rows, type, valueKey = "Sum of Value numbers only") {
	for (const row of rows) {
		const year = number(row["Target Year"]);
		const scenario = normalizeScenario(row.Scenario || "high demand");
		target.push({
			year,
			scenario,
			scenarioLabel: scenarioLabels[scenario] || row.Scenario || "High Demand",
			type,
			category: row.Sector || row.Subsector || row.Category || "",
			value: number(row[valueKey]),
		});
	}
}

async function buildSystemMix() {
	const demand = (await readCsv("Scenario - Demand - Overview yearly.csv")).map((row) => ({
		year: number(row["Target Year"]),
		scenario: normalizeScenario(row.Scenario),
		scenarioLabel: scenarioLabels[normalizeScenario(row.Scenario)] || row.Scenario,
		sector: row.Sector,
		value: number(row["Sum of Value numbers only"]),
	}));

	const capacity = [];
	appendCapacity(capacity, await readCsv("Scenario - Generation - Installed capacity conventional.csv"), "Conventioneel");
	appendCapacity(capacity, await readCsv("Scenario - Generation - Installed capacity renewable.csv"), "Hernieuwbaar");
	appendCapacity(capacity, await readCsv("Scenario - Flexibility - Battery capacity.csv"), "Batterijvermogen");
	appendCapacity(capacity, await readCsv("Scenario - Flexibility - Battery storage volume.csv"), "Batterijopslag");
	appendCapacity(capacity, await readCsv("Scenario - Flexibility - Power-to-x capacity.csv"), "Power-to-x");
	appendCapacity(capacity, await readCsv("Scenario - Flexibility  - DSR shifting capacity.csv"), "DSR shifting");
	appendCapacity(capacity, await readCsv("Scenario - Flexibility - DSR shedding capacity.csv"), "DSR shedding");

	const imports = [];
	for (const file of ["Results - Net import average - High demand.csv", "Results - Net import average - Low demand.csv", "Results - Net import average - Low demand Europe sensitivity.csv"]) {
		for (const row of await readCsv(file)) {
			const scenario = normalizeScenario(row.ScenarioDetail || file);
			imports.push({
				year: number(row.Year),
				scenario,
				scenarioLabel: scenarioLabels[scenario] || row.ScenarioDetail,
				state: row.SHortage,
				value: number(row["Average of exch-GW"]),
			});
		}
	}

	return {
		demand: demand.sort(sortYears),
		capacity: capacity.sort(sortYears),
		imports: imports.sort(sortYears),
	};
}

async function buildMissingCapacity() {
	const items = [];
	for (const file of ["Results - Missing capacity analysis - 2030 - High demand.csv", "Results - Missing capacity analysis - 2035 - High demand.csv"]) {
		const year = yearFromFile(file);
		for (const row of await readCsv(file)) {
			items.push({
				year,
				scenario: "high-demand",
				scenarioLabel: scenarioLabels["high-demand"],
				case: row.Scenario,
				iteration: row.Iteration || "",
				attribute: row.Attribute,
				addedCapacityGw: number(row["Average of Value"]),
				resultingLole: number(row["Average of Resulting LOLE"] || row["Sum of LOLE 2"]),
			});
		}
	}
	return items.sort((a, b) => a.year - b.year || a.case.localeCompare(b.case) || a.attribute.localeCompare(b.attribute));
}

const files = await csvFiles();
const warnings = [];
const data = {
	meta: {
		title: "TenneT Monitor Voorzieningszekerheid 2026",
		generatedAt: new Date().toISOString(),
		adequacyNormHours,
		sourceFiles: files,
		warnings,
	},
	scenarios: Object.entries(scenarioLabels).map(([key, label]) => ({ key, label })),
	mainResults: await buildMainResults(),
	weatherDistributions: await buildWeatherDistributions(files, warnings),
	eventDistributions: await buildEventDistributions(files),
	durationCurves: await buildDurationCurves(files),
	systemMix: await buildSystemMix(),
	missingCapacity: await buildMissingCapacity(),
};

await writeFile(outputFile, `${JSON.stringify(data, null, "\t")}\n`);
console.log(`Wrote ${outputFile.pathname}`);
