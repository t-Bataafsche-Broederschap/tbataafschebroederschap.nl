(() => {
	"use strict";

	const number = new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 1 });
	const integer = new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 0 });
	const percent = new Intl.NumberFormat("nl-NL", {
		minimumFractionDigits: 1,
		maximumFractionDigits: 1,
	});
	const ratioPercent = new Intl.NumberFormat("nl-NL", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	});
	const precisePercent = new Intl.NumberFormat("nl-NL", {
		minimumFractionDigits: 4,
		maximumFractionDigits: 4,
	});
	const aggregatePercent = new Intl.NumberFormat("nl-NL", {
		minimumFractionDigits: 3,
		maximumFractionDigits: 3,
	});
	const euro = new Intl.NumberFormat("nl-NL", {
		style: "currency",
		currency: "EUR",
		maximumFractionDigits: 0,
	});
	const corridorColors = ["#ff6b6b", "#4dabf7", "#63e6be", "#b197fc", "#ffa94d", "#74c0fc", "#e599f7", "#8ce99a", "#f783ac", "#66d9e8", "#c0eb75", "#fcc2d7", "#a5d8ff", "#d0bfff", "#96f2d7", "#ffc078", "#91a7ff", "#ff8787", "#69db7c", "#eebefa", "#99e9f2", "#d8f5a2", "#ff922b", "#5c7cfa", "#20c997"];

	const state = {
		data: null,
		corridorQuery: "",
		showCorridorTotal: true,
		incomeMetric: "personalIncomePerMemberThousandEur",
		incomeScope: "countries",
		proxyGroup: null,
	};

	const metricDefinitions = {
		personalIncomePerMemberThousandEur: {
			label: "persoonlijk inkomen per groepslid",
			format: (value) => euro.format(value * 1000),
		},
		averagePersonalIncomeThousandEur: {
			label: "persoonlijk inkomen per inkomensontvanger",
			format: (value) => euro.format(value * 1000),
		},
		averageStandardizedIncomeThousandEur: {
			label: "gestandaardiseerd huishoudensinkomen per persoon",
			format: (value) => euro.format(value * 1000),
		},
	};

	const byId = (id) => document.getElementById(id);

	function setBoundText(name, value) {
		document.querySelectorAll(`[data-bind="${name}"]`).forEach((element) => {
			element.textContent = value;
		});
	}

	function setStatus(message, status = "ready") {
		const element = byId("remittance-status");
		element.classList.toggle("is-ready", status === "ready");
		element.classList.toggle("is-error", status === "error");
		element.querySelector("span:last-child").textContent = message;
	}

	function hideTooltip(target = null) {
		const tooltip = byId("remittance-tooltip");
		tooltip.hidden = true;
		if (target) {
			target.removeAttribute("aria-describedby");
		}
	}

	function showTooltip(event, target, definition) {
		const tooltip = byId("remittance-tooltip");
		const title = document.createElement("strong");
		title.textContent = definition.title;
		const list = document.createElement("dl");
		definition.rows.forEach(([term, value]) => {
			const dt = document.createElement("dt");
			dt.textContent = term;
			const dd = document.createElement("dd");
			dd.textContent = value;
			list.append(dt, dd);
		});
		tooltip.replaceChildren(title, list);
		tooltip.hidden = false;
		target.setAttribute("aria-describedby", tooltip.id);

		const bounds = target.getBoundingClientRect();
		const positionEvent = event?.clientX ? event : { clientX: bounds.left + bounds.width / 2, clientY: bounds.bottom };
		window.positionProjectTooltip?.(positionEvent, tooltip, document.querySelector(".remittance-page"));
	}

	function attachTooltip(target, definition) {
		if (!target.matches("button, a, input, select, [tabindex]")) {
			target.tabIndex = 0;
		}
		target.addEventListener("pointerenter", (event) => showTooltip(event, target, definition));
		target.addEventListener("pointermove", (event) => showTooltip(event, target, definition));
		target.addEventListener("pointerleave", () => hideTooltip(target));
		target.addEventListener("focus", (event) => showTooltip(event, target, definition));
		target.addEventListener("blur", () => hideTooltip(target));
	}

	function valueAtYear(corridor, year) {
		const value = corridor.values.find((item) => item.year === year);
		return value ? value.millionEur : 0;
	}

	function formatMillion(value, long = false) {
		return long ? `€ ${number.format(value)} miljoen` : `€ ${number.format(value)} mln`;
	}

	function formatCumulative(value) {
		return `€ ${number.format(value / 1000)} mld`;
	}

	function bindSummary(data) {
		const { snapshot, remittances, income, economicContext } = data;
		const summary = remittances.summary;
		const reference = income.referenceGroups.find((group) => group.id === income.referenceGroupId);
		const first = remittances.timeline[0];
		const latest = remittances.timeline.at(-1);
		const latestChange = (latest.millionEur / first.millionEur - 1) * 100;
		const matchedIncomeMillionEur = data.ecologicalComparisons.reduce((total, comparison) => total + comparison.totalPersonalIncomeMillionEur, 0);
		const matchedProxyPct = (economicContext.matchedCorridorsMillionEur / matchedIncomeMillionEur) * 100;

		setBoundText("cbs-year", String(snapshot.cbsYear));
		setBoundText("dnb-year", String(snapshot.dnbLatestYear));
		setBoundText("dnb-period", snapshot.dnbPeriod);
		setBoundText("latest-total", formatMillion(summary.latestTotalMillionEur, true));
		setBoundText("latest-total-short", formatMillion(summary.latestTotalMillionEur));
		setBoundText("cumulative-total", formatCumulative(summary.cumulativeMillionEur));
		setBoundText("top25-share", `${percent.format(summary.top25ShareLatestPct)}%`);
		setBoundText("reference-income", euro.format(reference.personalIncomePerMemberThousandEur * 1000));
		setBoundText("change-2020", `${summary.change2020Pct < 0 ? "−" : "+"}${percent.format(Math.abs(summary.change2020Pct))}%`);
		setBoundText("latest-change", `${percent.format(latestChange)}%`);
		setBoundText("matched-share", `${percent.format(economicContext.matchedCorridorsShareOfTotalPct)}%`);
		setBoundText("matched-corridor-total", formatMillion(economicContext.matchedCorridorsMillionEur));
		setBoundText("matched-income-total", formatCumulative(matchedIncomeMillionEur));
		setBoundText("matched-proxy-pct", `${aggregatePercent.format(matchedProxyPct)}%`);
		setBoundText("impact-income-pct", `${precisePercent.format(economicContext.remittanceAsPctOfPersonalIncome)}%`);
		setBoundText("impact-consumption-pct", `${precisePercent.format(economicContext.remittanceAsPctOfHouseholdConsumption)}%`);
		setBoundText("impact-gdp-pct", `${precisePercent.format(economicContext.remittanceAsPctOfGdp)}%`);
	}

	function renderTrend(data) {
		const points = data.remittances.timeline;
		const width = 960;
		const height = 390;
		const margin = { top: 34, right: 30, bottom: 48, left: 58 };
		const innerWidth = width - margin.left - margin.right;
		const innerHeight = height - margin.top - margin.bottom;
		const maxValue = Math.ceil(Math.max(...points.map((item) => item.millionEur)) / 100) * 100;
		const x = (index) => margin.left + (index / (points.length - 1)) * innerWidth;
		const y = (value) => margin.top + innerHeight - (value / maxValue) * innerHeight;
		const line = points.map((item, index) => `${index ? "L" : "M"} ${x(index)} ${y(item.millionEur)}`).join(" ");
		const area = `${line} L ${x(points.length - 1)} ${margin.top + innerHeight} L ${x(0)} ${margin.top + innerHeight} Z`;
		const yTicks = [0, maxValue / 2, maxValue];
		const controlIndex = points.findIndex((item) => item.year === 2020);

		byId("trend-chart").innerHTML = `
			<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Totale remittance-uitstroom per jaar in miljoenen euro">
				${yTicks
					.map(
						(tick) => `
							<line class="grid-line" x1="${margin.left}" x2="${width - margin.right}" y1="${y(tick)}" y2="${y(tick)}"></line>
							<text class="axis-label" x="${margin.left - 12}" y="${y(tick) + 4}" text-anchor="end">${integer.format(tick)}</text>
						`
					)
					.join("")}
				<path class="trend-area" d="${area}"></path>
				<path class="trend-line" d="${line}"></path>
				<line class="control-line" x1="${x(controlIndex)}" x2="${x(controlIndex)}" y1="${margin.top}" y2="${margin.top + innerHeight}"></line>
				<text class="control-label" x="${x(controlIndex) + 8}" y="${margin.top + 15}">controlepunt −44%</text>
				${points
					.map(
						(item, index) => `
							<circle class="trend-dot" cx="${x(index)}" cy="${y(item.millionEur)}" r="5">
								<title>${item.year}: € ${integer.format(item.millionEur)} miljoen</title>
							</circle>
							<text class="axis-label" x="${x(index)}" y="${height - 16}" text-anchor="middle">${item.year}</text>
						`
					)
					.join("")}
			</svg>
		`;
		byId("trend-chart")
			.querySelectorAll(".trend-dot")
			.forEach((dot, index) => {
				const point = points[index];
				const previous = points[index - 1];
				const rows = [["Totale uitstroom", formatMillion(point.millionEur, true)]];
				if (previous) {
					const change = (point.millionEur / previous.millionEur - 1) * 100;
					rows.push(["Verschil met vorig jaar", `${change < 0 ? "−" : "+"}${percent.format(Math.abs(change))}%`]);
				}
				rows.push(["Bron", "DNB"]);
				attachTooltip(dot, { title: String(point.year), rows });
			});
	}

	function makeBar({ label, value, width, referencePosition = null, reference = false, tooltip = null }) {
		const row = document.createElement("div");
		row.className = `remittance-bar${reference ? " is-reference" : ""}`;

		const labelElement = document.createElement("span");
		labelElement.className = "remittance-bar__label";
		labelElement.textContent = label;
		labelElement.title = label;

		const track = document.createElement("span");
		track.className = "remittance-bar__track";
		const fill = document.createElement("span");
		fill.className = "remittance-bar__fill";
		fill.style.setProperty("--bar-width", `${Math.max(0, Math.min(100, width))}%`);
		track.append(fill);
		if (referencePosition !== null) {
			const marker = document.createElement("span");
			marker.className = "remittance-bar__reference";
			marker.style.setProperty("--reference-position", `${Math.max(0, Math.min(100, referencePosition))}%`);
			marker.title = "Nederlandse referentie";
			track.append(marker);
		}

		const valueElement = document.createElement("span");
		valueElement.className = "remittance-bar__value";
		valueElement.textContent = value;
		row.append(labelElement, track, valueElement);
		if (tooltip) {
			attachTooltip(row, tooltip);
		}
		return row;
	}

	function filteredCorridors() {
		const latestYear = state.data.snapshot.dnbLatestYear;
		const query = state.corridorQuery.trim().toLocaleLowerCase("nl-NL");
		return state.data.remittances.corridors
			.slice()
			.sort((a, b) => valueAtYear(b, latestYear) - valueAtYear(a, latestYear) || a.destination.localeCompare(b.destination, "nl"))
			.filter((corridor) => !query || corridor.destination.toLocaleLowerCase("nl-NL").includes(query));
	}

	function renderCorridors() {
		const totalTimeline = state.data.remittances.timeline;
		const years = totalTimeline.map((item) => item.year);
		const totalsByYear = new Map(totalTimeline.map((item) => [item.year, item.millionEur]));
		const allCorridors = state.data.remittances.corridors;
		const corridors = filteredCorridors();
		const chart = byId("corridor-lines");
		const legend = byId("corridor-line-legend");
		const colorByDestination = new Map(
			allCorridors
				.slice()
				.sort((a, b) => a.destination.localeCompare(b.destination, "nl"))
				.map((corridor, index) => [corridor.destination, corridorColors[index % corridorColors.length]])
		);
		if (!corridors.length && !state.showCorridorTotal) {
			const empty = document.createElement("p");
			empty.className = "remittance-filter-empty";
			empty.textContent = "Geen bestemming gevonden binnen de 25 gepubliceerde corridors.";
			chart.replaceChildren(empty);
			legend.replaceChildren();
		} else {
			const width = 1100;
			const height = 560;
			const margin = { top: 30, right: 30, bottom: 54, left: 62 };
			const innerWidth = width - margin.left - margin.right;
			const innerHeight = height - margin.top - margin.bottom;
			const countryMax = Math.max(...allCorridors.flatMap((corridor) => corridor.values.map((item) => item.millionEur)));
			const totalMax = Math.max(...totalTimeline.map((item) => item.millionEur));
			const rawMax = state.showCorridorTotal ? Math.max(countryMax, totalMax) : countryMax;
			const tickStep = state.showCorridorTotal ? 100 : 25;
			const maxValue = Math.ceil(rawMax / tickStep) * tickStep;
			const x = (index) => margin.left + (index / (years.length - 1)) * innerWidth;
			const y = (value) => margin.top + innerHeight - (value / maxValue) * innerHeight;
			const yTicks = [0, maxValue / 3, (maxValue / 3) * 2, maxValue];
			chart.innerHTML = `
				<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Remittance-corridors${state.showCorridorTotal ? " en totale Nederlandse uitstroom" : ""} in miljoenen euro, 2016 tot en met 2025">
					${yTicks
						.map(
							(tick) => `
								<line class="grid-line" x1="${margin.left}" x2="${width - margin.right}" y1="${y(tick)}" y2="${y(tick)}"></line>
								<text class="axis-label" x="${margin.left - 12}" y="${y(tick) + 4}" text-anchor="end">${number.format(tick)}</text>
							`
						)
						.join("")}
					${years.map((year, index) => `<text class="axis-label" x="${x(index)}" y="${height - 18}" text-anchor="middle">${year}</text>`).join("")}
					<g class="corridor-series-layer"></g>
				</svg>
			`;
			const svg = chart.querySelector("svg");
			const layer = chart.querySelector(".corridor-series-layer");
			const namespace = "http://www.w3.org/2000/svg";
			const lineElements = new Map();

			const pointIndexForEvent = (event) => {
				if (event.type === "focus") return years.length - 1;
				const bounds = svg.getBoundingClientRect();
				const svgX = ((event.clientX - bounds.left) / bounds.width) * width;
				return Math.max(0, Math.min(years.length - 1, Math.round(((svgX - margin.left) / innerWidth) * (years.length - 1))));
			};

			const showCorridorTooltip = (event, target, corridor) => {
				const point = corridor.values[pointIndexForEvent(event)];
				const total = totalsByYear.get(point.year);
				showTooltip(event, target, {
					title: `${corridor.destination} · ${point.year}`,
					rows: [
						["Geld naar bestemming", formatMillion(point.millionEur, true)],
						["Aandeel totale NL-uitstroom", `${percent.format((point.millionEur / total) * 100)}%`],
						["Afzenders", "Onbekend"],
					],
				});
			};
			const showTotalTooltip = (event, target) => {
				const point = totalTimeline[pointIndexForEvent(event)];
				showTooltip(event, target, {
					title: `Totaal Nederland · ${point.year}`,
					rows: [["Totale uitstroom", formatMillion(point.millionEur, true)]],
				});
			};

			corridors.forEach((corridor) => {
				const pathData = corridor.values.map((item, index) => `${index ? "L" : "M"} ${x(index)} ${y(item.millionEur)}`).join(" ");
				const visible = document.createElementNS(namespace, "path");
				visible.setAttribute("class", `corridor-series${corridors.length === 1 ? " is-active" : ""}`);
				visible.setAttribute("d", pathData);
				visible.style.setProperty("--series-color", colorByDestination.get(corridor.destination));
				const hit = document.createElementNS(namespace, "path");
				hit.setAttribute("class", "corridor-series-hit");
				hit.setAttribute("d", pathData);
				hit.setAttribute("tabindex", corridors.length === 1 ? "0" : "-1");
				hit.setAttribute("aria-label", `${corridor.destination}, remittance-corridor 2016 tot en met 2025`);
				const activate = () => visible.classList.add("is-active");
				const deactivate = () => {
					if (corridors.length !== 1) visible.classList.remove("is-active");
				};
				hit.addEventListener("pointerenter", (event) => {
					activate();
					showCorridorTooltip(event, hit, corridor);
				});
				hit.addEventListener("pointermove", (event) => showCorridorTooltip(event, hit, corridor));
				hit.addEventListener("pointerleave", () => {
					deactivate();
					hideTooltip(hit);
				});
				hit.addEventListener("focus", (event) => {
					activate();
					showCorridorTooltip(event, hit, corridor);
				});
				hit.addEventListener("blur", () => {
					deactivate();
					hideTooltip(hit);
				});
				layer.append(visible, hit);
				lineElements.set(corridor.destination, visible);
			});

			if (state.showCorridorTotal) {
				const pathData = totalTimeline.map((item, index) => `${index ? "L" : "M"} ${x(index)} ${y(item.millionEur)}`).join(" ");
				const visible = document.createElementNS(namespace, "path");
				visible.setAttribute("class", "corridor-total-series");
				visible.setAttribute("d", pathData);
				const hit = document.createElementNS(namespace, "path");
				hit.setAttribute("class", "corridor-total-hit");
				hit.setAttribute("d", pathData);
				hit.setAttribute("tabindex", "0");
				hit.setAttribute("aria-label", "Totale Nederlandse remittance-uitstroom 2016 tot en met 2025");
				hit.addEventListener("pointerenter", (event) => showTotalTooltip(event, hit));
				hit.addEventListener("pointermove", (event) => showTotalTooltip(event, hit));
				hit.addEventListener("pointerleave", () => hideTooltip(hit));
				hit.addEventListener("focus", (event) => showTotalTooltip(event, hit));
				hit.addEventListener("blur", () => hideTooltip(hit));
				layer.append(visible, hit);
			}

			legend.replaceChildren(
				...corridors.map((corridor) => {
					const button = document.createElement("button");
					const latestYear = years.at(-1);
					const latestValue = valueAtYear(corridor, latestYear);
					const cumulative = corridor.values.reduce((total, item) => total + item.millionEur, 0);
					button.type = "button";
					button.textContent = corridor.destination;
					button.style.setProperty("--series-color", colorByDestination.get(corridor.destination));
					button.title = `Toon alleen ${corridor.destination}`;
					button.addEventListener("pointerenter", () => lineElements.get(corridor.destination).classList.add("is-active"));
					button.addEventListener("pointerleave", () => lineElements.get(corridor.destination).classList.remove("is-active"));
					button.addEventListener("focus", () => lineElements.get(corridor.destination).classList.add("is-active"));
					button.addEventListener("blur", () => lineElements.get(corridor.destination).classList.remove("is-active"));
					attachTooltip(button, {
						title: corridor.destination,
						rows: [
							[`${latestYear}`, formatMillion(latestValue, true)],
							[`Aandeel NL-totaal ${latestYear}`, `${percent.format((latestValue / totalsByYear.get(latestYear)) * 100)}%`],
							["Totaal 2016–2025", formatMillion(cumulative, true)],
							["Afzenders", "Onbekend"],
						],
					});
					button.addEventListener("click", () => {
						state.corridorQuery = corridor.destination;
						byId("corridor-filter").value = corridor.destination;
						renderCorridors();
					});
					return button;
				})
			);
		}

		const headerRow = document.createElement("tr");
		["Bestemming", ...years].forEach((label) => {
			const th = document.createElement("th");
			th.scope = "col";
			th.textContent = label;
			headerRow.append(th);
		});
		byId("corridor-table-head").replaceChildren(headerRow);
		const body = byId("corridor-table-body");
		body.replaceChildren(
			...corridors.map((corridor) => {
				const tr = document.createElement("tr");
				[corridor.destination, ...years.map((year) => number.format(valueAtYear(corridor, year)))].forEach((value) => {
					const td = document.createElement("td");
					td.textContent = value;
					tr.append(td);
				});
				return tr;
			})
		);
		byId("corridor-table-caption").textContent = `${corridors.length} zichtbare remittance-bestemmingen, 2016–2025, in miljoenen euro`;
		byId("corridor-result-count").value = `${corridors.length} van ${allCorridors.length} landen`;
		byId("corridor-filter-reset").hidden = !state.corridorQuery;
	}

	function incomeGroups() {
		const reference = state.data.income.referenceGroups.find((group) => group.id === state.data.income.referenceGroupId);
		if (state.incomeScope === "generations") {
			return state.data.income.referenceGroups;
		}
		return [reference, ...state.data.income.countryGroups];
	}

	function renderIncome() {
		const metric = metricDefinitions[state.incomeMetric];
		const groups = incomeGroups()
			.slice()
			.sort((a, b) => b[state.incomeMetric] - a[state.incomeMetric]);
		const reference = state.data.income.referenceGroups.find((group) => group.id === state.data.income.referenceGroupId);
		const max = Math.max(...groups.map((group) => group[state.incomeMetric])) * 1.04;
		const referencePosition = (reference[state.incomeMetric] / max) * 100;
		const bars = groups.map((group) =>
			makeBar({
				label: group.label,
				value: metric.format(group[state.incomeMetric]),
				width: (group[state.incomeMetric] / max) * 100,
				referencePosition,
				reference: group.id === reference.id,
				tooltip: {
					title: group.label,
					rows: [
						[metric.label, metric.format(group[state.incomeMetric])],
						["Bevolking in groep", integer.format(group.populationThousands * 1000)],
						["Aandeel inkomensontvangers", `${percent.format(group.incomeRecipientSharePct)}%`],
						["Totaal persoonlijk inkomen", formatCumulative(group.totalPersonalIncomeMillionEur)],
					],
				},
			})
		);
		byId("income-bars").replaceChildren(...bars);
		byId("income-reference-value").textContent = `${metric.format(reference[state.incomeMetric])} · ${metric.label}`;
	}

	function renderProxyDetail(comparison) {
		const detail = byId("proxy-detail");
		detail.replaceChildren();
		const eyebrow = document.createElement("p");
		eyebrow.className = "eyebrow";
		eyebrow.textContent = "Geselecteerde schaalproxy";
		const title = document.createElement("h3");
		title.textContent = comparison.group;
		const list = document.createElement("dl");
		const values = [
			["Geld naar dit land", formatMillion(comparison.remittanceMillionEur)],
			["Afzenders van dat geld", "Onbekend"],
			["Inkomen gelijknamige CBS-groep", formatCumulative(comparison.totalPersonalIncomeMillionEur)],
			["Schaalproxy: corridor ÷ groepsinkomen", `${ratioPercent.format(comparison.remittanceAsPctOfIncome)}%`],
			["Corridor als aandeel alle NL-remittances", `${percent.format(comparison.remittanceShareOfNetherlandsTotalPct)}%`],
			["Werkelijk door deze groep verzonden", "Onbekend"],
		];
		values.forEach(([term, value]) => {
			const dt = document.createElement("dt");
			dt.textContent = term;
			const dd = document.createElement("dd");
			dd.textContent = value;
			list.append(dt, dd);
		});
		const note = document.createElement("p");
		note.textContent = "De landnaam is de enige koppeling. Het corridorbedrag en het groepsinkomen zijn bekend; verzendgedrag van de groep niet.";
		detail.append(eyebrow, title, list, note);
	}

	function renderProxy() {
		const comparisons = state.data.ecologicalComparisons;
		const max = Math.max(...comparisons.map((item) => item.remittanceAsPctOfIncome));
		if (!state.proxyGroup) {
			state.proxyGroup = comparisons[0].groupId;
		}
		const rows = comparisons.map((comparison) => {
			const row = document.createElement("button");
			row.type = "button";
			row.className = `remittance-bar${comparison.groupId === state.proxyGroup ? " is-selected" : ""}`;
			row.setAttribute(
				"aria-label",
				`${comparison.group}: ${formatMillion(comparison.remittanceMillionEur)} naar het land, afzenders onbekend; ${formatCumulative(comparison.totalPersonalIncomeMillionEur)} inkomen van de gelijknamige CBS-groep; schaalproxy ${ratioPercent.format(comparison.remittanceAsPctOfIncome)} procent; corridor is ${percent.format(comparison.remittanceShareOfNetherlandsTotalPct)} procent van alle Nederlandse remittances; toon details`
			);
			const bar = makeBar({
				label: comparison.group,
				value: "",
				width: (comparison.remittanceAsPctOfIncome / max) * 100,
			});
			row.append(...bar.children);
			const value = row.querySelector(".remittance-bar__value");
			const visibleValues = [
				[formatMillion(comparison.remittanceMillionEur), "naar land"],
				[formatCumulative(comparison.totalPersonalIncomeMillionEur), "groepsinkomen"],
				[`${ratioPercent.format(comparison.remittanceAsPctOfIncome)}%`, "proxy"],
				[`${percent.format(comparison.remittanceShareOfNetherlandsTotalPct)}%`, "NL-totaal"],
			];
			value.replaceChildren(
				...visibleValues.map(([amount, label]) => {
					const stat = document.createElement("span");
					const strong = document.createElement("strong");
					strong.textContent = amount;
					const small = document.createElement("small");
					small.textContent = label;
					stat.append(strong, small);
					return stat;
				})
			);
			attachTooltip(row, {
				title: `${comparison.group} · 2024`,
				rows: [
					["Geld naar land", formatMillion(comparison.remittanceMillionEur, true)],
					["Afzenders", "Onbekend"],
					["Inkomen gelijknamige groep", formatCumulative(comparison.totalPersonalIncomeMillionEur)],
					["Schaalproxy", `${ratioPercent.format(comparison.remittanceAsPctOfIncome)}%`],
					["Aandeel alle NL-remittances", `${percent.format(comparison.remittanceShareOfNetherlandsTotalPct)}%`],
				],
			});
			row.addEventListener("click", () => {
				state.proxyGroup = comparison.groupId;
				renderProxy();
			});
			return row;
		});
		byId("proxy-bars").replaceChildren(...rows);
		renderProxyDetail(comparisons.find((item) => item.groupId === state.proxyGroup));
	}

	function renderQuality(data) {
		const warnings = byId("quality-warnings");
		warnings.replaceChildren(
			...data.quality.warnings.map((warning) => {
				const item = document.createElement("li");
				item.textContent = warning;
				return item;
			})
		);

		const receiptLabels = {
			cbsObservationCount: "CBS-waarnemingen",
			nationalAccountsObservationCount: "Nationale-rekeningenwaarnemingen",
			incomeCountryGroupCount: "Herkomstlanden",
			dnbCorridorCount: "DNB-corridors",
			exactEcologicalMatchCount: "Exacte naammatches",
		};
		const receipts = byId("quality-receipts");
		receipts.replaceChildren();
		Object.entries(receiptLabels).forEach(([key, label]) => {
			const term = document.createElement("dt");
			term.textContent = label;
			const value = document.createElement("dd");
			value.textContent = integer.format(data.quality.receipts[key]);
			receipts.append(term, value);
		});
		const generated = new Date(data.generatedAt);
		byId("generated-at").dateTime = data.generatedAt;
		byId("generated-at").textContent = generated.toLocaleString("nl-NL", {
			dateStyle: "long",
			timeStyle: "short",
			timeZone: "Europe/Amsterdam",
		});
	}

	function bindImpactTooltips(data) {
		const context = data.economicContext;
		const definitions = [
			["impact-income-pct", "Remittance / persoonlijk inkomen", context.totalPersonalIncomeMillionEur],
			["impact-consumption-pct", "Remittance / huishoudconsumptie", context.householdConsumptionMillionEur],
			["impact-gdp-pct", "Remittance / bbp", context.gdpMillionEur],
		];
		definitions.forEach(([binding, title, denominator]) => {
			const card = document.querySelector(`[data-bind="${binding}"]`)?.closest("article");
			if (card) {
				attachTooltip(card, {
					title,
					rows: [
						["Remittance 2024", formatMillion(context.grossRemittanceMillionEur, true)],
						["Noemer", formatCumulative(denominator)],
						["Interpretatie", "Economische schaal, geen schade"],
					],
				});
			}
		});
	}

	function renderImpactScenario() {
		const context = state.data.economicContext;
		const share = Number(byId("impact-spend-share").value);
		const vatRate = Number(byId("impact-vat-rate").value);
		const displaced = context.grossRemittanceMillionEur * (share / 100);
		const vat = vatRate ? displaced * (vatRate / (100 + vatRate)) : 0;
		byId("impact-spend-share-output").value = `${integer.format(share)}%`;
		byId("impact-displaced-spending").textContent = formatMillion(displaced);
		byId("impact-vat-component").textContent = formatMillion(vat);
	}

	function csvCell(value) {
		let text = String(value ?? "");
		if (/^[=+\-@]/.test(text)) {
			text = `'${text}`;
		}
		return `"${text.replaceAll('"', '""')}"`;
	}

	function downloadCsv(filename, rows) {
		const csv = rows.map((row) => row.map(csvCell).join(";")).join("\n");
		const blob = new Blob([new Uint8Array([0xef, 0xbb, 0xbf]), csv], {
			type: "text/csv;charset=utf-8",
		});
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = filename;
		document.body.append(link);
		link.click();
		link.remove();
		URL.revokeObjectURL(url);
	}

	function bindControls() {
		document.querySelectorAll("#income-metric button").forEach((button) => {
			button.addEventListener("click", () => {
				state.incomeMetric = button.dataset.metric;
				document.querySelectorAll("#income-metric button").forEach((item) => {
					item.setAttribute("aria-pressed", String(item === button));
				});
				renderIncome();
			});
		});

		byId("income-scope").addEventListener("change", (event) => {
			state.incomeScope = event.target.value;
			renderIncome();
		});

		byId("corridor-filter").addEventListener("input", (event) => {
			state.corridorQuery = event.target.value;
			renderCorridors();
		});
		byId("corridor-filter-reset").addEventListener("click", () => {
			state.corridorQuery = "";
			byId("corridor-filter").value = "";
			renderCorridors();
			byId("corridor-filter").focus();
		});
		byId("corridor-total-toggle").addEventListener("change", (event) => {
			state.showCorridorTotal = event.target.checked;
			renderCorridors();
		});

		byId("impact-spend-share").addEventListener("input", renderImpactScenario);
		byId("impact-vat-rate").addEventListener("change", renderImpactScenario);

		byId("download-corridors").addEventListener("click", () => {
			const years = state.data.remittances.timeline.map((item) => item.year);
			const corridors = filteredCorridors();
			downloadCsv("remittance-bestemmingen-2016-2025.csv", [["bestemming", ...years.map((year) => `${year}_miljoen_euro`)], ...corridors.map((corridor) => [corridor.destination, ...years.map((year) => valueAtYear(corridor, year))])]);
		});

		byId("download-income").addEventListener("click", () => {
			downloadCsv("inkomen-naar-herkomst-2024.csv", [
				["groep", "categorie", "bevolking_duizend", "inkomensontvangers_duizend", "persoonlijk_inkomen_per_ontvanger_duizend_euro", "persoonlijk_inkomen_per_groepslid_duizend_euro", "gestandaardiseerd_inkomen_duizend_euro", "totaal_persoonlijk_inkomen_miljoen_euro"],
				...[...state.data.income.referenceGroups, ...state.data.income.countryGroups].map((group) => [
					group.label,
					group.kind,
					group.populationThousands,
					group.incomeRecipientsThousands,
					group.averagePersonalIncomeThousandEur,
					group.personalIncomePerMemberThousandEur,
					group.averageStandardizedIncomeThousandEur,
					group.totalPersonalIncomeMillionEur,
				]),
			]);
		});
	}

	async function start() {
		try {
			const response = await fetch("data.json", {
				headers: { Accept: "application/json" },
			});
			if (!response.ok) {
				throw new Error(`data.json antwoordde met HTTP ${response.status}`);
			}
			state.data = await response.json();
			const urlParams = new URLSearchParams(window.location.search);
			const vatRate = byId("impact-vat-rate");
			if (["0", "9", "21"].includes(urlParams.get("btw")) && vatRate) vatRate.value = urlParams.get("btw");
			bindSummary(state.data);
			bindImpactTooltips(state.data);
			renderTrend(state.data);
			renderCorridors();
			renderIncome();
			renderProxy();
			renderImpactScenario();
			renderQuality(state.data);
			bindControls();
			setStatus(`Brondata geladen · CBS ${state.data.snapshot.cbsYear} voorlopig · DNB t/m ${state.data.snapshot.dnbLatestYear}`);
		} catch (error) {
			console.error(error);
			setStatus("De interactieve brondata kon niet worden geladen; gebruik de JSON-download of probeer de pagina opnieuw.", "error");
		}
	}

	start();
})();
