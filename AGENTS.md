# AGENTS.md

## Cursor Cloud specific instructions

This is a vanilla JavaScript + Vite project that visualizes WFS map data using OpenLayers. No backend services are required — the app fetches WFS data directly from Statistics Finland's public API.

### Services

| Service         | Command        | Port | Notes                                       |
| --------------- | -------------- | ---- | ------------------------------------------- |
| Vite dev server | `npm run dev`  | 5173 | Serves the app with hot module replacement  |

### Key commands

See `package.json` scripts — `npm run dev`, `npm run build`, `npm run lint`. All are standard Vite/ESLint commands.

### Testing

- **Do NOT create screen recordings or demo videos.** The user tests the app themselves via a public tunnel (e.g. Cloudflare Tunnel). Verify changes with `npm run lint` and `npm run build` instead.

### Cloudflare Tunnel (session lifecycle)

The public site should only be accessible while the user is actively working in a session. Start and stop the tunnel with the session:

**When session starts** (if the user needs external access to test the app):

1. Start the dev server: `npm run dev` (background)
2. Install cloudflared if needed: `curl -sL "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64" -o /tmp/cloudflared && chmod +x /tmp/cloudflared`
3. Start the tunnel: `/tmp/cloudflared tunnel --url http://localhost:5173` (background)
4. Share the generated URL (e.g. `https://xxxxx.trycloudflare.com`) with the user

**When session ends** (before finishing):

1. Stop the tunnel: `pkill -f cloudflared` or kill the tunnel process
2. Stop the dev server: `pkill -f "vite"` (or leave it; it will stop when the workspace shuts down)

### Statistics Finland WFS API options

**Base URL:** `https://geo.stat.fi/geoserver/vaestoruutu/wfs`

**Projections (srsName):**

| Code      | Name              | Notes                                                                 |
| --------- | ----------------- | --------------------------------------------------------------------- |
| EPSG:3067 | ETRS-TM35FIN      | Finland's national projection. Grid cells align with North (0°). Use this for correct alignment. |
| EPSG:4326 | WGS84             | Lat/lon. Causes grid rotation (anticlockwise west, clockwise east) when displayed in Web Mercator. |
| EPSG:3857 | Web Mercator      | Same rotation issues as 4326 when used with OSM tiles.                |

**Datasets (typeName):** Population grid by year and resolution:

| Resolution | Layers (examples)     | Notes                    |
| ---------- | --------------------- | ------------------------- |
| 1 km       | `vaestoruutu:vaki2022_1km` | More detail, more features |
| 5 km       | `vaestoruutu:vaki2022_5km` | Less detail, fewer features |
| 1 km _kp   | `vaestoruutu:vaki2022_1km_kp` | Variant of 1 km layer      |

Years: 2005–2024 (e.g. `vaki2023_5km`, `vaki2024_1km`).

**Output formats:** `application/json` (GeoJSON), `application/gml+xml`, `csv`, `excel`, etc.

### Notes

- The WFS endpoint (`geo.stat.fi`) is a public API; no API keys or secrets needed.
- The Vite dev server binds to `0.0.0.0` (configured in `vite.config.js`) so it's accessible from outside the container.
- `vite.config.js` has `allowedHosts: true` to allow tunnel hostnames; without this Vite blocks tunneled requests.
- OpenLayers CSS (`ol/ol.css`) is imported in `src/main.js`; forgetting this import will break map styling.
