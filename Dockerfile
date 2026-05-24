FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
RUN echo "Archivos en /app:" && ls -la /app
EXPOSE 3000
CMD ["node", "server.js"]
