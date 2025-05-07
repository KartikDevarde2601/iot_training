import { FC, memo, useCallback, useMemo, useRef, useState } from "react"
import { observer } from "mobx-react-lite"
import { ViewStyle, View, TextStyle } from "react-native"
import { AppStackScreenProps } from "@/navigators"
import { Screen, Text, Button, ListView, Icon, ListItem } from "@/components"
import type { ThemedStyle } from "@/theme"
import { useAppTheme } from "@/utils/useAppTheme"
import LottieView from "lottie-react-native"
import { BLEService } from "@/services/ble/BLEservice"
import { Device } from "react-native-ble-plx"
import { cloneDeep } from "@/utils/deepclone"
import { useNavigation } from "@react-navigation/native"
import { formatDate } from "@/utils/formatDate"

interface DeviceSearchScreenProps extends AppStackScreenProps<"DeviceSearch"> {}
type DeviceExtendedByUpdateTime = Device & { updateTimestamp: number }

const MIN_TIME_BEFORE_UPDATE_IN_MILLISECONDS = 5000

export const DeviceSearchScreen: FC<DeviceSearchScreenProps> = observer(
  function DeviceSearchScreen() {
    const [isConnecting, setIsConnecting] = useState(false)
    const [status, setStatus] = useState<string>("")
    const [foundDevices, setFoundDevices] = useState<DeviceExtendedByUpdateTime[]>([])

    const animation = useRef<LottieView>(null)

    const navigate = useNavigation<AppStackScreenProps<"Heartrate">["navigation"]>()

    const {
      themed,
      theme: { colors },
    } = useAppTheme()

    const isFoundDeviceUpdateNecessary = (
      currentDevices: DeviceExtendedByUpdateTime[],
      updatedDevice: Device,
    ) => {
      const currentDevice = currentDevices.find(({ id }) => updatedDevice.id === id)
      if (!currentDevice) {
        return true
      }
      return currentDevice.updateTimestamp < Date.now()
    }

    const startScaning = () => {
      setFoundDevices([])
      setStatus("Scanning Near Device")
      BLEService.initializeBLE().then(() => {
        BLEService.scanDevices(addFoundDevice, null, true)
        setTimeout(() => {
          stopScaning()
        }, 5000)
      })
    }

    const addFoundDevice = (device: Device) =>
      setFoundDevices((prevState) => {
        if (typeof device.rssi !== "number" || device.rssi <= -60) {
          return prevState
        }
        if (!isFoundDeviceUpdateNecessary(prevState, device)) {
          return prevState
        }
        // deep clone
        const nextState = cloneDeep(prevState)
        const extendedDevice: DeviceExtendedByUpdateTime = {
          ...device,
          updateTimestamp: Date.now() + MIN_TIME_BEFORE_UPDATE_IN_MILLISECONDS,
        } as DeviceExtendedByUpdateTime

        const indexToReplace = nextState.findIndex(
          (currentDevice) => currentDevice.id === device.id,
        )
        if (indexToReplace === -1) {
          return nextState.concat(extendedDevice)
        }
        nextState[indexToReplace] = extendedDevice
        return nextState
      })

    const stopScaning = () => {
      BLEService.manager.stopDeviceScan()
    }

    const onConnectSuccess = () => {
      navigate.navigate("Heartrate")
    }

    const onConnectFail = () => {
      setStatus("Not able to connect")
    }

    const ConnectToDevice = useCallback((device: Device) => {
      setStatus(`Connecting to ${device.name}`)
      BLEService.connectToDevice(device.id).then(onConnectSuccess).catch(onConnectFail)
    }, [])

    return (
      <Screen
        contentContainerStyle={{ justifyContent: "space-between", flex: 1 }}
        style={themed($screenContentContainer)}
        preset="auto"
        safeAreaEdges={["top", "bottom"]}
      >
        <View style={{ alignItems: "center" }}>
          <LottieView
            autoPlay
            ref={animation}
            style={{
              width: 300,
              height: 300,
              alignSelf: "center",
            }}
            source={require("../../assets/animation/bluetoothAnimation.json")}
          />
          <Text text={status} style={$statusText} />
        </View>

        <View style={themed($topContainer)}>
          <ListView<DeviceExtendedByUpdateTime>
            data={foundDevices}
            renderItem={({ item }) => <DeviceItem device={item} onPress={ConnectToDevice} />}
            estimatedItemSize={89}
          />
        </View>

        <Button
          text="Scan Device"
          onPress={startScaning}
          LeftAccessory={(props) => <Icon icon="scanradar" />}
          style={[{ borderRadius: 10, gap: 10 }]}
        />
      </Screen>
    )
  },
)

interface DeviceItemProp {
  device: DeviceExtendedByUpdateTime
  onPress: (device: Device) => void
}

const DeviceItem = memo(({ device, onPress }: DeviceItemProp) => {
  const isoString = useMemo(
    () => new Date(device.updateTimestamp).toISOString(),
    [device.updateTimestamp],
  )

  return device ? (
    <ListItem bottomSeparator={true} leftIcon="bluetooth" onPress={() => onPress(device)}>
      <View>
        <Text>{device.name ? device.name : device.id}</Text>
        <Text>{formatDate(isoString, " HH:mm:ss.SSS")}</Text>
      </View>
    </ListItem>
  ) : null
})

const $screenContentContainer: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flex: 1,
  paddingVertical: spacing.lg,
  paddingHorizontal: spacing.lg,
})

const $topContainer: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexShrink: 1,
  flexGrow: 1,
  flexBasis: "57%",
  justifyContent: "center",
  paddingHorizontal: spacing.lg,
})

const $statusText: TextStyle = {
  position: "absolute",
  top: "80%",
  alignSelf: "center",
  width: "100%",
  textAlign: "center",
  color: "#333",
  fontWeight: "bold",
  fontSize: 18,
}
