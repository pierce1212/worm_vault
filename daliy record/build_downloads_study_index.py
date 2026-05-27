# -*- coding: utf-8 -*-
"""
Build a lightweight study index for PDFs in Downloads.
Outputs:
- E:/github/worm_vault/Downloads_Autosar_Document_Study_Index.md
- E:/github/worm_vault/Downloads_Autosar_Document_Study_Index.json
"""
from __future__ import annotations

import json
import os
import re
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

import fitz

DOWNLOADS = Path(r"C:\Users\nvtc140\Downloads")
OUT_DIR = Path(r"E:\github\worm_vault")
OUT_DIR.mkdir(parents=True, exist_ok=True)

PDFS = sorted(DOWNLOADS.glob("*.pdf"), key=lambda p: p.name.lower())

TOPICS = {
    "AUTOSAR总览/架构": ["autosar", "classic platform", "adaptive", "rte", "bsw", "basic software", "ecu abstraction", "service layer"],
    "COM通信栈": ["com", "pdu router", "pdur", "canif", "cantp", "can tp", "can communication", "i-pdu", "n-pdu", "l-pdu", "signal", "ipdu", "communication stack"],
    "诊断UDS/DCM/DEM": ["uds", "diagnostic", "dcm", "dem", "dtc", "did", "routinecontrol", "securityaccess", "sessioncontrol"],
    "存储/NvM/MemStack": ["nvm", "nv block", "memif", "fee", "ea", "fls", "eeprom", "memory stack", "nvram"],
    "MCAL/EB tresos配置": ["mcal", "eb tresos", "tresos", "port", "dio", "mcu", "can driver", "adc", "pwm", "spi", "gpt", "icu", "eMIOS"],
    "E2E保护": ["e2e", "crc", "counter", "data id", "profile", "alive counter"],
    "PNC/网络管理": ["pnc", "partial network", "comM", "nm", "network management", "can state manager", "cannm"],
    "CAN/RH850/MCAN": ["mcan", "rh850", "can controller", "mailbox", "hardware object", "hoh", "hrh", "hth"],
    "电机控制器软件": ["motor", "电机", "控制器", "驱动", "foc", "mcu", "软件开发"],
}

KEY_TERMS = sorted(set(sum(TOPICS.values(), [])))


def clean_text(text: str) -> str:
    text = text.replace("\x00", " ")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def first_nonempty_lines(text: str, n: int = 20):
    lines = []
    for line in text.splitlines():
        line = line.strip()
        if len(line) >= 2:
            lines.append(line)
        if len(lines) >= n:
            break
    return lines


def extract_toc(doc, max_pages=12):
    toc = doc.get_toc(simple=True)
    if toc:
        return [dict(level=l, title=t, page=p) for l, t, p in toc[:80]], "embedded"
    # fallback: scan first pages for table of contents-like lines
    lines = []
    for i in range(min(max_pages, doc.page_count)):
        text = clean_text(doc.load_page(i).get_text("text"))
        for line in text.splitlines():
            s = line.strip()
            if 3 <= len(s) <= 120 and re.search(r"(chapter|目录|contents|^[0-9]+(\.[0-9]+){0,3}\s+|第.+章)", s, re.I):
                lines.append({"level": 1, "title": s, "page": i + 1})
            if len(lines) >= 80:
                break
        if len(lines) >= 80:
            break
    return lines, "scanned_first_pages"


def classify_and_count(sample: str):
    low = sample.lower()
    topic_scores = {}
    term_hits = Counter()
    for topic, terms in TOPICS.items():
        score = 0
        for term in terms:
            c = low.count(term.lower())
            if c:
                score += c
                term_hits[term] += c
        if score:
            topic_scores[topic] = score
    return topic_scores, term_hits


