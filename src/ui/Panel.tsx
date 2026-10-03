import React from 'react'
import { Box, Text } from 'ink'
import stringWidth from 'string-width'
import { useTerminal } from './terminal.js'

/** One run of text drawn into a border line, styled on its own. */
export interface LabelSegment {
  text: string
  color?: string
  bold?: boolean
  dimColor?: boolean
}

/** Columns a border label costs beyond its text: two corners and a space on either side. */
export const LABEL_CHROME = 4

export function labelWidth(label: LabelSegment[]): number {
  return label.reduce((width, segment) => width + stringWidth(segment.text), 0)
}

interface BorderLineProps {
  width: number
  corners: [string, string]
  fill: string
  label: LabelSegment[]
  color?: string
}

/**
 * One border row with its label centered in it. A border cannot wrap, so a
 * label that does not fit is dropped rather than broken; callers fit their
 * text to the width first.
 */
function BorderLine({ width, corners, fill, label, color }: BorderLineProps): React.ReactElement {
  const inner = Math.max(0, width - 2)
  const text = labelWidth(label)
  const shown = text > 0 && text + LABEL_CHROME <= width
  const free = shown ? inner - text - 2 : inner
  const left = Math.floor(free / 2)
  const gap = shown ? ' ' : ''
  return (
    <Box height={1} flexShrink={0}>
      <Text color={color}>{`${corners[0]}${fill.repeat(left)}${gap}`}</Text>
      {shown && label.map((segment, index) => (
        <Text key={index} color={segment.color} bold={segment.bold} dimColor={segment.dimColor}>
          {segment.text}
        </Text>
      ))}
      <Text color={color}>{`${gap}${fill.repeat(free - left)}${corners[1]}`}</Text>
    </Box>
  )
}

export interface PanelProps {
  /** Outer width in columns, borders included. */
  width: number
  title?: LabelSegment[]
  footer?: LabelSegment[]
  color?: string
  /** Columns between each side border and the content. */
  paddingX?: number
  /** Takes the rows its column has left, so a side Panel ends level with the main one. */
  grow?: boolean
  children?: React.ReactNode
}

/**
 * A bordered, titled region of the layout. Ink draws the two sides, so they
 * stretch with whatever height flex gives the Panel; the top and bottom rows
 * are drawn here because Ink's own border cannot carry a label.
 */
export function Panel({
  width,
  title = [],
  footer = [],
  color,
  paddingX = 1,
  grow = false,
  children,
}: PanelProps): React.ReactElement {
  const { box } = useTerminal().glyphs
  return (
    <Box flexDirection="column" width={width} flexGrow={grow ? 1 : 0} flexShrink={0}>
      <BorderLine width={width} corners={[box.topLeft, box.topRight]} fill={box.top} label={title} color={color} />
      <Box
        flexDirection="column"
        flexGrow={1}
        borderStyle={box}
        borderTop={false}
        borderBottom={false}
        borderColor={color}
        paddingX={paddingX}
        overflowX="hidden"
      >
        {children}
      </Box>
      <BorderLine
        width={width}
        corners={[box.bottomLeft, box.bottomRight]}
        fill={box.bottom}
        label={footer}
        color={color}
      />
    </Box>
  )
}
