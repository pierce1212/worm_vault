"""Resumeable personal archive of public WeChat articles.
Requires Python 3.10+, beautifulsoup4, and the existing browser-act CLI.
Does NOT enumerate an account's full history. Follows same-account article links.
Stops on verification; never counts a verification page as a saved article.
"""
import argparse, hashlib, html, json, re, subprocess, time
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse, parse_qs, urlencode
from urllib.request import Request, urlopen
from bs4 import BeautifulSoup

BASE = Path(__file__).resolve().parent
BIZ = "MzUyNDU4NTc1NQ=="
MANIFEST = BASE / "manifest.json"

def identity(url):
    p = urlparse(html.unescape(url))
    if p.hostname != "mp.weixin.qq.com" or not p.path.startswith("/s"):
        return None
    q = parse_qs(p.query)
    if q.get("__biz", [BIZ])[0] != BIZ:
        return None
    if "mid" in q:
        return BIZ + ":" + q["mid"][0] + ":" + q.get("idx", ["1"])[0]
    return p.path

def load():
    if MANIFEST.exists():
        db = json.loads(MANIFEST.read_text(encoding="utf-8"))
        for source_file in (BASE / "link-sources").glob("*.json"):
            source = json.loads(source_file.read_text(encoding="utf-8"))
            for item in source.get("articles", []):
                add(db, item["url"], item.get("title", ""), source.get("source", ""))
        return db
    return {"account": "开心果 Need Car", "complete": False,
            "coverage_note": "完整历史列表尚未取得；发现数量不等于账号总数。",
            "articles": {}, "events": []}

def add(db, url, title="", source=""):
    key = identity(url)
    if not key:
        return None
    if key not in db["articles"]:
        db["articles"][key] = {"url": html.unescape(url), "title": title,
             "discovered_from": source, "status": "discovered", "date": "", "file": ""}
    elif title and not db["articles"][key]["title"]:
        db["articles"][key]["title"] = title
    article = db["articles"][key]
    new_url = html.unescape(url)
    if "chksm" in parse_qs(urlparse(new_url).query) and "chksm" not in parse_qs(urlparse(article["url"]).query):
        article.setdefault("alternate_urls", []).append(article["url"])
        article["url"] = new_url
    return key

def discover(db, body, source):
    for a in body.find_all("a", href=True):
        add(db, a["href"], a.get_text(" ", strip=True), source)

