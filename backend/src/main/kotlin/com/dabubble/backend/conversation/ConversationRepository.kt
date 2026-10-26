package com.dabubble.backend.conversation

import com.dabubble.backend.problem.ProblemCode
import com.dabubble.backend.problem.ProblemException
import jakarta.persistence.LockModeType
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Lock
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import java.time.Instant
import java.util.UUID

interface ConversationRepository : JpaRepository<Conversation, Long> {
    // Found by the flag, never by name; the migration seeds it.
    @Query("SELECT c FROM Conversation c WHERE c.isDefault = true")
    fun findDefaultChannel(): Conversation

    /** Those of [ids] that are Channels. */
    @Query(
        """
        SELECT c.id FROM Conversation c
        WHERE c.id IN :ids AND c.kind = com.dabubble.backend.conversation.ConversationKind.CHANNEL
        """,
    )
    fun findChannelIds(ids: Collection<Long>): Set<Long>

    // A DM row exists only once it has a Message (or is a self-DM), so every DM of the User is listed.
    @Query(
        """
        SELECT DISTINCT c FROM Conversation c LEFT JOIN c.memberships m
        WHERE m.userId = :userId OR c.userLow = :userId OR c.userHigh = :userId
        ORDER BY c.id
        """,
    )
    fun findVisibleTo(userId: UUID): List<Conversation>

    @Query("SELECT c FROM Conversation c WHERE c.userLow = :userLow AND c.userHigh = :userHigh")
    fun findDirectMessage(
        userLow: UUID,
        userHigh: UUID,
    ): Conversation?

    /** Moves the stored last activity of [id] to [at], unless a concurrent send already moved it further. */
    @Modifying
    @Query("UPDATE Conversation c SET c.lastActivityAt = GREATEST(c.lastActivityAt, :at) WHERE c.id = :id")
    fun bumpActivity(
        id: Long,
        at: Instant,
    )

    /**
     * Locks the Conversation [id] until the transaction ends. Its row's foreign key holds back new Messages,
     * which then wait.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT c.id FROM Conversation c WHERE c.id = :id")
    fun lock(id: Long): Long?

    /** Deletes the Conversation [id] in the database alone, which cascades to everything in it. */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("DELETE FROM Conversation c WHERE c.id = :id")
    fun deleteConversation(id: Long)

    @Query(
        """
        SELECT DISTINCT c FROM Conversation c LEFT JOIN c.memberships m
        WHERE c.id = :id AND (m.userId = :userId OR c.userLow = :userId OR c.userHigh = :userId)
        """,
    )
    fun findVisibleTo(
        id: Long,
        userId: UUID,
    ): Conversation?
}

/**
 * The Conversation [id] if [userId] can see it. Otherwise not found rather than forbidden, so a Channel's
 * existence isn't revealed to non-Members.
 */
fun ConversationRepository.requireVisibleTo(
    id: Long,
    userId: UUID,
): Conversation =
    findVisibleTo(id, userId)
        ?: throw ProblemException(ProblemCode.NOT_FOUND, "No visible Conversation $id")
