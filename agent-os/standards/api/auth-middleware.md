# Auth Middleware Usage

All protected API routes must use the `requireAuth()` helper to ensure only authenticated users can access them:

```typescript
import { requireAuth, handleAuthError } from "@/lib/auth/middleware";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth();
    // Use auth.userId for database queries...
  } catch (error) {
    return handleAuthError(error);
  }
}
```

- **Pattern:** Call `requireAuth()` at the top of the route handler.
- **Error Handling:** Use `handleAuthError(error)` to consistently handle authentication failures (e.g., 401 Unauthorized).
- **Public Routes:** If a route is public, document why it's public.
