# How should Postgres search Message text?

Research for issue #25. Researched 2026-10-21 against PostgreSQL 18 docs and source, the Snowball project, Hibernate ORM 7 docs and Spring Data JPA docs.

Context: a 5–50 person German-speaking team, one Workspace. Domain model from #16, `GLOSSARY.md` and ADR 0002: a Conversation is a Channel or a DM, a Reply is a Message with a parent, a Deleted Message is a tombstone, Mentions are tokens in the text holding an id plus the name at writing time, and lists use keyset pagination. Backend: Kotlin, Spring Boot 4.1.1, Spring Data JPA (Hibernate 7). The repo pins no Postgres version (no compose file, `application.properties` only has the app name), so this assumes **PostgreSQL 18**. There's no migration tool yet either.

## Recommendation

Use **both, OR'd together, over one denormalised column that the app maintains**:

1. A plain `search_text text` column on `message`. The app writes it: the Message text with every Mention token replaced by its current display name (`@Anna Schmidt`, `#projekt-x`). It's `NULL` for Deleted Messages.
2. `search_tsv tsvector GENERATED ALWAYS AS (to_tsvector('german_unaccent', coalesce(search_text, ''))) STORED`, plus a GIN index. `german_unaccent` is a copy of `german` with `unaccent` in front of `german_stem`.
3. A GIN `gin_trgm_ops` expression index on `f_unaccent(search_text)` for substring matching with `ILIKE`.
4. Query: `deleted_at IS NULL AND conversation visible to me AND (search_tsv @@ tsquery OR f_unaccent(search_text) ILIKE '%' || f_unaccent(:q) || '%')`. Order newest first, keyset-paginate on `(created_at, id)`, and run `ts_headline` only on the page that comes back, with sentinel delimiters that the backend turns into structured segments.
5. Call it through a native query (`@NativeQuery` or `JdbcClient`) that returns a projection. Hibernate has no FTS functions.

