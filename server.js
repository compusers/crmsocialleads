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
const path = require('path');
const fs = require('fs');
const http = require('http');
const socketIO = require('socket.io');
const emailService = require('./services/email-service');

// Intentar cargar multer (puede no estar instalado en Render aún)
let multer;
let upload;
try {
  multer = require('multer');
  
  // ============================================
  // CONFIGURACIÓN DE MULTER PARA UPLOADS
  // ============================================
  
  // Crear directorio de uploads si no existe
  const uploadsDir = path.join(__dirname, 'uploads', 'avatars');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // Configuración de almacenamiento
  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
    }
  });

  // Filtro de archivos (solo imágenes)
  const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes (jpeg, jpg, png, gif)'));
    }
  };

  upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB máximo
    fileFilter: fileFilter
  });
  
  console.log('✅ Multer configurado correctamente');
} catch (error) {
  console.warn('⚠️ Multer no disponible:', error.message);
  console.warn('📝 Las funciones de upload de avatar no estarán disponibles hasta instalar multer');
}

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling']
});
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

// Servir archivos estáticos (avatars)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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
      activo: user.estado === 'activo' ? 1 : 0,
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
      'SELECT id_usuario, email, nombre FROM usuarios WHERE email = ?',
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
    const userId = user.id_usuario || user.id;

    // Generar token de recuperación (válido por 1 hora)
    const resetToken = jwt.sign(
      { id: userId, email: user.email, type: 'password-reset' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Responder inmediatamente (no esperar a que se envíe el email)
    res.json({
      success: true,
      message: 'Se ha enviado un email con instrucciones para recuperar tu contraseña',
      // SOLO PARA DESARROLLO - ELIMINAR EN PRODUCCIÓN
      debug_token: process.env.NODE_ENV === 'production' ? undefined : resetToken
    });

    // Enviar email de forma asíncrona (no bloquear la respuesta)
    emailService.sendPasswordResetEmail(
      user.email,
      resetToken,
      user.nombre
    ).then(emailResult => {
      if (!emailResult.success) {
        console.error('❌ Error enviando email:', emailResult.error);
      } else {
        console.log(`✅ Email de recuperación enviado a ${email}`);
      }
    }).catch(error => {
      console.error('❌ Error crítico enviando email:', error);
    });

    console.log(`🔑 Token de recuperación para ${email}:`, resetToken);
    console.log(`🔗 Link de recuperación: ${process.env.APP_URL}/reset-password?token=${resetToken}`);

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
// RUTAS DE PERFIL DE USUARIO
// ============================================

// PATCH /api/users/profile - Actualizar perfil
app.patch('/api/users/profile', authenticateToken, async (req, res) => {
  try {
    const { nombre, email, telefono } = req.body;
    const userId = req.user.id;

    console.log('📝 Actualizar perfil:', { userId, nombre, email, telefono });

    // Validar datos
    if (!nombre || !email) {
      return res.status(400).json({
        success: false,
        message: 'Nombre y email son requeridos'
      });
    }

    // Verificar si el email ya existe (y no es el del usuario actual)
    const [existingUser] = await pool.query(
      'SELECT id_usuario FROM usuarios WHERE email = ? AND id_usuario != ?',
      [email, userId]
    );

    if (existingUser.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'El email ya está en uso por otro usuario'
      });
    }

    // Actualizar usuario
    const [updateResult] = await pool.query(
      'UPDATE usuarios SET nombre = ?, email = ?, telefono = ? WHERE id_usuario = ?',
      [nombre, email, telefono || null, userId]
    );

    console.log('📝 Update result:', updateResult);

    // Obtener usuario actualizado
    const [users] = await pool.query(
      'SELECT id_usuario as id, nombre, email, rol, telefono, CASE WHEN estado = "activo" THEN 1 ELSE 0 END as activo, avatar FROM usuarios WHERE id_usuario = ?',
      [userId]
    );

    console.log(`✅ Perfil actualizado para usuario ID: ${userId}`, users[0]);

    res.json({
      success: true,
      message: 'Perfil actualizado exitosamente',
      user: users[0]
    });

  } catch (error) {
    console.error('❌ Error actualizando perfil:', error);
    res.status(500).json({
      success: false,
      message: 'Error en el servidor: ' + error.message
    });
  }
});

