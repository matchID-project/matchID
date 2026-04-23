#!/usr/bin/env python3

import argparse
import dataclasses
import hashlib
import json
import random
import sys
from pathlib import Path
from typing import Any


CONTRACT_FILES = {
    "count": "count.txt",
    "mapping": "mapping.json",
    "source-types": "source-types.json",
    "sample": "sample.json",
}


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as fh:
        json.dump(value, fh, ensure_ascii=True, sort_keys=True, indent=2)
        fh.write("\n")


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def value_type(value: Any) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "bool"
    if isinstance(value, int):
        return "int"
    if isinstance(value, float):
        return "float"
    if isinstance(value, str):
        return "str"
    if isinstance(value, list):
        return "array"
    if isinstance(value, dict):
        return "object"
    return type(value).__name__


def merge_type(type_map: dict[str, set[str]], path: str, type_name: str) -> None:
    type_map.setdefault(path, set()).add(type_name)


def walk_source_types(value: Any, type_map: dict[str, set[str]], prefix: str) -> None:
    type_name = value_type(value)
    merge_type(type_map, prefix, type_name)

    if isinstance(value, dict):
        for key, child in value.items():
            child_path = f"{prefix}.{key}" if prefix else key
            walk_source_types(child, type_map, child_path)
    elif isinstance(value, list):
        item_path = f"{prefix}[]"
        if not value:
            merge_type(type_map, item_path, "empty")
        for item in value:
            walk_source_types(item, type_map, item_path)


def infer_source_types(source: dict[str, Any]) -> dict[str, list[str]]:
    type_map: dict[str, set[str]] = {}
    for key, value in source.items():
        walk_source_types(value, type_map, key)
    return {key: sorted(values) for key, values in sorted(type_map.items())}


def merge_source_types(
    destination: dict[str, set[str]], source_types: dict[str, list[str]]
) -> None:
    for key, values in source_types.items():
        destination.setdefault(key, set()).update(values)


def select_sample(docs: list[dict[str, Any]], sample_size: int, seed: int) -> list[dict[str, Any]]:
    if sample_size <= 0:
        return []
    normalized_docs = sorted(
        ({"_id": str(doc["_id"]), "_source": doc.get("_source", {})} for doc in docs),
        key=lambda doc: doc["_id"],
    )
    if len(normalized_docs) <= sample_size:
        return normalized_docs
    rng = random.Random(seed)
    sample_indexes = sorted(rng.sample(range(len(normalized_docs)), sample_size))
    return [normalized_docs[index] for index in sample_indexes]


def write_contract(
    out_dir: Path,
    *,
    count: int,
    mapping: dict[str, Any],
    source_types: dict[str, list[str]],
    sample: list[dict[str, Any]],
    metadata: dict[str, Any],
) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / CONTRACT_FILES["count"]).write_text(f"{count}\n", encoding="ascii")
    write_json(out_dir / CONTRACT_FILES["mapping"], mapping)
    write_json(out_dir / CONTRACT_FILES["source-types"], source_types)
    write_json(out_dir / CONTRACT_FILES["sample"], sample)

    manifest = {
        "metadata": metadata,
        "files": {
            key: {
                "path": filename,
                "sha256": file_sha256(out_dir / filename),
            }
            for key, filename in CONTRACT_FILES.items()
        },
    }
    write_json(out_dir / "manifest.json", manifest)


@dataclasses.dataclass(frozen=True)
class CompareResult:
    ok: bool
    mismatches: list[str]


def compare_contract_dirs(reference_dir: Path, candidate_dir: Path) -> CompareResult:
    mismatches = []
    for key, filename in CONTRACT_FILES.items():
        reference = reference_dir / filename
        candidate = candidate_dir / filename
        if not reference.exists() or not candidate.exists():
            mismatches.append(key)
            continue
        if reference.read_bytes() != candidate.read_bytes():
            mismatches.append(key)
    return CompareResult(ok=not mismatches, mismatches=mismatches)


def normalize_mapping(mapping_response: dict[str, Any], index: str) -> dict[str, Any]:
    if index in mapping_response:
        return mapping_response[index].get("mappings", {})
    return mapping_response


def main() -> None:
    parser = argparse.ArgumentParser(description="Compare Elasticsearch index contracts")
    subparsers = parser.add_subparsers(dest="command", required=True)
    compare_parser = subparsers.add_parser("compare")
    compare_parser.add_argument("--reference-dir", required=True)
    compare_parser.add_argument("--candidate-dir", required=True)
    compare_parser.add_argument("--report-file")

    args = parser.parse_args()
    result = compare_contract_dirs(Path(args.reference_dir), Path(args.candidate_dir))
    report = dataclasses.asdict(result)
    if args.report_file:
        write_json(Path(args.report_file), report)
    if result.ok:
        print("contract parity ok")
        return
    print(f"contract parity mismatch: {', '.join(result.mismatches)}", file=sys.stderr)
    raise SystemExit(1)


if __name__ == "__main__":
    main()
