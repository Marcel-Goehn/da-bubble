package com.dabubble.backend.attachment

import com.dabubble.backend.message.AttachmentDto
import com.dabubble.backend.message.MessageDto
import com.dabubble.backend.message.MessagePageDto
import com.dabubble.backend.message.ThreadPageDto
import com.dabubble.backend.support.StorageApiTest
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test
import org.springframework.test.web.servlet.client.RestTestClient
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.util.UUID

class AttachmentSendApiTest : StorageApiTest() {
    @Test
    fun `a Message with only an Attachment is sent, and everyone who sees it can fetch the file`() {
        val ada = provision()
        val upload = uploadId(ada, "Plan.pdf", "%PDF-1", "application/pdf")

        val sent = send(ada, "", listOf(upload)).expectStatus().isCreated.message()

        val attachment = sent.attachments.single()
        assertEquals(
            AttachmentDto(attachment.id, "Plan.pdf", 6, "application/pdf", attachment.url, null),
            attachment,
        )
        assertEquals("", sent.text)
        val alan = provision()
        val shown =
            page(alan)
                .messages
                .single()
                .attachments
                .single()
        assertEquals("%PDF-1", fetch(shown.url).body())
    }

    @Test
    fun `an image's Attachment carries its thumbnail`() {
        val ada = provision()
        val upload = uploadId(ada, "Foto.png", "png!", "image/png", thumbnail = "webp")

        val attachment =
            send(ada, "Schau", listOf(upload))
                .expectStatus()
                .isCreated
                .message()
                .attachments
                .single()

        assertEquals("webp", fetch(attachment.thumbnailUrl!!).body())
        assertEquals("png!", fetch(attachment.url).body())
    }

    @Test
    fun `an image whose thumbnail never arrived is sent without one`() {
        val ada = provision()
        val upload = uploadId(ada, "Foto.png", "png!", "image/png", thumbnail = "webp", putThumbnail = false)

        val attachment =
            send(ada, "", listOf(upload))
                .expectStatus()
                .isCreated
                .message()
                .attachments
                .single()

        assertNull(attachment.thumbnailUrl)
    }

    @Test
    fun `Attachments keep the order they were sent in`() {
        val ada = provision()
        val uploads = listOf("b.txt", "a.txt", "c.txt").map { uploadId(ada, it, it, "text/plain") }

        val sent = send(ada, "", uploads).expectStatus().isCreated.message()

        assertEquals(listOf("b.txt", "a.txt", "c.txt"), sent.attachments.map { it.name })
    }

    @Test
    fun `a file that was never uploaded can't be sent`() {
        val ada = provision()
        val upload = uploadId(ada, "Plan.pdf", "%PDF-1", "application/pdf", putFile = false)

        send(ada, "Hier", listOf(upload)).expectProblem(400, "UPLOAD_INCOMPLETE")
        assertEquals(emptyList<MessageDto>(), page(ada).messages)
    }

    @Test
    fun `only its uploader may send a Pending Upload`() {
        val ada = provision()
        val upload = uploadId(ada, "Plan.pdf", "%PDF-1", "application/pdf")
        val alan = provision()

        send(alan, "Meins", listOf(upload)).expectProblem(400, "UPLOAD_NOT_FOUND")
    }

    @Test
    fun `a Pending Upload is used once`() {
        val ada = provision()
        val upload = uploadId(ada, "Plan.pdf", "%PDF-1", "application/pdf")
        send(ada, "Einmal", listOf(upload)).expectStatus().isCreated

        send(ada, "Nochmal", listOf(upload)).expectProblem(400, "UPLOAD_NOT_FOUND")
        send(ada, "Unbekannt", listOf(999)).expectProblem(400, "UPLOAD_NOT_FOUND")
    }

    @Test
    fun `a Message has at most 5 Attachments`() {
        val ada = provision()
        val uploads = (1..6).map { uploadId(ada, "$it.txt", "$it", "text/plain") }

        send(ada, "Viele", uploads).expectProblem(400, "TOO_MANY_ATTACHMENTS")
        send(ada, "Fünf", uploads.take(5)).expectStatus().isCreated
    }

