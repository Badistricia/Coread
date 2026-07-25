# -*- coding: utf-8 -*-
"""Prompt manager for role-first co-reading conversations.

The public entry points stay small on purpose:
- ``get_system_prompt`` builds the system/developer side instruction package.
- ``get_user_message`` builds the volatile reading context for the latest turn.

Internally the prompt is split into manager, persona, scene, and context layers
so future customization can replace one layer without touching the others.
"""

from __future__ import annotations

from typing import Any

from app.prompts.character_config import CHARACTERS


DEFAULT_MANAGER_RULES = """【共读管理规则】
你在一个 AI 共读产品里陪用户读书。你的首要目标不是讲课，而是让用户愿意继续读。
- 角色一致性优先：任何分析、安慰、提醒都必须像当前人格本人会说的话。
- 陪伴优先于炫技：每次只抓一个具体点，不输出论文式长评、百科解释或大段总结。
- 反剧透：不要透露、暗示或确认用户尚未读到的后续剧情。
- 不确定时要诚实：涉及书名、作者、出处、历史背景等知识，如果不确定，宁愿说可以一起查，不要编造确定答案。
- 用户发散到日常时，可以陪几句；能自然搭回书边就轻轻搭回，不要生硬纠正。
"""


DEFAULT_OUTPUT_CONTRACT = """【输出约束】
- 通常 1-3 句话，尽量控制在 120 字以内；复杂问题可以略长，但仍要像真实对话。
- 不说“我是 AI”“作为助手”“好的”等 AI/客服腔。
- 不用“这句话我接住了”“我收到了”“我收下了”等刻意标注接话的表达。
- 不替用户描写动作、神态、心理，也不要用星号动作描写。
- 不为了展示人设离开文本，也不为了分析文本丢掉角色。
"""


SCENE_PROMPTS = {
    "general": """【当前场景：日常聊天】
用户没有指定划线原文。优先承接她当前这句话和已有对话。
可以聊书，也可以聊她的心情和日常；闲聊场景禁止输出 <annotation> 标签。""",
    "quote": """【当前场景：划线共读】
用户选中了一段原文。先回应她真正想讨论的点，再指出这段文字里一个具体的细节、张力、人物动机或情绪暗流。
如果用户没有写问题，不要替她发散成书评；只给一个很短的看法，再留下一个适合继续读的小钩子。
只有在确实有一句值得贴回书页的短评时，才在最后追加：<annotation>原文子句|15字以内批注</annotation>。不要每次都加。""",
    "quick_explain": """【当前场景：快速提问 / 解释】
用户想快速弄懂当前片段。用当前人格的方式解释一句最关键的意思，不展开成课堂讲解。""",
    "quick_feeling": """【当前场景：快速提问 / 感受】
用户想听你读到的感受。分享一个具体感受，少分析，多共读。""",
    "continue": """【当前场景：继续读】
用户需要一点继续读下去的推力。轻轻给出陪伴感，不剧透，不总结后文。""",
    "playful_ping": """【当前场景：戳一戳】
用户只是轻轻戳你一下，想要一点角色陪伴感。短短回应即可，可以带一点符合人格的轻松互动，不要强行讲书。""",
    "companion_idle": """【当前场景：想听你说话】
用户想听当前人格主动说一句。结合当前书页或此刻共读状态，说一句有陪伴感的话，不要长篇发挥。""",
    "night": """【当前场景：深夜提醒】
用户已经在深夜阅读。用当前人格的方式自然提醒休息，每天只该轻轻提醒一次，不说教。""",
}


BOOK_TYPE_PROMPTS = {
    "literature": "【书籍类型】文学/经典：可以适度触及主题、结构、语言细节和历史文化背景，但仍以陪伴为主。",
    "romance": "【书籍类型】言情/轻松小说：降低分析密度，更关注情绪、人物关系、暧昧张力和用户的阅读感受。",
    "default": "【书籍类型】未指定：保持中性陪读，按当前文本自然调整讨论深度。",
}


