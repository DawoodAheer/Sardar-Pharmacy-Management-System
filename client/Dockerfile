# ===================================================
# Multi-stage Dockerfile for Pharma Desk Frontend
# Stage 1: Build React production bundle
# Stage 2: Serve with lightweight Nginx
# ===================================================

FROM node:20-slim AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install all dependencies (including devDependencies needed for build)
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Pass build arg VITE_API_URL="" so frontend uses relative /api reverse proxy
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL

# Build production assets into /app/dist
RUN npm run build

# ===================================================
# Stage 2: Production Nginx Server
# ===================================================
FROM nginx:alpine

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy built frontend assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose HTTP port
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
