# S3-compatible object storage in docker-compose

Research for [#14](https://github.com/Marcel-Goehn/da-bubble/issues/14) (map [#1](https://github.com/Marcel-Goehn/da-bubble/issues/1)). Researched 2026-10-21.

## Question

Attachments and uploaded Avatars ([#3](https://github.com/Marcel-Goehn/da-bubble/issues/3)) need S3-compatible storage as a docker-compose service. Which server fits a small local setup today, given MinIO's 2025 licence and image-distribution changes? Cover licence, official image availability, bucket bootstrap in compose, presigned URLs, and the Spring Boot client (AWS SDK v2 / Spring Cloud AWS).

## Recommendation (TL;DR)

1. **Use SeaweedFS, `chrislusf/seaweedfs:4.48`, in its `mini` mode.** Apache-2.0, official image on Docker Hub, released every few weeks. `mini` is the image's default command and is built "for S3 beginners and small/dev use cases". Credentials come from `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`, and `S3_BUCKET` creates the bucket at startup if it does not exist. No config file, no init container. CORS is open (`*`) by default, so the browser can use presigned URLs directly.
2. **Use the plain AWS SDK for Java v2 (`software.amazon.awssdk:s3`), not Spring Cloud AWS.** Spring Cloud AWS 4.x documents compatibility with Spring Boot **4.0.x** only; Boot 4.1 is not listed. We need two beans (`S3Client`, `S3Presigner`) and four properties, which does not justify the extra compatibility gate.
3. **Use two endpoints, as with Keycloak.** `S3Client` talks to `http://seaweedfs:8333` inside the compose network. `S3Presigner` signs with the browser-facing `http://localhost:8333`, because SigV4 signs the `host` header. Presigning is offline, so the presigner never has to reach that URL from inside the container. Use path-style addressing for both.
4. **Fallback: Garage `dxflrs/garage:v2.4.1`** with `server --single-node --default-bucket` (since v2.3.0). AGPL-3.0, presigned URLs, CORS and path-style documented as implemented. It needs a small `garage.toml` and a `PutBucketCors` call, so it is one step more work than SeaweedFS.
5. **Rule out MinIO, LocalStack and Ceph.** MinIO's repo is archived and its Docker Hub images are gone. LocalStack's current image needs an auth token. Ceph's container repo is archived and RGW is far too heavy. RustFS (Apache-2.0) only reached 1.0 on 2026-09-16; revisit later.

## 1. Candidates at a glance

| Server | Licence | Official image (current) | Maintained? | Bucket bootstrap in compose | Presigned URLs | Fit |
|---|---|---|---|---|---|---|
| **SeaweedFS** | Apache-2.0 [5] | `chrislusf/seaweedfs:4.48` (2026-09-28) [6] | Yes, release 4.48 on 2026-09-28, repo pushed 2026-10-21 [5][7] | `S3_BUCKET` env, created if missing [8] | Yes [9] | **Chosen** |
| Garage | AGPL-3.0 [10] | `dxflrs/garage:v2.4.1` (2026-09-08) [11] | Yes, mirror pushed 2026-10-16 [10] | `--single-node --default-bucket` + `GARAGE_DEFAULT_*` env [12] | Yes [13] | Fallback |
| RustFS | Apache-2.0 [14] | `rustfs/rustfs` [14] | Yes, but 1.0.0 only since 2026-09-16 [15] | Not documented in the README [14] | Not checked | Revisit later |
| MinIO | AGPL-3.0 [1] | **None.** Docker Hub repo returns 404 [3]; source-only [1] | **No.** Archived 2026-04-25 [1] | n/a | n/a | Ruled out |
| LocalStack | Proprietary image since 2026.03.0 [16] | `localstack/localstack`, needs `LOCALSTACK_AUTH_TOKEN` [16] | Yes | init hooks | Yes | Ruled out |
| Ceph RGW | LGPL (Ceph) | `ceph/ceph-container` archived [17] | Container repo no | cephadm / manual | Yes | Ruled out |

## 2. What happened to MinIO

- The `minio/minio` GitHub repository "was archived by the owner on Apr 25, 2026". Its README says "THIS REPOSITORY IS NO LONGER MAINTAINED" and points to the commercial AIStor Free and AIStor Enterprise [1]. The licence stays AGPL-3.0 [1][4].
- The README states: "We will no longer provide pre-compiled binary releases for the community version." Legacy binaries "will not receive updates." The only Docker path documented is building your own image from the Dockerfile [1].
- The Docker Hub repository is gone: `hub.docker.com/v2/repositories/minio/minio/` returns HTTP 404 (checked 2026-10-21) [3]. Projects reported failed pulls of `minio/minio` and `minio/mc` from around 2026-09-12 [2].
- Historical images were still pullable from `quay.io/minio/minio` (for example `RELEASE.2025-09-07T16-13-09Z`) in September 2026, with "no guarantee those images will stay available forever" [2]. Pinning an unmaintained 2025 image is not a base to build on.

## 3. SeaweedFS (recommended)

**Licence and image.** Apache-2.0 [5]. The official image is `chrislusf/seaweedfs`; `4.48` and its variants were pushed 2026-09-28 [6], matching GitHub release 4.48 [7]. Pin the exact tag, not `latest` or `dev`.

**`mini` mode.** The image's Dockerfile ends with `ENTRYPOINT ["/entrypoint.sh"]` and `CMD ["mini", "-dir=/data"]` [18]. `weed mini` is described in source as "a complete SeaweedFS setup optimized for S3 beginners and small/dev use cases", with the S3 endpoint on port 8333 and an admin UI on 23646 [8]. The README's quick start is [5]:

```
docker run -p 8333:8333 -v weed-data:/data \
  -e AWS_ACCESS_KEY_ID=admin \
  -e AWS_SECRET_ACCESS_KEY=secret \
  -e S3_BUCKET=my-bucket \
  chrislusf/seaweedfs
```

**Bucket bootstrap.** `-bucket` is "comma-separated S3 bucket names to create on startup if they do not already exist ... Falls back to S3_BUCKET env var." [8]. This is idempotent across restarts, so no init container is needed. `-s3.autoCreateBucket` defaults to true as well ("create the bucket on upload if it does not exist, for admin identities only") [8].

**CORS.** `-s3.allowedOrigins` defaults to `"*"` [8], so presigned PUT/GET from the Angular dev server works without a `PutBucketCors` step. The S3 API page also lists `PutBucketCors` as supported if we want to restrict origins [9].

**S3 feature coverage.** The wiki's feature table lists presigned URLs as "Yes" and Get/Put/DeleteBucketCors as "Yes". Unsupported features (torrent, Select, Object Lambda, lifecycle transitions, website config) are ones DA Bubble does not need [9].

**Persistence and permissions.** Mount a named volume at `/data`. The entrypoint, when run as root, chowns `/data` to the `seaweed` user and drops privileges with `su-exec` [18].

Sketch for `docker-compose.yml` (to be confirmed when the compose topology is built):

```yaml
seaweedfs:
  image: chrislusf/seaweedfs:4.48
  environment:
    AWS_ACCESS_KEY_ID: ${S3_ACCESS_KEY}
    AWS_SECRET_ACCESS_KEY: ${S3_SECRET_KEY}
    S3_BUCKET: da-bubble
  ports:
    - "8333:8333"   # S3 API, browser-facing for presigned URLs
  volumes:
    - seaweedfs-data:/data
```

## 4. Garage (fallback)

- **Licence and image.** AGPL-3.0 (GitHub mirror `deuxfleurs-org/garage`) [10]. AGPL obligations apply to modified versions offered over a network; we run it unmodified. Image `dxflrs/garage`, latest `v2.4.1` on 2026-09-08 [11].
- **Bootstrap.** Since v2.3.0, `garage server --single-node --default-bucket` configures a one-node cluster without replication and creates a default access key and bucket from `GARAGE_DEFAULT_ACCESS_KEY` (example: `GK` + 16 random hex bytes), `GARAGE_DEFAULT_SECRET_KEY` (32 hex bytes) and `GARAGE_DEFAULT_BUCKET` [12]. Before v2.3.0 this took `layout assign`, `layout apply`, `key create`, `bucket create` and `bucket allow` [12].
- **Config.** A `garage.toml` is required (`metadata_dir`, `data_dir`, `db_engine`, `replication_factor = 1`, `rpc_bind_addr`, `rpc_public_addr`, `rpc_secret`, plus `[s3_api]` with `s3_region = "garage"` and port 3900) [12].
- **S3 coverage.** Presigned URLs, SigV4, path-style and vhost-style, CreateBucket and Put/Get/DeleteBucketCors are "✅ Implemented". Bucket versioning is missing [13]. CORS is not open by default, so the backend (or a one-shot `aws` CLI container) must call `PutBucketCors` once.
- **Why second.** It does the job, but needs a config file with a secret, a CORS step, and has a smaller feature table than SeaweedFS. If SeaweedFS misbehaves in the spike, switching is a compose-and-properties change only.

## 5. Ruled out

- **LocalStack.** Since release 2026.03.0 (2026-03-23) it ships as "a single, unified container image requiring an auth token"; "Accessing the latest releases will require authenticated access", CI included [16]. Older pinned tags get "No ongoing updates" [16]. A per-developer account and token is friction for a local-only setup.
- **Ceph RGW.** `ceph/ceph-container` (the source of the old `ceph/demo` image) is archived, last pushed 2024-12-12 [17]. A real Ceph needs MON/OSD/RGW daemons via cephadm. Far too heavy for one bucket.
- **RustFS.** Apache-2.0, image `rustfs/rustfs`, MinIO-like ports 9000/9001 [14]. It went from alpha (until 2026-04-25) through beta and RC to 1.0.0 on 2026-09-16, now 1.0.3 (2026-10-17) [15]. The README documents default console credentials `rustfsadmin` but no env-var bucket bootstrap [14]. Promising, but five weeks of 1.0 is too young to be the default.

## 6. Spring Boot client

### Spring Cloud AWS vs plain AWS SDK v2

- Spring Cloud AWS's compatibility table maps **4.x.x → Spring Cloud 2025.1.x, Spring Boot 4.0.x, Spring Framework 7.0.x, AWS SDK 2.x**. Spring Boot 4.1 is not listed [19]. The latest release is 4.2.0 (2026-09-29), still built on `spring-cloud-build` 5.0.2 and managing AWS SDK `2.47.4` [20][21].
- Its S3 starter (`io.awspring.cloud:spring-cloud-aws-starter-s3`) offers `spring.cloud.aws.s3.endpoint`, `spring.cloud.aws.s3.region`, `spring.cloud.aws.s3.path-style-access-enabled`, and `S3Template.createSignedGetURL(bucket, key, Duration)` [22]. That is convenient, but it is exactly what two SDK beans give us.
- **Decision:** depend on `software.amazon.awssdk:bom` + `software.amazon.awssdk:s3` directly. This avoids running Boot 4.1.1 on a library that documents Boot 4.0.x. Revisit if we later need other AWS integrations.

### Configuration

- **Endpoints.** `S3Client.builder().endpointOverride(URI)` for internal calls. `S3Presigner.builder().endpointOverride(...)` "Configure[s] an endpoint that should be used in the pre-signed requests" [23]. Give the presigner the browser-facing URL (`http://localhost:8333`).
- **Why two endpoints.** A presigned URL without extra headers has signed headers `[host]` only [24], so the host the browser calls must equal the host the URL was signed for. Signing itself is a local computation (the AWS examples build the presigner with no client call [24]). This is the same split as Keycloak's `issuer-uri` / `jwk-set-uri` (map Decisions, #7).
- **Path-style.** Set `S3Configuration.builder().pathStyleAccessEnabled(true)` on both client and presigner via `serviceConfiguration(...)` [23]; compose hostnames like `seaweedfs` cannot resolve `bucket.seaweedfs`.
- **Region and credentials.** The presigner throws at `build()` if no region or credentials are found [23], so set a fixed region (any string the server accepts, for example `us-east-1`) and a `StaticCredentialsProvider` from properties.
- **Checksums.** Since AWS SDK for Java 2.30.0, request checksums (CRC32) and response validation default to `WHEN_SUPPORTED` [25]. Third-party S3 servers vary in how much of this they implement (Garage still has an open PR on `x-amz-checksum-type` response headers [26]). Set `requestChecksumCalculation(WHEN_REQUIRED)` and `responseChecksumValidation(WHEN_REQUIRED)` on the `S3Client` defensively, and confirm with an upload test in the spike.
- **Presigned PUT from the browser.** Fields like metadata or ACL map to `x-amz-*` headers that the caller must then send, or the server returns `SignatureDoesNotMatch`. Pass them as signed query parameters with `putRawQueryParameter`, or leave them out [24]. Content-Type and size limits are therefore best enforced by the backend before it hands out the URL.

## Open points for the spec

- Upload flow: browser PUTs via presigned URL vs. multipart upload through the backend. Presigned keeps file bytes off the backend; the Avatar size/type checks then move to presign time.
- Download flow: presigned GET (short-lived URLs in message payloads) vs. a backend proxy endpoint that checks Channel membership on every request.
- One bucket with key prefixes (`avatars/`, `attachments/<channelId>/`) is enough for v1.

## Sources

1. MinIO GitHub repository and README (archived 2026-04-25, AGPLv3, source-only): https://github.com/minio/minio
2. StableBuild, "MinIO images disappeared from Docker Hub" (2026-09-17): https://www.stablebuild.com/blog/minio-images-disappeared-from-docker-hub
3. Docker Hub API, `minio/minio` repository (HTTP 404 on 2026-10-21): https://hub.docker.com/v2/repositories/minio/minio/
4. GitHub API `repos/minio/minio` (archived: true, licence AGPL-3.0, last push 2026-04-24): https://api.github.com/repos/minio/minio
5. SeaweedFS GitHub repository and README (Apache-2.0, Docker quick start): https://github.com/seaweedfs/seaweedfs
6. Docker Hub tags, `chrislusf/seaweedfs` (4.48 pushed 2026-09-28): https://hub.docker.com/r/chrislusf/seaweedfs/tags
7. SeaweedFS GitHub releases (4.48, 2026-09-28): https://github.com/seaweedfs/seaweedfs/releases
8. SeaweedFS source, `weed/command/mini.go` at tag 4.48 (flags `-bucket`/`S3_BUCKET`, `-s3.allowedOrigins`, `-s3.autoCreateBucket`, ports): https://github.com/seaweedfs/seaweedfs/blob/4.48/weed/command/mini.go
9. SeaweedFS wiki, Amazon S3 API (feature table): https://github.com/seaweedfs/seaweedfs/wiki/Amazon-S3-API
10. Garage GitHub mirror (AGPL-3.0, not archived): https://github.com/deuxfleurs-org/garage
11. Docker Hub tags, `dxflrs/garage` (v2.4.1 on 2026-09-08, v2.3.0 on 2026-04-16): https://hub.docker.com/r/dxflrs/garage/tags
12. Garage documentation, Quick Start: https://garagehq.deuxfleurs.fr/documentation/quick-start/
13. Garage documentation, S3 Compatibility status: https://garagehq.deuxfleurs.fr/documentation/reference-manual/s3-compatibility/
14. RustFS GitHub repository and README: https://github.com/rustfs/rustfs
15. RustFS GitHub releases (1.0.0 on 2026-09-16, 1.0.3 on 2026-10-17): https://github.com/rustfs/rustfs/releases
16. LocalStack blog, "LocalStack for AWS Is Moving to a Single Image. Here are Your Next Steps": https://blog.localstack.cloud/localstack-single-image-next-steps/
17. GitHub API `repos/ceph/ceph-container` (archived: true, last push 2024-12-12): https://github.com/ceph/ceph-container
18. SeaweedFS `docker/Dockerfile.go_build` and `docker/entrypoint.sh` at tag 4.48: https://github.com/seaweedfs/seaweedfs/tree/4.48/docker
19. Spring Cloud AWS README, compatibility table: https://github.com/awspring/spring-cloud-aws
20. Spring Cloud AWS releases (4.2.0 on 2026-09-29, 4.1.1 on 2026-08-28): https://github.com/awspring/spring-cloud-aws/releases
21. Spring Cloud AWS `pom.xml` and `spring-cloud-aws-dependencies/pom.xml` at v4.2.0: https://github.com/awspring/spring-cloud-aws/tree/v4.2.0
22. Spring Cloud AWS 4.1.1 reference documentation (S3 section): https://docs.awspring.io/spring-cloud-aws/docs/4.1.1/reference/html/index.html
23. AWS SDK for Java 2.x API, `S3Presigner.Builder`: https://docs.aws.amazon.com/java/api/latest/software/amazon/awssdk/services/s3/presigner/S3Presigner.Builder.html
24. AWS SDK for Java 2.x Developer Guide, "Work with Amazon S3 pre-signed URLs": https://docs.aws.amazon.com/sdk-for-java/latest/developer-guide/examples-s3-presign.html
25. AWS SDKs and Tools Reference Guide, "Data Integrity Protections for Amazon S3": https://docs.aws.amazon.com/sdkref/latest/guide/feature-dataintegrity.html ; AWS SDK for Java 2.x, "Data integrity protection with checksums" (2.30.0): https://docs.aws.amazon.com/sdk-for-java/latest/developer-guide/s3-checksums.html
26. Garage PR #1511, "fix(s3): return x-amz-checksum-type in responses as per AWS S3 spec": https://git.deuxfleurs.fr/Deuxfleurs/garage/pulls/1511
