package com.dabubble.backend.presence

import io.swagger.v3.oas.annotations.tags.Tag
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
@RequestMapping("/api/presence")
@Tag(name = "presence")
class PresenceController(
    private val presence: PresenceService,
) {
    /** The ids of the Users online now, those briefly disconnected included; what clients catch up on. */
    @GetMapping
    fun listOnline(): List<UUID> = presence.online().sorted()
}
