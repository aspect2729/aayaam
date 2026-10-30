export type BusinessId = "shakti" | "mitti" | "aangan";

export type BusinessType = "gym" | "handicraft" | "interior";

export type ChipTone = "blue" | "sand" | "lavender" | "mint" | "rose";

export type NavKey =
  | "brain"
  | "sales"
  | "customers"
  | "marketing"
  | "commerce"
  | "finance"
  | "operations"
  | "agents"
  | "integrations"
  | "settings";

export type Kpi = {
  id: string;
  label: string;
  value: string;
  delta?: string;
  direction?: "up" | "down";
  attention?: boolean;
};

export type Insight = {
  id: string;
  title: string;
  investigation: string[];
  actions: string[];
};

export type LeadSource = "Website" | "WhatsApp" | "Google" | "Walk-in" | "Meta ad";

export type LeadStage = "new" | "qualified" | "visit" | "quotation" | "won" | "lost";

export type TimelineItem = {
  at: string;
  from: "lead" | "team" | "brain";
  text: string;
};

export type Lead = {
  id: string;
  name: string;
  source: LeadSource;
  score: number;
  budget: string;
  location: string;
  lastContact: string;
  stage: LeadStage;
  phone: string;
  requirements: string;
  duplicate?: boolean;
  aiQualified?: boolean;
  neverContacted?: boolean;
  timeline: TimelineItem[];
  draft: string;
};

export type FollowUp = {
  id: string;
  leadId: string;
  name: string;
  reason: string;
  due: string;
  channel: string;
};

export type FunnelPoint = { stage: string; value: number };
export type SourcePoint = { source: string; rate: number };
export type Leader = { name: string; initials: string; deals: string; revenue: string };

export type CustomerSegment = "New" | "Active" | "Inactive" | "Renewal due" | "High value";

export type Customer = {
  id: string;
  name: string;
  segment: CustomerSegment;
  phone: string;
  city: string;
  value: string;
  lastSeen: string;
  consent: "Opted in" | "Pending" | "Opted out";
  messages: { from: "them" | "us"; text: string; time: string }[];
  history: { label: string; date: string; amount: string }[];
};

export type Journey = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  template: string;
};

export type RankingKeyword = {
  keyword: string;
  position: number;
  change: number;
  volume: string;
};

export type ChecklistItem = { id: string; label: string; done: boolean };

export type SeoImprovement = {
  id: string;
  page: string;
  issue: string;
  beforeTitle: string;
  afterTitle: string;
  beforeDescription: string;
  afterDescription: string;
};

export type SearchPoint = { date: string; clicks: number; impressions: number };

export type Review = {
  id: string;
  author: string;
  rating: number;
  text: string;
  date: string;
  reply: string;
  negative?: boolean;
};

export type AeoQuestion = {
  question: string;
  mentioned: boolean;
  suggestion: string;
};

export type ContentPost = {
  network: "Instagram" | "Facebook" | "LinkedIn" | "X";
  caption: string;
};

export type WeekEvent = {
  id: string;
  title: string;
  day: number;
  time: string;
  tone: ChipTone;
};

export type CampaignCreative = { name: string; note: string };

export type AdCampaign = {
  name: string;
  spend: string;
  reach: string;
  leads: number;
  cpl: string;
  cpp: string;
  roi: string;
};

export type AdKpis = {
  spend: string;
  reach: string;
  leads: string;
  cpl: string;
  cpp: string;
  roi: string;
};

export type Product = {
  id: string;
  name: string;
  category: string;
  price: string;
  stock: number;
  revenue: string;
  marginLabel: string;
  marginTone: ChipTone;
  costMissing?: boolean;
};

export type OrderStatus = "Paid" | "Packed" | "Shipped" | "Delivered" | "Returned";

export type Order = {
  id: string;
  customer: string;
  items: string;
  total: string;
  status: OrderStatus;
  channel: "Razorpay" | "Shiprocket" | "Counter";
  date: string;
};

export type StockPoint = { name: string; stock: number; forecast: number };

export type Supplier = {
  id: string;
  name: string;
  category: string;
  city: string;
  leadTime: string;
  note: string;
};

export type ReturnItem = {
  id: string;
  orderId: string;
  customer: string;
  item: string;
  reason: string;
  status: string;
};

export type CommerceInsight = {
  id: string;
  title: string;
  detail: string;
  action: string;
};

export type MonthPoint = { month: string; revenue: number; expenses: number };
export type ExpenseSlice = { name: string; value: number };

export type ProfitRow = {
  name: string;
  revenue: number;
  cost: number | null;
};

export type FinanceStory = {
  title: string;
  why: string[];
  next: string[];
};

export type DayEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  tone: ChipTone;
  detail?: string;
};

export type TaskItem = {
  id: string;
  title: string;
  assignee: string;
  initials: string;
  due: string;
  priority: "High" | "Medium" | "Low";
  fromBrain?: boolean;
};

export type Workflow = {
  id: string;
  name: string;
  detail: string;
  enabled: boolean;
};

export type AgentStatus = "done" | "pending" | "running" | "failed";

export type AgentRun = {
  id: string;
  agent: string;
  task: string;
  status: AgentStatus;
  time: string;
  input: string;
  reasoning: string;
  action: string;
  result: string;
};

export type ApprovalItem = {
  id: string;
  title: string;
  meta: string;
};

export type BrainAnswer = {
  match: string;
  changed: string[];
  why: string[];
  actions: string[];
};

export type BusinessProfile = {
  id: BusinessId;
  name: string;
  city: string;
  type: BusinessType;
  typeLabel: string;
  emphasis: NavKey;
  emphasisLabel: string;
  summary: string;
  kpis: Kpi[];
  insights: Insight[];
  cycleFocus: number;
  visitLabel: string;
  recoveryCount: number;
  leads: Lead[];
  followUps: FollowUp[];
  funnel: FunnelPoint[];
  sources: SourcePoint[];
  leaders: Leader[];
  customers: Customer[];
  journeys: Journey[];
  seoScore: number;
  gbp: ChecklistItem[];
  rankings: RankingKeyword[];
  searchSeries: SearchPoint[];
  seoFixes: SeoImprovement[];
  reviews: Review[];
  aeo: AeoQuestion[];
  posts: ContentPost[];
  week: WeekEvent[];
  campaignDefaults: { goal: string; budget: string; location: string };
  audience: string;
  adCopies: string[];
  creatives: CampaignCreative[];
  contentSeed: string;
  adKpis: AdKpis;
  adCampaigns: AdCampaign[];
  products: Product[];
  orders: Order[];
  stock: StockPoint[];
  lowStock: { name: string; left: string; reorder: boolean }[];
  suppliers: Supplier[];
  returns: ReturnItem[];
  commerceInsights: CommerceInsight[];
  financeKpis: Kpi[];
  months: MonthPoint[];
  expenses: ExpenseSlice[];
  profitRows: ProfitRow[];
  financeStory: FinanceStory;
  cashNote: string;
  events: DayEvent[];
  tasks: TaskItem[];
  workflows: Workflow[];
  agents: AgentRun[];
  approvals: ApprovalItem[];
  connectedIntegrations: string[];
  brainAnswers: BrainAnswer[];
};

export type IntegrationDef = {
  id: string;
  name: string;
  description: string;
  mark: string;
  tone: ChipTone;
  special?: "approval" | "later";
};

export type OnboardingTool = {
  id: string;
  name: string;
  detail: string;
  mark: string;
  tone: ChipTone;
};
