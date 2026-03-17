# Timestamp Fields Pattern

All database entities must include `createdAt` and `updatedAt` timestamp fields to track record lifecycle.

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
import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";

@Entity()
export class User {
  @PrimaryColumn()
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

- **createdAt:** Set to the time of record creation (immutable after creation)
- **updatedAt:** Automatically updated to the current time whenever the record is modified
- **Implementation:** 
  - In Prisma: Use `@default(now())` for `createdAt` and `@updatedAt` for `updatedAt`
  - In TypeORM: Use `@CreateDateColumn()` and `@UpdateDateColumn()` decorators
  - In raw SQL: Use `TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP` and triggers
- **Usage:** Always include these fields in every table/entity unless there's a specific reason not to (e.g., audit tables with different patterns)
- **Timezone:** Store timestamps in UTC and convert to local time only for display purposes
