# Miden Web App

A starter template for building web applications powered by Miden blockchain technology.

## Features

- ✅ Next.js 15 with React 19
- ✅ Miden SDK integration
- ✅ Miden Wallet Adapter for seamless wallet connectivity
- ✅ TypeScript support
- ✅ Tailwind CSS for styling
- ✅ Ready-to-use Miden library functions

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or pnpm

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Building for Production

```bash
npm run build
npm start
```

## Structure

- `app/` - Next.js app directory with pages and components
- `lib/` - Utility functions and Miden integration code
  - `constants.ts` - Configuration constants
  - `contracts/` - Smart contract code
  - `notes/` - Note templates
  - Various utility functions for Miden operations

## Available Library Functions

This template includes several ready-to-use functions:

- `createGame` - Create a new game instance
- `findGame` - Find and validate game state
- `makeMove` - Execute moves in games
- `endGame` - End game sessions
- `createMintConsume` - Handle asset minting and consumption
- `getAccountId` - Retrieve account information
- And more...

## Customization

1. Update the app name in `app/providers.tsx`
2. Modify the UI components in `app/page.tsx`
3. Add your own smart contracts in `lib/contracts/`
4. Create custom note templates in `lib/notes/`

## Learn More

- [Miden VM Documentation](https://docs.polygon.technology/miden/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Miden SDK](https://github.com/0xMiden/miden-sdk)