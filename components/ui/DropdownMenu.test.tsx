import { render, screen, fireEvent } from '@testing-library/react'
import { DropdownMenu, DropdownMenuItem } from './DropdownMenu'

describe('DropdownMenu', () => {
  it('opens and triggers item click', () => {
    const onClick = jest.fn()
    render(
      <DropdownMenu trigger={<span>Open</span>}>
        <DropdownMenuItem onClick={onClick}>Item</DropdownMenuItem>
      </DropdownMenu>
    )
    fireEvent.click(screen.getByText('Open'))
    fireEvent.click(screen.getByText('Item'))
    expect(onClick).toHaveBeenCalled()
  })
})


