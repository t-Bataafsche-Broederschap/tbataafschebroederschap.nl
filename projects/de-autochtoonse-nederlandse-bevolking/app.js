/* global d3 */

import { formatMetric, formatNumber, formatOne, homes, mw, people, percent, percentTick, requests, shortNumber } from "./formatters.js";
import { gridCardInfo, metricInfo, viewSourceNotes } from "./metadata.js";
import { views } from "./views.js";

const chart = d3.select("#mainChart");
const chartWrap = document.querySelector(".chart-wrap");
const tooltip = document.querySelector("#tooltip");
const infoTooltip = document.createElement("div");
const legend = document.querySelector("#legend");
const viewButtons = document.querySelectorAll("[data-view]");
const yearRange = document.querySelector("#yearRange");
const yearLabel = document.querySelector("#yearLabel");
const minYearLabel = document.querySelector("#minYearLabel");
const maxYearLabel = document.querySelector("#maxYearLabel");
const prevYearButton = document.querySelector("#prevYear");
const nextYearButton = document.querySelector("#nextYear");
const resetZoomButton = document.querySelector("#resetZoom");
const exportCsvButton = document.querySelector("#exportCsv");
const definitionControl = document.querySelector("#definitionControl");
const definitionButtons = document.querySelectorAll("[data-definition]");
const selectedYearTitle = document.querySelector("#selectedYearTitle");
const statList = document.querySelector("#statList");
const gridCards = document.querySelector("#gridCards");
const detailEyebrow = document.querySelector("#detailEyebrow");
const detailTitle = document.querySelector("#gridTitle");
const viewKicker = document.querySelector("#viewKicker");
const viewTitle = document.querySelector("#viewTitle");
const chartNote = document.querySelector("#chartNote");

let data;
let state = {
	view: "population",
	year: 2024,
	definition: "nativeBackgroundProxy",
};
const zoomDomains = new Map();
let suppressNextClick = false;
const decimalTick = (value) => formatOne.format(value);

infoTooltip.className = "info-tooltip";
infoTooltip.hidden = true;
infoTooltip.setAttribute("role", "status");
document.querySelector(".autochtoon-page").append(infoTooltip);

function valueFor(row, key) {
	const value = row?.[key];
	return Number.isFinite(value) ? value : null;
}

function rowForYear(year) {
	return data.timeline.find((row) => row.year === year) || null;
}

function rowsForView(view) {
	if (view === "age") {
		return data.ageStructureByYear.map((row) => ({ year: row.year, population: row.buckets.reduce((total, bucket) => total + (bucket.population || 0), 0) || row.buckets.reduce((total, bucket) => total + (bucket.migrationBackgroundTotal || 0), 0) }));
	}
	const keys = views[view].series.map((series) => series.key);
	return data.timeline.filter((row) => keys.some((key) => Number.isFinite(row[key])));
}

function ageRowForYear(year) {
	return data.ageStructureByYear?.find((row) => row.year === year) || null;
}

function fullDomainForRows(rows) {
	const domain = d3.extent(rows, (row) => row.year);
	return domain.every(Number.isFinite) ? domain : [state.year, state.year];
}

function clampZoomDomain(rows, domain) {
	const fullDomain = fullDomainForRows(rows);
	const fullSpan = fullDomain[1] - fullDomain[0];
	if (fullSpan <= 0) return fullDomain;

	const minSpan = Math.min(2, fullSpan);
	let start = Number.isFinite(domain?.[0]) ? domain[0] : fullDomain[0];
	let end = Number.isFinite(domain?.[1]) ? domain[1] : fullDomain[1];
	if (end < start) [start, end] = [end, start];

	let span = Math.max(minSpan, Math.min(fullSpan, end - start));
	let center = (start + end) / 2;
	if (!Number.isFinite(center)) center = (fullDomain[0] + fullDomain[1]) / 2;

	start = center - span / 2;
	end = center + span / 2;

	if (start < fullDomain[0]) {
		end += fullDomain[0] - start;
		start = fullDomain[0];
	}
	if (end > fullDomain[1]) {
		start -= end - fullDomain[1];
		end = fullDomain[1];
	}

	return [Math.max(fullDomain[0], start), Math.min(fullDomain[1], end)];
}

function zoomDomainForView(view, rows) {
	const storedDomain = zoomDomains.get(view);
	if (!storedDomain) return fullDomainForRows(rows);

	const domain = clampZoomDomain(rows, storedDomain);
	zoomDomains.set(view, domain);
	return domain;
}

function setZoomDomainForView(view, rows, domain) {
	const fullDomain = fullDomainForRows(rows);
	const nextDomain = clampZoomDomain(rows, domain);
	const epsilon = 0.001;
	if (Math.abs(nextDomain[0] - fullDomain[0]) < epsilon && Math.abs(nextDomain[1] - fullDomain[1]) < epsilon) {
		zoomDomains.delete(view);
		return fullDomain;
	}

	zoomDomains.set(view, nextDomain);
	return nextDomain;
}

function isZoomed(view, rows) {
	const domain = zoomDomains.get(view);
	if (!domain) return false;
	const fullDomain = fullDomainForRows(rows);
	return Math.abs(domain[0] - fullDomain[0]) > 0.001 || Math.abs(domain[1] - fullDomain[1]) > 0.001;
}

function rowsInsideDomain(rows, domain) {
	const visibleRows = rows.filter((row) => row.year >= domain[0] && row.year <= domain[1]);
	return visibleRows.length ? visibleRows : rows;
}

function clampValue(value, min, max) {
	return Math.max(min, Math.min(max, value));
}

function yearTicks(domain, innerWidth) {
	const start = Math.ceil(domain[0]);
	const end = Math.floor(domain[1]);
	if (end < start) return [Math.round((domain[0] + domain[1]) / 2)];

	const years = d3.range(start, end + 1);
	const maxTicks = Math.max(4, Math.floor(innerWidth / 90));
	if (years.length <= maxTicks) return years;

	const rawStep = Math.ceil(years.length / maxTicks);
	const step = [1, 2, 5, 10, 20, 25, 50].find((candidate) => candidate >= rawStep) || rawStep;
	const ticks = years.filter((year) => year % step === 0);
	if (!ticks.includes(start)) ticks.unshift(start);
	if (!ticks.includes(end)) ticks.push(end);
	return ticks;
}

function extentForSeries(rows, series) {
	const values = [];
	for (const row of rows) {
		for (const item of series) {
			const value = valueFor(row, item.key);
			if (value !== null) values.push(value);
		}
	}

	if (!values.length) return [0, 1];
	const min = Math.min(0, d3.min(values));
	const max = d3.max(values);
	if (min === max) return [0, max || 1];
	const padding = (max - min) * 0.08;
	return [Math.min(0, min - padding), max + padding];
}

function activeView() {
	return views[state.view];
}

function qualityForMetric(row, key) {
	if (!row) return null;
	if ((key === "housingShortage" || key === "housingShortagePct") && row.housingShortageInterpolated) return "interpolated";
	if (["bornAbroadPopulation", "bornAbroadPopulationPctPopulation"].includes(key) && row.bornAbroadPopulationEstimated) return "backcast";
	if (
		[
			"nativeBackgroundProxy",
			"nativeBackgroundProxyPctPopulation",
			"migrationBackgroundTotal",
			"migrationBackgroundTotalPctPopulation",
			"firstGenerationMigrationBackground",
			"firstGenerationMigrationBackgroundPctPopulation",
			"secondGenerationMigrationBackground",
			"secondGenerationMigrationBackgroundPctPopulation",
		].includes(key)
	)
		return row.qualityMethod;
	if (key === "populationMinusNetMigration" || key === "originBornNetherlands") return "proxy";
	return null;
}

function qualityBadge(code) {
	const rule = data?.qualityRules?.[code];
	if (!rule) return "";
	return `<small class="quality-badge">${rule.label}</small>`;
}

function appendQualityBadge(element, code) {
	const rule = data?.qualityRules?.[code];
	if (!rule) return;
	const badge = document.createElement("small");
	badge.className = "quality-badge";
	badge.textContent = rule.label;
	badge.title = rule.description;
	element.append(badge);
}

function definitionInfo() {
	return {
		nativeBackgroundProxy: {
			title: "Gekozen definitie: inheemse proxy",
			description: "Personen met Nederlandse achtergrond of, vanaf 2022, twee in Nederland geboren ouders. Dit blijft een proxy en geen directe CBS-categorie 'inheems'.",
			key: "nativeBackgroundProxy",
		},
		bornAbroadPopulation: {
			title: "Gekozen definitie: geboren buiten Nederland",
			description: "Directe voorraad vanaf 2022; oudere jaren zijn teruggeschat uit 1e generatie plus een vaste correctiegroep.",
			key: "bornAbroadPopulation",
		},
		firstGenerationMigrationBackground: {
			title: "Gekozen definitie: 1e generatie",
			description: "Geboren buiten Nederland met migratieachtergrond volgens oude CBS-definitie of brugdefinitie.",
			key: "firstGenerationMigrationBackground",
		},
		migrationBackgroundTotal: {
			title: "Gekozen definitie: migratieachtergrond totaal",
			description: "1e en 2e generatie volgens oude CBS-definitie of doorgetrokken via geboorteland van persoon en ouders.",
			key: "migrationBackgroundTotal",
		},
	}[state.definition];
}

function seriesByKeys(view, keys, axisOverride = null) {
	return view.series.filter((series) => keys.includes(series.key)).map((series) => (axisOverride ? { ...series, axis: axisOverride } : series));
}

