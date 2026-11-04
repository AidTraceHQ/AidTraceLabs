FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY --chown=node:node . .
RUN npm run build:server

ENV NODE_ENV=production
EXPOSE 3001
USER node

CMD ["node", "dist-server/server/index.js"]