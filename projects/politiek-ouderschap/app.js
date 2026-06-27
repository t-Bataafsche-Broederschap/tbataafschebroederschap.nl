const STATUS_LABELS = {
	yes: "Ouder bekend",
	no: "Expliciet geen kinderen",
	unknown: "Onbekend",
};

const STATUS_ORDER = ["yes", "no", "unknown"];

const state = {
	data: null,
	partySort: {
		key: "yes",
		direction: "desc",
	},
	filters: {
		chamber: "all",
		status: "all",
		party: "all",
		search: "",
	},
};

const elements = {
	summary: document.querySelector("#summaryStrip"),
	dataStamp: document.querySelector("#dataStamp"),
	chamberFilter: document.querySelector("#chamberFilter"),
	statusFilter: document.querySelector("#statusFilter"),
	partyFilter: document.querySelector("#partyFilter"),
	searchInput: document.querySelector("#searchInput"),
	chamberBreakdown: document.querySelector("#chamberBreakdown"),
	partyBreakdownMeta: document.querySelector("#partyBreakdownMeta"),
	partyBreakdownBody: document.querySelector("#partyBreakdownTable tbody"),
	partySortButtons: [...document.querySelectorAll("#partyBreakdownTable [data-party-sort]")],
	resultCount: document.querySelector("#resultCount"),
	tableBody: document.querySelector("#membersTable tbody"),
};

init();

async function init() {
	const response = await fetch("data.json");
	state.data = await response.json();
	setupFilters();
	render();
}

function setupFilters() {
	const members = state.data.members;
	const chambers = uniqueOptions(members.map((member) => member.chamber));
	const parties = uniqueOptions(members.map((member) => member.party));

	fillSelect(elements.chamberFilter, [["all", "Alle Kamers"], ...chambers.map((value) => [value, value])]);
	fillSelect(elements.statusFilter, [["all", "Alle statussen"], ...STATUS_ORDER.map((value) => [value, STATUS_LABELS[value]])]);
	fillSelect(elements.partyFilter, [["all", "Alle fracties"], ...parties.map((value) => [value, value])]);

	elements.chamberFilter.addEventListener("change", () => {
		state.filters.chamber = elements.chamberFilter.value;
		render();
	});
	elements.statusFilter.addEventListener("change", () => {
		state.filters.status = elements.statusFilter.value;
		render();
	});
	elements.partyFilter.addEventListener("change", () => {
		state.filters.party = elements.partyFilter.value;
		render();
	});
	elements.searchInput.addEventListener("input", () => {
		state.filters.search = elements.searchInput.value.trim().toLowerCase();
		render();
	});
	setupPartySort();
}

function setupPartySort() {
	elements.partySortButtons.forEach((button) => {
		button.addEventListener("click", () => {
			const key = button.dataset.partySort;
			const defaultDirection = key === "party" ? "asc" : "desc";
			state.partySort = {
				key,
				direction: state.partySort.key === key && state.partySort.direction === defaultDirection ? oppositeDirection(defaultDirection) : defaultDirection,
			};
			render();
		});
	});
}

function uniqueOptions(values) {
	return [...new Set(values)].sort((a, b) => a.localeCompare(b, "nl"));
}

function fillSelect(select, options) {
	select.replaceChildren(
		...options.map(([value, label]) => {
			const option = document.createElement("option");
			option.value = value;
			option.textContent = label;
			return option;
		})
	);
}

function render() {
	const members = filteredMembers();
	renderSummary();
	renderBreakdown();
	renderPartyBreakdown(partyBreakdownMembers());
	renderTable(members);
	elements.resultCount.textContent = `${members.length} van ${state.data.members.length} leden`;
	elements.dataStamp.textContent = `Data opgehaald ${formatDate(state.data.generatedAt)}`;
}

function filteredMembers() {
	const { chamber, status, party, search } = state.filters;
	return state.data.members.filter((member) => {
		if (chamber !== "all" && member.chamber !== chamber) return false;
		if (status !== "all" && member.parentStatus !== status) return false;
		if (party !== "all" && member.party !== party) return false;
		if (search) {
			const haystack = `${member.name} ${member.displayName} ${member.party} ${member.chamber}`.toLowerCase();
			if (!haystack.includes(search)) return false;
		}
		return true;
	});
}

function partyBreakdownMembers() {
	return state.data.members.filter((member) => state.filters.chamber === "all" || member.chamber === state.filters.chamber);
}

function renderSummary() {
	const { summary } = state.data;
	const cards = [
		["Totaal", summary.total, "zittende Kamerleden"],
		["Ouder bekend", summary.statusCounts.yes, "expliciete kindervermelding"],
		["Onbekend", summary.statusCounts.unknown, "geen expliciete vermelding"],
		["Geen kinderen", summary.statusCounts.no, "expliciet geen kinderen"],
	];

	elements.summary.replaceChildren(
		...cards.map(([label, value, sublabel]) => {
			const article = document.createElement("article");
			article.className = "summary-card";
			article.innerHTML = `<span>${label}</span><strong>${formatNumber(value)}</strong><small>${sublabel}</small>`;
			return article;
		})
	);
}

