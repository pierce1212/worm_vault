"""Rebuild the reading index and local chronological navigation."""
import os
from pathlib import Path
from bs4 import BeautifulSoup
import archive

base=Path(__file__).resolve().parent
db=archive.load()
rows=sorted((a for a in db["articles"].values() if a.get("file")),
            key=lambda a:(a.get("date") or "9999",a["title"]))
for i,a in enumerate(rows):
    file=base/a["file"]
    soup=BeautifulSoup(file.read_text(encoding="utf-8"),"html.parser")
    if soup.body is None:continue
    for old in soup.select(".archive-navigation"):old.decompose()
    links=[]
    for j,label in ((i-1,"上一篇"),(i+1,"下一篇")):
        if 0<=j<len(rows):
            other=rows[j]
            target=os.path.relpath(base/other["file"],file.parent).replace("\\","/")
            suffix=" [试读]" if other["status"]=="paywall" else (" [视频说明]" if other["status"]=="wechat_only" else "")
            links.append('<a style="flex:1" href="'+archive.esc(target)+'">'+label+'：'+archive.esc(other["title"]+suffix)+'</a>')
    nav='<nav class="archive-navigation" aria-label="按发布时间阅读" style="display:flex;gap:20px;flex-wrap:wrap;border-block:1px solid #ddd;padding:16px 0;margin:24px 0;font-size:14px">'+"".join(links)+'</nav>'
    soup.body.insert(1,BeautifulSoup(nav,"html.parser"))
    soup.body.append(BeautifulSoup(nav,"html.parser"))
    for link in soup.find_all("a",href=True):
        if link.get_text(strip=True)=="微信原文":continue
        href=link["href"]
        if not href.startswith(("https://mp.weixin.qq.com/","http://mp.weixin.qq.com/")):continue
        key=archive.identity(href)
        dest=db["articles"].get(key,{})
        if dest.get("status")=="saved" and dest.get("file"):
            link["data-original-href"]=href
            link["href"]=os.path.relpath(base/dest["file"],file.parent).replace("\\","/")
    file.write_text(str(soup),encoding="utf-8")
archive.persist(db)
print("Navigation updated for",len(rows),"local pages.")

counts={}
for a in db["articles"].values():
    counts[a["status"]]=counts.get(a["status"],0)+1
summary=[
"开心果 Need Car — 归档结果",
"更新时间："+db.get("updated_at",""),
"",
"发现条目："+str(len(db["articles"])),
"全文及正文图片已保存："+str(counts.get("saved",0)),
"仅保存公开试读（付费全文未取得）："+str(counts.get("paywall",0)),
"微信视频仅保存公开说明："+str(counts.get("wechat_only",0)),
"原文已删除或不可用："+str(counts.get("unavailable",0)),
"仍需微信验证："+str(counts.get("blocked",0)),
"尚未处理："+str(counts.get("discovered",0)),
"",
"打开 index.html，按发布时间从早到晚阅读，支持标题搜索和状态筛选。",
"正文页提供上一篇、下一篇；可用的站内文章链接已指向本地副本。",
"",
"范围说明：清单来自作者公开汇总、主题合集及文章间链接；未取得微信客户端完整历史列表，不能以数量相近证明全量覆盖。",
"付费试读、视频说明、已删除和等待验证的条目均不计作全文已保存。"
]
(base/"归档结果.txt").write_text("\n".join(summary),encoding="utf-8")
attention=[]
for a in sorted(db["articles"].values(),key=lambda a:(a.get("date") or "9999",a["title"])):
    if a["status"] in ("paywall","wechat_only","unavailable","blocked","partial","error","discovered"):
        attention.extend([a["status"]+" | "+a["title"],a["url"],a.get("error",""),""])
(base/"未取得全文的条目.txt").write_text("\n".join(attention),encoding="utf-8")