function renderLegend(view) {
	legend.replaceChildren();

	const appendLegendItems = (container, items) => {
		for (const item of items) {
			const entry = document.createElement("span");
			entry.className = "legend-item";
			if (item.key === state.definition) entry.classList.add("is-highlighted");
			entry.tabIndex = 0;
			entry.title = metricInfo[item.key]?.description || item.label;
			entry.setAttribute("aria-label", `${item.label}: ${entry.title}`);

			const swatch = document.createElement("i");
			swatch.style.background = item.kind === "bar" ? item.color : "transparent";
			swatch.style.borderColor = item.color;
			if (item.kind === "line") swatch.classList.add("line-swatch");

			entry.append(swatch, item.label);
			bindInfoEvents(entry, {
				title: item.label,
				description: metricInfo[item.key]?.description,
				source: metricInfo[item.key]?.source,
			});
			container.append(entry);
		}
	};

	if (state.view === "population") {
		const groups = [
			{
				title: "Voorraden",
				items: view.series.filter((item) => ["population", "nativeBackgroundProxy", "migrationBackgroundTotal", "bornAbroadPopulation"].includes(item.key)),
			},
			{
				title: "Aandelen",
				items: view.series.filter((item) => ["nativeBackgroundProxyPctPopulation", "migrationBackgroundTotalPctPopulation", "bornAbroadPopulationPctPopulation"].includes(item.key)),
			},
			{
				title: "Boekhouding",
				items: view.series.filter((item) => ["populationMinusNetMigration"].includes(item.key)),
			},
			{
				title: "Geboorte & sterfte",
				items: view.series.filter((item) => ["liveBirths", "deaths", "birthSurplus"].includes(item.key)),
			},
			{
				title: "Migratie",
				items: view.series.filter((item) => ["immigration", "emigration", "netMigration"].includes(item.key)),
			},
		];

		for (const group of groups) {
			const wrapper = document.createElement("div");
			wrapper.className = "legend-group";

			const title = document.createElement("span");
			title.className = "legend-group-title";
			title.textContent = group.title;

			const items = document.createElement("div");
			items.className = "legend-group-items";
			appendLegendItems(items, group.items);

			wrapper.append(title, items);
			legend.append(wrapper);
		}
		return;
	}

	if (state.view === "composition") {
		const groups = [
			{
				title: "Voorraden",
				items: view.series.filter((item) => ["bornAbroadPopulation", "nativeBackgroundProxy", "migrationBackgroundTotal"].includes(item.key)),
			},
			{
				title: "Generaties",
				items: view.series.filter((item) => ["firstGenerationMigrationBackground", "secondGenerationMigrationBackground"].includes(item.key)),
			},
		];

		for (const group of groups) {
			const wrapper = document.createElement("div");
			wrapper.className = "legend-group";

			const title = document.createElement("span");
			title.className = "legend-group-title";
			title.textContent = group.title;

			const items = document.createElement("div");
			items.className = "legend-group-items";
			appendLegendItems(items, group.items);

			wrapper.append(title, items);
			legend.append(wrapper);
		}
		return;
	}

	if (state.view === "growth") {
		chartNote.textContent = "Deze tab ontleedt jaarlijkse bevolkingsgroei boekhoudkundig: totale groei = geboorteoverschot + nettomigratie + overige correcties.";
		chartNote.hidden = false;
		return;
	}

	if (state.view === "age") {
		chartNote.textContent = "Deze tab toont het geselecteerde jaar als leeftijdsprofiel. Voor 1972-1995 zijn alleen migratieachtergrond en generaties per leeftijdsbucket beschikbaar; ontbrekende waarden worden niet geinterpoleerd.";
		chartNote.hidden = false;
		return;
	}

	const legendItems =
		state.view === "housing"
			? [...view.series, { key: "netHousingStockGrowthPer1000Residents", label: "Netto groei per 1000 inwoners", color: "#8b443d", axis: "left", kind: "line", width: 2.4 }, { key: "personsPerHome", label: "Inwoners per woning", color: "#8167a9", axis: "left", kind: "line", width: 2.2, dash: "4 5" }]
			: view.series;

	for (const item of legendItems) {
		const entry = document.createElement("span");
		entry.className = "legend-item";
		if (item.key === state.definition) entry.classList.add("is-highlighted");
		entry.tabIndex = 0;
		entry.title = metricInfo[item.key]?.description || item.label;
		entry.setAttribute("aria-label", `${item.label}: ${entry.title}`);

		const swatch = document.createElement("i");
		swatch.style.background = item.kind === "bar" ? item.color : "transparent";
		swatch.style.borderColor = item.color;
		if (item.kind === "line") swatch.classList.add("line-swatch");

		entry.append(swatch, item.label);
		bindInfoEvents(entry, {
			title: item.label,
			description: metricInfo[item.key]?.description,
			source: metricInfo[item.key]?.source,
		});
		legend.append(entry);
	}
}

function renderStats() {
	const view = activeView();
	const row =
		state.view === "age"
			? Object.fromEntries(
					view.stats.map((stat) => {
						const values = (ageRowForYear(state.year)?.buckets || []).map((bucket) => valueFor(bucket, stat.key)).filter((value) => value !== null);
						return [stat.key, values.length ? values.reduce((total, value) => total + value, 0) : null];
					})
				)
			: rowForYear(state.year);

	yearLabel.textContent = state.year;
	selectedYearTitle.textContent = state.year;
	prevYearButton.disabled = state.year <= Number(yearRange.min);
	nextYearButton.disabled = state.year >= Number(yearRange.max);
	statList.replaceChildren();

	for (const stat of view.stats) {
		const item = document.createElement("div");
		item.className = "stat-item";
		item.tabIndex = 0;
		item.title = metricInfo[stat.key]?.description || stat.label;
		item.setAttribute("aria-label", `${stat.label}: ${item.title}`);
		const label = document.createElement("span");
		label.textContent = stat.label;
		const value = document.createElement("strong");
		value.textContent = stat.format(valueFor(row, stat.key));
		item.append(label, value);
		appendQualityBadge(item, qualityForMetric(row, stat.key));
		if ((stat.key === "housingShortage" || stat.key === "housingShortagePct") && row?.housingShortageInterpolated) {
			const note = document.createElement("small");
			note.className = "stat-note";
			note.textContent = interpolationLabel(row);
			item.append(note);
		}
		if ((stat.key === "bornAbroadPopulation" || stat.key === "bornAbroadPopulationPctPopulation") && row?.bornAbroadPopulationEstimated) {
			const note = document.createElement("small");
			note.className = "stat-note";
			note.textContent = "Geschat vóór 2022 uit 1e generatie + vaste offset";
			item.append(note);
		}
		bindInfoEvents(item, {
			title: stat.label,
			description: metricInfo[stat.key]?.description,
			source: metricInfo[stat.key]?.source,
		});
		statList.append(item);
	}
}

function renderGridCards() {
	const current = data.gridCurrent;
	detailEyebrow.textContent = "Capaciteitskaart 2026";
	detailTitle.textContent = "Stroomnet grootverbruik";
	gridCards.replaceChildren();

	for (const [key, label] of [
		["afname", "Afname"],
		["invoeding", "Invoeding"],
	]) {
		const stats = current[key];
		const card = document.createElement("div");
		card.className = "grid-card";
		card.tabIndex = 0;
		card.title = gridCardInfo[key].description;
		card.setAttribute("aria-label", `${gridCardInfo[key].title}: ${gridCardInfo[key].description}`);

		const heading = document.createElement("h3");
		heading.textContent = label;
		const room = document.createElement("strong");
		room.className = stats.waitlistMw > 0 ? "negative" : "positive";
		room.textContent = `${mw(stats.waitlistMw)} wachtrij`;

		const list = document.createElement("dl");
		for (const [term, value] of [
			["Aanwezig", mw(stats.availableMw)],
			["Benodigd", mw(stats.requiredMw)],
			["Saldo bekend", `${stats.headroomMw >= 0 ? "+" : ""}${mw(stats.headroomMw)}`],
			["Verzoeken", requests(stats.requests)],
		]) {
			const wrapper = document.createElement("div");
			const dt = document.createElement("dt");
			const dd = document.createElement("dd");
			dt.textContent = term;
			dd.textContent = value;
			wrapper.append(dt, dd);
			list.append(wrapper);
		}

		card.append(heading, room, list);
		bindInfoEvents(card, gridCardInfo[key]);
		gridCards.append(card);
	}
}

function originBreakdownForYear(year) {
	return data.migrationOriginBreakdown?.find((row) => row.year === year) || null;
}

function emigrationBreakdownForYear(year) {
	return data.migrationEmigrationBreakdown?.find((row) => row.year === year) || null;
}

function appendRankCard(title, rows, note) {
	const card = document.createElement("div");
	card.className = "grid-card is-list";

	const heading = document.createElement("h3");
	heading.textContent = title;
	card.append(heading);

	if (rows?.length) {
		const list = document.createElement("ol");
		list.className = "rank-list";
		for (const row of rows) {
			const item = document.createElement("li");
			const label = document.createElement("span");
			label.textContent = row.label;
			label.title = row.label;
			const value = document.createElement("strong");
			value.textContent = formatNumber.format(row.value);
			item.append(label, value);
			list.append(item);
		}
		card.append(list);
	} else {
		const empty = document.createElement("small");
		empty.className = "card-note";
		empty.textContent = "Geen CBS-uitsplitsing voor dit jaar.";
		card.append(empty);
	}

	if (note) {
		const source = document.createElement("small");
		source.className = "card-note";
		source.textContent = note;
		card.append(source);
	}

	gridCards.append(card);
}

