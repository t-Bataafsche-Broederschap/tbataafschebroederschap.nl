/* global d3 */

const scenarioSelect = document.querySelector("#scenarioSelect");
const yearSelect = document.querySelector("#yearSelect");
const normSlider = document.querySelector("#normSlider");
const normValue = document.querySelector("#normValue");
const metricButtons = document.querySelectorAll("[data-metric]");
const tabButtons = document.querySelectorAll("[data-tab]");
const tabPanels = document.querySelectorAll(".project-tab-panel");
const summaryCards = document.querySelector("#summaryCards");
const tooltip = document.querySelector("#tooltip");
const weatherMeta = document.querySelector("#weatherMeta");
const normBreakdownList = document.querySelector("#normBreakdownList");
const capacityMechanismList = document.querySelector("#capacityMechanismList");
const importVulnerabilityList = document.querySelector("#importVulnerabilityList");

const svgs = {
	lole: d3.select("#loleChart"),
	missing: d3.select("#missingCapacityChart"),
	weather: d3.select("#weatherChart"),
	duration: d3.select("#durationChart"),
	event: d3.select("#eventChart"),
	demand: d3.select("#demandChart"),
	capacity: d3.select("#capacityChart"),
	imports: d3.select("#importChart"),
	weeklyDemand: d3.select("#weeklyDemandChart"),
	simultaneity: d3.select("#simultaneityChart"),
};

const scenarioColors = {
	"high-demand": "#d64f43",
	"low-demand": "#d7b16e",
	"low-demand-europe-sensitivity": "#76b7c9",
};

const state = {
	scenario: "high-demand",
	year: 2035,
	metric: "lole",
	norm: 4,
	normIndex: 2,
	tab: "scarcity",
};

let data;

const numberFormat = new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 1 });
const compactFormat = new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 0 });
const percentFormat = new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 0 });
const dayLabels = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];
const objectLabels = {
	BE00: "BE",
	DE00: "DE",
	DKW1: "DK-W",
	FR00: "FR",
	NL00: "NL",
	NOS2: "NO-S",
	UK00: "UK",
};

function formatHours(value) {
	return Number.isFinite(value) ? `${numberFormat.format(value)} uur` : "-";
}

function formatGwh(value) {
	return Number.isFinite(value) ? `${numberFormat.format(value)} GWh` : "-";
}

function formatGw(value) {
	return Number.isFinite(value) ? `${numberFormat.format(value)} GW` : "-";
}

function formatPct(value) {
	return Number.isFinite(value) ? `${percentFormat.format(value * 100)}%` : "-";
}

function metricLabel(metric) {
	return metric === "lole" ? "LOLE" : "EENS";
}

function formatMetric(value, metric) {
	return metric === "lole" ? formatHours(value) : formatGwh(value);
}

function scenarioLabel(key) {
	return data.scenarios.find((scenario) => scenario.key === key)?.label || key;
}

function visibleScenarios() {
	return data.scenarios.filter((scenario) => scenario.key !== "reference" && data.mainResults.some((row) => row.scenario === scenario.key));
}

function availableYears(scenario = state.scenario) {
	return [...new Set(data.mainResults.filter((row) => row.scenario === scenario).map((row) => row.year))].sort((a, b) => a - b);
}

function mainResult(scenario = state.scenario, year = state.year) {
	return data.mainResults.find((row) => row.scenario === scenario && row.year === year);
}

function rowsForMetric(metric) {
	return data.weatherDistributions.filter((row) => row.metric === metric && row.scenario === state.scenario && row.year === state.year && Number.isFinite(row.value));
}

function missingCapacityPoints(year = state.year) {
	const rows = data.missingCapacity.filter((row) => row.year === year && Number.isFinite(row.resultingLole));
	return d3
		.rollups(
			rows,
			(values) => ({
				case: values[0]?.case || "",
				iteration: values[0]?.iteration || "",
				addedNl: d3.sum(
					values.filter((row) => row.attribute.includes("NL")),
					(row) => row.addedCapacityGw || 0
				),
				addedAbroad: d3.sum(
					values.filter((row) => row.attribute.includes("abroad")),
					(row) => row.addedCapacityGw || 0
				),
				lole: d3.mean(values, (row) => row.resultingLole),
			}),
			(row) => `${row.case} ${row.iteration}`.trim()
		)
		.map(([label, value]) => ({ label, ...value, totalAdded: value.addedNl + value.addedAbroad }))
		.sort((a, b) => a.totalAdded - b.totalAdded);
}

function chartSize(svg, preferredHeight = 420) {
	const node = svg.node();
	const rect = node.parentElement.getBoundingClientRect();
	const width = Math.max(320, Math.floor(rect.width));
	const height = window.matchMedia("(max-width: 720px)").matches ? Math.min(preferredHeight, 360) : preferredHeight;
	svg.attr("viewBox", `0 0 ${width} ${height}`).attr("width", width).attr("height", height);
	return { width, height };
}

