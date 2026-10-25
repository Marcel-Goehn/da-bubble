package com.dabubble.backend.storage

import org.springframework.stereotype.Component
import software.amazon.awssdk.services.s3.S3Client
import software.amazon.awssdk.services.s3.model.GetObjectRequest
import software.amazon.awssdk.services.s3.model.HeadObjectRequest
import software.amazon.awssdk.services.s3.model.NoSuchKeyException
import software.amazon.awssdk.services.s3.model.PutObjectRequest
import software.amazon.awssdk.services.s3.presigner.S3Presigner
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest
import java.time.Duration

/** The bucket's objects, by key: presigned URLs for the browser, and the checks the backend makes itself. */
@Component
class ObjectStorage(
    private val s3: S3Client,
    private val presigner: S3Presigner,
    private val properties: StorageProperties,
) {
    /**
     * A URL the browser PUTs the object [key] to within [ttl]. The signature covers [contentLength] and
     * [contentType], so storage refuses any other size or type.
     */
    fun presignPut(
        key: String,
        contentLength: Long,
        contentType: String,
        ttl: Duration,
    ): String {
        val put =
            PutObjectRequest
                .builder()
                .bucket(properties.bucket)
                .key(key)
                .contentLength(contentLength)
                .contentType(contentType)
                .build()
        val request =
            PutObjectPresignRequest
                .builder()
                .signatureDuration(ttl)
                .putObjectRequest(put)
                .build()
        return presigner.presignPutObject(request).url().toString()
    }

    /** A URL the browser GETs the object [key] from within [ttl], served with [contentDisposition]. */
    fun presignGet(
        key: String,
        contentDisposition: String,
        ttl: Duration,
    ): String {
        val get =
            GetObjectRequest
                .builder()
                .bucket(properties.bucket)
                .key(key)
                .responseContentDisposition(contentDisposition)
                .build()
        val request =
            GetObjectPresignRequest
                .builder()
                .signatureDuration(ttl)
                .getObjectRequest(get)
                .build()
        return presigner.presignGetObject(request).url().toString()
    }

    /** The size in bytes of the object [key], or `null` if there is none. */
    fun sizeOf(key: String): Long? =
        try {
            s3
                .headObject(
                    HeadObjectRequest
                        .builder()
                        .bucket(properties.bucket)
                        .key(key)
                        .build(),
                ).contentLength()
        } catch (_: NoSuchKeyException) {
            null
        }
}
