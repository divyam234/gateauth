import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { getRouteApi, useNavigate } from "@tanstack/react-router"
import { Ban, Check, Eye, LogIn, MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { DataPagination } from "@/components/data-pagination"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { adminKeys, USERS_PAGE_SIZE, usersQueryOptions } from "@/features/admin/query-options"
import { UserDetailSheet } from "@/features/users/user-detail-sheet"
import {
  BanUserDialog,
  CreateUserDialog,
  DeleteUserDialog,
  EditUserDialog,
} from "@/features/users/user-dialogs"
import { type AdminUser, impersonateAdminUser, unbanAdminUser } from "@/lib/admin-api"

const route = getRouteApi("/admin/users")
const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" })

type UserAction =
  | { type: "edit"; user: AdminUser }
  | { type: "ban"; user: AdminUser }
  | { type: "delete"; user: AdminUser }
  | null

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function UserMenu({
  user,
  onInspect,
  onAction,
  onUnban,
  onImpersonate,
}: {
  user: AdminUser
  onInspect: () => void
  onAction: (action: Exclude<UserAction, null>) => void
  onUnban: () => void
  onImpersonate: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${user.name}`}>
            <MoreHorizontal />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={onInspect}>
          <Eye /> Inspect
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAction({ type: "edit", user })}>
          <Pencil /> Edit
        </DropdownMenuItem>
        {user.banned ? (
          <DropdownMenuItem onClick={onUnban}>
            <Check /> Unban
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={() => onAction({ type: "ban", user })}>
            <Ban /> Ban
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={onImpersonate}>
          <LogIn /> Impersonate
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => onAction({ type: "delete", user })}>
          <Trash2 /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function AdminUsersPage() {
  const search = route.useSearch()
  const routeNavigate = route.useNavigate()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const currentQuery = search.q ?? ""
  const currentPage = search.page ?? 1
  const [searchDraft, setSearchDraft] = useState(currentQuery)
  const [createOpen, setCreateOpen] = useState(false)
  const [action, setAction] = useState<UserAction>(null)
  const { data, isFetching } = useSuspenseQuery(usersQueryOptions(currentQuery, currentPage))

  useEffect(() => setSearchDraft(currentQuery), [currentQuery])

  const unbanMutation = useMutation({
    mutationFn: unbanAdminUser,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: adminKeys.users() })
      toast.success("User unbanned")
    },
    onError: (error) => toast.error(error.message),
  })
  const impersonateMutation = useMutation({
    mutationFn: impersonateAdminUser,
    onSuccess: async () => {
      toast.success("Impersonation session started")
      await navigate({ to: "/dashboard", replace: true })
    },
    onError: (error) => toast.error(error.message),
  })

  const pageCount = Math.max(1, Math.ceil(data.total / USERS_PAGE_SIZE))

  function setPage(page: number) {
    void routeNavigate({ search: (previous) => ({ ...previous, page }) })
  }

  function inspectUser(userId: string) {
    void routeNavigate({ search: (previous) => ({ ...previous, user: userId }) })
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Identity directory
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Users</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {data.total} users across password, social, passkey, and API-key authentication.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus data-icon="inline-start" /> Add user
        </Button>
      </header>

      <search className="max-w-xl">
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            void routeNavigate({ search: { q: searchDraft.trim(), page: 1 } })
          }}
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Search users"
              className="pl-8"
              placeholder="Search by email"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
            />
          </div>
          <Button type="submit" variant="outline">
            Search
          </Button>
          {currentQuery && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setSearchDraft("")
                void routeNavigate({ search: { q: "", page: 1 } })
              }}
            >
              Clear
            </Button>
          )}
        </form>
      </search>

      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-14">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-48">
                  <Empty>
                    <EmptyHeader>
                      <EmptyTitle>No users found</EmptyTitle>
                      <EmptyDescription>
                        Change the search or provision a new account.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </TableCell>
              </TableRow>
            ) : (
              data.users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <Button
                      variant="ghost"
                      className="h-auto max-w-full justify-start px-0 py-0 text-left hover:bg-transparent"
                      onClick={() => inspectUser(user.id)}
                    >
                      <Avatar className="size-9">
                        <AvatarFallback className="text-xs">{initials(user.name)}</AvatarFallback>
                      </Avatar>
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{user.name}</span>
                        <span className="block truncate text-xs font-normal text-muted-foreground">
                          {user.email}
                        </span>
                      </span>
                    </Button>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.role === "admin" ? "default" : "outline"}>
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.banned ? "destructive" : "secondary"}>
                      {user.banned ? <Ban /> : <Check />}
                      {user.banned ? "Banned" : "Active"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {dateFormatter.format(new Date(user.createdAt))}
                  </TableCell>
                  <TableCell>
                    <UserMenu
                      user={user}
                      onInspect={() => inspectUser(user.id)}
                      onAction={setAction}
                      onUnban={() => unbanMutation.mutate(user.id)}
                      onImpersonate={() => impersonateMutation.mutate(user.id)}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {isFetching && (
          <div
            className="flex items-center justify-center gap-2 border-t py-2 text-xs text-muted-foreground"
            role="status"
          >
            <Spinner /> Refreshing users
          </div>
        )}
      </div>

      <DataPagination
        page={currentPage}
        pageCount={pageCount}
        total={data.total}
        pageSize={USERS_PAGE_SIZE}
        onPageChange={setPage}
      />

      <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} />
      <EditUserDialog
        user={action?.type === "edit" ? action.user : null}
        onOpenChange={(open) => {
          if (!open) setAction(null)
        }}
      />
      <BanUserDialog
        user={action?.type === "ban" ? action.user : null}
        onOpenChange={(open) => {
          if (!open) setAction(null)
        }}
      />
      <DeleteUserDialog
        user={action?.type === "delete" ? action.user : null}
        onOpenChange={(open) => {
          if (!open) setAction(null)
        }}
      />
      <UserDetailSheet
        userId={search.user}
        onOpenChange={(open) => {
          if (!open)
            void routeNavigate({ search: (previous) => ({ ...previous, user: undefined }) })
        }}
      />
    </div>
  )
}

export default AdminUsersPage
