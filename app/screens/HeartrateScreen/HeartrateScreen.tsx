import { FC, useEffect, useState, useRef } from "react"
import { observer } from "mobx-react-lite"
import { ViewStyle, View, TextStyle, Animated, Image, ImageStyle } from "react-native"
import { $styles, type ThemedStyle } from "@/theme"
import { AppStackScreenProps } from "@/navigators"
import { Screen, Text, Button } from "@/components"
import { spacing, colors, typography } from "app/theme"
import { BLEService } from "@/services/ble/BLEservice"
import { atob } from "react-native-quick-base64"
import { useAppTheme } from "@/utils/useAppTheme"
import { ServiceInfo, CharacteristicInfo, DescriptorInfo, DescriptorBox } from "./DescriptorBox"

const HEART_RATE_SERVICE_UUID = "0000180d-0000-1000-8000-00805f9b34fb"
const HEART_RATE_MEASUREMENT_CHARACTERISTIC_UUID = "00002a37-0000-1000-8000-00805f9b34fb"

const heartLogo = require("../../../assets/images/heart.png")

interface HeartrateScreenProps extends AppStackScreenProps<"Heartrate"> {}

export const HeartrateScreen: FC<HeartrateScreenProps> = observer(function HeartrateScreen() {
  const [heartRate, setHeartRate] = useState<number | null>(null)
  const [monitoring, setMonitoring] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [discoveredServicesData, setDiscoveredServicesData] = useState<ServiceInfo[] | []>([])

  const anim = useRef(new Animated.Value(1)).current
  const loopRef = useRef<Animated.CompositeAnimation | null>(null) // Track the loop
  const [isAnimating, setIsAnimating] = useState(false)

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

  const startAnimation = () => {
    if (!isAnimating) {
      loopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 1.5,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
        ]),
      )
      loopRef.current.start()
      setIsAnimating(true)
    }
  }

  const stopAnimation = () => {
    if (loopRef.current) {
      loopRef.current.stop() // Stops the animation
      loopRef.current = null
      setIsAnimating(false)
    }
  }

  const handleHeartRateData = (base64Value: string) => {
    try {
      const rawData = atob(base64Value)
      const byteArray = new Uint8Array(rawData.length)
      for (let i = 0; i < rawData.length; i++) {
        byteArray[i] = rawData.charCodeAt(i) & 0xff
      }
      if (byteArray.length === 0) return
      const flags = byteArray[0]
      const isUINT16 = (flags & 0x01) !== 0
      let hrValue: number
      if (isUINT16) {
        if (byteArray.length < 3) return
        const buffer = byteArray.buffer.slice(byteArray.byteOffset + 1, byteArray.byteOffset + 3)
        const view = new DataView(buffer)
        hrValue = view.getUint16(0, true)
      } else {
        if (byteArray.length < 2) return
        hrValue = byteArray[1]
      }
      setHeartRate(hrValue)
    } catch (e) {
      console.error("Failed to parse heart rate data:", e)
      setError("Error parsing heart rate data.")
    }
  }

  // Renamed and updated function
  const inspectAllServicesAndCharacteristics = async () => {
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

      const servicesInformation: ServiceInfo[] = []

      for (const service of services) {
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
  }

  const toggleMonitoring = async () => {
    if (!BLEService.device) {
      setError(
        BLEService.device ? "Device does not support monitoring." : "No BLE device connected.",
      )
      setMonitoring(false)
      return
    }
    setIsProcessing(true)
    setError(null)
    if (monitoring) {
      BLEService.finishMonitor()
      setMonitoring(false)
      stopAnimation()
      setHeartRate(null)
    } else {
      try {
        BLEService.setupMonitor(
          HEART_RATE_SERVICE_UUID,
          HEART_RATE_MEASUREMENT_CHARACTERISTIC_UUID,
          (characteristic) => {
            if (characteristic && characteristic.value) handleHeartRateData(characteristic.value)
          },
          (error) => {
            setError(`Failed to start: ${error.message}`)
          },
        )
        startAnimation()
        setMonitoring(true)
      } catch (e: any) {
        setError(`Failed to start: ${e.message}`)
        setMonitoring(false)
      }
    }
    setIsProcessing(false)
  }

  return (
    <Screen preset="scroll" contentContainerStyle={$container} safeAreaEdges={["top", "bottom"]}>
      <Text preset="heading" text="Heart Rate Monitor" style={$heading} />
      {error && <Text text={`Error: ${error}`} style={$errorText} />}
      <View style={$heartRateContainer}>
        <Animated.View style={{ transform: [{ scale: anim }] }}>
          <Image style={themed($welcomeLogo)} source={heartLogo} resizeMode="contain" />
        </Animated.View>
        <Text text={heartRate !== null ? `${heartRate} BPM` : "--"} preset="heading" />
      </View>
      <Button
        text={monitoring ? "Stop Monitoring" : "Start Monitoring"}
        onPress={toggleMonitoring}
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
    </Screen>
  )
})

// Styles (New styles for dynamic descriptor box are added/updated)
const $container: ViewStyle = {
  paddingHorizontal: spacing.lg,
  paddingVertical: spacing.lg,
  backgroundColor: colors.background,
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

const $welcomeLogo: ThemedStyle<ImageStyle> = ({ spacing }) => ({
  height: 80,
  width: 80,
  marginBottom: spacing.xxl,
})
