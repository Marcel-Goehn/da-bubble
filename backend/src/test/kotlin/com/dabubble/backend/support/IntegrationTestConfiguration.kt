package com.dabubble.backend.support

import org.springframework.boot.test.context.TestConfiguration
import org.springframework.boot.testcontainers.service.connection.ServiceConnection
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Primary
import org.springframework.security.oauth2.core.OAuth2TokenValidator
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder
import org.testcontainers.postgresql.PostgreSQLContainer

@TestConfiguration(proxyBeanMethods = false)
class IntegrationTestConfiguration {
    // Same tag as compose.yaml. As a bean of the one shared context, every integration test reuses it.
    @Bean
    @ServiceConnection
    fun postgres(): PostgreSQLContainer = PostgreSQLContainer("postgres:18.6")

    // Trusts TestTokens' key but keeps the production validators (issuer, audience, verified email).
    @Bean
    @Primary
    fun testJwtDecoder(jwtValidator: OAuth2TokenValidator<Jwt>): JwtDecoder =
        NimbusJwtDecoder.withPublicKey(TestTokens.publicKey).build().apply { setJwtValidator(jwtValidator) }

    @Bean
    @Primary
    fun mutableClock(): MutableClock = MutableClock()

    @Bean
    @Primary
    fun manualScheduler(): ManualScheduler = ManualScheduler()
}
