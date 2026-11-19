import { SignupForm } from "@/features/auth/signup-form"
import { AuthLayout } from "./auth-layout"

export function SignupPage() {
  return (
    <AuthLayout>
      <SignupForm />
    </AuthLayout>
  )
}
