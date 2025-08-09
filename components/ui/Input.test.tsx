import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Input from './Input'

describe('Input', () => {
  it('renders label and updates value', async () => {
    const user = userEvent.setup()
    render(<Input label="Email" placeholder="type" />)
    const input = screen.getByPlaceholderText('type') as HTMLInputElement
    expect(screen.getByText('Email')).toBeInTheDocument()
    await user.type(input, 'abc')
    expect(input.value).toBe('abc')
  })
})


