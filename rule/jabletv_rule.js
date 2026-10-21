/**
 * Jable.TV - WFTVIOS 规则
 * 规范: WFTV / TVBox / DRpy 标准规则引擎
 */

var rule = {
    title: 'Jable.TV',
    host: 'https://jable.tv',
    // proxy: 'socks5://ip.oily.cn:1081',
    url: '/fyclass/?from=fypage',
    searchUrl: '/search/**/?from=fypage',
    headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
        'Referer': 'https://jable.tv/',
        // 关键点：填入浏览器通过验证后的 cf_clearance 值，即可完全突破 403 盾
        //'Cookie': 'cf_clearance=6y.7G341VpofmxEvzIsCAfRW0ySxYzJKT_0tbjM8mjc-1791477379-1.2.1.1-q62UbTq8yyRA6GmD6LBvbykSkF8SsFe7qqdAd0Z9DVXMuBExtU6UIW3tRT0yz2zI8fy5HBuY.c7osQ9UnnK1U9pvw9VYeXYJ3f9uTFbV8r_j7kbaJNhI5hXaloZ0oSHK_s3qkngHsvR5D7ZGLLoiAgwrgAjQsq.9hR5.MzP53e2NiYZ.xzldmfkIVcXY.yFdba8YQuxNCaJlVUHO4jVjydYKBrPVY_wdZgI6_dpkboM12aJJRBg9x.YCR_bB4WeUI2nNdMxokLu0OPtzEojVYePa3WNC0Jc2WPWQtB2TN9e2hK1nw0ICd6XLKs4xztEn2XQbF9.tU2hufnzYku2gkklHmxHLEC7rMpjYnH5.thid4rK0hgSSRECjapHnZev8fk_mE4RhXC0u2aSjL64kgmQ.dEzQJfqbZHuQsUHmJwSIA_j60Qq7gqD8U8KS0Z2hB1KzR2pXkxxVfkysXY.cv0Dv9j5qbE6siKi7.q_x_PvcsZjtJzDDmAFQEAxMGBmDvbQViKlb1BfIsfOYJc0esA'
    },
    class_name: '最新更新&热门影片&中文字幕&无码破解&FC2精选&素人专区&巨乳美胸&熟女人妻&制服诱惑&角色扮演&潮吹内射',
    class_url: 'latest-updates&hot&categories/chinese-subtitle&categories/mosaic-removed&categories/fc2&categories/amateur&categories/big-tits&categories/milf&categories/uniform&categories/cosplay&categories/creampie',
    
    home: function() {
        var names = rule.class_name.split('&');
        var urls = rule.class_url.split('&');
        var cats = [];
        for (var i = 0; i < names.length; i++) {
            if (names[i] && urls[i]) cats.push({ type_id: urls[i], type_name: names[i] });
        }
        var firstList = [];
        try {
            var res = this.category('latest-updates', 1);
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
        tid = (tid || 'latest-updates').replace(/^\/+|\/+$/g, '');
        pg = parseInt(pg) || 1;
        var baseUrl = rule.host + '/' + tid + '/';
        var listUrl = pg <= 1 ? baseUrl : (baseUrl + '?from=' + pg);
        
        var resp = request(listUrl, { headers: rule.headers, timeout: 15 });
        var html = (resp && resp.text) ? resp.text : (typeof resp === 'string' ? resp : '');
        
        var vodList = [];
        var blocks = pdfa(html, '.video-img-box') || [];
        for (var i = 0; i < blocks.length; i++) {
            var b = blocks[i];
            var href = pdfh(b, 'a&&href');
            var idMatch = (href || '').match(/\/videos\/([a-zA-Z0-9_-]+)/);
            if (!idMatch) continue;
            var vid = idMatch[1];
            
            var title = pdfh(b, '.title a&&Text') || pdfh(b, 'img&&alt') || vid;
            title = title.trim();
            var pic = pdfh(b, 'img&&data-src') || pdfh(b, 'img&&src') || '';
            var remark = pdfh(b, '.label&&Text') || pdfh(b, '.sub-title&&Text') || '高清';
            
            vodList.push({
                vod_id: vid,
                vod_name: title,
                vod_pic: pic,
                vod_remarks: remark.trim()
            });
        }
        
        return { code: 1, msg: '数据列表', page: pg, pagecount: 50, limit: vodList.length, total: 1000, list: vodList };
    },
    
    detail: function(vid) {
        vid = String(vid).trim();
        var url = rule.host + '/videos/' + vid + '/';
        var resp = request(url, { headers: rule.headers, timeout: 15 });
        var html = (resp && resp.text) ? resp.text : (typeof resp === 'string' ? resp : '');
        
        var title = pdfh(html, 'meta[property="og:title"]&&content') || pdfh(html, 'title&&Text') || vid;
        title = title.replace(/- Jable\.TV.*/i, '').trim();
        var pic = pdfh(html, 'meta[property="og:image"]&&content') || '';
        
        var m3u8Url = '';
        var hlsMatch = html.match(/var\s+hlsUrl\s*=\s*['"]([^'"]+)['"]/i) ||
                       html.match(/hlsUrl\s*=\s*['"]([^'"]+)['"]/i) ||
                       html.match(/https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/i);
        if (hlsMatch) {
            m3u8Url = hlsMatch[1] || hlsMatch[0];
        } else {
            m3u8Url = url;
        }
        
        return {
            vod_id: vid,
            vod_name: title,
            vod_pic: pic,
            vod_remarks: '正片',
            vod_content: title,
            vod_play_from: 'JableHLS',
            vod_play_url: '播放$' + m3u8Url
        };
    },
    
    play: function(flag, id, flags) {
        var playUrl = String(id || flag || '').trim();
        if (playUrl.indexOf('.m3u8') !== -1) {
            return {
                url: playUrl,
                headers: {
                    'User-Agent': rule.headers['User-Agent'],
                    'Referer': rule.host + '/'
                }
            };
        }
        var resp = request(playUrl, { headers: rule.headers, timeout: 15 });
        var html = (resp && resp.text) ? resp.text : (typeof resp === 'string' ? resp : '');
        var m = html.match(/var\s+hlsUrl\s*=\s*['"]([^'"]+)['"]/i) ||
                html.match(/hlsUrl\s*=\s*['"]([^'"]+)['"]/i) ||
                html.match(/https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/i);
        if (m) {
            return {
                url: m[1] || m[0],
                headers: {
                    'User-Agent': rule.headers['User-Agent'],
                    'Referer': rule.host + '/'
                }
            };
        }
        return { url: playUrl, headers: rule.headers };
    }
};