import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { RegisterForm } from "@/components/register-form"

export default async function RegisterPage() {
  const user = await getCurrentUser()
  if (user) {
    redirect("/")
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-foreground">FlowCRM</h1>
          <p className="mt-2 text-muted-foreground">Create your account</p>
        </div>
        <RegisterForm />
      </div>
    </div>
  )
}
