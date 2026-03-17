# Indexing Strategy

Proper indexing is crucial for query performance. Follow these guidelines for indexing database tables.

## Primary Keys
- Primary keys are automatically indexed (using the CUID field).
- No additional action needed.

## Foreign Keys
- Index all foreign key columns to speed up joins and lookups.
- Example (Prisma): `@index([authorId])` or implicitly via `@relation` (Prisma creates indexes for relation fields by default).
- Example (TypeORM): Use `@Index()` decorator on the foreign key column.

## Common Query Patterns
- Index columns frequently used in `WHERE`, `ORDER BY`, and `GROUP BY` clauses.
- Consider composite indexes for queries that filter on multiple columns together.

## Timestamp Fields
- Index `createdAt` and `updatedAt` if querying by date ranges is common.
- Example: `@index([createdAt])` or `@index([updatedAt])`.

## Unique Constraints
- Unique fields (like email) are automatically indexed by the database.
- Ensure unique constraints are defined in the schema.

## Soft Delete Fields
- If using a `status` or `deletedAt` field for soft deletes, index it for filtering active records.
- Example: `@index([status])` where status is 'active' or 'deleted'.

## Guidelines
- **Analyze Query Patterns:** Use database query planning tools (EXPLAIN) to identify needed indexes.
- **Avoid Over-Indexing:** Each index adds overhead to write operations. Balance read vs. write needs.
- **Covering Indexes:** For frequent queries, consider indexes that cover all columns needed (to avoid table lookups).
- **Regular Review:** Periodically review index usage and remove unused indexes.

## Example (Prisma)
```typescript
model User {
  id String @id @default(cuid())
  email String @unique
  status String   // for soft delete: 'active' or 'inactive'
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([email])        // Already unique, but explicit
  @@index([status])       // For filtering by status
  @@index([createdAt])    // For date range queries
}
```

## Example (TypeORM)
```typescript
@Entity()
export class User {
  @PrimaryColumn()
  id: string;

  @Column({ unique: true })
  @Index()
  email: string;

  @Column()
  @Index()
  status: string;

  @CreateDateColumn()
  @Index()
  createdAt: Date;

  @UpdateDateColumn()
  @Index()
  updatedAt: Date;
}
```