function emptyChart(svg, message, preferredHeight = 320) {
	const { width, height } = chartSize(svg, preferredHeight);
	svg.selectAll("*").remove();
	svg
		.append("text")
		.attr("x", width / 2)
		.attr("y", height / 2)
		.attr("class", "empty-state")
		.attr("text-anchor", "middle")
		.text(message);
}

function moveTooltip(event) {
	const parent = document.querySelector(".tennet-security-page").getBoundingClientRect();
	tooltip.style.left = `${event.clientX - parent.left + 14}px`;
	tooltip.style.top = `${event.clientY - parent.top + 14}px`;
}

function showTooltip(event, html) {
	tooltip.hidden = false;
	tooltip.innerHTML = html;
	moveTooltip(event);
}

function hideTooltip() {
	tooltip.hidden = true;
}

function drawAxis(root, x, y, innerWidth, innerHeight, { xTicks = 5, yTicks = 5, yFormat = (value) => value } = {}) {
	root
		.append("g")
		.attr("class", "grid")
		.attr("transform", `translate(0,${innerHeight})`)
		.call(d3.axisBottom(x).ticks?.(xTicks).tickSize(-innerHeight).tickFormat("") || d3.axisBottom(x).tickSize(-innerHeight).tickFormat(""));
	root.append("g").attr("class", "grid").call(d3.axisLeft(y).ticks(yTicks).tickSize(-innerWidth).tickFormat(""));
	root
		.append("g")
		.attr("class", "axis")
		.attr("transform", `translate(0,${innerHeight})`)
		.call(d3.axisBottom(x).ticks?.(xTicks) || d3.axisBottom(x));
	root.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(yTicks).tickFormat(yFormat));
}

function populateControls() {
	state.normIndex = Math.max(0, data.meta.adequacyNormOptions.indexOf(data.meta.adequacyNormHours));
	state.norm = data.meta.adequacyNormOptions[state.normIndex] || data.meta.adequacyNormHours;
	normSlider.max = String(data.meta.adequacyNormOptions.length - 1);
	normSlider.value = String(state.normIndex);
	normValue.textContent = formatHours(state.norm);
	scenarioSelect.replaceChildren(
		...visibleScenarios().map((scenario) => {
			const option = document.createElement("option");
			option.value = scenario.key;
			option.textContent = scenario.label;
			return option;
		})
	);
	scenarioSelect.value = state.scenario;
	populateYears();
}

function populateYears() {
	const years = availableYears();
	if (!years.includes(state.year)) state.year = years.at(-1);
	yearSelect.replaceChildren(
		...years.map((year) => {
			const option = document.createElement("option");
			option.value = String(year);
			option.textContent = String(year);
			return option;
		})
	);
	yearSelect.value = String(state.year);
}

function renderSummary() {
	const selected = mainResult();
	const highest = [...data.mainResults].filter((row) => row.scenario !== "reference").sort((a, b) => b.lole - a.lole)[0];
	const weatherRows = rowsForMetric(state.metric);
	const weatherMax = d3.max(weatherRows, (row) => row.value);
	const overshoot = selected ? Math.max(0, selected.lole - state.norm) : null;
	const cards = [
		["Scenario", `${scenarioLabel(state.scenario)} ${state.year}`],
		["LOLE", selected ? formatHours(selected.lole) : "-"],
		[`Boven ${formatHours(state.norm)} norm`, Number.isFinite(overshoot) ? formatHours(overshoot) : "-"],
		["EENS", selected ? formatGwh(selected.eens) : "-"],
		[`Max ${metricLabel(state.metric)} in weerloting`, formatMetric(weatherMax, state.metric)],
		["Hoogste LOLE", highest ? `${highest.scenarioLabel} ${highest.year}: ${formatHours(highest.lole)}` : "-"],
	];

	summaryCards.replaceChildren(
		...cards.map(([label, value]) => {
			const card = document.createElement("article");
			card.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
			return card;
		})
	);
}

function renderNormBreakdown() {
	const rows = visibleScenarios().map((scenario) => {
		const scenarioRows = data.mainResults.filter((row) => row.scenario === scenario.key).sort((a, b) => a.year - b.year);
		const firstAbove = scenarioRows.find((row) => row.lole > state.norm);
		const worst = [...scenarioRows].sort((a, b) => b.lole - a.lole)[0];
		return {
			scenario: scenario.label,
			firstAbove,
			worst,
			overshoot: worst ? Math.max(0, worst.lole - state.norm) : null,
		};
	});

	normBreakdownList.replaceChildren(
		...rows.map((row) => {
			const item = document.createElement("article");
			item.innerHTML = `<span>${row.scenario}</span><strong>${row.firstAbove ? row.firstAbove.year : "blijft onder norm"}</strong><small>${row.worst ? `piek ${formatHours(row.worst.lole)} · ${formatHours(row.overshoot)} boven norm` : "geen LOLE-data"}</small>`;
			return item;
		})
	);
}

