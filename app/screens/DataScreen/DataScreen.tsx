import { FC, useEffect, useState, useRef, useMemo, useCallback } from "react"
import { observer } from "mobx-react-lite"
import { ViewStyle, View, TextStyle } from "react-native"
import { AppStackScreenProps } from "@/navigators"
import { Screen, Text, Button, Switch } from "@/components"
import { spacing, colors, typography } from "app/theme"
import { BLEService } from "@/services/ble/BLEservice"
import { atob } from "react-native-quick-base64"
import { useAppTheme } from "@/utils/useAppTheme"
import { ThemedStyle } from "app/theme"
import { ServiceInfo, CharacteristicInfo, DescriptorInfo, DescriptorBox } from "./DescriptorBox"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { RealTimeGraph } from "@/components/realtimeGraph"
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet"
import * as FileSystem from "expo-file-system"
import Animated, { useSharedValue, withTiming, runOnUI } from "react-native-reanimated"

enum StatusType {
  error,
  success,
  info,
}

interface Status {
  text: string
  type: StatusType
}

interface IMU {
  accel_x: number
  accel_y: number
  accel_z: number
  gyro_x: number
  gyro_y: number
  gyro_z: number
}

interface EMG {
  envelope_value: number
}

const SERVICE_UUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
const CHARACTERISTIC_IMU = "beb5483e-36e1-4688-b7f5-ea07361b26b4"
const CHARACTERISTIC_EXG = "beb5483e-36e1-4688-b7f5-ea07361b26b3"

interface HeartrateScreenProps extends AppStackScreenProps<"Data"> {}

