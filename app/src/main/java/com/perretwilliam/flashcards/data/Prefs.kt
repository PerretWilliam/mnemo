package com.perretwilliam.flashcards.data

import android.content.Context

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
}