**Fallback**: FTS only (`german_unaccent` with `websearch_to_tsquery`, no pg_trgm), with the same `search_text`, visibility, tombstone and snippet design. You lose substring and compound-part matching ("raum" won't find "Besprechungsraum") but drop one extension and one index. The other fallback is trigram/ILIKE only: no stemming, so "Besprechungen" won't find "Besprechung" unless the user types a shared substring, and snippets have to be built in the app.

## Findings

### 1. FTS `german` vs pg_trgm vs both

**Built-in FTS with `german`**
- `german` uses the Snowball `german_stem` dictionary. Snowball "recognizes everything, whether or not it is able to simplify the word, so it should be placed at the end of the dictionary list" ([PG 18 §12.6 Dictionaries](https://www.postgresql.org/docs/18/textsearch-dictionaries.html)). Stemming gives inflection matching (Besprechung/Besprechungen).
- **Compound words aren't split.** The Snowball German page says compound splitting needs a dictionary and the algorithmic stemmers "do not attempt it" ([Snowball German stemmer](https://snowballstem.org/algorithms/german/stemmer.html)). Postgres can split compounds only with an Ispell/Hunspell dictionary, and "the standard PostgreSQL distribution does not include any Ispell configuration files". You have to install `.dict`/`.affix` files into `$SHAREDIR/tsearch_data`, and "PostgreSQL implements only the basic compound word operations of Hunspell" ([§12.6](https://www.postgresql.org/docs/18/textsearch-dictionaries.html)). That's server file-system work and doesn't fit a managed or containerised Postgres, so for us **FTS alone won't find compound parts**.
- **Umlauts and ß.** Snowball German replaces ß with ss and finally removes the umlaut from a/o/u ([Snowball](https://snowballstem.org/algorithms/german/stemmer.html)). The current Snowball page also says it conflates ae/oe/ue spellings with ä/ö/ü. PG bundles its own Snowball snapshot (src/backend/snowball), which may lag the current upstream, so check the `Muenchen`/`München` behaviour with `ts_debug('german', …)` rather than assuming it. Adding `unaccent` as a filtering dictionary before the stemmer makes accents irrelevant on both document and query side ([unaccent docs](https://www.postgresql.org/docs/18/unaccent.html)):
  ```sql
  CREATE EXTENSION unaccent;             -- trusted: needs only CREATE on the DB
  CREATE TEXT SEARCH CONFIGURATION german_unaccent (COPY = german);
  ALTER TEXT SEARCH CONFIGURATION german_unaccent
    ALTER MAPPING FOR hword, hword_part, word WITH unaccent, german_stem;
  ```
  (The docs give this pattern with French. The German version is the same pattern, so test it with `to_tsvector`.) The stock `unaccent.rules` maps `ä→a ö→o ü→u Ä→A Ö→O Ü→U ß→ss ẞ→SS` ([source, REL_18_STABLE](https://github.com/postgres/postgres/blob/REL_18_STABLE/contrib/unaccent/unaccent.rules)). So "Muller" finds "Müller", but "Mueller" doesn't through unaccent.
- **Query parsing.** `websearch_to_tsquery` "never raises syntax errors", so you can pass it raw user input. It supports `"phrases"`, `OR` and `-exclude`, but it "does not recognize tsquery operators, weight labels, or prefix-match labels" ([§12.3](https://www.postgresql.org/docs/18/textsearch-controls.html)). **No search-as-you-type with it.** Prefix matching needs `to_tsquery` with `lexeme:*`, which means building the query string yourself from sanitised tokens. Note that the prefix gets stemmed too, so test that partial German words stem to a prefix of the full word's lexeme.
- **Hyphenated words** are indexed as the whole word and as each part, which "allows searches to work for both the whole compound word and for components" ([§12.5 Parsers](https://www.postgresql.org/docs/18/textsearch-parsers.html)). So `Projekt-Meeting` is findable by `Meeting`. Unhyphenated compounds aren't.

**pg_trgm**
- Trigram GIN and GiST indexes support `LIKE`/`ILIKE` with **non-anchored** patterns (`'%foo%'`) and regexes, plus similarity operators `%`, `<%`, `<<%`. Only GiST supports distance ordering (`<->`). The default thresholds are similarity 0.3, word_similarity 0.6 and strict_word_similarity 0.5. The extension is trusted ([PG 18 F.35 pg_trgm](https://www.postgresql.org/docs/18/pgtrgm.html)).
- Non-alphanumeric characters are ignored when extracting trigrams. "A pattern with no extractable trigrams degenerates to a full-index scan" (paraphrased from the same page), so require at least 3 characters for the substring branch.
- **Strengths for us**: substring and compound parts ("raum" in "Besprechungsraum"), search-as-you-type for free, and names in Mentions.
- **Weaknesses**: no stemming or stop words, no `ts_headline`, and nothing for phrase or `-exclude`. Typo matching (`%`, `<%`) against whole Messages is noisy because thresholds are relative to the extent compared. The docs' own typo approach builds a separate table of distinct words (`ts_stat(... 'simple' ...)`) with a trigram index for "did you mean" suggestions, and notes that table "must be periodically regenerated" ([pg_trgm §F.35.5](https://www.postgresql.org/docs/18/pgtrgm.html)). That's out of scope for v1.
- `unaccent()` is declared `STABLE` ([unaccent--1.1.sql, REL_18_STABLE](https://github.com/postgres/postgres/blob/REL_18_STABLE/contrib/unaccent/unaccent--1.1.sql)), so it can't appear directly in an index expression. Use the usual immutable wrapper, which pins the dictionary explicitly:
  ```sql
  CREATE FUNCTION f_unaccent(text) RETURNS text
    LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
    RETURN public.unaccent('public.unaccent'::regdictionary, $1);
  CREATE INDEX message_search_trgm ON message USING gin (f_unaccent(search_text) gin_trgm_ops);
  ```
  The user's term must have `%`, `_` and `\` escaped before it goes into the `ILIKE` pattern (backslash is the default LIKE escape).

**Why both.** FTS gives stemming, phrases, exclusion and good snippets. Trigrams give substring and compound-part matches and prefix-as-you-type. Postgres can combine a `@@` and an `ILIKE` predicate under `OR` with a BitmapOr of the two GIN indexes. Confirm this with `EXPLAIN` once there's data.

**Is an index needed at 5–50 users?** Rough estimate, not measured: 50 people × ~50 Messages/day × ~250 working days ≈ 600k rows/year. The docs say queries "will work without an index", but "practical use of text searching usually requires creating an index" ([§12.2](https://www.postgresql.org/docs/18/textsearch-tables.html)). Without a stored `tsvector`, a sequential scan would re-run `to_tsvector` on every row for every search. Both GIN indexes are cheap at this size, and writes are low-rate (chat), so add them from the start rather than retrofitting. The stored column also avoids rechecking with `to_tsvector` ([§12.2.2](https://www.postgresql.org/docs/18/textsearch-tables.html)).

**Generated column details (PG 18).** Generated columns are now **virtual by default**, so write `STORED` explicitly. The expression "can only use immutable functions and cannot use subqueries or reference anything other than the current row" ([§5.4](https://www.postgresql.org/docs/18/ddl-generated-columns.html)). Two-argument `to_tsvector(regconfig, text)` qualifies, and expression indexes must use the two-argument form with a fixed config ([§12.2.2](https://www.postgresql.org/docs/18/textsearch-tables.html)). That same rule is why Mention names **can't** be resolved inside a generated column (see §2).

### 2. Making Mentions searchable by current display name

Mention tokens hold the User or Channel id plus the name at writing time, and render with the **current** name (#16). Searching the raw text would match ids and stale names.

| Option | How | Trade-offs |
|---|---|---|
| **A. Denormalised `search_text`** (recommended) | The app renders text with current names on create/edit and writes `search_text`, and `search_tsv` follows automatically. On a User display-name change or Channel rename/delete, re-render `search_text` for the Messages that mention that id. | Simple indexed query, and `ts_headline` works on `search_text` directly, so snippets show names and never tokens. Costs a fan-out update on rename. Renames are rare and the Workspace is small, so it's a background or same-transaction `UPDATE` of a few hundred rows. Finding the affected rows needs a lookup: a `message_mention(message_id, target_kind, target_id)` side table (also useful later for notifications), or a `LIKE '%<token for id>%'` scan, which is acceptable at this size. The index is eventually consistent if the re-render is async. |
| B. Resolve at query time | Look up User/Channel ids whose current name matches the query, then OR in `text LIKE '%<id-token>%'`, or rewrite tokens with `regexp_replace` + lookup per row. | No fan-out writes, but it can't use the FTS index for names, can't mix name and words in one phrase, and `ts_headline` would need the rendered text built per row at query time (a correlated lookup per hit). More SQL, worse snippets. |
| C. Generated column that resolves names | — | Not possible: generated columns can't reference other rows or tables ([§5.4](https://www.postgresql.org/docs/18/ddl-generated-columns.html)). A trigger could do it, but that's option A hidden in plpgsql, and it still needs a rename trigger. |

Edge: a Channel Mention renders with the stored name for viewers who aren't in that Channel (#16), so the rendered name is viewer-dependent. Option A indexes one name per Mention. Suggest the current Channel name, or the stored name once the Channel is deleted. The leak is negligible (Channel names are Workspace-unique and not secret), but the spec should confirm it.

Also strip the token syntax itself. The default parser splits a UUID into hyphenated parts and numbers ([§12.5](https://www.postgresql.org/docs/18/textsearch-parsers.html)), so raw tokens would pollute `search_tsv` with id fragments. That's one more reason to index rendered text only.

### 3. Visibility and tombstones

- **Tombstones**: on delete the app sets `deleted_at` and nulls `text` and `search_text`, so `search_tsv` becomes empty and the trigram expression becomes NULL. Also filter `deleted_at IS NULL` explicitly. That's cheap, and it guards against any row where the nulling didn't happen. A Deleted parent's Replies stay searchable: they're their own Messages.
- **Current visibility** (#16: leaving a Channel removes access to history and search; Members see full history including before they joined; DMs are visible to their two Users):
  ```sql
  m.conversation_id IN (
    SELECT cm.conversation_id FROM channel_membership cm WHERE cm.user_id = :me
    UNION ALL
    SELECT dm.id FROM direct_message dm WHERE :me IN (dm.user_a_id, dm.user_b_id)
  )
  ```
  Use the real table and column names once the schema exists. Don't filter by join time, since full history is visible. Replies share their parent's `conversation_id`, so they're covered.
- At this scale a user sees at most a few dozen Conversations, so Postgres can evaluate the FTS/trigram match through the indexes and filter by `conversation_id`. A btree on `message(conversation_id, created_at, id)` already exists for list pagination (ADR 0002) and helps when the visible set is small.

### 4. Snippets

- `ts_headline([config,] document text, query tsquery [, options])`. The defaults are `MaxWords=35, MinWords=15, ShortWord=3, HighlightAll=false, MaxFragments=0, StartSel=<b>, StopSel=</b>, FragmentDelimiter=" ... "`. With no match it shows the first `MinWords` words ([§12.3.4](https://www.postgresql.org/docs/18/textsearch-controls.html)).
- **Cost**: it "uses the original document, not a tsvector summary, so it can be slow and should be used with care" (same page). Compute it **only for the returned page**: rank, filter and `LIMIT` in a subquery, and call `ts_headline` in the outer select. Chat Messages are short, so `MaxFragments=2, MaxWords=20, MinWords=8` is plenty.
- **XSS**: "The output from ts_headline is not guaranteed to be safe for direct inclusion in web pages … all HTML markup should be removed from the input document, or an HTML sanitizer should be used on the output" (same page). Recommendation:
  - Pass sentinel delimiters that can't appear in normal text, for example `StartSel=U+E000, StopSel=U+E001` (private-use code points; strip them from input on save).
  - In Kotlin, split the headline into `[{text, highlighted}]` segments and return those as JSON.
  - Angular renders each segment with interpolation (`{{ }}`), which escapes, wrapping highlighted ones in `<mark>`. Never use `[innerHTML]`, so no HTML ever crosses the API. Angular's own guidance: interpolated values are treated as untrusted and escaped ([angular.dev security](https://angular.dev/best-practices/security)).
  - With `HighlightAll=false` the parser drops some tag-like tokens (`<foo>`) from the headline, so the snippet may differ slightly from the Message text. That's harmless.
- **Trigram/ILIKE-only hits** (substring that FTS didn't match): `ts_headline` returns the opening words with nothing highlighted. Detect this (no sentinel in the output, or compute `search_tsv @@ q` as a boolean column). Then highlight in Kotlin with an accent- and case-insensitive substring search on `search_text` (normalise both sides the same way `f_unaccent`+lower does) and cut a window of about 20 words around the first hit. Same segment format.

### 5. Ranking, ordering and pagination

- `ts_rank` (frequency) and `ts_rank_cd` (cover density / proximity) both "must consult the tsvector of each matching document", which "can be I/O bound and slow" ([§12.3.3](https://www.postgresql.org/docs/18/textsearch-controls.html)). They exist only for the FTS branch, and trigram-only hits have no comparable score (`word_similarity` is on a different scale).
- For a team chat, **newest first** is what people expect and it's stable. Use `ORDER BY m.created_at DESC, m.id DESC` with keyset pagination (`(m.created_at, m.id) < (:beforeCreatedAt, :beforeId)`), matching ADR 0002's list pagination.
- If a "Relevant" sort is wanted later, order by `ts_rank_cd(search_tsv, q, 1|32)` with a boost for exact hits, then recency. Use **offset** pagination for that mode only (the result set is small, and keyset on a float score plus a tie-breaker is awkward). Spring Data notes offset gets "inefficient when the offset is too large" ([Spring Data JPA, query method details](https://docs.spring.io/spring-data/jpa/reference/repositories/query-methods-details.html)), which doesn't matter here.

### 6. Calling it from Spring Data JPA / Hibernate 7

- Hibernate 7's HQL has no full-text functions: the query-language guide has no `tsvector`, `@@` or `ts_rank`. It offers `function('name', args…)` for arbitrary DB functions and `sql('pattern', args…)` to embed a native SQL fragment, e.g. `sql('?::inet', …)` ([Hibernate 7 Query Language guide §2.6.10](https://docs.hibernate.org/orm/7.0/querylanguage/html_single/)). `@@` is an operator, not a function, so HQL would need `sql(...)` or a custom `FunctionContributor`. That's not worth it.
- Use a **native query**. `@NativeQuery(value = …)` is "mostly a composed annotation for `@Query(nativeQuery=true)`", and native queries can return a `Map`/Tuple or a projection ([Spring Data JPA query methods](https://docs.spring.io/spring-data/jpa/reference/jpa/query-methods.html)). Spring Data's built-in `Window`/`ScrollPosition` keyset scrolling isn't available: "Scrolling with String-based query methods is not yet supported" (same page). Pass the keyset cursor as plain parameters and return `limit + 1` rows to know if there's more.
- This is a read model that combines aggregates (Message + Conversation + author), which ADR 0002 says goes through "dedicated queries or projections". Spring's `JdbcClient` with a Kotlin data-class row mapper is an equally good fit and avoids JPA entirely for this read.
- Don't map `search_tsv` in the `Message` entity: it's generated, and Hibernate never needs to read it. Map `search_text` as a normal column written by the Message aggregate, or by a small domain service that renders Mentions.
- Sketch:
  ```sql
  WITH q AS (SELECT websearch_to_tsquery('german_unaccent', :q) AS tsq,
                    '%' || f_unaccent(:qLikeEscaped) || '%' AS pat)
  SELECT p.*, ts_headline('german_unaccent', p.search_text, q.tsq,
           'StartSel=, StopSel=, MaxFragments=2, MaxWords=20, MinWords=8') AS headline
  FROM (
    SELECT m.id, m.conversation_id, m.parent_message_id, m.author_id, m.created_at,
           m.search_text, (m.search_tsv @@ q.tsq) AS fts_hit
    FROM message m, q
    WHERE m.deleted_at IS NULL
      AND m.conversation_id IN (/* visible set, §3 */)
      AND (m.search_tsv @@ q.tsq OR (length(:q) >= 3 AND f_unaccent(m.search_text) ILIKE q.pat))
      AND (:beforeCreatedAt IS NULL OR (m.created_at, m.id) < (:beforeCreatedAt, :beforeId))
    ORDER BY m.created_at DESC, m.id DESC
    LIMIT :limitPlusOne
  ) p, q
  ORDER BY p.created_at DESC, p.id DESC;
  ```
  The `StartSel`/`StopSel` values are U+E000/U+E001. The 3-character minimum applies to the trigram branch only (see §1).

## Ruled out

- **Hunspell/Ispell German dictionary for compound splitting**: dictionary files aren't shipped and must go into the server's `tsearch_data` directory, and compound support is basic. That's an operational burden for a small app. Trigram substring covers the practical need.
- **External search engine (Elasticsearch/OpenSearch/Meilisearch)**: unjustified at 5–50 users. It adds a second store to keep consistent with tombstones and membership changes.
- **Query-time Mention resolution** (option B): worse snippets and no index use for names.
- **Trigram similarity (`%`, `<%`) for typo tolerance in v1**: noisy on whole Messages. Use the docs' word-list approach later if "did you mean" is wanted.
- **`ts_headline` over the whole hit set** or returning its HTML to Angular: cost and XSS, see §4.

## Open points the spec still has to settle

1. **Search-as-you-type or submit-to-search?** If as-you-type, the FTS branch needs a prefix-`to_tsquery` builder (tokens with `:*`) instead of `websearch_to_tsquery`. Or rely on the trigram branch for partial words.
2. **Scope and filters**: whole Workspace only, or also "in this Conversation" and "from User"? Do Replies show with a link to their Thread? Do results group by Conversation?
3. **Sort modes**: recency only (recommended), or also a "Relevant" mode with offset paging?
4. **Mention rendering for search**: confirm current Channel name (or stored name after deletion) for `#` Mentions, and choose a sync or async re-render on rename. That decides whether a `message_mention` side table is added now.
5. **Minimum query length** for the substring branch (3 suggested) and what shorter queries do (FTS only).
6. **Schema migrations**: the repo has no Flyway/Liquibase yet. Extensions (`unaccent`, `pg_trgm`), the `german_unaccent` text search configuration, `f_unaccent` and the generated column need a migration tool. `ddl-auto` can't create them.
7. **Postgres version pin**: nothing in the repo pins it. Pin 18 (stored generated column syntax, virtual-by-default) in the compose/deployment file when it's added.
8. **Umlaut transliteration** (`Mueller` vs `Müller`): check the PG 18 `german` stemmer with `ts_debug`, and decide whether to add a custom unaccent rules file mapping `ä→ae` etc. (which then needs the same mapping on queries).

## Sources

- PostgreSQL 18: [§12.2 Tables and Indexes](https://www.postgresql.org/docs/18/textsearch-tables.html), [§12.3 Controlling Text Search](https://www.postgresql.org/docs/18/textsearch-controls.html), [§12.5 Parsers](https://www.postgresql.org/docs/18/textsearch-parsers.html), [§12.6 Dictionaries](https://www.postgresql.org/docs/18/textsearch-dictionaries.html), [§12.11 Limitations](https://www.postgresql.org/docs/18/textsearch-limitations.html) (tsvector < 1 MB, positions ≤ 16,383: irrelevant for chat-sized text), [§5.4 Generated Columns](https://www.postgresql.org/docs/18/ddl-generated-columns.html), [F.35 pg_trgm](https://www.postgresql.org/docs/18/pgtrgm.html), [F.48 unaccent](https://www.postgresql.org/docs/18/unaccent.html)
- PostgreSQL source (REL_18_STABLE): [`contrib/unaccent/unaccent--1.1.sql`](https://github.com/postgres/postgres/blob/REL_18_STABLE/contrib/unaccent/unaccent--1.1.sql), [`contrib/unaccent/unaccent.rules`](https://github.com/postgres/postgres/blob/REL_18_STABLE/contrib/unaccent/unaccent.rules)
- [Snowball German stemmer](https://snowballstem.org/algorithms/german/stemmer.html)
- [Hibernate ORM 7 Query Language guide](https://docs.hibernate.org/orm/7.0/querylanguage/html_single/)
- Spring Data JPA: [Query methods](https://docs.spring.io/spring-data/jpa/reference/jpa/query-methods.html), [Query method details](https://docs.spring.io/spring-data/jpa/reference/repositories/query-methods-details.html)
- [Angular security guide](https://angular.dev/best-practices/security)
