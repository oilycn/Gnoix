/**
 * Gnoix (晚风TV) 原生 JS 视频源爬虫 - MX动漫 (dcc3.com)
 * 转换适配自 KazumiRules: MXdm (v2.4)
 * 特性：多分类、多线路（高清/ikun/非凡/量子）、原生直出未加密 HLS .m3u8 媒体流
 */

var spider = {
    /**
     * 首页与分类定义
     */
    home: function(filter) {
        var categories = [
            { type_id: "riman", type_name: "日本动漫" },
            { type_id: "guoman", type_name: "国产动漫" },
            { type_id: "oman", type_name: "欧美动漫" },
            { type_id: "dmfilm", type_name: "动漫电影" }
        ];
        var first = this.category("riman", 1);
        return {
            code: 1,
            msg: "OK",
            page: 1,
            pagecount: first.pagecount || 999,
            class: categories,
            list: first.list || []
        };
    },

    /**
     * 分类列表查询
     */
    category: function(tid, pg, filter, extend) {
        tid = tid || "riman";
        pg = parseInt(pg) || 1;
        var url = "https://www.dcc3.com/type/" + tid + "/";
        if (pg > 1) {
            url = "https://www.dcc3.com/type/" + tid + "/page/" + pg + "/";
        }

        var html = request(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
                "Referer": "https://www.dcc3.com/"
            }
        });

        var list = [];
        var re = /<li>\s*<a[^>]+href="(\/detail\/\d+\/)"[^>]*title="([^"]*)"[\s\S]*?<img[^>]+(?:data-original|src)="([^"]+)"[\s\S]*?<p>([^<]*)<\/p>/g;
        var m;
        while ((m = re.exec(html)) !== null) {
            var pic = m[3] || "";
            if (pic.indexOf("load.gif") !== -1) {
                var realPicM = m[0].match(/data-original="([^"]+)"/);
                if (realPicM) pic = realPicM[1];
            }
            list.push({
                vod_id: m[1],
                vod_name: m[2].trim(),
                vod_pic: pic,
                vod_remarks: m[4] ? m[4].trim() : ""
            });
        }

        return {
            code: 1,
            page: pg,
            pagecount: list.length > 0 ? (pg + 1) : pg,
            limit: list.length,
            total: 1000,
            list: list
        };
    },

    /**
     * 详情页解析与多线路剧集抽取
     */
    detail: function(vid) {
        var detailPath = vid.startsWith("/") ? vid : ("/" + vid);
        var url = "https://www.dcc3.com" + detailPath;
        var html = request(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
                "Referer": "https://www.dcc3.com/"
            }
        });

        // 标题
        var titleMatch = html.match(/<h[12][^>]*>([^<]+)<\/h[12]>/);
        var title = titleMatch ? titleMatch[1].trim() : "";

        // 海报封面
        var picMatch = html.match(/<div class="cover"[^>]*>[\s\S]*?<img[^>]+(?:data-original|data-src|src)="([^"]+)"/);
        var pic = "";
        if (picMatch) {
            pic = picMatch[1];
            if (pic.indexOf("load.gif") !== -1) {
                var origM = html.match(/<div class="cover"[^>]*>[\s\S]*?<img[^>]+data-original="([^"]+)"/);
                if (origM) pic = origM[1];
            }
        }

        // 简介
        var descMatch = html.match(/<li class="blurb"><span>简介：<\/span>([\s\S]*?)<\/li>/) || html.match(/<div class="intro[^"]*">([\s\S]*?)<\/div>/);
        var desc = descMatch ? descMatch[1].replace(/<[^>]+>/g, "").trim() : "";

        // 线路 Tabs
        var tabsMatch = html.match(/<div class="tabs">([\s\S]*?)<\/div>/);
        var tabNames = [];
        if (tabsMatch) {
            var tabRe = /<a[^>]*>(?:<i[^>]*><\/i>)?([^<]+)<\/a>/g;
            var tm;
            while ((tm = tabRe.exec(tabsMatch[1])) !== null) {
                var tName = tm[1].trim();
                if (tName) tabNames.push(tName);
            }
        }
        if (tabNames.length === 0) tabNames = ["默认线路"];

        // 剧集分组
        var rowRe = /<div class="row"[^>]*>\s*<ul[^>]*>([\s\S]*?)<\/ul>\s*<\/div>/g;
        var playFromList = [];
        var playUrlList = [];
        var rowIndex = 0;
        var rm;

        while ((rm = rowRe.exec(html)) !== null) {
            var tabName = tabNames[rowIndex] || ("线路" + (rowIndex + 1));
            rowIndex++;
            var epRe = /<a[^>]+href="(\/play\/[^"]+)"[^>]*>([^<]+)<\/a>/g;
            var curEps = [];
            var em;
            while ((em = epRe.exec(rm[1])) !== null) {
                var epTitle = em[2].trim();
                var epLink = "https://www.dcc3.com" + em[1];
                curEps.push(epTitle + "$" + epLink);
            }
            if (curEps.length > 0) {
                playFromList.push(tabName);
                playUrlList.push(curEps.join("#"));
            }
        }

        return {
            vod_id: vid,
            vod_name: title,
            vod_pic: pic,
            vod_content: desc,
            vod_remarks: "高清",
            vod_play_from: playFromList.join("$$$") || "MX动漫",
            vod_play_url: playUrlList.join("$$$")
        };
    },

    /**
     * 播放解析：提取 Artplayer 配置中的直链 m3u8
     */
    play: function(playUrl) {
        var html = request(playUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
                "Referer": playUrl
            }
        });

        var m3u8Match = html.match(/url:\s*['"](https?:\/\/[^'"]+\.m3u8[^'"]*)['"]/);
        if (m3u8Match) {
            return {
                url: m3u8Match[1],
                headers: {
                    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
                    "Referer": playUrl
                }
            };
        }

        // 备用正则：通用 mp4/m3u8
        var anyMedia = html.match(/['"](https?:\/\/[^'"\s]+\.(?:m3u8|mp4)[^'"\s]*)['"]/);
        if (anyMedia) {
            return {
                url: anyMedia[1],
                headers: {
                    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)",
                    "Referer": playUrl
                }
            };
        }

        return { url: playUrl, headers: {} };
    },

    /**
     * 搜索视频
     */
    search: function(wd, pg) {
        var url = "https://www.dcc3.com/search/?wd=" + encodeURIComponent(wd);
        var html = request(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
                "Referer": "https://www.dcc3.com/"
            }
        });

        var list = [];
        var re = /<li[^>]*>[\s\S]*?<a class="cover"[^>]+href="(\/detail\/\d+\/)"[^>]*title="([^"]*)"[\s\S]*?<img[^>]+(?:data-original|src)="([^"]+)"[\s\S]*?(?:<div class="item"><span>状态：<\/span>([^<]*)<\/div>)?/g;
        var m;
        while ((m = re.exec(html)) !== null) {
            var pic = m[3] || "";
            if (pic.indexOf("load.gif") !== -1) {
                var realM = m[0].match(/data-original="([^"]+)"/);
                if (realM) pic = realM[1];
            }
            list.push({
                vod_id: m[1],
                vod_name: m[2].trim(),
                vod_pic: pic,
                vod_remarks: m[4] ? m[4].trim() : ""
            });
        }

        return { code: 1, list: list };
    }
};
