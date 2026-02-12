#!/usr/bin/env bash
set -euo pipefail

# This script runs on the GitHub Actions runner after emulator is started.
# It installs the debug APK, grants runtime permissions, sends an SMS to the emulator
# and then checks the emulator's Sent SMS box for a reply containing the maps link.

APK_PATH="app/build/outputs/apk/debug/app-debug.apk"
if [ ! -f "$APK_PATH" ]; then
  echo "APK not found at $APK_PATH"
  exit 2
fi

# Wait for adb device
echo "Waiting for emulator to be ready..."
adb wait-for-device
sleep 5

# Install APK
echo "Installing APK..."
adb install -r "$APK_PATH"

PACKAGE=com.offsync.app

# Grant permissions
echo "Granting runtime permissions..."
adb shell pm grant $PACKAGE android.permission.RECEIVE_SMS || true
adb shell pm grant $PACKAGE android.permission.SEND_SMS || true
adb shell pm grant $PACKAGE android.permission.ACCESS_COARSE_LOCATION || true
adb shell pm grant $PACKAGE android.permission.ACCESS_FINE_LOCATION || true
adb shell pm grant $PACKAGE android.permission.ACCESS_BACKGROUND_LOCATION || true

# Trigger a short delay to let app initialize
sleep 3

# Insert authorized contact into Room DB so the app will accept the test SMS
# Use run-as to operate as the app user (requires debuggable APK)
TEST_SENDER=+1234567890
echo "Seeding authorized contact $TEST_SENDER into app DB"
adb shell "run-as com.offsync.app sqlite3 /data/data/com.offsync.app/databases/offsync_native_db \"INSERT OR IGNORE INTO authorized_contacts (phone_e164, display_name, enabled, created_at) VALUES ('${TEST_SENDER}', 'CI Test', 1, (strftime('%s','now') * 1000));\"" || true

# Small pause to let DB write flush
sleep 1

# Send SMS to emulator with keyword 'Location'
TEST_BODY="Location"
echo "Sending SMS from $TEST_SENDER -> emulator"
adb emu sms send "$TEST_SENDER" "$TEST_BODY"

# Wait for worker to process and send reply
REPLY_FOUND=0
MAX_WAIT=30
COUNT=0
while [ $COUNT -lt $MAX_WAIT ]; do
  echo "Checking Sent SMS (attempt $((COUNT+1)))..."
  # Query sent messages
  OUT=$(adb shell content query --uri content://sms/sent || true)
  if echo "$OUT" | grep -q "https://maps.google.com/?q=" ; then
    echo "Reply found in Sent box"
    REPLY_FOUND=1
    break
  fi
  sleep 1
  COUNT=$((COUNT+1))
done

if [ "$REPLY_FOUND" -eq 1 ]; then
  echo "E2E success: reply was sent."
  exit 0
else
  echo "E2E failure: no reply found in Sent SMS after $MAX_WAIT seconds."
  echo "Dumping SMS inbox and sent for debugging:"
  adb shell content query --uri content://sms/inbox || true
  adb shell content query --uri content://sms/sent || true
  exit 3
fi
