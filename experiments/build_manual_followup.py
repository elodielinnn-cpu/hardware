import csv
import json
from datetime import date, timedelta
from email.utils import parsedate_to_datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
prior = {row['sampleNumber']: row for row in json.loads((ROOT / 'reports/unified-v1/comparison-30.json').read_text())['rows']}
program = {row['sampleNumber']: row for row in json.loads((ROOT / 'news-filter-trial/reports/unified-v1/manual-followup-dated-program-30.json').read_text())['articles']}
site = {row['sampleNumber']: row for row in json.loads((ROOT / 'reports/unified-v1/manual-followup-dated-v3-30.json').read_text())['articles']}
source = {row['sampleNumber']: row for row in json.loads((ROOT / 'news-filter-trial/reports/unified-v1/manual-followup-dated-input.json').read_text())['articles']}
assert prior.keys() == program.keys() == site.keys() == source.keys()
rows = []
for number in sorted(prior):
    old, new, v3, article = prior[number], program[number], site[number], source[number]
    raw_date = article['publishedAt']
    published_date = date.fromisoformat(raw_date[:10]) if raw_date[:4].isdigit() else parsedate_to_datetime(raw_date).date()
    within_30_days = date(2026, 11, 13) - timedelta(days=30) <= published_date <= date(2026, 11, 13)
    rows.append({
        'sampleNumber': number, 'title': article['title'], 'url': article['url'],
        'priorProgramResult': old['newProgramResult'], 'currentProgramResult': new['newResult'],
        'priorEvent': old['mainEvent'], 'currentEvent': new['newEvent'],
        'priorStage': old['stage'], 'currentStage': new['newStage'],
        'actor': new['actor'], 'object': new['object'], 'evidence': new['evidence'],
        'paragraphId': new['paragraphId'], 'businessRelation': new['businessRelation'],
        'businessProducts': new['businessProducts'],
        'priorSiteHomepage': old['siteV3Homepage'], 'currentSiteContentHomepage': v3['homepage'],
        'siteRelevance': v3['relevance'], 'sitePriority': v3['priority'],
        'siteReasonCodes': v3['reasonCodes'], 'publishedAt': article['publishedAt'],
        'datePublishable': True, 'within30DaysOnNov13': within_30_days,
        'indicative30DayHomepage': v3['homepage'] and within_30_days,
        'dateEvidence': article.get('publishedAtEvidence', {}).get('sourceUrl', 'original_sample'),
        'programReason': new['reason']
    })
target = ROOT / 'reports/unified-v1/manual-followup-comparison-30'
target.with_suffix('.json').write_text(json.dumps({'version': 'unified-v1-manual-followup', 'modelRun': False, 'rows': rows}, ensure_ascii=False, indent=2) + '\n')
with target.with_suffix('.csv').open('w', encoding='utf-8', newline='') as stream:
    writer = csv.DictWriter(stream, fieldnames=rows[0], lineterminator='\n')
    writer.writeheader()
    writer.writerows({key: json.dumps(value, ensure_ascii=False) if isinstance(value, (list, dict)) else value for key, value in row.items()} for row in rows)
print(f'Joined {len(rows)} reviewed rows')
