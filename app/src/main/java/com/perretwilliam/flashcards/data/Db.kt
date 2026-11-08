// SQLite storage: 4 tables (folders, decks, cards, sessions) + card_stats, no ORM.
// All functions block: call them from Dispatchers.IO (see `rememberQuery` and `io`).
package com.perretwilliam.flashcards.data

import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import com.perretwilliam.flashcards.lib.CardInput
import com.perretwilliam.flashcards.lib.CardStat
import com.perretwilliam.flashcards.lib.DeckInput
import com.perretwilliam.flashcards.lib.ExchangeFile
import com.perretwilliam.flashcards.lib.FolderInput
import com.perretwilliam.flashcards.lib.HistoryInput
import com.perretwilliam.flashcards.lib.SessionLike
import com.perretwilliam.flashcards.lib.formatIsoMillis
import com.perretwilliam.flashcards.lib.nextFolderColor
import com.perretwilliam.flashcards.lib.parseIsoMillis
import java.io.File
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonPrimitive

data class Folder(val id: Long, val name: String, val color: String, val createdAt: Long, val deckCount: Int, val cardCount: Int)

data class Deck(
    val id: Long,
    val name: String,
    val createdAt: Long,
    val cardCount: Int,
    val folderId: Long?,
    /** Color of the deck's folder; null when unfiled. Resolve it with `Theme.deckColor()`. */
    val folderColor: String?,
)

data class Card(val id: Long, val deckId: Long, val front: String, val back: String, val tags: List<String>, val updatedAt: Long)

data class Session(
    val id: Long,
    val deckId: Long,
    val deckName: String,
    val folderColor: String?,
    val startedAt: Long,
    override val endedAt: Long,
    override val correct: Int,
    override val wrong: Int,
) : SessionLike

/** How to handle an imported deck whose name already exists. */
enum class ConflictChoice { MERGE, NEW, SKIP }

data class ImportResult(val decks: Int, val cards: Int)

/** Bump on schema changes and add a step to `migrate`; never edit an existing step. */
private const val SCHEMA_VERSION = 3

private fun migrate(db: SQLiteDatabase, from: Int) {
    if (from < 1) {
        db.execSQL("CREATE TABLE decks (id INTEGER PRIMARY KEY NOT NULL, name TEXT NOT NULL, created_at INTEGER NOT NULL)")
        db.execSQL(
            """CREATE TABLE cards (
                id INTEGER PRIMARY KEY NOT NULL,
                deck_id INTEGER NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
                front TEXT NOT NULL,
                back TEXT NOT NULL DEFAULT '',
                tags TEXT NOT NULL DEFAULT '[]',
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )""",
        )
        db.execSQL("CREATE INDEX cards_deck ON cards(deck_id)")
        db.execSQL(
            """CREATE TABLE sessions (
                id INTEGER PRIMARY KEY NOT NULL,
                deck_id INTEGER NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
                started_at INTEGER NOT NULL,
                ended_at INTEGER NOT NULL,
                correct INTEGER NOT NULL,
                wrong INTEGER NOT NULL
            )""",
        )
        db.execSQL("CREATE INDEX sessions_ended ON sessions(ended_at)")
    }
    if (from < 2) {
        // Deleting a folder unfiles its decks (SET NULL) instead of deleting them.
        db.execSQL("CREATE TABLE folders (id INTEGER PRIMARY KEY NOT NULL, name TEXT NOT NULL, color TEXT NOT NULL, created_at INTEGER NOT NULL)")
        db.execSQL("ALTER TABLE decks ADD COLUMN folder_id INTEGER REFERENCES folders(id) ON DELETE SET NULL")
        db.execSQL("CREATE INDEX decks_folder ON decks(folder_id)")
    }
    if (from < 3) {
        // Per-card answer stats, used to draw missed / never-seen cards more often.
        db.execSQL(
            """CREATE TABLE card_stats (
                card_id INTEGER PRIMARY KEY NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
                seen INTEGER NOT NULL,
                streak INTEGER NOT NULL,
                last_at INTEGER NOT NULL
            )""",
        )
    }
}

