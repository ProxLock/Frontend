export interface Project {
  id?: string;
  name?: string;
  description: string;
  keys?: unknown[];
}

export interface UserAccessKey {
  key: string;
  name: string;
}

export interface WebSocketUsage {
  connectionCount: number;
  connectionSeconds: number;
  connectionSecondLimit: number;
  messageCount: number;
  messageUnits: number;
  messageUnitLimit: number;
  bytesClientToUpstream: number;
  bytesUpstreamToClient: number;
}

export interface User {
  id?: string;
  primaryEmailAddress?: {
    emailAddress: string;
  };
  fullName?: string;
  projectLimit?: number;
  apiKeyLimit?: number;
  requestLimit?: number;
  currentRequestUsage?: number;
  currentWebSocketUsage?: WebSocketUsage;
  subscriptionStatus?: string;
  isPayingCustomer?: boolean;
  lastAcceptedTOS?: number;
}
