# ClipAndPost AI: production image with ffmpeg, yt-dlp and deno included.
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-bookworm-slim
WORKDIR /app
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg python3 python3-pip ca-certificates fonts-inter \
 && pip3 install --no-cache-dir --break-system-packages "yt-dlp[default]" \
 && rm -rf /var/lib/apt/lists/*
# yt-dlp uses a JavaScript runtime to read YouTube's player.
COPY --from=denoland/deno:bin /deno /usr/local/bin/deno
ENV NODE_ENV=production PORT=3000 DATA_DIR=/data
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/next.config.ts ./
VOLUME /data
EXPOSE 3000
CMD ["npm", "start"]
