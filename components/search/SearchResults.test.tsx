import { render } from '@testing-library/react'
import SearchResults from './SearchResults'

jest.mock('@/lib/supabase/client', () => ({ supabase: {} }))
jest.mock('@/services/search', () => ({ searchService: { searchByLocation: jest.fn() } }))

describe('SearchResults', () => {
  it('renders empty state without crashing', () => {
    render(<SearchResults filters={{ offset: 0, limit: 20 } as any} />)
  })
})


