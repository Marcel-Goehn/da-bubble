package com.dabubble.backend.conversation

import com.dabubble.backend.problem.ProblemCode
import com.dabubble.backend.problem.ProblemException
import com.dabubble.backend.time.now
import com.dabubble.backend.user.UserRepository
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Clock
import java.time.ZoneOffset
import java.util.UUID

/** Direct Messages, which exist from their first Message on (the self-DM from the User's creation). */
@Service
class DirectMessageService(
    private val jdbc: JdbcClient,
    private val conversations: ConversationRepository,
    private val users: UserRepository,
    private val clock: Clock,
) {
    /** The DM of [userId] with [partnerId], created if it doesn't exist yet; not found for an unknown partner. */
    @Transactional
    fun findOrCreate(
        userId: UUID,
        partnerId: UUID,
    ): Conversation {
        if (!users.existsById(partnerId)) {
            throw ProblemException(ProblemCode.NOT_FOUND, "No User $partnerId")
        }
        val (low, high) = directMessagePair(userId, partnerId)
        // A concurrent first Message waits on the other's row and then inserts nothing, so both share one DM.
        val now = clock.now().atOffset(ZoneOffset.UTC)
        jdbc
            .sql(
                """
                INSERT INTO conversations (kind, user_low, user_high, created_at, last_activity_at)
                VALUES ('DIRECT_MESSAGE', :low, :high, :now, :now)
                ON CONFLICT (user_low, user_high) WHERE kind = 'DIRECT_MESSAGE' DO NOTHING
                """.trimIndent(),
            ).param("low", low)
            .param("high", high)
            .param("now", now)
            .update()
        return checkNotNull(conversations.findDirectMessage(low, high))
    }
}
