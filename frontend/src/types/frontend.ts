export type RiskDecision = 'APPROVED' | 'STEP_UP' | 'BLOCKED';

export type UserRole = 'sender' | 'analyst' | 'admin';

export interface UserPersona {
  role: UserRole;
  name: string;
  email: string;
  organization: string;
  title: string;
  description: string;
}

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  organization: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'active' | 'disabled';
  anonymousId?: string;
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TelecomSignals {
  simSwap24h: boolean;
  numberVerified: boolean;
  deviceStatus: 'TRUSTED' | 'SUSPICIOUS' | 'UNKNOWN' | string;
  simSwapVerificationStatus?: string;
  numberVerificationStatus?: string;
  simSwapProvider?: string;
  simSwapMode?: 'mock' | 'sandbox' | 'live' | string;
}

export interface SelectedRoute {
  routeId: string;
  routeName: string;
  hops: string[];
  providerNames?: string[];
  estimatedCost: number;
  estimatedLatencyMs: number;
  reliability?: number;
  compositeWeight?: number;
  algorithm?: string;
  explanation?: string;
  alternatives?: Array<{
    hops: string[];
    providerNames?: string[];
    totalCost: number;
    totalLatencyMs: number;
    cumulativeReliability: number;
    compositeWeight: number;
  }>;
}

