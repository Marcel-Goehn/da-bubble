package com.dabubble.backend.user

import java.util.UUID

data class UserDto(
    val id: UUID,
    val name: String,
    val email: String,
    val avatar: PredefinedAvatar?,
) {
    companion object {
        fun from(user: User) = UserDto(user.id, user.name, user.email, user.avatar)
    }
}
