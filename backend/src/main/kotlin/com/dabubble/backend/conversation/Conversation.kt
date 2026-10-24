package com.dabubble.backend.conversation

import jakarta.persistence.CascadeType
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.JoinColumn
import jakarta.persistence.OneToMany
import jakarta.persistence.Table
import java.time.Instant
import java.util.UUID

enum class ConversationKind { CHANNEL, DIRECT_MESSAGE }

/** The Conversation aggregate: a Channel with its Memberships, or a Direct Message between two Users (ADR 0002). */
@Entity
@Table(name = "conversations")
class Conversation private constructor(
    @Enumerated(EnumType.STRING)
    val kind: ConversationKind,
    val name: String?,
    val isDefault: Boolean,
    val userLow: UUID?,
    val userHigh: UUID?,
    val createdAt: Instant,
) {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null

    @OneToMany(cascade = [CascadeType.ALL], orphanRemoval = true)
    @JoinColumn(name = "conversation_id", nullable = false)
    private val memberships: MutableList<Membership> = mutableListOf()

    fun addMember(
        userId: UUID,
        joinedAt: Instant,
    ) {
        check(kind == ConversationKind.CHANNEL) { "A Direct Message has no Members" }
        if (memberships.none { it.userId == userId }) {
            memberships += Membership(userId, joinedAt)
        }
    }

    /** The other User of a DM, or the User themselves for their self-DM; `null` for a Channel. */
    fun partnerOf(userId: UUID): UUID? =
        when {
            kind == ConversationKind.CHANNEL -> null
            userLow == userId -> userHigh
            else -> userLow
        }

    companion object {
        fun directMessage(
            a: UUID,
            b: UUID,
            createdAt: Instant,
        ): Conversation {
            // Postgres orders uuids byte-wise, which matches their canonical strings; UUID.compareTo is signed.
            val (low, high) = if (a.toString() <= b.toString()) a to b else b to a
            return Conversation(ConversationKind.DIRECT_MESSAGE, null, false, low, high, createdAt)
        }
    }
}
