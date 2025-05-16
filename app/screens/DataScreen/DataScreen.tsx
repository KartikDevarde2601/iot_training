import { FC, useEffect, useState, useRef, useMemo, useCallback } from "react"
import { observer } from "mobx-react-lite"
import { ViewStyle, View, TextStyle } from "react-native"
import { AppStackScreenProps } from "@/navigators"
import { Screen, Text, Button, Switch } from "@/components"
import { spacing, colors, typography } from "app/theme"
import { BLEService } from "@/services/ble/BLEservice"
import { atob } from "react-native-quick-base64"
import { useAppTheme } from "@/utils/useAppTheme"
import { ServiceInfo, CharacteristicInfo, DescriptorInfo, DescriptorBox } from "./DescriptorBox"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { TimerProgress } from "./timerProgress"
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet"
import { sensorRepository } from "../../op-sql/sensorRepository"
import { DatabaseService } from "../../op-sql/databaseRepository"
import * as FileSystem from "expo-file-system"
import Animated, { useSharedValue, withTiming, runOnUI } from "react-native-reanimated"
import { TABLE } from "@/op-sql/db_table"

enum StatusType {
  error,
  success,
  info,
}

interface Status {
  text: string
  type: StatusType
}

interface CSVRow {
  timestamp: number
  accel_x: number
  accel_y: number
  accel_z: number
  gyro_x: number
  gyro_y: number
  gyro_z: number
  exg_value: number
}

const SERVICE_UUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
const CHARACTERISTIC_CFG = "d0a1d466-344c-4be3-ab3f-189f80dd7516"
const CHARACTERISTIC_CTRL = "e1b2c3d4-e5f6-4765-8734-567890123abc"
const CHARACTERISTIC_IMU = "beb5483e-36e1-4688-b7f5-ea07361b26a8"
const CHARACTERISTIC_EXG = "cba1d466-344c-4be3-ab3f-189f80dd7516"
const CHARACTERISTIC_COMPLETED = "1ca3b55b-9700-44fa-afaf-8fd271de74ab"

interface HeartrateScreenProps extends AppStackScreenProps<"Data"> {}

