import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

const dataUrl = "/projects/wereldbevolking/world-population-series.json";
const chartRoot = document.getElementById("world-population-chart");
const statusNode = document.getElementById("world-population-status");
const highlightInput = document.getElementById("world-population-highlight");
const highlightButton = document.getElementById("world-population-add-highlight");
const resetButton = document.getElementById("world-population-reset");
const metricButtons = Array.from(document.querySelectorAll("[data-world-population-metric]"));
const scaleButtons = Array.from(document.querySelectorAll("[data-world-population-scale]"));
const backgroundToggle = document.getElementById("world-population-show-background");
const noMigrationToggle = document.getElementById("world-population-show-no-migration");
const continentButtonsNode = document.getElementById("world-population-continents");
const legendNode = document.getElementById("world-population-legend");
const tooltipNode = document.getElementById("world-population-tooltip");
const neighborRange = document.getElementById("world-population-neighbor-range");
const neighborCountNode = document.getElementById("world-population-neighbor-count");

const palette = ["#c43b2f", "#f4efe6", "#c9a36a", "#7da7c9", "#8fbf8d", "#d46a54", "#a98552", "#b6b6b6"];
const chartColors = {
	gridMajor: "rgba(244, 239, 230, 0.12)",
	gridMinor: "rgba(201, 163, 106, 0.13)",
	axisText: "#c7b9a3",
	axisLine: "rgba(201, 163, 106, 0.38)",
	red: "#c43b2f",
	backgroundLine: "#6c5a4b",
	neighborLine: "#a8a8a8",
	labelLine: "rgba(201, 163, 106, 0.38)",
	labelText: "#9a8870",
	pointStroke: "#080808",
	noMigrationFill: "#080808",
};
const currentYear = new Date().getFullYear();
const continentOrder = ["Africa", "Asia", "Europe", "North America", "Latin America and the Caribbean", "Oceania"];
const continentLabels = new Map([
	["Africa", "Afrika"],
	["Asia", "Azie"],
	["Europe", "Europa"],
	["North America", "Noord-Amerika"],
	["Latin America and the Caribbean", "Latijns-Amerika en het Caribisch gebied"],
	["Oceania", "Oceanie"],
]);

const state = {
	data: null,
	metricMode: "population",
	scaleMode: "log",
	highlightedSlugs: new Set(),
	neighborCount: Number(neighborRange?.value || 0),
	selectedCountrySlug: null,
	selectionWindows: new Map(),
	continentHighlights: new Set(),
	showBackgroundCountries: backgroundToggle?.checked ?? true,
	showNoMigrationComparison: noMigrationToggle?.checked ?? false,
};

function setStatus(message) {
	statusNode.textContent = message;
}

function formatPopulation(population) {
	return new Intl.NumberFormat("en-US").format(population);
}

function formatFertilityRate(value) {
	return value == null ? "niet beschikbaar" : value.toFixed(2);
}

function formatSignedInteger(value) {
	if (value == null) {
		return "niet beschikbaar";
	}
	return `${value >= 0 ? "+" : ""}${new Intl.NumberFormat("en-US").format(value)}`;
}