function appendTrendCard(title, trends, selectedYear, note) {
	const card = document.createElement("div");
	card.className = "grid-card is-list trend-card";
	const heading = document.createElement("h3");
	heading.textContent = title;
	card.append(heading);

	if (trends?.length) {
		const list = document.createElement("ol");
		list.className = "rank-list";
		for (const trend of trends.slice(0, 5)) {
			const selected = trend.values.find((row) => row.year === selectedYear);
			const item = document.createElement("li");
			const label = document.createElement("span");
			label.textContent = trend.label;
			label.title = `${trend.label}; piek ${trend.peakYear}: ${formatNumber.format(trend.peakValue)}`;
			const value = document.createElement("strong");
			value.textContent = selected ? formatNumber.format(selected.value) : `laatst ${formatNumber.format(trend.latestValue)}`;
			item.append(label, value);
			list.append(item);
		}
		card.append(list);
	} else {
		const empty = document.createElement("small");
		empty.className = "card-note";
		empty.textContent = "Geen trenddata beschikbaar.";
		card.append(empty);
	}

	if (note) {
		const source = document.createElement("small");
		source.className = "card-note";
		source.textContent = note;
		card.append(source);
	}

	gridCards.append(card);
}

function appendMetricCard({ title, mainValue, rows = [], note = "", info = null }) {
	const card = document.createElement("div");
	card.className = "grid-card";

	if (info?.description) {
		card.tabIndex = 0;
		card.title = info.description;
		card.setAttribute("aria-label", `${title}: ${info.description}`);
		bindInfoEvents(card, {
			title,
			description: info.description,
			source: info.source,
		});
	}

	const heading = document.createElement("h3");
	heading.textContent = title;
	const main = document.createElement("strong");
	main.textContent = mainValue;
	card.append(heading, main);

	if (rows.length) {
		const list = document.createElement("dl");
		for (const [term, value] of rows) {
			const wrapper = document.createElement("div");
			const dt = document.createElement("dt");
			const dd = document.createElement("dd");
			dt.textContent = term;
			dd.textContent = value;
			wrapper.append(dt, dd);
			list.append(wrapper);
		}
		card.append(list);
	}

	if (note) {
		const detail = document.createElement("small");
		detail.className = "card-note";
		detail.textContent = note;
		card.append(detail);
	}

	gridCards.append(card);
}

function renderCompositionCards() {
	const row = rowForYear(state.year);
	const method = row?.compositionMethod;
	const isParentsBridge = method === "geboorteland_en_ouders";
	const isReconstructed = method === "migratieachtergrond_reconstructie";

	detailEyebrow.textContent = isParentsBridge ? "Samenstelling geselecteerd jaar (ouders)" : isReconstructed ? "Samenstelling geselecteerd jaar (CBS-reconstructie)" : "Samenstelling geselecteerd jaar";
	detailTitle.textContent = "Achtergrond en generaties";
	gridCards.replaceChildren();

	appendMetricCard({
		title: "In buitenland geboren",
		mainValue: people(valueFor(row, "bornAbroadPopulation")),
		rows: [
			["Aandeel bevolking", percent(valueFor(row, "bornAbroadPopulationPctPopulation"))],
			["1e generatie", people(valueFor(row, "firstGenerationMigrationBackground"))],
			["Geboren buiten NL, 2 ouders geboren in NL", people(valueFor(row, "bornAbroadDutchParents"))],
		],
		note: isParentsBridge
			? "Dit is de directe CBS-voorraad waarop samenvattingen zoals '3 miljoen in het buitenland geboren' zijn gebaseerd."
			: isReconstructed
				? "Voor 1972-1995 is dit teruggeschat uit de CBS-reconstructie voor 1e generatie plus een vaste correctie voor buiten Nederland geboren personen met twee in Nederland geboren ouders."
				: "Voor 1996-2021 is dit in deze pagina teruggeschat uit 1e generatie plus een vaste correctie voor buiten Nederland geboren personen met twee in Nederland geboren ouders.",
		info: metricInfo.bornAbroadPopulation,
	});

	appendMetricCard({
		title: "Nederlandse achtergrond / 2 ouders geboren in NL",
		mainValue: people(valueFor(row, "nativeBackgroundProxy")),
		rows: [
			["Aandeel bevolking", percent(valueFor(row, "nativeBackgroundProxyPctPopulation"))],
			["Migratieachtergrond totaal", people(valueFor(row, "migrationBackgroundTotal"))],
			["Geboren buiten NL, 2 ouders geboren in NL", people(valueFor(row, "bornAbroadDutchParents"))],
			["Geboorten in jaar", people(valueFor(row, "nativeProxyBirths"))],
			["Aandeel van alle geboorten", percent(valueFor(row, "nativeProxyBirthsPctLiveBirths"))],
		],
		note: isParentsBridge
			? "Vanaf 2022 komt deze reeks uit geboorteland van beide ouders; geboren buiten NL met twee NL-geboren ouders blijven hier dus in zitten. De geboorte-regels gebruiken voor recente jaren CBS 85369NED en zijn daar afgeleid als overledenen plus geboorteoverschot voor dezelfde oudercategorie."
			: isReconstructed
				? "Voor 1972-1995 is dit totale bevolking minus de gereconstrueerde CBS-voorraad met migratieachtergrond. Een directe geboortereeks naar geboorteland van ouders is publiek pas vanaf 2022 beschikbaar."
				: "Voor 1996-2021 gebruikt CBS hier direct de oude categorie Nederlandse achtergrond. Een directe geboortereeks naar geboorteland van ouders is publiek pas vanaf 2022 beschikbaar en is voor oudere jaren nog niet teruggeschat.",
		info: metricInfo.nativeBackgroundProxy,
	});

	appendMetricCard({
		title: "1e generatie / migrant",
		mainValue: people(valueFor(row, "firstGenerationMigrationBackground")),
		rows: [
			["Aandeel bevolking", percent(valueFor(row, "firstGenerationMigrationBackgroundPctPopulation"))],
			["Migratieachtergrond totaal", people(valueFor(row, "migrationBackgroundTotal"))],
		],
		note: isParentsBridge
			? "Vanaf 2022 afgeleid als geboren buiten NL minus geboren buiten NL met twee in NL geboren ouders."
			: isReconstructed
				? "Voor 1972-1995 komt dit uit CBS 70787NED; CBS markeert die jaren als reconstructie van het verleden."
				: "Voor 1996-2021 is dit een direct CBS-label in de migratieachtergrondtabel.",
		info: metricInfo.firstGenerationMigrationBackground,
	});

	appendMetricCard({
		title: "2e generatie / kind van migrant",
		mainValue: people(valueFor(row, "secondGenerationMigrationBackground")),
		rows: [
			["Aandeel bevolking", percent(valueFor(row, "secondGenerationMigrationBackgroundPctPopulation"))],
			["1 ouder buiten NL", people(valueFor(row, "secondGenerationOneParentAbroad"))],
			["2 ouders buiten NL", people(valueFor(row, "secondGenerationBothParentsAbroad"))],
		],
		note: isParentsBridge ? "De fijnere ouder-split is publiek pas beschikbaar vanaf 2022." : isReconstructed ? "Voor 1972-1995 komt dit uit CBS 70787NED; de fijnere ouder-split is voor die jaren niet publiek beschikbaar." : "Voor 1996-2021 is alleen 2e generatie totaal publiek beschikbaar, niet de ouder-split.",
		info: metricInfo.secondGenerationMigrationBackground,
	});

	appendMetricCard({
		title: "3e generatie",
		mainValue: "Niet publiek",
		rows: [],
		note: "CBS publiceert in deze openbare reeksen geen grootouderherkomst. Daardoor is een doorlopende 3e generatie-telling hier niet verdedigbaar te reconstrueren.",
	});

	const info = definitionInfo();
	if (info) {
		appendMetricCard({
			title: info.title,
			mainValue: formatMetric(info.key, valueFor(row, info.key)),
			rows: [["Kwaliteit", data.qualityRules?.[qualityForMetric(row, info.key)]?.label || "direct"]],
			note: info.description,
			info: metricInfo[info.key],
		});
	}
}

function renderGrowthCards() {
	const row = rowForYear(state.year);
	detailEyebrow.textContent = "Groei geselecteerd jaar";
	detailTitle.textContent = "Bevolkingsgroei ontleed";
	gridCards.replaceChildren();

	appendMetricCard({
		title: "Totale groei",
		mainValue: formatMetric("populationGrowth", valueFor(row, "populationGrowth")),
		rows: [
			["Geboorteoverschot", formatMetric("birthSurplus", valueFor(row, "birthSurplus"))],
			["Nettomigratie", formatMetric("netMigration", valueFor(row, "netMigration"))],
			["Overige correcties", formatMetric("otherCorrections", valueFor(row, "otherCorrections"))],
		],
		note: "Boekhoudkundig: totale groei = geboorteoverschot + nettomigratie + overige correcties.",
		info: metricInfo.populationGrowth,
	});
}

function renderAgeCards() {
	const ageRow = ageRowForYear(state.year);
	detailEyebrow.textContent = "Leeftijd geselecteerd jaar";
	detailTitle.textContent = "Leeftijdsopbouw";
	gridCards.replaceChildren();

	for (const bucket of ageRow?.buckets || []) {
		appendMetricCard({
			title: bucket.label,
			mainValue: people(valueFor(bucket, "population") ?? valueFor(bucket, "migrationBackgroundTotal")),
			rows: [
				["Bevolking", people(valueFor(bucket, "population"))],
				["Inheemse proxy", people(valueFor(bucket, "nativeBackgroundProxy"))],
				["Migratieachtergrond", people(valueFor(bucket, "migrationBackgroundTotal"))],
				["1e generatie", people(valueFor(bucket, "firstGenerationMigrationBackground"))],
				["2e generatie", people(valueFor(bucket, "secondGenerationMigrationBackground"))],
			],
			note: state.year < 1996 ? "Voor 1972-1995 zijn alleen migratieachtergrond en generaties per leeftijdsbucket beschikbaar." : "",
		});
	}
}

