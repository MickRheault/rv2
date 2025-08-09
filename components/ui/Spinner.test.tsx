import { render, screen } from '@testing-library/react'
import Spinner from './Spinner'

describe('Spinner', () => {
  it('renders with role status and label', () => {
    render(<Spinner label="Loading data" />)
    const el = screen.getByRole('status', { name: 'Loading data' })
    expect(el).toBeInTheDocument()
  })
})


