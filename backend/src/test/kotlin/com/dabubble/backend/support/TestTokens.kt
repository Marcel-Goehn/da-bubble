package com.dabubble.backend.support

import com.nimbusds.jose.JWSAlgorithm
import com.nimbusds.jose.JWSHeader
import com.nimbusds.jose.crypto.RSASSASigner
import com.nimbusds.jwt.JWTClaimsSet
import com.nimbusds.jwt.SignedJWT
import java.security.KeyPair
import java.security.KeyPairGenerator
import java.security.interfaces.RSAPublicKey
import java.time.Duration
import java.time.Instant
import java.util.Date
import java.util.UUID

/** Mints Keycloak-shaped access tokens, signed with a key only the test `JwtDecoder` trusts. */
object TestTokens {
    // Must match spring.security.oauth2.resourceserver.jwt.* in application.properties.
    const val ISSUER = "http://localhost:8080/realms/da-bubble"
    const val AUDIENCE = "da-bubble-api"

    private val keyPair: KeyPair = KeyPairGenerator.getInstance("RSA").apply { initialize(2048) }.generateKeyPair()

    val publicKey: RSAPublicKey = keyPair.public as RSAPublicKey

    fun user(
        sub: UUID = UUID.randomUUID(),
        name: String? = "Ada Lovelace",
        email: String? = "ada@example.com",
        emailVerified: Boolean = true,
        audience: String = AUDIENCE,
        issuer: String = ISSUER,
    ): String {
        val now = Instant.now()
        val claims =
            JWTClaimsSet
                .Builder()
                .issuer(issuer)
                .subject(sub.toString())
                .audience(listOf(audience, "account"))
                .issueTime(Date.from(now))
                .expirationTime(Date.from(now + Duration.ofMinutes(5)))
                .claim("azp", "da-bubble-app")
                .claim("name", name)
                .claim("email", email)
                .claim("email_verified", emailVerified)
                .build()
        val jwt = SignedJWT(JWSHeader.Builder(JWSAlgorithm.RS256).keyID("test").build(), claims)
        jwt.sign(RSASSASigner(keyPair.private))
        return jwt.serialize()
    }
}
