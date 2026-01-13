# 1000 Applications (Chrome Extension)

Motivation system for job seekers: set an application goal (default `1000`), log every application fast, and watch progress/streaks build confidence.

## What’s Included (MVP)

- Popup: progress snapshot + quick add + “Log This Page”
- Dashboard: full list, search, filters, sorting, edit/delete
- Motivation: streaks, weekly summary, milestone celebrations
- Local-only storage: `chrome.storage.local`
- Backup: export/import JSON

## Install (Developer Mode)

1. Open Chrome → `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `extension/` folder in this repo

## Files

- `extension/manifest.json`: Manifest V3
- `extension/popup.html`, `extension/popup.js`: quick logging
- `extension/dashboard.html`, `extension/dashboard.js`: management + analytics
- `extension/background.js`: service worker, tab-title + URL capture
- `extension/lib/db.js`: storage + schema + computed stats

## Notes on “Gemini for frontend / Claude for backend”

This MVP is fully local/offline. Optional AI helpers are stubbed behind settings keys and can be wired to:

- Gemini: UX copy, form autofill suggestions
- Claude: data cleanup / dedupe assistant

See `extension/lib/ai.js`.