function renderCapacityMechanismSummary() {
	const points = missingCapacityPoints();
	if (!points.length) {
		capacityMechanismList.replaceChildren();
		return;
	}

	const european = points.filter((point) => point.case === "European capacity expansion");
	const onlyNl = points.filter((point) => point.case === "Only NL");
	const baseline = points.find((point) => point.totalAdded === 0);
	const requiredEurope = european.find((point) => point.lole <= state.norm);
	const requiredNl = onlyNl.find((point) => point.lole <= state.norm);
	const items = [
		["Startpunt", baseline ? formatHours(baseline.lole) : "-"],
		["Europa + NL onder norm", requiredEurope ? `${formatGw(requiredEurope.totalAdded)} extra` : "niet in stappenreeks"],
		["Alleen NL onder norm", requiredNl ? `${formatGw(requiredNl.addedNl)} extra` : "niet in stappenreeks"],
	];

	capacityMechanismList.replaceChildren(
		...items.map(([label, value]) => {
			const item = document.createElement("article");
			item.innerHTML = `<span>${label}</span><strong>${value}</strong><small>High Demand analyse ${state.year}</small>`;
			return item;
		})
	);
}

function renderLoleChart() {
	const rows = data.mainResults.filter((row) => row.scenario !== "reference" && Number.isFinite(row.lole));
	if (!rows.length) return emptyChart(svgs.lole, "Geen LOLE-data beschikbaar.", 440);
	const svg = svgs.lole;
	const { width, height } = chartSize(svg, 470);
	const margin = { top: 40, right: 26, bottom: 58, left: 68 };
	const innerWidth = width - margin.left - margin.right;
	const innerHeight = height - margin.top - margin.bottom;
	const years = [...new Set(rows.map((row) => row.year))].sort((a, b) => a - b);
	const maxValue = Math.max(
		state.norm,
		d3.max(rows, (row) => row.lole)
	);
	const x = d3.scalePoint().domain(years).range([0, innerWidth]).padding(0.42);
	const y = d3
		.scaleLinear()
		.domain([0, maxValue * 1.16])
		.nice()
		.range([innerHeight, 0]);

	svg.selectAll("*").remove();
	const root = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
	drawAxis(root, x, y, innerWidth, innerHeight, { yFormat: (value) => `${value}` });

	root.append("line").attr("class", "norm-line").attr("x1", 0).attr("x2", innerWidth).attr("y1", y(state.norm)).attr("y2", y(state.norm));
	root
		.append("text")
		.attr("class", "norm-label")
		.attr("x", innerWidth)
		.attr("y", y(state.norm) - 8)
		.attr("text-anchor", "end")
		.text(`${formatHours(state.norm)} norm`);

	const line = d3
		.line()
		.x((row) => x(row.year))
		.y((row) => y(row.lole));

	for (const scenario of visibleScenarios()) {
		const scenarioRows = rows.filter((row) => row.scenario === scenario.key);
		root
			.append("path")
			.datum(scenarioRows)
			.attr("class", `scenario-line ${scenario.key === state.scenario ? "is-active" : ""}`)
			.attr("fill", "none")
			.attr("stroke", scenarioColors[scenario.key] || "#c9a36a")
			.attr("d", line);
	}

	root
		.selectAll("circle")
		.data(rows)
		.join("circle")
		.attr("class", (row) => `point ${row.scenario === state.scenario && row.year === state.year ? "point-selected" : ""}`)
		.attr("cx", (row) => x(row.year))
		.attr("cy", (row) => y(row.lole))
		.attr("r", (row) => (row.scenario === state.scenario && row.year === state.year ? 6.5 : 4.8))
		.attr("fill", (row) => scenarioColors[row.scenario] || "#c9a36a")
		.on("mouseenter", (event, row) => showTooltip(event, `<strong>${row.scenarioLabel} ${row.year}</strong>LOLE: ${formatHours(row.lole)}<br>EENS: ${formatGwh(row.eens)}`))
		.on("mousemove", moveTooltip)
		.on("mouseleave", hideTooltip)
		.on("click", (_, row) => {
			state.scenario = row.scenario;
			state.year = row.year;
			scenarioSelect.value = state.scenario;
			populateYears();
			renderAll();
		});

	root
		.append("text")
		.attr("class", "axis-label")
		.attr("x", innerWidth / 2)
		.attr("y", innerHeight + 46)
		.attr("text-anchor", "middle")
		.text("Jaar");
	root
		.append("text")
		.attr("class", "axis-label")
		.attr("transform", "rotate(-90)")
		.attr("x", -innerHeight / 2)
		.attr("y", -50)
		.attr("text-anchor", "middle")
		.text("LOLE-uren per jaar");

	const legend = svg.append("g").attr("class", "legend").attr("transform", `translate(${margin.left},18)`);
	visibleScenarios().forEach((scenario, index) => {
		const item = legend.append("g").attr("transform", `translate(${index * 168},0)`);
		item.append("circle").attr("r", 5).attr("fill", scenarioColors[scenario.key]);
		item.append("text").attr("x", 10).attr("y", 4).text(scenario.label);
	});
}

