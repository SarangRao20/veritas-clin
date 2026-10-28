#!/usr/bin/env python3
"""Vendor a filtered subset of the real MTSamples corpus into data/mtsamples_samples.json.

Source: mtsamples.csv — 4,999 medical transcription samples scraped from
mtsamples.com, released under CC0 / Public Domain:
  https://www.kaggle.com/datasets/tboyle10/medicaltranscriptions  (license: CC0)
  Mirrors: https://github.com/eshza/medicalTranscriptsKaggle (raw mtsamples.csv)
           https://github.com/aneuraz/mtsamplesFR  (data/mtsamples.csv)

This preserves the original transcription text verbatim — no editorializing.
Only the four in-domain specialties are kept (Psychiatry/Psychology, Neurology,
General Medicine, SOAP/Chart/Progress Notes); the remaining surgical, imaging,
and lab-report specialties are outside the clinical-text QA scope of this
prototype and are dropped for size.
"""
from __future__ import annotations

import csv
import sys
from pathlib import Path

TARGET_SPECIALTIES = {
    "Psychiatry / Psychology",
    "Neurology",
    "General Medicine",
    "SOAP / Chart / Progress Notes",
}

KEEP_COLUMNS = ["description", "medical_specialty", "sample_name", "transcription"]


def main(src: str) -> None:
    out_path = Path(__file__).resolve().parents[1] / "data" / "mtsamples_samples.json"
    with open(src, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    kept = []
    seen_ids = set()
    for r in rows:
        if r.get("medical_specialty", "").strip() not in TARGET_SPECIALTIES:
            continue
        record = {c: r.get(c, "").strip() for c in KEEP_COLUMNS}
        if not record["transcription"]:
            continue
        # Dedupe by description+sample_name (a few rows repeat identical titles
        # with different transcriptions; those stay, exact full-text dupes go).
        key = (record["description"], record["sample_name"], record["transcription"])
        if key in seen_ids:
            continue
        seen_ids.add(key)
        kept.append(record)

    import json
    out_path.write_text(
        json.dumps(kept, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    from collections import Counter
    print(f"wrote {len(kept)} notes -> {out_path}")
    for k, v in Counter(r["medical_specialty"] for r in kept).most_common():
        print(f"  {v:4d} {k}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("usage: build_mtsamples_samples.py <path-to-mtsamples.csv>", file=sys.stderr)
        sys.exit(1)
    main(sys.argv[1])