// POST /api/users/change-password - Cambiar contraseña
app.post('/api/users/change-password', authenticateToken, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    const userId = req.user.id;

    // Validar datos
    if (!current_password || !new_password) {
      return res.status(400).json({
        success: false,
        message: 'Contraseña actual y nueva son requeridas'
      });
    }

    if (new_password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'La nueva contraseña debe tener al menos 6 caracteres'
      });
    }

    // Obtener usuario
    const [users] = await pool.query(
      'SELECT password_hash FROM usuarios WHERE id_usuario = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    // Verificar contraseña actual
    const isMatch = await bcrypt.compare(current_password, users[0].password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'La contraseña actual es incorrecta'
      });
    }

    // Verificar que la nueva contraseña sea diferente
    const isSame = await bcrypt.compare(new_password, users[0].password_hash);
    if (isSame) {
      return res.status(400).json({
        success: false,
        message: 'La nueva contraseña debe ser diferente a la actual'
      });
    }

    // Hash de la nueva contraseña
    const hashedPassword = await bcrypt.hash(new_password, 10);

    // Actualizar contraseña
    await pool.query(
      'UPDATE usuarios SET password_hash = ? WHERE id_usuario = ?',
      [hashedPassword, userId]
    );

    console.log(`✅ Contraseña cambiada para usuario ID: ${userId}`);

    res.json({
      success: true,
      message: 'Contraseña actualizada exitosamente'
    });

  } catch (error) {
    console.error('Error cambiando contraseña:', error);
    res.status(500).json({
      success: false,
      message: 'Error en el servidor'
    });
  }
});

// DELETE /api/users/account - Eliminar cuenta (solo usuarios no administradores)
app.delete('/api/users/account', authenticateToken, async (req, res) => {
  try {
    const { password } = req.body;
    const userId = req.user.id;
    const userRole = req.user.rol;

    // Validar que no sea administrador
    if (userRole.toLowerCase() === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Los administradores no pueden eliminar su cuenta desde aquí'
      });
    }

    // Validar contraseña
    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'La contraseña es requerida para confirmar la eliminación'
      });
    }

    // Verificar contraseña
    const [users] = await pool.query(
      'SELECT password_hash, email FROM usuarios WHERE id_usuario = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    const isMatch = await bcrypt.compare(password, users[0].password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Contraseña incorrecta'
      });
    }

    // Iniciar transacción
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Eliminar registros relacionados en cascada
      
      // 1. Eliminar actividades del usuario
      await connection.query('DELETE FROM actividades WHERE id_usuario = ?', [userId]);
      
      // 2. Desasignar leads (no eliminar, solo desasignar)
      await connection.query('UPDATE leads SET id_asignado = NULL WHERE id_asignado = ?', [userId]);
      
      // 3. Eliminar notificaciones del usuario
      await connection.query('DELETE FROM notificaciones WHERE id_usuario = ?', [userId]);
      
      // 4. Eliminar comentarios del usuario
      await connection.query('DELETE FROM comentarios WHERE id_usuario = ?', [userId]);
      
      // 5. Finalmente, eliminar el usuario
      await connection.query('DELETE FROM usuarios WHERE id_usuario = ?', [userId]);

      await connection.commit();
      connection.release();

      console.log(`✅ Cuenta eliminada para usuario ID: ${userId} (${users[0].email})`);

      res.json({
        success: true,
        message: 'Cuenta eliminada exitosamente'
      });

    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }

  } catch (error) {
    console.error('Error eliminando cuenta:', error);
    res.status(500).json({
      success: false,
      message: 'Error en el servidor'
    });
  }
});

