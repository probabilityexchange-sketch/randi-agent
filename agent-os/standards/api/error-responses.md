# Error Responses

All API error responses must return a JSON object with a descriptive message:

```json
{ "error": "Descriptive error message" }
```

- **HTTP Status Codes:** Use appropriate codes (400, 401, 403, 404, 429, 500).
- **Optional Fields:** Include `code` (string) for programmatic handling or `details` (any) for validation errors.
- **Consistency:** Never return raw strings or empty bodies for errors.
