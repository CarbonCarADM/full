
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

-- 2.1 Tabela de Baias/Boxes
CREATE TABLE IF NOT EXISTS public.service_bays (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID REFERENCES public.business_settings(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabela de Clientes (CRM)
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Alterado para permitir NULL (leads anônimos)
    business_id UUID REFERENCES public.business_settings(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    total_spent NUMERIC DEFAULT 0,
    last_visit DATE,
    xp_points INTEGER DEFAULT 0,
    washes_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(business_id, phone)
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
    user_id UUID REFERENCES auth.users(id), -- Nullable para visitantes
    business_id UUID REFERENCES public.business_settings(id) ON DELETE CASCADE NOT NULL,
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
    vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
    service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
    service_type TEXT,
    date DATE NOT NULL,
    time TIME NOT NULL,
    duration_minutes INTEGER DEFAULT 60,
    price NUMERIC NOT NULL,
    box_id UUID REFERENCES public.service_bays(id) ON DELETE SET NULL,
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
-- 9. SEGURANÇA (RLS)
-- =============================================================================

-- Habilitar RLS em tudo
ALTER TABLE business_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_bays ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- 9.1 POLÍTICAS PARA SERVICES
DROP POLICY IF EXISTS "Admin Services" ON services;
CREATE POLICY "Admin Services" ON services FOR ALL TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Public View Services" ON services;
CREATE POLICY "Public View Services" ON services FOR SELECT TO authenticated, anon USING (is_active = true);

-- 9.2 POLÍTICAS PARA BUSINESS SETTINGS
DROP POLICY IF EXISTS "Admin BS" ON business_settings;
CREATE POLICY "Admin BS" ON business_settings FOR ALL TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Public View Business" ON business_settings;
CREATE POLICY "Public View Business" ON business_settings FOR SELECT TO authenticated, anon USING (true);

-- 9.3 POLÍTICAS PARA AGENDAMENTOS
DROP POLICY IF EXISTS "Admin Appointments" ON appointments;
CREATE POLICY "Admin Appointments" ON appointments FOR ALL TO authenticated USING (
    business_id IN (SELECT id FROM business_settings WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "Client Insert Appointment" ON appointments;
CREATE POLICY "Client Insert Appointment" ON appointments FOR INSERT TO authenticated, anon WITH CHECK (true);

DROP POLICY IF EXISTS "Client View Own Appointments" ON appointments;
CREATE POLICY "Client View Own Appointments" ON appointments FOR SELECT TO authenticated USING (
    user_id = auth.uid() OR 
    customer_id IN (SELECT id FROM customers WHERE email = (select auth.jwt() ->> 'email') OR user_id = auth.uid())
);

-- 9.4 POLÍTICAS PARA CLIENTES (Admin pode gerenciar todos do seu hangar)
DROP POLICY IF EXISTS "Admin Customers" ON customers;
CREATE POLICY "Admin Customers" ON customers FOR ALL TO authenticated USING (
    business_id IN (SELECT id FROM business_settings WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "Public Insert Customer" ON customers;
CREATE POLICY "Public Insert Customer" ON customers FOR INSERT TO authenticated, anon WITH CHECK (true);

-- CORREÇÃO: Usar auth.jwt() ->> 'email' é mais seguro e evita 403 em subqueries
DROP POLICY IF EXISTS "Client View Own Customer Data" ON customers;
CREATE POLICY "Client View Own Customer Data" ON customers FOR SELECT TO authenticated USING (
    email = (select auth.jwt() ->> 'email') OR user_id = auth.uid()
);

-- 9.5 POLÍTICAS PARA VEÍCULOS
DROP POLICY IF EXISTS "Admin Vehicles" ON vehicles;
CREATE POLICY "Admin Vehicles" ON vehicles FOR ALL TO authenticated USING (
    customer_id IN (SELECT id FROM customers WHERE business_id IN (SELECT id FROM business_settings WHERE user_id = auth.uid()))
);

DROP POLICY IF EXISTS "Public Insert Vehicle" ON vehicles;
CREATE POLICY "Public Insert Vehicle" ON vehicles FOR INSERT TO authenticated, anon WITH CHECK (true);

-- 9.6 PORTFÓLIO E REVIEWS
DROP POLICY IF EXISTS "Public View Portfolio" ON portfolio_items;
CREATE POLICY "Public View Portfolio" ON portfolio_items FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "Public View Reviews" ON reviews;
CREATE POLICY "Public View Reviews" ON reviews FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "Public Insert Reviews" ON reviews;
CREATE POLICY "Public Insert Reviews" ON reviews FOR INSERT TO authenticated, anon WITH CHECK (true);

-- 9.7 OUTROS
DROP POLICY IF EXISTS "Admin Expenses" ON expenses;
CREATE POLICY "Admin Expenses" ON expenses FOR ALL TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Public View Bays" ON service_bays;
CREATE POLICY "Public View Bays" ON service_bays FOR SELECT TO authenticated, anon USING (true);
