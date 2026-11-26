FROM mcr.microsoft.com/playwright:v1.47.0-jammy

WORKDIR /app

COPY package.json package-lock.json prepare-fonts.js ./
RUN npm ci --omit=dev

COPY server.js layouts.js font-css.js ./
COPY backgrounds ./backgrounds

ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
