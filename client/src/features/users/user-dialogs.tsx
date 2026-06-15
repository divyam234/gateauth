import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { adminKeys } from "@/features/admin/query-options"
import {
  type AdminUser,
  banAdminUser,
  createAdminUser,
  removeAdminUser,
  updateAdminUser,
} from "@/lib/admin-api"

const roleSchema = z.enum(["user", "admin"])
const createUserSchema = z.object({
  name: z.string().trim().min(2, "Enter the user’s name"),
  email: z.email("Enter a valid email address"),
  password: z.string().min(12, "Use at least 12 characters"),
  role: roleSchema,
})
const editUserSchema = z.object({
  name: z.string().trim().min(2, "Enter the user’s name"),
  role: roleSchema,
})
const banUserSchema = z.object({ reason: z.string().trim().max(500).optional() })

type CreateUserValues = z.infer<typeof createUserSchema>
type EditUserValues = z.infer<typeof editUserSchema>
type BanUserValues = z.infer<typeof banUserSchema>

function RoleField({
  value,
  onValueChange,
  invalid,
  error,
}: {
  value: "user" | "admin"
  onValueChange: (value: "user" | "admin") => void
  invalid: boolean
  error?: string
}) {
  return (
    <Field data-invalid={invalid}>
      <FieldLabel htmlFor="user-role">Role</FieldLabel>
      <Select value={value} onValueChange={(next) => onValueChange(next as "user" | "admin")}>
        <SelectTrigger id="user-role" className="w-full" aria-invalid={invalid}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="user">User</SelectItem>
          <SelectItem value="admin">Administrator</SelectItem>
        </SelectContent>
      </Select>
      <FieldError>{error}</FieldError>
    </Field>
  )
}

