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
- To expose the dev server for external access, run: `/tmp/cloudflared tunnel --url http://localhost:5173` (install cloudflared to `/tmp` first if needed).

### Notes

- The WFS endpoint (`geo.stat.fi`) is a public API; no API keys or secrets needed.
- The Vite dev server binds to `0.0.0.0` (configured in `vite.config.js`) so it's accessible from outside the container.
- `vite.config.js` has `allowedHosts: true` to allow tunnel hostnames; without this Vite blocks tunneled requests.
- OpenLayers CSS (`ol/ol.css`) is imported in `src/main.js`; forgetting this import will break map styling.
