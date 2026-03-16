import fs from "fs";
import path from "path";

const SCHEMA_PATH = path.join(process.cwd(), "prisma", "schema.prisma");

function main() {
    const targetProvider = process.argv[2];

    if (!targetProvider || (targetProvider !== "postgresql" && targetProvider !== "sqlite")) {
        console.error("Usage: npx tsx scripts/swap-db.ts <postgresql|sqlite>");
        process.exit(1);
    }

    console.log(`Swapping Prisma provider to: ${targetProvider}`);

    let content = fs.readFileSync(SCHEMA_PATH, "utf-8");

    const pgBlock = `datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}`;

    const sqliteBlock = `datasource db {
  provider = "sqlite"
}`;

    if (targetProvider === "postgresql") {
        // Match any datasource db block (with or without url/directUrl lines)
        const replaced = content.replace(
            /datasource db \{[^}]+\}/,
            pgBlock
        );
        if (replaced === content) {
            console.error("WARNING: Could not find datasource db block to swap");
        }
        content = replaced;
    } else {
        const replaced = content.replace(
            /datasource db \{[^}]+\}/,
            sqliteBlock
        );
        if (replaced === content) {
            console.error("WARNING: Could not find datasource db block to swap");
        }
        content = replaced;
    }

    fs.writeFileSync(SCHEMA_PATH, content);
    console.log("✅ Managed schema.prisma successfully updated.");
}

main();
