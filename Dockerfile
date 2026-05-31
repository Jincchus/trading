FROM node:20-alpine

WORKDIR /app

# 의존성 설치
COPY package*.json ./
RUN npm ci

# 소스 복사
COPY . .

# Prisma 클라이언트 생성
RUN npx prisma generate

# 빌드 시 env 검증 통과용 더미값 (런타임엔 docker-compose의 env_file로 덮어씌워짐)
ENV ALPACA_API_KEY=build_placeholder \
    ALPACA_API_SECRET=build_placeholder \
    ALPACA_BASE_URL=https://paper-api.alpaca.markets \
    ALPACA_DATA_URL=https://data.alpaca.markets \
    ALPACA_WS_URL=wss://stream.data.alpaca.markets/v2/iex \
    FMP_API_KEY=build_placeholder \
    EXCHANGE_RATE_API_KEY=build_placeholder \
    VAPID_PUBLIC_KEY=BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U \
    VAPID_PRIVATE_KEY=UUxI4O8-FbRouAevSmBQ6o18hgE4nSG3qwvJTWKSkFU \
    VAPID_EMAIL=admin@example.com \
    DATABASE_URL=file:/app/prisma/trading.db \
    PORT=3000

# Next.js 빌드
RUN npm run build

# 데이터 디렉토리 생성
RUN mkdir -p /app/data

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
