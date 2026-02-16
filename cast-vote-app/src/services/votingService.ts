import { 
  Program, 
  AnchorProvider, 
  web3, 
  BN 
} from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import { WalletContextState } from "@solana/wallet-adapter-react";
import { Wallet } from "@coral-xyz/anchor/dist/cjs/provider";
import IDL from "@/lib/voting.json";
import { 
  Poll, 
  Contestant, 
  CreatePollParams, 
  VoteParams, 
  ContestantParams, 
  UpdatePollParams,
  VotingError
} from "@/types/frontend";

  // TODO: Update this to your new deployed program address
  const PROGRAM_ID = new PublicKey("8gbFCLsHxGtpGMxkPmoEYmgKQKFbcQangq3qTEuPjdb7");

export class VotingService {
  private program: Program;
  private connection: Connection;
  private pollsCache: { data: Poll[]; timestamp: number } | null = null;
  private readonly CACHE_TTL = 10000; // 10 seconds cache
  private provider: AnchorProvider;

  constructor(connection: Connection, wallet: WalletContextState | null) {
    this.connection = connection;
    
    if (wallet?.publicKey && wallet?.signTransaction) {
      const anchorWallet = {
        publicKey: wallet.publicKey,
        signTransaction: wallet.signTransaction,
        signAllTransactions: wallet.signAllTransactions!,
      } as Wallet;
      
      this.provider = new AnchorProvider(connection, anchorWallet, {
        commitment: "confirmed",
      });
    } else {
      const dummyWallet = {
        publicKey: PublicKey.default,
        signTransaction: async () => { throw new Error("Wallet not connected"); },
        signAllTransactions: async () => { throw new Error("Wallet not connected"); },
      } as Wallet;
      
      this.provider = new AnchorProvider(connection, dummyWallet, {
        commitment: "confirmed",
      });
    }
    
    this.program = new Program(IDL as any, this.provider);
  }

