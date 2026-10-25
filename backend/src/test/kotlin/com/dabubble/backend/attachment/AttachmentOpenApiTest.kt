package com.dabubble.backend.attachment

import com.dabubble.backend.message.AttachmentUrlDto
import com.dabubble.backend.message.MessageDto
import com.dabubble.backend.support.IntegrationTest
import com.dabubble.backend.support.TestTokens
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import java.net.URI
import java.net.URLEncoder
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.util.UUID

class AttachmentOpenApiTest : IntegrationTest() {
    @Test
    fun `a file safe to show opens in the browser under its original name`() {
        val ada = provision()
        val sent = send(ada, "Bericht ü.pdf", "%PDF-1", "application/pdf")

        val file = fetch(openUrl(ada, sent))

        assertEquals("%PDF-1", file.body())
        // With an ASCII fallback for clients without RFC 5987.
        assertEquals(
            "inline; filename=\"Bericht ue.pdf\"; filename*=UTF-8''${encoded("Bericht ü.pdf")}",
            disposition(file),
        )
    }

    @Test
    fun `any other file is downloaded`() {
        val ada = provision()
        val sent = send(ada, "Seite.html", "<script>", "text/html")

        val file = fetch(openUrl(ada, sent))

        assertEquals("attachment; filename=\"Seite.html\"; filename*=UTF-8''Seite.html", disposition(file))
        assertEquals(disposition(file), disposition(fetch(sent.attachments.single().url)))
    }

    @Test
    fun `a file safe to show can still be downloaded`() {
        val ada = provision()
        val sent = send(ada, "Plan.pdf", "%PDF-1", "application/pdf")

        val file = fetch(openUrl(ada, sent, download = true))

        assertEquals("attachment; filename=\"Plan.pdf\"; filename*=UTF-8''Plan.pdf", disposition(file))
    }

    @Test
    fun `a Member removed from the Channel can no longer open its Attachments`() {
        val adaId = UUID.randomUUID()
        val ada = provision(adaId)
        val alanId = UUID.randomUUID()
        val alan = provision(alanId)
        val marketing = channel("Marketing", members = listOf(adaId, alanId))
        val sent = send(ada, "Plan.pdf", "%PDF-1", "application/pdf", marketing)
        openUrl(alan, sent)

        jdbc
            .sql("DELETE FROM memberships WHERE conversation_id = :id AND user_id = :user")
            .param("id", marketing)
            .param("user", alanId)
            .update()

        urlRequest(alan, sent).expectStatus().isNotFound
    }

    @Test
    fun `an Attachment of another Message, or of a Deleted Message, is not found`() {
        val ada = provision()
        val sent = send(ada, "Plan.pdf", "%PDF-1", "application/pdf")
        val other = send(ada, "Andere.pdf", "%PDF-2", "application/pdf")
        val attachmentId = sent.attachments.single().id

        get("/api/conversations/1/messages/${other.id}/attachments/$attachmentId/url", ada).expectStatus().isNotFound
        delete("/api/conversations/1/messages/${sent.id}", ada).expectStatus().isOk
        urlRequest(ada, sent).expectStatus().isNotFound
    }

    private fun provision(sub: UUID = UUID.randomUUID()): String {
        val token = TestTokens.user(sub)
        get("/api/me", token).expectStatus().isOk
        return token
    }

    /** Sends a Message to [conversationId] with only the file [name] holding [content]. */
    private fun send(
        token: String,
        name: String,
        content: String,
        contentType: String,
        conversationId: Long = 1,
    ): MessageDto {
        val upload =
            post(
                "/api/attachments/uploads",
                token,
                """{"name":"$name","size":${content.toByteArray().size},"contentType":"$contentType"}""",
            ).expectStatus()
                .isCreated
                .expectBody(AttachmentUploadDto::class.java)
                .returnResult()
                .responseBody!!
        HttpClient.newHttpClient().send(
            HttpRequest
                .newBuilder(URI(upload.uploadUrl))
                .header("Content-Type", contentType)
                .PUT(HttpRequest.BodyPublishers.ofString(content))
                .build(),
            HttpResponse.BodyHandlers.discarding(),
        )
        return post(
            "/api/conversations/$conversationId/messages",
            token,
            """{"text":"","attachmentIds":[${upload.id}]}""",
        ).expectStatus()
            .isCreated
            .expectBody(MessageDto::class.java)
            .returnResult()
            .responseBody!!
    }

    private fun urlRequest(
        token: String,
        message: MessageDto,
        download: Boolean = false,
    ) = get(
        "/api/conversations/${message.conversationId}/messages/${message.id}/attachments/" +
            "${message.attachments.single().id}/url?download=$download",
        token,
    )

    private fun openUrl(
        token: String,
        message: MessageDto,
        download: Boolean = false,
    ): String =
        urlRequest(token, message, download)
            .expectStatus()
            .isOk
            .expectBody(AttachmentUrlDto::class.java)
            .returnResult()
            .responseBody!!
            .url

    private fun fetch(url: String): HttpResponse<String> =
        HttpClient.newHttpClient().send(HttpRequest.newBuilder(URI(url)).build(), HttpResponse.BodyHandlers.ofString())

    private fun disposition(response: HttpResponse<*>): String? {
        val header = response.headers().firstValue("Content-Disposition")
        return header.orElse(null)
    }

    private fun encoded(name: String) = URLEncoder.encode(name, Charsets.UTF_8).replace("+", "%20")
}
