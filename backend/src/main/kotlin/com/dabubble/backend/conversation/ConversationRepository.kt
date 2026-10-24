package com.dabubble.backend.conversation

import com.dabubble.backend.problem.ProblemCode
import com.dabubble.backend.problem.ProblemException
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import java.util.UUID

interface ConversationRepository : JpaRepository<Conversation, Long> {
    // Found by the flag, never by name; the migration seeds it.
    @Query("SELECT c FROM Conversation c WHERE c.isDefault = true")
    fun findDefaultChannel(): Conversation

    // A DM row exists only once it has a Message (or is a self-DM), so every DM of the User is listed.
    @Query(
        """
        SELECT DISTINCT c FROM Conversation c LEFT JOIN c.memberships m
        WHERE m.userId = :userId OR c.userLow = :userId OR c.userHigh = :userId
        ORDER BY c.id
        """,
    )
    fun findVisibleTo(userId: UUID): List<Conversation>

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