def persist(db):
    db["updated_at"] = datetime.now().astimezone().isoformat()
    tmp = MANIFEST.with_suffix(".tmp")
    tmp.write_text(json.dumps(db, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(MANIFEST)
    render_index(db)

def esc(s):
    return html.escape(str(s), quote=True)

def render_index(db):
    rows = []
    articles = sorted(db["articles"].values(), key=lambda a: (a.get("date") or "9999", a["title"]))
    counts = {}
    labels = {"wechat_only": "视频未离线保存（需微信客户端）", "paywall": "仅公开试读（付费全文未保存）", "saved": "已保存", "partial": "正文已保存，图片有缺失",
              "unavailable": "原文已删除或不可用", "discovered": "仅有链接", "blocked": "等待微信验证", "error": "下载失败"}
    for a in articles:
        counts[a["status"]] = counts.get(a["status"], 0) + 1
        local = '<a href="' + esc(a["file"]) + '">' + ("公开试读" if a["status"] == "paywall" else ("视频说明" if a["status"] == "wechat_only" else "离线正文")) + '</a> · ' if a.get("file") else ""
        rows.append('<tr data-status="' + esc(a["status"]) + '"><td>' + esc(a.get("date", "")[:10] or "日期待读取") +
                    "</td><td>" + esc(a["title"] or a["url"]) + "</td><td>" +
                    esc(labels.get(a["status"], a["status"])) + "</td><td>" +
                    local + '<a href="' + esc(a["url"]) + '">微信原文</a></td></tr>')
    page = """<!doctype html><html lang="zh-CN"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>开心果 Need Car · 本地归档</title>
<style>body{font:16px/1.7 "Microsoft YaHei",system-ui;margin:32px auto;max-width:1200px;padding:0 20px;color:#223}
a{color:#1269a8}table{border-collapse:collapse;width:100%}td,th{padding:12px;border-bottom:1px solid #ddd;text-align:left}
td:first-child{white-space:nowrap}th:nth-child(1){width:12%}th:nth-child(2){width:53%}th:nth-child(3){width:15%}th:nth-child(4){width:20%}input{font:inherit;padding:10px;width:95%;border:1px solid #ccc;border-radius:6px;margin:12px 0}.note{background:#fff4da;padding:16px;border-radius:8px}</style>
<h1>开心果 Need Car · 本地归档</h1>
<p class="note">尚未完成全量归档。已取得发布日期的文章按从早到晚排序，日期未知的排在最后。仅有链接的文章需要联网阅读。</p>"""
    page += "<p>发现条目：" + str(len(articles)) + "；状态：" + esc("；".join(labels.get(k,k) + " " + str(v) + " 篇" for k,v in counts.items())) + "</p>"
    page += "<p>更新：" + esc(db.get("updated_at", "").replace("T", " ")[:19]) + "</p>"
    page += '<input id="search" type="search" placeholder="搜索文章标题" aria-label="搜索文章标题"><select id="status" aria-label="按保存状态筛选"><option value="">全部内容</option><option value="saved">只看已保存全文</option><option value="paywall">仅公开试读</option><option value="wechat_only">视频说明</option><option value="blocked">等待验证</option><option value="unavailable">已删除或不可用</option></select>'
    page += "<table><thead><tr><th>发布日期</th><th>标题</th><th>保存状态</th><th>阅读</th></tr></thead><tbody>"
    page += "\n".join(rows) + "</tbody></table><script>function filterRows(){let q=document.getElementById('search').value.toLowerCase(),s=document.getElementById('status').value;document.querySelectorAll('tbody tr').forEach(r=>r.hidden=!r.cells[1].textContent.toLowerCase().includes(q)||(s&&r.dataset.status!==s));}document.getElementById('search').addEventListener('input',filterRows);document.getElementById('status').addEventListener('change',filterRows);</script></html>"
    (BASE / "index.html").write_text(page, encoding="utf-8")

def clean_and_assets(body, folder, source):
    for bad in list(body.find_all(["script", "iframe", "object", "embed", "form", "input", "button", "link", "meta", "style"])):
        bad.decompose()
    for tag in body.find_all(True):
        for key in list(tag.attrs):
            if key.lower().startswith("on") or key in ("srcset", "srcdoc"):
                del tag.attrs[key]
        # Remove remote CSS backgrounds and active CSS.
        if tag.has_attr("style"):
            st = tag["style"]
            if re.search(r"url\s*\(|expression\s*\(|behavior\s*:", st, re.I):
                del tag["style"]
        if tag.has_attr("href") and not re.match(r"^(https?://|#)", tag["href"], re.I):
            del tag["href"]
    # WeChat may inject an empty account-avatar placeholder into the article footer.
    for im in body.select("img.account_avatar"):
        if not (im.get("data-src") or im.get("src")):
            im.decompose()
    failures = []
    assets = folder / "images"
    assets.mkdir(parents=True, exist_ok=True)

    from concurrent.futures import ThreadPoolExecutor
    urls = {}
    for im in body.find_all("img"):
        u = im.get("data-src") or im.get("src") or ""
        if u.startswith("//"):
            u = "https:" + u
        host = urlparse(u).hostname or ""
        if not (host.endswith(".qpic.cn") or host == "mmbiz.qpic.cn" or host.endswith(".qlogo.cn")):
            continue
        digest = hashlib.sha256(u.encode()).hexdigest()[:20]
        fmt = parse_qs(urlparse(u).query).get("wx_fmt", [""])[0]
        ext = fmt if fmt in ("png", "jpg", "jpeg", "gif", "webp") else "img"
        urls[u] = assets / (digest + "." + ext)
    prefetch_errors = {}
    def fetch_asset(pair):
        u, dest = pair
        if dest.exists():
            return u, None
        try:
            req = Request(u, headers={"User-Agent": "Mozilla/5.0", "Referer": source})
            with urlopen(req, timeout=25) as res:
                ctype = res.headers.get("Content-Type", "")
                data = res.read(25 * 1024 * 1024 + 1)
            if not ctype.startswith("image/") or not data or len(data) > 25 * 1024 * 1024:
                raise ValueError("invalid image response")
            dest.write_bytes(data)
            return u, None
        except Exception as e:
            return u, str(e)
    with ThreadPoolExecutor(max_workers=4) as pool:
        for u, error in pool.map(fetch_asset, urls.items()):
            if error:
                prefetch_errors[u] = error

    for i, img in enumerate(body.find_all("img"), 1):
        url = img.get("data-src") or img.get("src") or ""
        if url.startswith("//"):
            url = "https:" + url
        host = urlparse(url).hostname or ""
        if not (host.endswith(".qpic.cn") or host == "mmbiz.qpic.cn" or host.endswith(".qlogo.cn")):
            failures.append({"url": url, "error": "unsupported image host"})
            img.decompose()
            continue
        digest = hashlib.sha256(url.encode()).hexdigest()[:20]
        fmt = parse_qs(urlparse(url).query).get("wx_fmt", [""])[0]
        ext = fmt if fmt in ("png", "jpg", "jpeg", "gif", "webp") else "img"
        dest = assets / (digest + "." + ext)
        try:
            if url in prefetch_errors:
                raise ValueError(prefetch_errors[url])
            if not dest.exists():
                req = Request(url, headers={"User-Agent": "Mozilla/5.0", "Referer": source})
                with urlopen(req, timeout=25) as res:
                    ctype = res.headers.get("Content-Type", "")
                    data = res.read(25 * 1024 * 1024 + 1)
                if not ctype.startswith("image/") or not data or len(data) > 25 * 1024 * 1024:
                    raise ValueError("invalid image response")
                dest.write_bytes(data)
            img.attrs = {"src": "images/" + dest.name, "alt": img.get("alt", "原文图片"),
                         "loading": "lazy"}
        except Exception as e:
            failures.append({"url": url, "error": str(e)})
            img.replace_with(body.new_tag("p") if hasattr(body, "new_tag") and callable(body.new_tag) else "[图片下载失败]")
    return failures

def save_article(db, url, title, date, content, preview=False):
    key = add(db, url, title)
    if key is None:
        return
    a = db["articles"][key]
    a["title"], a["date"] = title, date
    body = BeautifulSoup(content, "html.parser")
    discover(db, body, url)
    folder = BASE / "articles" / hashlib.sha256(key.encode()).hexdigest()[:16]
    folder.mkdir(parents=True, exist_ok=True)
    failures = clean_and_assets(body, folder, url)
    page = """<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline';">
<title>""" + esc(title) + """</title><style>
body{max-width:900px;margin:32px auto;padding:0 22px;font:17px/1.9 "Microsoft YaHei",system-ui;color:#222}
img{max-width:100%;height:auto}a{color:#146aa0}pre{overflow:auto}table{max-width:100%;overflow:auto}
</style></head><body><a href="../../index.html">返回目录</a><h1>""" + esc(title) + "</h1>"
    page += "<p>开心果 Need Car · " + esc(date) + ' · <a href="' + esc(url) + '">微信原文</a></p>'
    if preview:
        page += '<p style="background:#fff1cf;padding:14px">付费文章：当前仅保存公开试读部分，全文尚未获取。</p>'
    if failures:
        page += "<p>部分图片下载失败，详见 manifest.json。</p>"
    page += str(body) + "</body></html>"
    (folder / "article.html").write_text(page, encoding="utf-8")
    (folder / "article.txt").write_text(title + "\n" + date + "\n" + url + "\n\n" + ("【仅保存公开试读，付费全文未获取】\n\n" if preview else "") + body.get_text("\n", strip=True), encoding="utf-8")
    a.pop("error", None)
    a.update(status="paywall" if preview else ("partial" if failures else "saved"), content_scope="preview" if preview else "full", file=str((folder / "article.html").relative_to(BASE)).replace("\\", "/"),
             image_failures=failures, image_count=len(body.find_all("img")))
    persist(db)

def parse_rendered(doc):
    soup = BeautifulSoup(doc, "html.parser")
    title_el = soup.select_one("#activity-name") or soup.find("h1")
    body = soup.select_one("#js_content")
    if body is None or not body.get_text(strip=True):
        raise ValueError("未找到文章正文，可能需要微信验证；停止请求。")
    title = title_el.get_text(" ", strip=True) if title_el else ""
    account = soup.select_one("#js_name")
    if not account or "开心果 Need Car" not in account.get_text(" ", strip=True):
        raise ValueError("账号不匹配")
    d = soup.select_one("#publish_time")
    date = d.get_text(" ", strip=True) if d else ""
    for fmt in ("%Y年%m月%d日 %H:%M", "%Y-%m-%d %H:%M", "%b %d, %Y, %I:%M %p",
                "%B %d, %Y, %I:%M %p"):
        try:
            date = datetime.strptime(date, fmt).isoformat() + "+08:00"
            break
        except ValueError:
            pass
    if not re.match(r"^\d{4}-\d\d-\d\d", date):
        date = ""
    return title, date, str(body)

def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--seed-json", action="append", default=[])
    ap.add_argument("--import-html", nargs=2, action="append", default=[], metavar=("URL", "FILE"))
    ap.add_argument("--add-links", help="JSON containing an articles list with url and title")
    ap.add_argument("--crawl", type=int, default=0, help="Maximum article attempts; 0 means no network crawl")
    ap.add_argument("--delay", type=float, default=5)
    ap.add_argument("--retry-blocked", action="store_true", help="Reset blocked entries after access/verification is restored")
    ap.add_argument("--mark-unavailable", nargs=2, metavar=("URL", "REASON"))
    ap.add_argument("--preview", action="store_true", help="Mark imported HTML as a paid article public preview, not full text")
    ap.add_argument("--mark-blocked", nargs=2, metavar=("URL", "REASON"))
    args = ap.parse_args()
    db = load()
    if args.retry_blocked:
        for a in db["articles"].values():
            if a["status"] in ("blocked", "error"):
                a["status"] = "discovered"
    if args.add_links:
        obj = json.loads(Path(args.add_links).read_text(encoding="utf-8"))
        for item in obj["articles"]:
            add(db, item["url"], item.get("title", ""), obj.get("source", ""))
    if args.mark_unavailable:
        url, reason = args.mark_unavailable
        key = add(db, url)
        if key:
            db["articles"][key]["status"] = "unavailable"
            db["articles"][key]["error"] = reason
    if args.mark_blocked:
        url, reason = args.mark_blocked
        key = add(db, url)
        if key:
            db["articles"][key]["status"] = "blocked"
            db["articles"][key]["error"] = reason
    for file in args.seed_json:
        s = json.loads(Path(file).read_text(encoding="utf-8"))
        if not s.get("content_html") or s.get("account_name") != db["account"]:
            raise ValueError("种子文章无正文或账号不匹配")
        save_article(db, s["requested_url"], s["title"], s.get("publish_time", ""), s["content_html"])
    for url, file in args.import_html:
        title, date, content = parse_rendered(Path(file).read_text(encoding="utf-8"))
        save_article(db, url, title, date, content, preview=args.preview)
    persist(db)
    for i in range(args.crawl):
        pending = [(k, a) for k, a in db["articles"].items() if a["status"] == "discovered"]
        if not pending:
            break
        # Follow historical summaries first.
        pending.sort(key=lambda t: (0 if "汇总" in t[1]["title"] else 1, t[1]["url"]))
        key, a = pending[0]
        try:
            p = subprocess.run(["browser-act", "stealth-extract", a["url"], "--content-type", "html"],
                               capture_output=True, text=True, encoding="utf-8", timeout=75)
            if p.returncode or "appmsgcaptcha" in p.stderr:
                a["status"] = "blocked"
                a["error"] = "浏览器提取失败或微信要求验证，已暂停。"
                db["events"].append({"url": a["url"], "event": a["error"]})
                persist(db)
                print(a["error"], flush=True)
                break
            title, date, content = parse_rendered(p.stdout)
            save_article(db, a["url"], title, date, content)
            print("saved: " + title, flush=True)
        except (ValueError, subprocess.TimeoutExpired) as e:
            a["status"] = "blocked"
            a["error"] = str(e)
            persist(db)
            print("paused: " + str(e), flush=True)
            break
        except Exception as e:
            a["status"] = "error"
            a["error"] = str(e)
            persist(db)
            print("error: " + str(e), flush=True)
            break
        if i + 1 < args.crawl:
            time.sleep(max(args.delay, 3))
    persist(db)
    print(json.dumps({"found": len(db["articles"]), "saved": sum(a["status"] == "saved" for a in db["articles"].values()),
                      "complete": db["complete"]}, ensure_ascii=False), flush=True)

if __name__ == "__main__":
    main()
    if (BASE / ".pause-after-save").exists():
        raise SystemExit(42)