private class Helper(context: Context) : SQLiteOpenHelper(
    context,
    // Same file as the former Expo app (expo-sqlite), so updating keeps the user's decks.
    File(context.filesDir, "SQLite").also { it.mkdirs() }.resolve("flashcards.db").path,
    null,
    SCHEMA_VERSION,
) {
    override fun onConfigure(db: SQLiteDatabase) {
        db.setForeignKeyConstraintsEnabled(true)
        db.enableWriteAheadLogging()
    }

    override fun onCreate(db: SQLiteDatabase) = migrate(db, 0)
    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) = migrate(db, oldVersion)
}

object Db {
    private lateinit var helper: Helper
    private val db get() = helper.writableDatabase

    /** Bumped by every write; screens re-run their queries when it changes. */
    val version = MutableStateFlow(0)

    fun init(context: Context) {
        if (!::helper.isInitialized) helper = Helper(context.applicationContext)
    }

    private fun <T> write(block: () -> T): T = block().also { version.update { it + 1 } }

    private fun <T> transaction(block: () -> T): T {
        db.beginTransaction()
        try {
            return block().also { db.setTransactionSuccessful() }
        } finally {
            db.endTransaction()
        }
    }

    private fun <T> query(sql: String, vararg args: Any?, row: (Cursor) -> T): List<T> =
        db.rawQuery(sql, args.map { it.toString() }.toTypedArray()).use { c ->
            buildList { while (c.moveToNext()) add(row(c)) }
        }

    private fun exec(sql: String, vararg args: Any?) = db.execSQL(sql, args)

    private fun insert(table: String, vararg values: Pair<String, Any?>): Long =
        db.insertOrThrow(
            table,
            null,
            ContentValues().apply {
                for ((k, v) in values) when (v) {
                    null -> putNull(k)
                    is Long -> put(k, v)
                    is Int -> put(k, v)
                    else -> put(k, v.toString())
                }
            },
        )

    // --- Folders ---

    private const val FOLDER_SELECT = """
        SELECT f.id, f.name, f.color, f.created_at,
          (SELECT COUNT(*) FROM decks WHERE folder_id = f.id),
          (SELECT COUNT(*) FROM cards WHERE deck_id IN (SELECT id FROM decks WHERE folder_id = f.id))
        FROM folders f"""

    private fun folder(c: Cursor) = Folder(c.getLong(0), c.getString(1), c.getString(2), c.getLong(3), c.getInt(4), c.getInt(5))

    fun listFolders() = query("$FOLDER_SELECT ORDER BY f.name COLLATE NOCASE", row = ::folder)

    fun getFolder(id: Long) = query("$FOLDER_SELECT WHERE f.id = ?", id, row = ::folder).firstOrNull()

    fun createFolder(name: String, color: String) = write { insert("folders", "name" to name.trim(), "color" to color, "created_at" to now()) }

    fun updateFolder(id: Long, name: String, color: String) =
        write { exec("UPDATE folders SET name = ?, color = ? WHERE id = ?", name.trim(), color, id) }

    /** Decks of the folder are kept and become unfiled. */
    fun deleteFolder(id: Long) = write {
        transaction {
            exec("UPDATE decks SET folder_id = NULL WHERE folder_id = ?", id)
            exec("DELETE FROM folders WHERE id = ?", id)
        }
    }

    fun setDeckFolder(deckId: Long, folderId: Long?) = write { exec("UPDATE decks SET folder_id = ? WHERE id = ?", folderId, deckId) }

    // --- Decks ---

    private fun deck(c: Cursor) =
        Deck(c.getLong(0), c.getString(1), c.getLong(2), c.getInt(3), if (c.isNull(4)) null else c.getLong(4), c.getStringOrNull(5))

    private fun Cursor.getStringOrNull(i: Int) = if (isNull(i)) null else getString(i)

    fun listDecks() = query(
        """SELECT d.id, d.name, d.created_at, COUNT(c.id), d.folder_id, f.color
           FROM decks d
           LEFT JOIN cards c ON c.deck_id = d.id
           LEFT JOIN folders f ON f.id = d.folder_id
           GROUP BY d.id ORDER BY d.name COLLATE NOCASE""",
        row = ::deck,
    )

