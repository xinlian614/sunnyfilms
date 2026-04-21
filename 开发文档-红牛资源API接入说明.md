# 红牛资源 API 接入开发文档

## 1. 文档目的

这份文档说明如何基于红牛资源 API 开发一个本地影视网站，并结合当前项目的实现方式，解释：

- 红牛资源 API 的基本调用方式
- 影视网站的数据流设计
- 当前项目如何把红牛数据适配成前端可直接消费的结构
- 播放页、详情页、搜索页分别怎么接数据
- 如何单独测试红牛接口
- 开发中最容易踩的坑和建议处理方式

本文档对应当前项目目录中的这些核心文件：

- `server.js`
- `public/index.html`
- `public/play.html`
- `public/assets/app.js`
- `public/assets/play.js`
- `public/assets/styles.css`

## 2. 当前项目的技术路线

这个项目不是“采集入库型影视站”，而是“运行时实时请求上游 API”的开发版。

整体链路如下：

1. 浏览器访问本地页面
2. 前端只请求自己的本地接口 `/api/*`
3. `server.js` 负责向红牛资源发起请求
4. `server.js` 对红牛原始数据做标准化
5. 前端拿到统一结构后渲染首页、详情页和播放页

也就是说：

- 前端不直接请求红牛域名
- 不做数据库采集入库
- 不依赖 CMS
- 依赖本地 Node 服务做代理和字段适配

这种方式的优点是：

- 本地开发简单
- 规避浏览器跨域问题
- 前端不和红牛原始字段强绑定
- 后续替换其他资源网时，只需要改服务端适配层

## 3. 红牛资源 API 基本说明

当前项目使用的是红牛 `hnm3u8` 的 JSON 接口。

推荐接口：

```text
https://www.hongniuzy2.com/api.php/provide/vod/from/hnm3u8/at/json/
```

项目里还保留了一个备用形式：

```text
https://www.hongniuzy2.com/api.php/provide/vod/from/hnm3u8/
```

在当前项目中，这两个地址定义在：

- [`server.js`](d:/Project/官人影视/server.js)

常见参数：

- `ac=detail`
  含义：获取影视详情或列表数据

- `pg=1`
  含义：页码

- `t=1`
  含义：分类 ID

- `h=24`
  含义：最近多少小时更新

- `wd=哪吒`
  含义：关键词搜索

- `ids=138413`
  含义：按影片 ID 获取详情

典型请求示例：

```text
https://www.hongniuzy2.com/api.php/provide/vod/from/hnm3u8/at/json/?ac=detail&pg=1&t=1
```

获取单部影片详情示例：

```text
https://www.hongniuzy2.com/api.php/provide/vod/from/hnm3u8/at/json/?ac=detail&ids=138413
```

## 4. 红牛返回数据结构

红牛 JSON 接口常见结构如下：

```json
{
  "code": 1,
  "msg": "数据列表",
  "page": 1,
  "pagecount": 5062,
  "limit": 20,
  "total": 101237,
  "class": [
    { "type_id": 1, "type_name": "电影" }
  ],
  "list": [
    {
      "vod_id": 138413,
      "vod_name": "雾尾粉丝俱乐部",
      "type_id": 4,
      "type_name": "动漫",
      "vod_pic": "https://...",
      "vod_actor": "演员 A,演员 B",
      "vod_director": "导演",
      "vod_area": "日本",
      "vod_year": "2026",
      "vod_lang": "日语",
      "vod_remarks": "第3集",
      "vod_content": "简介",
      "vod_play_from": "hnm3u8",
      "vod_play_url": "第1集$https://...m3u8#第2集$https://...m3u8"
    }
  ]
}
```

最关键的字段：

- `class`
  分类列表

- `list`
  影片列表

- `vod_play_from`
  播放源标识，多个源一般用 `$$$` 分隔

- `vod_play_url`
  剧集和播放地址，多个源一般也用 `$$$` 分隔；单个源内部常用 `#` 分隔多集，单集名与地址用 `$` 分隔

## 5. 为什么前端不直接请求红牛 API

虽然从技术上讲，前端也可以尝试直接请求红牛接口，但在实际开发里并不推荐。

原因如下：

1. 容易遇到跨域限制
2. 上游字段可能变化，前端会被迫跟着改
3. 播放源解析逻辑不适合堆在前端
4. 搜索、筛选、错误处理、缓存更适合服务端做统一处理

