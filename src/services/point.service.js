import prisma from '../../prisma/client.js';
import { PointTransactionNotFoundError } from '../errors/customErrors.js';

// 현재 포인트 조회 
export const getCurrentPointByUserIdService = async (userId) => {
  const result = await prisma.pointTransaction.aggregate({
    where: { userId: Number(userId) },
    _sum: { point: true },
  });

  const total = result._sum.point;

  if (total === null) {
    throw new PointTransactionNotFoundError({ userId });
  }

  return total;
};

// 포인트 내역 조회 
export const getPointTransactionsByUserId = async (userId) => {
  const transactions = await prisma.pointTransaction.findMany({
    where: {
      userId: Number(userId), 
    },
    orderBy: {
      createdAt: 'desc',
    },
    include: {
      stampBook: {
        include: {
          cafe: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  if (!transactions || transactions.length === 0) {
    throw new PointTransactionNotFoundError({ userId });
  }

  return transactions.map((tx) => ({
    id: tx.id,
    point: tx.point,
    type: tx.type,
    description: tx.description,
    createdAt: tx.createdAt,
    cafeName: tx.stampBook?.cafe?.name ?? null,
  }));
};