def summarize_pdf(path: Path):
    info = {"file": str(path), "name": path.name, "size_mb": round(path.stat().st_size / 1024 / 1024, 2)}
    try:
        doc = fitz.open(path)
    except Exception as e:
        info["error"] = repr(e)
        return info
    info["pages"] = doc.page_count
    meta = doc.metadata or {}
    info["metadata"] = {k: v for k, v in meta.items() if v}
    toc, toc_source = extract_toc(doc)
    info["toc_source"] = toc_source
    info["toc"] = toc[:60]

    sample_parts = []
    page_text_stats = []
    # sample first 8 pages + every 20th page, capped
    indices = list(range(min(8, doc.page_count))) + list(range(8, doc.page_count, max(1, doc.page_count // 12 or 1)))
    seen = set()
    indices = [i for i in indices if not (i in seen or seen.add(i))][:24]
    for i in indices:
        text = clean_text(doc.load_page(i).get_text("text"))
        page_text_stats.append((i + 1, len(text)))
        if text:
            sample_parts.append("\n[page {}]\n{}".format(i + 1, text[:3500]))
    sample = "\n".join(sample_parts)
    info["sample_pages"] = [p for p, _ in page_text_stats]
    info["text_chars_in_sample"] = sum(c for _, c in page_text_stats)
    info["first_lines"] = first_nonempty_lines(sample, 18)
    topic_scores, term_hits = classify_and_count(sample)
    info["topic_scores"] = dict(sorted(topic_scores.items(), key=lambda x: -x[1]))
    info["top_terms"] = term_hits.most_common(25)
    # Useful snippets around important terms
    snippets = []
    low = sample.lower()
    for term, _ in term_hits.most_common(10):
        idx = low.find(term.lower())
        if idx >= 0:
            start = max(0, idx - 180)
            end = min(len(sample), idx + 360)
            snippets.append({"term": term, "snippet": re.sub(r"\s+", " ", sample[start:end]).strip()})
    info["snippets"] = snippets[:10]
    return info


results = [summarize_pdf(p) for p in PDFS]

json_path = OUT_DIR / "Downloads_Autosar_Document_Study_Index.json"
json_path.write_text(json.dumps({"generated_at": datetime.now().isoformat(timespec="seconds"), "documents": results}, ensure_ascii=False, indent=2), encoding="utf-8")

# Build markdown for user-facing study map
lines = []
lines.append("# Downloads AUTOSAR/车载软件资料学习索引\n")
lines.append("生成时间：{}\n".format(datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
lines.append("资料目录：`C:/Users/nvtc140/Downloads`\n")
lines.append("输出说明：这是给猪芯以后回答 AUTOSAR、CANoe、CAPL、S32K、MCAL、通信栈、诊断栈问题时用的本地学习索引。\n")

lines.append("## 1. 文档清单\n")
for i, r in enumerate(results, 1):
    lines.append("{}. **{}** — {} 页，{} MB".format(i, r.get("name"), r.get("pages", "?"), r.get("size_mb", "?")))
    if r.get("topic_scores"):
        top = ", ".join(list(r["topic_scores"].keys())[:3])
        lines.append("   - 主题判断：{}".format(top))
    if r.get("error"):
        lines.append("   - 解析错误：{}".format(r["error"]))
lines.append("")

lines.append("## 2. 推荐学习顺序\n")
order_keywords = [
    ("AUTOSAR Overview.pdf", "先建立 AUTOSAR 分层、RTE、BSW、MCAL、服务层的整体地图。"),
    ("Can Communication Stack Training.pdf", "再学习 COM/PduR/CanIf/CanDrv/CAN TP 的数据路径。"),
    ("AUTOSAR_User_Manual_CAN_COM.pdf", "结合实际 CAN COM 配置，把 Signal/I-PDU/L-PDU 的关系落到工具配置。"),
    ("Diagnostic Stack.pdf", "学习 DCM/DEM/UDS 诊断栈，与 CANoe 诊断测试关联。"),
    ("How to deploy UDS Diag Stack by Dext in RTA_CAR9_2_1.pdf", "看 ETAS/RTA-CAR 诊断栈部署流程。"),
    ("Memory Stack.pdf", "学习 NvM/MemIf/Fee/Fls 等存储栈。"),
    ("Freetech_AUTOSAR_User_Manual_NvBlock.pdf", "把 NvBlock 配置细节补齐。"),
    ("Freetech_AUTOSAR_User_Manual_E2E.pdf", "学习 E2E 保护、计数器、CRC、DataID。"),
    ("ETAS_AUTOSAR_User_Manual_PNC.pdf", "学习 ComM/NM/PNC 部分网络。"),
    ("LATE-017 SR5E1 How to configure MCAL with EB tresos studio Rev3.0 Jun 2024.pdf", "重点看 EB tresos 下 MCAL 配置方法，可迁移到 S32K3 GUI 理解。"),
    ("AUTOSAR MCAL 的原理与实践.pdf", "补 MCAL 原理与驱动抽象层理解。"),
    ("基于AUTOSAR规范的车用电机控制器软件开发.pdf", "结合应用层/电机控制器软件架构理解完整项目。"),
]
for i, (name, why) in enumerate(order_keywords, 1):
    present = any(r.get("name") == name for r in results)
    lines.append("{}. {}{}：{}".format(i, name, "" if present else "（未找到）", why))
lines.append("")

lines.append("## 3. 分主题索引\n")
by_topic = defaultdict(list)
for r in results:
    for topic, score in r.get("topic_scores", {}).items():
        by_topic[topic].append((score, r["name"]))
for topic in TOPICS:
    docs = sorted(by_topic.get(topic, []), reverse=True)[:8]
    if not docs:
        continue
    lines.append("### {}".format(topic))
    for score, name in docs:
        lines.append("- {}（命中分：{}）".format(name, score))
    lines.append("")

lines.append("## 4. 每份文档的目录/重点摘录\n")
for r in results:
    lines.append("### {}".format(r.get("name")))
    lines.append("- 路径：`{}`".format(r.get("file")))
    lines.append("- 页数/大小：{} 页 / {} MB".format(r.get("pages", "?"), r.get("size_mb", "?")))
    if r.get("metadata"):
        title = r["metadata"].get("title") or r["metadata"].get("subject")
        if title:
            lines.append("- PDF标题：{}".format(title))
    if r.get("topic_scores"):
        lines.append("- 主要主题：{}".format(", ".join(r["topic_scores"].keys())))
    if r.get("toc"):
        lines.append("- 目录来源：{}".format(r.get("toc_source")))
        lines.append("- 目录前若干项：")
        for item in r["toc"][:18]:
            indent = "  " * max(0, int(item.get("level", 1)) - 1)
            lines.append("  - {}{}  (p.{})".format(indent, item.get("title"), item.get("page")))
    if r.get("top_terms"):
        lines.append("- 高频关键词：{}".format(", ".join(["{}({})".format(k, v) for k, v in r["top_terms"][:12]])))
    if r.get("first_lines"):
        lines.append("- 开头可读文本：")
        for s in r["first_lines"][:8]:
            lines.append("  > {}".format(s[:160]))
    if r.get("snippets"):
        lines.append("- 代表片段：")
        for sn in r["snippets"][:3]:
            lines.append("  - {}：{}".format(sn["term"], sn["snippet"][:450]))
    lines.append("")

lines.append("## 5. 我以后回答时的使用原则\n")
lines.append("- 问 AUTOSAR 通信栈：优先按 COM → PduR → CanTp/J1939Tp → CanIf → CanDrv 的路径解释，并区分 Signal、I-PDU、N-PDU、L-PDU。")
lines.append("- 问 CANoe/CAPL：结合 E:/CANoe开发从入门到精通.pdf、E:/CAPL编程手册.pdf，以及 Downloads 中通信栈/诊断栈资料。")
lines.append("- 问 S32K3/MCAL/EB tresos：把 GUI 配置项和 MCAL/硬件抽象层、寄存器/外设概念对应起来解释。")
lines.append("- 问 UDS/诊断：优先从 DCM/DEM/CanTp/PduR/CanIf 的链路说明 CANoe 测试为什么这样配。")
lines.append("- 问 NvM/E2E/PNC：优先引用对应用户手册的概念和配置路径，再结合项目落地。")

md_path = OUT_DIR / "Downloads_Autosar_Document_Study_Index.md"
md_path.write_text("\n".join(lines), encoding="utf-8")

print("OK")
print("PDF count:", len(PDFS))
print("Markdown:", md_path)
print("JSON:", json_path)
for r in results:
    print("- {name}: {pages} pages, topics={topics}".format(name=r.get("name"), pages=r.get("pages"), topics=list(r.get("topic_scores", {}).keys())[:3]))
