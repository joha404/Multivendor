import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
export const connectDatabase = async () => {
    try {
        await prisma.$connect();
        console.log('Database connected');
    }
    catch {
        console.error('Database disconnected');
        throw new Error('Unable to connect to the database');
    }
};
export const disconnectDatabase = async () => {
    await prisma.$disconnect();
    console.log('Database disconnected');
};
export default prisma;
//# sourceMappingURL=db.js.map