export function CreateUserDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const form = useForm<CreateUserValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { name: "", email: "", password: "", role: "user" },
  })
  const mutation = useMutation({
    mutationFn: createAdminUser,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminKeys.users() }),
        queryClient.invalidateQueries({ queryKey: adminKeys.overview() }),
      ])
      form.reset()
      onOpenChange(false)
      toast.success("User created")
    },
    onError: (error) => toast.error(error.message),
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) form.reset()
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create user</DialogTitle>
          <DialogDescription>Provision a verified account with an initial role.</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        >
          <FieldGroup>
            <Field data-invalid={Boolean(form.formState.errors.name)}>
              <FieldLabel htmlFor="create-user-name">Name</FieldLabel>
              <Input
                id="create-user-name"
                autoComplete="name"
                aria-invalid={Boolean(form.formState.errors.name)}
                {...form.register("name")}
              />
              <FieldError>{form.formState.errors.name?.message}</FieldError>
            </Field>
            <Field data-invalid={Boolean(form.formState.errors.email)}>
              <FieldLabel htmlFor="create-user-email">Email</FieldLabel>
              <Input
                id="create-user-email"
                type="email"
                autoComplete="email"
                aria-invalid={Boolean(form.formState.errors.email)}
                {...form.register("email")}
              />
              <FieldError>{form.formState.errors.email?.message}</FieldError>
            </Field>
            <Field data-invalid={Boolean(form.formState.errors.password)}>
              <FieldLabel htmlFor="create-user-password">Temporary password</FieldLabel>
              <Input
                id="create-user-password"
                type="password"
                autoComplete="new-password"
                aria-invalid={Boolean(form.formState.errors.password)}
                {...form.register("password")}
              />
              <FieldError>{form.formState.errors.password?.message}</FieldError>
            </Field>
            <Controller
              control={form.control}
              name="role"
              render={({ field, fieldState }) => (
                <RoleField
                  value={field.value}
                  onValueChange={field.onChange}
                  invalid={fieldState.invalid}
                  error={fieldState.error?.message}
                />
              )}
            />
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Spinner data-icon="inline-start" />}
              Create user
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function EditUserDialog({
  user,
  onOpenChange,
}: {
  user: AdminUser | null
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const form = useForm<EditUserValues>({
    resolver: zodResolver(editUserSchema),
    values: { name: user?.name ?? "", role: user?.role === "admin" ? "admin" : "user" },
  })
  const mutation = useMutation({
    mutationFn: (values: EditUserValues) =>
      user ? updateAdminUser(user.id, values) : Promise.reject(new Error("No user selected")),
    onSuccess: async () => {
      if (user)
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: adminKeys.users() }),
          queryClient.invalidateQueries({ queryKey: adminKeys.userDetails(user.id) }),
        ])
      onOpenChange(false)
      toast.success("User updated")
    },
    onError: (error) => toast.error(error.message),
  })

  return (
    <Dialog open={Boolean(user)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit user</DialogTitle>
          <DialogDescription>Update profile data and effective role.</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        >
          <FieldGroup>
            <Field data-invalid={Boolean(form.formState.errors.name)}>
              <FieldLabel htmlFor="edit-user-name">Name</FieldLabel>
              <Input
                id="edit-user-name"
                aria-invalid={Boolean(form.formState.errors.name)}
                {...form.register("name")}
              />
              <FieldError>{form.formState.errors.name?.message}</FieldError>
            </Field>
            <Controller
              control={form.control}
              name="role"
              render={({ field, fieldState }) => (
                <RoleField
                  value={field.value}
                  onValueChange={field.onChange}
                  invalid={fieldState.invalid}
                  error={fieldState.error?.message}
                />
              )}
            />
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending || !user}>
              {mutation.isPending && <Spinner data-icon="inline-start" />}
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function BanUserDialog({
  user,
  onOpenChange,
}: {
  user: AdminUser | null
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const form = useForm<BanUserValues>({
    resolver: zodResolver(banUserSchema),
    defaultValues: { reason: "" },
  })
  const mutation = useMutation({
    mutationFn: (values: BanUserValues) =>
      user
        ? banAdminUser(user.id, values.reason || undefined)
        : Promise.reject(new Error("No user selected")),
    onSuccess: async () => {
      if (user)
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: adminKeys.users() }),
          queryClient.invalidateQueries({ queryKey: adminKeys.userDetails(user.id) }),
          queryClient.invalidateQueries({ queryKey: adminKeys.sessions() }),
        ])
      form.reset()
      onOpenChange(false)
      toast.success(`${user?.name ?? "User"} banned`)
    },
    onError: (error) => toast.error(error.message),
  })

  return (
    <Dialog open={Boolean(user)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ban user</DialogTitle>
          <DialogDescription>
            Block {user?.name ?? "this user"} and revoke active sessions.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        >
          <Field>
            <FieldLabel htmlFor="ban-user-reason">Reason</FieldLabel>
            <Input
              id="ban-user-reason"
              placeholder="Optional operator note"
              {...form.register("reason")}
            />
            <FieldError>{form.formState.errors.reason?.message}</FieldError>
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={mutation.isPending || !user}>
              {mutation.isPending && <Spinner data-icon="inline-start" />}
              Ban user
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function DeleteUserDialog({
  user,
  onOpenChange,
}: {
  user: AdminUser | null
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: () =>
      user ? removeAdminUser(user.id) : Promise.reject(new Error("No user selected")),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminKeys.users() }),
        queryClient.invalidateQueries({ queryKey: adminKeys.overview() }),
      ])
      onOpenChange(false)
      toast.success(`${user?.name ?? "User"} deleted`)
    },
    onError: (error) => toast.error(error.message),
  })

  return (
    <AlertDialog open={Boolean(user)} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete user permanently?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes {user?.name ?? "the selected user"}, linked accounts, sessions, keys,
            grants, and security data.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="rounded-lg border bg-muted/50 px-3 py-2 text-sm">
          <p className="font-medium">{user?.name}</p>
          <p className="text-muted-foreground">{user?.email}</p>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending && <Spinner data-icon="inline-start" />}
            Delete permanently
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