export const DataScreen: FC<HeartrateScreenProps> = observer(function HeartrateScreen() {
  const [monitoring, setMonitoring] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [status, setStatus] = useState<Status | null>(null)
  const [direction, setDirection] = useState<"up" | "down">("up")

  const currentSession = useRef<number | null>(null)

  // Timer related state and values
  const [totalSeconds, setTotalSeconds] = useState<number>(10)
  const percentage = useSharedValue(0)
  const endAngleProgress = useSharedValue(1)
  const isRunning = useSharedValue(false)
  const timeLeft = useSharedValue(totalSeconds)
  const permissionDirectoryUrl = useRef<string | null>(null)

  const dbService = useMemo(() => DatabaseService.getInstance(), [])

  const sensorService = useMemo(() => new sensorRepository(), [])

  // Calculate total timer duration in milliseconds
  const totalTimeMs = totalSeconds * 1000

  const sheetRef = useRef<BottomSheet>(null)

  const snapPoints = useMemo(() => ["25%", "50%", "90%"], [])

  const [discoveredServicesData, setDiscoveredServicesData] = useState<ServiceInfo[] | []>([])

  const { themed, theme } = useAppTheme()

  useEffect(() => {
    const discoverDeviceServices = async () => {
      if (BLEService.device) {
        setStatus(null)
        setIsProcessing(true)
        try {
          await BLEService.device.discoverAllServicesAndCharacteristics()
          await Monitoring()
          console.log("Services and characteristics discovered successfully.")
        } catch (e: any) {
          console.error("Service discovery error:", e)
          showStatus({
            text: `Discovery Error: ${e.message || "Unknown error during discovery"}`,
            type: StatusType.error,
          })
        } finally {
          setIsProcessing(false)
        }
      } else {
        showStatus({
          text: "Something went wrong restart the app",
          type: StatusType.error,
        })
      }
    }

    if (BLEService.device) {
      discoverDeviceServices()
    }

    return () => {
      BLEService.finishMonitor()
    }
  }, [BLEService.device])

  const isGenericService = (uuid: string) => {
    const lower = uuid.toLowerCase()
    return (
      lower === "00001800-0000-1000-8000-00805f9b34fb" ||
      lower === "00001801-0000-1000-8000-00805f9b34fb"
    )
  }

  const showStatus = (status: Status) => {
    setStatus(status)
  }

  const startTimer = useCallback(() => {
    if (isRunning.value) return
    runOnUI(() => {
      "worklet"
      isRunning.value = true
      percentage.value = 100
      endAngleProgress.value = 1
      timeLeft.value = totalSeconds

      percentage.value = withTiming(0, { duration: totalTimeMs })

      endAngleProgress.value = withTiming(0, { duration: totalTimeMs })
    })()
  }, [isRunning, percentage, endAngleProgress, timeLeft, totalSeconds, totalTimeMs])

  const handleTimerComplete = useCallback(() => {
    console.log("timer completed ")
  }, [])

  const handleIMU = (base64Value: string) => {
    const rawdata = atob(base64Value)
    const dataView = new DataView(
      new Uint8Array(rawdata.split("").map((c) => c.charCodeAt(0))).buffer,
    )

    if (currentSession.current != null) {
      const imuData = {
        timestamp: dataView.getUint32(0, true),
        accel_x: dataView.getFloat32(4, true),
        accel_y: dataView.getFloat32(8, true),
        accel_z: dataView.getFloat32(12, true),
        gyro_x: dataView.getFloat32(16, true),
        gyro_y: dataView.getFloat32(20, true),
        gyro_z: dataView.getFloat32(24, true),
        session_id: currentSession.current,
      }
      sensorService.insertIMU(imuData, TABLE.imu_data)
    }
  }

  const handleEXG = (base64Value: string) => {
    const rawdata = atob(base64Value)

    const dataView = new DataView(
      new Uint8Array(rawdata.split("").map((c) => c.charCodeAt(0))).buffer,
    )

    if (currentSession.current != null) {
      const exgdata = {
        session_id: currentSession.current,
        timestamp: dataView.getUint32(0, true),
        value: dataView.getFloat32(4, true),
      }
      sensorService.insertEXG(exgdata, TABLE.exg_data)
    }
  }

  const generateCSV = async (data: CSVRow[]) => {
    try {
      const headers = [
        "timestamp",
        "accel_x",
        "accel_y",
        "accel_z",
        "gyro_x",
        "gyro_y",
        "gyro_z",
        "exg_value",
      ].join(",")

      const csvRows = data.map((row) => {
        return [
          row.timestamp,
          row.accel_x,
          row.accel_y,
          row.accel_z,
          row.gyro_x,
          row.gyro_y,
          row.gyro_z,
          row.exg_value,
        ].join(",")
      })

      const csvString = [headers, ...csvRows].join("\n")
      const fileName = `${direction}_${currentSession.current}.csv`

      // Request permission if we don't have it yet
      if (permissionDirectoryUrl.current == null) {
        const permissionResult =
          await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync()
        if (!permissionResult.granted) {
          showStatus({
            text: "Permission to access external storage was denied",
            type: StatusType.error,
          })
          return
        }
        permissionDirectoryUrl.current = permissionResult.directoryUri
      }

      // Create the file in the SAF directory
      const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
        permissionDirectoryUrl.current!,
        fileName,
        "text/csv",
      )

      // Write the CSV string to the file
      await FileSystem.writeAsStringAsync(fileUri, csvString, {
        encoding: FileSystem.EncodingType.UTF8,
      })
      showStatus({
        text: "CSV file saved to external storage successfully",
        type: StatusType.success,
      })
    } catch (error) {
      console.error("Error generating CSV:", error)
      showStatus({
        text: `Error generating CSV: ${error}`,
        type: StatusType.error,
      })
    }
  }

  const handleCompleted = async (base64Value: string) => {
    const rawdata = atob(base64Value)
    const configValue = rawdata.charCodeAt(0)
    if (configValue) {
      showStatus({ text: "wait csv file is generating", type: StatusType.info })
      try {
        // Join IMU and EXG data based on timestamp
        const query = `
      SELECT 
        i.timestamp,
        i.accel_x,
        i.accel_y,
        i.accel_z,
        i.gyro_x,
        i.gyro_y,
        i.gyro_z,
        e.value as exg_value
      FROM ${TABLE.imu_data} i
      LEFT JOIN ${TABLE.exg_data} e 
        ON i.session_id = e.session_id 
        AND i.timestamp = e.timestamp
      WHERE i.session_id = ?
      ORDER BY i.timestamp
      LIMIT 1000;`

        const result = await dbService.executeQuery(query, [currentSession.current])

        const combinedData = result.rows.length > 0 ? result.rows : []

        const csvRows: CSVRow[] = combinedData.map((row: any) => ({
          timestamp: Number(row.timestamp),
          accel_x: Number(row.accel_x),
          accel_y: Number(row.accel_y),
          accel_z: Number(row.accel_z),
          gyro_x: Number(row.gyro_x),
          gyro_y: Number(row.gyro_y),
          gyro_z: Number(row.gyro_z),
          exg_value: Number(row.exg_value),
        }))

        if (csvRows.length > 0) {
          await generateCSV(csvRows)
        } else {
          showStatus({ text: "No data available to generate CSV", type: StatusType.info })
        }
      } catch (error) {
        showStatus({ text: `Error generating CSV: ${error}`, type: StatusType.error })
      }
    }
  }

  const Monitoring = async () => {
    if (!BLEService.device) {
      showStatus({
        text: BLEService.device
          ? "Device does not support monitoring."
          : "No BLE device connected.",
        type: StatusType.error,
      })

      setMonitoring(false)
      return
    }
    setIsProcessing(true)
    setStatus(null)
    if (monitoring) {
      BLEService.finishMonitor()
      setMonitoring(false)
    } else {
      try {
        BLEService.setupMonitor(
          SERVICE_UUID,
          CHARACTERISTIC_IMU,
          (characteristic) => {
            if (characteristic && characteristic.value) handleIMU(characteristic.value)
          },
          (error) => {
            showStatus({ text: `Failed to start: ${error.message}`, type: StatusType.error })
          },
        )

        BLEService.setupMonitor(
          SERVICE_UUID,
          CHARACTERISTIC_COMPLETED,
          (characteristic) => {
            if (characteristic && characteristic.value) handleCompleted(characteristic.value)
          },
          (error) => {
            showStatus({ text: `Failed to start: ${error.message}`, type: StatusType.error })
          },
        )

        BLEService.setupMonitor(
          SERVICE_UUID,
          CHARACTERISTIC_EXG,
          (characteristic) => {
            if (characteristic && characteristic.value) handleEXG(characteristic.value)
          },
          (error) => {
            showStatus({ text: `Failed to start: ${error.message}`, type: StatusType.error })
          },
        )

        setMonitoring(true)
      } catch (error: any) {
        showStatus({ text: `Failed to start: ${error.message}`, type: StatusType.error })
        setMonitoring(false)
      }
    }
    setIsProcessing(false)
  }

  const startAction = async () => {
    try {
      const dateunix = Math.floor(new Date().getTime() / 1000)
      const session = await sensorService.insertSession(
        { timestamp: dateunix, action: direction },
        TABLE.session,
      )
      if (session.insertId) {
        currentSession.current = session.insertId
      } else {
        showStatus({ text: "error occour when sending to BLE Device", type: StatusType.error })
      }

      const characteristic = await BLEService.readCharacteristicForDevice(
        SERVICE_UUID,
        CHARACTERISTIC_CFG,
      )
      if (characteristic?.value) {
        const binaryStr = atob(characteristic.value)
        const configValue = binaryStr.charCodeAt(0)
        if (configValue) {
          const buffer = new ArrayBuffer(8)
          const view = new DataView(buffer)

          view.setUint32(0, 25, true)
          view.setUint32(4, 10, true)

          // Convert to base64 for BLE transmission
          const bytes = new Uint8Array(buffer)
          let binary = ""
          bytes.forEach((byte) => (binary += String.fromCharCode(byte)))
          const base64 = btoa(binary)

          // Write to BLE device
          await BLEService.writeCharacteristicWithResponseForDevice(
            SERVICE_UUID,
            CHARACTERISTIC_CTRL,
            base64,
          ).then(() => {
            startTimer()
          })
        }
      }
    } catch (error) {
      throw error
    }
  }

  // Renamed and updated function
  const inspectAllServicesAndCharacteristics = useCallback(async () => {
    if (!BLEService.device || typeof BLEService.device.services !== "function") {
      showStatus({
        text: "No device connected or device object is not as expected for inspection.",
        type: StatusType.error,
      })
      return
    }
    setIsProcessing(true)
    setStatus(null)
    setDiscoveredServicesData([])
    console.log("Starting full service and characteristic inspection...")

    try {
      // Ensure services and characteristics are discovered/refreshed
      if (typeof BLEService.device.discoverAllServicesAndCharacteristics === "function") {
        console.log("Re-discovering all services and characteristics...")
        await BLEService.device.discoverAllServicesAndCharacteristics()
        console.log("Discovery complete for inspection.")
      }

      const services = await BLEService.device.services()
      const customServices = services.filter((service) => !isGenericService(service.uuid))
      console.log(customServices)

      const servicesInformation: ServiceInfo[] = []

      for (const service of customServices) {
        const characteristics = await service.characteristics()
        const characteristicsInformation: CharacteristicInfo[] = []

        for (const char of characteristics) {
          let charDescriptorsInfo: DescriptorInfo[] = []
          // Check if descriptors method exists and is a function before calling
          if (typeof char.descriptors === "function") {
            try {
              const descriptors = await char.descriptors()
              charDescriptorsInfo = descriptors.map((desc) => ({
                uuid: desc.uuid,
                // value: desc.value // Typically, descriptor value needs explicit read
              }))
            } catch (descError: any) {
              console.warn(
                `Could not fetch descriptors for char ${char.uuid}: ${descError.message}`,
              )
            }
          }

          characteristicsInformation.push({
            uuid: char.uuid,
            properties: {
              // Adapt these property names if your BLE lib uses different ones
              isReadable: char.isReadable,
              isWritableWithResponse: char.isWritableWithResponse,
              isWritableWithoutResponse: char.isWritableWithoutResponse,
              isNotifiable: char.isNotifiable,
              isIndicatable: char.isIndicatable,
            },
            descriptors: charDescriptorsInfo,
          })
        }
        servicesInformation.push({
          uuid: service.uuid,
          characteristics: characteristicsInformation,
        })
      }

      setDiscoveredServicesData(servicesInformation)
      sheetRef.current?.snapToIndex(1)
      if (servicesInformation.length === 0) {
        showStatus({
          text: "No services found on this device after inspection.",
          type: StatusType.error,
        })
      } else {
        console.log("Fetched all services data:", servicesInformation)
      }
    } catch (e: any) {
      console.error("Error during full service inspection:", e)
      showStatus({ text: `Full Inspection Error: ${e.message}`, type: StatusType.error })
      setDiscoveredServicesData([])
    } finally {
      setIsProcessing(false)
    }
  }, [BLEService.device])

  return (
    <GestureHandlerRootView>
      <Screen
        preset="scroll"
        contentContainerStyle={themed($container)}
        safeAreaEdges={["top", "bottom"]}
      >
        <Text preset="heading" text="Action Monitoring" style={$heading} />
        {status && (
          <Text
            text={status.text}
            style={[
              $statusText,
              status.type === StatusType.error
                ? $statusError
                : status.type === StatusType.success
                  ? $statusSuccess
                  : $statusInfo,
            ]}
          />
        )}
        <View style={themed($heartRateContainer)}>
          <TimerProgress
            radius={80}
            progressColor="#FFBB50"
            percentage={percentage}
            endAngleProgress={endAngleProgress}
            isRunning={isRunning}
            timeLeft={timeLeft}
            totalSeconds={totalSeconds}
            onComplete={handleTimerComplete}
          />
        </View>
        <View>
          <View style={$switchContainer}>
            <Text style={$switchLabel} preset="subheading">
              Action: up
            </Text>
            <Switch
              value={direction === "up"}
              onValueChange={(value) => setDirection(value ? "up" : "down")}
            />
          </View>
          <View style={$switchContainer}>
            <Text style={$switchLabel} preset="subheading">
              Action: down
            </Text>
            <Switch
              value={direction === "down"}
              onValueChange={(value) => setDirection(value ? "up" : "down")}
            />
          </View>
        </View>
        <Button
          text={monitoring ? "Collecting" : "Start Action"}
          onPress={() => startAction()}
          disabled={isProcessing || !BLEService.device}
          style={$button}
          pressedStyle={$buttonPressed}
        />
        <Button
          text="Inspect All Services & Chars"
          onPress={inspectAllServicesAndCharacteristics}
          disabled={isProcessing || !BLEService.device}
          style={$button}
          pressedStyle={$buttonPressed}
        />
        <BottomSheet
          ref={sheetRef}
          index={-1}
          snapPoints={snapPoints}
          enableDynamicSizing={false}
          enablePanDownToClose={true}
        >
          <BottomSheetScrollView contentContainerStyle={themed($containerBottom)}>
            <DescriptorBox
              title="Device Services & Characteristics:"
              isProcessing={isProcessing}
              data={
                discoveredServicesData
                  ? discoveredServicesData.map((service) => ({
                      ...service,
                      characteristics: service.characteristics.map((char) => ({
                        ...char,
                        descriptors: char.descriptors.map((desc) => desc.uuid),
                      })),
                    }))
                  : []
              }
            />
          </BottomSheetScrollView>
        </BottomSheet>
      </Screen>
    </GestureHandlerRootView>
  )
})

