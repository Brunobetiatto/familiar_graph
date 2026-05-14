import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

const createPrismaClient = () => {
  // Cria o pool de conexão nativo do pg usando a sua URL do .env
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  // Instancia o adaptador oficial do Prisma
  const adapter = new PrismaPg(pool);
  
  // Retorna o Prisma Client com o adaptador injetado, resolvendo o erro
  return new PrismaClient({ 
    adapter, 
    log: ['query'] 
  });
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;