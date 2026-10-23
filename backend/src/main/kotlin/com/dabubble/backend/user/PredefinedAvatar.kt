package com.dabubble.backend.user

/**
 * The 6 Avatars every User can pick from, plus the Guest's fixed one. Their pictures are static frontend
 * assets, so only the id is stored.
 */
enum class PredefinedAvatar {
    AVATAR_1,
    AVATAR_2,
    AVATAR_3,
    AVATAR_4,
    AVATAR_5,
    AVATAR_6,

    // Given to the Guest at provisioning; nobody can pick it.
    GUEST,
}
