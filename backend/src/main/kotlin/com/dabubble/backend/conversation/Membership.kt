package com.dabubble.backend.conversation

import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant
import java.util.UUID

/** A User's place in a Channel; part of the Conversation aggregate. */
@Entity
@Table(name = "memberships")
class Membership(
    val userId: UUID,
    val joinedAt: Instant,
    var isAdmin: Boolean = false,
) {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null
}
