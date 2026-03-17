# Soft Delete Pattern

Use status-based soft deletes instead of hard deletions to preserve data integrity and enable recovery.

```typescript
// Example Prisma schema
model User {
  id String @id @default(cuid())
  name String
  email String @unique
  status String @default("active") // 'active' | 'inactive' | 'deleted'
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([status])
}

// Example TypeORM entity
import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from "typeorm";

@Entity()
export class User {
  @PrimaryColumn()
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Column({ default: "active" })
  @Index()
  status: string; // 'active' | 'inactive' | 'deleted'

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

- **Status Values:** 
  - `active`: Record is fully operational
  - `inactive`: Record is temporarily disabled but may be reactivated
  - `deleted`: Record is soft deleted and should be excluded from normal queries
- **Querying:** Always filter by status in queries (e.g., `WHERE status = 'active'`)
- **Indexing:** Index the status field for efficient filtering
- **Alternative Approach:** Use a `deletedAt` timestamp field (NULL means active, timestamp means deleted)
  ```typescript
  // Prisma with deletedAt
  model User {
    id String @id @default(cuid())
    name String
    email String @unique
    deletedAt DateTime?
    createdAt DateTime @default(now())
    updatedAt DateTime @updatedAt

    @@index([deletedAt])
  }
  ```
- **Implementation:** 
  - In application code, automatically apply status filters to exclude deleted/inactive records
  - Provide explicit methods to view or restore soft-deleted records when needed
  - Consider hard deletion only for temporary data or when legally required
- **Benefits:**
  - Prevents accidental data loss
  - Maintains referential integrity (foreign keys remain valid)
  - Enables audit trails and data recovery
  - Allows for "undo" functionality
