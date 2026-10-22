# CLAUDE.md

Guidance for AI agents and humans working on this repository.

## Project

**Mnemo**: an offline-first mobile flashcard app (Android first, iOS-ready).
Markdown + KaTeX math, cloze cards (`{{c::...}}`), swipe study sessions, JSON import/export,
and a prompt generator that lets ChatGPT/Claude produce decks in the app's JSON format.

Stack: Expo SDK 58 · Expo Router · TypeScript (strict) · expo-sqlite (no ORM) ·
react-native-webview + marked + KaTeX (inlined, offline) · gesture-handler v3 + reanimated 4.

## Language rules — everything in English

- **App UI text**: never hard-coded in screens. Every string is a key in `src/i18n/en.ts`
  (English is the source), translated in `fr.ts`, `es.ts`, `de.ts`. TypeScript fails if a
  language misses a key. Read them with `const { t, tp } = useI18n()`; plurals use
  `<key>_one` / `<key>_other` + `tp(key, count)`. Adding a language = one dictionary + one
  line in `LANGUAGES` (`src/i18n/index.tsx`).
- Pure code in `src/lib/` returns codes, not sentences (e.g. import `Issue` codes), so the UI
  can translate them. Card *content* is user data, not UI.
- **Code**: identifiers, file names, types, routes: English.
- **Comments and JSDoc**: English. Explain *why*, not *what*. Keep them short.
- **Commits, PR titles/descriptions, issues, docs, changelog**: English.

## Commands

```bash
npm install              # also runs postinstall: builds src/render/assets.generated.ts
npm start                # dev server (needs a dev build: native modules aren't all in Expo Go)
npm run android          # debug build + install on USB device/emulator
npm run android:release  # release build + install on USB device
npm run build:apk        # standalone release APK -> android/app/build/outputs/apk/release/
npm run check            # lint + typecheck + tests (what CI runs)
npx expo install <pkg>   # ALWAYS use this to add deps (SDK-compatible versions)
npx expo-doctor          # dependency/config sanity check
```

Run `npm run check` before declaring any task done.

## Layout

```
src/app/                 Expo Router routes ONLY (every file is a screen)
  (tabs)/                index (dashboard), decks, history, settings
  deck/[id].tsx          cards of a deck: search, edit, delete
  card/[id].tsx          editor + live preview (id = "new" to create; needs ?deckId=)
  session/[deckId].tsx   swipe study session + recap
  ai-prompt.tsx          AI prompt generator + clipboard import
src/components/          ui.tsx (themed primitives, Select dropdown), math-markdown.tsx (WebView renderer)
src/i18n/                dictionaries (en source, fr, es, de) + I18nProvider / useI18n
src/lib/                 PURE TypeScript, no React/Expo imports, unit-tested with node:test
src/db.ts                SQLite schema, migrations (PRAGMA user_version) and queries
src/transfer.ts          import/export flows (file picker, clipboard, share sheet)
scripts/                 build-webview-assets.mjs (postinstall), build-icons.mjs (logo -> icon/splash PNGs)
docs/FORMAT.md           JSON exchange format spec
```

## Conventions

- **Expo changes fast**: do not trust memory for Expo/RN APIs. Check the installed package's
  `.d.ts` or https://docs.expo.dev/versions/v58.0.0/ before using an API.
- `android/` and `ios/` are generated (`expo prebuild`) and git-ignored. Never edit them;
  configure native behaviour in `app.config.ts` or config plugins.
- **Version**: `package.json` is the single source of truth. `app.config.ts` derives
  `version` and Android `versionCode` from it. Never bump versions by hand: release-please does.
- **Pure logic goes in `src/lib/`** with tests in `src/lib/*.test.ts`. Imports between lib files
  use explicit `.ts` extensions (Node runs them natively). Keep lib free of React/Expo imports.
- **Database**: raw SQL with bound parameters (`?`), never string-interpolated user input.
  Schema changes: bump `SCHEMA_VERSION` in `src/db.ts` and add a migration step; never edit
  an existing step.
- **Rendering**: list rows show plain text (`stripCloze`); only displayed card faces and the
  editor preview use `<MathMarkdown>` (one WebView each). Don't add a WebView per list item.
- **Data refresh**: screens load with `useFocusData(useCallback(...))` so they refresh on focus.
- **Theme**: colors from `useTheme()` only (light + dark). Decks get a stable color with
  `deckColor(id)`; tinted backgrounds via `withAlpha()` or `<Surface tint>`.
- **Icons**: `<Icon name={Icons.x} />` / `<Button icon={Icons.x}>` with the catalog in
  `src/constants/icons.ts` (Material Symbols on Android, SF Symbols on iOS, bundled offline).
  Never use emojis or text characters (✓ ✗ ▾…) as icons.
- **Branding**: the logo is code in `scripts/build-icons.mjs`; edit it and run
  `node scripts/build-icons.mjs` to regenerate `assets/images/*`. Never edit the PNGs by hand.
- Keep dependencies minimal. Prefer Expo modules; justify any new library in the PR.
- No speculative abstractions. Small, readable files over clever ones.

## Domain rules

- JSON format: `docs/FORMAT.md`. Import validates each card and reports errors with
  deck name + card number instead of failing silently. Valid cards can still be imported.
- AI JSON often has single LaTeX backslashes: `parseExchange` repairs both invalid escapes
  (`\int`) and silently-valid ones (`\frac` -> form feed). Keep tests for this green.
- Session: **swipe left = correct, swipe right = missed**. Buttons mirror that order.
- Out of scope for now: spaced repetition, multi-device sync, images.

## Git workflow

- `main` is protected: changes land through pull requests with green CI.
- Branches: `feat/...`, `fix/...`, `chore/...`, `docs/...`.
- **Conventional Commits** for PR titles (squash merge): `feat: ...`, `fix: ...`, `chore: ...`,
  `docs: ...`, `refactor: ...`, `test: ...`, `ci: ...`. They drive versioning and the changelog.
