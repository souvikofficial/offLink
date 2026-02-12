package com.offsync.app.work;

import android.content.Context;
import android.content.SharedPreferences;
import android.preference.PreferenceManager;
import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import com.offsync.app.db.AppDatabase;
import com.offsync.app.db.LocationPointEntity;
import com.offsync.app.BuildConfig;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.List;

public class LocationSyncWorker extends Worker {
    private static final MediaType JSON = MediaType.get("application/json; charset=utf-8");
    private final OkHttpClient client = new OkHttpClient();

    public LocationSyncWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        try {
            AppDatabase db = AppDatabase.getInstance(getApplicationContext());
            List<LocationPointEntity> pending = db.locationDao().getPending(50);
            if (pending == null || pending.size() == 0) {
                return Result.success();
            }

            JSONArray arr = new JSONArray();
            List<Integer> ids = new ArrayList<>();
            for (LocationPointEntity p : pending) {
                JSONObject o = new JSONObject();
                o.put("capturedAt", p.capturedAt);
                o.put("lat", p.lat);
                o.put("lng", p.lng);
                o.put("accuracyM", p.accuracyM);
                o.put("provider", p.provider == null ? JSONObject.NULL : p.provider);
                if (p.batteryPct != null) o.put("batteryPct", p.batteryPct);
                if (p.isCharging != null) o.put("isCharging", p.isCharging == 1);
                if (p.accuracyMode != null) o.put("accuracyMode", p.accuracyMode);
                arr.put(o);
                if (p.id != null) ids.add(p.id);
            }

            // We'll send the raw JSON array expected by the server
            String bodyString = arr.toString();

            // Read device credentials from Capacitor Preferences (try multiple SharedPreferences locations)
            String deviceId = null;
            String deviceToken = null;
            String[] candidatePrefs = new String[]{"capacitor.preferences", "CapacitorPreferences", "CapacitorStorage", "preferences"};
            for (String name : candidatePrefs) {
                try {
                    SharedPreferences p = getApplicationContext().getSharedPreferences(name, Context.MODE_PRIVATE);
                    if (deviceId == null) deviceId = p.getString("device_id", null);
                    if (deviceToken == null) deviceToken = p.getString("device_token", null);
                    if (deviceId != null && deviceToken != null) break;
                } catch (Exception ex) {
                    // ignore and try next
                }
            }
            // Also check default shared preferences
            if ((deviceId == null || deviceToken == null)) {
                try {
                    SharedPreferences def = PreferenceManager.getDefaultSharedPreferences(getApplicationContext());
                    if (deviceId == null) deviceId = def.getString("device_id", deviceId);
                    if (deviceToken == null) deviceToken = def.getString("device_token", deviceToken);
                } catch (Exception ex) {
                    // ignore
                }
            }

            // Construct request to server
            String serverUrl = getServerUrl();
            // The server expects an array directly; send the raw array to /ingest/locations
            RequestBody rb = RequestBody.create(bodyString, JSON);
            Request.Builder reqBuilder = new Request.Builder()
                    .url(serverUrl + "/ingest/locations")
                    .post(rb)
                    .addHeader("Content-Type", "application/json");
            if (deviceId != null) reqBuilder.addHeader("x-device-id", deviceId);
            if (deviceToken != null) reqBuilder.addHeader("x-device-token", deviceToken);

            // Add HMAC signature headers if deviceToken available
            if (deviceToken != null) {
                String timestamp = String.valueOf(System.currentTimeMillis());
                String method = "POST";
                String path = "/ingest/locations";
                String toSign = method + ":" + path + ":" + timestamp + ":" + bodyString;
                try {
                    String signature = hmacSha256Hex(deviceToken, toSign);
                    reqBuilder.addHeader("x-timestamp", timestamp);
                    reqBuilder.addHeader("x-signature", signature);
                } catch (Exception ex) {
                    // ignore signature failure and proceed with token header
                    ex.printStackTrace();
                }
            }

            Request request = reqBuilder.build();
            try (Response response = client.newCall(request).execute()) {
                if (response.isSuccessful()) {
                    if (ids.size() > 0) {
                        db.locationDao().markBatchAsUploaded(ids);
                    }
                    return Result.success();
                } else {
                    return Result.retry();
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
            return Result.retry();
        }
    }

    private String getServerUrl() {
        // Prefer a runtime-configured URL stored in SharedPreferences (so we don't need to rebuild)
        try {
            SharedPreferences prefs = getApplicationContext().getSharedPreferences("app_prefs", Context.MODE_PRIVATE);
            String runtime = prefs.getString("runtime_offsync_server_url", null);
            if (runtime != null && runtime.length() > 0) return runtime;
        } catch (Exception ex) {
            // ignore and fall back
        }
        return BuildConfig.OFFSYNC_SERVER_URL;
    }

    private static String hmacSha256Hex(String key, String data) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        SecretKeySpec secretKey = new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
        mac.init(secretKey);
        byte[] raw = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
        StringBuilder sb = new StringBuilder(raw.length * 2);
        for (byte b : raw) {
            sb.append(String.format("%02x", b & 0xff));
        }
        return sb.toString();
    }
}
