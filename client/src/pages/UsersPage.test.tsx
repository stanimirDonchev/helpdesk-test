import { screen } from '@testing-library/react'
import axios from 'axios'
import { expect, test, vi } from 'vitest'
import { renderWithQueryClient } from '../test/render-with-query'
import { UsersPage } from './UsersPage'

vi.mock('axios')

test('renders the heading regardless of load state', () => {
  vi.mocked(axios.get).mockReturnValue(new Promise(() => {}))

  renderWithQueryClient(<UsersPage />)

  expect(screen.getByRole('heading', { name: 'Users' })).toBeInTheDocument()
})

test('renders a button to create a user', () => {
  vi.mocked(axios.get).mockReturnValue(new Promise(() => {}))

  renderWithQueryClient(<UsersPage />)

  expect(screen.getByRole('button', { name: 'Create user' })).toBeInTheDocument()
})
