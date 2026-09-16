import { CreateUserDialog } from './CreateUserDialog'
import { UsersTable } from './UsersTable'

export function UsersPage() {
  return (
    <section className="mx-auto flex max-w-240 flex-col gap-4 px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Users</h1>
        <CreateUserDialog />
      </div>

      <UsersTable />
    </section>
  )
}
