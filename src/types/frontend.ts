export type RiskDecision = 'APPROVED' | 'STEP_UP' | 'BLOCKED';

export interface TelecomSignals {
  simSwap24h: boolean;
  numberVerified: boolean;
  deviceStatus: 'TRUSTED' | 'SUSPICIOUS' | 'UNKNOWN' | string;
}

export interface SelectedRoute {
  routeId: string;
  routeName: string;
  hops: string[];
  providerNames?: string[];
  estimatedCost: number;
  estimatedLatencyMs: number;
  reliability?: number;
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
  contributingFactors?: string[];
  recommendedAction?: string;
  selectedRoute: SelectedRoute | null;
  status: string;
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
}

