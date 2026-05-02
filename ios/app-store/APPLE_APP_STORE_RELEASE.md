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
- Either a Mac with Xcode installed, or a cloud Mac builder such as Codemagic.
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

## No Mac: Codemagic Path

This repo includes `codemagic.yaml` for a cloud Mac build.

1. Push the repo to GitHub.
2. Create or open a Codemagic account.
3. Add this repository as an app.
4. In App Store Connect, create an API key with App Manager access.
5. Add that API key to Codemagic with the integration name `codemagic`.
6. Create the App Store Connect app record for bundle ID `com.nexora.point`.
7. Replace `REPLACE_WITH_APP_STORE_APPLE_ID` in `codemagic.yaml` after App Store Connect gives the app an Apple ID.
8. Start the `NEXORA POINT iOS TestFlight` workflow.

Codemagic will use a Mac machine in the cloud, sign the app, build an `.ipa`, and upload it to TestFlight.

## Universal Links

After you know the Apple Team ID, copy `ios/app-store/apple-app-site-association.template.json`, replace `TEAMID`, and deploy it to:

```text
public/.well-known/apple-app-site-association
```

No `.json` extension is used for the deployed Apple file.
