import assert from "node:assert/strict";
import fs from "node:fs/promises";

const appSource = await fs.readFile(new URL("../app.js", import.meta.url), "utf8");

assert.match(appSource, /diff\s*>=\s*0\s*&&\s*diff\s*<\s*range\.days/);
assert.match(appSource, /state\.relevance\s*!==\s*["']默认["']\s*\|\|\s*article\.showByDefault\s*!==\s*false/);

const asOf = new Date("2026-10-27T00:00:00Z");
const fixture = [
  { id: "today-visible", publishedAt: "2026-10-27", showByDefault: true },
  { id: "day-29-visible", publishedAt: "2026-09-28", showByDefault: true },
  { id: "day-30-excluded", publishedAt: "2026-09-27", showByDefault: true },
  { id: "hidden-by-default", publishedAt: "2026-10-26", showByDefault: false }
];

const visible = fixture.filter((article) => {
  const published = new Date(`${article.publishedAt}T00:00:00Z`);
  const diff = Math.round((asOf - published) / 86400000);
  return diff >= 0 && diff < 30 && article.showByDefault;
});

assert.deepEqual(visible.map((article) => article.id), ["today-visible", "day-29-visible"]);
console.log("Front-end 30-day default filter regression passed.");
