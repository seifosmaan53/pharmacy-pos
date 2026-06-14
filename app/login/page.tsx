import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  // Already signed in? Skip the form.
  if (await getCurrentUser()) redirect("/dashboard");

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 to-white px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-3xl">
            💊
          </div>
          <h1 className="text-xl font-semibold text-gray-900">Pharmacy POS</h1>
          <p className="text-sm text-gray-500">Sign in to your account</p>
        </div>
        <LoginForm />
        <p className="mt-6 text-center text-xs text-gray-400">
          Demo — Manager: <b>1001 / admin123</b> · Cashier:{" "}
          <b>2001 / cashier123</b>
        </p>
      </div>
    </div>
  );
}
