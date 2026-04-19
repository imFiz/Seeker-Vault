package com.seekervault.app;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.Handler;
import android.provider.MediaStore;
import android.provider.OpenableColumns;
import android.os.Looper;
import android.os.ParcelFileDescriptor;
import android.util.Log;
import android.provider.DocumentsContract;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.OutputStream;

/**
 * Save files via Android SAF. Handles Activity destruction (Phantom/Solflare)
 * by processing the result in MainActivity.onActivityResult — bypasses Capacitor's
 * broken PluginCall save/restore mechanism.
 */
@CapacitorPlugin(name = "SafSaver")
public class SafSaverPlugin extends Plugin {
    public static final int SAF_REQUEST_CODE = 9087;

    private static final String PREFS = "saf_saver_prefs";
    private static final String KEY_SOURCE = "source_path";
    private static final String KEY_STATUS = "status"; // pending|success|error|cancelled
    private static final String KEY_URI = "result_uri";
    private static final String KEY_BYTES = "result_bytes";
    private static final String KEY_ERROR = "result_error";

    // Hold the active call until MainActivity notifies completion.
    private static volatile PluginCall pendingCall;
    private static volatile Plugin pendingPluginInstance;

    @PluginMethod
    public void saveFile(PluginCall call) {
        String filename = call.getString("filename");
        String sourcePath = call.getString("sourcePath");
        String base64Data = call.getString("data");
        String mimeType = call.getString("mimeType", "application/octet-stream");

        if (filename == null) {
            call.reject("filename required");
            return;
        }
        if (sourcePath == null && base64Data == null) {
            call.reject("sourcePath or data required");
            return;
        }

        // If caller passed base64 data directly, write it to a temp file first.
        if (sourcePath == null) {
            try {
                File tempDir = new File(getContext().getCacheDir(), "saf_temp");
                if (!tempDir.exists()) tempDir.mkdirs();
                File tempFile = new File(tempDir, System.currentTimeMillis() + "_" + filename);
                byte[] bytes = android.util.Base64.decode(base64Data, android.util.Base64.NO_WRAP);
                try (FileOutputStream fos = new FileOutputStream(tempFile)) {
                    fos.write(bytes);
                }
                sourcePath = tempFile.getAbsolutePath();
                Log.d("SafSaverTrace", "Wrote base64 to temp: " + sourcePath + " (" + bytes.length + " bytes)");
            } catch (Exception e) {
                Log.e("SafSaverTrace", "Failed to write base64 to temp", e);
                call.reject("Failed to stage file: " + e.getMessage());
                return;
            }
        }

        File source = new File(sourcePath);
        Log.d("SafSaverTrace", "saveFile called: filename=" + filename + " src=" + sourcePath + " srcExists=" + source.exists() + " srcLen=" + (source.exists() ? source.length() : -1));
        if (!source.exists() || source.length() == 0) {
            call.reject("Source file missing or empty: " + sourcePath);
            return;
        }

        // Silent mode: skip SAF picker, write directly to Downloads via MediaStore.
        boolean skipPicker = call.getBoolean("skipPicker", false);
        if (skipPicker) {
            try {
                Uri uri = writeToMediaStore(getContext(), source, filename, mimeType);
                long bytes = source.length();
                // cleanup temp file if we created it from base64
                if (base64Data != null) source.delete();
                if (uri == null) {
                    call.reject("MediaStore write failed");
                    return;
                }
                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("uri", uri.toString());
                ret.put("bytes", bytes);
                call.resolve(ret);
                return;
            } catch (Exception e) {
                Log.e("SafSaverTrace", "skipPicker save failed", e);
                if (base64Data != null) source.delete();
                call.reject("Silent save failed: " + e.getMessage());
                return;
            }
        }

        SharedPreferences prefs = getContext().getSharedPreferences(PREFS, 0);
        prefs.edit()
            .putString(KEY_SOURCE, sourcePath)
            .putString(KEY_STATUS, "pending")
            .remove(KEY_URI)
            .remove(KEY_BYTES)
            .remove(KEY_ERROR)
            .commit();

        call.setKeepAlive(true);
        pendingCall = call;
        pendingPluginInstance = this;

        try {
            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType(mimeType);
            intent.putExtra(Intent.EXTRA_TITLE, filename);
            getActivity().startActivityForResult(intent, SAF_REQUEST_CODE);
        } catch (Exception e) {
            pendingCall = null;
            pendingPluginInstance = null;
            call.reject("Launch intent failed: " + e.getMessage());
        }
    }

