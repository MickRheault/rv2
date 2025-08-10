import { render, screen } from '@testing-library/react'
import { ErrorBoundary } from './ErrorBoundary'

function Bomb() { throw new Error('Boom') }

describe('ErrorBoundary', () => {
  it('catches errors and renders fallback', () => {
    render(
      <ErrorBoundary level="component">
        {/* @ts-expect-error testing error boundary */}
        <Bomb />
      </ErrorBoundary>
    )
    expect(screen.getByText(/failed to load/i)).toBeInTheDocument()
  })
})


