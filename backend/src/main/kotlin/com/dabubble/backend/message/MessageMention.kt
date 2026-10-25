package com.dabubble.backend.message

import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.util.UUID

/** A User or Channel a Message mentions; part of the Message aggregate. Exactly one of the two ids is set. */
@Entity
@Table(name = "message_mention")
class MessageMention private constructor(
    val userId: UUID?,
    val channelId: Long?,
) {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null

    val target: MentionTarget
        get() = userId?.let { MentionTarget.User(it) } ?: MentionTarget.Channel(checkNotNull(channelId))

    companion object {
        fun of(target: MentionTarget) =
            when (target) {
                is MentionTarget.User -> MessageMention(target.id, null)
                is MentionTarget.Channel -> MessageMention(null, target.id)
            }
    }
}