// POST /api/users/avatar - Subir avatar
app.post('/api/users/avatar', authenticateToken, (req, res, next) => {
  if (!upload) {
    return res.status(503).json({
      success: false,
      message: 'La funcionalidad de upload no está disponible temporalmente'
    });
  }
  upload.single('avatar')(req, res, next);
}, async (req, res) => {
  try {
    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No se proporcionó ninguna imagen'
      });
    }

    // Obtener el avatar anterior para eliminarlo
    const [users] = await pool.query(
      'SELECT avatar FROM usuarios WHERE id_usuario = ?',
      [userId]
    );

    const oldAvatar = users[0]?.avatar;

    // Construir la URL del avatar  
    const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;
    const avatarUrl = `${baseUrl}/uploads/avatars/${req.file.filename}`;

    // Actualizar avatar en base de datos
    await pool.query(
      'UPDATE usuarios SET avatar = ? WHERE id_usuario = ?',
      [avatarUrl, userId]
    );

    // Eliminar avatar anterior si existe
    if (oldAvatar) {
      try {
        const filename = oldAvatar.split('/').pop();
        const oldAvatarPath = path.join(__dirname, 'uploads', 'avatars', filename);
        if (fs.existsSync(oldAvatarPath)) {
          fs.unlinkSync(oldAvatarPath);
        }
      } catch (err) {
        console.warn('No se pudo eliminar avatar anterior:', err.message);
      }
    }

    // Obtener usuario actualizado
    const [updatedUsers] = await pool.query(
      'SELECT id_usuario as id, nombre, email, rol, telefono, CASE WHEN estado = "activo" THEN 1 ELSE 0 END as activo, avatar FROM usuarios WHERE id_usuario = ?',
      [userId]
    );

    console.log(`✅ Avatar actualizado para usuario ID: ${userId}`);

    res.json({
      success: true,
      message: 'Avatar actualizado exitosamente',
      user: updatedUsers[0],
      avatar_url: avatarUrl
    });

  } catch (error) {
    console.error('❌ Error subiendo avatar:', error);
    
    // Eliminar archivo subido si hubo error
    if (req.file) {
      try {
        const filePath = path.join(__dirname, 'uploads', 'avatars', req.file.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (err) {
        console.warn('No se pudo eliminar archivo temporal:', err.message);
      }
    }

    res.status(500).json({
      success: false,
      message: 'Error en el servidor: ' + error.message
    });
  }
});

// DELETE /api/users/avatar - Eliminar avatar
app.delete('/api/users/avatar', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Obtener el avatar actual
    const [users] = await pool.query(
      'SELECT avatar FROM usuarios WHERE id_usuario = ?',
      [userId]
    );

    const avatar = users[0]?.avatar;

    // Eliminar avatar de la base de datos
    await pool.query(
      'UPDATE usuarios SET avatar = NULL WHERE id_usuario = ?',
      [userId]
    );

    // Eliminar archivo si existe
    if (avatar) {
      const avatarPath = path.join(__dirname, avatar);
      if (fs.existsSync(avatarPath)) {
        fs.unlinkSync(avatarPath);
      }
    }

    // Obtener usuario actualizado
    const [updatedUsers] = await pool.query(
      'SELECT id_usuario as id, nombre, email, rol, telefono, CASE WHEN estado = "activo" THEN 1 ELSE 0 END as activo, avatar FROM usuarios WHERE id_usuario = ?',
      [userId]
    );

    console.log(`✅ Avatar eliminado para usuario ID: ${userId}`);

    res.json({
      success: true,
      message: 'Avatar eliminado exitosamente',
      user: updatedUsers[0]
    });

  } catch (error) {
    console.error('Error eliminando avatar:', error);
    res.status(500).json({
      success: false,
      message: 'Error en el servidor'
    });
  }
});

// ============================================
// RUTAS DE NOTIFICACIONES
// ============================================

// GET /api/notifications - Obtener notificaciones del usuario
app.get('/api/notifications', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { leido, limit = 50, offset = 0 } = req.query;

    let query = 'SELECT * FROM notificaciones WHERE id_usuario = ?';
    const params = [userId];

    if (leido !== undefined) {
      query += ' AND leido = ?';
      params.push(leido === 'true' ? 1 : 0);
    }

    query += ' ORDER BY fecha_creacion DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [notifications] = await pool.query(query, params);

    // Obtener total
    const [totalResult] = await pool.query(
      'SELECT COUNT(*) as total FROM notificaciones WHERE id_usuario = ?',
      [userId]
    );

    // Obtener no leídas
    const [unreadResult] = await pool.query(
      'SELECT COUNT(*) as count FROM notificaciones WHERE id_usuario = ? AND leido = FALSE',
      [userId]
    );

    res.json({
      success: true,
      notifications: notifications,
      total: totalResult[0].total,
      unread_count: unreadResult[0].count
    });

  } catch (error) {
    console.error('Error obteniendo notificaciones:', error);
    res.status(500).json({
      success: false,
      message: 'Error en el servidor'
    });
  }
});

