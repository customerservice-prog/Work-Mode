# Prototype deployment base only. Do not publish this service without
# strong cloud credentials, HTTPS, persistent storage and browser isolation.
FROM mcr.microsoft.com/playwright:v1.63.0-noble
WORKDIR /app
ENV NODE_ENV=production \
    WORKMODE_CLOUD_MODE=1 \
    WORKMODE_DATA_DIR=/data \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY . .
RUN mkdir -p /data && chown -R pwuser:pwuser /data /app
USER pwuser
EXPOSE 3168
CMD ["node","server.js"]
