// Code primitive - syntax highlighted code display

import React from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import type { CodePrimitive } from '../types'

export interface CodeProps {
  primitive: CodePrimitive
  className?: string
}

export function Code({ primitive, className }: CodeProps) {
  const { code, language = 'text', showLineNumbers = true, highlightLines = [] } = primitive

  const lineProps = (lineNumber: number) => {
    const style: React.CSSProperties = {}
    if (highlightLines.includes(lineNumber)) {
      style.backgroundColor = 'rgba(255, 255, 0, 0.1)'
      style.display = 'block'
    }
    return { style }
  }

  return (
    <div style={{
      borderRadius: '8px',
      overflow: 'hidden',
      fontSize: '0.8125rem'
    }} className={className}>
      <SyntaxHighlighter
        language={language}
        style={oneDark}
        showLineNumbers={showLineNumbers}
        wrapLines={highlightLines.length > 0}
        lineProps={highlightLines.length > 0 ? lineProps : undefined}
        customStyle={{
          margin: 0,
          padding: '16px',
          borderRadius: '8px'
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  )
}
