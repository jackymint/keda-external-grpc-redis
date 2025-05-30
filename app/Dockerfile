FROM node:18-alpine

WORKDIR /app

COPY app/package.json package-lock.json* ./
RUN npm install --production

COPY app .

EXPOSE 50051 3000

CMD ["node", "external-grpc.js"]
