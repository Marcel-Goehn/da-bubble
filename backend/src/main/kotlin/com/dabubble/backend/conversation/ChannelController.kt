package com.dabubble.backend.conversation

import com.dabubble.backend.user.User
import io.swagger.v3.oas.annotations.media.Schema
import io.swagger.v3.oas.annotations.tags.Tag
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
@RequestMapping("/api/channels")
@Tag(name = "channels")
class ChannelController(
    private val channels: ChannelService,
) {
    /**
     * Creates a Channel with the User as its Creator, joined either by everyone in the Default Channel at this
     * moment or by the picked [CreateChannelRequest.memberIds].
     */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    fun createChannel(
        user: User,
        @RequestBody request: CreateChannelRequest,
    ): ConversationDto {
        val members =
            if (request.addDefaultChannelMembers) {
                NewMembers.DefaultChannelMembers
            } else {
                NewMembers.Picked(request.memberIds.toSet())
            }
        return ConversationDto.from(channels.create(user.id, request.name, request.description, members), user.id)
    }
}

/** With [addDefaultChannelMembers], [memberIds] is ignored. */
data class CreateChannelRequest(
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    val name: String,
    val description: String?,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    val addDefaultChannelMembers: Boolean,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    val memberIds: List<UUID>,
)
