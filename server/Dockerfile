# ===================================================
# Pharmadesk Backend Dockerfile (Node 20 Slim)
# Includes local OCR model for 100% offline usage
# ===================================================

FROM node:22-slim

WORKDIR /app

# Copy dependency definitions
COPY package*.json ./

# Install production dependencies
RUN npm ci --omit=dev

# Copy all server code (including eng.traineddata OCR model)
COPY . .

# Ensure uploads directory exists
RUN mkdir -p uploads

# Expose Express server port
EXPOSE 5000

ENV PORT=5000
ENV NODE_ENV=production

# Start backend server
CMD ["node", "--import", "./env-loader.js", "server.js"]
