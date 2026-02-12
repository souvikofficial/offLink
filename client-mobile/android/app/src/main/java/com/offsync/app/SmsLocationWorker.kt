package com.offsync.app

import android.Manifest
import android.content.Context
import android.location.Location
import android.location.LocationManager
import android.telephony.SmsManager
import android.util.Log
import android.content.pm.PackageManager
import android.Manifest
import androidx.core.content.ContextCompat
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.Tasks
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.concurrent.TimeUnit

class SmsLocationWorker(appContext: Context, params: WorkerParameters) : CoroutineWorker(appContext, params) {
    private val TAG = "SmsLocationWorker"
    private val LOCATION_TIMEOUT_SEC = 8L

    override suspend fun doWork(): Result {
        val sender = inputData.getString("sender") ?: return Result.success()
        val body = inputData.getString("body") ?: ""

        // Quick anti-abuse: small body already enforced by receiver
        // Authorization check
        try {
            if (!AuthorizationHelper.isAuthorized(applicationContext, sender)) {
                Log.d(TAG, "Sender not authorized: $sender")
                return Result.success()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Auth check failed", e)
            return Result.success()
        }

        // Check location permission
        val fine = ContextCompat.checkSelfPermission(applicationContext, Manifest.permission.ACCESS_FINE_LOCATION) == android.content.pm.PackageManager.PERMISSION_GRANTED
        val coarse = ContextCompat.checkSelfPermission(applicationContext, Manifest.permission.ACCESS_COARSE_LOCATION) == android.content.pm.PackageManager.PERMISSION_GRANTED
        if (!fine && !coarse) {
            sendSms(applicationContext, sender, "Location permission not granted on device.")
            return Result.success()
        }

        // Check if location providers enabled
        val lm = applicationContext.getSystemService(Context.LOCATION_SERVICE) as LocationManager
        val gpsEnabled = try { lm.isProviderEnabled(LocationManager.GPS_PROVIDER) } catch (e: Exception) { false }
        val netEnabled = try { lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER) } catch (e: Exception) { false }
        if (!gpsEnabled && !netEnabled) {
            sendSms(applicationContext, sender, "Location is OFF, please enable location on the device")
            return Result.success()
        }

        val fused = LocationServices.getFusedLocationProviderClient(applicationContext)
        var location: Location? = null
        try {
            val task = fused.getCurrentLocation(Priority.PRIORITY_BALANCED_POWER_ACCURACY, null)
            location = Tasks.await(task, LOCATION_TIMEOUT_SEC, TimeUnit.SECONDS)
        } catch (e: Exception) {
            Log.w(TAG, "Balanced attempt failed: ${e.message}")
        }

        if (location == null) {
            try {
                val task = fused.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, null)
                location = Tasks.await(task, LOCATION_TIMEOUT_SEC * 2, TimeUnit.SECONDS)
            } catch (e: Exception) {
                Log.w(TAG, "High accuracy attempt failed: ${e.message}")
            }
        }

        if (location == null) {
            sendSms(applicationContext, sender, "Unable to get location right now. Try again.")
            return Result.success()
        }

        val lat = location.latitude
        val lon = location.longitude
        val acc = if (location.hasAccuracy()) location.accuracy else -1f
        val providerRaw = location.provider ?: "unknown"
        val providerLabel = when (providerRaw.lowercase()) {
            LocationManager.GPS_PROVIDER -> "gps"
            LocationManager.NETWORK_PROVIDER -> "network"
            "fused" -> "fused"
            else -> providerRaw
        }

        // Local time from location timestamp if available, otherwise now
        val timeMillis = if (location.time > 0) location.time else System.currentTimeMillis()
        val localTime = Instant.ofEpochMilli(timeMillis).atZone(ZoneId.systemDefault())
            .format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss z"))

        val maps = "https://maps.google.com/?q=$lat,$lon"
        val accuracyLine = if (acc >= 0f) "Accuracy: ${acc}m" else "Accuracy: unknown"
        val message = "My location: $maps\n$accuracyLine\nTime: $localTime\nSource: $providerLabel"
        sendSms(applicationContext, sender, message)

        return Result.success()
    }

    private fun sendSms(context: Context, to: String, body: String) {
        try {
            if (ContextCompat.checkSelfPermission(context, Manifest.permission.SEND_SMS) != PackageManager.PERMISSION_GRANTED) {
                NotificationHelper.showPermissionNotification(context)
                Log.w(TAG, "SEND_SMS permission missing; notifying user")
                return
            }

            val sms = SmsManager.getDefault()
            val parts = sms.divideMessage(body)
            if (parts.size > 1) {
                sms.sendMultipartTextMessage(to, null, parts, null, null)
            } else {
                sms.sendTextMessage(to, null, body, null, null)
            }
            Log.d(TAG, "Sent SMS to $to")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to send SMS to $to", e)
        }
    }
}
