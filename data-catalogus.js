const numberFormat = new Intl.NumberFormat("nl-NL");
const query = new URLSearchParams(window.location.search);
const state = {
	producten: [],
	gegevensbronnen: [],
	gegevenssets: [],
	relaties: [],
	bewerkingen: [],
	varianten: [],
	visualisaties: [],
	begrippen: [],
	zoek: "",
	laag: "",
	product: query.get("product") || "",
	selected: query.get("node") || "",
	expanded: {},
	history: [],
	view: { x: 0, y: 0, scale: 1, dragging: false, moved: false, suppressClick: false, startX: 0, startY: 0, originX: 0, originY: 0 },
};

const elements = {
	producten: document.querySelector("#catalogusProducten"),
	bronnen: document.querySelector("#catalogusBronnen"),
	sets: document.querySelector("#catalogusSets"),
	herkomstlijnen: document.querySelector("#catalogusHerkomstlijnen"),
	bewerkingen: document.querySelector("#catalogusBewerkingen"),
	varianten: document.querySelector("#catalogusVarianten"),
	begrippen: document.querySelector("#catalogusBegrippen"),
	zoek: document.querySelector("#catalogusZoek"),
	laag: document.querySelector("#catalogusLaag"),
	productKaarten: document.querySelector("#catalogusProductKaarten"),
	resultaatStatus: document.querySelector("#catalogusResultaatStatus"),
	geschiedenis: document.querySelector("#catalogusGeschiedenis"),
	alleProducten: document.querySelector("#catalogusAlleProducten"),
	graphEmpty: document.querySelector("#catalogusGraphEmpty"),
	graphLayout: document.querySelector("#catalogusGraphLayout"),
	graph: document.querySelector("#catalogusGraph"),
	viewport: document.querySelector("#catalogusGraphViewport"),
	mapActions: document.querySelectorAll("[data-map-action]"),
	detail: document.querySelector("#catalogusDetail"),
	relatieLijst: document.querySelector("#catalogusRelatieLijst"),
	productRijen: document.querySelector("#catalogusProductRijen"),
	bronRijen: document.querySelector("#catalogusBronRijen"),
	setRijen: document.querySelector("#catalogusSetRijen"),
	variantRijen: document.querySelector("#catalogusVariantRijen"),
};

const typeLabels = {
	product: "product",
	gegevensbron: "bron",
	gegevensset: "gegevensset",
	bewerking: "bewerking",
	variant: "variant",
	visualisatie: "grafiek",
};

const groups = [
	{ type: "gegevensbron", label: "Bronnen" },
	{ type: "bewerking", label: "Bewerkingen" },
	{ type: "gegevensset", label: "Gegevenssets" },
	{ type: "variant", label: "Varianten" },
	{ type: "visualisatie", label: "Grafieken" },
];

async function fetchJson(path) {
	const response = await fetch(path);
	if (!response.ok) throw new Error(`${path} kon niet geladen worden: ${response.status}`);
	return response.json();
}

function text(value) {
	if (Array.isArray(value)) return value.filter(Boolean).join(", ");
	if (value && typeof value === "object") return Object.values(value).filter(Boolean).join(", ");
	return String(value ?? "");
}

function nodeId(type, item) {
	const id = String(item.id || item.slug);
	return id.startsWith(`${type}:`) ? id : `${type}:${id}`;
}

function allNodes() {
	return [
		...state.producten.map((item) => ({ ...item, type: "product", id: nodeId("product", item), label: item.titel || item.slug })),
		...state.gegevensbronnen.map((item) => ({ ...item, type: "gegevensbron", id: nodeId("gegevensbron", item), label: item.titel || item.id })),
		...state.gegevenssets.map((item) => ({ ...item, type: "gegevensset", id: nodeId("gegevensset", item), label: item.titel || item.id })),
		...state.bewerkingen.map((item) => ({ ...item, type: "bewerking", id: nodeId("bewerking", item), label: item.titel || item.id })),
		...state.varianten.map((item) => ({ ...item, type: "variant", id: nodeId("variant", item), label: item.titel || item.id })),
		...state.visualisaties.map((item) => ({ ...item, type: "visualisatie", id: nodeId("visualisatie", item), label: item.titel || item.id })),
	];
}

function nodeMap() {
	return new Map(allNodes().map((node) => [node.id, node]));
}

function productBySlug(slug) {
	return state.producten.find((product) => product.slug === slug);
}

