// ============================================
// SERVIDOR BACKEND - CRM SYSTEM
// Node.js + Express + MySQL
// ============================================

require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// MIDDLEWARES
// ============================================

// CORS - Permitir peticiones desde Flutter
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost'];
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ============================================
// CONFIGURACIÓN DE BASE DE DATOS
// ============================================

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Crear pool de conexiones
const pool = mysql.createPool(dbConfig);

// Verificar conexión al iniciar
pool.getConnection()
  .then(connection => {
    console.log('✅ Conectado a MySQL:', process.env.DB_HOST);
    connection.release();
  })
  .catch(err => {
    console.error('❌ Error conectando a MySQL:', err.message);
  });

// ============================================
// MIDDLEWARE DE AUTENTICACIÓN
// ============================================

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Token no proporcionado' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Token inválido o expirado' });
    }
    req.user = user;
    next();
  });
};

// Middleware de roles
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.rol)) {
      return res.status(403).json({ 
        success: false, 
        message: 'No tienes permisos para esta acción' 
      });
    }
    next();
  };
};

// ============================================
// RUTAS DE SALUD Y DIAGNÓSTICO
// ============================================

// Health check
app.get('/health', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await connection.query('SELECT 1');
    connection.release();
    
    res.json({ 
      status: 'ok', 
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      database: 'disconnected',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Verificar tablas
app.get('/api/debug/tables', async (req, res) => {
  try {
    const [tables] = await pool.query('SHOW TABLES');
    res.json({ success: true, tables });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// RUTAS DE AUTENTICACIÓN
// ============================================

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('🔐 Intento de login:', { email, timestamp: new Date().toISOString() });

    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email y contraseña son requeridos' 
      });
    }

    // Buscar usuario
    const [users] = await pool.query(
      'SELECT * FROM usuarios WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      console.log('❌ Usuario no encontrado:', email);
      return res.status(401).json({ 
        success: false, 
        message: 'Credenciales inválidas' 
      });
    }

    const user = users[0];
    console.log('✅ Usuario encontrado:', { id: user.id, email: user.email, tienePassword: !!user.password });

    // Verificar contraseña - buscar el campo correcto
    const passwordField = user.password || user.password_hash;
    
    if (!passwordField) {
      console.error('❌ No se encontró campo de contraseña en el usuario');
      return res.status(500).json({ 
        success: false, 
        message: 'Error de configuración del servidor' 
      });
    }

    const isValidPassword = await bcrypt.compare(password, passwordField);
    
    if (!isValidPassword) {
      console.log('❌ Contraseña incorrecta para:', email);
      return res.status(401).json({ 
        success: false, 
        message: 'Credenciales inválidas' 
      });
    }

    console.log('✅ Login exitoso para:', email);

    // Generar tokens
    const userId = user.id || user.id_usuario;
    const accessToken = jwt.sign(
      { 
        id: userId, 
        email: user.email, 
        rol: user.rol 
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    const refreshToken = jwt.sign(
      { id: userId },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
    );

    // Preparar datos del usuario (sin password)
    const userData = {
      id: userId,
      nombre: user.nombre,
      email: user.email,
      rol: user.rol,
      telefono: user.telefono,
      activo: user.activo,
      avatar: user.avatar
    };

    res.json({
      success: true,
      message: 'Login exitoso',
      data: {
        user: userData,
        token: accessToken,
        refreshToken: refreshToken
      }
    });

  } catch (error) {
    console.error('❌ Error en login:', error.message);
    console.error('Stack:', error.stack);
    res.status(500).json({ 
      success: false, 
      message: 'Error en el servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// POST /api/auth/refresh
app.post('/api/auth/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ 
        success: false, 
        message: 'Refresh token no proporcionado' 
      });
    }

    jwt.verify(refreshToken, process.env.JWT_SECRET, async (err, decoded) => {
      if (err) {
        return res.status(403).json({ 
          success: false, 
          message: 'Refresh token inválido' 
        });
      }

      // Buscar usuario
      const [users] = await pool.query(
        'SELECT * FROM usuarios WHERE id_usuario = ? AND estado = ?',
        [decoded.id_usuario, 'activo']
      );

      if (users.length === 0) {
        return res.status(404).json({ 
          success: false, 
          message: 'Usuario no encontrado' 
        });
      }

      const user = users[0];

      // Generar nuevo access token
      const accessToken = jwt.sign(
        { 
          id_usuario: user.id_usuario, 
          email: user.email, 
          rol: user.rol 
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
      );

      res.json({
        success: true,
        data: {
          token: accessToken
        }
      });
    });

  } catch (error) {
    console.error('Error en refresh:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error en el servidor' 
    });
  }
});

// GET /api/auth/me - Obtener usuario actual
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const [users] = await pool.query(
      'SELECT id_usuario, nombre, email, rol, telefono, estado, avatar_url, fecha_creacion FROM usuarios WHERE id_usuario = ?',
      [req.user.id_usuario]
    );

    if (users.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Usuario no encontrado' 
      });
    }

    res.json({
      success: true,
      data: users[0]
    });

  } catch (error) {
    console.error('Error obteniendo usuario:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error en el servidor' 
    });
  }
});

