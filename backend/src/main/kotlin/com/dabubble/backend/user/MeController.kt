package com.dabubble.backend.user

import com.dabubble.backend.problem.ProblemCode
import com.dabubble.backend.problem.ProblemException
import io.swagger.v3.oas.annotations.media.Schema
import io.swagger.v3.oas.annotations.tags.Tag
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

// springdoc doesn't infer `required` from Kotlin nullability; only properties with defaults are optional.
data class SetAvatarRequest(
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    val avatar: PredefinedAvatar,
)

@RestController
@RequestMapping("/api/me")
@Tag(name = "me")
class MeController(
    private val users: UserRepository,
) {
    // Getting here has already provisioned the User (CurrentUserFilter).
    @GetMapping
    fun getMe(user: User): UserDto = UserDto.from(user)

    // An unknown id never binds to PredefinedAvatar, so it is a BAD_REQUEST problem, as is the Guest's.
    @PutMapping("/avatar")
    fun setAvatar(
        user: User,
        @RequestBody request: SetAvatarRequest,
    ): UserDto {
        if (request.avatar == PredefinedAvatar.GUEST) {
            throw ProblemException(ProblemCode.BAD_REQUEST, "The Guest Avatar can't be picked")
        }
        user.avatar = request.avatar
        return UserDto.from(users.save(user))
    }
}
