import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Counter } from "../target/types/counter";
import { expect } from "chai";

describe("counter", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Counter as Program<Counter>;

  // Test users
  const user = provider.wallet as anchor.Wallet;
  const user2 = anchor.web3.Keypair.generate();

  // PDAs
  let counterPda: anchor.web3.PublicKey;
  let counterBump: number;
  let counter2Pda: anchor.web3.PublicKey;

  before(async () => {
    // Derive PDAs
    [counterPda, counterBump] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("counter"), user.publicKey.toBuffer()],
      program.programId
    );

    [counter2Pda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("counter"), user2.publicKey.toBuffer()],
      program.programId
    );

    // Airdrop to user2 for testing
    const airdropSig = await provider.connection.requestAirdrop(
      user2.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropSig);
  });

  // ============ HAPPY PATH TESTS ============

  describe("Happy Path", () => {
    it("Initializes a counter successfully", async () => {
      const tx = await program.methods
        .initialize()
        .accounts({
          counter: counterPda,
          user: user.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      console.log("Initialize transaction signature:", tx);

      // Fetch and verify counter data
      const counterAccount = await program.account.counter.fetch(counterPda);

      expect(counterAccount.owner.toString()).to.equal(
        user.publicKey.toString()
      );
      expect(counterAccount.count.toNumber()).to.equal(0);
      expect(counterAccount.totalIncrements.toNumber()).to.equal(0);
      expect(counterAccount.createdAt.toNumber()).to.be.greaterThan(0);
    });

    it("Increments counter successfully", async () => {
      const tx = await program.methods
        .increment()
        .accounts({
          counter: counterPda,
          user: user.publicKey,
        })
        .rpc();

      console.log("Increment transaction signature:", tx);

      // Verify counter incremented
      const counterAccount = await program.account.counter.fetch(counterPda);
      expect(counterAccount.count.toNumber()).to.equal(1);
      expect(counterAccount.totalIncrements.toNumber()).to.equal(1);
    });

    it("Increments counter multiple times", async () => {
      // Increment 4 more times (should be at 5 total)
      for (let i = 0; i < 4; i++) {
        await program.methods
          .increment()
          .accounts({
            counter: counterPda,
            user: user.publicKey,
          })
          .rpc();
      }

      const counterAccount = await program.account.counter.fetch(counterPda);
      expect(counterAccount.count.toNumber()).to.equal(5);
      expect(counterAccount.totalIncrements.toNumber()).to.equal(5);
    });

    it("Resets counter successfully", async () => {
      const tx = await program.methods
        .reset()
        .accounts({
          counter: counterPda,
          user: user.publicKey,
        })
        .rpc();

      console.log("Reset transaction signature:", tx);

      // Verify counter reset but total_increments preserved
      const counterAccount = await program.account.counter.fetch(counterPda);
      expect(counterAccount.count.toNumber()).to.equal(0);
      expect(counterAccount.totalIncrements.toNumber()).to.equal(5);
    });

    it("Can increment after reset", async () => {
      await program.methods
        .increment()
        .accounts({
          counter: counterPda,
          user: user.publicKey,
        })
        .rpc();

      const counterAccount = await program.account.counter.fetch(counterPda);
      expect(counterAccount.count.toNumber()).to.equal(1);
      expect(counterAccount.totalIncrements.toNumber()).to.equal(6);
    });

    it("Different users can have separate counters", async () => {
      // User 2 initializes their counter
      const tx = await program.methods
        .initialize()
        .accounts({
          counter: counter2Pda,
          user: user2.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([user2])
        .rpc();

      console.log("User 2 initialize signature:", tx);

      // Verify both counters exist independently
      const counter1 = await program.account.counter.fetch(counterPda);
      const counter2 = await program.account.counter.fetch(counter2Pda);

      expect(counter1.owner.toString()).to.equal(user.publicKey.toString());
      expect(counter2.owner.toString()).to.equal(user2.publicKey.toString());
      expect(counter1.count.toNumber()).to.equal(1);
      expect(counter2.count.toNumber()).to.equal(0);
    });
  });

  // ============ UNHAPPY PATH TESTS ============

  describe("Unhappy Path", () => {
    it("Fails to initialize counter twice", async () => {
      try {
        await program.methods
          .initialize()
          .accounts({
            counter: counterPda,
            user: user.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .rpc();

        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.toString()).to.include("already in use");
      }
    });

    it("Fails when unauthorized user tries to increment", async () => {
      try {
        // User 2 tries to increment User 1's counter
        await program.methods
          .increment()
          .accounts({
            counter: counterPda,
            user: user2.publicKey,
          })
          .signers([user2])
          .rpc();

        expect.fail("Should have thrown an error");
      } catch (error) {
        // Check for constraint violation or unauthorized error
        const errMsg = error.toString();
        const isConstraintError =
          errMsg.includes("ConstraintRaw") ||
          errMsg.includes("constraint") ||
          errMsg.includes("Unauthorized");
        expect(isConstraintError).to.be.true;
      }
    });

    it("Fails when unauthorized user tries to reset", async () => {
      try {
        // User 2 tries to reset User 1's counter
        await program.methods
          .reset()
          .accounts({
            counter: counterPda,
            user: user2.publicKey,
          })
          .signers([user2])
          .rpc();

        expect.fail("Should have thrown an error");
      } catch (error) {
        // Check for constraint violation or unauthorized error
        const errMsg = error.toString();
        const isConstraintError =
          errMsg.includes("ConstraintRaw") ||
          errMsg.includes("constraint") ||
          errMsg.includes("Unauthorized");
        expect(isConstraintError).to.be.true;
      }
    });

    it("Fails to increment non-existent counter", async () => {
      const nonExistentUser = anchor.web3.Keypair.generate();
      const [nonExistentPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("counter"), nonExistentUser.publicKey.toBuffer()],
        program.programId
      );

      // Airdrop for tx fees
      const airdropSig = await provider.connection.requestAirdrop(
        nonExistentUser.publicKey,
        1 * anchor.web3.LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(airdropSig);

      try {
        await program.methods
          .increment()
          .accounts({
            counter: nonExistentPda,
            user: nonExistentUser.publicKey,
          })
          .signers([nonExistentUser])
          .rpc();

        expect.fail("Should have thrown an error");
      } catch (error) {
        // Just verify an error was thrown
        expect(error).to.exist;
      }
    });

    it("Fails to reset non-existent counter", async () => {
      const nonExistentUser = anchor.web3.Keypair.generate();
      const [nonExistentPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("counter"), nonExistentUser.publicKey.toBuffer()],
        program.programId
      );

      const airdropSig = await provider.connection.requestAirdrop(
        nonExistentUser.publicKey,
        1 * anchor.web3.LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(airdropSig);

      try {
        await program.methods
          .reset()
          .accounts({
            counter: nonExistentPda,
            user: nonExistentUser.publicKey,
          })
          .signers([nonExistentUser])
          .rpc();

        expect.fail("Should have thrown an error");
      } catch (error) {
        // Just verify an error was thrown
        expect(error).to.exist;
      }
    });
  });
});
