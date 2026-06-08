const canvas = document.querySelector("#map");
const context = canvas.getContext("2d");
const yearInput = document.querySelector("#year");
const yearLabel = document.querySelector("#yearLabel");
const countryTooltip = document.querySelector("#countryTooltip");
const playButton = document.querySelector("#play");
const speedInput = document.querySelector("#speed");
const speedLabel = document.querySelector("#speedLabel");
const ranking = document.querySelector("#ranking");
const topOut = document.querySelector("#topOut");
const topIn = document.querySelector("#topIn");
const metricButtons = document.querySelectorAll("[data-metric]");

const euCodes = new Set(["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE"]);

const countryAliases = new Map([
	["Austria", "AT"],
	["Belgium", "BE"],
	["Bulgaria", "BG"],
	["Croatia", "HR"],
	["Cyprus", "CY"],
	["Denmark", "DK"],
	["Estonia", "EE"],
	["Finland", "FI"],
	["France", "FR"],
	["Germany", "DE"],
	["Greece", "GR"],
	["Hungary", "HU"],
	["Ireland", "IE"],
	["Italy", "IT"],
	["Latvia", "LV"],
	["Lithuania", "LT"],
	["Luxembourg", "LU"],
	["Malta", "MT"],
	["Netherlands", "NL"],
	["Poland", "PL"],
	["Portugal", "PT"],
	["Romania", "RO"],
	["Slovenia", "SI"],
	["Spain", "ES"],
	["Sweden", "SE"],
	["Czechia", "CZ"],
	["Czech Republic", "CZ"],
	["Slovakia", "SK"],
	["Republic of Serbia", "RS"],
	["Bosnia and Herzegovina", "BA"],
]);

let data;
let world;
let renderFeatures = [];
let euFeatures = [];
let metricExtents = {};
let metric = "net_balance_pct_gni";
let year = 2000;
let playing = true;
let lastAdvance = 0;
let transition = null;
let hoverFeature = null;
let hoverPoint = null;
let mapTransform;
let projection;
let path;
let zoomBehavior;
let animationSpeed = 1;
let lastAnimationDraw = 0;
const baseHoldMs = 650;
const baseTransitionMs = 1050;
const baseResetMs = 850;

function isSmallScreen() {
	return window.matchMedia("(max-width: 880px)").matches;
}

const formatters = {
	net_balance_pct_gni: (value) => `${value > 0 ? "+" : ""}${value.toFixed(2)}%`,
	net_balance_m_eur: (value) => `${value > 0 ? "+" : ""}${Math.round(value).toLocaleString("nl-NL")} mln`,
	m_eur: (value) => `${Math.round(value).toLocaleString("nl-NL")} mln`,
	net_balance_per_capita_eur: (value) => `${value > 0 ? "+" : ""}${Math.round(value).toLocaleString("nl-NL")} EUR`,
};

function currentRows() {
	return visualState(performance.now()).rows;
}

function currentRowForCode(code) {
	return rowByCode(currentRows()).get(code);
}

function resize() {
	const ratio = Math.min(window.devicePixelRatio || 1, window.matchMedia("(max-width: 880px)").matches ? 1.25 : 1.75);
	const { width, height } = canvas.getBoundingClientRect();
	canvas.width = Math.floor(width * ratio);
	canvas.height = Math.floor(height * ratio);
	context.setTransform(ratio, 0, 0, ratio, 0, 0);
	if (zoomBehavior)
		d3.select(canvas).call(
			zoomBehavior.extent([
				[0, 0],
				[width, height],
			])
		);

	projection = d3.geoConicConformal().parallels([35, 65]).rotate([-15, 0]);
	const euArea = { type: "FeatureCollection", features: euFeatures };
	projection.fitExtent(
		[
			[24, 92],
			[width - 24, height - 34],
		],
		euArea
	);
	projection.scale(projection.scale() * 1.45).translate([projection.translate()[0] - width * 0.04, projection.translate()[1] + height * 0.03]);
	path = d3.geoPath(projection, context);
	draw();
}

