import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Switch from './Switch'

describe('Switch', () => {
  it('toggles when clicked (uncontrolled)', async () => {
    const user = userEvent.setup()
    render(<Switch label="Enable" />)
    const button = screen.getByRole('switch')
    expect(button).toHaveAttribute('aria-checked', 'false')
    await user.click(button)
    expect(button).toHaveAttribute('aria-checked', 'true')
  })
})