所以当前项目采用：

- 前端请求本地 `/api/*`
- 服务端代理请求红牛
- 服务端负责标准化字段

## 6. 当前项目的本地 API 设计

当前项目在 [`server.js`](d:/Project/官人影视/server.js) 中暴露了这些本地接口：

### 6.1 健康检查

```text
GET /api/health
```

返回示例：

```json
{
  "ok": true,
  "uptime": 12.34
}
```

### 6.2 分类接口

```text
GET /api/categories
```

用途：

- 首页分类导航
- 搜索筛选中的分类下拉框

### 6.3 首页列表接口

```text
GET /api/home?pg=1&t=1&h=24
```

参数说明：

- `pg`：页码
- `t`：分类 ID，可选
- `h`：最近更新时间范围，可选

用途：

- 首页片单
- 分类页
- 同分类相关推荐

### 6.4 搜索接口

```text
GET /api/search?q=哪吒&field=name&t=1&pg=1
```

参数说明：

- `q`：关键词
- `field`：搜索维度，支持 `all`、`name`、`actor`
- `t`：分类 ID，可选
- `pg`：页码

当前实现里：

- `name` 搜索会用红牛搜索结果再做一次前端字段过滤
- `actor` 搜索则是服务端扫描多页数据后匹配演员字段

### 6.5 详情接口

```text
GET /api/detail?id=138413
```

用途：

- 详情抽屉
- 独立播放页

## 7. 服务端如何适配红牛数据

### 7.1 接口请求

当前项目通过 `fetchHongniuJson()` 统一发起请求。

位置：

- [`server.js`](d:/Project/官人影视/server.js)

它做了这些事情：

- 自动拼接查询参数
- 设置请求头 `Accept` 和 `User-Agent`
- 设置超时控制
- 多个上游地址失败时自动尝试备用地址

### 7.2 数据标准化

红牛原始字段不是前端最适合直接使用的格式，所以项目里做了 `normalizeJsonPayload()` 和 `normalizeVodItem()`。

标准化后的单条影片结构大致如下：

```json
{
  "id": 138413,
  "name": "雾尾粉丝俱乐部",
  "typeId": 4,
  "typeName": "动漫",
  "poster": "https://...",
  "actor": "演员",
  "director": "导演",
  "area": "日本",
  "year": "2026",
  "lang": "日语",
  "remarks": "第3集",
  "updateTime": "2026-04-17 00:12:03",
  "content": "简介",
  "sources": [
    {
      "key": "hnm3u8",
      "label": "M3U8",
      "directStream": true,
      "episodes": [
        {
          "label": "第1集",
          "url": "https://.../index.m3u8"
        }
      ]
    }
  ]
}
```

这样前端就可以稳定使用：

- `item.id`
- `item.name`
- `item.poster`
- `item.typeName`
- `item.sources`

而不用直接处理 `vod_*` 原始字段。

### 7.3 播放源拆分

项目里通过以下逻辑处理播放源：

1. `vod_play_from` 用 `$$$` 拆成多个源
2. `vod_play_url` 用 `$$$` 拆成多个源对应的剧集串
3. 每个源内部再用 `#` 拆分剧集
4. 每一集再用 `$` 拆成“集名 + 播放地址”

例如：

```text
hnm3u8$$$hnyun
```

配合：

```text
第1集$https://a.m3u8#第2集$https://b.m3u8$$$第1集$https://yun-1#第2集$https://yun-2
```

最终会被解析为：

- `hnm3u8` 源
- `hnyun` 源

每个源都包含自己的 `episodes`

## 8. 前端页面如何调用本地 API

### 8.1 首页

首页逻辑在：

- [`public/assets/app.js`](d:/Project/官人影视/public/assets/app.js)

主要调用：

- `/api/categories`
- `/api/home`
- `/api/search`
- `/api/detail`

用途分别是：

- 渲染分类导航
- 拉取首页/分类片单
- 关键词搜索
- 打开详情抽屉

### 8.2 详情抽屉

当用户点击影片卡片时：

1. 前端请求 `/api/detail?id=xxx`
2. 渲染海报、简介、演员、导演、播放源、剧集列表
3. 用户可以直接在弹层中播放
4. 也可以跳转到独立播放页

### 8.3 独立播放页

播放页逻辑在：

- [`public/assets/play.js`](d:/Project/官人影视/public/assets/play.js)

页面文件：

