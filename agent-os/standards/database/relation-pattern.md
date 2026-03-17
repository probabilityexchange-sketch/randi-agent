# Relation Usage Patterns

Define clear relationships between entities using foreign keys and relation fields to maintain data integrity.

```typescript
// Example Prisma schema: One-to-Many
model User {
  id String @id @default(cuid())
  name String
  posts Post[]
}

model Post {
  id String @id @default(cuid())
  title String
  authorId String
  author User @relation(fields: [authorId], references: [id])
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// Example Prisma schema: Many-to-Many
model User {
  id String @id @default(cuid())
  name String
  groups Group[] @relation("UserGroups")
}

model Group {
  id String @id @default(cuid())
  name String
  users User[] @relation("UserGroups")
}

// Example TypeORM entity: One-to-Many
import { Entity, PrimaryColumn, Column, OneToMany } from "typeorm";
import { Post } from "./Post";

@Entity()
export class User {
  @PrimaryColumn()
  id: string;

  @Column()
  name: string;

  @OneToMany(() => Post, post => post.author)
  posts: Post[];
}

// Example TypeORM entity: Many-to-Many
import { Entity, PrimaryColumn, Column, ManyToMany, JoinTable } from "typeorm";
import { User } from "./User";

@Entity()
export class Group {
  @PrimaryColumn()
  id: string;

  @Column()
  name: string;

  @ManyToMany(() => User)
  @JoinTable()
  users: User[];
}
```

- **Foreign Keys:** Always define explicit relation fields (e.g., `authorId`) and relation annotations
- **Naming:** Use singular form for relation fields (e.g., `author`, `posts`) and `[field]Id` for foreign keys
- **Cascading:** Consider cascade options (`onDelete`, `onUpdate`) based on business logic
- **Indexing:** Foreign key columns should be indexed for query performance (see indexing strategy)
- **Avoid:** Circular dependencies without careful consideration; use intermediate tables for complex many-to-many
- **Validation:** Apply relation constraints at the database level, not just application level
