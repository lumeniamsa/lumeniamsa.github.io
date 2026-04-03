# Lumenia

A French-language static website for a knowledge-sharing platform — articles, formations, videos, and community posts.

## Tech Stack

- **Frontend**: Pure HTML5, CSS3, Vanilla JavaScript
- **Server**: Node.js (built-in `http` module) — `server.js`
- **Build**: Custom Node.js script — `lumenia-build.js` (generates `data.json` indexes from HTML metadata)

## Project Structure

- `index.html` — Main homepage
- `404.html` — Custom 404 page
- `server.js` — Dev/production server (port 5000, binds to 0.0.0.0)
- `lumenia-build.js` — Scans content folders and generates `data.json` index files
- `listing.js` — Client-side GitHub API integration for GitHub Pages hosting
- `articles/` — Article HTML pages + `data.json` index
- `formations/` — Formation HTML pages + `data.json` index
- `videos/` — Video content + `data.json` index
- `communaute/` — Community posts + `data.json` index
- `a-propos/` — About page
- `contact/` — Contact page
- `attached_assets/` — Media and documents
- `sitemap.xml`, `robots.txt` — SEO files

## How to Run

The site is served via the Node.js server:

```
node server.js
```

Runs on port 5000, binding to `0.0.0.0`. Auto-watches content folders and rebuilds `data.json` indexes on file changes.

## Deployment

Configured as an **autoscale** deployment running `node server.js`.
