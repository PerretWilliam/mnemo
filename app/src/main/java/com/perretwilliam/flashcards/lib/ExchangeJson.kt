package com.perretwilliam.flashcards.lib

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

private val pretty = Json { prettyPrint = true; prettyPrintIndent = "  " }

/** The exchange format of docs/FORMAT.md, pretty-printed. */
fun ExchangeFile.toJson(): String = pretty.encodeToString(
    JsonObject.serializer(),
    buildJsonObject {
        put("version", 1)
        put("decks", buildJsonArray {
            for (d in decks) add(buildJsonObject {
                put("name", d.name)
                d.folder?.let { put("folder", it) }
                put("cards", buildJsonArray {
                    for (c in d.cards) add(buildJsonObject {
                        put("front", c.front)
                        put("back", c.back)
                        put("tags", JsonArray(c.tags.map(::JsonPrimitive)))
                    })
                })
            })
        })
        folders?.let { fs -> put("folders", buildJsonArray { for (f in fs) add(buildJsonObject { put("name", f.name); put("color", f.color) }) }) }
        history?.let { hs ->
            put("history", buildJsonArray {
                for (h in hs) add(buildJsonObject {
                    put("deck", h.deck); put("startedAt", h.startedAt); put("endedAt", h.endedAt)
                    put("correct", h.correct); put("wrong", h.wrong)
                })
            })
        }
    },
)
