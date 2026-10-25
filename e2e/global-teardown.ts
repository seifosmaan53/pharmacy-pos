import { removeE2EDatabase } from "./setup-db";

// Delete the throwaway database once the run is over. Set E2E_KEEP_DB=1 to
// keep it around for debugging a failure.
export default function globalTeardown() {
  if (process.env.E2E_KEEP_DB === "1") return;
  removeE2EDatabase();
}
