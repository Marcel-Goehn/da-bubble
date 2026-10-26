package com.dabubble.backend.support

import software.amazon.awssdk.core.exception.SdkClientException
import software.amazon.awssdk.services.s3.S3Client
import java.lang.reflect.InvocationTargetException
import java.lang.reflect.Proxy

/** Makes storage refuse deletes while [down], as an unreachable SeaweedFS would; everything else still works. */
object StorageOutage {
    @Volatile
    var down = false

    /** [s3], failing every delete while storage is [down]. */
    fun wrap(s3: S3Client): S3Client =
        Proxy.newProxyInstance(S3Client::class.java.classLoader, arrayOf(S3Client::class.java)) { _, method, args ->
            if (down && method.name.startsWith("delete")) {
                throw SdkClientException.create("Storage is down")
            }
            try {
                method.invoke(s3, *args.orEmpty())
            } catch (e: InvocationTargetException) {
                throw e.targetException
            }
        } as S3Client
}
