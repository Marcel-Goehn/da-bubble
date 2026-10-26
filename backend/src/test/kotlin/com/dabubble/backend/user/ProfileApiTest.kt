package com.dabubble.backend.user

import com.dabubble.backend.realtime.UserUpdatedEvent
import com.dabubble.backend.support.IntegrationTest
import com.dabubble.backend.support.StompTestSession
import com.dabubble.backend.support.TestTokens
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.ValueSource
import org.springframework.http.MediaType
import org.springframework.test.json.JsonCompareMode
import org.springframework.test.web.servlet.client.RestTestClient
import java.util.UUID

class ProfileApiTest : IntegrationTest() {
    @Test
    fun `a User renames themselves, trimmed, and everyone sees the new name`() {
        val sub = UUID.randomUUID()
        val token = TestTokens.user(sub, name = "Ada", email = "ada@example.com")
        get("/api/me", token).expectStatus().isOk

        put("/api/me/name", token, """{"name":"  Ada Lovelace  "}""")
            .expectStatus()
            .isOk
            .expectBody()
            .json(
                """
                {"id":"$sub","name":"Ada Lovelace","email":"ada@example.com","avatar":null,
                "uploadedAvatarUrl":null}
                """.trimIndent(),
                JsonCompareMode.STRICT,
            )

        get("/api/users/$sub", TestTokens.user())
            .expectStatus()
            .isOk
            .expectBody()
            .jsonPath("$.name")
            .isEqualTo("Ada Lovelace")
    }

    @Test
    fun `a name of 50 characters is fine, emoji counting as one`() {
        val token = provision()
        val name = "😀".repeat(50)

        put("/api/me/name", token, """{"name":"$name"}""")
            .expectStatus()
            .isOk
            .expectBody()
            .jsonPath("$.name")
            .isEqualTo(name)
    }

    @ParameterizedTest
    @ValueSource(strings = ["", "   "])
    fun `an empty name is a USER_NAME_EMPTY problem and changes nothing`(name: String) {
        val token = TestTokens.user(name = "Ada")

        expectProblem(put("/api/me/name", token, """{"name":"$name"}"""), 400, "USER_NAME_EMPTY")

        get("/api/me", token).expectBody().jsonPath("$.name").isEqualTo("Ada")
    }

    @Test
    fun `a name over 50 characters is a USER_NAME_TOO_LONG problem`() {
        val token = TestTokens.user(name = "Ada")

        expectProblem(put("/api/me/name", token, """{"name":"${"a".repeat(51)}"}"""), 400, "USER_NAME_TOO_LONG")

        get("/api/me", token).expectBody().jsonPath("$.name").isEqualTo("Ada")
    }

    @Test
    fun `the Guest can't rename themselves`() {
        val token = TestTokens.guest()

        expectProblem(put("/api/me/name", token, """{"name":"Hacker"}"""), 403, "GUEST_PROFILE_LOCKED")

        get("/api/me", token).expectBody().jsonPath("$.name").isEqualTo("Guest")
    }

    @Test
    fun `the Guest can't pick an Avatar`() {
        val token = TestTokens.guest()

        expectProblem(put("/api/me/avatar", token, """{"avatar":"AVATAR_1"}"""), 403, "GUEST_PROFILE_LOCKED")

        get("/api/me", token).expectBody().jsonPath("$.avatar").isEqualTo("GUEST")
    }

    @Test
    fun `a new name and a new Avatar reach every tab of the Workspace`() {
        val ada = UUID.randomUUID()
        val adaToken = provision(ada)
        val alanTab = stomp.connect(provision())

        val renamed = putUser(adaToken, "/api/me/name", """{"name":"Ada Lovelace"}""")
        assertEquals(UserUpdatedEvent(renamed), alanTab.awaitUserUpdate())

        val avatar = putUser(adaToken, "/api/me/avatar", """{"avatar":"AVATAR_2"}""")
        assertEquals(UserUpdatedEvent(avatar), alanTab.awaitUserUpdate())
    }

    @Test
    fun `a rejected name pushes nothing`() {
        val adaToken = provision()
        val alanTab = stomp.connect(provision())

        put("/api/me/name", adaToken, """{"name":""}""").expectStatus().isBadRequest
        val renamed = putUser(adaToken, "/api/me/name", """{"name":"Ada"}""")

        assertEquals(UserUpdatedEvent(renamed), alanTab.awaitUserUpdate())
    }

    private fun provision(sub: UUID = UUID.randomUUID()): String {
        val token = TestTokens.user(sub)
        get("/api/me", token).expectStatus().isOk
        return token
    }

    private fun putUser(
        token: String,
        uri: String,
        json: String,
    ): UserDto =
        put(uri, token, json)
            .expectStatus()
            .isOk
            .expectBody(UserDto::class.java)
            .returnResult()
            .responseBody!!

    // Presence events share the Workspace topic, so they're skipped.
    private fun StompTestSession.awaitUserUpdate(): UserUpdatedEvent =
        generateSequence { awaitWorkspaceEvent() }.filterIsInstance<UserUpdatedEvent>().first()
}

internal fun expectProblem(
    response: RestTestClient.ResponseSpec,
    status: Int,
    code: String,
) {
    response
        .expectStatus()
        .isEqualTo(status)
        .expectHeader()
        .contentType(MediaType.APPLICATION_PROBLEM_JSON)
        .expectBody()
        .json("""{"status":$status,"code":"$code"}""", JsonCompareMode.LENIENT)
}
