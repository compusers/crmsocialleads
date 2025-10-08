-- ============================================
-- VERIFICACIÓN DE BASE DE DATOS
-- Base de Datos: u250541039_crmsocialleads
-- Servidor: srv1145.hstgr.io (195.35.61.61)
-- ============================================

-- 1. Verificar tablas existentes
SHOW TABLES;

-- 2. Si no existen las tablas, ejecutar este script:

-- Tabla de usuarios
CREATE TABLE IF NOT EXISTS usuarios (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    rol ENUM('admin', 'vendedor', 'supervisor') DEFAULT 'vendedor',
    activo BOOLEAN DEFAULT TRUE,
    avatar VARCHAR(255),
    telefono VARCHAR(20),
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_rol (rol),
    INDEX idx_activo (activo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de estatus
CREATE TABLE IF NOT EXISTS estatus (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(50) NOT NULL,
    descripcion TEXT,
    color VARCHAR(7) DEFAULT '#2196F3',
    orden INT DEFAULT 0,
    tipo ENUM('lead', 'cliente', 'postventa') NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_nombre_tipo (nombre, tipo),
    INDEX idx_tipo (tipo),
    INDEX idx_orden (orden)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de campañas
CREATE TABLE IF NOT EXISTS campañas (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    canal ENUM('email', 'social', 'ads', 'evento', 'telefono', 'referido') NOT NULL,
    fecha_inicio DATE,
    fecha_fin DATE,
    presupuesto DECIMAL(10,2) DEFAULT 0,
    activa BOOLEAN DEFAULT TRUE,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_canal (canal),
    INDEX idx_activa (activa),
    INDEX idx_fechas (fecha_inicio, fecha_fin)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de leads
CREATE TABLE IF NOT EXISTS leads (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(100),
    telefono VARCHAR(20),
    empresa VARCHAR(100),
    fuente VARCHAR(50),
    estatus_id INT,
    usuario_id INT,
    campaña_id INT,
    notas TEXT,
    valor_estimado DECIMAL(10,2) DEFAULT 0,
    probabilidad INT DEFAULT 50,
    fecha_contacto DATE,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (estatus_id) REFERENCES estatus(id) ON DELETE SET NULL,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
    FOREIGN KEY (campaña_id) REFERENCES campañas(id) ON DELETE SET NULL,
    INDEX idx_estatus (estatus_id),
    INDEX idx_usuario (usuario_id),
    INDEX idx_fuente (fuente),
    INDEX idx_email (email),
    INDEX idx_telefono (telefono)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de clientes
CREATE TABLE IF NOT EXISTS clientes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    lead_id INT,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(100),
    telefono VARCHAR(20),
    empresa VARCHAR(100),
    direccion TEXT,
    estatus_id INT,
    usuario_id INT,
    fecha_conversion DATE,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL,
    FOREIGN KEY (estatus_id) REFERENCES estatus(id) ON DELETE SET NULL,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
    INDEX idx_email (email),
    INDEX idx_telefono (telefono),
    INDEX idx_estatus (estatus_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de seguimientos
CREATE TABLE IF NOT EXISTS seguimientos (
    id INT PRIMARY KEY AUTO_INCREMENT,
    lead_id INT,
    usuario_id INT,
    tipo ENUM('llamada', 'email', 'reunion', 'tarea', 'otro') NOT NULL,
    descripcion TEXT,
    fecha_programada DATETIME,
    completado BOOLEAN DEFAULT FALSE,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
    INDEX idx_lead (lead_id),
    INDEX idx_usuario (usuario_id),
    INDEX idx_fecha (fecha_programada),
    INDEX idx_completado (completado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de postventa
CREATE TABLE IF NOT EXISTS postventa (
    id INT PRIMARY KEY AUTO_INCREMENT,
    cliente_id INT NOT NULL,
    usuario_id INT,
    tipo ENUM('soporte', 'renovacion', 'upsell', 'feedback', 'otro') NOT NULL,
    descripcion TEXT,
    estatus_id INT,
    fecha_programada DATETIME,
    completado BOOLEAN DEFAULT FALSE,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
    FOREIGN KEY (estatus_id) REFERENCES estatus(id) ON DELETE SET NULL,
    INDEX idx_cliente (cliente_id),
    INDEX idx_usuario (usuario_id),
    INDEX idx_completado (completado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de notificaciones
CREATE TABLE IF NOT EXISTS notificaciones (
    id INT PRIMARY KEY AUTO_INCREMENT,
    usuario_id INT NOT NULL,
    titulo VARCHAR(200) NOT NULL,
    mensaje TEXT,
    tipo ENUM('info', 'warning', 'error', 'success') DEFAULT 'info',
    leida BOOLEAN DEFAULT FALSE,
    url VARCHAR(255),
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    INDEX idx_usuario (usuario_id),
    INDEX idx_leida (leida),
    INDEX idx_creado (creado_en)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de eventos del calendario
CREATE TABLE IF NOT EXISTS eventos (
    id INT PRIMARY KEY AUTO_INCREMENT,
    titulo VARCHAR(200) NOT NULL,
    descripcion TEXT,
    fecha_inicio DATETIME NOT NULL,
    fecha_fin DATETIME NOT NULL,
    todo_el_dia BOOLEAN DEFAULT FALSE,
    usuario_id INT,
    lead_id INT,
    cliente_id INT,
    tipo ENUM('reunion', 'llamada', 'tarea', 'otro') DEFAULT 'otro',
    color VARCHAR(7) DEFAULT '#2196F3',
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE,
    INDEX idx_usuario (usuario_id),
    INDEX idx_fechas (fecha_inicio, fecha_fin)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Insertar datos de prueba

-- Usuario administrador
INSERT IGNORE INTO usuarios (id, nombre, email, password, rol) VALUES 
(1, 'Administrador', 'admin@crm.com', '$2a$10$YourHashedPasswordHere', 'admin');

-- Estatus para leads
INSERT IGNORE INTO estatus (nombre, descripcion, color, orden, tipo) VALUES
('Nuevo', 'Lead recién creado', '#2196F3', 1, 'lead'),
('Contactado', 'Primer contacto realizado', '#FF9800', 2, 'lead'),
('Calificado', 'Lead calificado y con potencial', '#9C27B0', 3, 'lead'),
('Propuesta', 'Propuesta enviada', '#FFC107', 4, 'lead'),
('Negociación', 'En proceso de negociación', '#FF5722', 5, 'lead'),
('Ganado', 'Lead convertido en cliente', '#4CAF50', 6, 'lead'),
('Perdido', 'Oportunidad perdida', '#F44336', 7, 'lead');

-- Estatus para clientes
INSERT IGNORE INTO estatus (nombre, descripcion, color, orden, tipo) VALUES
('Activo', 'Cliente activo', '#4CAF50', 1, 'cliente'),
('Inactivo', 'Cliente inactivo', '#9E9E9E', 2, 'cliente'),
('Moroso', 'Pagos pendientes', '#F44336', 3, 'cliente');

-- Campaña de ejemplo
INSERT IGNORE INTO campañas (nombre, descripcion, canal, fecha_inicio, presupuesto) VALUES
('Campaña Demo', 'Campaña de demostración', 'social', CURDATE(), 5000.00);

-- 4. Verificar que todo se creó correctamente
SELECT 'Tablas creadas:' as mensaje;
SHOW TABLES;

SELECT 'Total usuarios:' as campo, COUNT(*) as total FROM usuarios;
SELECT 'Total estatus:' as campo, COUNT(*) as total FROM estatus;
SELECT 'Total campañas:' as campo, COUNT(*) as total FROM campañas;
