"use client";

import { Card, Button } from "@/components/ui";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="max-w-md p-8 text-center">
        <div className="mb-3 text-4xl">⚠️</div>
        <h2 className="mb-2 text-lg font-semibold text-gray-900">
          Something went wrong
        </h2>
        <p className="mb-6 text-sm text-gray-500">
          {error.message || "An unexpected error occurred. Please try again."}
        </p>
        <Button onClick={reset}>Try again</Button>
      </Card>
    </div>
  );
}
