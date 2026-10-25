package com.dabubble.backend.conversation

import com.dabubble.backend.problem.ProblemCode
import com.dabubble.backend.problem.ProblemException
import jakarta.persistence.CascadeType
import jakarta.persistence.Column
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
    val description: String?,
    /** The User who created a Channel; `null` for the Default Channel and DMs. */
    val creatorId: UUID?,
    val isDefault: Boolean,
    val userLow: UUID?,
    val userHigh: UUID?,
    val createdAt: Instant,
) {
    /**
     * When the latest Message was sent; orders the DM list. Written only by [ConversationRepository.bumpActivity],
     * so concurrent sends can't move it back.
     */
    @Column(updatable = false)
    var lastActivityAt: Instant = createdAt
        protected set

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

    /** Records activity at [at] in memory, for the DTO; [ConversationRepository.bumpActivity] stores it. */
    fun bumpActivity(at: Instant) {
        lastActivityAt = maxOf(lastActivityAt, at)
    }

    /** A Channel's current Members; none for a DM. */
    fun memberIds(): Set<UUID> = memberships.mapTo(mutableSetOf()) { it.userId }

    /** Who a new Message here concerns: a Channel's current Members, or the one or two Users of a DM. */
    fun recipients(): Set<UUID> =
        when (kind) {
            ConversationKind.CHANNEL -> memberIds()
            ConversationKind.DIRECT_MESSAGE -> setOfNotNull(userLow, userHigh)
        }

    /** The other User of a DM, or the User themselves for their self-DM; `null` for a Channel. */
    fun partnerOf(userId: UUID): UUID? =
        when {
            kind == ConversationKind.CHANNEL -> null
            userLow == userId -> userHigh
            else -> userLow
        }

    companion object {
        const val CHANNEL_NAME_MAX_LENGTH = 50

        // The Default Channel's shown names, in German and English; nobody else may use them.
        private val reservedChannelNames = setOf("allgemein", "general")

        /**
         * A new Channel with its Creator as first Member. The name is trimmed, must not be blank or reserved, and
         * a blank description is none. The Creator's Admin status follows from [creatorId] and isn't stored on
         * the Membership. Whether the name is free is up to the database.
         */
        fun channel(
            name: String,
            description: String?,
            creatorId: UUID,
            createdAt: Instant,
        ): Conversation {
            val trimmed = name.trim()
            val length = trimmed.codePointCount(0, trimmed.length)
            val refused =
                when {
                    trimmed.isEmpty() -> ProblemCode.CHANNEL_NAME_EMPTY
                    length > CHANNEL_NAME_MAX_LENGTH -> ProblemCode.CHANNEL_NAME_TOO_LONG
                    trimmed.lowercase() in reservedChannelNames -> ProblemCode.CHANNEL_NAME_TAKEN
                    else -> null
                }
            if (refused != null) {
                throw ProblemException(refused, "Channel name \"$trimmed\" refused")
            }
            val shownDescription = description?.trim()?.ifEmpty { null }
            return Conversation(
                kind = ConversationKind.CHANNEL,
                name = trimmed,
                description = shownDescription,
                creatorId = creatorId,
                isDefault = false,
                userLow = null,
                userHigh = null,
                createdAt = createdAt,
            ).apply { addMember(creatorId, createdAt) }
        }

        fun directMessage(
            a: UUID,
            b: UUID,
            createdAt: Instant,
        ): Conversation {
            val (low, high) = directMessagePair(a, b)
            return Conversation(
                kind = ConversationKind.DIRECT_MESSAGE,
                name = null,
                description = null,
                creatorId = null,
                isDefault = false,
                userLow = low,
                userHigh = high,
                createdAt = createdAt,
            )
        }
    }
}

/** The two Users of a DM as stored: `(user_low, user_high)`. */
fun directMessagePair(
    a: UUID,
    b: UUID,
): Pair<UUID, UUID> =
    // Postgres orders uuids byte-wise, which matches their canonical strings; UUID.compareTo is signed.
    if (a.toString() <= b.toString()) a to b else b to a