    @Test
    fun `a Message needs text or an Attachment`() {
        val ada = provision()

        send(ada, " ", emptyList()).expectProblem(400, "MESSAGE_EMPTY")
    }

    @Test
    fun `Replies and DMs take Attachments too`() {
        val adaId = UUID.randomUUID()
        val ada = provision(adaId)
        val alanId = UUID.randomUUID()
        val alan = provision(alanId)
        val parent = send(ada, "Frage", emptyList()).expectStatus().isCreated.message()

        val reply =
            post(
                "/api/conversations/1/messages/${parent.id}/replies",
                alan,
                body("", listOf(uploadId(alan, "Antwort.txt", "ja", "text/plain"))),
            ).expectStatus()
                .isCreated
                .message()
        val direct =
            post(
                "/api/direct-messages/$adaId/messages",
                alan,
                body("", listOf(uploadId(alan, "Privat.txt", "psst", "text/plain"))),
            ).expectStatus()
                .isCreated
                .message()

        val thread =
            get("/api/conversations/1/messages/${parent.id}/replies", ada)
                .expectStatus()
                .isOk
                .expectBody(ThreadPageDto::class.java)
                .returnResult()
                .responseBody!!
        assertEquals(
            listOf("Antwort.txt"),
            thread.replies
                .single()
                .attachments
                .map { it.name },
        )
        assertEquals(listOf("Antwort.txt"), reply.attachments.map { it.name })
        assertEquals(listOf("Privat.txt"), direct.attachments.map { it.name })
    }

    @Test
    fun `a Message with Attachments may be edited to no text, one without may not`() {
        val ada = provision()
        val withFile =
            send(ada, "Text", listOf(uploadId(ada, "a.txt", "a", "text/plain"))).expectStatus().isCreated.message()
        val without = send(ada, "Text", emptyList()).expectStatus().isCreated.message()

        val edited =
            put("/api/conversations/1/messages/${withFile.id}", ada, """{"text":" "}""")
                .expectStatus()
                .isOk
                .message()
        put("/api/conversations/1/messages/${without.id}", ada, """{"text":" "}""").expectProblem(400, "MESSAGE_EMPTY")

        assertEquals("", edited.text)
        assertEquals(listOf("a.txt"), edited.attachments.map { it.name })
    }

    @Test
    fun `a Deleted Message loses its Attachments`() {
        val ada = provision()
        val sent = send(ada, "", listOf(uploadId(ada, "a.txt", "a", "text/plain"))).expectStatus().isCreated.message()

        val deleted = delete("/api/conversations/1/messages/${sent.id}", ada).expectStatus().isOk.message()

        assertEquals(emptyList<AttachmentDto>(), deleted.attachments)
        assertEquals(emptyList<AttachmentDto>(), page(ada).messages.single().attachments)
    }

    private fun uploadId(
        token: String,
        name: String,
        content: String,
        contentType: String,
        thumbnail: String? = null,
        putFile: Boolean = true,
        putThumbnail: Boolean = true,
    ): Long = upload(token, name, content, contentType, thumbnail, putFile, putThumbnail).id

    private fun send(
        token: String,
        text: String,
        uploadIds: List<Long>,
    ) = send(token, 1, text, uploadIds)

    private fun page(token: String): MessagePageDto =
        get("/api/conversations/1/messages", token)
            .expectStatus()
            .isOk
            .expectBody(MessagePageDto::class.java)
            .returnResult()
            .responseBody!!

    private fun RestTestClient.ResponseSpec.expectProblem(
        status: Int,
        code: String,
    ) {
        expectStatus()
            .isEqualTo(status)
            .expectBody()
            .jsonPath("$.code")
            .isEqualTo(code)
    }

    private fun fetch(url: String): HttpResponse<String> =
        HttpClient.newHttpClient().send(HttpRequest.newBuilder(URI(url)).build(), HttpResponse.BodyHandlers.ofString())
}
