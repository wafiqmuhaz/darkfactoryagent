import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config';

const prisma = new PrismaClient();

export interface RegisterInput {
  username: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResult {
  user: { id: string; username: string; email: string };
  token: string;
}

export class AuthService {
  async register(input: RegisterInput): Promise<AuthResult> {
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { email: input.email },
          { username: input.username },
        ],
      },
    });

    if (existing) {
      throw new Error(
        existing.email === input.email
          ? 'Email already registered'
          : 'Username already taken'
      );
    }

    const passwordHash = await bcrypt.hash(input.password, 12);

    const user = await prisma.user.create({
      data: {
        username: input.username,
        email: input.email,
        passwordHash,
      },
    });

    const token = this.generateToken(user.id);

    return {
      user: { id: user.id, username: user.username, email: user.email },
      token,
    };
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const user = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (!user) {
      throw new Error('Invalid email or password');
    }

    const isValid = await bcrypt.compare(input.password, user.passwordHash);
    if (!isValid) {
      throw new Error('Invalid email or password');
    }

    const token = this.generateToken(user.id);

    return {
      user: { id: user.id, username: user.username, email: user.email },
      token,
    };
  }

  async getUser(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, email: true, avatarUrl: true, createdAt: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }

  private generateToken(userId: string): string {
    return jwt.sign({ userId }, config.jwtSecret, {
      expiresIn: config.jwtExpiresIn,
    } as jwt.SignOptions);
  }
}

export const authService = new AuthService();
