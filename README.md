# Morsel (working name; repo: bitesize)

One screen, one thing worth knowing. A mobile-first web app: swipe up through short knowledge cards from history, science, business, nature, space and language. Each card fits a phone screen without scrolling.

- No accounts, no cookies, no server data. Seen cards and saved cards live in the browser's local storage only.
- Content is a fixed deck in `content/*.tsv` (title, body, hook; tab-separated). `npm run content` rebuilds `src/data/cards.json`. Card ids come from line order, so **append new cards at the end of a file**; inserting or deleting rows shifts ids and scrambles people's saved cards.
- Each card has a "report a mistake" mail link to hello@strateriq.com (override with `VITE_FEEDBACK_EMAIL`). Support page: `/support.html`; privacy: `/privacy.html`.

```
npm ci
npm run dev      # local
npm test         # vitest: feed logic + deck length limits
npm run build    # static site in dist/ (Vercel picks this up as a Vite project)
```

CI (`.github/workflows/ci.yml`): tests and build, plus the PR checks copied from brain-workbench (credential scan of added lines, rule 11 grep via the `RULE11_PATTERN` secret).

## iPhone app (Capacitor)

`ios/` is a Capacitor wrapper around the same build; the cards ship inside the app, so it works offline. Native extras (haptics on swipe, native share sheet, opt-in 8am "card of the day" reminder scheduled on the phone) live in `src/native.ts` and are no-ops on the web.

```
npm run build && npx cap sync ios
npx cap open ios   # on a Mac with Xcode: set the signing team, then Product → Archive → Distribute
```

Privacy policy for the App Store listing: `/privacy.html` on the site.