function productForNode(node) {
	if (!node) return "";
	if (node.type === "product") return node.slug;
	if (node.product) return node.product;
	if (node.producten?.length) return state.product && node.producten.includes(state.product) ? state.product : node.producten[0];
	return state.product || "";
}

function nodeMatches(node) {
	if (state.laag && node.laag && node.laag !== state.laag) return false;
	return !state.zoek || JSON.stringify(node).toLowerCase().includes(state.zoek);
}

function relationNodesForProduct() {
	const product = productBySlug(state.product);
	if (!product) return { nodes: [], relations: [] };
	const nodes = allNodes().filter((node) => productForNode(node) === state.product);
	const ids = new Set(nodes.map((node) => node.id));
	let relations = state.relaties.filter((relation) => ids.has(relation.van) && ids.has(relation.naar));
	const matches = new Set(nodes.filter(nodeMatches).map((node) => node.id));
	if (state.zoek || state.laag) {
		const connected = new Set(matches);
		for (const relation of relations) {
			if (matches.has(relation.van) || matches.has(relation.naar)) {
				connected.add(relation.van);
				connected.add(relation.naar);
			}
		}
		relations = relations.filter((relation) => connected.has(relation.van) && connected.has(relation.naar));
		return { nodes: nodes.filter((node) => connected.has(node.id)), relations };
	}
	return { nodes, relations };
}

function hrefForNode(node) {
	return `/data-catalogus/?product=${encodeURIComponent(productForNode(node))}&node=${encodeURIComponent(node.id)}`;
}

function linkCell(value) {
	const td = document.createElement("td");
	const values = Array.isArray(value) ? value : [value].filter(Boolean);
	if (!values.length) {
		td.textContent = "-";
		return td;
	}
	for (const entry of values) {
		const href = typeof entry === "string" ? entry : entry.href || entry.pad;
		const label = typeof entry === "string" ? entry : entry.label || entry.titel || href;
		if (!href) continue;
		const anchor = document.createElement("a");
		anchor.href = href;
		anchor.textContent = label;
		td.append(anchor, document.createElement("br"));
	}
	return td;
}

function cell(value) {
	const td = document.createElement("td");
	td.textContent = text(value) || "-";
	return td;
}

function updateUrl(push = true) {
	const url = new URL(window.location.href);
	if (state.product) url.searchParams.set("product", state.product);
	else url.searchParams.delete("product");
	if (state.selected) url.searchParams.set("node", state.selected);
	else url.searchParams.delete("node");
	if (push) window.history.pushState({}, "", url);
	else window.history.replaceState({}, "", url);
}

function syncFromUrl() {
	const params = new URLSearchParams(window.location.search);
	state.product = params.get("product") || "";
	state.selected = params.get("node") || "";
	const selected = nodeMap().get(state.selected);
	if (!state.product && selected) state.product = productForNode(selected);
	if (state.product && !productBySlug(state.product)) {
		state.product = "";
		state.selected = "";
	}
}

function selectProduct(slug, { push = true } = {}) {
	if (!productBySlug(slug)) return;
	state.product = slug;
	state.selected = `product:${slug}`;
	state.expanded = {};
	resetMapView();
	if (!state.history.includes(slug)) state.history = [slug, ...state.history].slice(0, 5);
	updateUrl(push);
	renderAll();
}

function selectNode(id, { push = true } = {}) {
	const node = nodeMap().get(id);
	if (!node) return;
	state.selected = id;
	const product = productForNode(node);
	if (product) state.product = product;
	updateUrl(push);
	renderAll();
}

function renderSummary() {
	elements.producten.textContent = numberFormat.format(state.producten.length);
	elements.bronnen.textContent = numberFormat.format(state.gegevensbronnen.length);
	elements.sets.textContent = numberFormat.format(state.gegevenssets.length);
	elements.herkomstlijnen.textContent = numberFormat.format(state.relaties.length);
	elements.bewerkingen.textContent = numberFormat.format(state.bewerkingen.length);
	elements.varianten.textContent = numberFormat.format(state.varianten.length);
	elements.begrippen.textContent = numberFormat.format(state.begrippen.length);
}

function renderHistory() {
	elements.geschiedenis.replaceChildren(
		...state.history
			.filter((slug) => productBySlug(slug))
			.map((slug) => {
				const button = document.createElement("button");
				button.type = "button";
				button.textContent = productBySlug(slug).titel || slug;
				button.addEventListener("click", () => selectProduct(slug));
				return button;
			})
	);
}

