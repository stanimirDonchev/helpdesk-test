import { screen } from '@testing-library/react'
import axios from 'axios'
import { expect, test, vi } from 'vitest'
import { renderWithQueryClient } from '../test/render-with-query'
import { TicketsTable } from './TicketsTable'

vi.mock('axios')

const mockTickets = [
  {
    id: '1',
    subject: 'Cannot reset my password',
    senderEmail: 'ada@example.com',
    senderName: 'Ada Lovelace',
    status: 'open',
    category: 'technical_question',
    receivedAt: '2024-03-01T09:00:00.000Z',
  },
  {
    id: '2',
    subject: 'Refund for last month',
    senderEmail: 'gene@example.com',
    senderName: null,
    status: 'resolved',
    category: null,
    receivedAt: '2024-03-02T09:00:00.000Z',
  },
]

test('fetches the ticket list from /api/tickets', () => {
  vi.mocked(axios.get).mockReturnValue(new Promise(() => {}))

  renderWithQueryClient(<TicketsTable />)

  expect(axios.get).toHaveBeenCalledWith('/api/tickets')
})

test('shows skeleton rows before the fetch resolves', () => {
  vi.mocked(axios.get).mockReturnValue(new Promise(() => {}))

  const { container } = renderWithQueryClient(<TicketsTable />)

  expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0)
})

test('renders a column header for each field', async () => {
  vi.mocked(axios.get).mockResolvedValue({ data: { tickets: mockTickets } })

  renderWithQueryClient(<TicketsTable />)
  await screen.findByText('Cannot reset my password')

  expect(screen.getByRole('columnheader', { name: 'Subject' })).toBeInTheDocument()
  expect(screen.getByRole('columnheader', { name: 'From' })).toBeInTheDocument()
  expect(screen.getByRole('columnheader', { name: 'Status' })).toBeInTheDocument()
  expect(screen.getByRole('columnheader', { name: 'Category' })).toBeInTheDocument()
  expect(screen.getByRole('columnheader', { name: 'Received' })).toBeInTheDocument()
})

test('renders the tickets once loaded', async () => {
  vi.mocked(axios.get).mockResolvedValue({ data: { tickets: mockTickets } })

  renderWithQueryClient(<TicketsTable />)

  expect(await screen.findByText('Cannot reset my password')).toBeInTheDocument()
  expect(screen.getByText('Refund for last month')).toBeInTheDocument()
})

test('shows the sender name alongside the address when there is one', async () => {
  vi.mocked(axios.get).mockResolvedValue({ data: { tickets: mockTickets } })

  renderWithQueryClient(<TicketsTable />)

  expect(await screen.findByText('Ada Lovelace <ada@example.com>')).toBeInTheDocument()
  // The second ticket has no sender name, so it falls back to the bare address.
  expect(screen.getByText('gene@example.com')).toBeInTheDocument()
})

test('renders the human-readable status and category labels', async () => {
  vi.mocked(axios.get).mockResolvedValue({ data: { tickets: mockTickets } })

  renderWithQueryClient(<TicketsTable />)
  await screen.findByText('Cannot reset my password')

  expect(screen.getByText('Open')).toBeInTheDocument()
  expect(screen.getByText('Resolved')).toBeInTheDocument()
  expect(screen.getByText('Technical Question')).toBeInTheDocument()
})

test('shows a placeholder for a ticket that has not been classified yet', async () => {
  vi.mocked(axios.get).mockResolvedValue({ data: { tickets: mockTickets } })

  renderWithQueryClient(<TicketsTable />)
  await screen.findByText('Refund for last month')

  expect(screen.getByText('—')).toBeInTheDocument()
})

test('formats the received date', async () => {
  vi.mocked(axios.get).mockResolvedValue({ data: { tickets: mockTickets } })

  renderWithQueryClient(<TicketsTable />)
  await screen.findByText('Cannot reset my password')

  expect(
    screen.getByText(new Date('2024-03-01T09:00:00.000Z').toLocaleDateString()),
  ).toBeInTheDocument()
})

test('shows an empty state when there are no tickets', async () => {
  vi.mocked(axios.get).mockResolvedValue({ data: { tickets: [] } })

  renderWithQueryClient(<TicketsTable />)

  expect(await screen.findByText('No tickets yet.')).toBeInTheDocument()
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
})

test('shows an error state when the fetch fails', async () => {
  vi.mocked(axios.get).mockRejectedValue(new Error('network error'))

  renderWithQueryClient(<TicketsTable />)

  expect(await screen.findByText('Failed to load tickets.')).toBeInTheDocument()
})
