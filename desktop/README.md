# NEXORA TCG Desktop

This Electron shell loads the live NEXORA web app from:

```text
https://nexora-point-system.vercel.app
```

Web app changes deploy to the server and appear in the desktop app immediately on next load. Electron auto-update is for native shell changes such as icons, permissions, window behavior, installer metadata, and updater logic.

## Game Resource Pack

The dedicated game installer (1.0.7 onward) also includes every file from
`public/game-release.json` under `resources/game-resources`. Its HTTPS handler
serves only matching `?patch=<version>` requests from the installed pack, after
checking byte length and SHA-256. Other origins, APIs, newer patches, and damaged
files use the network. This avoids shadowing newer deployed resources.

At startup the game activates the shared service worker, checks that every
manifest file exists, repairs missing files, and publishes the cache pointer only
after a successful install. Unchanged files are reused after integrity checking.
Installed PWAs use the same verified cache; ordinary browser play prepares the
complete immutable card-thumbnail catalog without downloading the 4K video pack.

The shell, authentication, multiplayer state, and user-uploaded avatars still
require the server. Local artwork is not a promise of offline multiplayer or
identical frame rates on different hardware. Browser storage may be evicted;
persistent storage is requested but remains subject to platform policy.

Run `node scripts/test-game-resources-offline.cjs` to verify all 293 thumbnails,
the Next Image compatibility path, range requests, and missing-file repair with
the browser offline. Run `node scripts/test-game-resource-pack.cjs` for native
pack isolation and integrity tests.

The complete installer can exceed GitHub's 100 MiB Git-file limit. Do not copy it
into `public/downloads` or update the live updater feed until the binary is hosted
on a release/CDN endpoint that supports its size. `scripts/stage-game-desktop.cjs`
intentionally rejects oversized binaries. Existing clients can still receive the
shared web resource-cache upgrade independently of the next native release.

## Development

Run the Next.js dev server, then start Electron:

```bash
npm run dev
npm run desktop:dev
```

To point Electron at a different URL:

```powershell
$env:NEXORA_DEV_URL="http://localhost:3000"; npm run desktop:dev
```

## Windows Release

Build the installer and stage it for website download:

```bash
npm run desktop:release
```

This creates the Windows installer in `dist/desktop` and copies the current release files to `public/downloads/windows`:

- `NEXORA-TCG-Setup.exe`
- `NEXORA-TCG-Setup-<version>.exe`
- `NEXORA-TCG-Setup-<version>.exe.blockmap`
- `latest.yml`

Deploy the web app after staging so `/downloads/windows/latest.yml` and the installer are available to users and to `electron-updater`.

The app package intentionally ships without `asar` so Windows release builds do not depend on the extra asar-integrity signing toolchain. The desktop shell is small and still loads the live web app from the production URL.

The installer is configured as a one-click per-user install, so users do not see the all-users/current-user chooser and do not need admin rights for a normal install.

This local installer build is unsigned and disables update signature verification so auto-update works with the staged generic feed. For a public production release, add a Windows code-signing certificate, remove the signing skips in `build.win.signExts`, keep `build.win.signAndEditExecutable` enabled, set `build.win.verifyUpdateCodeSignature` back to `true`, then rebuild to avoid SmartScreen warnings.

## Production URL

For a packaged build that should load another domain, set `NEXORA_APP_URL` before building or launching the app. The default is `https://nexora-point-system.vercel.app`.
