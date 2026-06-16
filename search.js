(() => {
	const form = document.querySelector(".site-search");
	const input = document.querySelector(".site-search__input");
	const results = document.querySelector(".site-search__results");

	if (!form || !input || !results) return;

	let indexPromise;
	let pages = [];

	const normalize = (value) =>
		value
			.toLowerCase()
			.normalize("NFD")
			.replace(/[\u0300-\u036f]/g, "");

	const escapeHtml = (value) =>
		value.replace(/[&<>"']/g, (char) => {
			const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
			return entities[char];
		});

	const loadIndex = () => {
		indexPromise ??= fetch("/search-index.json")
			.then((response) => {
				if (!response.ok) throw new Error("Search index not available");
				return response.json();
			})
			.then((items) => {
				pages = items.map((item) => ({
					...item,
					haystack: normalize(`${item.title} ${item.section} ${item.description} ${item.content}`),
					titleText: normalize(item.title),
				}));
				return pages;
			})
			.catch(() => {
				pages = [];
				return pages;
			});
		return indexPromise;
	};

	const scorePage = (page, terms) => {
		let score = 0;
		for (const term of terms) {
			if (!page.haystack.includes(term)) return 0;
			score += page.titleText.includes(term) ? 5 : 1;
			if (page.description && normalize(page.description).includes(term)) score += 2;
		}
		return score;
	};

	const closeResults = () => {
		results.hidden = true;
		results.replaceChildren();
		input.setAttribute("aria-expanded", "false");
	};

	const renderResults = (matches, query) => {
		results.replaceChildren();
		input.setAttribute("aria-expanded", "true");
		results.hidden = false;

		if (!matches.length) {
			const empty = document.createElement("div");
			empty.className = "site-search__empty";
			empty.textContent = `Geen resultaten voor "${query}".`;
			results.append(empty);
			return;
		}

		for (const page of matches.slice(0, 8)) {
			const link = document.createElement("a");
			link.className = "site-search__result";
			link.href = page.url;
			link.setAttribute("role", "option");
			link.innerHTML = `<strong>${escapeHtml(page.title)}</strong><span>${escapeHtml(page.section)} · ${escapeHtml(page.description || "")}</span>`;
			results.append(link);
		}
	};

	const search = async () => {
		const query = input.value.trim();
		if (query.length < 2) {
			closeResults();
			return [];
		}

		await loadIndex();
		const terms = normalize(query).split(/\s+/).filter(Boolean);
		const matches = pages
			.map((page) => ({ ...page, score: scorePage(page, terms) }))
			.filter((page) => page.score > 0)
			.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));

		renderResults(matches, query);
		return matches;
	};

	input.addEventListener("focus", () => {
		loadIndex();
		if (input.value.trim().length >= 2) search();
	});

	input.addEventListener("input", search);

	form.addEventListener("submit", async (event) => {
		event.preventDefault();
		const matches = await search();
		if (matches[0]) window.location.href = matches[0].url;
	});

	document.addEventListener("click", (event) => {
		if (!form.contains(event.target)) closeResults();
	});

	input.addEventListener("keydown", (event) => {
		if (event.key === "Escape") {
			closeResults();
			input.blur();
		}
	});
})();
