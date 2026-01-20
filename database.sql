
-- =============================================================================
-- CARBONCAR OS - BANCO DE DADOS DEFINITIVO (POSTGRESQL / SUPABASE)
-- =============================================================================

-- 0. Extensões
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tipos Enumerados (Enums)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_plan') THEN
        CREATE TYPE public.subscription_plan AS ENUM ('START', 'PRO', 'ELITE');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_status') THEN
        CREATE TYPE public.subscription_status AS ENUM ('TRIAL', 'ACTIVE', 'EXPIRED');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointment_status') THEN
        CREATE TYPE public.appointment_status AS ENUM ('NOVO', 'CONFIRMADO', 'EM_EXECUCAO', 'FINALIZADO', 'CANCELADO');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vehicle_type') THEN
        CREATE TYPE public.vehicle_type AS ENUM ('CARRO', 'SUV', 'MOTO', 'UTILITARIO');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_type') THEN
        CREATE TYPE public.transaction_type AS ENUM ('RECEITA', 'DESPESA');
    END IF;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Tabela de Negócios (Tenant Principal)
CREATE TABLE IF NOT EXISTS public.business_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    business_name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    address TEXT,
    whatsapp TEXT,
    box_capacity INTEGER DEFAULT 1,
    patio_capacity INTEGER DEFAULT 5,
    slot_interval_minutes INTEGER DEFAULT 30,
    online_booking_enabled BOOLEAN DEFAULT TRUE,
    loyalty_program_enabled BOOLEAN DEFAULT FALSE,
    profile_image_url TEXT,
    plan_type public.subscription_plan DEFAULT 'START',
    subscription_status public.subscription_status DEFAULT 'TRIAL',
    trial_start_date TIMESTAMPTZ DEFAULT NOW(),
    configs JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabela de Clientes (CRM)
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL, -- Dono do registro
    business_id UUID REFERENCES public.business_settings(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    total_spent NUMERIC DEFAULT 0,
    last_visit DATE,
    xp_points INTEGER DEFAULT 0,
    washes_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabela de Veículos
CREATE TABLE IF NOT EXISTS public.vehicles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
    brand TEXT,
    model TEXT,
    plate TEXT,
    color TEXT,
    type public.vehicle_type DEFAULT 'CARRO',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Tabela de Serviços
CREATE TABLE IF NOT EXISTS public.services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    business_id UUID REFERENCES public.business_settings(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    duration_minutes INTEGER DEFAULT 60,
    price NUMERIC NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Tabela de Agendamentos
CREATE TABLE IF NOT EXISTS public.appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    business_id UUID REFERENCES public.business_settings(id) ON DELETE CASCADE NOT NULL,
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
    vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
    service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
    service_type TEXT,
    date DATE NOT NULL,
    time TIME NOT NULL,
    duration_minutes INTEGER DEFAULT 60,
    price NUMERIC NOT NULL,
    status public.appointment_status DEFAULT 'NOVO',
    observation TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Tabela Financeira
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    business_id UUID REFERENCES public.business_settings(id) ON DELETE CASCADE NOT NULL,
    description TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    date DATE NOT NULL,
    category TEXT,
    type public.transaction_type DEFAULT 'DESPESA',
    payment_method TEXT DEFAULT 'DINHEIRO',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Marketing & Reputação
CREATE TABLE IF NOT EXISTS public.portfolio_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID REFERENCES public.business_settings(id) ON DELETE CASCADE NOT NULL,
    image_url TEXT NOT NULL,
    description TEXT,
    category TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID REFERENCES public.business_settings(id) ON DELETE CASCADE NOT NULL,
    appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
    customer_name TEXT NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    reply TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 9. AUTOMAÇÃO E SEGURANÇA (RLS)
-- =============================================================================

-- Trigger de updated_at
CREATE OR REPLACE FUNCTION handle_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_business_updated BEFORE UPDATE ON business_settings FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER tr_customers_updated BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER tr_services_updated BEFORE UPDATE ON services FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER tr_appointments_updated BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER tr_expenses_updated BEFORE UPDATE ON expenses FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- Habilitar RLS
ALTER TABLE business_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- POLÍTICAS ADMIN (Usuários Autenticados - Donos da Estética)
CREATE POLICY "Admin BS" ON business_settings FOR ALL TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admin Customers" ON customers FOR ALL TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admin Vehicles" ON vehicles FOR ALL TO authenticated USING (
    customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid())
);
CREATE POLICY "Admin Services" ON services FOR ALL TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admin Appointments" ON appointments FOR ALL TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admin Expenses" ON expenses FOR ALL TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admin Portfolio" ON portfolio_items FOR ALL TO authenticated USING (
    business_id IN (SELECT id FROM business_settings WHERE user_id = auth.uid())
);
CREATE POLICY "Admin Reviews" ON reviews FOR ALL TO authenticated USING (
    business_id IN (SELECT id FROM business_settings WHERE user_id = auth.uid())
);