// POST /api/auth/forgot-password - Solicitar recuperación de contraseña
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email es requerido'
      });
    }

    // Buscar usuario
    const [users] = await pool.query(
      'SELECT id, email, nombre FROM usuarios WHERE email = ?',
      [email]
    );

    // Por seguridad, siempre devolver éxito (no revelar si el email existe)
    if (users.length === 0) {
      return res.json({
        success: true,
        message: 'Si el email existe, recibirás instrucciones para recuperar tu contraseña'
      });
    }

    const user = users[0];

    // Generar token de recuperación (válido por 1 hora)
    const resetToken = jwt.sign(
      { id: user.id, email: user.email, type: 'password-reset' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // TODO: Enviar email con el token
    // Por ahora, solo lo devolvemos en la respuesta (en producción NO hacer esto)
    console.log(`🔑 Token de recuperación para ${email}:`, resetToken);
    console.log(`🔗 Link de recuperación: https://tudominio.com/reset-password?token=${resetToken}`);

    res.json({
      success: true,
      message: 'Se ha enviado un email con instrucciones para recuperar tu contraseña',
      // SOLO PARA DESARROLLO - ELIMINAR EN PRODUCCIÓN
      debug_token: process.env.NODE_ENV === 'production' ? undefined : resetToken
    });

  } catch (error) {
    console.error('Error en forgot-password:', error);
    res.status(500).json({
      success: false,
      message: 'Error en el servidor'
    });
  }
});

// GET /api/auth/verify-reset-token/:token - Verificar token de recuperación
app.get('/api/auth/verify-reset-token/:token', async (req, res) => {
  try {
    const { token } = req.params;

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        return res.status(400).json({
          success: false,
          message: 'Token inválido o expirado'
        });
      }

      if (decoded.type !== 'password-reset') {
        return res.status(400).json({
          success: false,
          message: 'Token inválido'
        });
      }

      res.json({
        success: true,
        email: decoded.email
      });
    });

  } catch (error) {
    console.error('Error verificando token:', error);
    res.status(500).json({
      success: false,
      message: 'Error en el servidor'
    });
  }
});

// POST /api/auth/reset-password - Restablecer contraseña
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, new_password } = req.body;

    if (!token || !new_password) {
      return res.status(400).json({
        success: false,
        message: 'Token y nueva contraseña son requeridos'
      });
    }

    if (new_password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'La contraseña debe tener al menos 6 caracteres'
      });
    }

    // Verificar token
    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
      if (err) {
        return res.status(400).json({
          success: false,
          message: 'Token inválido o expirado'
        });
      }

      if (decoded.type !== 'password-reset') {
        return res.status(400).json({
          success: false,
          message: 'Token inválido'
        });
      }

      // Hash de la nueva contraseña
      const hashedPassword = await bcrypt.hash(new_password, 10);

      // Actualizar contraseña
      await pool.query(
        'UPDATE usuarios SET password_hash = ? WHERE id = ?',
        [hashedPassword, decoded.id]
      );

      console.log(`✅ Contraseña restablecida para: ${decoded.email}`);

      res.json({
        success: true,
        message: 'Contraseña restablecida exitosamente'
      });
    });

  } catch (error) {
    console.error('Error restableciendo contraseña:', error);
    res.status(500).json({
      success: false,
      message: 'Error en el servidor'
    });
  }
});

