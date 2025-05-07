import { FC, useEffect, useState } from "react"
import { observer } from "mobx-react-lite"
import { ViewStyle, View, TextStyle } from "react-native"
import { AppStackScreenProps } from "@/navigators"
import { Screen, Text, Button } from "@/components"
import { spacing, colors, typography } from "app/theme"
import { BLEService } from "@/services/ble/BLEservice"
// import { useNavigation } from "@react-navigation/native"
// import { useStores } from "@/models"

interface HeartrateScreenProps extends AppStackScreenProps<"Heartrate"> {}

export const HeartrateScreen: FC<HeartrateScreenProps> = observer(function HeartrateScreen() {
  // Pull in one of our MST stores
  // const { someStore, anotherStore } = useStores()
  const [heartRate, setHeartRate] = useState<number | null>(null)
  const [monitoring, setMonitoring] = useState(false)

  useEffect(() => {
    BLEService.discoverAllServicesAndCharacteristicsForDevice()
  }, [BLEService.device])

  const getService = async () => {
    const result = await BLEService.device?.services()
    if (result) {
      const characteristicsResult = await result[0].descriptorsForCharacteristic(
        "00002a05-0000-1000-8000-00805f9b34fb",
      )
      console.log(characteristicsResult)
    }
  }

  // Pull in navigation via hook
  // const navigation = useNavigation()
  return (
    <Screen preset="scroll" contentContainerStyle={$container}>
      <Text preset="heading" text="Heart Rate Monitor" style={$heading} />

      <View style={$heartRateContainer}>
        <Text text="Heart Rate:" style={$label} />
        <Text text={heartRate !== null ? `${heartRate} BPM` : "--"} style={$value} />
      </View>

      <Button
        text={monitoring ? "Monitoring..." : "Start Monitoring"}
        onPress={() => console.log("hello")}
        disabled={monitoring}
        style={$button}
      />

      <Button
        text="Discover Service"
        onPress={() => getService()}
        disabled={monitoring}
        style={$button}
      />

      <View style={$descriptorBox}>
        <Text text="Descriptor:" preset="bold" style={$descriptorHeading} />
        <Text text="UUID: 0x2902" style={$descriptorValue} />
        <Text text="Properties: Notify" style={$descriptorValue} />
      </View>
    </Screen>
  )
})

const $container = {
  padding: spacing.lg,
  backgroundColor: colors.background,
}

const $heading: TextStyle = {
  textAlign: "center",
  marginBottom: spacing.lg,
}

const $heartRateContainer: ViewStyle = {
  flexDirection: "row",
  justifyContent: "center",
  marginBottom: spacing.lg,
}

const $label = {
  fontSize: 18,
  fontFamily: typography.primary.medium,
}

const $value = {
  fontSize: 18,
  fontFamily: typography.primary.bold,
  color: colors.error,
  marginLeft: spacing.sm,
}

const $button = {
  marginVertical: spacing.sm,
}

const $descriptorBox = {
  padding: spacing.md,
  backgroundColor: colors.palette.neutral200,
  borderRadius: spacing.sm,
}

const $descriptorHeading = {
  fontSize: 16,
  marginBottom: spacing.sm,
}

const $descriptorValue = {
  fontSize: 14,
  color: colors.textDim,
}
