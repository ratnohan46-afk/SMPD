FROM node:20-alpine AS build
RUN apk add --no-cache python3 make g++
WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

FROM node:20-alpine
RUN apk add --no-cache tini
WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app ./

USER node
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["npm", "start"]
