package com.seekervault.app;

import android.content.Intent;
import android.os.Bundle;
import android.util.Log;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SafSaverPlugin.class);
        super.onCreate(savedInstanceState);
        // Force LIGHT status bar icons (white) — visible on both cream and graphite.
        // On Android 15 edge-to-edge, Capacitor StatusBar.setStyle is often ignored,
        // so we set it natively to be reliable across all themes.
        try {
            WindowInsetsControllerCompat c = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
            if (c != null) {
                c.setAppearanceLightStatusBars(false);
            }
        } catch (Exception e) {
            Log.w("SeekerVault", "Failed to set status bar appearance", e);
        }
    }

    /**
     * Перехват результата SAF-пикера НАПРЯМУЮ, минуя Capacitor plugin callback.
     * Capacitor не может сохранить PluginCall через уничтожение Activity
     * (Phantom/Solflare вызывают этот destroy из-за нехватки памяти),
     * поэтому делаем всю работу (запись файла) прямо здесь — она переживёт destroy,
     * так как MainActivity пересоздаётся со стейтом из SharedPreferences.
     */
    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        Log.d("SafSaverTrace", "MainActivity.onActivityResult req=" + requestCode + " result=" + resultCode + " hasData=" + (data != null));
        if (requestCode == SafSaverPlugin.SAF_REQUEST_CODE) {
            Log.d("SafSaverTrace", "Routing to handleSafResultStatic");
            SafSaverPlugin.handleSafResultStatic(this, resultCode, data);
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    /**
     * KEY FIX FOR SOLANA MWA:
     *
     * The Mobile Wallet Adapter browser library detects that a wallet app
     * opened by listening for `window.blur` — the window lost focus because
     * another app came to the foreground.
     *
     * Android WebView has a known Chromium bug: `window.blur` does NOT fire
     * when an Android Intent opens another Activity on top of the WebView.
     * (Chromium issue: https://issues.chromium.org/issues/41298055)
     *
     * Fix: We override the NATIVE `onWindowFocusChanged()` callback,
     * which DOES fire correctly on Android when any other app opens,
     * and manually dispatch a JavaScript blur/focus event into the WebView.
     *
     * This allows MWA to detect the wallet opened and proceed with the
     * WebSocket connection for authorization.
     */
    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (bridge != null && bridge.getWebView() != null) {
            String jsEvent = hasFocus
                    ? "window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('focus'));"
                    : "window.dispatchEvent(new Event('blur')); document.dispatchEvent(new Event('blur'));";
            bridge.getWebView().post(() ->
                bridge.getWebView().evaluateJavascript(jsEvent, null)
            );
        }
    }
}
