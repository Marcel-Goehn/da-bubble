package com.dabubble.backend.user

import com.dabubble.backend.support.IntegrationTest
import com.dabubble.backend.support.TestTokens
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.CsvSource
import org.springframework.http.HttpStatus
import org.springframework.http.HttpStatusCode
import org.springframework.test.json.JsonCompareMode
import java.time.OffsetDateTime
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

private const val PARALLEL_REQUESTS = 8

class MeApiTest : IntegrationTest() {
    @Test
    fun `the first request creates the User from the token and returns them`() {
        val sub = UUID.randomUUID()

        get("/api/me", TestTokens.user(sub, name = "Ada Lovelace", email = "ada@example.com"))
            .expectStatus()
            .isOk
            .expectBody()
            .json(
                """{"id":"$sub","name":"Ada Lovelace","email":"ada@example.com","avatar":null}""",
                JsonCompareMode.STRICT,
            )
    }

    // Join and creation times aren't in the API, so these read the tables (ConversationApiTest covers the sidebar).
    @Test
    fun `a new User joins the Default Channel and gets their self-DM, timestamped by the clock`() {
        val sub = UUID.randomUUID()

        get("/api/me", TestTokens.user(sub)).expectStatus().isOk

        val expectedTime = OffsetDateTime.parse("2026-01-15T09:30:00.123456Z")
        assertEquals(
            listOf(expectedTime),
            jdbc
                .sql(
                    """
                    SELECT m.joined_at FROM memberships m JOIN conversations c ON c.id = m.conversation_id
                    WHERE c.is_default AND m.user_id = :sub AND NOT m.is_admin
                    """.trimIndent(),
                ).param("sub", sub)
                .query(OffsetDateTime::class.java)
                .list(),
        )
        assertEquals(
            listOf(expectedTime),
            jdbc
                .sql(
                    """
                    SELECT created_at FROM conversations
                    WHERE kind = 'DIRECT_MESSAGE' AND user_low = :sub AND user_high = :sub
                    """.trimIndent(),
                ).param("sub", sub)
                .query(OffsetDateTime::class.java)
                .list(),
        )
    }

    @Test
    fun `later requests provision nothing more`() {
        val sub = UUID.randomUUID()

        repeat(3) { get("/api/me", TestTokens.user(sub)).expectStatus().isOk }

        assertEquals(1, countRows("memberships WHERE user_id = :sub", sub))
        assertEquals(1, countRows("conversations WHERE user_low = :sub", sub))
    }

    @Test
    fun `parallel first requests provision the User exactly once`() {
        val sub = UUID.randomUUID()
        val token = TestTokens.user(sub)
        val start = CountDownLatch(1)
        val executor = Executors.newFixedThreadPool(PARALLEL_REQUESTS)

        val statuses =
            try {
                List(PARALLEL_REQUESTS) {
                    executor.submit<HttpStatusCode> {
                        start.await()
                        get("/api/me", token).returnResult().status
                    }
                }.also { start.countDown() }
                    .map { it.get(1, TimeUnit.MINUTES) }
            } finally {
                executor.shutdownNow()
            }

        assertEquals(List(PARALLEL_REQUESTS) { HttpStatus.OK }, statuses)
        assertEquals(1, countRows("users WHERE id = :sub", sub))
        assertEquals(1, countRows("memberships WHERE user_id = :sub", sub))
        assertEquals(1, countRows("conversations WHERE user_low = :sub", sub))
    }

    @Test
    fun `the name is copied once while the email follows the token on every request`() {
        val sub = UUID.randomUUID()
        get("/api/me", TestTokens.user(sub, name = "Ada Lovelace", email = "ada@example.com")).expectStatus().isOk

        get("/api/me", TestTokens.user(sub, name = "Ada King", email = "countess@example.com"))
            .expectStatus()
            .isOk
            .expectBody()
            .jsonPath("$.name")
            .isEqualTo("Ada Lovelace")
            .jsonPath("$.email")
            .isEqualTo("countess@example.com")
    }

    @ParameterizedTest(name = "name claim [{0}] becomes {2}")
    @CsvSource(
        delimiter = '|',
        value = [
            // Trimmed; a blank or missing name falls back to the email's local part.
            "'  Ada Lovelace  ' | ada@example.com | Ada Lovelace",
            "'   ' | grace.hopper@example.com | grace.hopper",
            " | grace.hopper@example.com | grace.hopper",
        ],
    )
    fun `the initial name`(
        nameClaim: String?,
        email: String,
        expectedName: String,
    ) {
        get("/api/me", TestTokens.user(name = nameClaim, email = email))
            .expectStatus()
            .isOk
            .expectBody()
            .jsonPath("$.name")
            .isEqualTo(expectedName)
    }

    @Test
    fun `a long name is cut to 50 characters without splitting an emoji`() {
        val name = "x".repeat(49) + "\uD83E\uDEE7" + "tail"

        get("/api/me", TestTokens.user(name = name))
            .expectStatus()
            .isOk
            .expectBody()
            .jsonPath("$.name")
            .isEqualTo("x".repeat(49) + "\uD83E\uDEE7")
    }
}
