# Trip Planner MVP (Step 2)

This is a lightweight Trip Dashboard app for the normalized trip schema.

## Features

- Trip overview for two-family convoy travel
- Convoy Mode status buttons per vehicle
- Shared checklist persisted in local storage
- Day planner card with stops, activities, food, map links, and per-day checklist
- Expense tracker with budget categories, split modes, and running totals
- Family split support
- Equal split by family
- Single-family payer
- Custom percentage split (example: `Vaka:40,Gopu:60`)
- CSV export for expense records
- One-click export of an updated trip JSON with merged `budget.entries`
- Booking reminder cards for ferries and stay transitions
- Print-friendly daily briefing view
- PWA install and offline support
- Optional Firebase real-time sync for convoy status and expenses

## Run

Because the app uses `fetch` for the JSON file, run it with a local web server.

### Option A: VS Code Live Server

Open index.html with Live Server.

### Option B: Python

```bash
python -m http.server 8080
```

Then open: `http://localhost:8080`

## Hosting Options

### Netlify

- Push this project to GitHub.
- In Netlify, create a site from that repository.
- Build command: leave empty.
- Publish directory: `.`
- Deploy.

This project already includes `netlify.toml` for useful headers.

### Cloudflare Pages

- Push this project to GitHub.
- In Cloudflare Pages, connect the repository.
- Build command: none.
- Build output directory: `.`
- Deploy.

This project includes `_headers` which Cloudflare Pages supports.

## PWA Offline Use During Trip

- Open the deployed URL once with internet.
- Wait for full app load.
- Install to home screen from browser menu.
- Keep the app installed on both family phones.
- After first successful load, it works offline using `sw.js` cache.

## Optional Firebase Sync

Firebase sync is optional and disabled by default.

### What syncs

- Convoy vehicle statuses
- Expense entries

### Setup

- Create a Firebase project.
- Enable Firestore database.
- Add a web app in Firebase and copy config values.
- In browser console on each device, set config once:

```js
localStorage.setItem(
	"trip_firebase_config",
	JSON.stringify({
		apiKey: "...",
		authDomain: "...",
		projectId: "...",
		appId: "...",
		tripId: "norway-family-trip"
	})
);
location.reload();
```

- Use the same `tripId` on all devices you want to sync.
- `tripMeta` shows sync status at runtime.

## Expense Split Notes

- Family split uses `group.families[].family_id` values from your JSON (for example: `Vaka`, `Gopu`).
- Custom split must total exactly 100.
- Exported CSV includes split metadata and custom split JSON.

## Persist To JSON File

- The browser cannot directly overwrite local project files for security reasons.
- Use **Export Updated Trip JSON** in the Expense Tracker.
- This downloads `norway_tripinfo.updated.json` with all local expenses merged into `budget.entries`.
- Replace your project `norway_tripinfo.json` with the downloaded file when you want to persist updates in the workspace file.

## Files

- index.html: UI structure
- styles.css: visual design and responsive layout
- app.js: data loading, rendering, and local-storage state
- sw.js: service worker for offline caching
- manifest.webmanifest: PWA metadata
- firebase-sync.js: optional Firestore sync adapter
- netlify.toml: Netlify deployment headers
- _headers: Cloudflare Pages and static host headers
- norway_tripinfo.json: trip data source
