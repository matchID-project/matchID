#!/usr/bin/env python3

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

from es_index_contract import (
    infer_source_types,
    merge_source_types,
    normalize_mapping,
    select_sample,
    write_contract,
)


def run_curl(container: str, method: str, path: str, body: dict | None = None) -> dict:
    cmd = ["docker", "exec", "-i", container, "curl", "-sS", "-X", method]
    if body is not None:
        cmd.extend(["-H", "Content-Type: application/json", "-d", json.dumps(body, separators=(",", ":"))])
    cmd.append(f"http://localhost:9200{path}")
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        sys.stderr.write(proc.stderr)
        raise SystemExit(proc.returncode)
    payload = proc.stdout.strip()
    if not payload:
        return {}
    return json.loads(payload)


def clear_scroll(container: str, scroll_id: str) -> None:
    subprocess.run(
        [
            "docker",
            "exec",
            "-i",
            container,
            "curl",
            "-sS",
            "-X",
            "DELETE",
            "-H",
            "Content-Type: application/json",
            "-d",
            json.dumps({"scroll_id": [scroll_id]}, separators=(",", ":")),
            "http://localhost:9200/_search/scroll",
        ],
        capture_output=True,
        text=True,
        check=False,
    )


def normalize_docs(container: str, index: str, page_size: int) -> list[dict]:
    response = run_curl(
        container,
        "POST",
        f"/{index}/_search?scroll=1m",
        {
            "size": page_size,
            "query": {"match_all": {}},
            "sort": ["_doc"],
            "_source": True,
        },
    )
    scroll_id = response.get("_scroll_id")
    hits = response.get("hits", {}).get("hits", [])
    docs = [{"_id": hit["_id"], "_source": hit.get("_source", {})} for hit in hits]

    while hits:
        response = run_curl(
            container,
            "POST",
            "/_search/scroll",
            {"scroll": "1m", "scroll_id": scroll_id},
        )
        scroll_id = response.get("_scroll_id", scroll_id)
        hits = response.get("hits", {}).get("hits", [])
        docs.extend({"_id": hit["_id"], "_source": hit.get("_source", {})} for hit in hits)

    if scroll_id:
        clear_scroll(container, scroll_id)

    docs.sort(key=lambda doc: doc["_id"])
    return docs


def infer_all_source_types(docs: list[dict]) -> dict[str, list[str]]:
    merged_types: dict[str, set[str]] = {}
    for doc in docs:
        merge_source_types(merged_types, infer_source_types(doc.get("_source", {})))
    return {key: sorted(values) for key, values in sorted(merged_types.items())}


def write_outputs(
    count_file: Path,
    sample_file: Path,
    docs: list[dict],
    sample_size: int,
    seed: int,
    mapping: dict | None = None,
) -> None:
    count_file.parent.mkdir(parents=True, exist_ok=True)
    sample_file.parent.mkdir(parents=True, exist_ok=True)

    sample = select_sample(docs, sample_size, seed)
    if os.environ.get("ES_CONTRACT_EXPORT") == "true":
        if count_file.name != "count.txt" or sample_file.name != "sample.json":
            raise SystemExit(
                "ES_CONTRACT_EXPORT=true requires count-file=count.txt and sample-file=sample.json"
            )
        write_contract(
            count_file.parent,
            count=len(docs),
            mapping=mapping or {},
            source_types=infer_all_source_types(docs),
            sample=sample,
            metadata={"sample_size": sample_size, "seed": seed},
        )
        return

    with count_file.open("w", encoding="ascii") as fh:
        fh.write(f"{len(docs)}\n")
    with sample_file.open("w", encoding="utf-8") as fh:
        json.dump(sample, fh, ensure_ascii=True, sort_keys=True, indent=2)
        fh.write("\n")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--container", default="deces-elasticsearch")
    parser.add_argument("--index", required=True)
    parser.add_argument("--count-file", required=True)
    parser.add_argument("--sample-file", required=True)
    parser.add_argument("--sample-size", type=int, default=1000)
    parser.add_argument("--seed", type=int, default=424242)
    parser.add_argument("--page-size", type=int, default=1000)
    args = parser.parse_args()

    run_curl(args.container, "POST", f"/{args.index}/_refresh")
    reported_count = run_curl(args.container, "GET", f"/{args.index}/_count").get("count", 0)
    mapping = {}
    if os.environ.get("ES_CONTRACT_EXPORT") == "true":
        mapping = normalize_mapping(run_curl(args.container, "GET", f"/{args.index}/_mapping"), args.index)
    docs = normalize_docs(args.container, args.index, args.page_size)

    if reported_count != len(docs):
        raise SystemExit(
            f"count mismatch for {args.index}: _count={reported_count}, scanned={len(docs)}"
        )

    write_outputs(Path(args.count_file), Path(args.sample_file), docs, args.sample_size, args.seed, mapping)


if __name__ == "__main__":
    main()