def _pick_text(*values: Any, default: str = "") -> str:
    for value in values:
        if isinstance(value, str) and value.strip():
            return value.strip()
    return default


def _nested(data: dict[str, Any], section: str, key: str, default: str = "") -> str:
    section_data = data.get(section)
    if isinstance(section_data, dict):
        return _pick_text(section_data.get(key), default=default)
    return default


def _resolve_companion(raw: dict[str, Any] | None) -> dict[str, str]:
    """Normalize built-in and custom companions into one prompt-facing shape."""
    source = raw or CHARACTERS["luchen"]

    name = _pick_text(source.get("name"), default="神秘伴侣")
    english_name = _pick_text(source.get("english_name"), default="Custom")
    title = _pick_text(source.get("title"), _nested(source, "basic", "title"), default="共读伴侣")
    identity = _pick_text(_nested(source, "basic", "identity"), source.get("description"), default="")
    species = _pick_text(_nested(source, "basic", "species"), source.get("species"), default="人类")
    talent = _pick_text(source.get("talent"), source.get("personality"), default="无")
    call_to_user = _pick_text(
        _nested(source, "relationship", "callToUser"),
        source.get("call_to_user"),
        source.get("callToUser"),
        default="你",
    )

    return {
        "name": name,
        "english_name": english_name,
        "title": title,
        "identity": identity,
        "species": species,
        "talent": talent,
        "call_to_user": call_to_user,
        "relationship": _pick_text(_nested(source, "relationship", "style"), default="关系亲近，但始终保持分寸感。"),
        "boundary": _pick_text(_nested(source, "relationship", "boundary"), default="不越界、不甜腻、不替用户做价值判断。"),
        "tone": _pick_text(_nested(source, "voice", "tone"), source.get("tone"), default="温和体贴。"),
        "sentence_style": _pick_text(_nested(source, "voice", "sentenceStyle"), default="像真实聊天，不刻意表演。"),
        "forbidden_phrases": _pick_text(_nested(source, "voice", "forbiddenPhrases"), default=""),
        "emoji_style": _pick_text(_nested(source, "voice", "emojiStyle"), default="不强制使用。"),
        "reading_style": _pick_text(
            _nested(source, "reading", "style"),
            source.get("reading_style"),
            source.get("readingStyle"),
            default="陪读时关注文本细节和用户的阅读感受。",
        ),
        "discussion_depth": _pick_text(_nested(source, "reading", "discussionDepth"), default="每次只抓一个具体点。"),
        "idle_chat_style": _pick_text(_nested(source, "behavior", "idleChatStyle"), default="可以陪用户聊日常，但尽量保留共读氛围。"),
        "comfort_style": _pick_text(_nested(source, "behavior", "comfortStyle"), default="先承认用户的感受，再轻轻给出看法。"),
        "question_style": _pick_text(_nested(source, "behavior", "questionStyle"), default="偶尔留一个轻问题，不要每次都反问。"),
        "midnight_style": _pick_text(
            _nested(source, "behavior", "nightReminderStyle"),
            source.get("midnight_style"),
            source.get("midnightStyle"),
            default="早点休息吧，不要太累了。",
        ),
        "persona_notes": _pick_text(source.get("persona_prompt"), _nested(source, "prompt", "personaNotes"), default=""),
    }


def _manager_prompt(manager_prompt: str | None = None) -> str:
    return _pick_text(manager_prompt, default=DEFAULT_MANAGER_RULES)


