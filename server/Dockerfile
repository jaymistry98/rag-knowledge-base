# =============================================================================
# Dockerfile — Backend (Fastify API Server)
# =============================================================================
# Builds the Fastify backend into a lightweight container.
# Same pattern as Project 1's Dockerfile.
# =============================================================================

# Use Node.js 20 slim as the base image (~200MB)
FROM node:20-slim

# Set working directory inside the container
WORKDIR /app

# Copy package files first (for Docker layer caching)
# If dependencies haven't changed, Docker reuses the cached npm install layer
COPY package.json package-lock.json ./

# Install production dependencies only (skip devDependencies)
RUN npm ci --omit=dev

# Copy the rest of the backend source code
COPY . .

# Document which port the server listens on
EXPOSE 3001

# Health check — Docker uses this to monitor container health
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3001/health').then(r=>{if(!r.ok)throw new Error();process.exit(0)}).catch(()=>process.exit(1))"

# Start the Fastify server
CMD ["node", "server.js"]