import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../../prisma/client.js';


export const signup = async (req, res, next) => {
  try {
    const {
      email,
      password,
      nickname,
      phoneNumber,
      agreements
    } = req.body;
    console.log('body:', req.body);

    if (!email || !password || !nickname || !phoneNumber) {
  return res.error({
    errorCode: 'MISSING_FIELDS',
    reason: '필수 입력 항목이 누락되었습니다.'
  });
}



    // 중복 확인
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { phoneNumber: phoneNumber }
        ]
      }
    });

    if (existingUser) {
      return res.error({
        errorCode: 'USER_EXISTS',
        reason: '이미 가입된 이메일 또는 전화번호입니다.'
      });
    }

    // 비밀번호 해시
    const hashedPassword = await bcrypt.hash(password, 10);

    // 유저 + 약관 트랜잭션 저장
    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email,
          passwordHash: hashedPassword,
          nickname,
          phoneNumber: phoneNumber,
          role: 'CUSTOMER',
          allowKakaoAlert: false,
          status: 'active'
        }
      });

      await tx.userAgreement.create({
        data: {
          userId: createdUser.id,
          termsAgreed: agreements.termsAgreed,
          privacyPolicyAgreed: agreements.privacyPolicyAgreed,
          marketingAgreed: agreements.marketingAgreed,
          locationPermission: agreements.locationPermission,
          agreedAt: new Date()
        }
      });

      return createdUser;
    });

    return res.success({
      message: '회원가입 성공',
      userId: user.id.toString(), 
      nickname: user.nickname
    });
  } catch (err) {
    next(err); 
  }
};


export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // 1. 유저 찾기
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.error({
        errorCode: 'USER_NOT_FOUND',
        reason: '등록되지 않은 이메일입니다.',
      });
    }

    // 2. 비밀번호 일치 확인
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash || '');
    if (!isPasswordValid) {
      return res.error({
        errorCode: 'INVALID_PASSWORD',
        reason: '비밀번호가 일치하지 않습니다.',
      });
    }

    // 3. 토큰 발급
    const token = jwt.sign(
  { userId: user.id.toString(), role: user.role },
  process.env.JWT_SECRET,
  { expiresIn: '7d' }
);

    return res.success({
      message: '로그인 성공',
      token,
      user: {
        id: user.id.toString(), 
        email: user.email,
        nickname: user.nickname,
      },
    });
  } catch (err) {
    next(err);
  }
};