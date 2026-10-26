package com.dabubble.backend.user

import com.dabubble.backend.problem.ProblemCode
import com.dabubble.backend.problem.ProblemException
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant
import java.util.UUID

/** A User. The id is the Keycloak `sub`; the name belongs to the app, the email to Keycloak. */
@Entity
@Table(name = "users")
class User(
    @Id
    val id: UUID,
    var name: String,
    var email: String,
    // null until the User picks one on the Avatar step, and while they have an uploaded one.
    @Enumerated(EnumType.STRING)
    var avatar: PredefinedAvatar?,
    val createdAt: Instant,
    // From the `guest` realm role at provisioning.
    val isGuest: Boolean = false,
) {
    /** Where an uploaded Avatar is stored; `null` while the User has a predefined one or none. */
    var avatarKey: String? = null

    /** Renames the User to [raw], trimmed. */
    fun rename(raw: String) {
        requireEditable()
        val trimmed = raw.trim()
        val refused =
            when {
                trimmed.isEmpty() -> ProblemCode.USER_NAME_EMPTY
                trimmed.codePointCount(0, trimmed.length) > NAME_MAX_LENGTH -> ProblemCode.USER_NAME_TOO_LONG
                else -> null
            }
        if (refused != null) {
            throw ProblemException(refused, "Name \"$trimmed\" refused")
        }
        name = trimmed
    }

    /** Gives the User the predefined [picked]; returns the key of an uploaded Avatar it replaces. */
    fun pickAvatar(picked: PredefinedAvatar): String? {
        requireEditable()
        if (picked == PredefinedAvatar.GUEST) {
            throw ProblemException(ProblemCode.BAD_REQUEST, "The Guest Avatar can't be picked")
        }
        return replaceAvatar(picked, null)
    }

    /** Gives the User the Avatar uploaded to [key]; returns the key of an uploaded Avatar it replaces. */
    fun useUploadedAvatar(key: String): String? {
        requireEditable()
        return replaceAvatar(null, key)
    }

    /** Refuses any change to the Guest's name or Avatar, which everyone signed in as the Guest shares. */
    fun requireEditable() {
        if (isGuest) {
            throw ProblemException(ProblemCode.GUEST_PROFILE_LOCKED, "The Guest's profile can't be changed")
        }
    }

    private fun replaceAvatar(
        predefined: PredefinedAvatar?,
        key: String?,
    ): String? {
        val replaced = avatarKey?.takeIf { it != key }
        avatar = predefined
        avatarKey = key
        return replaced
    }

    companion object {
        const val NAME_MAX_LENGTH = 50
    }
}
