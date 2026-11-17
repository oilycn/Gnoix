# Gnoix 视频源开发指南与技术说明文档

Gnoix 聚合影音点播模块采用双轨源设计，目前支持两类视频源：
1. **CMS 采集站标准源**：基于各大影视站通用采集接口规范（JSON / XML）。
2. **原生 JavaScript (JS) 爬虫源**：运行在 App 本地沙盒内置的 `JavaScriptCore` 引擎中，支持网页动态抓取、DOM 解析、数据解密、多源聚合。兼容 **Gnoix 原生 Spider 规范**、**DRpy / TVBox 规则** 以及 **XPTV 扩展规范**。

---

## 一、CMS 采集站源规范 (快捷对接)

如果目标站点已经提供了 MacCMS（苹果 CMS）等兼容采集接口，只需提供 API 基础地址（Base URL），无需编写脚本即可直接接入。

### 1. 接口协议约定
App 会在请求 Base URL 时自动追加参数：
* **分类列表**：`{baseURL}?ac=list`
* **分类内容**：`{baseURL}?ac=videolist&t={tid}&pg={page}`
* **视频搜索**：`{baseURL}?ac=videolist&wd={keyword}&pg={page}`
* **视频详情**：`{baseURL}?ac=detail&ids={videoId}`

### 2. 标准 JSON 返回结构
```json
{
  "code": 1,
  "msg": "数据列表",
  "page": 1,
  "pagecount": 10,
  "limit": 20,
  "total": 200,
  "class": [
    { "type_id": 1, "type_name": "电影" },
    { "type_id": 2, "type_name": "电视剧" }
  ],
  "list": [
    {
      "vod_id": 12345,
      "vod_name": "示例影片",
      "vod_pic": "https://example.com/cover.jpg",
      "vod_remarks": "更新至10集",
      "vod_content": "影片剧情简介...",
      "vod_play_from": "播放源线路1$$$播放源线路2",
      "vod_play_url": "第1集$https://play.m3u8#第2集$https://play2.m3u8$$$第1集$https://line2.m3u8"
    }
  ]
}
```

---

## 二、原生 JavaScript (JS) 爬虫源开发（推荐）

对于没有开放采集 API 的网页站点，可以通过编写 `.js` 脚本进行实时解析与提取。

### 1. 运行环境与特性
* **执行容器**：基于 iOS 原生 `JavaScriptCore`，每个源拥有独立的上下文会话（JSContext）与热启动缓存池。
* **执行模式**：同步执行（若使用 `async/await`，引擎会自动转译展开执行）。
* **内置加解密**：原生支持 MD5、Base64、AES-CBC、AES-GCM（可自动穿透雷池 SafeLine WAF 盾）。
* **字符编码**：网络层自动识别并兼容 UTF-8、GBK、GB2312。

---

### 2. 内置全局 API

在脚本中可以直接调用 App 底层注入的方法：

#### ① 网络请求 `request(url, options)`
支持阻塞式同步请求，返回包含 `.text`、`.body`、`.status` 和 `.json()` 的响应：
```javascript
var res = request("https://api.example.com/data", {
    method: "GET", // 支持 "GET" 或 "POST"
    headers: {
        "User-Agent": PC_UA,
        "Referer": "https://example.com/"
    },
    timeout: 10 // 超时时间（秒）
});

// 解析 HTML 或 JSON
var html = res.text;
var json = res.json();
```
> **可用 UA 常量**：`PC_UA`、`MOBILE_UA`、`IOS_UA`、`UC_UA`。

#### ② DOM 节点选择器 (基于 SwiftSoup 原生解析)
* **`pdfa(html, selector)`**：选取匹配元素集合，返回 HTML 字符串数组。
* **`pdfh(html, selector)`**：提取节点文本或属性值：
  * `div&&Text`：获取文本内容。
  * `div&&Html`：获取内部 HTML。
  * `a&&href`、`img&&data-original`：获取指定属性值。
  * 支持 `:eq(n)` 伪类选择器（如 `.list:eq(0) a`）。
* **`pd(html, selector, host)`**：提取属性并将相对路径拼接为完整 URL。

#### ③ 编解码与加密工具
* `md5(string)`：计算 MD5 哈希（32位小写）。
* `base64Encode(string)` / `base64Decode(base64)`：Base64 编解码。
* `aesDecrypt(base64Cipher, key, iv)`：AES-CBC 解密。
* `CryptoJS`：内置 CryptoJS 垫片库，支持 `CryptoJS.MD5`、`CryptoJS.AES.decrypt`、`CryptoJS.enc.Base64` 等。