-- POLÍTICAS PÚBLICAS (Usuários Anônimos - Booking)
CREATE POLICY "Public View Business" ON business_settings FOR SELECT TO anon USING (true);
CREATE POLICY "Public View Services" ON services FOR SELECT TO anon USING (is_active = true);
CREATE POLICY "Public View Slots" ON appointments FOR SELECT TO anon USING (true);
CREATE POLICY "Public Insert Appointment" ON appointments FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Public Insert Customer" ON customers FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Public Insert Vehicle" ON vehicles FOR INSERT TO anon WITH CHECK (true);

-- NOVA POLÍTICA (CRÍTICA): Permitir que clientes autenticados vejam os dados do Hangar (Business Settings)
-- Isso corrige o problema onde um cliente logado não conseguia carregar o Hangar
CREATE POLICY "Authenticated View Business" ON business_settings FOR SELECT TO authenticated USING (true);

-- NOVA POLÍTICA (CRÍTICA): Permitir que clientes autenticados vejam a agenda de ocupação
-- Sem isso, o banco esconde os agendamentos de outros, retornando 0 ocupados.
CREATE POLICY "Client View Slots" ON appointments FOR SELECT TO authenticated USING (true);

-- =============================================================================
-- 10. FUNÇÃO ATÔMICA PARA AGENDAMENTO PÚBLICO (RPC)
-- =============================================================================
-- Esta função permite que o cliente crie tudo (Cadastro + Veículo + Agenda) 
-- em uma única transação SQL, evitando dados incompletos ou erros de RLS.

CREATE OR REPLACE FUNCTION public.create_complete_booking(
    p_business_slug TEXT,
    p_customer_name TEXT,
    p_customer_phone TEXT,
    p_vehicle_brand TEXT,
    p_vehicle_model TEXT,
    p_vehicle_plate TEXT,
    p_service_id UUID,
    p_booking_date DATE,
    p_booking_time TIME
) RETURNS JSONB AS $$
DECLARE
    v_business_id UUID;
    v_owner_id UUID;
    v_customer_id UUID;
    v_vehicle_id UUID;
    v_appointment_id UUID;
    v_service_name TEXT;
    v_service_price NUMERIC;
BEGIN
    -- 1. Buscar dados do negócio pelo Slug
    SELECT id, user_id INTO v_business_id, v_owner_id 
    FROM public.business_settings 
    WHERE slug = p_business_slug;

    IF v_business_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Business not found');
    END IF;

    -- 2. Buscar dados do serviço
    SELECT name, price INTO v_service_name, v_service_price 
    FROM public.services 
    WHERE id = p_service_id;

    -- 3. Inserir ou buscar Cliente (vinculado ao dono do negócio)
    INSERT INTO public.customers (user_id, business_id, name, phone)
    VALUES (v_owner_id, v_business_id, p_customer_name, p_customer_phone)
    RETURNING id INTO v_customer_id;

    -- 4. Inserir Veículo
    INSERT INTO public.vehicles (customer_id, brand, model, plate)
    VALUES (v_customer_id, p_vehicle_brand, p_vehicle_model, p_vehicle_plate)
    RETURNING id INTO v_vehicle_id;

    -- 5. Inserir Agendamento
    INSERT INTO public.appointments (
        user_id, business_id, customer_id, vehicle_id, service_id, 
        service_type, date, time, price, status
    )
    VALUES (
        v_owner_id, v_business_id, v_customer_id, v_vehicle_id, p_service_id,
        v_service_name, p_booking_date, p_booking_time, v_service_price, 'NOVO'
    )
    RETURNING id INTO v_appointment_id;

    RETURN jsonb_build_object(
        'success', true, 
        'appointment_id', v_appointment_id,
        'customer_id', v_customer_id
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 11. REALTIME
-- =============================================================================

BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime FOR TABLE appointments, customers, business_settings, services;
COMMIT;

-- =============================================================================
-- 12. RPC FUNCTIONS
-- =============================================================================

CREATE OR REPLACE FUNCTION public.downgrade_to_start(p_business_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.business_settings
    SET 
        plan_type = 'START',
        subscription_status = 'ACTIVE',
        updated_at = NOW()
    WHERE id = p_business_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
