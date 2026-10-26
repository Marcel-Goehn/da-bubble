package com.dabubble.backend.message

import com.dabubble.backend.problem.ProblemCode
import com.dabubble.backend.problem.ProblemException
import jakarta.persistence.LockModeType
import org.springframework.data.domain.Limit
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Lock
import org.springframework.data.jpa.repository.Query
import java.time.Instant

// The page queries follow messages_conversation_page_idx and messages_thread_page_idx: newest first, ties
// broken by the id.
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

    @Query(
        """
        SELECT m FROM Message m
        WHERE m.parentMessageId = :parentMessageId
        ORDER BY m.createdAt DESC, m.id DESC
        """,
    )
    fun findNewestReplies(
        parentMessageId: Long,
        limit: Limit,
    ): List<Message>

    @Query(
        """
        SELECT m FROM Message m
        WHERE m.parentMessageId = :parentMessageId
          AND (m.createdAt < :createdAt OR (m.createdAt = :createdAt AND m.id < :id))
        ORDER BY m.createdAt DESC, m.id DESC
        """,
    )
    fun findOlderReplies(
        parentMessageId: Long,
        createdAt: Instant,
        id: Long,
        limit: Limit,
    ): List<Message>

    /** The Threads of [parentMessageIds] that have Replies; reply count and last reply are never stored. */
    @Query(
        """
        SELECT new com.dabubble.backend.message.ThreadSummary(m.parentMessageId, count(m), max(m.createdAt))
        FROM Message m
        WHERE m.parentMessageId IN :parentMessageIds
        GROUP BY m.parentMessageId
        """,
    )
    fun summarizeThreads(parentMessageIds: Collection<Long>): List<ThreadSummary>

    /** The Attachments of every Message and Reply in the Conversation [conversationId]. */
    @Query("SELECT a FROM Message m JOIN m.attachmentList a WHERE m.conversationId = :conversationId")
    fun findAttachmentsIn(conversationId: Long): List<Attachment>

    fun findByIdAndConversationId(
        id: Long,
        conversationId: Long,
    ): Message?

    /** As [findByIdAndConversationId], locking the row until the transaction ends. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT m FROM Message m WHERE m.id = :id AND m.conversationId = :conversationId")
    fun findLockedByIdAndConversationId(
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

/** As [requireIn], locking the Message's row until the transaction ends. */
fun MessageRepository.requireLockedIn(
    conversationId: Long,
    id: Long,
): Message =
    findLockedByIdAndConversationId(id = id, conversationId = conversationId)
        ?: throw ProblemException(ProblemCode.NOT_FOUND, "No Message $id in Conversation $conversationId")
