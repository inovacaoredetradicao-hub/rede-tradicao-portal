CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Um produto pode ter mais de um codigo de barras (ex: embalagens/fornecedores
-- diferentes do mesmo item). products.barcode continua sendo o principal/primeiro;
-- os demais ficam aqui para a bipagem no app reconhecer qualquer um deles.
CREATE TABLE IF NOT EXISTS product_barcodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  barcode TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_barcodes_product ON product_barcodes (product_id);

CREATE TABLE IF NOT EXISTS operational_count_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL,
  barcode TEXT NOT NULL,
  product_name TEXT NOT NULL,
  unit_id UUID NOT NULL,
  unit_name TEXT NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('unica', 'diario', 'quinzenal', 'mensal')),
  execution_deadline_minutes INTEGER NOT NULL CHECK (execution_deadline_minutes > 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  start_date DATE NOT NULL,
  end_date DATE NULL,
  responsible_user_id UUID NULL,
  responsible_user_name TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- group_id agrupa N regras (produtos arbitrarios, ex.: Doritos + Baton + Coca-Cola)
-- criadas juntas num unico disparo, para que o scheduler as junte em 1 lote/alerta so.
ALTER TABLE operational_count_rules ADD COLUMN IF NOT EXISTS group_id UUID NULL;

-- Permite disparo "unico" (nao recorrente) alem das frequencias existentes.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'operational_count_rules' AND constraint_name = 'operational_count_rules_frequency_check'
  ) THEN
    ALTER TABLE operational_count_rules DROP CONSTRAINT operational_count_rules_frequency_check;
  END IF;
  ALTER TABLE operational_count_rules ADD CONSTRAINT operational_count_rules_frequency_check
    CHECK (frequency IN ('unica', 'diario', 'quinzenal', 'mensal'));
END $$;

CREATE TABLE IF NOT EXISTS operational_count_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES operational_count_rules(id) ON DELETE CASCADE,
  product_id UUID NOT NULL,
  barcode TEXT NOT NULL,
  product_name TEXT NOT NULL,
  unit_id UUID NOT NULL,
  unit_name TEXT NOT NULL,
  responsible_user_id UUID NULL,
  responsible_user_name TEXT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  due_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pendente', 'em_andamento', 'concluido', 'vencido')),
  linked_audit_session_id UUID NULL,
  started_at TIMESTAMPTZ NULL,
  completed_at TIMESTAMPTZ NULL,
  expired_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS operational_alert_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('product', 'classification')),
  classification_key TEXT NOT NULL,
  classification_label TEXT NOT NULL,
  unit_id UUID NOT NULL,
  unit_name TEXT NOT NULL,
  responsible_user_id UUID NULL,
  responsible_user_name TEXT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  due_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pendente', 'em_andamento', 'concluido', 'vencido')),
  linked_audit_session_id UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS operational_alert_batch_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES operational_alert_batches(id) ON DELETE CASCADE,
  rule_id UUID NULL REFERENCES operational_count_rules(id) ON DELETE SET NULL,
  product_id UUID NOT NULL,
  barcode TEXT NOT NULL,
  product_name TEXT NOT NULL
);

