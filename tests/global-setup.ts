import { execSync } from 'child_process';

export default function globalSetup() {
  console.log('Seeding database...');
  execSync('npx prisma db seed', { stdio: 'inherit', cwd: process.cwd() });
  console.log('Database seeded.');
}
