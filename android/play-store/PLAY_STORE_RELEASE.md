# NEXORA POINT Android Release

## App Identity

- App name: `NEXORA POINT`
- Package name: `com.nexora.point`
- Play Store URL: `https://play.google.com/store/apps/details?id=com.nexora.point`
- Web app URL: `https://nexora-point-system.vercel.app`
- Target SDK: configured by Capacitor in `android/variables.gradle`

## Build Requirements

Install Android Studio with:

- JDK bundled with Android Studio
- Android SDK Platform matching `targetSdkVersion`
- Android SDK Build-Tools

## Release Signing

Create an upload key once:

```powershell
keytool -genkeypair -v -keystore android\release-upload-key.jks -alias nexora-point -keyalg RSA -keysize 2048 -validity 10000
```

Copy the example file and fill real passwords:

```powershell
Copy-Item android\keystore.properties.example android\keystore.properties
```

Never commit `android/keystore.properties` or `android/*.jks`.

## Build AAB

```powershell
npm run android:sync
npm run android:build:aab
```

Upload this file to Google Play Console:

```text
android/app/build/outputs/bundle/release/app-release.aab
```

## App Links

After Play Console gives you the app signing SHA-256 fingerprint, copy `android/play-store/assetlinks.template.json`, replace the SHA-256 value, and deploy it to:

```text
public/.well-known/assetlinks.json
```

The Android manifest already includes an App Link intent filter for `https://nexora-point-system.vercel.app`.
