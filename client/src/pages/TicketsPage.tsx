import { TicketsTable } from './TicketsTable'

export function TicketsPage() {
  return (
    <section className="mx-auto flex max-w-240 flex-col gap-4 px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Tickets</h1>
      </div>

      <TicketsTable />
    </section>
  )
}
