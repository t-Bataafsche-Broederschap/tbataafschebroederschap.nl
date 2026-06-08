/* global d3 */

const svg = d3.select("#municipalityMap");
const tooltip = document.querySelector("#tooltip");
const yearSlider = document.querySelector("#yearSlider");
const yearLabel = document.querySelector("#yearLabel");
const yearTicks = document.querySelector("#yearTicks");
const metricSelect = document.querySelector("#metricSelect");
const tableBody = document.querySelector("#tableBody");
const rowCount = document.querySelector("#rowCount");
const selectionLabel = document.querySelector("#selectionLabel");
const summaryStrip = document.querySelector("#summaryStrip");
const mapTitle = document.querySelector("#mapTitle");
const sortButtons = document.querySelectorAll("[data-sort]");

const numberFormat = new Intl.NumberFormat("nl-NL");
const percentFormat = new Intl.NumberFormat("nl-NL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

let data;
let state = {
	year: 2025,
	metricId: "buiten-europa-geboren-buiten-nl",
	selectedCode: null,
	sortKey: "percentage",
	sortDirection: "desc",
};

function formatNumber(value) {
	return Number.isFinite(value) ? numberFormat.format(value) : "-";
}

function formatPercent(value) {
	return Number.isFinite(value) ? `${percentFormat.format(value)}%` : "-";
}

function metricFor(row, year = state.year) {
	return row?.years?.[year] || {};
}

function activeMetric() {
	return data.metadata.metrics.find((metric) => metric.id === state.metricId) || data.metadata.metrics[0];
}

function activeMetricValue(row, year = state.year) {
	return metricFor(row, year).metrics?.[state.metricId] || {};
}

function rowsForYear() {
	return data.municipalities.filter((row) => Number.isFinite(activeMetricValue(row).percentage));
}

function compareRows(a, b) {
	const direction = state.sortDirection === "asc" ? 1 : -1;
	if (state.sortKey === "name") return a.name.localeCompare(b.name, "nl-NL") * direction;
	const aValue = state.sortKey === "totalPopulation" ? metricFor(a).totalPopulation : activeMetricValue(a)[state.sortKey];
	const bValue = state.sortKey === "totalPopulation" ? metricFor(b).totalPopulation : activeMetricValue(b)[state.sortKey];
	return ((aValue ?? -Infinity) - (bValue ?? -Infinity)) * direction;
}

function sortedRows() {
	return rowsForYear().sort(compareRows);
}

function rowByCode(code) {
	return data.municipalities.find((row) => row.code === code) || null;
}

function colorScale(rows = rowsForYear()) {
	const values = rows.map((row) => activeMetricValue(row).percentage).filter(Number.isFinite);
	const max =
		d3.quantile(
			values.sort((a, b) => a - b),
			0.98
		) ||
		d3.max(values) ||
		1;
	return d3.scaleSequential([0, max], d3.interpolateYlOrRd).clamp(true);
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
	const padding = 18;
	const bounds = coordinateBounds(featureCollection);
	const scale = Math.min((width - padding * 2) / (bounds.maxX - bounds.minX), (height - padding * 2) / (bounds.maxY - bounds.minY));
	const mapWidth = (bounds.maxX - bounds.minX) * scale;
	const mapHeight = (bounds.maxY - bounds.minY) * scale;
	const offsetX = (width - mapWidth) / 2;
	const offsetY = (height - mapHeight) / 2;

	return ([x, y]) => [offsetX + (x - bounds.minX) * scale, offsetY + (bounds.maxY - y) * scale];
}

function ringPath(ring, project) {
	const commands = ring
		.map((point, index) => {
			const [x, y] = project(point);
			return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
		})
		.join("");
	return `${commands}Z`;
}

function geometryPath(geometry, project) {
	const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
	return polygons.map((polygon) => polygon.map((ring) => ringPath(ring, project)).join("")).join("");
}

function setSelected(code, { scroll = false } = {}) {
	state.selectedCode = code;
	const row = rowByCode(code);
	selectionLabel.textContent = row ? `${row.name}: ${formatPercent(activeMetricValue(row).percentage)}` : "Geen gemeente geselecteerd";
	renderMap();
	renderTable();
	if (scroll && code) {
		document.querySelector(`[data-row-code="${code}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
	}
}

function moveTooltip(event) {
	const rect = tooltip.parentElement.getBoundingClientRect();
	tooltip.style.left = `${event.clientX - rect.left + 14}px`;
	tooltip.style.top = `${event.clientY - rect.top + 14}px`;
}

function showTooltip(event, row) {
	const metric = activeMetricValue(row);
	tooltip.hidden = false;
	tooltip.innerHTML = `
		<strong>${row.name}</strong>
		<span>${activeMetric().shortLabel}</span>
		<span>${state.year}: ${formatPercent(metric.percentage)}</span>
		<span>Aantal: ${formatNumber(metric.count)}</span>
		<span>Bevolking: ${formatNumber(metricFor(row).totalPopulation)}</span>
	`;
	moveTooltip(event);
}

function hideTooltip() {
	tooltip.hidden = true;
}

function renderSummary() {
	const rows = rowsForYear();
	const totalPopulation = d3.sum(rows, (row) => metricFor(row).totalPopulation || 0);
	const totalCount = d3.sum(rows, (row) => activeMetricValue(row).count || 0);
	const top = rows.reduce((best, row) => (activeMetricValue(row).percentage > activeMetricValue(best).percentage ? row : best), rows[0]);
	summaryStrip.replaceChildren();

	const items = [
		["Gemeenten", formatNumber(rows.length)],
		["Totaal aantal", formatNumber(totalCount)],
		["Aandeel", formatPercent((totalCount / totalPopulation) * 100)],
		["Hoogste", top ? `${top.name} (${formatPercent(activeMetricValue(top).percentage)})` : "-"],
	];

	for (const [label, value] of items) {
		const item = document.createElement("div");
		item.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
		summaryStrip.append(item);
	}
}

function renderMap() {
	mapTitle.textContent = activeMetric().label;
	const wrap = document.querySelector(".map-wrap");
	const width = Math.max(320, Math.floor(wrap.getBoundingClientRect().width));
	const height = window.matchMedia("(max-width: 760px)").matches ? 560 : 720;
	const rows = rowsForYear();
	const byCode = new Map(rows.map((row) => [row.code, row]));
	const color = colorScale(rows);
	const project = rdProjector(data.geojson, width, height);

	svg.attr("viewBox", `0 0 ${width} ${height}`).attr("width", width).attr("height", height);
	svg.selectAll("*").remove();

	const g = svg.append("g");
	g.selectAll("path")
		.data(data.geojson.features, (feature) => feature.properties.code)
		.join("path")
		.attr("class", (feature) => `municipality ${feature.properties.code === state.selectedCode ? "is-selected" : ""}`)
		.attr("d", (feature) => geometryPath(feature.geometry, project))
		.attr("fill", (feature) => {
			const row = byCode.get(feature.properties.code);
			const value = activeMetricValue(row).percentage;
			return Number.isFinite(value) ? color(value) : "#ddd7cd";
		})
		.on("mouseenter", (event, feature) => {
			const row = byCode.get(feature.properties.code);
			if (row) showTooltip(event, row);
		})
		.on("mousemove", moveTooltip)
		.on("mouseleave", hideTooltip)
		.on("click", (event, feature) => {
			event.stopPropagation();
			setSelected(feature.properties.code, { scroll: true });
		})
		.append("title")
		.text((feature) => {
			const row = byCode.get(feature.properties.code);
			return row ? `${row.name}: ${formatPercent(activeMetricValue(row).percentage)}` : feature.properties.name;
		});

	const legendWidth = Math.min(300, width - 44);
	const legendX = 22;
	const legendY = height - 36;
	const defs = svg.append("defs");
	const gradient = defs.append("linearGradient").attr("id", "migrationLegend").attr("x1", "0%").attr("x2", "100%");
	d3.range(0, 1.01, 0.1).forEach((step) => {
		gradient
			.append("stop")
			.attr("offset", `${step * 100}%`)
			.attr("stop-color", color(color.domain()[1] * step));
	});
	svg.append("rect").attr("class", "legend-bar").attr("x", legendX).attr("y", legendY).attr("width", legendWidth).attr("height", 10).attr("fill", "url(#migrationLegend)");
	svg
		.append("text")
		.attr("class", "legend-text")
		.attr("x", legendX)
		.attr("y", legendY - 7)
		.text("Percentage");
	svg
		.append("text")
		.attr("class", "legend-text")
		.attr("x", legendX)
		.attr("y", legendY + 28)
		.text("0%");
	svg
		.append("text")
		.attr("class", "legend-text")
		.attr("x", legendX + legendWidth)
		.attr("y", legendY + 28)
		.attr("text-anchor", "end")
		.text(formatPercent(color.domain()[1]));
}

function renderTable() {
	const rows = sortedRows();
	rowCount.textContent = `${formatNumber(rows.length)} gemeenten, ${state.year}`;
	tableBody.replaceChildren();

	for (const row of rows) {
		const metric = activeMetricValue(row);
		const tr = document.createElement("tr");
		tr.dataset.rowCode = row.code;
		if (row.code === state.selectedCode) tr.classList.add("is-selected");
		tr.innerHTML = `
			<td><strong>${row.name}</strong><span>${row.code}</span></td>
			<td>${formatPercent(metric.percentage)}</td>
			<td>${formatNumber(metric.count)}</td>
			<td>${formatNumber(metricFor(row).totalPopulation)}</td>
		`;
		tr.addEventListener("click", () => setSelected(row.code));
		tableBody.append(tr);
	}

	for (const button of sortButtons) {
		const active = button.dataset.sort === state.sortKey;
		button.classList.toggle("is-active", active);
		button.textContent = button.textContent.replace(/\s+[▲▼]$/, "");
		if (active) button.textContent += state.sortDirection === "asc" ? " ▲" : " ▼";
	}
}

function setSort(key) {
	if (state.sortKey === key) {
		state.sortDirection = state.sortDirection === "asc" ? "desc" : "asc";
	} else {
		state.sortKey = key;
		state.sortDirection = key === "name" ? "asc" : "desc";
	}
	renderTable();
}

function render() {
	renderSummary();
	renderMap();
	renderTable();
}

async function init() {
	const response = await fetch("data.json");
	if (!response.ok) throw new Error(`data.json kon niet worden geladen: ${response.status}`);
	data = await response.json();
	const years = data.metadata.periods.map((period) => period.year);
	state.year = Math.max(...years);
	state.metricId = data.metadata.defaultMetric || data.metadata.metrics[0].id;

	yearSlider.min = Math.min(...years);
	yearSlider.max = Math.max(...years);
	yearSlider.value = state.year;
	yearLabel.textContent = state.year;
	yearTicks.replaceChildren(
		...years.map((year) => {
			const tick = document.createElement("span");
			tick.textContent = year;
			return tick;
		})
	);
	metricSelect.replaceChildren(
		...data.metadata.metrics.map((metric) => {
			const option = document.createElement("option");
			option.value = metric.id;
			option.textContent = metric.shortLabel;
			return option;
		})
	);
	metricSelect.value = state.metricId;

	yearSlider.addEventListener("input", () => {
		state.year = Number(yearSlider.value);
		yearLabel.textContent = state.year;
		if (state.selectedCode && !Number.isFinite(activeMetricValue(rowByCode(state.selectedCode)).percentage)) state.selectedCode = null;
		render();
	});
	metricSelect.addEventListener("change", () => {
		state.metricId = metricSelect.value;
		if (state.selectedCode && !Number.isFinite(activeMetricValue(rowByCode(state.selectedCode)).percentage)) state.selectedCode = null;
		render();
	});
	sortButtons.forEach((button) => button.addEventListener("click", () => setSort(button.dataset.sort)));
	window.addEventListener("resize", () => renderMap());
	render();
}

init().catch((error) => {
	tableBody.innerHTML = `<tr><td colspan="4">De data kon niet worden geladen: ${error.message}</td></tr>`;
});