function setupMapControls() {
	const selection = d3.select(canvas);
	zoomBehavior = d3
		.zoom()
		.scaleExtent([1, 8])
		.translateExtent([
			[-900, -700],
			[canvas.clientWidth + 900, canvas.clientHeight + 700],
		])
		.extent([
			[0, 0],
			[canvas.clientWidth, canvas.clientHeight],
		])
		.filter((event) => {
			if (event.type === "wheel") return true;
			return !event.ctrlKey && !event.button;
		})
		.on("zoom", (event) => {
			mapTransform = event.transform;
			draw();
		});

	selection.call(zoomBehavior).on("dblclick.zoom", null);
	canvas.addEventListener("dblclick", () => {
		selection.transition().duration(450).call(zoomBehavior.transform, d3.zoomIdentity);
	});
	canvas.addEventListener("mousemove", handleHover);
	canvas.addEventListener("mouseleave", clearHover);
	canvas.addEventListener("click", handleHover);
}

function countryCode(feature) {
	return countryAliases.get(feature.properties.name) || feature.id;
}

function isEuropeFeature(feature) {
	const [lon, lat] = d3.geoCentroid(feature);
	return lon > -26 && lon < 45 && lat > 34 && lat < 72;
}

function cacheFeatures() {
	euFeatures = world.features.filter((feature) => euCodes.has(countryCode(feature)));
	renderFeatures = world.features.filter((feature) => euCodes.has(countryCode(feature)) || isEuropeFeature(feature));
}

function cacheMetricExtents() {
	const rows = Object.values(data.byYear).flat();
	metricExtents = {
		net_balance_pct_gni: data.extent.maxAbsPctGni,
		net_balance_m_eur: d3.max(rows, (row) => Math.abs(row.net_balance_m_eur)),
		net_balance_per_capita_eur: d3.max(rows, (row) => Math.abs(row.net_balance_per_capita_eur)),
	};
}

function colorFor(value, opacity = 1) {
	const max = metricExtents[metric] || 1;
	const scale = Math.min(1, Math.abs(value) / max);
	const color = value < 0 ? d3.interpolateRgb("#383238", "#d54d43")(scale) : value > 0 ? d3.interpolateRgb("#273833", "#2fb47c")(scale) : "#263039";
	return d3.color(color).copy({ opacity }).formatRgb();
}

function mixRows(fromRows, toRows, progress) {
	const byCode = new Map(toRows.map((row) => [row.code, row]));
	return fromRows.map((fromRow) => {
		const toRow = byCode.get(fromRow.code) || fromRow;
		return {
			...fromRow,
			contribution_m_eur: d3.interpolateNumber(fromRow.contribution_m_eur, toRow.contribution_m_eur)(progress),
			receipts_m_eur: d3.interpolateNumber(fromRow.receipts_m_eur, toRow.receipts_m_eur)(progress),
			net_balance_m_eur: d3.interpolateNumber(fromRow.net_balance_m_eur, toRow.net_balance_m_eur)(progress),
			net_balance_per_capita_eur: d3.interpolateNumber(fromRow.net_balance_per_capita_eur, toRow.net_balance_per_capita_eur)(progress),
			net_balance_pct_gni: d3.interpolateNumber(fromRow.net_balance_pct_gni, toRow.net_balance_pct_gni)(progress),
		};
	});
}

function visualState(timestamp) {
	if (!transition) {
		return {
			label: String(year),
			rows: data.byYear[String(year)] || [],
			neutralOpacity: 1,
		};
	}

	const rawProgress = Math.min(1, (timestamp - transition.startedAt) / transition.duration);
	const progress = d3.easeCubicInOut(rawProgress);
	const fromRows = data.byYear[String(transition.from)] || [];

	if (transition.to === null) {
		return {
			label: "reset",
			rows: mixRows(
				fromRows,
				fromRows.map((row) => ({ ...row, [metric]: 0, net_balance_m_eur: 0 })),
				progress
			),
			neutralOpacity: 1 - progress,
		};
	}

	return {
		label: String(transition.from),
		rows: mixRows(fromRows, data.byYear[String(transition.to)] || fromRows, progress),
		neutralOpacity: 1,
	};
}

function scaledDuration(duration) {
	return duration / animationSpeed;
}

function completeTransition(timestamp) {
	if (!transition || timestamp - transition.startedAt < transition.duration) return;
	if (transition.to === null) {
		year = 2000;
		transition = null;
		lastAdvance = timestamp;
		updateSidePanel({ redraw: false });
		draw(timestamp);
		return;
	}

	year = transition.to;
	transition = null;
	lastAdvance = timestamp;
	updateSidePanel({ redraw: false });
	draw(timestamp);
}

