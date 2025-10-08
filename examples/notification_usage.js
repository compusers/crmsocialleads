// Ejemplo de cómo enviar notificaciones desde el backend

// ============================================
// FUNCIÓN AUXILIAR: Crear Notificación
// ============================================

async function createNotification(userId, titulo, mensaje, tipo = 'info', datosAdicionales = null) {
  try {
    const [result] = await pool.query(`
      INSERT INTO notificaciones (id_usuario, titulo, mensaje, tipo, datos_adicionales)
      VALUES (?, ?, ?, ?, ?)
    `, [userId, titulo, mensaje, tipo, JSON.stringify(datosAdicionales)]);
    
    const notificationId = result.insertId;
    
    // Obtener la notificación creada
    const [notifications] = await pool.query(
      'SELECT * FROM notificaciones WHERE id_notificacion = ?',
      [notificationId]
    );
    
    const notification = notifications[0];
    
    // TODO: Enviar por WebSocket
    // io.to(`user_${userId}`).emit('notification', notification);
    
    // TODO: Enviar Push Notification
    // const [users] = await pool.query('SELECT fcm_token FROM usuarios WHERE id_usuario = ?', [userId]);
    // if (users[0]?.fcm_token) {
    //   await sendPushNotification(users[0].fcm_token, titulo, mensaje, tipo);
    // }
    
    return notification;
  } catch (error) {
    console.error('Error creando notificación:', error);
    throw error;
  }
}

// ============================================
// EJEMPLOS DE USO
// ============================================

// 1. NOTIFICACIÓN AL CREAR UN LEAD
app.post('/api/leads', authenticateToken, async (req, res) => {
  try {
    // ... crear lead ...
    
    // Notificar al usuario asignado
    if (req.body.id_asignado) {
      await createNotification(
        req.body.id_asignado,
        'Nuevo Lead Asignado',
        `Se te ha asignado un nuevo lead: ${req.body.nombre_completo}`,
        'info',
        { lead_id: leadId, tipo_entidad: 'lead' }
      );
    }
    
    res.json({ success: true, data: lead });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 2. NOTIFICACIÓN AL COMPLETAR UNA TAREA
app.patch('/api/tasks/:id/complete', authenticateToken, async (req, res) => {
  try {
    // ... completar tarea ...
    
    await createNotification(
      req.user.id,
      '¡Tarea Completada!',
      `Has completado la tarea: ${task.titulo}`,
      'success',
      { task_id: taskId, tipo_entidad: 'task' }
    );
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 3. NOTIFICACIÓN DE RECORDATORIO
app.post('/api/reminders', authenticateToken, async (req, res) => {
  try {
    // ... crear recordatorio ...
    
    await createNotification(
      req.user.id,
      'Recordatorio',
      req.body.mensaje,
      'warning',
      { reminder_id: reminderId, fecha: req.body.fecha }
    );
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 4. NOTIFICACIÓN DE ERROR/ALERTA
app.post('/api/alerts', authenticateToken, async (req, res) => {
  try {
    // ... procesar alerta ...
    
    await createNotification(
      req.user.id,
      'Alerta del Sistema',
      req.body.mensaje,
      'error',
      { alert_type: req.body.tipo }
    );
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 5. NOTIFICACIÓN MASIVA (a todos los usuarios)
app.post('/api/broadcast', authenticateToken, async (req, res) => {
  try {
    // Solo admins pueden enviar broadcasts
    if (req.user.rol !== 'admin') {
      return res.status(403).json({ success: false, message: 'No autorizado' });
    }
    
    const [users] = await pool.query('SELECT id_usuario FROM usuarios WHERE estado = "activo"');
    
    for (const user of users) {
      await createNotification(
        user.id_usuario,
        req.body.titulo,
        req.body.mensaje,
        req.body.tipo || 'info'
      );
    }
    
    res.json({ success: true, sent_to: users.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 6. NOTIFICACIONES PROGRAMADAS (con cron job)
const cron = require('node-cron');

// Ejecutar cada día a las 9 AM
cron.schedule('0 9 * * *', async () => {
  console.log('Enviando notificaciones diarias...');
  
  // Obtener tareas pendientes del día
  const [tasks] = await pool.query(`
    SELECT t.*, u.id_usuario 
    FROM tasks t
    JOIN usuarios u ON t.id_asignado = u.id_usuario
    WHERE DATE(t.fecha_vencimiento) = CURDATE()
      AND t.completada = FALSE
  `);
  
  for (const task of tasks) {
    await createNotification(
      task.id_usuario,
      'Tareas Pendientes Hoy',
      `Tienes ${tasks.length} tarea(s) pendiente(s) para hoy`,
      'warning',
      { task_count: tasks.length }
    );
  }
});

// 7. NOTIFICACIÓN AL CAMBIAR ESTATUS DE LEAD
app.patch('/api/leads/:id/status', authenticateToken, async (req, res) => {
  try {
    const { id_estatus } = req.body;
    
    // ... actualizar estatus ...
    
    const [estatus] = await pool.query('SELECT nombre_estatus FROM estatus_leads WHERE id_estatus = ?', [id_estatus]);
    
    await createNotification(
      lead.id_asignado,
      'Cambio de Estatus',
      `El lead ${lead.nombre_completo} cambió a: ${estatus[0].nombre_estatus}`,
      'info',
      { lead_id: lead.id, estatus_anterior: lead.id_estatus, estatus_nuevo: id_estatus }
    );
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// FUNCIÓN PARA ENVIAR PUSH NOTIFICATION
// (Requiere configurar Firebase Admin SDK)
// ============================================

const admin = require('firebase-admin');

// Inicializar (hacer una sola vez al inicio)
// const serviceAccount = require('./firebase-service-account.json');
// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount)
// });

async function sendPushNotification(fcmToken, title, body, type = 'info') {
  try {
    if (!fcmToken) return;
    
    const message = {
      notification: {
        title: title,
        body: body,
      },
      data: {
        tipo: type,
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'notification',
          channelId: 'crm_notifications',
          priority: 'max',
          defaultVibrateTimings: false,
          vibrateTimingsMillis: [0, 500, 200, 500],
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'notification.aiff',
            badge: 1,
          },
        },
      },
      token: fcmToken,
    };
    
    const response = await admin.messaging().send(message);
    console.log('✅ Push notification enviada:', response);
    return response;
  } catch (error) {
    console.error('❌ Error enviando push:', error);
    return null;
  }
}

// ============================================
// EXPORTAR
// ============================================

module.exports = {
  createNotification,
  sendPushNotification,
};
