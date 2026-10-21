/**
 * 荐片影视 (jianpian) - WFTVIOS 通用模版规则
 * 规范: WFTV / TVBox / DRpy 标准规则引擎
 */

var HOST = "https://api.ztcgi.com";
var IMG_DOMAIN = "https://img.ypfbj.com";

var HEADERS = {
    "User-Agent": "Mozilla/5.0 (Linux; Android 9; V2196A Build/PQ3A.190705.08211809; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/91.0.4472.114 Mobile Safari/537.36;webank/h5face;webank/1.0;netType:NETWORK_WIFI;appVersion:416;packageName:com.jp3.xg3",
    "Referer": "https://api.ztcgi.com"
};

function initImgDomain() {
    try {
        var resp = request(HOST + "/api/v2/settings/resourceDomainConfig", { method: "GET", headers: HEADERS, timeout: 5 });
        var text = (resp && resp.text) ? resp.text : (typeof resp === "string" ? resp : "");
        if (text) {
            var json = JSON.parse(text);
            if (json && json.data && json.data.imgDomain) {
                var list = json.data.imgDomain.split(",");
                if (list.length > 0) {
                    var d = list[0].trim();
                    IMG_DOMAIN = d.indexOf("http") === 0 ? d : ("https://" + d);
                }
            }
        }
    } catch (e) {}
}

function formatPic(picPath) {
    if (!picPath) return "";
    var p = String(picPath).trim();
    if (p.indexOf("http://") === 0 || p.indexOf("https://") === 0) return p;
    if (p.indexOf("//") === 0) return "https:" + p;
    if (p.indexOf("/") !== 0) p = "/" + p;
    return IMG_DOMAIN + p;
}

