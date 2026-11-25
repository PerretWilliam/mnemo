package com.perretwilliam.flashcards.data

import android.content.Context
import com.perretwilliam.flashcards.lib.McqConfig

/** Study settings. */
object Prefs {
    /** Options for "cards per session"; 0 means every card. */
    val SESSION_SIZES = listOf(10, 20, 30, 40, 50, 100, 0)
    private const val DEFAULT_SESSION_SIZE = 20

    private lateinit var context: Context
    private val prefs get() = context.getSharedPreferences("settings", Context.MODE_PRIVATE)

    fun init(context: Context) {
        this.context = context.applicationContext
    }

    var sessionSize: Int
        get() = prefs.getInt("sessionSize", DEFAULT_SESSION_SIZE).takeIf { it in SESSION_SIZES } ?: DEFAULT_SESSION_SIZE
        set(value) = prefs.edit().putInt("sessionSize", value).apply()

    var mcq: McqConfig
        get() = McqConfig().let { d ->
            McqConfig(
                shuffle = prefs.getBoolean("mcqShuffle", d.shuffle),
                instant = prefs.getBoolean("mcqInstant", d.instant),
                explain = prefs.getBoolean("mcqExplain", d.explain),
                autoNext = prefs.getBoolean("mcqAutoNext", d.autoNext),
                timerSec = prefs.getInt("mcqTimer", d.timerSec),
            )
        }
        set(v) = prefs.edit().putBoolean("mcqShuffle", v.shuffle)
            .putBoolean("mcqInstant", v.instant).putBoolean("mcqExplain", v.explain).putBoolean("mcqAutoNext", v.autoNext)
            .putInt("mcqTimer", v.timerSec).apply()
}
