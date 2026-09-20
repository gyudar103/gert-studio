FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM dependencies AS development
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev"]

FROM dependencies AS browser-tests
RUN npx playwright install --with-deps chromium
COPY . .
CMD ["npm", "run", "test:e2e"]
