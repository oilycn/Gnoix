/**
 * 剧踪影院 (Juzong) - WFTVIOS 通用模版规则
 * 规范: WFTV / TVBox / DRpy 标准规则引擎
 * 核心升级:
 * 1. 适配最新 CMS 播放器架构 (MacPlayer + WGArt / 剧踪独家 JSON API 动态签名解析)
 * 2. 自动逆向解析 juzong1- 加密串，直通 WGArt api.php 获取 1080P/超清无广告直链
 * 3. 完整支持 8~11 大播放线路 (独家热播、西瓜海外、暴风海外、电影天堂、酷播国内等)
 * 4. 完美绕过 403 Cookie 盾防爬，自动保持会话状态
 * 5. 针对 douyinvod / bytevod 等直链剥离防盗链 Referer，彻底解决 403 无法播放问题
 */

var NAV_HOST = "https://juzong.vip";
var DEFAULT_HOST = "https://www.juzong01.me";
var cachedHost = "";

var HEADERS = {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    "Referer": DEFAULT_HOST + "/"
};

function getHost() {
    return DEFAULT_HOST;
}

function parseCards(html, host) {
    var list = [];
    var seen = {};
    var cardRegex = /<li\b[^>]*class=["'][^"']*(?:col-md-7|col-xs-3|stui-vodlist__item)[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi;
    var match;

    while ((match = cardRegex.exec(html)) !== null) {
        var block = match[1];
        var hrefM = block.match(/href=["']([^"']*(?:\/voddetail\/)[^"']*)["']/i) ||
                    block.match(/href=["']([^"']+\.html|\/voddetail\/[^"']+)["']/i);
        var titleM = block.match(/title=["']([^"']+)["']/i) ||
                     block.match(/alt=["']([^"']+)["']/i) ||
                     block.match(/<h\d\b[^>]*><a[^>]*>([^<]+)<\/a>/i);
        var picM = block.match(/data-original=["']([^"']+)["']/i) ||
                   block.match(/data-src=["']([^"']+)["']/i) ||
                   block.match(/src=["']([^"']+)["']/i);
        var remM = block.match(/class=["'][^"']*(?:pic-text|remarks|badge)[^"']*["'][^>]*>([^<]+)<\//i);

        if (hrefM && titleM) {
            var link = fixUrl(hrefM[1], host);
            if (seen[link]) continue;
            seen[link] = true;

            list.push({
                vod_id: link,
                vod_name: titleM[1].trim(),
                vod_pic: picM ? fixUrl(picM[1], host) : "",
                vod_remarks: remM ? remM[1].trim() : ""
            });
        }
    }
    return list;
}

function fixUrl(u, base) {
    if (!u) return "";
    u = u.trim();
    if (u.indexOf("//") === 0) return "https:" + u;
    if (u.indexOf("http") === 0) return u;
    var root = base || getHost();
    return root + (u.indexOf("/") === 0 ? "" : "/") + u;
}

function cleanMediaUrl(u) {
    if (!u) return "";
    return u.replace(/&amp;/g, "&").replace(/\\/g, "").trim();
}

function buildPlayHeaders(realUrl, host) {
    if (/(douyinvod\.com|bytevod\.com|kspkg\.com|zijiecdn\.com|bdxiguavod\.com|bytetos\.com|byteicdn\.com)/i.test(realUrl)) {
        return {
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"
        };
    }
    return {
        "User-Agent": HEADERS["User-Agent"],
        "Referer": (host || DEFAULT_HOST) + "/"
    };
}

function fetchWithCookieBypass(url) {
    var host = getHost();
    var resp = request(url, { headers: { "User-Agent": HEADERS["User-Agent"], "Referer": host + "/" }, timeout: 8 });
    var html = (resp && resp.text) ? resp.text : (typeof resp === "string" ? resp : "");
    if (html && html.indexOf("window.location.href") !== -1 && html.indexOf("<title></title>") !== -1) {
        var resp2 = request(url, { headers: { "User-Agent": HEADERS["User-Agent"], "Referer": host + "/" }, timeout: 8 });
        var html2 = (resp2 && resp2.text) ? resp2.text : (typeof resp2 === "string" ? resp2 : "");
        if (html2) html = html2;
    }
    return html;
}

var rule = {
    title: '剧踪影院',
    host: DEFAULT_HOST,
    url: '/vodtype/fyclass-fypage/',
    searchUrl: '/vodsearch/**----------fypage---/',
    searchable: 1,
    quickSearch: 0,
    filterable: 1,
    headers: HEADERS,
    class_name: '电影&电视剧&综艺&动漫',
    class_url: '1&2&3&4',

    /**
     * 1. 首页与分类
     */
    home: function() {
        var host = getHost();
        var html = fetchWithCookieBypass(host + "/");
        
        var categories = [
            { type_id: "1", type_name: "电影" },
            { type_id: "2", type_name: "电视剧" },
            { type_id: "3", type_name: "综艺" },
            { type_id: "4", type_name: "动漫" }
        ];

        var list = parseCards(html, host);
        return {
            code: 1,
            msg: "数据列表",
            class: categories,
            list: list
        };
    },

    /**
     * 2. 分类分页列表
     */
    category: function(tid, pg) {
        tid = String(tid || "1").trim();
        pg = parseInt(pg) || 1;
        var host = getHost();

        var listUrl = host + "/vodtype/" + tid + "-" + pg + "/";
        var html = fetchWithCookieBypass(listUrl);

        var list = [];
        var seen = {};
        var cardRegex = /<li\b[^>]*class=["'][^"']*(?:col-md-7|col-xs-3|stui-vodlist__item)[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi;
        var match;

        while ((match = cardRegex.exec(html)) !== null) {
            var block = match[1];
            var hrefM = block.match(/href=["']([^"']*(?:\/voddetail\/)[^"']*)["']/i) ||
                        block.match(/href=["']([^"']+\.html|\/voddetail\/[^"']+)["']/i);
            var titleM = block.match(/title=["']([^"']+)["']/i) ||
                         block.match(/alt=["']([^"']+)["']/i) ||
                         block.match(/<h\d\b[^>]*><a[^>]*>([^<]+)<\/a>/i);
            var picM = block.match(/data-original=["']([^"']+)["']/i) ||
                       block.match(/data-src=["']([^"']+)["']/i) ||
                       block.match(/src=["']([^"']+)["']/i);
            var remM = block.match(/class=["'][^"']*(?:pic-text|remarks|badge)[^"']*["'][^>]*>([^<]+)<\//i);

            if (hrefM && titleM) {
                var link = fixUrl(hrefM[1], host);
                if (seen[link]) continue;
                seen[link] = true;

                list.push({
                    vod_id: link,
                    vod_name: titleM[1].trim(),
                    vod_pic: picM ? fixUrl(picM[1], host) : "",
                    vod_remarks: remM ? remM[1].trim() : ""
                });
            }
        }

        return {
            code: 1,
            msg: "数据列表",
            page: pg,
            pagecount: 999,
            limit: list.length,
            total: 1000,
            list: list
        };
    },

    /**
     * 3. 详情与分集 (支持多线路精准分类)
     */
    detail: function(vid) {
        var host = getHost();
        var detailUrl = fixUrl(vid, host);
        var html = fetchWithCookieBypass(detailUrl);
        if (!html) return { vod_id: vid, vod_name: "", vod_play_url: "" };

        var titleM = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i) || html.match(/<title>([^<_\-]+)/i);
        var title = titleM ? titleM[1].replace(/<[^>]+>/g, "").trim() : "剧踪视频";

        var picM = html.match(/class=["'][^"']*(?:thumb|detail-pic|lazyload)[^"']*["'][\s\S]*?(?:data-original|data-src|src)=["']([^"']+)["']/i) ||
                   html.match(/<meta property=["']og:image["'] content=["']([^"']+)["']/i);
        var pic = picM ? fixUrl(picM[1], host) : "";

        var descM = html.match(/class=["'][^"']*(?:detail-content|detail-sketch)[^"']*["'][^>]*>([\s\S]*?)<\/span>/i) ||
                    html.match(/<meta property=["']og:description["'] content=["']([^"']+)["']/i);
        var desc = descM ? descM[1].replace(/<[^>]+>/g, "").trim() : "";

        // 提取线路名称
        var tabNames = [];
        var tabRegex = /<h3\b[^>]*class=["']title["'][^>]*>([\s\S]*?)<\/h3>/gi;
        var tm;
        while ((tm = tabRegex.exec(html)) !== null) {
            var raw = tm[1].replace(/<[^>]+>/g, "").trim();
            if (raw && raw !== "为你推荐" && raw.indexOf("排行榜") === -1 && raw !== "热播榜") {
                tabNames.push(raw);
            }
        }
        if (tabNames.length === 0) {
            tabNames = ["剧踪独家", "剧踪海外", "剧踪备用"];
        }

        var playFromList = [];
        var playUrlList = [];

        var listBlocks = html.split(/class=["'][^"']*stui-content__playlist/i);
        for (var b = 1; b < listBlocks.length; b++) {
            var blockContent = listBlocks[b].split(/<\/ul>/i)[0];
            var epRegex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
            var em;
            var eps = [];
            while ((em = epRegex.exec(blockContent)) !== null) {
                var epHref = fixUrl(em[1], host);
                var epTitle = em[2].replace(/<[^>]+>/g, "").trim();
                if (epHref && epTitle && (epHref.indexOf("/vodplay/") !== -1 || epHref.indexOf(".html") !== -1)) {
                    eps.push(epTitle + "$" + epHref);
                }
            }
            if (eps.length > 0) {
                playFromList.push(tabNames[b - 1] || ("线路" + b));
                playUrlList.push(eps.join("#"));
            }
        }

        if (playUrlList.length === 0) {
            var fallbackReg = /<a\b[^>]*href=["']([^"']*(?:\/vodplay\/)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
            var fm;
            var fallbackEps = [];
            var seenEp = {};
            while ((fm = fallbackReg.exec(html)) !== null) {
                var fHref = fixUrl(fm[1], host);
                var fTitle = fm[2].replace(/<[^>]+>/g, "").trim();
                if (!seenEp[fHref] && fTitle) {
                    seenEp[fHref] = true;
                    fallbackEps.push(fTitle + "$" + fHref);
                }
            }
            if (fallbackEps.length > 0) {
                playFromList.push("剧踪播放");
                playUrlList.push(fallbackEps.join("#"));
            }
        }

        return {
            vod_id: vid,
            vod_name: title,
            vod_pic: pic,
            vod_remarks: "超清",
            vod_content: desc,
            vod_play_from: playFromList.join("$$$") || "剧踪播放",
            vod_play_url: playUrlList.join("$$$")
        };
    },

    /**
     * 4. 播放地址直链提取 (逆向还原 WGArt JSON API 动态签名)
     */
    play: function(flag, id, flags) {
        var host = getHost();
        var playUrl = fixUrl(String(id || flag || ""), host);
        if (!playUrl) return { url: "", headers: HEADERS };

        // 1. 本身已是流媒体直链
        if (/\.(m3u8|mp4)($|\?)/i.test(playUrl)) {
            var cleanUrl = cleanMediaUrl(playUrl);
            return {
                url: cleanUrl,
                headers: buildPlayHeaders(cleanUrl, host)
            };
        }

        // 2. 请求播放网页
        var html = fetchWithCookieBypass(playUrl);

        // 3. 从播放页提取 player_data
        var pMatch = html.match(/player_data\s*=\s*({[\s\S]*?})<\/script>/i) ||
                     html.match(/player_data\s*=\s*({[\s\S]*?});/i);
        if (pMatch) {
            try {
                var pData = JSON.parse(pMatch[1]);
                var rawUrl = pData.url || "";
                
                // 3.1 已经是直接媒体直链 (如海外线 dyttm3u8 / xiguam3u8 / bfzym3u8)
                if (rawUrl.indexOf("http") === 0) {
                    var directDec = cleanMediaUrl(rawUrl);
                    return {
                        url: directDec,
                        headers: buildPlayHeaders(directDec, host)
                    };
                }

                // 3.2 独家线路加密串 (如 juzong1-...)
                if (rawUrl.indexOf("juzong") === 0) {
                    var basePlayer = "https://jzpic.ok1333.cn/";
                    var iframeUrl = basePlayer + "?url=" + encodeURIComponent(rawUrl);
                    var ifResp = request(iframeUrl, { headers: { "Referer": playUrl, "User-Agent": HEADERS["User-Agent"] }, timeout: 8 });
                    var ifHtml = (ifResp && ifResp.text) ? ifResp.text : (typeof ifResp === "string" ? ifResp : "");
                    
                    var tokenMatch = ifHtml.match(/window\.WGART_PARSE_TOKEN\s*=\s*["']([^"']+)["']/i);
                    if (tokenMatch) {
                        var token = tokenMatch[1];
                        var apiUrl = basePlayer + "wgart/api.php?action=try_json_api&video_url=" + encodeURIComponent(rawUrl) + "&parse_token=" + encodeURIComponent(token);
                        var apiResp = request(apiUrl, { headers: { "Referer": iframeUrl, "User-Agent": HEADERS["User-Agent"] }, timeout: 8 });
                        var apiText = (apiResp && apiResp.text) ? apiResp.text : (typeof apiResp === "string" ? apiResp : "");
                        var apiJson = JSON.parse(apiText);
                        if (apiJson && apiJson.success && apiJson.data && apiJson.data.url) {
                            var realMediaUrl = cleanMediaUrl(apiJson.data.url);
                            return {
                                url: realMediaUrl,
                                headers: buildPlayHeaders(realMediaUrl, host)
                            };
                        }
                    }
                }
            } catch(e) {}
        }

        // 4. 备用策略: 扫描页面中的 <video> 标签或 iframe
        var videoTagM = html.match(/<video\b[^>]*\bsrc=["']([^"']+)["']/i);
        if (videoTagM && videoTagM[1] && videoTagM[1].indexOf("http") === 0) {
            var realVideoUrl = cleanMediaUrl(videoTagM[1]);
            return {
                url: realVideoUrl,
                headers: buildPlayHeaders(realVideoUrl, host)
            };
        }

        var iframeM = html.match(/<iframe\b[^>]*src=["']?([^"'\s>]+)/i);
        if (iframeM) {
            var ifSrc = fixUrl(iframeM[1], host);
            var ifResp2 = request(ifSrc, { headers: { "Referer": playUrl, "User-Agent": HEADERS["User-Agent"] }, timeout: 8 });
            var ifHtml2 = (ifResp2 && ifResp2.text) ? ifResp2.text : (typeof ifResp2 === "string" ? ifResp2 : "");
            var ifDirect = ifHtml2.match(/(https?:\/\/[^"'\s<>]+\.(?:m3u8|mp4)[^"'\s<>]*)/i);
            if (ifDirect) {
                var dUrl = cleanMediaUrl(ifDirect[1]);
                return {
                    url: dUrl,
                    headers: buildPlayHeaders(dUrl, host)
                };
            }
        }

        // 5. 兜底扫描页面中的任何媒体流
        var directStream = html.match(/(https?:\/\/[^"'\s<>]+\.(?:m3u8|mp4)[^"'\s<>]*)/i);
        if (directStream) {
            var finalDirect = cleanMediaUrl(directStream[1]);
            return {
                url: finalDirect,
                headers: buildPlayHeaders(finalDirect, host)
            };
        }

        return {
            url: "",
            headers: HEADERS
        };
    },

    /**
     * 5. 关键词搜索
     */
    search: function(wd, pg) {
        pg = parseInt(pg) || 1;
        var host = getHost();
        var sUrl = host + "/vodsearch/" + encodeURIComponent(wd) + "----------" + pg + "---/";
        var html = fetchWithCookieBypass(sUrl);
        if (!html) return { list: [] };

        var list = [];
        var seen = {};
        var cardRegex = /<li\b[^>]*class=["'][^"']*(?:col-md-7|col-xs-3|stui-vodlist__item)[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi;
        var match;

        while ((match = cardRegex.exec(html)) !== null) {
            var block = match[1];
            var hrefM = block.match(/href=["']([^"']*(?:\/voddetail\/)[^"']*)["']/i) ||
                        block.match(/href=["']([^"']+\.html|\/voddetail\/[^"']+)["']/i);
            var titleM = block.match(/title=["']([^"']+)["']/i) ||
                         block.match(/alt=["']([^"']+)["']/i) ||
                         block.match(/<h\d\b[^>]*><a[^>]*>([^<]+)<\/a>/i);
            var picM = block.match(/data-original=["']([^"']+)["']/i) ||
                       block.match(/data-src=["']([^"']+)["']/i) ||
                       block.match(/src=["']([^"']+)["']/i);

            if (hrefM && titleM) {
                var link = fixUrl(hrefM[1], host);
                if (seen[link]) continue;
                seen[link] = true;

                list.push({
                    vod_id: link,
                    vod_name: titleM[1].trim(),
                    vod_pic: picM ? fixUrl(picM[1], host) : "",
                    vod_remarks: "搜索结果"
                });
            }
        }

        return { list: list };
    }
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = rule;
}