require('dotenv').config();
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const prisma = new PrismaClient({
  log: ['error', 'warn'],
  errorFormat: 'minimal',
});

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'divina_luz_secret_key';

// Middlewares
app.use(cors());
app.use(express.json());

// Rota POST /api/register
app.post('/api/register', async (req, res, next) => {
  try {
    const { nome, email, telefone, macAddress, ipAddress } = req.body;

    if (!nome || !email || !telefone) {
      return res.status(400).json({ error: 'Preencha todos os campos obrigatórios.' });
    }

    // Verifica e-mail existente
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Este e-mail já está cadastrado.' });
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
app.post('/api/login', async (req, res, next) => {
  try {
    const { email, telefone } = req.body;

    if (!email || !telefone) {
      return res.status(400).json({ error: 'Preencha e-mail e telefone.' });
    }

    // Busca usuário no banco remoto
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(400).json({ error: 'E-mail ou telefone incorretos.' });
    }

    // Validação do telefone
    if (user.telefone !== telefone) {
      return res.status(400).json({ error: 'E-mail ou telefone incorretos.' });
    }

    // Geração do token JWT
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, {
      expiresIn: '24h',
    });

    return res.status(200).json({
      message: 'Login realizado com sucesso!',
      token,
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

// Tratamento global de erros (Evita crash de Serverless Functions da Vercel)
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

// Inicialização do servidor (Usado para desenvolvimento local, Vercel usa o express exposto via app)
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Servidor rodando localmente na porta ${PORT}`);
  });
}

// Exporta a app para o builder do Vercel Serverless
module.exports = app;
