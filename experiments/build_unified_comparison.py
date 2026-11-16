"""Join immutable trial output, unified rule replay, V3 replay and one-off review."""

import csv
import json
import sys
from pathlib import Path


def main():
    if len(sys.argv) != 5:
        raise SystemExit("Usage: python3 build_unified_comparison.py PROGRAM.json V3.json PRIOR_REVIEW.csv OUT.json")
    program_path, v3_path, review_path, output_path = map(Path, sys.argv[1:])
    program = json.loads(program_path.read_text())["articles"]
    v3 = {row["sampleNumber"]: row for row in json.loads(v3_path.read_text())["articles"]}
    with review_path.open(encoding="utf-8-sig", newline="") as stream:
        review = {int(row["编号"]): row for row in csv.DictReader(stream)}
    rows = []
    for item in program:
        number = item["sampleNumber"]
        site = v3[number]
        prior = review.get(number, {})
        data_gap = site["dataQuality"] != "complete"
        rows.append({
            "sampleNumber": number,
            "title": item["title"], "url": item["url"],
            "scope": ["datacom", "automotive"],
            "oldProgramResult": item["originalResult"], "oldProgramEvent": item["originalEvent"],
            "newProgramResult": item["newResult"], "newProgramBusiness": item["businessRelation"],
            "newProgramReason": item["reason"],
            "domain": item["newDomain"], "mainEvent": item["newEvent"], "stage": item["newStage"],
            "actor": item["actor"], "object": item["object"], "evidenceParagraph": item["paragraphId"],
            "evidence": item["evidence"], "businessProducts": item["businessProducts"],
            "siteV3Relevance": site["relevance"], "siteV3Priority": site["priority"],
            "siteV3Homepage": site["homepage"], "siteV3DecisionStatus": site["decisionStatus"],
            "siteV3ReasonCodes": site["reasonCodes"], "dataQuality": site["dataQuality"],
            "priorCodexReviewDestination": prior.get("AI复核去向（按发布时价值）", ""),
            "priorCodexReviewMainEvent": prior.get("AI判断的主要事件", ""),
            "priorReviewIsModelRun": False,
            "reviewFlags": (["missing_published_at"] if data_gap else [])
                + (["program_decision_changed"] if item["difference"] == "screening_decision" else [])
                + (["business_mapping_unresolved"] if item["newResult"] == "待定" and item["newEvent"] else [])
                + (["no_main_event"] if not item["newEvent"] else []),
        })
    result = {"version": "unified-v1", "programModelRun": False,
              "priorCodexReviewIsModelRun": False, "rows": rows}
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    columns = ["sampleNumber", "title", "oldProgramResult", "newProgramResult", "domain", "mainEvent", "stage",
               "actor", "object", "evidenceParagraph", "evidence", "newProgramBusiness", "siteV3Relevance",
               "siteV3Priority", "siteV3Homepage", "dataQuality", "priorCodexReviewDestination", "reviewFlags", "url"]
    with output_path.with_suffix(".csv").open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=columns, extrasaction="ignore", lineterminator="\n")
        writer.writeheader()
        for row in rows:
            writer.writerow({key: json.dumps(value, ensure_ascii=False) if isinstance(value, list) else value
                             for key, value in row.items()})
    print(f"Joined {len(rows)} rows")


if __name__ == "__main__":
    main()
