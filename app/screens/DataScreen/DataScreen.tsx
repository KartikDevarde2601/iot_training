import { FC, useEffect, useState, useRef, useMemo, useCallback } from "react"
import { observer } from "mobx-react-lite"
import { ViewStyle, View, TextStyle, Image, ImageStyle } from "react-native"
import { $styles, type ThemedStyle } from "@/theme"
import { AppStackScreenProps } from "@/navigators"
import { Screen, Text, Button, SkiaSlider } from "@/components"
import { spacing, colors, typography } from "app/theme"
import { BLEService } from "@/services/ble/BLEservice"
import { atob } from "react-native-quick-base64"
import { useAppTheme } from "@/utils/useAppTheme"
import { ServiceInfo, CharacteristicInfo, DescriptorInfo, DescriptorBox } from "./DescriptorBox"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { TimerProgress } from "./timerProgress"
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet"
import { useFont } from "@shopify/react-native-skia"
import Animated, {
  useSharedValue,
  useDerivedValue,
  withTiming,
  runOnJS,
  runOnUI,
} from "react-native-reanimated"

const HEART_RATE_SERVICE_UUID = "0000180d-0000-1000-8000-00805f9b34fb"
const HEART_RATE_MEASUREMENT_CHARACTERISTIC_UUID = "00002a37-0000-1000-8000-00805f9b34fb"

interface HeartrateScreenProps extends AppStackScreenProps<"Data"> {}

export const DataScreen: FC<HeartrateScreenProps> = observer(function HeartrateScreen() {
  const [monitoring, setMonitoring] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Timer related state and values
  const [totalSeconds, setTotalSeconds] = useState<number>(12) // 12 seconds = 0.2 minutes
  const percentage = useSharedValue(0)
  const endAngleProgress = useSharedValue(1)
  const isRunning = useSharedValue(false)
  const timeLeft = useSharedValue(totalSeconds)

  const [sliderValue, setSliderValue] = useState(50)

  // Calculate total timer duration in milliseconds
  const totalTimeMs = totalSeconds * 1000

  const sheetRef = useRef<BottomSheet>(null)

  const snapPoints = useMemo(() => ["25%", "50%", "90%"], [])

  const [discoveredServicesData, setDiscoveredServicesData] = useState<ServiceInfo[] | []>([])

  const { themed, theme } = useAppTheme()

  useEffect(() => {
    const discoverDeviceServices = async () => {
      if (BLEService.device) {
        setError(null)
        setIsProcessing(true)
        console.log(
          `Discovering services for device: ${BLEService.device.id || BLEService.device.name}`,
        )
        try {
          await BLEService.device.discoverAllServicesAndCharacteristics()
          console.log("Services and characteristics discovered successfully.")
        } catch (e: any) {
          console.error("Service discovery error:", e)
          setError(`Discovery Error: ${e.message || "Unknown error during discovery"}`)
        } finally {
          setIsProcessing(false)
        }
      } else {
        setError("Something went wrong")
      }
    }

    if (BLEService.device) {
      discoverDeviceServices()
    }

    // Cleanup function
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

  // Function to start the timer
  const startTimer = useCallback(() => {
    if (isRunning.value) return // Don't start if already running

    // Run the following logic on the UI thread
    runOnUI(() => {
      "worklet" // Mark this anonymous function as a worklet
      isRunning.value = true
      percentage.value = 100 // Reset percentage
      endAngleProgress.value = 1 // Reset progress bar angle
      timeLeft.value = totalSeconds // Reset time left

      // Animate percentage from 100 to 0 over totalTimeMs
      percentage.value = withTiming(0, { duration: totalTimeMs })
      // Animate progress bar angle from 1 to 0
      endAngleProgress.value = withTiming(0, { duration: totalTimeMs })
    })() // Immediately invoke the function scheduled by runOnUI
  }, [isRunning, percentage, endAngleProgress, timeLeft, totalSeconds, totalTimeMs])

  const handleTimerComplete = useCallback(() => {
    console.log("Timer completed!")
    // Add any additional logic here
  }, [])

  // Renamed and updated function
  const inspectAllServicesAndCharacteristics = useCallback(async () => {
    if (!BLEService.device || typeof BLEService.device.services !== "function") {
      setError("No device connected or device object is not as expected for inspection.")
      return
    }
    setIsProcessing(true)
    setError(null)
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
        setError("No services found on this device after inspection.")
      } else {
        console.log("Fetched all services data:", servicesInformation)
      }
    } catch (e: any) {
      console.error("Error during full service inspection:", e)
      setError(`Full Inspection Error: ${e.message}`)
      setDiscoveredServicesData([])
    } finally {
      setIsProcessing(false)
    }
  }, [BLEService.device])

  // Handle slider value changes
  const handleSliderChange = (value: number) => {
    setSliderValue(value)
  }

  return (
    <GestureHandlerRootView>
      <Screen
        preset="scroll"
        contentContainerStyle={themed($container)}
        safeAreaEdges={["top", "bottom"]}
      >
        <Text preset="heading" text="IMU Monitor" style={$heading} />
        {error && <Text text={`Error: ${error}`} style={$errorText} />}
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

        <SkiaSlider
          initialValue={100}
          minValue={20}
          maxValue={300}
          sliderWidth={350}
          trackColor="#82cab2"
          handleColor="#f8f9ff"
          trackHeight={30}
          handleSize={25}
          onValueChange={handleSliderChange}
        />
        <Button
          text={monitoring ? "Stop Monitoring" : "Start Monitoring"}
          onPress={() => console.log("hello")}
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
const $errorText: TextStyle = {
  color: colors.error,
  textAlign: "center",
  marginBottom: spacing.md,
  fontSize: 14,
  fontFamily: typography.primary.medium,
  padding: spacing.sm,
  backgroundColor: colors.palette.angry100,
  borderRadius: spacing.xs,
}
