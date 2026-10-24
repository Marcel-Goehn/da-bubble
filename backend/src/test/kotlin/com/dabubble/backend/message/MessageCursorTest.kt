package com.dabubble.backend.message

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test
import java.time.Instant

class MessageCursorTest {
    @Test
    fun `a cursor decodes to the position it encodes`() {
        val cursor = MessageCursor(Instant.parse("2026-01-15T09:30:00.123456Z"), 42)

        assertEquals(cursor, MessageCursor.decode(cursor.encode()))
    }

    @Test
    fun `a cursor is URL-safe`() {
        val encoded = MessageCursor(Instant.parse("2026-12-31T23:59:59.999999Z"), Long.MAX_VALUE).encode()

        assertEquals(encoded, encoded.filter { it.isLetterOrDigit() || it == '-' || it == '_' })
    }

    @Test
    fun `anything else decodes to nothing`() {
        listOf("", "kaputt", "MTIz", "!!!", "bm9wZXw0Mg").forEach { assertNull(MessageCursor.decode(it), it) }
    }
}
