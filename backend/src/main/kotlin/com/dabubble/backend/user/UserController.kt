package com.dabubble.backend.user

import io.swagger.v3.oas.annotations.tags.Tag
import org.springframework.data.domain.Sort
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/users")
@Tag(name = "users")
class UserController(
    private val users: UserRepository,
) {
    /** Every User of the Workspace, which everyone can see; a team of 5–50 needs no paging. */
    @GetMapping
    fun listUsers(): List<UserDto> = users.findAll(Sort.by(User::name.name)).map(UserDto::from)
}
