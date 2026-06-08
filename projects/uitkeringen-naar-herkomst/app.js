/* global d3 */

const trendSvg = d3.select("#trendChart");
const scatterSvg = d3.select("#scatterChart");
const mapSvg = d3.select("#regionMap");
const tooltip = document.querySelector("#tooltip");

const periodRange = document.querySelector("#periodRange");
const periodLabelElement = document.querySelector("#periodLabel");
const topicSelect = document.querySelector("#topicSelect");
const ageSelect = document.querySelector("#ageSelect");
const sexSelect = document.querySelector("#sexSelect");
const parentsSelect = document.querySelector("#parentsSelect");
const summaryStrip = document.querySelector("#summaryStrip");
const detailTitle = document.querySelector("#detailTitle");
const detailStats = document.querySelector("#detailStats");
const rankingList = document.querySelector("#rankingList");
const regionSelection = document.querySelector("#regionSelection");
const regionTable = document.querySelector("#regionTable");
const exportCsvButton = document.querySelector("#exportCsv");

const numberFormat = new Intl.NumberFormat("nl-NL");
const decimalFormat = new Intl.NumberFormat("nl-NL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const ratioFormat = new Intl.NumberFormat("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

let data;
let selectedOrigin = "1012600";
let selectedRegion = null;
let selectedPeriod = null;

function formatNumber(value) {
	return Number.isFinite(value) ? numberFormat.format(value) : "-";
}

function formatDecimal(value) {
	return Number.isFinite(value) ? decimalFormat.format(value) : "-";
}

function formatRatio(value) {
	return Number.isFinite(value) ? `${ratioFormat.format(value)}x` : "-";
}

function labelFor(options, key) {
	return options.find((option) => option.key === key)?.label || key;
}

function topicLabel() {
	return labelFor(data.national.dimensions.topics, topicSelect.value);
}

function periodLabel(period) {
	return data.national.periods.find((row) => row.key === period)?.title || period;
}

function periodIndex(period) {
	return Math.max(
		0,
		data.national.periods.findIndex((row) => row.key === period)
	);
}

function setSelectedPeriod(period) {
	selectedPeriod = period;
	periodRange.value = String(periodIndex(period));
	periodLabelElement.textContent = periodLabel(period);
}

function option(parent, option) {
	const element = document.createElement("option");
	element.value = option.key;
	element.textContent = option.label;
	parent.append(element);
}

function populateSelects() {
	for (const topic of data.national.dimensions.topics) option(topicSelect, topic);
	for (const age of data.national.dimensions.ages) option(ageSelect, age);
	for (const sex of data.national.dimensions.sexes) option(sexSelect, sex);
	for (const parents of data.national.dimensions.parents) option(parentsSelect, parents);

	periodRange.min = "0";
	periodRange.max = String(data.national.periods.length - 1);
	periodRange.step = "1";
	setSelectedPeriod(data.national.defaults.period);
	topicSelect.value = data.national.defaults.topic;
	ageSelect.value = data.national.defaults.age;
	sexSelect.value = data.national.defaults.sex;
	parentsSelect.value = data.national.defaults.parents;
	selectedOrigin = data.national.defaults.referenceOrigin;
}

function filteredRecords({ period = null, origin = null } = {}) {
	return data.national.records.filter((row) => {
		if (period && row.period !== period) return false;
		if (origin && row.origin !== origin) return false;
		return row.sex === sexSelect.value && row.age === ageSelect.value && row.parents === parentsSelect.value;
	});
}

function latestRows() {
	return filteredRecords({ period: selectedPeriod })
		.filter((row) => row.values[topicSelect.value]?.recipients !== null && row.population > 0)
		.sort((a, b) => (b.values[topicSelect.value].per1000 ?? -Infinity) - (a.values[topicSelect.value].per1000 ?? -Infinity));
}

function originLabel(key) {
	return labelFor(data.national.dimensions.origins, key);
}

function referenceRecord(period = selectedPeriod) {
	return data.national.records.find((row) => row.period === period && row.sex === sexSelect.value && row.age === ageSelect.value && row.origin === data.national.defaults.referenceOrigin && row.parents === data.national.defaults.referenceParents);
}

function selectedRecord(period = selectedPeriod) {
	const sameFilter = data.national.records.find((row) => row.period === period && row.sex === sexSelect.value && row.age === ageSelect.value && row.parents === parentsSelect.value && row.origin === selectedOrigin);
	return sameFilter || data.national.records.find((row) => row.period === period && row.sex === sexSelect.value && row.age === ageSelect.value && row.origin === selectedOrigin);
}

function valueFor(row) {
	return row?.values?.[topicSelect.value] || {};
}

function ratioToReference(row, period = row?.period) {
	const ref = referenceRecord(period);
	const value = valueFor(row).per1000;
	const refValue = valueFor(ref).per1000;
	return Number.isFinite(value) && Number.isFinite(refValue) && refValue > 0 ? value / refValue : null;
}

function rowShare(row) {
	const total = data.national.records.find((candidate) => candidate.period === row.period && candidate.sex === row.sex && candidate.age === row.age && candidate.parents === row.parents && candidate.origin === data.national.defaults.totalOrigin);
	const value = valueFor(row).recipients;
	const totalValue = valueFor(total).recipients;
	return Number.isFinite(value) && Number.isFinite(totalValue) && totalValue > 0 ? (value / totalValue) * 100 : null;
}

function moveTooltip(event) {
	const rect = tooltip.parentElement.getBoundingClientRect();
	tooltip.style.left = `${event.clientX - rect.left + 14}px`;
	tooltip.style.top = `${event.clientY - rect.top + 14}px`;
}

function showTooltip(event, html) {
	tooltip.hidden = false;
	tooltip.innerHTML = html;
	moveTooltip(event);
}

function hideTooltip() {
	tooltip.hidden = true;
}

function renderSummary() {
	const row = selectedRecord();
	const ref = referenceRecord();
	const value = valueFor(row);
	const refValue = valueFor(ref);
	const items = [
		["Selectie", originLabel(row?.origin || selectedOrigin)],
		["Ontvangers", formatNumber(value.recipients)],
		["Per 1.000", formatDecimal(value.per1000)],
		["T.o.v. referentie", formatRatio(ratioToReference(row))],
		["Referentie", formatDecimal(refValue.per1000)],
	];
	summaryStrip.replaceChildren(
		...items.map(([label, valueText]) => {
			const item = document.createElement("div");
			item.innerHTML = `<span>${label}</span><strong>${valueText}</strong>`;
			return item;
		})
	);
}

function renderDetails() {
	const row = selectedRecord();
	const value = valueFor(row);
	detailTitle.textContent = originLabel(row?.origin || selectedOrigin);
	const rows = [
		["Periode", periodLabel(selectedPeriod)],
		["Uitkeringstype", topicLabel()],
		["Ontvangers", formatNumber(value.recipients)],
		["Bevolking", formatNumber(row?.population)],
		["Per 1.000 inwoners", formatDecimal(value.per1000)],
		["Ratio t.o.v. referentie", formatRatio(ratioToReference(row))],
		["Aandeel in totaal", Number.isFinite(rowShare(row)) ? `${formatDecimal(rowShare(row))}%` : "-"],
		["Leeftijd", labelFor(data.national.dimensions.ages, ageSelect.value)],
		["Geslacht", labelFor(data.national.dimensions.sexes, sexSelect.value)],
		["Ouderfilter", labelFor(data.national.dimensions.parents, parentsSelect.value)],
	];
	detailStats.replaceChildren(
		...rows.map(([label, valueText]) => {
			const item = document.createElement("div");
			item.innerHTML = `<span>${label}</span><strong>${valueText}</strong>`;
			return item;
		})
	);
}

function renderRanking() {
	const rows = latestRows();
	rankingList.replaceChildren(
		...rows.map((row) => {
			const button = document.createElement("button");
			button.type = "button";
			button.className = row.origin === selectedOrigin ? "active" : "";
			button.innerHTML = `<span>${originLabel(row.origin)}</span><strong>${formatDecimal(valueFor(row).per1000)} per 1.000</strong><small>${formatNumber(valueFor(row).recipients)} ontvangers · ${formatRatio(ratioToReference(row))}</small>`;
			button.addEventListener("click", () => {
				selectedOrigin = row.origin;
				renderAll();
			});
			return button;
		})
	);
}

function trendSeries() {
	const importantOrigins = new Set([data.national.defaults.totalOrigin, data.national.defaults.referenceOrigin, "H007933", "H008859", selectedOrigin]);
	const records = data.national.records.filter((row) => row.sex === sexSelect.value && row.age === ageSelect.value && row.parents === parentsSelect.value && importantOrigins.has(row.origin));
	const byOrigin = d3.group(records, (row) => row.origin);
	return [...byOrigin].map(([origin, rows]) => ({
		origin,
		label: originLabel(origin),
		values: rows
			.map((row) => ({ date: new Date(row.date), period: row.period, value: valueFor(row).per1000, recipients: valueFor(row).recipients }))
			.filter((row) => Number.isFinite(row.value))
			.sort((a, b) => a.date - b.date),
	}));
}

function renderTrend() {
	const wrap = document.querySelector(".chart-wrap");
	const width = Math.max(320, Math.floor(wrap.getBoundingClientRect().width));
	const height = window.matchMedia("(max-width: 760px)").matches ? 430 : 500;
	const margin = { top: 24, right: 22, bottom: 54, left: 62 };
	const innerWidth = width - margin.left - margin.right;
	const innerHeight = height - margin.top - margin.bottom;
	const series = trendSeries().filter((row) => row.values.length);
	const color = d3
		.scaleOrdinal()
		.domain(series.map((row) => row.origin))
		.range(["#264653", "#2a9d8f", "#e76f51", "#8f5b2d", "#5c6bc0"]);

	trendSvg.attr("viewBox", `0 0 ${width} ${height}`).attr("width", width).attr("height", height);
	trendSvg.selectAll("*").remove();

	const x = d3
		.scaleTime()
		.domain(
			d3.extent(
				series.flatMap((row) => row.values),
				(row) => row.date
			)
		)
		.range([0, innerWidth]);
	const y = d3
		.scaleLinear()
		.domain([
			0,
			d3.max(
				series.flatMap((row) => row.values),
				(row) => row.value
			) * 1.12 || 1,
		])
		.range([innerHeight, 0])
		.nice();
	const g = trendSvg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

	g.append("g").attr("class", "grid").call(d3.axisLeft(y).ticks(6).tickSize(-innerWidth).tickFormat(""));
	g.append("g")
		.attr("class", "axis")
		.attr("transform", `translate(0,${innerHeight})`)
		.call(d3.axisBottom(x).ticks(6).tickFormat(d3.timeFormat("%Y")));
	g.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(6));
	g.append("text")
		.attr("class", "axis-label")
		.attr("x", innerWidth / 2)
		.attr("y", innerHeight + 42)
		.attr("text-anchor", "middle")
		.text("Periode");
	g.append("text")
		.attr("class", "axis-label")
		.attr("transform", "rotate(-90)")
		.attr("x", -innerHeight / 2)
		.attr("y", -46)
		.attr("text-anchor", "middle")
		.text("Ontvangers per 1.000 inwoners");

	const line = d3
		.line()
		.x((row) => x(row.date))
		.y((row) => y(row.value));

	g.selectAll("path.series")
		.data(series)
		.join("path")
		.attr("class", (row) => `series ${row.origin === selectedOrigin ? "is-selected" : ""}`)
		.attr("fill", "none")
		.attr("stroke", (row) => color(row.origin))
		.attr("stroke-width", (row) => (row.origin === selectedOrigin ? 3.4 : 2.1))
		.attr("d", (row) => line(row.values));

	g.selectAll("circle.point")
		.data(series.flatMap((lineRow) => lineRow.values.map((point) => ({ ...point, origin: lineRow.origin, label: lineRow.label }))))
		.join("circle")
		.attr("class", "point")
		.attr("r", (row) => (row.period === selectedPeriod && row.origin === selectedOrigin ? 5 : 3.2))
		.attr("cx", (row) => x(row.date))
		.attr("cy", (row) => y(row.value))
		.attr("fill", (row) => color(row.origin))
		.on("mouseenter", (event, row) => {
			showTooltip(event, `<strong>${row.label}</strong><span>${periodLabel(row.period)}</span><span>${formatDecimal(row.value)} per 1.000 inwoners</span><span>${formatNumber(row.recipients)} ontvangers</span>`);
		})
		.on("mousemove", moveTooltip)
		.on("mouseleave", hideTooltip)
		.on("click", (event, row) => {
			selectedOrigin = row.origin;
			setSelectedPeriod(row.period);
			renderAll();
		});

	const legend = g.append("g").attr("class", "chart-legend").attr("transform", "translate(8,8)");
	series.forEach((row, index) => {
		const item = legend.append("g").attr("transform", `translate(0,${index * 20})`);
		item.append("rect").attr("width", 10).attr("height", 10).attr("rx", 2).attr("fill", color(row.origin));
		item.append("text").attr("x", 16).attr("y", 9).text(row.label);
	});
}

