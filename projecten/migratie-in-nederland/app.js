const DATA_URL = "/api/v1/projecten/autochtoonse-nederlandse-bevolking/data.json";
const EXTRA_DATA_URL = "/api/v1/projecten/migratie-in-nederland/data.json";
const SVG_NS = "http://www.w3.org/2000/svg";

const page = document.querySelector(".migration-page");
const heroStats = document.querySelector("#heroStats");
const focusYearTitle = document.querySelector("#focus-year-title");
const focusSummary = document.querySelector("#focusSummary");
const availabilityNote = document.querySelector("#availabilityNote");
const chartNote = document.querySelector("#chartNote");
const migrationChart = document.querySelector("#migrationChart");
const migrationLegend = document.querySelector("#migrationLegend");
const migrationTable = document.querySelector("#migrationTable");
const euBreakdown = document.querySelector("#euBreakdown");
const nonEuBreakdown = document.querySelector("#nonEuBreakdown");
const knowledgeSummary = document.querySelector("#knowledgeSummary");
const knowledgeBars = document.querySelector("#knowledgeBars");
const expatNote = document.querySelector("#expatNote");

const peopleFormatter = new Intl.NumberFormat("nl-NL");
const percentFormatter = new Intl.NumberFormat("nl-NL", {
	maximumFractionDigits: 1,
});
const compactFormatter = new Intl.NumberFormat("nl-NL", {
	notation: "compact",
	maximumFractionDigits: 1,
});

const categories = [
	{
		key: "work",
		label: "Arbeid",
		color: "#2a9d8f",
		fields: ["migrationPurposeEuWork", "migrationPurposeNonEuWork"],
	},
	{
		key: "family",
		label: "Gezin",
		color: "#235789",
		fields: ["migrationPurposeEuFamily", "migrationPurposeNonEuFamily"],
	},
	{
		key: "study",
		label: "Studie",
		color: "#edae49",
		fields: ["migrationPurposeEuStudy", "migrationPurposeNonEuStudy"],
	},
	{
		key: "asylum",
		label: "Asiel",
		color: "#d1495b",
		fields: ["migrationPurposeNonEuAsylum"],
	},
	{
		key: "temporary",
		label: "Tijdelijke bescherming",
		color: "#8167a9",
		fields: ["migrationPurposeNonEuTemporaryProtection"],
	},
	{
		key: "other",
		label: "Overig / onbekend",
		color: "#7b8087",
		fields: ["migrationPurposeEuNoDerivedGoal", "migrationPurposeEuOther", "migrationPurposeNonEuOther"],
	},
];

const state = {
	data: null,
	extraData: null,
	focusYear: null,
};

function valueFor(row, key) {
	const value = row?.[key];
	return Number.isFinite(value) ? value : null;
}

function sumFields(row, fields) {
	return fields.reduce((sum, field) => sum + (valueFor(row, field) || 0), 0);
}

function people(value) {
	return Number.isFinite(value) ? peopleFormatter.format(Math.round(value)) + " personen" : "-";
}

function compactPeople(value) {
	return Number.isFinite(value) ? compactFormatter.format(Math.round(value)) : "-";
}

function percent(value) {
	return Number.isFinite(value) ? percentFormatter.format(value) + "%" : "-";
}

function categoryValues(row) {
	const total = valueFor(row, "immigration");
	const values = categories.map((category) => ({
		...category,
		value: sumFields(row, category.fields),
	}));
	const known = values.filter((category) => category.key !== "other").reduce((sum, category) => sum + category.value, 0);
	const other = values.find((category) => category.key === "other");
	if (other && Number.isFinite(total)) {
		other.value = Math.max(0, total - known);
	}
	return values.map((category) => ({
		...category,
		share: total > 0 ? (category.value / total) * 100 : 0,
	}));
}

function comparableRows() {
	return state.data.timeline.filter((row) => Number.isFinite(row.immigration) && Number.isFinite(row.migrationPurposeEuTotal) && Number.isFinite(row.migrationPurposeNonEuTotal)).sort((a, b) => a.year - b.year);
}

function createElement(tagName, className, textContent) {
	const element = document.createElement(tagName);
	if (className) element.className = className;
	if (textContent !== undefined) element.textContent = textContent;
	return element;
}

function renderHero(row) {
	const values = categoryValues(row);
	const leading = [...values].sort((a, b) => b.value - a.value)[0];
	const study = values.find((category) => category.key === "study");

	heroStats.replaceChildren();
	[
		["Immigratie", people(row.immigration), "alle inschrijvingen in het laatste vergelijkbare jaar"],
		["Grootste groep", people(leading.value), leading.label],
		["Studie", percent(study.share), people(study.value)],
	].forEach(([label, value, note]) => {
		const card = createElement("article", "migration-stat");
		card.append(createElement("span", "migration-stat__label", label), createElement("strong", "migration-stat__value", value), createElement("small", "migration-stat__note", note));
		heroStats.append(card);
	});
}

