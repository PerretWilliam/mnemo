package com.perretwilliam.flashcards

import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.compose.runtime.CompositionLocalProvider
import com.perretwilliam.flashcards.data.Db
import com.perretwilliam.flashcards.data.Prefs
import com.perretwilliam.flashcards.ui.App
import com.perretwilliam.flashcards.ui.MnemoTheme

// AppCompatActivity (not ComponentActivity) so AppCompatDelegate.setApplicationLocales works on every API level.
class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        Db.init(this)
        Prefs.init(this)
        setContent {
            MnemoTheme {
                CompositionLocalProvider(LocalTr provides rememberTranslator()) { App() }
            }
        }
    }
}
