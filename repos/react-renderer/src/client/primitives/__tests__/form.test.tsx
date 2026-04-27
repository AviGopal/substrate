// Tests for FormPrimitive component

import { describe, it, expect, mock, jest } from 'bun:test'
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { FormPrimitive } from '../form'
import type { FormPrimitive as FormPrimitiveType } from '../../../types'

// Mock @tanstack/react-router
mock.module('@tanstack/react-router', () => ({
  useSearch: () => ({}),
  useNavigate: () => () => {},
}))

const basePrimitive: FormPrimitiveType = {
  type: 'form',
  fields: [
    { name: 'name', label: 'Full Name', type: 'text', required: true },
    { name: 'age', label: 'Age', type: 'number' },
    { name: 'email', label: 'Email', type: 'text' },
  ],
  submitLabel: 'Save',
}

describe('FormPrimitive', () => {
  it('renders all fields', () => {
    render(<FormPrimitive primitive={basePrimitive} />)
    expect(screen.getByText('Full Name')).toBeTruthy()
    expect(screen.getByText('Age')).toBeTruthy()
    expect(screen.getByText('Email')).toBeTruthy()
  })

  it('shows required validation error on blur when field is empty', async () => {
    render(<FormPrimitive primitive={basePrimitive} />)
    const nameInput = screen.getAllByRole('textbox')[0]
    fireEvent.blur(nameInput)
    await waitFor(() => {
      expect(screen.getByText('Full Name is required')).toBeTruthy()
    })
  })

  it('shows custom errorMessage for required fields', async () => {
    const primitive: FormPrimitiveType = {
      ...basePrimitive,
      fields: [
        { name: 'username', label: 'Username', type: 'text', required: true, errorMessage: 'Please enter a username' },
      ],
    }
    render(<FormPrimitive primitive={primitive} />)
    const input = screen.getByRole('textbox')
    fireEvent.blur(input)
    await waitFor(() => {
      expect(screen.getByText('Please enter a username')).toBeTruthy()
    })
  })

  it('calls onAction with form values on submit', async () => {
    const onAction = jest.fn()
    render(<FormPrimitive primitive={{ ...basePrimitive, action: 'my_action' }} onAction={onAction} />)

    const nameInput = screen.getAllByRole('textbox')[0]
    fireEvent.change(nameInput, { target: { value: 'John Doe' } })

    const submitBtn = screen.getByRole('button', { name: 'Save' })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(onAction).toHaveBeenCalledWith('my_action', expect.objectContaining({
        values: expect.objectContaining({ name: 'John Doe' }),
      }))
    })
  })

  it('renders step navigation when steps are provided', () => {
    const primitive: FormPrimitiveType = {
      type: 'form',
      fields: [
        { name: 'name', label: 'Name', type: 'text' },
        { name: 'email', label: 'Email', type: 'text' },
      ],
      steps: [
        { title: 'Personal Info', fields: ['name'] },
        { title: 'Contact', fields: ['email'] },
      ],
    }
    render(<FormPrimitive primitive={primitive} />)
    expect(screen.getByText(/Step 1 of 2/)).toBeTruthy()
    // Only step 1 fields visible
    expect(screen.getByText('Name')).toBeTruthy()
    expect(screen.queryByText('Email')).toBeFalsy()
  })

  it('advances to next step on Next click', async () => {
    const primitive: FormPrimitiveType = {
      type: 'form',
      fields: [
        { name: 'name', label: 'Name', type: 'text' },
        { name: 'email', label: 'Email', type: 'text' },
      ],
      steps: [
        { title: 'Step 1', fields: ['name'] },
        { title: 'Step 2', fields: ['email'] },
      ],
    }
    render(<FormPrimitive primitive={primitive} />)
    const nextBtn = screen.getByRole('button', { name: 'Next' })
    fireEvent.click(nextBtn)
    await waitFor(() => {
      expect(screen.getByText(/Step 2 of 2/)).toBeTruthy()
    })
  })
})
