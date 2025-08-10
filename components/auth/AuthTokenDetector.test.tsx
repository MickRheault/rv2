import { render } from '@testing-library/react'
import AuthTokenDetector from './AuthTokenDetector'

describe('AuthTokenDetector', () => {
  it('renders without crashing', () => {
    render(<AuthTokenDetector />)
  })
})


