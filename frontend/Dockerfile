FROM node:22-slim AS derleme
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production \
    PORT=30205 \
    HOSTNAME=0.0.0.0 \
    DATA_DIR=/app/data
COPY --from=derleme /app/.next/standalone ./
COPY --from=derleme /app/.next/static ./.next/static
COPY --from=derleme /app/public ./public
EXPOSE 30205
CMD ["node", "server.js"]