export const DataScreen: FC<HeartrateScreenProps> = observer(function HeartrateScreen() {
  const [monitoring, setMonitoring] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [status, setStatus] = useState<Status | null>(null)
  const [imudata, setimudata] = useState<IMU>({
    accel_x: 0.0,
    accel_y: 0.0,
    accel_z: 0.0,
    gyro_x: 0.0,
    gyro_y: 0.0,
    gyro_z: 0.0,
  })
  const [emgdata, setemgdata] = useState<EMG>({ envelope_value: 0 })

  const currentSession = useRef<number | null>(null)

  // Timer related state and values
  const [totalSeconds, setTotalSeconds] = useState<number>(5)
  const percentage = useSharedValue(0)
  const endAngleProgress = useSharedValue(1)
  const isRunning = useSharedValue(false)
  const timeLeft = useSharedValue(totalSeconds)

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

  const handleIMU = (base64Value: string) => {
    const rawdata = atob(base64Value)
    const bytes = new Uint8Array(rawdata.split("").map((c) => c.charCodeAt(0)))
    const dataView = new DataView(bytes.buffer)

    const imu = {
      accel_x: dataView.getFloat32(0, true),
      accel_y: dataView.getFloat32(4, true),
      accel_z: dataView.getFloat32(8, true),
      gyro_x: dataView.getFloat32(12, true),
      gyro_y: dataView.getFloat32(16, true),
      gyro_z: dataView.getFloat32(20, true),
    }
    setimudata(imu)
  }

  const handleEXG = (base64Value: string) => {
    const rawdata = atob(base64Value)
    const bytes = new Uint8Array(rawdata.split("").map((c) => c.charCodeAt(0)))
    const dataView = new DataView(bytes.buffer)

    const envelope_value = dataView.getInt16(0, true)
    setemgdata({ envelope_value })
  }

  const toggleMonitoring = async () => {
    if (!BLEService.device) {
      showStatus({
        text: "No BLE device connected.",
        type: StatusType.error,
      })
      setMonitoring(false)
      return
    }

    setIsProcessing(true)
    setStatus(null)

    if (monitoring) {
      // Stop monitoring
      try {
        await BLEService.finishMonitor()
        setMonitoring(false)
        showStatus({ text: "Monitoring stopped.", type: StatusType.info })
      } catch (error: any) {
        showStatus({ text: `Failed to stop: ${error.message}`, type: StatusType.error })
      } finally {
        setIsProcessing(false)
      }
      return
    }

    // Start monitoring
    try {
      BLEService.setupMonitor(
        SERVICE_UUID,
        CHARACTERISTIC_IMU,
        (characteristic) => {
          if (characteristic && characteristic.value) handleIMU(characteristic.value)
        },
        (error) => {
          showStatus({ text: `Failed to start IMU: ${error.message}`, type: StatusType.error })
        },
      )

      BLEService.setupMonitor(
        SERVICE_UUID,
        CHARACTERISTIC_EXG,
        (characteristic) => {
          if (characteristic && characteristic.value) handleEXG(characteristic.value)
        },
        (error) => {
          showStatus({ text: `Failed to start EXG: ${error.message}`, type: StatusType.error })
        },
      )

      setMonitoring(true)
      showStatus({ text: "Monitoring started.", type: StatusType.success })
    } catch (error: any) {
      showStatus({ text: `Failed to start: ${error.message}`, type: StatusType.error })
      setMonitoring(false)
    } finally {
      setIsProcessing(false)
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
        <Text preset="heading" text="IMU & EMG" style={$heading} />
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
        <View
          style={{
            marginVertical: spacing.md,
            padding: spacing.md,
            borderRadius: spacing.xs,
            backgroundColor: colors.palette.neutral100,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 2,
          }}
        >
          <Text
            preset="subheading"
            text="IMU Data"
            style={{
              marginBottom: spacing.xs,
              color: colors.palette.primary500,
              fontFamily: typography.primary.bold,
              fontSize: 16,
              textAlign: "center",
            }}
          />
          <View style={{ marginTop: spacing.sm }}>
            {/* Header Row */}
            <View
              style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}
            >
              <Text text="" style={{ flex: 1 }} />
              <Text
                text="Accel (m/s²)"
                style={{ flex: 1, color: colors.text, textAlign: "center" }}
              />
              <Text
                text="Gyro (°/s)"
                style={{ flex: 1, color: colors.text, textAlign: "center" }}
              />
            </View>
            {/* X Axis */}
            <View
              style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}
            >
              <Text text="X axis:" style={{ flex: 1, color: colors.text }} />
              <Text
                text={imudata.accel_x.toFixed(2)}
                style={{ flex: 1, color: colors.text, textAlign: "center" }}
              />
              <Text
                text={imudata.gyro_x.toFixed(2)}
                style={{ flex: 1, color: colors.text, textAlign: "center" }}
              />
            </View>
            {/* Y Axis */}
            <View
              style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}
            >
              <Text text="Y axis:" style={{ flex: 1, color: colors.text }} />
              <Text
                text={imudata.accel_y.toFixed(2)}
                style={{ flex: 1, color: colors.text, textAlign: "center" }}
              />
              <Text
                text={imudata.gyro_y.toFixed(2)}
                style={{ flex: 1, color: colors.text, textAlign: "center" }}
              />
            </View>
            {/* Z Axis */}
            <View
              style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}
            >
              <Text text="Z axis:" style={{ flex: 1, color: colors.text }} />
              <Text
                text={imudata.accel_z.toFixed(2)}
                style={{ flex: 1, color: colors.text, textAlign: "center" }}
              />
              <Text
                text={imudata.gyro_z.toFixed(2)}
                style={{ flex: 1, color: colors.text, textAlign: "center" }}
              />
            </View>
          </View>
        </View>
        <View style={themed($graphWrapper)}>
          <RealTimeGraph
            value={emgdata.envelope_value}
            title="EMG envelope Graph"
            graphColor={colors.palette.accent500}
          />
        </View>

        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Button
            text={monitoring ? "stop monitoring" : "start monitoring"}
            onPress={() => toggleMonitoring()}
            disabled={isProcessing || !BLEService.device}
            style={$button}
            pressedStyle={$buttonPressed}
          />
          <Button
            text="Inspect"
            onPress={inspectAllServicesAndCharacteristics}
            disabled={isProcessing || !BLEService.device}
            style={$button}
            pressedStyle={$buttonPressed}
          />
        </View>

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

const $button: ViewStyle = {
  width: "40%",
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

const $graphWrapper: ThemedStyle<ViewStyle> = () => ({
  flex: 1,
})
