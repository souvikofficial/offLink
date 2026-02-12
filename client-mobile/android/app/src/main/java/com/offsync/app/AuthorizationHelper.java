package com.offsync.app;

import android.content.Context;
import com.google.i18n.phonenumbers.PhoneNumberUtil;
import com.google.i18n.phonenumbers.NumberParseException;
import com.google.i18n.phonenumbers.Phonenumber;
import com.offsync.app.db.AuthorizedContactDao;
import com.offsync.app.db.AppDatabase;
import com.offsync.app.db.AuthorizedContactEntity;

/**
 * Authorization helper using libphonenumber for normalization.
 * Normalizes input to E.164 when possible. If parsing fails, falls back to digit-only prefixed with '+'.
 */
public class AuthorizationHelper {
    private static final String DEFAULT_REGION = "IN"; // change if your default country differs

    public static String normalizePhone(String raw) {
        if (raw == null) return "";
        PhoneNumberUtil util = PhoneNumberUtil.getInstance();
        try {
            Phonenumber.PhoneNumber num = util.parse(raw, DEFAULT_REGION);
            if (util.isPossibleNumber(num)) {
                return util.format(num, PhoneNumberUtil.PhoneNumberFormat.E164);
            }
        } catch (NumberParseException e) {
            // fall through
        }
        // Fallback: strip non-digits and prefix +
        String digits = raw.replaceAll("[^0-9]", "");
        if (digits.isEmpty()) return "";
        return "+" + digits;
    }

    public static boolean isAuthorized(Context context, String senderRawNumber) {
        String norm = normalizePhone(senderRawNumber);
        if (norm.isEmpty()) return false;
        AppDatabase db = AppDatabase.getInstance(context);
        AuthorizedContactDao dao = db.authorizedContactDao();
        AuthorizedContactEntity found = dao.findByE164(norm);
        return found != null && found.enabled;
    }

    public static void addAuthorizedContact(Context context, String phoneE164, String displayName) {
        AppDatabase db = AppDatabase.getInstance(context);
        AuthorizedContactDao dao = db.authorizedContactDao();
        AuthorizedContactEntity ent = new AuthorizedContactEntity();
        ent.phoneE164 = phoneE164;
        ent.displayName = displayName;
        ent.enabled = true;
        ent.createdAt = System.currentTimeMillis();
        dao.insert(ent);
    }
}
