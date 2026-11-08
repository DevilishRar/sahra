FROM python:3.12-slim
WORKDIR /app
COPY server.py ./
COPY public ./public
RUN mkdir -p sessions
EXPOSE 8080
CMD ["python", "server.py", "8080"]
