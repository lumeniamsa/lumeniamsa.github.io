# Lumenia

A French-language static website for a knowledge-sharing platform — articles, formations, videos, and community.

## Project Structure

- `index.html` — Main homepage (static HTML, built with React/Vite and pre-built)
- `404.html` — Custom 404 page
- `articles/` — Individual article HTML pages
- `assets/` — Pre-built CSS and JS bundles
- `sitemap.xml`, `robots.txt` — SEO files

## How to Run

The site is served via Python's built-in HTTP server:

```
python3 -m http.server 5000 --bind 0.0.0.0
```

## Deployment

Configured as a **static** deployment with `publicDir: "."`.
