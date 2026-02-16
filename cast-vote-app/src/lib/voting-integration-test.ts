// Integration test for VotingService with IDL
import { VotingService } from '../services/votingService';
import { Connection, PublicKey } from '@solana/web3.js';

// Test configuration
const RPC_URL = 'http://localhost:8899'; // Local validator
const PROGRAM_ID = 'GeG51N1M2x4qygt9RT4JLeM895BYMSiSCySbC3SBYXHY';

export async function testVotingServiceIntegration() {
  console.log('🧪 Testing VotingService Integration...');
  
  try {
    // Create connection
    const connection = new Connection(RPC_URL, 'confirmed');
    console.log('✅ Connection created');
    
    // Create service instance (without wallet for read-only operations)
    const votingService = new VotingService(connection, null);
    console.log('✅ VotingService created');
    
    // Test fetching all polls
    const polls = await votingService.getAllPolls();
    console.log(`✅ Fetched ${polls.length} polls`);
    
    // Test fetching a specific poll (if any exist)
    if (polls.length > 0) {
      const firstPoll = polls[0];
      const poll = await votingService.getPoll(firstPoll.title, new PublicKey(firstPoll.director));
      console.log('✅ Fetched specific poll:', poll?.title);
    }
    
    console.log('🎉 All integration tests passed!');
    return true;
  } catch (error) {
    console.error('❌ Integration test failed:', error);
    return false;
  }
}

// Export for use in components
export { VotingService };
export { PROGRAM_ID };
