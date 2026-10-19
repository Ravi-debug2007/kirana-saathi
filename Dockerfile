FROM node:20-bookworm
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run typecheck
CMD ["npm", "run", "start", "--", "--non-interactive"]
