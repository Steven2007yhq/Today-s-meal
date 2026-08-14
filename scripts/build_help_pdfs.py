#!/usr/bin/env python3
"""Build the two polished, user-facing help PDFs bundled with the desktop app."""

from __future__ import annotations

import shutil
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "output" / "pdf"
PUBLIC_DIR = ROOT / "public" / "docs"
USER_GUIDE_NAME = "hao-chi-de-jin-tian-user-guide.pdf"
SHORTCUT_GUIDE_NAME = "hao-chi-de-jin-tian-keyboard-shortcuts.pdf"

INK = colors.HexColor("#3F382F")
MUTED = colors.HexColor("#82796F")
ACCENT = colors.HexColor("#E66F47")
ACCENT_DARK = colors.HexColor("#B94D2C")
PALE = colors.HexColor("#FFF0E8")
CREAM = colors.HexColor("#F8F6F1")
LINE = colors.HexColor("#E7E0D7")
GREEN = colors.HexColor("#3F8A68")


def register_fonts() -> None:
    regular_candidates = [
        Path(r"C:\Windows\Fonts\msyh.ttc"),
        Path(r"C:\Windows\Fonts\simhei.ttf"),
    ]
    bold_candidates = [
        Path(r"C:\Windows\Fonts\msyhbd.ttc"),
        Path(r"C:\Windows\Fonts\simhei.ttf"),
    ]
    regular = next((path for path in regular_candidates if path.exists()), None)
    bold = next((path for path in bold_candidates if path.exists()), None)
    if not regular or not bold:
        raise RuntimeError("未找到可嵌入的中文字体，请安装微软雅黑或黑体。")

    pdfmetrics.registerFont(TTFont("MealSans", str(regular), subfontIndex=0))
    pdfmetrics.registerFont(TTFont("MealSansBold", str(bold), subfontIndex=0))
    pdfmetrics.registerFontFamily(
        "MealSans",
        normal="MealSans",
        bold="MealSansBold",
        italic="MealSans",
        boldItalic="MealSansBold",
    )


def make_styles():
    base = getSampleStyleSheet()
    return {
        "cover_kicker": ParagraphStyle(
            "CoverKicker",
            parent=base["Normal"],
            fontName="MealSansBold",
            fontSize=11,
            leading=16,
            textColor=ACCENT,
            alignment=TA_CENTER,
            spaceAfter=9,
        ),
        "cover_title": ParagraphStyle(
            "CoverTitle",
            parent=base["Title"],
            fontName="MealSansBold",
            fontSize=30,
            leading=41,
            textColor=INK,
            alignment=TA_CENTER,
            spaceAfter=12,
        ),
        "cover_subtitle": ParagraphStyle(
            "CoverSubtitle",
            parent=base["Normal"],
            fontName="MealSans",
            fontSize=12,
            leading=21,
            textColor=MUTED,
            alignment=TA_CENTER,
        ),
        "h1": ParagraphStyle(
            "H1",
            parent=base["Heading1"],
            fontName="MealSansBold",
            fontSize=21,
            leading=29,
            textColor=INK,
            spaceBefore=4,
            spaceAfter=11,
        ),
        "h2": ParagraphStyle(
            "H2",
            parent=base["Heading2"],
            fontName="MealSansBold",
            fontSize=14,
            leading=21,
            textColor=ACCENT_DARK,
            spaceBefore=11,
            spaceAfter=6,
        ),
        "body": ParagraphStyle(
            "Body",
            parent=base["BodyText"],
            fontName="MealSans",
            fontSize=10.5,
            leading=18,
            textColor=INK,
            spaceAfter=7,
        ),
        "small": ParagraphStyle(
            "Small",
            parent=base["BodyText"],
            fontName="MealSans",
            fontSize=8.5,
            leading=14,
            textColor=MUTED,
        ),
        "card_title": ParagraphStyle(
            "CardTitle",
            parent=base["Heading3"],
            fontName="MealSansBold",
            fontSize=11,
            leading=17,
            textColor=INK,
            spaceAfter=3,
        ),
        "card_body": ParagraphStyle(
            "CardBody",
            parent=base["BodyText"],
            fontName="MealSans",
            fontSize=9,
            leading=15,
            textColor=MUTED,
        ),
        "key": ParagraphStyle(
            "Key",
            parent=base["BodyText"],
            fontName="MealSansBold",
            fontSize=10,
            leading=16,
            textColor=ACCENT_DARK,
            alignment=TA_CENTER,
        ),
    }


