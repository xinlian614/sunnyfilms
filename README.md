# Sunny影视

这是一个本地运行的影视站原型，现已从“单一红牛资源接入”升级为“多影视资源接口可配置化管理”架构。

前台页面仍然统一访问本地 `/api/*`，服务端负责：

- 根据接口配置自动选择可用的影视资源接口
- 按模板组装请求参数并发起请求
- 按解析规则把不同上游响应统一适配成前端可消费的结构
- 记录调用日志、耗时和请求结果
- 持久化保存接口配置，并支持导入/导出

## 当前能力

- 首页搜索、分类筛选、详情查看、播放页联调
- 多影视资源接口配置管理
- 自动故障切换与手动指定接口
- 接口新增、编辑、删除、启用、禁用、测试
- 请求 URL、方法、参数模板、解析规则、认证方式、超时时间、优先级配置
- 接口调用日志记录
- 配置 JSON 导入、导出
- 红牛资源默认模板预置

## 本地启动

推荐方式一：PowerShell

```powershell
npm run start:local
```

停止服务：

```powershell
npm run stop:local
```

推荐方式二：双击脚本

- 双击 `start-local.bat`
- 停止时双击 `stop-local.bat`

## 访问地址

- 前台首页：`http://127.0.0.1:3001`
- 播放页：`http://127.0.0.1:3001/play.html`
- 接口管理页：`http://127.0.0.1:3001/admin.html`

建议优先使用 `127.0.0.1`，避免本机代理或 hosts 配置影响联调。

## 持久化数据

服务启动后会自动创建 `data` 目录，并持久化以下文件：

- `data/resource-apis.json`
  保存所有影视资源接口配置
- `data/resource-api-logs.json`
  保存最近的接口调用日志

项目目录下仍会保留本地运行日志：

- `server.stdout.log`
- `server.stderr.log`

## 接口管理说明

管理页支持以下配置项：

- 接口名称
- 接口类型
- 请求 URL
- 请求方式
- 请求参数模板
- 响应解析规则
- 认证方式
- 超时时间
- 优先级
- 默认请求头
- 备用 URL
- 启用状态

默认预置了一份“红牛资源”配置，你可以直接复制其结构，扩展新的接口。

### 认证方式

当前内置支持：

- `none`
- `bearer`
- `header-key`
- `query-key`
- `basic`

后续若要扩展新的认证方式，可在 `server.js` 的 `buildAuth()` 中继续增加类型分支。

### 接口类型

当前默认模板类型为：

- `mac-cms-v10-json`

后续若要支持新的接口类型，可以继续扩展：

- 请求参数模板生成规则
- 响应解析规则字段映射
- 不同类型的标准化适配器

## 对外业务接口

前台继续使用以下本地接口：

- `GET /api/health`
- `GET /api/categories`
- `GET /api/home?pg=1&t=1&h=24`
- `GET /api/search?q=哪吒&field=name&t=1&pg=1`
- `GET /api/detail?id=138413`

所有业务接口都支持可选参数：

- `provider=provider_xxx`

当传入 `provider` 时，会强制手动指定该接口执行请求。
当不传入时，系统会根据当前策略：

- 自动模式：按优先级依次尝试，失败时自动切换到下一个可用接口
- 手动模式：固定使用后台指定的默认接口

## 管理接口

- `GET /api/admin/providers`
- `POST /api/admin/providers`
- `PUT /api/admin/providers/:id`
- `DELETE /api/admin/providers/:id`
- `POST /api/admin/providers/:id/toggle`
- `POST /api/admin/providers/:id/test`
- `GET /api/admin/logs`
- `GET /api/admin/selection`
- `POST /api/admin/selection`
- `GET /api/admin/config/export`
- `POST /api/admin/config/import`

## 项目结构

- `server.js`
  本地 Node 服务，负责资源接口配置读取、适配执行、业务 API、管理 API、日志持久化
- `public/index.html`
  前台首页
- `public/play.html`
  播放页
- `public/admin.html`
  资源接口管理页
- `public/assets/app.js`
  首页逻辑
- `public/assets/play.js`
  播放页逻辑
- `public/assets/admin.js`
  管理页逻辑
- `public/assets/styles.css`
  全站样式
- `data/resource-apis.json`
  接口配置持久化文件
- `data/resource-api-logs.json`
  接口调用日志持久化文件

## 说明

这是本地开发版，不做采集入库，仍然是运行时实时请求上游影视资源接口。
