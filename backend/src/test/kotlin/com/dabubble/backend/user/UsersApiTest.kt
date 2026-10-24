package com.dabubble.backend.user

import com.dabubble.backend.support.IntegrationTest
import com.dabubble.backend.support.TestTokens
import org.junit.jupiter.api.Test
import org.springframework.test.json.JsonCompareMode
import java.util.UUID

class UsersApiTest : IntegrationTest() {
    @Test
    fun `every User of the Workspace is listed, by name`() {
        val ada = UUID.randomUUID()
        val alan = UUID.randomUUID()
        get("/api/me", TestTokens.user(alan, name = "Alan Turing", email = "alan@example.com")).expectStatus().isOk
        get("/api/me", TestTokens.user(ada)).expectStatus().isOk

        get("/api/users", TestTokens.user(ada))
            .expectStatus()
            .isOk
            .expectBody()
            .json(
                """
                [
                  {"id":"$ada","name":"Ada Lovelace","email":"ada@example.com","avatar":null},
                  {"id":"$alan","name":"Alan Turing","email":"alan@example.com","avatar":null}
                ]
                """.trimIndent(),
                JsonCompareMode.STRICT,
            )
    }

    @Test
    fun `a User is found by id, with their email for the profile card`() {
        val ada = UUID.randomUUID()
        val alan = UUID.randomUUID()
        get("/api/me", TestTokens.user(alan, name = "Alan Turing", email = "alan@example.com")).expectStatus().isOk

        get("/api/users/$alan", TestTokens.user(ada))
            .expectStatus()
            .isOk
            .expectBody()
            .json(
                """{"id":"$alan","name":"Alan Turing","email":"alan@example.com","avatar":null}""",
                JsonCompareMode.STRICT,
            )
    }

    @Test
    fun `an unknown User is not found`() {
        get("/api/users/${UUID.randomUUID()}", TestTokens.user())
            .expectStatus()
            .isNotFound
            .expectBody()
            .jsonPath("$.code")
            .isEqualTo("NOT_FOUND")
    }
}