def draw_page(canvas, doc, title: str) -> None:
    canvas.saveState()
    width, height = A4
    canvas.setTitle(title)
    canvas.setAuthor("好吃的今天产品团队")
    canvas.setFillColor(CREAM)
    canvas.rect(0, 0, width, height, fill=1, stroke=0)
    canvas.setFillColor(colors.white)
    canvas.roundRect(14 * mm, 13 * mm, width - 28 * mm, height - 26 * mm, 4 * mm, fill=1, stroke=0)

    canvas.setFont("MealSansBold", 8)
    canvas.setFillColor(ACCENT)
    canvas.drawString(21 * mm, height - 18 * mm, "好吃的今天")
    canvas.setFont("MealSans", 7.5)
    canvas.setFillColor(MUTED)
    canvas.drawRightString(width - 21 * mm, height - 18 * mm, title)
    canvas.setStrokeColor(LINE)
    canvas.line(21 * mm, height - 21 * mm, width - 21 * mm, height - 21 * mm)

    canvas.setFont("MealSans", 7.5)
    canvas.setFillColor(MUTED)
    canvas.drawString(21 * mm, 18 * mm, "一日三餐，不再为难")
    canvas.drawRightString(width - 21 * mm, 18 * mm, f"第 {canvas.getPageNumber()} 页")
    canvas.restoreState()


def make_doc(path: Path, title: str) -> SimpleDocTemplate:
    return SimpleDocTemplate(
        str(path),
        pagesize=A4,
        title=title,
        author="好吃的今天产品团队",
        leftMargin=23 * mm,
        rightMargin=23 * mm,
        topMargin=28 * mm,
        bottomMargin=25 * mm,
    )


def section_title(text: str, styles) -> KeepTogether:
    return KeepTogether([
        Paragraph(text, styles["h1"]),
        Table([[""]], colWidths=[18 * mm], rowHeights=[1.3 * mm], style=TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), ACCENT),
        ])),
        Spacer(1, 5 * mm),
    ])


def cards(items, styles, columns=2):
    cells = []
    for title, body in items:
        cells.append([
            Paragraph(title, styles["card_title"]),
            Paragraph(body, styles["card_body"]),
        ])
    rows = []
    for index in range(0, len(cells), columns):
        row = cells[index:index + columns]
        while len(row) < columns:
            row.append("")
        rows.append(row)
    table = Table(rows, colWidths=[(164 * mm - (columns - 1) * 4 * mm) / columns] * columns, hAlign="LEFT")
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), CREAM),
        ("BOX", (0, 0), (-1, -1), 0.7, LINE),
        ("INNERGRID", (0, 0), (-1, -1), 4 * mm, colors.white),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
    ]))
    return table


def note(text: str, styles, color=PALE):
    table = Table([[Paragraph(text, styles["body"])]], colWidths=[164 * mm])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), color),
        ("BOX", (0, 0), (-1, -1), 0.7, colors.HexColor("#F2C5B5")),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
    ]))
    return table


