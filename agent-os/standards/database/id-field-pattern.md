# CUID-based ID Pattern

All database records must use a CUID (Collision-resistant Unique IDentifier) for primary keys to ensure uniqueness across distributed systems.

```typescript
// Example Prisma schema
model User {
  id String @id @default(cuid())
  name String
  email String @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// Example TypeORM entity
import { Entity, PrimaryColumn, Column } from "typeorm";
import { cuid } from "@/lib/utils/cuid";

@Entity()
export class User {
  @PrimaryColumn()
  id: string = cuid();

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;
}
```

- **Generation:** Use the `cuid()` helper function from `@/lib/utils/cuid` for ID generation
- **Format:** 25-character string, starting with 'c' (e.g., "clxyz123abc456def789ghi0")
- **Benefits:** 
  - Horizontal scaling safe (no central authority needed)
  - Offline generation possible
  - Human-readable and URL-friendly
  - Collision-resistant
- **Usage:** Always define ID fields as `String @id @default(cuid())` in Prisma or equivalent in other ORMs
