package com.dabubble.backend.conversation

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
