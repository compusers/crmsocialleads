// Script para crear usuario administrador
require('dotenv').config();
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306
};

async function createAdminUser() {
  let connection;
  
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Conectado a MySQL');

    // Primero, ver la estructura de la tabla
    const [columns] = await connection.query('DESCRIBE usuarios');
    console.log('\n📋 Estructura de la tabla usuarios:');
    columns.forEach(col => {
      console.log(`  - ${col.Field} (${col.Type})`);
    });

    // Hash de la contraseña
    const password = 'admin123';
    const hashedPassword = await bcrypt.hash(password, 10);
    
    console.log('\n🔐 Password hasheado:', hashedPassword);

    // Detectar el nombre de la columna de password
    const passwordColumn = columns.find(col => 
      col.Field.toLowerCase().includes('password') || 
      col.Field.toLowerCase().includes('contrasena') ||
      col.Field.toLowerCase().includes('clave')
    );

    if (!passwordColumn) {
      throw new Error('No se encontró columna de password en la tabla');
    }

    console.log(`\n✅ Columna de password detectada: ${passwordColumn.Field}`);

    // Insertar usuario
    const query = `INSERT INTO usuarios (nombre, email, ${passwordColumn.Field}, rol, estado) 
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE ${passwordColumn.Field} = VALUES(${passwordColumn.Field})`;
    
    const [result] = await connection.execute(
      query,
      ['Admin CRM', 'admin@crmsocialleads.com', hashedPassword, 'admin', 'activo']
    );

    console.log('\n✅ Usuario creado/actualizado');
    console.log('\n📧 Credenciales:');
    console.log('   Email: admin@crmsocialleads.com');
    console.log('   Password: admin123');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

createAdminUser();
