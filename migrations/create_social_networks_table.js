// Migración: Crear tabla de redes sociales
const mysql = require('mysql2/promise');
require('dotenv').config();

async function createSocialNetworksTable() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
  });

  try {
    console.log('🔧 Creando tabla redes_sociales...');

    // Crear tabla de redes sociales
    await connection.query(`
      CREATE TABLE IF NOT EXISTS redes_sociales (
        id_red_social INT AUTO_INCREMENT PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL,
        icono VARCHAR(255),
        color VARCHAR(7),
        url VARCHAR(255),
        activo BOOLEAN DEFAULT TRUE,
        fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_nombre (nombre),
        INDEX idx_activo (activo)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log('✅ Tabla redes_sociales creada');

    // Insertar redes sociales por defecto
    await connection.query(`
      INSERT INTO redes_sociales (nombre, icono, color, url, activo) VALUES
      ('Facebook', 'facebook', '#1877F2', 'https://facebook.com', TRUE),
      ('Instagram', 'instagram', '#E4405F', 'https://instagram.com', TRUE),
      ('Twitter/X', 'twitter', '#000000', 'https://x.com', TRUE),
      ('LinkedIn', 'linkedin', '#0A66C2', 'https://linkedin.com', TRUE),
      ('TikTok', 'tiktok', '#000000', 'https://tiktok.com', TRUE),
      ('YouTube', 'youtube', '#FF0000', 'https://youtube.com', TRUE),
      ('WhatsApp', 'whatsapp', '#25D366', 'https://whatsapp.com', TRUE),
      ('Google Ads', 'google', '#4285F4', 'https://ads.google.com', TRUE),
      ('Email', 'email', '#EA4335', NULL, TRUE),
      ('Sitio Web', 'web', '#2196F3', NULL, TRUE)
      ON DUPLICATE KEY UPDATE nombre=VALUES(nombre);
    `);

    console.log('✅ Redes sociales por defecto insertadas');

    // Verificar si la tabla campanas existe y agregar la columna id_red_social si no existe
    const [tables] = await connection.query(`
      SHOW TABLES LIKE 'campanas'
    `);

    if (tables.length > 0) {
      console.log('📝 Verificando columna id_red_social en tabla campanas...');
      
      const [columns] = await connection.query(`
        SHOW COLUMNS FROM campanas LIKE 'id_red_social'
      `);

      if (columns.length === 0) {
        await connection.query(`
          ALTER TABLE campanas
          ADD COLUMN id_red_social INT NULL,
          ADD CONSTRAINT fk_campanas_red_social 
            FOREIGN KEY (id_red_social) 
            REFERENCES redes_sociales(id_red_social) 
            ON DELETE SET NULL
        `);
        console.log('✅ Columna id_red_social agregada a campanas');
      } else {
        console.log('✅ Columna id_red_social ya existe en campanas');
      }
    }

    // Mostrar estructura de la tabla
    const [structure] = await connection.query('DESCRIBE redes_sociales');
    console.log('\n📋 Estructura de la tabla redes_sociales:');
    console.table(structure);

  } catch (error) {
    console.error('❌ Error en la migración:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

// Ejecutar migración
createSocialNetworksTable()
  .then(() => {
    console.log('\n✅ Migración completada exitosamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error en la migración:', error);
    process.exit(1);
  });
