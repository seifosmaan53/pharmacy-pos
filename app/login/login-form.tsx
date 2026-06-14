"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";
import { Card, Input, Button } from "@/components/ui";

export function LoginForm() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    login,
    {},
  );

  return (
    <Card className="p-6">
      <form action={formAction} className="space-y-4">
        <Input
          label="Staff number (pfno)"
          name="pfno"
          inputMode="numeric"
          autoComplete="username"
          placeholder="e.g. 1001"
          autoFocus
          required
        />
        <Input
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
        {state.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {state.error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </Card>
  );
}