function renderProductCards() {
	if (state.product) {
		elements.productKaarten.replaceChildren();
		elements.productKaarten.hidden = true;
		elements.resultaatStatus.textContent = `Geselecteerd product: ${productBySlug(state.product)?.titel || state.product}`;
		return;
	}
	elements.productKaarten.hidden = false;
	const products = state.producten.filter(nodeMatches);
	elements.productKaarten.replaceChildren(
		...products.map((product) => {
			const card = document.createElement("article");
			card.className = `afkomstdiagram__product-card${state.product === product.slug ? " is-selected" : ""}`;
			const button = document.createElement("button");
			button.type = "button";
			button.className = "afkomstdiagram__product-card-button";
			button.addEventListener("click", () => selectProduct(product.slug));
			const heading = document.createElement("h3");
			heading.textContent = product.titel || product.slug;
			const description = document.createElement("p");
			description.textContent = product.beschrijving || "Geen beschrijving beschikbaar.";
			const stats = document.createElement("span");
			stats.className = "afkomstdiagram__product-card-stats";
			stats.textContent = `${product.bronnen?.length || 0} bronnen · ${state.gegevenssets.filter((set) => set.product === product.slug).length} datasets · ${state.varianten.filter((variant) => variant.product === product.slug).length} varianten`;
			button.append(heading, description, stats);
			card.append(button);
			return card;
		})
	);
	const count = products.length;
	elements.resultaatStatus.textContent = `${count} van ${state.producten.length} producten zichtbaar${state.product ? ` · geselecteerd: ${productBySlug(state.product)?.titel || state.product}` : ""}`;
}

function renderLayers() {
	const layers = [...new Set(state.gegevenssets.map((set) => set.laag).filter(Boolean))].sort();
	elements.laag.replaceChildren(new Option("Alle lagen", ""), ...layers.map((layer) => new Option(layer, layer)));
	elements.laag.value = state.laag;
}

function makeNodeCard(node) {
	const card = document.createElement("button");
	card.type = "button";
	card.className = `afkomstdiagram__node afkomstdiagram__node--${node.type}${state.selected === node.id ? " is-selected" : ""}`;
	card.dataset.nodeId = node.id;
	card.setAttribute("aria-label", `${typeLabels[node.type]}: ${node.label}`);
	const kind = document.createElement("span");
	kind.className = "afkomstdiagram__node-kind";
	kind.textContent = typeLabels[node.type];
	const label = document.createElement("strong");
	label.textContent = node.label;
	const meta = document.createElement("small");
	meta.textContent = node.laag || node.status || node.type;
	card.append(kind, label, meta);
	card.addEventListener("click", () => {
		if (state.view.suppressClick) {
			state.view.suppressClick = false;
			return;
		}
		selectNode(node.id);
	});
	return card;
}

function applyMapView() {
	const { x, y, scale } = state.view;
	elements.graph.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
	elements.graph.style.transformOrigin = "0 0";
	if (state.product) requestAnimationFrame(() => drawEdges(relationNodesForProduct().relations));
}

function clampScale(value) {
	return Math.min(2.5, Math.max(0.65, value));
}

function resetMapView() {
	state.view.x = 0;
	state.view.y = 0;
	state.view.scale = 1;
	applyMapView();
}

function zoomMap(factor, clientX, clientY) {
	const viewport = elements.viewport.getBoundingClientRect();
	const oldScale = state.view.scale;
	const nextScale = clampScale(oldScale * factor);
	const anchorX = ((clientX ?? viewport.left + viewport.width / 2) - viewport.left - state.view.x) / oldScale;
	const anchorY = ((clientY ?? viewport.top + viewport.height / 2) - viewport.top - state.view.y) / oldScale;
	state.view.scale = nextScale;
	state.view.x = (clientX ?? viewport.left + viewport.width / 2) - viewport.left - anchorX * nextScale;
	state.view.y = (clientY ?? viewport.top + viewport.height / 2) - viewport.top - anchorY * nextScale;
	applyMapView();
}

