package com.nexora.tcg;

import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;

public class NexoraWebViewClient extends BridgeWebViewClient {
    private final Context context;

    public NexoraWebViewClient(Bridge bridge, Context context) {
        super(bridge);
        this.context = context;
    }

    @Override
    public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        Uri url = request.getUrl();

        if (isExternalAuthUrl(url)) {
            openExternal(url);
            return true;
        }

        return super.shouldOverrideUrlLoading(view, request);
    }

    private boolean isExternalAuthUrl(Uri url) {
        if (url == null || url.getHost() == null) {
            return false;
        }

        String host = url.getHost().toLowerCase();
        return host.equals("accounts.google.com")
                || host.endsWith(".google.com")
                || host.equals("access.line.me")
                || host.equals("line.me")
                || host.endsWith(".line.me")
                || host.endsWith(".linecorp.com");
    }

    private void openExternal(Uri url) {
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, url);
            intent.addCategory(Intent.CATEGORY_BROWSABLE);
            context.startActivity(intent);
        } catch (ActivityNotFoundException ignored) {
        }
    }
}
