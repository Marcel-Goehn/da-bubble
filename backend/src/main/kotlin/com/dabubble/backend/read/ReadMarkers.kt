package com.dabubble.backend.read

import com.dabubble.backend.realtime.ReadUpdatedEvent
import com.dabubble.backend.realtime.RealtimePublisher
import com.dabubble.backend.time.now
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional
import java.time.Clock
import java.time.ZoneOffset
import java.util.UUID

/**
 * A User's read markers: one per Conversation, for its sidebar count, and one per Thread, for its "N neu".
 * Marking read moves a marker to now, never back, and tells the User's other tabs once committed.
 */
@Component
class ReadMarkers(
    private val jdbc: JdbcClient,
    private val realtime: RealtimePublisher,
    private val clock: Clock,
) {
    /** The User [userId] has read the Conversation [conversationId], which the caller checked they see. */
    @Transactional
    fun markConversationRead(
        userId: UUID,
        conversationId: Long,
    ) {
        val now = clock.now()
        jdbc
            .sql(
                """
                INSERT INTO conversation_read_markers (user_id, conversation_id, read_at)
                VALUES (:userId, :conversationId, :now)
                ON CONFLICT (user_id, conversation_id)
                DO UPDATE SET read_at = greatest(conversation_read_markers.read_at, excluded.read_at)
                """.trimIndent(),
            ).param("userId", userId)
            .param("conversationId", conversationId)
            .param("now", now.atOffset(ZoneOffset.UTC))
            .update()
        realtime.toUsers(setOf(userId), ReadUpdatedEvent(conversationId, null, now))
    }

    /** The User [userId] has read the Thread of [parentMessageId] in [conversationId], checked as above. */
    @Transactional
    fun markThreadRead(
        userId: UUID,
        conversationId: Long,
        parentMessageId: Long,
    ) {
        val now = clock.now()
        jdbc
            .sql(
                """
                INSERT INTO thread_read_markers (user_id, parent_message_id, read_at)
                VALUES (:userId, :parentMessageId, :now)
                ON CONFLICT (user_id, parent_message_id)
                DO UPDATE SET read_at = greatest(thread_read_markers.read_at, excluded.read_at)
                """.trimIndent(),
            ).param("userId", userId)
            .param("parentMessageId", parentMessageId)
            .param("now", now.atOffset(ZoneOffset.UTC))
            .update()
        realtime.toUsers(setOf(userId), ReadUpdatedEvent(conversationId, parentMessageId, now))
    }
}
