import React, { useEffect, useState, useMemo } from "react";
import { Connection, PublicKey } from "@solana/web3.js";
import { Program, AnchorProvider, web3, BN } from "@coral-xyz/anchor";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import idl from "./../idl.json";

// Replace with your deployed program ID
const PROGRAM_ID = new PublicKey(
  "5eW63Ha7mXHUPaKBp5Scy7GfuwxoSYhfFbv6P9SkSiw4"
);
const ELECTION_ID = "presidential-2024";

interface Candidate {
  name: string;
  votes: BN;
}

interface ElectionData {
  admin: PublicKey;
  electionId: string;
  candidates: Candidate[];
  totalVotes: BN;
  isActive: boolean;
  createdAt: BN;
}

interface VoterData {
  election: PublicKey;
  voter: PublicKey;
  candidateIndex: number;
  votedAt: BN;
}

export default function VotingApp() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [election, setElection] = useState<ElectionData | null>(null);
  const [voterRecord, setVoterRecord] = useState<VoterData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const provider = useMemo(() => {
    if (!wallet.publicKey) return null;
    return new AnchorProvider(connection, wallet as any, {
      commitment: "confirmed",
    });
  }, [connection, wallet]);

  const program = useMemo(() => {
    if (!provider) return null;
    return new Program(idl as any, PROGRAM_ID, provider);
  }, [provider]);

  // Derive PDAs
  const electionPda = useMemo(() => {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("election"), Buffer.from(ELECTION_ID)],
      PROGRAM_ID
    )[0];
  }, []);

  const voterPda = useMemo(() => {
    if (!wallet.publicKey) return null;
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from("voter"),
        electionPda.toBuffer(),
        wallet.publicKey.toBuffer(),
      ],
      PROGRAM_ID
    )[0];
  }, [wallet.publicKey, electionPda]);

  // Fetch election data
  const fetchElection = async () => {
    if (!program) return;
    try {
      const data = await program.account.election.fetch(electionPda);
      setElection(data as any);
    } catch (err) {
      console.log("Election not found or not initialized");
      setElection(null);
    }
  };

  // Fetch voter record
  const fetchVoterRecord = async () => {
    if (!program || !voterPda) return;
    try {
      const data = await program.account.voter.fetch(voterPda);
      setVoterRecord(data as any);
    } catch (err) {
      setVoterRecord(null);
    }
  };

  useEffect(() => {
    fetchElection();
    fetchVoterRecord();
  }, [program, wallet.publicKey]);

  // Initialize election (admin only)
  const initializeElection = async () => {
    if (!program || !wallet.publicKey) return;
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const candidates = ["Alice Johnson", "Bob Smith", "Charlie Davis"];

      await program.methods
        .initializeElection(ELECTION_ID, candidates)
        .accounts({
          election: electionPda,
          admin: wallet.publicKey,
          systemProgram: web3.SystemProgram.programId,
        })
        .rpc();

      setSuccess("Election initialized successfully!");
      await fetchElection();
    } catch (err: any) {
      setError(err.message || "Failed to initialize election");
    } finally {
      setLoading(false);
    }
  };

  // Cast vote
  const castVote = async (candidateIndex: number) => {
    if (!program || !wallet.publicKey || !voterPda) return;
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      await program.methods
        .castVote(candidateIndex)
        .accounts({
          election: electionPda,
          voterRecord: voterPda,
          voter: wallet.publicKey,
          systemProgram: web3.SystemProgram.programId,
        })
        .rpc();

      setSuccess("Vote cast successfully!");
      await fetchElection();
      await fetchVoterRecord();
    } catch (err: any) {
      if (err.message.includes("already in use")) {
        setError("You have already voted!");
      } else {
        setError(err.message || "Failed to cast vote");
      }
    } finally {
      setLoading(false);
    }
  };

  // Close election (admin only)
  const closeElection = async () => {
    if (!program || !wallet.publicKey) return;
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      await program.methods
        .closeElection()
        .accounts({
          election: electionPda,
          admin: wallet.publicKey,
        })
        .rpc();

      setSuccess("Election closed successfully!");
      await fetchElection();
    } catch (err: any) {
      setError(err.message || "Failed to close election");
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = wallet.publicKey && election?.admin.equals(wallet.publicKey);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 to-blue-100 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">🗳️ SolVote</h1>
              <p className="text-gray-600">Decentralized Presidential Voting</p>
            </div>
            <WalletMultiButton />
          </div>

          {/* Status messages */}
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

          {/* Election status */}
          {election && (
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Election Status</p>
                  <p className="text-lg font-bold">
                    {election.isActive ? (
                      <span className="text-green-600">🟢 Active</span>
                    ) : (
                      <span className="text-red-600">🔴 Closed</span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Votes</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {election.totalVotes.toString()}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Initialize election (if not exists) */}
        {!election && wallet.connected && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6 text-center">
            <h2 className="text-xl font-bold mb-4">No Election Found</h2>
            <p className="text-gray-600 mb-4">
              Initialize the election to start voting
            </p>
            <button
              onClick={initializeElection}
              disabled={loading}
              className="bg-purple-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-purple-700 disabled:bg-gray-400"
            >
              {loading ? "Initializing..." : "Initialize Election"}
            </button>
          </div>
        )}

        {/* Voter status */}
        {voterRecord && election && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold mb-3 text-green-600">
              ✅ You Have Voted!
            </h2>
            <p className="text-gray-700">
              Your vote was cast for:{" "}
              <span className="font-bold text-purple-600">
                {election.candidates[voterRecord.candidateIndex]?.name}
              </span>
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Voted at:{" "}
              {new Date(voterRecord.votedAt.toNumber() * 1000).toLocaleString()}
            </p>
          </div>
        )}

        {/* Candidates */}
        {election && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-2xl font-bold mb-6">Candidates</h2>
            <div className="space-y-4">
              {election.candidates.map((candidate, index) => {
                const votePercentage =
                  election.totalVotes.toNumber() > 0
                    ? (candidate.votes.toNumber() /
                        election.totalVotes.toNumber()) *
                      100
                    : 0;

                return (
                  <div
                    key={index}
                    className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-lg font-bold text-gray-800">
                        {candidate.name}
                      </h3>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-purple-600">
                          {candidate.votes.toString()}
                        </p>
                        <p className="text-sm text-gray-500">
                          {votePercentage.toFixed(1)}%
                        </p>
                      </div>
                    </div>

                    {/* Vote bar */}
                    <div className="w-full bg-gray-200 rounded-full h-3 mb-3">
                      <div
                        className="bg-purple-600 h-3 rounded-full transition-all duration-300"
                        style={{ width: `${votePercentage}%` }}
                      />
                    </div>

                    {/* Vote button */}
                    {wallet.connected && !voterRecord && election.isActive && (
                      <button
                        onClick={() => castVote(index)}
                        disabled={loading}
                        className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 disabled:bg-gray-400"
                      >
                        {loading ? "Voting..." : "Vote for " + candidate.name}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Admin controls */}
        {isAdmin && election && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold mb-4 text-orange-600">
              🔐 Admin Controls
            </h2>
            <button
              onClick={closeElection}
              disabled={loading || !election.isActive}
              className="bg-red-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-red-700 disabled:bg-gray-400"
            >
              {loading ? "Closing..." : "Close Election"}
            </button>
          </div>
        )}

        {/* Connect wallet prompt */}
        {!wallet.connected && (
          <div className="bg-white rounded-lg shadow-lg p-6 text-center">
            <h2 className="text-xl font-bold mb-4">Connect Your Wallet</h2>
            <p className="text-gray-600">
              Please connect your Solana wallet to view and participate in the
              election
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
