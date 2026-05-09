#!/usr/bin/env bash
set -euo pipefail

sep=""
for arg in "$@"; do
	quoted=${arg//\'/\'\\\'\'}
	printf "%s'%s'" "$sep" "$quoted"
	sep=" "
done
printf '\n'
