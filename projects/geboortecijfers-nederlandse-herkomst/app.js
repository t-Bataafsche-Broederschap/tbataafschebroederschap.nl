/* global d3 */

const chart = d3.select("#mainChart");
const tooltip = document.querySelector("#tooltip");
const groupSelect = document.querySelector("#groupSelect");
const yearRange = document.querySelector("#yearRange");
const yearLabel = document.querySelector("#yearLabel");
const viewButtons = document.querySelectorAll("[data-view]");
const exportCsvButton = document.querySelector("#exportCsv");
const legend = document.querySelector("#legend");
const chartTitle = document.querySelector("#chartTitle");
const chartKicker = document.querySelector("#chartKicker");
const selectedTitle = document.querySelector("#selectedTitle");
const statList = document.querySelector("#statList");
const claimCards = document.querySelector("#claimCards");
const conclusionText = document.querySelector("#conclusionText");
const tableBody = document.querySelector("#metricsTable tbody");

const fmtInt = new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 0 });
const fmt1 = new Intl.NumberFormat("nl-NL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmt2 = new Intl.NumberFormat("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const colors = {
	all: "#d33",
	fertile: "#6ccf8e",
	tfr: "#fbad37",
	replacement: "#ffffff",
	twoChildren: "#9da4aa",
	shortfall: "#d33",
	structure: "#8ab4f8",
	births: "#ff5286",
	contribution: "#fbad37",
	women: "#ff5286",
};

let data;
const state = {
	view: "structure",
	group: "nederlandse_herkomst",
	year: 2025,
};

function groupById(id) {
	return data.groups.find((group) => group.id === id);
}

function metricsFor(group = state.group) {
	return data.metrics.filter((row) => row.group === group);
}

function selectedMetric() {
	return data.metrics.find((row) => row.group === state.group && row.year === state.year);
}

function womenAgeRangeTotal(group, year, minAge, maxAge) {
	return d3.sum(
		data.ageTree.filter((row) => row.group === group && row.year === year && row.startAge >= minAge && row.endAge <= maxAge),
		(row) => row.womenAvg
	);
}

function setLegend(items) {
	legend.innerHTML = items.map((item) => `<span><i style="background:${item.color}"></i>${item.label}</span>`).join("");
}

function dimensions() {
	const node = chart.node();
	const width = Math.max(360, node.clientWidth || 900);
	const height = Math.max(380, node.clientHeight || 520);
	return { width, height, margin: { top: 24, right: 32, bottom: 46, left: 58 } };
}

function clearChart() {
	chart.selectAll("*").remove();
}

function setYear(year) {
	state.year = Number(year);
	yearRange.value = state.year;
	render();
}

function addAxes(svg, x, y, width, height, margin, yLabel) {
	svg
		.append("g")
		.attr("class", "axis")
		.attr("transform", `translate(0,${height - margin.bottom})`)
		.call(d3.axisBottom(x).ticks(4).tickFormat(d3.format("d")));
	svg.append("g").attr("class", "axis").attr("transform", `translate(${margin.left},0)`).call(d3.axisLeft(y).ticks(5));
	svg
		.append("g")
		.attr("transform", `translate(${margin.left},0)`)
		.call(
			d3
				.axisLeft(y)
				.ticks(5)
				.tickSize(-(width - margin.left - margin.right))
				.tickFormat("")
		)
		.selectAll("line")
		.attr("class", "grid-line");
	svg.append("text").attr("x", margin.left).attr("y", 12).attr("fill", "currentColor").attr("font-size", 12).attr("font-weight", 800).text(yLabel);
}

function drawRates() {
	clearChart();
	const rows = metricsFor();
	const { width, height, margin } = dimensions();
	const svg = chart.attr("viewBox", `0 0 ${width} ${height}`);
	const x = d3
		.scaleLinear()
		.domain(d3.extent(rows, (row) => row.year))
		.range([margin.left, width - margin.right]);
	const yMax = d3.max(rows, (row) => Math.max(row.geboorten_per_1000_15_49, row.geboorten_per_1000_alles)) * 1.15;
	const y = d3
		.scaleLinear()
		.domain([0, yMax])
		.nice()
		.range([height - margin.bottom, margin.top]);
	const lineAll = d3
		.line()
		.x((row) => x(row.year))
		.y((row) => y(row.geboorten_per_1000_alles));
	const lineFertile = d3
		.line()
		.x((row) => x(row.year))
		.y((row) => y(row.geboorten_per_1000_15_49));

	addAxes(svg, x, y, width, height, margin, "Geboorten per 1.000 vrouwen");
	svg.append("path").datum(rows).attr("fill", "none").attr("stroke", colors.all).attr("stroke-width", 3).attr("d", lineAll);
	svg.append("path").datum(rows).attr("fill", "none").attr("stroke", colors.fertile).attr("stroke-width", 3).attr("d", lineFertile);

	for (const row of rows) {
		for (const key of ["geboorten_per_1000_alles", "geboorten_per_1000_15_49"]) {
			svg
				.append("circle")
				.attr("cx", x(row.year))
				.attr("cy", y(row[key]))
				.attr("r", row.year === state.year ? 6 : 4)
				.attr("fill", key === "geboorten_per_1000_alles" ? colors.all : colors.fertile)
				.on("mouseenter", (event) => showTooltip(event, `<strong>${row.year}</strong><br>${key === "geboorten_per_1000_alles" ? "Alle leeftijden" : "15-49 jaar"}: ${fmt2.format(row[key])} per 1.000<br>Geboorten: ${fmtInt.format(row.geboorten)}<br>TFR: ${fmt2.format(row.tfr_benadering)}`))
				.on("mousemove", moveTooltip)
				.on("click", () => setYear(row.year))
				.on("mouseleave", hideTooltip);
		}
	}

	setLegend([
		{ color: colors.all, label: "Alle leeftijden in de noemer" },
		{ color: colors.fertile, label: "Alleen 15-49 in de noemer" },
	]);
}

function drawReplacement() {
	clearChart();
	const rows = metricsFor();
	const selected = selectedMetric();
	const { width, height, margin } = dimensions();
	const svg = chart.attr("viewBox", `0 0 ${width} ${height}`);
	const replacementLevel = rows[0]?.vervangingsniveau ?? 2.1;
	const x = d3
		.scaleLinear()
		.domain(d3.extent(rows, (row) => row.year))
		.range([margin.left, width - margin.right]);
	const y = d3
		.scaleLinear()
		.domain([0, Math.max(2.25, d3.max(rows, (row) => row.tfr_benadering) * 1.18)])
		.nice()
		.range([height - margin.bottom, margin.top]);
	const line = d3
		.line()
		.x((row) => x(row.year))
		.y((row) => y(row.tfr_benadering));
	const shortfallArea = d3
		.area()
		.x((row) => x(row.year))
		.y0(y(replacementLevel))
		.y1((row) => y(row.tfr_benadering));

	addAxes(svg, x, y, width, height, margin, "TFR en vervangingsniveau");
	svg.append("path").datum(rows).attr("fill", colors.shortfall).attr("opacity", 0.16).attr("d", shortfallArea);
	for (const reference of [
		{ value: replacementLevel, color: colors.replacement, label: "Vervangingsniveau 2,1", dash: "none" },
		{ value: 2, color: colors.twoChildren, label: "2,0 kinderen", dash: "5 5" },
	]) {
		svg
			.append("line")
			.attr("x1", margin.left)
			.attr("x2", width - margin.right)
			.attr("y1", y(reference.value))
			.attr("y2", y(reference.value))
			.attr("stroke", reference.color)
			.attr("stroke-width", 2)
			.attr("stroke-dasharray", reference.dash);
		svg
			.append("text")
			.attr("x", width - margin.right)
			.attr("y", y(reference.value) - 6)
			.attr("fill", reference.color)
			.attr("font-size", 12)
			.attr("font-weight", 800)
			.attr("text-anchor", "end")
			.text(reference.label);
	}

	svg.append("path").datum(rows).attr("fill", "none").attr("stroke", colors.tfr).attr("stroke-width", 3).attr("d", line);
	const selectedX = x(selected.year);
	svg.append("line").attr("x1", selectedX).attr("x2", selectedX).attr("y1", y(replacementLevel)).attr("y2", y(selected.tfr_benadering)).attr("stroke", colors.shortfall).attr("stroke-width", 4).attr("stroke-linecap", "round");
	svg
		.append("text")
		.attr("x", Math.min(width - margin.right - 180, selectedX + 12))
		.attr("y", y(selected.tfr_benadering) + 26)
		.attr("fill", colors.shortfall)
		.attr("font-size", 12)
		.attr("font-weight", 800)
		.text(`ratio ${fmt2.format(selected.vervangingsratio)}; tekort ${fmt2.format(selected.vervangingstekort)}`);
	svg
		.append("text")
		.attr("x", Math.min(width - margin.right - 220, selectedX + 12))
		.attr("y", y(selected.tfr_benadering) + 44)
		.attr("fill", colors.shortfall)
		.attr("font-size", 12)
		.text(`+${fmtInt.format(selected.extra_geboorten_voor_vervanging)} geboorten bij dit patroon`);
	svg
		.selectAll(".replacement-point")
		.data(rows)
		.join("circle")
		.attr("class", "replacement-point")
		.attr("cx", (row) => x(row.year))
		.attr("cy", (row) => y(row.tfr_benadering))
		.attr("r", (row) => (row.year === state.year ? 6 : 4))
		.attr("fill", colors.tfr)
		.on("mouseenter", (event, row) =>
			showTooltip(event, `<strong>${row.year}</strong><br>TFR: ${fmt2.format(row.tfr_benadering)}<br>Vervangingsratio: ${fmt2.format(row.vervangingsratio)}<br>Tekort t.o.v. 2,1: ${fmt2.format(row.vervangingstekort)}<br>Extra geboorten bij dit patroon: ${fmtInt.format(row.extra_geboorten_voor_vervanging)}`)
		)
		.on("mousemove", moveTooltip)
		.on("click", (_event, row) => setYear(row.year))
		.on("mouseleave", hideTooltip);
	setLegend([
		{ color: colors.tfr, label: "TFR-benadering" },
		{ color: colors.replacement, label: "Vervangingsniveau 2,1" },
		{ color: colors.shortfall, label: "Tekort t.o.v. vervanging" },
		{ color: colors.twoChildren, label: "Referentie 2,0" },
	]);
}

function drawStructure() {
	clearChart();
	const rows = data.ageTree.filter((row) => row.group === state.group && row.year === state.year).sort((a, b) => a.startAge - b.startAge);
	const totalWomen = d3.sum(rows, (row) => row.womenAvg);
	const { width, height, margin } = dimensions();
	const svg = chart.attr("viewBox", `0 0 ${width} ${height}`);
	const x = d3
		.scaleBand()
		.domain(rows.map((row) => row.bucket))
		.range([margin.left, width - margin.right])
		.padding(0.16);
	const y = d3
		.scaleLinear()
		.domain([0, d3.max(rows, (row) => row.womenAvg) * 1.15])
		.nice()
		.range([height - margin.bottom, margin.top]);

	svg
		.append("g")
		.attr("class", "axis")
		.attr("transform", `translate(0,${height - margin.bottom})`)
		.call(d3.axisBottom(x));
	svg
		.append("g")
		.attr("class", "axis")
		.attr("transform", `translate(${margin.left},0)`)
		.call(
			d3
				.axisLeft(y)
				.ticks(5)
				.tickFormat((value) => fmtInt.format(value))
		);
	svg.append("text").attr("x", margin.left).attr("y", 12).attr("fill", "currentColor").attr("font-size", 12).attr("font-weight", 800).text("Gemiddeld aantal vrouwen per 5-jaarsgroep");
	svg
		.selectAll("rect")
		.data(rows)
		.join("rect")
		.attr("x", (row) => x(row.bucket))
		.attr("y", (row) => y(row.womenAvg))
		.attr("width", x.bandwidth())
		.attr("height", (row) => y(0) - y(row.womenAvg))
		.attr("rx", 3)
		.attr("fill", (row) => (row.startAge >= 15 && row.endAge <= 49 ? colors.fertile : colors.structure))
		.on("mouseenter", (event, row) => showTooltip(event, `<strong>${row.bucket} jaar</strong><br>${fmtInt.format(row.womenAvg)} vrouwen<br>${fmt1.format((row.womenAvg / totalWomen) * 100)}% van alle vrouwen<br>${row.bucket === "95+" ? "Open eindgroep" : "5-jaarsgroep"}`))
		.on("mousemove", moveTooltip)
		.on("mouseleave", hideTooltip);
	setLegend([
		{ color: colors.fertile, label: "Binnen 15-49" },
		{ color: colors.structure, label: "Buiten 15-49" },
	]);
}

function drawFertility() {
	clearChart();
	const rows = data.ageSpecific.filter((row) => row.group === state.group && row.year === state.year);
	const metric = selectedMetric();
	const { width, height, margin } = dimensions();
	const svg = chart.attr("viewBox", `0 0 ${width} ${height}`);
	const x = d3
		.scaleLinear()
		.domain([14, 50])
		.range([margin.left, width - margin.right]);
	const y = d3
		.scaleLinear()
		.domain([0, d3.max(rows, (row) => row.birthsPer1000) * 1.18])
		.nice()
		.range([height - margin.bottom, margin.top]);
	const line = d3
		.line()
		.x((row) => x(row.age))
		.y((row) => y(row.birthsPer1000))
		.curve(d3.curveMonotoneX);
	const fertilityTooltip = (row) => `<strong>${row.ageLabel}</strong><br>Bijdrage aan TFR: ${fmt2.format(row.tfrContribution)}<br>${fmt2.format(row.birthsPer1000)} geboorten per 1.000<br>${fmtInt.format(row.births)} geboorten<br>${fmtInt.format(row.womenAvg)} vrouwen`;

	addAxes(svg, x, y, width, height, margin, "Geboorten per 1.000 vrouwen van dezelfde leeftijd");
	svg
		.append("rect")
		.attr("class", "fertile-band hover-target")
		.attr("x", x(15))
		.attr("y", margin.top)
		.attr("width", x(49) - x(15))
		.attr("height", height - margin.top - margin.bottom)
		.attr("fill", colors.fertile)
		.attr("opacity", 0.12)
		.on("mouseenter", (event) => showTooltip(event, `<strong>Vruchtbare vrouwen</strong><br>Leeftijd 15-49<br>${fmtInt.format(metric.vrouwen_15_49_avg)} vrouwen<br>${fmt1.format(metric.aandeel_15_49)}% van alle vrouwen in deze groep`))
		.on("mousemove", moveTooltip)
		.on("mouseleave", hideTooltip);

	const calloutWidth = 230;
	const calloutHeight = 76;
	const calloutX = Math.min(x(27), width - margin.right - calloutWidth);
	const calloutY = margin.top + 28;
	const fertileCallout = svg
		.append("g")
		.attr("class", "fertile-callout hover-target")
		.attr("transform", `translate(${calloutX},${calloutY})`)
		.on("mouseenter", (event) => showTooltip(event, `<strong>Vruchtbare vrouwen</strong><br>Leeftijd 15-49<br>${fmtInt.format(metric.vrouwen_15_49_avg)} vrouwen<br>${fmt1.format(metric.aandeel_15_49)}% van alle vrouwen in deze groep`))
		.on("mousemove", moveTooltip)
		.on("mouseleave", hideTooltip);

	fertileCallout.append("rect").attr("width", calloutWidth).attr("height", calloutHeight).attr("rx", 8).attr("fill", colors.fertile).attr("opacity", 0.18).attr("stroke", colors.fertile);
	fertileCallout.append("text").attr("x", 14).attr("y", 23).attr("fill", colors.fertile).attr("font-size", 12).attr("font-weight", 850).text("Vruchtbare vrouwen");
	fertileCallout.append("text").attr("x", 14).attr("y", 48).attr("fill", "currentColor").attr("font-size", 22).attr("font-weight", 850).text(fmtInt.format(metric.vrouwen_15_49_avg));
	fertileCallout
		.append("text")
		.attr("x", 14)
		.attr("y", 66)
		.attr("fill", "currentColor")
		.attr("font-size", 12)
		.attr("opacity", 0.72)
		.text(`15-49 jaar, ${fmt1.format(metric.aandeel_15_49)}% van alle vrouwen`);

	svg
		.append("text")
		.attr("x", x(15) + 8)
		.attr("y", margin.top + 18)
		.attr("fill", colors.fertile)
		.attr("font-size", 12)
		.attr("font-weight", 800)
		.text("15-49: vruchtbare vrouwen");
	svg
		.append("text")
		.attr("x", width - margin.right)
		.attr("y", margin.top + 18)
		.attr("fill", colors.contribution)
		.attr("font-size", 12)
		.attr("font-weight", 850)
		.attr("text-anchor", "end")
		.text(`TFR = Σ leeftijdsbijdragen = ${fmt2.format(metric.tfr_benadering)}`);
	svg
		.selectAll(".tfr-contribution")
		.data(rows)
		.join("rect")
		.attr("class", "tfr-contribution hover-target")
		.attr("x", (row) => x(row.age) - 4)
		.attr("y", (row) => y(row.birthsPer1000))
		.attr("width", 8)
		.attr("height", (row) => y(0) - y(row.birthsPer1000))
		.attr("rx", 3)
		.attr("fill", colors.contribution)
		.attr("opacity", 0.22)
		.on("mouseenter", (event, row) => showTooltip(event, `${fertilityTooltip(row)}<br>Som alle leeftijden: ${fmt2.format(metric.tfr_benadering)}`))
		.on("mousemove", moveTooltip)
		.on("mouseleave", hideTooltip);
	svg.append("path").datum(rows).attr("fill", "none").attr("stroke", colors.births).attr("stroke-width", 3).attr("d", line);
	svg
		.selectAll("circle")
		.data(rows)
		.join("circle")
		.attr("cx", (row) => x(row.age))
		.attr("cy", (row) => y(row.birthsPer1000))
		.attr("r", (row) => (row.isBoundaryAge ? 5 : 3.5))
		.attr("fill", (row) => (row.isBoundaryAge ? colors.tfr : colors.births))
		.on("mouseenter", (event, row) => showTooltip(event, fertilityTooltip(row)))
		.on("mousemove", moveTooltip)
		.on("mouseleave", hideTooltip);
	svg
		.selectAll(".fertility-hover-zone")
		.data(rows)
		.join("rect")
		.attr("class", "fertility-hover-zone hover-target")
		.attr("x", (row) => x(row.age) - 8)
		.attr("y", margin.top)
		.attr("width", 16)
		.attr("height", height - margin.top - margin.bottom)
		.attr("fill", "transparent")
		.attr("pointer-events", "all")
		.on("mouseenter", (event, row) => showTooltip(event, fertilityTooltip(row)))
		.on("mousemove", moveTooltip)
		.on("mouseleave", hideTooltip);
	setLegend([
		{ color: colors.fertile, label: "Blok vruchtbare vrouwen 15-49" },
		{ color: colors.contribution, label: "Bijdrage aan TFR per leeftijd" },
		{ color: colors.births, label: "Leeftijdsspecifiek geboortecijfer" },
		{ color: colors.tfr, label: "CBS-randleeftijd" },
	]);
}

function showTooltip(event, html) {
	tooltip.innerHTML = html;
	tooltip.hidden = false;
	tooltip.removeAttribute("hidden");
	moveTooltip(event);
}

function moveTooltip(event) {
	tooltip.style.left = `${event.pageX + 14}px`;
	tooltip.style.top = `${event.pageY + 14}px`;
}

function hideTooltip() {
	tooltip.hidden = true;
}

function updateText() {
	const group = groupById(state.group);
	const row = selectedMetric();
	const women0To14 = womenAgeRangeTotal(state.group, state.year, 0, 14);
	const target2025 = data.metrics.find((item) => item.group === "nederlandse_herkomst" && item.year === 2025);
	yearLabel.textContent = state.year;
	selectedTitle.textContent = String(state.year);
	chartKicker.textContent = `${group.shortLabel}, ${data.years[0]}-${data.years[data.years.length - 1]}`;
	chartTitle.textContent = {
		rates: "Ruwe ratio tegenover vruchtbare leeftijden",
		structure: "Leeftijdsopbouw per 5-jaarsgroep",
		fertility: "Leeftijdsspecifieke geboortecijfers",
		replacement: "Vruchtbaarheid tegenover vervangingsniveau",
	}[state.view];
	conclusionText.textContent = `Voor vrouwen van Nederlandse herkomst in 2025 is de ruwe ratio ${fmt1.format(target2025.geboorten_per_1000_alles)} geboorten per 1.000 vrouwen als alle leeftijden meetellen. Beperk je de noemer tot 15-49 jaar, dan wordt dat ${fmt1.format(target2025.geboorten_per_1000_15_49)}. Dat is de vergelijking "alle vrouwen vs vruchtbare vrouwen"; de TFR zelf is al leeftijdsspecifiek en komt uit op ${fmt2.format(target2025.tfr_benadering)}, goed voor een vervangingsratio van ${fmt2.format(target2025.vervangingsratio)} ten opzichte van 2,1.`;

	statList.innerHTML = [
		["Levendgeborenen", fmtInt.format(row.geboorten)],
		["Vrouwen, alle leeftijden", fmtInt.format(row.vrouwen_alles_avg)],
		["Vrouwen, 0-14 jaar", fmtInt.format(women0To14)],
		["Vrouwen, 15-49 jaar", fmtInt.format(row.vrouwen_15_49_avg)],
		["Per 1.000, alle leeftijden", fmt2.format(row.geboorten_per_1000_alles)],
		["Per 1.000, 15-49 jaar", fmt2.format(row.geboorten_per_1000_15_49)],
		["TFR-benadering", fmt2.format(row.tfr_benadering)],
		["Vervangingsratio", fmt2.format(row.vervangingsratio)],
	]
		.map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`)
		.join("");

	claimCards.innerHTML = [
		["Noemereffect", `${fmt2.format(row.ouderdomsfactor)}x`, `De 15-49-ratio is ${fmt2.format(row.ouderdomsfactor)} keer zo hoog als de ratio met alle leeftijden.`],
		["Vervangingsratio", fmt2.format(row.vervangingsratio), `TFR gedeeld door 2,1. Er ontbreken ongeveer ${fmtInt.format(row.extra_geboorten_voor_vervanging)} geboorten bij dit leeftijdspatroon.`],
		["Aandeel 15-49", `${fmt1.format(row.aandeel_15_49)}%`, "Dit deel van de vrouwelijke noemer zit in de vruchtbare leeftijdsband van de analyse."],
	]
		.map(([label, value, text]) => `<article class="claim-card"><span>${label}</span><strong>${value}</strong><p>${text}</p></article>`)
		.join("");
}

function renderTable() {
	const groupLabels = Object.fromEntries(data.groups.map((group) => [group.id, group.shortLabel]));
	tableBody.innerHTML = data.metrics
		.map(
			(row) => `
		<tr>
			<td>${row.year}</td>
			<td>${groupLabels[row.group]}</td>
			<td>${fmtInt.format(row.geboorten)}</td>
			<td>${fmtInt.format(row.vrouwen_alles_avg)}</td>
			<td>${fmtInt.format(row.vrouwen_15_49_avg)}</td>
			<td>${fmt2.format(row.geboorten_per_1000_alles)}</td>
			<td>${fmt2.format(row.geboorten_per_1000_15_49)}</td>
			<td>${fmt2.format(row.tfr_benadering)}</td>
			<td>${fmt2.format(row.vervangingsratio)}</td>
		</tr>`
		)
		.join("");
}

function render() {
	updateText();
	if (state.view === "rates") drawRates();
	if (state.view === "structure") drawStructure();
	if (state.view === "fertility") drawFertility();
	if (state.view === "replacement") drawReplacement();
}

function exportCsv() {
	const headers = ["jaar", "groep", "geboorten", "vrouwen_alles_avg", "vrouwen_15_49_avg", "geboorten_per_1000_alles", "geboorten_per_1000_15_49", "tfr_benadering", "vervangingsratio", "vervangingstekort", "extra_geboorten_voor_vervanging"];
	const lines = [headers.join(",")];
	for (const row of data.metrics) {
		lines.push(headers.map((key) => JSON.stringify(row[key] ?? "")).join(","));
	}
	const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = "geboortecijfers-nederlandse-herkomst.csv";
	anchor.click();
	URL.revokeObjectURL(url);
}

async function init() {
	data = await fetch("data.json").then((response) => response.json());
	state.year = Math.max(...data.years);
	yearRange.min = Math.min(...data.years);
	yearRange.max = Math.max(...data.years);
	yearRange.value = state.year;
	groupSelect.innerHTML = data.groups.map((group) => `<option value="${group.id}">${group.shortLabel}</option>`).join("");
	groupSelect.value = state.group;
	renderTable();
	render();

	groupSelect.addEventListener("change", () => {
		state.group = groupSelect.value;
		render();
	});
	yearRange.addEventListener("input", () => {
		state.year = Number(yearRange.value);
		render();
	});
	viewButtons.forEach((button) => {
		button.addEventListener("click", () => {
			state.view = button.dataset.view;
			viewButtons.forEach((item) => {
				const active = item === button;
				item.classList.toggle("is-active", active);
				item.setAttribute("aria-selected", String(active));
			});
			render();
		});
	});
	exportCsvButton.addEventListener("click", exportCsv);
	window.addEventListener("resize", render);
}

init();