    private static String querySafDisplayName(Context ctx, Uri uri) {
        try (android.database.Cursor c = ctx.getContentResolver().query(
                uri, new String[]{ OpenableColumns.DISPLAY_NAME }, null, null, null)) {
            if (c != null && c.moveToFirst()) {
                String n = c.getString(0);
                if (n != null && !n.isEmpty()) return n;
            }
        } catch (Exception ignore) {}
        return "backup_" + System.currentTimeMillis() + ".vault";
    }

    private static Uri writeToMediaStore(Context ctx, File source, String filename, String mimeType) {
        long expected = source.length();
        Uri insertUri = null;
        BufferedInputStream in = null;
        BufferedOutputStream out = null;
        ParcelFileDescriptor pfd = null;
        FileOutputStream fos = null;
        try {
            ContentValues values = new ContentValues();
            values.put(MediaStore.Downloads.DISPLAY_NAME, filename);
            values.put(MediaStore.Downloads.MIME_TYPE, mimeType);
            values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
            values.put(MediaStore.Downloads.IS_PENDING, 1);

            Uri collection = MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
            insertUri = ctx.getContentResolver().insert(collection, values);
            if (insertUri == null) throw new Exception("MediaStore insert returned null");

            Log.d("SafSaverTrace", "MediaStore insert uri=" + insertUri + " expected=" + expected);

            pfd = ctx.getContentResolver().openFileDescriptor(insertUri, "w");
            if (pfd == null) throw new Exception("openFileDescriptor returned null");
            fos = new FileOutputStream(pfd.getFileDescriptor());
            out = new BufferedOutputStream(fos, 32768);
            in = new BufferedInputStream(new FileInputStream(source), 32768);

            byte[] buf = new byte[16384];
            int n; long total = 0;
            while ((n = in.read(buf)) > 0) { out.write(buf, 0, n); total += n; }
            out.flush();
            try { fos.getFD().sync(); } catch (Exception ignore) {}
            out.close(); out = null;
            fos.close(); fos = null;
            pfd.close(); pfd = null;
            in.close(); in = null;

            Log.d("SafSaverTrace", "MediaStore write complete wrote=" + total);
            if (total != expected) throw new Exception("size mismatch wrote=" + total + " expected=" + expected);

            ContentValues finalize = new ContentValues();
            finalize.put(MediaStore.Downloads.IS_PENDING, 0);
            ctx.getContentResolver().update(insertUri, finalize, null, null);
            return insertUri;
        } catch (Exception e) {
            Log.e("SafSaverTrace", "MediaStore save failed: " + e.getMessage(), e);
            try { if (in != null) in.close(); } catch (Exception ignore) {}
            try { if (out != null) out.close(); } catch (Exception ignore) {}
            try { if (fos != null) fos.close(); } catch (Exception ignore) {}
            try { if (pfd != null) pfd.close(); } catch (Exception ignore) {}
            if (insertUri != null) {
                try { ctx.getContentResolver().delete(insertUri, null, null); } catch (Exception ignore) {}
            }
            return null;
        }
    }