function renderMissingCapacityChart() {
	const grouped = missingCapacityPoints();
	renderCapacityMechanismSummary();
	if (!grouped.length) return emptyChart(svgs.missing, "Beschikbaar voor 2030 en 2035 High Demand.", 340);
	const svg = svgs.missing;
	const { width, height } = chartSize(svg, 360);
	const margin = { top: 22, right: 18, bottom: 52, left: 58 };
	const innerWidth = width - margin.left - margin.right;
	const innerHeight = height - margin.top - margin.bottom;

	const x = d3
		.scaleLinear()
		.domain([0, d3.max(grouped, (row) => row.totalAdded) || 1])
		.nice()
		.range([0, innerWidth]);
	const y = d3
		.scaleLinear()
		.domain([0, Math.max(state.norm, d3.max(grouped, (row) => row.lole) || 1) * 1.15])
		.nice()
		.range([innerHeight, 0]);

	svg.selectAll("*").remove();
	const root = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
	drawAxis(root, x, y, innerWidth, innerHeight, { yFormat: (value) => `${value}` });
	root.append("line").attr("class", "norm-line").attr("x1", 0).attr("x2", innerWidth).attr("y1", y(state.norm)).attr("y2", y(state.norm));

	root
		.selectAll("circle")
		.data(grouped)
		.join("circle")
		.attr("class", "point")
		.attr("cx", (row) => x(row.totalAdded))
		.attr("cy", (row) => y(row.lole))
		.attr("r", 5.5)
		.attr("fill", "#d7b16e")
		.on("mouseenter", (event, row) => showTooltip(event, `<strong>${row.label}</strong>Extra capaciteit: ${formatGw(row.totalAdded)}<br>NL: ${formatGw(row.addedNl)} · Buitenland: ${formatGw(row.addedAbroad)}<br>LOLE: ${formatHours(row.lole)}`))
		.on("mousemove", moveTooltip)
		.on("mouseleave", hideTooltip);

	root
		.append("text")
		.attr("class", "axis-label")
		.attr("x", innerWidth / 2)
		.attr("y", innerHeight + 42)
		.attr("text-anchor", "middle")
		.text("Extra capaciteit");
	root
		.append("text")
		.attr("class", "axis-label")
		.attr("transform", "rotate(-90)")
		.attr("x", -innerHeight / 2)
		.attr("y", -43)
		.attr("text-anchor", "middle")
		.text("Resulterende LOLE");
}

function renderWeatherChart() {
	const rows = rowsForMetric(state.metric);
	weatherMeta.textContent = rows.length ? `${rows.length} samples · ${metricLabel(state.metric)}` : "Geen samples";
	if (!rows.length) return emptyChart(svgs.weather, "Geen weerscenario-verdeling voor deze combinatie.", 430);

	const svg = svgs.weather;
	const { width, height } = chartSize(svg, 455);
	const margin = { top: 26, right: 24, bottom: 56, left: 70 };
	const innerWidth = width - margin.left - margin.right;
	const innerHeight = height - margin.top - margin.bottom;
	const weatherScenarios = [...new Set(rows.map((row) => row.weatherScenario))].sort();
	const maxValue = Math.max(
		state.metric === "lole" ? state.norm : 0,
		d3.max(rows, (row) => row.value)
	);
	const x = d3.scaleBand().domain(weatherScenarios).range([0, innerWidth]).padding(0.32);
	const y = d3
		.scaleLinear()
		.domain([0, maxValue * 1.16 || 1])
		.nice()
		.range([innerHeight, 0]);
	const jitter = d3
		.scaleLinear()
		.domain([0, 1])
		.range([-x.bandwidth() * 0.28, x.bandwidth() * 0.28]);

	svg.selectAll("*").remove();
	const root = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
	drawAxis(root, x, y, innerWidth, innerHeight, { yFormat: (value) => `${value}` });
	if (state.metric === "lole") {
		root.append("line").attr("class", "norm-line").attr("x1", 0).attr("x2", innerWidth).attr("y1", y(state.norm)).attr("y2", y(state.norm));
	}

	root
		.selectAll("circle")
		.data(rows)
		.join("circle")
		.attr("class", "weather-dot")
		.attr("cx", (row, index) => (x(row.weatherScenario) || 0) + x.bandwidth() / 2 + jitter((index * 0.618) % 1))
		.attr("cy", (row) => y(row.value))
		.attr("r", 3.2)
		.attr("fill", scenarioColors[state.scenario])
		.on("mouseenter", (event, row) => showTooltip(event, `<strong>${row.weatherScenario} · ${row.iteration}</strong>${metricLabel(state.metric)}: ${formatMetric(row.value, state.metric)}`))
		.on("mousemove", moveTooltip)
		.on("mouseleave", hideTooltip);

	root
		.append("text")
		.attr("class", "axis-label")
		.attr("x", innerWidth / 2)
		.attr("y", innerHeight + 44)
		.attr("text-anchor", "middle")
		.text("Weerscenario");
	root
		.append("text")
		.attr("class", "axis-label")
		.attr("transform", "rotate(-90)")
		.attr("x", -innerHeight / 2)
		.attr("y", -50)
		.attr("text-anchor", "middle")
		.text(metricLabel(state.metric));
}

