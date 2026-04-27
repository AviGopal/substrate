// Form primitive - TanStack Form based multi-field form component

import React, { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import type { FormPrimitive, FormField } from '../../types'
import { Input } from '../components/ui/input'
import { Button } from '../components/ui/button'
import { Textarea } from '../components/ui/textarea'
import { Checkbox } from '../components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select'
import { cn } from '../lib/utils'

export interface FormProps {
  primitive: FormPrimitive
  onAction?: (actionId: string, payload?: Record<string, unknown>) => void
}

// ============================================================================
// Router integration (try/catch fallback for out-of-router contexts)
// ============================================================================

function useSafeStep(): [number, (step: number) => void] {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useSearch, useNavigate } = require('@tanstack/react-router')
    const search = useSearch({ from: '/app' }) as { step?: number }
    const navigate = useNavigate()
    const step = search?.step ?? 0
    const setStep = (s: number) => {
      navigate({ search: (prev: Record<string, unknown>) => ({ ...prev, step: s }) })
    }
    return [step, setStep]
  } catch {
    const [step, setStep] = useState(0)
    return [step, setStep]
  }
}

// ============================================================================
// Field renderer
// ============================================================================

interface FieldRendererProps {
  field: FormField
  value: unknown
  onChange: (v: unknown) => void
  error?: string
}

function FieldRenderer({ field, value, onChange, error }: FieldRendererProps) {
  const { type, label, placeholder, options, required } = field

  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </label>

      {type === 'text' && (
        <Input
          type="text"
          value={String(value ?? '')}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {type === 'number' && (
        <Input
          type="number"
          value={String(value ?? '')}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        />
      )}

      {type === 'date' && (
        <Input
          type="date"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {type === 'textarea' && (
        <Textarea
          value={String(value ?? '')}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {type === 'select' && (
        <Select value={String(value ?? '')} onValueChange={onChange}>
          <SelectTrigger>
            <SelectValue placeholder={placeholder ?? `Select ${label}`} />
          </SelectTrigger>
          <SelectContent>
            {options?.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {type === 'checkbox' && (
        <div className="flex items-center gap-2">
          <Checkbox
            checked={Boolean(value)}
            onCheckedChange={(checked) => onChange(checked)}
            id={`field-${field.name}`}
          />
          <label htmlFor={`field-${field.name}`} className="text-sm cursor-pointer">
            {placeholder ?? label}
          </label>
        </div>
      )}

      {type === 'radio' && (
        <RadioGroup value={String(value ?? '')} onValueChange={onChange}>
          {options?.map((opt) => (
            <div key={opt.value} className="flex items-center gap-2">
              <RadioGroupItem value={opt.value} id={`${field.name}-${opt.value}`} />
              <label htmlFor={`${field.name}-${opt.value}`} className="text-sm cursor-pointer">
                {opt.label}
              </label>
            </div>
          ))}
        </RadioGroup>
      )}

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  )
}

// ============================================================================
// FormPrimitive component
// ============================================================================

export function FormPrimitive({ primitive, onAction }: FormProps) {
  const { fields, submitLabel = 'Submit', action, steps } = primitive
  const [currentStep, setCurrentStep] = useSafeStep()

  // Build default values
  const defaultValues: Record<string, unknown> = {}
  fields.forEach((f) => {
    defaultValues[f.name] = f.defaultValue ?? (
      f.type === 'checkbox' ? false :
      f.type === 'number' ? '' :
      ''
    )
  })

  const form = useForm({
    defaultValues,
    onSubmit: async ({ value }) => {
      onAction?.(action ?? 'form_submit', { values: value })
    },
  })

  // Determine which fields to show based on step
  const visibleFieldNames: Set<string> = (() => {
    if (!steps || steps.length === 0) return new Set(fields.map((f) => f.name))
    const step = steps[currentStep]
    return new Set(step?.fields ?? [])
  })()

  const visibleFields = fields.filter((f) => visibleFieldNames.has(f.name))

  const isStepMode = steps && steps.length > 0
  const totalSteps = steps?.length ?? 1
  const isLastStep = !isStepMode || currentStep >= totalSteps - 1

  const validateField = (field: FormField, value: unknown): string | undefined => {
    if (field.required) {
      const isEmpty = value === '' || value === null || value === undefined ||
        (typeof value === 'string' && value.trim() === '')
      if (isEmpty) {
        return field.errorMessage ?? `${field.label} is required`
      }
    }
    return undefined
  }

  const handleNext = () => {
    // Validate visible fields before advancing
    let hasErrors = false
    visibleFields.forEach((f) => {
      const val = form.getFieldValue(f.name as never)
      const err = validateField(f, val)
      if (err) hasErrors = true
    })
    if (!hasErrors && currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        form.handleSubmit()
      }}
      className="flex flex-col gap-4"
    >
      {isStepMode && (
        <div className="text-sm text-muted-foreground font-medium">
          {steps![currentStep]?.title && (
            <span>{steps![currentStep].title} — </span>
          )}
          Step {currentStep + 1} of {totalSteps}
        </div>
      )}

      {visibleFields.map((field) => (
        <form.Field
          key={field.name}
          name={field.name as never}
          validators={{
            onBlur: ({ value }) => {
              const err = validateField(field, value)
              return err
            },
          }}
        >
          {(f) => (
            <FieldRenderer
              field={field}
              value={f.state.value as unknown}
              onChange={(v) => f.handleChange(v as never)}
              error={f.state.meta.errors.join(', ') || undefined}
            />
          )}
        </form.Field>
      ))}

      <div className="flex gap-2 justify-end mt-2">
        {isStepMode && currentStep > 0 && (
          <Button
            type="button"
            variant="outline"
            onClick={() => setCurrentStep(currentStep - 1)}
          >
            Previous
          </Button>
        )}

        {!isLastStep ? (
          <Button type="button" onClick={handleNext}>
            Next
          </Button>
        ) : (
          <Button type="submit">
            {submitLabel}
          </Button>
        )}
      </div>
    </form>
  )
}
