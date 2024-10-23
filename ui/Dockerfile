FROM node:22-alpine as build

WORKDIR /app
COPY . .

RUN npm install --no-scripts
RUN npm run build --omit=dev



FROM nginx:alpine

WORKDIR /usr/share/nginx/html
COPY --from=build /app/dist/ /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