function renderDurationChart() {
	const row = data.durationCurves.find((item) => item.scenario === state.scenario && item.year === state.year);
	if (!row?.points?.length) return emptyChart(svgs.duration, "Geen ENS-duurcurve voor deze combinatie.", 340);
	const svg = svgs.duration;
	const { width, height } = chartSize(svg, 360);
	const margin = { top: 22, right: 18, bottom: 52, left: 58 };
	const innerWidth = width - margin.left - margin.right;
	const innerHeight = height - margin.top - margin.bottom;
	const x = d3
		.scaleLinear()
		.domain([0, d3.max(row.points, (point) => point.hour) || 1])
		.range([0, innerWidth]);
	const y = d3
		.scaleLinear()
		.domain([0, d3.max(row.points, (point) => point.ensGw) || 1])
		.nice()
		.range([innerHeight, 0]);
	const line = d3
		.line()
		.x((point) => x(point.hour))
		.y((point) => y(point.ensGw));

	svg.selectAll("*").remove();
	const root = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
	drawAxis(root, x, y, innerWidth, innerHeight, { yFormat: (value) => `${value}` });
	root.append("path").datum(row.points).attr("class", "area-line").attr("fill", "none").attr("stroke", scenarioColors[state.scenario]).attr("d", line);
	root
		.append("text")
		.attr("class", "axis-label")
		.attr("x", innerWidth / 2)
		.attr("y", innerHeight + 42)
		.attr("text-anchor", "middle")
		.text("Gerangschikte tekorturen");
	root
		.append("text")
		.attr("class", "axis-label")
		.attr("transform", "rotate(-90)")
		.attr("x", -innerHeight / 2)
		.attr("y", -43)
		.attr("text-anchor", "middle")
		.text("ENS GW");
}

function renderEventChart() {
	const rows = data.eventDistributions.filter((row) => row.scenario === state.scenario && row.year === state.year && Number.isFinite(row.eventSizeGwh) && Number.isFinite(row.durationHours));
	if (!rows.length) return emptyChart(svgs.event, "Geen eventverdeling voor deze combinatie.", 340);
	const svg = svgs.event;
	const { width, height } = chartSize(svg, 360);
	const margin = { top: 22, right: 18, bottom: 52, left: 58 };
	const innerWidth = width - margin.left - margin.right;
	const innerHeight = height - margin.top - margin.bottom;
	const x = d3
		.scaleLinear()
		.domain([0, d3.max(rows, (row) => row.durationHours) || 1])
		.nice()
		.range([0, innerWidth]);
	const y = d3
		.scaleLinear()
		.domain([0, d3.max(rows, (row) => row.eventSizeGwh) || 1])
		.nice()
		.range([innerHeight, 0]);
	const r = d3
		.scaleSqrt()
		.domain([0, d3.max(rows, (row) => row.count) || 1])
		.range([3, 15]);

	svg.selectAll("*").remove();
	const root = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
	drawAxis(root, x, y, innerWidth, innerHeight, { yFormat: (value) => `${value}` });
	root
		.selectAll("circle")
		.data(rows)
		.join("circle")
		.attr("class", "event-bubble")
		.attr("cx", (row) => x(row.durationHours))
		.attr("cy", (row) => y(row.eventSizeGwh))
		.attr("r", (row) => r(row.count))
		.on("mouseenter", (event, row) => showTooltip(event, `<strong>${formatGwh(row.eventSizeGwh)} · ${formatHours(row.durationHours)}</strong>Aantal events: ${compactFormat.format(row.count)}`))
		.on("mousemove", moveTooltip)
		.on("mouseleave", hideTooltip);
	root
		.append("text")
		.attr("class", "axis-label")
		.attr("x", innerWidth / 2)
		.attr("y", innerHeight + 42)
		.attr("text-anchor", "middle")
		.text("Eventduur");
	root
		.append("text")
		.attr("class", "axis-label")
		.attr("transform", "rotate(-90)")
		.attr("x", -innerHeight / 2)
		.attr("y", -43)
		.attr("text-anchor", "middle")
		.text("Eventgrootte");
}

