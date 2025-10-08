// Script para agregar columna fcm_token
require('dotenv').config();
const mysql = require('mysql2/promise');

async function addFcmTokenColumn() {
  let connection;
  
  try {
    console.log('🔌 Conectando a la base de datos...');
    
    const dbConfig = {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    };
    
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Conexión establecida');

    // Verificar si la columna ya existe
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
        AND TABLE_NAME = 'usuarios' 
        AND COLUMN_NAME = 'fcm_token'
    `, [dbConfig.database]);

    if (columns.length > 0) {
      console.log('⚠️  La columna "fcm_token" ya existe');
      return;
    }

    // Agregar la columna fcm_token
    console.log('\n🔧 Agregando columna fcm_token...');
    await connection.query(`
      ALTER TABLE usuarios 
      ADD COLUMN fcm_token VARCHAR(255) NULL
    `);
    console.log('✅ Columna fcm_token agregada exitosamente');

    // Verificar la estructura actualizada
    console.log('\n📊 Estructura actualizada:');
    const [structure] = await connection.query('DESCRIBE usuarios');
    console.table(structure);

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Conexión cerrada');
    }
  }
}

console.log('🚀 Agregando columna fcm_token a usuarios...\n');
addFcmTokenColumn();