function renderOriginCards() {
	const row = rowForYear(state.year);
	const breakdown = originBreakdownForYear(state.year);
	detailEyebrow.textContent = "Herkomst geselecteerd jaar";
	detailTitle.textContent = "Vertrek, geboorte, nationaliteit";
	gridCards.replaceChildren();

	const returnCard = document.createElement("div");
	returnCard.className = "grid-card";
	returnCard.tabIndex = 0;
	returnCard.title = metricInfo.originBornNetherlands.description;
	returnCard.setAttribute("aria-label", `Terugkomers: ${metricInfo.originBornNetherlands.description}`);

	const heading = document.createElement("h3");
	heading.textContent = "Terugkeer-proxy";
	const mainValue = document.createElement("strong");
	mainValue.textContent = people(valueFor(row, "originBornNetherlands"));
	const list = document.createElement("dl");
	for (const [term, value] of [
		["Vertrekland bekend", people(valueFor(row, "originDepartureKnown"))],
		["Geboren buiten NL", people(valueFor(row, "originBornOutsideNetherlands"))],
		["Nederlandse nationaliteit", people(valueFor(row, "originDutchNationality"))],
		["Niet-Nederlandse nationaliteit", people(valueFor(row, "originNonDutchNationality"))],
	]) {
		const wrapper = document.createElement("div");
		const dt = document.createElement("dt");
		const dd = document.createElement("dd");
		dt.textContent = term;
		dd.textContent = value;
		wrapper.append(dt, dd);
		list.append(wrapper);
	}
	const note = document.createElement("small");
	note.className = "card-note";
	note.textContent = "Terugkomers is hier niet een CBS-label, maar immigranten met geboorteland Nederland.";
	returnCard.append(heading, mainValue, list, note);
	bindInfoEvents(returnCard, {
		title: "Terugkeer-proxy",
		description: metricInfo.originBornNetherlands.description,
		source: metricInfo.originBornNetherlands.source,
	});
	gridCards.append(returnCard);

	appendRankCard("Top vertreklanden", breakdown?.departureTop, "CBS 85671NED; beschikbaar vanaf 2014.");
	appendRankCard("Top geboortelanden", breakdown?.birthCountryTop, "CBS 85468NED; Nederland apart als terugkeer-proxy.");
	appendRankCard("Top nationaliteiten", breakdown?.nationalityTop, "CBS 85848NED; nationaliteit op moment van immigratie.");
	appendTrendCard("Vertreklanden door de tijd", data.migrationOriginCountryTrends, state.year, "Top 8 bepaald op basis van de laatste vijf beschikbare jaren.");
}

function renderEmigrationCards() {
	const row = rowForYear(state.year);
	const breakdown = emigrationBreakdownForYear(state.year);
	detailEyebrow.textContent = "Emigratie geselecteerd jaar";
	detailTitle.textContent = "Bestemming, geboorte, nationaliteit";
	gridCards.replaceChildren();

	const summaryCard = document.createElement("div");
	summaryCard.className = "grid-card";
	summaryCard.tabIndex = 0;
	summaryCard.title = metricInfo.emigrationDestinationReported.description;
	summaryCard.setAttribute("aria-label", `Bestemmingsdata: ${metricInfo.emigrationDestinationReported.description}`);

	const heading = document.createElement("h3");
	heading.textContent = "Bestemmingsdata";
	const mainValue = document.createElement("strong");
	mainValue.textContent = people(valueFor(row, "emigrationDestinationReported"));
	const list = document.createElement("dl");
	for (const [term, value] of [
		["Totaal incl. correcties", people(valueFor(row, "emigrationTotalDetailed"))],
		["Bestemming gepubliceerd", people(valueFor(row, "emigrationDestinationKnown"))],
		["Administratieve afvoeringen", people(valueFor(row, "emigrationAdministrativeRemovals"))],
		["Geboren in NL", people(valueFor(row, "emigrationBornNetherlands"))],
		["Nederlandse nationaliteit", people(valueFor(row, "emigrationDutchNationality"))],
	]) {
		const wrapper = document.createElement("div");
		const dt = document.createElement("dt");
		const dd = document.createElement("dd");
		dt.textContent = term;
		dd.textContent = value;
		wrapper.append(dt, dd);
		list.append(wrapper);
	}
	const note = document.createElement("small");
	note.className = "card-note";
	note.textContent = "Bestemmingsland is exclusief administratieve correcties; totaal, geboorteland en nationaliteit zijn inclusief correcties.";
	summaryCard.append(heading, mainValue, list, note);
	bindInfoEvents(summaryCard, {
		title: "Bestemmingsdata",
		description: metricInfo.emigrationDestinationReported.description,
		source: metricInfo.emigrationDestinationReported.source,
	});
	gridCards.append(summaryCard);

	appendRankCard("Top bestemmingen", breakdown?.destinationTop, "CBS 85671NED; exclusief administratieve correcties.");
	appendRankCard("Top geboortelanden", breakdown?.birthCountryTop, "CBS 85468NED; inclusief administratieve correcties.");
	appendRankCard("Top nationaliteiten", breakdown?.nationalityTop, "CBS 85848NED; inclusief administratieve correcties.");
	appendTrendCard("Bestemmingen door de tijd", data.migrationEmigrationCountryTrends, state.year, "Top 8 bepaald op basis van de laatste vijf beschikbare jaren.");
}

function renderMotivesCards() {
	const row = rowForYear(state.year);
	detailEyebrow.textContent = "Motieven geselecteerd jaar";
	detailTitle.textContent = "EU/EFTA en niet-EU/EFTA";
	gridCards.replaceChildren();

	appendMetricCard({
		title: "EU/EFTA afgeleid migratiedoel",
		mainValue: people(valueFor(row, "migrationPurposeEuTotal")),
		rows: [
			["Arbeid", people(valueFor(row, "migrationPurposeEuWork"))],
			["Gezin", people(valueFor(row, "migrationPurposeEuFamily"))],
			["Studie", people(valueFor(row, "migrationPurposeEuStudy"))],
			["Geen doel", people(valueFor(row, "migrationPurposeEuNoDerivedGoal"))],
			["Overig/onbekend", people(valueFor(row, "migrationPurposeEuOther"))],
		],
		note: "CBS leidt dit af; het is niet hetzelfde als een IND-migratiemotief.",
		info: metricInfo.migrationPurposeEuTotal,
	});

	appendMetricCard({
		title: "Niet-EU/EFTA migratiemotief",
		mainValue: people(valueFor(row, "migrationPurposeNonEuTotal")),
		rows: [
			["Arbeid", people(valueFor(row, "migrationPurposeNonEuWork"))],
			["Gezin", people(valueFor(row, "migrationPurposeNonEuFamily"))],
			["Asiel", people(valueFor(row, "migrationPurposeNonEuAsylum"))],
			["Studie", people(valueFor(row, "migrationPurposeNonEuStudy"))],
			["Tijdelijke bescherming", people(valueFor(row, "migrationPurposeNonEuTemporaryProtection"))],
			["Overig", people(valueFor(row, "migrationPurposeNonEuOther"))],
		],
		note: "Gebaseerd op de eerste vergunning volgens IND/CBS-definitie.",
		info: metricInfo.migrationPurposeNonEuTotal,
	});
}

function renderHousingCards() {
	const row = rowForYear(state.year);
	const shortageNote = row?.housingShortageInterpolated ? interpolationLabel(row) : "Bronpunt uit ABF/Primos-publicaties.";

	detailEyebrow.textContent = "Wonen geselecteerd jaar";
	detailTitle.textContent = "Woningbouw en tekort";
	gridCards.replaceChildren();

	appendMetricCard({
		title: "Gebouwde woningen",
		mainValue: homes(valueFor(row, "newHomes")),
		rows: [
			["Netto voorraadgroei", homes(valueFor(row, "netHousingStockGrowth"))],
			["Woningvoorraad", homes(valueFor(row, "housingStock"))],
			["Inwoners per woning", formatMetric("personsPerHome", valueFor(row, "personsPerHome"))],
			["Netto woningen per 1000 inwoners", formatMetric("netHousingStockGrowthPer1000Residents", valueFor(row, "netHousingStockGrowthPer1000Residents"))],
		],
		note: "CBS woningvoorraadmutaties; netto groei kan afwijken van nieuwbouw door sloop, onttrekking, overige toevoegingen en correcties.",
		info: metricInfo.newHomes,
	});

	appendMetricCard({
		title: "Woningtekort",
		mainValue: homes(valueFor(row, "housingShortage")),
		rows: [
			["Tekortpercentage", percent(valueFor(row, "housingShortagePct"))],
			["Nieuwbouw", homes(valueFor(row, "newHomes"))],
			["Bevolkingsgroei per netto woning", formatMetric("populationGrowthPerNetHome", valueFor(row, "populationGrowthPerNetHome"))],
		],
		note: shortageNote,
		info: metricInfo.housingShortage,
	});
}

function renderDetailCards() {
	if (state.view === "population") {
		renderCompositionCards();
		return;
	}

	if (state.view === "composition") {
		renderCompositionCards();
		return;
	}

	if (state.view === "growth") {
		renderGrowthCards();
		return;
	}

	if (state.view === "age") {
		renderAgeCards();
		return;
	}

	if (state.view === "origin") {
		renderOriginCards();
		return;
	}

	if (state.view === "emigration") {
		renderEmigrationCards();
		return;
	}

	if (state.view === "motives") {
		chartNote.textContent = "EU/EFTA gebruikt CBS 'afgeleid migratiedoel'; niet-EU/EFTA gebruikt migratiemotief op basis van IND-vergunning. Die definities zijn verwant, maar niet identiek.";
		chartNote.hidden = false;
		return;
	}

	if (state.view === "motives") {
		renderMotivesCards();
		return;
	}

	if (state.view === "housing") {
		renderHousingCards();
		return;
	}

	renderGridCards();
}

