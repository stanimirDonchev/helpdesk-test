import { screen } from '@testing-library/react'
import axios from 'axios'
import { expect, test, vi } from 'vitest'
import { renderWithQueryClient } from '../test/render-with-query'
import { TicketsPage } from './TicketsPage'

vi.mock('axios')

test('renders the heading regardless of load state', () => {
  vi.mocked(axios.get).mockReturnValue(new Promise(() => {}))

  renderWithQueryClient(<TicketsPage />)

  expect(screen.getByRole('heading', { name: 'Tickets' })).toBeInTheDocument()
})

test('renders the ticket table', async () => {
  vi.mocked(axios.get).mockResolvedValue({ data: { tickets: [] } })

  renderWithQueryClient(<TicketsPage />)

  expect(await screen.findByText('No tickets yet.')).toBeInTheDocument()
})