var rule = {
    title: '荐片影视',
    host: HOST,
    url: '/api/v2/video/filter?category_id=fyclass&page=fypage&pageSize=20',
    searchUrl: '/api/v2/search/videoV2?key=**&category_id=88&page=fypage&pageSize=20',
    searchable: 1,
    quickSearch: 0,
    filterable: 1,
    headers: HEADERS,
    class_name: '电影&电视剧&动漫&综艺&纪录片&Netflix',
    class_url: '1&2&3&4&50&99',
    home: function() {
        initImgDomain();
        var categories = [
            { type_id: "1", type_name: "电影" },
            { type_id: "2", type_name: "电视剧" },
            { type_id: "3", type_name: "动漫" },
            { type_id: "4", type_name: "综艺" },
            { type_id: "50", type_name: "纪录片" },
            { type_id: "99", type_name: "Netflix" }
        ];
        var firstPage = this.category("1", 1);
        return {
            code: 1,
            msg: "数据列表",
            class: categories,
            list: firstPage.list || []
        };
    },
    category: function(tid, pg, filter, extend) {
        initImgDomain();
        tid = String(tid || "1").trim();
        pg = parseInt(pg) || 1;
        var list = [];

        if (tid === "99" || tid === "50") {
            var dyUrl = HOST + "/api/dyTag/list?category_id=" + tid + "&page=" + pg;
            var dyResp = request(dyUrl, { method: "GET", headers: HEADERS, timeout: 10 });
            var dyText = (dyResp && dyResp.text) ? dyResp.text : dyResp;
            try {
                var dyJson = JSON.parse(dyText);
                var groups = dyJson.data || [];
                groups.forEach(function(g) {
                    var items = g.dataList || [];
                    items.forEach(function(item) {
                        var id = item.id || (item._id && item._id.$oid);
                        if (!id) return;
                        list.push({
                            vod_id: String(id),
                            vod_name: item.title || "",
                            vod_pic: formatPic(item.path || item.thumbnail),
                            vod_remarks: item.mask || ""
                        });
                    });
                });
            } catch(e) {}
            return { code: 1, page: pg, pagecount: 999, limit: list.length, total: 1000, list: list };
        }

        var area = (extend && extend.area) || "";
        var year = (extend && extend.year) || "";
        var cateId = (extend && extend.cateId) || "";
        var sort = (extend && extend.sort) || "update";
        var url = HOST + "/api/crumb/list?fcate_pid=" + tid +
                  "&area=" + encodeURIComponent(area) +
                  "&year=" + encodeURIComponent(year) +
                  "&type=0&sort=" + encodeURIComponent(sort) +
                  "&page=" + pg +
                  "&category_id=" + encodeURIComponent(cateId);
        var resp = request(url, { method: "GET", headers: HEADERS, timeout: 10 });
        var text = (resp && resp.text) ? resp.text : resp;
        try {
            var json = JSON.parse(text);
            var items = json.data || [];
            items.forEach(function(item) {
                var id = item.id || (item._id && item._id.$oid);
                if (!id) return;
                list.push({
                    vod_id: String(id),
                    vod_name: item.title || "",
                    vod_pic: formatPic(item.path || item.thumbnail || item.tvimg),
                    vod_remarks: item.mask || (item.score ? (item.score + "分") : "")
                });
            });
        } catch(e) {}
        return { code: 1, page: pg, pagecount: list.length > 0 ? (pg + 1) : pg, limit: list.length, total: 1000, list: list };
    },
    detail: function(vid) {
        initImgDomain();
        vid = String(vid).trim();
        var url = HOST + "/api/video/detailv2?id=" + vid;
        var resp = request(url, { method: "GET", headers: HEADERS, timeout: 10 });
        var text = (resp && resp.text) ? resp.text : resp;
        var title = "荐片影视", pic = "", desc = "", remarks = "";
        var sourceNames = [], sourceUrls = [];
        try {
            var json = JSON.parse(text);
            var d = json.data || {};
            title = d.title || title;
            pic = formatPic(d.thumbnail || d.path || d.tvimg);
            desc = d.description || "";
            remarks = d.mask || (d.score ? (d.score + "分") : "");
            var rawSources = d.source_list_source || [];
            rawSources.forEach(function(srcGroup) {
                if (srcGroup.source_key === "back_source_list_p2p") return;
                var sName = srcGroup.name || "在线播放";
                var items = srcGroup.source_list || [];
                var epList = [];
                items.forEach(function(item, idx) {
                    var epTitle = item.source_name || ("第" + (idx + 1) + "集");
                    var playUrl = item.url || "";
                    if (playUrl && playUrl.indexOf("http") === 0) {
                        epList.push(epTitle + "$" + playUrl);
                    }
                });
                if (epList.length > 0) {
                    sourceNames.push(sName);
                    sourceUrls.push(epList.join("#"));
                }
            });
        } catch(e) {}
        if (sourceNames.length === 0 || !title) {
            return null;
        }
        return {
            vod_id: vid,
            vod_name: title,
            vod_pic: pic,
            vod_content: desc,
            vod_remarks: remarks,
            vod_play_from: sourceNames.join("$$$"),
            vod_play_url: sourceUrls.join("$$$")
        };
    },
    play: function(flag, id, flags) {
        var playUrl = String(id || flag || "");
        return { url: playUrl, headers: HEADERS };
    },
    search: function(wd, pg) {
        initImgDomain();
        pg = parseInt(pg) || 1;
        var url = HOST + "/api/v2/search/videoV2?key=" + encodeURIComponent(wd) + "&category_id=88&page=" + pg + "&pageSize=20";
        var resp = request(url, { method: "GET", headers: HEADERS, timeout: 10 });
        var text = (resp && resp.text) ? resp.text : resp;
        var list = [];
        try {
            var json = JSON.parse(text);
            var items = json.data || [];
            items.forEach(function(item) {
                var id = item.id || (item._id && item._id.$oid);
                if (!id) return;
                list.push({
                    vod_id: String(id),
                    vod_name: item.title || "",
                    vod_pic: formatPic(item.thumbnail || item.path),
                    vod_remarks: item.mask || ""
                });
            });
        } catch(e) {}
        return { code: 1, list: list };
    }
};