function formatSignedPercent(value) {
	if (value == null) {
		return "niet beschikbaar";
	}
	return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatPercent(value) {
	return value == null ? "niet beschikbaar" : `${value.toFixed(1)}%`;
}

function getNetMigrationShare(point) {
	if (point?.population == null || point.population === 0 || point.migrantsNet == null) {
		return null;
	}
	return (point.migrantsNet / point.population) * 100;
}

function getMetricValue(point) {
	if (state.metricMode === "net-migration-share") {
		return getNetMigrationShare(point);
	}
	return point?.population ?? null;
}

function hasMetricValue(point) {
	const value = getMetricValue(point);
	return Number.isFinite(value) && (state.metricMode !== "population" || value > 0);
}

function showTooltip(event, country, point, color, label = null) {
	if (!tooltipNode) {
		return;
	}

	const netMigrationShare = getNetMigrationShare(point);
	tooltipNode.innerHTML = `
		<strong style="color:${color}">${label ? `${country.name} (${label})` : country.name}</strong>
		<div>Jaar: ${point.year}</div>
		<div>Bevolking: ${formatPopulation(point.population)}</div>
		<div>Groei: ${formatSignedPercent(point.yearlyPercentChange)} (${formatSignedInteger(point.yearlyChange)})</div>
		<div>Nettomigratie: ${formatSignedInteger(point.migrantsNet)}</div>
		<div>Aandeel nettomigratie: ${formatSignedPercent(netMigrationShare)}</div>
		<div>Vruchtbaarheidscijfer: ${formatFertilityRate(point.fertilityRate)}</div>
		<div>Mediane leeftijd: ${point.medianAge == null ? "niet beschikbaar" : point.medianAge.toFixed(1)}</div>
		<div>Stedelijke bevolking: ${formatPercent(point.urbanPopulationPercent)}</div>
		<div>Wereldrang: ${point.globalRank ?? "niet beschikbaar"}</div>
	`;
	tooltipNode.style.display = "block";
	tooltipNode.setAttribute("aria-hidden", "false");

	const stageBounds = chartRoot.parentElement.getBoundingClientRect();
	const tooltipBounds = tooltipNode.getBoundingClientRect();
	const offset = 14;
	let left = event.clientX - stageBounds.left + offset;
	let top = event.clientY - stageBounds.top - tooltipBounds.height - offset;

	if (left + tooltipBounds.width > stageBounds.width - 8) {
		left = stageBounds.width - tooltipBounds.width - 8;
	}
	if (left < 8) {
		left = 8;
	}
	if (top < 8) {
		top = event.clientY - stageBounds.top + offset;
	}

	tooltipNode.style.left = `${left}px`;
	tooltipNode.style.top = `${top}px`;
}

function hideTooltip() {
	if (!tooltipNode) {
		return;
	}

	tooltipNode.style.display = "none";
	tooltipNode.setAttribute("aria-hidden", "true");
}

function findCountryByName(name) {
	return state.data.countries.find((candidate) => candidate.name.toLowerCase() === name.toLowerCase());
}

function findCountryBySlug(slug) {
	return state.data.countries.find((candidate) => candidate.slug === slug);
}

function findCountryByInput(input) {
	const normalized = input.trim().toLowerCase();
	if (!normalized) {
		return null;
	}

	return findCountryByName(normalized) ?? findCountryBySlug(normalized);
}

function recomputeHighlights() {
	state.highlightedSlugs.clear();

	for (const [slug, neighbors] of state.selectionWindows.entries()) {
		const country = findCountryBySlug(slug);
		if (!country) {
			continue;
		}

		const index = state.data.countries.findIndex((candidate) => candidate.slug === slug);
		if (index < 0) {
			continue;
		}

		const start = Math.max(0, index - neighbors);
		const end = Math.min(state.data.countries.length, index + neighbors + 1);
		for (const neighbor of state.data.countries.slice(start, end)) {
			state.highlightedSlugs.add(neighbor.slug);
		}
	}

	for (const country of state.data.countries) {
		if (country.continent && state.continentHighlights.has(country.continent)) {
			state.highlightedSlugs.add(country.slug);
		}
	}
}

function getHighlightedCountries() {
	return state.data.countries.filter((country) => state.highlightedSlugs.has(country.slug));
}

function getSelectedCountries() {
	return Array.from(state.selectionWindows.keys())
		.map((slug) => findCountryBySlug(slug))
		.filter(Boolean);
}

function getAnchorColor(countrySlug) {
	const anchorIndex = Array.from(state.selectionWindows.keys()).indexOf(countrySlug);
	return palette[(((anchorIndex >= 0 ? anchorIndex : 0) % palette.length) + palette.length) % palette.length];
}

function buildSelectionNeighborGroups(anchorCountries) {
	return anchorCountries
		.map((anchorCountry) => {
			const index = state.data.countries.findIndex((candidate) => candidate.slug === anchorCountry.slug);
			const neighbors = state.selectionWindows.get(anchorCountry.slug) ?? 0;
			if (index < 0 || neighbors <= 0) {
				return null;
			}

			const start = Math.max(0, index - neighbors);
			const end = Math.min(state.data.countries.length, index + neighbors + 1);
			const countries = state.data.countries.slice(start, end).filter((country) => country.slug !== anchorCountry.slug);
			if (countries.length === 0) {
				return null;
			}

			return {
				anchor: anchorCountry,
				color: getAnchorColor(anchorCountry.slug),
				countries,
			};
		})
		.filter(Boolean);
}

function buildEndLabels(countries, y, top, bottom, gap) {
	const labels = countries
		.map((country) => {
			const point = country.points.at(-1);
			const value = getMetricValue(point);
			if (!point || !Number.isFinite(value)) {
				return null;
			}
			return {
				country,
				point,
				targetY: y(value),
				y: y(value),
			};
		})
		.filter(Boolean)
		.sort((left, right) => left.targetY - right.targetY);

	for (let index = 1; index < labels.length; index += 1) {
		labels[index].y = Math.max(labels[index].targetY, labels[index - 1].y + gap);
	}

	for (let index = labels.length - 2; index >= 0; index -= 1) {
		labels[index].y = Math.min(labels[index].y, labels[index + 1].y - gap);
	}

	for (const label of labels) {
		label.y = Math.max(top, Math.min(bottom, label.y));
	}

	return labels;
}

function updateLegend() {
	const selectedCountries = getSelectedCountries();
	legendNode.replaceChildren();

	for (const [index, country] of selectedCountries.entries()) {
		const chip = document.createElement("div");
		chip.className = "world-population-chip";
		if (country.slug === state.selectedCountrySlug) {
			chip.classList.add("is-selected");
		}

		const neighbors = state.selectionWindows.get(country.slug);
		const labelButton = document.createElement("button");
		labelButton.type = "button";
		labelButton.className = "world-population-chip-label";
		labelButton.innerHTML = `<span class="world-population-chip-swatch" style="background:${palette[index % palette.length]}"></span><span>${country.name} ±${neighbors}</span>`;
		labelButton.addEventListener("click", () => {
			state.selectedCountrySlug = country.slug;
			highlightInput.value = country.name;
			state.neighborCount = state.selectionWindows.get(country.slug) ?? state.neighborCount;
			neighborRange.value = String(state.neighborCount);
			hideTooltip();
			render();
		});

		const removeButton = document.createElement("button");
		removeButton.type = "button";
		removeButton.className = "world-population-chip-remove";
		removeButton.setAttribute("aria-label", `Verwijder ${country.name}`);
		removeButton.textContent = "x";
		removeButton.addEventListener("click", () => {
			state.selectionWindows.delete(country.slug);

			if (state.selectedCountrySlug === country.slug) {
				const nextSelectedSlug = Array.from(state.selectionWindows.keys()).at(-1) ?? null;
				state.selectedCountrySlug = nextSelectedSlug;
				if (nextSelectedSlug) {
					const nextCountry = findCountryBySlug(nextSelectedSlug);
					highlightInput.value = nextCountry?.name ?? "";
					state.neighborCount = state.selectionWindows.get(nextSelectedSlug) ?? state.neighborCount;
					neighborRange.value = String(state.neighborCount);
				} else {
					highlightInput.value = "";
				}
			}

			recomputeHighlights();
			render();
		});

		chip.append(labelButton, removeButton);
		legendNode.append(chip);
	}
}

function updateScaleButtons() {
	for (const button of scaleButtons) {
		button.classList.toggle("is-active", button.dataset.worldPopulationScale === state.scaleMode);
		button.disabled = false;
	}
}

function updateMetricButtons() {
	for (const button of metricButtons) {
		button.classList.toggle("is-active", button.dataset.worldPopulationMetric === state.metricMode);
	}
}

function updateBackgroundToggle() {
	if (backgroundToggle) {
		backgroundToggle.checked = state.showBackgroundCountries;
	}
}

function updateNoMigrationToggle() {
	if (noMigrationToggle) {
		noMigrationToggle.checked = state.showNoMigrationComparison && state.metricMode === "population";
		noMigrationToggle.disabled = state.selectionWindows.size === 0 || state.metricMode !== "population";
	}
}

function buildNoMigrationPoints(country) {
	if (!country?.points?.length) {
		return [];
	}

	const derivedPoints = [Object.assign({}, country.points[0])];

	for (let index = 1; index < country.points.length; index += 1) {
		const previousActual = country.points[index - 1];
		const actualPoint = country.points[index];
		const previousDerived = derivedPoints[index - 1];
		const yearDelta = actualPoint.year - previousActual.year;
		const migrationContribution = (actualPoint.migrantsNet ?? 0) * yearDelta;
		const naturalDelta = actualPoint.population - previousActual.population - migrationContribution;

		derivedPoints.push({
			...actualPoint,
			population: Math.max(1, Math.round(previousDerived.population + naturalDelta)),
		});
	}

	return derivedPoints;
}

function getContinentColor(continent) {
	const index = continentOrder.indexOf(continent);
	return palette[(((index >= 0 ? index : 0) % palette.length) + palette.length) % palette.length];
}

function mixHexColors(color, amount, base = "#090909") {
	const normalized = color.replace("#", "");
	const normalizedBase = base.replace("#", "");
	const channels = [0, 2, 4].map((offset) => {
		const source = Number.parseInt(normalized.slice(offset, offset + 2), 16);
		const target = Number.parseInt(normalizedBase.slice(offset, offset + 2), 16);
		return Math.round(source * amount + target * (1 - amount));
	});
	return `#${channels.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function updateContinentButtons() {
	if (!continentButtonsNode || !state.data) {
		return;
	}

	continentButtonsNode.replaceChildren();
	const continents = continentOrder.filter((continent) => state.data.countries.some((country) => country.continent === continent));

	for (const continent of continents) {
		const button = document.createElement("button");
		button.type = "button";
		button.className = "button";
		if (state.continentHighlights.has(continent)) {
			button.classList.add("is-active");
		}
		button.textContent = continentLabels.get(continent) ?? continent;
		const color = getContinentColor(continent);
		button.style.borderColor = color;
		button.style.setProperty("--continent-button-bg", mixHexColors(color, 0.24));
		button.style.setProperty("--continent-button-fg", mixHexColors(color, 0.24, "#fff8ed"));
		button.addEventListener("click", () => {
			if (state.continentHighlights.has(continent)) {
				state.continentHighlights.delete(continent);
			} else {
				state.continentHighlights.add(continent);
			}
			recomputeHighlights();
			render();
		});
		continentButtonsNode.append(button);
	}
}

function updateNeighborCountLabel() {
	if (neighborCountNode) {
		neighborCountNode.textContent = String(state.neighborCount);
	}
}

function syncUrl() {
	if (!state.data) {
		return;
	}

	const params = new URLSearchParams();
	if (state.selectedCountrySlug) {
		params.set("country", state.selectedCountrySlug);
	}
	if (state.selectionWindows.size > 0) {
		params.set(
			"selections",
			Array.from(state.selectionWindows.entries())
				.map(([slug, neighbors]) => `${slug}:${neighbors}`)
				.join(",")
		);
	}
	if (state.neighborCount !== 0) {
		params.set("neighbors", String(state.neighborCount));
	}
	if (state.scaleMode !== "log") {
		params.set("scale", state.scaleMode);
	}
	if (state.metricMode !== "population") {
		params.set("metric", state.metricMode);
	}
	if (!state.showBackgroundCountries) {
		params.set("background", "hidden");
	}
	if (state.showNoMigrationComparison && state.metricMode === "population") {
		params.set("migration", "compare");
	}
	if (state.continentHighlights.size > 0) {
		params.set("continents", Array.from(state.continentHighlights).join(","));
	}

	const query = params.toString();
	const nextUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
	window.history.replaceState({}, "", nextUrl);
}

function applyUrlState() {
	const params = new URLSearchParams(window.location.search);

	const neighborValue = Number(params.get("neighbors"));
	if (Number.isFinite(neighborValue)) {
		state.neighborCount = Math.min(25, Math.max(0, neighborValue));
		neighborRange.value = String(state.neighborCount);
	}

	const scale = params.get("scale");
	if (scale === "linear" || scale === "log") {
		state.scaleMode = scale;
	}

	const metric = params.get("metric");
	if (metric === "population" || metric === "net-migration-share") {
		state.metricMode = metric;
	}

	const background = params.get("background");
	if (background === "hidden") {
		state.showBackgroundCountries = false;
	}

	const migration = params.get("migration");
	if (migration === "compare") {
		state.showNoMigrationComparison = true;
	}

	const continents = params
		.get("continents")
		?.split(",")
		.map((continent) => continent.trim())
		.filter(Boolean);
	if (continents?.length) {
		for (const continent of continents) {
			state.continentHighlights.add(continent);
		}
	}

	const selections = params
		.get("selections")
		?.split(",")
		.map((entry) => entry.trim())
		.filter(Boolean);
	if (selections?.length) {
		for (const entry of selections) {
			const [slug, neighborsText] = entry.split(":");
			const country = findCountryBySlug(slug);
			const neighbors = Number(neighborsText);
			if (!country || !Number.isFinite(neighbors)) {
				continue;
			}
			state.selectionWindows.set(slug, Math.min(25, Math.max(0, neighbors)));
		}
		recomputeHighlights();
	}

	const countrySlug = params.get("country");
	if (countrySlug) {
		const country = findCountryBySlug(countrySlug);
		if (country) {
			state.selectedCountrySlug = country.slug;
			highlightInput.value = country.name;
			if (state.selectionWindows.has(country.slug)) {
				state.neighborCount = state.selectionWindows.get(country.slug) ?? state.neighborCount;
				neighborRange.value = String(state.neighborCount);
			}
		}
	}

	if (!selections?.length && countrySlug) {
		const country = findCountryBySlug(countrySlug);
		if (country) {
			state.selectionWindows.set(country.slug, state.neighborCount);
			state.selectedCountrySlug = country.slug;
			highlightInput.value = country.name;
			recomputeHighlights();
		}
	}
}

function applySelectedCountry(country) {
	state.selectedCountrySlug = country.slug;
	state.selectionWindows.set(country.slug, state.neighborCount);
	recomputeHighlights();
	highlightInput.value = country.name;
}

function addHighlightFromInput() {
	const rawInput = highlightInput.value.trim();
	if (!rawInput) {
		return;
	}

	const country = findCountryByInput(rawInput);
	if (!country) {
		setStatus(`Land niet gevonden: ${highlightInput.value.trim()}`);
		return;
	}

	applySelectedCountry(country);
	render();
}

function render() {
	if (!state.data) {
		return;
	}

	updateMetricButtons();
	updateScaleButtons();
	updateBackgroundToggle();
	updateNoMigrationToggle();
	updateNeighborCountLabel();
	updateContinentButtons();
	updateLegend();

	const bounds = chartRoot.getBoundingClientRect();
	const width = Math.max(720, Math.round(bounds.width || 960));
	const height = Math.max(540, Math.round(width * 0.58));
	const margin = { top: 24, right: 180, bottom: 48, left: 76 };
	const plotWidth = width - margin.left - margin.right;
	const plotHeight = height - margin.top - margin.bottom;

	chartRoot.replaceChildren();

	const isPopulationMetric = state.metricMode === "population";
	const metricLabel = isPopulationMetric ? "Bevolking" : "Nettomigratie als percentage van de bevolking";
	const svg = d3.select(chartRoot).append("svg").attr("viewBox", `0 0 ${width} ${height}`).attr("role", "img").attr("aria-label", `${metricLabel} per land door de tijd`);

	const allPoints = state.data.countries.flatMap((country) => country.points);
	const highlightedCountries = getHighlightedCountries();
	const anchorCountries = getSelectedCountries();
	const selectedCountry = state.selectedCountrySlug ? findCountryBySlug(state.selectedCountrySlug) : null;
	const selectionNeighborGroups = buildSelectionNeighborGroups(anchorCountries);
	const noMigrationComparisons =
		state.showNoMigrationComparison && isPopulationMetric
			? anchorCountries.map((country) => ({
					country,
					color: getAnchorColor(country.slug),
					points: buildNoMigrationPoints(country),
				}))
			: [];
	const anchorSlugs = new Set(anchorCountries.map((country) => country.slug));
	const selectionNeighborSlugs = new Set(selectionNeighborGroups.flatMap((group) => group.countries.map((country) => country.slug)));
	const neighborCountries = highlightedCountries.filter((country) => !anchorSlugs.has(country.slug) && !selectionNeighborSlugs.has(country.slug));
	const backgroundCountries = state.showBackgroundCountries ? state.data.countries.filter((country) => !state.highlightedSlugs.has(country.slug)) : [];
	const scaleCountries = !state.showBackgroundCountries && highlightedCountries.length > 0 ? highlightedCountries : state.scaleMode === "log" || highlightedCountries.length === 0 || !isPopulationMetric ? state.data.countries : highlightedCountries;
	const scalePoints = scaleCountries.flatMap((country) => country.points).concat(noMigrationComparisons.flatMap((comparison) => comparison.points));
	const years = d3.extent(allPoints, (point) => point.year);
	const metricValues = scalePoints.map((point) => getMetricValue(point)).filter(Number.isFinite);

	const x = d3
		.scaleLinear()
		.domain(years)
		.range([margin.left, margin.left + plotWidth]);
	let y;
	if (isPopulationMetric && state.scaleMode === "log") {
		y = d3
			.scaleLog()
			.domain([d3.min(metricValues), d3.max(metricValues)])
			.range([margin.top + plotHeight, margin.top])
			.nice();
	} else if (!isPopulationMetric && state.scaleMode === "log") {
		y = d3
			.scaleSymlog()
			.constant(0.1)
			.domain(d3.extent(metricValues.concat(0)))
			.range([margin.top + plotHeight, margin.top])
			.nice();
	} else {
		y = d3
			.scaleLinear()
			.domain(isPopulationMetric ? [0, d3.max(metricValues)] : d3.extent(metricValues.concat(0)))
			.range([margin.top + plotHeight, margin.top])
			.nice();
	}

	const line = d3
		.line()
		.defined(hasMetricValue)
		.x((point) => x(point.year))
		.y((point) => y(getMetricValue(point)));

	svg
		.append("g")
		.attr("stroke", chartColors.gridMinor)
		.selectAll("line")
		.data(x.ticks(10))
		.join("line")
		.attr("x1", (value) => x(value))
		.attr("x2", (value) => x(value))
		.attr("y1", margin.top)
		.attr("y2", margin.top + plotHeight);

	svg
		.append("g")
		.attr("stroke", chartColors.gridMajor)
		.selectAll("line")
		.data(y.ticks(8))
		.join("line")
		.attr("x1", margin.left)
		.attr("x2", margin.left + plotWidth)
		.attr("y1", (value) => y(value))
		.attr("y2", (value) => y(value));

	svg
		.append("g")
		.attr("transform", `translate(0, ${margin.top + plotHeight})`)
		.call(d3.axisBottom(x).tickFormat(d3.format("d")).tickValues([1955, 1965, 1975, 1985, 1995, 2005, 2015, 2025, 2035, 2045, 2050]))
		.call((axis) => axis.selectAll("text").attr("fill", chartColors.axisText))
		.call((axis) => axis.selectAll("line,path").attr("stroke", chartColors.axisLine));

	svg
		.append("g")
		.attr("transform", `translate(${margin.left}, 0)`)
		.call(
			isPopulationMetric
				? state.scaleMode === "log"
					? d3.axisLeft(y).ticks(8, "~s")
					: d3.axisLeft(y).ticks(8).tickFormat(d3.format("~s"))
				: d3
						.axisLeft(y)
						.ticks(8)
						.tickFormat((value) => `${d3.format("~g")(value)}%`)
		)
		.call((axis) => axis.selectAll("text").attr("fill", chartColors.axisText))
		.call((axis) => axis.selectAll("line,path").attr("stroke", chartColors.axisLine));

	if (!isPopulationMetric) {
		const zeroY = y(0);
		svg
			.append("line")
			.attr("x1", margin.left)
			.attr("x2", margin.left + plotWidth)
			.attr("y1", zeroY)
			.attr("y2", zeroY)
			.attr("stroke", chartColors.red)
			.attr("stroke-width", 1.2)
			.attr("stroke-opacity", 0.6);
	}

	if (currentYear >= years[0] && currentYear <= years[1]) {
		const yearX = x(currentYear);
		svg
			.append("line")
			.attr("x1", yearX)
			.attr("x2", yearX)
			.attr("y1", margin.top)
			.attr("y2", margin.top + plotHeight)
			.attr("stroke", chartColors.red)
			.attr("stroke-width", 1.5)
			.attr("stroke-dasharray", "6 4")
			.attr("stroke-opacity", 0.85);

		svg
			.append("text")
			.attr("x", yearX + 6)
			.attr("y", margin.top + 12)
			.attr("fill", chartColors.red)
			.attr("font-size", 12)
			.attr("font-weight", 700)
			.text(currentYear);
	}

	svg
		.append("g")
		.selectAll("path")
		.data(backgroundCountries)
		.join("path")
		.attr("fill", "none")
		.attr("stroke", chartColors.backgroundLine)
		.attr("stroke-width", 1.1)
		.attr("stroke-opacity", isPopulationMetric && state.scaleMode === "log" ? 0.22 : 0.1)
		.attr("d", (country) => line(country.points));

	svg
		.append("g")
		.selectAll("g")
		.data(selectionNeighborGroups)
		.join("g")
		.each(function (group) {
			d3.select(this)
				.selectAll("path")
				.data(group.countries)
				.join("path")
				.attr("fill", "none")
				.attr("stroke", group.color)
				.attr("stroke-width", 1.8)
				.attr("stroke-opacity", 0.8)
				.attr("stroke-linecap", "round")
				.attr("stroke-linejoin", "round")
				.attr("d", (country) => line(country.points));
		});

	svg
		.append("g")
		.selectAll("g")
		.data(selectionNeighborGroups)
		.join("g")
		.each(function (group) {
			const color = group.color;
			const baseRadius = 2.8;
			const hoverRadius = 4.4;

			d3.select(this)
				.selectAll("circle")
				.data(group.countries.flatMap((country) => country.points.map((point) => ({ country, point, color }))))
				.join("circle")
				.attr("cx", ({ point }) => x(point.year))
				.attr("cy", ({ point }) => y(getMetricValue(point)))
				.attr("r", baseRadius)
				.attr("fill", color)
				.attr("fill-opacity", 0.9)
				.attr("stroke", chartColors.pointStroke)
				.attr("stroke-width", 1)
				.style("cursor", "crosshair")
				.on("mouseenter", function (event, datum) {
					d3.select(this).attr("r", hoverRadius);
					showTooltip(event, datum.country, datum.point, datum.color);
				})
				.on("mousemove", function (event, datum) {
					showTooltip(event, datum.country, datum.point, datum.color);
				})
				.on("mouseleave", function () {
					d3.select(this).attr("r", baseRadius);
					hideTooltip();
				});
		});

	svg
		.append("g")
		.selectAll("path")
		.data(neighborCountries)
		.join("path")
		.attr("fill", "none")
		.attr("stroke", chartColors.neighborLine)
		.attr("stroke-width", 1.8)
		.attr("stroke-opacity", 0.72)
		.attr("stroke-linecap", "round")
		.attr("stroke-linejoin", "round")
		.attr("d", (country) => line(country.points));

	svg
		.append("g")
		.selectAll("g")
		.data(neighborCountries)
		.join("g")
		.each(function (country) {
			const color = chartColors.neighborLine;
			const baseRadius = 2.8;
			const hoverRadius = 4.4;

			d3.select(this)
				.selectAll("circle")
				.data(country.points.map((point) => ({ country, point, color })))
				.join("circle")
				.attr("cx", ({ point }) => x(point.year))
				.attr("cy", ({ point }) => y(getMetricValue(point)))
				.attr("r", baseRadius)
				.attr("fill", color)
				.attr("fill-opacity", 0.9)
				.attr("stroke", chartColors.pointStroke)
				.attr("stroke-width", 1)
				.style("cursor", "crosshair")
				.on("mouseenter", function (event, datum) {
					d3.select(this).attr("r", hoverRadius);
					showTooltip(event, datum.country, datum.point, datum.color);
				})
				.on("mousemove", function (event, datum) {
					showTooltip(event, datum.country, datum.point, datum.color);
				})
				.on("mouseleave", function () {
					d3.select(this).attr("r", baseRadius);
					hideTooltip();
				});
		});

	svg
		.append("g")
		.selectAll("path")
		.data(anchorCountries)
		.join("path")
		.attr("fill", "none")
		.attr("stroke", (country) => getAnchorColor(country.slug))
		.attr("stroke-width", (country) => (country.slug === state.selectedCountrySlug ? 5 : 3.4))
		.attr("stroke-opacity", 1)
		.attr("stroke-linecap", "round")
		.attr("stroke-linejoin", "round")
		.style("filter", (country) => (country.slug === state.selectedCountrySlug ? "drop-shadow(0 0 10px rgba(196, 59, 47, 0.52))" : "drop-shadow(0 0 6px rgba(0, 0, 0, 0.55))"))
		.attr("d", (country) => line(country.points));

	if (noMigrationComparisons.length > 0) {
		svg
			.append("g")
			.selectAll("path")
			.data(noMigrationComparisons)
			.join("path")
			.attr("fill", "none")
			.attr("stroke", (comparison) => comparison.color)
			.attr("stroke-width", 2.2)
			.attr("stroke-opacity", 0.8)
			.attr("stroke-dasharray", "8 5")
			.attr("stroke-linecap", "round")
			.attr("stroke-linejoin", "round")
			.attr("d", (comparison) => line(comparison.points));

		svg
			.append("g")
			.selectAll("circle")
			.data(
				noMigrationComparisons.flatMap((comparison) =>
					comparison.points.map((point) => ({
						country: comparison.country,
						point,
						color: comparison.color,
					}))
				)
			)
			.join("circle")
			.attr("cx", ({ point }) => x(point.year))
			.attr("cy", ({ point }) => y(getMetricValue(point)))
			.attr("r", 3.6)
			.attr("fill", chartColors.noMigrationFill)
			.attr("stroke", ({ color }) => color)
			.attr("stroke-width", 1.4)
			.style("cursor", "crosshair")
			.on("mouseenter", function (event, datum) {
				d3.select(this).attr("r", 5.4);
				showTooltip(event, datum.country, datum.point, datum.color, "zonder nettomigratie");
			})
			.on("mousemove", function (event, datum) {
				showTooltip(event, datum.country, datum.point, datum.color, "zonder nettomigratie");
			})
			.on("mouseleave", function () {
				d3.select(this).attr("r", 3.6);
				hideTooltip();
			});
	}

	svg
		.append("g")
		.selectAll("g")
		.data(anchorCountries)
		.join("g")
		.each(function (country) {
			const isSelected = country.slug === state.selectedCountrySlug;
			const color = getAnchorColor(country.slug);
			const baseRadius = isSelected ? 4.8 : 3.8;
			const hoverRadius = isSelected ? 6.8 : 5.8;

			d3.select(this)
				.selectAll("circle")
				.data(country.points.map((point) => ({ country, point, color })))
				.join("circle")
				.attr("cx", ({ point }) => x(point.year))
				.attr("cy", ({ point }) => y(getMetricValue(point)))
				.attr("r", baseRadius)
				.attr("fill", color)
				.attr("fill-opacity", 1)
				.attr("stroke", chartColors.pointStroke)
				.attr("stroke-width", isSelected ? 1.9 : 1.4)
				.style("filter", isSelected ? "drop-shadow(0 0 6px rgba(196, 59, 47, 0.52))" : "drop-shadow(0 0 4px rgba(0, 0, 0, 0.55))")
				.style("cursor", "crosshair")
				.on("mouseenter", function (event, datum) {
					d3.select(this).attr("r", hoverRadius);
					showTooltip(event, datum.country, datum.point, datum.color);
				})
				.on("mousemove", function (event, datum) {
					showTooltip(event, datum.country, datum.point, datum.color);
				})
				.on("mouseleave", function () {
					d3.select(this).attr("r", baseRadius);
					hideTooltip();
				});
		});

	svg.append("text").attr("x", margin.left).attr("y", 14).attr("fill", chartColors.red).attr("font-size", 13).attr("font-weight", 700).text(metricLabel);

	svg
		.append("text")
		.attr("x", margin.left + plotWidth)
		.attr("y", height - 10)
		.attr("fill", chartColors.red)
		.attr("font-size", 13)
		.attr("text-anchor", "end")
		.text("Jaar");

	const endLabelCountries = isPopulationMetric && state.showBackgroundCountries ? state.data.countries : highlightedCountries;
	const endLabels = buildEndLabels(endLabelCountries, y, margin.top + 8, margin.top + plotHeight - 8, 11);
	const labelAnchorX = x(years[1]);
	const labelTextX = labelAnchorX + 10;

	svg
		.append("g")
		.selectAll("line")
		.data(endLabels)
		.join("line")
		.attr("x1", labelAnchorX)
		.attr("x2", labelTextX - 4)
		.attr("y1", (label) => label.targetY)
		.attr("y2", (label) => label.y)
		.attr("stroke", (label) => {
			if (state.selectionWindows.has(label.country.slug)) {
				return getAnchorColor(label.country.slug);
			}
			return chartColors.labelLine;
		})
		.attr("stroke-opacity", (label) => (state.selectionWindows.has(label.country.slug) ? 0.9 : 0.55))
		.attr("stroke-width", (label) => (state.selectionWindows.has(label.country.slug) ? 1.2 : 0.8));

	svg
		.append("g")
		.selectAll("text")
		.data(endLabels)
		.join("text")
		.attr("x", labelTextX)
		.attr("y", (label) => label.y)
		.attr("dy", "0.32em")
		.attr("fill", (label) => {
			if (state.selectionWindows.has(label.country.slug)) {
				return getAnchorColor(label.country.slug);
			}
			return chartColors.labelText;
		})
		.attr("font-size", (label) => (state.selectionWindows.has(label.country.slug) ? 12 : 9.5))
		.attr("font-weight", (label) => {
			if (label.country.slug === state.selectedCountrySlug) {
				return 700;
			}
			return state.selectionWindows.has(label.country.slug) ? 600 : 400;
		})
		.text((label) => label.country.name);

	for (const comparison of noMigrationComparisons) {
		const finalPoint = comparison.points.at(-1);
		if (!finalPoint) {
			continue;
		}

		const labelY = y(getMetricValue(finalPoint));

		svg
			.append("line")
			.attr("x1", labelAnchorX)
			.attr("x2", labelTextX - 4)
			.attr("y1", labelY)
			.attr("y2", labelY)
			.attr("stroke", comparison.color)
			.attr("stroke-opacity", 0.9)
			.attr("stroke-width", 1)
			.attr("stroke-dasharray", "4 3");

		svg.append("text").attr("x", labelTextX).attr("y", labelY).attr("dy", "0.32em").attr("fill", comparison.color).attr("font-size", 10.5).attr("font-weight", 600).text(`${comparison.country.name} zonder nettomigratie`);
	}

	setStatus(
		`Toont ${state.data.countries.length} landen. ${getHighlightedCountries().length} gemarkeerd. ${state.selectionWindows.size} geselecteerde ankerlanden. Actief anker gebruikt ${state.neighborCount} buren aan elke kant. ${metricLabel}. ${
			isPopulationMetric ? (state.scaleMode === "log" ? "Logaritmische schaal" : "Lineaire schaal") : state.scaleMode === "log" ? "Symmetrisch-logaritmische percentageschaal" : "Lineaire percentageschaal"
		}. ${state.showBackgroundCountries ? "Niet-geselecteerde landen zichtbaar." : "Niet-geselecteerde landen verborgen."} ${state.showNoMigrationComparison && anchorCountries.length > 0 && isPopulationMetric ? `Vergelijkt ${anchorCountries.length} geselecteerde landen met ramingen zonder nettomigratie.` : ""}`
	);
	syncUrl();
}

async function main() {
	setStatus("Grafiekdata laden...");
	const response = await fetch(dataUrl);
	if (!response.ok) {
		throw new Error(`Kon ${dataUrl} niet laden`);
	}

	state.data = await response.json();

	const datalist = document.getElementById("world-population-country-list");
	for (const country of state.data.countries) {
		const option = document.createElement("option");
		option.value = country.name;
		datalist.append(option);
	}

	applyUrlState();

	if (!state.selectedCountrySlug && state.selectionWindows.size === 0) {
		const defaultCountry = state.data.countries.find((country) => country.name === "Netherlands");
		if (defaultCountry) {
			applySelectedCountry(defaultCountry);
		}
	}

	render();

	const resizeObserver = new ResizeObserver(() => render());
	resizeObserver.observe(chartRoot);
}

highlightButton?.addEventListener("click", addHighlightFromInput);
highlightInput?.addEventListener("keydown", (event) => {
	if (event.key === "Enter") {
		event.preventDefault();
		addHighlightFromInput();
	}
});

resetButton?.addEventListener("click", () => {
	state.selectedCountrySlug = null;
	state.selectionWindows.clear();
	state.continentHighlights.clear();
	state.highlightedSlugs.clear();
	highlightInput.value = "";
	hideTooltip();
	render();
});

neighborRange?.addEventListener("input", () => {
	state.neighborCount = Number(neighborRange.value);
	updateNeighborCountLabel();

	const selectedName = highlightInput?.value.trim();
	if (selectedName) {
		const selectedCountry = findCountryByInput(selectedName);
		if (selectedCountry) {
			state.selectedCountrySlug = selectedCountry.slug;
			state.selectionWindows.set(selectedCountry.slug, state.neighborCount);
			recomputeHighlights();
			hideTooltip();
			render();
			return;
		}
	}

	render();
});

for (const button of scaleButtons) {
	button.addEventListener("click", () => {
		state.scaleMode = button.dataset.worldPopulationScale;
		hideTooltip();
		render();
	});
}

for (const button of metricButtons) {
	button.addEventListener("click", () => {
		state.metricMode = button.dataset.worldPopulationMetric;
		hideTooltip();
		render();
	});
}

backgroundToggle?.addEventListener("input", () => {
	state.showBackgroundCountries = backgroundToggle.checked;
	hideTooltip();
	render();
});

noMigrationToggle?.addEventListener("input", () => {
	state.showNoMigrationComparison = noMigrationToggle.checked;
	hideTooltip();
	render();
});

main().catch((error) => {
	console.error(error);
	setStatus(`Chart failed to load: ${error.message}`);
});
