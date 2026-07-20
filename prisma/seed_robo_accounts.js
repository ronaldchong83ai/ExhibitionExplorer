require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function simpleHash(password) {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `hash_${Math.abs(hash).toString(36)}`;
}

const roboAccounts = [
  {
    name: 'Test Visitor User',
    email: 'test.visitor@exhibition.com',
    contact: '+6591234567',
    password: 'TestVisitor123!',
    role: 'VISITOR'
  },
  {
    name: 'Test Exhibitor User',
    email: 'test.exhibitor@exhibition.com',
    contact: '+6591234568',
    password: 'TestExhibitor123!',
    role: 'EXHIBITOR'
  },
  {
    name: 'Test Redemptor User',
    email: 'test.redemptor@exhibition.com',
    contact: '+6591234569',
    password: 'TestRedemptor123!',
    role: 'REDEMPTOR'
  },
  {
    name: 'Test Admin User',
    email: 'test.admin@exhibition.com',
    contact: '+6591234570',
    password: 'TestAdmin123!',
    role: 'ADMIN'
  }
];

async function seedRoboAccounts() {
  console.log("Seeding Robo Test Accounts into database...");

  for (const acc of roboAccounts) {
    const hash = simpleHash(acc.password);
    const existing = await prisma.user.findUnique({ where: { email: acc.email } });

    if (existing) {
      await prisma.user.update({
        where: { email: acc.email },
        data: {
          name: acc.name,
          role: acc.role,
          passwordHash: hash,
          provider: 'CREDENTIALS'
        }
      });
      console.log(`Updated user: ${acc.email} (${acc.role})`);
    } else {
      await prisma.user.create({
        data: {
          name: acc.name,
          email: acc.email,
          contact: acc.contact,
          passwordHash: hash,
          role: acc.role,
          provider: 'CREDENTIALS'
        }
      });
      console.log(`Created user: ${acc.email} (${acc.role})`);
    }
  }
  console.log("Robo account seeding complete!");
}

seedRoboAccounts()
  .catch(console.error)
  .finally(() => prisma.$disconnect().then(() => pool.end()));
