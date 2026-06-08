import { writeFile } from "node:fs/promises";

const years = Array.from({ length: 25 }, (_, index) => 2000 + index);
const publishedYears = [2000, ...Array.from({ length: 18 }, (_, index) => 2007 + index)];
const endpoint = "https://eubudget.com/ranking";

function textBetween(value, start, end) {
	const from = value.indexOf(start);
	if (from === -1) return "";
	const to = value.indexOf(end, from + start.length);
	if (to === -1) return "";
	return value.slice(from + start.length, to);
}

function cleanHtml(value) {
	return value
		.replace(/<script[\s\S]*?<\/script>/gi, "")
		.replace(/<style[\s\S]*?<\/style>/gi, "")
		.replace(/<[^>]+>/g, " ")
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/\s+/g, " ")
		.trim();
}

function parseNumber(value) {
	const normalized = value.replace(/[,%]/g, "").replace(/\+/g, "").trim();
	return Number(normalized);
}

function parseRows(html, year) {
	const tbody = textBetween(html, "<tbody>", "</tbody>");
	const rows = [...tbody.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((match) => match[0]);

	return rows.map((row) => {
		const country = cleanHtml(textBetween(row, '<div class="country-name">', "</div>"));
		const code = cleanHtml(textBetween(row, '<div class="small">', "</div>"));
		const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => cleanHtml(match[1]));
		const numeric = cells.slice(2, 7);

		return {
			year,
			code,
			country,
			contribution_m_eur: parseNumber(numeric[0]),
			receipts_m_eur: parseNumber(numeric[1]),
			net_balance_m_eur: parseNumber(numeric[2]),
			net_balance_per_capita_eur: parseNumber(numeric[3]),
			net_balance_pct_gni: parseNumber(numeric[4]),
		};
	});
}

function interpolateMissingYears(rows) {
	const result = [...rows];
	const rowsByCodeYear = new Map(rows.map((row) => [`${row.code}:${row.year}`, row]));
	const codes = [...new Set(rows.map((row) => row.code))];
	const fields = ["contribution_m_eur", "receipts_m_eur", "net_balance_m_eur", "net_balance_per_capita_eur", "net_balance_pct_gni"];

	for (const code of codes) {
		const start = rowsByCodeYear.get(`${code}:2000`);
		const end = rowsByCodeYear.get(`${code}:2007`);
		if (!start || !end) continue;

		for (let missingYear = 2001; missingYear <= 2006; missingYear += 1) {
			const ratio = (missingYear - 2000) / 7;
			const interpolated = {
				year: missingYear,
				code,
				country: start.country,
				estimated: true,
			};
			for (const field of fields) {
				interpolated[field] = Math.round((start[field] + (end[field] - start[field]) * ratio) * 100) / 100;
			}
			result.push(interpolated);
		}
	}

	return result.sort((a, b) => a.year - b.year || a.country.localeCompare(b.country));
}

const publishedRows = [];

for (const year of publishedYears) {
	const url = `${endpoint}?year=${year}&sort=net_balance_pct_gni&dir=asc`;
	console.log(`Fetching ${year}`);
	const response = await fetch(url, {
		headers: {
			"user-agent": "thaumatorium-eu-budget-flow-map/1.0",
		},
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch ${year}: ${response.status} ${response.statusText}`);
	}

	const html = await response.text();
	const rows = parseRows(html, year);
	if (rows.length < 20) {
		throw new Error(`Unexpectedly few rows for ${year}: ${rows.length}`);
	}
	publishedRows.push(...rows);
}

const allRows = interpolateMissingYears(publishedRows);

const byYear = Object.fromEntries(years.map((year) => [String(year), allRows.filter((row) => row.year === year)]));

const countries = [...new Map(allRows.map((row) => [row.code, row.country])).entries()].map(([code, country]) => ({ code, country })).sort((a, b) => a.country.localeCompare(b.country));

const maxAbsNetBalance = Math.max(...allRows.map((row) => Math.abs(row.net_balance_m_eur)));
const maxAbsPctGni = Math.max(...allRows.map((row) => Math.abs(row.net_balance_pct_gni)));

await writeFile(
	new URL("./budget-flows.json", import.meta.url),
	JSON.stringify(
		{
			source: "https://eubudget.com/ranking",
			fetched_at: new Date().toISOString(),
			note: "EUBudget publishes ranking pages for 2000 and 2007-2024. Years 2001-2006 are linearly interpolated between 2000 and 2007 so the animation can run continuously.",
			units: {
				contribution_m_eur: "million EUR",
				receipts_m_eur: "million EUR",
				net_balance_m_eur: "million EUR",
				net_balance_per_capita_eur: "EUR per resident",
				net_balance_pct_gni: "percentage points of GNI",
			},
			years,
			publishedYears,
			estimatedYears: [2001, 2002, 2003, 2004, 2005, 2006],
			countries,
			extent: { maxAbsNetBalance, maxAbsPctGni },
			byYear,
		},
		null,
		2
	)
);

console.log(`Wrote ${allRows.length} rows for ${years.length} years.`);