function bindMapControls() {
	elements.mapActions.forEach((button) =>
		button.addEventListener("click", () => {
			if (button.dataset.mapAction === "reset") resetMapView();
			if (button.dataset.mapAction === "zoom-in") zoomMap(1.2);
			if (button.dataset.mapAction === "zoom-out") zoomMap(1 / 1.2);
		})
	);

	elements.viewport.addEventListener(
		"wheel",
		(event) => {
			event.preventDefault();
			zoomMap(event.deltaY < 0 ? 1.1 : 1 / 1.1, event.clientX, event.clientY);
		},
		{ passive: false }
	);

	elements.viewport.addEventListener("pointerdown", (event) => {
		if (!event.isPrimary || event.button !== 0) return;
		state.view.dragging = true;
		state.view.startX = event.clientX;
		state.view.startY = event.clientY;
		state.view.originX = state.view.x;
		state.view.originY = state.view.y;
		state.view.moved = false;
		elements.viewport.setPointerCapture(event.pointerId);
		elements.viewport.classList.add("is-dragging");
	});
	elements.viewport.addEventListener("pointermove", (event) => {
		if (!state.view.dragging) return;
		if (Math.hypot(event.clientX - state.view.startX, event.clientY - state.view.startY) > 4) state.view.moved = true;
		state.view.x = state.view.originX + event.clientX - state.view.startX;
		state.view.y = state.view.originY + event.clientY - state.view.startY;
		applyMapView();
	});
	const stopDragging = (event) => {
		if (!state.view.dragging) return;
		state.view.dragging = false;
		state.view.suppressClick = state.view.moved;
		elements.viewport.releasePointerCapture?.(event.pointerId);
		elements.viewport.classList.remove("is-dragging");
	};
	elements.viewport.addEventListener("pointerup", stopDragging);
	elements.viewport.addEventListener("pointercancel", stopDragging);

	elements.viewport.addEventListener("keydown", (event) => {
		const step = event.shiftKey ? 80 : 40;
		if (event.key === "0") {
			event.preventDefault();
			resetMapView();
			return;
		}
		if (event.key === "+" || event.key === "=") {
			event.preventDefault();
			zoomMap(1.2);
			return;
		}
		if (event.key === "-") {
			event.preventDefault();
			zoomMap(1 / 1.2);
			return;
		}
		const offsets = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
		if (!offsets[event.key]) return;
		event.preventDefault();
		state.view.x += offsets[event.key][0];
		state.view.y += offsets[event.key][1];
		applyMapView();
	});
}

function drawEdges(relations) {
	const stage = elements.graph;
	const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	svg.classList.add("afkomstdiagram__edges");
	svg.setAttribute("aria-hidden", "true");
	const rect = stage.getBoundingClientRect();
	const scale = state.view.scale;
	svg.setAttribute("width", String(stage.offsetWidth));
	svg.setAttribute("height", String(stage.offsetHeight));
	for (const relation of relations) {
		const from = [...stage.querySelectorAll("[data-node-id]")].find((element) => element.dataset.nodeId === relation.van);
		const to = [...stage.querySelectorAll("[data-node-id]")].find((element) => element.dataset.nodeId === relation.naar);
		if (!from || !to) continue;
		const a = from.getBoundingClientRect();
		const b = to.getBoundingClientRect();
		const line = document.createElementNS("http://www.w3.org/2000/svg", "path");
		const x1 = (a.right - rect.left) / scale;
		const y1 = (a.top + a.height / 2 - rect.top) / scale;
		const x2 = (b.left - rect.left) / scale;
		const y2 = (b.top + b.height / 2 - rect.top) / scale;
		const bend = Math.max(24, (x2 - x1) / 2);
		line.setAttribute("d", `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`);
		line.classList.add("afkomstdiagram__edge");
		if (relation.van === state.selected || relation.naar === state.selected) line.classList.add("is-active");
		svg.append(line);
	}
	stage.querySelector(".afkomstdiagram__edges")?.remove();
	stage.prepend(svg);
}