function startNextTransition(timestamp) {
	if (year >= 2024) {
		transition = { from: 2024, to: null, startedAt: timestamp, duration: scaledDuration(baseResetMs) };
		return;
	}

	transition = { from: year, to: year + 1, startedAt: timestamp, duration: scaledDuration(baseTransitionMs) };
}

function resetAnimationClock() {
	transition = null;
	lastAdvance = performance.now();
}

function updateAnimationSpeed(value) {
	animationSpeed = Number(value);
	speedLabel.textContent = `${animationSpeed
		.toFixed(2)
		.replace(/\\.00$/, ".0")
		.replace(/0$/, "")}x`;
}

function rowByCode(rows) {
	return new Map(rows.map((row) => [row.code, row]));
}

function pointerOnMap(event) {
	const rect = canvas.getBoundingClientRect();
	const screenPoint = [event.clientX - rect.left, event.clientY - rect.top];
	return mapTransform.invert(screenPoint);
}

function findFeatureAtPoint(event) {
	const mapPoint = pointerOnMap(event);
	const lonLat = projection.invert(mapPoint);
	if (!lonLat) return null;
	return euFeatures.find((feature) => d3.geoContains(feature, lonLat));
}

function tooltipHtml(row) {
	const netClass = row.net_balance_m_eur < 0 ? "out-text" : "in-text";
	const status = row.net_balance_m_eur < 0 ? "Netto betaler" : "Netto ontvanger";
	return `
		<div class="country-tooltip-title">
			<strong>${row.country}</strong>
			<span>${row.code}</span>
		</div>
		<div class="${netClass}">${status}: ${formatters.net_balance_m_eur(row.net_balance_m_eur)}</div>
		<dl>
			<div><dt>Bijdrage</dt><dd>${formatters.m_eur(row.contribution_m_eur)}</dd></div>
			<div><dt>Ontvangsten</dt><dd>${formatters.m_eur(row.receipts_m_eur)}</dd></div>
			<div><dt>Per capita</dt><dd>${formatters.net_balance_per_capita_eur(row.net_balance_per_capita_eur)}</dd></div>
			<div><dt>% GNI</dt><dd>${formatters.net_balance_pct_gni(row.net_balance_pct_gni)}</dd></div>
		</dl>
	`;
}

function positionTooltip(event) {
	const pane = canvas.closest(".map-pane").getBoundingClientRect();
	const tooltipRect = countryTooltip.getBoundingClientRect();
	const offset = 16;
	let left = event.clientX - pane.left + offset;
	let top = event.clientY - pane.top + offset;

	if (left + tooltipRect.width > pane.width - 12) left = event.clientX - pane.left - tooltipRect.width - offset;
	if (top + tooltipRect.height > pane.height - 12) top = event.clientY - pane.top - tooltipRect.height - offset;

	countryTooltip.style.left = `${Math.max(12, left)}px`;
	countryTooltip.style.top = `${Math.max(12, top)}px`;
}

function handleHover(event) {
	if (!projection || !mapTransform) return;
	const feature = findFeatureAtPoint(event);
	const row = feature ? currentRowForCode(countryCode(feature)) : null;
	if (!row) {
		clearHover();
		return;
	}

	hoverFeature = feature;
	hoverPoint = [event.clientX, event.clientY];
	countryTooltip.hidden = false;
	countryTooltip.innerHTML = tooltipHtml(row);
	positionTooltip(event);
	draw();
}

function clearHover() {
	hoverFeature = null;
	hoverPoint = null;
	countryTooltip.hidden = true;
	draw();
}

function countryFill(row, neutralOpacity) {
	if (!row) return "#182027";
	if (neutralOpacity < 1) return colorFor(row[metric], neutralOpacity);
	return colorFor(row[metric]);
}

function countryStroke(code) {
	if (euCodes.has(code)) return "rgba(244,247,248,0.45)";
	return "rgba(244,247,248,0.12)";
}

function neutralLandFill() {
	return "#263039";
}