function drawChartPanel({ root, rows, series, x, top, height, marginLeft, innerWidth, leftLabel, rightLabel, leftTickFormat = shortNumber, rightTickFormat = shortNumber, estimatedBandKey = null, estimatedBandLabel = "", showXAxis = true, showSelectedYearLabel = false }) {
	const leftSeries = series.filter((item) => item.axis !== "right");
	const rightSeries = series.filter((item) => item.axis === "right");
	const leftAxisSeries = leftSeries.length ? leftSeries : rightSeries;
	const yLeft = d3
		.scaleLinear()
		.domain(extentForSeries(rows, leftAxisSeries))
		.nice()
		.range([top + height, top]);
	const yRight = d3
		.scaleLinear()
		.domain(extentForSeries(rows, rightSeries.length ? rightSeries : leftAxisSeries))
		.nice()
		.range([top + height, top]);
	const baselineLeft = yLeft(0);
	const baselineRight = yRight(0);
	const annotationYears = [
		{ year: 1972, label: "1972 CBS-reconstructie" },
		{ year: 1996, label: "1996 oude migratieachtergrondreeks" },
		{ year: 2022, label: "2022 nieuwe herkomstindeling" },
	].filter((item) => item.year >= x.domain()[0] && item.year <= x.domain()[1]);
	const barSeries = series.filter((item) => item.kind === "bar");
	const xDomain = x.domain();
	const yearSpacing = innerWidth / Math.max(1, xDomain[1] - xDomain[0]);
	const barGroupWidth = Math.min(52, yearSpacing * 0.72);
	const barWidth = Math.max(1, Math.min(18, barGroupWidth / Math.max(1, barSeries.length) - 1));

	const panel = root.append("g");
	const estimatedRows = estimatedBandKey ? rows.filter((row) => row.bornAbroadPopulationEstimated && valueFor(row, estimatedBandKey) !== null) : [];

	if (estimatedRows.length) {
		const firstEstimatedYear = estimatedRows[0].year;
		const lastEstimatedYear = estimatedRows[estimatedRows.length - 1].year;
		const xStart = Math.max(marginLeft, x(firstEstimatedYear) - yearSpacing / 2);
		const xEnd = Math.min(marginLeft + innerWidth, x(lastEstimatedYear) + yearSpacing / 2);

		panel
			.append("rect")
			.attr("class", "estimated-band")
			.attr("x", xStart)
			.attr("y", top)
			.attr("width", Math.max(0, xEnd - xStart))
			.attr("height", height);

		if (estimatedBandLabel) {
			panel
				.append("text")
				.attr("class", "estimated-band-label")
				.attr("x", xStart + 8)
				.attr("y", top + 14)
				.text(estimatedBandLabel);
		}
	}

	panel
		.append("g")
		.attr("class", "grid-lines")
		.attr("transform", `translate(${marginLeft},0)`)
		.call(d3.axisLeft(yLeft).ticks(6).tickSize(-innerWidth).tickFormat(""))
		.call((selection) => selection.select(".domain").remove());

	if (showXAxis) {
		const xAxis = d3.axisBottom(x).tickValues(yearTicks(x.domain(), innerWidth)).tickFormat(d3.format("d"));

		panel
			.append("g")
			.attr("class", "axis x-axis")
			.attr("transform", `translate(0,${top + height})`)
			.call(xAxis);
	}

	panel.append("g").attr("class", "axis").attr("transform", `translate(${marginLeft},0)`).call(d3.axisLeft(yLeft).ticks(6).tickFormat(leftTickFormat));

	if (leftLabel) {
		panel
			.append("text")
			.attr("class", "axis-label")
			.attr("x", marginLeft)
			.attr("y", top - 10)
			.text(leftLabel);
	}

	if (rightSeries.length) {
		panel
			.append("g")
			.attr("class", "axis right-axis")
			.attr("transform", `translate(${marginLeft + innerWidth},0)`)
			.call(d3.axisRight(yRight).ticks(6).tickFormat(rightTickFormat));

		if (rightLabel) {
			panel
				.append("text")
				.attr("class", "axis-label right")
				.attr("x", marginLeft + innerWidth)
				.attr("y", top - 10)
				.attr("text-anchor", "end")
				.text(rightLabel);
		}
	}

	for (const seriesItem of barSeries) {
		const index = barSeries.indexOf(seriesItem);
		const scale = seriesItem.axis === "right" ? yRight : yLeft;
		const baseline = seriesItem.axis === "right" ? baselineRight : baselineLeft;
		const offset = (index - (barSeries.length - 1) / 2) * (barWidth + 3);

		panel
			.append("g")
			.selectAll("rect")
			.data(rows.filter((row) => valueFor(row, seriesItem.key) !== null))
			.join("rect")
			.attr("class", "bar")
			.attr("x", (row) => x(row.year) + offset - barWidth / 2)
			.attr("y", (row) => Math.min(scale(valueFor(row, seriesItem.key)), baseline))
			.attr("width", barWidth)
			.attr("height", (row) => Math.max(1, Math.abs(scale(valueFor(row, seriesItem.key)) - baseline)))
			.attr("fill", seriesItem.color)
			.attr("opacity", 0.76);
	}

	for (const seriesItem of series.filter((item) => item.kind === "line")) {
		const scale = seriesItem.axis === "right" ? yRight : yLeft;
		const line = d3
			.line()
			.defined((row) => valueFor(row, seriesItem.key) !== null)
			.x((row) => x(row.year))
			.y((row) => scale(valueFor(row, seriesItem.key)));

		panel
			.append("path")
			.datum(rows)
			.attr("class", "line")
			.attr("d", line)
			.attr("fill", "none")
			.attr("stroke", seriesItem.color)
			.attr("stroke-width", seriesItem.width || 2.4)
			.attr("stroke-dasharray", seriesItem.dash || null);

		panel
			.append("g")
			.selectAll("circle")
			.data(rows.filter((row) => valueFor(row, seriesItem.key) !== null))
			.join("circle")
			.attr("class", (row) => `point${seriesItem.key === "housingShortage" && row.housingShortageInterpolated ? " interpolated-point" : ""}${row.bornAbroadPopulationEstimated && ["bornAbroadPopulation", "bornAbroadPopulationPctPopulation"].includes(seriesItem.key) ? " estimated-point" : ""}`)
			.attr("cx", (row) => x(row.year))
			.attr("cy", (row) => scale(valueFor(row, seriesItem.key)))
			.attr("r", (row) => (row.year === state.year ? 5 : 3.2))
			.attr("fill", (row) => (seriesItem.key === "housingShortage" && row.housingShortageInterpolated ? "#fffdfa" : row.bornAbroadPopulationEstimated && ["bornAbroadPopulation", "bornAbroadPopulationPctPopulation"].includes(seriesItem.key) ? "#fffdfa" : seriesItem.color))
			.attr("stroke", (row) => (seriesItem.key === "housingShortage" && row.housingShortageInterpolated ? seriesItem.color : row.bornAbroadPopulationEstimated && ["bornAbroadPopulation", "bornAbroadPopulationPctPopulation"].includes(seriesItem.key) ? seriesItem.color : "#fff"))
			.attr("stroke-width", (row) => (seriesItem.key === "housingShortage" && row.housingShortageInterpolated ? 2.2 : row.bornAbroadPopulationEstimated && ["bornAbroadPopulation", "bornAbroadPopulationPctPopulation"].includes(seriesItem.key) ? 2.2 : 1.6));
	}

	const selectedX = x(state.year);
	if (selectedX >= marginLeft && selectedX <= marginLeft + innerWidth) {
		const selected = panel.append("g").attr("class", "selected-year-group").attr("transform", `translate(${selectedX},0)`);

		selected
			.append("line")
			.attr("class", "selected-year")
			.attr("x1", 0)
			.attr("x2", 0)
			.attr("y1", top)
			.attr("y2", top + height);

		for (const annotation of annotationYears) {
			const annotationX = x(annotation.year);
			panel
				.append("line")
				.attr("class", "definition-marker")
				.attr("x1", annotationX)
				.attr("x2", annotationX)
				.attr("y1", top)
				.attr("y2", top + height);
			panel
				.append("text")
				.attr("class", "definition-marker-label")
				.attr("x", annotationX + 5)
				.attr("y", top + 12)
				.text(annotation.label);
		}

		if (showSelectedYearLabel) {
			selected
				.append("text")
				.attr("class", "selected-year-label")
				.attr("x", -8)
				.attr("y", top + 16)
				.attr("text-anchor", "end")
				.text(state.year);
		}
	}

	return {
		top,
		bottom: top + height,
		series,
		yLeft,
		yRight,
		baselineLeft,
		baselineRight,
	};
}

function attachYearOverlay({ rows, zoomRows = rows, x, top, height, marginLeft, innerWidth, view, panelContext = null }) {
	chart
		.append("rect")
		.attr("class", "hover-capture")
		.attr("x", marginLeft)
		.attr("y", top)
		.attr("width", innerWidth)
		.attr("height", height)
		.attr("aria-label", "Scroll om te zoomen, sleep om te verschuiven, dubbelklik om zoom te resetten")
		.on("wheel", (event) => zoomChartAtPointer(event, zoomRows, x))
		.on("mousedown", (event) => startChartPan(event, zoomRows, innerWidth))
		.on("dblclick", (event) => {
			event.preventDefault();
			resetZoomForCurrentView();
		})
		.on("mousemove", (event) => {
			const [mouseX] = d3.pointer(event);
			const nearest = d3.least(rows, (row) => Math.abs(x(row.year) - mouseX));
			if (!nearest) return;

			const tooltipSeries = panelContext?.series || view.series;

			showTooltip(event, nearest, view, tooltipSeries);
		})
		.on("mouseleave", hideTooltip)
		.on("click", (event) => {
			if (suppressNextClick) return;
			const [mouseX] = d3.pointer(event);
			const nearest = d3.least(rows, (row) => Math.abs(x(row.year) - mouseX));
			if (!nearest) return;
			state.year = nearest.year;
			yearRange.value = nearest.year;
			render();
		});
}

