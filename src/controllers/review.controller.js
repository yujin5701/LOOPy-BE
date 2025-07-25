import prisma from "../../prisma/client.js";
import { uploadToS3 } from "../utils/s3.js";
import {
  InvalidReviewTitleError,
  InvalidReviewContentError,
  ReviewNotFoundError,
  ForbiddenReviewAccessError,
} from "../errors/customErrors.js";

export const createReview = async (req, res, next) => {
  try {
    const { title, content } = req.body;
    const { cafeId } = req.params;
    const userId = req.user.id; 
    const files = req.files;

    if (!title || title.length < 20) {
      return next(new InvalidReviewTitleError(title));
    }

    if (!content || content.length < 500) {
      return next(new InvalidReviewContentError(content));
    }

    if (files.length > 5) {
      return next(new TooManyImagesError(files.length));
    }
    
    for (const file of files) {
      if (!file.mimetype.startsWith("image/")) {
        return next(new InvalidImageTypeError(file.mimetype));
      }
    }

    let imageUrls = [];
    if (files && files.length > 0) {
      imageUrls = await Promise.all(
        files.map((file) => uploadToS3(file)) // S3에 업로드
      );
    }

    const review = await prisma.review.create({
      data: {
        title,
        content,
        cafeId: parseInt(cafeId),
        userId,
        images: imageUrls,
      },
    });

    return res.success({
      message: "리뷰 작성 성공",
      review,
    });
  } catch (err) {
    next(err);
  }
};

export const updateReview = async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    const { title, content } = req.body;
    const userId = parseInt(req.user.id);

    const review = await prisma.review.findUnique({
      where: { id: parseInt(reviewId) },
    });

    if (!review) {
      return next(new ReviewNotFoundError(reviewId));
    }

    if (review.userId !== userId) {
      return next(new ForbiddenReviewAccessError(userId, review.userId));
    }

    const updatedReview = await prisma.review.update({
      where: { id: parseInt(reviewId) },
      data: {
        title,
        content,
        updatedAt: new Date(),
      },
    });

    return res.success({
      message: "리뷰 수정 성공",
      review: updatedReview,
    });
  } catch (err) {
    next(err);
  }
};

export const deleteReview = async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    const userId = parseInt(req.user.id);

    const review = await prisma.review.findUnique({
      where: { id: parseInt(reviewId) },
    });

    if (!review) {
      return next(new ReviewNotFoundError(reviewId));
    }

    if (review.userId !== userId) {
      return next(new ForbiddenReviewAccessError(userId, review.userId));
    }

    await prisma.review.delete({
      where: { id: parseInt(reviewId) },
    });

    return res.success({
      message: "리뷰 삭제 성공!",
    });
  } catch (err) {
    next(err);
  }
};

export const getMyReviews = async (req, res, next) => {
  try {
    const userId = parseInt(req.user.id);
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [total, reviews] = await Promise.all([
      prisma.review.count({ where: { userId } }),
      prisma.review.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          cafe: {
            select: {
              id: true,
              name: true
            }
          }
        }
      })
    ]);

    const formatted = reviews.map((review) => ({
      reviewId: review.id,
      cafeId: review.cafe.id,
      cafeName: review.cafe.name,
      title: review.title,
      content: review.content,
      images: review.images || [],
      createdAt: review.createdAt
    }));

    return res.success({
      message: '내가 쓴 리뷰 목록 조회 성공',
      data: formatted,
      pagination: {
        page,
        limit,
        total
      }
    });
  } catch (err) {
    next(err);
  }
};