export interface TransactionRecord {
  _id: string;
  transactionId: string;
  amount: number;
  currency: string;
  sourceCountry: string;
  destinationCountry: string;
  riskScore: number;
  riskDecision: RiskDecision;
  signals: TelecomSignals;
  riskFactors?: {
    simSwapWithin24h?: boolean;
    velocityPerHour?: number;
    [key: string]: any;
  };
  contributingFactors?: string[];
  recommendedAction?: string;
  selectedRoute: SelectedRoute | null;
  status: string;
  senderId?: string;
  senderEmail?: string;
  senderName?: string;
  recipientName?: string;
  retryOfTransactionId?: string;
  telecomVerification?: {
    mode: 'MOCK' | 'SANDBOX' | 'LIVE' | string;
    isSimulated: boolean;
    provider: string;
    status: string;
    checkedAt: string;
    msisdnMasked: string;
    phoneNumberMasked: string;
    latencyMs: number;
    simSwap: {
      swappedWithin24h: boolean;
      status?: string;
      details?: string;
      lastSwapAt: string | null;
    };
    numberVerification: {
      verified: boolean;
      status?: string;
      details?: string;
    };
    deviceIntegrity: {
      status: string;
    };
    details?: string;
  };
  reviewStatus?:
    | 'PENDING_REVIEW'
    | 'PENDING_ADMIN_REVIEW'
    | 'VERIFIED_APPROVED'
    | 'ESCALATED'
    | 'BLOCKED'
    | 'UNDER_REVIEW'
    | 'RESOLVED'
    | 'REJECTED'
    | 'DISMISSED'
    | 'APPROVED'
    | string;
  transferredToAdmin?: boolean;
  transferredBy?: string;
  transferredAt?: string;
  transferNotes?: string;
  reviewedBy?: string;
  reviewerName?: string;
  reviewNotes?: string;
  reviewedAt?: string;
  timestamp?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderNode {
  id: string;
  name: string;
  type: 'GATEWAY' | 'BANK' | 'CLEARING' | 'CORRIDOR' | 'DESTINATION_BANK';
  country: string;
  currency: string;
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
  isAvailable: boolean;
}

export interface ProviderEdge {
  source: string;
  target: string;
  baseCost: number;
  latencyMs: number;
  reliability: number;
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
  isAvailable: boolean;
  prohibited: boolean;
}

export interface NetworkData {
  success?: boolean;
  count: {
    nodes: number;
    edges: number;
    activeEdges: number;
    prohibitedEdges: number;
  };
  nodes: ProviderNode[];
  edges: ProviderEdge[];
}

export interface AnalyticsSummary {
  total: number;
  approved: number;
  stepUp: number;
  blocked: number;
  approvalRate: number;
  blockedRate: number;
  stepUpRate: number;
  volumeByCurrency: Array<{
    currency: string;
    totalVolume: number;
    transactionCount: number;
    avgAmount: number;
  }>;
}

export interface SimulationResult {
  total: number;
  fraudCount: number;
  legitimateCount: number;
  durationMs: number;
  averageLatencyMs: number;
  confusionMatrix: {
    blocked: {
      fraud: number;
      legitimate: number;
      total: number;
    };
    stepUp: {
      fraud: number;
      legitimate: number;
      total: number;
    };
    approved: {
      fraud: number;
      legitimate: number;
      total: number;
    };
    totals: {
      fraud: number;
      legitimate: number;
      total: number;
    };
  };
  metrics: {
    accuracy: number;
    detectionRate: number;
    precision: number;
    specificity: number;
    f1Score: number;
    falsePositiveRate: number;
    blockedCount: number;
    stepUpCount: number;
    approvedCount: number;
  };
  sampleCases: Array<{
    scenario: string;
    groundTruth: 'FRAUDULENT' | 'LEGITIMATE';
    predictedDecision: string;
    riskScore: number;
    signals: Record<string, unknown>;
  }>;
  executedAt: string;
}

export interface AuditLogRecord {
  _id: string;
  id?: string;
  timestamp: string;
  actorEmail: string;
  actorName: string;
  actorRole: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  targetType?: string;
  targetId?: string;
  outcome: 'SUCCESS' | 'FAILURE' | 'BLOCKED';
  details?: Record<string, unknown>;
  ipAddress?: string;
}

export interface SystemHealthData {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  databases: {
    mongodb: {
      status: 'healthy' | 'unhealthy';
      latencyMs?: number;
      error?: string;
    };
    neo4j: {
      status: 'healthy' | 'unhealthy';
      database?: string;
      latencyMs?: number;
      error?: string;
    };
  };
  telecomGateway?: {
    mode: 'mock' | 'sandbox' | 'live' | string;
    isSimulated: boolean;
    provider: string;
    status?: string;
    connectivity?: 'HEALTHY' | 'DEGRADED' | 'UNCONFIGURED' | 'ERROR';
    baseUrl?: string;
    authUrl?: string;
    hasClientId?: boolean;
    hasClientSecret?: boolean;
    hasApiKey?: boolean;
    configuredScope?: string;
    latencyMs?: number;
    message?: string;
    recentFailuresCount?: number;
    recentEvents?: Array<any>;
  };
}

export interface UserPersonaProfile {
  id?: string;
  userId: string; // Persistent Anonymous ID (e.g. USR-1001)
  role: 'sender' | 'analyst' | 'admin';
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  loginCount: number;
  lastLoginTime: string;
  accountCreatedAt: string;
  totalTransactions: number;
  approvedTransactions: number;
  blockedTransactions: number;
  stepUpTransactions: number;
  totalVolume: number;
  averageAmount: number;
  averageRiskScore: number;
  suspiciousActivityCount: number;
  riskScoreHistory: Array<{
    score: number;
    decision: string;
    date: string;
  }>;
  recentActivity: Array<{
    transactionId: string;
    amount: number;
    currency: string;
    riskScore: number;
    riskDecision: string;
    createdAt: string;
  }>;
}

export interface UserPersonaAnalyticsResponse {
  success: boolean;
  summary: {
    totalTrackedPersonas: number;
    activePersonas: number;
    suspendedPersonas: number;
    totalTransactionsAnalyzed: number;
  };
  personas: UserPersonaProfile[];
  aggregations: {
    mostActiveUsers: UserPersonaProfile[];
    repeatedBlockedUsers: UserPersonaProfile[];
    accountStatusDistribution: {
      ACTIVE: number;
      INACTIVE: number;
      SUSPENDED: number;
    };
    riskDistribution: {
      low: number;
      medium: number;
      high: number;
    };
  };
}

