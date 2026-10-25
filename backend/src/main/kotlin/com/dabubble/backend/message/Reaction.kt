package com.dabubble.backend.message

import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant
import java.util.UUID

/** An emoji a User attached to a Message; part of the Message aggregate. */
@Entity
@Table(name = "reactions")
class Reaction(
    val userId: UUID,
    /** Native Unicode, skin tone included, so 👍 and 👍🏽 are different Reactions. */
    val emoji: String,
    val createdAt: Instant,
) {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null
}

private val oneGrapheme = Regex("\\X")

private const val KEYCAP = 0x20E3
private val regionalIndicators = 0x1F1E6..0x1F1FF

/**
 * Whether [text] is exactly one emoji as a picker inserts it: one grapheme cluster (so a skin tone, a flag or a
 * ZWJ sequence stays one) that is pictographic, a flag or a keycap.
 */
fun isSingleEmoji(text: String): Boolean =
    oneGrapheme.matches(text) &&
        text.codePoints().anyMatch {
            Character.isExtendedPictographic(it) || it in regionalIndicators || it == KEYCAP
        }
