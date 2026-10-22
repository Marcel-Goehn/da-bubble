# Which OpenAPI → Angular client generator fits springdoc and Angular 22?

Research for [#37](https://github.com/Marcel-Goehn/da-bubble/issues/37) (map: [#1](https://github.com/Marcel-Goehn/da-bubble/issues/1)). Checked 2026-10-22 against GitHub releases, npm, the projects' own docs and source, and a small generation test (see "Generation check" below). The repo is on Spring Boot `4.1.1`, Kotlin `2.3.21`, Java 25, Gradle `9.8.1` and `springdoc-openapi-starter-webmvc-ui:3.1.0` (`backend/build.gradle.kts`, `backend/gradle/wrapper/gradle-wrapper.properties`), and Angular `^22.2.0` with TypeScript `~6.0.2` (`frontend/package.json`).

## Recommendation

Use **Orval 8.x (`client: 'angular'`) with `override.angular.retrievalClient: 'both'`**, generated from an `openapi.json` that the backend writes at build time and that is committed to the repo.

- `both` gives injectable `HttpClient` service classes (Observables) for every operation **plus** sibling `*.resource.ts` files with signal-based `httpResource` helpers for reads. This matches Angular's own guidance: `httpResource` is stable since v22.0, and Angular says to avoid it for POST/PUT and use `HttpClient` for writes.
- Everything goes through Angular `HttpClient`, so the functional `includeBearerTokenInterceptor` from keycloak-angular ([Which Angular library runs the PKCE flow against Keycloak?](https://github.com/Marcel-Goehn/da-bubble/issues/4)) applies without extra setup. Angular says `httpResource` is "built on top of HttpClient … supports … interceptors".
- No Java toolchain is needed on the frontend side (pure npm), the Angular generator is its own package (`@orval/angular`) with an Angular 22 sample app in the Orval repo, and it releases about weekly (8.40 to 8.44 in October 2026 alone). Orval resolves specs as OAS 3.1 internally, which is what springdoc 3 emits by default.
- **Fallback: openapi-generator `typescript-angular` (7.25+).** It supports Angular 22 (since 7.25.0, default `ngVersion` 22.0.0), generates `provideApi(...)` for standalone apps, and has the biggest user base. Its signal support (`withHttpResource`) was merged on 2026-10-21 for milestone **7.27.0 and is not released yet** (latest is 7.26.0). OAS 3.1 support is still labelled beta, and the generator needs a JVM. Switch to it if Orval's fast release pace breaks the build, or if Orval's output shape gets in the way.

## Comparison

| | Orval 8.44.0 | openapi-generator `typescript-angular` 7.26.0 | ng-openapi-gen 1.1.0 | Hey API `@hey-api/openapi-ts` 0.99.0 | Hand-written |
|---|---|---|---|---|---|
| Angular 22 | Orval workspace upgraded to Angular 22 in 8.19.0; output compiles against 22.2.3 (tested) | "Angular (9.x - 22.x)", Angular 22 added in 7.25.0; compiles (tested) | peer `@angular/core >=16`; compiles (tested) | example app is on Angular 21.2; **confirm in a spike** | n/a |
| Signals / `httpResource` | yes, `retrievalClient: 'httpResource'` or `'both'` (reads only; writes stay `HttpClient`) | only from 7.27.0 (`withHttpResource`, unreleased); Observables otherwise | no; Promise (default since 1.0) or Observable | yes, `@angular/common` plugin `httpResources` | whatever we write |
| Standalone / providers | `@Injectable({ providedIn: 'root' })` services, `httpResource` functions; base URL via interceptor or `override.angular.baseUrl` DI token | `provideApi(basePath or config)` via `makeEnvironmentProviders`; `NgModule` still generated but optional | `provideApiConfiguration(rootUrl)`; no `NgModule` by default since 1.0 | `@hey-api/client-angular` (uses `inject(HttpClient)`) | n/a |
| Bearer interceptor | works (all calls via `HttpClient`) | works (`HttpClient`) | works (`HttpClient`) | works (`HttpClient`) | works |
| Enums | `enumGenerationType`: `'const'` (default, `as const` object + type), `'enum'`, `'union'` | TS `enum` (`stringEnums`, `enumPropertyNaming`, `enumUnknownDefaultCase`) | `enumStyle: 'alias'` union by default, `enumArray` for value lists | `enums: 'javascript'` etc. | n/a |
| OAS 3.1 | native (resolves to 3.1 internally) | "3.1 (beta support)", warns on every run | supported since 1.0; open 3.1 nullable bugs (#350 `["integer","null"]`, #410 nullable array of `$ref`) | supported | n/a |
| Runs on | Node | JVM (npm CLI wrapper downloads the jar; Gradle plugin also exists) | Node | Node | n/a |
| Maintenance | last release 2026-10-21, ~weekly; 1.4 M weekly npm downloads (all clients) | last release 2026-10-06, ~monthly; 0.72 M weekly CLI downloads | last release 2026-09-23 (previous 2025-11-24); 0.10 M weekly | 3.0 M weekly, but still 0.x (breaking changes in minors); last release 2026-06-22 | our cost |

Also seen: `ng-openapi` (0.4.1, ~2 k weekly downloads), too small to rely on. Hand-written clients lose the point of the contract: DTO drift between Kotlin and TypeScript becomes a runtime bug instead of a compile error. Keep that only if [Is the REST API contract-first or code-first, and is the Angular client generated?](https://github.com/Marcel-Goehn/da-bubble/issues/38) decides against generation.

## springdoc and Spring Boot 4.1

- **Supported.** springdoc 3.x targets Spring Boot 4 (3.0.0 on 2025-11-21 was "Upgrade to Spring Boot 4.0.0"). **3.1.0** (2026-08-01) upgraded to Spring Boot **4.1.0**. **3.1.1** (2026-09-06) is the latest and the version the springdoc FAQ recommends. The 2.9.x line is for Boot 3.
- **Bump `3.1.0` → `3.1.1`.** It fixes security advisories, including an unbounded per-locale OpenAPI cache (`Accept-Language` memory exhaustion) and a swagger-ui DOMPurify XSS. Some other advisories only concern the MCP and Scalar modules, which we don't use. It also fixes Kotlin `Any?` nullability (#3338).
- **Default output is OpenAPI 3.1.** `springdoc.api-docs.version` defaults to `openapi_3_1`. Setting it to `openapi_3_0` is a lever if a generator struggles with 3.1. Also set `springdoc.writer-with-order-by-keys=true` so the committed spec diffs cleanly.

### Kotlin nullability in the spec

- Kotlin nullability comes from `kotlin-reflect`, which is already a dependency. A property of type `T?` is left out of `required`. Since **3.0.3** (#3256) the schema is also marked nullable: in OAS 3.1, a simple type becomes `"type": ["string", "null"]` and a `$ref` becomes `"oneOf": [{"$ref": …}, {"type": "null"}]`. Generators then produce `prop?: T | null`.
- If the backend leaves nulls out (`@JsonInclude(NON_NULL)`), turn off the `| null` with `springdoc.model-converters.kotlin-nullable-property-customizer.enabled=false` (added in 3.1.0 by #3269; a user confirmed it works on 3.1.1). Then a nullable property is just optional (`prop?: T`). Pick one rule and apply it everywhere. The Jackson default (nulls written) plus the default customizer gives `prop?: T | null`, which is honest but means every consumer has to handle both cases.
- Non-null Kotlin properties should appear in `required`. Whether a non-null property **with a default value** is treated as required is **confirm in a spike**.
- Inherited nullable fields from a parent class were fixed in 3.1.0 (#3304). `@Schema` works on Kotlin value classes since 3.0.1 (#3168).

### Enum fidelity

- A Kotlin `enum class` is written as a string `enum` list. By default the list is **inlined into every property that uses it**, which gives one TS type per use (e.g. `MessageDtoStatus`) instead of one shared type. To get one named, shared schema, put `@Schema(enumAsRef = true)` on the enum, or set `io.swagger.v3.core.jackson.ModelResolver.enumsAsRef = true` globally in a static block (springdoc FAQ). Using it globally is recommended so that, for example, a `ConversationKind` enum stays one TS type.
- The values are the Kotlin constant names (Jackson's default). `@JsonValue` / `@JsonProperty` renames are **confirm in a spike** with Jackson 3 (`tools.jackson.module:jackson-module-kotlin`).
- Large ids: `bigint`/`int64` maps to TS `number` in all three generators (tested). That's fine for identity ids well below 2^53. `users.id` is a `uuid` string.

### Producing the spec at build time

- **springdoc-openapi-gradle-plugin 1.9.0** (`org.springdoc.openapi-gradle-plugin`) starts the app with a forked `bootRun` (`forkedSpringBootRun`), downloads `/v3/api-docs` and writes `build/openapi.json`. It has had **no release or commit since 2024-06-22**, and it has open, unanswered issues about Java 25 (#172), Boot 3.x Gradle plugin task wiring (#173) and the Gradle configuration cache (#166, workaround: `notCompatibleWithConfigurationCache`). It also needs a bootable app, i.e. Postgres reachable and the OAuth2 resource-server config resolvable. Whether it works with Boot 4.1.1 / Gradle 9.8.1 / Java 25 is **confirm in a spike**.
- **Preferred: a backend test that writes the spec.** A `@SpringBootTest` + MockMvc test calls `GET /v3/api-docs` and writes `openapi.json` into the repo (e.g. `frontend/openapi/openapi.json` or `api/openapi.json`). This uses the same context and Testcontainers setup as the other integration tests, needs no unmaintained plugin, and the committed file makes contract changes show up in PR diffs. CI can fail if regenerating changes the file. The test is our own idea, not a documented springdoc feature. The [springdoc Maven plugin](https://github.com/springdoc/springdoc-openapi-maven-plugin) works the same way (runs the app, fetches the URL).
- Frontend side: an `npm run api` script (`orval --config orval.config.ts`) generates from the committed spec into `src/app/api/` (generated files committed or git-ignored; to decide in the grilling ticket).

## Generation check

On 2026-10-22, a hand-written OAS 3.1 spec shaped like springdoc's Kotlin output (`type: [X, "null"]`, `oneOf [$ref, null]` for a nullable reference, nullable enum, nullable array of `$ref`, a shared enum `$ref`, `int64` ids) went through Orval 8.44.0 (`both`), ng-openapi-gen 1.1.0 and openapi-generator 7.26.0. All three outputs passed `tsc --strict` with TypeScript 6.0.3 against `@angular/core`/`@angular/common` 22.2.3.

- All three produced `parent?: UserDto | null`, `editedAt?: string | null`, `mentions?: UserDto[] | null`, and required non-null fields.
- Orval produced `getMessageResource(id: Signal<number>, options?)` returning `HttpResourceRef<MessageDto | undefined>` next to an injectable `MessagesService` with `HttpClient` overloads (body / events / response). Shared enum: `as const` object + type. Nullable inline enum: `MessageDtoStatus … | null`.
- openapi-generator printed "OpenAPI 3.1 support is still in beta" and produced a TS `enum MessageDtoStatusEnum`.
- ng-openapi-gen produced a union `('SENT' | 'DELETED' | null)` and `fn/` functions plus an `Api` service.

This was a hand-written spec, not real springdoc output. Running it against the real backend DTOs is still **confirm in a spike**.

## Confirm in a spike

1. The real springdoc 3.1.1 output for our Kotlin DTOs (nullable `$ref`, defaults, value classes, `Instant` → `date-time`), run through Orval, with and without `kotlin-nullable-property-customizer`.
2. How the spec gets produced: whether a `@SpringBootTest` dump or the Gradle plugin works on Boot 4.1.1 / Gradle 9.8.1 / Java 25.
3. Orval `httpResource` together with keycloak-angular's `includeBearerTokenInterceptor` URL conditions in the zoneless app (expected to work, since both go through `HttpClient`).
4. Event DTOs for the STOMP socket: only schemas reachable from a REST operation end up in the spec. Event envelopes have to be added explicitly (e.g. an `OpenApiCustomizer` that registers them as component schemas) if the frontend should get their types from the generator.

## Sources

- springdoc releases (3.0.0 → 3.1.1 notes: Boot 4.0/4.1 upgrades, #3256, #3269, #3304, #3338, security advisories): https://github.com/springdoc/springdoc-openapi/releases
- springdoc #3256 (Kotlin nullable → OAS 3.0 `nullable` / OAS 3.1 type arrays and `oneOf`): https://github.com/springdoc/springdoc-openapi/pull/3256 ; #3269 (disable switch, user confirmation on 3.1.1): https://github.com/springdoc/springdoc-openapi/issues/3269
- springdoc properties (`springdoc.api-docs.version` default `openapi_3_1`, `writer-with-order-by-keys`, `nullable-request-parameter-enabled`): https://springdoc.org/properties.html
- springdoc FAQ (`enumAsRef`, `ModelResolver.enumsAsRef`, Boot 4 ↔ 3.x, build-time plugins): https://springdoc.org/faq.html
- springdoc-openapi-gradle-plugin README and issues #166, #172, #173 (last commit 2024-06-23): https://github.com/springdoc/springdoc-openapi-gradle-plugin
- Angular `httpResource` API (stable since v22.0): https://angular.dev/api/common/http/httpResource ; guide (built on HttpClient, interceptors, avoid for mutations): https://angular.dev/guide/http/http-resource
- Orval `@orval/angular` README (`httpClient` / `httpResource` / `both`): https://github.com/orval-labs/orval/tree/master/packages/angular ; Angular guide source: https://github.com/orval-labs/orval/blob/master/docs/content/docs/guides/angular.mdx ; output reference (`enumGenerationType`): https://github.com/orval-labs/orval/blob/master/docs/content/docs/reference/configuration/output.mdx ; releases: https://github.com/orval-labs/orval/releases
- openapi-generator `typescript-angular` options (`ngVersion` 22.0.0, `withHttpResource`, `stringEnums`, `providedIn`): https://github.com/OpenAPITools/openapi-generator/blob/master/docs/generators/typescript-angular.md ; `provide-api.mustache`: https://github.com/OpenAPITools/openapi-generator/blob/master/modules/openapi-generator/src/main/resources/typescript-angular/provide-api.mustache ; PR #24964 (`withHttpResource`, milestone 7.27.0): https://github.com/OpenAPITools/openapi-generator/pull/24964 ; releases (Angular 22 in 7.25.0): https://github.com/OpenAPITools/openapi-generator/releases ; README ("3.1 (beta support)"): https://github.com/OpenAPITools/openapi-generator
- ng-openapi-gen README (Angular 16+, OAS 3.1 since 1.0, Promise default, `enumStyle`, `provideApiConfiguration`, functional interceptor): https://github.com/cyclosproject/ng-openapi-gen ; issues #350, #410: https://github.com/cyclosproject/ng-openapi-gen/issues
- Hey API Angular example config and client (uses `inject(HttpClient)`): https://github.com/hey-api/openapi-ts/tree/main/examples/openapi-ts-angular-common ; https://github.com/hey-api/openapi-ts/blob/main/packages/openapi-ts/src/plugins/@hey-api/client-angular/bundle/client.ts
- npm metadata (`npm view`) and npm downloads API (week 2026-10-12 to 2026-10-18), 2026-10-22: orval, ng-openapi-gen, ng-openapi, @openapitools/openapi-generator-cli, @hey-api/openapi-ts
