# The REST API is code-first, with a committed OpenAPI spec and a generated Angular client

The Kotlin controllers and DTOs are the only place the API is defined. springdoc derives the OpenAPI spec from them, a backend test (`OpenApiSpecTest`) writes it to `backend/openapi.json`, and Orval generates the Angular services and types from that file into `frontend/src/app/api/generated/`. Both the spec and the generated TypeScript are committed and never hand-edited, so an API change shows up in a diff and a field that changes or disappears becomes a compile error in the frontend. We chose this because one developer owns both sides, and the alternatives either mean maintaining a second definition by hand or give up the compile-time check.

## Considered Options

- **Contract-first** (hand-written spec, both sides generated): rejected as ceremony for a single team, with a YAML file to maintain alongside the Kotlin.
- **Hand-written TS client**: rejected because nothing catches drift between backend and frontend.
- **Git-ignored generated TS**: rejected so a fresh clone runs `ng serve` without a generation step and PRs show the TS change.

## Consequences

- Drift is guarded locally only: `OpenApiSpecTest` fails when the spec changed, and npm `prestart`/`prebuild` run Orval. There is no CI yet, so a Kotlin change made without running the backend tests leaves the spec stale until the next test run.
- Responses always serialise every field. Kotlin `T?` becomes TS `T | null` and is never left out, so a pushed DTO merged over an existing one can't keep a stale value.
- The STOMP event envelopes are registered in the spec as well, so realtime payloads are the same generated types as REST.
