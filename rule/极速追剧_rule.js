/**
 * 极速追剧 (Jisuzhuiju) - WFTVIOS 通用模版规则
 * 规范: WFTV / TVBox / DRpy 标准规则引擎
 */

var rule = {
    title: '极速追剧',
    host: 'https://jisuzhuiju.com',
    url: '/filter?channel=fyclass&page=fypage',
    searchUrl: '/search?keyword=**&page=fypage',
    searchable: 1,
    quickSearch: 0,
    filterable: 1,
    headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
        'Referer': 'https://jisuzhuiju.com/'
    },
    class_name: '电视剧&电影&动漫&综艺&短剧',
    class_url: '1&2&3&4&5',
    一级: 'a[href*="/detail/"];p.vod-title&&Text;img&&src;.vod-badge&&Text;a&&href',
    二级: {
        title: 'h1.detail-title&&Text;h1&&Text',
        img: 'img.detail-cover&&src;img&&src',
        desc: '.detail-meta&&Text;.detail-info&&Text',
        content: '.detail-intro&&Text;.intro-content&&Text',
        tabs: '.source-tab',
        lists: '.source-panel:eq(#id) a'
    },
    play_url: '/api/play-url?vodId={vodId}&playFrom={playFrom}&index={index}',
    play: function(flag, id, flags) {
        var playUrl = String(id || flag || "").trim();
        if (!playUrl) return { url: "", headers: rule.headers };
        if (playUrl.indexOf(".m3u8") !== -1 || playUrl.indexOf(".mp4") !== -1) {
            return { url: playUrl, headers: rule.headers };
        }
        var m = playUrl.match(/\/vodplay\/(\d+)-([^-]+)-(\d+)\.html/i) || playUrl.match(/(\d+)-([^-]+)-(\d+)/i);
        if (m) {
            var vodId = m[1];
            var playFrom = m[2];
            var index = m[3];
            var apiUrl = rule.host + "/api/play-url?vodId=" + encodeURIComponent(vodId)
                + "&playFrom=" + encodeURIComponent(playFrom)
                + "&index=" + encodeURIComponent(index);
            var res = request(apiUrl, {
                headers: {
                    "User-Agent": rule.headers["User-Agent"],
                    "Referer": playUrl.indexOf("http") === 0 ? playUrl : (rule.host + playUrl)
                },
                timeout: 10
            });
            var text = (res && res.text) ? res.text : (typeof res === "string" ? res : "");
            try {
                var json = JSON.parse(text);
                if (json && (json.code === 200 || json.code === "200") && json.url) {
                    return {
                        url: json.url,
                        headers: {
                            "User-Agent": rule.headers["User-Agent"],
                            "Referer": rule.host + "/"
                        }
                    };
                }
            } catch (e) {}
        }
        return { url: "", headers: rule.headers };
    },
    搜索: 'a[href*="/detail/"];p.vod-title&&Text;img&&src;.vod-badge&&Text;a&&href'
};

