# Running Secretariat locally

## WalletConnect (Connect button)

The Connect button uses RainbowKit + WalletConnect. To avoid 400/403 errors:

1. Go to [cloud.walletconnect.com](https://cloud.walletconnect.com) and create a free project.
2. Copy the **Project ID** (32 characters).
3. In the repo root or `app/`, create or edit `.env` and add:
   ```bash
   NEXT_PUBLIC_WALLETCONNECT_ID=your_32_character_project_id_here
   ```
4. Rebuild and restart: `cd app && npm run run`

Without this, you may see 400 Bad Request or 403 Forbidden from WalletConnect. You can still use **MetaMask** by choosing the “Injected” or browser wallet option in the connect modal if it appears.

---

## Option A: Production mode (recommended – no chunk 404s)

From the **app** directory:

```bash
cd app
npm run run
```

This clears `.next`, builds, and starts the server. Open **http://localhost:3000** in your browser.

If port 3000 is in use, stop other Node/Next processes first:

```bash
pkill -f "next"
```

Then run `npm run run` again.

## Option B: Dev mode (with hot reload)

1. **Stop any other Next/Node servers** (so nothing else is using port 3000).
2. From the **app** directory:

   ```bash
   cd app
   npm run dev:clean
   ```

3. Open the URL printed in the terminal (e.g. **http://localhost:3000**).
4. If you still see 404s for `main-app.js` or `app-pages-internals.js`:
   - Do a **hard refresh**: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows), or DevTools → Network → “Disable cache” and reload.
   - Make sure you’re not running `npm run start` (production) while the browser has a cached dev page.

## Why 404s happen

- **Dev server** uses chunk names like `main-app.js` and `app-pages-internals.js`.
- **Production server** uses hashed names like `main-app-1e591c85059a583f.js`.

If the server and the HTML don’t match (e.g. production server but cached dev HTML, or leftover build in `.next`), the browser requests the wrong chunk names and gets 404. Using **Option A** (`npm run run`) avoids that by always serving a fresh production build.
