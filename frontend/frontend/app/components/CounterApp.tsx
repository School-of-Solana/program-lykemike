"use client";
import React, { useEffect, useState, useMemo } from "react";
import {
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import * as borsh from "borsh";

const PROGRAM_ID = new PublicKey(
  "5eW63Ha7mXHUPaKBp5Scy7GfuwxoSYhfFbv6P9SkSiw4"
);

// Instruction discriminators from your IDL
const DISCRIMINATORS = {
  initialize: Buffer.from([175, 175, 109, 31, 13, 152, 155, 237]),
  increment: Buffer.from([11, 18, 104, 9, 104, 174, 59, 33]),
  reset: Buffer.from([23, 81, 251, 84, 138, 183, 240, 214]),
};

interface CounterData {
  owner: PublicKey;
  count: number;
  totalIncrements: number;
  createdAt: number;
}

// Schema for deserializing Counter account
class Counter {
  owner: Uint8Array;
  count: bigint;
  totalIncrements: bigint;
  createdAt: bigint;

  constructor(fields: {
    owner: Uint8Array;
    count: bigint;
    totalIncrements: bigint;
    createdAt: bigint;
  }) {
    this.owner = fields.owner;
    this.count = fields.count;
    this.totalIncrements = fields.totalIncrements;
    this.createdAt = fields.createdAt;
  }
}

const CounterSchema = new Map([
  [
    Counter,
    {
      kind: "struct",
      fields: [
        ["owner", [32]],
        ["count", "u64"],
        ["totalIncrements", "u64"],
        ["createdAt", "i64"],
      ],
    },
  ],
]);

export default function CounterApp() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [counter, setCounter] = useState<CounterData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const counterPda = useMemo(() => {
    if (!wallet.publicKey) return null;
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("counter"), wallet.publicKey.toBuffer()],
      PROGRAM_ID
    );
    console.log("Counter PDA:", pda.toString());
    return pda;
  }, [wallet.publicKey]);
  // Helper functions to read u64 and i64 from buffer
  function readU64LE(buffer: Uint8Array, offset: number): bigint {
    const arr = buffer.subarray(offset, offset + 8);
    let value = BigInt(0);
    for (let i = 0; i < 8; i++) {
      value += BigInt(arr[i]) << BigInt(8 * i);
    }
    return value;
  }

  function readI64LE(buffer: Uint8Array, offset: number): bigint {
    const u64 = readU64LE(buffer, offset);
    // Convert unsigned to signed using computed BigInt values instead of BigInt literals
    const twoPow63 = BigInt(1) << BigInt(63);
    const twoPow64 = BigInt(1) << BigInt(64);
    if (u64 >= twoPow63) {
      return u64 - twoPow64;
    }
    return u64;
  }
  // const fetchCounter = async () => {
  //   if (!counterPda) return;

  //   try {
  //     const accountInfo = await connection.getAccountInfo(counterPda);
  //     if (!accountInfo) {
  //       console.log("Counter not initialized");
  //       setCounter(null);
  //       return;
  //     }

  //     console.log("Account data length:", accountInfo.data.length);

  //     // Skip the 8-byte discriminator
  //     const data = accountInfo.data.subarray(8);
  //     const decoded = borsh.deserialize(
  //       CounterSchema,
  //       Counter,
  //       data
  //     ) as Counter;

  //     console.log("Decoded counter:", decoded);

  //     setCounter({
  //       owner: new PublicKey(decoded.owner),
  //       count: Number(decoded.count),
  //       totalIncrements: Number(decoded.totalIncrements),
  //       createdAt: Number(decoded.createdAt),
  //     });
  //   } catch (err) {
  //     console.error("Error fetching counter:", err);
  //     setCounter(null);
  //   }
  // };
  const fetchCounter = async () => {
    if (!counterPda) return;

    try {
      const accountInfo = await connection.getAccountInfo(counterPda);
      if (!accountInfo) {
        console.log("Counter not initialized");
        setCounter(null);
        return;
      }

      console.log("Account data length:", accountInfo.data.length);

      // Skip the 8-byte discriminator and manually parse the data
      const data = accountInfo.data.subarray(8);

      // Manually deserialize the account data
      // Account structure: owner (32 bytes) + count (8 bytes) + totalIncrements (8 bytes) + createdAt (8 bytes)

      const owner = new PublicKey(data.subarray(0, 32));
      const count = Number(readU64LE(data, 32));
      const totalIncrements = Number(readU64LE(data, 40));
      const createdAt = Number(readI64LE(data, 48));

      console.log("Decoded counter:", {
        owner: owner.toString(),
        count,
        totalIncrements,
        createdAt,
      });

      setCounter({
        owner,
        count,
        totalIncrements,
        createdAt,
      });
    } catch (err) {
      console.error("Error fetching counter:", err);
      setCounter(null);
    }
  };

  useEffect(() => {
    if (mounted && wallet.connected && counterPda) {
      fetchCounter();
    }
  }, [mounted, wallet.connected, counterPda]);

  const clearMessages = () => {
    setError("");
    setSuccess("");
  };

  const handleInitialize = async () => {
    if (!wallet.publicKey || !counterPda || !wallet.signTransaction) return;

    setLoading(true);
    clearMessages();

    try {
      console.log("Initializing counter...");
      console.log("Counter PDA:", counterPda.toString());
      console.log("User:", wallet.publicKey.toString());

      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: counterPda, isSigner: false, isWritable: true },
          { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
          {
            pubkey: SystemProgram.programId,
            isSigner: false,
            isWritable: false,
          },
        ],
        programId: PROGRAM_ID,
        data: DISCRIMINATORS.initialize,
      });

      const transaction = new Transaction().add(instruction);
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet.publicKey;

      const signed = await wallet.signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signed.serialize());

      console.log("Transaction sent:", signature);
      console.log(
        `View on explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`
      );

      await connection.confirmTransaction(signature, "confirmed");
      console.log("Transaction confirmed");

      setSuccess("Counter created successfully!");
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await fetchCounter();
    } catch (err: any) {
      console.error("Initialize error:", err);
      setError(err.message || "Failed to create counter");
    } finally {
      setLoading(false);
    }
  };

  const handleIncrement = async () => {
    if (!wallet.publicKey || !counterPda || !wallet.signTransaction) return;

    setLoading(true);
    clearMessages();

    try {
      console.log("Incrementing counter...");

      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: counterPda, isSigner: false, isWritable: true },
          { pubkey: wallet.publicKey, isSigner: true, isWritable: false },
        ],
        programId: PROGRAM_ID,
        data: DISCRIMINATORS.increment,
      });

      const transaction = new Transaction().add(instruction);
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet.publicKey;

      const signed = await wallet.signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signed.serialize());

      console.log("Transaction sent:", signature);
      console.log(
        `View on explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`
      );

      await connection.confirmTransaction(signature, "confirmed");
      console.log("Transaction confirmed");

      setSuccess("Counter incremented!");
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await fetchCounter();
    } catch (err: any) {
      console.error("Increment error:", err);
      setError(err.message || "Failed to increment");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!wallet.publicKey || !counterPda || !wallet.signTransaction) return;

    setLoading(true);
    clearMessages();

    try {
      console.log("Resetting counter...");

      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: counterPda, isSigner: false, isWritable: true },
          { pubkey: wallet.publicKey, isSigner: true, isWritable: false },
        ],
        programId: PROGRAM_ID,
        data: DISCRIMINATORS.reset,
      });

      const transaction = new Transaction().add(instruction);
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet.publicKey;

      const signed = await wallet.signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signed.serialize());

      console.log("Transaction sent:", signature);
      console.log(
        `View on explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`
      );

      await connection.confirmTransaction(signature, "confirmed");
      console.log("Transaction confirmed");

      setSuccess("Counter reset!");
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await fetchCounter();
    } catch (err: any) {
      console.error("Reset error:", err);
      setError(err.message || "Failed to reset");
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
        <div className="text-xl font-semibold text-gray-700">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">
                🔢 Counter dApp
              </h1>
              <p className="text-gray-600">Simple counter on Solana Devnet</p>
            </div>
            <WalletMultiButton />
          </div>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
              {success}
            </div>
          )}
        </div>

        {!wallet.connected ? (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <h2 className="text-xl font-bold mb-4 text-gray-800">
              Connect Your Wallet
            </h2>
            <p className="text-gray-600">
              Please connect your Solana wallet to use the counter
            </p>
          </div>
        ) : !counter ? (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <h2 className="text-xl font-bold mb-4 text-gray-800">
              No Counter Found
            </h2>
            <p className="text-gray-600 mb-6">
              Initialize your personal counter to get started
            </p>
            <button
              onClick={handleInitialize}
              disabled={loading}
              className="bg-blue-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
            >
              {loading ? "Creating..." : "Create Counter"}
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-lg p-8">
              <div className="text-center mb-8">
                <p className="text-gray-600 text-sm mb-2">Current Count</p>
                <div className="text-8xl font-bold text-blue-600 mb-4">
                  {counter.count}
                </div>
                <p className="text-gray-500 text-sm">
                  Total increments:{" "}
                  <span className="font-bold text-purple-600">
                    {counter.totalIncrements}
                  </span>
                </p>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={handleIncrement}
                  disabled={loading}
                  className="flex-1 bg-green-600 text-white py-4 rounded-lg font-bold text-xl hover:bg-green-700 disabled:bg-gray-400 transition-colors"
                >
                  {loading ? "..." : "+ Increment"}
                </button>
                <button
                  onClick={handleReset}
                  disabled={loading}
                  className="flex-1 bg-red-600 text-white py-4 rounded-lg font-bold text-xl hover:bg-red-700 disabled:bg-gray-400 transition-colors"
                >
                  {loading ? "..." : "↻ Reset"}
                </button>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">
                Counter Details
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Owner:</span>
                  <span className="font-mono text-gray-800">
                    {counter.owner.toString().slice(0, 8)}...
                    {counter.owner.toString().slice(-8)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Current Count:</span>
                  <span className="font-bold text-blue-600">
                    {counter.count}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Increments:</span>
                  <span className="font-bold text-purple-600">
                    {counter.totalIncrements}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Created:</span>
                  <span className="text-gray-800">
                    {new Date(counter.createdAt * 1000).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-bold text-blue-800 mb-2">ℹ️ How it works</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>
                  • Click <strong>Increment</strong> to add 1 to your counter
                </li>
                <li>
                  • Click <strong>Reset</strong> to set count back to 0
                </li>
                <li>• Total increments are preserved when you reset</li>
                <li>• Your counter is stored on Solana blockchain</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
