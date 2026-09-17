import { readFile, writeFile } from "node:fs/promises";

const source = await readFile(new URL("./app.js", import.meta.url), "utf8");
const names = ["LONG_DATA", "TYPE_DATA", "WEALTH_DATA", "VIOLENCE_DATA", "ONLINE_DATA", "VICTIM_DATA", "COMPOSITION", "MIGRATION_CHARTS", "CBS_MIGRATION_TIMELINE", "TIMELINE_EVENTS"];
const output = {};
for (const name of names) {
	const match = source.match(new RegExp(`const ${name} = (\\[[\\s\\S]*?\\]|"(?:[^"\\\\]|\\\\.)*");`));
	if (!match) throw new Error(`Ontbrekende gegevensreeks: ${name}`);
	output[name] = Function(...Object.keys(output), `return (${match[1]});`)(...Object.values(output));
}
output.schemaVersion = 1;
output.source = {
	type: "embedded-cbs-transcript",
	file: "content/projecten/criminaliteit-nederland/app.js",
	note: "Historische reeksen en contextmarkers worden uit de gecontroleerde projectbron geëxtraheerd.",
};
await writeFile(new URL("./data.json", import.meta.url), `${JSON.stringify(output, null, 2)}\n`);
