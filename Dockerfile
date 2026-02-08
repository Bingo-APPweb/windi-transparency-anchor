FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --omit=dev 2>/dev/null || npm install --omit=dev

# Copy source
COPY . .

ENV NODE_ENV=production
EXPOSE 4040

CMD ["node", "src/server.js"]
