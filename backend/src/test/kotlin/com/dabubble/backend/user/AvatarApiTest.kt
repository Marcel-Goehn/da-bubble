package com.dabubble.backend.user

import com.dabubble.backend.support.IntegrationTest
import com.dabubble.backend.support.TestTokens
import org.junit.jupiter.api.Test
import org.springframework.http.MediaType
import org.springframework.test.json.JsonCompareMode
import java.util.UUID

class AvatarApiTest : IntegrationTest() {
    @Test
    fun `a User picks a predefined Avatar and keeps it`() {
        val sub = UUID.randomUUID()
        val token = TestTokens.user(sub, name = "Ada Lovelace", email = "ada@example.com")

        put("/api/me/avatar", token, """{"avatar":"AVATAR_3","uploadedAvatarUrl":null}""")
            .expectStatus()
            .isOk
            .expectBody()
            .json(
                """
                {"id":"$sub","name":"Ada Lovelace","email":"ada@example.com","avatar":"AVATAR_3",
                "uploadedAvatarUrl":null}
                """.trimIndent(),
                JsonCompareMode.STRICT,
            )

        get("/api/me", token)
            .expectStatus()
            .isOk
            .expectBody()
            .jsonPath("$.avatar")
            .isEqualTo("AVATAR_3")
    }

    @Test
    fun `an unknown Avatar is a BAD_REQUEST problem and changes nothing`() {
        val token = TestTokens.user()

        put("/api/me/avatar", token, """{"avatar":"AVATAR_7"}""")
            .expectStatus()
            .isBadRequest
            .expectHeader()
            .contentType(MediaType.APPLICATION_PROBLEM_JSON)
            .expectBody()
            .json("""{"status":400,"code":"BAD_REQUEST"}""", JsonCompareMode.LENIENT)

        get("/api/me", token)
            .expectStatus()
            .isOk
            .expectBody()
            .jsonPath("$.avatar")
            .isEqualTo(null)
    }

    @Test
    fun `the Guest Avatar can't be picked`() {
        val token = TestTokens.user()

        put("/api/me/avatar", token, """{"avatar":"GUEST","uploadedAvatarUrl":null}""")
            .expectStatus()
            .isBadRequest
            .expectHeader()
            .contentType(MediaType.APPLICATION_PROBLEM_JSON)
            .expectBody()
            .json("""{"status":400,"code":"BAD_REQUEST"}""", JsonCompareMode.LENIENT)

        get("/api/me", token)
            .expectStatus()
            .isOk
            .expectBody()
            .jsonPath("$.avatar")
            .isEqualTo(null)
    }
}