function renderLegend() {
	migrationLegend.replaceChildren();
	categories.forEach((category) => {
		const item = createElement("span", "migration-legend__item");
		const swatch = createElement("i", "migration-legend__swatch");
		swatch.style.backgroundColor = category.color;
		item.append(swatch, createElement("span", null, category.label));
		migrationLegend.append(item);
	});
}

function svgElement(tagName, attributes = {}, textContent = null) {
	const element = document.createElementNS(SVG_NS, tagName);
	Object.entries(attributes).forEach(([name, value]) => {
		element.setAttribute(name, String(value));
	});
	if (textContent !== null) element.textContent = textContent;
	return element;
}

function focusChartRow(row) {
	state.focusYear = row.year;
	migrationChart.querySelectorAll(".migration-chart__row.is-focus").forEach((item) => item.classList.remove("is-focus"));
	const chartRow = migrationChart.querySelector('[data-year="' + row.year + '"]');
	if (chartRow) chartRow.classList.add("is-focus");
	renderFocus(row);
}

function renderChart(rows, focusYear) {
	const width = 960;
	const margin = { top: 34, right: 82, bottom: 18, left: 92 };
	const plotWidth = width - margin.left - margin.right;
	const rowHeight = 42;
	const height = margin.top + margin.bottom + rows.length * rowHeight;

	migrationChart.replaceChildren();
	migrationChart.setAttribute("viewBox", "0 0 " + width + " " + height);
	migrationChart.setAttribute("height", height);

	[0, 25, 50, 75, 100].forEach((tick) => {
		const x = margin.left + (plotWidth * tick) / 100;
		migrationChart.append(
			svgElement("line", {
				x1: x,
				x2: x,
				y1: margin.top - 18,
				y2: height - margin.bottom,
				class: "migration-chart__guide",
			}),
			svgElement(
				"text",
				{
					x,
					y: margin.top - 22,
					class: "migration-chart__axis-label",
					"text-anchor": "middle",
				},
				tick + "%"
			)
		);
	});

	rows.forEach((row, rowIndex) => {
		const y = margin.top + rowIndex * rowHeight;
		const values = categoryValues(row);
		const isFocus = row.year === focusYear;
		const chartRow = svgElement("g", {
			class: "migration-chart__row" + (isFocus ? " is-focus" : ""),
			"data-year": row.year,
			tabindex: 0,
			role: "button",
			"aria-label": row.year + ": " + people(row.immigration) + " immigranten. Bekijk de verdeling.",
		});
		chartRow.append(
			svgElement(
				"text",
				{
					x: margin.left - 14,
					y: y + 19,
					class: "migration-chart__year",
					"text-anchor": "end",
				},
				String(row.year)
			)
		);
		let currentX = margin.left;
		values.forEach((category) => {
			const segmentWidth = (plotWidth * category.share) / 100;
			const rect = svgElement("rect", {
				x: currentX,
				y,
				width: Math.max(0, segmentWidth),
				height: 25,
				fill: category.color,
				class: "migration-chart__segment migration-chart__segment--" + category.key,
				rx: 3,
			});
			const title = svgElement("title", {}, row.year + " · " + category.label + ": " + people(category.value) + " (" + percent(category.share) + ")");
			rect.append(title);
			chartRow.append(rect);
			currentX += segmentWidth;
		});
		chartRow.append(svgElement("text", { x: width - 4, y: y + 19, class: "migration-chart__total", "text-anchor": "end" }, compactPeople(row.immigration)));
		const updateFocus = () => focusChartRow(row);
		chartRow.addEventListener("mouseenter", updateFocus);
		chartRow.addEventListener("focus", updateFocus);
		chartRow.addEventListener("click", updateFocus);
		migrationChart.append(chartRow);
	});
}

function renderTable(rows) {
	const table = createElement("table", "migration-data-table");
	const caption = createElement("caption", null, "Aantallen per motief en aandeel van de totale immigratie.");
	table.append(caption);
	const headRow = createElement("tr");
	["Jaar", ...categories.map((category) => category.label), "Totaal"].forEach((label) => {
		headRow.append(createElement("th", null, label));
	});
	const head = createElement("thead");
	head.append(headRow);
	table.append(head);
	const body = createElement("tbody");
	rows.forEach((row) => {
		const dataRow = createElement("tr");
		const values = categoryValues(row);
		dataRow.append(createElement("th", null, String(row.year)));
		values.forEach((category) => {
			dataRow.append(createElement("td", null, peopleFormatter.format(Math.round(category.value)) + " (" + percent(category.share) + ")"));
		});
		dataRow.append(createElement("td", null, people(row.immigration)));
		body.append(dataRow);
	});
	table.append(body);
	migrationTable.replaceChildren(table);
}

function renderFocus(row) {
	const values = categoryValues(row);
	focusYearTitle.textContent = String(row.year);
	focusSummary.replaceChildren(createElement("p", "migration-focus-total", people(row.immigration) + " in totaal"));
	values.forEach((category) => {
		const card = createElement("article", "migration-value-card migration-value-card--" + category.key);
		const heading = createElement("div", "migration-value-card__head");
		const swatch = createElement("i", "migration-value-card__swatch");
		swatch.style.backgroundColor = category.color;
		heading.append(swatch, createElement("h3", null, category.label));
		card.append(heading, createElement("strong", "migration-value-card__value", people(category.value)), createElement("small", "migration-value-card__share", percent(category.share) + " van alle immigratie"));
		focusSummary.append(card);
	});
}

