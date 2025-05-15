import { DB, QueryResult } from "@op-engineering/op-sqlite"
import { DatabaseService } from "./databaseRepository"
import { TABLE } from "./db_table"

interface IMUData {
  timestamp: number
  accel_x: number
  accel_y: number
  accel_z: number
  gyro_x: number
  gyro_y: number
  gyro_z: number
  session_id: number
}

interface EXG {
  timestamp: number
  value: number
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
      (session_id,timestamp, accel_x, accel_y, accel_z, gyro_x, gyro_y, gyro_z) 
      VALUES (?, ?, ?, ?, ?, ?, ?,?)`

    try {
      if (!this.db) {
        throw new Error("Database is not initialized")
      }

      const result = await this.db.executeQuery(query, [
        data.session_id,
        data.timestamp,
        data.accel_x,
        data.accel_y,
        data.accel_z,
        data.gyro_x,
        data.gyro_y,
        data.gyro_z,
      ])

      return result
    } catch (error) {
      console.error(`insertIMU Error:`, error)
      throw new Error(`Failed to insert IMU data: ${(error as Error).message}`)
    }
  }

  async insertEXG(data: EXG, tablename: string): Promise<QueryResult> {
    const query = `INSERT INTO ${tablename} (session_id,timestamp, value) VALUES (?, ?,?)`

    try {
      if (!this.db) {
        throw new Error("Database is not initialized")
      }

      const result = await this.db.executeQuery(query, [
        data.session_id,
        data.timestamp,
        data.value,
      ])
      return result
    } catch (error) {
      console.error(`insertEXG Error:`, error)
      throw new Error(`Failed to insert EXG data: ${(error as Error).message}`)
    }
  }
}
