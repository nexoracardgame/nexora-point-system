package com.nexora.tcg;

import android.content.Intent;
import android.net.Uri;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String APP_ORIGIN = "https://nexora-point-system.vercel.app";

    @Override
    protected void load() {
        super.load();

        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().setWebViewClient(
                new NexoraWebViewClient(getBridge(), this)
            );
            handleNativeAuthIntent(getIntent());
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleNativeAuthIntent(intent);
    }

    private void handleNativeAuthIntent(Intent intent) {
        if (intent == null || intent.getData() == null || getBridge() == null) {
            return;
        }

        Uri uri = intent.getData();
        boolean customSchemeCallback =
            "nexoratcg".equals(uri.getScheme()) && "auth".equals(uri.getHost());
        boolean appLinkCallback =
            "https".equals(uri.getScheme())
                && "nexora-point-system.vercel.app".equals(uri.getHost())
                && "/api/auth/native/consume".equals(uri.getPath());

        if (!customSchemeCallback && !appLinkCallback) {
            return;
        }

        String token = uri.getQueryParameter("token");
        if (token == null || token.length() == 0) {
            return;
        }

        String consumeUrl = APP_ORIGIN + "/api/auth/native/consume?token=" + Uri.encode(token);
        getBridge().getWebView().post(() -> getBridge().getWebView().loadUrl(consumeUrl));
    }
}
