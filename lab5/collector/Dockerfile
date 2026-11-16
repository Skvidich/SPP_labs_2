# syntax=docker/dockerfile:1

FROM node:24-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY src ./src

USER node

CMD ["node", "src/index.js"]