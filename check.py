"""FLC 宣传站自检：链接/资源存在性、HTML 结构、锚点、无障碍属性。"""
import os
import re
import sys
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.abspath(__file__))
VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input",
        "link", "meta", "param", "source", "track", "wbr"}
# 这些可选结束标签在 HTML5 里可以省略
OPTIONAL_END = {"li", "p", "td", "th", "tr", "thead", "tbody", "option", "dt", "dd"}


class Checker(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []
        self.errors = []
        self.ids = set()
        self.hrefs = []
        self.srcs = []
        self.imgs_no_alt = []
        self.inline_svg_depth = 0

    def handle_starttag(self, tag, attrs):
        d = dict(attrs)
        if tag == "svg":
            self.inline_svg_depth += 1
        if "id" in d:
            if d["id"] in self.ids:
                self.errors.append(f"duplicate id: {d['id']}")
            self.ids.add(d["id"])
        if tag == "a" and d.get("href"):
            self.hrefs.append(d["href"])
        if tag == "img":
            self.srcs.append(d.get("src", ""))
            if "alt" not in d:
                self.imgs_no_alt.append(d.get("src", "?"))
        if tag not in VOID:
            self.stack.append((tag, self.getpos()[0]))

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag in self.stack and self.stack[-1][0] == tag:
            self.stack.pop()

    def handle_endtag(self, tag):
        if tag == "svg":
            self.inline_svg_depth = max(0, self.inline_svg_depth - 1)
        if tag in VOID:
            return
        # 找到匹配的开标签
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                unclosed = self.stack[i + 1:]
                for t, ln in unclosed:
                    if t not in OPTIONAL_END:
                        self.errors.append(f"line {ln}: <{t}> not closed before </{tag}>")
                del self.stack[i:]
                return
        self.errors.append(f"line {self.getpos()[0]}: stray </{tag}>")


def strip_svg(html: str) -> str:
    """内联 SVG 的标签配对单独处理，检查时先去除以免干扰。"""
    return re.sub(r"<svg\b.*?</svg>", "<svg></svg>", html, flags=re.S | re.I)


def main():
    pages = sorted(f for f in os.listdir(ROOT) if f.endswith(".html"))
    problems = 0

    for page in pages:
        path = os.path.join(ROOT, page)
        raw = open(path, encoding="utf-8").read()
        body = strip_svg(raw)

        c = Checker()
        c.feed(body)
        c.close()

        print(f"\n=== {page} ===")
        for e in c.errors:
            print("  [结构] " + e)
            problems += 1
        for t, ln in c.stack:
            if c.inline_svg_depth == 0 and t not in OPTIONAL_END:
                print(f"  [结构] line {ln}: <{t}> 未闭合")
                problems += 1
        if c.imgs_no_alt:
            print("  [无障碍] img 缺少 alt: " + ", ".join(c.imgs_no_alt))
            problems += 1

        # 链接检查
        for h in c.hrefs:
            if h.startswith(("http://", "https://", "mailto:", "data:", "#")):
                continue
            target, _, frag = h.partition("#")
            if not target:
                if frag and frag not in c.ids:
                    print(f"  [锚点] 页内锚点 #{frag} 无对应 id")
                    problems += 1
                continue
            tp = os.path.join(ROOT, target.replace("/", os.sep))
            if not os.path.exists(tp):
                print(f"  [链接] 目标不存在: {h}")
                problems += 1
            elif frag:
                other = open(tp, encoding="utf-8").read()
                if f'id="{frag}"' not in other:
                    print(f"  [锚点] {h} 中的 #{frag} 在目标页不存在")
                    problems += 1

        # 图片检查
        for s in c.srcs:
            if s.startswith("data:"):
                continue
            sp = os.path.join(ROOT, s.replace("/", os.sep))
            if not os.path.exists(sp):
                print(f"  [图片] 缺失: {s}")
                problems += 1
            elif os.path.getsize(sp) == 0:
                print(f"  [图片] 空文件: {s}")
                problems += 1

        # CSS / JS 引用（跳过 data: 内联 URI）
        for m in re.finditer(r'<link[^>]+href="([^"]+)"', raw):
            if m.group(1).startswith("data:"):
                continue
            p = os.path.join(ROOT, m.group(1).replace("/", os.sep))
            if not os.path.exists(p):
                print(f"  [样式] 缺失: {m.group(1)}")
                problems += 1
        for m in re.finditer(r'<script[^>]+src="([^"]+)"', raw):
            p = os.path.join(ROOT, m.group(1).replace("/", os.sep))
            if not os.path.exists(p):
                print(f"  [脚本] 缺失: {m.group(1)}")
                problems += 1

        # 关键元信息
        for need in ("<title>", 'name="description"', 'lang="zh-CN"', 'charset="UTF-8"',
                     'name="viewport"', "assets/style.css", "assets/app.js"):
            if need not in raw:
                print(f"  [元信息] 缺少 {need}")
                problems += 1
        # 导航一致性
        for nav in ('href="index.html"', 'href="features.html"',
                    'href="download.html"', 'href="resources.html"', 'href="about.html"'):
            if nav not in raw:
                print(f"  [导航] 缺少 {nav}")
                problems += 1
        # 当前页高亮必须且只能有一个
        cur = raw.count('aria-current="page"')
        if cur != 1:
            print(f"  [导航] aria-current 出现 {cur} 次（应为 1）")
            problems += 1

        print(f"  图片 {len(c.srcs)} 个 · 链接 {len(c.hrefs)} 个 · id {len(c.ids)} 个")

    print("\n" + "=" * 46)
    print(f"页面 {len(pages)} 个 · 问题 {problems} 处")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
