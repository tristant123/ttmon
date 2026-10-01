import json
import os
import tempfile
import threading
import unittest
from unittest import mock
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer
from importlib.util import find_spec
from types import SimpleNamespace

from nihongo import analyzer, config, dictionary
from nihongo.__main__ import format_report
from nihongo.kana import to_romaji
from nihongo.offline import analyze_offline
from nihongo.schema import ANALYSIS_SCHEMA, validate
from nihongo.server import make_handler

HAS_ANTHROPIC = find_spec("anthropic") is not None
_cache = tempfile.TemporaryDirectory()


def setUpModule():
    # Unpack the dictionary into a throwaway folder, not the real user cache.
    os.environ["NIHONGO_CACHE"] = _cache.name


def tearDownModule():
    dictionary._conn = None
    _cache.cleanup()


class FakeClient:
    """Stands in for anthropic.Anthropic(); records the request, returns a canned reply."""

    def __init__(self, text, stop_reason="end_turn"):
        self.request = None
        reply = SimpleNamespace(stop_reason=stop_reason,
                                content=[SimpleNamespace(type="text", text=text)])

        def create(**kwargs):
            self.request = kwargs
            return reply

        self.beta = SimpleNamespace(messages=SimpleNamespace(create=create))


def demo_json():
    a = analyzer.demo_analysis()
    a.pop("warnings"), a.pop("demo")
    return json.dumps(a, ensure_ascii=False)


class SchemaTests(unittest.TestCase):
    def test_demo_is_valid(self):
        self.assertEqual(analyzer.demo_analysis()["warnings"], [])

    def test_demo_uses_every_schema_field(self):
        demo = analyzer.demo_analysis()
        self.assertTrue(set(ANALYSIS_SCHEMA["required"]) <= set(demo))

    def test_schema_is_strict(self):
        # Structured outputs need every object closed and fully required.
        def walk(node):
            if node.get("type") == "object":
                self.assertIs(node["additionalProperties"], False)
                self.assertEqual(set(node["required"]), set(node["properties"]))
                for child in node["properties"].values():
                    walk(child)
            elif node.get("type") == "array":
                walk(node["items"])
        walk(ANALYSIS_SCHEMA)

    def test_catches_tokens_that_do_not_spell_the_sentence(self):
        a = analyzer.demo_analysis()
        a["tokens"] = a["tokens"][:-2]
        self.assertTrue(any("spell" in p for p in validate(a)))

    def test_catches_out_of_range_token_index(self):
        a = analyzer.demo_analysis()
        a["grammar_points"][0]["token_indices"] = [99]
        self.assertTrue(any("missing tokens" in p for p in validate(a)))


class AnalyzerTests(unittest.TestCase):
    @unittest.skipUnless(HAS_ANTHROPIC, "the optional anthropic package is not installed")
    def test_sends_sentence_with_schema_and_parses_reply(self):
        client = FakeClient(demo_json())
        result = analyzer.analyze("  雨が降っていたので、傘を持って出かけました。 ", client=client)
        self.assertEqual(result["translation"], analyzer.demo_analysis()["translation"])
        self.assertEqual(result["warnings"], [])
        req = client.request
        self.assertEqual(req["messages"], [{"role": "user", "content": "雨が降っていたので、傘を持って出かけました。"}])
        self.assertEqual(req["output_config"]["format"]["schema"], ANALYSIS_SCHEMA)
        self.assertEqual(req["model"], analyzer.MODEL)

    def test_empty_and_overlong_input_rejected_without_calling_api(self):
        client = FakeClient("{}")
        for bad in ["", "   ", "あ" * (analyzer.MAX_SENTENCE_CHARS + 1)]:
            with self.assertRaises(analyzer.AnalysisError):
                analyzer.analyze(bad, client=client)
        self.assertIsNone(client.request)

    @unittest.skipUnless(HAS_ANTHROPIC, "the optional anthropic package is not installed")
    def test_refusal_and_truncation_become_errors(self):
        for stop in ("refusal", "max_tokens"):
            with self.assertRaises(analyzer.AnalysisError):
                analyzer.analyze("猫", client=FakeClient("", stop_reason=stop))

    def test_bad_effort_rejected(self):
        with self.assertRaises(analyzer.AnalysisError):
            analyzer.analyze("猫", client=FakeClient("{}"), effort="huge")


