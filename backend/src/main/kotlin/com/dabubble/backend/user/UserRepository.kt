package com.dabubble.backend.user

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import java.util.UUID

interface UserRepository : JpaRepository<User, UUID> {
    /** Those of [ids] that are Users. */
    @Query("SELECT u.id FROM User u WHERE u.id IN :ids")
    fun findExistingIds(ids: Collection<UUID>): Set<UUID>
}
