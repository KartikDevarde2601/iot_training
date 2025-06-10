import { Canvas, Group, Path, Skia, matchFont, rect, Text } from "@shopify/react-native-skia"
import { curveBumpX, scaleLinear, scaleTime, line } from "d3"
import { useEffect, useCallback, useState, FC } from "react"
import { Dimensions, View, ViewStyle, TextStyle } from "react-native"
import { runOnUI, useSharedValue } from "react-native-reanimated"
import { Text as TextComponent } from "@/components"

interface RealTimeGraphProps {
  value: number
  title: string
  graphColor: string
  maxPoints?: number
  minValue?: number
  maxValue?: number
  height?: number
}

const DEFAULT_WIDTH = Dimensions.get("screen").width - 50
const DEFAULT_HEIGHT = 180
const DEFAULT_MAX_POINTS = 20

type DataPoint = {
  date: Date
  value: number
}

const generateTicks = (min: number, max: number, numTicks: number = 5): number[] => {
  const step = (max - min) / (numTicks - 1)
  return Array.from({ length: numTicks }, (_, i) => Math.round(min + i * step))
}

export const RealTimeGraph: FC<RealTimeGraphProps> = ({
  value,
  title,
  graphColor,
  maxPoints = DEFAULT_MAX_POINTS,
  minValue = 0,
  height = DEFAULT_HEIGHT,
}) => {
  const [data, setData] = useState<DataPoint[]>(() =>
    Array.from({ length: maxPoints }, (_, i) => ({
      date: new Date(Date.now() - (maxPoints - i) * 1000),
      value: minValue,
    })),
  )

  const path = useSharedValue<string>("")
  const yPoints = useSharedValue<number[]>([])
  const yTicks = useSharedValue<number[]>([])

  const font = matchFont({
    fontFamily: "Helvetica",
    fontSize: 12,
    fontWeight: "bold",
  })

  // Update data when new value comes in
  useEffect(() => {
    setData((prevData) => {
      const newData = [...prevData]
      newData.shift()
      newData.push({
        date: new Date(),
        value: value,
      })
      return newData
    })
  }, [value])

  const calculatePath = useCallback(
    (currentData: DataPoint[]) => {
      let maxValue = 500
      let minValue = 0
      if (minValue === 0 && maxValue === 0) {
        maxValue = 10
        minValue = -10
      }

      const xScale = scaleTime()
        .domain([currentData[0].date, currentData[currentData.length - 1].date])
        .range([0, DEFAULT_WIDTH])

      const yScale = scaleLinear()
        .domain([minValue, maxValue])
        .range([height - 20, 20])

      const ticks = generateTicks(minValue, maxValue)

      const l = line<DataPoint>()
        .x((d: any) => xScale(d.date))
        .y((d: any) => yScale(d.value))
        .curve(curveBumpX)

      const pathData = l(currentData)!
      const calculatedYPoints = ticks.map((tick) => yScale(tick))

      return {
        pathData,
        yPoints: calculatedYPoints,
        ticks,
      }
    },
    [data],
  )

  const updatePath = useCallback(
    (pathString: string, newYPoints: number[], newYTicks: number[]) => {
      "worklet"
      path.value = pathString
      yPoints.value = newYPoints
      yTicks.value = newYTicks
    },
    [],
  )

  // Recalculate path when data changes
  useEffect(() => {
    const { pathData, yPoints: newYPoints, ticks: newTicks } = calculatePath(data)
    runOnUI(updatePath)(pathData, newYPoints, newTicks)
  }, [data, calculatePath, updatePath])

  return (
    <View style={$graphWrapper}>
      <TextComponent text={title} preset="subheading" />
      <View style={$graphContainer}>
        <Canvas style={{ width: DEFAULT_WIDTH, height }}>
          <Group>
            {yPoints.value.map((yPoint, i) => (
              <Group key={i}>
                <Path
                  color="#090909"
                  style="stroke"
                  strokeWidth={1}
                  path={`M30,${yPoint} L${DEFAULT_WIDTH},${yPoint}`}
                />
                <Text
                  text={yTicks.value[i]?.toString() ?? ""}
                  x={0}
                  y={yPoint + 10}
                  color="#474747"
                  font={font}
                />
              </Group>
            ))}
          </Group>
          <Group clip={rect(30, 0, DEFAULT_WIDTH, height)}>
            <Path
              style="stroke"
              strokeWidth={3}
              color={graphColor}
              path={Skia.Path.MakeFromSVGString(path.value) || Skia.Path.Make()}
            />
          </Group>
        </Canvas>
      </View>
    </View>
  )
}

const $graphWrapper: ViewStyle = {
  marginVertical: 8,
  alignItems: "center",
}

const $graphContainer: ViewStyle = {
  backgroundColor: "#f0f0f0",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 8,
}

const $title: TextStyle = {
  fontSize: 16,
  fontWeight: "bold",
  marginBottom: 8,
}