function stackedBars(svg, rows, { categoryKey, valueKey, preferredHeight, yLabel }) {
	if (!rows.length) return emptyChart(svg, "Geen data voor deze combinatie.", preferredHeight);
	const { width, height } = chartSize(svg, preferredHeight);
	const margin = { top: 24, right: 22, bottom: 54, left: 60 };
	const innerWidth = width - margin.left - margin.right;
	const innerHeight = height - margin.top - margin.bottom;
	const years = [...new Set(rows.map((row) => row.year))].sort((a, b) => a - b);
	const categories = [...new Set(rows.map((row) => row[categoryKey]))];
	const byYear = d3.rollup(
		rows,
		(values) => Object.fromEntries(values.map((row) => [row[categoryKey], row[valueKey] || 0])),
		(row) => row.year
	);
	const series = d3.stack().keys(categories)(years.map((year) => ({ year, ...(byYear.get(year) || {}) })));
	const x = d3.scaleBand().domain(years).range([0, innerWidth]).padding(0.28);
	const y = d3
		.scaleLinear()
		.domain([0, d3.max(series.at(-1), (item) => item[1]) || 1])
		.nice()
		.range([innerHeight, 0]);
	const color = d3.scaleOrdinal().domain(categories).range(["#d64f43", "#d7b16e", "#76b7c9", "#8fbf8d", "#9f84d9", "#c78f61", "#b8b0a0", "#e07a5f"]);

	svg.selectAll("*").remove();
	const root = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
	drawAxis(root, x, y, innerWidth, innerHeight, { yFormat: (value) => `${value}` });
	root
		.selectAll("g.stack")
		.data(series)
		.join("g")
		.attr("class", "stack")
		.attr("fill", (layer) => color(layer.key))
		.selectAll("rect")
		.data((layer) => layer.map((item) => ({ ...item, key: layer.key })))
		.join("rect")
		.attr("x", (item) => x(item.data.year))
		.attr("y", (item) => y(item[1]))
		.attr("height", (item) => Math.max(0, y(item[0]) - y(item[1])))
		.attr("width", x.bandwidth())
		.on("mouseenter", (event, item) => showTooltip(event, `<strong>${item.key} ${item.data.year}</strong>${formatGw(item.data[item.key] || 0)}`))
		.on("mousemove", moveTooltip)
		.on("mouseleave", hideTooltip);
	root
		.append("text")
		.attr("class", "axis-label")
		.attr("x", innerWidth / 2)
		.attr("y", innerHeight + 42)
		.attr("text-anchor", "middle")
		.text("Jaar");
	root
		.append("text")
		.attr("class", "axis-label")
		.attr("transform", "rotate(-90)")
		.attr("x", -innerHeight / 2)
		.attr("y", -44)
		.attr("text-anchor", "middle")
		.text(yLabel);
}

function renderDemandChart() {
	const rows = data.systemMix.demand.filter((row) => row.scenario === state.scenario || row.scenario === "reference");
	stackedBars(svgs.demand, rows, { categoryKey: "sector", valueKey: "value", preferredHeight: 445, yLabel: "Vraag GW" });
}

function renderCapacityChart() {
	const rowsByKey = new Map();
	for (const row of data.systemMix.capacity) {
		if (row.scenario === "reference") {
			rowsByKey.set(`${row.year}:${row.type}:${row.category}`, row);
			continue;
		}
		if (row.scenario === "high-demand" && state.scenario !== "high-demand") {
			rowsByKey.set(`${row.year}:${row.type}:${row.category}`, row);
			continue;
		}
		if (row.scenario === state.scenario) {
			rowsByKey.set(`${row.year}:${row.type}:${row.category}`, row);
		}
	}
	const rows = [...rowsByKey.values()];
	const aggregate = d3
		.rollups(
			rows,
			(values) => d3.sum(values, (row) => row.value || 0),
			(row) => row.year,
			(row) => row.type
		)
		.flatMap(([year, types]) => types.map(([type, value]) => ({ year, type, value })));
	stackedBars(svgs.capacity, aggregate, { categoryKey: "type", valueKey: "value", preferredHeight: 360, yLabel: "Capaciteit GW" });
}

