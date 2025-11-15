// src/createDirector.ts

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

// Inicializa o Prisma
const prisma = new PrismaClient();

// Função principal assíncrona
async function main() {
  console.log('A iniciar o script para criar o Diretor...');

  // Dados do Diretor, baseados na maquete
  const email = 'director@paroquia.com';
  const password = 'password';

  // 1. Encriptar a senha
  const hashedPassword = await bcrypt.hash(password, 10);

  // 2. Criar o utilizador Diretor
  try {
    const director = await prisma.user.create({
      data: {
        email: email,
        password: hashedPassword,
        name: 'Diretor Admin',
        role: 'DIRECTOR', // O papel mais importante
        status: 'active',
        // Dados fictícios para campos obrigatórios (conforme o schema.prisma)
        phone: '(00) 00000-0000',
        cpf: '000.000.000-00',
        rg: '00.000.000-0',
      },
    });

    console.log('✅ Utilizador Diretor criado com sucesso!');
    console.log(director);

  } catch (error: any) {
    // Código P2002 é "Unique constraint failed" (violação de restrição única)
    if (error.code === 'P2002') {
      console.warn('⚠️  O utilizador Diretor (ou o CPF/RG/Email) já existe no banco de dados.');
    } else {
      console.error('Erro ao criar o utilizador Diretor:', error);
    }
  }
}

// Executa a função principal e desliga o Prisma no final
main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    // Fecha a conexão com o banco de dados
    await prisma.$disconnect();
  });