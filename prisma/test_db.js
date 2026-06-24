require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function test() {
  const exhibitions = await prisma.exhibition.findMany();
  const homePageInfos = await prisma.homePageInfo.findMany();
  console.log("Exhibitions:", exhibitions);
  console.log("HomePageInfos:", homePageInfos);
}

test().catch(console.error).finally(() => prisma.$disconnect().then(() => pool.end()));
