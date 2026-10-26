package com.dabubble.backend.attachment

import jakarta.persistence.LockModeType
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Lock
import java.time.Instant
import java.util.UUID

interface PendingUploadRepository : JpaRepository<PendingUpload, Long> {
    /**
     * Those of [ids] that [uploaderId] uploaded as [kind], locked until the transaction ends: a concurrent use
     * of the same one waits, and then no longer finds it.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    fun findByIdInAndUploaderIdAndKind(
        ids: Collection<Long>,
        uploaderId: UUID,
        kind: PendingUploadKind,
    ): List<PendingUpload>

    /**
     * Those created at or before [cutoff], locked until the transaction ends. One being sent meanwhile is
     * waited for, and then no longer found.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    fun findByCreatedAtLessThanEqual(cutoff: Instant): List<PendingUpload>
}
