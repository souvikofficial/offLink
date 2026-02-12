package com.offsync.app

import org.junit.Assert.*
import org.junit.Test

class AuthorizationHelperTest {
    @Test
    fun testNormalizeE164() {
        val raw = "+1 555-123-4567"
        val out = AuthorizationHelper.normalizePhone(raw)
        assertEquals("+15551234567", out)
    }

    @Test
    fun testNormalizeLocalNumber() {
        // Assuming DEFAULT_REGION = IN (India) in helper
        val raw = "9123456789"
        val out = AuthorizationHelper.normalizePhone(raw)
        // For Indian 10-digit, libphonenumber will parse as +91...
        assertTrue(out.startsWith("+91"))
    }

    @Test
    fun testFallback() {
        val raw = "(555) 444 3333"
        val out = AuthorizationHelper.normalizePhone(raw)
        assertTrue(out.startsWith("+"))
    }
}
