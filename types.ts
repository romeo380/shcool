export const DEFAULT_USER_IMAGE = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iIzljYTNhZiI+PHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBkPSJNMTguNjg1IDE5LjA5N0E5LjcyMyA5LjcyMyAwIDAgMCAyMS43NSAxMmMyLTUuMzg1LTQuMzY1LTkuNzUtOS43NS05Ljc1UzIuMjUgNi42MTUgMi4yNSAxMmE5LjcyMyA5LjcyMyAwIDAgMCAzLjA2NSA3LjA5N0E5LjcxNiA5LjcxNiAwIDAgMCAxMiAyMS43NWE5LjcxNiA5LjcxNiAwIDAgMCA2LjY4NS0yLjY1M1ptLTEyLjU0LTEuMjg1QTcuNDg2IDcuNDg2IDAgMCAxIDEyIDE1YTcuNDg2IDcuNDg2IDAgMCAxIDUuODU1IDIuODEyQTguMjI0IDguMjI0IDAgMCAxIDEyIDIwLjI1YTguMjI4IDguMjI4IDAgMCAxLTUuODU1LTIuNDM4Wk0xNSA5YTMuNzUgMy43NSAwIDEgMS03LjUgMCAzLjc1IDMuNzUgMCAwIDEgNy41IDBaIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIC8+PC9zdmc+';

export interface Position {
  id: number;
  name: string;
  maxVotes?: number;
  type: 'GENERAL' | 'CLASS_SPECIFIC';
  associatedClass: string | null;
}

export interface Candidate {
  id: number;
  name: string;
  positionId: number;
  imageUrl: string;
  mobile: string;
  dob: string;
  manifesto: string;
}

export interface Voter {
  id: string;
  name: string;
  class: string;
  rollNo: string;
  password: string;
  hasVoted: boolean;
  imageUrl: string;
  isBlocked: boolean;
}

export interface Vote {
  // FIX: Add voterId to associate vote with a voter.
  voterId: string;
  candidateId: number;
  positionId: number;
  timestamp: number;
}

export interface ElectionDetails {
  name: string;
  description: string;
  endTime: number | null;
}

export type ElectionStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'ENDED';

export interface Workspace {
  id: string;
  name: string;
}

export type AuditLogAction =
  | 'ELECTION_START' | 'ELECTION_END' | 'ELECTION_RESET' | 'ELECTION_UPDATED'
  | 'RESULTS_PUBLISHED' | 'RESULTS_HIDDEN'
  | 'VOTE_CAST'
  | 'VOTER_CREATED' | 'VOTER_UPDATED' | 'VOTER_DELETED' | 'VOTER_IMPORTED' | 'VOTER_BLOCKED' | 'VOTER_UNBLOCKED' | 'VOTER_VOTE_RESET'
  | 'CANDIDATE_CREATED' | 'CANDIDATE_UPDATED' | 'CANDIDATE_DELETED' | 'CANDIDATE_IMPORTED'
  | 'POSITION_CREATED' | 'POSITION_UPDATED' | 'POSITION_DELETED'
  | 'ADMIN_LOGIN' | 'VOTER_LOGIN_SUCCESS' | 'VOTER_LOGIN_FAIL' | 'ADMIN_PROFILE_UPDATED'
  | 'WORKSPACE_CREATED' | 'WORKSPACE_DELETED' | 'SA_PROFILE_UPDATED';

export interface AuditLogEntry {
  id: string;
  timestamp: number;
  actor: { id: string; name: string; role: 'Voter' | 'Admin' | 'Super Admin' | 'System' };
  action: AuditLogAction;
  details: string;
}

export interface AdminProfile {
    id: string;
    name: string;
    password: string;
    imageUrl: string;
    contact: string;
}

// --- Data Structures for Unified State ---
export interface WorkspaceData {
  positions: Position[];
  candidates: Candidate[];
  voters: Voter[];
  votes: Vote[];
  electionStatus: ElectionStatus;
  electionDetails: ElectionDetails;
  adminProfile: AdminProfile | null;
  auditLog: AuditLogEntry[];
  resultsPublished: boolean;
}

export interface FullAppState {
  workspaces: Workspace[];
  superAdminProfile: AdminProfile;
  workspaceData: Record<string, WorkspaceData>;
  theme: 'light' | 'dark';
  lastWorkspaceId: string | null;
  lastBackupTimestamp: number | null;
}
