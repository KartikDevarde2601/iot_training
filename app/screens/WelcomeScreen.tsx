import { observer } from "mobx-react-lite"
import { FC, useCallback, useEffect } from "react"
import { Image, ImageStyle, TextStyle, View, ViewStyle } from "react-native"
import { Text, Screen, Button } from "@/components"
import { isRTL } from "@/i18n"
import { AppStackScreenProps } from "../navigators"
import { $styles, type ThemedStyle } from "@/theme"
import { useSafeAreaInsetsStyle } from "../utils/useSafeAreaInsetsStyle"
import { useAppTheme } from "@/utils/useAppTheme"
import { useNavigation } from "@react-navigation/native"
const welcomeLogo = require("../../assets/images/logo.png")
const welcomeFace = require("../../assets/images/welcome-face.png")
import { BLEService } from "@/services/ble/BLEservice"

interface WelcomeScreenProps extends AppStackScreenProps<"Welcome"> {}

export const WelcomeScreen: FC<WelcomeScreenProps> = observer(function WelcomeScreen() {
  const { themed, theme } = useAppTheme()

  const $bottomContainerInsets = useSafeAreaInsetsStyle(["bottom"])

  const navigate = useNavigation<AppStackScreenProps<"Welcome">["navigation"]>()

  const onClick = useCallback(() => {
    navigate.navigate("DeviceSearch")
  }, [navigate])

  useEffect(() => {
    BLEService.requestBluetoothPermission()
  }, [])

  return (
    <Screen preset="fixed" contentContainerStyle={$styles.flex1}>
      <View style={themed($topContainer)}>
        <Image style={themed($welcomeLogo)} source={welcomeLogo} resizeMode="contain" />
        <Text
          testID="welcome-heading"
          style={themed($welcomeHeading)}
          text="Smart Healthcare with IoT: Learn, Build, Innovate"
          preset="heading"
        />
        <Text tx="welcomeScreen:exciting" preset="subheading" />
        <Image
          style={$welcomeFace}
          source={welcomeFace}
          resizeMode="contain"
          tintColor={theme.isDark ? theme.colors.palette.neutral900 : undefined}
        />
      </View>

      <View style={themed([$bottomContainer, $bottomContainerInsets])}>
        <Text
          text="Empower the next generation of innovators with our training program that bridges IoT and medical technology."
          size="md"
        />
        <Button text="Get Started" onPress={onClick} />
      </View>
    </Screen>
  )
})

const $topContainer: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexShrink: 1,
  flexGrow: 1,
  flexBasis: "57%",
  justifyContent: "center",
  paddingHorizontal: spacing.lg,
})

const $bottomContainer: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  flexShrink: 1,
  flexGrow: 0,
  flexBasis: "43%",
  backgroundColor: colors.palette.neutral100,
  borderTopLeftRadius: 16,
  borderTopRightRadius: 16,
  paddingHorizontal: spacing.lg,
  justifyContent: "space-around",
})

const $welcomeLogo: ThemedStyle<ImageStyle> = ({ spacing }) => ({
  height: 88,
  width: "100%",
  marginBottom: spacing.xxl,
})

const $welcomeFace: ImageStyle = {
  height: 169,
  width: 269,
  position: "absolute",
  bottom: -47,
  right: -80,
  transform: [{ scaleX: isRTL ? -1 : 1 }],
}

const $welcomeHeading: ThemedStyle<TextStyle> = ({ spacing }) => ({
  marginBottom: spacing.md,
})
