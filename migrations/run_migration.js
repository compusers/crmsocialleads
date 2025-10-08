// Script para ejecutar migración de base de datos
// Agrega la columna avatar a la tabla usuarios

require('dotenv').config();
const mysql = require('mysql2/promise');

async function runMigration() {
  let connection;
  
  try {
    console.log('🔌 Conectando a la base de datos...');
    
    // Configuración de conexión
    const dbConfig = {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    };
    
    console.log('📝 Configuración DB:', {
      host: dbConfig.host,
      user: dbConfig.user,
      database: dbConfig.database,
      port: dbConfig.port
    });

    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Conexión establecida');

    // Verificar si la columna ya existe
    console.log('\n📋 Verificando estructura actual...');
    
    // Primero ver la estructura completa
    const [currentStructure] = await connection.query('DESCRIBE usuarios');
    console.log('\n📊 Estructura actual de usuarios:');
    console.table(currentStructure);
    
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
        AND TABLE_NAME = 'usuarios' 
        AND COLUMN_NAME = 'avatar'
    `, [dbConfig.database]);

    if (columns.length > 0) {
      console.log('⚠️  La columna "avatar" ya existe en la tabla usuarios');
      console.log('✅ No se requiere migración');
      return;
    }

    // Agregar la columna avatar
    console.log('\n🔧 Agregando columna avatar...');
    await connection.query(`
      ALTER TABLE usuarios 
      ADD COLUMN avatar VARCHAR(500) NULL
    `);
    console.log('✅ Columna avatar agregada exitosamente');

    // Verificar la estructura actualizada
    console.log('\n📊 Estructura actualizada de la tabla usuarios:');
    const [structure] = await connection.query('DESCRIBE usuarios');
    console.table(structure);

    console.log('\n✅ Migración completada exitosamente');

  } catch (error) {
    console.error('\n❌ Error durante la migración:');
    console.error(error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Conexión cerrada');
    }
  }
}

// Ejecutar migración
console.log('🚀 Iniciando migración de base de datos...');
console.log('📝 Migración: Agregar columna avatar a usuarios\n');
runMigration();
