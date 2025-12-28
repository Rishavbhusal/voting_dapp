import { useState, useEffect, useCallback } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { VotingService } from "@/services/votingService";
import { Poll, CreatePollParams, VoteParams, ContestantParams, UpdatePollParams } from "@/types/frontend";

export const useVotingService = () => {
  const { connection } = useConnection();
  const wallet = useWallet();
  
  const [votingService, setVotingService] = useState<VotingService | null>(null);

  useEffect(() => {
    const service = new VotingService(connection, wallet);
    setVotingService(service);
  }, [connection, wallet]);

  return votingService;
};

export const usePolls = () => {
  const votingService = useVotingService();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPolls = useCallback(async (forceRefresh: boolean = false) => {
    if (!votingService) {
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const pollsData = await votingService.getAllPolls(forceRefresh);
      setPolls(pollsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch polls");
    } finally {
      setLoading(false);
    }
  }, [votingService]);

  useEffect(() => {
    fetchPolls();
  }, [fetchPolls]);

  return { polls, loading, error, refetch: fetchPolls };
};

export const useCreatePoll = () => {
  const votingService = useVotingService();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createPoll = useCallback(async (params: CreatePollParams) => {
    if (!votingService) {
      setError("Wallet not connected");
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const tx = await votingService.createPoll(params);
      return tx;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create poll");
      return null;
    } finally {
      setLoading(false);
    }
  }, [votingService]);

  return { createPoll, loading, error };
};

export const usePoll = (pollId: number) => {
  const votingService = useVotingService();
  const [poll, setPoll] = useState<Poll | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPoll = useCallback(async () => {
    if (!votingService) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const allPolls = await votingService.getAllPolls();
      const pollData = allPolls.find(p => p.id === pollId);
      
      if (pollData) {
        setPoll(pollData);
      } else {
        setPoll(null);
        setError(`Poll with ID ${pollId} not found`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch poll");
    } finally {
      setLoading(false);
    }
  }, [votingService, pollId]);

  useEffect(() => {
    fetchPoll();
  }, [fetchPoll]);

  return { poll, loading, error, refetch: fetchPoll };
};

export const useVote = () => {
  const votingService = useVotingService();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const vote = useCallback(async (params: VoteParams) => {
    if (!votingService) {
      setError("Wallet not connected");
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const tx = await votingService.vote(params);
      return tx;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to vote");
      return null;
    } finally {
      setLoading(false);
    }
  }, [votingService]);

  return { vote, loading, error };
};

export const useAddContestant = () => {
  const votingService = useVotingService();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addContestant = useCallback(async (params: ContestantParams) => {
    if (!votingService) {
      setError("Wallet not connected");
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const tx = await votingService.addContestant(params);
      return tx;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add contestant");
      return null;
    } finally {
      setLoading(false);
    }
  }, [votingService]);

  return { addContestant, loading, error };
};

export const useUpdatePoll = () => {
  const votingService = useVotingService();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updatePoll = useCallback(async (params: UpdatePollParams) => {
    if (!votingService) {
      setError("Wallet not connected");
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const tx = await votingService.updatePoll(params);
      return tx;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update poll");
      return null;
    } finally {
      setLoading(false);
    }
  }, [votingService]);

  return { updatePoll, loading, error };
};

export const useFinalizePoll = () => {
  const votingService = useVotingService();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finalizePoll = useCallback(async (title: string) => {
    console.log("🟡 useFinalizePoll called with title:", title);
    console.log("🟡 votingService:", !!votingService);
    
    if (!votingService) {
      const errMsg = "Wallet not connected";
      console.error("❌", errMsg);
      setError(errMsg);
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      console.log("🟡 Calling votingService.finalizePoll...");
      const tx = await votingService.finalizePoll(title);
      console.log("🟡 finalizePoll returned:", tx);
      return tx;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Failed to finalize poll";
      console.error("❌ useFinalizePoll error:", err);
      console.error("❌ Error message:", errMsg);
      setError(errMsg);
      return null;
    } finally {
      setLoading(false);
    }
  }, [votingService]);

  return { finalizePoll, loading, error };
};

export const useDeletePoll = () => {
  const votingService = useVotingService();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deletePoll = useCallback(async (title: string) => {
    if (!votingService) {
      setError("Wallet not connected");
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const tx = await votingService.deletePoll(title);
      return tx;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete poll");
      return null;
    } finally {
      setLoading(false);
    }
  }, [votingService]);

  return { deletePoll, loading, error };
};
