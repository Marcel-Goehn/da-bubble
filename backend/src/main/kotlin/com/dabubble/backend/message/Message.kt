package com.dabubble.backend.message

import com.dabubble.backend.problem.ProblemCode
import com.dabubble.backend.problem.ProblemException
import jakarta.persistence.CascadeType
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.JoinColumn
import jakarta.persistence.OneToMany
import jakarta.persistence.OrderBy
import jakarta.persistence.Table
import org.hibernate.annotations.BatchSize
import java.time.Instant
import java.util.UUID

/** The Message aggregate: a post by a User in a Conversation, or a Reply in a Thread (ADR 0002). */
@Entity
@Table(name = "messages")
class Message private constructor(
    val conversationId: Long,
    val authorId: UUID,
    val parentMessageId: Long?,
    var text: String,
    val createdAt: Instant,
) {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null

    var editedAt: Instant? = null

    var deletedAt: Instant? = null

    // Loaded for a whole page of Messages at once rather than one query each.
    @OneToMany(cascade = [CascadeType.ALL], orphanRemoval = true)
    @JoinColumn(name = "message_id", nullable = false)
    @OrderBy("createdAt, id")
    @BatchSize(size = 64)
    private val reactionList: MutableList<Reaction> = mutableListOf()

    /** Its Reactions, oldest first. */
    val reactions: List<Reaction> get() = reactionList

    @OneToMany(cascade = [CascadeType.ALL], orphanRemoval = true)
    @JoinColumn(name = "message_id", nullable = false)
    private val mentionList: MutableList<MessageMention> = mutableListOf()

    @OneToMany(cascade = [CascadeType.ALL], orphanRemoval = true)
    @JoinColumn(name = "message_id", nullable = false)
    @OrderBy("id")
    @BatchSize(size = 64)
    private val attachmentList: MutableList<Attachment> = mutableListOf()

    /** Its Attachments, in the order they were sent. */
    val attachments: List<Attachment> get() = attachmentList

    /** The Users and Channels its text mentions. */
    val mentions: Set<MentionTarget> get() = mentionList.mapTo(linkedSetOf()) { it.target }

    /**
     * Makes [targets] the Users and Channels it mentions. Only what changed is written, as Hibernate inserts
     * before it deletes and a Mention kept would otherwise clash with itself.
     */
    private fun mention(targets: Set<MentionTarget>) {
        mentionList.removeAll { it.target !in targets }
        val kept = mentions
        targets.filterNot { it in kept }.forEach { mentionList += MessageMention.of(it) }
    }

    /**
     * Adds the User's Reaction with [emoji], or removes it if they've already reacted with it. A Deleted Message
     * can't be reacted to, and [emoji] must be exactly one emoji.
     */
    fun toggleReaction(
        userId: UUID,
        emoji: String,
        at: Instant,
    ) {
        if (deletedAt != null) {
            throw ProblemException(ProblemCode.MESSAGE_DELETED, "A Deleted Message can't be reacted to")
        }
        if (!isSingleEmoji(emoji)) {
            throw ProblemException(ProblemCode.EMOJI_INVALID, "A Reaction is exactly one emoji")
        }
        val existing = reactionList.find { it.userId == userId && it.emoji == emoji }
        if (existing != null) {
            reactionList.remove(existing)
        } else {
            reactionList += Reaction(userId, emoji, at)
        }
    }

    /**
     * Replaces the text and the [mentions] in it and sets edited at; only the author may, and not once it's
     * deleted. The text may only be blank if it has Attachments.
     */
    fun edit(
        userId: UUID,
        text: String,
        mentions: Set<MentionTarget>,
        at: Instant,
    ) {
        requireAuthor(userId)
        if (deletedAt != null) {
            throw ProblemException(ProblemCode.MESSAGE_DELETED, "A Deleted Message can't be edited")
        }
        requireContent(text, attachmentList)
        this.text = text.ifBlank { "" }
        mention(mentions)
        editedAt = at
    }

    /**
     * Makes it a Deleted Message: its content is erased, its place, author and time stay. Only the author may.
     * Returns whether anything changed, which it doesn't for one deleted already.
     */
    fun delete(
        userId: UUID,
        at: Instant,
    ): Boolean {
        requireAuthor(userId)
        if (deletedAt != null) {
            return false
        }
        text = ""
        reactionList.clear()
        mentionList.clear()
        // TODO(#68): delete the files of its Attachments after the commit, before their keys are gone.
        attachmentList.clear()
        deletedAt = at
        return true
    }

    /** Fails for a Reply: Threads are one level deep, so a Reply has no Thread of its own. */
    fun requireThreadable() {
        if (parentMessageId != null) {
            throw ProblemException(ProblemCode.REPLY_HAS_NO_THREAD, "A Reply can't have a Thread of its own")
        }
    }

    private fun requireAuthor(userId: UUID) {
        if (userId != authorId) {
            throw ProblemException(ProblemCode.NOT_MESSAGE_AUTHOR, "Only its author may change a Message")
        }
    }

    companion object {
        /** At most this many Attachments per Message. */
        const val MAX_ATTACHMENTS = 5

        /**
         * A new top-level Message, with the Users and Channels its text [mentions] and its [attachments]. It
         * needs text or at least one Attachment.
         */
        fun send(
            conversationId: Long,
            authorId: UUID,
            text: String,
            mentions: Set<MentionTarget>,
            attachments: List<Attachment>,
            createdAt: Instant,
        ): Message {
            requireContent(text, attachments)
            return Message(conversationId, authorId, null, text.ifBlank { "" }, createdAt).apply {
                mention(mentions)
                attachmentList += attachments
            }
        }

        /**
         * A new Reply in the Thread of [parent], in the same Conversation. The parent may be a Deleted Message,
         * whose Thread stays open, but not a Reply. Like a Message, it needs text or at least one Attachment.
         */
        fun reply(
            parent: Message,
            authorId: UUID,
            text: String,
            mentions: Set<MentionTarget>,
            attachments: List<Attachment>,
            createdAt: Instant,
        ): Message {
            parent.requireThreadable()
            requireContent(text, attachments)
            val parentId = checkNotNull(parent.id)
            return Message(parent.conversationId, authorId, parentId, text.ifBlank { "" }, createdAt).apply {
                mention(mentions)
                attachmentList += attachments
            }
        }

        private fun requireContent(
            text: String,
            attachments: List<Attachment>,
        ) {
            if (text.isBlank() && attachments.isEmpty()) {
                throw ProblemException(ProblemCode.MESSAGE_EMPTY, "A Message needs text or an Attachment")
            }
            if (attachments.size > MAX_ATTACHMENTS) {
                throw ProblemException(ProblemCode.TOO_MANY_ATTACHMENTS, "At most $MAX_ATTACHMENTS Attachments")
            }
        }
    }
}