class ServerTests(unittest.TestCase):
    def start(self, **kw):
        server = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(**kw))
        threading.Thread(target=server.serve_forever, daemon=True).start()
        self.addCleanup(server.server_close)
        self.addCleanup(server.shutdown)
        return f"http://127.0.0.1:{server.server_address[1]}"

    def post(self, url, body, path="/api/analyze", headers=None):
        req = urllib.request.Request(url + path, data=json.dumps(body).encode(),
                                     headers={"Content-Type": "application/json", **(headers or {})})
        try:
            with urllib.request.urlopen(req) as r:
                return r.status, json.loads(r.read())
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read())

    def test_serves_page(self):
        with urllib.request.urlopen(self.start(demo=True) + "/") as r:
            self.assertIn(b"Japanese Grammar Breakdown", r.read())

    def test_demo_mode_returns_sample(self):
        status, data = self.post(self.start(demo=True), {"sentence": "何でも"})
        self.assertEqual(status, 200)
        self.assertTrue(data["demo"])
        self.assertGreater(len(data["grammar_points"]), 0)

    def test_live_mode_uses_analyzer_and_reports_errors(self):
        def fake(sentence, effort):
            if sentence == "bad":
                raise analyzer.AnalysisError("nope")
            return {"echo": sentence, "effort": effort}
        url = self.start(analyze_fn=fake, effort="high")
        self.assertEqual(self.post(url, {"sentence": "猫"}), (200, {"echo": "猫", "effort": "high"}))
        self.assertEqual(self.post(url, {"sentence": "bad"}), (422, {"error": "nope"}))


    def get_json(self, url):
        with urllib.request.urlopen(url) as r:
            return json.loads(r.read())

    def test_key_setup_flow(self):
        with isolated_config():
            url = self.start(engine="claude")
            self.assertEqual(self.get_json(url + "/api/status"),
                             {"demo": False, "engine": "claude", "has_key": False})
            status, data = self.post(url, {"key": "hello"}, path="/api/key")
            self.assertEqual(status, 422)
            status, data = self.post(url, {"key": "sk-ant-test"}, path="/api/key")
            self.assertEqual((status, data), (200, {"has_key": True}))
            self.assertEqual(self.get_json(url + "/api/status")["has_key"], True)
            self.assertEqual(config.api_key(), "sk-ant-test")

    def test_offline_is_the_default_and_needs_no_key(self):
        with isolated_config():
            url = self.start()
            self.assertEqual(self.get_json(url + "/api/status"),
                             {"demo": False, "engine": "offline", "has_key": True})
            status, data = self.post(url, {"sentence": "猫が好きです。"})
            self.assertEqual(status, 200)
            self.assertEqual(data["engine"], "offline")
            self.assertIn("〜が好き / 嫌い / 上手 / 下手", [p["pattern"] for p in data["grammar_points"]])
            status, data = self.post(url, {"sentence": "hello"})
            self.assertEqual(status, 422)

    def test_cross_origin_posts_refused(self):
        with isolated_config():
            url = self.start()
            status, _ = self.post(url, {"key": "sk-ant-evil"}, path="/api/key",
                                  headers={"Origin": "https://evil.example"})
            self.assertEqual(status, 403)
            self.assertIsNone(config.saved_api_key())


def isolated_config():
    """Point the config file at a temp dir and hide any real credentials."""
    tmp = tempfile.TemporaryDirectory()
    env = {"NIHONGO_CONFIG": os.path.join(tmp.name, "config.json")}
    patch = mock.patch.dict(os.environ, env)

    class Ctx:
        def __enter__(self):
            patch.start()
            for var in ("ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN"):
                os.environ.pop(var, None)

        def __exit__(self, *exc):
            patch.stop()
            tmp.cleanup()
    return Ctx()


class ConfigTests(unittest.TestCase):
    def test_env_var_wins_over_saved_key(self):
        with isolated_config():
            self.assertIsNone(config.api_key())
            config.save_api_key("  sk-ant-saved \n")
            self.assertEqual(config.api_key(), "sk-ant-saved")
            os.environ["ANTHROPIC_API_KEY"] = "sk-ant-env"
            self.assertEqual(config.api_key(), "sk-ant-env")

    def test_rejects_non_keys(self):
        with isolated_config():
            for bad in ("", None, "password"):
                with self.assertRaises(ValueError):
                    config.save_api_key(bad)
            self.assertFalse(config.has_key())


class ReportTests(unittest.TestCase):
    def test_text_report_lists_every_point(self):
        demo = analyzer.demo_analysis()
        report = format_report(demo)
        for gp in demo["grammar_points"]:
            self.assertIn(gp["pattern"], report)


if __name__ == "__main__":
    unittest.main()


def patterns(sentence):
    return [p["pattern"] for p in analyze_offline(sentence)["grammar_points"]]


