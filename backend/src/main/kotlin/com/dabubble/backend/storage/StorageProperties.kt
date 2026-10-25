package com.dabubble.backend.storage

import org.springframework.boot.context.properties.ConfigurationProperties

/** Where files are stored: one S3 bucket on SeaweedFS (`dabubble.storage.*`). */
@ConfigurationProperties("dabubble.storage")
data class StorageProperties(
    /** For the backend's own calls; in compose, the internal host. */
    val endpoint: String,
    /** For presigned URLs, which the browser opens. */
    val publicEndpoint: String,
    val bucket: String,
    val accessKey: String,
    val secretKey: String,
    // SeaweedFS ignores the region, but SigV4 signs one.
    val region: String = "us-east-1",
)
