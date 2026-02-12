package com.offsync.app.db;

import androidx.room.ColumnInfo;
import androidx.room.Entity;
import androidx.room.PrimaryKey;

@Entity(tableName = "authorized_contacts")
public class AuthorizedContactEntity {
    @PrimaryKey(autoGenerate = true)
    public long id;

    @ColumnInfo(name = "phone_e164")
    public String phoneE164;

    @ColumnInfo(name = "display_name")
    public String displayName;

    @ColumnInfo(name = "enabled")
    public boolean enabled = true;

    @ColumnInfo(name = "created_at")
    public long createdAt = System.currentTimeMillis();
}
