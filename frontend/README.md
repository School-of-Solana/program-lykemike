# Counter dApp Frontend

This is the frontend application for the Counter dApp, built with Next.js and Solana Wallet Adapter.

## Prerequisites

- Node.js
- NPM or Yarn

## Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```

## Development

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Build

To build the application for production:

```bash
npm run build
```

## Features

- **Wallet Connection**: Supports Phantom and Solflare wallets.
- **Counter Interaction**: Initialize, Increment, and Reset your personal counter on the Solana blockchain.
- **Real-time Updates**: View your current count and total lifetime increments.

## Configuration

The application is configured to connect to **Solana Devnet**.
The program ID is set in `app/components/CounterApp.tsx`.