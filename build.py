"""
Собирает статьи из articles-md/*.md в готовые HTML-страницы (articles/*.html)
и обновляет карточки статей на blog.html и index.html.

Использование:
    python build.py

Формат исходника (articles-md/имя-статьи.md):

    ---
    title: Заголовок статьи
    description: Короткое описание для карточки и <meta description>.
    tag: Категория (например: Парсинг)
    tags: тег1, тег2, тег3
    reading_time: 9 мин чтения · Python, графы
    date: 2026-09-14
    slug: imya-stati
    ---
    Текст статьи в Markdown. Поддерживаются заголовки (##, ###),
    **жирный текст**, `код`, ```блоки кода```, списки и > цитаты
    (цитаты превращаются в выделенную плашку-callout).
"""

import re
import sys
from pathlib import Path

try:
    import markdown
except ImportError:
    sys.exit("Не найден пакет 'markdown'. Установи: python -m pip install markdown")

ROOT = Path(__file__).resolve().parent
MD_DIR = ROOT / "articles-md"
OUT_DIR = ROOT / "articles"
TEMPLATE_PATH = ROOT / "templates" / "article.html"
BLOG_PATH = ROOT / "blog.html"
INDEX_PATH = ROOT / "index.html"

REQUIRED_FIELDS = ["title", "description", "tag", "reading_time", "slug"]


def parse_frontmatter(text, source):
    if not text.startswith("---"):
        sys.exit(f"{source}: файл должен начинаться с --- (frontmatter)")
    parts = text.split("---", 2)
    if len(parts) < 3:
        sys.exit(f"{source}: не найден закрывающий --- у frontmatter")
    _, fm_raw, body = parts

    meta = {}
    for line in fm_raw.strip().splitlines():
        if not line.strip() or ":" not in line:
            continue
        key, value = line.split(":", 1)
        meta[key.strip()] = value.strip()

    missing = [f for f in REQUIRED_FIELDS if f not in meta]
    if missing:
        sys.exit(f"{source}: в frontmatter не хватает полей: {', '.join(missing)}")

    return meta, body.strip()


def render_body(md_text):
    md = markdown.Markdown(extensions=["fenced_code", "tables"])
    html = md.convert(md_text)
    # цитаты (> текст) превращаем в выделенную плашку .callout
    html = re.sub(
        r"<blockquote>\s*<p>(.*?)</p>\s*</blockquote>",
        r'<div class="callout">\1</div>',
        html,
        flags=re.DOTALL,
    )
    return html


def build_article(md_path, template):
    meta, body_md = parse_frontmatter(md_path.read_text(encoding="utf-8"), md_path.name)
    body_html = render_body(body_md)

    out = (
        template.replace("{{TITLE}}", meta["title"])
        .replace("{{DESCRIPTION}}", meta["description"])
        .replace("{{TAG}}", meta["tag"])
        .replace("{{READING_TIME}}", meta["reading_time"])
        .replace("{{BODY}}", body_html)
    )

    OUT_DIR.mkdir(exist_ok=True)
    out_path = OUT_DIR / f"{meta['slug']}.html"
    out_path.write_text(out, encoding="utf-8", newline="\n")

    tags = [t.strip().lower() for t in meta.get("tags", "").split(",") if t.strip()]
    if meta["tag"].lower() not in tags:
        tags.append(meta["tag"].lower())

    return {
        "slug": meta["slug"],
        "title": meta["title"],
        "description": meta["description"],
        "tag": meta["tag"],
        "tags": tags,
        "reading_time": meta["reading_time"].split(" · ")[0],
        "date": meta.get("date", ""),
    }


def render_card(article):
    tags_attr = " ".join(article["tags"])
    return (
        f'      <div class="card" data-tags="{tags_attr}" data-block="{article["slug"]}">\n'
        f'        <span class="tag">{article["tag"]}</span>\n'
        f'        <h3><a href="articles/{article["slug"]}.html">{article["title"]}</a></h3>\n'
        f'        <p>{article["description"]}</p>\n'
        f'        <div class="meta">{article["reading_time"]}</div>\n'
        f'      </div>'
    )


def inject(path, start_marker, end_marker, cards):
    text = path.read_text(encoding="utf-8")
    pattern = re.compile(re.escape(start_marker) + r".*?" + re.escape(end_marker), re.DOTALL)
    if not pattern.search(text):
        sys.exit(f"{path.name}: не найдены маркеры {start_marker} / {end_marker}")
    replacement = f"{start_marker}\n{cards}\n      {end_marker}"
    path.write_text(pattern.sub(replacement, text), encoding="utf-8", newline="\n")


def main():
    if not MD_DIR.exists():
        sys.exit(f"Нет папки {MD_DIR}")

    template = TEMPLATE_PATH.read_text(encoding="utf-8")
    articles = [build_article(p, template) for p in sorted(MD_DIR.glob("*.md"))]

    if not articles:
        sys.exit("В articles-md/ нет ни одного .md файла")

    articles.sort(key=lambda a: a["date"], reverse=True)

    inject(BLOG_PATH, "<!-- ARTICLES:GRID:START -->", "<!-- ARTICLES:GRID:END -->",
           "\n".join(render_card(a) for a in articles))

    inject(INDEX_PATH, "<!-- ARTICLES:STACK:START -->", "<!-- ARTICLES:STACK:END -->",
           "\n".join(render_card(a) for a in articles[:3]))

    print(f"Собрано статей: {len(articles)}")
    for a in articles:
        print(f"  {a['date']}  {a['slug']:30s}  [{', '.join(a['tags'])}]")


if __name__ == "__main__":
    main()