function renderSinglePanelChart(view, rows) {
	const rect = chartWrap.getBoundingClientRect();
	const width = Math.max(320, Math.floor(rect.width));
	const height = Math.max(420, Math.floor(rect.height));
	const margin = {
		top: 30,
		right: view.series.some((series) => series.axis === "right") ? 64 : 22,
		bottom: 52,
		left: 72,
	};
	const innerWidth = width - margin.left - margin.right;
	const innerHeight = height - margin.top - margin.bottom;
	const xDomain = zoomDomainForView(state.view, rows);
	const visibleRows = rowsInsideDomain(rows, xDomain);
	const x = d3
		.scaleLinear()
		.domain(xDomain)
		.range([margin.left, margin.left + innerWidth]);

	chart.attr("viewBox", `0 0 ${width} ${height}`);
	chart.selectAll("*").remove();

	const panel = drawChartPanel({
		root: chart,
		rows: visibleRows,
		series: view.series,
		x,
		top: margin.top,
		height: innerHeight,
		marginLeft: margin.left,
		innerWidth,
		leftLabel: view.leftLabel,
		rightLabel: view.rightLabel,
		showXAxis: true,
		showSelectedYearLabel: true,
	});

	attachYearOverlay({
		rows: visibleRows,
		zoomRows: rows,
		x,
		top: margin.top,
		height: innerHeight,
		marginLeft: margin.left,
		innerWidth,
		view,
		panelContext: panel,
	});
}

function renderSplitPopulationChart(view, rows) {
	const rect = chartWrap.getBoundingClientRect();
	const width = Math.max(320, Math.floor(rect.width));
	const height = Math.max(760, Math.floor(rect.height));
	const migrationSeries = [...seriesByKeys(view, ["liveBirths", "deaths", "birthSurplus", "immigration", "emigration", "netMigration"], "left")];
	const margin = {
		top: 30,
		right: migrationSeries.some((series) => series.axis === "right") ? 64 : 22,
		bottom: 52,
		left: 72,
	};
	const gap = 30;
	const innerWidth = width - margin.left - margin.right;
	const availableHeight = height - margin.top - margin.bottom - gap * 2;
	const topHeight = Math.round(availableHeight * 0.44);
	const middleHeight = Math.round(availableHeight * 0.22);
	const bottomHeight = availableHeight - topHeight - middleHeight;
	const xDomain = zoomDomainForView(state.view, rows);
	const visibleRows = rowsInsideDomain(rows, xDomain);
	const x = d3
		.scaleLinear()
		.domain(xDomain)
		.range([margin.left, margin.left + innerWidth]);
	const populationSeries = seriesByKeys(view, ["population", "populationMinusNetMigration", "nativeBackgroundProxy", "migrationBackgroundTotal", "bornAbroadPopulation"]);
	const shareSeries = seriesByKeys(view, ["nativeBackgroundProxyPctPopulation", "migrationBackgroundTotalPctPopulation", "bornAbroadPopulationPctPopulation"]);

	chart.attr("viewBox", `0 0 ${width} ${height}`);
	chart.selectAll("*").remove();

	const topPanel = drawChartPanel({
		root: chart,
		rows: visibleRows,
		series: populationSeries,
		x,
		top: margin.top,
		height: topHeight,
		marginLeft: margin.left,
		innerWidth,
		leftLabel: view.leftLabel,
		rightLabel: "",
		estimatedBandKey: "bornAbroadPopulation",
		estimatedBandLabel: "geschat vóór 2022",
		showXAxis: false,
		showSelectedYearLabel: true,
	});

	const middleTop = topPanel.bottom + gap;
	const middlePanel = drawChartPanel({
		root: chart,
		rows: visibleRows,
		series: shareSeries,
		x,
		top: middleTop,
		height: middleHeight,
		marginLeft: margin.left,
		innerWidth,
		leftLabel: "% van bevolking",
		rightLabel: "",
		leftTickFormat: percentTick,
		estimatedBandKey: "bornAbroadPopulationPctPopulation",
		estimatedBandLabel: "geschat vóór 2022",
		showXAxis: false,
		showSelectedYearLabel: false,
	});

	const bottomTop = middlePanel.bottom + gap;
	const bottomPanel = drawChartPanel({
		root: chart,
		rows: visibleRows,
		series: migrationSeries,
		x,
		top: bottomTop,
		height: bottomHeight,
		marginLeft: margin.left,
		innerWidth,
		leftLabel: view.rightLabel,
		rightLabel: "",
		showXAxis: true,
		showSelectedYearLabel: false,
	});

	attachYearOverlay({
		rows: visibleRows,
		zoomRows: rows,
		x,
		top: topPanel.top,
		height: topHeight,
		marginLeft: margin.left,
		innerWidth,
		view,
		panelContext: topPanel,
	});

	attachYearOverlay({
		rows: visibleRows,
		zoomRows: rows,
		x,
		top: middleTop,
		height: middleHeight,
		marginLeft: margin.left,
		innerWidth,
		view,
		panelContext: middlePanel,
	});

	attachYearOverlay({
		rows: visibleRows,
		zoomRows: rows,
		x,
		top: bottomTop,
		height: bottomHeight,
		marginLeft: margin.left,
		innerWidth,
		view,
		panelContext: bottomPanel,
	});
}

function renderSplitHousingChart(view, rows) {
	const rect = chartWrap.getBoundingClientRect();
	const width = Math.max(320, Math.floor(rect.width));
	const height = Math.max(620, Math.floor(rect.height));
	const mainSeries = view.series;
	const perResidentSeries = [{ key: "netHousingStockGrowthPer1000Residents", label: "Netto groei per 1000 inwoners", color: "#8b443d", axis: "left", kind: "line", width: 2.4 }];
	const personsPerHomeSeries = [{ key: "personsPerHome", label: "Inwoners per woning", color: "#8167a9", axis: "left", kind: "line", width: 2.2, dash: "4 5" }];
	const margin = {
		top: 30,
		right: mainSeries.some((series) => series.axis === "right") ? 64 : 22,
		bottom: 52,
		left: 72,
	};
	const gap = 30;
	const innerWidth = width - margin.left - margin.right;
	const availableHeight = height - margin.top - margin.bottom - gap * 2;
	const topHeight = Math.round(availableHeight * 0.58);
	const middleHeight = Math.round(availableHeight * 0.21);
	const bottomHeight = availableHeight - topHeight - middleHeight;
	const xDomain = zoomDomainForView(state.view, rows);
	const visibleRows = rowsInsideDomain(rows, xDomain);
	const x = d3
		.scaleLinear()
		.domain(xDomain)
		.range([margin.left, margin.left + innerWidth]);

	chart.attr("viewBox", `0 0 ${width} ${height}`);
	chart.selectAll("*").remove();

	const topPanel = drawChartPanel({
		root: chart,
		rows: visibleRows,
		series: mainSeries,
		x,
		top: margin.top,
		height: topHeight,
		marginLeft: margin.left,
		innerWidth,
		leftLabel: view.leftLabel,
		rightLabel: view.rightLabel,
		showXAxis: false,
		showSelectedYearLabel: true,
	});

	const middleTop = topPanel.bottom + gap;
	const middlePanel = drawChartPanel({
		root: chart,
		rows: visibleRows,
		series: perResidentSeries,
		x,
		top: middleTop,
		height: middleHeight,
		marginLeft: margin.left,
		innerWidth,
		leftLabel: "woningen per 1000 inwoners - hoger = meer netto woninggroei",
		rightLabel: "",
		leftTickFormat: decimalTick,
		showXAxis: false,
		showSelectedYearLabel: false,
	});

	const bottomTop = middlePanel.bottom + gap;
	const bottomPanel = drawChartPanel({
		root: chart,
		rows: visibleRows,
		series: personsPerHomeSeries,
		x,
		top: bottomTop,
		height: bottomHeight,
		marginLeft: margin.left,
		innerWidth,
		leftLabel: "inwoners per woning - lager = meer woningen per inwoner",
		rightLabel: "",
		leftTickFormat: decimalTick,
		showXAxis: true,
		showSelectedYearLabel: false,
	});

	attachYearOverlay({
		rows: visibleRows,
		zoomRows: rows,
		x,
		top: topPanel.top,
		height: topHeight,
		marginLeft: margin.left,
		innerWidth,
		view,
		panelContext: topPanel,
	});

	attachYearOverlay({
		rows: visibleRows,
		zoomRows: rows,
		x,
		top: middleTop,
		height: middleHeight,
		marginLeft: margin.left,
		innerWidth,
		view,
		panelContext: middlePanel,
	});

	attachYearOverlay({
		rows: visibleRows,
		zoomRows: rows,
		x,
		top: bottomTop,
		height: bottomHeight,
		marginLeft: margin.left,
		innerWidth,
		view,
		panelContext: bottomPanel,
	});
}

