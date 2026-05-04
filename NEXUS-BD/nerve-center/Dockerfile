FROM node:20-alpine AS base

WORKDIR /app

# Install deps first (better layer caching)
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Run migrations on startup then launch the server
CMD ["sh", "-c", "node src/db/migrate.js && node src/app.js"]

EXPOSE 3001
