import React, { useEffect } from "react"
import { StyleSheet, View } from "react-native"
import { GestureDetector, Gesture } from "react-native-gesture-handler"
import { Canvas, RoundedRect, Circle, Group } from "@shopify/react-native-skia"
import Animated, {
  useSharedValue,
  withTiming,
  useAnimatedReaction,
  useDerivedValue,
  runOnJS,
} from "react-native-reanimated"

export const SkiaSlider = ({
  initialValue = 0,
  minValue = 0,
  maxValue = 100,
  sliderWidth = 300,
  trackHeight = 50,
  handleSize = 40,
  trackColor = "#82cab2",
  activeTrackColor = "#60a892",
  handleColor = "#f8f9ff",
  onValueChange = (value: number) => {},
}) => {
  // Calculate initial position based on value
  const valueToPosition = (value: number) => {
    const trackPadding = 5
    const trackInnerWidth = sliderWidth - trackPadding * 2
    const sliderRange = trackInnerWidth - handleSize
    return ((value - minValue) / (maxValue - minValue)) * sliderRange
  }

  const trackPadding = 5
  const trackInnerWidth = sliderWidth - trackPadding * 2
  const sliderRange = trackInnerWidth - handleSize
  const handleRadius = handleSize / 2

  // Shared values for animations
  const offset = useSharedValue(valueToPosition(initialValue))
  const isDragging = useSharedValue(false)

  // Handle value changes
  const updateValue = (position: number) => {
    const newValue = minValue + (position / sliderRange) * (maxValue - minValue)
    onValueChange(Math.round(newValue))
  }

  // Initialize value on mount and when dependencies change
  useEffect(() => {
    const position = valueToPosition(initialValue)
    offset.value = position
    onValueChange(initialValue)
  }, [initialValue, sliderWidth, handleSize, minValue, maxValue])

  // Derive current value for display
  const currentValue = useDerivedValue(() => {
    "worklet"
    const value = minValue + (offset.value / sliderRange) * (maxValue - minValue)
    return Math.round(value)
  })

  // Update parent component
  useAnimatedReaction(
    () => offset.value,
    (position) => {
      runOnJS(updateValue)(position)
    },
  )

  // Pan gesture handler
  const pan = Gesture.Pan()
    .onBegin(() => {
      isDragging.value = true
    })
    .onChange((event) => {
      const newOffset = Math.max(0, Math.min(sliderRange, offset.value + event.changeX))
      offset.value = newOffset
    })
    .onFinalize(() => {
      isDragging.value = false
    })

  // Calculate handle X position
  const handleX = useDerivedValue(() => {
    return trackPadding + offset.value
  })

  return (
    <GestureDetector gesture={pan}>
      <View style={styles.container}>
        <Canvas style={{ width: sliderWidth, height: trackHeight }}>
          <RoundedRect
            x={0}
            y={0}
            width={sliderWidth}
            height={trackHeight}
            r={trackHeight / 2}
            color={trackColor}
          />
          <RoundedRect
            x={0}
            y={0}
            width={handleX}
            height={trackHeight}
            r={trackHeight / 2}
            color={activeTrackColor}
          />
          <Circle cx={handleX} cy={trackHeight / 2} r={handleRadius} color={handleColor}>
            <Circle
              cx={0}
              cy={0}
              r={handleRadius}
              color="rgba(0, 0, 0, 0.2)"
              transform={[{ translateY: 2 }]}
            />
          </Circle>
        </Canvas>
      </View>
    </GestureDetector>
  )
}

const styles = StyleSheet.create({
  container: {
    justifyContent: "center",
    alignItems: "center",
  },
})