// GET /api/notifications/unread-count - Obtener contador de no leídas
app.get('/api/notifications/unread-count', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const [result] = await pool.query(
      'SELECT COUNT(*) as count FROM notificaciones WHERE id_usuario = ? AND leido = FALSE',
      [userId]
    );

    res.json({
      success: true,
      count: result[0].count
    });

  } catch (error) {
    console.error('Error obteniendo contador:', error);
    res.status(500).json({
      success: false,
      message: 'Error en el servidor'
    });
  }
});

// PATCH /api/notifications/:id/read - Marcar como leída
app.patch('/api/notifications/:id/read', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const notificationId = req.params.id;

    // Verificar que la notificación pertenece al usuario
    const [notifications] = await pool.query(
      'SELECT * FROM notificaciones WHERE id_notificacion = ? AND id_usuario = ?',
      [notificationId, userId]
    );

    if (notifications.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Notificación no encontrada'
      });
    }

    // Marcar como leída
    await pool.query(
      'UPDATE notificaciones SET leido = TRUE WHERE id_notificacion = ?',
      [notificationId]
    );

    res.json({
      success: true,
      message: 'Notificación marcada como leída'
    });

  } catch (error) {
    console.error('Error marcando notificación:', error);
    res.status(500).json({
      success: false,
      message: 'Error en el servidor'
    });
  }
});

// POST /api/notifications/read-all - Marcar todas como leídas
app.post('/api/notifications/read-all', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    await pool.query(
      'UPDATE notificaciones SET leido = TRUE WHERE id_usuario = ? AND leido = FALSE',
      [userId]
    );

    res.json({
      success: true,
      message: 'Todas las notificaciones marcadas como leídas'
    });

  } catch (error) {
    console.error('Error marcando todas:', error);
    res.status(500).json({
      success: false,
      message: 'Error en el servidor'
    });
  }
});

// DELETE /api/notifications/:id - Eliminar notificación
app.delete('/api/notifications/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const notificationId = req.params.id;

    // Verificar que la notificación pertenece al usuario
    const [notifications] = await pool.query(
      'SELECT * FROM notificaciones WHERE id_notificacion = ? AND id_usuario = ?',
      [notificationId, userId]
    );

    if (notifications.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Notificación no encontrada'
      });
    }

    // Eliminar
    await pool.query(
      'DELETE FROM notificaciones WHERE id_notificacion = ?',
      [notificationId]
    );

    res.json({
      success: true,
      message: 'Notificación eliminada'
    });

  } catch (error) {
    console.error('Error eliminando notificación:', error);
    res.status(500).json({
      success: false,
      message: 'Error en el servidor'
    });
  }
});

// POST /api/users/fcm-token - Guardar token FCM
app.post('/api/users/fcm-token', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { fcm_token } = req.body;

    if (!fcm_token) {
      return res.status(400).json({
        success: false,
        message: 'Token FCM requerido'
      });
    }

    // Guardar token en la base de datos
    await pool.query(
      'UPDATE usuarios SET fcm_token = ? WHERE id_usuario = ?',
      [fcm_token, userId]
    );

    console.log(`✅ FCM Token guardado para usuario ${userId}`);

    res.json({
      success: true,
      message: 'Token FCM guardado'
    });

  } catch (error) {
    console.error('Error guardando FCM token:', error);
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
      },
      campaigns: {
        list: 'GET /api/campaigns',
        get: 'GET /api/campaigns/:id',
        create: 'POST /api/campaigns',
        update: 'PUT /api/campaigns/:id',
        delete: 'DELETE /api/campaigns/:id',
        changeStatus: 'PATCH /api/campaigns/:id/status',
        stats: 'GET /api/campaigns/:id/stats'
      },
      socialNetworks: {
        list: 'GET /api/social-networks',
        get: 'GET /api/social-networks/:id',
        create: 'POST /api/social-networks',
        update: 'PUT /api/social-networks/:id',
        delete: 'DELETE /api/social-networks/:id'
      }
    }
  });
});

// ============================================
// RUTAS DE CAMPAÑAS
// ============================================

