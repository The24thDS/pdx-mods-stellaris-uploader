FROM mcr.microsoft.com/playwright:v1.41.0-jammy

WORKDIR /app

COPY package.json .
COPY yarn.lock .

RUN yarn install

COPY . .

WORKDIR /app/mod