    /**
     * Статический обработчик — переживает destroy Activity, потому что вся логика синхронна
     * и использует SharedPreferences. Вызывается из MainActivity.onActivityResult.
     */
    public static void handleSafResultStatic(Context ctx, int resultCode, Intent data) {
        Log.d("SafSaverTrace", "handleSafResultStatic ENTER resultCode=" + resultCode);
        SharedPreferences prefs = ctx.getSharedPreferences(PREFS, 0);
        String sourcePath = prefs.getString(KEY_SOURCE, null);
        Log.d("SafSaverTrace", "sourcePath from prefs=" + sourcePath);

        if (resultCode != Activity.RESULT_OK) {
            if (sourcePath != null) new File(sourcePath).delete();
            prefs.edit().putString(KEY_STATUS, "cancelled").remove(KEY_SOURCE).commit();
            resolvePending("cancelled", null, 0, "cancelled");
            return;
        }

        Uri uri = data != null ? data.getData() : null;
        Log.d("SafSaverTrace", "destination uri=" + uri);
        if (uri == null) {
            if (sourcePath != null) new File(sourcePath).delete();
            prefs.edit().putString(KEY_STATUS, "error").putString(KEY_ERROR, "No URI returned").remove(KEY_SOURCE).commit();
            resolvePending("error", null, 0, "No URI returned from SAF");
            return;
        }

        if (sourcePath == null) {
            deleteDestSilently(ctx, uri);
            prefs.edit().putString(KEY_STATUS, "error").putString(KEY_ERROR, "Source path lost").commit();
            resolvePending("error", uri.toString(), 0, "Source path lost across Activity restart");
            return;
        }

        File source = new File(sourcePath);
        if (!source.exists()) {
            deleteDestSilently(ctx, uri);
            prefs.edit().putString(KEY_STATUS, "error").putString(KEY_ERROR, "Source missing").remove(KEY_SOURCE).commit();
            resolvePending("error", uri.toString(), 0, "Source file missing: " + sourcePath);
            return;
        }

        long expected = source.length();
        if (expected == 0) {
            deleteDestSilently(ctx, uri);
            source.delete();
            prefs.edit().putString(KEY_STATUS, "error").putString(KEY_ERROR, "Source empty").remove(KEY_SOURCE).commit();
            resolvePending("error", uri.toString(), 0, "Source file is empty");
            return;
        }

        // Обход бага Downloads-провайдера: он кэширует SIZE=0 на момент создания
        // файла и не обновляет метаданные после записи. Перенаправляем на MediaStore
        // с тем же именем — там размер учитывается корректно.
        String authority = uri.getAuthority();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                && authority != null && authority.contains("downloads")) {
            Log.d("SafSaverTrace", "Downloads provider detected — redirecting to MediaStore");
            String displayName = querySafDisplayName(ctx, uri);
            deleteDestSilently(ctx, uri); // удаляем пустышку, созданную SAF
            Uri msUri = writeToMediaStore(ctx, source, displayName, "application/octet-stream");
            source.delete();
            if (msUri != null) {
                prefs.edit()
                    .putString(KEY_STATUS, "success")
                    .putString(KEY_URI, msUri.toString())
                    .putLong(KEY_BYTES, expected)
                    .remove(KEY_SOURCE)
                    .commit();
                resolvePending("success", msUri.toString(), expected, null);
            } else {
                prefs.edit().putString(KEY_STATUS, "error").putString(KEY_ERROR, "MediaStore write failed").remove(KEY_SOURCE).commit();
                resolvePending("error", null, 0, "MediaStore write failed");
            }
            return;
        }

        ParcelFileDescriptor pfd = null;
        FileOutputStream fos = null;
        BufferedOutputStream out = null;
        BufferedInputStream in = null;
        OutputStream rawStream = null;
        long total = 0;
        boolean success = false;
        String errorMsg = null;
        try {
            // Режим "rwt" = read+write+truncate. На Downloads provider без truncate
            // запись ложится рядом с уже созданным 0-байтовым файлом и не коммитится.
            pfd = ctx.getContentResolver().openFileDescriptor(uri, "rwt");
            if (pfd != null) {
                fos = new FileOutputStream(pfd.getFileDescriptor());
                out = new BufferedOutputStream(fos, 32768);
            } else {
                rawStream = ctx.getContentResolver().openOutputStream(uri, "wt");
                if (rawStream == null) throw new Exception("Both PFD and output stream are null");
                out = new BufferedOutputStream(rawStream, 32768);
            }
            in = new BufferedInputStream(new FileInputStream(source), 32768);
            byte[] buf = new byte[16384];
            int n;
            while ((n = in.read(buf)) > 0) {
                out.write(buf, 0, n);
                total += n;
            }
            out.flush();
            // Форсируем запись на диск ДО закрытия дескриптора.
            if (fos != null) {
                try { fos.getFD().sync(); } catch (Exception ignore) {}
            }
            try { out.close(); out = null; } catch (Exception ignore) {}
            if (fos != null) { try { fos.close(); fos = null; } catch (Exception ignore) {} }
            if (pfd != null) {
                // closeWithError(null) = нормальное закрытие, коммитит изменения провайдеру.
                try { pfd.close(); pfd = null; } catch (Exception ignore) {}
            }
            if (rawStream != null) { try { rawStream.close(); rawStream = null; } catch (Exception ignore) {} }

            Log.d("SafSaverTrace", "write complete wrote=" + total + " expected=" + expected);
            if (total != expected || total == 0) {
                throw new Exception("size mismatch wrote=" + total + " expected=" + expected);
            }
            // Верификация: читаем фактический размер через провайдер.
            long actualSize = -1;
            try (ParcelFileDescriptor check = ctx.getContentResolver().openFileDescriptor(uri, "r")) {
                if (check != null) actualSize = check.getStatSize();
            } catch (Exception e) {
                Log.e("SafSaverTrace", "size verify failed: " + e.getMessage());
            }
            Log.d("SafSaverTrace", "verified actualSize=" + actualSize);
            if (actualSize != expected) {
                throw new Exception("provider did not persist bytes: actual=" + actualSize + " expected=" + expected);
            }
            // Обновляем метаданные SIZE в MediaStore / Documents provider —
            // без этого встроенные файл-пикеры (MIUI, Android System) показывают 0 Б,
            // даже если физический файл содержит данные.
            try {
                ContentValues cv = new ContentValues();
                cv.put(OpenableColumns.SIZE, expected);
                cv.put(MediaStore.MediaColumns.SIZE, expected);
                ctx.getContentResolver().update(uri, cv, null, null);
            } catch (Exception e) {
                Log.e("SafSaverTrace", "metadata update failed (non-fatal): " + e.getMessage());
            }
            try {
                ctx.getContentResolver().notifyChange(uri, null);
            } catch (Exception ignore) {}
            success = true;
        } catch (Exception e) {
            errorMsg = e.getMessage();
            Log.e("SafSaverTrace", "write FAILED: " + errorMsg, e);
        } finally {
            try { if (in != null) in.close(); } catch (Exception ignore) {}
            try { if (out != null) out.close(); } catch (Exception ignore) {}
            try { if (fos != null) fos.close(); } catch (Exception ignore) {}
            try { if (rawStream != null) rawStream.close(); } catch (Exception ignore) {}
            try { if (pfd != null) pfd.close(); } catch (Exception ignore) {}
            source.delete();
            if (!success) deleteDestSilently(ctx, uri);
        }

