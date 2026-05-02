# App Store Privacy Checklist

Use this when filling App Privacy in App Store Connect.

## Likely Data Types

Confirm against the live production app before submitting:

- Contact Info: user account email/name if collected through login.
- User Content: profile images, chat uploads, marketplace listing images.
- Identifiers: user ID/account ID.
- Purchases: only if real-money purchases are added later.
- Usage Data: app interactions if analytics are enabled.
- Diagnostics: crash/performance data if Apple/Xcode or analytics collects it.

## Privacy Policy

App Store Connect needs a privacy policy URL. Add or confirm a live page on the production domain before submission, for example:

```text
https://nexora-point-system.vercel.app/privacy
```

## Permissions Used In iOS Build

- Camera: scanning cards/coupons.
- Photo Library: selecting profile, chat, and listing images.
- Microphone: only if live/audio features are enabled.

Keep the permission usage text in `ios/App/App/Info.plist` aligned with the real feature set.
