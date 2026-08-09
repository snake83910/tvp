FROM node:20-slim AS deps
WORKDIR /app
# package-lock.json + `npm ci` : le build installe exactement les versions
# testées en CI. Avec `npm install` sans lockfile, deux builds à deux dates
# n'embarquent pas les mêmes dépendances — une régression peut apparaître
# en production sans qu'aucun commit n'ait changé.
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# API_URL_INTERNAL doit être connu au build : next build() évalue rewrites()
# à la compilation, pas à l'exécution. http://api:8000 = hostname Docker interne.
ENV API_URL_INTERNAL=http://api:8000
RUN npm run build

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