class OfflineTests(unittest.TestCase):
    EXAMPLES = {
        "雨が降っていたので、傘を持って出かけました。":
            ["が", "〜ている", "〜ので", "を", "〜ました"],
        "日本に来てから、毎日日本語を勉強しなければならないと思っています。":
            ["〜てから", "〜なければならない", "〜と思う", "〜ている"],
        "先生に褒められて、とても嬉しかったです。":
            ["〜れる / 〜られる", "〜かった", "〜です"],
        "もし時間があったら、一緒に映画を見に行きませんか。":
            ["〜たら", "〜に行く / 〜に来る", "〜ませんか"],
        "母が作ったケーキはとてもおいしかった。": ["Noun-modifying clause", "は", "〜かった"],
        "窓を開けてもいいですか。": ["〜てもいい", "か"],
        "ここで写真を撮らないでください。": ["〜ないでください"],
        "富士山に登ったことがありますか。": ["〜たことがある"],
        "明日は雨が降るかもしれない。": ["〜かもしれない"],
        "お荷物をお持ちします。": ["お〜する"],
        "ちょっと待って！": ["〜て (request)"],
    }

    def test_finds_expected_grammar(self):
        for sentence, expected in self.EXAMPLES.items():
            with self.subTest(sentence=sentence):
                found = patterns(sentence)
                for p in expected:
                    self.assertIn(p, found)

    def test_every_analysis_is_valid(self):
        for sentence in self.EXAMPLES:
            with self.subTest(sentence=sentence):
                self.assertEqual(analyze_offline(sentence)["warnings"], [])

    def test_no_duplicate_or_swallowed_points(self):
        # ん inside ませんか, and ます inside ました, are not separate points.
        found = patterns("一緒に行きませんか。")
        self.assertNotIn("〜ん", found)
        self.assertNotIn("〜ます", patterns("昨日、映画を見ました。"))

    def test_matches_read_as_whole_words(self):
        a = analyze_offline("先生に褒められて、とても嬉しかったです。")
        texts = {p["pattern"]: p["matched_text"] for p in a["grammar_points"]}
        self.assertEqual(texts["〜て (て-form)"], "褒められて")
        self.assertEqual(texts["〜れる / 〜られる"], "褒められ")

    def test_sentence_romaji_and_reading(self):
        a = analyze_offline("雨が降っていたので、傘を持って出かけました。")
        self.assertEqual(a["romaji"], "Ame ga futte ita node, kasa o motte dekakemashita.")
        self.assertEqual(a["reading"], "あめがふっていたので、かさをもってでかけました。")

    def test_word_meanings_come_from_the_dictionary(self):
        words = {t["surface"]: t["gloss"] for t in analyze_offline("傘を持って出かけた。")["tokens"]}
        self.assertIn("umbrella", words["傘"])
        self.assertIn("hold", words["持っ"])

    def test_rejects_non_japanese_and_empty(self):
        for bad in ("", "   ", "hello world"):
            with self.assertRaises(analyzer.AnalysisError):
                analyze_offline(bad)

    def test_register_and_sentence_type(self):
        self.assertIn("polite", analyze_offline("行きませんか。")["structure"])
        self.assertIn("invitation", analyze_offline("行きませんか。")["structure"])
        self.assertIn("plain", analyze_offline("行かない。")["structure"])


class DictionaryTests(unittest.TestCase):
    def test_reading_picks_the_right_homograph(self):
        self.assertIn("fall", dictionary.lookup("降る", "ふっ", "v"))
        self.assertIn("descend", dictionary.lookup("降る", "くだ", "v"))

    def test_part_of_speech_picks_the_particle(self):
        self.assertIn("subject", dictionary.lookup("が", "が", "prt"))

    def test_unknown_word(self):
        self.assertIsNone(dictionary.lookup("ｘｙｚｚｙ"))


class KanaTests(unittest.TestCase):
    def test_romaji(self):
        cases = {"きょう": "kyou", "がっこう": "gakkou", "しんぶん": "shinbun", "きんえん": "kin'en",
                 "ちゃ": "cha", "まっちゃ": "matcha", "コーヒー": "koohii", "ティー": "tii"}
        for kana, romaji in cases.items():
            with self.subTest(kana=kana):
                self.assertEqual(to_romaji(kana), romaji)


