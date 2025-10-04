# syntax=docker/dockerfile:1

# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files for workspace setup
COPY package*.json ./
COPY frontend/package*.json ./frontend/

# Install dependencies for the workspace and frontend
RUN npm ci && npm cache clean --force

# Copy source code and config files
COPY . .

# Build only the frontend application
# Inject build-time environment variables for Vite
ARG VITE_API_URL=https://api.pagina1digital.com.br/api
ARG VITE_BACKEND_ORIGIN=https://api.pagina1digital.com.br
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_BACKEND_ORIGIN=${VITE_BACKEND_ORIGIN}
RUN cd frontend && VITE_API_URL=$VITE_API_URL VITE_BACKEND_ORIGIN=$VITE_BACKEND_ORIGIN npm run build

# Production stage
FROM nginx:alpine AS production

# Copy custom nginx config
COPY <<EOF /etc/nginx/conf.d/default.conf
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Handle client-side routing (disable cache for HTML responses)
    location / {
        try_files $uri $uri/ /index.html;
        # Ensure HTML is never cached (so new JS/CSS manifests are picked up)
        add_header Cache-Control "no-store, no-cache, must-revalidate, max-age=0" always;
        add_header Pragma "no-cache" always;
        add_header Expires "0" always;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Proxy API requests to backend (failsafe for any relative /api calls)
    location ^~ /api/ {
        proxy_pass https://api.pagina1digital.com.br/api/;
        proxy_http_version 1.1;
        proxy_set_header Host api.pagina1digital.com.br;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # SSL configuration for upstream
        proxy_ssl_server_name on;
        proxy_ssl_name api.pagina1digital.com.br;
        proxy_ssl_verify off;
        
        # DNS resolution
        resolver 8.8.8.8 1.1.1.1 valid=300s;
        resolver_timeout 5s;

        # Increased timeouts to avoid 502 errors
        proxy_connect_timeout 30s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        proxy_buffering off;

        # CORS headers (OPTIONS preflight support)
        add_header Access-Control-Allow-Origin "*" always;
        add_header Access-Control-Allow-Credentials "true" always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Origin, Content-Type, Accept, Authorization" always;
        if ($request_method = OPTIONS) {
            return 204;
        }
    }

}
EOF

# Copy built application from builder stage
COPY --from=builder /app/frontend/dist /usr/share/nginx/html

# Create nginx user (idempotent: ignore if already exists)
RUN addgroup -g 1001 -S nginx || true && adduser -S -u 1001 -G nginx nginx || true

# Set proper permissions
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    chown -R nginx:nginx /etc/nginx/conf.d

# Switch to non-root user
USER nginx

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]