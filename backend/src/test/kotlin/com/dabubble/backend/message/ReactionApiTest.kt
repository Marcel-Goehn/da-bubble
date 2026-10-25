package com.dabubble.backend.message

import com.dabubble.backend.conversation.ConversationDto
import com.dabubble.backend.support.IntegrationTest
import com.dabubble.backend.support.MutableClock
import com.dabubble.backend.support.TestTokens
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.springframework.dao.DuplicateKeyException
import org.springframework.test.web.servlet.client.RestTestClient
import java.time.Duration
import java.time.temporal.ChronoUnit
import java.util.UUID

class ReactionApiTest : IntegrationTest() {
    @Test
    fun `a User reacts to a Message, and clicking the Reaction again removes it`() {
        val adaId = UUID.randomUUID()
        val ada = provision(adaId)
        val sent = send(ada, "Hallo")

        val reacted = react(ada, sent.id, "👍").expectStatus().isOk.message()

        assertEquals(listOf(ReactionDto("👍", listOf(adaId))), reacted.reactions)
        assertEquals(listOf(reacted), page(ada).messages)

        val removed = react(ada, sent.id, "👍").expectStatus().isOk.message()

        assertEquals(emptyList<ReactionDto>(), removed.reactions)
        assertEquals(listOf(removed), page(ada).messages)
    }

    @Test
    fun `Reactions with the same emoji are grouped, and a skin tone makes another Reaction`() {
        val adaId = UUID.randomUUID()
        val alanId = UUID.randomUUID()
        val ada = provision(adaId)
        val alan = provision(alanId)
        val sent = send(ada, "Hallo")

        react(alan, sent.id, "👍🏽").expectStatus().isOk
        react(ada, sent.id, "✅").expectStatus().isOk
        react(ada, sent.id, "👍🏽").expectStatus().isOk
        val reacted = react(ada, sent.id, "👍").expectStatus().isOk.message()

        assertEquals(
            listOf(
                ReactionDto("👍🏽", listOf(alanId, adaId)),
                ReactionDto("✅", listOf(adaId)),
                ReactionDto("👍", listOf(adaId)),
            ),
            reacted.reactions,
        )
        assertEquals(reacted.reactions, page(alan).messages.single().reactions)
    }

    @Test
    fun `the database keeps one Reaction per Message, User and emoji`() {
        val adaId = UUID.randomUUID()
        val ada = provision(adaId)
        val sent = send(ada, "Hallo")
        react(ada, sent.id, "👍").expectStatus().isOk

        assertThrows<DuplicateKeyException> {
            jdbc
                .sql("INSERT INTO reactions (message_id, user_id, emoji, created_at) VALUES (:id, :user, '👍', now())")
                .param("id", sent.id)
                .param("user", adaId)
                .update()
        }
    }

    @Test
    fun `a Reply can be reacted to`() {
        val adaId = UUID.randomUUID()
        val ada = provision(adaId)
        val parent = send(ada, "Frage")
        val reply =
            post("/api/conversations/1/messages/${parent.id}/replies", ada, """{"text":"Antwort"}""")
                .expectStatus()
                .isCreated
                .message()

        val reacted = react(ada, reply.id, "✅").expectStatus().isOk.message()

        assertEquals(listOf(ReactionDto("✅", listOf(adaId))), reacted.reactions)
    }

    @Test
    fun `a Deleted Message can't be reacted to`() {
        val ada = provision()
        val sent = send(ada, "Weg")
        delete("/api/conversations/1/messages/${sent.id}", ada).expectStatus().isOk

        react(ada, sent.id, "👍")
            .expectStatus()
            .isEqualTo(409)
            .expectBody()
            .jsonPath("$.code")
            .isEqualTo("MESSAGE_DELETED")
    }

    @Test
    fun `deleting a Message erases its Reactions`() {
        val ada = provision()
        val alan = provision()
        val sent = send(ada, "Peinlich")
        react(alan, sent.id, "😂").expectStatus().isOk

        delete("/api/conversations/1/messages/${sent.id}", ada).expectStatus().isOk

        assertEquals(emptyList<ReactionDto>(), page(alan).messages.single().reactions)
    }

    @Test
    fun `a Reaction is exactly one emoji`() {
        val ada = provision()
        val sent = send(ada, "Hallo")

        listOf("", " ", "a", "1", "👍👍", "👍 ", ":+1:").forEach { emoji ->
            react(ada, sent.id, emoji)
                .expectStatus()
                .isBadRequest
                .expectBody()
                .jsonPath("$.code")
                .isEqualTo("EMOJI_INVALID")
        }
        // Flags, keycaps, ZWJ sequences and text-style symbols with VS16 are single emoji too.
        listOf("🇩🇪", "1️⃣", "👩🏽‍💻", "❤️", "👨‍👩‍👧").forEach { emoji ->
            react(ada, sent.id, emoji).expectStatus().isOk
        }
        assertEquals(
            5,
            page(ada)
                .messages
                .single()
                .reactions.size,
        )
    }

    @Test
    fun `a Message in a Conversation the User can't see, or none, is not found`() {
        val alanId = UUID.randomUUID()
        val alan = provision(alanId)
        val marketing = channel("Marketing", members = listOf(alanId))
        val secret = send(alan, "Intern", marketing)
        val ada = provision()

        react(ada, secret.id, "👍", marketing).expectStatus().isNotFound
        react(alan, secret.id, "👍").expectStatus().isNotFound
        react(ada, 999, "👍").expectStatus().isNotFound
    }

    @Test
    fun `reacting bumps the Conversation's last activity`() {
        val ada = provision()
        val sent = send(ada, "Hallo")
        val later = MutableClock.START + Duration.ofMinutes(4)
        clock.set(later)

        react(ada, sent.id, "👍").expectStatus().isOk

        val allgemein =
            get("/api/conversations", ada)
                .expectStatus()
                .isOk
                .expectBody(Array<ConversationDto>::class.java)
                .returnResult()
                .responseBody!!
                .single { it.id == 1L }
        assertEquals(later.truncatedTo(ChronoUnit.MICROS), allgemein.lastActivityAt)
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
        post("/api/conversations/$conversationId/messages", token, """{"text":"$text"}""")
            .expectStatus()
            .isCreated
            .message()

    private fun react(
        token: String,
        messageId: Long,
        emoji: String,
        conversationId: Long = 1,
    ) = post("/api/conversations/$conversationId/messages/$messageId/reactions", token, """{"emoji":"$emoji"}""")

    private fun page(
        token: String,
        conversationId: Long = 1,
    ): MessagePageDto =
        get("/api/conversations/$conversationId/messages", token)
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
