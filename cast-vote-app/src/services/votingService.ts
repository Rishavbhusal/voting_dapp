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

const PROGRAM_ID = new PublicKey("DExwUvcLqxYi5grCn9XtweCEPHSWUHfNAaad88ksuyhb");

export class VotingService {
  private program: Program;
  private connection: Connection;
  private provider: AnchorProvider;

  constructor(connection: Connection, wallet: WalletContextState | null) {
    console.log("🔄 VotingService: Constructor called");
    console.log("📊 Connection:", !!connection);
    console.log("📊 Wallet:", !!wallet);
    console.log("📊 Wallet public key:", wallet?.publicKey?.toString());
    
    this.connection = connection;
    
    if (wallet?.publicKey && wallet?.signTransaction) {
      console.log("✅ VotingService: Using real wallet");
      // Create a wallet adapter for Anchor
      const anchorWallet = {
        publicKey: wallet.publicKey,
        signTransaction: wallet.signTransaction,
        signAllTransactions: wallet.signAllTransactions!,
      } as Wallet;
      
      this.provider = new AnchorProvider(connection, anchorWallet, {
        commitment: "confirmed",
      });
    } else {
      console.log("⚠️ VotingService: Using dummy wallet for read-only operations");
      // Create a dummy provider for read-only operations
      const dummyWallet = {
        publicKey: PublicKey.default,
        signTransaction: async () => { throw new Error("Wallet not connected"); },
        signAllTransactions: async () => { throw new Error("Wallet not connected"); },
      } as Wallet;
      
      this.provider = new AnchorProvider(connection, dummyWallet, {
        commitment: "confirmed",
      });
    }
    
    console.log("🔄 VotingService: Creating program...");
    this.program = new Program(IDL as any, this.provider);
    console.log("✅ VotingService: Program created successfully");
    console.log("📊 Program ID:", this.program.programId.toString());
  }

  /**
   * Create a new poll
   */
  async createPoll(params: CreatePollParams): Promise<string> {
    console.log('🔄 Creating poll with params:', {
      title: params.title,
      startsAt: params.startsAt,
      endsAt: params.endsAt,
      startsAtSeconds: Math.floor(params.startsAt / 1000),
      endsAtSeconds: Math.floor(params.endsAt / 1000),
      timeDifference: Math.floor(params.endsAt / 1000) - Math.floor(params.startsAt / 1000)
    });
    
    // Use admin public key for PDA derivation (consistent with vote function)
    const ADMIN_PUBKEY = new PublicKey("GHjCZ5SsSWedrFJLyHKU6JM1GoPoFXBdbXfrdFiU4eJS");
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
    console.log("🔄 addContestant: Starting transaction...");
    console.log("📊 Params:", params);
    console.log("📊 Wallet:", this.provider.wallet.publicKey.toString());
    
    try {
      // Use the current payer for PDA derivation (matches smart contract)
      const [pollPda] = PublicKey.findProgramAddressSync(
        [Buffer.from(params.title), this.provider.wallet.publicKey.toBuffer()],
        this.program.programId
      );

      console.log("📊 Poll PDA:", pollPda.toString());
      console.log("📊 Program ID:", this.program.programId.toString());

      const tx = await this.program.methods
        .contest(params.title, params.name, params.image)
        .accounts({
          poll: pollPda,
          payer: this.provider.wallet.publicKey,
        })
        .rpc();

      console.log("✅ addContestant: Transaction successful:", tx);
      return tx;
    } catch (error) {
      console.error("❌ addContestant: Transaction failed:", error);
      console.error("❌ Error message:", error.message);
      console.error("❌ Error code:", error.code);
      console.error("❌ Error logs:", error.logs);
      console.error("❌ Full error object:", error);
      throw error;
    }
  }

