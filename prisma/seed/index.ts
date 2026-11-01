// `pnpm seed`: wipe and re-seed the demo database.
import { PrismaClient } from "@prisma/client";
import { seed } from "./seed";

const db = new PrismaClient();
const started = Date.now();

seed(db)
  .then((summary) => {
    console.log(`Seeded in ${Date.now() - started} ms`);
    console.table(summary);
  })
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
