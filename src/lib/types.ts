export type AccessAction = "open" | "close" | "unknown";

export type Settings = {
  twsHost: string;
  twsUser: string;
  twsPass: string;
  twsOrgToken: string;
  twsUserToken: string;
  twsMembershipId: string;
  lockId: string;
  accessHistoryPath: string;
  lockStatusPath: string;
  signInPath: string;
  extraHeadersJson: string;
  publicAppUrl: string;
  webhookToken: string;
  maxUsers: number;
  windowMinutes: number;
  alertOnDaily: boolean;
  timezone: string;
};

export type AccessEvent = {
  id: number;
  source: "webhook" | "api";
  lockId: string | null;
  lockName: string | null;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  action: AccessAction;
  occurredAt: string;
  rawJson: string;
  createdAt: string;
  externalId: string | null;
};

export type AlertRow = {
  id: number;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  kind: "burst" | "daily";
  openCount: number;
  windowMinutes: number;
  threshold: number;
  message: string;
  occurredAt: string;
  acknowledgedAt: string | null;
  createdAt: string;
};

export type WebhookLog = {
  id: number;
  receivedAt: string;
  method: string;
  headers: string;
  body: string;
  parsedOk: boolean;
  note: string | null;
};

export type UserDayStat = {
  userKey: string;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  openCount: number;
  lastOpenAt: string | null;
};

export type ParsedLockEvent = {
  lockId: string | null;
  lockName: string | null;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  action: AccessAction;
  occurredAt: string;
  externalId: string | null;
  open: boolean | null;
};
