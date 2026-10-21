/**
 * 新闪雷 - WFTVIOS 通用模版规则
 * 规范: WFTV / TVBox / DRpy 标准规则引擎
 */

var rule = {
    title: '新闪雷',
    host: 'http://114.100.48.52:18008',
    url: '/jdl/List.asp?ClassId=fyclass&searchword=&page=fypage',
    searchUrl: '/jdl/List.asp?ClassId=30&type=&searchword=**&page=fypage',
    searchable: 1,
    quickSearch: 0,
    filterable: 1,
    headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15',
        'Referer': 'http://114.100.48.52:18008/'
    },
    class_name: '电视剧&大陆地区&港台地区&日韩地区&欧美地区&其他地区&动作片&喜剧片&恐怖片&科幻片&战争片&动画片&爱情片&综艺片&剧情片&MTV',
    class_url: '10&20&21&22&23&24&1&2&3&4&5&6&7&8&9&12',
    category: function(tid, pg) {
        tid = tid || '10';
        pg = parseInt(pg) || 1;
        var listUrl = rule.host + '/jdl/List.asp?ClassId=' + tid + '&searchword=&page=' + pg;
        var resp = request(listUrl, { headers: rule.headers, timeout: 15 });
        var html = (resp && resp.text) ? resp.text : (typeof resp === 'string' ? resp : '');
        var vodList = [];
        var dlRegex = /<DL>([\s\S]*?)<\/DL>/gi;
        var m;
        while ((m = dlRegex.exec(html)) !== null) {
            var block = m[1];
            var idM = block.match(/movie\.asp\?ClassID=(\d+)/i) || block.match(/\?ClassID=(\d+)/i);
            if (!idM) continue;
            var vid = idM[1];
            var titleM = block.match(/<DD classid=["']?h4["']?><A[^>]*>([^<]+)<\/A>/i) || block.match(/title=["']([^"']+)["']/i);
            var title = titleM ? titleM[1].trim() : ('影片 ' + vid);
            var imgM = block.match(/<IMG[^>]*src=["']([^"']+)["']/i);
            var pic = imgM ? imgM[1] : '';
            if (pic.indexOf('../') === 0) pic = rule.host + '/' + pic.replace('../', '');
            else if (pic && !pic.startsWith('http')) pic = rule.host + (pic.startsWith('/') ? '' : '/') + pic;
            var remarkM = block.match(/<SPAN>([^<]+)<\/SPAN>/i);
            vodList.push({ vod_id: vid, vod_name: title, vod_pic: pic, vod_remarks: remarkM ? remarkM[1].trim() : '全集' });
        }
        return { code: 1, msg: '数据列表', page: pg, pagecount: 50, limit: vodList.length, total: 1000, list: vodList };
    },
    detail: function(vid) {
        vid = String(vid).trim();
        var url = rule.host + '/jdl/movie.asp?ClassID=' + vid;
        var resp = request(url, { headers: rule.headers, timeout: 15 });
        var html = (resp && resp.text) ? resp.text : (typeof resp === 'string' ? resp : '');
        var titleM = html.match(/<li classid=["']?h4["']?>([^<]+)<\/li>/i) || html.match(/<title>([^<]+)<\/title>/i);
        var title = titleM ? titleM[1].replace(/欢迎使用闪雷影视系统.*/, '').trim() : ('影片 ' + vid);
        var picM = html.match(/class=["']?intro["']?[\s\S]*?<img[^>]*src=["']([^"']+)["']/i);
        var pic = picM ? picM[1] : '';
        if (pic.indexOf('../') === 0) pic = rule.host + '/' + pic.replace('../', '');
        else if (pic && !pic.startsWith('http')) pic = rule.host + (pic.startsWith('/') ? '' : '/') + pic;
        var actorM = html.match(/<li>主　　演：([^<]+)<\/li>/i) || html.match(/主演：([^<]+)/i);
        var desc = actorM ? actorM[1].trim() : '';

        var epRegex = /<a[^>]*href=["']javascript:senfe\([^,]+,[^,]+,(\d+),(\d+)[^"']*["'][^>]*>([^<]+)<\/a>/gi;
        var epM;
        var playList = [];
        while ((epM = epRegex.exec(html)) !== null) {
            playList.push(epM[3].trim() + '$' + epM[1] + ',' + epM[2]);
        }
        if (playList.length === 0) playList.push('正片$' + vid + ',1');
        return {
            vod_id: vid,
            vod_name: title,
            vod_pic: pic,
            vod_remarks: '全' + playList.length + '集',
            vod_content: desc,
            vod_play_from: '新闪雷',
            vod_play_url: playList.join('#')
        };
    },
    play: function(flag, id, flags) {
        var playUrl = String(id || flag || '');
        if (playUrl.indexOf('.mp4') !== -1 || playUrl.indexOf('.m3u8') !== -1) {
            return { url: playUrl, headers: rule.headers };
        }
        var parts = playUrl.split(',');
        if (parts.length >= 2) {
            var cid = parts[0].trim();
            var movNo = parts[1].trim();
            var playApi = rule.host + '/PlayMov.asp?ClassId=' + cid + '&video=2&exe=0&down=0&movNo=' + movNo + '&vgver=undefined&ClientIP=114.100.48.52';
            var resp = request(playApi, { headers: rule.headers, timeout: 10 });
            var m = (resp.text || resp || '').match(/videoarr\.push\(['"](.*?)['"]\)/);
            if (m) {
                var realUrl = m[1].replace(/https?:\/\/(?:[\d.]+|[\w\-]+)(?::\d+)?\//, rule.host + '/');
                return { url: realUrl, headers: rule.headers };
            }
        }
        return { url: '', headers: rule.headers };
    }
};
