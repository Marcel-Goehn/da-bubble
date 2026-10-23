package com.dabubble.backend.problem

import com.dabubble.backend.support.IntegrationTest
import com.dabubble.backend.support.TestTokens
import org.junit.jupiter.api.Test
import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.test.json.JsonCompareMode

class ProblemApiTest : IntegrationTest() {
    private val token = TestTokens.user()

    @Test
    fun `an unknown path is a NOT_FOUND problem`() {
        get("/api/nothing-here", token)
            .expectStatus()
            .isNotFound
            .expectHeader()
            .contentType(MediaType.APPLICATION_PROBLEM_JSON)
            .expectBody()
            .json(
                """{"status":404,"code":"NOT_FOUND","instance":"/api/nothing-here","errors":[]}""",
                JsonCompareMode.LENIENT,
            )
    }

    @Test
    fun `an invalid body is a VALIDATION_FAILED problem listing each field and constraint`() {
        client
            .post()
            .uri("/test/problems/validated")
            .header(HttpHeaders.AUTHORIZATION, "Bearer $token")
            .contentType(MediaType.APPLICATION_JSON)
            .body("""{"name":" ","tags":["a","b","c","d"]}""")
            .exchange()
            .expectStatus()
            .isBadRequest
            .expectHeader()
            .contentType(MediaType.APPLICATION_PROBLEM_JSON)
            .expectBody()
            .json(
                """
                {"status":400,"code":"VALIDATION_FAILED",
                 "errors":[{"field":"name","code":"NOT_BLANK"},{"field":"tags","code":"SIZE"}]}
                """.trimIndent(),
                JsonCompareMode.LENIENT,
            )
    }

    @Test
    fun `a thrown ProblemException answers with its code and status`() {
        get("/test/problems/thrown", token)
            .expectStatus()
            .isNotFound
            .expectBody()
            .json("""{"status":404,"code":"NOT_FOUND","detail":"No such thing"}""", JsonCompareMode.LENIENT)
    }

    @Test
    fun `an unexpected failure is an INTERNAL_ERROR problem that hides the exception`() {
        get("/test/problems/crash", token)
            .expectStatus()
            .is5xxServerError
            .expectBody()
            .json("""{"status":500,"code":"INTERNAL_ERROR","detail":null}""", JsonCompareMode.LENIENT)
    }
}
