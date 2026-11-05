import fs from 'node:fs/promises';
import { requestDocument, diagnosticOf } from './fetch.mjs';

const targets = [
  ['DCD configured feed', 'https://www.datacenterdynamics.com/en/rss/'],
  ['DCD root feed', 'https://www.datacenterdynamics.com/rss/'],
  ['DCD legacy news feed', 'https://www.datacenterdynamics.com/en/rss/news'],
  ['DCD homepage', 'https://www.datacenterdynamics.com/en/'],
  ['Automotive RSS control', 'https://www.autonomousvehicleinternational.com/feed'],
  ['Automotive Infineon article', 'https://www.autonomousvehicleinternational.com/news/software/infineon-and-qualcomm-collaborate-on-central-computing-for-software-defined-vehicles.html'],
  ['Automotive Kodiak article', 'https://www.autonomousvehicleinternational.com/news/trucks/kodiak-adopts-stoneridge-mirroreye-system-for-autonomous-truck-deployments.html']
];
const results = [];
for (let offset = 0; offset < targets.length; offset += 3) {
  const batch = await Promise.all(targets.slice(offset, offset + 3).map(async ([name, url]) => {
    const response = await requestDocument(url);
    const result = {
      name, ...diagnosticOf(response),
      feedEntries: [...response.body.matchAll(/<item\b|<entry\b/giu)].length,
      paragraphTags: [...response.body.matchAll(/<p\b/giu)].length
    };
    console.log(`${name}: ${result.reason}, HTTP ${result.httpStatus}, feed entries ${result.feedEntries}`);
    return result;
  }));
  results.push(...batch);
}
if (results.every(result => result.transportCode)) throw new Error('All diagnostic requests failed at transport layer; previous report preserved');
const path = new URL('../../outputs/news-screening/source-diagnostics.json', import.meta.url);
await fs.writeFile(path, JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2) + '\n');
