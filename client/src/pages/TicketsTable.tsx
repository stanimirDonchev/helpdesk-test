import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import type { TicketsListResponse } from 'shared/api-types'
import {
  TICKET_CATEGORY_LABELS,
  TICKET_STATUS_LABELS,
  TicketStatus,
} from 'shared/ticket-types'
import { Skeleton } from '../components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table'

const SKELETON_ROWS = 5

// Rendered by both the loading and the loaded branch, so the column list only
// has to be kept in sync in one place.
function TicketsTableHead() {
  return (
    <TableHeader>
      <TableRow>
        <TableHead>Subject</TableHead>
        <TableHead>From</TableHead>
        <TableHead>Status</TableHead>
        <TableHead>Category</TableHead>
        <TableHead>Received</TableHead>
      </TableRow>
    </TableHeader>
  )
}

export function TicketsTable() {
  const { data, isPending, isError } = useQuery({
    queryKey: ['tickets'],
    queryFn: () => axios.get<TicketsListResponse>('/api/tickets').then((res) => res.data.tickets),
  })

  if (isPending) {
    return (
      <div className="rounded-lg border border-border">
        <Table>
          <TicketsTableHead />
          <TableBody>
            {Array.from({ length: SKELETON_ROWS }).map((_, index) => (
              <TableRow key={index}>
                <TableCell>
                  <Skeleton className="h-4 w-56" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-44" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-6 w-16 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-32" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-20" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  if (isError) {
    return <p className="text-[0.9375rem] text-destructive">Failed to load tickets.</p>
  }

  if (data.length === 0) {
    return <p className="text-[0.9375rem] text-muted-foreground">No tickets yet.</p>
  }

  return (
    <div className="rounded-lg border border-border">
      <Table>
        <TicketsTableHead />
        <TableBody>
          {data.map((ticket) => (
            <TableRow key={ticket.id}>
              <TableCell className="font-medium text-foreground">{ticket.subject}</TableCell>
              <TableCell className="text-muted-foreground">
                {ticket.senderName ? `${ticket.senderName} <${ticket.senderEmail}>` : ticket.senderEmail}
              </TableCell>
              <TableCell>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.8125rem] font-semibold ${
                    ticket.status === TicketStatus.open
                      ? 'bg-emerald-500/12 text-emerald-700'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {TICKET_STATUS_LABELS[ticket.status]}
                </span>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {/* Null until Phase 4's classifier runs. */}
                {ticket.category ? TICKET_CATEGORY_LABELS[ticket.category] : '—'}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {new Date(ticket.receivedAt).toLocaleDateString()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
