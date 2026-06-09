const TABLES = {
	demographic: "85844NED",
};

const PERIOD = "2025JJ00";
const VALUE_MARGIN = "MW00000";

const METRICS = [
	{
		key: "socialCohesion",
		sourceKey: "SocialeCohesieSchaalscore_15",
		label: "Sociale cohesie",
		shortLabel: "Cohesie",
		unit: "score",
		direction: "higher-better",
		description: "Schaalscore van sociale cohesie in de woonbuurt.",
	},
	{
		key: "neighborhoodUnsafe",
		sourceKey: "VoeltZichWeleensOnveiligInBuurt_50",
		label: "Onveilig in buurt",
		shortLabel: "Buurt-onveiligheid",
		unit: "%",
		direction: "higher-worse",
		description: "Aandeel 15-plussers dat zich weleens onveilig voelt in de eigen buurt.",
	},
	{
		key: "generalUnsafe",
		sourceKey: "VoeltZichWeleensOnveilig_43",
		label: "Onveilig algemeen",
		shortLabel: "Algemeen onveilig",
		unit: "%",
		direction: "higher-worse",
		description: "Aandeel 15-plussers dat zich weleens onveilig voelt in het algemeen.",
	},
	{
		key: "safetyGrade",
		sourceKey: "RapportcijferVeiligheidInBuurt_60",
		label: "Rapportcijfer veiligheid",
		shortLabel: "Veiligheidscijfer",
		unit: "score",
		direction: "higher-better",
		description: "Gemiddeld rapportcijfer voor veiligheid in de buurt.",
	},
	{
		key: "streetDisrespect",
		sourceKey: "DoorOnbekendenOpStraat_61",
		label: "Respectloos op straat",
		shortLabel: "Respectloos",
		unit: "%",
		direction: "higher-worse",
		description: "Aandeel dat vaak of soms respectloos gedrag door onbekenden op straat ervaart.",
	},
	{
		key: "discrimination",
		sourceKey: "GediscrimineerdGevoeld_66",
		label: "Discriminatie ervaren",
		shortLabel: "Discriminatie",
		unit: "%",
		direction: "higher-worse",
		description: "Aandeel dat zich in de afgelopen twaalf maanden gediscrimineerd voelde.",
	},
	{
		key: "traditionalVictim",
		sourceKey: "Slachtoffers_68",
		label: "Slachtoffer traditioneel",
		shortLabel: "Traditioneel",
		unit: "%",
		direction: "higher-worse",
		description: "Aandeel slachtoffers van geweldsdelicten, vermogensdelicten of vernielingen.",
	},
	{
		key: "violenceVictim",
		sourceKey: "Slachtoffers_72",
		label: "Slachtoffer geweld",
		shortLabel: "Geweld",
		unit: "%",
		direction: "higher-worse",
		description: "Aandeel slachtoffers van geweldsdelicten.",
	},
	{
		key: "onlineVictim",
		sourceKey: "Slachtoffers_132",
		label: "Slachtoffer online",
		shortLabel: "Online",
		unit: "%",
		direction: "higher-worse",
		description: "Aandeel slachtoffers van een of meer vormen van online criminaliteit.",
	},
	{
		key: "onlineFraud",
		sourceKey: "Slachtoffers_136",
		label: "Online oplichting/fraude",
		shortLabel: "Online fraude",
		unit: "%",
		direction: "higher-worse",
		description: "Aandeel slachtoffers van online oplichting en fraude.",
	},
	{
		key: "onlineThreat",
		sourceKey: "Slachtoffers_166",
		label: "Online bedreiging/intimidatie",
		shortLabel: "Online bedreiging",
		unit: "%",
		direction: "higher-worse",
		description: "Aandeel slachtoffers van online bedreiging en intimidatie.",
	},
	{
		key: "policeContact",
		sourceKey: "ContactMetPolitie_188",
		label: "Contact met politie",
		shortLabel: "Politiecontact",
		unit: "%",
		direction: "neutral",
		description: "Aandeel dat in de afgelopen twaalf maanden contact had met de politie.",
	},
];

