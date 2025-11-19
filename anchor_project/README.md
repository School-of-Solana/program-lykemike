# Anchor Counter Program

This is the Solana smart contract (program) for the Counter dApp. It is built using the Anchor framework.

## Prerequisites

- Rust
- Solana CLI
- Anchor CLI
- Yarn

## Setup

1. Install dependencies:
   ```bash
   yarn install
   ```

2. Build the program:
   ```bash
   anchor build
   ```

## Testing

Run the test suite to verify the program logic:

```bash
anchor test
```

The tests cover:
- Initializing a counter
- Incrementing the counter
- Resetting the counter
- Error handling (unauthorized access, duplicate initialization)

## Deployment

To deploy to Devnet:

1. Configure your Solana CLI to Devnet:
   ```bash
   solana config set --url devnet
   ```

2. Deploy the program:
   ```bash
   anchor deploy
   ```

## Program Details

- **Program ID**: `5eW63Ha7mXHUPaKBp5Scy7GfuwxoSYhfFbv6P9SkSiw4`
- **Network**: Devnet
