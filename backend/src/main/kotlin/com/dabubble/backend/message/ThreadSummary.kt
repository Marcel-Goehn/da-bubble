package com.dabubble.backend.message

import java.time.Instant

/** The derived state of the Thread of the Message [parentMessageId], which has at least one Reply. */
data class ThreadSummary(
    val parentMessageId: Long,
    val replyCount: Long,
    val lastReplyAt: Instant,
) {
    fun toDto() = ThreadSummaryDto(parentMessageId, replyCount.toInt(), lastReplyAt)
}