  /**
   * Cast a vote for a contestant
   */
  async vote(params: VoteParams): Promise<string> {
    console.log('🗳️ Starting vote transaction for poll:', params.title);

    try {
      // Get the poll data to find the creator (director)
      const pollAccounts = await (this.program.account as any).poll.all();
      console.log('📊 All poll accounts:', pollAccounts.map((p: any) => ({
        address: p.publicKey.toString(),
        title: p.account.title,
        director: p.account.director.toString()
      })));
      
      const pollAccount = pollAccounts.find((p: any) => p.account.title === params.title);
      
      if (!pollAccount) {
        throw new Error(`Poll "${params.title}" not found on blockchain`);
      }
      
      // Use the poll's director (creator) for PDA calculation to match the constraint
      const directorPubkey = pollAccount.account.director;
      console.log('📊 Poll director:', directorPubkey.toString());
      
      const [expectedPda] = PublicKey.findProgramAddressSync(
        [Buffer.from(params.title), directorPubkey.toBuffer()],
        this.program.programId
      );
      
      console.log('📊 Expected PDA:', expectedPda.toString());
      console.log('📊 Actual poll address:', pollAccount.publicKey.toString());
      console.log('📊 Voter:', this.provider.wallet.publicKey.toString());

      const tx = await this.program.methods
        .vote(new BN(params.contestantId))
        .accounts({
          poll: pollAccount.publicKey, // Use the actual poll address that exists
          payer: this.provider.wallet.publicKey,
        })
        .rpc();

      console.log('✅ Vote transaction successful:', tx);
      return tx;
    } catch (error) {
      console.error('❌ Vote transaction failed:', error);
      console.error('❌ Error details:', {
        message: error.message,
        code: error.code,
        logs: error.logs,
      });
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

    return tx;
  }

  /**
   * Finalize a poll
   */
  async finalizePoll(title: string): Promise<string> {
    const [pollPda] = PublicKey.findProgramAddressSync(
      [Buffer.from(title), this.provider.wallet.publicKey.toBuffer()],
      this.program.programId
    );

    const tx = await this.program.methods
      .finalizePoll()
      .accounts({
        poll: pollPda,
        payer: this.provider.wallet.publicKey,
      })
      .rpc();

    return tx;
  }

  /**
   * Delete a poll
   */
  async deletePoll(title: string): Promise<string> {
    const [pollPda] = PublicKey.findProgramAddressSync(
      [Buffer.from(title), this.provider.wallet.publicKey.toBuffer()],
      this.program.programId
    );

    const tx = await this.program.methods
      .deletePoll(title)
      .accounts({
        poll: pollPda,
        payer: this.provider.wallet.publicKey,
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc();

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
      console.error("Error fetching poll:", error);
      return null;
    }
  }

  /**
   * Fetch all polls using Anchor's built-in account fetching
   */
  async getAllPolls(): Promise<Poll[]> {
    try {
      console.log("🔄 getAllPolls: Fetching from blockchain...");
      
      // Use Anchor's built-in account fetching
      const pollAccounts = await (this.program.account as any).poll.all();
      
      console.log(`📊 Found ${pollAccounts.length} poll accounts from blockchain`);
      
      if (pollAccounts.length === 0) {
        return [];
      }
      
      const polls: Poll[] = [];
      
      for (const accountInfo of pollAccounts) {
        try {
          const pollData = accountInfo.account;
          console.log(`📊 Poll "${pollData.title}":`, {
            accountAddress: accountInfo.publicKey.toString(),
            director: pollData.director.toString(),
            contestantsCount: pollData.contestants?.length || 0,
            contestants: pollData.contestants
          });
          
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
          
          console.log(`✅ Processed poll "${processedPoll.title}":`, {
            id: processedPoll.id,
            contestantsCount: processedPoll.contestants.length,
            contestants: processedPoll.contestants
          });
          
          polls.push(processedPoll);
        } catch (error) {
          console.error("Error processing poll account:", accountInfo.publicKey.toString(), error);
        }
      }
      
      console.log(`✅ getAllPolls: Returning ${polls.length} polls from blockchain`);
      polls.forEach((poll, index) => {
        console.log(`📊 Final Poll ${index + 1} "${poll.title}":`, {
          id: poll.id,
          contestantsCount: poll.contestants?.length || 0,
          contestants: poll.contestants
        });
      });
      
      return polls;
      
    } catch (error) {
      console.error("Error fetching all polls:", error);
      return [];
    }
  }
}
// Force refresh Fri Oct 17 02:54:36 PM +0545 2025
