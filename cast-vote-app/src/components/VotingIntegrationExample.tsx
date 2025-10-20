import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useConnection } from '@solana/wallet-adapter-react';
import { VotingService } from '../services/votingService';
import { Poll, CreatePollParams } from '../types/frontend';

export const VotingIntegrationExample: React.FC = () => {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [votingService, setVotingService] = useState<VotingService | null>(null);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(false);

  // Initialize VotingService when wallet or connection changes
  useEffect(() => {
    if (connection) {
      const service = new VotingService(connection, wallet);
      setVotingService(service);
      console.log('✅ VotingService initialized with IDL integration');
    }
  }, [connection, wallet]);

  // Fetch all polls
  const fetchPolls = async () => {
    if (!votingService) return;
    
    setLoading(true);
    try {
      const allPolls = await votingService.getAllPolls();
      setPolls(allPolls);
      console.log(`✅ Fetched ${allPolls.length} polls from blockchain`);
    } catch (error) {
      console.error('❌ Error fetching polls:', error);
    } finally {
      setLoading(false);
    }
  };

  // Create a new poll
  const createPoll = async () => {
    if (!votingService || !wallet.publicKey) return;

    const now = Date.now();
    const pollParams: CreatePollParams = {
      title: `Test Poll ${Date.now()}`,
      image: 'https://example.com/image.jpg',
      description: 'This is a test poll created from the frontend',
      startsAt: now + 60000, // Start in 1 minute
      endsAt: now + 7 * 24 * 60 * 60 * 1000, // End in 7 days
    };

    try {
      const tx = await votingService.createPoll(pollParams);
      console.log('✅ Poll created successfully:', tx);
      // Refresh polls after creation
      await fetchPolls();
    } catch (error) {
      console.error('❌ Error creating poll:', error);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Voting DApp - IDL Integration</h1>
      
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-4">Connection Status</h2>
        <div className="space-y-2">
          <p><strong>Wallet:</strong> {wallet.connected ? wallet.publicKey?.toString() : 'Not connected'}</p>
          <p><strong>Connection:</strong> {connection ? 'Connected' : 'Not connected'}</p>
          <p><strong>VotingService:</strong> {votingService ? 'Initialized' : 'Not initialized'}</p>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-4">Actions</h2>
        <div className="space-x-4">
          <button
            onClick={fetchPolls}
            disabled={!votingService || loading}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Fetch Polls'}
          </button>
          
          <button
            onClick={createPoll}
            disabled={!votingService || !wallet.connected}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
          >
            Create Test Poll
          </button>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">Polls ({polls.length})</h2>
        {polls.length === 0 ? (
          <p className="text-gray-500">No polls found. Create one or check your connection.</p>
        ) : (
          <div className="space-y-4">
            {polls.map((poll) => (
              <div key={poll.id} className="border rounded-lg p-4">
                <h3 className="font-semibold text-lg">{poll.title}</h3>
                <p className="text-gray-600">{poll.description}</p>
                <div className="mt-2 text-sm text-gray-500">
                  <p>Votes: {poll.votes}</p>
                  <p>Contestants: {poll.contestants.length}</p>
                  <p>Status: {poll.finalized ? 'Finalized' : 'Active'}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
