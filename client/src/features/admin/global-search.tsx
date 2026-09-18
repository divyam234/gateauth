import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { AppWindow, BookOpenCheck, CommandIcon, Users } from "lucide-react"
import { type ReactNode, useDeferredValue, useState } from "react"
import { Badge } from "@/components/ui/badge"
import {
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Spinner } from "@/components/ui/spinner"
import { globalSearchQueryOptions } from "@/features/admin/query-options"

function SearchMessage({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-2 px-6 text-center text-sm text-muted-foreground">
      {children}
    </div>
  )
}

export function GlobalSearch({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const navigate = useNavigate()
  const [query, setQuery] = useState("")
  const deferredQuery = useDeferredValue(query.trim())
  const canSearch = deferredQuery.length >= 2
  const searchQuery = useQuery({
    ...globalSearchQueryOptions(deferredQuery),
    enabled: open && canSearch,
  })

  function close() {
    onOpenChange(false)
    setQuery("")
  }

  function select(action: () => Promise<unknown>) {
    close()
    void action()
  }

  const hasResults = Boolean(
    searchQuery.data &&
      (searchQuery.data.users.length ||
        searchQuery.data.applications.length ||
        searchQuery.data.events.length),
  )

  return (
    <CommandDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) onOpenChange(true)
        else close()
      }}
      title="Search GateAuth"
      description="Search users, applications, and audit events."
      className="top-[18%] max-w-xl translate-y-0"
      commandProps={{ shouldFilter: false }}
    >
      <CommandInput
        autoFocus
        value={query}
        onValueChange={setQuery}
        placeholder="Search users, apps, or events…"
      />
      <CommandList className="max-h-[430px]">
        {!canSearch ? (
          <SearchMessage>
            <CommandIcon className="size-6" />
            <span className="font-medium text-foreground">Search the control plane</span>
            <span className="text-xs">Enter at least two characters.</span>
          </SearchMessage>
        ) : searchQuery.isFetching ? (
          <SearchMessage>
            <Spinner />
            <span>Searching…</span>
          </SearchMessage>
        ) : searchQuery.isError ? (
          <SearchMessage>
            <span className="text-destructive">Search failed. Try again.</span>
          </SearchMessage>
        ) : !hasResults ? (
          <SearchMessage>No matching records.</SearchMessage>
        ) : (
          <>
            {searchQuery.data?.applications.length ? (
              <CommandGroup heading="Applications">
                {searchQuery.data.applications.map((application) => (
                  <CommandItem
                    key={application.id}
                    value={`${application.name} ${application.slug}`}
                    onSelect={() => select(() => navigate({ to: "/admin/applications" }))}
                  >
                    <AppWindow />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{application.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {application.slug}
                      </span>
                    </span>
                    <Badge variant="outline">{application.lastHealthStatus}</Badge>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            {searchQuery.data?.users.length ? (
              <CommandGroup heading="Users">
                {searchQuery.data.users.map((user) => (
                  <CommandItem
                    key={user.id}
                    value={`${user.name} ${user.email}`}
                    onSelect={() =>
                      select(() => navigate({ to: "/admin/users", search: { user: user.id } }))
                    }
                  >
                    <Users />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{user.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {user.email}
                      </span>
                    </span>
                    <Badge variant={user.banned ? "destructive" : "secondary"}>{user.role}</Badge>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            {searchQuery.data?.events.length ? (
              <CommandGroup heading="Audit events">
                {searchQuery.data.events.map((event) => (
                  <CommandItem
                    key={event.id}
                    value={`${event.action} ${event.outcome} ${event.severity}`}
                    onSelect={() =>
                      select(() =>
                        navigate({ to: "/admin/audit-log", search: { q: event.action } }),
                      )
                    }
                  >
                    <BookOpenCheck />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{event.action}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {new Date(event.createdAt).toLocaleString()}
                      </span>
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
          </>
        )}
      </CommandList>
    </CommandDialog>
  )
}