    fun getDeck(id: Long) = query(
        """SELECT d.id, d.name, d.created_at, (SELECT COUNT(*) FROM cards WHERE deck_id = d.id), d.folder_id, f.color
           FROM decks d LEFT JOIN folders f ON f.id = d.folder_id WHERE d.id = ?""",
        id,
        row = ::deck,
    ).firstOrNull()

    fun createDeck(name: String, folderId: Long? = null) =
        write { insert("decks", "name" to name.trim(), "created_at" to now(), "folder_id" to folderId) }

    fun renameDeck(id: Long, name: String) = write { exec("UPDATE decks SET name = ? WHERE id = ?", name.trim(), id) }

    fun deleteDeck(id: Long) = write { exec("DELETE FROM decks WHERE id = ?", id) }

    // --- Cards ---

    private const val CARD_COLS = "id, deck_id, front, back, tags, updated_at"

    private fun card(c: Cursor) = Card(
        c.getLong(0), c.getLong(1), c.getString(2), c.getString(3),
        Json.parseToJsonElement(c.getString(4)).jsonArray.map { it.jsonPrimitive.content }, c.getLong(5),
    )

    private fun tagsJson(tags: List<String>) = JsonArray(tags.map(::JsonPrimitive)).toString()

    fun listCards(deckId: Long) = query("SELECT $CARD_COLS FROM cards WHERE deck_id = ? ORDER BY id", deckId, row = ::card)

    /** Cards of every deck in a folder, for studying a whole folder at once. */
    fun listFolderCards(folderId: Long) = query(
        "SELECT $CARD_COLS FROM cards WHERE deck_id IN (SELECT id FROM decks WHERE folder_id = ?) ORDER BY id",
        folderId,
        row = ::card,
    )

    fun getCard(id: Long) = query("SELECT $CARD_COLS FROM cards WHERE id = ?", id, row = ::card).firstOrNull()

    fun createCard(deckId: Long, c: CardInput) = write { insertCard(deckId, c) }

    private fun insertCard(deckId: Long, c: CardInput) {
        val t = now()
        insert("cards", "deck_id" to deckId, "front" to c.front, "back" to c.back, "tags" to tagsJson(c.tags), "created_at" to t, "updated_at" to t)
    }

    fun updateCard(id: Long, c: CardInput) =
        write { exec("UPDATE cards SET front = ?, back = ?, tags = ?, updated_at = ? WHERE id = ?", c.front, c.back, tagsJson(c.tags), now(), id) }

    fun deleteCard(id: Long) = write { exec("DELETE FROM cards WHERE id = ?", id) }

    // --- Sessions ---

    fun getCardStats(): Map<Long, CardStat> =
        query("SELECT card_id, seen, streak FROM card_stats") { it.getLong(0) to CardStat(it.getInt(1), it.getInt(2)) }.toMap()

    /** Updates the stats of the answered cards (one write transaction): a miss resets the streak. */
    fun recordAnswers(answers: List<Pair<Long, Boolean>>) = write {
        val t = now()
        transaction {
            // UPDATE then INSERT instead of an upsert: SQLite on Android < 11 is too old for ON CONFLICT DO UPDATE.
            for ((cardId, correct) in answers) {
                val updated = db.compileStatement(
                    "UPDATE card_stats SET seen = seen + 1, streak = CASE WHEN ? > 0 THEN streak + 1 ELSE 0 END, last_at = ? WHERE card_id = ?",
                ).use {
                    it.bindLong(1, if (correct) 1 else 0)
                    it.bindLong(2, t)
                    it.bindLong(3, cardId)
                    it.executeUpdateDelete()
                }
                if (updated == 0) insert("card_stats", "card_id" to cardId, "seen" to 1, "streak" to if (correct) 1 else 0, "last_at" to t)
            }
        }
    }

    fun saveSession(deckId: Long, startedAt: Long, endedAt: Long, correct: Int, wrong: Int) = write {
        insert("sessions", "deck_id" to deckId, "started_at" to startedAt, "ended_at" to endedAt, "correct" to correct, "wrong" to wrong)
    }

