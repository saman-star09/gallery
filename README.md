# The Living Satellite Ghost Gallery

A zero-gravity 3D gallery whose frames aren't photos — they're live windows onto
public Earth-observation satellites. Fly up to a frame and it fetches whatever
that satellite (or the sun-lit face of the whole planet) looked like most
recently, right there in your browser.

This is a working prototype of one gallery concept from a larger brainstorm
(*"Orbital Perspective"*), built with real public APIs rather than mocked data.

## What's actually live

| Frame | Source | Update cadence | Notes |
|---|---|---|---|
| **The Whole Earth, Right Now** | [NASA EPIC](https://epic.gsfc.nasa.gov/about/api) — DSCOVR at the Sun-Earth L1 point | ~1–2 hours | Full sunlit disc of Earth. No API key required. |
| **GOES-16 — Americas, Live** | [NOAA GOES-East GeoColor](https://www.star.nesdis.noaa.gov/GOES/) | ~10 minutes | Static `latest.jpg`, cache-busted on every fetch. |
| **GOES-18 — Pacific, Live** | [NOAA GOES-West GeoColor](https://www.star.nesdis.noaa.gov/GOES/) | ~10 minutes | Same as above, Pacific hemisphere. |
| **Nearest Satellite Pass** | [CelesTrak](https://celestrak.org/) TLEs + real SGP4 propagation ([satellite.js](https://github.com/shashwatak/satellite-js)), imagery via [NASA GIBS](https://nasa-gibs.github.io/gibs-api-docs/) | ~1 minute | Computes the real current position of 8 tracked EO satellites and fetches a near-real-time tile centered on whichever is nearest to you. |

The last frame is the literal version of the "telescope aperture" idea: it
runs actual orbital mechanics client-side to find which real satellite
(Terra, Aqua, Suomi NPP, NOAA-20, Landsat 8/9, Sentinel-2A/B) is closest to a
reference point (your geolocation if you allow it, otherwise Greenwich), then
asks GIBS for a near-real-time scan of that spot. Flying closer to the frame
requests a higher WMTS zoom level of the same location — a real "zoom deeper
into the live feed" driven by your position in the room, not a canned effect.
If CelesTrak's TLE catalog can't be reached, this frame falls back to a
physically-shaped simulated ground track (documented in
`src/data/satelliteTracker.ts`) and is clearly labeled *"simulated orbit"*
rather than pretending to be live.

## Why CSS3D, not WebGL textures

Cross-origin satellite images generally aren't served with
`Access-Control-Allow-Origin`, so loading them as WebGL textures would taint
the canvas. Instead, the room and frame borders are drawn with
`THREE.WebGLRenderer`, and each frame's actual image is a real `<img>`
element positioned in 3D space via `THREE.CSS3DRenderer` — the same
dual-renderer technique three.js's own CSS3D examples use. Plain `<img>` tags
display cross-origin content without needing CORS headers, so the gallery
works with imagery hosts that were never built for WebGL.

## Controls

- Click to enter — mouse looks around, `W A S D` thrusts along your view direction
- `Space` / `Shift` — thrust up / down
- `Esc` — release the cursor
- Movement has inertia (zero gravity): you drift and decelerate rather than stopping instantly
- Drift close to a frame to focus it — the HUD shows its source and caption, and it re-fetches the freshest imagery available at that moment

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build to dist/
npm run preview  # serve the production build
```

No API keys or environment variables are required — every data source here is
free and open access.

## Known limitations

- **Network access.** All four frames need outbound internet to their
  respective public APIs. Locked-down environments (including the sandbox
  this was developed in, which only allowlists npm/GitHub) will show every
  frame in its "uplink interrupted" state — that's the app's real error path,
  not a bug, and it retries with backoff.
- **GIBS tile availability.** Near-real-time processing can lag a few hours;
  the GIBS-based frame cascades through a couple of fallback zoom levels and
  the previous day before giving up.
- **Simulated fallback isn't tracking.** When CelesTrak is unreachable, the
  "Nearest Satellite Pass" frame shows a physically-realistic but illustrative
  ground track, not that satellite's true current position — it's labeled as
  such in the HUD.
- **Bundle size.** `satellite.js` ships an optional WASM acceleration path
  that gets bundled in; the production build is ~600 KB (~160 KB gzipped).
  Fine for a prototype; a follow-up could lazy-load `satelliteTracker.ts`.
- **Multiplayer "shared magnification"** from the original concept (two
  visitors standing near a frame zoom it further together) isn't implemented
  — it needs a realtime presence backend this static front-end prototype
  doesn't have. The solo version (your own proximity drives zoom) is real and
  working.
