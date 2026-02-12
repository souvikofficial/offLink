package com.offsync.app;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationManager;
import android.net.Uri;
import android.os.Build;
import android.provider.ContactsContract;
import android.provider.Settings;
import android.text.format.DateFormat;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

public final class LocationPermissionHelper {
    public static final int LOCATION_PERMISSION_REQUEST = 5010;
    public static final int PICK_CONTACT_REQUEST = 6010;
    private static final String[] LOCATION_PERMISSIONS = new String[] {
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION
    };

    private LocationPermissionHelper() {
    }

    public static boolean hasLocationPermissions(Context context) {
        if (context == null) return false;
        return ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION)
                == PackageManager.PERMISSION_GRANTED
                && ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION)
                == PackageManager.PERMISSION_GRANTED;
    }

    public static void requestLocationPermissions(Activity activity) {
        if (activity == null) return;
        ActivityCompat.requestPermissions(activity, LOCATION_PERMISSIONS, LOCATION_PERMISSION_REQUEST);
    }

    public static boolean isLocationEnabled(Context context) {
        if (context == null) return false;
        LocationManager locationManager =
                (LocationManager) context.getSystemService(Context.LOCATION_SERVICE);
        if (locationManager == null) return false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            return locationManager.isLocationEnabled();
        }
        return locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)
                || locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER);
    }

    public static void openLocationSettings(Activity activity) {
        if (activity == null) return;
        Intent intent = new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS);
        activity.startActivity(intent);
    }

    /**
     * Build a short SMS body for a location.
     * Example: "I'm here: https://maps.google.com/?q=12.34,56.78 (accuracy 5m) at 2/12/2026 3:30 PM"
     */
    public static String buildSmsMessage(Location location) {
        if (location == null) return "";
        double lat = location.getLatitude();
        double lng = location.getLongitude();
        StringBuilder sb = new StringBuilder();
        sb.append("I'm here: https://maps.google.com/?q=").append(lat).append(",").append(lng);
        if (location.hasAccuracy()) {
            sb.append(" (accuracy ").append(Math.round(location.getAccuracy())).append("m)");
        }
        long time = location.getTime();
        if (time > 0) {
            CharSequence date = DateFormat.getDateFormat(null).format(new java.util.Date(time));
            CharSequence timeOfDay = DateFormat.getTimeFormat(null).format(new java.util.Date(time));
            sb.append(" at ").append(date).append(" ").append(timeOfDay);
        }
        return sb.toString();
    }

    /**
     * Share location via SMS compose screen. If pickContact is true, starts a contact picker
     * (ContactsContract.CommonDataKinds.Phone) — the calling Activity should handle the result
     * and pass the selected number to {@link #shareViaSmsWithNumber(Activity, String, String)}.
     * If pickContact is false, opens the SMS composer (no recipient) with the message filled.
     */
    public static void shareViaSms(Activity activity, Location location, boolean pickContact) {
        if (activity == null || location == null) return;
        String body = buildSmsMessage(location);
        if (pickContact) {
            Intent pickIntent = new Intent(Intent.ACTION_PICK, ContactsContract.CommonDataKinds.Phone.CONTENT_URI);
            activity.startActivityForResult(pickIntent, PICK_CONTACT_REQUEST);
            return;
        }
        // Open SMS compose with body populated (no recipient)
        Intent intent = new Intent(Intent.ACTION_SENDTO);
        intent.setData(Uri.parse("smsto:")); // ensures only SMS apps handle this
        intent.putExtra("sms_body", body);
        if (intent.resolveActivity(activity.getPackageManager()) != null) {
            activity.startActivity(intent);
        }
    }

    /**
     * Share via SMS to a specific number. Number should be a plain phone number (or URI-encoded).
     */
    public static void shareViaSmsWithNumber(Activity activity, String number, String message) {
        if (activity == null || message == null) return;
        String uri = "smsto:" + (number == null ? "" : Uri.encode(number));
        Intent intent = new Intent(Intent.ACTION_SENDTO, Uri.parse(uri));
        intent.putExtra("sms_body", message);
        if (intent.resolveActivity(activity.getPackageManager()) != null) {
            activity.startActivity(intent);
        }
    }
}