function renderImportChart() {
	const rows = data.systemMix.imports.filter((row) => row.scenario === state.scenario && row.year === state.year);
	if (!rows.length) return emptyChart(svgs.imports, "Geen importdata voor deze combinatie.", 340);
	const svg = svgs.imports;
	const { width, height } = chartSize(svg, 360);
	const margin = { top: 24, right: 18, bottom: 64, left: 56 };
	const innerWidth = width - margin.left - margin.right;
	const innerHeight = height - margin.top - margin.bottom;
	const x = d3
		.scaleBand()
		.domain(rows.map((row) => row.state))
		.range([0, innerWidth])
		.padding(0.36);
	const y = d3
		.scaleLinear()
		.domain([0, d3.max(rows, (row) => row.value) * 1.2 || 1])
		.nice()
		.range([innerHeight, 0]);

	svg.selectAll("*").remove();
	const root = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
	drawAxis(root, x, y, innerWidth, innerHeight, { yFormat: (value) => `${value}` });
	root
		.selectAll("rect")
		.data(rows)
		.join("rect")
		.attr("class", "bar")
		.attr("x", (row) => x(row.state))
		.attr("y", (row) => y(row.value))
		.attr("width", x.bandwidth())
		.attr("height", (row) => innerHeight - y(row.value))
		.on("mouseenter", (event, row) => showTooltip(event, `<strong>${row.state}</strong>${formatGw(row.value)} netto import`))
		.on("mousemove", moveTooltip)
		.on("mouseleave", hideTooltip);
	root
		.append("text")
		.attr("class", "axis-label")
		.attr("x", innerWidth / 2)
		.attr("y", innerHeight + 52)
		.attr("text-anchor", "middle")
		.text("Uurtype");
	root
		.append("text")
		.attr("class", "axis-label")
		.attr("transform", "rotate(-90)")
		.attr("x", -innerHeight / 2)
		.attr("y", -42)
		.attr("text-anchor", "middle")
		.text("Netto import GW");
}

function renderWeeklyDemandChart() {
	const rows = data.weeklyDemand.filter((row) => row.scenario === state.scenario && row.year === state.year && Number.isFinite(row.load));
	if (!rows.length) return emptyChart(svgs.weeklyDemand, "Weekprofiel beschikbaar voor High Demand en Low Demand.", 340);
	const svg = svgs.weeklyDemand;
	const { width, height } = chartSize(svg, 360);
	const margin = { top: 28, right: 18, bottom: 46, left: 46 };
	const innerWidth = width - margin.left - margin.right;
	const innerHeight = height - margin.top - margin.bottom;
	const x = d3.scaleBand().domain(d3.range(24)).range([0, innerWidth]).padding(0.04);
	const y = d3.scaleBand().domain(d3.range(7)).range([0, innerHeight]).padding(0.08);
	const color = d3.scaleSequential(d3.interpolateYlOrRd).domain(d3.extent(rows, (row) => row.load));

	svg.selectAll("*").remove();
	const root = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
	root
		.selectAll("rect")
		.data(rows)
		.join("rect")
		.attr("class", "heat-cell")
		.attr("x", (row) => x(row.hour))
		.attr("y", (row) => y(row.day))
		.attr("width", x.bandwidth())
		.attr("height", y.bandwidth())
		.attr("fill", (row) => color(row.load))
		.on("mouseenter", (event, row) => showTooltip(event, `<strong>${dayLabels[row.day]} ${String(row.hour).padStart(2, "0")}:00</strong>Load: ${formatGw(row.load)}<br>Native load: ${formatGw(row.nativeLoad)}`))
		.on("mousemove", moveTooltip)
		.on("mouseleave", hideTooltip);

	root
		.append("g")
		.attr("class", "axis heat-axis")
		.call(d3.axisLeft(y).tickFormat((value) => dayLabels[value]));
	root
		.append("g")
		.attr("class", "axis heat-axis")
		.attr("transform", `translate(0,${innerHeight})`)
		.call(
			d3
				.axisBottom(x)
				.tickValues([0, 6, 12, 18, 23])
				.tickFormat((value) => `${value}:00`)
		);
}

function renderSimultaneityChart() {
	const rows = data.simultaneity.filter((row) => row.year === state.year && Number.isFinite(row.probability));
	if (!rows.length) return emptyChart(svgs.simultaneity, "Geen simultaneity-data voor dit jaar.", 340);
	const objects = [...new Set(rows.flatMap((row) => [row.objectA, row.objectB]))].sort((a, b) => {
		if (a === "NL00") return -1;
		if (b === "NL00") return 1;
		return (objectLabels[a] || a).localeCompare(objectLabels[b] || b);
	});
	const byPair = new Map(rows.map((row) => [`${row.objectA}:${row.objectB}`, row]));
	const svg = svgs.simultaneity;
	const { width, height } = chartSize(svg, 360);
	const margin = { top: 42, right: 20, bottom: 46, left: 52 };
	const innerWidth = width - margin.left - margin.right;
	const innerHeight = height - margin.top - margin.bottom;
	const x = d3.scaleBand().domain(objects).range([0, innerWidth]).padding(0.06);
	const y = d3.scaleBand().domain(objects).range([0, innerHeight]).padding(0.06);
	const color = d3.scaleSequential(d3.interpolateRgb("#191716", "#d64f43")).domain([0, 1]);
	const cells = objects.flatMap((objectA) => objects.map((objectB) => byPair.get(`${objectA}:${objectB}`) || { objectA, objectB, probability: null }));

	svg.selectAll("*").remove();
	const root = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
	root
		.selectAll("rect")
		.data(cells)
		.join("rect")
		.attr("class", (row) => `heat-cell ${row.objectA === "NL00" || row.objectB === "NL00" ? "heat-cell-focus" : ""}`)
		.attr("x", (row) => x(row.objectB))
		.attr("y", (row) => y(row.objectA))
		.attr("width", x.bandwidth())
		.attr("height", y.bandwidth())
		.attr("fill", (row) => (Number.isFinite(row.probability) ? color(row.probability) : "rgba(255,255,255,0.03)"))
		.on("mouseenter", (event, row) => showTooltip(event, `<strong>${objectLabels[row.objectA] || row.objectA} met ${objectLabels[row.objectB] || row.objectB}</strong>Gelijktijdigheid: ${formatPct(row.probability)}`))
		.on("mousemove", moveTooltip)
		.on("mouseleave", hideTooltip);

	root
		.append("g")
		.attr("class", "axis heat-axis")
		.call(d3.axisLeft(y).tickFormat((value) => objectLabels[value] || value));
	root
		.append("g")
		.attr("class", "axis heat-axis")
		.attr("transform", `translate(0,${innerHeight})`)
		.call(d3.axisBottom(x).tickFormat((value) => objectLabels[value] || value));
	root
		.append("text")
		.attr("class", "axis-label")
		.attr("x", innerWidth / 2)
		.attr("y", -18)
		.attr("text-anchor", "middle")
		.text(`${state.year}: kans op gelijktijdige krapte`);
}

