package com.dabubble.backend.user

import jakarta.persistence.Entity
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
    var avatar: String?,
    val createdAt: Instant,
) {
    companion object {
        const val NAME_MAX_LENGTH = 50
    }
}
