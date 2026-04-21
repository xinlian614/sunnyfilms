# Cloudflare Pages 部署指南

## 🚀 简介

本项目已经适配 Cloudflare Pages，可以像 MoonTV 一样一键部署！

## 📋 前置准备

1. 注册 Cloudflare 账号：https://dash.cloudflare.com/sign-up
2. 准备 GitHub 仓库，将代码推送到 GitHub

## 📁 项目结构

```
SunnyFilms/
├── public/                    # 静态文件目录（Cloudflare Pages 会自动部署）
│   ├── index.html
│   ├── admin.html
│   ├── analytics.html
│   └── assets/
├── functions/                 # Cloudflare Pages Functions（API 处理）
│   └── [[path]].js           # 通配符路由，处理所有 API 请求
├── lib/                      # 共享库
│   ├── shared.js
│   ├── kv-storage.js
│   └── provider-service.js
├── server.js                # 原 Node.js 后端（本地开发使用）
├── package.json
└── wrangler.toml            # Cloudflare 配置文件
```

## 🏗️ 部署步骤

### 第一步：创建 KV 命名空间

1. 访问 Cloudflare Dashboard
2. 进入 **Workers & Pages** → **KV**
3. 点击 **Create a namespace**
4. 名称填写：`sunnyfilms-kv`
5. 点击 **Add** 创建
6. **复制命名空间的 ID**（后面会用到）

### 第二步：创建 Pages 项目

1. 访问 https://dash.cloudflare.com/
2. 进入 **Workers & Pages**
3. 点击 **Create application**
4. 选择 **Pages** 标签页
5. 点击 **Connect to Git**
6. 选择你的 GitHub 仓库（SunnyFilms）
7. 点击 **Begin setup**

### 第三步：配置部署设置

在部署设置页面填写：

- **Project name**: `sunnyfilms`（或你喜欢的名字）
- **Production branch**: `dev`（或你的主分支名）
- **Framework preset**: `None`
- **Build command**: （留空）
- **Build output directory**: `public`

### 第四步：配置 KV 绑定（关键！）

1. 在 **Environment variables** 部分
2. 点击 **KV namespace bindings**（在 Variables 旁边）
3. 点击 **Add binding**
4. **Variable name**: `SUNNYFILMS_KV`
5. **KV namespace**: 选择刚才创建的 `sunnyfilms-kv`
6. 保存

### 第五步：开始部署

点击 **Save and Deploy**

Cloudflare Pages 会自动：
1. 克隆你的仓库
2. 部署 public 目录下的静态文件
3. 配置 Functions 处理 API 请求
4. 分配一个 `.pages.dev` 域名

## 🌐 访问地址

部署成功后，你可以访问：

- **前台首页**: `https://你的项目名.pages.dev`
- **管理页面**: `https://你的项目名.pages.dev/admin.html`
- **统计分析**: `https://你的项目名.pages.dev/analytics.html`
- **API 健康检查**: `https://你的项目名.pages.dev/api/health`

## 📚 Pages Functions 工作原理

- `/api/*` 请求 → `functions/[[path]].js` 处理（使用 KV 存储）
- 其他请求 → 直接返回 `public/` 目录的静态文件

## 🔄 自动部署

每次 Push 到配置的分支，Cloudflare Pages 都会自动重新部署！

## 💡 常见问题

### KV 未绑定错误

**错误信息**: `env.SUNNYFILMS_KV is undefined`

**解决方法**:
1. 进入 Pages 项目的 **Settings**
2. 点击 **Functions** → **KV namespace bindings**
3. 确认变量名是 `SUNNYFILMS_KV`，并且绑定了正确的 KV 命名空间
4. 点击 **Retry deployment**

### API 返回 404

**解决方法**:
1. 确认 `functions/[[path]].js` 文件存在并已提交到 Git
2. 确认文件名为 `[[path]].js`（注意是双括号）
3. 重新部署

### 构建失败

**解决方法**:
1. 确认 **Build output directory** 设为 `public`
2. 确认 **Build command** 留空
3. 确认 public 目录存在且包含 index.html

## 📖 与 MoonTV 对比

| 特性 | MoonTV | SunnyFilms (本项目) |
|------|--------|---------------------|
| 框架 | Next.js | 原生 JS + Functions |
| KV 绑定 | ✅ | ✅ |
| 自动部署 | ✅ | ✅ |
| 本地 Node.js | ❌ | ✅ |

## 🆓 免费额度说明

- **Cloudflare Pages**: 无限免费！
- **Cloudflare KV**:
  - 每天 100,000 次读取
  - 每天 1,000 次写入
  - 完全足够个人使用

## 🎉 完成

部署成功后，像 MoonTV 一样免费托管！

如果你想在本地开发，可以继续使用原来的 Node.js 版本：

```bash
npm run start:local
```

访问 http://localhost:3001

祝你部署成功！🚀
