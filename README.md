# Morsel (working name; repo: bitesize)

One screen, one thing worth knowing. A mobile-first web app: swipe up through short knowledge cards from history, science, business, nature, space and language. Each card fits a phone screen without scrolling.

- No accounts, no cookies, no server data. Seen cards and saved cards live in the browser's local storage only.
- Content is a fixed deck in `content/*.tsv` (title, body, hook; tab-separated). `npm run content` rebuilds `src/data/cards.json`. Card ids come from line order, so **append new cards at the end of a file**; inserting or deleting rows shifts ids and scrambles people's saved cards.
- Optional `VITE_FEEDBACK_EMAIL` adds a "report a mistake" mail link on each card; unset, the link is hidden.

```
npm ci
npm run dev      # local
npm test         # vitest: feed logic + deck length limits
npm run build    # static site in dist/ (Vercel picks this up as a Vite project)
```

CI (`.github/workflows/ci.yml`): tests and build, plus the PR checks copied from brain-workbench (credential scan of added lines, rule 11 grep via the `RULE11_PATTERN` secret).