const DEMOGRAPHIC_GROUPS = new Set([
	1, // Totaal
	2, // Geslacht
	3, // Leeftijd beknopt
	5, // Geboorteland en herkomst
	7, // Onderwijsniveau beknopt
	9, // Genderidentiteit
	10, // Seksuele orientatie
	11, // Intersekse
	12, // Inkomen
	13, // Welvaart
	14, // Stedelijkheid gemeente
]);

async function cbs(table, endpoint) {
	const url = new URL(`https://opendata.cbs.nl/ODataApi/OData/${table}/${endpoint}`);
	const response = await fetch(url);
	if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
	return response.json();
}

async function cbsAll(table, endpoint) {
	let url = `https://opendata.cbs.nl/ODataApi/OData/${table}/${endpoint}`;
	const rows = [];
	while (url) {
		const response = await fetch(url);
		if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
		const data = await response.json();
		rows.push(...data.value);
		url = data["odata.nextLink"] || "";
	}
	return rows;
}

function valuesFrom(row) {
	return Object.fromEntries(METRICS.map((metric) => [metric.key, row[metric.sourceKey] ?? null]));
}

function cleanTitle(title) {
	return title
		.replace(/^Geslacht: /, "")
		.replace(/^Leeftijd: /, "")
		.replace(/^Herkomst: /, "")
		.replace(/^Onderwijsniveau: /, "")
		.replace(/^Genderidentiteit: /, "")
		.replace(/^Seks\. oriëntatie: /, "")
		.replace(/^Intersekse zijn: /, "")
		.replace(/^Inkomen: /, "")
		.replace(/^Welvaart: /, "")
		.replace(/^Gemeente: /, "");
}

async function demographicData() {
	const [groups, characteristics, rows] = await Promise.all([cbsAll(TABLES.demographic, "CategoryGroups"), cbsAll(TABLES.demographic, "Kenmerken"), cbsAll(TABLES.demographic, `TypedDataSet?$filter=Marges eq '${VALUE_MARGIN}' and Perioden eq '${PERIOD}'`)]);

	const groupById = new Map(groups.map((group) => [group.ID, group]));
	const characteristicByKey = new Map(characteristics.map((item) => [item.Key, item]));

	return rows
		.map((row) => {
			const characteristic = characteristicByKey.get(row.Kenmerken);
			const group = groupById.get(characteristic?.CategoryGroupID);
			if (!characteristic || !group || !DEMOGRAPHIC_GROUPS.has(group.ID)) return null;
			return {
				key: row.Kenmerken.trim(),
				sourceKey: row.Kenmerken,
				label: cleanTitle(characteristic.Title),
				fullLabel: characteristic.Title,
				groupId: group.ID,
				group: group.Title,
				values: valuesFrom(row),
			};
		})
		.filter(Boolean);
}

const [tableInfo, demographic] = await Promise.all([cbs(TABLES.demographic, "TableInfos"), demographicData()]);

const data = {
	meta: {
		title: "Demografische veiligheid",
		period: PERIOD,
		periodLabel: "2025",
		generatedAt: new Date().toISOString(),
		tables: {
			demographic: TABLES.demographic,
		},
		sourceModified: tableInfo.value?.[0]?.Modified || null,
	},
	metrics: METRICS.map(({ sourceKey, ...metric }) => metric),
	demographic,
	defaults: {
		group: "Leeftijdsklasse beknopt",
		xMetric: "traditionalVictim",
		yMetric: "neighborhoodUnsafe",
		selectedKey: "53050",
	},
};

await writeFile(new URL("./data.json", import.meta.url), `${JSON.stringify(data, null, "\t")}\n`);
import { writeFile } from "node:fs/promises";