function renderGraph() {
	const selectedProduct = productBySlug(state.product);
	elements.graphEmpty.hidden = Boolean(selectedProduct);
	elements.graphLayout.hidden = !selectedProduct;
	if (!selectedProduct) return;
	const { nodes, relations } = relationNodesForProduct();
	elements.graph.replaceChildren();
	const groupGrid = document.createElement("div");
	groupGrid.className = "afkomstdiagram__groups";
	for (const group of groups) {
		const column = document.createElement("section");
		column.className = "afkomstdiagram__group";
		column.setAttribute("aria-labelledby", `groep-${group.type}`);
		const heading = document.createElement("h3");
		heading.id = `groep-${group.type}`;
		heading.textContent = group.label;
		const groupNodes = nodes.filter((node) => node.type === group.type).sort((a, b) => a.label.localeCompare(b.label, "nl"));
		const showAll = group.type === "gegevensbron" || group.type === "gegevensset";
		let visible = showAll || state.expanded[group.type] ? groupNodes : groupNodes.slice(0, 6);
		if (!showAll && !state.expanded[group.type] && state.selected && groupNodes.some((node) => node.id === state.selected) && !visible.some((node) => node.id === state.selected)) {
			visible = [...visible.slice(0, 5), groupNodes.find((node) => node.id === state.selected)];
		}
		const list = document.createElement("div");
		list.className = "afkomstdiagram__node-list";
		list.append(...visible.map(makeNodeCard));
		column.append(heading, list);
		if (!showAll && groupNodes.length > 6) {
			const more = document.createElement("button");
			more.type = "button";
			more.className = "afkomstdiagram__more";
			more.textContent = state.expanded[group.type] ? "Toon minder" : `Toon nog ${groupNodes.length - 6}`;
			more.addEventListener("click", () => {
				state.expanded[group.type] = !state.expanded[group.type];
				renderGraph();
			});
			column.append(more);
		}
		groupGrid.append(column);
	}
	elements.graph.append(groupGrid);
	applyMapView();
	requestAnimationFrame(() => drawEdges(relations));
}

function renderDetail() {
	const node = nodeMap().get(state.selected);
	if (!node || productForNode(node) !== state.product) {
		elements.detail.innerHTML = '<p class="data-catalogus__muted">Selecteer een onderdeel in het Afkomstdiagram.</p>';
		return;
	}
	const related = state.relaties.filter((relation) => relation.van === node.id || relation.naar === node.id);
	elements.detail.replaceChildren();
	const heading = document.createElement("h3");
	heading.textContent = node.label;
	const type = document.createElement("p");
	type.className = "afkomstdiagram__detail-type";
	type.textContent = typeLabels[node.type];
	elements.detail.append(heading, type);
	if (node.beschrijving || node.opmerking) {
		const description = document.createElement("p");
		description.textContent = node.beschrijving || node.opmerking;
		elements.detail.append(description);
	}
	const metadata = document.createElement("dl");
	for (const [label, value] of [
		["Laag", node.laag],
		["Status", node.status],
		["Aanbieder", node.aanbieder],
		["Rol", node.rol],
		["Product", node.product || node.producten?.join(", ")],
	]) {
		if (!value) continue;
		const term = document.createElement("dt");
		term.textContent = label;
		const definition = document.createElement("dd");
		definition.textContent = value;
		metadata.append(term, definition);
	}
	if (metadata.children.length) elements.detail.append(metadata);
	const links = [];
	if (node.href) links.push({ href: node.href, label: "Open grafiek" });
	if (node.url) links.push({ href: node.url, label: "Open bron" });
	if (node.publiekBestand) links.push({ href: node.publiekBestand, label: "Download bestand" });
	if (node.type === "product") links.push({ href: `/projecten/${node.slug}/`, label: "Open project" });
	if (node.script) links.push({ href: `https://github.com/t-Bataafsche-Broederschap/tbb/blob/trunk/${node.script}`, label: "Open verwerkingsscript" });
	if (links.length) elements.detail.append(linkCell(links));
	if (related.length) {
		const relationList = document.createElement("ul");
		const nodes = nodeMap();
		for (const relation of related) {
			const otherId = relation.van === node.id ? relation.naar : relation.van;
			const other = nodes.get(otherId);
			const item = document.createElement("li");
			const link = document.createElement("a");
			link.href = hrefForNode(other || { id: otherId });
			link.textContent = `${relation.type}: ${other?.label || otherId}`;
			item.append(link);
			relationList.append(item);
		}
		elements.detail.append(relationList);
	}
}

function renderRelationsList() {
	const nodes = nodeMap();
	const relations = relationNodesForProduct().relations;
	elements.relatieLijst?.replaceChildren();
	elements.relatieLijst?.append(
		...relations.map((relation) => {
			const item = document.createElement("li");
			const from = document.createElement("a");
			from.href = hrefForNode(nodes.get(relation.van) || { id: relation.van });
			from.textContent = nodes.get(relation.van)?.label || relation.van;
			const to = document.createElement("a");
			to.href = hrefForNode(nodes.get(relation.naar) || { id: relation.naar });
			to.textContent = nodes.get(relation.naar)?.label || relation.naar;
			item.append(from, ` ${relation.type} `, to);
			return item;
		})
	);
}

