# AFFiNE 项目初始化指南

> 本文档旨在帮助开源贡献者在本地快速搭建 AFFiNE 的基础开发环境（截至 2024 年 6 月的信息）。如果你发现内容过时，欢迎提交 Issue 或 PR 协助更新。

## 1. 环境准备

### 1.1 Node.js（必需）

- 推荐使用 Node.js LTS 版本（当前主版本为 20.x）。
- 安装方式：
  - **直接安装**：访问 [Node.js 官网](https://nodejs.org/en/download) 下载并安装 LTS 版本。
  - **通过 fnm 管理**：安装 [fnm](https://github.com/Schniz/fnm) 后，在仓库目录内执行 `fnm use` 自动切换到项目要求的版本。

### 1.2 Rust 工具链（必需）

AFFiNE 包含使用 Rust 实现的原生模块。请按照 [Rust 官方文档](https://www.rust-lang.org/tools/install) 安装 `rustup` 及默认工具链。

### 1.3 Yarn（Corepack）

项目使用 Yarn 4（现代版本）。首次使用时推荐执行：

```bash
corepack enable
corepack prepare yarn@stable --activate
```

## 2. 克隆仓库

### macOS / Linux

```bash
git clone https://github.com/toeverything/AFFiNE
```

### Windows

仓库使用符号链接，请先开启开发者模式或授予创建符号链接权限：

```powershell
git config --global core.symlinks true
git clone https://github.com/toeverything/AFFiNE
```

更多细节可参考微软文档：[Enable Developer Mode on Windows](https://learn.microsoft.com/en-us/windows/apps/get-started/enable-your-device-for-development)。

## 3. 安装依赖

进入仓库根目录，安装 JavaScript 依赖：

```bash
yarn install
```

首次安装可能需要较长时间下载依赖包。

## 4. 构建原生模块

AFFiNE 前端和服务端均依赖 Rust 原生模块，首次初始化时请执行：

```bash
# 前端原生模块
yarn affine @affine/native build

# （可选）服务端原生模块
yarn affine @affine/server-native build
```

macOS 用户遇到 `strip` 相关错误时，请确保系统自带的 `strip` 位于 `PATH` 且优先级高于 GNU binutils 版本（参见项目讨论 #2840）。

## 5. （可选）初始化本地服务端

如果需要本地联调后端 API，请按照以下步骤准备服务端环境：

1. **准备 Docker 服务**（Postgres、Redis、Mailhog）：

   ```bash
   cp ./.docker/dev/compose.yml.example ./.docker/dev/compose.yml
   cp ./.docker/dev/.env.example ./.docker/dev/.env
   docker compose -f ./.docker/dev/compose.yml up
   ```

   > 自 AFFiNE 0.20 起，默认数据库镜像改为 `pgvector/pgvector:pg16`。如需使用其他主版本，请自行调整镜像标签。

2. **构建服务端相关包**（如第 4 步已执行，可跳过重复命令）：

   ```bash
   yarn affine @affine/server-native build
   yarn affine @affine/reader build
   ```

3. **准备环境变量并初始化数据库**：

   ```bash
   cp packages/backend/server/.env.example packages/backend/server/.env
   yarn affine server init
   ```

4. **启动本地服务端**：

   ```bash
   yarn affine server dev
   ```

   启动后可使用以下测试账号登录（成员数量配额不同）：

   - Dev 用户：`dev@affine.pro` / `dev`
   - Pro 用户：`pro@affine.pro` / `pro`
   - Team 用户：`team@affine.pro` / `team`

## 6. 启动前端开发服务器

在项目根目录运行：

```bash
yarn dev
```

默认情况下，前端会在 `http://localhost:3000` 启动。若已开启服务端，可以直接使用上一步的测试账号完成登录。

## 7. 常用测试命令

- 单元测试：

  ```bash
  yarn test
  ```

- 端到端测试（运行前需安装浏览器依赖 `npx playwright install`）：

  ```bash
  yarn workspace @affine-test/affine-local e2e
  ```

## 8. 更多资源

- 构建前端的详细说明：`docs/BUILDING.md`
- 构建桌面客户端：`docs/building-desktop-client-app.md`
- 服务端开发指南：`docs/developing-server.md`
- 贡献指南与流程：`docs/CONTRIBUTING.md`

欢迎在 AFFiNE 的 [Discord 社区](https://affine.pro/redirect/discord) 或 GitHub Issues 中反馈问题与建议。
