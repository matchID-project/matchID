#!/usr/bin/env python3

import argparse
import json
from pathlib import Path


PACKAGE_FILES = {
    "deces-ui": {
        "manifest": Path("packages/deces-ui/package.json"),
        "lockfile": Path("packages/deces-ui/package-lock.json"),
    },
    "deces-backend": {
        "manifest": Path("packages/deces-backend/package.json"),
        "lockfile": Path("packages/deces-backend/package-lock.json"),
    },
    "dataprep-frontend": {
        "manifest": Path("packages/dataprep-frontend/package.json"),
        "lockfile": None,
    },
    "dataprep-backend": {
        "version_file": Path("packages/dataprep-backend/VERSION"),
    },
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Read or update independent package versions in the monorepo."
    )
    parser.add_argument(
        "--root",
        type=Path,
        default=Path.cwd(),
        help="Monorepo root. Defaults to the current directory.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("list", help="List all package versions.")

    get_parser = subparsers.add_parser("get", help="Read one package version.")
    get_parser.add_argument("--package", required=True, choices=PACKAGE_FILES)

    set_parser = subparsers.add_parser("set", help="Update one package version.")
    set_parser.add_argument("--package", required=True, choices=PACKAGE_FILES)
    set_parser.add_argument("--version", required=True)

    return parser.parse_args()


def read_json(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path: Path, payload: dict) -> None:
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)
        handle.write("\n")


def get_version(root: Path, package: str) -> str:
    package_config = PACKAGE_FILES[package]
    version_file = package_config.get("version_file")
    if version_file is not None:
        return (root / version_file).read_text(encoding="utf-8").strip()
    manifest = read_json(root / package_config["manifest"])
    return manifest["version"]


def set_version(root: Path, package: str, version: str) -> None:
    if not version.strip() or any(char.isspace() for char in version):
        raise SystemExit("VERSION must be non-empty and must not contain whitespace")

    package_config = PACKAGE_FILES[package]
    version_file = package_config.get("version_file")
    if version_file is not None:
        (root / version_file).write_text(f"{version}\n", encoding="utf-8")
        return

    manifest_path = root / package_config["manifest"]
    manifest = read_json(manifest_path)
    manifest["version"] = version
    write_json(manifest_path, manifest)

    lockfile = package_config.get("lockfile")
    if lockfile is None:
        return

    lockfile_path = root / lockfile
    lockfile_payload = read_json(lockfile_path)
    lockfile_payload["version"] = version
    if isinstance(lockfile_payload.get("packages"), dict) and isinstance(
        lockfile_payload["packages"].get(""), dict
    ):
        lockfile_payload["packages"][""]["version"] = version
    write_json(lockfile_path, lockfile_payload)


def main() -> None:
    args = parse_args()
    root = args.root.resolve()

    if args.command == "list":
        for package in PACKAGE_FILES:
            print(f"{package}: {get_version(root, package)}")
        return

    if args.command == "get":
        print(get_version(root, args.package))
        return

    if args.command == "set":
        set_version(root, args.package, args.version)
        print(get_version(root, args.package))
        return

    raise SystemExit(f"Unsupported command: {args.command}")


if __name__ == "__main__":
    main()
