package com.dabubble.backend.message

import com.dabubble.backend.conversation.ConversationDto
import com.dabubble.backend.support.IntegrationTest
import com.dabubble.backend.support.MutableClock
import com.dabubble.backend.support.TestTokens
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.springframework.test.web.servlet.client.RestTestClient
import java.time.Duration
import java.time.Instant
import java.time.temporal.ChronoUnit
import java.util.UUID

class MessageEditApiTest : IntegrationTest() {
    @Test
    fun `the author edits a Message's text, which sets edited at`() {
        val ada = provision()
        val sent = send(ada, "Hallo zusamen")
        val later = MutableClock.START + Duration.ofMinutes(3)
        clock.set(later)

        val edited = edit(ada, sent.id, "Hallo zusammen").expectStatus().isOk.message()

        assertEquals(sent.copy(text = "Hallo zusammen", editedAt = later.truncatedTo(ChronoUnit.MICROS)), edited)
        assertEquals(listOf(edited), page(ada).messages)
    }

    @Test
    fun `nobody but the author may edit a Message`() {
        val ada = provision()
        val sent = send(ada, "Meins")
        val alan = provision()

        edit(alan, sent.id, "Jetzt meins")
            .expectStatus()
            .isForbidden
            .expectBody()
            .jsonPath("$.code")
            .isEqualTo("NOT_MESSAGE_AUTHOR")
        assertEquals(listOf(sent), page(ada).messages)
    }

    @Test
    fun `a Message can't be edited to no text`() {
        val ada = provision()
        val sent = send(ada, "Text")

        listOf("", " ").forEach { text ->
            edit(ada, sent.id, text)
                .expectStatus()
                .isBadRequest
                .expectBody()
                .jsonPath("$.code")
                .isEqualTo("MESSAGE_EMPTY")
        }
        assertEquals(listOf(sent), page(ada).messages)
    }

    @Test
    fun `a Message of another Conversation, or none, is not found`() {
        val adaId = UUID.randomUUID()
        val ada = provision(adaId)
        val marketing = channel("Marketing", members = listOf(adaId))
        val elsewhere = send(ada, "Marketing", marketing)

        edit(ada, elsewhere.id, "Hier?").expectStatus().isNotFound
        deleteMessage(ada, elsewhere.id).expectStatus().isNotFound
        edit(ada, 999, "Niemand").expectStatus().isNotFound
    }

    @Test
    fun `a Message in a Conversation the User can't see is not found`() {
        val alanId = UUID.randomUUID()
        val alan = provision(alanId)
        val marketing = channel("Marketing", members = listOf(alanId))
        val secret = send(alan, "Intern", marketing)
        val ada = provision()

        edit(ada, secret.id, "Hallo?", marketing).expectStatus().isNotFound
        deleteMessage(ada, secret.id, marketing).expectStatus().isNotFound
    }

    @Test
    fun `the author deletes a Message, which keeps its place, author and time but loses its text`() {
        val ada = provision()
        val first = send(ada, "Erste")
        val sent = send(ada, "Peinlich")
        val last = send(ada, "Letzte")
        val later = MutableClock.START + Duration.ofMinutes(3)
        clock.set(later)

        val deleted = deleteMessage(ada, sent.id).expectStatus().isOk.message()

        assertEquals(sent.copy(text = "", deletedAt = later.truncatedTo(ChronoUnit.MICROS)), deleted)
        assertEquals(listOf(last, deleted, first), page(ada).messages)
    }

    @Test
    fun `a deleted edited Message loses its text and keeps when it was edited`() {
        val ada = provision()
        val sent = send(ada, "Erst")
        val edited = edit(ada, sent.id, "Dann").expectStatus().isOk.message()

        val deleted = deleteMessage(ada, sent.id).expectStatus().isOk.message()

        assertEquals(edited.copy(text = "", deletedAt = deleted.deletedAt), deleted)
    }

    @Test
    fun `nobody but the author may delete a Message`() {
        val ada = provision()
        val sent = send(ada, "Meins")
        val alan = provision()

        deleteMessage(alan, sent.id)
            .expectStatus()
            .isForbidden
            .expectBody()
            .jsonPath("$.code")
            .isEqualTo("NOT_MESSAGE_AUTHOR")
        assertEquals(listOf(sent), page(ada).messages)
    }

    @Test
    fun `deleting a Deleted Message again changes nothing`() {
        val ada = provision()
        val sent = send(ada, "Weg")
        val deleted = deleteMessage(ada, sent.id).expectStatus().isOk.message()
        clock.set(MutableClock.START + Duration.ofMinutes(5))

        assertEquals(deleted, deleteMessage(ada, sent.id).expectStatus().isOk.message())
        assertEquals(listOf(deleted), page(ada).messages)
    }

    @Test
    fun `a Deleted Message can't be edited, so it can't be brought back`() {
        val ada = provision()
        val sent = send(ada, "Weg")
        val deleted = deleteMessage(ada, sent.id).expectStatus().isOk.message()

        edit(ada, sent.id, "Wieder da")
            .expectStatus()
            .isEqualTo(409)
            .expectBody()
            .jsonPath("$.code")
            .isEqualTo("MESSAGE_DELETED")
        assertEquals(listOf(deleted), page(ada).messages)
    }

    @Test
    fun `editing and deleting bump the Conversation's last activity`() {
        val adaId = UUID.randomUUID()
        val alanId = UUID.randomUUID()
        val ada = provision(adaId)
        provision(alanId)
        val dm = directMessage(adaId, alanId)
        val sent = send(ada, "Hallo", dm)

        val editedAt = MutableClock.START + Duration.ofMinutes(1)
        clock.set(editedAt)
        edit(ada, sent.id, "Hallo Alan", dm).expectStatus().isOk
        assertEquals(editedAt.truncatedTo(ChronoUnit.MICROS), lastActivity(ada, dm))

        val deletedAt = MutableClock.START + Duration.ofMinutes(2)
        clock.set(deletedAt)
        deleteMessage(ada, sent.id, dm).expectStatus().isOk
        assertEquals(deletedAt.truncatedTo(ChronoUnit.MICROS), lastActivity(ada, dm))
    }

    private fun lastActivity(
        token: String,
        conversationId: Long,
    ): Instant =
        get("/api/conversations", token)
            .expectStatus()
            .isOk
            .expectBody(Array<ConversationDto>::class.java)
            .returnResult()
            .responseBody!!
            .single { it.id == conversationId }
            .lastActivityAt

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
        post("/api/conversations/$conversationId/messages", token, """{"text":"$text"}""")
            .expectStatus()
            .isCreated
            .message()

    private fun edit(
        token: String,
        messageId: Long,
        text: String,
        conversationId: Long = 1,
    ) = put("/api/conversations/$conversationId/messages/$messageId", token, """{"text":"$text"}""")

    private fun deleteMessage(
        token: String,
        messageId: Long,
        conversationId: Long = 1,
    ) = delete("/api/conversations/$conversationId/messages/$messageId", token)

    private fun page(token: String): MessagePageDto =
        get("/api/conversations/1/messages", token)
            .expectStatus()
            .isOk
            .expectBody(MessagePageDto::class.java)
            .returnResult()
            .responseBody!!

    private fun RestTestClient.ResponseSpec.message(): MessageDto =
        expectBody(MessageDto::class.java)
            .returnResult()
            .responseBody!!
}
