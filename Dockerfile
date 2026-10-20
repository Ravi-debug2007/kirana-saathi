FROM node:22.14.0-bookworm
WORKDIR /app
COPY package*.json ./
COPY packages/domain/package.json ./packages/domain/package.json
COPY packages/api/package.json ./packages/api/package.json
RUN npm ci
COPY . .
RUN npm test && npm run typecheck
EXPOSE 3000
CMD ["npm", "run", "api:dev"]
