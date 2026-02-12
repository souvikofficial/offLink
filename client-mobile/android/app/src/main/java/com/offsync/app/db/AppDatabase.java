package com.offsync.app.db;

import com.offsync.app.BuildConfig;

import androidx.room.Database;
import androidx.room.Room;
import androidx.room.RoomDatabase;
import android.content.Context;
import android.content.SharedPreferences;
import android.util.Base64;
import androidx.security.crypto.EncryptedSharedPreferences;
import androidx.security.crypto.MasterKey;
import net.sqlcipher.database.SupportFactory;
import java.security.SecureRandom;

@Database(entities = {LocationPointEntity.class, AuthorizedContactEntity.class}, version = 2, exportSchema = false)
public abstract class AppDatabase extends RoomDatabase {
    public abstract LocationDao locationDao();
    public abstract AuthorizedContactDao authorizedContactDao();

    private static volatile AppDatabase INSTANCE;
    private static final String PREFS_NAME = "secure_prefs";
    private static final String DB_SECRET_KEY = "db_secret";

    public static AppDatabase getInstance(Context context) {
        if (INSTANCE == null) {
            synchronized (AppDatabase.class) {
                if (INSTANCE == null) {
                    SupportFactory factory = getSupportFactory(context);
                    RoomDatabase.Builder<AppDatabase> builder = Room.databaseBuilder(context.getApplicationContext(),
                                AppDatabase.class, "offsync_native_db");
                    if (factory != null) {
                        builder = builder.openHelperFactory(factory);
                    }
                    // Add explicit migrations to preserve data; define MIGRATION_1_2 below
                    builder = builder.addMigrations(MIGRATION_1_2);
                    INSTANCE = builder.build();

                    // Seed a test authorized contact in debug builds if none exist
                    if (BuildConfig.DEBUG) {
                        new Thread(() -> {
                            try {
                                AuthorizedContactDao dao = INSTANCE.authorizedContactDao();
                                if (dao.count() == 0) {
                                    AuthorizedContactEntity test = new AuthorizedContactEntity();
                                    test.phoneE164 = "+15551234567";
                                    test.displayName = "Test Contact";
                                    test.enabled = true;
                                    test.createdAt = System.currentTimeMillis();
                                    dao.insert(test);
                                }
                            } catch (Exception e) {
                                e.printStackTrace();
                            }
                        }).start();
                    }
                }
            }
        }
        return INSTANCE;
    }

    // Migration from version 1 -> 2: create authorized_contacts table
    private static final androidx.room.migration.Migration MIGRATION_1_2 =
            new androidx.room.migration.Migration(1, 2) {
                @Override
                public void migrate(androidx.sqlite.db.SupportSQLiteDatabase database) {
                    database.execSQL("CREATE TABLE IF NOT EXISTS `authorized_contacts` (`id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, `phone_e164` TEXT, `display_name` TEXT, `enabled` INTEGER NOT NULL, `created_at` INTEGER NOT NULL)");
                    database.execSQL("CREATE UNIQUE INDEX IF NOT EXISTS `index_authorized_contacts_phone_e164` ON `authorized_contacts` (`phone_e164`)");
                }
            };

    private static SupportFactory getSupportFactory(Context context) {
        try {
            MasterKey masterKey = new MasterKey.Builder(context)
                    .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                    .build();

            SharedPreferences prefs = EncryptedSharedPreferences.create(
                    context,
                    PREFS_NAME,
                    masterKey,
                    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            );

            String secret = prefs.getString(DB_SECRET_KEY, null);
            if (secret == null) {
                byte[] pass = new byte[32];
                SecureRandom rnd = new SecureRandom();
                rnd.nextBytes(pass);
                secret = Base64.encodeToString(pass, Base64.NO_WRAP);
                prefs.edit().putString(DB_SECRET_KEY, secret).apply();
            }

            byte[] passphrase = secret.getBytes("UTF-8");
            return new SupportFactory(passphrase);
        } catch (Exception e) {
            // If any error occurs, fall back to unencrypted DB
            e.printStackTrace();
            return null;
        }
    }
}
