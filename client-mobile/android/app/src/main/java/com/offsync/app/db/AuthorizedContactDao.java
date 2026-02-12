package com.offsync.app.db;

import androidx.room.Dao;
import androidx.room.Insert;
import androidx.room.OnConflictStrategy;
import androidx.room.Query;
import androidx.room.Update;
import java.util.List;

@Dao
public interface AuthorizedContactDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    long insert(AuthorizedContactEntity contact);

    @Update
    void update(AuthorizedContactEntity contact);

    @Query("SELECT * FROM authorized_contacts WHERE phone_e164 = :e164 LIMIT 1")
    AuthorizedContactEntity findByE164(String e164);

    @Query("SELECT COUNT(*) FROM authorized_contacts")
    int count();

    @Query("SELECT * FROM authorized_contacts WHERE enabled = 1")
    List<AuthorizedContactEntity> getEnabled();
}
