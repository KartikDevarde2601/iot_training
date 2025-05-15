import { open, DB, QueryResult } from "@op-engineering/op-sqlite"
import { TABLE } from "./db_table"

export class DatabaseService {
  private readonly db_config = {
    name: "sensorDB",
  }

  private database: DB | null = null
  private static instance: DatabaseService | null = null

  private constructor() {}

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService()
    }
    return DatabaseService.instance
  }

  async initDatabase() {
    try {
      this.database = await open(this.db_config)

      if (this.database) {
        await this.database.execute(`
  -- Session table (parent)
  CREATE TABLE IF NOT EXISTS ${TABLE.session} (
    session_id INTEGER PRIMARY KEY AUTOINCREMENT,
    time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    action_type TEXT
  );

  -- IMU table (child)
  CREATE TABLE IF NOT EXISTS ${TABLE.imu_data} (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER,
    timestamp INTEGER,
    accel_x REAL,
    accel_y REAL,
    accel_z REAL,
    gyro_x REAL,
    gyro_y REAL,
    gyro_z REAL,
    FOREIGN KEY(session_id) REFERENCES ${TABLE.session}(session_id) ON DELETE CASCADE
  );

  -- EXG table (child)
  CREATE TABLE IF NOT EXISTS ${TABLE.exg_data} (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER,
    timestamp INTEGER,
    value REAL,
    FOREIGN KEY(session_id) REFERENCES ${TABLE.session}(session_id) ON DELETE CASCADE
  );

  -- Indexes for better query performance
  CREATE INDEX IF NOT EXISTS idx_session_time ON ${TABLE.session}(time);
  CREATE INDEX IF NOT EXISTS idx_imu_session_id ON ${TABLE.imu_data}(session_id);
  CREATE INDEX IF NOT EXISTS idx_exg_session_id ON ${TABLE.exg_data}(session_id);
`)
      }
    } catch (error) {
      console.error("Error initializing database", error)
      throw error
    }
  }

  async close(): Promise<void> {
    try {
      if (this.database) {
        await this.database.close()
        this.database = null
      }
    } catch (error) {
      console.error("Error closing database", error)
      throw error
    }
  }

  async executeQuery<T>(query: string, params: any[] = []): Promise<QueryResult> {
    if (!this.database) {
      throw new Error("Database not initialized")
    }

    const results = await this.database.execute(query, params)
    return results as QueryResult
  }

  async transaction<T>(query: string): Promise<T> {
    if (!this.database) {
      throw new Error("Database not initialized")
    }

    return (await this.database.transaction(async (tx) => {
      try {
        await tx.execute(query)
        await tx.commit()
      } catch (error) {
        console.error("Error executing transaction", error)
        await tx.rollback()
        throw error
      }
    })) as unknown as T
  }
}
