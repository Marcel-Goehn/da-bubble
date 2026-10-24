package com.dabubble.backend.security

import com.dabubble.backend.realtime.RealtimeConfig
import com.dabubble.backend.user.CurrentUserFilter
import com.dabubble.backend.user.CurrentUserService
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.boot.security.oauth2.server.resource.autoconfigure.OAuth2ResourceServerProperties
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.config.annotation.web.invoke
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator
import org.springframework.security.oauth2.core.OAuth2Error
import org.springframework.security.oauth2.core.OAuth2ErrorCodes
import org.springframework.security.oauth2.core.OAuth2TokenValidator
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.security.oauth2.jwt.JwtValidators
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder
import org.springframework.security.oauth2.server.resource.web.BearerTokenAuthenticationEntryPoint
import org.springframework.security.oauth2.server.resource.web.authentication.BearerTokenAuthenticationFilter
import org.springframework.security.web.AuthenticationEntryPoint
import org.springframework.security.web.SecurityFilterChain
import org.springframework.web.servlet.HandlerExceptionResolver

@Configuration
class SecurityConfig {
    // The health endpoint stays public for the compose healthcheck and the WebSocket handshake for STOMP;
    // everything else needs a bearer JWT.
    @Bean
    fun securityFilterChain(
        http: HttpSecurity,
        currentUsers: CurrentUserService,
        @Qualifier("handlerExceptionResolver") exceptionResolver: HandlerExceptionResolver,
    ): SecurityFilterChain {
        val bearerEntryPoint = BearerTokenAuthenticationEntryPoint()
        http {
            authorizeHttpRequests {
                authorize("/actuator/health", permitAll)
                // The STOMP CONNECT frame carries the token instead (StompAuthInterceptor).
                authorize(RealtimeConfig.ENDPOINT, permitAll)
                authorize(anyRequest, authenticated)
            }
            oauth2ResourceServer {
                jwt { }
                // The stock entry point sets 401 and WWW-Authenticate; ProblemHandler then writes the body.
                authenticationEntryPoint =
                    AuthenticationEntryPoint { request, response, ex ->
                        bearerEntryPoint.commence(request, response, ex)
                        exceptionResolver.resolveException(request, response, null, ex)
                    }
            }
            // Not a bean, so Boot doesn't also register it as a plain servlet filter.
            addFilterAfter<BearerTokenAuthenticationFilter>(CurrentUserFilter(currentUsers, exceptionResolver))
        }
        return http.build()
    }

    // A separate bean so the test decoder, which trusts a test key, applies exactly these rules.
    @Bean
    fun jwtValidator(properties: OAuth2ResourceServerProperties): OAuth2TokenValidator<Jwt> {
        val audiences = properties.jwt.audiences
        return DelegatingOAuth2TokenValidator(
            JwtValidators.createDefaultWithIssuer(requireNotNull(properties.jwt.issuerUri)),
            claimValidator("The token is not meant for $audiences") { jwt ->
                audiences.any(jwt.audience.orEmpty()::contains)
            },
            // A User is someone with a verified email (GLOSSARY: User).
            claimValidator("The email is missing or not verified") { jwt ->
                !jwt.getClaimAsString("email").isNullOrBlank() && jwt.getClaimAsBoolean("email_verified") == true
            },
        )
    }

    private fun claimValidator(
        description: String,
        isValid: (Jwt) -> Boolean,
    ) = OAuth2TokenValidator<Jwt> { jwt ->
        if (isValid(jwt)) {
            OAuth2TokenValidatorResult.success()
        } else {
            OAuth2TokenValidatorResult.failure(OAuth2Error(OAuth2ErrorCodes.INVALID_TOKEN, description, null))
        }
    }

    // The issuer is the browser-facing URL, but keys come from the JWK set URI, which compose points at
    // the internal host.
    @Bean
    fun jwtDecoder(
        properties: OAuth2ResourceServerProperties,
        jwtValidator: OAuth2TokenValidator<Jwt>,
    ): JwtDecoder =
        NimbusJwtDecoder
            .withJwkSetUri(requireNotNull(properties.jwt.jwkSetUri))
            .build()
            .apply { setJwtValidator(jwtValidator) }
}