def shortcut_table(rows, styles):
    data = [[
        Paragraph("按键", styles["card_title"]),
        Paragraph("功能", styles["card_title"]),
        Paragraph("使用说明", styles["card_title"]),
    ]]
    for keys, action, description in rows:
        data.append([
            Paragraph(keys, styles["key"]),
            Paragraph(action, styles["card_title"]),
            Paragraph(description, styles["card_body"]),
        ])
    table = Table(data, colWidths=[39 * mm, 39 * mm, 86 * mm], repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PALE),
        ("TEXTCOLOR", (0, 0), (-1, 0), ACCENT_DARK),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, CREAM]),
        ("BOX", (0, 0), (-1, -1), 0.7, LINE),
        ("INNERGRID", (0, 0), (-1, -1), 0.45, LINE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    return table


def build_user_guide(path: Path, styles) -> None:
    title = "好吃的今天 - README 使用说明"
    story = [
        Spacer(1, 32 * mm),
        Paragraph("README · USER GUIDE", styles["cover_kicker"]),
        Paragraph("好吃的今天<br/>使用说明", styles["cover_title"]),
        Paragraph("从今天吃什么，到一周怎么吃<br/>一份轻松、温暖、可持续记录的餐桌指南", styles["cover_subtitle"]),
        Spacer(1, 22 * mm),
        note("这份 PDF 面向应用用户，内容包括快速上手、主要功能、小饭 AI、数据安全和常见问题。快捷键请查看设置中的独立《快捷键说明 PDF》。", styles),
        Spacer(1, 13 * mm),
        cards([
            ("适用平台", "Windows 桌面应用。网页预览仅用于体验界面，部分系统能力以桌面版为准。"),
            ("产品定位", "帮助个人与家庭安排三餐、查询菜品、记录份量，并获得饮食参考建议。"),
        ], styles),
        PageBreak(),
        section_title("01  快速上手", styles),
        cards([
            ("1. 选择场景", "从日常、家庭、乐龄或健身模式开始。进阶场景需要登录并开通有效的 Pro 会员。"),
            ("2. 安排三餐", "在“好吃的今天”查看早餐、午餐和晚餐，点击菜品可调整时间、用量和营养信息。"),
            ("3. 搜索菜品", "按 Ctrl + K 或点击顶部搜索框，在八大菜系库中按菜名、食材、口味和做法查找。"),
            ("4. 问问小饭", "点击右下角“问问小饭”，描述想吃什么、现有食材或饮食目标，获取餐食建议。"),
        ], styles),
        Paragraph("界面怎么走", styles["h2"]),
        Paragraph("左侧导航负责页面和场景切换；顶部提供后退、前进、搜索、通知和账号入口；中间是当前功能区；右下角是小饭 AI。后退与前进会记录你访问过的页面和场景。", styles["body"]),
        note("第一次使用建议依次打开“好吃的今天 - 八大菜系库 - 餐食日历 - 营养报告”，再回到首页完成一顿饭的编辑。", styles),
        PageBreak(),
        section_title("02  主要功能", styles),
        cards([
            ("今日三餐", "查看计划、编辑菜品和实际饭量、标记完成，并把记录用于后续份量建议。"),
            ("餐食日历", "按月浏览餐食，选择日期查看三餐；右键可快速打开当天详情。"),
            ("八大菜系库", "检索菜品并查看食材、营养、推荐份量以及关联菜品，可直接加入早餐、午餐或晚餐。"),
            ("收藏与报告", "把喜欢的菜加入收藏夹；在营养报告中查看阶段性表现和饮食结构提示。"),
            ("四种场景", "日常模式关注均衡，家庭餐桌关注多人份量，乐龄养护强调清淡与风险提示，燃力健身关注训练与营养搭配。"),
            ("PDF 导出", "单道食谱和每周菜单可通过 Windows 保存窗口导出为 PDF，便于打印、分享或留存。"),
        ], styles),
        Paragraph("份量建议如何产生", styles["h2"]),
        Paragraph("应用会参考同一餐次的历史饭量与单餐热量目标，计算建议份量和食材克数。它用于生活规划，不是医学诊断，也不替代营养师或医生。", styles["body"]),
        PageBreak(),
        section_title("03  小饭 AI 与隐私", styles),
        Paragraph("小饭 AI 是应用内统一的饮食顾问名称。用户端不会展示、保存或读取后台服务凭证，也不会显示底层供应商或模型名称。服务会结合当前场景、今天的餐食和近期饭量记录生成回答。", styles["body"]),
        cards([
            ("适合询问", "今晚吃什么、冰箱剩菜怎么搭配、家庭人数变化、清淡或高蛋白替换、近期饮食结构。"),
            ("不适合询问", "疾病诊断、处方调整、急救判断、药物剂量，以及与饮食无关的通用问答。"),
            ("数据保存", "餐食历史和日历调整优先保存在当前设备；登录、收藏等联网能力由后台服务处理。"),
            ("敏感信息", "不要在对话中输入身份证号、银行卡、详细病历或其他与餐食建议无关的隐私信息。"),
        ], styles),
        note("如出现持续连接失败，请先检查网络，再到“设置 - 小饭 AI”运行连接检测。现有菜单和本地记录不会因 AI 暂时不可用而消失。", styles),
        Paragraph("账号与会员", styles["h2"]),
        Paragraph("应用支持手机号或受支持邮箱登录。商户通道启用后，可在 Pro 收银台选择方案并扫码支付；会员只会在服务端确认到账后开通。当前不提供自动续费，付款前请核对方案和金额。", styles["body"]),
        PageBreak(),
        section_title("04  常见问题", styles),
        cards([
            ("找不到想吃的菜", "尝试搜索主要食材、菜系、口味或做法；也可以让小饭 AI 给出相近替代。"),
            ("页面切错了", "点击左上角返回按钮，或按 Alt + 左方向键。需要回来时点击前进按钮。"),
            ("文字太小", "按 Ctrl + 加号放大，Ctrl + 减号缩小，Ctrl + 0 恢复默认比例。"),
            ("PDF 没有打开", "确认系统已安装 PDF 阅读器；若仍失败，请重新安装最新版应用，确保帮助文档资源完整。"),
            ("AI 连接异常", "前往设置中的小饭 AI 页面运行检测；若持续失败，请联系管理员检查后台通道。"),
            ("如何看全部快捷键", "进入“设置与帮助 - 快捷键说明”，或随时按 Ctrl + / 打开独立 PDF。"),
        ], styles),
        Spacer(1, 7 * mm),
        note("健康提示：小饭 AI 和营养数据仅作日常饮食参考。涉及疾病、过敏、孕产、儿童喂养或用药时，请咨询具备资质的专业人员。", styles, colors.HexColor("#EDF7F1")),
    ]
    doc = make_doc(path, title)
    doc.build(story, onFirstPage=lambda c, d: draw_page(c, d, title), onLaterPages=lambda c, d: draw_page(c, d, title))


def build_shortcut_guide(path: Path, styles) -> None:
    title = "好吃的今天 - 快捷键说明"
    navigation = [
        ("Alt + 左方向键", "返回上一界面", "沿页面访问记录向后移动；与左上角返回按钮一致。"),
        ("Alt + 右方向键", "前往下一界面", "返回后可沿历史记录向前移动。"),
        ("Ctrl + 1", "今日三餐", "直接打开“好吃的今天”。"),
        ("Ctrl + 2", "餐食日历", "直接打开餐食日历。"),
        ("Ctrl + 3", "菜系库", "直接打开八大菜系库。"),
        ("Ctrl + 4", "营养报告", "直接打开营养报告。"),
        ("Ctrl + 5", "我的收藏", "直接打开收藏页面。"),
        ("Alt + 1", "日常模式", "切换到日常模式并返回今日页面。"),
        ("Alt + 2", "家庭餐桌", "切换到家庭模式；未解锁时会显示会员或建档流程。"),
        ("Alt + 3", "乐龄养护", "切换到乐龄模式；未解锁时会显示会员流程。"),
        ("Alt + 4", "燃力健身", "切换到健身模式；未解锁时会显示会员流程。"),
    ]
    productivity = [
        ("Ctrl + K", "搜索菜品", "打开八大菜系库并把光标放到搜索区域。"),
        ("Ctrl + Shift + A", "打开或关闭小饭 AI", "快速呼出饮食顾问；再次按下可收起。"),
        ("Ctrl + ,", "打开设置", "打开“设置与帮助”的账号信息页面。"),
        ("Ctrl + /", "快捷键说明", "直接打开当前这份快捷键 PDF。"),
        ("F1", "使用说明", "直接打开 README 使用说明 PDF。"),
        ("Esc", "关闭当前浮层", "关闭对话框、通知面板或小饭 AI。"),
        ("Tab", "下一个控件", "在对话框或表单中移动到下一个可操作控件。"),
        ("Shift + Tab", "上一个控件", "在对话框或表单中反向移动。"),
        ("Enter", "发送消息", "在小饭 AI 输入框中发送；Shift + Enter 用于换行。"),
    ]
    window_keys = [
        ("Ctrl + +", "放大界面", "逐级放大文字和界面元素。"),
        ("Ctrl + -", "缩小界面", "逐级缩小文字和界面元素。"),
        ("Ctrl + 0", "恢复缩放", "恢复应用默认显示比例。"),
        ("F5 或 Ctrl + R", "刷新应用", "重新加载当前应用窗口；未保存的临时输入可能丢失。"),
    ]

    story = [
        Spacer(1, 28 * mm),
        Paragraph("KEYBOARD SHORTCUTS", styles["cover_kicker"]),
        Paragraph("好吃的今天<br/>快捷键说明", styles["cover_title"]),
        Paragraph("少点几下，早点开饭<br/>Windows 桌面版键盘操作速查", styles["cover_subtitle"]),
        Spacer(1, 18 * mm),
        note("快捷键不会绕过登录、会员、家庭建档或安全检查。正在填写对话框时，应用级快捷键会暂停，避免误操作。", styles),
        Spacer(1, 10 * mm),
        cards([
            ("最常用", "Ctrl + K 搜菜 · Ctrl + Shift + A 问小饭 · Alt + 左/右方向键前后导航"),
            ("随时查看", "按 Ctrl + / 打开本说明；按 F1 打开完整使用说明。"),
        ], styles),
        PageBreak(),
        section_title("01  页面与场景导航", styles),
        shortcut_table(navigation, styles),
        PageBreak(),
        section_title("02  效率与表单操作", styles),
        shortcut_table(productivity, styles),
        Spacer(1, 8 * mm),
        section_title("03  窗口控制", styles),
        shortcut_table(window_keys, styles),
    ]
    doc = make_doc(path, title)
    doc.build(story, onFirstPage=lambda c, d: draw_page(c, d, title), onLaterPages=lambda c, d: draw_page(c, d, title))


def main() -> None:
    register_fonts()
    styles = make_styles()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)

    user_guide = OUTPUT_DIR / USER_GUIDE_NAME
    shortcut_guide = OUTPUT_DIR / SHORTCUT_GUIDE_NAME
    build_user_guide(user_guide, styles)
    build_shortcut_guide(shortcut_guide, styles)

    shutil.copy2(user_guide, PUBLIC_DIR / USER_GUIDE_NAME)
    shutil.copy2(shortcut_guide, PUBLIC_DIR / SHORTCUT_GUIDE_NAME)
    print(user_guide)
    print(shortcut_guide)


if __name__ == "__main__":
    main()
