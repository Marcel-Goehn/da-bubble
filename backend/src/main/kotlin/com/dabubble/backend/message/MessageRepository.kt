package com.dabubble.backend.message

import com.dabubble.backend.problem.ProblemCode
import com.dabubble.backend.problem.ProblemException
import org.springframework.data.domain.Limit
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import java.time.Instant

// Both page queries follow messages_conversation_page_idx: newest first, ties broken by the id.
interface MessageRepository : JpaRepository<Message, Long> {
    @Query(
        """
        SELECT m FROM Message m
        WHERE m.conversationId = :conversationId AND m.parentMessageId IS NULL
        ORDER BY m.createdAt DESC, m.id DESC
        """,
    )
    fun findNewest(
        conversationId: Long,
        limit: Limit,
    ): List<Message>

    @Query(
        """
        SELECT m FROM Message m
        WHERE m.conversationId = :conversationId AND m.parentMessageId IS NULL
          AND (m.createdAt < :createdAt OR (m.createdAt = :createdAt AND m.id < :id))
        ORDER BY m.createdAt DESC, m.id DESC
        """,
    )
    fun findOlder(
        conversationId: Long,
        createdAt: Instant,
        id: Long,
        limit: Limit,
    ): List<Message>

    fun findByIdAndConversationId(
        id: Long,
        conversationId: Long,
    ): Message?
}

/** The Message [id] of the Conversation [conversationId], which the caller has checked the User can see. */
fun MessageRepository.requireIn(
    conversationId: Long,
    id: Long,
): Message =
    findByIdAndConversationId(id = id, conversationId = conversationId)
        ?: throw ProblemException(ProblemCode.NOT_FOUND, "No Message $id in Conversation $conversationId")
