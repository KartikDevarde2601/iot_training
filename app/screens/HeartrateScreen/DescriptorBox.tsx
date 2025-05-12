import React from "react"
import { View, ScrollView, ViewStyle, TextStyle } from "react-native"
import { spacing, colors, typography } from "app/theme"
import { Screen, Text, Button } from "@/components"

export interface DescriptorInfo {
  uuid: string
  value?: any
}

export interface DescriptorBoxProps {
  title?: string
  isProcessing: boolean
  error?: string | null
  data: {
    uuid: string
    characteristics: {
      uuid: string
      properties: CharacteristicInfo["properties"]
      descriptors: string[]
    }[]
  }[]
  placeholder?: string
}

export interface CharacteristicInfo {
  uuid: string
  properties: {
    isReadable?: boolean
    isWritableWithResponse?: boolean
    isWritableWithoutResponse?: boolean
    isNotifiable?: boolean
    isIndicatable?: boolean
    // Add other properties if available from your BLE library
  }
  descriptors: DescriptorInfo[]
}

export interface ServiceInfo {
  uuid: string
  characteristics: CharacteristicInfo[]
}

export const DescriptorBox = ({
  title = "Device Services & Characteristics:",
  isProcessing,
  error,
  data,
  placeholder = "Click 'Inspect All Services & Chars' to view details.",
}: DescriptorBoxProps) => {
  const getPropertiesString = (properties: CharacteristicInfo["properties"]): string => {
    const props: string[] = []
    if (properties.isReadable) props.push("Read")
    if (properties.isWritableWithResponse) props.push("Write")
    if (properties.isWritableWithoutResponse) props.push("WriteWithoutResponse")
    if (properties.isNotifiable) props.push("Notify")
    if (properties.isIndicatable) props.push("Indicate")
    return props.length > 0 ? props.join(", ") : "N/A"
  }

  return (
    <View style={$outerDescriptorBox}>
      <Text
        text="Device Services & Characteristics:"
        preset="subheading"
        style={$descriptorHeading}
      />
      {isProcessing && !data && <Text style={$placeholderText}>Inspecting device...</Text>}
      {!isProcessing && data === null && (
        <Text style={$placeholderText}>Click 'Inspect All Services & Chars' to view details.</Text>
      )}
      {data && data.length === 0 && !isProcessing && (
        <Text style={$placeholderText}>No services found on the device.</Text>
      )}
      {data &&
        data.length > 0 &&
        data.map((service, serviceIndex) => (
          <View key={`service-${service.uuid}-${serviceIndex}`} style={$serviceContainer}>
            <Text style={$serviceUuidText}>Service: {service.uuid}</Text>
            {service.characteristics.map((char, charIndex) => (
              <View key={`char-${char.uuid}-${charIndex}`} style={$characteristicContainer}>
                <Text style={$charUuidText}> Characteristic: {char.uuid}</Text>
                <Text style={$propertyText}>
                  {" "}
                  Properties: {getPropertiesString(char.properties)}
                </Text>
                {char.descriptors.length > 0 && (
                  <View>
                    <Text style={$descriptorListHeader}> Descriptors:</Text>
                    {char.descriptors.map((desc, descIndex) => (
                      <Text key={`desc-${desc}-${descIndex}`} style={$descriptorUuidText}>
                        {" "}
                        - {desc}
                      </Text>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </View>
        ))}
    </View>
  )
}

// Styles for the dynamic services/characteristics display box
const $outerDescriptorBox: ViewStyle = {
  flex: 1,
  padding: spacing.md,
  backgroundColor: colors.palette.neutral100,
  borderRadius: spacing.sm,
  borderColor: colors.palette.neutral300,
}
const $descriptorHeading: TextStyle = {
  marginBottom: spacing.sm,
  fontFamily: typography.primary.semiBold,
  color: colors.text,
}
const $discoveredServicesScrollView: ViewStyle = {
  flex: 1, // Allows ScrollView to take available space within maxHeight
}
const $placeholderText: TextStyle = {
  color: colors.textDim,
  fontFamily: typography.primary.normal,
  textAlign: "center",
  paddingVertical: spacing.lg,
}
const $serviceContainer: ViewStyle = {
  marginBottom: spacing.md,
  paddingLeft: spacing.xs,
}
const $serviceUuidText: TextStyle = {
  fontFamily: typography.primary.semiBold,
  color: colors.text,
}
const $characteristicContainer: ViewStyle = {
  marginTop: spacing.xs,
  paddingLeft: spacing.sm, // Indent characteristics
}
const $charUuidText: TextStyle = {
  fontFamily: typography.primary.medium,
  color: colors.textDim,
}
const $propertyText: TextStyle = {
  fontFamily: typography.primary.light,
  color: colors.textDim,
  paddingLeft: spacing.sm, // Further indent properties
}
const $descriptorListHeader: TextStyle = {
  color: colors.textDim,
  paddingLeft: spacing.md,
  marginTop: spacing.xxs,
}
const $descriptorUuidText: TextStyle = {
  fontFamily: typography.primary.light,
  color: colors.textDim,
  paddingLeft: spacing.lg, // Further indent descriptors
}
