package com.offsync.app.db;

import androidx.room.Dao;
import androidx.room.Insert;
import androidx.room.OnConflictStrategy;
import androidx.room.Query;
import java.util.List;

@Dao
public interface LocationDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    long insert(LocationPointEntity point);

    @Query("SELECT * FROM location_points WHERE isUploaded = 0 ORDER BY capturedAt ASC LIMIT :limit")
    List<LocationPointEntity> getPending(int limit);

    @Query("UPDATE location_points SET isUploaded = 1 WHERE id IN (:ids)")
    void markBatchAsUploaded(List<Integer> ids);

    @Query("SELECT * FROM location_points ORDER BY capturedAt DESC LIMIT 1")
    LocationPointEntity getLatest();

    @Query("DELETE FROM location_points WHERE capturedAt < :ts")
    int deleteOlderThan(String ts);
}
