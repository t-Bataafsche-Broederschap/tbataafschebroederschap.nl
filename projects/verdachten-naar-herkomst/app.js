/* global d3 */

const svg = d3.select("#scatterChart");
const tooltip = document.querySelector("#tooltip");
const searchInput = document.querySelector("#searchInput");
const labelToggle = document.querySelector("#labelToggle");
const aggregateToggle = document.querySelector("#aggregateToggle");
const xScaleInputs = document.querySelectorAll('input[name="xScale"]');
const exportButton = document.querySelector("#exportCsv");
const resetZoomButton = document.querySelector("#resetZoom");
const selectedTitle = document.querySelector("#selectedTitle");
const selectedStats = document.querySelector("#selectedStats");
const currentSummary = document.querySelector("#currentSummary");
const pointCount = document.querySelector("#pointCount");
const quartileLabel = document.querySelector("#quartileLabel");

let data;
let selectedKey = null;
let zoomTransform = d3.zoomIdentity;

const numberFormat = new Intl.NumberFormat("nl-NL");
const perFormat = new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 0 });
const ratioFormat = new Intl.NumberFormat("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const percentFormat = new Intl.NumberFormat("nl-NL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const sharePercentFormat = new Intl.NumberFormat("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function formatNumber(value) {
	return Number.isFinite(value) ? numberFormat.format(value) : "-";
}

function formatPer(value) {
	return Number.isFinite(value) ? perFormat.format(value) : "-";
}

function dutchBackgroundRate() {
	return data?.legacy2022.points.find((point) => point.label === "Nederlandse achtergrond")?.suspectsPer10000 || null;
}

function totalPoint() {
	return data?.legacy2022.points.find((point) => point.label === "Totaal") || null;
}

function formatRatioOfDutchBackground(value) {
	const baseline = dutchBackgroundRate();
	return Number.isFinite(value) && Number.isFinite(baseline) && baseline > 0 ? `${ratioFormat.format(value / baseline)}x` : "";
}

function formatPercent(value) {
	return Number.isFinite(value) ? `${percentFormat.format(value)}%` : "-";
}

function formatSharePercent(value) {
	return Number.isFinite(value) ? `${sharePercentFormat.format(value)}%` : "-";
}

function formatChance(value) {
	if (!Number.isFinite(value) || value <= 0) return "-";
	const percentage = value / 100;
	const oneIn = Math.round(10000 / value);
	return `${ratioFormat.format(percentage)}% / 1 op ${formatNumber(oneIn)}`;
}

function shareOfTotalSuspects(point) {
	const total = totalPoint()?.totalSuspects;
	return Number.isFinite(point?.totalSuspects) && Number.isFinite(total) && total > 0 ? (point.totalSuspects / total) * 100 : null;
}

function shareOfTotalPopulation(point) {
	const total = totalPoint()?.populationEstimate;
	return Number.isFinite(point?.populationEstimate) && Number.isFinite(total) && total > 0 ? (point.populationEstimate / total) * 100 : null;
}

function suspectPopulationShareRatio(point) {
	const suspectShare = shareOfTotalSuspects(point);
	const populationShare = shareOfTotalPopulation(point);
	return Number.isFinite(suspectShare) && Number.isFinite(populationShare) && populationShare > 0 ? suspectShare / populationShare : null;
}

function isSmallScreen() {
	return window.matchMedia("(max-width: 760px)").matches;
}

function selectedXScale() {
	return document.querySelector('input[name="xScale"]:checked')?.value === "linear" ? "linear" : "log";
}

function visiblePoints() {
	const query = searchInput.value.trim().toLowerCase();
	return data.legacy2022.points.filter((point) => {
		if (!aggregateToggle.checked && point.isAggregate) return false;
		if (!query) return true;
		return point.label.toLowerCase().includes(query);
	});
}

function rowsForStats(point) {
	if (!point) {
		return [
			["Totaal verdachten", "-"],
			["Met woonadres in Nederland", "-"],
			["Per 10.000 inwoners", "-"],
			["Bron", "-"],
		];
	}
	return [
		["Totaal verdachten", formatNumber(point.totalSuspects)],
		["Met woonadres in Nederland", formatNumber(point.suspectsWithDutchAddress)],
		["Bevolking groep", `ca. ${formatNumber(point.populationEstimate)}`],
		["Aandeel alle verdachten", formatSharePercent(shareOfTotalSuspects(point))],
		["Aandeel bevolking", formatSharePercent(shareOfTotalPopulation(point))],
		["Verdachten/bevolking", Number.isFinite(suspectPopulationShareRatio(point)) ? `${ratioFormat.format(suspectPopulationShareRatio(point))}x` : "-"],
		["Per 10.000 inwoners", formatPer(point.suspectsPer10000)],
		["Aandeel totaal", formatChance(point.populationEstimate > 0 ? (point.totalSuspects / point.populationEstimate) * 10000 : null)],
		["Aandeel met Nederlands adres", formatChance(point.suspectsPer10000)],
		["Type", point.isAggregate ? "Aggregaat" : "Land / herkomst"],
		["Bron", `${point.source}, ${point.year}`],
	];
}

function renderSelected(point) {
	selectedTitle.textContent = point ? point.label : "Geen selectie";
	selectedStats.replaceChildren(
		...rowsForStats(point).map(([label, value]) => {
			const item = document.createElement("div");
			const term = document.createElement("span");
			const definition = document.createElement("strong");
			term.textContent = label;
			definition.textContent = value;
			item.append(term, definition);
			return item;
		})
	);
}

function renderCurrentSummary() {
	const latestYear = d3.max(data.currentSeries.periods, (period) => period.year);
	const latestRows = data.currentSeries.series.filter((row) => row.year === latestYear);
	const totals = latestRows.find((row) => row.label === "Totaal");
	const rows = latestRows.filter((row) => row.label !== "Totaal").sort((a, b) => b.totalSuspects - a.totalSuspects);
	const period = data.currentSeries.periods.find((row) => row.year === latestYear);

	currentSummary.replaceChildren();

	const intro = document.createElement("p");
	intro.textContent = `85658NED gebruikt de nieuwe CBS-herkomstindeling. Laatste jaar: ${latestYear}${period?.status ? ` (${period.status.toLowerCase()})` : ""}.`;
	currentSummary.append(intro);

	if (totals) {
		const total = document.createElement("div");
		total.className = "current-total";
		total.innerHTML = `<span>Totaal ${latestYear}</span><strong>${formatNumber(totals.totalSuspects)}</strong><small>${formatPer(totals.suspectsPer10000)} per 10.000 inwoners</small>`;
		currentSummary.append(total);
	}

	const list = document.createElement("ol");
	for (const row of rows.slice(0, 6)) {
		const item = document.createElement("li");
		item.innerHTML = `<span>${row.label}</span><strong>${formatNumber(row.totalSuspects)}</strong><small>${formatPer(row.suspectsPer10000)} per 10.000</small>`;
		list.append(item);
	}
	currentSummary.append(list);
}

function moveTooltip(event) {
	const rect = tooltip.parentElement.getBoundingClientRect();
	tooltip.style.left = `${event.clientX - rect.left + 14}px`;
	tooltip.style.top = `${event.clientY - rect.top + 14}px`;
}

function showTooltip(event, point) {
	tooltip.hidden = false;
	tooltip.innerHTML = `
		<strong>${point.label}</strong>
		<span>Totaal verdachten: ${formatNumber(point.totalSuspects)}</span>
		<span>Met woonadres in Nederland: ${formatNumber(point.suspectsWithDutchAddress)}</span>
		<span>Bevolking groep: ca. ${formatNumber(point.populationEstimate)}</span>
		<span>Aandeel alle verdachten: ${formatSharePercent(shareOfTotalSuspects(point))}</span>
		<span>Aandeel bevolking: ${formatSharePercent(shareOfTotalPopulation(point))}</span>
		<span>Verdachten/bevolking: ${Number.isFinite(suspectPopulationShareRatio(point)) ? `${ratioFormat.format(suspectPopulationShareRatio(point))}x` : "-"}</span>
		<span>Per 10.000 inwoners: ${formatPer(point.suspectsPer10000)}</span>
		<span>Aandeel totaal: ${formatChance(point.populationEstimate > 0 ? (point.totalSuspects / point.populationEstimate) * 10000 : null)}</span>
		<span>Aandeel met Nederlands adres: ${formatChance(point.suspectsPer10000)}</span>
		<span>T.o.v. Nederlandse achtergrond: ${formatRatioOfDutchBackground(point.suspectsPer10000)}</span>
		<small>${point.source}, ${point.year}. Geregistreerde verdachten, niet veroordeelden.</small>
	`;
	moveTooltip(event);
}

function hideTooltip() {
	tooltip.hidden = true;
}

function renderChart() {
	const points = visiblePoints();
	const allPoints = data.legacy2022.points;
	const wrap = document.querySelector(".project-chart-wrap");
	const width = Math.max(320, Math.floor(wrap.getBoundingClientRect().width));
	const height = isSmallScreen() ? 560 : 720;
	const margin = isSmallScreen() ? { top: 24, right: 42, bottom: 64, left: 54 } : { top: 30, right: 70, bottom: 78, left: 68 };
	const innerWidth = width - margin.left - margin.right;
	const innerHeight = height - margin.top - margin.bottom;

	svg.attr("viewBox", `0 0 ${width} ${height}`).attr("width", width).attr("height", height);
	svg.selectAll("*").remove();

	const xExtent = d3.extent(allPoints, (point) => point.totalSuspects);
	const yMax = d3.max(allPoints, (point) => point.suspectsPer10000) || 1;
	const xScale = selectedXScale();
	const x =
		xScale === "linear"
			? d3
					.scaleLinear()
					.domain([0, xExtent[1] * 1.08])
					.range([0, innerWidth])
					.nice()
			: d3
					.scaleLog()
					.domain([Math.max(1, xExtent[0] * 0.72), xExtent[1] * 1.28])
					.range([0, innerWidth])
					.nice();
	const y = d3
		.scaleLinear()
		.domain([-20, Math.ceil((yMax + 28) / 25) * 25])
		.range([innerHeight, 0]);
	const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
	const clipId = "scatter-clip";

	svg.append("defs").append("clipPath").attr("id", clipId).append("rect").attr("width", innerWidth).attr("height", innerHeight);

	const { q1, median, q3 } = data.legacy2022.quartiles;
	const bands = [
		{ from: -20, to: q1, color: "rgba(34, 197, 94, 0.16)" },
		{ from: q1, to: median, color: "rgba(250, 204, 21, 0.16)" },
		{ from: median, to: q3, color: "rgba(249, 115, 22, 0.18)" },
		{ from: q3, to: y.domain()[1], color: "rgba(196, 59, 47, 0.24)" },
	];
	const plotArea = g.append("g").attr("clip-path", `url(#${clipId})`);
	const bandSelection = plotArea
		.selectAll("rect.band")
		.data(bands)
		.join("rect")
		.attr("class", "band")
		.attr("fill", (band) => band.color);

	const bandBoundarySelection = plotArea.selectAll("line.band-boundary").data([q1, median, q3]).join("line").attr("class", "band-boundary").attr("x1", 0).attr("x2", innerWidth);

	const yGrid = g.append("g").attr("class", "grid").call(d3.axisLeft(y).ticks(8).tickSize(-innerWidth).tickFormat(""));

	const xGrid = g
		.append("g")
		.attr("class", "grid")
		.attr("transform", `translate(0,${innerHeight})`)
		.call(
			d3
				.axisBottom(x)
				.ticks(isSmallScreen() ? 4 : 6, "~s")
				.tickSize(-innerHeight)
				.tickFormat("")
		);

	const xAxis = g
		.append("g")
		.attr("class", "axis")
		.attr("transform", `translate(0,${innerHeight})`)
		.call(d3.axisBottom(x).ticks(isSmallScreen() ? 4 : 6, "~s"));
	const yAxis = g.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(8));
	const yAxisRight = g.append("g").attr("class", "axis axis-right").attr("transform", `translate(${innerWidth},0)`).call(d3.axisRight(y).ticks(8).tickFormat(formatRatioOfDutchBackground));

	g.append("text")
		.attr("class", "axis-label")
		.attr("x", innerWidth / 2)
		.attr("y", innerHeight + 52)
		.attr("text-anchor", "middle")
		.text(`Totaal verdachten (aantal, 2022, ${xScale === "linear" ? "lineair" : "log"})`);

	g.append("text")
		.attr("class", "axis-label")
		.attr("transform", "rotate(-90)")
		.attr("x", -innerHeight / 2)
		.attr("y", -46)
		.attr("text-anchor", "middle")
		.text("Verdachten per 10.000 inwoners (2022)");

	g.append("text")
		.attr("class", "axis-label axis-label-right")
		.attr("transform", "rotate(90)")
		.attr("x", innerHeight / 2)
		.attr("y", -innerWidth - 48)
		.attr("text-anchor", "middle")
		.text("Nederlandse achtergrond = 1,00x");

	const pointGroup = plotArea.append("g").attr("class", "points");
	const pointSelection = pointGroup
		.selectAll("circle")
		.data(points, (point) => point.key)
		.join("circle")
		.attr("class", (point) => `point ${point.isAggregate ? "is-aggregate" : "is-country"} ${point.key === selectedKey ? "is-selected" : ""}`)
		.attr("r", (point) => (point.isAggregate ? 6.2 : 5.2))
		.on("pointerdown", (event) => event.stopPropagation())
		.on("click", (event, point) => {
			event.stopPropagation();
			selectedKey = point.key;
			renderSelected(point);
			renderChart();
		});

	pointSelection.append("title").text((point) => `${point.label}: ${formatNumber(point.totalSuspects)} verdachten, ${formatPer(point.suspectsPer10000)} per 10.000`);

	let labelSelection = null;
	if (labelToggle.checked) {
		const labeled = isSmallScreen() && !searchInput.value.trim() ? points.filter((point) => point.isAggregate || point.totalSuspects >= 1000 || point.suspectsPer10000 >= 180) : points;
		labelSelection = plotArea
			.append("g")
			.attr("class", "labels")
			.selectAll("text")
			.data(labeled, (point) => point.key)
			.join("text")
			.text((point) => point.label);
	}

	const zoom = d3
		.zoom()
		.scaleExtent([1, 24])
		.extent([
			[0, 0],
			[innerWidth, innerHeight],
		])
		.translateExtent([
			[0, 0],
			[innerWidth, innerHeight],
		])
		.filter((event) => {
			if (event.type === "wheel") return true;
			return !event.ctrlKey && !event.button;
		})
		.on("start", hideTooltip)
		.on("zoom", (event) => {
			zoomTransform = event.transform;
			redraw(zoomTransform);
		});

	function redraw(transform) {
		const zx = transform.rescaleX(x);
		const zy = transform.rescaleY(y);

		bandSelection
			.attr("x", 0)
			.attr("y", (band) => zy(band.to))
			.attr("width", innerWidth)
			.attr("height", (band) => Math.max(0, zy(band.from) - zy(band.to)));

		bandBoundarySelection.attr("y1", (value) => zy(value)).attr("y2", (value) => zy(value));

		xGrid.call(
			d3
				.axisBottom(zx)
				.ticks(isSmallScreen() ? 4 : 6, "~s")
				.tickSize(-innerHeight)
				.tickFormat("")
		);
		yGrid.call(d3.axisLeft(zy).ticks(8).tickSize(-innerWidth).tickFormat(""));
		xAxis.call(d3.axisBottom(zx).ticks(isSmallScreen() ? 4 : 6, "~s"));
		yAxis.call(d3.axisLeft(zy).ticks(8));
		yAxisRight.call(d3.axisRight(zy).ticks(8).tickFormat(formatRatioOfDutchBackground));

		pointSelection.attr("cx", (point) => zx(point.totalSuspects)).attr("cy", (point) => zy(point.suspectsPer10000));
		if (labelSelection) {
			labelSelection.attr("x", (point) => zx(point.totalSuspects) + 5).attr("y", (point) => zy(point.suspectsPer10000) - 5);
		}

		resetZoomButton.disabled = transform.k === 1 && transform.x === 0 && transform.y === 0;
	}

	svg.call(zoom).on("dblclick.zoom", null);

	let hoveredKey = null;
	svg.on("mousemove.tooltip", (event) => {
		const [px, py] = d3.pointer(event, g.node());
		if (px < 0 || px > innerWidth || py < 0 || py > innerHeight) {
			if (hoveredKey !== null) {
				hoveredKey = null;
				hideTooltip();
			}
			return;
		}
		let nearest = null;
		let minDist = 20;
		pointSelection.each(function (point) {
			const cx = +d3.select(this).attr("cx");
			const cy = +d3.select(this).attr("cy");
			const dist = Math.hypot(px - cx, py - cy);
			if (dist < minDist) {
				minDist = dist;
				nearest = point;
			}
		});
		if (nearest) {
			if (nearest.key !== hoveredKey) {
				hoveredKey = nearest.key;
				showTooltip(event, nearest);
			} else {
				moveTooltip(event);
			}
		} else {
			if (hoveredKey !== null) {
				hoveredKey = null;
				hideTooltip();
			}
		}
	});
	svg.on("mouseleave.tooltip", () => {
		hoveredKey = null;
		hideTooltip();
	});

	if (!svg.node().__hideTooltipOnPointerDown) {
		svg.node().addEventListener(
			"pointerdown",
			(event) => {
				if (!event.target.matches?.("circle.point")) hideTooltip();
			},
			{ capture: true }
		);
		svg.node().__hideTooltipOnPointerDown = true;
	}
	svg.on("click", (event) => {
		if (!event.target.matches?.("circle.point")) hideTooltip();
	});
	svg.on("dblclick", () => {
		svg.transition().duration(250).call(zoom.transform, d3.zoomIdentity);
	});
	svg.call(zoom.transform, zoomTransform);
	redraw(zoomTransform);

	quartileLabel.textContent = `y-kwartielen ≈ ${formatPer(q1)} / ${formatPer(median)} / ${formatPer(q3)}`;
	pointCount.textContent = `${points.length} van ${allPoints.length} punten zichtbaar`;
}