- [`public/play.html`](d:/Project/官人影视/public/play.html)

通过 URL 参数驱动：

```text
/play.html?id=138413&source=hnm3u8&episode=第1集
```

播放页会：

1. 读取 `id`
2. 请求 `/api/detail?id=xxx`
3. 找到指定播放源
4. 找到指定剧集
5. 加载播放器
6. 同时渲染上下集和相关推荐

## 9. 播放器实现说明

项目优先支持 M3U8 播放。

逻辑是：

1. 如果浏览器原生支持 `application/vnd.apple.mpegurl`
   直接给 `<video>` 设置 `src`

2. 如果浏览器不原生支持，但页面里加载了 `hls.js`
   使用 `Hls.js` 播放

3. 如果都不支持
   退回到 `<iframe>` 方式兜底

当前前端已经在页面里引入：

```html
<script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
```

这种方式适合开发版快速验证。

## 10. 当前项目的缓存策略

当前服务端使用内存缓存：

- 首页列表：短缓存
- 分类：长一点缓存
- 详情：中等缓存
- 演员搜索：中等缓存

优点：

- 减少对红牛接口的重复请求
- 提升本地页面响应速度

缺点：

- 服务重启后缓存会消失
- 不适合多实例共享

如果以后做正式线上版，可以考虑：

- Redis
- 本地 SQLite
- 文件缓存

## 11. 最近观看记录怎么做

当前项目没有把观看记录写入数据库，而是写到浏览器本地存储：

- `localStorage`

键名示例：

- `guanren_recent_history`

优点：

- 简单
- 无需后端存储
- 适合开发版快速验证体验

如果后续做正式站点，可以升级为：

- 登录用户的数据库观看记录
- 最近观看同步云端

## 12. 开发时最容易踩的坑

### 12.1 浏览器跨域

如果前端直接请求红牛域名，可能遇到跨域问题。

建议：

- 始终让前端请求本地 `/api/*`

### 12.2 上游字段变化

红牛字段名或内容格式可能变化。

建议：

- 所有适配逻辑都集中在 `server.js`
- 不要让前端到处直接引用 `vod_*` 字段

### 12.3 播放源并不一定只有一个

不能假设只有 `hnm3u8`。

建议：

- 保留多播放源结构
- 前端默认优先 `hnm3u8`，但不要写死只有一个源

### 12.4 播放地址并不总是稳定

上游地址可能失效、变更或被限制。

建议：

- 对播放器报错做兜底提示
- 保留手动切换播放源能力

### 12.5 图片可能失效

上游图片地址不稳定时，会导致页面大面积空图。

建议：

- 已实现图片失败占位图
- 后续如果上线，可以考虑图片代理或图片本地化

### 12.6 演员搜索成本高

红牛不一定直接提供高质量演员搜索接口。

当前项目做法是：

- 服务端扫描多页并匹配演员字段

这意味着：

- 演员搜索性能会比普通关键词搜索差

## 13. 如果要继续扩展，建议优先做什么

### 第一优先级

- 全项目文本编码统一清理
- 前端错误提示细化
- 播放器异常回退提示

### 第二优先级

- 增加图片代理
- 增加搜索建议
- 增加更多筛选维度

### 第三优先级

- 登录系统
- 收藏功能
- 真正的用户观看历史
- 服务端持久化缓存

## 14. 单独测试红牛接口的完整参考

这一节专门说明：如果你不通过当前项目，只想单独测试红牛接口本身，该怎么做。

建议优先测试下面这个地址：

```text
https://www.hongniuzy2.com/api.php/provide/vod/from/hnm3u8/at/json/
```

### 14.1 最简单的浏览器地址栏测试

直接把下面的地址粘到浏览器里：

首页列表：

```text
https://www.hongniuzy2.com/api.php/provide/vod/from/hnm3u8/at/json/?ac=detail&pg=1
```

电影分类第一页：

```text
https://www.hongniuzy2.com/api.php/provide/vod/from/hnm3u8/at/json/?ac=detail&t=1&pg=1
```

最近 24 小时更新：

```text
https://www.hongniuzy2.com/api.php/provide/vod/from/hnm3u8/at/json/?ac=detail&h=24&pg=1
```

关键词搜索：

```text
https://www.hongniuzy2.com/api.php/provide/vod/from/hnm3u8/at/json/?ac=detail&wd=哪吒&pg=1
```

按影片 ID 查详情：

