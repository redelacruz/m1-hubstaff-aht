FROM node:20-alpine

WORKDIR /app

COPY package.json ./

RUN npm install

COPY . .

EXPOSE 80

ENV PORT=80

RUN npm run build

CMD ["npm", "run", "start"]
