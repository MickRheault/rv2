import { render, screen, fireEvent } from '@testing-library/react'
import Pagination from './Pagination'

describe('Pagination', () => {
  it('renders and navigates pages', () => {
    const onPageChange = jest.fn()
    const onPageSizeChange = jest.fn()
    render(
      <Pagination
        currentPage={2}
        totalPages={5}
        pageSize={10}
        totalItems={100}
        startItem={11}
        endItem={20}
        hasNextPage
        hasPrevPage
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    )
    fireEvent.click(screen.getByText('Next'))
    expect(onPageChange).toHaveBeenCalledWith(3)
  })
})