```text
https://www.hongniuzy2.com/api.php/provide/vod/from/hnm3u8/at/json/?ac=detail&ids=138413
```

你主要观察这些字段：

- `code`
- `msg`
- `page`
- `pagecount`
- `total`
- `class`
- `list`

如果 `list` 有数据，说明接口当前可用。

### 14.2 PowerShell 测试

适合在 Windows 本地快速看接口可用性。

#### 示例 1：直接取第一页

```powershell
Invoke-WebRequest -UseBasicParsing "https://www.hongniuzy2.com/api.php/provide/vod/from/hnm3u8/at/json/?ac=detail&pg=1" | Select-Object -ExpandProperty Content
```

#### 示例 2：把结果转成 JSON 对象再看第一条数据

```powershell
$resp = Invoke-WebRequest -UseBasicParsing "https://www.hongniuzy2.com/api.php/provide/vod/from/hnm3u8/at/json/?ac=detail&pg=1"
$json = $resp.Content | ConvertFrom-Json
$json.list[0]
```

#### 示例 3：看分类列表

```powershell
$resp = Invoke-WebRequest -UseBasicParsing "https://www.hongniuzy2.com/api.php/provide/vod/from/hnm3u8/at/json/?ac=detail&pg=1"
$json = $resp.Content | ConvertFrom-Json
$json.class
```

#### 示例 4：查看某个影片的播放源字段

```powershell
$id = 138413
$resp = Invoke-WebRequest -UseBasicParsing "https://www.hongniuzy2.com/api.php/provide/vod/from/hnm3u8/at/json/?ac=detail&ids=$id"
$json = $resp.Content | ConvertFrom-Json
$json.list[0].vod_play_from
$json.list[0].vod_play_url
```

### 14.3 Node.js 测试

适合你在服务端开发前先验证接口和字段。

#### 示例 1：最小测试

```js
const endpoint = 'https://www.hongniuzy2.com/api.php/provide/vod/from/hnm3u8/at/json/?ac=detail&pg=1';

const response = await fetch(endpoint, {
  headers: {
    Accept: 'application/json',
    'User-Agent': 'GuanrenYingshi/1.0'
  }
});

const payload = await response.json();
console.log(payload.list?.[0]);
```

#### 示例 2：完整可直接运行脚本

```js
const baseUrl = 'https://www.hongniuzy2.com/api.php/provide/vod/from/hnm3u8/at/json/';

async function testHongniu(params = {}) {
  const url = new URL(baseUrl);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'GuanrenYingshi/1.0'
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const payload = await response.json();
  console.log('code =', payload.code);
  console.log('msg =', payload.msg);
  console.log('page =', payload.page);
  console.log('pagecount =', payload.pagecount);
  console.log('list length =', payload.list?.length || 0);
  console.log('first item =', payload.list?.[0]);
}

testHongniu({ ac: 'detail', pg: 1 }).catch(console.error);
```

运行方式：

```powershell
node your-test-file.js
```

#### 示例 3：查询单个影片详情

```js
const id = 138413;
const endpoint = `https://www.hongniuzy2.com/api.php/provide/vod/from/hnm3u8/at/json/?ac=detail&ids=${id}`;

const response = await fetch(endpoint, {
  headers: {
    Accept: 'application/json',
    'User-Agent': 'GuanrenYingshi/1.0'
  }
});

const payload = await response.json();
console.log(payload.list?.[0]);
```

#### 示例 4：把播放源解析成可用结构

```js
function parseEpisodes(groupValue) {
  return String(groupValue || '')
    .split('#')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part, index) => {
      const markerIndex = part.indexOf('$');
      if (markerIndex === -1) {
        return {
          label: `第${index + 1}集`,
          url: part
        };
      }

      return {
        label: part.slice(0, markerIndex).trim() || `第${index + 1}集`,
        url: part.slice(markerIndex + 1).trim()
      };
    });
}

