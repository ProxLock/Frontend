export interface Project {
  id?: string;
  name?: string;
  description: string;
  keys?: unknown[];
}

export interface UserAccessKey {
  id: string;
  name: string;
  key?: string;
  displayPrefix?: string;
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
  subscriptionStatus?: string;
  isPayingCustomer?: boolean;
}
