package com.dabubble.backend.security

import com.dabubble.backend.support.IntegrationTest
import com.dabubble.backend.support.TestTokens
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.test.json.JsonCompareMode
import java.util.UUID

class TokenValidationApiTest : IntegrationTest() {
    @Test
    fun `a token with an unverified email is rejected and provisions nothing`() {
        val sub = UUID.randomUUID()

        get("/api/me", TestTokens.user(sub, emailVerified = false)).expectStatus().isUnauthorized

        assertEquals(0, countRows("users WHERE id = :sub", sub))
    }

    @Test
    fun `a token without an email is rejected`() {
        get("/api/me", TestTokens.user(email = null)).expectStatus().isUnauthorized
    }

    @Test
    fun `a rejected token is an UNAUTHENTICATED problem that still asks for a bearer token`() {
        get("/api/me", TestTokens.user(emailVerified = false))
            .expectStatus()
            .isUnauthorized
            .expectHeader()
            .valueMatches(HttpHeaders.WWW_AUTHENTICATE, "Bearer.*invalid_token.*")
            .expectHeader()
            .contentType(MediaType.APPLICATION_PROBLEM_JSON)
            .expectBody()
            .json("""{"status":401,"code":"UNAUTHENTICATED","detail":null}""", JsonCompareMode.LENIENT)
    }

    @Test
    fun `a token for another audience is rejected`() {
        get("/api/me", TestTokens.user(audience = "some-other-api")).expectStatus().isUnauthorized
    }

    @Test
    fun `a token from another issuer is rejected`() {
        get("/api/me", TestTokens.user(issuer = "http://localhost:8080/realms/other")).expectStatus().isUnauthorized
    }

    @Test
    fun `a request without a token is an UNAUTHENTICATED problem`() {
        client
            .get()
            .uri("/api/me")
            .exchange()
            .expectStatus()
            .isUnauthorized
            .expectBody()
            .json("""{"status":401,"code":"UNAUTHENTICATED"}""", JsonCompareMode.LENIENT)
    }
}
