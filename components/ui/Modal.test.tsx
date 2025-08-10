import { render, screen, fireEvent } from '@testing-library/react'
import Modal from './Modal'

describe('Modal', () => {
  it('renders when open and closes on close button', () => {
    const onClose = jest.fn()
    render(
      <Modal isOpen onClose={onClose} title="Title">
        Content
      </Modal>
    )
    expect(screen.getByText('Title')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Close modal'))
    expect(onClose).toHaveBeenCalled()
  })
})


