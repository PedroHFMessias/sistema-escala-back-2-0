import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma';

export class AuthService {
  async register(data: any) {
    const { name, email, password, role } = data;

    const userExists = await prisma.user.findUnique({
      where: { email }
    });

    if (userExists) {
      throw { status: 400, message: 'E-mail já cadastrado' };
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role
      }
    });

    return user;
  }

  async login(email: string, password: string) {
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      throw { status: 400, message: 'Usuário não encontrado' };
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);

    if (!isValid) {
      throw { status: 401, message: 'Senha inválida' };
    }

    const token = jwt.sign(
      {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      process.env.JWT_SECRET as string,
      { expiresIn: '7d' }
    );

    return { token, user };
  }
}
