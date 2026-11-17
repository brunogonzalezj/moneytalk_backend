# API de MoneyTalk. Al arrancar aplica las migraciones pendientes y levanta el servidor.
FROM node:22-alpine AS build
WORKDIR /app
# prisma generate only reads the schema, but prisma.config.ts insists on a URL; the real one comes at runtime
ARG DATABASE_URL=mysql://build:build@localhost:3306/build
COPY package*.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=build /app/package*.json /app/prisma.config.ts ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
