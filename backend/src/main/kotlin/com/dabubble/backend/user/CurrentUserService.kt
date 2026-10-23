package com.dabubble.backend.user

import com.dabubble.backend.conversation.Conversation
import com.dabubble.backend.conversation.ConversationRepository
import com.dabubble.backend.time.now
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Clock
import java.time.ZoneOffset
import java.util.UUID

/** Turns a validated token into its User, creating them just in time on their first request (ADR 0001). */
@Service
class CurrentUserService(
    private val jdbc: JdbcClient,
    private val users: UserRepository,
    private val conversations: ConversationRepository,
    private val clock: Clock,
) {
    @Transactional
    fun resolve(jwt: Jwt): User {
        val id = UUID.fromString(jwt.subject)
        val email = requireNotNull(jwt.getClaimAsString("email")) { "A verified token always carries an email" }
        val now = clock.now()
        val realmRoles = jwt.getClaimAsMap("realm_access")?.get("roles") as? List<*>
        val isGuest = realmRoles.orEmpty().contains(GUEST_ROLE)

        // A concurrent first request waits on this row and then inserts nothing, so only one provisions.
        val inserted =
            jdbc
                .sql(
                    """
                    INSERT INTO users (id, name, email, avatar, is_guest, created_at)
                    VALUES (:id, :name, :email, :avatar, :isGuest, :createdAt)
                    ON CONFLICT (id) DO NOTHING
                    """.trimIndent(),
                ).param("id", id)
                .param("name", initialName(jwt.getClaimAsString("name"), email))
                .param("email", email)
                // The Guest never sees the Avatar step.
                .param("avatar", if (isGuest) PredefinedAvatar.GUEST.name else null)
                .param("isGuest", isGuest)
                .param("createdAt", now.atOffset(ZoneOffset.UTC))
                .update() == 1
        if (inserted) {
            conversations.findDefaultChannel().addMember(id, now)
            conversations.save(Conversation.directMessage(id, id, now))
        }

        return users.findById(id).orElseThrow().apply { this.email = email }
    }

    private companion object {
        const val GUEST_ROLE = "guest"
    }
}

/** The name copied once from the `name` claim: trimmed and cut to the limit, or the email's local part if empty. */
internal fun initialName(
    nameClaim: String?,
    email: String,
): String = fitName(nameClaim.orEmpty()).ifEmpty { fitName(email.substringBefore('@')) }

// Cuts by code points, as Postgres' varchar(50) counts them, so an emoji is never split.
private fun fitName(raw: String): String {
    val trimmed = raw.trim()
    val length = minOf(User.NAME_MAX_LENGTH, trimmed.codePointCount(0, trimmed.length))
    return trimmed.substring(0, trimmed.offsetByCodePoints(0, length)).trimEnd()
}
