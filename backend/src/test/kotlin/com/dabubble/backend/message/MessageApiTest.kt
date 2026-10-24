package com.dabubble.backend.message

import com.dabubble.backend.support.IntegrationTest
import com.dabubble.backend.support.MutableClock
import com.dabubble.backend.support.TestTokens
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test
import org.springframework.test.json.JsonCompareMode
import java.time.Duration
import java.util.UUID

class MessageApiTest : IntegrationTest() {
    @Test
    fun `a Member sends a Message and reads it back`() {
        val ada = UUID.randomUUID()
        val token = TestTokens.user(ada)
        get("/api/me", token).expectStatus().isOk

        post("/api/conversations/1/messages", token, """{"text":"Hallo zusammen"}""")
            .expectStatus()
            .isCreated
            .expectBody()
            .json(
                """
                {
                  "id":1,"conversationId":1,"authorId":"$ada","parentMessageId":null,"text":"Hallo zusammen",
                  "createdAt":"2026-01-15T09:30:00.123456Z","editedAt":null,"deletedAt":null,
                  "replyCount":0,"lastReplyAt":null
                }
                """.trimIndent(),
                JsonCompareMode.STRICT,
            )

        get("/api/conversations/1/messages", token)
            .expectStatus()
            .isOk
            .expectBody()
            .jsonPath("$.messages[*].text")
            .isEqualTo(listOf("Hallo zusammen"))
            .jsonPath("$.nextCursor")
            .isEqualTo(null)
    }

    @Test
    fun `a page lists the newest Message first`() {
        val token = provision()
        listOf("eins", "zwei", "drei").forEach { send(token, it) }

        assertEquals(listOf("drei", "zwei", "eins"), page(token).messages.map { it.text })
    }

    @Test
    fun `a Member reads the Messages sent before they joined`() {
        val ada = provision()
        send(ada, "Vor deiner Zeit")
        val alan = provision()

        assertEquals(listOf("Vor deiner Zeit"), page(alan).messages.map { it.text })
    }

    @Test
    fun `a blank Message is rejected`() {
        val token = provision()

        listOf("", " ", "\n\t ").forEach { text ->
            post("/api/conversations/1/messages", token, """{"text":${jsonString(text)}}""")
                .expectStatus()
                .isBadRequest
                .expectBody()
                .jsonPath("$.code")
                .isEqualTo("MESSAGE_EMPTY")
        }
        assertEquals(emptyList<MessageDto>(), page(token).messages)
    }

    @Test
    fun `only Members may send to or read a Channel`() {
        val alan = UUID.randomUUID()
        provision(alan)
        val marketing = channel("Marketing", members = listOf(alan))
        send(TestTokens.user(alan), "Intern", marketing)
        val ada = provision()

        get("/api/conversations/$marketing/messages", ada)
            .expectStatus()
            .isNotFound
            .expectBody()
            .jsonPath("$.code")
            .isEqualTo("NOT_FOUND")
        post("/api/conversations/$marketing/messages", ada, """{"text":"Hallo?"}""")
            .expectStatus()
            .isNotFound
        assertEquals(listOf("Intern"), page(TestTokens.user(alan), marketing).messages.map { it.text })
    }

    @Test
    fun `only the two Users of a DM may send to or read it`() {
        val ada = UUID.randomUUID()
        val alan = UUID.randomUUID()
        listOf(ada, alan).forEach(::provision)
        val dm = directMessage(ada, alan)
        val grace = provision()

        send(TestTokens.user(ada), "Nur für dich", dm)

        assertEquals(listOf("Nur für dich"), page(TestTokens.user(alan), dm).messages.map { it.text })
        get("/api/conversations/$dm/messages", grace).expectStatus().isNotFound
        post("/api/conversations/$dm/messages", grace, """{"text":"Ich auch"}""").expectStatus().isNotFound
    }

    @Test
    fun `pages of 50 walk the whole history once, even when Messages share a timestamp`() {
        val token = provision()
        // The clock stands still, so all 120 Messages have the same created at.
        val sent = (1..120).map { send(token, "Nachricht $it").id }

        val first = page(token)
        val second = page(token, cursor = first.nextCursor)
        val third = page(token, cursor = second.nextCursor)

        assertEquals(listOf(50, 50, 20), listOf(first, second, third).map { it.messages.size })
        assertEquals(sent.reversed(), (first.messages + second.messages + third.messages).map { it.id })
        assertNull(third.nextCursor)
    }

    @Test
    fun `Messages sent while paging don't shift the older pages`() {
        val token = provision()
        val sent = (1..60).map { send(token, "Alt $it").id }
        val first = page(token)

        clock.set(MutableClock.START + Duration.ofMinutes(1))
        repeat(5) { send(token, "Neu $it") }

        assertEquals(sent.take(10).reversed(), page(token, cursor = first.nextCursor).messages.map { it.id })
    }

    @Test
    fun `a malformed cursor is a bad request`() {
        val token = provision()

        listOf("kaputt", "", "MTIz").forEach { cursor ->
            get("/api/conversations/1/messages?cursor=$cursor", token)
                .expectStatus()
                .isBadRequest
                .expectBody()
                .jsonPath("$.code")
                .isEqualTo("BAD_REQUEST")
        }
    }

    private fun provision(sub: UUID = UUID.randomUUID()): String {
        val token = TestTokens.user(sub)
        get("/api/me", token).expectStatus().isOk
        return token
    }

    private fun send(
        token: String,
        text: String,
        conversationId: Long = 1,
    ): MessageDto =
        post("/api/conversations/$conversationId/messages", token, """{"text":${jsonString(text)}}""")
            .expectStatus()
            .isCreated
            .expectBody(MessageDto::class.java)
            .returnResult()
            .responseBody!!

    private fun page(
        token: String,
        conversationId: Long = 1,
        cursor: String? = null,
    ): MessagePageDto =
        get("/api/conversations/$conversationId/messages" + cursor?.let { "?cursor=$it" }.orEmpty(), token)
            .expectStatus()
            .isOk
            .expectBody(MessagePageDto::class.java)
            .returnResult()
            .responseBody!!

    private fun jsonString(text: String): String =
        "\"" +
            text
                .replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\t", "\\t") + "\""
}
