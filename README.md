# DutchDeck Studio v0.9.16

## What’s new

- Visible app version in Settings and the page footer.
- Automatic notification when a newer GitHub Pages build is ready.
- **Reload now** activates the new service worker and refreshes the app.
- Service-worker cache updated to `dutchdeck-studio-v0.9.16`.

# DutchDeck Studio — Knowledge Edition

An offline-first Dutch learning PWA with a spaced-repetition review system, rich dictionary entries, verb-family exploration, and a reading lab.

## What is new

- **Word families:** curated core families such as *stellen, nemen, houden, brengen, komen,* and *gaan*.
- **Rich entries:** collocations, related words, separability, grammar forms, usage notes, CEFR and frequency.
- **Family review mode:** study one morphological family at a time.
- **Reading lab:** paste Dutch text, tap words, hear pronunciation, and add unknown vocabulary.
- **Improved review:** new/weak/favorite/family modes, keyboard shortcuts, clearer scheduling, and session progress.
- **Better statistics:** 14-day activity and family mastery.
- **Safe migration:** existing cards and progress in browser storage are preserved; new built-in entries are merged by Dutch headword.

## Publish with GitHub Pages

Copy every file and the `icons` folder into the root of your existing GitHub repository, replacing the old app files. Commit and push. GitHub Pages will publish the update automatically.

Because this version has a new service-worker cache, an installed copy may need to be closed and reopened once after publishing. Safari users can also refresh the webpage before reopening the Home Screen app.

## Windows

1. Extract the ZIP.
2. Double-click `start-windows.bat`.
3. Keep the PowerShell window open while using the local app.

## Data

Cards, settings, favorites, reader text and review progress stay in browser local storage. Use **Settings → Export backup** before major changes or moving to another device.


## Learning Edition additions

- Guided family modules with a suggested high-frequency learning path
- Three exercise modes: meaning choice, sentence completion, and family identification
- Persistent quiz score and accuracy
- Module mastery, study counts, pronunciation, and one-tap dictionary details
- Exercises are generated automatically from every imported Core 3000 pack


## Imported family definitions
JSON decks may include a top-level `familyDefinitions` object (or legacy `familyInfo`). Definitions are merged into local storage and override built-in family descriptions. Backups include imported family definitions.
