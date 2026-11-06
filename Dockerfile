# Experimental cloud build. Not production-safe without browser sandbox,
# HTTPS, private auth, encrypted persistent storage and tested isolation.
FROM mcr.microsoft.com/playwright:v1.63.0-noble
WORKDIR /app
ENV NODE_ENV=production \
    WORKMODE_CLOUD_MODE=1 \
    WORKMODE_DATA_DIR=/data \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# gosu allows Railway's root-owned volume to be prepared, then drops root
# for the application and Chromium.
RUN apt-get update \
    && apt-get install -y --no-install-recommends gosu \
    && rm -rf /var/lib/apt/lists/*
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY . .
RUN mkdir -p /data \
    && chown pwuser:pwuser /data \
    && chmod 0700 /data \
    && chmod 0755 /app/docker-entrypoint.sh
EXPOSE 3168
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "server.js"]
