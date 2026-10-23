package com.dabubble.backend.user

import io.swagger.v3.oas.annotations.tags.Tag
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/me")
@Tag(name = "me")
class MeController {
    // Getting here has already provisioned the User (CurrentUserFilter).
    @GetMapping
    fun getMe(user: User): UserDto = UserDto.from(user)
}
