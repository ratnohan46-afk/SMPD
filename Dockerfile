FROM node:20-alpine AS build
RUN apk add --no-cache python3 make g++
WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

FROM node:20-alpine
RUN apk add --no-cache tini
WORKDIR /app

COPY --from=build /app /app

# SMPD uses SQLite and must be able to create/update smpd.sqlite.
RUN chown -R node:node /app

USER node
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["npm", "start"]
