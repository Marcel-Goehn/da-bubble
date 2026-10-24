package com.dabubble.backend.user

import com.dabubble.backend.problem.ProblemCode
import com.dabubble.backend.problem.ProblemException
import io.swagger.v3.oas.annotations.tags.Tag
import org.springframework.data.domain.Sort
import org.springframework.data.repository.findByIdOrNull
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
@RequestMapping("/api/users")
@Tag(name = "users")
class UserController(
    private val users: UserRepository,
) {
    /** Every User of the Workspace, which everyone can see; a team of 5–50 needs no paging. */
    @GetMapping
    fun listUsers(): List<UserDto> = users.findAll(Sort.by(User::name.name)).map(UserDto::from)

    /** One User, e.g. for a `/dm/:userId` with someone who joined after the list was loaded. */
    @GetMapping("/{id}")
    fun getUser(
        @PathVariable id: UUID,
    ): UserDto {
        val user = users.findByIdOrNull(id) ?: throw ProblemException(ProblemCode.NOT_FOUND, "No User $id")
        return UserDto.from(user)
    }
}
