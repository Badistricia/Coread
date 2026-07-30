import unittest

from app.prompts.prompt_manager import get_system_prompt


class QuotePromptTests(unittest.TestCase):
    def test_quote_scene_prioritizes_the_selected_subject(self):
        prompt = get_system_prompt(
            companion_id="luchen",
            current_local_time="20:00",
            daily_read_minutes=10,
            quote="少女清冷淡然的气质，犹如清莲初绽。",
            scene="quote",
        )

        self.assertIn("当前划线和用户这次的问题优先于历史对话", prompt)
        self.assertIn("划线中的具体人物、动作或描写", prompt)
        self.assertIn("不要先评价作者写得好不好", prompt)
        self.assertIn("不要用“这段写得真准”", prompt)
        self.assertNotIn("<annotation>", prompt)


if __name__ == "__main__":
    unittest.main()
