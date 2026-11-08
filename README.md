# Mnemo

[![CI](https://github.com/PerretWilliam/mnemo/actions/workflows/ci.yml/badge.svg)](https://github.com/PerretWilliam/mnemo/actions/workflows/ci.yml)

**Mnemo** is an offline flashcard app, native Android (Kotlin + Jetpack Compose).
Write cards in **Markdown with LaTeX math**, make **cloze** (fill-in-the-blank) cards, study them
with **swipe gestures**, and let ChatGPT or Claude **generate whole decks** for you.

## Features

- **Decks and cards**: create, search, edit and delete; tags; live preview in the editor.
- **Markdown + KaTeX**: `$x^2$` inline and `$$\int_0^1 f$$` block math, rendered fully offline.
- **Cloze cards**: `A primitive of $\cos$ is {{c::$\sin$}}.` hides the part in braces.
- **Study sessions**: tap to flip, swipe **left = got it**, **right = missed**, ✓ / ✗ buttons,
  undo, haptic feedback, and an end-of-session recap with "review missed". Sessions draw a
  limited number of cards (10-100, set in Settings) from a deck or a whole folder, favoring cards
  you missed or never studied.
- **Import / export**: JSON files, paste from clipboard, share sheet; full backups include history.
  Import validates every card and lists errors by card number.
- **AI generator**: fill in topic, deck name, count, card types, language and optional notes;
  copy or share the prompt; paste the AI's answer back to import it.
- **Dashboard and history**: streak, success rate, last-7-days chart, past sessions.
- **Languages**: English, French, Spanish and German (follows the phone by default, switchable in
  Settings). AI-generated cards can be in 14 languages.

All data stays on the device (SQLite). No account, no network.

## Getting started

Requirements: JDK 17+, Android SDK (`ANDROID_HOME` set or `local.properties` with `sdk.dir`), `adb`.
Android Studio works too: open the folder and run the `app` configuration.

```bash
./gradlew testDebugUnitTest lintDebug   # tests + lint (what CI runs, plus a release build)
```

### Run on your Android phone over USB

1. On the phone: enable **Developer options** and **USB debugging**, plug it in, accept the prompt.
2. Check it is visible:
   ```bash
   adb devices
   ```
3. Build and install:
   ```bash
   ./gradlew installRelease   # optimized build
   ./gradlew installDebug     # debug build
   ```

### Build a standalone APK

```bash
./gradlew assembleRelease
adb install -r app/build/outputs/apk/release/app-release.apk
```

Every GitHub release also has the APK attached. Requires Android 8.0 (API 26) or newer.

> The release APK is signed with the default debug key, fine for personal sideloading.
> Publishing to the Play Store needs your own upload keystore.

## JSON format

```json
{
  "version": 1,
  "decks": [
    {
      "name": "Calculus — Chapter 2",
      "cards": [
        { "front": "Derivative of $\\ln x$?", "back": "$\\dfrac{1}{x}$ for $x>0$", "tags": ["derivatives"] },
        { "front": "A primitive of $\\cos$ is {{c::$\\sin$}}.", "back": "", "tags": [] }
      ]
    }
  ]
}
```

Full spec: [docs/FORMAT.md](docs/FORMAT.md).

## Project

- Contributor guide: [CONTRIBUTING.md](CONTRIBUTING.md)
- Conventions for humans and AI agents: [CLAUDE.md](CLAUDE.md)
- Changelog: [CHANGELOG.md](CHANGELOG.md) (generated on release)
