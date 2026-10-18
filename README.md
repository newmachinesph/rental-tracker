# RentalTracker

![License: MIT](https://img.shields.io/badge/license-MIT-green) ![Next.js](https://img.shields.io/badge/Next.js-16-black) ![React](https://img.shields.io/badge/React-19-61dafb) ![Prisma](https://img.shields.io/badge/Prisma-7-2d3748) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-336791)

A web app for landlords to manage rental properties: properties and units, tenants, leases, income, expenses, maintenance, mileage, tenant ledgers, rent reminders, and PDF statements of account and letters, with monthly, annual, five-year, custom and comparison dashboards.

## Stack

Next.js (App Router), React, TypeScript, Tailwind CSS, Prisma with PostgreSQL, AG Grid, Recharts, Zustand, jsPDF, UploadThing (file uploads), Playwright (end-to-end tests).

## Getting started

Requires Node.js and a PostgreSQL database.

```bash
npm install
```

Create a `.env` file:

```
DATABASE_URL=postgresql://user:password@localhost:5432/rental_tracker
UPLOADTHING_TOKEN=<your UploadThing token>
```

Then apply the schema, seed, and start:

```bash
npx prisma db push
npx prisma db seed
npm run dev
```

The seed creates a single demo admin account (`admin@gmail.com` / `admin123`) with fictional owner details. For development only; change it before any real deployment.

## Scripts

- `npm run dev` - development server
- `npm run build` / `npm start` - production build and server
- `npm run lint` - ESLint
- `npm run test:e2e` - Playwright end-to-end tests (seeds the database)

## Structure

- `app/` - pages (`(app)`, `(auth)`) and API routes
- `components/` - UI components and cards
- `lib/` - store, validation, auth, PDF generators
- `prisma/` - schema and seed
- `tests/` - Playwright end-to-end tests
- `RentalTracker_Admin_Guide.pdf` - user guide

## License

MIT. See [LICENSE](LICENSE).
