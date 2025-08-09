import { render, screen, fireEvent } from '@testing-library/react'
import Checkbox from './Checkbox'

describe('Checkbox', () => {
  it('toggles checked state', () => {
    render(<Checkbox label="Accept" />)
    const input = screen.getByLabelText('Accept') as HTMLInputElement
    expect(input.checked).toBe(false)
    fireEvent.click(input)
    expect(input.checked).toBe(true)
  })
})


