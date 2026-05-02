# NEXORA POINT Desktop

This Electron shell loads the live NEXORA web app from:

```text
https://nexora-point-system.vercel.app
```

Web app changes deploy to the server and appear in the desktop app immediately on next load. Electron auto-update is for native shell changes such as icons, permissions, window behavior, installer metadata, and updater logic.

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

- `NEXORA-Point-Setup.exe`
- `NEXORA-Point-Setup-<version>.exe`
- `NEXORA-Point-Setup-<version>.exe.blockmap`
- `latest.yml`

Deploy the web app after staging so `/downloads/windows/latest.yml` and the installer are available to users and to `electron-updater`.

The app package intentionally ships without `asar` so Windows release builds do not depend on the extra asar-integrity signing toolchain. The desktop shell is small and still loads the live web app from the production URL.

This local installer build is unsigned and disables update signature verification so auto-update works with the staged generic feed. For a public production release, add a Windows code-signing certificate and turn signature verification back on to avoid SmartScreen warnings.

## Production URL

For a packaged build that should load another domain, set `NEXORA_APP_URL` before building or launching the app. The default is `https://nexora-point-system.vercel.app`.
