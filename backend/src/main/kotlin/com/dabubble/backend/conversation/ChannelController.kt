package com.dabubble.backend.conversation

import com.dabubble.backend.user.User
import com.fasterxml.jackson.annotation.JsonProperty
import io.swagger.v3.oas.annotations.media.Schema
import io.swagger.v3.oas.annotations.tags.Tag
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import java.time.Instant
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

    /** Renames the Channel and changes its description, as an Admin; what's left out stays as it is. */
    @PatchMapping("/{id}")
    fun editChannel(
        user: User,
        @PathVariable id: Long,
        @RequestBody request: EditChannelRequest,
    ): ConversationDto = ConversationDto.from(channels.edit(id, user.id, request.name, request.description), user.id)

    /** Adds Users to the Channel, as an Admin; those already Members stay as they are. */
    @PostMapping("/{id}/members")
    fun addMembers(
        user: User,
        @PathVariable id: Long,
        @RequestBody request: AddMembersRequest,
    ): ConversationDto = ConversationDto.from(channels.addMembers(id, user.id, request.userIds.toSet()), user.id)

    /** Leaves the Channel; anyone may except its Creator, and nobody leaves the Default Channel. */
    @PostMapping("/{id}/leave")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun leaveChannel(
        user: User,
        @PathVariable id: Long,
    ) {
        channels.leave(id, user.id)
    }

    /** Deletes the Channel with all its Messages, as its Creator; nobody deletes the Default Channel. */
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun deleteChannel(
        user: User,
        @PathVariable id: Long,
    ) {
        channels.delete(id, user.id)
    }

    /**
     * Removes a Member, as an Admin; never the Creator or the User themselves. Answers with the Membership as it
     * was, which [restoreMember] takes to undo the removal.
     */
    @DeleteMapping("/{id}/members/{userId}")
    fun removeMember(
        user: User,
        @PathVariable id: Long,
        @PathVariable userId: UUID,
    ): MemberDto =
        // Never the Creator, so their stored Admin flag is all there is.
        MemberDto.from(channels.removeMember(id, user.id, userId), creatorId = null)

    /**
     * Undoes a removal, as an Admin: the User is a Member again with the Admin flag and join time they had. A
     * Member already stays as they are.
     */
    @PutMapping("/{id}/members/{userId}")
    fun restoreMember(
        user: User,
        @PathVariable id: Long,
        @PathVariable userId: UUID,
        @RequestBody request: RestoreMemberRequest,
    ): ConversationDto =
        ConversationDto.from(
            channels.restoreMember(id, user.id, userId, request.isAdmin, request.joinedAt),
            user.id,
        )

    /** Grants or revokes Admin for a Member, as an Admin; never for the Creator or the User themselves. */
    @PutMapping("/{id}/members/{userId}/admin")
    fun setAdmin(
        user: User,
        @PathVariable id: Long,
        @PathVariable userId: UUID,
        @RequestBody request: SetAdminRequest,
    ): ConversationDto = ConversationDto.from(channels.setAdmin(id, user.id, userId, request.isAdmin), user.id)
}

data class AddMembersRequest(
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    val userIds: List<UUID>,
)

/** The removed Membership as [ChannelController.removeMember] answered it. */
data class RestoreMemberRequest(
    @get:Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    @get:JsonProperty("isAdmin")
    val isAdmin: Boolean,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    val joinedAt: Instant,
)

data class SetAdminRequest(
    @get:Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    @get:JsonProperty("isAdmin")
    val isAdmin: Boolean,
)

/** A `null` leaves the name or description as it is; a blank description removes it. */
data class EditChannelRequest(
    val name: String?,
    val description: String?,
)

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
