package com.offsync.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.telephony.SmsMessage
import android.telephony.SmsManager
import android.telephony.TelephonyManager
import android.util.Log
import androidx.work.Data
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import android.provider.Telephony

class SmsLocationReceiver : BroadcastReceiver() {
    private val TAG = "SmsLocationReceiver"
    private val KEY_SENDER = "sender"
    private val KEY_BODY = "body"
    // Maximum length accepted for auto-location requests (anti-spam)
    private val MAX_BODY_LENGTH = 240

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return

        val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
        if (messages == null || messages.isEmpty()) return

        // Reconstruct full body per originating address
        val grouped = mutableMapOf<String, StringBuilder>()
        for (msg in messages) {
            val sender = msg.originatingAddress ?: continue
            val body = msg.messageBody ?: ""
            val sb = grouped.getOrPut(sender) { StringBuilder() }
            sb.append(body)
        }

        val prefs = context.getSharedPreferences("offsync_prefs", Context.MODE_PRIVATE)
        val enabled = prefs.getBoolean("sms_location_enabled", true)
        val keyword = prefs.getString("sms_location_keyword", "Location") ?: "Location"

        for ((sender, sb) in grouped) {
            val body = sb.toString()
            if (body.length > MAX_BODY_LENGTH) {
                Log.d(TAG, "Skipping long SMS from $sender (length ${body.length})")
                continue
            }
            if (!body.contains(keyword, ignoreCase = true)) continue

            // Check runtime permissions quickly; if missing, show notification prompting the user
            val pm = ContextCompat.checkSelfPermission(context, android.Manifest.permission.RECEIVE_SMS) == android.content.pm.PackageManager.PERMISSION_GRANTED &&
                    ContextCompat.checkSelfPermission(context, android.Manifest.permission.SEND_SMS) == android.content.pm.PackageManager.PERMISSION_GRANTED &&
                    (ContextCompat.checkSelfPermission(context, android.Manifest.permission.ACCESS_COARSE_LOCATION) == android.content.pm.PackageManager.PERMISSION_GRANTED ||
                            ContextCompat.checkSelfPermission(context, android.Manifest.permission.ACCESS_FINE_LOCATION) == android.content.pm.PackageManager.PERMISSION_GRANTED)

            if (!enabled) {
                Log.d(TAG, "SMS Location feature disabled; ignoring request from $sender")
                continue
            }

            if (!pm) {
                NotificationHelper.showPermissionNotification(context)
                continue
            }

            // Enqueue background work to handle location + reply
            val input = Data.Builder()
                .putString(KEY_SENDER, sender)
                .putString(KEY_BODY, body)
                .build()

            val work = OneTimeWorkRequestBuilder<SmsLocationWorker>()
                .setInputData(input)
                .build()

            WorkManager.getInstance(context.applicationContext).enqueue(work)
        }
    }
}
