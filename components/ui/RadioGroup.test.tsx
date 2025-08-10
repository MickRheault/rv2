import { render, screen, fireEvent } from '@testing-library/react'
import RadioGroup, { RadioOption } from './RadioGroup'

describe('RadioGroup', () => {
  it('selects radio option', () => {
    const handleChange = jest.fn()
    render(
      <RadioGroup name="size" value="m" onChange={handleChange}>
        <RadioOption value="s" label="Small" />
        <RadioOption value="m" label="Medium" />
      </RadioGroup>
    )
    const medium = screen.getByLabelText('Medium') as HTMLInputElement
    expect(medium.checked).toBe(true)
    const small = screen.getByLabelText('Small') as HTMLInputElement
    fireEvent.click(small)
    expect(handleChange).toHaveBeenCalledWith('s')
  })
})


