import { useQueryClient } from "@tanstack/react-query"
import { Link, useRouter } from "@tanstack/react-router"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useI18n } from "@/features/i18n/i18n-provider"
import { cn } from "@/lib/utils"
import { authClient } from "./auth-client"
import { navigateAfterSessionChange } from "./session-cache"

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const { t } = useI18n()

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setPending(true)

    const form = new FormData(event.currentTarget)
    const { error: signInError } = await authClient.signIn.email({
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
    })

    setPending(false)

    if (signInError) {
      setError(signInError.message ?? t("Unable to sign in"))
      return
    }

    await navigateAfterSessionChange(queryClient, router, "/dashboard")
  }

  return (
    <form
      className={cn("flex flex-col gap-6", className)}
      onSubmit={onSubmit}
      {...props}
    >
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">{t("Login to your account")}</h1>
          <p className="text-sm text-balance text-muted-foreground">
            {t("Enter your email below to login to your account")}
          </p>
        </div>
        {error ? <FieldError>{error}</FieldError> : null}
        <Field>
          <FieldLabel htmlFor="email">{t("Email")}</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="m@example.com"
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="password">{t("Password")}</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            minLength={8}
            required
          />
        </Field>
        <Field>
          <Button type="submit" disabled={pending}>
            {pending ? t("Signing In...") : t("Login")}
          </Button>
        </Field>
        <FieldDescription className="text-center">
          {t("Don't have an account?")}{" "}
          <Link to="/signup" className="underline underline-offset-4">
            {t("Sign Up")}
          </Link>
        </FieldDescription>
      </FieldGroup>
    </form>
  )
}
