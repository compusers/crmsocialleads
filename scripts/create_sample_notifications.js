// Script para crear notificaciones de prueba
require('dotenv').config();
const mysql = require('mysql2/promise');

async function createSampleNotifications() {
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

    // Verificar si la tabla existe
    const [tables] = await connection.query(`
      SHOW TABLES LIKE 'notificaciones'
    `);

    if (tables.length === 0) {
      console.log('\n📝 Creando tabla notificaciones...');
      
      await connection.query(`
        CREATE TABLE notificaciones (
          id_notificacion INT AUTO_INCREMENT PRIMARY KEY,
          id_usuario INT NOT NULL,
          titulo VARCHAR(255) NOT NULL,
          mensaje TEXT NOT NULL,
          tipo ENUM('info', 'success', 'warning', 'error') DEFAULT 'info',
          leido BOOLEAN DEFAULT FALSE,
          fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          datos_adicionales JSON,
          FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
          INDEX idx_usuario_leido (id_usuario, leido),
          INDEX idx_fecha (fecha_creacion)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
      
      console.log('✅ Tabla notificaciones creada');
    } else {
      console.log('✅ Tabla notificaciones ya existe');
    }

    // Obtener todos los usuarios
    const [users] = await connection.query('SELECT id_usuario FROM usuarios');
    
    if (users.length === 0) {
      console.log('⚠️  No hay usuarios en la base de datos');
      return;
    }

    console.log(`\n📊 Creando notificaciones de prueba para ${users.length} usuario(s)...`);

    const notifications = [
      {
        titulo: 'Bienvenido al CRM',
        mensaje: 'Gracias por usar nuestro sistema. Aquí podrás gestionar tus leads y clientes de manera eficiente.',
        tipo: 'info'
      },
      {
        titulo: 'Nuevo lead asignado',
        mensaje: 'Se te ha asignado un nuevo lead: María González de Empresa ABC.',
        tipo: 'success'
      },
      {
        titulo: 'Recordatorio',
        mensaje: 'Tienes una reunión programada para hoy a las 15:00 con Juan Pérez.',
        tipo: 'warning'
      },
      {
        titulo: 'Meta alcanzada',
        mensaje: '¡Felicidades! Has alcanzado tu meta de ventas del mes.',
        tipo: 'success'
      },
      {
        titulo: 'Tarea pendiente',
        mensaje: 'Tienes 3 tareas pendientes por completar antes del fin de semana.',
        tipo: 'info'
      },
    ];

    let insertedCount = 0;

    for (const user of users) {
      // Insertar algunas notificaciones para cada usuario
      const userNotifications = notifications.slice(0, 3 + Math.floor(Math.random() * 3));
      
      for (let i = 0; i < userNotifications.length; i++) {
        const notification = userNotifications[i];
        const leido = Math.random() > 0.5; // 50% leídas, 50% no leídas
        
        await connection.query(`
          INSERT INTO notificaciones (id_usuario, titulo, mensaje, tipo, leido, fecha_creacion)
          VALUES (?, ?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL ? HOUR))
        `, [
          user.id_usuario,
          notification.titulo,
          notification.mensaje,
          notification.tipo,
          leido,
          i * 2 // Espaciar las notificaciones cada 2 horas hacia atrás
        ]);
        
        insertedCount++;
      }
    }

    console.log(`✅ ${insertedCount} notificaciones creadas exitosamente`);

    // Mostrar resumen
    const [summary] = await connection.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN leido = FALSE THEN 1 ELSE 0 END) as no_leidas,
        SUM(CASE WHEN leido = TRUE THEN 1 ELSE 0 END) as leidas
      FROM notificaciones
    `);

    console.log('\n📊 Resumen de notificaciones:');
    console.log(`   Total: ${summary[0].total}`);
    console.log(`   No leídas: ${summary[0].no_leidas}`);
    console.log(`   Leídas: ${summary[0].leidas}`);

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

console.log('🚀 Iniciando creación de notificaciones de prueba...\n');
createSampleNotifications();
