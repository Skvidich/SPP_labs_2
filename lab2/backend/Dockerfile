FROM node:24-alpine

WORKDIR /app/backend

COPY backend/package*.json ./

RUN npm ci

COPY backend/ ./
COPY frontend/ /app/frontend/

RUN mkdir -p /app/backend/uploads

EXPOSE 3000

CMD ["node", "src/server.js"]