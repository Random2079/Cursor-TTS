"""Мост ChatGPT: чужой сайт 403, голос в команду демона не подставляется."""
from __future__ import annotations

import unittest
from unittest.mock import patch

import chatgpt_tts_http as bridge


class TestBridgePolicy(unittest.TestCase):
    def test_chatgpt_and_extension_allowed(self) -> None:
        self.assertTrue(bridge.origin_allowed("https://chatgpt.com", None))
        self.assertTrue(
            bridge.origin_allowed("chrome-extension://abcdefghijklmnop", None)
        )
        self.assertTrue(bridge.origin_allowed(None, None))

    def test_foreign_site_forbidden(self) -> None:
        self.assertFalse(bridge.origin_allowed("https://example.com", None))
        self.assertFalse(bridge.origin_allowed("https://chatgpt.com.evil.test", None))
        self.assertFalse(bridge.origin_allowed("null", None))
        self.assertFalse(bridge.origin_allowed(None, "https://evil.test/x"))
        self.assertFalse(bridge.host_allowed("evil.test"))
        self.assertFalse(bridge.host_allowed("localhost:47392"))
        self.assertTrue(bridge.host_allowed("127.0.0.1:47392"))

    def test_speak_drops_voice_fields(self) -> None:
        payload = bridge.speak_command(
            {
                "text": "  Привет  ",
                "speaker": "xenia",
                "engine": "edge",
                "voice": "nova",
                "local_speaker": "baya",
            }
        )
        self.assertEqual(payload, {"cmd": "speak", "text": "Привет"})

    def test_stop_is_bare_command(self) -> None:
        self.assertEqual(bridge.stop_command(), {"cmd": "stop"})

    def test_forward_speak_does_not_add_voice(self) -> None:
        seen: dict = {}

        def fake_send(payload: dict, timeout: float = 2.0) -> dict:
            seen["payload"] = payload
            seen["timeout"] = timeout
            return {"ok": True, "queued": True}

        with patch.object(bridge, "send_command", fake_send):
            reply = bridge.forward(bridge.speak_command({"text": "Раз"}))
        self.assertEqual(seen["payload"], {"cmd": "speak", "text": "Раз"})
        self.assertNotIn("speaker", seen["payload"])
        self.assertTrue(reply["queued"])


if __name__ == "__main__":
    unittest.main()
