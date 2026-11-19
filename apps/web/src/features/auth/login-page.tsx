import { LoginForm } from "@/features/auth/login-form"
import { AuthLayout } from "./auth-layout"

export function LoginPage() {
  return (
    <AuthLayout>
      <LoginForm />
    </AuthLayout>
  )
}
