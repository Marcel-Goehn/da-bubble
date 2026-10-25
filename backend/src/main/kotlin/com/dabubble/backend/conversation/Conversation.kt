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
import org.hibernate.annotations.BatchSize
import java.time.Instant
import java.time.temporal.ChronoUnit
import java.util.UUID

enum class ConversationKind { CHANNEL, DIRECT_MESSAGE }

/**
 * The Conversation aggregate: a Channel with its Memberships, or a Direct Message between two Users (ADR 0002).
 * Every rule about a Channel and its Memberships lives here, hence its many functions.
 */
@Suppress("TooManyFunctions")
@Entity
@Table(name = "conversations")
class Conversation private constructor(
    @Enumerated(EnumType.STRING)
    val kind: ConversationKind,
    name: String?,
    description: String?,
    /** The User who created a Channel; `null` for the Default Channel and DMs. */
    val creatorId: UUID?,
    val isDefault: Boolean,
    val userLow: UUID?,
    val userHigh: UUID?,
    val createdAt: Instant,
) {
    /** A Channel's name, internal for the Default Channel; none for a DM. */
    var name: String? = name
        protected set

    var description: String? = description
        protected set

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

    // Batched, so listing the sidebar loads the Memberships of many Channels at once.
    @BatchSize(size = 50)
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

    /**
     * Renames the Channel and changes its description, as the Admin [actorId]; a `null` leaves either as it is.
     * The new name is refused like a new Channel's, and a blank description is none.
     */
    fun edit(
        actorId: UUID,
        name: String?,
        description: String?,
    ) {
        requireAdmin(actorId)
        name?.let { this.name = channelName(it) }
        description?.let { this.description = shownDescription(it) }
    }

    /** Adds the Users [userIds] as Members joined [at], as the Admin [actorId]; Members already are. */
    fun addMembers(
        actorId: UUID,
        userIds: Collection<UUID>,
        at: Instant,
    ) {
        requireAdmin(actorId)
        userIds.forEach { addMember(it, at) }
    }

    /**
     * Removes the Member [userId], as the Admin [actorId]: their Membership is gone, and with it their access.
     * Returns it, so the removal can be undone with [restoreMember].
     */
    fun removeMember(
        actorId: UUID,
        userId: UUID,
    ): Membership = requireManageable(actorId, userId).also { memberships -= it }

    /**
     * Undoes the removal of [userId], as the Admin [actorId]: they're a Member again with the Admin flag and
     * the join time they had, which can't be later than [now]. Someone who is a Member already stays as they are.
     */
    fun restoreMember(
        actorId: UUID,
        userId: UUID,
        isAdmin: Boolean,
        joinedAt: Instant,
        now: Instant,
    ) {
        requireAdmin(actorId)
        requireOther(actorId, userId)
        if (memberships.none { it.userId == userId }) {
            memberships += Membership(userId, minOf(joinedAt.truncatedTo(ChronoUnit.MICROS), now), isAdmin)
        }
    }

    /** The Member [userId] leaves; anyone may, except the Creator, and nobody leaves the Default Channel. */
    fun leave(userId: UUID) {
        val refused =
            when {
                isDefault -> ProblemCode.DEFAULT_CHANNEL_LOCKED
                userId == creatorId -> ProblemCode.CHANNEL_CREATOR_PROTECTED
                else -> null
            }
        if (refused != null) {
            throw ProblemException(refused, "$userId may not leave $id")
        }
        memberships.removeIf { it.userId == userId }
    }

    /** Grants or revokes Admin for the Member [userId], as the Admin [actorId]. */
    fun setAdmin(
        actorId: UUID,
        userId: UUID,
        isAdmin: Boolean,
    ) {
        requireManageable(actorId, userId).isAdmin = isAdmin
    }

    /** Whether [userId] is an Admin here: the Creator always is, and the Default Channel has none. */
    fun isAdmin(userId: UUID): Boolean = userId == creatorId || memberships.any { it.userId == userId && it.isAdmin }

    private fun requireAdmin(userId: UUID) {
        if (!isAdmin(userId)) {
            throw ProblemException(ProblemCode.NOT_CHANNEL_ADMIN, "$userId is no Admin of $id")
        }
    }

    /**
     * The Membership of [userId], whom the Admin [actorId] may manage: anyone but the Creator and themselves.
     */
    private fun requireManageable(
        actorId: UUID,
        userId: UUID,
    ): Membership {
        requireAdmin(actorId)
        requireOther(actorId, userId)
        return memberships.find { it.userId == userId }
            ?: throw ProblemException(ProblemCode.NOT_FOUND, "$userId is no Member of $id")
    }

    /** Refuses [actorId] managing themselves or the Creator. */
    private fun requireOther(
        actorId: UUID,
        userId: UUID,
    ) {
        val refused =
            when (userId) {
                actorId -> ProblemCode.MANAGING_YOURSELF
                creatorId -> ProblemCode.CHANNEL_CREATOR_PROTECTED
                else -> null
            }
        if (refused != null) {
            throw ProblemException(refused, "$actorId may not manage $userId in $id")
        }
    }

    /** Records activity at [at] in memory, for the DTO; [ConversationRepository.bumpActivity] stores it. */
    fun bumpActivity(at: Instant) {
        lastActivityAt = maxOf(lastActivityAt, at)
    }

    /** A Channel's Memberships in the order they joined; none for a DM. */
    fun members(): List<Membership> = memberships.sortedWith(compareBy({ it.joinedAt }, { it.id }))

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
        ): Conversation =
            Conversation(
                kind = ConversationKind.CHANNEL,
                name = channelName(name),
                description = description?.let(::shownDescription),
                creatorId = creatorId,
                isDefault = false,
                userLow = null,
                userHigh = null,
                createdAt = createdAt,
            ).apply { addMember(creatorId, createdAt) }

        /** [name] trimmed, unless it's blank, too long or reserved. Whether it's free is up to the database. */
        private fun channelName(name: String): String {
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
            return trimmed
        }

        private fun shownDescription(description: String): String? = description.trim().ifEmpty { null }

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
