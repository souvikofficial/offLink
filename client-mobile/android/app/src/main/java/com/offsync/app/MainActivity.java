package com.offsync.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final int LOCATION_PERMISSION_REQUEST =
            LocationPermissionHelper.LOCATION_PERMISSION_REQUEST;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register custom plugins before super.onCreate
        registerPlugin(NativeSettingsPlugin.class);
        registerPlugin(NativeSyncPlugin.class);
        registerPlugin(NativeSmsPlugin.class);
        super.onCreate(savedInstanceState);
        // If launched with intent extra `openDevSettings`, set a SharedPreferences flag
        try {
            if (getIntent() != null && getIntent().getBooleanExtra("openDevSettings", false)) {
                android.content.SharedPreferences prefs = getSharedPreferences("app_prefs", MODE_PRIVATE);
                prefs.edit().putBoolean("open_dev_settings", true).apply();
            }
        } catch (Exception ex) {
            // ignore
        }
    }

    /**
     * Runtime permission hook for ACCESS_FINE_LOCATION + ACCESS_COARSE_LOCATION.
     * Call this from native code when a location operation is about to run.
     */
    public void requestLocationPermissionsIfNeeded() {
        if (!LocationPermissionHelper.hasLocationPermissions(this)) {
            LocationPermissionHelper.requestLocationPermissions(this);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == LOCATION_PERMISSION_REQUEST) {
            // Result handled by the caller after re-checking permissions.
        }
    }
}
