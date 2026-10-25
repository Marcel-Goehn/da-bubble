package com.dabubble.backend.message

import java.util.UUID

/** What a Mention points at: a User (`@`) or a Channel (`#`), by id (ADR 0002). */
sealed interface MentionTarget {
    data class User(
        val id: UUID,
    ) : MentionTarget

    data class Channel(
        val id: Long,
    ) : MentionTarget
}

/** A Mention as it stands in a Message's text: its [target] and the [name] it had when the Message was written. */
data class MentionToken(
    val target: MentionTarget,
    val name: String,
)

/**
 * The Mention tokens in Message text: `<@user-uuid|Name>` for a User and `<#channel-id|Name>` for a Channel. In
 * the name, `\` escapes a `>` or a `\`. Anything else, malformed tokens included, is plain text. The frontend
 * parses the same grammar.
 */
object MentionTokens {
    private const val UUID_PATTERN = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
    private val token = Regex("""<(?:@($UUID_PATTERN)|#(\d{1,18}))\|((?:[^\\>\n]|\\[\\>])*)>""")
    private val escaped = Regex("""\\([\\>])""")

    fun parse(text: String): List<MentionToken> =
        token
            .findAll(text)
            .map { match ->
                val (userId, channelId, name) = match.destructured
                val target =
                    if (userId.isNotEmpty()) {
                        MentionTarget.User(UUID.fromString(userId))
                    } else {
                        MentionTarget.Channel(channelId.toLong())
                    }
                MentionToken(target, escaped.replace(name, "$1"))
            }.toList()

    /** Everything [text] mentions, each once. */
    fun targetsIn(text: String): Set<MentionTarget> = parse(text).mapTo(linkedSetOf()) { it.target }
}
