/**
 * 奇优影院 (Qiyou) - WFTVIOS 通用模版规则
 * 规范: WFTV / TVBox / DRpy 标准规则引擎
 */

var DEFAULT_HOST = "https://www.qiyoudy88.com";
var NAV_HOST = "https://www.qiyoudy.info";
var cachedHost = "";

function getHost() {
    if (cachedHost) return cachedHost;
    try {
        var resp = request(NAV_HOST, { headers: { "User-Agent": "Mozilla/5.0" }, timeout: 5 });
        var text = (resp && resp.text) ? resp.text : (typeof resp === "string" ? resp : "");
        var m = text.match(/href="(https:\/\/[^"]*qiyou(?:dy)?\d*\.com[^"]*)"/i);
        if (m && m[1]) {
            var u = m[1].trim();
            if (u.indexOf(".info") === -1 && u.indexOf("http") === 0) {
                cachedHost = u.replace(/\/+$/, "");
                return cachedHost;
            }
        }
    } catch (e) {}
    cachedHost = DEFAULT_HOST;
    return cachedHost;
}

var rule = {
    title: '奇优影视',
    host: DEFAULT_HOST,
    url: '/list/fyclass_fypage.html',
    searchUrl: '/search.html?wd=**',
    searchable: 1,
    quickSearch: 0,
    filterable: 1,
    headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
        'Referer': DEFAULT_HOST + '/'
    },
    class_name: '电影&电视剧&动漫&综艺&动作',
    class_url: '1&2&3&4&6',
    category: function(tid, pg) {
        tid = tid || "1";
        pg = parseInt(pg) || 1;
        var host = getHost();
        var listUrl = host + "/list/" + tid + "_" + pg + ".html";
        var resp = request(listUrl, { headers: rule.headers, timeout: 15 });
        var html = (resp && resp.text) ? resp.text : (typeof resp === "string" ? resp : "");
        var list = [];
        var boxRegex = /<div\b[^>]*class="[^"]*stui-vodlist__box[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi;
        var m;
        while ((m = boxRegex.exec(html)) !== null) {
            var block = m[1];
            var titleM = block.match(/title="([^"]+)"/i) || block.match(/<h4[^>]*><a[^>]*>([^<]+)<\/a>/i);
            var hrefM = block.match(/href="([^"]+)"/i);
            var picM = block.match(/data-original="([^"]+)"/i) || block.match(/src="([^"]+)"/i);
            var remM = block.match(/class="[^"]*pic-text[^"]*"[^>]*>([^<]+)<\//i);
            if (titleM && hrefM) {
                var link = hrefM[1].trim();
                if (link.indexOf("http") !== 0) link = host + (link.indexOf("/") === 0 ? "" : "/") + link;
                var pic = picM ? picM[1].trim() : "";
                if (pic && pic.indexOf("http") !== 0) pic = host + (pic.indexOf("/") === 0 ? "" : "/") + pic;
                list.push({ vod_id: link, vod_name: titleM[1].trim(), vod_pic: pic, vod_remarks: remM ? remM[1].trim() : "" });
            }
        }
        return { code: 1, msg: "数据列表", page: pg, pagecount: 999, limit: list.length, total: 1000, list: list };
    },
    detail: function(vid) {
        var host = getHost();
        var detailUrl = String(vid).trim();
        if (detailUrl.indexOf("http") !== 0) {
            detailUrl = host + (detailUrl.indexOf("/") === 0 ? "" : "/") + detailUrl;
        }
        var resp = request(detailUrl, { headers: rule.headers, timeout: 15 });
        var html = (resp && resp.text) ? resp.text : (typeof resp === "string" ? resp : "");
        var title = pdfh(html, "h1&&Text") || "影片详情";
        var pic = pd(html, ".stui-content__thumb img&&data-original", host) || pd(html, ".stui-content__thumb img&&src", host);
        var desc = pdfh(html, ".stui-content__detail p&&Text") || "";

        var tabItems = pdfa(html, ".nav-tabs li a");
        var tabNames = [];
        for (var t = 0; t < tabItems.length; t++) {
            var tn = pdfh(tabItems[t], "Text").trim();
            if (tn) tabNames.push(tn);
        }
        if (tabNames.length === 0) tabNames.push("默认线路");

        var playFromList = [];
        var playUrlList = [];
        for (var t = 0; t < tabNames.length; t++) {
            var items = pdfa(html, ".stui-content__playlist:eq(" + t + ") a");
            var curEps = [];
            for (var i = 0; i < items.length; i++) {
                var it = items[i];
                var epText = pdfh(it, "Text") || ("第" + (i + 1) + "集");
                var epUrl = pd(it, "a&&href", host);
                if (epUrl) curEps.push(epText.trim() + "$" + epUrl.trim());
            }
            if (curEps.length > 0) {
                playFromList.push(tabNames[t]);
                playUrlList.push(curEps.join("#"));
            }
        }
        return {
            vod_id: vid,
            vod_name: title,
            vod_pic: pic,
            vod_remarks: desc,
            vod_content: desc,
            vod_play_from: playFromList.join("$$$") || "奇优播放",
            vod_play_url: playUrlList.join("$$$")
        };
    },
    play: function(flag, id, flags) {
        var playUrl = String(id || flag || "").trim();
        if (!playUrl) return { url: "", headers: rule.headers };
        var host = getHost();
        if (playUrl.indexOf("http") !== 0) {
            playUrl = host + (playUrl.indexOf("/") === 0 ? "" : "/") + playUrl;
        }
        if (playUrl.indexOf(".mp4") !== -1 || playUrl.indexOf(".m3u8") !== -1) {
            return { url: playUrl, headers: rule.headers };
        }
        var resp = request(playUrl, { headers: rule.headers, timeout: 15 });
        var html = (resp && resp.text) ? resp.text : (typeof resp === "string" ? resp : "");
        var iframeM = html.match(/<iframe\b[^>]*src=["']?([^"'>]+)/i);
        var iframeSrc = "";
        if (iframeM) {
            iframeSrc = iframeM[1].trim();
            if (iframeSrc.indexOf("//") === 0) iframeSrc = "https:" + iframeSrc;
            else if (iframeSrc.indexOf("http") !== 0) iframeSrc = host + (iframeSrc.indexOf("/") === 0 ? "" : "/") + iframeSrc;
        }

        if (iframeSrc) {
            var urlParam = iframeSrc.match(/[?&]url=([^&]+)/i);
            if (urlParam) {
                var dec = decodeURIComponent(urlParam[1]);
                if (dec.indexOf("http") === 0 && (dec.indexOf(".m3u8") !== -1 || dec.indexOf(".mp4") !== -1)) {
                    return { url: dec, headers: rule.headers };
                }
            }
            try {
                // 直接请求 iframeSrc（curl 自动追踪 302 重定向到真实的播放器页）
                var ifResp = request(iframeSrc, { headers: { "Referer": playUrl, "User-Agent": rule.headers["User-Agent"] }, timeout: 10 });
                var ifHtml = (ifResp && ifResp.text) ? ifResp.text : (typeof ifResp === "string" ? ifResp : "");
                
                var directM3u8 = ifHtml.match(/(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/i) || ifHtml.match(/(https?:\/\/[^\s"'<>]+\.mp4[^\s"'<>]*)/i);
                if (directM3u8) {
                    return { url: directM3u8[1].replace(/\\/g, ""), headers: { "Referer": iframeSrc, "User-Agent": rule.headers["User-Agent"] } };
                }
                
                var urlMatch = ifHtml.match(/const\s+Url\s*=\s*["']([^"']+)["']/i) || ifHtml.match(/var\s+url\s*=\s*["']([^"']+)["']/i);
                var signMatch = ifHtml.match(/const\s+Sign\s*=\s*["']([^"']+)["']/i) || ifHtml.match(/var\s+sign\s*=\s*["']([^"']+)["']/i);
                var fromMatch = ifHtml.match(/const\s+From\s*=\s*["']([^"']+)["']/i) || ifHtml.match(/var\s+from\s*=\s*["']([^"']+)["']/i);
                if (urlMatch && signMatch) {
                    var uParam = urlMatch[1];
                    var sParam = signMatch[1];
                    var fParam = fromMatch ? fromMatch[1] : "m3u8";
                    
                    var originMatch = iframeSrc.match(/^(https?:\/\/[^\/]+)/i);
                    var origin = originMatch ? originMatch[1] : host;
                    var fullApi = origin + "/player/api.php?url=" + encodeURIComponent(uParam) + "&sign=" + encodeURIComponent(sParam) + "&t=" + encodeURIComponent(fParam);
                    
                    var apiResp = request(fullApi, { headers: { "Referer": iframeSrc, "User-Agent": rule.headers["User-Agent"] }, timeout: 10 });
                    var apiText = (apiResp && apiResp.text) ? apiResp.text : (typeof apiResp === "string" ? apiResp : "");
                    try {
                        var apiJson = JSON.parse(apiText);
                        if (apiJson && apiJson.url && apiJson.url.indexOf("http") === 0) {
                            return { url: apiJson.url, headers: { "Referer": iframeSrc, "User-Agent": rule.headers["User-Agent"] } };
                        }
                    } catch(e) {}
                }
            } catch(e) {}
        }
        var directM = html.match(/(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/i);
        if (directM) return { url: directM[1].replace(/\\/g, ""), headers: rule.headers };
        return { url: "", headers: rule.headers };
    }
};
