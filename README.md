# 王琪 · Kay — 个人网站

内容营销 / KOL·KOC 生态运营 / 兴趣电商方向的个人网站，含首页简历拆解与站内作品集。

线上地址：<https://kzccc.github.io/WangQi77/>

## 页面结构

| 文件 | 说明 |
|---|---|
| `index.html` | 首页：个人定位、关键数据、三段工作经历（含量化指标）、技能分组、教育背景、联系方式 |
| `portfolio.html` | 作品集：28 页项目复盘，按 6 个章节从上到下滑动展示，点击可放大 |
| `css/style.css` | 全部样式（编辑式优雅风格，无框架依赖） |
| `js/main.js` | 手机号打码、滚动入场、章节高亮、作品集灯箱 |
| `assets/portfolio/` | 作品集每一页的图片，每页两个尺寸（`-w` 1600px / `-s` 900px），用 `srcset` 按屏幕宽度自动选择 |
| `assets/fonts/` | 自托管思源宋体（Noto Serif SC）子集，避免依赖境外字体 CDN |
| `tools/build-assets.py` | 生成字体子集与头像，可重复执行 |

## 设计说明

- **风格**：编辑式优雅。象牙纸底 `#fbf9f6`、墨黑正文 `#17161a`、胭脂点缀 `#9e3b4e`，靠留白与 1px 细规则线建立秩序。
- **字体**：标题与数字用思源宋体（衬线），正文用系统无衬线（PingFang SC / 微软雅黑）。中文字体全量有 11MB，这里按页面实际用到的 971 个字符裁剪成 **274KB / 278KB** 两个 woff2，自托管、不依赖 Google Fonts（境内访问更稳）。
- **响应式**：900px 与 640px 两个断点，作品集图片走 `srcset`，移动端只下载 900px 版本。
- **可访问性**：跳转链接、`aria-current`、灯箱 Esc 关闭与焦点回收、`prefers-reduced-motion` 降级；关闭 JS 后内容与导航依然完整可读。

## 重新生成资源

改过页面文案后，字体子集需要重新生成（否则新出现的汉字会回退到系统字体）：

```bash
pip install pymupdf pillow fonttools brotli
# 思源宋体 OTF 放在 %TEMP%\hanserif\，或用 SMIND_FONT_SRC 指定目录
python tools/build-assets.py
```

改完文案可以用这个脚本确认没有漏字（漏字会让该字回退到系统字体，句中字体会变）：

```bash
python tools/check-font-coverage.py
```

作品集图片由作品集 PDF 渲染而来，如需更新：

```bash
python tools/render-portfolio.py   # 需要把作品集 PDF 放回本目录
```

## 本地预览

静态站点，任意静态服务器即可（直接双击 `index.html` 也能看，但 `srcset` 与字体在 `file://` 下行为不同，建议起服务）：

```bash
python -m http.server 8080
# 然后打开 http://localhost:8080/
```

## 部署

推送到 `main` 分支后，GitHub Pages 会自动构建并发布：

```bash
git add -A
git commit -m "更新网站内容"
git push
```

站点来源配置：仓库 `Settings → Pages → Source: Deploy from a branch → main / (root)`。

## 隐私

- 页面上手机号默认显示为 `176****1867`，点击才展开完整号码，避免被爬虫直接抓取。
- 邮箱直接公开。
- 原始简历与作品集 PDF 通过 `.gitignore` 排除，不进入公开仓库。
