require('dotenv').config();
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'divina_luz_secret_key';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Cadastro
app.post('/api/register', async (req, res) => {
  const { nome, email, telefone, senha, confirmaSenha } = req.body;

  if (!nome || !email || !senha || !confirmaSenha) {
    return res.status(400).json({ error: 'Preencha todos os campos obrigatórios.' });
  }

  if (senha !== confirmaSenha) {
    return res.status(400).json({ error: 'As senhas não coincidem.' });
  }

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Email já cadastrado.' });
    }

    const hashedPassword = await bcrypt.hash(senha, 10);

    const user = await prisma.user.create({
      data: {
        nome,
        email,
        telefone,
        senha: hashedPassword
      }
    });

    res.status(201).json({ message: 'Usuário cadastrado com sucesso!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.status(400).json({ error: 'Preencha email e senha.' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(400).json({ error: 'Email ou senha incorretos.' });
    }

    const isMatch = await bcrypt.compare(senha, user.senha);
    if (!isMatch) {
      return res.status(400).json({ error: 'Email ou senha incorretos.' });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '1h' });

    res.json({ message: 'Login realizado com sucesso!', token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