  /**
   * Create a new poll
   */
  async createPoll(params: CreatePollParams): Promise<string> {
    
    // Use admin public key for PDA derivation (consistent with vote function)
    const ADMIN_PUBKEY = new PublicKey("Bundt9yGXifxnNMWJMnEQj2EwNPtyJiq7XeqE9Eb98Mg");
    const [pollPda] = PublicKey.findProgramAddressSync(
      [Buffer.from(params.title), ADMIN_PUBKEY.toBuffer()],
      this.program.programId
    );

    const tx = await this.program.methods
      .createPoll(
        params.title,
        params.image,
        params.description,
        new BN(Math.floor(params.startsAt / 1000)), // Convert milliseconds to seconds
        new BN(Math.floor(params.endsAt / 1000))   // Convert milliseconds to seconds
      )
      .accounts({
        payer: this.provider.wallet.publicKey,
        poll: pollPda,
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc();

    return tx;
  }

  /**
   * Add a contestant to a poll
   */
  async addContestant(params: ContestantParams): Promise<string> {
    try {
      const [pollPda] = PublicKey.findProgramAddressSync(
        [Buffer.from(params.title), this.provider.wallet.publicKey.toBuffer()],
        this.program.programId
      );

      const tx = await this.program.methods
        .contest(params.title, params.name, params.image)
        .accounts({
          poll: pollPda,
          payer: this.provider.wallet.publicKey,
        })
        .rpc();

      // Clear cache after updating poll
      this.clearPollsCache();
      return tx;
    } catch (error: any) {
      // Extract better error messages from Anchor errors
      if (error?.error?.errorMessage) {
        error.message = error.error.errorMessage;
      } else if (error?.error?.code) {
        const errorCode = error.error.code;
        const errorMessages: { [key: number]: string } = {
          6008: "A contestant with this name already exists in this poll",
          6012: "Image URL is too long (max 200 characters) or name is too long (max 50 characters)",
          6013: "Name cannot be empty",
          6005: "Cannot add contestants after poll has started",
          6014: "Too many contestants (max 20 allowed)",
          6000: "You are not authorized. Only admin can add contestants",
        };
        error.message = errorMessages[errorCode] || error.message || "Failed to add contestant";
      } else if (error?.logs) {
        // Try to extract error from logs
        const logString = error.logs?.join(" ") || "";
        if (logString.includes("StringTooLong")) {
          error.message = "Image URL is too long (max 200 characters) or name is too long (max 50 characters)";
        } else if (logString.includes("DuplicateContestantName")) {
          error.message = "A contestant with this name already exists in this poll";
        } else if (logString.includes("PollAlreadyStarted")) {
          error.message = "Cannot add contestants after poll has started";
        } else if (logString.includes("EmptyString")) {
          error.message = "Name cannot be empty";
        } else if (logString.includes("TooManyContestants")) {
          error.message = "Too many contestants (max 20 allowed)";
        }
      }
      throw error;
    }
  }

  /**
   * Get current blockchain time in seconds (Unix timestamp)
   */
  async getBlockchainTime(): Promise<number> {
    try {
      const slot = await this.connection.getSlot();
      const blockTime = await this.connection.getBlockTime(slot);
      if (blockTime === null) {
        // Fallback to current time if block time is unavailable
        return Math.floor(Date.now() / 1000);
      }
      return blockTime;
    } catch (error) {
      return Math.floor(Date.now() / 1000);
    }
  }

  /**
   * Cast a vote for a contestant
   */
  async vote(params: VoteParams): Promise<string> {
    try {
      const pollAccounts = await (this.program.account as any).poll.all();
      const pollAccount = pollAccounts.find((p: any) => p.account.title === params.title);
      
      if (!pollAccount) {
        throw new Error(`Poll "${params.title}" not found on blockchain`);
      }
      
      const directorPubkey = pollAccount.account.director;
      
      const [expectedPda] = PublicKey.findProgramAddressSync(
        [Buffer.from(params.title), directorPubkey.toBuffer()],
        this.program.programId
      );

      const tx = await this.program.methods
        .vote(new BN(params.contestantId))
        .accounts({
          poll: pollAccount.publicKey, // Use the actual poll address that exists
          payer: this.provider.wallet.publicKey,
        })
        .rpc();

      // Clear cache after voting
      this.clearPollsCache();
      return tx;
    } catch (error: any) {
      if (error?.message?.includes('PollNotStarted') || error?.code === 6001) {
        try {
          const blockchainTime = await this.getBlockchainTime();
          const pollAccounts = await (this.program.account as any).poll.all();
          const pollAccount = pollAccounts.find((p: any) => p.account.title === params.title);
          
          if (pollAccount) {
            const pollStartTime = pollAccount.account.starts_at?.toNumber() || pollAccount.account.startsAt?.toNumber();
            const timeUntilStart = pollStartTime ? pollStartTime - blockchainTime : null;
            
            const helpfulMessage = timeUntilStart 
              ? `Poll has not started yet on blockchain. Blockchain time is ${timeUntilStart > 0 ? `${Math.ceil(timeUntilStart / 60)} minutes` : 'ahead'} behind. The poll will start when the blockchain clock reaches the start time.`
              : 'Poll has not started yet on blockchain. The blockchain clock may be significantly behind your local time.';
            
            error.message = helpfulMessage;
          }
        } catch (timeError) {
          // Silent fail - use original error message
        }
      }
      throw error;
    }
  }

  /**
   * Update poll details
   */
  async updatePoll(params: UpdatePollParams): Promise<string> {
    // First, get the poll to find its director (creator)
    const allPolls = await this.getAllPolls();
    const poll = allPolls.find(p => p.title === params.title);
    
    if (!poll) {
      throw new Error(`Poll "${params.title}" not found`);
    }
    
    // Use the poll's director (creator) for PDA derivation
    const [pollPda] = PublicKey.findProgramAddressSync(
      [Buffer.from(params.title), new PublicKey(poll.director).toBuffer()],
      this.program.programId
    );

    const tx = await this.program.methods
      .updatePoll(
        params.title,
        params.image,
        params.description,
        new BN(Math.floor(params.startsAt / 1000)), // Convert milliseconds to seconds
        new BN(Math.floor(params.endsAt / 1000))   // Convert milliseconds to seconds
      )
      .accounts({
        poll: pollPda,
        payer: this.provider.wallet.publicKey,
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc();

    // Clear cache after creating poll
    this.clearPollsCache();
    return tx;
  }

  /**
   * Finalize a poll
   */
  async finalizePoll(title: string): Promise<string> {
    console.log("🟢 finalizePoll called with title:", title);
    console.log("🟢 Current wallet:", this.provider.wallet.publicKey.toString());
    
    // Find the poll account on blockchain
    const pollAccounts = await (this.program.account as any).poll.all();
    console.log("🟢 Found", pollAccounts.length, "poll accounts");
    const pollAccount = pollAccounts.find((p: any) => p.account.title === title);
    
    if (!pollAccount) {
      console.error("❌ Poll not found:", title);
      throw new Error(`Poll "${title}" not found on blockchain`);
    }
    
    console.log("🟢 Poll found:", {
      title: pollAccount.account.title,
      director: pollAccount.account.director.toString(),
      finalized: pollAccount.account.finalized,
      endsAt: pollAccount.account.ends_at?.toNumber() || pollAccount.account.endsAt?.toNumber(),
      contestants: pollAccount.account.contestants?.length || 0
    });
    
    // The contract's FinalizePoll uses payer.key() for PDA derivation
    // This means only the poll creator (director/admin) can finalize
    const directorPubkey = pollAccount.account.director;
    
    // Verify the current wallet is the admin/director
    if (!this.provider.wallet.publicKey.equals(directorPubkey)) {
      console.error("❌ Wallet mismatch:", {
        current: this.provider.wallet.publicKey.toString(),
        director: directorPubkey.toString()
      });
      throw new Error("Only the poll creator (admin) can finalize the poll. Please connect with the admin wallet.");
    }
    
    console.log("🟢 Wallet matches director");
    
    // Derive PDA using current payer's key (which matches the director)
    const [pollPda] = PublicKey.findProgramAddressSync(
      [Buffer.from(title), this.provider.wallet.publicKey.toBuffer()],
      this.program.programId
    );
    
    console.log("🟢 Derived PDA:", pollPda.toString());
    console.log("🟢 Actual poll address:", pollAccount.publicKey.toString());
    
    // Verify the derived PDA matches the actual poll account
    if (!pollPda.equals(pollAccount.publicKey)) {
      console.error("❌ PDA mismatch");
      throw new Error(`PDA mismatch. Expected ${pollAccount.publicKey.toString()}, got ${pollPda.toString()}. This poll was created by a different wallet.`);
    }
    
    console.log("🟢 PDA matches poll account");

    // Get blockchain time to verify poll has ended
    const blockchainTime = await this.getBlockchainTime();
    const pollEndTime = pollAccount.account.ends_at?.toNumber() || pollAccount.account.endsAt?.toNumber();
    
    console.log("🟢 Time check:", {
      blockchainTime,
      pollEndTime,
      hasEnded: pollEndTime ? blockchainTime > pollEndTime : false
    });
    
    if (pollEndTime && blockchainTime <= pollEndTime) {
      console.error("❌ Poll has not ended yet");
      throw new Error(`Poll has not ended yet on blockchain. Poll ends at ${new Date(pollEndTime * 1000).toLocaleString()}, current blockchain time is ${new Date(blockchainTime * 1000).toLocaleString()}`);
    }

    // Call finalizePoll - workaround for IDL mismatch
    // IDL says no args but account constraint needs title for PDA derivation
    // We provide the poll account directly to bypass PDA derivation
    // Call finalizePoll - title is now required as argument for PDA derivation
    console.log("🟢 Calling finalizePoll transaction with title:", title);
    try {
      const tx = await this.program.methods
        .finalizePoll(title)
        .accounts({
          poll: pollPda,
          payer: this.provider.wallet.publicKey,
        })
        .rpc();

      console.log("✅ finalizePoll transaction successful:", tx);
      // Clear cache after finalizing poll
      this.clearPollsCache();
      return tx;
    } catch (error: any) {
      console.error("❌ finalizePoll transaction failed:", error);
      console.error("❌ Error details:", {
        message: error?.message,
        code: error?.code,
        logs: error?.logs,
        name: error?.name
      });
      
      // Provide more helpful error messages
      if (error?.message?.includes("PollStillActive") || error?.code === 6010) {
        throw new Error("Poll has not ended yet on blockchain. Please wait until the poll end time.");
      }
      if (error?.message?.includes("AlreadyFinalized") || error?.code === 6011) {
        throw new Error("This poll has already been finalized.");
      }
      if (error?.message?.includes("NoContestants") || error?.code === 6015) {
        throw new Error("Cannot finalize a poll with no contestants.");
      }
      if (error?.logs) {
        const errorLogs = error.logs?.join('\n') || '';
        console.error("❌ Error logs:", errorLogs);
        if (errorLogs.includes("PollStillActive")) {
          throw new Error("Poll has not ended yet on blockchain.");
        }
        if (errorLogs.includes("AlreadyFinalized")) {
          throw new Error("This poll has already been finalized.");
        }
      }
      throw error;
    }
  }

  /**
   * Delete a poll
   */
  async deletePoll(title: string): Promise<string> {
    // Find the poll account to get the director (creator)
    const pollAccounts = await (this.program.account as any).poll.all();
    const pollAccount = pollAccounts.find((p: any) => p.account.title === title);
    
    if (!pollAccount) {
      throw new Error(`Poll "${title}" not found on blockchain`);
    }
    
    // The contract's DeletePoll uses payer.key() for PDA derivation
    // This means only the poll creator (director/admin) can delete
    const directorPubkey = pollAccount.account.director;
    
    // Verify the current wallet is the admin/director
    if (!this.provider.wallet.publicKey.equals(directorPubkey)) {
      throw new Error("Only the poll creator (admin) can delete the poll. Please connect with the admin wallet.");
    }
    
    // Derive PDA using current payer's key (which matches the director)
    const [pollPda] = PublicKey.findProgramAddressSync(
      [Buffer.from(title), this.provider.wallet.publicKey.toBuffer()],
      this.program.programId
    );
    
    // Verify the derived PDA matches the actual poll account
    if (!pollPda.equals(pollAccount.publicKey)) {
      throw new Error(`PDA mismatch. Expected ${pollAccount.publicKey.toString()}, got ${pollPda.toString()}. This poll was created by a different wallet.`);
    }

    // Check if poll has votes (contract prevents deletion if votes exist)
    const pollVotes = pollAccount.account.votes?.toNumber() || 0;
    if (pollVotes > 0) {
      throw new Error("Cannot delete a poll that has votes. The contract prevents deletion of polls with votes.");
    }

    const tx = await this.program.methods
      .deletePoll(title)
      .accounts({
        poll: pollPda,
        payer: this.provider.wallet.publicKey,
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc();

    // Clear cache after deleting poll
    this.clearPollsCache();
    return tx;
  }

  /**
   * Fetch a poll by title and payer
   */
  async getPoll(title: string, payer: PublicKey): Promise<Poll | null> {
    try {
      const [pollPda] = PublicKey.findProgramAddressSync(
        [Buffer.from(title), payer.toBuffer()],
        this.program.programId
      );

      const pollAccount = await (this.program.account as any).poll.fetch(pollPda);
      
      // Generate the same safe ID as getAllPolls method
      const accountString = pollPda.toString();
      let hash = 0;
      for (let i = 0; i < accountString.length; i++) {
        const char = accountString.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      const safeId = Math.abs(hash) % 10000; // Ensure positive number within safe range
      
      // Handle timestamps - check both snake_case and camelCase field names
      const timestampRaw = pollAccount.timestamp?.toNumber() || 0;
      const timestampMs = timestampRaw * 1000; // Convert to milliseconds
      
      const startsAtSnake = pollAccount.starts_at?.toNumber();
      const endsAtSnake = pollAccount.ends_at?.toNumber();
      const startsAtCamel = pollAccount.startsAt?.toNumber();
      const endsAtCamel = pollAccount.endsAt?.toNumber();
      
      let startsAtMs, endsAtMs;
      
      // Use whichever format has values
      if (startsAtSnake !== undefined && endsAtSnake !== undefined) {
        startsAtMs = startsAtSnake * 1000; // Convert from seconds to milliseconds
        endsAtMs = endsAtSnake * 1000;
      } else if (startsAtCamel !== undefined && endsAtCamel !== undefined) {
        startsAtMs = startsAtCamel * 1000; // Convert from seconds to milliseconds
        endsAtMs = endsAtCamel * 1000;
      } else {
        // Generate reasonable timestamps based on poll creation
        const now = Date.now();
        const pollCreatedAt = timestampMs || now;
        
        // Set poll to start 1 hour from creation and end 7 days later
        startsAtMs = pollCreatedAt + (60 * 60 * 1000); // 1 hour from creation
        endsAtMs = pollCreatedAt + (7 * 24 * 60 * 60 * 1000); // 7 days from creation
      }
      
      return {
        id: safeId, // Use the same ID generation as getAllPolls
        image: pollAccount.image,
        title: pollAccount.title,
        description: pollAccount.description,
        votes: pollAccount.votes.toNumber(),
        voters: pollAccount.voters,
        deleted: pollAccount.deleted,
        director: pollAccount.director,
        startsAt: startsAtMs, // Use properly converted milliseconds
        endsAt: endsAtMs, // Use properly converted milliseconds
        timestamp: timestampMs, // Use properly converted milliseconds
        contestants: (pollAccount.contestants || []).map((c: any, index: number) => ({
          id: index, // Use array index as safe ID instead of potentially large c.id
          image: c.image || "",
          name: c.name || "",
          voter: c.voter,
          votes: c.votes?.toNumber() || 0,
          voters: c.voters || [],
        })),
        finalized: pollAccount.finalized,
        winner: pollAccount.winner ? pollAccount.winner.toNumber() : undefined,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Fetch all polls using Anchor's built-in account fetching
   * Optimized with caching and early filtering
     */
  async getAllPolls(forceRefresh: boolean = false): Promise<Poll[]> {
    // Check cache first
    if (!forceRefresh && this.pollsCache) {
      const cacheAge = Date.now() - this.pollsCache.timestamp;
      if (cacheAge < this.CACHE_TTL) {
        return this.pollsCache.data;
      }
    }

    try {
      const pollAccounts = await (this.program.account as any).poll.all();
      
      if (pollAccounts.length === 0) {
        this.pollsCache = { data: [], timestamp: Date.now() };
        return [];
      }
      
      const polls: Poll[] = [];
      
      // Process polls in parallel batches for better performance
      for (const accountInfo of pollAccounts) {
        try {
          const pollData = accountInfo.account;
          
          // Filter deleted polls early
          if (pollData.deleted) {
            continue;
          }
          
          // Handle timestamps - check both snake_case and camelCase field names
          const timestampRaw = pollData.timestamp?.toNumber() || 0;
          const timestampMs = timestampRaw * 1000; // Convert to milliseconds
          
          // Check for timestamps in both formats (snake_case and camelCase)
          const startsAtSnake = pollData.starts_at?.toNumber();
          const endsAtSnake = pollData.ends_at?.toNumber();
          const startsAtCamel = pollData.startsAt?.toNumber();
          const endsAtCamel = pollData.endsAt?.toNumber();
          
          let startsAtMs, endsAtMs;
          
          // Use whichever format has values
          if (startsAtSnake !== undefined && endsAtSnake !== undefined) {
            startsAtMs = startsAtSnake * 1000; // Convert from seconds to milliseconds
            endsAtMs = endsAtSnake * 1000;
          } else if (startsAtCamel !== undefined && endsAtCamel !== undefined) {
            startsAtMs = startsAtCamel * 1000; // Convert from seconds to milliseconds
            endsAtMs = endsAtCamel * 1000;
          } else {
            // Generate reasonable timestamps based on poll creation
            const now = Date.now();
            const pollCreatedAt = timestampMs || now;
            
            // Set poll to start 1 hour from creation and end 7 days later
            startsAtMs = pollCreatedAt + (60 * 60 * 1000); // 1 hour from creation
            endsAtMs = pollCreatedAt + (7 * 24 * 60 * 60 * 1000); // 7 days from creation
          }
          
          // Generate a safe ID from the account public key instead of using the large poll ID
          const accountString = accountInfo.publicKey.toString();
          let hash = 0;
          for (let i = 0; i < accountString.length; i++) {
            const char = accountString.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
          }
          const safeId = Math.abs(hash) % 10000; // Ensure positive number within safe range
          
          const processedPoll = {
            id: safeId,
            image: pollData.image || "",
            title: pollData.title || "",
            description: pollData.description || "",
            votes: pollData.votes?.toNumber() || 0,
            voters: pollData.voters || [],
            deleted: pollData.deleted || false,
            director: pollData.director,
            startsAt: startsAtMs, // Use properly converted milliseconds
            endsAt: endsAtMs, // Use properly converted milliseconds
            timestamp: timestampMs, // Use properly converted milliseconds
            contestants: (pollData.contestants || []).map((c: any, index: number) => ({
              id: index, // Use array index as safe ID instead of potentially large c.id
              image: c.image || "",
              name: c.name || "",
              voter: c.voter,
              votes: c.votes?.toNumber() || 0,
              voters: c.voters || [],
            })),
            finalized: pollData.finalized || false,
            winner: pollData.winner?.toNumber() || undefined,
          };
          
          polls.push(processedPoll);
        } catch (error) {
          // Skip invalid poll accounts
        }
      }
      
      // Update cache
      this.pollsCache = { data: polls, timestamp: Date.now() };
      return polls;
      
    } catch (error) {
      // Return cached data if available, even if stale
      if (this.pollsCache) {
        return this.pollsCache.data;
      }
      return [];
    }
  }

  /**
   * Clear the polls cache (useful after creating/updating/deleting polls)
   */
  clearPollsCache(): void {
    this.pollsCache = null;
  }
}
// Force refresh Fri Oct 17 02:54:36 PM +0545 2025