// ============================================
// RUTAS DE LEADS
// ============================================

// GET /api/leads - Obtener todos los leads
app.get('/api/leads', authenticateToken, async (req, res) => {
  try {
    const { estatus, asignado, fuente, search, page = 1, limit = 50 } = req.query;
    
    let query = `
      SELECT l.*, e.nombre_estatus, e.color as estatus_color, 
             u.nombre as nombre_asignado, c.nombre_campana
      FROM leads l
      LEFT JOIN estatus_leads e ON l.id_estatus = e.id_estatus
      LEFT JOIN usuarios u ON l.id_asignado = u.id_usuario
      LEFT JOIN campanas c ON l.id_campana = c.id_campana
      WHERE 1=1
    `;
    const params = [];

    if (estatus) {
      query += ' AND l.id_estatus = ?';
      params.push(estatus);
    }

    if (asignado) {
      query += ' AND l.id_asignado = ?';
      params.push(asignado);
    }

    if (fuente) {
      query += ' AND l.fuente = ?';
      params.push(fuente);
    }

    if (search) {
      query += ' AND (l.nombre_completo LIKE ? OR l.empresa LIKE ? OR l.email LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    query += ' ORDER BY l.fecha_creacion DESC';
    
    const offset = (page - 1) * limit;
    query += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [leads] = await pool.query(query, params);

    // Obtener total
    let countQuery = 'SELECT COUNT(*) as total FROM leads WHERE 1=1';
    const countParams = [];
    
    if (estatus) {
      countQuery += ' AND id_estatus = ?';
      countParams.push(estatus);
    }
    if (asignado) {
      countQuery += ' AND id_asignado = ?';
      countParams.push(asignado);
    }
    if (fuente) {
      countQuery += ' AND fuente = ?';
      countParams.push(fuente);
    }
    if (search) {
      countQuery += ' AND (nombre_completo LIKE ? OR empresa LIKE ? OR email LIKE ?)';
      const searchTerm = `%${search}%`;
      countParams.push(searchTerm, searchTerm, searchTerm);
    }

    const [countResult] = await pool.query(countQuery, countParams);

    res.json({
      success: true,
      data: leads,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult[0].total
      }
    });

  } catch (error) {
    console.error('Error obteniendo leads:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error en el servidor' 
    });
  }
});

// GET /api/leads/pipeline - Obtener leads agrupados por estatus (Kanban)
app.get('/api/leads/pipeline', authenticateToken, async (req, res) => {
  try {
    const [leads] = await pool.query(`
      SELECT l.*, e.nombre_estatus, e.color as estatus_color, 
             u.nombre as nombre_asignado
      FROM leads l
      LEFT JOIN estatus_leads e ON l.id_estatus = e.id_estatus
      LEFT JOIN usuarios u ON l.id_asignado = u.id_usuario
      WHERE l.convertido_cliente = FALSE
      ORDER BY e.orden, l.fecha_creacion DESC
    `);

    // Agrupar por estatus
    const pipeline = {};
    leads.forEach(lead => {
      if (!pipeline[lead.id_estatus]) {
        pipeline[lead.id_estatus] = [];
      }
      pipeline[lead.id_estatus].push(lead);
    });

    res.json({
      success: true,
      data: pipeline
    });

  } catch (error) {
    console.error('Error obteniendo pipeline:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error en el servidor' 
    });
  }
});

