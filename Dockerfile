FROM mcr.microsoft.com/playwright:v1.59.1-jammy

WORKDIR /app

COPY package.json .
COPY yarn.lock .

RUN yarn install

COPY . .

WORKDIR /app/mod
