# Web-map-test

A simple web application for visualizing WFS (Web Feature Service) map data using [OpenLayers](https://openlayers.org/) and [Vite](https://vite.dev/).

The app fetches population grid data from [Statistics Finland's WFS API](https://geo.stat.fi/geoserver/vaestoruutu/wfs) and displays it on an interactive map.

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

## Scripts

| Command           | Description                     |
| ----------------- | ------------------------------- |
| `npm run dev`     | Start Vite dev server           |
| `npm run build`   | Production build to `dist/`     |
| `npm run preview` | Preview production build        |
| `npm run lint`    | Run ESLint                      |

## Tech stack

- **Vite** — dev server and bundler
- **OpenLayers** — map rendering and WFS support
- **ESLint** — linting