        if (success) {
            prefs.edit()
                .putString(KEY_STATUS, "success")
                .putString(KEY_URI, uri.toString())
                .putLong(KEY_BYTES, total)
                .remove(KEY_SOURCE)
                .commit();
            resolvePending("success", uri.toString(), total, null);
        } else {
            prefs.edit()
                .putString(KEY_STATUS, "error")
                .putString(KEY_ERROR, errorMsg != null ? errorMsg : "unknown")
                .remove(KEY_SOURCE)
                .commit();
            resolvePending("error", uri.toString(), total, "Write failed: " + errorMsg);
        }
    }

    private static void resolvePending(String status, String uri, long bytes, String error) {
        final PluginCall call = pendingCall;
        pendingCall = null;
        pendingPluginInstance = null;
        if (call == null) return; // JS context исчез, но файл уже записан на диск — это OK
        new Handler(Looper.getMainLooper()).post(() -> {
            try { call.setKeepAlive(false); } catch (Exception ignore) {}
            if ("success".equals(status)) {
                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("uri", uri);
                ret.put("bytes", bytes);
                call.resolve(ret);
            } else if ("cancelled".equals(status)) {
                call.reject("cancelled");
            } else {
                call.reject(error != null ? error : "unknown error");
            }
        });
    }

    /**
     * Проверить результат последнего save (для восстановления после destroy JS контекста).
     */
    @PluginMethod
    public void getLastResult(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS, 0);
        String status = prefs.getString(KEY_STATUS, "none");
        JSObject ret = new JSObject();
        ret.put("status", status);
        ret.put("uri", prefs.getString(KEY_URI, ""));
        ret.put("bytes", prefs.getLong(KEY_BYTES, 0));
        ret.put("error", prefs.getString(KEY_ERROR, ""));
        call.resolve(ret);
    }

    private static void deleteDestSilently(Context ctx, Uri uri) {
        if (uri == null) return;
        try {
            boolean ok = DocumentsContract.deleteDocument(ctx.getContentResolver(), uri);
            if (ok) return;
        } catch (Exception ignore) {}
        try {
            int n = ctx.getContentResolver().delete(uri, null, null);
            if (n > 0) return;
        } catch (Exception ignore) {}
        ParcelFileDescriptor pfd = null;
        try {
            pfd = ctx.getContentResolver().openFileDescriptor(uri, "wt");
        } catch (Exception ignore) {
        } finally {
            try { if (pfd != null) pfd.close(); } catch (Exception ignore) {}
        }
    }
}
