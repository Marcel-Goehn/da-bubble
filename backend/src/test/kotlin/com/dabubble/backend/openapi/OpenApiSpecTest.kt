package com.dabubble.backend.openapi

import com.dabubble.backend.support.IntegrationTest
import com.dabubble.backend.support.TestTokens
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import tools.jackson.databind.SerializationFeature
import tools.jackson.databind.json.JsonMapper
import java.nio.file.Files
import java.nio.file.Path

/**
 * Keeps the committed `backend/openapi.json` (ADR 0004) in step with the controllers: writes the current
 * spec with sorted keys and fails when that changed the file, so the change shows up in the diff.
 */
class OpenApiSpecTest : IntegrationTest() {
    private val specFile: Path = Path.of("openapi.json")

    @Test
    fun `the committed OpenAPI spec is up to date`() {
        val spec =
            get("/v3/api-docs", TestTokens.user())
                .expectStatus()
                .isOk
                .expectBody(String::class.java)
                .returnResult()
                .responseBody!!
        val mapper =
            JsonMapper
                .builder()
                .enable(SerializationFeature.INDENT_OUTPUT, SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS)
                .build()
        val sorted = mapper.writeValueAsString(mapper.readValue(spec, Map::class.java)) + "\n"

        val committed = if (Files.exists(specFile)) Files.readString(specFile) else null
        if (committed != sorted) {
            Files.writeString(specFile, sorted)
        }
        assertEquals(committed, sorted, "openapi.json was stale and has been rewritten; review and commit it")
    }
}
