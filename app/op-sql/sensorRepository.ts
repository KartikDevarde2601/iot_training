import { DB, QueryResult } from "@op-engineering/op-sqlite"
import { DatabaseService } from "./databaseRepository"
import { TABLE } from "./db_table"

interface IMUData {
  timestamp: number
  accel_magnitude_ms2: number
  gyro_magnitude_dps: number
  pitch_deg: number
  roll_deg: number
  session_id: number
}

interface EXG {
  timestamp: number
  latest_emg_envelope: number
  latest_emg_mav: number
  latest_emg_rms: number
  session_id: number
}

export class sensorRepository {
  private db: DatabaseService

  constructor() {
    this.db = DatabaseService.getInstance()
  }

  async insertSession(
    data: { timestamp: number; action: string },
    tablename: string,
  ): Promise<QueryResult> {
    const query = `INSERT INTO ${tablename} 
      (time,action_type) 
      VALUES (?, ?)`

    try {
      const result = await this.db.executeQuery(query, [data.timestamp, data.action])

      return result as QueryResult
    } catch (error) {
      console.error(`insertIMU Error:`, error)
      throw new Error(`Failed to insert IMU data: ${(error as Error).message}`)
    }
  }

  async insertIMU(data: IMUData, tablename: string): Promise<QueryResult> {
    const query = `INSERT INTO ${tablename} 
      (session_id,timestamp, accel_magnitude_ms2, gyro_magnitude_dps, pitch_deg, roll_deg) 
      VALUES (?, ?, ?, ?, ?, ?)`

    try {
      if (!this.db) {
        throw new Error("Database is not initialized")
      }

      const result = await this.db.executeQuery(query, [
        data.session_id,
        data.timestamp,
        data.accel_magnitude_ms2,
        data.gyro_magnitude_dps,
        data.pitch_deg,
        data.roll_deg,
      ])

      return result
    } catch (error) {
      console.error(`insertIMU Error:`, error)
      throw new Error(`Failed to insert IMU data: ${(error as Error).message}`)
    }
  }

  async insertEXG(data: EXG, tablename: string): Promise<QueryResult> {
    const query = `INSERT INTO ${tablename} (session_id,timestamp, latest_emg_envelope,latest_emg_mav,latest_emg_rms) VALUES (?, ?,?,?,?)`

    try {
      if (!this.db) {
        throw new Error("Database is not initialized")
      }

      const result = await this.db.executeQuery(query, [
        data.session_id,
        data.timestamp,
        data.latest_emg_envelope,
        data.latest_emg_mav,
        data.latest_emg_rms,
      ])
      return result
    } catch (error) {
      console.error(`insertEXG Error:`, error)
      throw new Error(`Failed to insert EXG data: ${(error as Error).message}`)
    }
  }
}