function renderBreakdown(container, title, row, fields) {
	const total = valueFor(row, fields.total);
	container.replaceChildren();
	container.append(createElement("strong", "migration-breakdown__total", people(total)));
	const list = createElement("dl", "migration-breakdown__list");
	fields.items.forEach(([label, key]) => {
		const value = valueFor(row, key);
		const item = createElement("div");
		item.append(createElement("dt", null, label), createElement("dd", null, people(value)));
		list.append(item);
	});
	container.append(list);
	container.setAttribute("aria-label", title + ": " + people(total));
}

function renderMethodCards(row) {
	renderBreakdown(euBreakdown, "EU/EFTA", row, {
		total: "migrationPurposeEuTotal",
		items: [
			["Arbeid", "migrationPurposeEuWork"],
			["Gezin", "migrationPurposeEuFamily"],
			["Studie", "migrationPurposeEuStudy"],
			["Geen afgeleid doel", "migrationPurposeEuNoDerivedGoal"],
			["Overig / onbekend", "migrationPurposeEuOther"],
		],
	});
	renderBreakdown(nonEuBreakdown, "Buiten EU/EFTA", row, {
		total: "migrationPurposeNonEuTotal",
		items: [
			["Arbeid", "migrationPurposeNonEuWork"],
			["Gezin", "migrationPurposeNonEuFamily"],
			["Asiel", "migrationPurposeNonEuAsylum"],
			["Studie", "migrationPurposeNonEuStudy"],
			["Tijdelijke bescherming", "migrationPurposeNonEuTemporaryProtection"],
			["Overig", "migrationPurposeNonEuOther"],
		],
	});
}

function renderKnowledge() {
	const series = state.extraData.knowledgeMigrants;
	const latest = series.at(-1);
	knowledgeSummary.replaceChildren(createElement("span", "migration-knowledge__label", "Laatste beschikbare kennismigranten"), createElement("strong", "migration-knowledge__value", people(latest.value)), createElement("small", "migration-knowledge__note", "Niet-EU/EFTA · " + latest.year));
	knowledgeBars.replaceChildren();
	const maxValue = Math.max(...series.map((item) => item.value));
	series.forEach((item) => {
		const bar = createElement("div", "migration-knowledge__bar");
		bar.style.setProperty("--bar-height", (item.value / maxValue) * 100 + "%");
		bar.setAttribute("title", item.year + ": " + people(item.value));
		if (item.year === latest.year) bar.classList.add("is-selected");
		bar.append(createElement("span", "migration-knowledge__bar-value", compactPeople(item.value)), createElement("i", "migration-knowledge__bar-fill"), createElement("small", "migration-knowledge__bar-year", String(item.year)));
		knowledgeBars.append(bar);
	});
	expatNote.textContent = "In " + latest.year + " waren er " + people(latest.value) + " niet-EU/EFTA-kennismigranten. Dit is een meetbare subgroep van arbeidsmigratie, geen volledige telling van expats.";
}

function renderNotes(rows, row) {
	const firstYear = rows[0].year;
	const lastYear = rows.at(-1).year;
	availabilityNote.textContent = "Volledig vergelijkbare motiefgegevens zijn beschikbaar voor " + firstYear + "–" + lastYear + ". EU/EFTA-doelen lopen achter op de niet-EU/EFTA-motieven; daarom staat 2024 niet in deze gecombineerde vergelijking.";
	chartNote.textContent = "De categorie “overig / onbekend” is het resterende deel van " + people(row.immigration) + " immigranten nadat de gepubliceerde motieven zijn opgeteld. Afrondingen en verschillen tussen CBS-tabellen kunnen kleine afwijkingen veroorzaken.";
}

function render() {
	const rows = comparableRows();
	const chartRows = rows;
	const latest = rows.at(-1);
	if (!latest) throw new Error("Geen vergelijkbare migratiemotieven gevonden.");
	state.focusYear = latest.year;
	renderHero(latest);
	renderChart(chartRows, latest.year);
	renderLegend();
	renderTable(chartRows);
	renderFocus(latest);
	renderMethodCards(latest);
	renderKnowledge();
	renderNotes(rows, latest);
}

async function load() {
	const [dataResponse, extraResponse] = await Promise.all([fetch(DATA_URL), fetch(EXTRA_DATA_URL)]);
	if (!dataResponse.ok || !extraResponse.ok) throw new Error("De migratiegegevens konden niet worden geladen.");
	[state.data, state.extraData] = await Promise.all([dataResponse.json(), extraResponse.json()]);
	render();
}

load().catch((error) => {
	page.dataset.state = "error";
	availabilityNote.textContent = error.message;
	chartNote.textContent = "Probeer de pagina opnieuw te laden.";
});
