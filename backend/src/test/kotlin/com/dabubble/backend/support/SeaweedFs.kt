package com.dabubble.backend.support

import com.dabubble.backend.storage.StorageConfig
import com.dabubble.backend.storage.StorageProperties
import org.awaitility.Awaitility.await
import org.testcontainers.containers.GenericContainer
import org.testcontainers.containers.wait.strategy.Wait
import software.amazon.awssdk.services.s3.S3Client
import software.amazon.awssdk.services.s3.model.HeadBucketRequest
import java.lang.reflect.InvocationTargetException
import java.lang.reflect.Proxy
import java.time.Duration

/**
 * A real SeaweedFS, the same image and mode as compose.yaml, started on first use so only storage tests pay
 * for it. The backend reaches it as `localhost` and the browser as `127.0.0.1`, so a presigned URL that
 * works was signed for the browser-facing endpoint.
 */
object SeaweedFs {
    private const val PORT = 8333
    private const val BUCKET = "dabubble"
    private const val ACCESS_KEY = "test"
    private const val SECRET_KEY = "test-secret"

    private val container: GenericContainer<*> by lazy {
        GenericContainer("chrislusf/seaweedfs:4.48")
            .withCommand("mini", "-dir=/data", "-bucket=$BUCKET")
            .withEnv("AWS_ACCESS_KEY_ID", ACCESS_KEY)
            .withEnv("AWS_SECRET_ACCESS_KEY", SECRET_KEY)
            .withExposedPorts(PORT)
            .waitingFor(Wait.forListeningPort())
            .apply { start() }
    }

    /** The settings the app gets in tests; starts SeaweedFS. */
    val properties: StorageProperties by lazy {
        val port = container.getMappedPort(PORT)
        StorageProperties(
            endpoint = "http://localhost:$port",
            publicEndpoint = "http://127.0.0.1:$port",
            bucket = BUCKET,
            accessKey = ACCESS_KEY,
            secretKey = SECRET_KEY,
        ).also { awaitBucket(it) }
    }

    // The bucket is created a moment after the S3 API is up.
    private fun awaitBucket(properties: StorageProperties) {
        StorageConfig().s3Client(properties).use { s3 ->
            await().atMost(Duration.ofSeconds(60)).ignoreExceptions().until {
                s3.headBucket(HeadBucketRequest.builder().bucket(BUCKET).build())
                true
            }
        }
    }

    /** An [S3Client] for the backend's own calls, connecting on its first call. */
    fun s3Client(): S3Client = lazyProxy { StorageConfig().s3Client(properties) }

    /** An instance of [T] built by [create] on its first call; closing one never built does nothing. */
    inline fun <reified T : Any> lazyProxy(noinline create: () -> T): T {
        val target = lazy(create)
        return Proxy.newProxyInstance(T::class.java.classLoader, arrayOf(T::class.java)) { _, method, args ->
            if (method.name == "close" && !target.isInitialized()) {
                null
            } else {
                try {
                    method.invoke(target.value, *args.orEmpty())
                } catch (e: InvocationTargetException) {
                    throw e.targetException
                }
            }
        } as T
    }
}
