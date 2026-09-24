# 数字素材库与共享 API 服务

## Docker 启动

```bash
docker compose up --build
```

Swagger 地址：http://localhost:19310/api-docs

MinIO Console 地址：http://localhost:9001

默认环境变量位于 `.env`，包含 `COMPOSE_PROJECT_NAME`、`MONGO_URI`、`JWT_SECRET`、`REDIS_URL`、`MINIO_ENDPOINT`、`MINIO_ACCESS_KEY`、`MINIO_SECRET_KEY`、`MINIO_BUCKET`、`BACKEND_PORT`。

## 技术栈

| 层级 | 技术 |
| --- | --- |
| 后端 | NestJS + TypeScript |
| 数据库 | MongoDB 7 + Mongoose |
| 缓存 | Redis 7 |
| 对象存储 | MinIO |
| 认证 | JWT 模拟鉴权中间件，可接入真实签名校验 |
| API 文档 | Swagger |

## 核心接口

- `GET /health`：健康检查。
- `GET /assets`、`POST /assets`、`PATCH /assets/:id`：素材列表、上传元数据、编辑信息。
- `POST /assets/:id/publish`、`POST /assets/:id/archive`：素材发布与归档。
- `GET /categories`、`POST /categories`：多级分类管理。
- `GET /collections`、`POST /collections`：收藏夹列表（按可见性过滤）与创建。
- `GET /collections/:id`、`PATCH /collections/:id`：收藏夹详情与改名（携带 `expectedRevision` 乐观锁，冲突返回 409 与最新修订号）。
- `PATCH /collections/:id/assets/:assetId`、`DELETE /collections/:id/assets/:assetId`：协作素材增删（需 Editor 身份与 `expectedRevision`）。
- `POST /collections/:id/collaborators`、`DELETE /collections/:id/collaborators/:userId`：协作成员管理（仅创建者，成员分 Viewer/Editor 身份）。
- `POST /assets/:assetId/downloads`、`GET /downloads`：下载记录和许可校验。
- `GET /tags`、`POST /tags`：标签管理。
- `POST /reviews/assets/:assetId`、`GET /reviews`：素材审核记录。

## 目录结构

```text
backend/src/
├── routes/           # asset.routes.ts, category.routes.ts, collection.routes.ts, download.routes.ts, tag.routes.ts
├── controllers/      # asset.controller.ts, category.controller.ts, collection.controller.ts, download.controller.ts, tag.controller.ts
├── services/         # asset.service.ts, category.service.ts, collection.service.ts, download.service.ts, tag.service.ts, review.service.ts, storage.service.ts
├── models/           # asset.schema.ts, category.schema.ts, collection.schema.ts, collectionCollaborator.schema.ts, downloadRecord.schema.ts, tag.schema.ts, reviewRecord.schema.ts
├── middlewares/      # auth.middleware.ts, rbac.middleware.ts, auditLog.middleware.ts, errorHandler.middleware.ts, rateLimit.middleware.ts, requestLogger.middleware.ts, validation.middleware.ts
├── guards/           # collectionAccess.guard.ts（收藏夹实时鉴权）
├── decorators/       # collectionAction.decorator.ts（收藏夹动作元数据）
├── types/            # enums.ts, interfaces.ts
├── utils/            # logger.ts, response.ts, fileValidator.ts, thumbnailGenerator.ts
├── config/           # database.config.ts, jwt.config.ts, redis.config.ts, minio.config.ts, swagger.config.ts
└── database/         # seeds/
```

## 枚举位置

共享枚举统一位于 `backend/src/types/enums.ts`，包含 `AssetType`、`LicenseType`、`AssetStatus`、`ReviewResult`、`DownloadPurpose`、`TagCategory` 和 `UserRole`。

## License

MIT
