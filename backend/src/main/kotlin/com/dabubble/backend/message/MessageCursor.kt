package com.dabubble.backend.message

import java.time.Instant
import java.util.Base64

/**
 * The position after which the next older page starts: the last Message's `(created_at, id)`. Clients get it
 * as an opaque URL-safe base64 string; ties on the timestamp are broken by the id, so no Message is skipped.
 */
data class MessageCursor(
    val createdAt: Instant,
    val id: Long,
) {
    fun encode(): String = encoder.encodeToString("$createdAt$SEPARATOR$id".toByteArray())

    companion object {
        private const val SEPARATOR = '|'
        private val encoder = Base64.getUrlEncoder().withoutPadding()

        /** The cursor [encoded] holds, or `null` if it isn't one of ours. */
        fun decode(encoded: String): MessageCursor? =
            runCatching {
                val (createdAt, id) = String(Base64.getUrlDecoder().decode(encoded)).split(SEPARATOR)
                MessageCursor(Instant.parse(createdAt), id.toLong())
            }.getOrNull()
    }
}
