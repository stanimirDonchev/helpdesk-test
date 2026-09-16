import { screen } from '@testing-library/react'
import axios from 'axios'
import { expect, test, vi } from 'vitest'
import { renderWithQueryClient } from '../test/render-with-query'
import { HomePage } from './HomePage'

vi.mock('axios')

test('renders the heading and the API status once loaded', async () => {
  vi.mocked(axios.get).mockResolvedValue({ data: { status: 'ok' } })

  renderWithQueryClient(<HomePage />)

  expect(screen.getByRole('heading', { name: 'Helpdesk' })).toBeInTheDocument()
  expect(screen.getByText('API status')).toBeInTheDocument()
  expect(await screen.findByText('ok')).toBeInTheDocument()
})