function renderAgeChart(view) {
	const ageRow = ageRowForYear(state.year);
	const buckets = ageRow?.buckets || [];
	const rect = chartWrap.getBoundingClientRect();
	const width = Math.max(320, Math.floor(rect.width));
	const height = Math.max(420, Math.floor(rect.height));
	const margin = { top: 30, right: 22, bottom: 70, left: 72 };
	const innerWidth = width - margin.left - margin.right;
	const innerHeight = height - margin.top - margin.bottom;
	const series = view.series;
	const maxValue = d3.max(buckets.flatMap((bucket) => series.map((item) => valueFor(bucket, item.key) || 0))) || 1;
	const x0 = d3
		.scaleBand()
		.domain(buckets.map((bucket) => bucket.key))
		.range([margin.left, margin.left + innerWidth])
		.padding(0.18);
	const x1 = d3
		.scaleBand()
		.domain(series.map((item) => item.key))
		.range([0, x0.bandwidth()])
		.padding(0.08);
	const y = d3
		.scaleLinear()
		.domain([0, maxValue * 1.08])
		.nice()
		.range([margin.top + innerHeight, margin.top]);

	chart.attr("viewBox", `0 0 ${width} ${height}`);
	chart.selectAll("*").remove();

	chart
		.append("g")
		.attr("class", "grid-lines")
		.selectAll("line")
		.data(y.ticks(5))
		.join("line")
		.attr("x1", margin.left)
		.attr("x2", margin.left + innerWidth)
		.attr("y1", (tick) => y(tick))
		.attr("y2", (tick) => y(tick));

	chart
		.append("g")
		.attr("class", "axis")
		.attr("transform", `translate(0,${margin.top + innerHeight})`)
		.call(d3.axisBottom(x0).tickFormat((key) => buckets.find((bucket) => bucket.key === key)?.label || key));
	chart.append("g").attr("class", "axis").attr("transform", `translate(${margin.left},0)`).call(d3.axisLeft(y).ticks(5).tickFormat(shortNumber));

	const groups = chart
		.append("g")
		.selectAll("g")
		.data(buckets)
		.join("g")
		.attr("transform", (bucket) => `translate(${x0(bucket.key)},0)`);

	groups
		.selectAll("rect")
		.data((bucket) => series.map((item) => ({ bucket, item, value: valueFor(bucket, item.key) })))
		.join("rect")
		.attr("class", "bar")
		.attr("x", (entry) => x1(entry.item.key))
		.attr("y", (entry) => (entry.value === null ? y(0) : y(entry.value)))
		.attr("width", x1.bandwidth())
		.attr("height", (entry) => (entry.value === null ? 0 : y(0) - y(entry.value)))
		.attr("fill", (entry) => entry.item.color);
}

function renderChart() {
	const view = activeView();
	const rows = rowsForView(state.view);
	chartWrap.classList.toggle("is-split", ["population", "housing"].includes(state.view));

	if (state.view === "population") {
		renderSplitPopulationChart(view, rows);
		updateZoomControls();
		return;
	}

	if (state.view === "housing") {
		renderSplitHousingChart(view, rows);
		updateZoomControls();
		return;
	}

	if (state.view === "age") {
		renderAgeChart(view);
		updateZoomControls();
		return;
	}

	renderSinglePanelChart(view, rows);
	updateZoomControls();
}

function tooltipAnnotation(series, row) {
	return [series.key === "housingShortage" && row.housingShortageInterpolated ? `<small>${interpolationLabel(row)}</small>` : "", ["bornAbroadPopulation", "bornAbroadPopulationPctPopulation"].includes(series.key) && row.bornAbroadPopulationEstimated ? "<small>geschat vóór 2022</small>" : ""].filter(Boolean).join("");
}

function seriesScreenMetrics({ row, seriesItem, mouseY, yLeft, yRight, baselineLeft, baselineRight }) {
	const value = valueFor(row, seriesItem.key);
	if (value === null) return null;

	const scale = seriesItem.axis === "right" ? yRight : yLeft;
	if (seriesItem.kind === "bar") {
		const baseline = seriesItem.axis === "right" ? baselineRight : baselineLeft;
		const yValue = scale(value);
		const top = Math.min(yValue, baseline);
		const bottom = Math.max(yValue, baseline);
		return {
			position: (top + bottom) / 2,
			distance: mouseY >= top && mouseY <= bottom ? 0 : Math.min(Math.abs(top - mouseY), Math.abs(bottom - mouseY)),
		};
	}

	const position = scale(value);
	return {
		position,
		distance: Math.abs(position - mouseY),
	};
}

function tooltipSeriesWindow({ row, series, mouseY, yLeft, yRight, baselineLeft, baselineRight }) {
	const positioned = series
		.map((seriesItem) => {
			const metrics = seriesScreenMetrics({ row, seriesItem, mouseY, yLeft, yRight, baselineLeft, baselineRight });
			return metrics ? { seriesItem, ...metrics } : null;
		})
		.filter(Boolean)
		.sort((a, b) => a.position - b.position);

	if (positioned.length <= 5) return positioned.map((entry) => entry.seriesItem);

	let nearestIndex = 0;
	let nearestDistance = Number.POSITIVE_INFINITY;
	for (const [index, entry] of positioned.entries()) {
		if (entry.distance < nearestDistance) {
			nearestDistance = entry.distance;
			nearestIndex = index;
		}
	}

	const start = Math.max(0, Math.min(positioned.length - 5, nearestIndex - 2));
	return positioned.slice(start, start + 5).map((entry) => entry.seriesItem);
}

function zoomChartAtPointer(event, rows, x) {
	event.preventDefault();

	const currentDomain = zoomDomainForView(state.view, rows);
	const fullDomain = fullDomainForRows(rows);
	const fullSpan = fullDomain[1] - fullDomain[0];
	const currentSpan = currentDomain[1] - currentDomain[0];
	if (fullSpan <= 0 || currentSpan <= 0) return;

	const [mouseX] = d3.pointer(event);
	const anchor = clampValue(x.invert(mouseX), currentDomain[0], currentDomain[1]);
	const anchorRatio = (anchor - currentDomain[0]) / currentSpan;
	const factor = event.deltaY > 0 ? 1.2 : 0.82;
	const nextSpan = clampValue(currentSpan * factor, Math.min(2, fullSpan), fullSpan);
	const nextDomain = [anchor - nextSpan * anchorRatio, anchor + nextSpan * (1 - anchorRatio)];

	setZoomDomainForView(state.view, rows, nextDomain);
	hideTooltip();
	renderChart();
	scheduleUrlUpdate();
}

function startChartPan(event, rows, innerWidth) {
	if (event.button !== 0) return;
	event.preventDefault();

	const startX = event.clientX;
	const startDomain = zoomDomainForView(state.view, rows);
	const span = startDomain[1] - startDomain[0];
	if (span <= 0) return;

	let didMove = false;
	chartWrap.classList.add("is-panning");

	const handleMove = (moveEvent) => {
		const deltaX = moveEvent.clientX - startX;
		if (Math.abs(deltaX) < 2) return;

		didMove = true;
		suppressNextClick = true;
		const deltaYears = (-deltaX / Math.max(1, innerWidth)) * span;
		setZoomDomainForView(state.view, rows, [startDomain[0] + deltaYears, startDomain[1] + deltaYears]);
		hideTooltip();
		renderChart();
		scheduleUrlUpdate();
	};

	const handleUp = () => {
		window.removeEventListener("mousemove", handleMove);
		window.removeEventListener("mouseup", handleUp);
		chartWrap.classList.remove("is-panning");
		if (didMove) window.setTimeout(() => (suppressNextClick = false), 0);
	};

	window.addEventListener("mousemove", handleMove);
	window.addEventListener("mouseup", handleUp);
}

function resetZoomForCurrentView() {
	zoomDomains.delete(state.view);
	hideTooltip();
	render();
}

function updateZoomControls() {
	if (!resetZoomButton || !data) return;
	const rows = rowsForView(state.view);
	const zoomed = isZoomed(state.view, rows);
	resetZoomButton.disabled = !zoomed;
	resetZoomButton.textContent = zoomed ? "Reset zoom" : "Volledig bereik";
}

let urlTimer = null;
function scheduleUrlUpdate() {
	window.clearTimeout(urlTimer);
	urlTimer = window.setTimeout(updateUrlState, 150);
}

function updateUrlState() {
	const params = new URLSearchParams();
	params.set("view", state.view);
	params.set("year", state.year);
	if (["population", "composition"].includes(state.view)) params.set("definition", state.definition);
	const domain = zoomDomains.get(state.view);
	if (domain) {
		params.set("x0", String(Math.round(domain[0] * 100) / 100));
		params.set("x1", String(Math.round(domain[1] * 100) / 100));
	}
	history.replaceState(null, "", `${location.pathname}?${params.toString()}`);
}

function readUrlState() {
	const params = new URLSearchParams(location.search);
	const view = params.get("view");
	if (view && views[view]) state.view = view;
	const year = Number(params.get("year"));
	if (Number.isFinite(year)) state.year = Math.round(year);
	const definition = params.get("definition");
	if (definition && ["nativeBackgroundProxy", "bornAbroadPopulation", "firstGenerationMigrationBackground", "migrationBackgroundTotal"].includes(definition)) state.definition = definition;
	const x0 = Number(params.get("x0"));
	const x1 = Number(params.get("x1"));
	if (Number.isFinite(x0) && Number.isFinite(x1) && x0 !== x1) zoomDomains.set(state.view, [x0, x1]);
}

