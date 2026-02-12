package com.offsync.app;

import android.content.Context;
import androidx.annotation.NonNull;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.offsync.app.db.AppDatabase;
import com.offsync.app.db.LocationPointEntity;
import androidx.work.OneTimeWorkRequest;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.NetworkType;
import java.util.concurrent.TimeUnit;
import com.offsync.app.work.LocationSyncWorker;
import androidx.security.crypto.EncryptedSharedPreferences;
import androidx.security.crypto.MasterKey;
import android.content.SharedPreferences;
import android.app.NotificationManager;
import android.app.NotificationChannel;
import android.app.PendingIntent;
import android.content.Intent;
import androidx.core.app.NotificationCompat;
import android.util.Base64;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

@CapacitorPlugin(name = "NativeSync")
public class NativeSyncPlugin extends Plugin {
    private static final String PREFS_NAME = "secure_prefs";
    private static final String DB_SECRET_KEY = "db_secret";

    @PluginMethod
    public void saveLocation(PluginCall call) {
        try {
            String capturedAt = call.getString("capturedAt");
            double lat = call.getDouble("lat");
            double lng = call.getDouble("lng");
            double accuracyM = call.getDouble("accuracyM");
            String provider = call.getString("provider");
            Integer batteryPct = call.hasOption("batteryPct") ? (int) call.getInt("batteryPct", 0) : null;
            Boolean isCharging = call.hasOption("isCharging") ? call.getBoolean("isCharging", false) : null;
            String accuracyMode = call.getString("accuracyMode");

            Context ctx = getContext();
            AppDatabase db = AppDatabase.getInstance(ctx);
            LocationPointEntity e = new LocationPointEntity();
            e.capturedAt = capturedAt;
            e.lat = lat;
            e.lng = lng;
            e.accuracyM = accuracyM;
            e.provider = provider;
            e.batteryPct = batteryPct;
            e.isCharging = isCharging == null ? null : (isCharging ? 1 : 0);
            e.accuracyMode = accuracyMode;
            e.isUploaded = 0;

            // Insert on background thread
            new Thread(() -> {
                db.locationDao().insert(e);
                // Trigger a one-off sync that only runs when network is connected
                Constraints constraints = new Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build();
                OneTimeWorkRequest req = new OneTimeWorkRequest.Builder(LocationSyncWorker.class)
                    .setConstraints(constraints)
                    .build();
                WorkManager.getInstance(ctx).enqueue(req);

                // Ensure a periodic sync is scheduled (15 minute interval minimum)
                PeriodicWorkRequest periodic = new PeriodicWorkRequest.Builder(LocationSyncWorker.class, 15, TimeUnit.MINUTES)
                    .setConstraints(constraints)
                    .build();
                WorkManager.getInstance(ctx).enqueueUniquePeriodicWork(
                    "offsync_periodic_sync",
                    ExistingPeriodicWorkPolicy.KEEP,
                    periodic
                );
            }).start();

            JSObject ret = new JSObject();
            ret.put("saved", true);
            call.resolve(ret);
        } catch (Exception ex) {
            call.reject("Failed to save location", ex);
        }
    }

    @PluginMethod
    public void getEncryptionKey(PluginCall call) {
        try {
            Context ctx = getContext();
            MasterKey masterKey = new MasterKey.Builder(ctx)
                    .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                    .build();

            SharedPreferences prefs = EncryptedSharedPreferences.create(
                    ctx,
                    PREFS_NAME,
                    masterKey,
                    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            );

            String secret = prefs.getString(DB_SECRET_KEY, null);
            if (secret == null) {
                byte[] pass = new byte[32];
                SecureRandom rnd = new SecureRandom();
                rnd.nextBytes(pass);
                secret = Base64.encodeToString(pass, Base64.NO_WRAP);
                prefs.edit().putString(DB_SECRET_KEY, secret).apply();
            }

            JSObject ret = new JSObject();
            ret.put("secret", secret);
            call.resolve(ret);
        } catch (Exception ex) {
            call.reject("Failed to obtain encryption key", ex);
        }
    }

    @PluginMethod
    public void pruneOldPoints(PluginCall call) {
        try {
            int maxAgeDays = (int) call.getInt("maxAgeDays", 90);
            Instant cutoff = Instant.now().minus(maxAgeDays, ChronoUnit.DAYS);
            String cutoffIso = cutoff.toString();

            Context ctx = getContext();
            AppDatabase db = AppDatabase.getInstance(ctx);

            new Thread(() -> {
                int deleted = db.locationDao().deleteOlderThan(cutoffIso);
                JSObject ret = new JSObject();
                ret.put("deleted", deleted);
                call.resolve(ret);
            }).start();
        } catch (Exception ex) {
            call.reject("Failed to prune old points", ex);
        }
    }

