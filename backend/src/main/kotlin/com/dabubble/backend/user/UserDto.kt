package com.dabubble.backend.user

import java.util.UUID

data class UserDto(
    val id: UUID,
    val name: String,
    val email: String,
    /** The predefined Avatar; `null` while the User has an uploaded one, or none yet. */
    val avatar: PredefinedAvatar?,
    /** Shows an uploaded Avatar for 5 minutes; fetch the User again once it stops loading. */
    val uploadedAvatarUrl: String?,
)
