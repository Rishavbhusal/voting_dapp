# Voting App - Next.js

This is a Next.js version of the Solana Voting Application.

## Getting Started

### Install Dependencies

```bash
npm install
# or
yarn install
# or
pnpm install
```

### Run Development Server

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Build for Production

```bash
npm run build
npm start
```

## Project Structure

- `src/app/` - Next.js App Router pages and layouts
  - `layout.tsx` - Root layout with providers
  - `page.tsx` - Home page
  - `poll/[id]/page.tsx` - Poll detail page
  - `not-found.tsx` - 404 page
- `src/components/` - React components
- `src/contexts/` - React contexts (Wallet, Admin)
- `src/hooks/` - Custom React hooks
- `src/services/` - Business logic services
- `src/types/` - TypeScript type definitions
- `src/lib/` - Utility functions

## Key Changes from Vite

1. **Routing**: Uses Next.js App Router instead of React Router
2. **Pages**: Converted to Next.js page components in `app/` directory
3. **Links**: Uses `next/link` instead of `react-router-dom`
4. **Client Components**: Pages using hooks must be marked with `"use client"`
5. **Layout**: Root layout wraps all pages with providers

## Migration Notes

- All pages are now client components (`"use client"`) because they use React hooks
- Dynamic routes use `[id]` folder structure
- `useParams()` comes from `next/navigation` instead of `react-router-dom`
- `Link` component comes from `next/link`

