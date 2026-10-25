package com.dabubble.backend.attachment

import com.dabubble.backend.support.IntegrationTest
import com.dabubble.backend.support.SeaweedFs
import com.dabubble.backend.support.TestTokens
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse

class AttachmentUploadApiTest : IntegrationTest() {
    @Test
    fun `an upload is a presigned PUT for the browser that takes exactly the announced size and type`() {
        val ada = provision()

        val upload = requestUpload(ada, """{"name":"Plan.pdf","size":5,"contentType":"application/pdf"}""")

        assertTrue(upload.uploadUrl.startsWith(SeaweedFs.properties.publicEndpoint), upload.uploadUrl)
        assertNull(upload.thumbnailUploadUrl)
        assertEquals(403, putObject(upload.uploadUrl, "123456", "application/pdf"))
        assertEquals(403, putObject(upload.uploadUrl, "12345", "text/html"))
        assertEquals(200, putObject(upload.uploadUrl, "12345", "application/pdf"))
    }

    @Test
    fun `an image gets a second PUT for its WebP thumbnail, pinned to the thumbnail's size`() {
        val ada = provision()

        val upload =
            requestUpload(
                ada,
                """{"name":"Foto.jpg","size":4,"contentType":"image/jpeg","thumbnailSize":3}""",
            )

        val thumbnailUrl = upload.thumbnailUploadUrl!!
        assertEquals(403, putObject(thumbnailUrl, "1234", "image/webp"))
        assertEquals(200, putObject(thumbnailUrl, "123", "image/webp"))
        assertEquals(200, putObject(upload.uploadUrl, "1234", "image/jpeg"))
    }

    @Test
    fun `only images get a thumbnail`() {
        val ada = provision()

        val upload =
            requestUpload(ada, """{"name":"Notiz.txt","size":4,"contentType":"text/plain","thumbnailSize":3}""")

        assertNull(upload.thumbnailUploadUrl)
    }

    @Test
    fun `a file over 25 MB is refused`() {
        val ada = provision()
        val tooLarge = 25L * 1024 * 1024 + 1

        post(
            "/api/attachments/uploads",
            ada,
            """{"name":"Video.mp4","size":$tooLarge,"contentType":"video/mp4"}""",
        ).expectStatus()
            .isEqualTo(413)
            .expectBody()
            .jsonPath("$.code")
            .isEqualTo("ATTACHMENT_TOO_LARGE")
    }

    @Test
    fun `an upload needs a name, a size and a valid type`() {
        val ada = provision()

        listOf(
            """{"name":" ","size":5,"contentType":"text/plain"}""",
            """{"name":"a.txt","size":0,"contentType":"text/plain"}""",
            """{"name":"a.txt","size":5,"contentType":"kein typ"}""",
        ).forEach { body ->
            post("/api/attachments/uploads", ada, body).expectStatus().isBadRequest
        }
    }

    private fun provision(): String {
        val token = TestTokens.user()
        get("/api/me", token).expectStatus().isOk
        return token
    }

    private fun requestUpload(
        token: String,
        json: String,
    ): AttachmentUploadDto =
        post("/api/attachments/uploads", token, json)
            .expectStatus()
            .isCreated
            .expectBody(AttachmentUploadDto::class.java)
            .returnResult()
            .responseBody!!

    /** PUTs [body] to [url] as a browser would: no credentials, only the headers it signs. */
    private fun putObject(
        url: String,
        body: String,
        contentType: String,
    ): Int =
        HttpClient
            .newHttpClient()
            .send(
                HttpRequest
                    .newBuilder(URI(url))
                    .header("Content-Type", contentType)
                    .PUT(HttpRequest.BodyPublishers.ofString(body))
                    .build(),
                HttpResponse.BodyHandlers.discarding(),
            ).statusCode()
}
