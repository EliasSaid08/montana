DROP TABLE IF EXISTS password_reset_tokens CASCADE;
DROP TABLE IF EXISTS pagos CASCADE;
DROP TABLE IF EXISTS venta_detalles CASCADE;
DROP TABLE IF EXISTS ventas CASCADE;
DROP TABLE IF EXISTS clientes CASCADE;
DROP TABLE IF EXISTS productos CASCADE;
DROP TABLE IF EXISTS categorias CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;
DROP TABLE IF EXISTS configuracion CASCADE;


-- TABLAS PRINCIPALES

CREATE TABLE usuarios (
    id          SERIAL PRIMARY KEY,
    username    VARCHAR(50)  UNIQUE NOT NULL,
    password    VARCHAR(255) NOT NULL,
    nombre      VARCHAR(100) NOT NULL,
    email       VARCHAR(100),
    role        VARCHAR(20)  DEFAULT 'empleado',
    activo      BOOLEAN      DEFAULT true,
    created_at  TIMESTAMP    DEFAULT NOW()
);

CREATE TABLE categorias (
    id          SERIAL PRIMARY KEY,
    nombre      VARCHAR(50) NOT NULL,
    descripcion TEXT,
    activo      BOOLEAN   DEFAULT true,
    created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE productos (
    id           SERIAL PRIMARY KEY,
    codigo       VARCHAR(50) UNIQUE,
    nombre       VARCHAR(100) NOT NULL,
    descripcion  TEXT,
    categoria_id INTEGER REFERENCES categorias(id),
    precio       DECIMAL(10,2) NOT NULL DEFAULT 0,
    costo        DECIMAL(10,2) DEFAULT 0,
    stock        INTEGER DEFAULT 0,
    stock_minimo INTEGER DEFAULT 5,
    imagen_url   TEXT,
    activo       BOOLEAN   DEFAULT true,
    created_at   TIMESTAMP DEFAULT NOW()
);

CREATE TABLE clientes (
    id          SERIAL PRIMARY KEY,
    nombre      VARCHAR(100) NOT NULL,
    telefono    VARCHAR(20),
    email       VARCHAR(100),
    direccion   TEXT,
    deuda_total DECIMAL(10,2) DEFAULT 0,
    activo      BOOLEAN   DEFAULT true,
    created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE ventas (
    id          SERIAL PRIMARY KEY,
    codigo      VARCHAR(50) UNIQUE NOT NULL,
    fecha       TIMESTAMP DEFAULT NOW(),
    cliente_id  INTEGER REFERENCES clientes(id),
    vendedor_id INTEGER REFERENCES usuarios(id),
    subtotal    DECIMAL(10,2) NOT NULL,
    descuento   DECIMAL(10,2) DEFAULT 0,
    total       DECIMAL(10,2) NOT NULL,
    estado      VARCHAR(20) DEFAULT 'completada',
    metodo_pago VARCHAR(30),
    notas       TEXT,
    created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE venta_detalles (
    id              SERIAL PRIMARY KEY,
    venta_id        INTEGER REFERENCES ventas(id) ON DELETE CASCADE,
    producto_id     INTEGER REFERENCES productos(id),
    cantidad        INTEGER       NOT NULL,
    precio_unitario DECIMAL(10,2) NOT NULL,
    subtotal        DECIMAL(10,2) NOT NULL
);

CREATE TABLE pagos (
    id          SERIAL PRIMARY KEY,
    cliente_id  INTEGER REFERENCES clientes(id),
    monto       DECIMAL(10,2) NOT NULL,
    fecha       TIMESTAMP DEFAULT NOW(),
    metodo_pago VARCHAR(30),
    referencia  VARCHAR(100),
    notas       TEXT,
    created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE configuracion (
    id          SERIAL PRIMARY KEY,
    clave       VARCHAR(50) UNIQUE NOT NULL,
    valor       TEXT,
    descripcion TEXT
);

-- Tokens para recuperación de contraseña (RLS habilitado)
CREATE TABLE password_reset_tokens (
    id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id    INTEGER     REFERENCES usuarios(id),
    token      TEXT        NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used       BOOLEAN     DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ÍNDICES

CREATE INDEX idx_productos_categoria      ON productos(categoria_id);
CREATE INDEX idx_productos_activo         ON productos(activo);
CREATE INDEX idx_ventas_fecha             ON ventas(fecha);
CREATE INDEX idx_ventas_cliente           ON ventas(cliente_id);
CREATE INDEX idx_ventas_vendedor          ON ventas(vendedor_id);
CREATE INDEX idx_clientes_deuda           ON clientes(deuda_total);
CREATE INDEX idx_pagos_cliente            ON pagos(cliente_id);
CREATE INDEX idx_venta_detalles_venta     ON venta_detalles(venta_id);
CREATE INDEX idx_venta_detalles_producto  ON venta_detalles(producto_id);


-- RLS — password_reset_tokens
-- Las demás tablas no usan RLS (acceso vía anon key desde el frontend)

ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tokens_insert" ON password_reset_tokens FOR INSERT WITH CHECK (true);
CREATE POLICY "tokens_select" ON password_reset_tokens FOR SELECT USING (true);
CREATE POLICY "tokens_update" ON password_reset_tokens FOR UPDATE USING (true);


-- STORAGE — bucket "imagenes" (crearlo manualmente en Supabase Dashboard > Storage)

CREATE POLICY "imagenes_select" ON storage.objects FOR SELECT USING (bucket_id = 'imagenes');
CREATE POLICY "imagenes_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'imagenes');
CREATE POLICY "imagenes_update" ON storage.objects FOR UPDATE USING (bucket_id = 'imagenes');
CREATE POLICY "imagenes_delete" ON storage.objects FOR DELETE USING (bucket_id = 'imagenes');


-- DATOS INICIALES — configuración de la empresa

INSERT INTO usuarios (username, password, nombre, email, role) VALUES
('admin', 'admin123', 'Administrador', 'admin@montanaimportados.com', 'admin');

INSERT INTO configuracion (clave, valor, descripcion) VALUES
('empresa_nombre',     'Montana Importados',                   'Nombre de la empresa'),
('empresa_telefono',   '',                                     'Teléfono de contacto'),
('empresa_direccion',  '',                                     'Dirección de la empresa');