    /** Most recent first; a negative `limit` returns everything. */
    fun listSessions(limit: Int = 500) = query(
        """SELECT s.id, s.deck_id, d.name, f.color, s.started_at, s.ended_at, s.correct, s.wrong
           FROM sessions s JOIN decks d ON d.id = s.deck_id LEFT JOIN folders f ON f.id = d.folder_id
           ORDER BY s.ended_at DESC LIMIT $limit""",
    ) { Session(it.getLong(0), it.getLong(1), it.getString(2), it.getStringOrNull(3), it.getLong(4), it.getLong(5), it.getInt(6), it.getInt(7)) }

    // --- Import / export ---

    suspend fun importExchange(data: ExchangeFile, resolve: suspend (deckName: String) -> ConflictChoice): ImportResult {
        // Ask about conflicts before writing anything, so the import stays one transaction.
        val existing = withContext(Dispatchers.IO) { listDecks().associate { it.name.lowercase() to it.id } }
        val plan = mutableListOf<Pair<DeckInput, Long?>>() // deck + the existing deck to merge into
        for (deck in data.decks) {
            val id = existing[deck.name.lowercase()]
            if (id == null) plan += deck to null
            else when (resolve(deck.name)) {
                ConflictChoice.SKIP -> continue
                ConflictChoice.MERGE -> plan += deck to id
                ConflictChoice.NEW -> plan += deck to null
            }
        }
        return withContext(Dispatchers.IO) { write { transaction { importPlan(data, plan, existing) } } }
    }

    private fun importPlan(data: ExchangeFile, plan: List<Pair<DeckInput, Long?>>, existing: Map<String, Long>): ImportResult {
        // Folders are matched by name (case-insensitive) and created on demand. An existing folder keeps its color.
        val folders = listFolders()
        val folderIds = folders.associate { it.name.lowercase() to it.id }.toMutableMap()
        val colors = folders.map { it.color }.toMutableList()
        fun ensureFolder(name: String): Long = folderIds.getOrPut(name.lowercase()) {
            val color = data.folders?.find { it.name.lowercase() == name.lowercase() }?.color ?: nextFolderColor(colors)
            colors += color
            insert("folders", "name" to name.trim(), "color" to color, "created_at" to now())
        }
        data.folders?.forEach { ensureFolder(it.name) }

        var cards = 0
        val idsByName = mutableMapOf<String, Long>()
        for ((deck, targetId) in plan) {
            val folderId = if (targetId == null && deck.folder != null) ensureFolder(deck.folder) else null
            val deckId = targetId ?: insert("decks", "name" to deck.name.trim(), "created_at" to now(), "folder_id" to folderId)
            idsByName[deck.name.lowercase()] = deckId
            deck.cards.forEach { insertCard(deckId, it) }
            cards += deck.cards.size
        }
        for (h in data.history.orEmpty()) {
            val deckId = idsByName[h.deck.lowercase()] ?: existing[h.deck.lowercase()] ?: continue
            insert(
                "sessions", "deck_id" to deckId, "started_at" to parseIsoMillis(h.startedAt)!!,
                "ended_at" to parseIsoMillis(h.endedAt)!!, "correct" to h.correct, "wrong" to h.wrong,
            )
        }
        return ImportResult(plan.size, cards)
    }

    fun exportExchange(withHistory: Boolean): ExchangeFile {
        val folders = listFolders()
        val folderNames = folders.associate { it.id to it.name }
        return ExchangeFile(
            decks = listDecks().map { d ->
                DeckInput(d.name, d.folderId?.let(folderNames::get), listCards(d.id).map { CardInput(it.front, it.back, it.tags) })
            },
            folders = folders.takeIf { it.isNotEmpty() }?.map { FolderInput(it.name, it.color) },
            history = if (withHistory) {
                listSessions(-1).map { HistoryInput(it.deckName, formatIsoMillis(it.startedAt), formatIsoMillis(it.endedAt), it.correct, it.wrong) }
            } else null,
        )
    }

    fun wipeAll() = write {
        for (t in listOf("sessions", "card_stats", "cards", "decks", "folders")) exec("DELETE FROM $t")
    }

    private fun now() = System.currentTimeMillis()
}

/** Runs a blocking database call off the main thread. */
suspend fun <T> io(block: () -> T): T = withContext(Dispatchers.IO) { block() }
