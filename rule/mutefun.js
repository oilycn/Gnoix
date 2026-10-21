/**
 * Gnoix (晚风TV) 原生 JS 视频源爬虫 - MuteFun动漫 (2kdm.com)
 * 转换适配自 KazumiRules: mutefun (v1.4, 2026-10 最新更新)
 * 特性：专用动漫站点、JSON 原生异步检索 API、直解 Cloudflare R2 极速 MP4 媒体流
 */

var spider = {
    /**
     * 首页与分类定义
     */
    home: function(filter) {
        var categories = [
            { type_id: "20", type_name: "日漫" },
            { type_id: "24", type_name: "美漫" },
            { type_id: "25", type_name: "特摄" },
            { type_id: "26", type_name: "日剧" }
        ];
        var first = this.category("20", 1);
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
        tid = tid || "20";
        pg = parseInt(pg) || 1;
        var url = "https://www.2kdm.com/vodtype/" + tid + "-" + pg + ".html";

        var html = request(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
                "Referer": "https://www.2kdm.com/"
            }
        });

        var list = [];
        var re = /<a[^>]+href="(\/voddetail\/\d+\.html)"[^>]*title="([^"]*)"[\s\S]*?<div class="module-item-note">([^<]*)<\/div>[\s\S]*?<img[^>]+(?:data-original|src)="([^"]+)"/g;
        var m;
        while ((m = re.exec(html)) !== null) {
            list.push({
                vod_id: m[1],
                vod_name: m[2].trim(),
                vod_pic: m[4] || "",
                vod_remarks: m[3] ? m[3].trim() : ""
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
     * 搜索视频：基于 Kazumi 推荐的 /index.php/ajax/suggest API
     */
    search: function(wd, pg) {
        var url = "https://www.2kdm.com/index.php/ajax/suggest?mid=1&wd=" + encodeURIComponent(wd);
        var jsonStr = request(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
                "Referer": "https://www.2kdm.com/"
            }
        });

        var list = [];
        try {
            var data = typeof jsonStr === "string" ? JSON.parse(jsonStr) : jsonStr;
            if (data && Array.isArray(data.list)) {
                for (var i = 0; i < data.list.length; i++) {
                    var item = data.list[i];
                    list.push({
                        vod_id: "/voddetail/" + item.id + ".html",
                        vod_name: item.name,
                        vod_pic: item.pic || "",
                        vod_remarks: item.en || ""
                    });
                }
            }
        } catch(e) {}

        return { code: 1, list: list };
    },

    /**
     * 详情页解析与剧集多线路提取
     */
    detail: function(vid) {
        var detailPath = vid.startsWith("/") ? vid : ("/" + vid);
        var url = "https://www.2kdm.com" + detailPath;
        var html = request(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
                "Referer": "https://www.2kdm.com/"
            }
        });

        var titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
        var title = titleMatch ? titleMatch[1].trim() : "";

        var picMatch = html.match(/<div class="module-item-pic"[^>]*>[\s\S]*?<img[^>]+(?:data-original|src)="([^"]+)"/);
        var pic = picMatch ? picMatch[1] : "";

        var descMatch = html.match(/<div class="video-info-content[^"]*"[^>]*>([\s\S]*?)<\/div>/) || html.match(/<div class="module-info-introduction-content[^"]*"[^>]*>([\s\S]*?)<\/div>/);
        var desc = descMatch ? descMatch[1].replace(/<[^>]+>/g, "").trim() : "";

        // 解析播放线路
        var tabRe = /<div class="module-tab-item tab-item[^"]*"[^>]*>[\s\S]*?<span>([^<]+)<\/span>/g;
        var tabNames = [];
        var tm;
        while ((tm = tabRe.exec(html)) !== null) {
            tabNames.push(tm[1].trim());
        }
        if (tabNames.length === 0) tabNames = ["MuteFun专线"];

        // 解析播放集数
        var listRe = /<div class="module-play-list-content[^"]*"[^>]*>([\s\S]*?)<\/div>/g;
        var playFromList = [];
        var playUrlList = [];
        var lIdx = 0;
        var lm;

        while ((lm = listRe.exec(html)) !== null) {
            var tabName = tabNames[lIdx] || ("线路" + (lIdx + 1));
            lIdx++;
            var epRe = /<a[^>]+href="(\/vodplay\/[^"]+)"[^>]*>[\s\S]*?<span>([^<]+)<\/span>/g;
            var curEps = [];
            var em;
            while ((em = epRe.exec(lm[1])) !== null) {
                var epTitle = em[2].trim();
                var epLink = "https://www.2kdm.com" + em[1];
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
            vod_play_from: playFromList.join("$$$") || "MuteFun",
            vod_play_url: playUrlList.join("$$$")
        };
    },

    /**
     * 播放解析：调度 dp.php 接口获取直链 MP4
     */
    play: function(playUrl) {
        var html = request(playUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
                "Referer": playUrl
            }
        });

        var m = html.match(/player_aaaa\s*=\s*(\{.*?\})<\/script>/);
        if (m) {
            try {
                var p = JSON.parse(m[1]);
                var dpUrl = "https://www.2kdm.com/addons/dp/player/dp.php?key=0&from=" + (p.from || "") + "&id=" + (p.id || "") + "&api=&url=" + (p.url || "") + "&jump=";
                var dpHtml = request(dpUrl, {
                    headers: {
                        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
                        "Referer": "https://www.2kdm.com/"
                    }
                });

                var directMatch = dpHtml.match(/"url":\s*"(https?:\/\/[^"]+)"/);
                if (directMatch) {
                    return {
                        url: directMatch[1],
                        headers: {
                            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
                            "Referer": "https://www.2kdm.com/"
                        }
                    };
                }
            } catch(e) {}
        }

        return { url: playUrl, headers: {} };
    }
};
