/**
 * 黄果短剧 - WFTVIOS / TVBox / DRpy 规则 (动态发布页免代理版 - 晚风TV优化加固)
 * 特性：
 * 1. 自动通过发布页代理/直连提取最新国内可用域名，彻底告别代理
 * 2. 精准全集提取，解决选集截断或误匹配问题
 * 3. 动态提取真实 m3u8 直链秒播
 */

var rule = {
    title: '黄果短剧',
    host: 'https://thu.vchllzwu.cc', // 初始默认，初次运行会自动从发布页更新
    url: '/fyclass/fypage/',
    class_name: 'AI成人短剧&AI成人漫剧&AI换脸&AI魔改',
    class_url: 'ai-duanju&ai-manju&ai-huanlian&ai-mogai',

    // 发布页数据源列表（优先使用代理，备用官方直连）
    publishSources: [
        'https://proxy.oily.cn/proxy/https://huangguoai.pages.dev/publish.js',
        'https://huangguoai.pages.dev/publish.js',
        'https://huang-guo.pages.dev/publish.js'
    ],
    // 应急硬编码备选域名
    fallbackHosts: [
        'https://thu.vchllzwu.cc',
        'https://fdu.vchllzwu.cc',
        'https://pku.vchllzwu.cc',
        'https://huangguoai.com'
    ],
    _cachedHost: '',
    _lastCheckTime: 0,

    /**
     * 自动从发布页获取并健康探测最新免代理 Host
     */
    getHost: function() {
        var now = Date.now();
        // 缓存 2 小时，避免翻页/选集时重复探测发布页造成卡顿
        if (rule._cachedHost && (now - rule._lastCheckTime < 7200000)) {
            return rule._cachedHost;
        }

        var candidates = [];
        for (var i = 0; i < rule.publishSources.length; i++) {
            try {
                var resp = request(rule.publishSources[i], { timeout: 4 });
                var js = (resp && resp.text) ? resp.text : (typeof resp === 'string' ? resp : '');
                if (js && js.indexOf('urls=') !== -1) {
                    var urlsMatch = js.match(/urls\s*=\s*\[([\s\S]*?)\]/);
                    var subMatch = js.match(/subdomains\s*=\s*\[([\s\S]*?)\]/);
                    if (urlsMatch) {
                        var rawUrls = urlsMatch[1].match(/['"]([^'"]+)['"]/g) || [];
                        var domains = [];
                        for (var d = 0; d < rawUrls.length; d++) {
                            var clean = rawUrls[d].replace(/['"/]/g, '').trim();
                            if (clean) domains.push(clean);
                        }
                        var subs = ['thu', 'pku', 'fdu'];
                        if (subMatch) {
                            var rawSubs = subMatch[1].match(/['"]([^'"]+)['"]/g) || [];
                            if (rawSubs.length > 0) {
                                subs = rawSubs.slice(0, 3).map(function(s) { return s.replace(/['"]/g, ''); });
                            }
                        }
                        for (var di = 0; di < domains.length; di++) {
                            for (var si = 0; si < subs.length; si++) {
                                candidates.push('https://' + subs[si] + '.' + domains[di]);
                            }
                        }
                    }
                    if (candidates.length > 0) break;
                }
            } catch(e) {}
        }

        candidates = candidates.concat(rule.fallbackHosts);

        // 探测可用性（选用首个健康状态为 200 的通畅直连域名）
        var tested = {};
        for (var c = 0; c < candidates.length; c++) {
            var target = candidates[c];
            if (!target || tested[target]) continue;
            tested[target] = true;
            try {
                var testRes = request(target + '/favicon.ico', { timeout: 3 });
                var isOk = false;
                if (testRes) {
                    if (testRes.status === 200 || testRes.code === 200 || testRes.statusCode === 200) {
                        isOk = true;
                    } else if (typeof testRes === 'string' && testRes.length > 0) {
                        isOk = true;
                    }
                }
                if (isOk) {
                    rule._cachedHost = target;
                    rule._lastCheckTime = now;
                    rule.host = target;
                    return target;
                }
            } catch(te) {}
        }

        rule._cachedHost = rule.fallbackHosts[0];
        rule.host = rule._cachedHost;
        return rule.host;
    },

    getHeaders: function() {
        var h = (rule.getHost && rule.getHost()) || rule.host;
        return {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
            'Referer': h + '/',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Cookie': 'dx150_age_verified=1; sm_age_verified=1;'
        };
    },

    fixUrl: function(url) {
        if (!url) return '';
        url = String(url).trim();
        if (url.indexOf('//') === 0) return 'https:' + url;
        if (url.indexOf('http') !== 0) {
            var h = (rule.getHost && rule.getHost()) || rule.host;
            return h + (url.indexOf('/') === 0 ? '' : '/') + url;
        }
        return url;
    },

    safeRequest: function(url, timeout) {
        try {
            var opt = { headers: rule.getHeaders(), timeout: timeout || 12 };
            var resp = request(url, opt);
            if (!resp) return '';
            if (typeof resp === 'string') return resp;
            return resp.text || resp.body || '';
        } catch (e) {
            return '';
        }
    },

    home: function() {
        var names = rule.class_name.split('&');
        var urls = rule.class_url.split('&');
        var cats = [];
        for (var i = 0; i < names.length; i++) {
            if (names[i] && urls[i]) {
                cats.push({ type_id: urls[i].trim(), type_name: names[i].trim() });
            }
        }
        var firstList = [];
        try {
            var res = rule.category('ai-duanju', 1);
            firstList = (res && res.list) ? res.list : [];
        } catch(e) {}
        return {
            code: 1,
            msg: '数据列表',
            class: cats,
            list: firstList
        };
    },

    category: function(tid, pg) {
        var curHost = rule.getHost();
        tid = tid || 'ai-duanju';
        pg = parseInt(pg) || 1;
        var listUrl = pg === 1 ? (curHost + '/' + tid + '/') : (curHost + '/' + tid + '/' + pg + '/');
        var html = rule.safeRequest(listUrl);
        var vodList = [];
        var cardRegex = /<div class=["']hg-drama-card["'][\s\S]*?(?=<div class=["']hg-drama-card["']|<\/div>\s*<\/section>)/g;
        var cards = html.match(cardRegex) || [];
        for (var i = 0; i < cards.length; i++) {
            var c = cards[i];
            var hrefM = c.match(/\/video\/(\d+)\//);
            if (!hrefM) continue;
            var vid = hrefM[1];

            var titleM = c.match(/class=["']hg-drama-card__title["'][^>]*>[\s\S]*?<a[^>]*>([^<]+)/);
            var title = titleM ? titleM[1].trim() : ('短剧 ' + vid);
            title = title.replace(/全集在线观看.*$/, '').trim();

            var picM = c.match(/data-src=["']([^"']+)["']/) || c.match(/src=["']([^"']+)["']/);
            var pic = picM ? picM[1] : '';
            if (pic.indexOf('placeholder') !== -1) pic = '';

            var descM = c.match(/class=["']hg-drama-card__episode["'][^>]*>([\s\S]*?)<\/span>/) ||
                        c.match(/class=["']hg-drama-card__desc["'][^>]*>([\s\S]*?)<\/p>/);
            var desc = descM ? descM[1].replace(/<[^>]+>/g, '').trim() : '全集短剧';

            vodList.push({
                vod_id: vid,
                vod_name: title,
                vod_pic: rule.fixUrl(pic),
                vod_remarks: desc.substring(0, 15)
            });
        }
        return { code: 1, msg: '数据列表', page: pg, pagecount: 50, limit: vodList.length, total: 1000, list: vodList };
    },

    detail: function(vid) {
        var curHost = rule.getHost();
        vid = String(vid).trim();
        var url = curHost + '/video/' + vid + '/';
        var html = rule.safeRequest(url);

        var title = '短剧 ' + vid;
        var pic = '';
        var intro = '';
        var epSrcs = {};
        var directVideo1 = '';

        // 1. 解析初始 JSON (提取第1、2集已有的直链及基础元数据)
        var initialMatch = html.match(/id=["']videoInitialData["'][^>]*>([\s\S]*?)<\/script>/);
        if (initialMatch) {
            try {
                var data = JSON.parse(initialMatch[1]);
                title = data.title || title;
                pic = rule.fixUrl(data.coverSrc || data.posterSrc || '');
                intro = data.description || '';
                if (data.videoSrc) directVideo1 = rule.fixUrl(data.videoSrc);
                if (data.epPlaySrcs && typeof data.epPlaySrcs === 'object') {
                    for (var k in data.epPlaySrcs) {
                        epSrcs[k] = rule.fixUrl(data.epPlaySrcs[k]);
                    }
                }
            } catch (e) {}
        }

        // 2. 精准提取选集：扫描页面真实存在的各集链接
        var epLinkRegex = /<a[^>]+class=["'][^"']*hg-web-play__ep[^"']*["'][^>]*href=["']([^"']+)["'][^>]*data-ep-id=["'](\d+)["']/g;
        var m;
        var epMap = {};
        while ((m = epLinkRegex.exec(html)) !== null) {
            epMap[parseInt(m[2], 10)] = rule.fixUrl(m[1]);
        }

        // 兜底匹配
        if (Object.keys(epMap).length === 0) {
            var fallbackReg = /data-ep-id=["'](\d+)["']/g;
            var fm;
            while ((fm = fallbackReg.exec(html)) !== null) {
                var epNum = parseInt(fm[1], 10);
                epMap[epNum] = curHost + '/video/' + vid + (epNum === 1 ? '/' : ('/ep-' + epNum + '/'));
            }
        }

        var epNums = Object.keys(epMap).map(Number);
        var maxEp = epNums.length > 0 ? Math.max.apply(null, epNums) : 1;

        // 3. 组装选集列表
        var playList = [];
        for (var ep = 1; ep <= maxEp; ep++) {
            var epKey = String(ep);
            if (epSrcs[epKey] && (epSrcs[epKey].indexOf('.mp4') !== -1 || epSrcs[epKey].indexOf('.m3u8') !== -1)) {
                // 首屏已有直链，秒播
                playList.push('第' + ep + '集$' + epSrcs[epKey]);
            } else if (ep === 1 && directVideo1 && (directVideo1.indexOf('.mp4') !== -1 || directVideo1.indexOf('.m3u8') !== -1)) {
                playList.push('第1集$' + directVideo1);
            } else {
                // 分集页面链接，由 play() 动态抓取直链
                var epTargetUrl = epMap[ep] || (curHost + '/video/' + vid + (ep === 1 ? '/' : ('/ep-' + ep + '/')));
                playList.push('第' + ep + '集$' + epTargetUrl);
            }
        }

        var vodItem = {
            vod_id: vid,
            vod_name: title,
            vod_pic: pic,
            vod_remarks: '全' + maxEp + '集',
            vod_content: intro,
            vod_play_from: '黄果短剧',
            vod_play_url: playList.join('#')
        };

        return { code: 1, list: [vodItem] };
    },

    play: function(flag, id, flags) {
        var playUrl = String(id || flag || '').trim();

        // 1. 如果已是 m3u8 或 mp4 直链，直接硬解秒播
        if (playUrl.indexOf('.m3u8') !== -1 || playUrl.indexOf('.mp4') !== -1) {
            return {
                url: playUrl,
                headers: rule.getHeaders(),
                header: rule.getHeaders()
            };
        }

        // 2. 请求对应分集页面，动态提取当集真实直链
        var html = rule.safeRequest(playUrl, 10);
        if (html) {
            var initialMatch = html.match(/id=["']videoInitialData["'][^>]*>([\s\S]*?)<\/script>/);
            if (initialMatch) {
                try {
                    var data = JSON.parse(initialMatch[1]);
                    if (data.videoSrc && (data.videoSrc.indexOf('.m3u8') !== -1 || data.videoSrc.indexOf('.mp4') !== -1)) {
                        return {
                            url: rule.fixUrl(data.videoSrc),
                            headers: rule.getHeaders(),
                            header: rule.getHeaders()
                        };
                    }
                    if (data.epPlaySrcs && typeof data.epPlaySrcs === 'object') {
                        var epM = playUrl.match(/\/ep-(\d+)/);
                        var curEp = epM ? epM[1] : (data.ep ? String(data.ep) : '1');
                        if (data.epPlaySrcs[curEp]) {
                            return {
                                url: rule.fixUrl(data.epPlaySrcs[curEp]),
                                headers: rule.getHeaders(),
                                header: rule.getHeaders()
                            };
                        }
                        var keys = Object.keys(data.epPlaySrcs);
                        if (keys.length > 0 && data.epPlaySrcs[keys[0]]) {
                            return {
                                url: rule.fixUrl(data.epPlaySrcs[keys[0]]),
                                headers: rule.getHeaders(),
                                header: rule.getHeaders()
                            };
                        }
                    }
                } catch(e) {}
            }

            var streamMatch = html.match(/https?:\\?\/\\?\/[^\s"']+\.(?:m3u8|mp4)[^\s"']*/i);
            if (streamMatch) {
                var clean = streamMatch[0].replace(/\\u0026/g, '&').replace(/\\/g, '');
                return {
                    url: clean,
                    headers: rule.getHeaders(),
                    header: rule.getHeaders()
                };
            }
        }

        return {
            url: playUrl,
            headers: rule.getHeaders(),
            header: rule.getHeaders()
        };
    },

    search: function(wd, quick, pg) {
        var curHost = rule.getHost();
        var searchUrl = curHost + '/search/video/' + encodeURIComponent(wd) + '/';
        var html = rule.safeRequest(searchUrl);
        var vodList = [];
        var cardRegex = /<div class=["']hg-drama-card["'][\s\S]*?(?=<div class=["']hg-drama-card["']|<\/div>\s*<\/section>)/g;
        var cards = html.match(cardRegex) || [];
        for (var i = 0; i < cards.length; i++) {
            var c = cards[i];
            var hrefM = c.match(/\/video\/(\d+)\//);
            if (!hrefM) continue;
            var vid = hrefM[1];

            var titleM = c.match(/class=["']hg-drama-card__title["'][^>]*>[\s\S]*?<a[^>]*>([^<]+)/);
            var title = titleM ? titleM[1].trim() : ('短剧 ' + vid);

            var picM = c.match(/data-src=["']([^"']+)["']/) || c.match(/src=["']([^"']+)["']/);
            var pic = picM ? picM[1] : '';

            vodList.push({
                vod_id: vid,
                vod_name: title,
                vod_pic: rule.fixUrl(pic),
                vod_remarks: '短剧'
            });
        }
        return {
            code: 1,
            list: vodList
        };
    }
};
