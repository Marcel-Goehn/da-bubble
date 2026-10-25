package com.dabubble.backend.support

import com.dabubble.backend.time.now
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureRestTestClient
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.web.server.LocalServerPort
import org.springframework.context.ApplicationContext
import org.springframework.context.annotation.Import
import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.messaging.simp.user.SimpUserRegistry
import org.springframework.test.web.servlet.client.RestTestClient
import java.time.ZoneOffset
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

    @Autowired
    protected lateinit var scheduler: ManualScheduler

    @Autowired
    private lateinit var context: ApplicationContext

    @LocalServerPort
    private var port: Int = 0

    private var stompClient: StompTestClient? = null

    /** STOMP sessions to the app; each test's sessions are disconnected after it. */
    protected val stomp: StompTestClient
        get() {
            val registry = context.getBean(SimpUserRegistry::class.java)
            return stompClient ?: StompTestClient(port, registry).also { stompClient = it }
        }

    @AfterEach
    fun disconnectStomp() {
        stompClient?.disconnectAll()
    }

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
        clock.reset()
        // Same row as V1__init.sql seeds, at the test clock's time.
        jdbc
            .sql(
                """
                INSERT INTO conversations (kind, name, is_default, created_at, last_activity_at)
                VALUES ('CHANNEL', 'Allgemein', true, :now, :now)
                """.trimIndent(),
            ).param("now", testNow())
            .update()
        scheduler.reset()
    }

    private fun testNow() = clock.now().atOffset(ZoneOffset.UTC)

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

    protected fun patch(
        uri: String,
        token: String,
        json: String,
    ): RestTestClient.ResponseSpec =
        client
            .patch()
            .uri(uri)
            .header(HttpHeaders.AUTHORIZATION, "Bearer $token")
            .contentType(MediaType.APPLICATION_JSON)
            .body(json)
            .exchange()

    protected fun delete(
        uri: String,
        token: String,
    ): RestTestClient.ResponseSpec =
        client
            .delete()
            .uri(uri)
            .header(HttpHeaders.AUTHORIZATION, "Bearer $token")
            .exchange()

    protected fun post(
        uri: String,
        token: String,
        json: String,
    ): RestTestClient.ResponseSpec =
        client
            .post()
            .uri(uri)
            .header(HttpHeaders.AUTHORIZATION, "Bearer $token")
            .contentType(MediaType.APPLICATION_JSON)
            .body(json)
            .exchange()

    protected fun channel(
        name: String,
        members: List<UUID>,
    ): Long {
        val id =
            jdbc
                .sql(
                    """
                    INSERT INTO conversations (kind, name, created_at, last_activity_at)
                    VALUES ('CHANNEL', :name, :now, :now) RETURNING id
                    """.trimIndent(),
                ).param("name", name)
                .param("now", testNow())
                .query(Long::class.java)
                .single()
        members.forEach {
            jdbc
                .sql("INSERT INTO memberships (conversation_id, user_id, joined_at) VALUES (:id, :user, now())")
                .param("id", id)
                .param("user", it)
                .update()
        }
        return id
    }

    // Sorted the way Conversation.directMessage stores the pair.
    protected fun directMessage(
        a: UUID,
        b: UUID,
    ): Long {
        val (low, high) = listOf(a, b).sortedBy { it.toString() }
        return jdbc
            .sql(
                """
                INSERT INTO conversations (kind, user_low, user_high, created_at, last_activity_at)
                VALUES ('DIRECT_MESSAGE', :low, :high, :now, :now) RETURNING id
                """.trimIndent(),
            ).param("low", low)
            .param("now", testNow())
            .param("high", high)
            .query(Long::class.java)
            .single()
    }
}
