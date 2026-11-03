FROM node:26.13.0-alpine AS builder

# Reduce npm log spam and colour during install
ENV NPM_CONFIG_LOGLEVEL=warn
ENV NPM_CONFIG_COLOR=false

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# `prebuild` copies the OCR / background-removal assets into public/vendor first
RUN npm run build
# Build metadata served at /info
RUN node -e "const p=require('./package.json');require('fs').writeFileSync('dist/info.json',JSON.stringify({name:p.name,version:p.version,builtAt:new Date().toISOString()}))"

# Create production image
FROM nginx:1.27.5-alpine AS deploy
COPY nginx/nginx.conf /etc/nginx/nginx.conf
COPY nginx/security-headers.conf /etc/nginx/security-headers.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
