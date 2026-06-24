require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const keys = ['home', 'stages', 'exhibitors', 'vouchers', 'favourites', 'notifications', 'users'];
  const newVersion = Date.now().toString();
  for (const key of keys) {
    await prisma.dbVersion.upsert({
      where: { key },
      update: { version: newVersion },
      create: { key, version: newVersion }
    });
  }
  console.log("All caches invalidated successfully to version:", newVersion);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect().then(() => pool.end()));
