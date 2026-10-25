package com.dabubble.backend.message

import com.dabubble.backend.support.IntegrationTest
import com.dabubble.backend.support.MutableClock
import com.dabubble.backend.support.TestTokens
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.springframework.test.json.JsonCompareMode
import java.time.Duration
import java.util.UUID

class ThreadApiTest : IntegrationTest() {
    @Test
    fun `a Member replies to a Message and reads the Thread back`() {
        val ada = UUID.randomUUID()
        val token = provision(ada)
        val parent = send(token, "Welche Version ist aktuell?")
        clock.set(MutableClock.START + Duration.ofMinutes(5))

        post("/api/conversations/1/messages/${parent.id}/replies", token, """{"text":"Angular 22"}""")
            .expectStatus()
            .isCreated
            .expectBody()
            .json(
                """
                {
                  "id":2,"conversationId":1,"authorId":"$ada","parentMessageId":${parent.id},"text":"Angular 22",
                  "createdAt":"2026-01-15T09:35:00.123456Z","editedAt":null,"deletedAt":null,
                  "replyCount":0,"lastReplyAt":null,"reactions":[],"attachments":[]
                }
                """.trimIndent(),
                JsonCompareMode.STRICT,
            )

        val thread = thread(token, parent.id)
        assertEquals(parent.copy(replyCount = 1, lastReplyAt = thread.replies.single().createdAt), thread.parent)
        assertEquals(listOf("Angular 22"), thread.replies.map { it.text })
        assertEquals(null, thread.nextCursor)
    }

    @Test
    fun `a Reply can't be replied to, nor have a Thread of its own`() {
        val token = provision()
        val parent = send(token, "Frage")
        val answer = sentReply(token, parent.id, "Antwort")

        reply(token, answer.id, "Antwort auf die Antwort")
            .expectStatus()
            .isBadRequest
            .expectBody()
            .jsonPath("$.code")
            .isEqualTo("REPLY_HAS_NO_THREAD")
        get("/api/conversations/1/messages/${answer.id}/replies", token)
            .expectStatus()
            .isBadRequest
            .expectBody()
            .jsonPath("$.code")
            .isEqualTo("REPLY_HAS_NO_THREAD")
        assertEquals(listOf("Antwort"), thread(token, parent.id).replies.map { it.text })
    }

    @Test
    fun `a Reply stays in its parent's Conversation`() {
        val adaId = UUID.randomUUID()
        val ada = provision(adaId)
        val marketing = channel("Marketing", members = listOf(adaId))
        val elsewhere = send(ada, "Im Marketing", marketing)

        reply(ada, elsewhere.id, "Falscher Ort")
            .expectStatus()
            .isNotFound
            .expectBody()
            .jsonPath("$.code")
            .isEqualTo("NOT_FOUND")
        get("/api/conversations/1/messages/${elsewhere.id}/replies", ada).expectStatus().isNotFound
        reply(ada, 999, "Niemand").expectStatus().isNotFound

        val answer = sentReply(ada, elsewhere.id, "Richtiger Ort", marketing)
        assertEquals(marketing, answer.conversationId)
        assertEquals(listOf("Richtiger Ort"), thread(ada, elsewhere.id, marketing).replies.map { it.text })
    }

    @Test
    fun `Replies don't show among the Conversation's Messages`() {
        val token = provision()
        val parent = send(token, "Oben")
        sentReply(token, parent.id, "Im Thread")

        val page =
            get("/api/conversations/1/messages", token)
                .expectStatus()
                .isOk
                .expectBody(MessagePageDto::class.java)
                .returnResult()
                .responseBody!!
        assertEquals(listOf("Oben"), page.messages.map { it.text })
        assertEquals(1, page.messages.single().replyCount)
    }

    @Test
    fun `the parent counts every Reply, Deleted ones too, and knows the time of the last`() {
        val token = provision()
        val parent = send(token, "Frage")
        sentReply(token, parent.id, "Erste")
        val lastTime = MutableClock.START + Duration.ofMinutes(26)
        clock.set(lastTime)
        val last = sentReply(token, parent.id, "Zweite")
        delete("/api/conversations/1/messages/${last.id}", token).expectStatus().isOk

        val shown = thread(token, parent.id).parent
        assertEquals(2, shown.replyCount)
        assertEquals(last.createdAt, shown.lastReplyAt)
        // An edit of the parent returns it with its Thread, too.
        val edited =
            put("/api/conversations/1/messages/${parent.id}", token, """{"text":"Neue Frage"}""")
                .expectStatus()
                .isOk
                .expectBody(MessageDto::class.java)
                .returnResult()
                .responseBody!!
        assertEquals(2, edited.replyCount)
    }