// GET /api/campaigns - Obtener todas las campañas
app.get('/api/campaigns', authenticateToken, async (req, res) => {
  try {
    const { estado, id_red_social, limit = 100, offset = 0 } = req.query;

    let query = `
      SELECT 
        c.*,
        rs.nombre as red_social_nombre,
        (SELECT COUNT(*) FROM leads l WHERE l.id_campana = c.id_campana) as total_leads,
        (SELECT COUNT(*) FROM clientes cl 
         INNER JOIN leads l ON cl.id_lead = l.id_lead 
         WHERE l.id_campana = c.id_campana) as total_clientes,
        CASE 
          WHEN (SELECT COUNT(*) FROM leads l WHERE l.id_campana = c.id_campana) > 0 
          THEN (SELECT COUNT(*) FROM clientes cl 
                INNER JOIN leads l ON cl.id_lead = l.id_lead 
                WHERE l.id_campana = c.id_campana) * 100.0 / 
               (SELECT COUNT(*) FROM leads l WHERE l.id_campana = c.id_campana)
          ELSE 0
        END as tasa_conversion
      FROM campanas c
      LEFT JOIN redes_sociales rs ON c.id_red_social = rs.id_red_social
      WHERE 1=1
    `;
    
    const params = [];

    if (estado) {
      query += ' AND c.estado = ?';
      params.push(estado);
    }

    if (id_red_social) {
      query += ' AND c.id_red_social = ?';
      params.push(parseInt(id_red_social));
    }

    query += ' ORDER BY c.fecha_creacion DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [campaigns] = await pool.query(query, params);

    res.json({
      success: true,
      campaigns: campaigns
    });

  } catch (error) {
    console.error('Error obteniendo campañas:', error);
    res.status(500).json({
      success: false,
      message: 'Error en el servidor'
    });
  }
});

// GET /api/campaigns/:id - Obtener una campaña por ID
app.get('/api/campaigns/:id', authenticateToken, async (req, res) => {
  try {
    const campaignId = parseInt(req.params.id);

    const [campaigns] = await pool.query(`
      SELECT 
        c.*,
        rs.nombre as red_social_nombre,
        u.nombre as creado_por_nombre
      FROM campanas c
      LEFT JOIN redes_sociales rs ON c.id_red_social = rs.id_red_social
      LEFT JOIN usuarios u ON c.creado_por = u.id_usuario
      WHERE c.id_campana = ?
    `, [campaignId]);

    if (campaigns.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Campaña no encontrada'
      });
    }

    res.json({
      success: true,
      campaign: campaigns[0]
    });

  } catch (error) {
    console.error('Error obteniendo campaña:', error);
    res.status(500).json({
      success: false,
      message: 'Error en el servidor'
    });
  }
});

