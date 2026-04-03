# Lumenia

A French-language knowledge-sharing platform serving articles, training courses (formations), videos, and community posts.

## Tech Stack

- **Runtime**: Node.js 20 (built-in `http`, `fs`, `path`, `child_process` modules — no external npm dependencies)
- **Frontend**: Vanilla HTML5, CSS3, and JavaScript (no framework)
- **Data storage**: Flat-file JSON (`data/interactions.json`) for likes and comments
- **Build system**: Custom `lumenia-build.js` script that scans content folders and generates `data.json` index files

## Project Layout

- `server.js` — Main Node.js HTTP server (static files + REST API)
- `lumenia-build.js` — Build script that indexes content into `data.json` files
- `index.html` — Homepage
- `404.html` — Custom error page
- `viewer.html` — Content viewer template
- `listing.js` — Client-side content listing logic
- `articles/`, `formations/`, `videos/`, `communaute/` — Content directories (each with a generated `data.json`)
- `css/lumenia.css` — Site-wide styles
- `js/lumenia.js`, `js/interactions.js` — Client-side scripts
- `data/interactions.json` — Likes and comments database
- `attached_assets/` — Media files

## Running the App

The server runs on **port 5000** via:

```
node server.js
```

The server:
- Serves all static files from the project root
- Provides a REST API at `/api/` for likes, comments, and community post creation
- Auto-watches content folders and rebuilds `data.json` indexes on file changes

## Deployment

- Deployment target: `autoscale`
- Run command: `node server.js`
