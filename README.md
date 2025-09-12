# Miden Name Service (MNS)

A decentralized name service built on the Miden blockchain that allows users to register human-readable names and associate them with their Miden account IDs.

> [!NOTE]
> This project is a proof of concept and has limited features.

## Overview

The Miden Name Service (MNS) is a blockchain-based naming system that provides:

- **Name Registration**: Register lowercase alphabetic names (a-z, up to 36 characters) 
- **Account Mapping**: Associate names with Miden account IDs
- **Smart Contract Backend**: Implemented in Miden Assembly (MASM) for on-chain storage and validation
- **Web Interface**: React/Next.js frontend with Miden wallet integration

## Architecture

### Smart Contract (`masm/accounts/name_service.masm`)
- Stores name-to-account mappings in contract storage
- Prevents duplicate name registration
- Validates account IDs are non-empty
- Written in Miden Assembly for execution on Miden VM

### Frontend (`app/`)
- Next.js 15 with React 19
- Miden wallet adapter for seamless wallet connectivity
- Real-time name validation and registration interface
- TypeScript support with Tailwind CSS styling

### Backend Tools (`mns/`)
- Rust-based CLI tools for name service deployment and management
- Miden client integration for blockchain interactions
- SQLite storage for local state management

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- Rust toolchain (for backend tools)
- Miden wallet compatible with the testnet

### Deployment

1. Navigate to the `mns/` directory:
   ```bash
   cd mns
   ```

2. Build the tools:
   ```bash
   cargo run --release --bin deploy_name_service
   ```

Copy the account ID and replace `NAME_SERVICE_ACCOUNT_ID` in `constants.ts`.

### Frontend Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.
