// Frontend TypeScript interfaces based on the IDL
// This file contains the interfaces needed for the frontend application

export interface Contestant {
  id: number;
  image: string;
  name: string;
  voter: string; // PublicKey as string
  votes: number;
  voters: string[]; // Array of PublicKeys as strings
}

export interface Poll {
  id: number;
  image: string;
  title: string;
  description: string;
  votes: number;
  voters: string[]; // Array of PublicKeys as strings
  deleted: boolean;
  director: string; // PublicKey as string
  startsAt: number; // Timestamp in milliseconds
  endsAt: number; // Timestamp in milliseconds
  timestamp: number; // Timestamp in milliseconds
  contestants: Contestant[];
  finalized: boolean;
  winner?: number; // Optional winner contestant ID
}

// Parameter interfaces for service methods
export interface CreatePollParams {
  title: string;
  image: string;
  description: string;
  startsAt: number; // Timestamp in milliseconds
  endsAt: number; // Timestamp in milliseconds
}

export interface VoteParams {
  title: string;
  contestantId: number;
}

export interface ContestantParams {
  title: string;
  name: string;
  image: string;
}

export interface UpdatePollParams {
  title: string;
  image: string;
  description: string;
  startsAt: number; // Timestamp in milliseconds
  endsAt: number; // Timestamp in milliseconds
}

// Error types from the IDL
export enum VotingError {
  Unauthorized = 6000,
  PollNotStarted = 6001,
  PollEnded = 6002,
  AlreadyVoted = 6003,
  InvalidContestant = 6004,
  PollAlreadyStarted = 6005,
  InvalidTimeRange = 6006,
  CannotDeleteWithVotes = 6007,
  DuplicateContestantName = 6008,
  InvalidAdminPubkey = 6009,
  PollStillActive = 6010,
  AlreadyFinalized = 6011,
  StringTooLong = 6012,
  EmptyString = 6013,
  TooManyContestants = 6014,
  NoContestants = 6015,
}
