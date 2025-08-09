import { render, screen, fireEvent } from '@testing-library/react'
import Alert from './Alert'

describe('Alert', () => {
  it('renders title and description', () => {
    render(<Alert title="Info Title" description="Info description" />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Info Title')).toBeInTheDocument()
    expect(screen.getByText('Info description')).toBeInTheDocument()
  })

  it('calls onDismiss when dismissible', () => {
    const onDismiss = jest.fn()
    render(
      <Alert title="Dismissible" dismissible onDismiss={onDismiss} />
    )
    fireEvent.click(screen.getByLabelText('Dismiss'))
    expect(onDismiss).toHaveBeenCalled()
  })
})


