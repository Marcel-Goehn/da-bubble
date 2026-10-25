package com.dabubble.backend.message

import com.dabubble.backend.support.IntegrationTest
import com.dabubble.backend.support.TestTokens
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.test.web.servlet.client.RestTestClient
import java.util.UUID

// message_mention records which Messages mention which User or Channel, for search and renames to find them.
class MentionApiTest : IntegrationTest() {
    @Test
    fun `sending a Message keeps its Mention tokens and records whom and what it mentions`() {
        val adaId = UUID.randomUUID()
        val alanId = UUID.randomUUID()
        val ada = provision(adaId)
        provision(alanId)
        val channelId = channel("Entwicklung", listOf(adaId))
        val text = "Hallo <@$alanId|Alan Turing>, siehe <#$channelId|Entwicklung> und <@$alanId|Alan>"

        val sent = send(ada, text)

        assertEquals(text, sent.text)
        assertEquals(setOf(MentionTarget.User(alanId), MentionTarget.Channel(channelId)), mentionsOf(sent.id))
    }

    @Test
    fun `a Reply records its Mentions too`() {
        val adaId = UUID.randomUUID()
        val ada = provision(adaId)
        val parent = send(ada, "Frage")

        val reply =
            post("/api/conversations/1/messages/${parent.id}/replies", ada, body("<@$adaId|Ada>"))
                .expectStatus()
                .isCreated
                .message()

        assertEquals(setOf(MentionTarget.User(adaId)), mentionsOf(reply.id))
    }

    @Test
    fun `editing a Message records its Mentions anew`() {
        val adaId = UUID.randomUUID()
        val alanId = UUID.randomUUID()
        val ada = provision(adaId)
        provision(alanId)
        val sent = send(ada, "<@$adaId|Ada> und <@$alanId|Alan>")

        put("/api/conversations/1/messages/${sent.id}", ada, body("<@$alanId|Alan> und <#1|Allgemein>"))
            .expectStatus()
            .isOk

        assertEquals(setOf(MentionTarget.User(alanId), MentionTarget.Channel(1)), mentionsOf(sent.id))
    }

    @Test
    fun `deleting a Message erases its Mentions`() {
        val adaId = UUID.randomUUID()
        val ada = provision(adaId)
        val sent = send(ada, "<@$adaId|Ada>")

        delete("/api/conversations/1/messages/${sent.id}", ada).expectStatus().isOk

        assertEquals(emptySet<MentionTarget>(), mentionsOf(sent.id))
    }

    @Test
    fun `a token for a User or Channel that doesn't exist, or for a DM, stays text and records nothing`() {
        val adaId = UUID.randomUUID()
        val ada = provision(adaId)
        val dmId = directMessage(adaId, UUID.randomUUID().also { provision(it) })
        val text = "<@${UUID.randomUUID()}|Niemand> <#999|Weg> <#$dmId|DM>"

        val sent = send(ada, text)

        assertEquals(text, sent.text)
        assertEquals(emptySet<MentionTarget>(), mentionsOf(sent.id))
    }

    @Test
    fun `a Mention adds nobody to anything`() {
        val adaId = UUID.randomUUID()
        val alanId = UUID.randomUUID()
        val ada = provision(adaId)
        val alan = provision(alanId)
        val channelId = channel("Entwicklung", listOf(adaId))
        val channelMembers = countRows("memberships WHERE conversation_id = $channelId")
        val conversations = countRows("conversations")

        send(ada, "<@$alanId|Alan>, schau mal in <#$channelId|Entwicklung>")

        assertEquals(channelMembers, countRows("memberships WHERE conversation_id = $channelId"))
        assertEquals(conversations, countRows("conversations"))
        get("/api/conversations/$channelId/messages", alan).expectStatus().isNotFound
    }

    @Test
    fun `deleting a Channel removes the Mentions of it`() {
        val adaId = UUID.randomUUID()
        val ada = provision(adaId)
        val channelId =
            post(
                "/api/channels",
                ada,
                """{"name":"Entwicklung","addDefaultChannelMembers":false,"memberIds":[]}""",
            ).expectStatus()
                .isCreated
                .expectBody(Map::class.java)
                .returnResult()
                .responseBody!!["id"]
                .toString()
                .toLong()
        val sent = send(ada, "<#$channelId|Entwicklung>")

        delete("/api/channels/$channelId", ada).expectStatus().is2xxSuccessful

        assertEquals(emptySet<MentionTarget>(), mentionsOf(sent.id))
        assertEquals("<#$channelId|Entwicklung>", page(ada).messages.single().text)
    }

    @Test
    fun `the database keeps a Mention to exactly one User or Channel, once per Message`() {
        val adaId = UUID.randomUUID()
        val ada = provision(adaId)
        val sent = send(ada, "<@$adaId|Ada>")

        assertThrows<DataIntegrityViolationException> {
            jdbc.sql("INSERT INTO message_mention (message_id) VALUES (:id)").param("id", sent.id).update()
        }
        assertThrows<DataIntegrityViolationException> {
            jdbc
                .sql("INSERT INTO message_mention (message_id, user_id, channel_id) VALUES (:id, :ada, 1)")
                .param("id", sent.id)
                .param("ada", adaId)
                .update()
        }
        assertThrows<DataIntegrityViolationException> {
            jdbc
                .sql("INSERT INTO message_mention (message_id, user_id) VALUES (:id, :ada)")
                .param("id", sent.id)
                .param("ada", adaId)
                .update()
        }
    }

    private fun mentionsOf(messageId: Long): Set<MentionTarget> =
        jdbc
            .sql("SELECT user_id, channel_id FROM message_mention WHERE message_id = :id")
            .param("id", messageId)
            .query { rs, _ ->
                rs.getObject("user_id", UUID::class.java)?.let { MentionTarget.User(it) }
                    ?: MentionTarget.Channel(rs.getLong("channel_id"))
            }.set()

    private fun provision(sub: UUID): String {
        val token = TestTokens.user(sub)
        get("/api/me", token).expectStatus().isOk
        return token
    }

    private fun body(text: String) = """{"text":"$text"}"""

    private fun send(
        token: String,
        text: String,
    ): MessageDto =
        post("/api/conversations/1/messages", token, body(text))
            .expectStatus()
            .isCreated
            .message()

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
