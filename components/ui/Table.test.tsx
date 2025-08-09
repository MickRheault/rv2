import { render, screen } from '@testing-library/react'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from './Table'

describe('Table', () => {
  it('renders table structure', () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>H1</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>C1</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    )
    expect(screen.getByText('H1')).toBeInTheDocument()
    expect(screen.getByText('C1')).toBeInTheDocument()
  })
})


