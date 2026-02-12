package com.offsync.app;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.pm.PackageManager;
import android.telephony.SmsManager;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.ContactsContract;
import android.content.SharedPreferences;
import android.preference.PreferenceManager;
import android.provider.Telephony;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NativeSms")
public class NativeSmsPlugin extends Plugin {
    private static final int SMS_PERMISSION_REQUEST = 7010;
    private static final int PICK_CONTACT_REQUEST = 7011;
    private PluginCall pendingPermissionCall = null;
    private PluginCall pendingPickCall = null;
    private static final String PREF_KEY_SAVED_NUMBER = "native_sms_saved_number";

    @PluginMethod
    public void hasSendSmsPermission(PluginCall call) {
        Context ctx = getContext();
        boolean granted = ContextCompat.checkSelfPermission(ctx, Manifest.permission.SEND_SMS) == PackageManager.PERMISSION_GRANTED;
        JSObject ret = new JSObject();
        ret.put("value", granted);
        call.resolve(ret);
    }

    @PluginMethod
    public void openDefaultSmsSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Telephony.Sms.Intents.ACTION_CHANGE_DEFAULT);
            intent.putExtra(Telephony.Sms.Intents.EXTRA_PACKAGE_NAME, getContext().getPackageName());
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to open default SMS app settings", e);
        }
    }

    @PluginMethod
    public void requestSendSmsPermission(PluginCall call) {
        Context ctx = getContext();
        if (ContextCompat.checkSelfPermission(ctx, Manifest.permission.SEND_SMS) == PackageManager.PERMISSION_GRANTED) {
            JSObject ret = new JSObject();
            ret.put("granted", true);
            call.resolve(ret);
            return;
        }

        // Store pending call and request permission
        pendingPermissionCall = call;
        ActivityCompat.requestPermissions(getActivity(), new String[]{Manifest.permission.SEND_SMS}, SMS_PERMISSION_REQUEST);
    }

    @PluginMethod
    public void sendSmsSilent(PluginCall call) {
        String number = call.getString("number");
        String message = call.getString("message");
        if (number == null || message == null) {
            call.reject("number and message are required");
            return;
        }

        Context ctx = getContext();
        if (ContextCompat.checkSelfPermission(ctx, Manifest.permission.SEND_SMS) != PackageManager.PERMISSION_GRANTED) {
            call.reject("SEND_SMS permission not granted");
            return;
        }

        try {
            SmsManager smsManager = SmsManager.getDefault();
            smsManager.sendTextMessage(number, null, message, null, null);
            JSObject ret = new JSObject();
            ret.put("sent", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to send SMS", e);
        }
    }

    @PluginMethod
    public void pickContact(PluginCall call) {
        // Start contact picker for phone numbers
        Intent pickIntent = new Intent(Intent.ACTION_PICK, ContactsContract.CommonDataKinds.Phone.CONTENT_URI);
        try {
            pendingPickCall = call;
            getActivity().startActivityForResult(pickIntent, PICK_CONTACT_REQUEST);
        } catch (Exception e) {
            pendingPickCall = null;
            call.reject("Failed to start contact picker", e);
        }
    }

    @PluginMethod
    public void getSavedNumber(PluginCall call) {
        SharedPreferences prefs = PreferenceManager.getDefaultSharedPreferences(getContext());
        String num = prefs.getString(PREF_KEY_SAVED_NUMBER, null);
        JSObject ret = new JSObject();
        ret.put("number", num);
        call.resolve(ret);
    }

    @PluginMethod
    public void clearSavedNumber(PluginCall call) {
        SharedPreferences prefs = PreferenceManager.getDefaultSharedPreferences(getContext());
        prefs.edit().remove(PREF_KEY_SAVED_NUMBER).apply();
        call.resolve();
    }

    // Handle activity result for contact picker
    @Override
    protected void handleOnActivityResult(int requestCode, int resultCode, Intent data) {
        super.handleOnActivityResult(requestCode, resultCode, data);
        if (requestCode == PICK_CONTACT_REQUEST) {
            if (pendingPickCall == null) return;
            if (resultCode != Activity.RESULT_OK || data == null) {
                pendingPickCall.reject("Contact pick cancelled");
                pendingPickCall = null;
                return;
            }

            Uri contactUri = data.getData();
            String[] projection = {ContactsContract.CommonDataKinds.Phone.NUMBER};
            Cursor cursor = getActivity().getContentResolver().query(contactUri, projection, null, null, null);
            if (cursor != null) {
                try {
                    if (cursor.moveToFirst()) {
                        int idx = cursor.getColumnIndexOrThrow(ContactsContract.CommonDataKinds.Phone.NUMBER);
                        String number = cursor.getString(idx);
                        // Save number
                        SharedPreferences prefs = PreferenceManager.getDefaultSharedPreferences(getContext());
                        prefs.edit().putString(PREF_KEY_SAVED_NUMBER, number).apply();
                        JSObject ret = new JSObject();
                        ret.put("number", number);
                        pendingPickCall.resolve(ret);
                    } else {
                        pendingPickCall.reject("No number found");
                    }
                } finally {
                    cursor.close();
                }
            } else {
                pendingPickCall.reject("Failed to read contact");
            }
            pendingPickCall = null;
        }
    }

    // Handle permission request result
    @Override
    protected void handleRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.handleRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == SMS_PERMISSION_REQUEST) {
            if (pendingPermissionCall == null) return;
            boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
            JSObject ret = new JSObject();
            ret.put("granted", granted);
            if (granted) pendingPermissionCall.resolve(ret); else pendingPermissionCall.reject("Permission denied");
            pendingPermissionCall = null;
        }
    }
}
