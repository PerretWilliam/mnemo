# Mnemo

[![CI](https://github.com/PerretWilliam/flashcard/actions/workflows/ci.yml/badge.svg)](https://github.com/PerretWilliam/flashcard/actions/workflows/ci.yml)

**Mnemo** is an offline flashcard app for Android (iOS-ready) built with Expo and React Native.
Write cards in **Markdown with LaTeX math**, make **cloze** (fill-in-the-blank) cards, study them
with **swipe gestures**, and let ChatGPT or Claude **generate whole decks** for you.

## Features

- **Decks and cards**: create, search, edit and delete; tags; live preview in the editor.
- **Markdown + KaTeX**: `$x^2$` inline and `$$\int_0^1 f$$` block math, rendered fully offline.
- **Cloze cards**: `A primitive of $\cos$ is {{c::$\sin$}}.` hides the part in braces.
- **Study sessions**: tap to flip, swipe **left = got it**, **right = missed**, ✓ / ✗ buttons,
  undo, haptic feedback, and an end-of-session recap with "review missed".
- **Import / export**: JSON files, paste from clipboard, share sheet; full backups include history.
  Import validates every card and lists errors by card number.
- **AI generator**: fill in topic, deck name, count, card types, language and optional notes;
  copy or share the prompt; paste the AI's answer back to import it.
- **Dashboard and history**: streak, success rate, last-7-days chart, past sessions.
- **Languages**: English, French, Spanish and German (follows the phone by default, switchable in
  Settings). AI-generated cards can be in 14 languages.

All data stays on the device (SQLite). No account, no network.

## Getting started

Requirements: Node ≥ 22.18, JDK 17, Android SDK (`ANDROID_HOME` set), `adb`.

```bash
npm install
npm run check   # lint + typecheck + tests
```

### Run on your Android phone over USB

1. On the phone: enable **Developer options** and **USB debugging**, plug it in, accept the prompt.
2. Check it is visible:
   ```bash
   adb devices
   ```
3. Build and install a release build (no dev server needed afterwards):
   ```bash
   npm run android:release
   ```

For development with hot reload use `npm run android` (debug build) and keep `npm start` running.

### Build a standalone APK

```bash
npm run build:apk
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

Every GitHub release also has the APK attached.

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
