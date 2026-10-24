package com.dabubble.backend.openapi

import com.dabubble.backend.problem.ProblemDto
import com.dabubble.backend.realtime.RealtimeEvent
import com.dabubble.backend.user.User
import io.swagger.v3.core.converter.ModelConverters
import io.swagger.v3.core.jackson.ModelResolver
import io.swagger.v3.oas.models.Components
import io.swagger.v3.oas.models.OpenAPI
import io.swagger.v3.oas.models.info.Info
import io.swagger.v3.oas.models.media.Schema
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
            // No operation returns the STOMP events either; publishing them gives the frontend the typed union.
            schemas.putAll(realtimeEventSchemas())
            // Responses and events always serialise every field: a Kotlin T? is `T | null` in TypeScript, never
            // left out. Response types are named XxxDto, events XxxEvent and request bodies <Action>Request
            // (spec #42), so the suffix finds them.
            schemas
                .filterKeys { it.endsWith("Dto") || it.endsWith("Event") }
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

    /**
     * [RealtimeEvent] as a plain discriminated `oneOf` of flat event objects. swagger-core models each event as
     * `allOf` the union plus its own fields, which loops back to the union and leaves TypeScript without the
     * literal `type` it narrows on.
     */
    private fun realtimeEventSchemas(): Map<String, Schema<*>> {
        val schemas = ModelConverters.getInstance(true).readAll(RealtimeEvent::class.java)
        val unionName = checkNotNull(RealtimeEvent::class.simpleName)
        val unionRef = Components.COMPONENTS_SCHEMAS_REF + unionName
        return schemas.mapValues { (name, schema) ->
            when {
                name == unionName -> {
                    Schema<Any>().oneOf(schema.oneOf).discriminator(schema.discriminator)
                }

                schema.allOf?.any { it.`$ref` == unionRef } == true -> {
                    schema.allOf.single { it.`$ref` != unionRef }
                }

                else -> {
                    schema
                }
            }
        }
    }
}
