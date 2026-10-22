#!/usr/bin/env python3
"""Apply app-specific, offline WebView support to a *staged* KCAPK source tree.

Never edits KCAPK_DIR. Keep the upstream templates canonical; only change the
two necessary integration points here, and abort if their shape changes.
"""
from pathlib import Path
import sys

templates = Path(sys.argv[1])
main_file = templates / "MainActivity.java.in"
client_file = templates / "TrustedWebViewClient.java.in"

def replace_once(path, before, after):
    text = path.read_text(encoding="utf-8")
    if text.count(before) != 1:
        raise SystemExit(f"KCAPK template incompatible: {path.name}: {before!r}")
    path.write_text(text.replace(before, after), encoding="utf-8")

replace_once(main_file,
    'private static final String WEBVIEW_URL = "@WEBVIEW_URL@";',
    'private static final String WEBVIEW_URL = "file:///android_asset/migrate.html";')
replace_once(main_file,
    'webView.setWebViewClient(new TrustedWebViewClient(this, TRUSTED_ORIGINS, bridge));',
    'webView.setWebViewClient(new TrustedWebViewClient(this, TRUSTED_ORIGINS, bridge));\n'
    '        webView.setWebChromeClient(new AppWebChromeClient(this));')
replace_once(client_file,
    'import android.webkit.WebViewClient;',
    'import android.webkit.WebViewClient;\n'
    'import android.webkit.WebResourceResponse;\n'
    'import java.io.ByteArrayInputStream;\n'
    'import java.io.IOException;\n'
    'import java.util.Collections;')
intercept = '''
    // Keep all content inside the APK while exposing a secure HTTPS origin.
    // Unlike file:///, the synthetic origin can request browser microphone
    // permission. Nothing is fetched from a remote server.
    private static final String LOCAL_HOST = "appassets.androidplatform.net";

    @Override
    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        Uri uri = request.getUrl();
        if (!"https".equals(uri.getScheme()) || !LOCAL_HOST.equals(uri.getHost())) {
            return super.shouldInterceptRequest(view, request);
        }
        String path = uri.getPath();
        if (path == null || path.equals("/")) path = "/index.html";
        if (path.contains("..") || !path.matches("/[a-zA-Z0-9_./-]+")) {
            return missingAsset();
        }
        String name = path.substring(1);
        String mime = "application/octet-stream";
        if (name.endsWith(".html")) mime = "text/html";
        else if (name.endsWith(".css")) mime = "text/css";
        else if (name.endsWith(".js")) mime = "text/javascript";
        else if (name.endsWith(".svg")) mime = "image/svg+xml";
        else if (name.endsWith(".mp3")) mime = "audio/mpeg";
        else if (name.endsWith(".png")) mime = "image/png";
        else if (name.endsWith(".jpg") || name.endsWith(".jpeg")) mime = "image/jpeg";
        else if (name.endsWith(".json")) mime = "application/json";
        try {
            return new WebResourceResponse(mime, mime.startsWith("text/") ? "UTF-8" : null,
                context.getAssets().open(name));
        } catch (IOException ignored) {
            return missingAsset();
        }
    }

    private static WebResourceResponse missingAsset() {
        return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found",
            Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
    }

'''
replace_once(client_file,
    '    private boolean openExternally(String url) {',
    intercept + '    private boolean openExternally(String url) {')
