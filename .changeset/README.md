# Changesets

Changesets is an optional helper for Node packages:

- `packages/deces-ui`
- `packages/deces-backend`
- `packages/dataprep-frontend`

Canonical operator entrypoint is `make`, not the raw `changeset` CLI:

- `make package-versions`
- `make package-version PACKAGE=<name>`
- `make package-version-set PACKAGE=<name> VERSION=<x.y.z>`

The merged PR on `main` is already the release candidate, so final versions must
already be written in the commit that is validated on `dev-deces.matchid.io`.

If Changesets is used locally for a Node package, its result must already be
materialized in the package files before merge.

Do not use Changesets for `packages/dataprep-backend`.
Use `packages/dataprep-backend/VERSION` for the Python backend semantic version.
