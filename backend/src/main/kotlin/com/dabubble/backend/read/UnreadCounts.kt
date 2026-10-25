package com.dabubble.backend.read

import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Component
import java.util.UUID

/**
 * Derives what a User hasn't read in the Conversations they can see. A Message or Reply is Unread if someone
 * else sent it after the User joined a Channel (any time in a DM) and after the User last opened
 * its Conversation, or for "N neu" its Thread; a Thread never opened falls back to the join time.
 */
@Component
class UnreadCounts(
    private val jdbc: JdbcClient,
) {
    fun of(userId: UUID): UnreadDto {
        val conversations =
            jdbc
                .sql(
                    """
                    $VISIBLE
                    SELECT v.id, count(*) AS unread
                    FROM visible v
                    JOIN messages m ON m.conversation_id = v.id
                    LEFT JOIN conversation_read_markers rm ON rm.conversation_id = v.id AND rm.user_id = :userId
                    -- greatest ignores a null: without a marker, only the join time counts.
                    WHERE m.author_id <> :userId AND m.created_at > greatest(v.joined_at, rm.read_at)
                    GROUP BY v.id
                    ORDER BY v.id
                    """.trimIndent(),
                ).param("userId", userId)
                .query { rs, _ -> ConversationUnreadDto(rs.getLong("id"), rs.getInt("unread")) }
                .list()
        val threads =
            jdbc
                .sql(
                    """
                    $VISIBLE
                    SELECT v.id, r.parent_message_id, count(*) AS unread
                    FROM visible v
                    JOIN messages r ON r.conversation_id = v.id AND r.parent_message_id IS NOT NULL
                    LEFT JOIN thread_read_markers rm ON rm.parent_message_id = r.parent_message_id AND rm.user_id = :userId
                    WHERE r.author_id <> :userId AND r.created_at > greatest(v.joined_at, rm.read_at)
                    GROUP BY v.id, r.parent_message_id
                    ORDER BY v.id, r.parent_message_id
                    """.trimIndent(),
                ).param("userId", userId)
                .query { rs, _ ->
                    ThreadUnreadDto(rs.getLong("id"), rs.getLong("parent_message_id"), rs.getInt("unread"))
                }.list()
        return UnreadDto(conversations, threads)
    }

    private companion object {
        // The Conversations the User sees, with when they joined each. A DM has no join time: the first Message
        // creates it, at that Message's time.
        const val VISIBLE = """
            WITH visible AS (
                SELECT c.id, coalesce(ms.joined_at, '-infinity') AS joined_at
                FROM conversations c
                LEFT JOIN memberships ms ON ms.conversation_id = c.id AND ms.user_id = :userId
                WHERE ms.user_id IS NOT NULL OR c.user_low = :userId OR c.user_high = :userId
            )
        """
    }
}
