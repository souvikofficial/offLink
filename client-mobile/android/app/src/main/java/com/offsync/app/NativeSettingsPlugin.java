package com.offsync.app;

import android.content.Intent;
import android.net.Uri;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Native Capacitor plugin that opens the Android application details
 * settings page (Settings → Apps → Offsync → Permissions).
 *
 * Registered as "NativeSettings" to match the TypeScript
 * {@code registerPlugin<NativeSettingsPlugin>('NativeSettings')} call.
 */
@CapacitorPlugin(name = "NativeSettings")
public class NativeSettingsPlugin extends Plugin {

    @PluginMethod
    public void openSettings(PluginCall call) {
        try {
            if (getActivity() == null) {
                call.reject("Activity not available");
                return;
            }
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            intent.setData(Uri.parse("package:" + getActivity().getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getActivity().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to open settings", e);
        }
    }

    @PluginMethod
    public void openLocationSettings(PluginCall call) {
        try {
            if (getActivity() == null) {
                call.reject("Activity not available");
                return;
            }
            LocationPermissionHelper.openLocationSettings(getActivity());
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to open location settings", e);
        }
    }

    @PluginMethod
    public void isLocationEnabled(PluginCall call) {
        boolean enabled = LocationPermissionHelper.isLocationEnabled(getContext());
        JSObject ret = new JSObject();
        ret.put("enabled", enabled);
        call.resolve(ret);
    }
}
