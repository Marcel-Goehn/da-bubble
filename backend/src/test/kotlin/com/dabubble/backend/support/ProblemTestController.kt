package com.dabubble.backend.support

import com.dabubble.backend.problem.ProblemCode
import com.dabubble.backend.problem.ProblemException
import jakarta.validation.Valid
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

data class TestRequest(
    @field:NotBlank val name: String,
    @field:Size(max = 3) val tags: List<String> = emptyList(),
)

/** Endpoints that fail on purpose. Under /test, so the OpenAPI spec (only /api paths) never sees them. */
@RestController
@RequestMapping("/test/problems")
class ProblemTestController {
    @PostMapping("/validated")
    fun validated(
        @Valid @RequestBody request: TestRequest,
    ): TestRequest = request

    @GetMapping("/thrown")
    fun thrown(): Nothing = throw ProblemException(ProblemCode.NOT_FOUND, "No such thing")

    @GetMapping("/crash")
    fun crash(): Nothing = error("secret internals")
}