function renderScatter() {
	const rows = latestRows();
	const wrap = document.querySelector(".scatter-panel .chart-wrap");
	const width = Math.max(320, Math.floor(wrap.getBoundingClientRect().width));
	const height = 380;
	const margin = { top: 22, right: 22, bottom: 58, left: 64 };
	const innerWidth = width - margin.left - margin.right;
	const innerHeight = height - margin.top - margin.bottom;

	scatterSvg.attr("viewBox", `0 0 ${width} ${height}`).attr("width", width).attr("height", height);
	scatterSvg.selectAll("*").remove();

	const x = d3
		.scaleLog()
		.domain([Math.max(1, d3.min(rows, (row) => valueFor(row).recipients) * 0.7 || 1), d3.max(rows, (row) => valueFor(row).recipients) * 1.3 || 10])
		.range([0, innerWidth])
		.nice();
	const y = d3
		.scaleLinear()
		.domain([0, d3.max(rows, (row) => valueFor(row).per1000) * 1.14 || 1])
		.range([innerHeight, 0])
		.nice();
	const g = scatterSvg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
	g.append("g").attr("class", "grid").call(d3.axisLeft(y).ticks(5).tickSize(-innerWidth).tickFormat(""));
	g.append("g").attr("class", "axis").attr("transform", `translate(0,${innerHeight})`).call(d3.axisBottom(x).ticks(4, "~s"));
	g.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(5));
	g.append("text")
		.attr("class", "axis-label")
		.attr("x", innerWidth / 2)
		.attr("y", innerHeight + 44)
		.attr("text-anchor", "middle")
		.text("Ontvangers (log)");
	g.append("text")
		.attr("class", "axis-label")
		.attr("transform", "rotate(-90)")
		.attr("x", -innerHeight / 2)
		.attr("y", -48)
		.attr("text-anchor", "middle")
		.text("Per 1.000 inwoners");

	g.selectAll("circle")
		.data(rows)
		.join("circle")
		.attr("class", (row) => `scatter-dot ${row.origin === selectedOrigin ? "is-selected" : ""}`)
		.attr("r", (row) => (row.origin === selectedOrigin ? 7 : 5.2))
		.attr("cx", (row) => x(valueFor(row).recipients))
		.attr("cy", (row) => y(valueFor(row).per1000))
		.on("mouseenter", (event, row) => {
			showTooltip(event, `<strong>${originLabel(row.origin)}</strong><span>${formatNumber(valueFor(row).recipients)} ontvangers</span><span>${formatDecimal(valueFor(row).per1000)} per 1.000</span><span>${formatRatio(ratioToReference(row))} t.o.v. referentie</span>`);
		})
		.on("mousemove", moveTooltip)
		.on("mouseleave", hideTooltip)
		.on("click", (event, row) => {
			selectedOrigin = row.origin;
			renderAll();
		});

	g.selectAll("text.dot-label")
		.data(rows.filter((row) => row.origin === selectedOrigin || row.origin === data.national.defaults.referenceOrigin || row.origin === "H008859" || row.origin === "H007933"))
		.join("text")
		.attr("class", "dot-label")
		.attr("x", (row) => x(valueFor(row).recipients) + 8)
		.attr("y", (row) => y(valueFor(row).per1000) - 7)
		.text((row) => originLabel(row.origin));
}

