export function isDevAuthBypassEnabled(): boolean {
  if (process.env.NODE_ENV === "production") {
    return false;
  }

  return process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "true";
}
