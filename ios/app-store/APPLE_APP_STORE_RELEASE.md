# NEXORA POINT iOS App Store Release

## App Identity

- App name: `NEXORA POINT`
- Bundle ID: `com.nexora.point`
- URL scheme: `nexorapoint://`
- Web app URL: `https://nexora-point-system.vercel.app`
- Version: `0.1.0`
- Build: `1`

## Requirements

You need:

- Apple Developer Program membership.
- A Mac with Xcode installed.
- App Store Connect access with permission to create app records and upload builds.

Starting April 28, 2026, iOS and iPadOS uploads to App Store Connect must be built with the iOS and iPadOS 26 SDK or later. Use Xcode 26 or newer for release uploads.

## App Store Connect

Create a new app record:

- Platform: iOS
- Name: `NEXORA POINT`
- Bundle ID: `com.nexora.point`
- SKU: `nexora-point-ios`

After the app record exists, App Store Connect will assign an Apple ID. Use it to replace the website App Store button URL with:

```text
https://apps.apple.com/app/idYOUR_APPLE_ID
```

## Sync And Open

Run:

```bash
npm run ios:sync
npm run ios:open
```

In Xcode:

1. Select the `App` project and `App` target.
2. Set Team to your Apple Developer team.
3. Confirm Bundle Identifier is `com.nexora.point`.
4. Enable Associated Domains if Xcode asks, keeping `applinks:nexora-point-system.vercel.app`.
5. Choose Any iOS Device.
6. Product > Archive.
7. Distribute App > TestFlight & App Store.

## Universal Links

After you know the Apple Team ID, copy `ios/app-store/apple-app-site-association.template.json`, replace `TEAMID`, and deploy it to:

```text
public/.well-known/apple-app-site-association
```

No `.json` extension is used for the deployed Apple file.