function draw(timestamp = performance.now()) {
	if (!data || !world || !path) return;
	const width = canvas.clientWidth;
	const height = canvas.clientHeight;
	const state = visualState(timestamp);
	const rows = state.rows;
	const rowsByCode = rowByCode(rows);

	yearLabel.textContent = state.label;

	context.clearRect(0, 0, width, height);
	context.fillStyle = "#0d1216";
	context.fillRect(0, 0, width, height);

	context.save();
	context.translate(mapTransform.x, mapTransform.y);
	context.scale(mapTransform.k, mapTransform.k);

	renderFeatures.forEach((feature) => {
		const code = countryCode(feature);
		const row = rowsByCode.get(code);
		context.beginPath();
		path(feature);
		context.fillStyle = row ? countryFill(row, state.neutralOpacity) : "#182027";
		if (transition?.to === null && row) context.fillStyle = d3.interpolateRgb(countryFill(row, state.neutralOpacity), neutralLandFill())(1 - state.neutralOpacity);
		context.fill();
		context.strokeStyle = countryStroke(code);
		context.lineWidth = (euCodes.has(code) ? 0.8 : 0.45) / mapTransform.k;
		context.stroke();
	});

	if (hoverFeature) {
		context.beginPath();
		path(hoverFeature);
		context.fillStyle = "rgba(255,255,255,0.08)";
		context.fill();
		context.strokeStyle = "rgba(255,255,255,0.92)";
		context.lineWidth = 2 / mapTransform.k;
		context.stroke();
	}

	context.restore();

	if (hoverFeature && hoverPoint) {
		const eventLike = { clientX: hoverPoint[0], clientY: hoverPoint[1] };
		const row = currentRowForCode(countryCode(hoverFeature));
		if (row) countryTooltip.innerHTML = tooltipHtml(row);
		positionTooltip(eventLike);
	}
}

function updateSidePanel({ redraw = true } = {}) {
	yearLabel.textContent = year;
	yearInput.value = year;
	const rows = [...data.byYear[String(year)]].sort((a, b) => a.net_balance_m_eur - b.net_balance_m_eur);
	const out = rows[0];
	const inn = rows.at(-1);
	topOut.textContent = `${out.country} ${formatters.net_balance_m_eur(out.net_balance_m_eur)}`;
	topIn.textContent = `${inn.country} ${formatters.net_balance_m_eur(inn.net_balance_m_eur)}`;

	ranking.replaceChildren(
		...rows.map((row) => {
			const li = document.createElement("li");
			li.innerHTML = `<span>${row.country}<br><small>${row.code}</small></span><strong>${formatters[metric](row[metric])}</strong>`;
			li.style.color = row[metric] < 0 ? "#ffb6ae" : "#a8e8ca";
			return li;
		})
	);
	if (redraw) draw();
}

function tick(timestamp) {
	if (transition) {
		const targetFrameMs = isSmallScreen() ? 33 : 16;
		if (timestamp - lastAnimationDraw >= targetFrameMs) {
			draw(timestamp);
			lastAnimationDraw = timestamp;
		}
		completeTransition(timestamp);
	} else if (playing && timestamp - lastAdvance > scaledDuration(baseHoldMs)) {
		startNextTransition(timestamp);
	}
	requestAnimationFrame(tick);
}

yearInput.addEventListener("input", (event) => {
	resetAnimationClock();
	year = Number(event.target.value);
	updateSidePanel();
});

playButton.addEventListener("click", () => {
	playing = !playing;
	playButton.textContent = playing ? "Pause" : "Play";
});

speedInput.addEventListener("input", (event) => {
	updateAnimationSpeed(event.target.value);
});

metricButtons.forEach((button) => {
	button.addEventListener("click", () => {
		metric = button.dataset.metric;
		metricButtons.forEach((item) => item.classList.toggle("active", item === button));
		updateSidePanel();
	});
});

window.addEventListener("resize", resize);

const topologyUrl = isSmallScreen() ? "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json" : "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json";
const [budgetData, topology] = await Promise.all([fetch("budget-flows.json").then((response) => response.json()), fetch(topologyUrl).then((response) => response.json())]);

data = budgetData;
world = topojson.feature(topology, topology.objects.countries);
cacheFeatures();
cacheMetricExtents();
mapTransform = d3.zoomIdentity;
updateAnimationSpeed(speedInput.value);
setupMapControls();
resize();
updateSidePanel();
requestAnimationFrame(tick);
