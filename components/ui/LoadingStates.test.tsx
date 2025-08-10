import { render, screen } from '@testing-library/react'
import { SkeletonText, LoadingOverlay, ErrorState, InlineError, EmptyState } from './LoadingStates'

describe('LoadingStates', () => {
  it('renders skeleton text', () => {
    render(<SkeletonText className="h-4 w-8" />)
    // no assertion on classes, just ensure it mounts
  })

  it('renders LoadingOverlay when isLoading', () => {
    render(
      <LoadingOverlay isLoading message="Loading...">
        <div>child</div>
      </LoadingOverlay>
    )
    // Two occurrences: Spinner sr-only and visible paragraph
    const nodes = screen.getAllByText('Loading...')
    expect(nodes.length).toBeGreaterThanOrEqual(1)
  })

  it('renders ErrorState with retry', () => {
    const onRetry = jest.fn()
    render(<ErrorState title="Oops" message="Err" onRetry={onRetry} />)
    screen.getByRole('button', { name: /try again/i }).click()
    expect(onRetry).toHaveBeenCalled()
  })

  it('renders InlineError', () => {
    render(<InlineError message="Inline" />)
    expect(screen.getByText('Inline')).toBeInTheDocument()
  })

  it('renders EmptyState', () => {
    render(<EmptyState title="Nothing" description="none" />)
    expect(screen.getByText('Nothing')).toBeInTheDocument()
    expect(screen.getByText('none')).toBeInTheDocument()
  })
})