// Styles (New styles for dynamic descriptor box are added/updated)
const $container: ViewStyle = {
  paddingHorizontal: spacing.lg,
  paddingVertical: spacing.lg,
  backgroundColor: colors.background,
  flex: 1,
}

const $containerBottom: ViewStyle = {
  paddingHorizontal: spacing.lg,
  paddingVertical: spacing.lg,
  flex: 1,
}
const $heading: TextStyle = {
  textAlign: "center",
  marginBottom: spacing.md,
  color: colors.text,
  fontFamily: typography.primary.bold,
}
const $heartRateContainer: ViewStyle = {
  justifyContent: "center",
  alignItems: "center",
  marginBottom: spacing.md,
  paddingVertical: spacing.lg,
  paddingHorizontal: spacing.md,
}

const $button: ViewStyle = {
  marginVertical: spacing.md,
  backgroundColor: colors.tint || colors.palette.primary100,
}
const $buttonPressed: ViewStyle = {
  backgroundColor: colors.palette.primary200 || colors.palette.neutral400,
}
const $statusText: TextStyle = {
  textAlign: "center",
  marginBottom: spacing.md,
  fontSize: 14,
  fontFamily: typography.primary.medium,
  padding: spacing.sm,
  borderRadius: spacing.xs,
}

const $statusError: TextStyle = {
  color: colors.palette.error500,
  backgroundColor: colors.palette.error100,
}
const $statusSuccess: TextStyle = {
  color: colors.palette.success500,
  backgroundColor: colors.palette.success100,
}
const $statusInfo: TextStyle = {
  color: colors.palette.info500,
  backgroundColor: colors.palette.info100,
}

const $switchContainer: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  paddingHorizontal: spacing.md,
  marginVertical: spacing.sm,
}

const $switchLabel: TextStyle = {
  fontFamily: typography.primary.medium,
  color: colors.text,
}