function coordinateBounds(featureCollection) {
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	function visit(coordinates) {
		if (typeof coordinates[0] === "number") {
			const [x, y] = coordinates;
			minX = Math.min(minX, x);
			minY = Math.min(minY, y);
			maxX = Math.max(maxX, x);
			maxY = Math.max(maxY, y);
			return;
		}
		coordinates.forEach(visit);
	}
	featureCollection.features.forEach((feature) => visit(feature.geometry.coordinates));
	return { minX, minY, maxX, maxY };
}

function rdProjector(featureCollection, width, height) {
	const padding = 16;
	const bounds = coordinateBounds(featureCollection);
	const scale = Math.min((width - padding * 2) / (bounds.maxX - bounds.minX), (height - padding * 2) / (bounds.maxY - bounds.minY));
	const mapWidth = (bounds.maxX - bounds.minX) * scale;
	const mapHeight = (bounds.maxY - bounds.minY) * scale;
	const offsetX = (width - mapWidth) / 2;
	const offsetY = (height - mapHeight) / 2;
	return ([x, y]) => [offsetX + (x - bounds.minX) * scale, offsetY + (bounds.maxY - y) * scale];
}

function ringPath(ring, project) {
	return `${ring
		.map((point, index) => {
			const [x, y] = project(point);
			return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
		})
		.join("")}Z`;
}

