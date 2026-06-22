/* global d3 */

const groupSelect = document.querySelector("#groupSelect");
const xMetricSelect = document.querySelector("#xMetricSelect");
const yMetricSelect = document.querySelector("#yMetricSelect");
const zeroBaselineToggle = document.querySelector("#zeroBaselineToggle");
const chartPanel = document.querySelector(".project-chart");
const chartWrap = document.querySelector(".project-chart-wrap");
const fullscreenButton = document.querySelector("#fullscreenButton");
const presetControls = document.querySelector("#presetControls");
const summaryStrip = document.querySelector("#summaryStrip");
const chartTitle = document.querySelector("#chartTitle");
const chartMeta = document.querySelector("#chartMeta");
const scatterSvg = d3.select("#safetyScatter");
const tooltip = document.querySelector("#tooltip");
const selectedTitle = document.querySelector("#selectedTitle");
const selectedStats = document.querySelector("#selectedStats");
const rankingTitle = document.querySelector("#rankingTitle");
const rankingList = document.querySelector("#rankingList");

const decimalFormat = new Intl.NumberFormat("nl-NL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const signedFormat = new Intl.NumberFormat("nl-NL", { minimumFractionDigits: 1, maximumFractionDigits: 1, signDisplay: "always" });

const PRESETS = {
	ageRisk: {
		group: "Leeftijdsklasse beknopt",
		xMetric: "traditionalVictim",
		yMetric: "neighborhoodUnsafe",
		selectedKey: "53050",
	},
	originDiscrimination: {
		group: "Geboorteland en herkomst",
		xMetric: "traditionalVictim",
		yMetric: "discrimination",
		selectedKey: "A052023",
	},
	urbanCohesion: {
		group: "Stedelijkheid gemeente",
		xMetric: "socialCohesion",
		yMetric: "safetyGrade",
		selectedKey: "1018850",
	},
	orientationStreet: {
		group: "Seksuele oriëntatie",
		xMetric: "streetDisrespect",
		yMetric: "generalUnsafe",
		selectedKey: "A052631",
	},
	incomeSafety: {
		group: "Inkomen",
		xMetric: "neighborhoodUnsafe",
		yMetric: "safetyGrade",
		selectedKey: "1014752",
	},
	genderOnline: {
		group: "Genderidentiteit",
		xMetric: "onlineVictim",
		yMetric: "onlineThreat",
		selectedKey: "A052616",
	},
};

let data;
let selectedKey;

function metric(key) {
	return data.metrics.find((item) => item.key === key);
}

function formatValue(value, metricKey) {
	if (!Number.isFinite(value)) return "-";
	const unit = metric(metricKey)?.unit;
	if (unit === "%") return `${decimalFormat.format(value)}%`;
	if (unit === "score") return decimalFormat.format(value);
	return decimalFormat.format(value);
}

function formatDelta(value, metricKey) {
	if (!Number.isFinite(value)) return "-";
	const unit = metric(metricKey)?.unit;
	if (unit === "%") return `${signedFormat.format(value)} punt`;
	if (unit === "score") return signedFormat.format(value);
	return signedFormat.format(value);
}

function isPercentMetric(metricKey) {
	return metric(metricKey)?.unit === "%";
}

function clamp(value, min, max) {
	return Math.max(min, Math.min(max, value));
}

function toRgba(color, alpha) {
	const parsed = d3.rgb(color);
	return `rgba(${parsed.r}, ${parsed.g}, ${parsed.b}, ${alpha})`;
}

function valueOf(row, metricKey) {
	const value = row?.values?.[metricKey];
	return Number.isFinite(value) ? value : null;
}

function totalRow() {
	return data.demographic.find((row) => row.key === "T001038");
}

function rowsForGroup() {
	return data.demographic.filter((row) => row.group === groupSelect.value && Number.isFinite(valueOf(row, xMetricSelect.value)) && Number.isFinite(valueOf(row, yMetricSelect.value)));
}

function selectedRow() {
	const rows = rowsForGroup();
	return rows.find((row) => row.key === selectedKey) || rows[0] || totalRow();
}

function option(parent, value, label) {
	const element = document.createElement("option");
	element.value = value;
	element.textContent = label;
	parent.append(element);
}

function populateControls() {
	const groups = [...new Set(data.demographic.map((row) => row.group))];
	for (const group of groups) option(groupSelect, group, group);
	for (const item of data.metrics) {
		option(xMetricSelect, item.key, item.label);
		option(yMetricSelect, item.key, item.label);
	}

	groupSelect.value = data.defaults.group;
	xMetricSelect.value = data.defaults.xMetric;
	yMetricSelect.value = data.defaults.yMetric;
	selectedKey = data.defaults.selectedKey;
}

function moveTooltip(event) {
	window.positionProjectTooltip(event, tooltip);
}

function showTooltip(event, row) {
	tooltip.hidden = false;
	tooltip.setAttribute("aria-hidden", "false");
	tooltip.innerHTML = `<strong>${row.label}</strong>${metric(xMetricSelect.value).shortLabel}: ${formatValue(valueOf(row, xMetricSelect.value), xMetricSelect.value)}<br>${metric(yMetricSelect.value).shortLabel}: ${formatValue(valueOf(row, yMetricSelect.value), yMetricSelect.value)}`;
	moveTooltip(event);
}

function updateFullscreenButton() {
	if (!fullscreenButton) return;
	const isFullscreen = document.fullscreenElement === chartPanel;
	fullscreenButton.textContent = isFullscreen ? "Verlaat schermvullend" : "Vul scherm";
	fullscreenButton.setAttribute("aria-pressed", String(isFullscreen));
}

function toggleFullscreen() {
	if (!chartPanel || !fullscreenButton) return;
	if (document.fullscreenElement === chartPanel) {
		document.exitFullscreen?.();
		return;
	}
	chartPanel.requestFullscreen?.();
}

function hideTooltip() {
	tooltip.hidden = true;
	tooltip.setAttribute("aria-hidden", "true");
}

function metricGap(rows, metricKey) {
	const values = rows.map((row) => valueOf(row, metricKey)).filter(Number.isFinite);
	return values.length ? d3.max(values) - d3.min(values) : null;
}

function sortRows(rows, metricKey) {
	return [...rows].sort((a, b) => {
		const av = valueOf(a, metricKey);
		const bv = valueOf(b, metricKey);
		return metric(metricKey)?.direction === "higher-better" ? av - bv : bv - av;
	});
}

function rankingDirectionLabel(metricKey) {
	return metric(metricKey)?.direction === "higher-better" ? "Laagste" : "Hoogste";
}

function selectedStatTone(metricKey, delta) {
	const totalValue = valueOf(totalRow(), metricKey);
	if (!Number.isFinite(delta) || !Number.isFinite(totalValue)) {
		return null;
	}

	const values = data.demographic.map((row) => valueOf(row, metricKey)).filter(Number.isFinite);
	const maxDelta = d3.max(values.map((value) => Math.abs(value - totalValue))) || 0;
	const direction = metric(metricKey)?.direction === "higher-better" ? 1 : -1;
	const favorableDelta = delta * direction;
	const score = maxDelta > 0 ? clamp(0.5 + favorableDelta / (maxDelta * 2), 0, 1) : 0.5;
	const color = d3.interpolateRgbBasis(["#d46a54", "#c9a36a", "#8fbf8d"])(score);
	const threshold = maxDelta * 0.08;
	const label = Math.abs(favorableDelta) <= threshold ? "vergelijkbaar met Nederland" : favorableDelta > 0 ? "gunstiger dan Nederland" : "ongunstiger dan Nederland";

	return {
		color,
		background: toRgba(color, 0.18),
		border: toRgba(color, 0.62),
		label,
	};
}

function activePresetKey() {
	return Object.entries(PRESETS).find(([, preset]) => preset.group === groupSelect.value && preset.xMetric === xMetricSelect.value && preset.yMetric === yMetricSelect.value)?.[0] || "";
}

function updatePresetButtons() {
	const active = activePresetKey();
	presetControls.querySelectorAll("button").forEach((button) => {
		button.classList.toggle("is-active", button.dataset.preset === active);
	});
}

function applyPreset(key) {
	const preset = PRESETS[key];
	if (!preset) return;
	groupSelect.value = preset.group;
	xMetricSelect.value = preset.xMetric;
	yMetricSelect.value = preset.yMetric;
	selectedKey = preset.selectedKey;
	renderAll();
}

function renderSummary() {
	const rows = rowsForGroup();
	const xKey = xMetricSelect.value;
	const yKey = yMetricSelect.value;
	const topX = sortRows(rows, xKey)[0];
	const topY = sortRows(rows, yKey)[0];
	const total = totalRow();
	const selected = selectedRow();
	const items = [
		["Selectie", selected?.label || "-"],
		[`Nederland: ${metric(yKey).shortLabel}`, formatValue(valueOf(total, yKey), yKey)],
		[`${rankingDirectionLabel(xKey)} ${metric(xKey).shortLabel}`, topX ? `${topX.label} · ${formatValue(valueOf(topX, xKey), xKey)}` : "-"],
		[`Spreiding ${metric(yKey).shortLabel}`, formatValue(metricGap(rows, yKey), yKey)],
	];
	summaryStrip.replaceChildren(
		...items.map(([label, value]) => {
			const item = document.createElement("div");
			item.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
			return item;
		})
	);
}

function renderDetails() {
	const row = selectedRow();
	const total = totalRow();
	selectedKey = row?.key;
	selectedTitle.textContent = row?.label || "Geen selectie";

	const detailMetrics = ["neighborhoodUnsafe", "generalUnsafe", "traditionalVictim", "violenceVictim", "onlineVictim", "discrimination", "streetDisrespect", "policeContact", "socialCohesion", "safetyGrade"];
	selectedStats.replaceChildren(
		...detailMetrics.map((metricKey) => {
			const value = valueOf(row, metricKey);
			const totalValue = valueOf(total, metricKey);
			const delta = Number.isFinite(value) && Number.isFinite(totalValue) ? value - totalValue : null;
			const tone = selectedStatTone(metricKey, delta);
			const item = document.createElement("div");
			if (tone) {
				item.style.setProperty("--stat-color", tone.color);
				item.style.setProperty("--stat-bg", tone.background);
				item.style.setProperty("--stat-border", tone.border);
				item.setAttribute("title", tone.label);
			}
			item.innerHTML = `<span>${metric(metricKey).label}</span><strong>${formatValue(value, metricKey)} <small>${formatDelta(delta, metricKey)} vs NL</small></strong>`;
			return item;
		})
	);
}

function renderRanking() {
	const yKey = yMetricSelect.value;
	const rows = sortRows(rowsForGroup(), yKey).slice(0, 12);
	rankingTitle.textContent = `${metric(yKey).shortLabel}: ${rankingDirectionLabel(yKey).toLowerCase()} waarden`;
	rankingList.replaceChildren(
		...rows.map((row) => {
			const button = document.createElement("button");
			button.type = "button";
			button.className = row.key === selectedKey ? "is-active" : "";
			button.innerHTML = `<span>${row.label}</span><strong>${formatValue(valueOf(row, yKey), yKey)}</strong><small>${metric(xMetricSelect.value).shortLabel}: ${formatValue(valueOf(row, xMetricSelect.value), xMetricSelect.value)}</small>`;
			button.addEventListener("click", () => {
				selectedKey = row.key;
				renderAll();
			});
			return button;
		})
	);
}

function renderScatter() {
	const rows = rowsForGroup();
	const xKey = xMetricSelect.value;
	const yKey = yMetricSelect.value;
	const selected = selectedRow();
	const wrap = chartWrap;
	const width = Math.max(320, Math.floor(wrap.getBoundingClientRect().width));
	const fullscreenHeight = document.fullscreenElement === chartPanel ? Math.max(520, window.innerHeight - Math.ceil(wrap.getBoundingClientRect().top) - 28) : null;
	const height = fullscreenHeight ?? (window.matchMedia("(max-width: 720px)").matches ? 420 : 520);
	const margin = { top: 26, right: 28, bottom: 66, left: 74 };
	const innerWidth = width - margin.left - margin.right;
	const innerHeight = height - margin.top - margin.bottom;

	chartTitle.textContent = `${metric(xKey).label} versus ${metric(yKey).label}`;
	chartMeta.textContent = `${rows.length} punten · ${data.meta.periodLabel}`;

	scatterSvg.attr("viewBox", `0 0 ${width} ${height}`).attr("width", width).attr("height", height);
	scatterSvg.selectAll("*").remove();

	const xValues = rows.map((row) => valueOf(row, xKey));
	const yValues = rows.map((row) => valueOf(row, yKey));
	const xDomain = d3.extent(xValues);
	const yDomain = d3.extent(yValues);
	const xPad = Math.max((xDomain[1] - xDomain[0]) * 0.16, xKey === "safetyGrade" || xKey === "socialCohesion" ? 0.12 : 1);
	const yPad = Math.max((yDomain[1] - yDomain[0]) * 0.16, yKey === "safetyGrade" || yKey === "socialCohesion" ? 0.12 : 1);
	const fixedPercentXAxis = zeroBaselineToggle.checked && isPercentMetric(xKey);
	const fixedPercentYAxis = zeroBaselineToggle.checked && isPercentMetric(yKey);
	const xMin = fixedPercentXAxis ? 0 : xDomain[0] - xPad;
	const xMax = fixedPercentXAxis ? 100 : xDomain[1] + xPad;
	const yMin = fixedPercentYAxis ? 0 : yDomain[0] - yPad;
	const yMax = fixedPercentYAxis ? 100 : yDomain[1] + yPad;
	const x = d3.scaleLinear().domain([xMin, xMax]).range([0, innerWidth]);
	const y = d3.scaleLinear().domain([yMin, yMax]).range([innerHeight, 0]);
	if (!fixedPercentXAxis) x.nice();
	if (!fixedPercentYAxis) y.nice();
	const xMedian = d3.median(xValues);
	const yMedian = d3.median(yValues);

	const root = scatterSvg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
	root.append("g").attr("class", "grid").attr("transform", `translate(0,${innerHeight})`).call(d3.axisBottom(x).ticks(6).tickSize(-innerHeight).tickFormat(""));
	root.append("g").attr("class", "grid").call(d3.axisLeft(y).ticks(6).tickSize(-innerWidth).tickFormat(""));
	root.append("line").attr("class", "quadrant-line").attr("x1", x(xMedian)).attr("x2", x(xMedian)).attr("y1", 0).attr("y2", innerHeight);
	root.append("line").attr("class", "quadrant-line").attr("x1", 0).attr("x2", innerWidth).attr("y1", y(yMedian)).attr("y2", y(yMedian));
	root
		.append("g")
		.attr("class", "axis")
		.attr("transform", `translate(0,${innerHeight})`)
		.call(
			d3
				.axisBottom(x)
				.ticks(6)
				.tickFormat((value) => formatValue(value, xKey))
		);
	root
		.append("g")
		.attr("class", "axis")
		.call(
			d3
				.axisLeft(y)
				.ticks(6)
				.tickFormat((value) => formatValue(value, yKey))
		);

	root
		.append("text")
		.attr("class", "axis-label")
		.attr("x", innerWidth / 2)
		.attr("y", innerHeight + 52)
		.attr("text-anchor", "middle")
		.text(metric(xKey).label);
	root
		.append("text")
		.attr("class", "axis-label")
		.attr("transform", "rotate(-90)")
		.attr("x", -innerHeight / 2)
		.attr("y", -54)
		.attr("text-anchor", "middle")
		.text(metric(yKey).label);

	const color = d3.scaleLinear().domain(d3.extent(yValues)).range(["#7da7c9", "#c43b2f"]);
	const points = root
		.selectAll("circle")
		.data(rows, (row) => row.key)
		.join("circle")
		.attr("class", (row) => `point ${row.key === selected?.key ? "point-selected" : ""}`)
		.attr("cx", (row) => x(valueOf(row, xKey)))
		.attr("cy", (row) => y(valueOf(row, yKey)))
		.attr("r", (row) => (row.key === selected?.key ? 7 : 5.5))
		.attr("fill", (row) => color(valueOf(row, yKey)))
		.on("mouseenter", (event, row) => {
			points.classed("point-muted", (candidate) => candidate.key !== row.key);
			showTooltip(event, row);
		})
		.on("mousemove", moveTooltip)
		.on("mouseleave", () => {
			points.classed("point-muted", false);
			hideTooltip();
		})
		.on("click", (event, row) => {
			selectedKey = row.key;
			renderAll();
		});

	root
		.selectAll(".point-label")
		.data(rows.filter((row) => rows.length <= 12 || row.key === selected?.key))
		.join("text")
		.attr("class", "point-label")
		.attr("x", (row) => x(valueOf(row, xKey)) + 8)
		.attr("y", (row) => y(valueOf(row, yKey)) - 8)
		.text((row) => row.label);
}

function renderAll() {
	renderSummary();
	renderDetails();
	renderRanking();
	renderScatter();
	updatePresetButtons();
}

function handleGroupChange() {
	const rows = rowsForGroup();
	selectedKey = rows.some((row) => row.key === selectedKey) ? selectedKey : rows[0]?.key;
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
		groupSelect.addEventListener("change", handleGroupChange);
		xMetricSelect.addEventListener("change", renderAll);
		yMetricSelect.addEventListener("change", renderAll);
		zeroBaselineToggle.addEventListener("change", renderScatter);
		if (fullscreenButton && chartPanel?.requestFullscreen) {
			fullscreenButton.addEventListener("click", toggleFullscreen);
			document.addEventListener("fullscreenchange", () => {
				updateFullscreenButton();
				renderScatter();
			});
			updateFullscreenButton();
		} else if (fullscreenButton) {
			fullscreenButton.hidden = true;
		}
		presetControls.addEventListener("click", (event) => {
			const button = event.target.closest("button[data-preset]");
			if (button) applyPreset(button.dataset.preset);
		});
		window.addEventListener("resize", () => renderScatter());
		renderAll();
	})
	.catch((error) => {
		document.querySelector(".project-dashboard").innerHTML = `<section class="panel detail-panel"><h2>Data kon niet worden geladen</h2><p>${error.message}</p></section>`;
	});