// POST /api/campaigns - Crear nueva campaña
app.post('/api/campaigns', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      nombre,
      descripcion,
      fecha_inicio,
      fecha_fin,
      presupuesto,
      id_red_social,
      estado = 'activa'
    } = req.body;

    if (!nombre) {
      return res.status(400).json({
        success: false,
        message: 'El nombre es requerido'
      });
    }

    const [result] = await pool.query(`
      INSERT INTO campanas (
        nombre, descripcion, fecha_inicio, fecha_fin, 
        presupuesto, id_red_social, estado, creado_por
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      nombre,
      descripcion || null,
      fecha_inicio || null,
      fecha_fin || null,
      presupuesto || null,
      id_red_social || null,
      estado,
      userId
    ]);

    // Obtener la campaña creada
    const [campaigns] = await pool.query(`
      SELECT c.*, rs.nombre as red_social_nombre
      FROM campanas c
      LEFT JOIN redes_sociales rs ON c.id_red_social = rs.id_red_social
      WHERE c.id_campana = ?
    `, [result.insertId]);

    res.status(201).json({
      success: true,
      message: 'Campaña creada exitosamente',
      campaign: campaigns[0]
    });

  } catch (error) {
    console.error('Error creando campaña:', error);
    res.status(500).json({
      success: false,
      message: 'Error en el servidor'
    });
  }
});

// PUT /api/campaigns/:id - Actualizar campaña
app.put('/api/campaigns/:id', authenticateToken, async (req, res) => {
  try {
    const campaignId = parseInt(req.params.id);
    const {
      nombre,
      descripcion,
      fecha_inicio,
      fecha_fin,
      presupuesto,
      id_red_social,
      estado
    } = req.body;

    // Verificar si la campaña existe
    const [existing] = await pool.query(
      'SELECT id_campana FROM campanas WHERE id_campana = ?',
      [campaignId]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Campaña no encontrada'
      });
    }

    await pool.query(`
      UPDATE campanas SET
        nombre = ?,
        descripcion = ?,
        fecha_inicio = ?,
        fecha_fin = ?,
        presupuesto = ?,
        id_red_social = ?,
        estado = ?
      WHERE id_campana = ?
    `, [
      nombre,
      descripcion || null,
      fecha_inicio || null,
      fecha_fin || null,
      presupuesto || null,
      id_red_social || null,
      estado,
      campaignId
    ]);

    // Obtener la campaña actualizada
    const [campaigns] = await pool.query(`
      SELECT c.*, rs.nombre as red_social_nombre
      FROM campanas c
      LEFT JOIN redes_sociales rs ON c.id_red_social = rs.id_red_social
      WHERE c.id_campana = ?
    `, [campaignId]);

    res.json({
      success: true,
      message: 'Campaña actualizada exitosamente',
      campaign: campaigns[0]
    });

  } catch (error) {
    console.error('Error actualizando campaña:', error);
    res.status(500).json({
      success: false,
      message: 'Error en el servidor'
    });
  }
});

// DELETE /api/campaigns/:id - Eliminar campaña
app.delete('/api/campaigns/:id', authenticateToken, async (req, res) => {
  try {
    const campaignId = parseInt(req.params.id);

    // Verificar si la campaña existe
    const [existing] = await pool.query(
      'SELECT id_campana FROM campanas WHERE id_campana = ?',
      [campaignId]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Campaña no encontrada'
      });
    }

    // Verificar si hay leads asociados
    const [leads] = await pool.query(
      'SELECT COUNT(*) as count FROM leads WHERE id_campana = ?',
      [campaignId]
    );

    if (leads[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: `No se puede eliminar. Hay ${leads[0].count} lead(s) asociado(s) a esta campaña`
      });
    }

    await pool.query('DELETE FROM campanas WHERE id_campana = ?', [campaignId]);

    res.json({
      success: true,
      message: 'Campaña eliminada exitosamente'
    });

  } catch (error) {
    console.error('Error eliminando campaña:', error);
    res.status(500).json({
      success: false,
      message: 'Error en el servidor'
    });
  }
});

// PATCH /api/campaigns/:id/status - Cambiar estado de campaña
app.patch('/api/campaigns/:id/status', authenticateToken, async (req, res) => {
  try {
    const campaignId = parseInt(req.params.id);
    const { estado } = req.body;

    if (!['activa', 'pausada', 'finalizada'].includes(estado)) {
      return res.status(400).json({
        success: false,
        message: 'Estado inválido. Debe ser: activa, pausada o finalizada'
      });
    }

    await pool.query(
      'UPDATE campanas SET estado = ? WHERE id_campana = ?',
      [estado, campaignId]
    );

    // Obtener la campaña actualizada
    const [campaigns] = await pool.query(`
      SELECT c.*, rs.nombre as red_social_nombre
      FROM campanas c
      LEFT JOIN redes_sociales rs ON c.id_red_social = rs.id_red_social
      WHERE c.id_campana = ?
    `, [campaignId]);

    res.json({
      success: true,
      message: `Campaña ${estado}`,
      campaign: campaigns[0]
    });

  } catch (error) {
    console.error('Error cambiando estado:', error);
    res.status(500).json({
      success: false,
      message: 'Error en el servidor'
    });
  }
});

// GET /api/campaigns/:id/stats - Estadísticas de campaña
app.get('/api/campaigns/:id/stats', authenticateToken, async (req, res) => {
  try {
    const campaignId = parseInt(req.params.id);

    const [stats] = await pool.query(`
      SELECT 
        COUNT(DISTINCT l.id_lead) as total_leads,
        COUNT(DISTINCT c.id_cliente) as total_clientes,
        SUM(CASE WHEN l.estado = 'caliente' THEN 1 ELSE 0 END) as leads_calientes,
        SUM(CASE WHEN l.estado = 'frio' THEN 1 ELSE 0 END) as leads_frios,
        SUM(CASE WHEN l.estado = 'prospecto' THEN 1 ELSE 0 END) as leads_prospectos,
        CASE 
          WHEN COUNT(DISTINCT l.id_lead) > 0 
          THEN COUNT(DISTINCT c.id_cliente) * 100.0 / COUNT(DISTINCT l.id_lead)
          ELSE 0
        END as tasa_conversion
      FROM leads l
      LEFT JOIN clientes c ON l.id_lead = c.id_lead
      WHERE l.id_campana = ?
    `, [campaignId]);

    res.json({
      success: true,
      stats: stats[0]
    });

  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Error en el servidor'
    });
  }
});

// ============================================
// RUTAS DE REDES SOCIALES
// ============================================

// GET /api/social-networks - Obtener todas las redes sociales
app.get('/api/social-networks', authenticateToken, async (req, res) => {
  try {
    const { activo } = req.query;

    let query = 'SELECT * FROM redes_sociales WHERE 1=1';
    const params = [];

    if (activo !== undefined) {
      query += ' AND activo = ?';
      params.push(activo === 'true' ? 1 : 0);
    }

    query += ' ORDER BY nombre ASC';

    const [networks] = await pool.query(query, params);

    res.json({
      success: true,
      social_networks: networks
    });

  } catch (error) {
    console.error('Error obteniendo redes sociales:', error);
    res.status(500).json({
      success: false,
      message: 'Error en el servidor'
    });
  }
});

// GET /api/social-networks/:id - Obtener una red social por ID
app.get('/api/social-networks/:id', authenticateToken, async (req, res) => {
  try {
    const networkId = parseInt(req.params.id);

    const [networks] = await pool.query(
      'SELECT * FROM redes_sociales WHERE id_red_social = ?',
      [networkId]
    );

    if (networks.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Red social no encontrada'
      });
    }

    res.json({
      success: true,
      social_network: networks[0]
    });

  } catch (error) {
    console.error('Error obteniendo red social:', error);
    res.status(500).json({
      success: false,
      message: 'Error en el servidor'
    });
  }
});

// POST /api/social-networks - Crear nueva red social
app.post('/api/social-networks', authenticateToken, async (req, res) => {
  try {
    const { nombre, icono, color, url, activo = true } = req.body;

    if (!nombre) {
      return res.status(400).json({
        success: false,
        message: 'El nombre es requerido'
      });
    }

    const [result] = await pool.query(`
      INSERT INTO redes_sociales (nombre, icono, color, url, activo)
      VALUES (?, ?, ?, ?, ?)
    `, [nombre, icono || null, color || null, url || null, activo]);

    // Obtener la red social creada
    const [networks] = await pool.query(
      'SELECT * FROM redes_sociales WHERE id_red_social = ?',
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      message: 'Red social creada exitosamente',
      social_network: networks[0]
    });

  } catch (error) {
    console.error('Error creando red social:', error);
    res.status(500).json({
      success: false,
      message: 'Error en el servidor'
    });
  }
});

// PUT /api/social-networks/:id - Actualizar red social
app.put('/api/social-networks/:id', authenticateToken, async (req, res) => {
  try {
    const networkId = parseInt(req.params.id);
    const { nombre, icono, color, url, activo } = req.body;

    // Verificar si existe
    const [existing] = await pool.query(
      'SELECT id_red_social FROM redes_sociales WHERE id_red_social = ?',
      [networkId]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Red social no encontrada'
      });
    }

    await pool.query(`
      UPDATE redes_sociales SET
        nombre = ?,
        icono = ?,
        color = ?,
        url = ?,
        activo = ?
      WHERE id_red_social = ?
    `, [nombre, icono || null, color || null, url || null, activo, networkId]);

    // Obtener la red social actualizada
    const [networks] = await pool.query(
      'SELECT * FROM redes_sociales WHERE id_red_social = ?',
      [networkId]
    );

    res.json({
      success: true,
      message: 'Red social actualizada exitosamente',
      social_network: networks[0]
    });

  } catch (error) {
    console.error('Error actualizando red social:', error);
    res.status(500).json({
      success: false,
      message: 'Error en el servidor'
    });
  }
});

// DELETE /api/social-networks/:id - Eliminar red social
app.delete('/api/social-networks/:id', authenticateToken, async (req, res) => {
  try {
    const networkId = parseInt(req.params.id);

    // Verificar si existe
    const [existing] = await pool.query(
      'SELECT id_red_social FROM redes_sociales WHERE id_red_social = ?',
      [networkId]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Red social no encontrada'
      });
    }

    // Verificar si hay campañas asociadas
    const [campaigns] = await pool.query(
      'SELECT COUNT(*) as count FROM campanas WHERE id_red_social = ?',
      [networkId]
    );

    if (campaigns[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: `No se puede eliminar. Hay ${campaigns[0].count} campaña(s) asociada(s)`
      });
    }

    await pool.query('DELETE FROM redes_sociales WHERE id_red_social = ?', [networkId]);

    res.json({
      success: true,
      message: 'Red social eliminada exitosamente'
    });

  } catch (error) {
    console.error('Error eliminando red social:', error);
    res.status(500).json({
      success: false,
      message: 'Error en el servidor'
    });
  }
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
// SOCKET.IO - REAL-TIME NOTIFICATIONS
// ============================================

// Middleware de autenticación para Socket.IO
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  
  if (!token) {
    return next(new Error('Authentication error'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    socket.userEmail = decoded.email;
    next();
  } catch (error) {
    next(new Error('Authentication error'));
  }
});

// Conexiones de Socket.IO
io.on('connection', (socket) => {
  console.log(`✅ Usuario conectado: ${socket.userEmail} (ID: ${socket.userId})`);
  
  // Unirse a la sala del usuario
  socket.join(`user_${socket.userId}`);
  
  // Evento: marcar como leída
  socket.on('mark_as_read', async (data) => {
    try {
      const { notification_id } = data;
      
      await pool.query(
        'UPDATE notificaciones SET leido = TRUE WHERE id_notificacion = ? AND id_usuario = ?',
        [notification_id, socket.userId]
      );
      
      // Emitir a todas las conexiones del usuario
      io.to(`user_${socket.userId}`).emit('notification_read', { notification_id });
      
      console.log(`✅ Notificación ${notification_id} marcada como leída por usuario ${socket.userId}`);
    } catch (error) {
      console.error('Error marcando notificación como leída:', error);
      socket.emit('error', { message: 'Error al marcar como leída' });
    }
  });
  
  // Evento: eliminar notificación
  socket.on('delete_notification', async (data) => {
    try {
      const { notification_id } = data;
      
      await pool.query(
        'DELETE FROM notificaciones WHERE id_notificacion = ? AND id_usuario = ?',
        [notification_id, socket.userId]
      );
      
      // Emitir a todas las conexiones del usuario
      io.to(`user_${socket.userId}`).emit('notification_deleted', { notification_id });
      
      console.log(`🗑️ Notificación ${notification_id} eliminada por usuario ${socket.userId}`);
    } catch (error) {
      console.error('Error eliminando notificación:', error);
      socket.emit('error', { message: 'Error al eliminar notificación' });
    }
  });
  
  // Desconexión
  socket.on('disconnect', () => {
    console.log(`❌ Usuario desconectado: ${socket.userEmail} (ID: ${socket.userId})`);
  });
});

// Función helper para enviar notificaciones en tiempo real
global.sendNotificationToUser = (userId, notification) => {
  io.to(`user_${userId}`).emit('notification', notification);
  console.log(`📨 Notificación enviada a usuario ${userId}:`, notification.titulo);
};

// ============================================
// INICIAR SERVIDOR
// ============================================

server.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔═══════════════════════════════════════════════╗
║   🚀 CRM Backend Server                       ║
║   📡 Local: http://localhost:${PORT}          ║
║   📡 Red: http://192.168.0.107:${PORT}        ║
║   🗄️  Base de Datos: ${process.env.DB_HOST}              ║
║   📝 Entorno: ${process.env.NODE_ENV}                ║
║   ⏰ Iniciado: ${new Date().toLocaleString()}  ║
║   🔌 Socket.IO: Activo                        ║
╚═══════════════════════════════════════════════╝
  `);
});

// Manejo de cierre graceful
process.on('SIGTERM', () => {
  console.log('SIGTERM recibido. Cerrando servidor...');
  pool.end();
  process.exit(0);
});