function exportCsv() {
	const header = ["herkomst", "jaar", "totaal_verdachten", "verdachten_met_woonadres_nederland", "bevolking_groep_afgeleid", "verdachten_per_10000", "is_aggregaat", "bron"];
	const rows = visiblePoints().map((point) => [point.label, point.year, point.totalSuspects, point.suspectsWithDutchAddress, point.populationEstimate, point.suspectsPer10000, point.isAggregate, point.source]);
	const csv = [header, ...rows].map((row) => row.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
	const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = "verdachten-naar-herkomst-2022.csv";
	link.click();
	URL.revokeObjectURL(url);
}

async function init() {
	const response = await fetch("/projects/verdachten-naar-herkomst/data.json");
	if (!response.ok) throw new Error(`Kon data.json niet laden: ${response.status}`);
	data = await response.json();

	renderSelected(null);
	renderCurrentSummary();
	renderChart();

	searchInput.addEventListener("input", renderChart);
	labelToggle.addEventListener("change", renderChart);
	aggregateToggle.addEventListener("change", renderChart);
	xScaleInputs.forEach((input) => {
		input.addEventListener("change", () => {
			zoomTransform = d3.zoomIdentity;
			renderChart();
		});
	});
	exportButton.addEventListener("click", exportCsv);
	resetZoomButton.addEventListener("click", () => {
		zoomTransform = d3.zoomIdentity;
		renderChart();
	});
	window.addEventListener("resize", renderChart);
}

init().catch((error) => {
	console.error(error);
	document.querySelector(".project-chart-wrap").innerHTML = `<p class="load-error">Data kon niet worden geladen.</p>`;
});