function renderBreakdown() {
	const chambers = Object.entries(state.data.summary.chambers).sort(([a], [b]) => a.localeCompare(b, "nl"));
	elements.chamberBreakdown.replaceChildren(
		...chambers.map(([chamber, counts]) => {
			const article = document.createElement("article");
			article.className = "breakdown-card";
			const yesShare = counts.total ? (counts.yes / counts.total) * 100 : 0;
			const unknownShare = counts.total ? (counts.unknown / counts.total) * 100 : 0;
			const noShare = Math.max(0, 100 - yesShare - unknownShare);
			article.innerHTML = `
				<h3>${chamber}</h3>
				<div class="status-bar" aria-label="${chamber}: ${counts.yes} ouder bekend, ${counts.unknown} onbekend">
					<span class="status-bar__yes" style="width: ${yesShare}%"></span>
					<span class="status-bar__unknown" style="width: ${unknownShare}%"></span>
					<span class="status-bar__no" style="width: ${noShare}%"></span>
				</div>
				<dl>
					<div><dt>Ouder bekend</dt><dd>${formatNumber(counts.yes)}</dd></div>
					<div><dt>Onbekend</dt><dd>${formatNumber(counts.unknown)}</dd></div>
					<div><dt>Totaal</dt><dd>${formatNumber(counts.total)}</dd></div>
				</dl>
			`;
			return article;
		})
	);
}

function renderPartyBreakdown(members) {
	const rows = [...groupByParty(members).entries()].map(([party, counts]) => ({ party, ...counts, knownShare: counts.total ? counts.yes / counts.total : 0 })).sort(comparePartyRows);

	updatePartySortHeaders();
	elements.partyBreakdownMeta.textContent = `${formatNumber(members.length)} leden${state.filters.chamber === "all" ? ", beide Kamers samen" : `, ${state.filters.chamber}`}`;
	elements.partyBreakdownBody.replaceChildren(
		...rows.map((row) => {
			const tableRow = document.createElement("tr");

			const partyCell = document.createElement("th");
			partyCell.scope = "row";
			partyCell.textContent = row.party;

			const totalCell = numericCell(row.total, "metric metric--total");
			const yesCell = numericCell(row.yes, "metric metric--yes");
			const noCell = numericCell(row.no, "metric metric--no");
			const unknownCell = numericCell(row.unknown, "metric metric--unknown");

			const shareCell = document.createElement("td");
			shareCell.className = "party-share-cell";
			const share = document.createElement("span");
			share.className = "party-share";
			share.textContent = formatPercent(row.knownShare);
			const bar = document.createElement("span");
			bar.className = "party-share-bar";
			bar.style.setProperty("--known-share", `${row.knownShare * 100}%`);
			shareCell.append(share, bar);

			tableRow.append(partyCell, totalCell, yesCell, noCell, unknownCell, shareCell);
			return tableRow;
		})
	);
}

function comparePartyRows(a, b) {
	const { key, direction } = state.partySort;
	const directionMultiplier = direction === "asc" ? 1 : -1;
	const primaryCompare = key === "party" ? a.party.localeCompare(b.party, "nl") : a[key] - b[key];
	if (primaryCompare !== 0) return primaryCompare * directionMultiplier;
	return defaultPartyCompare(a, b);
}

function defaultPartyCompare(a, b) {
	return b.yes - a.yes || b.knownShare - a.knownShare || a.party.localeCompare(b.party, "nl");
}

function updatePartySortHeaders() {
	elements.partySortButtons.forEach((button) => {
		const isActive = button.dataset.partySort === state.partySort.key;
		const direction = isActive ? state.partySort.direction : "";
		if (direction) button.dataset.sortDirection = direction;
		else button.removeAttribute("data-sort-direction");
		const indicator = button.querySelector(".sort-button__indicator");
		if (indicator) indicator.textContent = direction === "asc" ? "↑" : direction === "desc" ? "↓" : "↕";
		button.closest("th").setAttribute("aria-sort", isActive ? (direction === "asc" ? "ascending" : "descending") : "none");
	});
}

function oppositeDirection(direction) {
	return direction === "asc" ? "desc" : "asc";
}

function numericCell(value, className) {
	const cell = document.createElement("td");
	const marker = document.createElement("span");
	marker.className = className;
	marker.textContent = formatNumber(value);
	cell.append(marker);
	return cell;
}

function groupByParty(members) {
	const groups = new Map();
	for (const member of members) {
		if (!groups.has(member.party)) groups.set(member.party, { total: 0, yes: 0, no: 0, unknown: 0 });
		const counts = groups.get(member.party);
		counts.total += 1;
		counts[member.parentStatus] += 1;
	}
	return groups;
}

function renderTable(members) {
	elements.tableBody.replaceChildren(
		...members.map((member) => {
			const row = document.createElement("tr");
			row.dataset.status = member.parentStatus;
			const evidence = member.evidence || "Geen expliciete vermelding in de geraadpleegde biografie";

			const nameCell = document.createElement("th");
			nameCell.scope = "row";
			const link = document.createElement("a");
			link.href = member.sourceUrl;
			link.rel = "noopener noreferrer";
			link.target = "_blank";
			link.textContent = member.name;
			nameCell.append(link);

			const chamberCell = document.createElement("td");
			chamberCell.textContent = member.chamber;

			const partyCell = document.createElement("td");
			partyCell.textContent = member.party;

			const statusCell = document.createElement("td");
			const status = document.createElement("span");
			status.className = `status-pill status-pill--${member.parentStatus}`;
			status.textContent = STATUS_LABELS[member.parentStatus];
			statusCell.append(status);

			const evidenceCell = document.createElement("td");
			evidenceCell.textContent = evidence;

			row.append(nameCell, chamberCell, partyCell, statusCell, evidenceCell);
			return row;
		})
	);
}

function formatDate(value) {
	return new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium" }).format(new Date(value));
}

function formatNumber(value) {
	return new Intl.NumberFormat("nl-NL").format(value);
}

function formatPercent(value) {
	return new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 0, style: "percent" }).format(value);
}
