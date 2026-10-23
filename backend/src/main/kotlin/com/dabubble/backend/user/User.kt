package com.dabubble.backend.user

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
    // null until the User picks one on the Avatar step.
    @Enumerated(EnumType.STRING)
    var avatar: PredefinedAvatar?,
    val createdAt: Instant,
) {
    companion object {
        const val NAME_MAX_LENGTH = 50
    }
}