-- Historico dos lotes nao pode ser perdido quando uma regra e apagada:
-- os dados do produto ja estao desnormalizados nesta tabela, so o vinculo com a regra fica nulo.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'operational_alert_batch_items'
      AND constraint_name = 'operational_alert_batch_items_rule_id_fkey'
      AND constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE operational_alert_batch_items
      ALTER COLUMN rule_id DROP NOT NULL;

    ALTER TABLE operational_alert_batch_items
      DROP CONSTRAINT operational_alert_batch_items_rule_id_fkey;

    ALTER TABLE operational_alert_batch_items
      ADD CONSTRAINT operational_alert_batch_items_rule_id_fkey
      FOREIGN KEY (rule_id) REFERENCES operational_count_rules(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_operational_count_alerts_rule_schedule
  ON operational_count_alerts (rule_id, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_operational_count_alerts_status
  ON operational_count_alerts (status);

CREATE INDEX IF NOT EXISTS idx_operational_count_alerts_unit_user
  ON operational_count_alerts (unit_id, responsible_user_id);

CREATE INDEX IF NOT EXISTS idx_operational_count_rules_active_dates
  ON operational_count_rules (is_active, start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_operational_alert_batches_status
  ON operational_alert_batches (status);

CREATE INDEX IF NOT EXISTS idx_operational_alert_batches_lookup
  ON operational_alert_batches (type, classification_key, unit_id, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_operational_alert_batches_due_at
  ON operational_alert_batches (due_at);

CREATE INDEX IF NOT EXISTS idx_operational_alert_batch_items_batch
  ON operational_alert_batch_items (batch_id);

CREATE INDEX IF NOT EXISTS idx_operational_alert_batch_items_product
  ON operational_alert_batch_items (product_id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'products'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'operational_count_rules'
      AND constraint_name = 'fk_operational_count_rules_product'
  ) THEN
    ALTER TABLE operational_count_rules
      ADD CONSTRAINT fk_operational_count_rules_product
      FOREIGN KEY (product_id) REFERENCES products(id);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'units'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'operational_alert_batches'
      AND constraint_name = 'fk_operational_alert_batches_unit'
  ) THEN
    ALTER TABLE operational_alert_batches
      ADD CONSTRAINT fk_operational_alert_batches_unit
      FOREIGN KEY (unit_id) REFERENCES units(id);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'users'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'operational_alert_batches'
      AND constraint_name = 'fk_operational_alert_batches_user'
  ) THEN
    ALTER TABLE operational_alert_batches
      ADD CONSTRAINT fk_operational_alert_batches_user
      FOREIGN KEY (responsible_user_id) REFERENCES users(id);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'products'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'operational_alert_batch_items'
      AND constraint_name = 'fk_operational_alert_batch_items_product'
  ) THEN
    ALTER TABLE operational_alert_batch_items
      ADD CONSTRAINT fk_operational_alert_batch_items_product
      FOREIGN KEY (product_id) REFERENCES products(id);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'units'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'operational_count_rules'
      AND constraint_name = 'fk_operational_count_rules_unit'
  ) THEN
    ALTER TABLE operational_count_rules
      ADD CONSTRAINT fk_operational_count_rules_unit
      FOREIGN KEY (unit_id) REFERENCES units(id);
  END IF;
END $$;

-- linked_audit_session_id sempre aponta para portal_audits, que e a tabela
-- realmente usada pelo backend do app (POST /portal/mobile/audits). A tabela
-- audit_sessions e um schema legado sem uso e nunca deve ser o alvo desta FK.
-- ON DELETE SET NULL: excluir uma auditoria (admin apagando um resultado)
-- nao pode ficar bloqueado pelo lote que ela concluiu; o lote so perde o vinculo.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'operational_alert_batches'
      AND constraint_name = 'fk_operational_alert_batches_audit_session'
  ) THEN
    ALTER TABLE operational_alert_batches
      DROP CONSTRAINT fk_operational_alert_batches_audit_session;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'operational_alert_batches'
      AND constraint_name = 'fk_operational_alert_batches_portal_audit'
  ) THEN
    ALTER TABLE operational_alert_batches
      DROP CONSTRAINT fk_operational_alert_batches_portal_audit;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'portal_audits'
  ) THEN
    ALTER TABLE operational_alert_batches
      ADD CONSTRAINT fk_operational_alert_batches_portal_audit
      FOREIGN KEY (linked_audit_session_id) REFERENCES portal_audits(id) ON DELETE SET NULL;
  END IF;
END $$;


DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'users'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'operational_count_rules'
      AND constraint_name = 'fk_operational_count_rules_user'
  ) THEN
    ALTER TABLE operational_count_rules
      ADD CONSTRAINT fk_operational_count_rules_user
      FOREIGN KEY (responsible_user_id) REFERENCES users(id);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'products'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'operational_count_alerts'
      AND constraint_name = 'fk_operational_count_alerts_product'
  ) THEN
    ALTER TABLE operational_count_alerts
      ADD CONSTRAINT fk_operational_count_alerts_product
      FOREIGN KEY (product_id) REFERENCES products(id);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'units'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'operational_count_alerts'
      AND constraint_name = 'fk_operational_count_alerts_unit'
  ) THEN
    ALTER TABLE operational_count_alerts
      ADD CONSTRAINT fk_operational_count_alerts_unit
      FOREIGN KEY (unit_id) REFERENCES units(id);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'users'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'operational_count_alerts'
      AND constraint_name = 'fk_operational_count_alerts_user'
  ) THEN
    ALTER TABLE operational_count_alerts
      ADD CONSTRAINT fk_operational_count_alerts_user
      FOREIGN KEY (responsible_user_id) REFERENCES users(id);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'audit_sessions'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'operational_count_alerts'
      AND constraint_name = 'fk_operational_count_alerts_audit_session'
  ) THEN
    ALTER TABLE operational_count_alerts
      ADD CONSTRAINT fk_operational_count_alerts_audit_session
      FOREIGN KEY (linked_audit_session_id) REFERENCES audit_sessions(id);
  ELSIF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'portal_audits'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'operational_count_alerts'
      AND constraint_name = 'fk_operational_count_alerts_portal_audit'
  ) THEN
    ALTER TABLE operational_count_alerts
      ADD CONSTRAINT fk_operational_count_alerts_portal_audit
      FOREIGN KEY (linked_audit_session_id) REFERENCES portal_audits(id);
  END IF;
END $$;

-- ============================================================
-- Modulo de inventario de uniformes
-- ============================================================

-- Catalogo: cada linha e um modelo+tamanho distinto (ex: "Jaqueta" + "P").
CREATE TABLE IF NOT EXISTS uniform_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  size TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (name, size)
);

-- Etiquetas impressas (QR code). Nascem "livre" (sem vinculo) e sao coladas
-- fisicamente num uniforme/lote. O primeiro scan de "entrada" vincula a
-- etiqueta a um item do catalogo, uma unidade e uma quantidade/local.
-- O id e o proprio codigo curto impresso/gravado no QR.
CREATE TABLE IF NOT EXISTS uniform_tags (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'livre' CHECK (status IN ('livre', 'em_uso')),
  uniform_item_id UUID NULL REFERENCES uniform_items(id) ON DELETE SET NULL,
  unit_id UUID NULL REFERENCES units(id),
  location_label TEXT NULL,
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  batch_label TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Historico de entradas/saidas, para auditoria e para reconstruir o
-- estoque agregado por filial.
CREATE TABLE IF NOT EXISTS uniform_stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id TEXT NOT NULL REFERENCES uniform_tags(id) ON DELETE CASCADE,
  uniform_item_id UUID NOT NULL REFERENCES uniform_items(id),
  type TEXT NOT NULL CHECK (type IN ('entrada', 'saida')),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_id UUID NOT NULL REFERENCES units(id),
  from_unit_id UUID NULL REFERENCES units(id),
  location_label TEXT NULL,
  user_id UUID NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Estoque agregado por filial (independe de qual etiqueta/local especifico).
-- Atualizado a cada entrada/saida.
CREATE TABLE IF NOT EXISTS uniform_unit_stock (
  unit_id UUID NOT NULL REFERENCES units(id),
  uniform_item_id UUID NOT NULL REFERENCES uniform_items(id),
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (unit_id, uniform_item_id)
);

CREATE INDEX IF NOT EXISTS idx_uniform_tags_status ON uniform_tags (status);
CREATE INDEX IF NOT EXISTS idx_uniform_tags_unit ON uniform_tags (unit_id);
CREATE INDEX IF NOT EXISTS idx_uniform_tags_item ON uniform_tags (uniform_item_id);
CREATE INDEX IF NOT EXISTS idx_uniform_stock_movements_tag ON uniform_stock_movements (tag_id);
CREATE INDEX IF NOT EXISTS idx_uniform_stock_movements_unit ON uniform_stock_movements (unit_id);

-- ============================================================
-- Vinculo usuario <-> filial (para disparo de contagem por filial)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_units (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, unit_id)
);

CREATE INDEX IF NOT EXISTS idx_user_units_unit ON user_units (unit_id);
