package com.dabubble.backend.user

import com.dabubble.backend.storage.ObjectStorage
import org.springframework.stereotype.Component
import java.time.Duration

/** Users as the API shows them, with a presigned GET for an uploaded Avatar. */
@Component
class UserViews(
    private val storage: ObjectStorage,
) {
    fun toDto(user: User): UserDto =
        UserDto(
            id = user.id,
            name = user.name,
            email = user.email,
            avatar = user.avatar,
            uploadedAvatarUrl = user.avatarKey?.let(::avatarUrl),
        )

    /** Shows the uploaded Avatar stored at [key] for 5 minutes. */
    fun avatarUrl(key: String): String = storage.presignGet(key, "inline", SHOW_TTL)

    private companion object {
        val SHOW_TTL: Duration = Duration.ofMinutes(5)
    }
}
