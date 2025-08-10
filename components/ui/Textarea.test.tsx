import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Textarea from './Textarea'

describe('Textarea', () => {
  it('renders label and updates value', async () => {
    const user = userEvent.setup()
    render(<Textarea label="Notes" placeholder="enter" />)
    const input = screen.getByPlaceholderText('enter') as HTMLTextAreaElement
    await user.type(input, 'hello')
    expect(input.value).toBe('hello')
  })
})


