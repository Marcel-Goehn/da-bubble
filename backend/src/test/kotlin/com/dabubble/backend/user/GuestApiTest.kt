package com.dabubble.backend.user

import com.dabubble.backend.support.IntegrationTest
import com.dabubble.backend.support.TestTokens
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.springframework.test.json.JsonCompareMode
import java.util.UUID

class GuestApiTest : IntegrationTest() {
    @Test
    fun `the Guest is provisioned with the Guest Avatar, so they skip the Avatar step`() {
        val sub = UUID.randomUUID()

        get("/api/me", TestTokens.guest(sub))
            .expectStatus()
            .isOk
            .expectBody()
            .json(
                """{"id":"$sub","name":"Guest","email":"guest@dabubble.com","avatar":"GUEST"}""",
                JsonCompareMode.STRICT,
            )
    }

    // No Conversation endpoint exists yet, so this reads the tables; switch to the sidebar API once it lands.
    @Test
    fun `the Guest is marked as the Guest and joins the Default Channel like everyone else`() {
        val sub = UUID.randomUUID()

        get("/api/me", TestTokens.guest(sub)).expectStatus().isOk

        assertEquals(1, countRows("users WHERE id = :sub AND is_guest", sub))
        assertEquals(
            1,
            countRows(
                "memberships m JOIN conversations c ON c.id = m.conversation_id " +
                    "WHERE c.is_default AND m.user_id = :sub",
                sub,
            ),
        )
    }

    @Test
    fun `a User without the guest role is not the Guest and has no Avatar yet`() {
        val sub = UUID.randomUUID()

        get("/api/me", TestTokens.user(sub))
            .expectStatus()
            .isOk
            .expectBody()
            .jsonPath("$.avatar")
            .isEqualTo(null)

        assertEquals(0, countRows("users WHERE id = :sub AND is_guest", sub))
    }
}