function splitPlayGroups(value) {
  return String(value || '')
    .split('$$$')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parsePlaySources(vodPlayFrom, vodPlayUrl) {
  const sourceKeys = splitPlayGroups(vodPlayFrom);
  const sourceUrls = splitPlayGroups(vodPlayUrl);
  const maxLength = Math.max(sourceKeys.length, sourceUrls.length);
  const groups = [];

  for (let index = 0; index < maxLength; index += 1) {
    const key = sourceKeys[index] || `source${index + 1}`;
    const episodes = parseEpisodes(sourceUrls[index] || '');

    if (!episodes.length) {
      continue;
    }

    groups.push({
      key,
      episodes
    });
  }

  return groups;
}
```

### 14.4 curl 测试

如果你装了 `curl`，可以直接这样试：

```bash
curl "https://www.hongniuzy2.com/api.php/provide/vod/from/hnm3u8/at/json/?ac=detail&pg=1"
```

如果想看单个影片详情：

```bash
curl "https://www.hongniuzy2.com/api.php/provide/vod/from/hnm3u8/at/json/?ac=detail&ids=138413"
```

### 14.5 推荐的测试顺序

如果你准备开发，建议按下面的顺序验证：

1. 先测列表接口是否通

```text
?ac=detail&pg=1
```

2. 再测分类是否通

```text
?ac=detail&t=1&pg=1
```

3. 再测关键词搜索

```text
?ac=detail&wd=哪吒&pg=1
```

4. 再测单个详情

```text
?ac=detail&ids=138413
```

5. 最后专门检查播放源字段

- `vod_play_from`
- `vod_play_url`

### 14.6 测试时最应该重点看什么

#### 是否有数据

优先看：

- `code`
- `msg`
- `list.length`

#### 分类是否完整

优先看：

- `class`

#### 播放源是否可用

优先看：

- `vod_play_from`
- `vod_play_url`

#### 是否是 M3U8 地址

重点检查剧集 URL 是否包含：

```text
.m3u8
```

#### 是否分页正常

优先看：

- `page`
- `pagecount`
- `total`

### 14.7 测试失败时怎么排查

如果接口测试失败，按下面顺序看：

1. 地址是否写错
2. 是否遗漏 `ac=detail`
3. 是否网络访问不到红牛域名
4. 是否当前接口临时异常
5. 是否被上游限流或屏蔽

常见排查方式：

- 先浏览器直接打开 URL
- 再用 PowerShell 看原始返回
- 再用 Node 看能否正常 `response.json()`

### 14.8 一份完整的调试脚本参考

下面这份 Node 脚本可以直接作为本地调试模板：

```js
const BASE_URL = 'https://www.hongniuzy2.com/api.php/provide/vod/from/hnm3u8/at/json/';

async function requestHongniu(params) {
  const url = new URL(BASE_URL);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });

  console.log('request =>', url.toString());

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'GuanrenYingshi/1.0'
    }
  });

  console.log('status =>', response.status);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const payload = await response.json();
  console.log('code =>', payload.code);
  console.log('msg =>', payload.msg);
  console.log('page =>', payload.page);
  console.log('pagecount =>', payload.pagecount);
  console.log('total =>', payload.total);
  console.log('list length =>', payload.list?.length || 0);

  if (payload.list?.length) {
    const item = payload.list[0];
    console.log('first vod_id =>', item.vod_id);
    console.log('first vod_name =>', item.vod_name);
    console.log('first vod_play_from =>', item.vod_play_from);
    console.log('first vod_play_url =>', item.vod_play_url);
  }

  return payload;
}

requestHongniu({ ac: 'detail', pg: 1 })
  .then(() => console.log('done'))
  .catch((error) => {
    console.error('request failed =>', error);
    process.exit(1);
  });
```

## 15. 当前项目最重要的原则

做这个影视网站时，最重要的不是“把红牛 API 直接显示出来”，而是：

1. 服务端统一代理红牛
2. 服务端统一标准化字段
3. 前端只依赖你自己的接口结构
4. 播放源解析集中处理
5. 页面体验与上游数据解耦

只要这五点保持住，后面无论你换模板、换前端框架、换资源网，成本都会小很多。

## 16. 对应文件索引

- 服务端入口：[server.js](d:/Project/官人影视/server.js)
- 首页页面：[public/index.html](d:/Project/官人影视/public/index.html)
- 首页脚本：[public/assets/app.js](d:/Project/官人影视/public/assets/app.js)
- 播放页页面：[public/play.html](d:/Project/官人影视/public/play.html)
- 播放页脚本：[public/assets/play.js](d:/Project/官人影视/public/assets/play.js)
- 样式文件：[public/assets/styles.css](d:/Project/官人影视/public/assets/styles.css)
- 启动脚本：[start-local.ps1](d:/Project/官人影视/start-local.ps1)
- 停止脚本：[stop-local.ps1](d:/Project/官人影视/stop-local.ps1)

