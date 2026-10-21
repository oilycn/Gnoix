/**
 * 低端影视 (DDYS) - WFTVIOS 通用模版规则
 * 规范: WFTV / TVBox / DRpy 标准规则引擎
 */

function cyDecrypt(encryptedBase64, key) {
    try {
        var encrypted = (typeof atob === "function") ? atob(encryptedBase64) : encryptedBase64;
        var keyLen = key.length, dataLen = encrypted.length;
        var s = new Array(256);
        for (var i = 0; i < 256; i++) s[i] = i;
        var j = 0;
        for (var i = 0; i < 256; i++) {
            j = (j + s[i] + key.charCodeAt(i % keyLen)) % 256;
            var tmp = s[i]; s[i] = s[j]; s[j] = tmp;
        }
        var i = 0, j = 0, decrypted = "";
        for (var k = 0; k < dataLen; k++) {
            i = (i + 1) % 256;
            j = (j + s[i]) % 256;
            var tmp = s[i]; s[i] = s[j]; s[j] = tmp;
            var t = (s[i] + s[j]) % 256;
            var cipherByte = encrypted.charCodeAt(k);
            decrypted += String.fromCharCode(cipherByte ^ s[t]);
        }
        return decrypted;
    } catch (e) {
        return "";
    }
}

var rule = {
    title: '低端影视',
    host: 'https://www.ddys.run',
    url: '/category/fyclass-fypage.html',
    searchUrl: '/?s=**&post_type=post',
    searchable: 1,
    quickSearch: 0,
    filterable: 1,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Referer': 'https://www.ddys.run/',
        'Cookie': 'pageLogin=ok'
    },
    class_name: '电影&剧集&动漫',
    class_url: 'dianying&juji&dongman',
    一级: '.stui-vodlist__box;a.stui-vodlist__thumb&&title;a.stui-vodlist__thumb&&data-original;.pic-text&&Text;a.stui-vodlist__thumb&&href',
    detail: function(vid) {
        var detailUrl = String(vid).trim();
        if (!detailUrl.startsWith('http')) {
            detailUrl = rule.host + (detailUrl.startsWith('/') ? '' : '/') + detailUrl;
        }
        var resp = request(detailUrl, { headers: rule.headers, timeout: 15 });
        var html = (resp && resp.text) ? resp.text : (typeof resp === 'string' ? resp : '');
        if (!html) return { vod_id: vid, vod_name: '', vod_play_url: '' };

        var title = pdfh(html, 'h1.title&&Text') || pdfh(html, 'title&&Text').replace(/\s*在线观看.*$/, '').trim();
        var pic = pd(html, '.stui-content__thumb img&&data-original', rule.host) || pd(html, '.stui-content__thumb img&&src', rule.host);
        var desc = pdfh(html, '.stui-content__detail p&&Text');

        var tabItems = pdfa(html, '.nav-tabs li a');
        var tabNames = [];
        for (var t = 0; t < tabItems.length; t++) {
            var tn = pdfh(tabItems[t], 'Text').trim();
            if (tn) tabNames.push(tn);
        }
        if (tabNames.length === 0) tabNames.push('默认线路');

        var playFromList = [];
        var playUrlList = [];
        for (var t = 0; t < tabNames.length; t++) {
            var items = pdfa(html, '.stui-content__playlist:eq(' + t + ') a');
            var curEps = [];
            for (var i = 0; i < items.length; i++) {
                var it = items[i];
                var epText = pdfh(it, 'Text') || ('第' + (i + 1) + '集');
                var epUrl = pd(it, 'a&&href', rule.host);
                if (epUrl) curEps.push(epText.trim() + '$' + epUrl.trim());
            }
            if (curEps.length > 0) {
                playFromList.push(tabNames[t]);
                playUrlList.push(curEps.join('#'));
            }
        }
        return {
            vod_id: vid,
            vod_name: title,
            vod_pic: pic,
            vod_remarks: desc,
            vod_content: desc,
            vod_play_from: playFromList.join('$$$') || '低端播放',
            vod_play_url: playUrlList.join('$$$')
        };
    },
    play: function(flag, id, flags) {
        var playUrl = String(id || flag || '').trim();
        if (playUrl.indexOf('.mp4') !== -1 || playUrl.indexOf('.m3u8') !== -1) {
            return { url: playUrl, headers: rule.headers };
        }
        var resp = request(playUrl, { headers: rule.headers, timeout: 15 });
        var html = (resp && resp.text) ? resp.text : (typeof resp === 'string' ? resp : '');
        var ddMatch = html.match(/ddcloud\s*\(\s*["']([^"']+)["']\s*,\s*["']([^"']+)["']/i);
        if (ddMatch) {
            var realUrl = cyDecrypt(ddMatch[1], ddMatch[2]);
            if (realUrl) return { url: realUrl, headers: rule.headers };
        }
        var m3u8Match = html.match(/https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/i);
        if (m3u8Match) {
            return { url: m3u8Match[0], headers: rule.headers };
        }
        return { url: '', headers: rule.headers };
    },
    搜索: '.stui-vodlist__box;a.stui-vodlist__thumb&&title;a.stui-vodlist__thumb&&data-original;.pic-text&&Text;a.stui-vodlist__thumb&&href'
};
