
export enum PlanType {
  START = 'START',
  PRO = 'PRO',
  ELITE = 'ELITE'
}

export type BillingCycle = 'MONTHLY' | 'ANNUAL';

export enum AppointmentStatus {
  NOVO = 'NOVO',
  CONFIRMADO = 'CONFIRMADO',
  EM_EXECUCAO = 'EM_EXECUCAO',
  FINALIZADO = 'FINALIZADO',
  CANCELADO = 'CANCELADO'
}

export enum ServiceType {
  LAVAGEM_SIMPLES = 'Lavagem Simples',
  LAVAGEM_DETALHADA = 'Lavagem Detalhada',
  POLIMENTO = 'Polimento',
  HIGIENIZACAO = 'Higienização Interna',
  VITRIFICACAO = 'Vitrificação'
}

export type VehicleType = 'CARRO' | 'SUV' | 'MOTO' | 'UTILITARIO';

export interface ServiceBay {
  id: string;
  name: string;
  business_id: string;
  is_active: boolean;
}

export interface ServiceItem {
  id: string;
  name: string;
  description: string;
  duration_minutes: number;
  price: number;
  compatible_vehicles?: VehicleType[];
  is_active: boolean;
  business_id?: string;
  image_url?: string;
}

export interface OperatingRule {
  dayOfWeek: number;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
  reason?: string;
}

export interface BlockedDate {
  date: string; // YYYY-MM-DD
  reason: string;
}

export interface BusinessSettings {
  id?: string;
  // Added user_id to BusinessSettings to fix property missing errors
  user_id?: string;
  business_name: string;
  slug: string;
  address?: string;
  whatsapp?: string;
  box_capacity: number;
  patio_capacity: number;
  daily_booking_limit?: number;
  time_buffer_minutes?: number;
  blocked_dates?: BlockedDate[];
  timezone?: string;
  slot_interval_minutes: number;
  operating_days?: OperatingRule[];
  online_booking_enabled: boolean;
  cnpj?: string;
  profile_image_url?: string;
  loyalty_program_enabled: boolean;
  trial_start_date?: string;
  subscription_status?: 'TRIAL' | 'ACTIVE' | 'EXPIRED';
  plan_type?: PlanType;
  billing_cycle?: BillingCycle;
  created_at?: string;
  configs?: any; // Suporte para coluna JSONB
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  totalSpent: number;
  lastVisit: string;
  vehicles: Vehicle[];
  status?: 'ATIVO' | 'INATIVO' | 'NOVO';
  xpPoints?: number;
  washes?: number;
}

export interface Vehicle {
  id: string;
  brand: string;
  model: string;
  plate: string;
  color: string;
  type: VehicleType;
}

export interface Appointment {
  id: string;
  customerId: string;
  vehicleId: string;
  boxId?: string; 
  serviceId?: string;
  serviceType: string;
  date: string;
  time: string;
  durationMinutes: number;
  price: number;
  status: AppointmentStatus;
  staffName?: string;
  cancellationReason?: string;
  observation?: string;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  date: string;
  category: string;
  type: 'RECEITA' | 'DESPESA';
  payment_method?: 'DINHEIRO' | 'PIX' | 'CREDITO' | 'DEBITO' | 'BOLETO';
  business_id?: string;
}

export interface FinancialMetric {
  label: string;
  value: number;
  trend: number;
}

export interface Review {
  id: string;
  appointmentId?: string;
  customerName: string;
  rating: number;
  comment: string;
  date: string;
  reply?: string;
}

export interface PortfolioItem {
  id: string;
  imageUrl: string;
  description: string;
  date: string;
  category?: string;
}

export interface CarbonInsight {
  id: string;
  problem: string;
  impact: string;
  action: string;
  type: 'CRITICAL' | 'WARNING' | 'OPPORTUNITY';
}
