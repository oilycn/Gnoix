/**
 * 厂长资源 (4kcz / cz01) - WFTVIOS 通用模版规则
 * 规范: WFTV / TVBox / DRpy 标准规则引擎
 */

var DEFAULT_HOST = "https://www.4kcz.com";
var NAV_HOST = "https://cz01.vip";
var cachedHost = "https://www.4kcz.com";

function getHost() {
    return cachedHost || DEFAULT_HOST;
}

var rule = {
    title: '厂长影视',
    host: DEFAULT_HOST,
    url: '/fyclass/page/fypage',
    searchUrl: '/xssearch?q=**&f=_all&p=fypage',
    searchable: 1,
    quickSearch: 0,
    filterable: 1,
    headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
        'Referer': DEFAULT_HOST + '/',
        'Cookie': 'esc_search_captcha=1'
    },
    class_name: '最新更新&国产剧&美剧&韩剧&日剧&海外剧&番剧&剧场版&最新电影&豆瓣Top250&高分影视&华语电影&欧美电影&日本电影&韩国电影&印度电影&俄罗斯电影&加拿大电影',
    class_url: 'movie_bt&gcj&meijutt&hanjutv&movie_bt/movie_bt_series/rj&movie_bt/movie_bt_series/hwj&fanju&dongmanjuchangban&zuixindianying&dbtop250&gaofenyingshi&huayudianying&oumeidianying&ribendianying&hanguodianying&yindudianying&eluosidianying&jianadadianying',
    home: function() {
        var names = rule.class_name.split('&');
        var urls = rule.class_url.split('&');
        var cats = [];
        for (var i = 0; i < names.length; i++) {
            if (names[i] && urls[i]) cats.push({ type_id: urls[i], type_name: names[i] });
        }
        var firstList = [];
        try {
            var res = this.category('movie_bt', 1);
            firstList = (res && res.list) ? res.list : [];
        } catch (e) {}
        return {
            code: 1,
            msg: '数据列表',
            class: cats,
            list: firstList
        };
    },
    category: function(tid, pg) {
        tid = String(tid || "movie_bt").trim();
        pg = parseInt(pg) || 1;
        var host = getHost();
        var cleanPath = tid.replace(/^\/+|\/+$/g, "");
        var listUrl = (pg > 1) ? (host + "/" + cleanPath + "/page/" + pg) : (host + "/" + cleanPath);
        var resp = request(listUrl, { headers: rule.headers, timeout: 6 });
        var html = (resp && resp.text) ? resp.text : (typeof resp === "string" ? resp : "");
        var list = [];
        var liRegex = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
        var m;
        while ((m = liRegex.exec(html)) !== null) {
            var block = m[1];
            if (block.indexOf("dytit") === -1) continue;
            var titleM = block.match(/<h3\b[^>]*class=["']?dytit[^>]*><a[^>]*>([^<]+)<\/a>/i);
            var hrefM = block.match(/<a\b[^>]*href=["']?([^"'\s>]+)/i);
            var picM = block.match(/data-original=["']?([^"'\s>]+)/i) || block.match(/src=["']?([^"'\s>]+)/i);
            var remM = block.match(/class=["']?[^"'>]*jidi[^"'>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>/i) ||
                       block.match(/class=["']?[^"'>]*qb[^"'>]*>([^<]+)<\/span>/i);
            if (titleM && hrefM) {
                var link = hrefM[1].trim();
                if (link.indexOf("http") !== 0) link = host + (link.indexOf("/") === 0 ? "" : "/") + link;
                var pic = picM ? picM[1].trim() : "";
                if (pic && pic.indexOf("http") !== 0) pic = host + (pic.indexOf("/") === 0 ? "" : "/") + pic;
                list.push({
                    vod_id: link,
                    vod_name: titleM[1].trim(),
                    vod_pic: pic,
                    vod_remarks: remM ? remM[1].trim() : ""
                });
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
        var pic = pd(html, ".dyimg img&&src", host) || "";
        var desc = pdfh(html, ".yp_context&&Text") || "";
        
        var tabItems = pdfa(html, ".mi_paly_box .ypxingq_t");
        var tabNames = [];
        for (var t = 0; t < tabItems.length; t++) {
            var tn = pdfh(tabItems[t], "Text").trim();
            if (tn) tabNames.push(tn);
        }
        if (tabNames.length === 0) tabNames.push("播放线路");

        var playFromList = [];
        var playUrlList = [];
        for (var t = 0; t < tabNames.length; t++) {
            var items = pdfa(html, ".paly_list_btn:eq(" + t + ") a");
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
            vod_play_from: playFromList.join("$$$") || "厂长播放",
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
        // 匹配 iframe
        var iframeM = html.match(/<iframe\b[^>]*\bsrc\s*=\s*["']?([^"'\s>]+)/i);
        if (iframeM) {
            var ifSrc = iframeM[1].trim();
            if (ifSrc.indexOf("//") === 0) ifSrc = "https:" + ifSrc;
            else if (ifSrc.indexOf("http") !== 0) ifSrc = host + (ifSrc.indexOf("/") === 0 ? "" : "/") + ifSrc;
            
            // 策略 A: iframe 带有 url=http 参数
            var urlParam = ifSrc.match(/[?&]url=([^&]+)/i);
            if (urlParam) {
                var dec = decodeURIComponent(urlParam[1]);
                if (dec.indexOf("http") === 0 && (dec.indexOf(".m3u8") !== -1 || dec.indexOf(".mp4") !== -1)) {
                    return { url: dec, headers: { "Referer": ifSrc, "User-Agent": rule.headers["User-Agent"] } };
                }
            }

            var ifResp = request(ifSrc, { headers: { "Referer": playUrl, "User-Agent": rule.headers["User-Agent"] }, timeout: 10 });
            var ifHtml = (ifResp && ifResp.text) ? ifResp.text : (typeof ifResp === "string" ? ifResp : "");

            // 策略 B: Cloud 线路逆序十六进制解密
            if (/Cloud/i.test(ifSrc) || /url\s*=\s*['"][0-9a-fA-F]+['"]/i.test(ifHtml)) {
                var codeM = ifHtml.match(/var\s+url\s*=\s*['"]([0-9a-fA-F]{30,})['"]/i);
                if (codeM) {
                    try {
                        var code = codeM[1].split('').reverse().join('');
                        var temp = '';
                        for (var i = 0; i < code.length; i += 2) {
                            temp += String.fromCharCode(parseInt(code.substr(i, 2), 16));
                        }
                        var realUrl = temp.substring(0, (temp.length - 7) / 2) + temp.substring((temp.length - 7) / 2 + 7);
                        if (realUrl && realUrl.indexOf("http") === 0) {
                            return { url: realUrl, headers: { "Referer": ifSrc, "User-Agent": rule.headers["User-Agent"] } };
                        }
                    } catch(e) {}
                }
            }

            var m3u8M = ifHtml.match(/(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/i) || ifHtml.match(/(https?:\/\/[^"'\s]+\.mp4[^"'\s]*)/i);
            if (m3u8M) return { url: m3u8M[1], headers: { "Referer": ifSrc, "User-Agent": rule.headers["User-Agent"] } };
        }
        var directM = html.match(/(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/i) || html.match(/(https?:\/\/[^"'\s]+\.mp4[^"'\s]*)/i);
        if (directM) return { url: directM[1], headers: rule.headers };
        return { url: "", headers: rule.headers };
    }
};
