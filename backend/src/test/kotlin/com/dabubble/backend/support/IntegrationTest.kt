package com.dabubble.backend.support

import org.junit.jupiter.api.BeforeEach
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureRestTestClient
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.context.annotation.Import
import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.test.web.servlet.client.RestTestClient
import java.util.UUID

/**
 * Base for tests against the running app over HTTP. Requests cross threads, so isolation is
 * truncate + re-seed before each test rather than a rolled-back transaction.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureRestTestClient
@Import(IntegrationTestConfiguration::class, ProblemTestController::class)
abstract class IntegrationTest {
    @Autowired
    protected lateinit var client: RestTestClient

    @Autowired
    protected lateinit var jdbc: JdbcClient

    @Autowired
    protected lateinit var clock: MutableClock

    @BeforeEach
    fun resetState() {
        val tables =
            jdbc
                .sql(
                    """
                    SELECT tablename FROM pg_tables
                    WHERE schemaname = 'public' AND tablename <> 'flyway_schema_history'
                    """.trimIndent(),
                ).query(String::class.java)
                .list()
        if (tables.isNotEmpty()) {
            jdbc.sql("TRUNCATE ${tables.joinToString()} RESTART IDENTITY CASCADE").update()
        }
        // Same row as V1__init.sql seeds.
        jdbc
            .sql(
                """
                INSERT INTO conversations (kind, name, is_default, created_at)
                VALUES ('CHANNEL', 'Allgemein', true, now())
                """.trimIndent(),
            ).update()
        clock.reset()
    }

    protected fun countRows(
        fromWhere: String,
        sub: UUID,
    ): Long =
        jdbc
            .sql("SELECT count(*) FROM $fromWhere")
            .param("sub", sub)
            .query(Long::class.java)
            .single()

    protected fun get(
        uri: String,
        token: String,
    ): RestTestClient.ResponseSpec =
        client
            .get()
            .uri(uri)
            .header(HttpHeaders.AUTHORIZATION, "Bearer $token")
            .exchange()

    protected fun put(
        uri: String,
        token: String,
        json: String,
    ): RestTestClient.ResponseSpec =
        client
            .put()
            .uri(uri)
            .header(HttpHeaders.AUTHORIZATION, "Bearer $token")
            .contentType(MediaType.APPLICATION_JSON)
            .body(json)
            .exchange()
}
