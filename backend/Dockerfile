FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
COPY backend/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt
COPY backend/ /app/
COPY --from=frontend-builder /app/backend/frontend_dist /app/frontend_dist
RUN mkdir -p /app/data && ln -sf /app/data/db.sqlite3 /app/db.sqlite3
EXPOSE 8000
CMD ["sh", "-c", "python manage.py migrate && gunicorn pgokache.wsgi:application --bind 0.0.0.0:8000"]
