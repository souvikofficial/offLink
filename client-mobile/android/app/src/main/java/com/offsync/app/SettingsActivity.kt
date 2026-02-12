package com.offsync.app

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.EditText
import android.widget.ListView
import android.widget.Switch
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.offsync.app.db.AppDatabase
import com.offsync.app.db.AuthorizedContactEntity

class SettingsActivity : AppCompatActivity() {
    private val REQ_PERMS = 1001
    private lateinit var etKeyword: EditText
    private lateinit var switchEnabled: Switch
    private lateinit var etNumber: EditText
    private lateinit var btnAdd: Button
    private lateinit var listNumbers: ListView
    private lateinit var btnRequestPerms: Button
    private lateinit var adapter: ArrayAdapter<String>
    private val items = mutableListOf<String>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        NotificationHelper.ensureChannel(this)
        setContentView(R.layout.activity_settings)

        etKeyword = findViewById(R.id.etKeyword)
        switchEnabled = findViewById(R.id.switchEnabled)
        etNumber = findViewById(R.id.etNumber)
        btnAdd = findViewById(R.id.btnAdd)
        listNumbers = findViewById(R.id.listNumbers)
        btnRequestPerms = findViewById(R.id.btnRequestPerms)

        adapter = ArrayAdapter(this, android.R.layout.simple_list_item_1, items)
        listNumbers.adapter = adapter

        val prefs = getSharedPreferences("offsync_prefs", MODE_PRIVATE)
        val keyword = prefs.getString("sms_location_keyword", "Location") ?: "Location"
        val enabled = prefs.getBoolean("sms_location_enabled", true)
        etKeyword.setText(keyword)
        switchEnabled.isChecked = enabled

        loadContacts()

        btnAdd.setOnClickListener {
            val num = etNumber.text.toString().trim()
            if (num.isNotEmpty()) {
                addContact(num)
                etNumber.setText("")
            }
        }

        listNumbers.setOnItemLongClickListener { _, _, pos, _ ->
            val v = items[pos]
            // delete by E164 stored string
            deleteContact(v)
            true
        }

        switchEnabled.setOnCheckedChangeListener { _, checked ->
            prefs.edit().putBoolean("sms_location_enabled", checked).apply()
        }

        etKeyword.setOnFocusChangeListener { _, hasFocus ->
            if (!hasFocus) {
                prefs.edit().putString("sms_location_keyword", etKeyword.text.toString()).apply()
            }
        }

        btnRequestPerms.setOnClickListener {
            requestNeededPermissions()
        }
    }

    private fun loadContacts() {
        Thread {
            try {
                val dao = AppDatabase.getInstance(applicationContext).authorizedContactDao()
                val list = dao.getEnabled()
                items.clear()
                for (c in list) items.add(c.phoneE164)
                runOnUiThread { adapter.notifyDataSetChanged() }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }.start()
    }

    private fun addContact(raw: String) {
        Thread {
            try {
                val norm = AuthorizationHelper.normalizePhone(raw)
                val ent = AuthorizedContactEntity()
                ent.phoneE164 = norm
                ent.displayName = ""
                ent.enabled = true
                ent.createdAt = System.currentTimeMillis()
                val dao = AppDatabase.getInstance(applicationContext).authorizedContactDao()
                dao.insert(ent)
                runOnUiThread {
                    items.add(norm)
                    adapter.notifyDataSetChanged()
                }
            } catch (e: Exception) { e.printStackTrace() }
        }.start()
    }

    private fun deleteContact(e164: String) {
        Thread {
            try {
                val dao = AppDatabase.getInstance(applicationContext).authorizedContactDao()
                val ent = dao.findByE164(e164)
                if (ent != null) dao.update(ent.also { it.enabled = false })
                runOnUiThread {
                    items.remove(e164)
                    adapter.notifyDataSetChanged()
                }
            } catch (e: Exception) { e.printStackTrace() }
        }.start()
    }

    private fun requestNeededPermissions() {
        val perms = mutableListOf<String>()
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECEIVE_SMS) != PackageManager.PERMISSION_GRANTED) perms.add(Manifest.permission.RECEIVE_SMS)
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.SEND_SMS) != PackageManager.PERMISSION_GRANTED) perms.add(Manifest.permission.SEND_SMS)
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) perms.add(Manifest.permission.ACCESS_COARSE_LOCATION)
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) perms.add(Manifest.permission.ACCESS_FINE_LOCATION)
        // Background location is special on newer Android; request if present
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_BACKGROUND_LOCATION) != PackageManager.PERMISSION_GRANTED) perms.add(Manifest.permission.ACCESS_BACKGROUND_LOCATION)
        }

        if (perms.isEmpty()) return
        ActivityCompat.requestPermissions(this, perms.toTypedArray(), REQ_PERMS)
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        // no-op (user can re-open settings for more info)
    }
}
