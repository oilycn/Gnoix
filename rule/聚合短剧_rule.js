/**
 * 聚合短剧 (免服直连版) - WFTVIOS / TVBox / DRpy 通用模版规则
 * 
 * 核心特性:
 * 1. 100% 纯客户端直连 (基于喜番短剧云网关)
 * 2. 彻底摆脱自建服务器 / VPS / Node.js 依赖
 * 3. 官方 1080P / 原画无水印 MP4 直链秒播，完美适配 iOS KSPlayer 硬件解码
 * 4. 全分类畅看：都市、逆袭、大女主、战神、赘婿、重生、神医、豪门等全集短剧
 */

var rule = {
    title: '聚合短剧',
    host: 'https://xifan-api-cn.youlishipin.com',
    url: '/category/fyclass/fypage',
    searchUrl: '/search/**?page=fypage',
    searchable: 2,
    quickSearch: 0,
    filterable: 1,
    headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
        'Referer': 'https://xifan-api-cn.youlishipin.com/'
    },

    // 热门大类配置
    class_name: '都市&逆袭&大女主&战神&赘婿&重生&神医&现代言情&豪门&强者回归&高手下山&反转&龙王&穿越',
    class_url: '68_都市&79_逆袭&80_大女主&80_战神&80_赘婿&79_重生&80_神医&81_现代言情&81_豪门&79_强者回归&79_高手下山&79_反转&80_龙王&81_穿越',

    safeRequest: function(url, timeout) {
        try {
            var resp = request(url, { headers: rule.headers, timeout: timeout || 10 });
            if (!resp) return '';
            if (typeof resp === 'string') return resp;
            return resp.text || resp.body || '';
        } catch (e) {
            return '';
        }
    },

    cleanText: function(str) {
        if (!str) return '';
        return String(str).replace(/<[^>]*>/g, '').trim();
    },

    // 一级分类列表获取
    category: function(tid, pg, filter, extend) {
        tid = String(tid || '68_都市').trim();
        pg = parseInt(pg) || 1;
        var parts = tid.split('_');
        var catId = parts[0] || '68';
        var catName = parts[1] || '都市';

        var offset = (pg - 1) * 30;
        var apiUrl = rule.host + '/xifan/drama/portalPage?reqType=aggregationPage&offset=' + offset +
            '&categoryId=' + catId +
            '&categoryNames=' + encodeURIComponent(catName) +
            '&categoryVersion=1&version=2001001&androidVersionCode=28';

        var raw = rule.safeRequest(apiUrl);
        var vodList = [];

        if (raw) {
            try {
                var json = JSON.parse(raw);
                var contents = (json.result && json.result.elements && json.result.elements[0] && json.result.elements[0].contents) || [];
                for (var i = 0; i < contents.length; i++) {
                    var vo = contents[i].duanjuVo;
                    if (!vo) continue;
                    var sId = String(vo.source || '') + ':' + String(vo.duanjuId || '');
                    var sName = rule.cleanText(vo.title);
                    var sCover = vo.coverImageUrl || '';
                    var sRemarks = vo.total ? ('全' + vo.total + '集') : (vo.playViewText || '');
                    if (!sId || !sName) continue;

                    vodList.push({
                        vod_id: sId,
                        vod_name: sName,
                        vod_pic: sCover,
                        vod_remarks: sRemarks
                    });
                }
            } catch (e) {}
        }

        return {
            code: 1,
            msg: '数据列表',
            page: pg,
            pagecount: 50,
            limit: vodList.length,
            total: 1500,
            list: vodList
        };
    },

    // 二级详情页与全集选集提取
    detail: function(vid) {
        vid = String(vid || '').trim();
        var parts = vid.split(':');
        var source = parts[0] || '';
        var duanjuId = parts[1] || '';

        var title = '短剧 ' + vid;
        var pic = '';
        var intro = '';
        var remarks = '';
        var playList = [];

        if (source && duanjuId) {
            var detailUrl = rule.host + '/xifan/drama/getDuanjuInfo?source=' + encodeURIComponent(source) +
                '&duanjuId=' + encodeURIComponent(duanjuId) +
                '&version=2001001&androidVersionCode=28';

            var raw = rule.safeRequest(detailUrl);
            if (raw) {
                try {
                    var json = JSON.parse(raw);
                    var info = json.result || {};
                    title = rule.cleanText(info.title) || title;
                    pic = info.coverImageUrl || '';
                    intro = rule.cleanText(info.desc) || '';

                    var episodeList = info.episodeList || [];
                    remarks = episodeList.length ? ('全' + episodeList.length + '集') : '';

                    for (var i = 0; i < episodeList.length; i++) {
                        var ep = episodeList[i];
                        var idx = ep.index || (i + 1);
                        var pUrl = ep.playUrl || '';
                        if (!pUrl) continue;
                        // 附带扩展名提示，确保 iOS KSPlayer / AVPlayer 默认走硬件直解 (用 &ext=.mp4 避免与选集分隔符 # 冲突)
                        if (pUrl.indexOf('.mp4') === -1) {
                            pUrl = pUrl + '&ext=.mp4';
                        }
                        playList.push('第' + idx + '集$' + pUrl);
                    }
                } catch (e) {}
            }
        }

        if (playList.length === 0) {
            playList.push('第1集$' + vid);
        }

        return {
            vod_id: vid,
            vod_name: title,
            vod_pic: pic,
            vod_remarks: remarks,
            vod_content: intro,
            vod_play_from: '原画直连(免服)',
            vod_play_url: playList.join('#')
        };
    },

    // 播放地址直接回传 (iOS KSPlayer 自动跟随 302 重定向至 1080P MP4)
    play: function(flag, id, flags) {
        var playUrl = String(id || flag || '').trim();
        return {
            parse: 0,
            jx: 0,
            url: playUrl,
            header: {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15',
                'Referer': 'https://xifan-api-cn.youlishipin.com/'
            },
            headers: {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15',
                'Referer': 'https://xifan-api-cn.youlishipin.com/'
            }
        };
    },

    // 全量短剧搜索
    search: function(wd, quick, pg) {
        wd = String(wd || '').trim();
        try { wd = decodeURIComponent(wd); } catch (e) {}
        if (!wd) return { code: 1, msg: '数据列表', list: [] };
        pg = parseInt(pg) || 1;

        var searchUrl = rule.host + '/xifan/search/getSearchList?keyword=' + encodeURIComponent(wd) +
            '&pageIndex=' + pg +
            '&version=2001001&androidVersionCode=28';

        var raw = rule.safeRequest(searchUrl);
        var vodList = [];

        if (raw) {
            try {
                var json = JSON.parse(raw);
                var contents = (json.result && json.result.elements && json.result.elements[0] && json.result.elements[0].contents) || [];
                for (var i = 0; i < contents.length; i++) {
                    var vo = contents[i].duanjuVo;
                    if (!vo) continue;
                    var sId = String(vo.source || '') + ':' + String(vo.duanjuId || '');
                    var sName = rule.cleanText(vo.title);
                    var sCover = vo.coverImageUrl || '';
                    var sRemarks = vo.total ? ('全' + vo.total + '集') : (vo.playViewText || '');
                    if (!sId || !sName) continue;

                    vodList.push({
                        vod_id: sId,
                        vod_name: sName,
                        vod_pic: sCover,
                        vod_remarks: sRemarks
                    });
                }
            } catch (e) {}
        }

        return {
            code: 1,
            msg: '数据列表',
            page: pg,
            pagecount: 10,
            limit: vodList.length,
            total: vodList.length,
            list: vodList
        };
    }
};
