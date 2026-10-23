package com.dabubble.backend.conversation

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query

interface ConversationRepository : JpaRepository<Conversation, Long> {
    // Found by the flag, never by name; the migration seeds it.
    @Query("SELECT c FROM Conversation c WHERE c.isDefault = true")
    fun findDefaultChannel(): Conversation
}
