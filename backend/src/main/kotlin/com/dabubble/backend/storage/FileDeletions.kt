package com.dabubble.backend.storage

import com.dabubble.backend.time.now
import org.slf4j.LoggerFactory
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Component
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.TransactionDefinition
import org.springframework.transaction.support.TransactionSynchronization
import org.springframework.transaction.support.TransactionSynchronizationManager
import org.springframework.transaction.support.TransactionTemplate
import java.time.Clock
import java.time.ZoneOffset

/**
 * Deletes stored files once nothing refers to them: a Deleted Message's Attachments, a deleted Channel's, a
 * swept Pending Upload, and an uploaded Avatar once it's replaced or removed. A file storage fails to delete is
 * kept in `file_deletions` until [retry] deletes it.
 */
@Component
class FileDeletions(
    private val storage: ObjectStorage,
    private val jdbc: JdbcClient,
    transactionManager: PlatformTransactionManager,
    private val clock: Clock,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    // The committed transaction's resources are still bound after its commit; recording needs one of its own.
    private val newTransaction =
        TransactionTemplate(transactionManager).apply {
            propagationBehavior = TransactionDefinition.PROPAGATION_REQUIRES_NEW
        }

    /**
     * Deletes the objects [keys] after the current transaction commits, in the same request, and not at all if
     * it rolls back.
     */
    fun deleteAfterCommit(keys: Collection<String>) {
        check(TransactionSynchronizationManager.isSynchronizationActive()) { "Files are deleted after a commit" }
        if (keys.isEmpty()) {
            return
        }
        TransactionSynchronizationManager.registerSynchronization(
            object : TransactionSynchronization {
                // The request already succeeded; whatever fails here is only logged.
                @Suppress("TooGenericExceptionCaught")
                override fun afterCommit() {
                    try {
                        val failed = storage.deleteAll(keys)
                        if (failed.isNotEmpty()) {
                            newTransaction.executeWithoutResult { record(failed) }
                        }
                    } catch (e: Exception) {
                        log.error("Couldn't delete or record the files {}", keys, e)
                    }
                }
            },
        )
    }

    /** Tries again to delete up to [RETRY_BATCH] of the files storage failed to delete, oldest first. */
    fun retry() {
        val keys =
            jdbc
                .sql("SELECT object_key FROM file_deletions ORDER BY failed_at, object_key LIMIT :limit")
                .param("limit", RETRY_BATCH)
                .query(String::class.java)
                .list()
                .filterNotNull()
        if (keys.isEmpty()) {
            return
        }
        val deleted = keys - storage.deleteAll(keys).toSet()
        if (deleted.isNotEmpty()) {
            jdbc
                .sql("DELETE FROM file_deletions WHERE object_key IN (:keys)")
                .param("keys", deleted)
                .update()
        }
    }

    private fun record(keys: Collection<String>) {
        val now = clock.now().atOffset(ZoneOffset.UTC)
        keys.forEach {
            jdbc
                .sql("INSERT INTO file_deletions (object_key, failed_at) VALUES (:key, :now) ON CONFLICT DO NOTHING")
                .param("key", it)
                .param("now", now)
                .update()
        }
    }

    private companion object {
        const val RETRY_BATCH = 1000
    }
}