function renderImportVulnerability() {
	const shortageImport = data.systemMix.imports.find((row) => row.year === state.year && row.scenario === state.scenario && row.state === "Shortage hour")?.value;
	const byObject = d3.rollup(
		data.simultaneity.filter((row) => row.year === state.year && row.objectA === "NL00" && row.objectB !== "NL00" && Number.isFinite(row.probability)),
		(values) => d3.max(values, (row) => row.probability),
		(row) => row.objectB
	);
	const rows = [...byObject]
		.map(([objectB, probability]) => ({
			objectB,
			probability,
			score: Number.isFinite(shortageImport) ? probability * shortageImport : probability,
		}))
		.sort((a, b) => b.score - a.score);

	if (!rows.length) {
		importVulnerabilityList.replaceChildren();
		return;
	}

	importVulnerabilityList.replaceChildren(
		...rows.map((row) => {
			const item = document.createElement("article");
			item.innerHTML = `<span>${objectLabels[row.objectB] || row.objectB}</span><strong>${formatPct(row.probability)}</strong><small>${Number.isFinite(shortageImport) ? `${formatGw(shortageImport)} import in tekorturen · score ${numberFormat.format(row.score)}` : "gelijktijdige krapte met NL"}</small>`;
			return item;
		})
	);
}

function renderActiveTab() {
	if (state.tab === "scarcity") {
		renderLoleChart();
		renderMissingCapacityChart();
		renderNormBreakdown();
	} else if (state.tab === "events") {
		renderWeatherChart();
		renderDurationChart();
		renderEventChart();
	} else {
		renderDemandChart();
		renderCapacityChart();
		renderImportChart();
		renderWeeklyDemandChart();
		renderSimultaneityChart();
		renderImportVulnerability();
	}
}

function renderAll() {
	renderSummary();
	renderActiveTab();
}

function activateTab(tab) {
	state.tab = tab;
	tabButtons.forEach((button) => button.classList.toggle("is-active", button.dataset.tab === tab));
	tabPanels.forEach((panel) => {
		const active = panel.id === `tab-${tab}`;
		panel.classList.toggle("is-active", active);
		panel.hidden = !active;
	});
	renderAll();
}

fetch("data.json")
	.then((response) => {
		if (!response.ok) throw new Error(`Kon data.json niet laden: ${response.status}`);
		return response.json();
	})
	.then((loaded) => {
		data = loaded;
		populateControls();
		normSlider.addEventListener("input", () => {
			state.normIndex = Number(normSlider.value);
			state.norm = data.meta.adequacyNormOptions[state.normIndex] || data.meta.adequacyNormHours;
			normValue.textContent = formatHours(state.norm);
			renderAll();
		});
		scenarioSelect.addEventListener("change", () => {
			state.scenario = scenarioSelect.value;
			populateYears();
			renderAll();
		});
		yearSelect.addEventListener("change", () => {
			state.year = Number(yearSelect.value);
			renderAll();
		});
		metricButtons.forEach((button) => {
			button.addEventListener("click", () => {
				state.metric = button.dataset.metric;
				metricButtons.forEach((item) => item.classList.toggle("is-active", item === button));
				renderAll();
			});
		});
		tabButtons.forEach((button) => button.addEventListener("click", () => activateTab(button.dataset.tab)));
		window.addEventListener("resize", () => renderActiveTab());
		renderAll();
	})
	.catch((error) => {
		document.querySelector(".project-dashboard").innerHTML = `<section class="panel"><h2>Data kon niet worden geladen</h2><p>${error.message}</p></section>`;
	});
