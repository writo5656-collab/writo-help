# Nihongo — Personal Japanese Academy

A personal Android app for learning Japanese properly: a JLPT track and a real-life track, a notebook you type Japanese into, spaced review, a Mistake Notebook, a flexible Sunday review and speaking practice. No hearts, locks, waiting or penalties.

## Install it on your phone

1. On GitHub, open this repository → **Actions** → **Nihongo APK** → the latest green run.
2. Under **Artifacts**, download **nihongo-apk** and unzip it. Inside is `nihongo.apk`.
3. Open `nihongo.apk` on your Android phone and allow "install from this source" when asked.

Before first use, add a Japanese keyboard: **Settings → System → Keyboard → Gboard → Languages → Add → Japanese**.
For audio, the phone needs a Japanese voice: **Settings → System → Languages → Text-to-speech output** (Google's engine includes Japanese).

Later versions install over the old one and keep your data. **Uninstalling deletes your data**, so use **Settings → Save a backup file** now and then.

## Run it on a computer (optional)

Needs [Node.js](https://nodejs.org) 20 or newer.

```bash
cd nihongo
npm install
npm run dev      # then open the address it prints, e.g. http://localhost:5173
npm test         # checks the learning engine and every lesson's content
```

## How the project is organised

| Folder | What it holds |
|---|---|
| `src/content/` | **All lesson content** — kana, kanji, JLPT lessons, practical lessons, readings, roleplays. Plain data; edit here to add lessons. |
| `src/lib/` | The learning engine: Japanese text handling, answer checking, spaced repetition, daily plan, database, backup. |
| `src/services/` | Replaceable integrations: speech (TTS), speech recognition, kanji readings, reminders, AI tutor. |
| `src/components/` | Shared UI: notebook paper, exercise runner, buttons, icons, mascot. |
| `src/screens/` | One file per screen. |
| `src/styles/app.css` | The design system (colours, type, cards, paper). |
| `android/` | The Android wrapper (Capacitor). Rarely needs touching. |
| `server/` | The AI tutor proxy. See `server/README.md`. |

### Adding a lesson

Open `src/content/jlpt.ts` (or `practical.ts`) and copy an existing lesson. Sentences use a compact notation:

```
私[わたし]は 水[みず]{を} 飲[の]みます。
```

- `漢字[かな]` gives the reading (furigana).
- Spaces split the sentence into chunks (for word-by-word audio and sentence building).
- `{を}` marks a particle to blank out in fill-in exercises.
- `alt: [...]` lists other answers that must also be accepted.

Run `npm test` afterwards: it checks every sentence has a clean reading and accepts its own answers.

## Data and credits

- **JLPT vocabulary (N5–N1, 8,034 words):** [open-anki-jlpt-decks](https://github.com/jamsinclair/open-anki-jlpt-decks) (MIT), from Jonathan Waller's JLPT lists; meanings from JMdict © EDRDG, CC BY-SA 4.0.
- **Kanji (N5–N1, 2,211):** [kanji-data](https://github.com/davidluzgouveia/kanji-data) (MIT), KANJIDIC fields only, © EDRDG, CC BY-SA 4.0.
- **Stroke order:** [KanjiVG](https://kanjivg.tagaini.net) © Ulrich Apel, CC BY-SA 3.0.
- **Anime characters:** names only, used as a personal study aid. No official artwork, dialogue or manga pages are included; all lines and story pages are original.

Rebuild the data with `node scripts/build-library.mjs` and `node scripts/fetch-strokes.mjs "$(cat src/content/library/kanji-chars.txt)"`.

## What is and is not finished

Working: onboarding and placement check, kana (hiragana and katakana), 104 N5 kanji, 14 N5 lessons, 3 N4 starter lessons, 9 practical lessons with scenes and dialogues, vocabulary packs, reading passages, all exercise types, notebook typing with romaji option and reading line, free notes, spaced repetition, Mistake Notebook, Sunday review with report, progress dashboard, offline roleplays, backup/restore, reminders.

Not finished — labelled inside the app too:

- **N3, N2, N1 lessons are not written**, and N4 lessons are only started. Every N4–N1 word and kanji is in the Library with practice and review.
- **AI tutor** needs you to deploy the proxy in `server/` with your own API key. The proxy has not been tested against a live key.
- **Handwriting** traces a stroke-order guide and counts strokes, but cannot judge stroke shape.
- **Scenes and manga pages** are drawn by the app (signs, panels, speech bubbles). There are no photographs or real manga pages.
- **Speech**: pronunciation is checked only by whether the phone's recogniser understood you. It is not a pronunciation score.
- Content was written for this app and should be spot-checked by a fluent speaker over time.
