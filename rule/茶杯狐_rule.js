/**
 * 茶杯狐 (Cupfox) - WFTVIOS 通用模版规则
 * 规范: WFTV / TVBox / DRpy 标准规则引擎
 */

var rule = {
    title: '茶杯狐',
    host: 'https://www.cupfox.in',
    url: '/type/fyclass/?page=fypage',
    searchUrl: '/search?q=**&page=fypage',
    searchable: 1,
    quickSearch: 0,
    filterable: 1,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36 Edg/136.0.0.0',
        'Referer': 'https://www.cupfox.in/'
    },
    class_name: '电视剧&电影&动漫&综艺&纪录片',
    class_url: 'tv&movie&anime&show&doc',
    一级: '.movie-list-item;.movie-title&&Text;img&&src;.movie-rating&&Text;a:eq(0)&&href',
    detail: function(vid) {
        var detailUrl = String(vid);
        if (!detailUrl.startsWith('http')) {
            detailUrl = rule.host + (detailUrl.startsWith('/') ? '' : '/') + detailUrl;
        }
        var resp = request(detailUrl, { headers: rule.headers, timeout: 15 });
        var html = (resp && resp.text) ? resp.text : (typeof resp === 'string' ? resp : '');
        if (!html) return { vod_id: vid, vod_name: '', vod_play_url: '' };

        var idMatch = detailUrl.match(/vod-detail\/(\d+)\.html/);
        var id = idMatch ? idMatch[1] : '';
        var title = pdfh(html, '.movie-list-title:eq(0)&&Text') || pdfh(html, 'title&&Text').replace(/\s*在线观看.*$/, '').trim();
        var pic = id ? (rule.host + '/simg/' + id + '.jpg') : '';
        var content = pdfh(html, 'meta[name=description]&&content') || '';
        
        var urls = [];
        var reg = /ep_slug="([^"]+)"[^>]*>([^<]+)</g;
        var m;
        while ((m = reg.exec(html)) !== null) {
            var epSlug = m[1].trim();
            var epTitle = m[2].trim();
            if (epSlug && epTitle && epTitle !== '其他版本') {
                urls.push(epTitle + '$' + id + '-' + epSlug);
            }
        }
        urls.reverse();

        return {
            vod_id: vid,
            vod_name: title || '视频详情',
            vod_pic: pic,
            vod_content: content,
            vod_play_from: '茶杯狐',
            vod_play_url: urls.join('#')
        };
    },
    play: function(flag, id, flags) {
        var playUrl = String(id || flag || '');
        if (playUrl.startsWith('http')) return { url: playUrl };
        var resp = request(rule.host + '/tea/' + playUrl, {
            headers: {
                'User-Agent': rule.headers['User-Agent'],
                'Referer': rule.host + '/'
            },
            timeout: 15
        });
        var text = (resp && resp.text) ? resp.text : (typeof resp === 'string' ? resp : '');
        try {
            var data = JSON.parse(text);
            var plays = (data && data.video_plays) ? data.video_plays : [];
            for (var i = 0; i < plays.length; i++) {
                if (plays[i] && plays[i].play_data) {
                    return { 
                        url: plays[i].play_data, 
                        headers: { 
                            'User-Agent': rule.headers['User-Agent'], 
                            'Referer': rule.host + '/' 
                        } 
                    };
                }
            }
        } catch (e) {}
        return { url: '', headers: {} };
    },
    搜索: '.movie-list-item;.movie-title&&Text;img&&src;.movie-rating&&Text;a:eq(0)&&href'
};
