#!/usr/bin/env bash

set -euo pipefail

namespace="${1:?namespace is required}"
statefulset="${2:?statefulset name is required}"
pod="${3:-${statefulset}-0}"

if ! kubectl -n "$namespace" get pod "$pod" >/dev/null 2>&1; then
  exit 0
fi

# An OrderedReady StatefulSet can remain blocked on an unhealthy pod from the
# previous revision. Wait for the controller to publish the revision produced
# by the manifest that was just applied before deciding whether recovery is
# needed.
for attempt in $(seq 1 30); do
  revision_status="$(
    kubectl -n "$namespace" get statefulset "$statefulset" \
      -o jsonpath='{.metadata.generation}{"\t"}{.status.observedGeneration}{"\t"}{.status.updateRevision}'
  )"
  IFS=$'\t' read -r generation observed_generation desired_revision <<< "$revision_status"

  if [ -n "${desired_revision:-}" ] && [ "$generation" = "${observed_generation:-}" ]; then
    break
  fi

  if [ "$attempt" -eq 30 ]; then
    echo "StatefulSet $statefulset did not publish its desired revision" >&2
    exit 1
  fi
  sleep 1
done

pod_status="$(
  kubectl -n "$namespace" get pod "$pod" \
    -o jsonpath='{.metadata.labels.controller-revision-hash}{"\t"}{.status.conditions[?(@.type=="Ready")].status}'
)"
IFS=$'\t' read -r pod_revision pod_ready <<< "$pod_status"

if [ "${pod_revision:-}" != "$desired_revision" ] && [ "${pod_ready:-}" != "True" ]; then
  echo "Recreating non-ready $pod from revision ${pod_revision:-unknown} at desired revision $desired_revision"
  kubectl -n "$namespace" delete pod "$pod"
fi
