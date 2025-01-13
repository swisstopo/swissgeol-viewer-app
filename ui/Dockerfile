FROM node:22.5.1-alpine AS build

ARG APP_VERSION
ENV APP_VERSION=${APP_VERSION}

RUN apk add --no-cache git

WORKDIR /app
COPY . .

RUN npm install --ignore-scripts \
 && npm run build --omit=dev


FROM nginx:alpine

WORKDIR /usr/share/nginx/html
COPY --from=build /app/dist/ /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