    @PluginMethod
    public void setServerUrl(PluginCall call) {
        try {
            String url = call.getString("url");
            if (url == null) {
                call.reject("Missing url");
                return;
            }
            Context ctx = getContext();
            SharedPreferences prefs = ctx.getSharedPreferences("app_prefs", Context.MODE_PRIVATE);
            prefs.edit().putString("runtime_offsync_server_url", url).apply();
            JSObject ret = new JSObject();
            ret.put("saved", true);
            call.resolve(ret);
        } catch (Exception ex) {
            call.reject("Failed to set server URL", ex);
        }
    }

    @PluginMethod
    public void getServerUrl(PluginCall call) {
        try {
            Context ctx = getContext();
            SharedPreferences prefs = ctx.getSharedPreferences("app_prefs", Context.MODE_PRIVATE);
            String url = prefs.getString("runtime_offsync_server_url", null);
            JSObject ret = new JSObject();
            ret.put("url", url);
            call.resolve(ret);
        } catch (Exception ex) {
            call.reject("Failed to get server URL", ex);
        }
    }

    @PluginMethod
    public void clearServerUrl(PluginCall call) {
        try {
            Context ctx = getContext();
            SharedPreferences prefs = ctx.getSharedPreferences("app_prefs", Context.MODE_PRIVATE);
            prefs.edit().remove("runtime_offsync_server_url").apply();
            JSObject ret = new JSObject();
            ret.put("cleared", true);
            call.resolve(ret);
        } catch (Exception ex) {
            call.reject("Failed to clear server URL", ex);
        }
    }

    @PluginMethod
    public void checkAndConsumeOpenDevFlag(PluginCall call) {
        try {
            Context ctx = getContext();
            SharedPreferences prefs = ctx.getSharedPreferences("app_prefs", Context.MODE_PRIVATE);
            boolean flag = prefs.getBoolean("open_dev_settings", false);
            if (flag) {
                prefs.edit().remove("open_dev_settings").apply();
            }
            JSObject ret = new JSObject();
            ret.put("openDev", flag);
            call.resolve(ret);
        } catch (Exception ex) {
            call.reject("Failed to read openDev flag", ex);
        }
    }

    @PluginMethod
    public void setDeveloperMode(PluginCall call) {
        try {
            boolean enabled = call.getBoolean("enabled", false);
            Context ctx = getContext();
            SharedPreferences prefs = ctx.getSharedPreferences("app_prefs", Context.MODE_PRIVATE);
            prefs.edit().putBoolean("developer_mode", enabled).apply();
            JSObject ret = new JSObject();
            ret.put("developerMode", enabled);
            call.resolve(ret);
        } catch (Exception ex) {
            call.reject("Failed to set developer mode", ex);
        }
    }

    @PluginMethod
    public void getDeveloperMode(PluginCall call) {
        try {
            Context ctx = getContext();
            SharedPreferences prefs = ctx.getSharedPreferences("app_prefs", Context.MODE_PRIVATE);
            boolean enabled = prefs.getBoolean("developer_mode", false);
            JSObject ret = new JSObject();
            ret.put("developerMode", enabled);
            call.resolve(ret);
        } catch (Exception ex) {
            call.reject("Failed to get developer mode", ex);
        }
    }

    @PluginMethod
    public void createDevNotification(PluginCall call) {
        try {
            Context ctx = getContext();
            NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            String channelId = "offsync_dev";
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                NotificationChannel ch = new NotificationChannel(channelId, "Offsync Dev", NotificationManager.IMPORTANCE_LOW);
                nm.createNotificationChannel(ch);
            }

            Intent intent = new Intent(ctx, Class.forName(ctx.getPackageName() + ".MainActivity"));
            intent.putExtra("openDevSettings", true);
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);

            PendingIntent pi = PendingIntent.getActivity(ctx, 12345, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

            NotificationCompat.Builder nb = new NotificationCompat.Builder(ctx, channelId)
                    .setSmallIcon(ctx.getApplicationInfo().icon)
                    .setContentTitle("Offsync Dev")
                    .setContentText("Open developer settings")
                    .setPriority(NotificationCompat.PRIORITY_LOW)
                    .setContentIntent(pi)
                    .setAutoCancel(true);

            nm.notify(424242, nb.build());

            JSObject ret = new JSObject();
            ret.put("notified", true);
            call.resolve(ret);
        } catch (Exception ex) {
            call.reject("Failed to create dev notification", ex);
        }
    }
}
