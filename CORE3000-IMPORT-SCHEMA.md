# DutchDeck Core 3000 import format

This app is ready for large, structured vocabulary packs. Import JSON is recommended because it preserves every rich field.

## Recommended JSON shape

```json
{
  "deckId": "core-pack-01",
  "deckName": "DutchDeck Core 3000 — Pack 1",
  "version": 1,
  "cards": [
    {
      "front": "vaststellen",
      "back": "to determine; to establish",
      "example": "De onderzoekers stelden vast dat de maatregel effect had.",
      "cefr": "B2",
      "type": "verb",
      "frequency": 5,
      "register": "formal",
      "forms": "stelt vast · stelde vast · heeft vastgesteld",
      "family": "stellen",
      "separable": true,
      "collocations": ["een feit vaststellen", "een diagnose vaststellen", "de oorzaak vaststellen"],
      "related": ["de vaststelling", "stellen", "bepalen"],
      "tags": ["core3000", "verb-family", "news", "pack-01"],
      "note": "Common in formal, professional and news Dutch."
    }
  ]
}
```

## Import behavior

In **Import → Duplicates**, choose:

- **Skip existing words** to add only new entries.
- **Update empty fields** to enrich existing cards without replacing your own content.
- **Replace content, keep progress** when installing a corrected pack. Review history, favorites and scheduling are retained.

Duplicate detection is based on the normalized Dutch headword. The importer supports JSON, CSV, TSV, plain text, pipes and em-dash-separated notes.

## Supported fields

`deckIds`, `front`, `back`, `example`, `cefr`, `type`, `frequency`, `register`, `forms`, `family`, `separable`, `collocations`, `related`, `tags`, and `note`.


## Deck behavior

Each imported card receives the top-level `deckId`. Duplicate words keep a union of all source deck IDs, so one word may belong to several decks while remaining in one linguistic family. The Dictionary and Review screens can filter by deck.
