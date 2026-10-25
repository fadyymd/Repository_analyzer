# ---- build the React client ----
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY server/package*.json server/
COPY client/package*.json client/
RUN npm --prefix server ci && npm --prefix client ci
COPY . .
RUN npm --prefix client run build

# ---- runtime ----
FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production PORT=4000
COPY --from=build /app/server ./server
COPY --from=build /app/client/dist ./client/dist
EXPOSE 4000
CMD ["node", "server/index.js"]
