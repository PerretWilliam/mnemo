package com.perretwilliam.flashcards.ui

import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.perretwilliam.flashcards.LocalTr
import com.perretwilliam.flashcards.R
import com.perretwilliam.flashcards.ui.screens.AiPromptScreen
import com.perretwilliam.flashcards.ui.screens.CardEditorScreen
import com.perretwilliam.flashcards.ui.screens.DeckScreen
import com.perretwilliam.flashcards.ui.screens.DecksScreen
import com.perretwilliam.flashcards.ui.screens.FolderScreen
import com.perretwilliam.flashcards.ui.screens.HistoryScreen
import com.perretwilliam.flashcards.ui.screens.HomeScreen
import com.perretwilliam.flashcards.ui.screens.SessionScreen
import com.perretwilliam.flashcards.ui.screens.SettingsScreen

private class Tab(val route: String, val label: Int, val icon: ImageVector)

private val TABS = listOf(
    Tab("home", R.string.tabs_home, Ic.home),
    Tab("decks", R.string.tabs_decks, Ic.cards),
    Tab("history", R.string.tabs_history, Ic.history),
    Tab("settings", R.string.tabs_settings, Ic.settings),
)

private val LongArg = { name: String -> navArgument(name) { type = NavType.LongType } }

@Composable
fun App() {
    val nav = rememberNavController()
    val theme = LocalTheme.current
    val tr = LocalTr.current
    val current = nav.currentBackStackEntryAsState().value?.destination?.route
    Scaffold(
        containerColor = theme.background,
        contentWindowInsets = WindowInsets(0, 0, 0, 0), // each screen handles its own insets
        bottomBar = {
            if (TABS.any { it.route == current }) {
                NavigationBar(containerColor = theme.surface) {
                    for (tab in TABS) {
                        NavigationBarItem(
                            selected = tab.route == current,
                            onClick = {
                                nav.navigate(tab.route) {
                                    popUpTo("home") { saveState = true }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            },
                            icon = { Icon(tab.icon, null) },
                            label = { T(tr(tab.label), variant = TextVariant.Label, maxLines = 1) },
                            colors = NavigationBarItemDefaults.colors(
                                selectedIconColor = theme.primary, selectedTextColor = theme.primary, indicatorColor = theme.primarySoft,
                                unselectedIconColor = theme.textSecondary, unselectedTextColor = theme.textSecondary,
                            ),
                        )
                    }
                }
            }
        },
    ) { inner ->
        NavHost(nav, startDestination = "home", modifier = Modifier.padding(inner)) {
            composable("home") { HomeScreen(nav) }
            composable("decks") { DecksScreen(nav) }
            composable("history") { HistoryScreen() }
            composable("settings") { SettingsScreen(nav) }
            composable("deck/{id}", listOf(LongArg("id"))) { DeckScreen(nav, it.arguments!!.getLong("id")) }
            // "new" creates a folder; the id is a string for that reason.
            composable("folder/{id}") { FolderScreen(nav, it.arguments!!.getString("id")!!) }
            composable("card/{id}/{deckId}", listOf(LongArg("id"), LongArg("deckId"))) {
                CardEditorScreen(nav, it.arguments!!.getLong("id"), it.arguments!!.getLong("deckId"))
            }
            composable("session/{kind}/{id}", listOf(LongArg("id"))) {
                SessionScreen(nav, it.arguments!!.getString("kind") == "folder", it.arguments!!.getLong("id"))
            }
            composable("ai") { AiPromptScreen(nav) }
        }
    }
    DialogHost()
}

fun NavHostController.openDeck(id: Long) = navigate("deck/$id")
fun NavHostController.openFolder(id: String) = navigate("folder/$id")
/** `cardId` -1 creates a card in the deck. */
fun NavHostController.openCard(cardId: Long, deckId: Long) = navigate("card/$cardId/$deckId")
fun NavHostController.study(deckId: Long) = navigate("session/deck/$deckId")
fun NavHostController.studyFolder(folderId: Long) = navigate("session/folder/$folderId")
