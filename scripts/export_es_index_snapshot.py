#!/usr/bin/env python3

import argparse
import json
import random
import subprocess
import sys
from pathlib import Path


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


def write_outputs(count_file: Path, sample_file: Path, docs: list[dict], sample_size: int, seed: int) -> None:
    count_file.parent.mkdir(parents=True, exist_ok=True)
    sample_file.parent.mkdir(parents=True, exist_ok=True)

    with count_file.open("w", encoding="ascii") as fh:
        fh.write(f"{len(docs)}\n")

    if len(docs) <= sample_size:
        sample = docs
    else:
        rng = random.Random(seed)
        sample_indexes = sorted(rng.sample(range(len(docs)), sample_size))
        sample = [docs[index] for index in sample_indexes]
        sample.sort(key=lambda doc: doc["_id"])

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

    reported_count = run_curl(args.container, "GET", f"/{args.index}/_count").get("count", 0)
    docs = normalize_docs(args.container, args.index, args.page_size)

    if reported_count != len(docs):
        raise SystemExit(
            f"count mismatch for {args.index}: _count={reported_count}, scanned={len(docs)}"
        )

    write_outputs(Path(args.count_file), Path(args.sample_file), docs, args.sample_size, args.seed)


if __name__ == "__main__":
    main()
