import type { FieldErrors, UseFormRegister } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// Both the create and the edit form resolve to exactly this shape (see
// `shared/user-validation`), which is what lets this component stay
// non-generic: `UseFormRegister<CreateUserFormValues>` and
// `UseFormRegister<UpdateUserFormValues>` are structurally the same type as
// `UseFormRegister<UserFormValues>`, so both dialogs pass `register`/`errors`
// with no casts — while `register('name')` still type-checks in here, which it
// would not under a `<T extends FieldValues>` generic (`Path<T>` is deferred).
//
// `password` is always a string on the form side; blank means "keep the current
// password" on edit. Turning blank into an omitted request field is the
// submitting dialog's job, not this component's.
export type UserFormValues = {
  name: string
  email: string
  password: string
}

type UserFormFieldsProps = {
  register: UseFormRegister<UserFormValues>
  errors: FieldErrors<UserFormValues>
  /** Scopes the field ids to this instance; two dialogs can briefly overlap
   *  while one animates closed, and hardcoded ids would collide. */
  idPrefix: string
  /** Rendered under the password input and wired up as its description. */
  passwordHint?: string
}

export function UserFormFields({ register, errors, idPrefix, passwordHint }: UserFormFieldsProps) {
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-name`}>Name</Label>
        <Input
          id={`${idPrefix}-name`}
          autoComplete="name"
          aria-invalid={errors.name ? 'true' : 'false'}
          {...register('name')}
        />
        {errors.name && (
          <p className="text-[0.8125rem] text-destructive" role="alert">
            {errors.name.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-email`}>Email</Label>
        <Input
          id={`${idPrefix}-email`}
          type="email"
          autoComplete="email"
          aria-invalid={errors.email ? 'true' : 'false'}
          {...register('email')}
        />
        {errors.email && (
          <p className="text-[0.8125rem] text-destructive" role="alert">
            {errors.email.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-password`}>Password</Label>
        <Input
          id={`${idPrefix}-password`}
          type="password"
          autoComplete="new-password"
          aria-invalid={errors.password ? 'true' : 'false'}
          aria-describedby={passwordHint ? `${idPrefix}-password-hint` : undefined}
          {...register('password')}
        />
        {passwordHint && (
          <p id={`${idPrefix}-password-hint`} className="text-[0.8125rem] text-muted-foreground">
            {passwordHint}
          </p>
        )}
        {errors.password && (
          <p className="text-[0.8125rem] text-destructive" role="alert">
            {errors.password.message}
          </p>
        )}
      </div>
    </>
  )
}
