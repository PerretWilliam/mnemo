package com.perretwilliam.flashcards.data

import android.content.Context
import com.perretwilliam.flashcards.lib.McqConfig
import com.perretwilliam.flashcards.lib.StudyMode

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

    /** Flashcards or multiple choice; the play buttons start whichever was used last. */
    var studyMode: StudyMode
        get() = prefs.getString("studyMode", null)?.let { m -> StudyMode.entries.find { it.name == m } } ?: StudyMode.CARDS
        set(value) = prefs.edit().putString("studyMode", value.name).apply()

    var mcq: McqConfig
        get() = McqConfig().let { d ->
            McqConfig(
                choices = prefs.getInt("mcqChoices", d.choices),
                generate = prefs.getBoolean("mcqGenerate", d.generate),
                shuffle = prefs.getBoolean("mcqShuffle", d.shuffle),
                instant = prefs.getBoolean("mcqInstant", d.instant),
                explain = prefs.getBoolean("mcqExplain", d.explain),
                autoNext = prefs.getBoolean("mcqAutoNext", d.autoNext),
                timerSec = prefs.getInt("mcqTimer", d.timerSec),
            )
        }
        set(v) = prefs.edit().putInt("mcqChoices", v.choices).putBoolean("mcqGenerate", v.generate).putBoolean("mcqShuffle", v.shuffle)
            .putBoolean("mcqInstant", v.instant).putBoolean("mcqExplain", v.explain).putBoolean("mcqAutoNext", v.autoNext)
            .putInt("mcqTimer", v.timerSec).apply()
}
