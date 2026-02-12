package com.offsync.app.db;

import androidx.room.ColumnInfo;
import androidx.room.Entity;
import androidx.room.PrimaryKey;

@Entity(tableName = "location_points")
public class LocationPointEntity {
    @PrimaryKey(autoGenerate = true)
    public Integer id;

    @ColumnInfo(name = "capturedAt")
    public String capturedAt;

    @ColumnInfo(name = "lat")
    public double lat;

    @ColumnInfo(name = "lng")
    public double lng;

    @ColumnInfo(name = "accuracyM")
    public double accuracyM;

    @ColumnInfo(name = "provider")
    public String provider;

    @ColumnInfo(name = "batteryPct")
    public Integer batteryPct;

    @ColumnInfo(name = "isCharging")
    public Integer isCharging; // 0/1 nullable

    @ColumnInfo(name = "accuracyMode")
    public String accuracyMode;

    @ColumnInfo(name = "isUploaded")
    public Integer isUploaded; // 0 = false, 1 = true

    public LocationPointEntity() {}
}
