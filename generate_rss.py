#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RunAnalyz RSS 2.0 Generator (generate_rss.py)
---------------------------------------------
Scans articles in runanalyz/articles/*.html, extracts metadata (title, description, date, category),
and compiles a valid RSS 2.0 feed (rss.xml) optimized for Google Search Console and Naver Search Advisor.
Uses only standard Python libraries (no external dependencies).
"""

import os
import re
import glob
import datetime
import html
from email.utils import format_datetime

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ARTICLES_DIR = os.path.join(BASE_DIR, "articles")
OUTPUT_RSS = os.path.join(BASE_DIR, "rss.xml")
SITEMAP_PATH = os.path.join(BASE_DIR, "sitemap.xml")
BASE_URL = "https://runanalyz.com"

# KST Timezone (+09:00)
KST = datetime.timezone(datetime.timedelta(hours=9))

def load_sitemap_dates():
    """Extract URL to lastmod mapping from sitemap.xml."""
    dates = {}
    if not os.path.exists(SITEMAP_PATH):
        return dates
    try:
        with open(SITEMAP_PATH, "r", encoding="utf-8") as f:
            content = f.read()
        pattern = re.compile(r"<url>\s*<loc>(.*?)</loc>\s*<lastmod>(.*?)</lastmod>", re.DOTALL)
        for loc, lastmod in pattern.findall(content):
            base_name = loc.strip().split("/")[-1]
            if base_name:
                dates[base_name] = lastmod.strip()
    except Exception as e:
        print(f"Warning: Could not read sitemap.xml: {e}")
    return dates

def parse_article(file_path, sitemap_dates):
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    rel_name = os.path.basename(file_path)

    # Extract title
    title_match = re.search(r"<title>(.*?)</title>", content, re.IGNORECASE | re.DOTALL)
    title = title_match.group(1).strip() if title_match else rel_name
    title = re.sub(r"\s*\|\s*RunAnalyz$", "", title).strip()

    # Extract description (handle matching quotes properly)
    desc_match = re.search(r'<meta\s+name=["\']description["\']\s+content=("([^"]*)"|\'([^\']*)\')', content, re.IGNORECASE | re.DOTALL)
    if not desc_match:
        desc_match = re.search(r'<meta\s+content=("([^"]*)"|\'([^\']*)\')\s+name=["\']description["\']', content, re.IGNORECASE | re.DOTALL)
    if desc_match:
        description = desc_match.group(2) if desc_match.group(2) is not None else desc_match.group(3)
        description = description.strip()
    else:
        description = ""

    # Fallback description from content if meta is missing
    if not description:
        # Check for summary box or paragraph
        p_matches = re.findall(r'<p[^>]*>(.*?)</p>', content, re.DOTALL)
        for p in p_matches:
            clean_p = re.sub(r'<[^>]+>', '', p).strip()
            if len(clean_p) > 25:
                description = clean_p[:200]
                break

    # Extract category / tag
    tag_match = re.search(r'<span class=["\']article-tag["\']>(.*?)</span>', content, re.IGNORECASE | re.DOTALL)
    category = tag_match.group(1).strip() if tag_match else "러닝 사이언스"
    category = html.unescape(re.sub(r"<[^>]+>", "", category))

    # Extract update date:
    # 1. From HTML meta "업데이트: YYYY. MM. DD"
    date_match = re.search(r'업데이트:\s*(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})', content)
    if date_match:
        year, month, day = map(int, date_match.groups())
        pub_dt = datetime.datetime(year, month, day, 9, 0, 0, tzinfo=KST)
    elif rel_name in sitemap_dates:
        # 2. From sitemap lastmod "YYYY-MM-DD"
        try:
            parts = [int(p) for p in sitemap_dates[rel_name].split("-")]
            pub_dt = datetime.datetime(parts[0], parts[1], parts[2], 9, 0, 0, tzinfo=KST)
        except Exception:
            mtime = os.path.getmtime(file_path)
            pub_dt = datetime.datetime.fromtimestamp(mtime, tz=KST)
    else:
        # 3. Fallback to file mtime
        mtime = os.path.getmtime(file_path)
        pub_dt = datetime.datetime.fromtimestamp(mtime, tz=KST)

    link = f"{BASE_URL}/articles/{rel_name}"

    return {
        "title": title,
        "link": link,
        "description": description,
        "category": category,
        "pub_dt": pub_dt,
        "pub_date_str": format_datetime(pub_dt)
    }

def generate_rss():
    article_files = glob.glob(os.path.join(ARTICLES_DIR, "*.html"))
    articles = []

    sitemap_dates = load_sitemap_dates()
    for file_path in article_files:
        base_name = os.path.basename(file_path)
        # Skip templates and draft files starting with underscore
        if base_name.startswith("_"):
            continue
        try:
            art = parse_article(file_path, sitemap_dates)
            articles.append(art)
        except Exception as e:
            print(f"Error parsing {file_path}: {e}")

    # Sort articles newest first
    articles.sort(key=lambda x: (x["pub_dt"], x["link"]), reverse=True)

    now_kst = datetime.datetime.now(KST)
    last_build_date = format_datetime(now_kst)

    xml_lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
        '  <channel>',
        '    <title>RunAnalyz 러닝 사이언스 &amp; 체력 진단 랩</title>',
        '    <link>https://runanalyz.com/</link>',
        '    <description>스포츠 생체역학과 운동생리학 연구 기반의 러닝 사이언스, 부상 재활, 마라톤 코스 공략 및 체력 진단 매거진</description>',
        '    <language>ko</language>',
        f'    <lastBuildDate>{last_build_date}</lastBuildDate>',
        '    <atom:link href="https://runanalyz.com/rss.xml" rel="self" type="application/rss+xml" />',
    ]

    for art in articles:
        safe_title = html.escape(art["title"])
        safe_category = html.escape(art["category"])
        # CDATA for description to prevent XML entity issues
        desc_cdata = f"<![CDATA[{art['description']}]]>"
        
        xml_lines.append('    <item>')
        xml_lines.append(f'      <title>{safe_title}</title>')
        xml_lines.append(f'      <link>{art["link"]}</link>')
        xml_lines.append(f'      <guid isPermaLink="true">{art["link"]}</guid>')
        xml_lines.append(f'      <pubDate>{art["pub_date_str"]}</pubDate>')
        xml_lines.append(f'      <category>{safe_category}</category>')
        xml_lines.append(f'      <description>{desc_cdata}</description>')
        xml_lines.append('    </item>')

    xml_lines.append('  </channel>')
    xml_lines.append('</rss>\n')

    rss_content = "\n".join(xml_lines)
    with open(OUTPUT_RSS, "w", encoding="utf-8") as f:
        f.write(rss_content)

    print(f"[SUCCESS] Generated {OUTPUT_RSS} with {len(articles)} items.")

if __name__ == "__main__":
    generate_rss()