// POST /api/leads - Crear nuevo lead
app.post('/api/leads', authenticateToken, async (req, res) => {
  try {
    const {
      nombre_completo, email, telefono, empresa, cargo, fuente,
      id_estatus, valor_estimado, probabilidad_cierre, 
      fecha_cierre_esperada, id_campana, notas
    } = req.body;

    if (!nombre_completo) {
      return res.status(400).json({ 
        success: false, 
        message: 'El nombre es requerido' 
      });
    }

    const [result] = await pool.query(
      `INSERT INTO leads (
        nombre_completo, email, telefono, empresa, cargo, fuente,
        id_estatus, id_asignado, valor_estimado, probabilidad_cierre,
        fecha_cierre_esperada, id_campana, notas
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nombre_completo, email, telefono, empresa, cargo, fuente || 'web',
        id_estatus || 1, req.user.id_usuario, valor_estimado, probabilidad_cierre,
        fecha_cierre_esperada, id_campana, notas
      ]
    );

    // Obtener el lead creado
    const [newLead] = await pool.query(
      'SELECT * FROM leads WHERE id_lead = ?',
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      message: 'Lead creado exitosamente',
      data: newLead[0]
    });

  } catch (error) {
    console.error('Error creando lead:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error en el servidor' 
    });
  }
});

// PATCH /api/leads/:id/status - Actualizar estatus de lead
app.patch('/api/leads/:id/status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { id_estatus } = req.body;

    await pool.query(
      'UPDATE leads SET id_estatus = ? WHERE id_lead = ?',
      [id_estatus, id]
    );

    res.json({
      success: true,
      message: 'Estatus actualizado'
    });

  } catch (error) {
    console.error('Error actualizando estatus:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error en el servidor' 
    });
  }
});

// ============================================
// RUTAS DE DASHBOARD
// ============================================

// GET /api/dashboard/stats
app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id_usuario;

    // Obtener estadísticas
    const [stats] = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM leads WHERE id_asignado = ? AND convertido_cliente = FALSE) as total_leads,
        (SELECT COUNT(*) FROM clientes WHERE id_agente_responsable = ?) as total_clientes,
        (SELECT COUNT(*) FROM seguimientos WHERE id_agente = ? AND estado = 'pendiente') as tareas_pendientes,
        (SELECT COUNT(*) FROM notificaciones WHERE id_usuario = ? AND leido = FALSE) as notificaciones_no_leidas,
        (SELECT SUM(valor_estimado) FROM leads WHERE id_asignado = ? AND convertido_cliente = FALSE) as valor_pipeline,
        (SELECT SUM(valor_total_ventas) FROM clientes WHERE id_agente_responsable = ?) as valor_total_ventas
    `, [userId, userId, userId, userId, userId, userId]);

    res.json({
      success: true,
      data: stats[0]
    });

  } catch (error) {
    console.error('Error obteniendo stats:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error en el servidor' 
    });
  }
});

// ============================================
// RUTA DE PRUEBA
// ============================================

app.get('/api/health', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    
    res.json({ 
      success: true, 
      message: 'CRM Backend está funcionando',
      timestamp: new Date().toISOString(),
      database: {
        connected: true,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error de conexión a base de datos',
      error: error.message,
      database: {
        connected: false,
        host: process.env.DB_HOST || 'NO_CONFIGURADO',
        database: process.env.DB_NAME || 'NO_CONFIGURADO'
      }
    });
  }
});

app.get('/', (req, res) => {
  res.json({ 
    success: true, 
    message: 'CRM API v1.0',
    endpoints: {
      health: '/api/health',
      auth: {
        login: 'POST /api/auth/login',
        refresh: 'POST /api/auth/refresh',
        me: 'GET /api/auth/me'
      },
      leads: {
        list: 'GET /api/leads',
        pipeline: 'GET /api/leads/pipeline',
        create: 'POST /api/leads',
        updateStatus: 'PATCH /api/leads/:id/status'
      },
      dashboard: {
        stats: 'GET /api/dashboard/stats'
      }
    }
  });
});

// ============================================
// MANEJO DE ERRORES
// ============================================

app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    message: 'Ruta no encontrada' 
  });
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    success: false, 
    message: 'Error interno del servidor' 
  });
});

// ============================================
// INICIAR SERVIDOR
// ============================================

app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔═══════════════════════════════════════════════╗
║   🚀 CRM Backend Server                       ║
║   📡 Local: http://localhost:${PORT}          ║
║   📡 Red: http://192.168.0.107:${PORT}        ║
║   🗄️  Base de Datos: ${process.env.DB_HOST}              ║
║   📝 Entorno: ${process.env.NODE_ENV}                ║
║   ⏰ Iniciado: ${new Date().toLocaleString()}  ║
╚═══════════════════════════════════════════════╝
  `);
});

// Manejo de cierre graceful
process.on('SIGTERM', () => {
  console.log('SIGTERM recibido. Cerrando servidor...');
  pool.end();
  process.exit(0);
});
