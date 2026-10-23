package com.dabubble.backend.openapi

import com.dabubble.backend.problem.ProblemDto
import com.dabubble.backend.user.User
import io.swagger.v3.core.converter.ModelConverters
import io.swagger.v3.core.jackson.ModelResolver
import io.swagger.v3.oas.models.OpenAPI
import io.swagger.v3.oas.models.info.Info
import io.swagger.v3.oas.models.servers.Server
import org.springdoc.core.customizers.OpenApiCustomizer
import org.springdoc.core.utils.SpringDocUtils
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

/** Shapes the spec that `OpenApiSpecTest` commits and Orval turns into the Angular client (ADR 0004). */
@Configuration
class OpenApiConfig {
    init {
        // Enums become shared schemas, so the frontend gets one named type per enum.
        ModelResolver.enumsAsRef = true
        // Controllers receive the current User from CurrentUserFilter, not from the request.
        SpringDocUtils.getConfig().addRequestWrapperToIgnore(User::class.java)
    }

    // A relative server keeps the random test port out of the committed spec.
    @Bean
    fun openApi(): OpenAPI =
        OpenAPI()
            .info(Info().title("DA Bubble API").version("v1"))
            .servers(listOf(Server().url("/")))

    @Bean
    fun dabubbleOpenApiCustomizer() =
        OpenApiCustomizer { openApi ->
            val schemas = openApi.components.schemas ?: mutableMapOf()
            // No operation declares its errors, so publish the problem body (and with it ProblemCode) explicitly.
            schemas.putAll(ModelConverters.getInstance(true).readAll(ProblemDto::class.java))
            // Responses always serialise every field: a Kotlin T? is `T | null` in TypeScript, never left out.
            // Response types are named XxxDto and request bodies <Action>Request (spec #42), so the suffix finds them.
            schemas
                .filterKeys { it.endsWith("Dto") }
                .values
                .forEach { schema ->
                    schema.required =
                        schema.properties
                            .orEmpty()
                            .keys
                            .sorted()
                }
            openApi.components.schemas = schemas.toSortedMap()
        }
}
