package com.dabubble.backend.message

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import java.util.UUID

class MentionTokensTest {
    private val ada = UUID.fromString("0f8fad5b-d9cb-469f-a165-70867728950e")

    @Test
    fun `a User and a Channel Mention hold the id and the name at the time of writing`() {
        val text = "Hallo <@$ada|Ada Lovelace>, siehe <#42|Entwicklung>!"

        assertEquals(
            listOf(
                MentionToken(MentionTarget.User(ada), "Ada Lovelace"),
                MentionToken(MentionTarget.Channel(42), "Entwicklung"),
            ),
            MentionTokens.parse(text),
        )
    }

    @Test
    fun `a backslash escapes a closing bracket or a backslash in the name`() {
        val text = """<@$ada|a\>b\\c>"""

        assertEquals(listOf(MentionToken(MentionTarget.User(ada), """a>b\c""")), MentionTokens.parse(text))
    }

    @Test
    fun `anything that isn't a well-formed token is plain text`() {
        listOf(
            "@Ada",
            "#Entwicklung",
            "<@not-a-uuid|Ada>",
            "<#abc|Kanal>",
            "<#42 Entwicklung>",
            "<#42|Entwicklung",
            "<@$ada|Ada\nLovelace>",
            "<#99999999999999999999|zu groß>",
        ).forEach { assertEquals(emptyList<MentionToken>(), MentionTokens.parse(it), it) }
    }

    @Test
    fun `the targets of a text are each mentioned once`() {
        val text = "<@$ada|Ada> <#42|A> <@$ada|Ada L.> <#42|B>"

        assertEquals(setOf(MentionTarget.User(ada), MentionTarget.Channel(42)), MentionTokens.targetsIn(text))
    }
}