function csvEscape(value) {
	const text = String(value ?? "");
	return /[;"\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function exportCsv() {
	const view = activeView();
	const rows = state.view === "age" ? (ageRowForYear(state.year)?.buckets || []).map((bucket) => ({ year: state.year, bucket: bucket.label, ...bucket })) : rowsInsideDomain(rowsForView(state.view), zoomDomainForView(state.view, rowsForView(state.view)));
	const columns = state.view === "age" ? ["year", "bucket", ...view.series.map((series) => series.key)] : ["year", ...view.series.map((series) => series.key), ...view.stats.map((stat) => stat.key).filter((key) => !view.series.some((series) => series.key === key))];
	const labels = Object.fromEntries(view.series.concat(view.stats).map((item) => [item.key, item.label]));
	const header = columns.map((key) => csvEscape(labels[key] || key)).join(";");
	const body = rows.map((row) => columns.map((key) => csvEscape(row[key] ?? "")).join(";")).join("\n");
	const blob = new Blob([`${header}\n${body}\n`], { type: "text/csv;charset=utf-8" });
	const link = document.createElement("a");
	link.href = URL.createObjectURL(blob);
	link.download = `de-autochtoonse-nederlandse-bevolking-${state.view}-${state.year}.csv`;
	link.click();
	URL.revokeObjectURL(link.href);
}

function showTooltip(event, row, view, tooltipSeries = view.series) {
	const lines = tooltipSeries
		.map((series) => {
			const value = valueFor(row, series.key);
			if (value === null) return null;
			const formatted = formatMetric(series.key, value);
			return {
				label: series.label,
				html: `<span><i style="background:${series.color}"></i>${series.label}${qualityBadge(qualityForMetric(row, series.key))}${tooltipAnnotation(series, row)}</span><strong>${formatted}</strong>`,
			};
		})
		.filter(Boolean)
		.sort((a, b) => a.label.localeCompare(b.label, "nl", { sensitivity: "base" }))
		.map((line) => line.html);

	tooltip.innerHTML = `<div class="tooltip-title"><strong>${row.year}</strong><small>${viewSourceNotes[state.view]}</small></div><dl>${lines.map((line) => `<div>${line}</div>`).join("")}</dl>`;
	tooltip.hidden = false;

	const wrapRect = chartWrap.getBoundingClientRect();
	const gap = 8;
	const padding = 8;
	const cursorX = event.clientX - wrapRect.left;
	const cursorY = event.clientY - wrapRect.top;
	let left = cursorX - tooltip.offsetWidth - gap;
	let top = cursorY + gap;

	if (left < padding) left = cursorX + gap;
	if (top + tooltip.offsetHeight > wrapRect.height - padding) top = cursorY - tooltip.offsetHeight - gap;

	left = Math.max(padding, Math.min(wrapRect.width - tooltip.offsetWidth - padding, left));
	top = Math.max(padding, Math.min(wrapRect.height - tooltip.offsetHeight - padding, top));
	tooltip.style.transform = `translate(${left}px, ${top}px)`;
}

function hideTooltip() {
	tooltip.hidden = true;
}

function bindInfoEvents(element, info) {
	if (!info?.description) return;

	element.classList.add("has-info");
	element.addEventListener("mouseenter", (event) => showInfoTooltip(event, info));
	element.addEventListener("mousemove", positionInfoTooltip);
	element.addEventListener("mouseleave", hideInfoTooltip);
	element.addEventListener("focus", () => {
		const rect = element.getBoundingClientRect();
		showInfoTooltip({ clientX: rect.left + rect.width / 2, clientY: rect.bottom + 8 }, info);
	});
	element.addEventListener("blur", hideInfoTooltip);
}

function showInfoTooltip(event, info) {
	infoTooltip.replaceChildren();

	const title = document.createElement("strong");
	title.textContent = info.title;
	const description = document.createElement("p");
	description.textContent = info.description;
	infoTooltip.append(title, description);

	if (info.source) {
		const source = document.createElement("small");
		source.textContent = info.source;
		infoTooltip.append(source);
	}

	infoTooltip.hidden = false;
	positionInfoTooltip(event);
}

function positionInfoTooltip(event) {
	if (infoTooltip.hidden) return;

	const gap = 8;
	const viewportPadding = 8;
	const rect = infoTooltip.getBoundingClientRect();
	let left = event.clientX + gap;
	let top = event.clientY + gap;

	if (left + rect.width > window.innerWidth - viewportPadding) left = event.clientX - rect.width - gap;
	if (top + rect.height > window.innerHeight - viewportPadding) top = event.clientY - rect.height - gap;

	infoTooltip.style.left = `${Math.max(viewportPadding, left)}px`;
	infoTooltip.style.top = `${Math.max(viewportPadding, top)}px`;
}

function hideInfoTooltip() {
	infoTooltip.hidden = true;
}

function interpolationLabel(row) {
	const basis = row?.housingShortageInterpolationBasis;
	return basis ? `Lineair geinterpoleerd tussen ${basis[0]} en ${basis[1]}` : "Lineair geinterpoleerd";
}

function renderChartNote() {
	if (state.view === "population") {
		chartNote.textContent =
			"Deze tab combineert nu bevolking en samenstellingsvoorraden bovenin, aandelen in het midden, en jaarstromen van geboorte, sterfte en migratie onderin. 'Inheemse proxy' betekent hier vanaf 2022: twee in Nederland geboren ouders. Voor 1972-1995 is het totale bevolking minus de CBS-reconstructie van migratieachtergrond; voor 1996-2021 is het de oude CBS-categorie Nederlandse achtergrond. De lijn 'bevolking min cum. nettomigratie (gekalibreerd)' is geen nul-geankerde flowsom meer: vanaf 1972 sluit zij aan op de reeks 'in buitenland geboren', en voor eerdere jaren gebruikt de pagina een op 1972 geankerde backcast op basis van cumulatieve nettomigratie. De goud gemarkeerde band en open punten tonen dat 'in buitenland geboren' vóór 2022 is teruggeschat uit 1e generatie plus een kleine vaste correctiegroep.";
		chartNote.hidden = false;
		return;
	}

	if (state.view === "composition") {
		chartNote.textContent =
			"1972-1995 gebruikt deze tab CBS 70787NED: een door CBS als reconstructie gemarkeerde reeks voor migratieachtergrond en 1e/2e generatie. 1996-2021 gebruikt de tab de oude CBS-reeks voor Nederlandse achtergrond en 1e/2e generatie migratieachtergrond. Vanaf 2022 loopt de reeks door via geboorteland van persoon en ouders. De reeks 'in het buitenland geboren' is vanaf 2022 direct uit CBS en voor 1972-2021 teruggeschat uit 1e generatie plus een kleine vaste correctiegroep. 3e generatie blijft niet publiek zichtbaar.";
		chartNote.hidden = false;
		return;
	}

	if (state.view === "origin") {
		chartNote.textContent = "Vertrekland is beschikbaar vanaf 2014; een klein deel heeft geen gepubliceerd vertrekland. Geboorteland en nationaliteit zijn beschikbaar vanaf 2010. Terugkomers is hier een proxy: immigranten met geboorteland Nederland.";
		chartNote.hidden = false;
		return;
	}

	if (state.view === "emigration") {
		chartNote.textContent = "Bestemmingsland is beschikbaar vanaf 2014 en is exclusief administratieve correcties. Totaal, geboorteland en nationaliteit zijn beschikbaar vanaf 2010 en inclusief administratieve correcties.";
		chartNote.hidden = false;
		return;
	}

	if (state.view !== "housing") {
		chartNote.hidden = true;
		chartNote.textContent = "";
		return;
	}

	const interpolation = data.derivedSources?.housingShortageInterpolation;
	if (!interpolation?.interpolatedYears?.length) {
		chartNote.hidden = true;
		chartNote.textContent = "";
		return;
	}

	const interpolated = interpolation.interpolatedYears.map((row) => `${row.year} (${row.basis[0]}-${row.basis[1]})`).join(", ");
	chartNote.textContent = `Woningtekort: ${interpolated} lineair geinterpoleerd. Bronpunten: ${interpolation.observedYears.join(", ")}.`;
	chartNote.hidden = false;
}

function render() {
	const view = activeView();
	viewKicker.textContent = view.kicker;
	viewTitle.textContent = view.title;
	renderLegend(view);
	renderChartNote();
	renderStats();
	renderDetailCards();
	renderChart();
	viewButtons.forEach((button) => button.classList.toggle("active", button.dataset.view === state.view));
	definitionControl.hidden = !["population", "composition"].includes(state.view);
	definitionButtons.forEach((button) => button.classList.toggle("active", button.dataset.definition === state.definition));
	scheduleUrlUpdate();
}

function setupEvents() {
	viewButtons.forEach((button) => {
		button.addEventListener("click", () => {
			state.view = button.dataset.view;
			syncYearRange();
			render();
		});
	});

	definitionButtons.forEach((button) => {
		button.addEventListener("click", () => {
			state.definition = button.dataset.definition;
			render();
		});
	});

	yearRange.addEventListener("input", () => {
		state.year = Number(yearRange.value);
		render();
	});

	prevYearButton.addEventListener("click", () => stepYear(-1));
	nextYearButton.addEventListener("click", () => stepYear(1));
	resetZoomButton?.addEventListener("click", resetZoomForCurrentView);
	exportCsvButton?.addEventListener("click", exportCsv);

	window.addEventListener("resize", () => renderChart());
}

function stepYear(direction) {
	const next = Math.min(Number(yearRange.max), Math.max(Number(yearRange.min), state.year + direction));
	if (next === state.year) return;
	state.year = next;
	yearRange.value = next;
	render();
}

function syncYearRange() {
	const rows = rowsForView(state.view);
	const [minYear, maxYear] = d3.extent(rows, (row) => row.year);
	state.year = Math.min(maxYear, Math.max(minYear, state.year));
	yearRange.min = minYear;
	yearRange.max = maxYear;
	yearRange.value = state.year;
	minYearLabel.textContent = minYear;
	maxYearLabel.textContent = maxYear;
}

async function init() {
	data = await fetch("data.json").then((response) => response.json());
	readUrlState();
	setupEvents();
	syncYearRange();
	render();
}

init();
