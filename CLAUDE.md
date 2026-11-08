# CLAUDE.md

Guidance for AI agents and humans working on this repository.

## Project

**Mnemo**: an offline-first, native Android flashcard app.
Markdown + KaTeX math, cloze cards (`{{c::...}}`), swipe study sessions, JSON import/export,
and a prompt generator that lets ChatGPT/Claude produce decks in the app's JSON format.

Stack: Kotlin · Jetpack Compose (Material 3) · navigation-compose · raw `SQLiteOpenHelper` (no ORM) ·
WebView + marked + KaTeX (bundled in `assets/render`, offline) · kotlinx-serialization-json (parser only) ·
Gradle (Kotlin DSL, AGP built-in Kotlin). minSdk 26.

## Language rules — everything in English

- **App UI text**: never hard-coded in screens. Every string is a resource in
  `app/src/main/res/values/strings.xml` (English is the source), translated in `values-fr`,
  `values-es`, `values-de`. Read them with `val tr = LocalTr.current`: `tr(R.string.x, "name" to value)`;
  placeholders are `{name}` (not `%s`); plurals are `<plurals>` read with `tr.plural(R.plurals.x, count)`
  (`{count}` is filled automatically). Adding a language = one `values-xx/strings.xml`, one entry in
  `res/xml/locales_config.xml`, `androidResources.localeFilters` in `app/build.gradle.kts` and the language
  list in Settings. Lint fails on missing translations.
- Pure code in `lib/` returns codes, not sentences (e.g. import `IssueCode`), so the UI can
  translate them (`Transfer.kt` maps codes to strings). Card *content* is user data, not UI.
- **Code**: identifiers, file names, types, routes: English.
- **Comments and KDoc**: English. Explain *why*, not *what*. Keep them short.
- **Commits, PR titles/descriptions, issues, docs, changelog**: English.

## Commands

```bash
./gradlew testDebugUnitTest lintDebug assembleRelease   # what CI runs
./gradlew installDebug                                   # debug build on a USB device/emulator
./gradlew installRelease                                 # optimized build on a USB device
./gradlew assembleRelease                                # APK -> app/build/outputs/apk/release/app-release.apk
node scripts/build-icons.mjs                             # regenerate launcher/splash PNGs from the logo (needs rsvg-convert)
```

Run `./gradlew testDebugUnitTest lintDebug assembleRelease` before declaring any task done.
There is no emulator in CI: UI changes need a manual run on a device.

## Layout

```
app/src/main/java/com/perretwilliam/flashcards/
  MainActivity.kt        single activity (AppCompatActivity, for per-app languages)
  Translator.kt          string/plural lookup with {name} placeholders (LocalTr)
  Transfer.kt            import/export flows (clipboard, file, share sheet), IssueCode -> string
  data/Db.kt             SQLite schema, migrations, queries, import/export; data/Prefs.kt: session size
  lib/                   PURE Kotlin, no Android imports, unit-tested (app/src/test)
  ui/                    Theme, Components (themed primitives, Select, DetailScreen), Dialogs, MathMarkdown, App (nav + tabs)
  ui/screens/            Tabs.kt (home, decks, history, settings), Deck.kt (deck, folder, card editor), Session.kt, AiPrompt.kt
app/src/main/assets/render/   marked + KaTeX + render.js (offline)
scripts/build-icons.mjs  logo -> launcher/splash PNGs in res/drawable-nodpi
docs/FORMAT.md           JSON exchange format spec
version.txt              single source of truth for the version (bumped by release-please)
```

## Conventions

- **Version**: `version.txt` is the single source of truth. `app/build.gradle.kts` derives `versionName`
  and `versionCode` (`major*10000 + minor*100 + patch`) from it. Never bump versions by hand: release-please does.
- **Pure logic goes in `lib/`** with tests in `app/src/test/.../LibTest.kt`. Keep it free of Android imports.
- **Database**: raw SQL with bound parameters (`?`), never string-interpolated user input.
  Schema changes: bump `SCHEMA_VERSION` in `Db.kt` and add a migration step; never edit an existing step.
  The database file and application id are the same as the former Expo app, so updates keep user data.
  All `Db` functions block: call them through `io { }` or `rememberQuery { }`.
- **Rendering**: list rows show plain text (`stripCloze`); only displayed card faces and the editor
  preview use `MathMarkdown` (one WebView each). Don't add a WebView per list item. The WebView only
  loads bundled assets through `WebViewAssetLoader` with a CSP; card content must never be able to run script.
- **Data refresh**: screens load with `rememberQuery(keys) { ... }`; it re-runs after every `Db` write.
- **Theme**: colors from `LocalTheme.current` only (light + dark). Decks get a stable color with
  `theme.deckColor(deck.folderColor)` (a deck takes its folder's color, unfiled = primary);
  tinted backgrounds via `Color.alpha()` or `Surface(tint = ...)`. List rows have no colored side bar.
- **Icons**: `Ic.x` from `ui/Icons.kt` (Material icons, bundled). Never use emojis or text characters as icons.
- **Dialogs**: `ask`/`alert`/`confirm` in `ui/Dialogs.kt` are suspend functions (rendered by `DialogHost`).
  Run user actions with `scope.launchSafe(tr) { ... }` so failures are shown instead of crashing.
- **Branding**: the logo is code in `scripts/build-icons.mjs`; edit it and run the script to regenerate the PNGs
  in `res/drawable-nodpi`. Never edit those PNGs by hand.
- Keep dependencies minimal. Prefer AndroidX/Jetpack; justify any new library in the PR.
- No speculative abstractions. Small, readable files over clever ones.

## Domain rules

- JSON format: `docs/FORMAT.md`. Import validates each card and reports errors with
  deck name + card number instead of failing silently. Valid cards can still be imported.
- AI JSON often has single LaTeX backslashes: `parseExchange` repairs both invalid escapes
  (`\int`) and silently-valid ones (`\frac` -> form feed). Keep tests for this green.
- Session: **swipe left = correct, swipe right = missed**. Buttons mirror that order.
- A session is a random sample of N cards (Settings, 0 = all) from a deck or a whole folder.
  `drawCards` (`lib/Sampling.kt`) weights cards by their `card_stats` row: missed and
  never-seen cards are drawn more often than mastered ones. Stats are written when a session ends.
- Out of scope for now: spaced repetition, multi-device sync, images.

## Git workflow

- `main` is protected: changes land through pull requests with green CI.
- Branches: `feat/...`, `fix/...`, `chore/...`, `docs/...`.
- **Conventional Commits** for PR titles (squash merge): `feat: ...`, `fix: ...`, `chore: ...`,
  `docs: ...`, `refactor: ...`, `test: ...`, `ci: ...`. They drive versioning and the changelog.