function geometryPath(geometry, project) {
	const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
	return polygons.map((polygon) => polygon.map((ring) => ringPath(ring, project)).join("")).join("");
}

function regionalRows() {
	return data.regional.values.filter((row) => row.values[topicSelect.value] !== null);
}

function renderMap() {
	const rows = regionalRows();
	const municipalities = rows.filter((row) => row.level === "Gemeente");
	const byCode = new Map(municipalities.map((row) => [row.code, row]));
	const values = municipalities
		.map((row) => row.values[topicSelect.value])
		.filter(Number.isFinite)
		.sort((a, b) => a - b);
	const max = d3.quantile(values, 0.98) || d3.max(values) || 1;
	const color = d3.scaleSequential([0, max], d3.interpolateYlGnBu).clamp(true);
	const wrap = document.querySelector(".map-wrap");
	const width = Math.max(320, Math.floor(wrap.getBoundingClientRect().width));
	const height = window.matchMedia("(max-width: 760px)").matches ? 500 : 620;
	const project = rdProjector(data.regional.geojson, width, height);

	mapSvg.attr("viewBox", `0 0 ${width} ${height}`).attr("width", width).attr("height", height);
	mapSvg.selectAll("*").remove();
	mapSvg
		.append("g")
		.selectAll("path")
		.data(data.regional.geojson.features, (feature) => feature.properties.code)
		.join("path")
		.attr("class", (feature) => `municipality ${feature.properties.code === selectedRegion ? "is-selected" : ""}`)
		.attr("d", (feature) => geometryPath(feature.geometry, project))
		.attr("fill", (feature) => {
			const row = byCode.get(feature.properties.code);
			return row ? color(row.values[topicSelect.value]) : "#ddd";
		})
		.on("mouseenter", (event, feature) => {
			const row = byCode.get(feature.properties.code);
			if (row) showTooltip(event, `<strong>${row.name}</strong><span>${topicLabel()}: ${formatNumber(row.values[topicSelect.value])}</span><small>${data.regional.period.title}, geen herkomstuitsplitsing</small>`);
		})
		.on("mousemove", moveTooltip)
		.on("mouseleave", hideTooltip)
		.on("click", (event, feature) => {
			selectedRegion = feature.properties.code;
			renderRegionalTable();
			renderMap();
		});
}