class LibraryTests(unittest.TestCase):
    """The grammar library: every point is found in its own example, in new
    sentences, and not in look-alikes."""

    def test_every_grammar_point_detects_its_own_example(self):
        from nihongo import catalog
        from nihongo.grammar import RULES
        items = [(e.key, e.example[0]) for e in catalog.REGISTRY] + [(r.key, r.example[0]) for r in RULES]
        self.assertGreater(len(items), 400)
        for key, example in items:
            with self.subTest(key=key):
                keys = [p["key"] for p in analyze_offline(example)["grammar_points"]]
                self.assertIn(key, keys)

    def test_every_level_is_covered(self):
        from nihongo import catalog
        levels = {e.jlpt for e in catalog.REGISTRY}
        self.assertEqual(levels, {"N5", "N4", "N3", "N2", "N1"})

    NEW_SENTENCES = {
        "駅まで歩いて行くしかない。": "n3_shika_nai",
        "彼女に会うたびに、緊張してしまう。": "n3_tabi_ni",
        "知らないくせに、偉そうなことを言うな。": "n3_kuse_ni",
        "ニュースによると、地震があったらしい。": "n3_ni_yoru_to",
        "約束したから、行かないわけにはいかない。": "n3_wake_ni_wa_ikanai",
        "説明書のとおりに組み立てた。": "n3_toori",
        "考えれば考えるほど分からなくなる。": "n4_ba_hodo",
        "来年から日本で働くことになった。": "n4_koto_ni_naru",
        "電話しようとしたら、電池が切れた。": "n4_you_to_suru",
        "どこにも行かなかった。": "n5_q_mo_nai",
        "反対意見にもかかわらず、計画は進められた。": "n2_nimo_kakawarazu",
        "雨が降ったので、中止せざるを得なかった。": "n2_zaru_wo_enai",
        "やってみないことには、分からない。": "n2_nai_koto_ni_wa",
        "金持ちが幸せだとは限らない。": "n2_to_wa_kagiranai",
        "社長ともなると、責任が重い。": "n1_tomo_naru_to",
        "駅に着くや否や、電車が出発した。": "n1_ya_ina_ya",
    }

    def test_detects_grammar_in_new_sentences(self):
        for sentence, key in self.NEW_SENTENCES.items():
            with self.subTest(sentence=sentence):
                keys = [p["key"] for p in analyze_offline(sentence)["grammar_points"]]
                self.assertIn(key, keys)

    LOOKALIKES = {
        "駅の前にある新しいカフェに行った。": "mae_ni",         # in front of, not before
        "猫は机の上で寝ている。": "n2_ue_de",                  # on the desk
        "どちらか一つを選んでください。": "n5_ka_or",           # どちらか, not "A or B"
        "物価が上がった。": "n4_garu",                         # 上がる is not 上 + がる
        "昔のことを思い出した。": "n4_compound_aspect",          # 思い出す is "recall"
        "趣味は写真を撮ることです。": "n2_koto_da",             # not advice
        "夕方に帰ります。": "n4_kata",                          # 夕方 is not a way of doing
        "この服はよく似合う。": "n3_au",                        # 似合う is not "each other"
    }

    def test_no_false_detections_on_lookalikes(self):
        for sentence, key in self.LOOKALIKES.items():
            with self.subTest(sentence=sentence):
                keys = [p["key"] for p in analyze_offline(sentence)["grammar_points"]]
                self.assertNotIn(key, keys)

    def test_building_blocks_fold_into_bigger_points(self):
        a = analyze_offline("雨にもかかわらず、たくさんの人が集まった。")
        patterns = [p["pattern"] for p in a["grammar_points"]]
        self.assertIn("〜にもかかわらず", patterns)
        self.assertNotIn("に", patterns)          # part of にもかかわらず
        self.assertIn("[despite]", a["literal_translation"])

    def test_every_point_links_to_bunpro(self):
        for p in analyze_offline("彼は忙しいにもかかわらず手伝ってくれる。")["grammar_points"]:
            self.assertIn("bunpro", p["lookup_url"])


class PhraseTests(unittest.TestCase):
    def test_sentence_splits_into_phrases_with_roles(self):
        a = analyze_offline("雨が降っていたので、傘を持って出かけました。")
        got = [(ph["text"], ph["role"]) for ph in a["phrases"]]
        self.assertEqual(got, [
            ("雨が", "Subject"),
            ("降っていたので、", "Because, so (clause)"),
            ("傘を", "Object"),
            ("持って", "Linked action (て-form)"),
            ("出かけました。", "Main predicate"),
        ])

    def test_fixed_expression_stays_in_one_phrase(self):
        texts = [ph["text"] for ph in analyze_offline("彼は忙しいにもかかわらず、手伝ってくれる。")["phrases"]]
        self.assertIn("忙しいにもかかわらず、", texts)

    def test_phrases_cover_every_word_once(self):
        a = analyze_offline("先週買った本をもう読み終わりましたか。")
        covered = [i for ph in a["phrases"] for i in ph["token_indices"]]
        self.assertEqual(covered, list(range(len(a["tokens"]))))

    def test_phrase_lists_its_grammar(self):
        a = analyze_offline("毎日走ることにしました。")
        ph = [p for p in a["phrases"] if "こと" in p["text"]][0]
        self.assertIn("〜ことにする", [a["grammar_points"][k]["pattern"] for k in ph["grammar"]])