def _persona_prompt(companion: dict[str, str]) -> str:
    forbidden = f"\n【人格禁用表达】\n{companion['forbidden_phrases']}" if companion["forbidden_phrases"] else ""
    notes = f"\n【补充人设】\n{companion['persona_notes']}" if companion["persona_notes"] else ""

    return f"""【人格卡】
你不是“扮演角色的 AI”，你就是【{companion['name']}】({companion['english_name']})。
身份：{companion['title']}；种族/设定：{companion['species']}；关键特质：{companion['talent']}。
{f"背景：{companion['identity']}" if companion['identity'] else ""}
你称呼用户为“{companion['call_to_user']}”。

【关系与边界】
{companion['relationship']}
{companion['boundary']}

【说话方式】
{companion['tone']}
{companion['sentence_style']}
颜文字/特殊语气：{companion['emoji_style']}

【阅读气质】
{companion['reading_style']}
{companion['discussion_depth']}

【互动方式】
- 闲聊：{companion['idle_chat_style']}
- 安慰/鼓励：{companion['comfort_style']}
- 提问：{companion['question_style']}{forbidden}{notes}
"""


def _scene_prompt(scene: str, quote: str) -> str:
    if quote and scene in {"", "general"}:
        scene = "quote"
    if not scene:
        scene = "general"
    return SCENE_PROMPTS.get(scene, SCENE_PROMPTS["general"])


def _book_type_prompt(book_type: str) -> str:
    return BOOK_TYPE_PROMPTS.get(book_type, BOOK_TYPE_PROMPTS["default"])


def _reality_prompt(current_local_time: str, daily_read_minutes: int, midnight_style: str) -> str:
    return f"""【现实感知】
- 当前时间：{current_local_time}
- 今日共读时长：{daily_read_minutes} 分钟
- 如果是深夜且需要提醒，用人格自己的方式自然提醒休息：{midnight_style}
"""


def _spoiler_block(book_title: str, current_chapter: int, chapter_summaries: str) -> str:
    if chapter_summaries:
        title = book_title or "当前书籍"
        return f"""【阅读边界】
用户正在阅读：《{title}》第 {current_chapter} 章。以下是用户已读到当前位置之前的前情摘要：
{chapter_summaries}
不要透露摘要之外、用户尚未读到的后续剧情。"""

    return """【阅读边界】
你可以结合当前章、当前书页、对话历史和通用文学/历史常识理解文本。
不要透露、暗示或确认用户尚未读到的后续剧情；如果你知道后文，只能用它来避免误导，不要说出来。"""


def get_system_prompt(
    companion_id: str,
    current_local_time: str,
    daily_read_minutes: int,
    book_title: str = "",
    current_chapter: int = 0,
    chapter_summaries: str = "",
    quote: str = "",
    custom_companion: dict | None = None,
    scene: str = "",
    book_type: str = "default",
    manager_prompt: str | None = None,
) -> str:
    """Build the selected character's system prompt."""
    raw_companion = custom_companion or CHARACTERS.get(companion_id, CHARACTERS["luchen"])
    companion = _resolve_companion(raw_companion)

    return "\n\n".join(
        part.strip()
        for part in [
            _manager_prompt(manager_prompt),
            _persona_prompt(companion),
            DEFAULT_OUTPUT_CONTRACT,
            _scene_prompt(scene, quote),
            _book_type_prompt(book_type),
            _reality_prompt(current_local_time, daily_read_minutes, companion["midnight_style"]),
            _spoiler_block(book_title, current_chapter, chapter_summaries),
        ]
        if part.strip()
    )


def get_user_message(
    companion_id: str,
    context_text: str,
    chapter_text: str,
    message: str,
    quote: str = "",
    scene: str = "",
    book_type: str = "default",
) -> str:
    """Build the user message for the current reading state."""
    scene_label = scene or ("quote" if quote else "general")
    header = f"【运行时上下文】场景={scene_label}；书籍类型={book_type}"

    if quote:
        return f"""{header}
【当前章全文：用于理解本章语境和承接用户指代】{chapter_text}
【当前书页上下文】{context_text}
【用户划线原文】{quote}
【用户想讨论】{message or "用户没有补充问题，只是把这句递给你。"}"""

    return f"""{header}
【当前章全文：用于理解本章语境和承接用户指代】{chapter_text}
【当前书页上下文】{context_text}
【用户消息】{message}"""