    @Test
    fun `a Deleted Message's Thread stays open for Replies`() {
        val token = provision()
        val parent = send(token, "Bald weg")
        delete("/api/conversations/1/messages/${parent.id}", token).expectStatus().isOk

        sentReply(token, parent.id, "Trotzdem")

        val thread = thread(token, parent.id)
        assertEquals("", thread.parent.text)
        assertEquals(listOf("Trotzdem"), thread.replies.map { it.text })
    }

    @Test
    fun `a blank Reply is rejected`() {
        val token = provision()
        val parent = send(token, "Frage")

        reply(token, parent.id, " ")
            .expectStatus()
            .isBadRequest
            .expectBody()
            .jsonPath("$.code")
            .isEqualTo("MESSAGE_EMPTY")
        assertEquals(0, thread(token, parent.id).parent.replyCount)
    }

    @Test
    fun `only Users who see the Conversation may read or reply in its Threads`() {
        val alanId = UUID.randomUUID()
        val alan = provision(alanId)
        val marketing = channel("Marketing", members = listOf(alanId))
        val secret = send(alan, "Intern", marketing)
        val ada = provision()

        get("/api/conversations/$marketing/messages/${secret.id}/replies", ada).expectStatus().isNotFound
        reply(ada, secret.id, "Hallo?", marketing).expectStatus().isNotFound
        assertEquals(0, thread(alan, secret.id, marketing).parent.replyCount)
    }

    @Test
    fun `Thread pages of 50 walk all Replies once, newest first, even when they share a timestamp`() {
        val token = provision()
        val parent = send(token, "Frage")
        // The clock stands still, so all 70 Replies have the same created at.
        val sent = (1..70).map { sentReply(token, parent.id, "Antwort $it").id }

        val first = thread(token, parent.id)
        val second = thread(token, parent.id, cursor = first.nextCursor)

        assertEquals(listOf(50, 20), listOf(first, second).map { it.replies.size })
        assertEquals(sent.reversed(), (first.replies + second.replies).map { it.id })
        assertEquals(null, second.nextCursor)
        assertEquals(70, second.parent.replyCount)
        get("/api/conversations/1/messages/${parent.id}/replies?cursor=kaputt", token).expectStatus().isBadRequest
    }

    @Test
    fun `a Reply bumps the Conversation's last activity`() {
        val token = provision()
        val parent = send(token, "Frage")
        val later = MutableClock.START + Duration.ofHours(1)
        clock.set(later)

        val answer = sentReply(token, parent.id, "Antwort")

        get("/api/conversations", token)
            .expectStatus()
            .isOk
            .expectBody()
            .jsonPath("$[?(@.id == 1)].lastActivityAt")
            .isEqualTo(listOf(answer.createdAt.toString()))
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
            .expectBody(MessageDto::class.java)
            .returnResult()
            .responseBody!!

    private fun reply(
        token: String,
        parentId: Long,
        text: String,
        conversationId: Long = 1,
    ) = post("/api/conversations/$conversationId/messages/$parentId/replies", token, """{"text":"$text"}""")

    private fun sentReply(
        token: String,
        parentId: Long,
        text: String,
        conversationId: Long = 1,
    ): MessageDto =
        reply(token, parentId, text, conversationId)
            .expectStatus()
            .isCreated
            .expectBody(MessageDto::class.java)
            .returnResult()
            .responseBody!!

    private fun thread(
        token: String,
        parentId: Long,
        conversationId: Long = 1,
        cursor: String? = null,
    ): ThreadPageDto =
        get(
            "/api/conversations/$conversationId/messages/$parentId/replies" + cursor?.let { "?cursor=$it" }.orEmpty(),
            token,
        ).expectStatus()
            .isOk
            .expectBody(ThreadPageDto::class.java)
            .returnResult()
            .responseBody!!
}
