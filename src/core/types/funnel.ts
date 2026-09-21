export type ComponentType =
  | 'alert' | 'arguments' | 'audio' | 'button' | 'card' | 'carousel'
  | 'cartesian' | 'compare' | 'confetti' | 'countdown' | 'coupon' | 'divider'
  | 'email' | 'faq' | 'form' | 'gate' | 'guarantee' | 'headline' | 'hero'
  | 'iframe' | 'image' | 'input' | 'level' | 'list' | 'loading' | 'logo' | 'marquee'
  | 'menu' | 'pix' | 'price' | 'progress' | 'question' | 'result' | 'reviews'
  | 'social_proof' | 'stats' | 'terms' | 'text' | 'video' | 'whatsapp';

export type LeadStatus = 'visitor' | 'lead' | 'qualified' | 'completed';

export interface FunnelComponent {
  id: string;
  type: ComponentType;
  order: number;
  props: Record<string, any>;
}

export interface FunnelStep {
  id: string;
  title: string;
  order: number;
  components: FunnelComponent[];
  position: { x: number; y: number };
  loadingScreen?: Partial<FunnelLoadingScreen>;
  showLogo?: boolean;
  showProgress?: boolean;
  allowBack?: boolean;
  stickyButton?: boolean;
  stickyButtonLabel?: string;
}

export interface FunnelLoadingScreen {
  enabled: boolean;
  duration: number;
  color: string;
  targetPercent: number;
  showText: boolean;
  text: string;
  mediaType: 'none' | 'emoji' | 'image';
  mediaValue: string;
}

export interface FlowEdgeCondition {
  questionId: string;
  operator: 'equals' | 'contains' | 'gt' | 'lt' | 'score_range';
  value: string;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  label?: string;
  condition?: FlowEdgeCondition;
  isFallback?: boolean;
}

export interface FunnelDesign {
  general: {
    maxWidth: number;
    spacing: number;
    borderRadius: number;
    showProgress?: boolean;
  };
  header: {
    logoUrl: string;
    bgColor: string;
    showHeader: boolean;
  };
  colors: {
    primary: string;
    secondary: string;
    background: string;
    text: string;
    input?: Record<string, string>;
    button?: Record<string, Record<string, string>>;
    hover?: Record<string, string>;
    checkbox?: Record<string, string>;
  };
  typography: {
    headingFont: string;
    bodyFont: string;
    headingWeight: number;
    bodyWeight: number;
  };
  animation: {
    type: 'none' | 'fade' | 'slide' | 'scale';
    speed: number;
    direction: 'up' | 'down' | 'left' | 'right';
  };
  loadingScreen: FunnelLoadingScreen;
}

export type PixelPlatformId = 'facebook_ads' | 'tiktok_ads' | 'google_ads';

export interface FunnelSettings {
  customDomain?: string;
  customDomainId?: string;
  seo: {
    title: string;
    description: string;
    ogImage: string;
    favicon: string;
  };
  /** Ids from list_tokens (one per platform); the page resolves them to pixel ids server-side. */
  pixelTokenIds?: Partial<Record<PixelPlatformId, string>>;
  scripts?: {
    head?: string;
    body?: string;
    footer?: string;
  };
  /** Ids from list_webhooks; each receives quiz.completed. */
  webhookIds?: string[];
  clarity?: { projectId?: string };
  postPurchaseUrl?: string;
}

/** A partial update: every nested object is merged into the stored one by the service. */
export type DeepPartial<T> = T extends (infer U)[]
  ? U[]
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

export interface ScoreRange {
  id: string;
  label: string;
  minScore: number;
  maxScore: number;
}

export interface FunnelScoring {
  enabled: boolean;
  ranges: ScoreRange[];
}

export interface Funnel {
  id: string;
  businessId: string;
  title: string;
  slug: string;
  published: boolean;
  deleted: boolean;
  usesBillingGateway?: boolean;
  steps: FunnelStep[];
  flow: { edges: FlowEdge[] };
  design: FunnelDesign;
  settings: FunnelSettings;
  scoring?: FunnelScoring;
  createdAt: string;
  updatedAt: string;
}

export interface LeadResponse {
  questionId: string;
  componentId: string;
  answer: string;
}

export interface FunnelLead {
  id: string;
  funnelId: string;
  businessId: string;
  name?: string;
  email?: string;
  phone?: string;
  cpf?: string;
  responses: LeadResponse[];
  stepsCompleted: string[];
  currentStep: string;
  status: LeadStatus;
  totalScore?: number;
  source?: string;
  ip?: string;
  userAgent?: string;
  startedAt: string;
  completedAt?: string;
  createdAt: string;
}

export interface CreateFunnelInput {
  title: string;
  slug?: string;
}

export interface UpdateFunnelInput {
  title?: string;
  slug?: string;
  published?: boolean;
  steps?: FunnelStep[];
  flow?: { edges: FlowEdge[] };
  design?: DeepPartial<FunnelDesign>;
  settings?: DeepPartial<FunnelSettings>;
  scoring?: FunnelScoring;
}

export interface FunnelCheckoutSummary {
  uid: string;
  title: string;
  price: number;
  currency: string;
  checkoutModel: string;
  image: string;
  orderBumps: Array<{ id: string; title: string; price: number; image: string }>;
  paymentMethods: Record<string, unknown> | null;
}

export interface FunnelCheckoutOptions {
  checkouts: FunnelCheckoutSummary[];
  gateways: Array<Record<string, unknown>>;
}

export interface FunnelLeadStats {
  visitors: number;
  leads: number;
  interactionRate: number;
  qualified: number;
  completed: number;
}

export interface FunnelStepAnalytics {
  stepId: string;
  visitors: number;
  exits: number;
  dropOffRate: number;
}

export interface FunnelAnalytics {
  steps: FunnelStepAnalytics[];
  totalVisitors: number;
  totalCompleted: number;
  overallConversionRate: number;
}
