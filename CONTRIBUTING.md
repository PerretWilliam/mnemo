# Contributing

Thanks for helping! Read [CLAUDE.md](CLAUDE.md) first: it holds the project conventions
(everything in English, layout, database and rendering rules).

## Setup

```bash
git clone https://github.com/PerretWilliam/mnemo.git
cd mnemo
./gradlew installDebug   # debug build on a USB device or emulator (or run it from Android Studio)
```

## Workflow

1. Branch from `main`: `feat/short-name`, `fix/short-name`, `docs/...`, `chore/...`.
2. Keep changes focused. Add or update tests in `app/src/test/` for any pure logic.
3. Run `./gradlew testDebugUnitTest lintDebug assembleRelease`. CI runs the same.
4. Open a pull request. **The PR title must follow [Conventional Commits](https://www.conventionalcommits.org/)**,
   because PRs are squash-merged and the title becomes the commit on `main`:
   - `feat: add tag filter to deck screen` → minor version bump
   - `fix: keep cloze braces in preview` → patch bump
   - `feat!: change export format` (or a `BREAKING CHANGE:` footer) → major bump
   - `docs:`, `chore:`, `refactor:`, `test:`, `ci:`, `perf:`, `style:` → no release on their own
5. A green CI and a resolved conversation are required to merge. `main` cannot be pushed to directly.

## Releases

Fully automated with [release-please](https://github.com/googleapis/release-please):

- Every merge to `main` updates a **release PR** that bumps `version.txt` and writes `CHANGELOG.md`.
- Merging the release PR creates the `vX.Y.Z` tag and GitHub release; a workflow then builds the
  Android APK and attaches it to the release.
- The app version and Android `versionCode` are derived from `version.txt` in `app/build.gradle.kts`.

## Reporting bugs

Open an issue with the bug template: steps to reproduce, expected vs actual, device and app version
(shown at the bottom of Settings). For import problems, attach the JSON (without private content).
