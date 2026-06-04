# =============================================================================
# Dockerfile — Frontend (React + Nginx Multi-Stage Build)
# =============================================================================
# Uses a TWO-STAGE build:
#   Stage 1 (build): Install deps + compile React into static HTML/JS/CSS
#   Stage 2 (serve): Copy static files into tiny Nginx image to serve them
#
# Why multi-stage?
#   Stage 1 image with node_modules = ~500MB
#   Stage 2 image with just static files = ~25MB
#   We get the build tools we need without shipping them to production.
# =============================================================================

# ---------------------------------------------------------------------------
# STAGE 1: BUILD — Compile the React app into static files
# ---------------------------------------------------------------------------
# "AS build" gives this stage a name we can reference later
FROM node:20-slim AS build

# Set working directory
WORKDIR /app

# Copy package files and install ALL dependencies (including devDeps)
# We need devDependencies (vite, etc.) to BUILD the React app.
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the source code
COPY . .

# Run the Vite build command.
# This compiles React JSX → plain HTML/JS/CSS in the /app/dist/ folder.
# These static files are all we need to serve the app.
RUN npm run build

# ---------------------------------------------------------------------------
# STAGE 2: SERVE — Serve the static files with Nginx
# ---------------------------------------------------------------------------
# Start fresh from a tiny Nginx image (~25MB).
# None of the node_modules or build tools carry over.
FROM nginx:alpine

# Copy our custom Nginx config that handles:
#   - Serving the React static files
#   - Proxying /api/ requests to the backend container
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy ONLY the built static files from Stage 1.
# --from=build references the first stage by its "AS build" name.
# /app/dist/ is where Vite outputs the compiled files.
# /usr/share/nginx/html/ is Nginx's default document root.
COPY --from=build /app/dist /usr/share/nginx/html

# Nginx listens on port 80 by default
EXPOSE 80

# Nginx starts automatically — no CMD needed (it's in the base image)