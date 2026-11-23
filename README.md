# zhuzhyk-web
Web application for Zhuzhyk online store coursework

## Запуск

Потрібні Node.js 24 і PostgreSQL із таблицями магазину. У підготовленій
хмарній конфігурації скрипт запуску налаштовує локальну базу автоматично.
Для звичайного запуску задайте `DATABASE_URL` у середовищі або в локальному
`backend/.env`.

```bash
cd backend
npm ci
npm start
npm test
```

За замовчуванням магазин працює на порту 3000. Для перевірки використовуйте
`GET /health` і `GET /items`.

## Адмінпанель

Задайте довгий унікальний `ADMIN_PASSWORD` у середовищі процесу або в
локальному `backend/.env` і перезапустіть застосунок. Відкрийте `/admin`
і введіть ім’я користувача `admin` та заданий пароль. Для доступу з іншого
пристрою використовуйте HTTPS, оскільки вхід працює через HTTP Basic.
Docker Compose передає `ADMIN_PASSWORD` із середовища або кореневого `.env`.

У панелі можна додавати, редагувати й видаляти товари та завантажувати їхні
фотографії. Запити `POST /items`, `PATCH /items/:id` і `DELETE /items/:id`
потребують облікових даних адміністратора та заголовка `X-Admin-Request: 1`.

## Архітектура

Модульний моноліт із шарами `api/ → service/ → domain/` і репозиторіями PostgreSQL.
Рішення зафіксовані в [`docs/adr/`](docs/adr/):

- [0001 — стиль архітектури](docs/adr/0001-architecture-style.md)
- [0002 — шарова структура](docs/adr/0002-layered-architecture.md)
- [0003 — стиль API та модель помилок](docs/adr/0003-api-style-and-error-model.md)

## API документація

Контракт API: [`docs/api/openapi.yaml`](docs/api/openapi.yaml) (перевірено в [Swagger Editor](https://editor.swagger.io/)).

![Swagger Editor](docs/api/swagger_screenshot.png)
