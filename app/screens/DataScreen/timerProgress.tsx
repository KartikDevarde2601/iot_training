import React, { useCallback } from "react"
import { StyleSheet, View } from "react-native"
import { Canvas, Path, Skia, Text as SkText, useFont } from "@shopify/react-native-skia"
import Animated, { useSharedValue, useDerivedValue, runOnJS } from "react-native-reanimated"

interface TimerProgressProps {
  radius?: number
  strokeWidth?: number
  backgroundColor?: string
  progressColor?: string
  textColor?: string
  totalSeconds: number
  percentage: Animated.SharedValue<number>
  endAngleProgress: Animated.SharedValue<number>
  isRunning: Animated.SharedValue<boolean>
  timeLeft: Animated.SharedValue<number>
  onComplete?: () => void
}

export const TimerProgress: React.FC<TimerProgressProps> = ({
  radius = 120,
  strokeWidth = 20,
  backgroundColor = "#ffff",
  progressColor = "#FFBB50",
  textColor = "black",
  percentage,
  endAngleProgress,
  isRunning,
  timeLeft,
  totalSeconds,
  onComplete,
}) => {
  const font = useFont(require("../../../assets/font/Roboto-Bold.ttf"), 30)

  const innerRadius = radius - strokeWidth / 2
  const path = Skia.Path.Make()
  path.addCircle(radius, radius, innerRadius)

  const formatTime = useCallback((secs: number) => {
    "worklet"
    const mins = Math.floor(secs / 60)
    const remainingSecs = Math.floor(secs % 60)

    return `${String(mins).padStart(2, "0")}:${String(remainingSecs).padStart(2, "0")}`
  }, [])
  const timeText = useDerivedValue(() => {
    return formatTime(timeLeft.value)
  }, [timeLeft])

  useDerivedValue(() => {
    const remaining = Math.ceil((percentage.value / 100) * totalSeconds)
    timeLeft.value = remaining

    if (percentage.value === 0 && isRunning.value) {
      isRunning.value = false
      if (onComplete) {
        runOnJS(onComplete)()
      }
    }
  }, [percentage, isRunning, timeLeft, totalSeconds])

  const timeTextMetrics = useDerivedValue(() => {
    if (!font) return { width: 0, height: 0 }
    return font.measureText(timeText.value)
  }, [font, timeText])

  const timeTextX = useDerivedValue(() => {
    if (!font) return radius
    return radius - timeTextMetrics.value.width / 2
  }, [font, radius, timeTextMetrics])

  const fixedFontSizeHeight = font ? font.measureText("00:00").height : 24
  const timeTextY = radius + fixedFontSizeHeight / 2 - fixedFontSizeHeight * 0.8

  if (!font) {
    return null
  }

  return (
    <View style={styles.container}>
      <View style={{ width: radius * 2, height: radius * 2 }}>
        <Canvas style={styles.canvas}>
          {/* Background circular path */}
          <Path
            path={path}
            strokeWidth={strokeWidth}
            color={backgroundColor}
            style="stroke"
            strokeJoin="round"
            strokeCap="round"
            start={0}
            end={1}
          />
          {/* Progress circular path */}
          <Path
            path={path}
            strokeWidth={strokeWidth}
            color={progressColor}
            style="stroke"
            strokeJoin="round"
            strokeCap="round"
            start={0}
            end={endAngleProgress}
          />
          {/* Time text */}
          <SkText
            x={timeTextX}
            y={timeTextY} // Adjusted Y position
            text={timeText}
            font={font}
            color={textColor}
          />
        </Canvas>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  canvas: {
    flex: 1,
  },
})
