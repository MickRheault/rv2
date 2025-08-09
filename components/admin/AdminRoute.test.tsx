import { render, screen } from '@testing-library/react'
import { AdminRoute } from './AdminRoute'

jest.mock('@/hooks/useAdminAuth', () => ({
  useAdminAuth: () => ({ isLoading: false, isAdmin: true, user: { id: '1' } }),
  useAdminPermission: () => ({ isLoading: false, hasAccess: true }),
}))

describe('AdminRoute', () => {
  it('renders children when authorized', () => {
    render(<AdminRoute><div>Secret</div></AdminRoute>)
    expect(screen.getByText('Secret')).toBeInTheDocument()
  })
})


