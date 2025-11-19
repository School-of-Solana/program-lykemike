# Project Description

**Deployed Frontend URL:** https://frontend-two-swart-37.vercel.app/

**Solana Program ID:** `5eW63Ha7mXHUPaKBp5Scy7GfuwxoSYhfFbv6P9SkSiw4`

## Project Overview

### Description
This is a decentralized counter application built on the Solana blockchain. It allows users to create their own personal counter accounts, which are stored on-chain. Each user can increment their counter and reset it. The application demonstrates the use of Program Derived Addresses (PDAs) to ensure that each user has a unique, deterministic counter account that only they can control. It tracks both the current count and the total number of increments over the lifetime of the counter.

### Key Features
- **Connect Wallet**: Users can connect their Solana wallets (Phantom, Solflare) to interact with the dApp.
- **Create Counter**: Users can initialize a new counter account on-chain if they don't have one.
- **Increment Counter**: Users can increase their counter value by 1. This also updates the lifetime total increments.
- **Reset Counter**: Users can reset their current count to 0. This does NOT reset the total lifetime increments.
- **View Stats**: Users can view their current count, total increments, and the creation date of their counter.
  
### How to Use the dApp
1. **Connect Wallet**: Click the "Select Wallet" button in the top right corner and choose your wallet (e.g., Phantom).
2. **Initialize Counter**: If you haven't used the app before, click the "Create Counter" button to initialize your on-chain account. Approve the transaction in your wallet.
3. **Increment**: Click the green "+ Increment" button to add 1 to your counter. Approve the transaction.
4. **Reset**: Click the red "↻ Reset" button to set your current count back to 0. Your total increments will be preserved.

## Program Architecture
The program is built using the Anchor framework. It uses a single account type `Counter` and provides three main instructions to manage the state.

### PDA Usage
The program uses Program Derived Addresses (PDAs) to deterministically locate each user's counter account.

**PDAs Used:**
- **Counter Account**: Derived using the seeds `["counter", user_public_key]`. 
    - **Purpose**: This ensures that every user wallet maps to exactly one unique counter account. It also allows the program to easily find a user's counter without needing to store the address separately.

### Program Instructions
**Instructions Implemented:**
- **initialize**: Creates a new `Counter` account for the user. Sets `count` and `total_increments` to 0 and records the `created_at` timestamp.
- **increment**: Increases both `count` and `total_increments` by 1. Checks for overflow.
- **reset**: Sets `count` to 0. Does NOT modify `total_increments` or `owner`.

### Account Structure
The main state is stored in the `Counter` account:

```rust
#[account]
#[derive(InitSpace)]
pub struct Counter {
    pub owner: Pubkey,           // 32 bytes - The owner of the counter
    pub count: u64,              // 8 bytes - Current count value
    pub total_increments: u64,   // 8 bytes - Lifetime total increments
    pub created_at: i64,         // 8 bytes - Creation timestamp
}
```

## Testing

### Test Coverage
The project includes a comprehensive test suite written in TypeScript using Mocha and Chai. It covers both successful operations and error handling.

**Happy Path Tests:**
- **Initializes a counter successfully**: Verifies that a new counter is created with correct initial values (owner, count=0).
- **Increments counter successfully**: Verifies that count and total increments increase by 1.
- **Increments counter multiple times**: Verifies state consistency after multiple updates.
- **Resets counter successfully**: Verifies count goes to 0 but total increments are preserved.
- **Different users can have separate counters**: Verifies that actions by one user do not affect another user's counter.

**Unhappy Path Tests:**
- **Fails to initialize counter twice**: Ensures a user cannot create a second counter (PDA collision).
- **Fails when unauthorized user tries to increment**: Ensures User B cannot increment User A's counter.
- **Fails when unauthorized user tries to reset**: Ensures User B cannot reset User A's counter.
- **Fails to increment/reset non-existent counter**: Ensures operations fail gracefully if the account doesn't exist.

### Running Tests
```bash
# Commands to run your tests
anchor test
```

### Additional Notes for Evaluators
The frontend is built with Next.js and uses the Solana Wallet Adapter for connection. The program is deployed on Devnet. The "Total Increments" feature demonstrates persistent state even when the main "count" is reset, adding a layer of complexity beyond a simple counter.

