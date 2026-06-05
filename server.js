require('dotenv').config();
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');

// --- Validação de variáveis de ambiente obrigatórias ---
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error('FATAL: JWT_SECRET não definido ou muito curto! Defina uma chave de pelo menos 32 caracteres no .env');
  process.exit(1);
}

// --- Prisma Client (logs apenas em desenvolvimento) ---
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'info', 'warn', 'error']
    : ['error'],
  errorFormat: 'minimal',
});

const app = express();
const PORT = process.env.PORT || 3000;

// ═══════════════════════════════════════════════
// MIDDLEWARES DE SEGURANÇA
// ═══════════════════════════════════════════════

// Headers de segurança HTTP (X-Frame-Options, X-Content-Type-Options, HSTS, etc.)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'"],
    },
  },
}));

// CORS restrito a origens permitidas
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : [];

app.use(cors({
  origin: (origin, callback) => {
    // Permite requisições same-origin (sem header Origin) e origens autorizadas
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Origem não autorizada pelo CORS.'));
    }
  },
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
  credentials: true,
}));

// Limita tamanho do body para evitar payloads gigantes
app.use(express.json({ limit: '10kb' }));

// Rate Limiting geral para toda a API
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100,                 // Máx. 100 requisições por IP
  message: { error: 'Muitas requisições. Tente novamente em 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate Limiting rigoroso para rotas de autenticação (anti brute-force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10,                  // Máx. 10 tentativas por IP
  message: { error: 'Muitas tentativas. Aguarde 15 minutos para tentar novamente.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', apiLimiter);

// ═══════════════════════════════════════════════
// VALIDAÇÕES REUTILIZÁVEIS (express-validator)
// ═══════════════════════════════════════════════

const registerValidation = [
  body('nome')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Nome deve ter entre 2 e 100 caracteres.')
    .escape(),
  body('email')
    .isEmail()
    .withMessage('E-mail inválido.')
    .normalizeEmail(),
  body('telefone')
    .trim()
    .isLength({ min: 10, max: 15 })
    .withMessage('Telefone deve ter entre 10 e 15 caracteres.')
    .matches(/^[\d\s\-\(\)\+]+$/)
    .withMessage('Telefone contém caracteres inválidos.'),
  body('macAddress')
    .optional({ nullable: true })
    .matches(/^([0-9A-Fa-f]{2}[:\-]){5}[0-9A-Fa-f]{2}$/)
    .withMessage('MAC Address inválido.'),
  body('ipAddress')
    .optional({ nullable: true })
    .isIP()
    .withMessage('Endereço IP inválido.'),
];

const loginValidation = [
  body('email')
    .isEmail()
    .withMessage('E-mail inválido.')
    .normalizeEmail(),
  body('telefone')
    .trim()
    .isLength({ min: 10, max: 15 })
    .withMessage('Telefone deve ter entre 10 e 15 caracteres.')
    .matches(/^[\d\s\-\(\)\+]+$/)
    .withMessage('Telefone contém caracteres inválidos.'),
];

// ═══════════════════════════════════════════════
// ROTAS DA API
// ═══════════════════════════════════════════════

// Rota POST /api/register
app.post('/api/register', authLimiter, registerValidation, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Dados inválidos. Verifique os campos preenchidos.' });
    }

    const { nome, email, telefone, macAddress, ipAddress } = req.body;

    // Verifica e-mail existente
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      // Mensagem genérica para evitar enumeração de e-mails
      return res.status(400).json({ error: 'Não foi possível completar o cadastro. Verifique os dados informados.' });
    }

    // Cria o usuário no banco MySQL
    const user = await prisma.user.create({
      data: {
        nome,
        email,
        telefone,
        macAddress: macAddress || null,
        ipAddress: ipAddress || null,
      },
    });

    return res.status(201).json({
      message: 'Usuário cadastrado com sucesso!',
      userId: user.id,
    });
  } catch (error) {
    next(error);
  }
});

// Rota POST /api/login
app.post('/api/login', authLimiter, loginValidation, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Dados inválidos. Verifique os campos preenchidos.' });
    }

    const { email, telefone } = req.body;

    // Busca usuário no banco remoto
    const user = await prisma.user.findUnique({
      where: { email },
    });

    // Mensagem genérica para evitar enumeração (não revela se o email existe)
    if (!user || user.telefone !== telefone) {
      return res.status(400).json({ error: 'Credenciais inválidas.' });
    }

    // Geração do token JWT
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, {
      expiresIn: '24h',
    });

    // Token enviado via cookie HttpOnly (inacessível por JavaScript = proteção XSS)
    res.cookie('session_token', token, {
      httpOnly: true,      // JavaScript não consegue acessar
      secure: process.env.NODE_ENV === 'production', // HTTPS obrigatório em produção
      sameSite: 'strict',  // Proteção contra CSRF
      maxAge: 24 * 60 * 60 * 1000, // 24 horas
    });

    return res.status(200).json({
      message: 'Login realizado com sucesso!',
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════
// TRATAMENTO GLOBAL DE ERROS
// ═══════════════════════════════════════════════

// Evita crash de Serverless Functions da Vercel
app.use((err, req, res, next) => {
  console.error('Erro Capturado no Middleware Global:', err);

  // Erros específicos de conexão do Prisma / Banco de dados remoto legado
  if (err.code && err.code.startsWith('P')) {
    return res.status(503).json({
      error: 'Serviço temporariamente indisponível. Falha na conexão com o banco de dados remoto.',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }

  return res.status(500).json({
    error: 'Ocorreu um erro interno no servidor.',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// ═══════════════════════════════════════════════
// INICIALIZAÇÃO
// ═══════════════════════════════════════════════

// Usado para desenvolvimento local, Vercel usa o express exposto via app
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Servidor rodando localmente na porta ${PORT}`);
  });
}

// Exporta a app para o builder do Vercel Serverless
module.exports = app;