function renderRegionalTable() {
	const rows = regionalRows()
		.filter((row) => row.level !== "Nederland")
		.sort((a, b) => (b.values[topicSelect.value] ?? -Infinity) - (a.values[topicSelect.value] ?? -Infinity))
		.slice(0, 60);
	const selected = selectedRegion ? data.regional.values.find((row) => row.code === selectedRegion) : null;
	regionSelection.textContent = selected ? `${selected.name}: ${formatNumber(selected.values[topicSelect.value])}` : `Laatste regionale periode: ${data.regional.period.title}`;
	regionTable.replaceChildren(
		...rows.map((row) => {
			const tr = document.createElement("tr");
			tr.className = row.code === selectedRegion ? "active" : "";
			tr.dataset.region = row.code;
			tr.innerHTML = `<td>${row.name}</td><td>${row.level}</td><td>${formatNumber(row.values[topicSelect.value])}</td>`;
			tr.addEventListener("click", () => {
				selectedRegion = row.code;
				renderRegionalTable();
				renderMap();
			});
			return tr;
		})
	);
}

function exportCsv() {
	const rows = latestRows();
	const header = ["periode", "uitkeringstype", "herkomst", "ontvangers", "bevolking", "per_1000", "ratio_referentie"].join(",");
	const body = rows.map((row) => [selectedPeriod, JSON.stringify(topicLabel()), JSON.stringify(originLabel(row.origin)), valueFor(row).recipients ?? "", row.population ?? "", valueFor(row).per1000 ?? "", ratioToReference(row) ?? ""].join(",")).join("\n");
	const blob = new Blob([`${header}\n${body}\n`], { type: "text/csv;charset=utf-8" });
	const link = document.createElement("a");
	link.href = URL.createObjectURL(blob);
	link.download = `uitkeringen-naar-herkomst-${selectedPeriod}.csv`;
	link.click();
	URL.revokeObjectURL(link.href);
}

function renderAll() {
	if (!selectedRecord()) selectedOrigin = data.national.defaults.referenceOrigin;
	renderSummary();
	renderDetails();
	renderRanking();
	renderTrend();
	renderScatter();
	renderMap();
	renderRegionalTable();
}

async function init() {
	data = await fetch("data.json").then((response) => {
		if (!response.ok) throw new Error(`Kon data.json niet laden: ${response.status}`);
		return response.json();
	});
	populateSelects();
	periodRange.addEventListener("input", () => {
		const period = data.national.periods[Number(periodRange.value)]?.key || data.national.defaults.period;
		setSelectedPeriod(period);
		renderAll();
	});
	[topicSelect, ageSelect, sexSelect, parentsSelect].forEach((select) => select.addEventListener("change", renderAll));
	exportCsvButton.addEventListener("click", exportCsv);
	window.addEventListener("resize", () => {
		renderTrend();
		renderScatter();
		renderMap();
	});
	renderAll();
}

init().catch((error) => {
	console.error(error);
	document.querySelector(".benefits-dashboard").innerHTML = `<section class="panel"><h2>Data kon niet geladen worden</h2><p>${error.message}</p></section>`;
});