#### ④ 日志与打印
* `console.log(...)` / `print(...)`：输出将直接同步到客户端控制台日志。

---

### 3. Gnoix 原生 Spider 规范（标准规范）

编写一个 `spider` 对象并导出，需实现以下 5 个核心方法：

```javascript
var spider = {
    /**
     * 1. 首页与分类定义
     * @returns {Object} 包含 class 分类列表和推荐列表
     */
    home: function() {
        return {
            class: [
                { type_id: "movie", type_name: "电影" },
                { type_id: "tv", type_name: "电视剧" },
                { type_id: "anime", type_name: "动漫" }
            ],
            list: [] // 可选：首页热播推荐列表
        };
    },

    /**
     * 2. 分类下的视频列表
     * @param {string} tid 分类 ID（对应 home 中的 type_id）
     * @param {number} pg 当前页码（从 1 开始）
     * @returns {Object} 列表与分页信息
     */
    category: function(tid, pg) {
        var url = "https://example.com/list/" + tid + "-page-" + pg + ".html";
        var html = request(url);
        
        var list = [];
        var items = pdfa(html, ".vod-list .item"); // 选取所有列表节点
        
        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            list.push({
                vod_id: pd(item, "a&&href"),            // 视频唯一标识（通常可传详情页相对/绝对链接）
                vod_name: pdfh(item, "a&&title"),       // 视频名称
                vod_pic: pd(item, "img&&data-src"),     // 封面图片 URL
                vod_remarks: pdfh(item, ".remark&&Text")// 更新状态/清晰度
            });
        }
        
        return {
            page: pg,
            pagecount: 999,
            list: list
        };
    },

    /**
     * 3. 视频详情与播放选集列表
     * @param {string} vid 视频 ID（即 category 或 search 返回的 vod_id）
     * @returns {Object} 详情信息
     */
    detail: function(vid) {
        var url = vid.indexOf("http") === 0 ? vid : ("https://example.com" + vid);
        var html = request(url);

        var title = pdfh(html, "h1&&Text");
        var pic = pd(html, ".cover img&&src");
        var desc = pdfh(html, ".intro&&Text");

        // 提取播放列表（多集格式：第1集$播放URL#第2集$播放URL）
        var epItems = pdfa(html, ".playlist a");
        var episodes = [];
        for (var i = 0; i < epItems.length; i++) {
            var epName = pdfh(epItems[i], "Text") || ("第" + (i + 1) + "集");
            var epLink = pd(epItems[i], "a&&href");
            episodes.push(epName + "$" + epLink);
        }

        return {
            vod_id: vid,
            vod_name: title,
            vod_pic: pic,
            vod_content: desc,
            vod_remarks: "高清",
            vod_play_from: "默认播放源",           // 线路名（若有多条线路用 $$$ 拼接）
            vod_play_url: episodes.join("#")     // 选集列表（多线路时对应也用 $$$ 拼接）
        };
    },

    /**
     * 4. 视频播放链接解析
     * @param {string} playUrl 选集列表中 $ 符号后的 URL
     * @returns {Object} 返回真实播放流媒体地址（m3u8/mp4）及所需 Header
     */
    play: function(playUrl) {
        // 场景 A：如果 playUrl 本身已是直链或 M3U8，直接返回
        if (playUrl.indexOf(".m3u8") !== -1 || playUrl.indexOf(".mp4") !== -1) {
            return {
                url: playUrl,
                headers: { "User-Agent": PC_UA }
            };
        }

        // 场景 B：需要请求中间播放页提取真实流或调用嗅探
        var html = request(playUrl);
        // 从 script 变量中正则匹配 m3u8 地址
        var match = html.match(/var player_aaaa\s*=\s*\{.*"url":"([^"]+)".*\}/);
        var realUrl = match ? match[1].replace(/\\\//g, "/") : playUrl;

        return {
            url: realUrl,
            headers: {
                "User-Agent": PC_UA,
                "Referer": playUrl
            }
        };
    },

    /**
     * 5. 关键词搜索
     * @param {string} wd 搜索关键词
     * @param {number} pg 页码
     * @returns {Object} 搜索匹配列表
     */
    search: function(wd, pg) {
        var searchUrl = "https://example.com/search?q=" + encodeURIComponent(wd) + "&page=" + (pg || 1);
        var html = request(searchUrl);
        var items = pdfa(html, ".search-results .item");
        var list = [];
        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            list.push({
                vod_id: pd(item, "a&&href"),
                vod_name: pdfh(item, "a&&title"),
                vod_pic: pd(item, "img&&src"),
                vod_remarks: pdfh(item, ".desc&&Text")
            });
        }
        return { list: list };
    }
};
```

