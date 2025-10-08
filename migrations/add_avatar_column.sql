-- Migración: Agregar columna avatar a tabla usuarios
-- Fecha: 2025-10-07
-- Descripción: Agrega la columna avatar para almacenar la URL de la foto de perfil

-- Agregar columna avatar si no existe
ALTER TABLE usuarios 
ADD COLUMN IF NOT EXISTS avatar VARCHAR(500) NULL AFTER activo;

-- Verificar la estructura
DESCRIBE usuarios;

-- Mensaje de confirmación
SELECT 'Columna avatar agregada exitosamente' AS resultado;
