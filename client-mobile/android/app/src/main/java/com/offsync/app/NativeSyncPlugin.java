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

@CapacitorPlugin(name = "NativeSync")
public class NativeSyncPlugin extends Plugin {

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
}
