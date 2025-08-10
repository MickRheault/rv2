import { render, screen, fireEvent } from '@testing-library/react'
import Select from './Select'

describe('Select', () => {
  it('renders options and changes value', () => {
    render(<Select options={[{value:'1',label:'One'},{value:'2',label:'Two'}]} placeholder="Pick" defaultValue="" />)
    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select.value).toBe('')
    fireEvent.change(select, { target: { value: '2' } })
    expect(select.value).toBe('2')
  })
})


