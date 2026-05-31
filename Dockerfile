FROM node:20-alpine

WORKDIR /app

# 의존성 설치
COPY package*.json ./
RUN npm ci

# 소스 복사
COPY . .

# Prisma 클라이언트 생성
RUN npx prisma generate

# Next.js 빌드
RUN npm run build

# 데이터 디렉토리 생성 (SQLite, push-subscription)
RUN mkdir -p /app/data /app/prisma

EXPOSE 3000

# 마이그레이션 실행 후 서버 시작
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