function renderTables() {
	const products = state.producten.filter(nodeMatches);
	elements.productRijen.replaceChildren(
		...products.map((product) => {
			const tr = document.createElement("tr");
			const title = document.createElement("td");
			const link = document.createElement("a");
			link.href = `/data-catalogus/?product=${encodeURIComponent(product.slug)}&node=${encodeURIComponent(`product:${product.slug}`)}`;
			link.textContent = product.titel || product.slug;
			title.append(link);
			tr.append(title, cell(product.status), cell(product.bronnen || []), linkCell(Object.values(product.publiekeEindpunten || {})));
			return tr;
		})
	);
	elements.bronRijen.replaceChildren(
		...state.gegevensbronnen.filter(nodeMatches).map((source) => {
			const tr = document.createElement("tr");
			const title = document.createElement("td");
			if (source.url) {
				const link = document.createElement("a");
				link.href = source.url;
				link.target = "_blank";
				link.rel = "noopener noreferrer";
				link.textContent = source.titel || source.id;
				title.append(link);
			} else title.textContent = source.titel || source.id;
			tr.append(title, cell(source.aanbieder), cell(source.type), cell(source.producten || []));
			return tr;
		})
	);
	elements.setRijen.replaceChildren(
		...state.gegevenssets
			.filter((set) => (!state.laag || set.laag === state.laag) && nodeMatches(set))
			.map((set) => {
				const tr = document.createElement("tr");
				tr.append(cell(set.titel || set.id), cell(set.product), cell(set.laag), linkCell((set.bestanden || []).map((file) => ({ href: file.pad, label: file.pad }))));
				return tr;
			})
	);
	elements.variantRijen.replaceChildren(
		...state.varianten.filter(nodeMatches).map((variant) => {
			const tr = document.createElement("tr");
			const title = document.createElement("td");
			const link = document.createElement("a");
			link.href = `/data-catalogus/?product=${encodeURIComponent(variant.product)}&node=${encodeURIComponent(variant.id)}`;
			link.textContent = variant.titel;
			title.append(link);
			tr.append(title, cell(variant.product), cell((variant.opties || []).map((option) => `${option.titel} (${option.id})`)), linkCell(variant.href));
			return tr;
		})
	);
}

function renderAll() {
	renderSummary();
	renderHistory();
	renderProductCards();
	renderGraph();
	renderDetail();
	renderRelationsList();
	renderTables();
}

async function init() {
	const names = ["producten", "gegevensbronnen", "gegevenssets", "afstamming", "bewerkingen", "varianten", "visualisaties", "begrippen"];
	const payloads = await Promise.all(names.map((name) => fetchJson(`/api/v1/catalogus/${name}.json`)));
	state.producten = payloads[0].producten || [];
	state.gegevensbronnen = payloads[1].gegevensbronnen || [];
	state.gegevenssets = payloads[2].gegevenssets || [];
	state.relaties = payloads[3].relaties || [];
	state.bewerkingen = payloads[4].bewerkingen || [];
	state.varianten = payloads[5].varianten || [];
	state.visualisaties = payloads[6].visualisaties || [];
	state.begrippen = payloads[7].begrippen || [];
	syncFromUrl();
	if (state.product) state.history = [state.product];
	renderLayers();
	renderAll();
	elements.zoek.addEventListener("input", () => {
		state.zoek = elements.zoek.value.trim().toLowerCase();
		renderAll();
	});
	elements.laag.addEventListener("change", () => {
		state.laag = elements.laag.value;
		renderAll();
	});
	elements.alleProducten.addEventListener("click", () => {
		state.product = "";
		state.selected = "";
		state.expanded = {};
		resetMapView();
		updateUrl();
		renderAll();
	});
	window.addEventListener("popstate", () => {
		syncFromUrl();
		renderAll();
	});
	window.addEventListener("resize", () => {
		if (state.product) drawEdges(relationNodesForProduct().relations);
	});
	bindMapControls();
}

init().catch((error) => {
	console.error(error);
	const message = document.createElement("p");
	message.className = "data-catalogus__error";
	message.textContent = error.message;
	document.querySelector(".data-catalogus")?.append(message);
});
