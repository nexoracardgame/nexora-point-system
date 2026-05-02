import type { CapacitorConfig } from "@capacitor/cli";

const productionUrl =
  process.env.NEXORA_APP_URL || "https://nexora-point-system.vercel.app";

const config: CapacitorConfig = {
  appId: "com.nexora.point",
  appName: "NEXORA POINT",
  webDir: "android-web",
  backgroundColor: "#0B0A09",
  loggingBehavior: "debug",
  server: {
    url: productionUrl,
    cleartext: false,
    allowNavigation: ["nexora-point-system.vercel.app"],
    errorPath: "offline.html",
  },
  android: {
    backgroundColor: "#0B0A09",
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  ios: {
    backgroundColor: "#0B0A09",
    contentInset: "automatic",
    scrollEnabled: true,
  },
};

export default config;