---

### 4. DRpy 规则规范 (`var rule = { ... }`)

Gnoix 深度兼容 DRpy 模板规则，针对常见的 CMS 模板只需声明选择器即可：

```javascript
var rule = {
    title: '某影视',
    host: 'https://example.com',
    url: '/type/fyclass-fypage.html',
    searchUrl: '/search/**-fypage.html',
    class_name: '电影&电视剧&综艺&动漫',
    class_url: '1&2&3&4',
    // 列表页解析规则：列表选择器;标题选择器;图片选择器;副标题选择器;详情链接选择器
    一级: '.stui-vodlist li;a&&title;.lazyload&&data-original;.pic-text&&Text;a&&href',
    // 详情页解析规则
    二级: {
        title: 'h1&&Text',
        img: '.lazyload&&data-original',
        desc: '.detail-desc&&Text',
        content: '.detail-content&&Text',
        tabs: '.nav-tabs a',
        lists: '.playlist:eq(#id) a'
    },
    // 播放链接解析
    lazy: 'js: input = input.indexOf(".m3u8") !== -1 ? input : request(input);'
};
```

---

## 三、播放选集与线路语法规范

在 `detail` 阶段返回的播放字段约定如下：

### 1. 单线路格式
* `vod_play_from`: `"蓝光专线"`
* `vod_play_url`: `"第1集$https://a.m3u8#第2集$https://b.m3u8#第3集$https://c.m3u8"`
  * 每集格式为：`集数名称$播放数据`。
  * 集与集之间用英文井号 `#` 分隔。

### 2. 多线路格式
* `vod_play_from`: `"线路1$$$线路2"`
* `vod_play_url`: `"第1集$url1#第2集$url2$$$第1集$url3#第2集$url4"`
  * 线路之间用 `$$$` 严格一一对应分隔。

---

## 四、视频源导入与配置方法

### 方式 1：单一源直接添加
1. 将编写好的脚本上传至公网服务器（或 GitHub Raw / Gist / 私有 CDN），获取 `.js` 直链；也可以直接存为手机本地文件。
2. 打开 Gnoix App，进入 **「设置」 -> 「内容源管理」**。
3. 点击右上角 **添加源**：
   * **名称**：自定义名称（如：*极速影院*）
   * **类型**：选择 **JS爬虫源**（若为 CMS 接口则选 *采集站源*）
   * **URL 地址**：填入 `https://.../spider.js`（本地调试支持 `file:///...`）
4. 保存后在主界面即可实时切换并载入。

### 方式 2：批量订阅配置 (JSON 格式)
可准备一份 `config.json` 供 App 一键批量订阅导入：
```json
{
  "name": "我的自建源订阅",
  "version": "1.0",
  "sites": [
    {
      "name": "极速影视",
      "type": "js",
      "api": "https://example.com/spiders/jisu.js",
      "searchable": 1
    },
    {
      "name": "官方标准采集站",
      "type": "api",
      "api": "https://cms.example.com/api.php/provide/vod/",
      "searchable": 1
    }
  ]
}
```

---

## 五、开发与调试排错建议

1. **防盗链与鉴权头 (Headers)**：
   * 部分站点的 M3U8 切片或封面图片限制了请求来源，务必在 `play()` 的返回值中携带 `headers: { "User-Agent": PC_UA, "Referer": "https://..." }`。
2. **SafeLine WAF (雷池盾) 自动穿透**：
   * Gnoix 底层网络模块已集成针对 SafeLine WAF 的自动解密功能，如果站点使用了雷池盾（AES-256-GCM 保护），App 会自动探测并解密出真实 HTML，开发者直接按常规页面解析即可。
3. **URL 智能编码**：
   * 在使用 `request(url)` 时，底层会自动校验 URL 合法性，避免中文参数出现重复百分号转义（如 `%25E9`），确保搜索与分页准确。
4. **日志排查**：
   * 在脚本各处增加 `console.log("解析结果:", JSON.stringify(list))`，在调试时可清晰观测数据流动。
