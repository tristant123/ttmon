"""The offline grammar catalog: patterns matched against Janome (IPADIC) tokens.

Each Rule describes one grammar point: how to spot it in a token sequence,
and what to tell the learner about it. IPADIC splits words finely, so a
pattern like 〜ていた is several tokens: 降っ / て / い / た.

Matchers (m) test one token:
    s  surface text        b  dictionary (base) form
    p  part-of-speech prefix, e.g. "助詞,格助詞" or just "動詞"
    f  conjugation-form prefix, e.g. "連用" (連用形 and 連用タ接続), "基本形"
    opt=True               the token may be absent
Any of s/b/p/f may be a tuple of alternatives.
"""

from dataclasses import dataclass, field


# --- matching -----------------------------------------------------------------

@dataclass(frozen=True)
class M:
    s: tuple = None
    b: tuple = None
    p: tuple = None
    f: tuple = None
    opt: bool = False
    not_b: tuple = None

    def test(self, t):
        if self.s and t.surface not in self.s:
            return False
        if self.b and t.base not in self.b:
            return False
        if self.not_b and t.base in self.not_b:
            return False
        if self.p and not t.pos.startswith(self.p):
            return False
        if self.f and not t.iform.startswith(self.f):
            return False
        return True


def m(s=None, b=None, p=None, f=None, opt=False, not_b=None):
    tup = lambda v: (v,) if isinstance(v, str) else v
    return M(tup(s), tup(b), tup(p), tup(f), opt, tup(not_b))


def _match_seq(seq, toks, i, k=0):
    if k == len(seq):
        return i
    mt = seq[k]
    if i < len(toks) and mt.test(toks[i]):
        end = _match_seq(seq, toks, i + 1, k + 1)
        if end is not None:
            return end
    if mt.opt:
        return _match_seq(seq, toks, i, k + 1)
    return None


@dataclass
class Rule:
    key: str
    pattern: str
    name: str
    category: str
    jlpt: str
    seqs: list
    meaning: str
    formation: str
    example: tuple
    here: object                     # str template or callable(ctx) -> str
    before: M = None                 # token just before the match must pass this
    after: M = None                  # token just after the match must pass this
    at_end: bool = False             # match must close the sentence (punctuation aside)
    check: object = None             # callable(toks, start, end) -> bool
    hides: tuple = field(default_factory=tuple)

    def find(self, toks):
        for i in range(len(toks)):
            if self.before and (i == 0 or not self.before.test(toks[i - 1])):
                continue
            for seq in self.seqs:
                end = _match_seq(seq, toks, i)
                if end is None or end == i:
                    continue
                if self.after and (end >= len(toks) or not self.after.test(toks[end])):
                    continue
                if self.at_end and any(t.pos.split(",")[0] != "記号" for t in toks[end:]):
                    continue
                if self.check and not self.check(toks, i, end):
                    continue
                yield i, end
                break


# --- shorthands ---------------------------------------------------------------

VERB_REN = m(p="動詞", f="連用")                         # 書い, 食べ, 行き, 持っ
PRED_REN = m(p=("動詞", "助動詞", "形容詞"), f="連用")
TE = m(s=("て", "で"), p="助詞,接続助詞")

RULES = []


def rule(key, pattern, name, category, jlpt, seqs, meaning, formation, example, here, **kw):
    if isinstance(seqs, M):              # one token
        seqs = [[seqs]]
    elif isinstance(seqs[0], M):         # one sequence
        seqs = [seqs]
    RULES.append(Rule(key, pattern, name, category, jlpt, seqs, meaning, formation,
                      example, here, **kw))


def prev_not(*bases):
    return lambda toks, i, j: i == 0 or toks[i - 1].base not in bases


# --- polite forms ---------------------------------------------------------------

rule("masen_deshita", "〜ませんでした", "Polite negative past", "auxiliary", "N5",
     [m(b="ます", f="未然"), m(s="ん"), m(b="です", f="連用"), m(b="た")],
     "Did not (polite).", "Verb ます-stem + ませんでした", ("昨日は何も食べませんでした。", "I didn't eat anything yesterday."),
     "Makes {base} polite, negative and past: 'did not {gloss}'.",
     hides=("masu", "masen", "ta_past", "desu", "negative_n"))
rule("masen_ka", "〜ませんか", "Invitation: won't you …?", "sentence_pattern", "N5",
     [m(b="ます", f="未然"), m(s="ん"), m(s="か", p="助詞")],
     "A polite invitation, literally 'won't you …?'.", "Verb ます-stem + ませんか", ("一緒に行きませんか。", "Would you like to go together?"),
     "Invites the listener to {base} together; asking in the negative makes it softer and more polite than a plain question.",
     hides=("masu", "masen", "ka_question", "negative_n"))
rule("mashou", "〜ましょう", "Let's …", "auxiliary", "N5",
     [m(b="ます", f="未然ウ"), m(s="う")],
     "Suggests doing something together: 'let's …'. With か it offers: 'shall I/we …?'.", "Verb ます-stem + ましょう", ("始めましょう。", "Let's begin."),
     "Suggests {base} together (or offers to, if か follows).",
     hides=("masu", "volitional"))
rule("mashita", "〜ました", "Polite past", "auxiliary", "N5",
     [m(b="ます", f="連用"), m(b="た")],
     "Past tense in polite form.", "Verb ます-stem + ました", ("昨日、映画を見ました。", "I watched a movie yesterday."),
     "Puts {base} in the past and keeps the sentence polite.",
     hides=("masu", "ta_past"))
rule("masen", "〜ません", "Polite negative", "auxiliary", "N5",
     [m(b="ます", f="未然"), m(s="ん")],
     "Does not / will not (polite).", "Verb ます-stem + ません", ("肉は食べません。", "I don't eat meat."),
     "Negates {base} politely.",
     hides=("masu", "negative_n"))
rule("masu", "〜ます", "Polite form (ます)", "auxiliary", "N5",
     m(b="ます"),
     "Makes a verb polite; on its own it is present or future tense.", "Verb ます-stem + ます", ("毎日コーヒーを飲みます。", "I drink coffee every day."),
     "Makes {base} polite. Without た it means the action happens habitually or will happen.")

rule("deshita", "〜でした", "Polite past of です", "auxiliary", "N5",
     [m(b="です", f="連用"), m(b="た")],
     "Was / were (polite).", "Noun / な-adjective + でした", ("昨日は雨でした。", "It was rainy yesterday."),
     "The past of です: '{prev} was …'.", check=prev_not("ん"), hides=("desu", "ta_past"))
rule("deshou", "〜でしょう / だろう", "Probably; …, right?", "auxiliary", "N5",
     [[m(b="です", f="未然"), m(s="う")], [m(b="だ", f="未然"), m(s="う")]],
     "Guesses ('probably …') or checks with the listener ('…, right?').", "Plain form / noun + でしょう (polite) or だろう (plain)", ("明日は晴れるでしょう。", "It will probably be sunny tomorrow."),
     "Adds 'probably' to what comes before, or asks the listener to agree.",
     hides=("desu", "da", "volitional"))
rule("desu", "〜です", "Polite copula / polite ending", "auxiliary", "N5",
     m(b="です"),
     "'Is / am / are' in polite speech; after an い-adjective it only adds politeness.", "Noun / な-adjective / い-adjective + です", ("私は学生です。", "I am a student."),
     lambda c: ("Adds politeness after the adjective; the adjective already carries the meaning."
                if c["prev_pos"].startswith("形容詞") or c["prev_surface"] in ("た",)
                else f"Says that the subject is {c['prev']}, in polite speech."),
     check=prev_not("ん", "の"))

# --- plain copula ---------------------------------------------------------------

rule("datta", "〜だった", "Plain past copula", "auxiliary", "N5",
     [m(b="だ", f="連用タ"), m(b="た")],
     "Was / were (plain).", "Noun / な-adjective + だった", ("子供の頃は静かだった。", "I was quiet as a child."),
     "The plain past of だ: '{prev} was'.", hides=("da", "ta_past"))
rule("dewa_nai", "〜ではない / じゃない", "Negative copula: is not", "auxiliary", "N5",
     [[m(s="で"), m(s="は"), m(b="ない")],
      [m(s="で"), m(s="は"), m(b="ある"), m(b="ます"), m(s="ん")],
      [m(s="じゃ"), m(b="ない")],
      [m(s="じゃ"), m(b="ある"), m(b="ます"), m(s="ん")]],
     "The negative of だ / です: 'is not'. じゃ is the everyday contraction of では.", "Noun / な-adjective + ではない (じゃない); polite ではありません", ("これは私の本じゃない。", "This isn't my book."),
     "Says that the subject is not {prev}.",
     before=m(p="名詞"), hides=("wa_topic", "nai", "masen", "masu", "de_particle", "negative_n"))
rule("da", "〜だ", "Plain copula", "auxiliary", "N5",
     m(b="だ", f="基本形"),
     "'Is / am / are' in plain (casual) speech.", "Noun / な-adjective + だ", ("今日は日曜日だ。", "Today is Sunday."),
     "Says that the subject is {prev}, in plain speech.",
     check=lambda toks, i, j: toks[i].surface == "だ" and (i == 0 or toks[i - 1].pos.startswith("名詞")))
rule("na_adj", "な-adjective + な", "な-adjective modifying a noun", "conjugation", "N5",
     [m(p="名詞,形容動詞語幹"), m(s="な", b="だ")],
     "な-adjectives take な when they come directly before a noun.", "な-adjective + な + noun", ("静かな部屋", "a quiet room"),
     "{text} describes the noun that follows: '{gloss}'.")
rule("nara", "〜なら", "Conditional なら", "conjunction", "N4",
     m(s="なら", b="だ"),
     "'If (it's the case that) …', often reacting to what someone just said.", "Plain form / noun + なら", ("京都に行くなら、秋がいいですよ。", "If you're going to Kyoto, autumn is good."),
     "Sets up the condition '{prev}' for the advice or statement that follows.")

# --- plain conjugations ---------------------------------------------------------

rule("nakatta", "〜なかった", "Plain negative past", "conjugation", "N5",
     [m(b="ない", f="連用タ"), m(b="た")],
     "Did not (plain).", "Verb ない-form: ない → なかった", ("何も言わなかった。", "I didn't say anything."),
     "Makes {base} negative and past.", hides=("nai", "ta_past"))
rule("kereba", "〜なければ", "Negative conditional", "conjugation", "N4",
     [m(b="ない", f="仮定形"), m(s="ば")],
     "'If (you) don't …'.", "Verb ない-form: ない → なければ", ("急がなければ、遅れます。", "If we don't hurry, we'll be late."),
     "'If (one) doesn't …': the condition is not doing {base}.", hides=("nai", "ba"))
rule("nai", "〜ない", "Plain negative", "conjugation", "N5",
     m(b="ない", p="助動詞"),
     "Negative ('not') in plain form.", "Verb ない-stem (あ-row for godan) + ない; い-adjective く + ない", ("今日は行かない。", "I'm not going today."),
     "Negates {base}: 'not {gloss}'.")
rule("negative_n", "〜ん", "Negative ん", "auxiliary", "N5",
     m(s="ん", p="助動詞"),
     "The negative ぬ/ん; almost always seen inside ません.", "Verb stem + ん", ("分かりません。", "I don't understand."),
     "Negates the verb.", hides=())
rule("ta_past", "〜た", "Plain past", "conjugation", "N5",
     m(b="た", f="基本形"),
     "Past tense (or a completed action) in plain form.", "Verb た-form (like the て-form with た)", ("昨日、本を読んだ。", "I read a book yesterday."),
     lambda c: (f"Puts {c['base']} in the past or marks it as completed."
                if c["base"] else "Marks the action as past or completed."))
rule("tara", "〜たら", "Conditional たら", "conjunction", "N4",
     m(b="た", f="仮定形"),
     "'If / when …': once the first thing happens, the second follows.", "Verb た-form + ら", ("駅に着いたら、電話してください。", "Call me when you get to the station."),
     "Makes {base} a condition: 'if / once …'. The rest of the sentence follows from it.")
rule("ba", "〜ば", "Conditional ば", "conjunction", "N4",
     [m(p=("動詞", "形容詞"), f="仮定形"), m(s="ば")],
     "'If …': the first part is a condition for the second.", "Verb え-row + ば (行く → 行けば); い-adjective ければ", ("安ければ買います。", "I'll buy it if it's cheap."),
     "Makes {base} a condition: 'if …'. The rest of the sentence depends on it.")
rule("volitional", "〜う / 〜よう", "Volitional form", "conjugation", "N4",
     m(s=("う", "よう"), p="助動詞"),
     "'Let's …' (casual) or 'I will …'; with と思う it means 'I'm thinking of …'.", "Godan: お-row + う (行く → 行こう); ichidan: stem + よう", ("一緒に帰ろう。", "Let's go home together."),
     "Expresses the speaker's will or suggestion to {gloss}.",
     check=prev_not("です", "だ", "ます"))
rule("imperative", "Imperative", "Command form", "conjugation", "N4",
     m(p="動詞", f="命令ｅ"),
     "A blunt command. Used in signs, sports, and by some speakers among close friends.", "Godan: え-row (行く → 行け); ichidan: stem + ろ", ("早く寝ろ。", "Go to sleep already."),
     "A direct order to do {base}.")
rule("nasai", "〜なさい", "Command: do …", "sentence_pattern", "N4",
     [VERB_REN, m(b="なさる", f="命令")],
     "A firm but not rude command, typical of parents and teachers.", "Verb ます-stem + なさい", ("早く寝なさい。", "Go to bed now."),
     "Tells the listener to {base}, in the tone of a parent or teacher.")
rule("tai", "〜たい", "Want to …", "auxiliary", "N5",
     m(b="たい", p="助動詞"),
     "The speaker wants to do something. It conjugates like an い-adjective.", "Verb ます-stem + たい", ("日本に行きたい。", "I want to go to Japan."),
     "Says (someone) wants to {base}.")
rule("rashii", "〜らしい", "Seems / apparently; typical of", "auxiliary", "N4",
     m(b="らしい", p="助動詞"),
     "'Apparently …' (based on what you heard or saw), or 'typical of' after a noun.", "Plain form / noun + らしい", ("彼は来ないらしい。", "Apparently he isn't coming."),
     "Presents what comes before as hearsay or inference, not the speaker's own certainty.")
rule("beki", "〜べき", "Should", "auxiliary", "N3",
     m(b="べし"),
     "'Should / ought to', a strong recommendation or moral obligation.", "Verb dictionary form + べき (する → すべき)", ("もっと早く言うべきだった。", "I should have said so sooner."),
     "Says one ought to {base}.")

# --- te-form and te-patterns ---------------------------------------------------

rule("te_form", "〜て (て-form)", "Te-form", "conjugation", "N5",
     [m(p=("動詞", "助動詞", "形容詞"), f="連用"), TE],
     "The connecting form: links to a following verb or clause ('and', 'and then', 'by …ing') or to helper verbs like いる.",
     "Godan: 書く → 書いて, 読む → 読んで, 待つ → 待って; ichidan: stem + て; い-adjective: くて",
     ("朝ご飯を食べて、学校に行った。", "I ate breakfast and went to school."),
     "{base} → {text}: the て-form joins it to what follows.")
rule("te_request", "〜て (request)", "Casual request", "sentence_pattern", "N5",
     [VERB_REN, TE],
     "A て-form at the end of a sentence is a casual request: '(please) …'. It's 〜てください with ください dropped.",
     "Verb て-form (end of sentence)", ("ちょっと待って。", "Wait a moment."),
     "Casually asks the listener to do {base}.", at_end=True, hides=("te_form",))
rule("mase", "〜ませ", "Polite command (set phrases)", "honorific", "N4",
     m(b="ます", f="命令"),
     "The command form of ます, heard in fixed polite phrases: いらっしゃいませ (welcome), お待ちくださいませ.",
     "Honorific verb + ませ", ("いらっしゃいませ。", "Welcome (to our shop)."),
     "A fixed, very polite expression used by shop and service staff.", hides=("masu",))
rule("te_iru", "〜ている", "Ongoing action / resulting state", "sentence_pattern", "N5",
     [[PRED_REN, TE, m(b="いる", p="動詞,非自立"), m(b="ます", opt=True), m(b="た", opt=True)],
      [PRED_REN, m(b=("てる", "でる"), p="動詞,非自立"), m(b="た", opt=True)]],
     "An action in progress ('is …ing') or a state that results from a past change ('is married', 'has arrived').",
     "Verb て-form + いる (casual: てる)", ("今、雨が降っている。", "It's raining now."),
     "Describes {base} as ongoing ('is …ing') or as a state that continues.")
rule("te_aru", "〜てある", "Has been done (deliberately)", "sentence_pattern", "N4",
     [VERB_REN, TE, m(b="ある")],
     "Something has been done on purpose and the result remains.", "Transitive verb て-form + ある", ("窓が開けてある。", "The window has been left open."),
     "The result of {base} is in place because someone did it on purpose.")
rule("te_oku", "〜ておく", "Do in advance", "sentence_pattern", "N4",
     [[VERB_REN, TE, m(b="おく", p="動詞,非自立")], [VERB_REN, m(b=("とく", "どく"))]],
     "Do something in advance, or leave it as it is.", "Verb て-form + おく (casual: とく)", ("旅行の前にホテルを予約しておく。", "I'll book the hotel before the trip."),
     "Says {base} is done ahead of time, in preparation.")
rule("te_shimau", "〜てしまう / 〜ちゃう", "Completely / regrettably", "sentence_pattern", "N4",
     [[VERB_REN, TE, m(b="しまう")], [VERB_REN, m(b=("ちゃう", "じゃう"))],
      [VERB_REN, m(s="じゃ", p="助詞,接続助詞"), m(s="う")]],
     "Doing something completely, or (often) with regret or by accident.", "Verb て-form + しまう (casual: ちゃう / じゃう)", ("財布を忘れてしまった。", "I (stupidly) forgot my wallet."),
     "{base} is done completely, often with a sense of regret or that it can't be undone.",
     hides=("te_form",))
rule("te_miru", "〜てみる", "Try doing", "sentence_pattern", "N4",
     [VERB_REN, TE, m(b="みる", p="動詞,非自立")],
     "Try doing something to see what it's like.", "Verb て-form + みる", ("この服を着てみます。", "I'll try this on."),
     "Means trying {base} to see how it goes.")
rule("te_kuru", "〜てくる", "Come (having done) / start to", "sentence_pattern", "N4",
     [VERB_REN, TE, m(b=("くる", "来る"), p="動詞,非自立")],
     "Do something and come back, or a change that develops up to now.", "Verb て-form + くる", ("コンビニで飲み物を買ってくる。", "I'll go buy a drink at the convenience store (and come back)."),
     "{base} happens and then comes toward the speaker, in space or in time.")
rule("te_iku", "〜ていく", "Go (having done) / continue on", "sentence_pattern", "N4",
     [VERB_REN, TE, m(b=("いく", "行く"), p="動詞,非自立")],
     "Do something and then go, or a change that continues from now on.", "Verb て-form + いく", ("これからも日本語を勉強していきます。", "I'll keep on studying Japanese."),
     "{base} continues away from the speaker, in space or into the future.")
rule("te_ageru", "〜てあげる", "Do for someone", "sentence_pattern", "N4",
     [VERB_REN, TE, m(b=("あげる", "やる", "差し上げる"), p="動詞,非自立")],
     "Do something as a favor for someone else.", "Verb て-form + あげる", ("妹に本を読んであげた。", "I read a book to my little sister."),
     "{base} is done as a favor for someone else.")
rule("te_kureru", "〜てくれる / 〜てくださる", "Someone does for me", "sentence_pattern", "N4",
     [VERB_REN, TE, m(b=("くれる", "くださる"), p="動詞,非自立"), m(p="助動詞", opt=True)],
     "Someone does something as a favor for the speaker (or the speaker's group).", "Verb て-form + くれる (respectful: くださる)", ("友達が手伝ってくれた。", "My friend helped me."),
     "Someone does {base} as a favor to the speaker.",
     check=lambda toks, i, j: not toks[j - 1].iform.startswith("命令") and not (j - 2 >= 0 and toks[j - 2].iform.startswith("命令")))
rule("te_morau", "〜てもらう / 〜ていただく", "Have someone do (for me)", "sentence_pattern", "N4",
     [VERB_REN, TE, m(b=("もらう", "いただく"), p="動詞,非自立")],
     "Receive the favor of someone doing something; often 'get someone to …'.", "Verb て-form + もらう (humble: いただく)", ("先生に作文を直してもらった。", "I had my teacher correct my essay."),
     "The speaker receives the favor of someone doing {base}.")
rule("te_kudasai", "〜てください", "Please do", "sentence_pattern", "N5",
     [VERB_REN, TE, m(b="くださる", f="命令")],
     "A polite request: 'please …'.", "Verb て-form + ください", ("ちょっと待ってください。", "Please wait a moment."),
     "Politely asks the listener to {base}.")
rule("naide_kudasai", "〜ないでください", "Please don't", "sentence_pattern", "N5",
     [m(b="ない"), m(s="で"), m(b="くださる", f="命令")],
     "A polite request not to do something.", "Verb ない-form + でください", ("ここで写真を撮らないでください。", "Please don't take photos here."),
     "Politely asks the listener not to {base}.", hides=("nai", "te_form"))
rule("te_hoshii", "〜てほしい", "Want someone to do", "sentence_pattern", "N4",
     [VERB_REN, TE, m(b="ほしい")],
     "The speaker wants someone else to do something.", "Verb て-form + ほしい", ("もっとゆっくり話してほしい。", "I want you to speak more slowly."),
     "The speaker wants someone else to {base}.")
rule("te_mo_ii", "〜てもいい", "It's OK to / may", "sentence_pattern", "N5",
     [PRED_REN, TE, m(s="も"), m(b=("いい", "よい", "かまう", "構う"))],
     "Permission: 'it's all right to …' / 'may I …?'.", "Verb て-form + もいい", ("ここに座ってもいいですか。", "May I sit here?"),
     "Gives or asks permission to {base}.", hides=("mo", "te_mo"))
rule("nakute_mo_ii", "〜なくてもいい", "Don't have to", "sentence_pattern", "N4",
     [m(b="ない", f="連用テ"), TE, m(s="も"), m(b=("いい", "よい", "かまう", "構う"))],
     "'It's fine not to …' / 'you don't have to …'.", "Verb ない-form: ない → なくてもいい", ("明日は来なくてもいいです。", "You don't have to come tomorrow."),
     "Says it's not necessary to {base}.", hides=("nai", "mo", "te_mo", "te_mo_ii", "te_form"))
rule("te_wa_ikenai", "〜てはいけない", "Must not", "sentence_pattern", "N5",
     [PRED_REN, TE, m(s="は"), m(b=("いける", "だめ", "ダメ", "なる")), m(p="助動詞", opt=True), m(p="助動詞", opt=True)],
     "Prohibition: 'you must not …'.", "Verb て-form + はいけない (formal: はならない)", ("ここでタバコを吸ってはいけません。", "You must not smoke here."),
     "Forbids {base}.", hides=("wa_topic", "nai", "masen", "masu", "negative_n"))
rule("te_mo", "〜ても", "Even if / even though", "conjunction", "N4",
     [PRED_REN, TE, m(s="も")],
     "'Even if …' / 'even though …': the result doesn't change.", "Verb / い-adjective て-form + も", ("雨が降っても、行きます。", "I'll go even if it rains."),
     "'Even if …': what follows holds regardless of {base}.", hides=("mo",))
rule("te_kara", "〜てから", "After doing", "conjunction", "N5",
     [VERB_REN, TE, m(s="から")],
     "'After …, (then) …': one action strictly follows the other.", "Verb て-form + から", ("手を洗ってから、食べてください。", "Please wash your hands before eating."),
     "The action after {text} happens only once {base} is done.", hides=("kara_from", "kara_because"))

# --- obligation, ability, experience -------------------------------------------

rule("nakereba_naranai", "〜なければならない", "Must, have to", "sentence_pattern", "N4",
     [[m(b="ない", f="仮定形"), m(s="ば"), m(b=("なる", "いける"), f=("未然", "連用")), m(p="助動詞"), m(p="助動詞", opt=True)],
      [m(b="ない", f="連用テ"), TE, m(s="は"), m(b=("なる", "いける"), f=("未然", "連用")), m(p="助動詞"), m(p="助動詞", opt=True)],
      [m(s=("なきゃ", "なくちゃ"))]],
     "Obligation: literally 'if (you) don't …, it won't do'.", "Verb ない-stem + なければならない (also なくてはいけない; casual なきゃ)", ("明日までにレポートを出さなければならない。", "I have to hand in the report by tomorrow."),
     "Says (someone) has to {base}.", hides=("nai", "ba", "kereba", "masen", "masu", "te_form", "wa_topic", "negative_n", "te_wa_ikenai"))
rule("koto_ga_dekiru", "〜ことができる", "Can, be able to", "sentence_pattern", "N4",
     [m(p=("動詞",), f="基本形"), m(b="こと"), m(s="が"), m(b="できる")],
     "Ability or possibility: 'can …'.", "Verb dictionary form + ことができる", ("私は泳ぐことができます。", "I can swim."),
     "Says (someone) is able to {base}.", hides=("koto_nominal", "ga_subject"))
rule("ta_koto_ga_aru", "〜たことがある", "Have (ever) done", "sentence_pattern", "N4",
     [m(b="た"), m(b="こと"), m(s=("が", "は", "も")), m(b="ある")],
     "Experience: 'have done … (at some point)'.", "Verb た-form + ことがある", ("富士山に登ったことがあります。", "I've climbed Mt. Fuji."),
     "Says (someone) has the experience of having {base}.", hides=("ta_past", "koto_nominal", "ga_subject", "relative"))
rule("hou_ga_ii", "〜ほうがいい", "Had better", "sentence_pattern", "N4",
     [m(b=("た", "ない")), m(b=("ほう", "方")), m(s="が"), m(b=("いい", "よい"))],
     "Advice: 'you'd better …' (after た) or 'you'd better not …' (after ない).", "Verb た-form / ない-form + ほうがいい", ("早く寝たほうがいいですよ。", "You'd better go to bed early."),
     "Advises the listener to {base}.", hides=("ta_past", "ga_subject", "relative"))
rule("potential", "Potential form", "Can do (potential verb)", "conjugation", "N4",
     m(p="動詞,自立"),
     "The potential form: 'can …'. Godan verbs swap the final う-row sound for え-row + る.", "Godan: 話す → 話せる; ichidan: 食べる → 食べられる", ("日本語が少し話せます。", "I can speak a little Japanese."),
     "{text} is the potential form of {origin}: 'can {origin_gloss}'.",
     check=lambda toks, i, j: potential_origin(toks[i]) is not None)
rule("dekiru", "〜できる", "Can do (する-verb)", "conjugation", "N4",
     [m(p="名詞,サ変接続"), m(b="できる")],
     "A する-verb noun + できる means 'can do …'.", "する-noun + できる", ("明日は勉強できない。", "I can't study tomorrow."),
     "'Can do {base}': できる is the potential form of する.")

# --- passive / causative ----------------------------------------------------------

rule("causative_passive", "〜させられる", "Causative-passive: be made to", "conjugation", "N3",
     [m(b=("せる", "させる"), p="動詞,接尾"), m(b=("られる", "れる"), p="動詞,接尾")],
     "Being made to do something (usually unwillingly).", "Verb causative (させる) + られる", ("子供の頃、毎日ピアノを練習させられた。", "As a child I was made to practise piano every day."),
     "Says (someone) was made to {base}, against their wishes.", hides=("causative", "passive"))
rule("causative", "〜せる / 〜させる", "Causative: make / let", "conjugation", "N4",
     m(b=("せる", "させる"), p="動詞,接尾"),
     "Make or let someone do something.", "Godan: あ-row + せる (読む → 読ませる); ichidan: stem + させる", ("子供に野菜を食べさせる。", "I make my child eat vegetables."),
     "Someone makes or lets another person {base}.")
rule("passive", "〜れる / 〜られる", "Passive / potential / respectful", "conjugation", "N4",
     m(b=("れる", "られる"), p="動詞,接尾"),
     "One form with three uses: passive ('be …ed'), potential ('can …', ichidan verbs), or respectful (about a superior's action).",
     "Godan: あ-row + れる (読む → 読まれる); ichidan: stem + られる",
     ("先生に褒められた。", "I was praised by the teacher."),
     lambda c: (f"Most likely passive here: the に-marked person is the one who does the {c['base_gloss']}, and the subject receives it."
                if c["has_ni_before"] else
                f"This can be passive ('be {c['base_gloss']}ed'), potential ('can {c['base_gloss']}'), or respectful; context decides."))

# --- seeming, hearsay, likelihood ------------------------------------------------

rule("sou_looks", "〜そう (looks like)", "Looks like, about to", "auxiliary", "N4",
     [m(p=("動詞", "形容詞", "名詞,形容動詞語幹")), m(s="そう", p="名詞,接尾"), m(b=("だ", "です"), opt=True)],
     "How something looks: 'looks …', 'seems about to …'.", "Verb ます-stem / adjective stem + そう", ("このケーキはおいしそうだ。", "This cake looks delicious."),
     "Says {base} is how it looks to the speaker, not a certain fact.", hides=("da", "desu"))
rule("sou_hearsay", "〜そうだ (I hear)", "Hearsay: I hear that", "auxiliary", "N4",
     [m(p=("動詞", "形容詞", "助動詞"), f="基本形"), m(s="そう", p="名詞,特殊"), m(b=("だ", "です"), opt=True)],
     "Reporting something heard: 'I hear that …', 'they say …'.", "Plain form + そうだ", ("明日は雨が降るそうだ。", "I hear it will rain tomorrow."),
     "Reports what comes before as something the speaker heard, not saw.", hides=("da", "desu"))
rule("you_da", "〜ようだ / 〜みたいだ", "Seems, looks like, like", "auxiliary", "N4",
     [m(b=("よう", "みたい"), p="名詞,非自立"), m(b=("だ", "です"), opt=True)],
     "An inference from what the speaker sees ('it seems …') or a comparison ('like …'). みたい is the casual form.", "Plain form / noun + の + ようだ; plain form / noun + みたいだ", ("誰もいないようだ。", "It seems no one is here."),
     "The speaker infers or compares, rather than stating a fact.",
     after=None, check=lambda toks, i, j: not (j < len(toks) and toks[j].surface == "に"), hides=("da", "desu"))
rule("you_ni", "〜ように", "So that / in the way that", "sentence_pattern", "N4",
     [m(b="よう", p="名詞,非自立"), m(s="に"), m(b=("する", "なる"), opt=True)],
     "Purpose ('so that …'), or with する / なる: 'make sure to' / 'come to (be able to)'.", "Verb dictionary / ない-form + ように (する / なる)", ("忘れないようにメモする。", "I'll take a note so I don't forget."),
     lambda c: ("With なる: a gradual change, 'come to …'." if c["text"].endswith(("なる", "なっ", "なり"))
                else "With する: making an effort, 'make sure to …'." if c["text"].endswith(("する", "し"))
                else "Gives the purpose: 'so that …'."))
rule("kamoshirenai", "〜かもしれない", "Might, maybe", "sentence_pattern", "N4",
     [m(s="かも"), m(b=("しれる", "知れる")), m(p="助動詞"), m(p="助動詞", opt=True)],
     "Possibility: 'might …', 'maybe …'.", "Plain form / noun + かもしれない (polite: かもしれません)", ("明日は雪が降るかもしれない。", "It might snow tomorrow."),
     "Presents what comes before as a possibility, not a certainty.", hides=("nai", "masen", "masu", "negative_n"))
rule("hazu", "〜はず", "Should be, expected to", "sentence_pattern", "N4",
     m(b="はず"),
     "The speaker's confident expectation: 'should (be)'.", "Plain form / noun + の + はず", ("彼はもう着いたはずだ。", "He should have arrived by now."),
     "Presents what comes before as what the speaker expects to be true.")
rule("tsumori", "〜つもり", "Intend to", "sentence_pattern", "N4",
     m(b="つもり"),
     "Intention or plan: 'I intend to …'.", "Verb dictionary / ない-form + つもり", ("来年、日本に行くつもりです。", "I plan to go to Japan next year."),
     "Says the speaker plans to {base}.")
rule("no_da", "〜のだ / 〜んです", "Explanatory の", "sentence_pattern", "N4",
     [m(b=("の", "ん"), p="名詞,非自立"), m(b=("だ", "です"))],
     "Adds explanation or emphasis: 'it's that …'. Common in questions asking for reasons.", "Plain form + んです (casual: のだ / んだ)", ("どうしたんですか。", "What's the matter?"),
     "Frames the sentence as an explanation of the situation, not just a bare statement.", hides=("da", "desu", "deshita", "no_nominal"))

# --- clause linking ------------------------------------------------------------

rule("node", "〜ので", "Because, so", "conjunction", "N4",
     m(s="ので", p="助詞,接続助詞"),
     "Gives a reason as a natural or objective cause; softer than から.", "Plain form + ので (noun / な-adjective + なので)", ("疲れたので、早く寝ます。", "I'm tired, so I'll go to bed early."),
     "What comes before is the reason for what follows.")
rule("kara_because", "〜から (because)", "Because", "conjunction", "N5",
     m(s="から", p="助詞,接続助詞"),
     "Gives a reason; more direct and subjective than ので.", "Plain or polite form + から", ("暑いから、窓を開けて。", "It's hot, so open the window."),
     "What comes before is the reason for what follows.")
rule("noni", "〜のに", "Even though", "conjunction", "N4",
     m(s="のに", p="助詞,接続助詞"),
     "'Even though …', usually with surprise or frustration at the result.", "Plain form + のに (noun / な-adjective + なのに)", ("たくさん勉強したのに、試験に落ちた。", "Even though I studied a lot, I failed the exam."),
     "The result contradicts what you'd expect from what comes before.")
rule("kedo", "〜けど / 〜けれど", "But, although", "conjunction", "N5",
     m(s=("けど", "けれど", "けれども"), p="助詞"),
     "'But' / 'although'; at the end of a sentence it softens it.", "Plain or polite form + けど", ("高いけど、買います。", "It's expensive, but I'll buy it."),
     "Contrasts what comes before with what follows (or softens the sentence).")
rule("ga_but", "〜が (but)", "But", "conjunction", "N5",
     m(s="が", p="助詞,接続助詞"),
     "'But' joining two clauses; a bit more formal than けど.", "Plain or polite form + が", ("行きたいですが、時間がありません。", "I'd like to go, but I don't have time."),
     "Contrasts the clause before with the one after.")
rule("to_conditional", "〜と (whenever / if)", "Natural consequence と", "conjunction", "N4",
     m(s="と", p="助詞,接続助詞"),
     "'When / whenever / if …': the second thing always or naturally follows.", "Verb dictionary form + と", ("春になると、桜が咲く。", "When spring comes, the cherry blossoms bloom."),
     "When what comes before happens, what follows naturally happens too.")
rule("nagara", "〜ながら", "While doing", "conjunction", "N4",
     [VERB_REN, m(s="ながら")],
     "Two actions at the same time: 'while …'.", "Verb ます-stem + ながら", ("音楽を聞きながら勉強する。", "I study while listening to music."),
     "{base} happens at the same time as the main action.")
rule("tari", "〜たり〜たりする", "Doing things like …", "sentence_pattern", "N4",
     [VERB_REN, m(s=("たり", "だり"))],
     "Lists example actions, not all of them, or alternating actions.", "Verb た-form + り … た-form + りする", ("週末は本を読んだり、映画を見たりします。", "On weekends I do things like read books and watch movies."),
     "{base} is one example among the things done.")
rule("shi", "〜し", "And what's more", "conjunction", "N4",
     m(s="し", p="助詞,接続助詞"),
     "Lists reasons or points: 'and also …'.", "Plain form + し", ("この店は安いし、おいしい。", "This place is cheap, and what's more it's tasty."),
     "Adds one reason or point, implying there are more.")
rule("tame_ni", "〜ために", "In order to; because of", "sentence_pattern", "N4",
     [m(b=("ため", "為")), m(s="に", opt=True)],
     "Purpose ('in order to …') after a verb you control, or cause ('because of …').", "Verb dictionary form / noun + の + ために", ("日本で働くために、日本語を勉強している。", "I'm studying Japanese in order to work in Japan."),
     "Gives the purpose or the cause of what follows.")
rule("toki", "〜時", "When", "sentence_pattern", "N5",
     m(b=("時", "とき"), p="名詞,非自立"),
     "'When …' / 'at the time …'.", "Plain form / noun + の + 時", ("子供の時、よく海に行った。", "When I was a child, I often went to the sea."),
     "Sets the time of the main clause.")
rule("mae_ni", "〜前に", "Before", "sentence_pattern", "N5",
     [m(b="前"), m(s="に")],
     "'Before …'. The verb before 前に is always in dictionary form.", "Verb dictionary form / noun + の + 前に", ("寝る前に歯を磨く。", "I brush my teeth before going to bed."),
     "The main action happens before what comes before 前に.",
     before=m(p=("動詞", "助詞,連体化")), hides=("ni_particle",))
rule("ato_de", "〜後で", "After", "sentence_pattern", "N5",
     [m(b=("後", "あと")), m(s="で")],
     "'After …'. The verb before 後で is in た-form.", "Verb た-form / noun + の + 後で", ("授業の後で、図書館に行く。", "After class I'm going to the library."),
     "The main action happens after what comes before.",
     before=m(p=("助動詞", "助詞,連体化")), hides=("de_particle",))
rule("tokoro", "〜ところ", "Just about to / in the middle of / just did", "sentence_pattern", "N3",
     m(b="ところ", p="名詞,非自立"),
     "The stage of an action: about to (dictionary form), in the middle of (ている), or just finished (た-form).", "Verb form + ところ", ("今、出かけるところです。", "I'm just about to go out."),
     "Pinpoints the stage of the action.")
rule("purpose_ni", "〜に行く / 〜に来る", "Go / come to do", "sentence_pattern", "N5",
     [VERB_REN, m(s="に"), m(b=("行く", "いく", "来る", "くる", "帰る", "かえる", "出かける"))],
     "Purpose of movement: 'go to …', 'come to …'.", "Verb ます-stem + に + 行く / 来る / 帰る", ("友達に会いに行く。", "I'm going to see a friend."),
     "{base} is the reason for going or coming.", hides=("ni_particle",))
rule("sugiru", "〜すぎる", "Too much", "sentence_pattern", "N4",
     [m(p=("動詞", "形容詞", "名詞,形容動詞語幹")), m(b=("すぎる", "過ぎる"))],
     "Doing something too much, or being too …", "Verb ます-stem / adjective stem + すぎる", ("昨日は食べすぎた。", "I ate too much yesterday."),
     "Says {base} goes beyond what's right.")
rule("yasui_nikui", "〜やすい / 〜にくい", "Easy / hard to do", "sentence_pattern", "N4",
     [VERB_REN, m(b=("やすい", "にくい", "づらい"), p="形容詞")],
     "Ease or difficulty of an action.", "Verb ます-stem + やすい / にくい", ("このペンは書きやすい。", "This pen is easy to write with."),
     "Says how easy or hard it is to {base}.")
rule("aspect_verb", "〜始める / 〜終わる / 〜続ける", "Start / finish / keep doing", "sentence_pattern", "N4",
     [VERB_REN, m(b=("始める", "はじめる", "出す", "だす", "終わる", "おわる", "続ける", "つづける"))],
     "Compound verbs that mark the start, end, or continuation of an action.", "Verb ます-stem + 始める / 終わる / 続ける / 出す", ("雨が降り出した。", "It started raining."),
     "Marks the stage of {base}: starting, finishing, or continuing.")
rule("hoshii", "〜がほしい", "Want (a thing)", "sentence_pattern", "N5",
     [m(s="が"), m(b=("ほしい", "欲しい"), p="形容詞,自立")],
     "Wanting an object. For wanting to do something, use 〜たい.", "Noun + が + ほしい", ("新しいパソコンがほしい。", "I want a new computer."),
     "Says the speaker wants {prev}.", hides=("ga_subject",))
rule("to_omou", "〜と思う", "I think that", "sentence_pattern", "N5",
     [m(s="と", p="助詞,格助詞,引用"), m(b=("思う", "おもう", "考える"))],
     "Quotes a thought: 'I think that …'. With ている it's an ongoing belief or plan.", "Plain form + と思う", ("明日は雨だと思う。", "I think it'll rain tomorrow."),
     "Marks everything before と as the content of a thought.", hides=("to_quote",))
rule("vol_to_omou", "〜(よ)うと思う", "I'm thinking of doing", "sentence_pattern", "N4",
     [m(s=("う", "よう"), p="助動詞"), m(s="と", p="助詞,格助詞,引用"), m(b=("思う", "おもう"))],
     "Intention: 'I'm thinking of …', 'I'm going to …'.", "Volitional form + と思う", ("来年、留学しようと思う。", "I'm thinking of studying abroad next year."),
     "Shows the speaker's intention to {base}.", hides=("volitional", "to_omou", "to_quote"))
rule("to_iu", "〜という", "Called; that says", "sentence_pattern", "N4",
     [[m(s="という")], [m(s="と", p="助詞,格助詞,引用"), m(b=("いう", "言う"))]],
     "'Called …' (naming) or 'the … that …' (content).", "Noun / clause + という + noun", ("田中という人から電話がありました。", "There was a call from someone called Tanaka."),
     "Names or describes the content of the noun that follows.", hides=("to_quote",))
rule("to_quote", "と (quotation)", "Quotation particle", "particle", "N5",
     m(s="と", p="助詞,格助詞,引用"),
     "Marks what was said, thought, or written.", "Quote / plain form + と + 言う / 思う / 書く", ("「行く」と言った。", "He said 'I'll go'."),
     "Marks what comes before as quoted speech or thought.")
rule("kadouka", "〜かどうか", "Whether or not", "sentence_pattern", "N4",
     [m(s="か"), m(s="どう"), m(s="か")],
     "Embeds a yes/no question: 'whether (or not) …'.", "Plain form + かどうか", ("行くかどうか分からない。", "I don't know whether I'll go."),
     "Turns what comes before into an embedded yes/no question.", hides=("ka_question",))
rule("kata", "〜方", "Way of doing", "sentence_pattern", "N4",
     [VERB_REN, m(s="方", p="名詞,接尾")],
     "'How to …', 'the way of …'.", "Verb ます-stem + 方", ("漢字の読み方を教えてください。", "Please teach me how to read the kanji."),
     "'The way to do {base}', i.e. how to do it.")

# --- change ----------------------------------------------------------------------

rule("ku_naru", "〜くなる / 〜になる", "Become", "sentence_pattern", "N5",
     [[m(p="形容詞", f="連用テ"), m(b="なる")],
      [m(p=("名詞",)), m(s="に"), m(b="なる")]],
     "A change of state: 'become …', 'get …'.", "い-adjective く + なる; な-adjective / noun + に + なる", ("暗くなりました。", "It got dark."),
     "Describes a change into the state before なる.", hides=("ni_particle",),
     check=lambda toks, i, j: not (toks[i].base in ("よう", "こと", "ため")))
rule("adverb_ku", "い-adjective + く (adverb)", "Adjective used as an adverb", "conjugation", "N5",
     m(p="形容詞", f="連用テ"),
     "い-adjectives turn into adverbs by changing い to く.", "い-adjective: い → く", ("速く走る。", "I run fast."),
     "{base} becomes {text}, describing how the action is done.",
     after=m(p=("動詞", "形容詞,自立")), check=lambda toks, i, j: not (j < len(toks) and toks[j].base == "なる"))
rule("i_adj_past", "〜かった", "い-adjective past", "conjugation", "N5",
     [m(p="形容詞", f="連用タ"), m(b="た")],
     "Past tense of an い-adjective: い → かった.", "い-adjective: い → かった", ("旅行は楽しかった。", "The trip was fun."),
     "{base} in the past: 'was {gloss}'.", hides=("ta_past",))
rule("i_adj_neg", "〜くない", "い-adjective negative", "conjugation", "N5",
     [m(p="形容詞", f="連用テ"), m(b="ない")],
     "Negative of an い-adjective: い → くない.", "い-adjective: い → くない", ("今日は寒くない。", "It's not cold today."),
     "{base} negated: 'not {gloss}'.", hides=("nai",))
rule("i_adj_noun", "い-adjective + noun", "い-adjective modifying a noun", "conjugation", "N5",
     [m(p="形容詞,自立", f="基本形"), m(p=("名詞,一般", "名詞,固有", "名詞,代名詞", "名詞,サ変"))],
     "い-adjectives go directly before a noun, with no extra particle.", "い-adjective + noun", ("大きい犬", "a big dog"),
     "{base} describes the noun right after it.")
rule("relative", "Noun-modifying clause", "Relative clause", "sentence_pattern", "N4",
     [m(p=("動詞", "助動詞"), f="基本形", not_b=("だ", "です", "ます")), m(p=("名詞,一般", "名詞,固有", "名詞,代名詞", "名詞,サ変", "名詞,副詞可能"))],
     "A clause placed directly before a noun describes it, like 'the … that …' in English. No relative pronoun is needed.",
     "Plain form (clause) + noun", ("これは母が作ったケーキです。", "This is the cake my mother made."),
     "The clause ending in {text_first} describes {text_last}: 'the {text_last} that …'.")

# --- particles --------------------------------------------------------------------

rule("adverbial_ni", "〜に (adverb)", "Adverb formed with に", "particle", "N5",
     [m(p=("名詞,形容動詞語幹", "名詞,副詞可能", "名詞,サ変接続", "名詞,一般"), b=("一緒", "静か", "上手", "きれい", "綺麗", "簡単", "本当", "特", "急", "自由", "元気", "大切", "丁寧", "静か", "確か", "非常", "十分", "すぐ")), m(s="に")],
     "Some nouns and な-adjectives become adverbs with に: 一緒に (together), 静かに (quietly), 本当に (really).", "な-adjective / noun + に", ("静かに話してください。", "Please speak quietly."),
     "{text} works as an adverb describing how the action is done.", hides=("ni_particle",),
     after=m(p=("動詞", "形容詞", "名詞", "副詞", "助詞,格助詞", "記号")),
     check=lambda toks, i, j: not (j < len(toks) and toks[j].base == "なる"))
rule("wa_topic", "は", "Topic marker", "particle", "N5",
     m(s="は", p="助詞,係助詞"),
     "Marks the topic: what the sentence is about. Also used for contrast.", "Noun + は", ("私は学生です。", "I am a student."),
     "Sets up {prev} as the topic (or as a contrast with other things).")
rule("ga_subject", "が", "Subject marker", "particle", "N5",
     m(s="が", p="助詞,格助詞"),
     "Marks the grammatical subject, often new or specific information. Also marks the object of 好き, 分かる, ほしい, できる.",
     "Noun + が", ("猫がいます。", "There is a cat."),
     "Marks {prev} as the subject of the verb or adjective that follows.")
rule("wo_object", "を", "Direct object marker", "particle", "N5",
     m(s="を", p="助詞,格助詞"),
     "Marks the direct object of a verb, or the space moved through.", "Noun + を + verb", ("水を飲みます。", "I drink water."),
     "Marks {prev} as what the action is done to.")
rule("ni_particle", "に", "Target / time / location of existence", "particle", "N5",
     m(s="に", p="助詞,格助詞"),
     "Target or destination ('to'), point in time ('at'), where something exists ('in'), or the person receiving.", "Noun + に", ("7時に起きます。", "I get up at 7."),
     lambda c: (f"Marks {c['prev']} as the one who does the action: with a passive verb, に means 'by'."
                if c["passive_after"] else
                f"Marks {c['prev']} as the target, time, or location of the verb."))
rule("de_particle", "で", "Place of action / means", "particle", "N5",
     m(s="で", p="助詞,格助詞"),
     "Where an action takes place, or the means used ('by', 'with', 'in').", "Noun + で", ("図書館で勉強します。", "I study at the library."),
     "Marks {prev} as where the action happens, or what it is done with.")
rule("he_particle", "へ", "Direction", "particle", "N5",
     m(s="へ", p="助詞,格助詞"),
     "Direction of movement: 'toward, to'. Pronounced え.", "Place + へ", ("東京へ行きます。", "I'm going to Tokyo."),
     "Marks {prev} as the direction of movement.")
rule("to_and", "と (and / with)", "And; with", "particle", "N5",
     m(s="と", p=("助詞,並立助詞", "助詞,格助詞,一般")),
     "Joins nouns into a complete list ('A and B'), or marks a companion ('with').", "Noun + と + noun", ("友達と映画を見た。", "I watched a movie with a friend."),
     "Links {prev} with what follows ('and' / 'with').")
rule("no_link", "の", "Possessive / linking の", "particle", "N5",
     m(s="の", p="助詞,連体化"),
     "Links two nouns: possession ('X's'), origin, or description.", "Noun + の + noun", ("私の本", "my book"),
     "Makes {prev} describe the noun after it ('{prev}'s …').")
rule("no_nominal", "の (nominaliser)", "Turns a clause into a noun", "nominalizer", "N4",
     m(s="の", p="名詞,非自立"),
     "Turns the clause before it into a noun: '(the act of) …ing'.", "Plain form + の", ("本を読むのが好きです。", "I like reading books."),
     "Makes the clause before it into a noun.")
rule("koto_nominal", "こと (nominaliser)", "Turns a verb into a noun", "nominalizer", "N4",
     m(b="こと", p="名詞,非自立"),
     "Turns the clause before it into a noun: 'the fact of …', '…ing'.", "Plain form + こと", ("趣味は写真を撮ることです。", "My hobby is taking photos."),
     "Makes the clause before it into a noun.")
rule("mo", "も", "Also, too; even", "particle", "N5",
     m(s="も", p="助詞,係助詞"),
     "'Also / too'; with a negative, 'not … either'; after a number, 'as many as'.", "Noun + も", ("私も行きます。", "I'm going too."),
     "Adds {prev} to something already mentioned: '{prev} too'.")
rule("kara_from", "から (from)", "From", "particle", "N5",
     m(s="から", p="助詞,格助詞"),
     "Starting point in space or time: 'from'.", "Noun + から", ("9時から働きます。", "I work from 9."),
     "Marks {prev} as the starting point.")
rule("made", "まで", "Until, as far as", "particle", "N5",
     m(s="まで", p="助詞"),
     "End point in space or time: 'until / to / as far as'.", "Noun / verb dictionary form + まで", ("駅まで歩きます。", "I'll walk to the station."),
     "Marks {prev} as the end point.")
rule("yori", "より", "Than", "particle", "N5",
     m(s="より", p="助詞"),
     "Comparison: 'than'.", "A は B より + adjective", ("東京は大阪より大きい。", "Tokyo is bigger than Osaka."),
     "{prev} is the thing being compared against.")
rule("ya", "や", "And (among others)", "particle", "N5",
     m(s="や", p="助詞,並立助詞"),
     "Lists examples, implying there are others.", "Noun + や + noun (+ など)", ("りんごやバナナを買った。", "I bought apples, bananas and so on."),
     "Lists {prev} as one example among others.")
rule("dake", "だけ", "Only, just", "particle", "N5",
     m(s="だけ", p="助詞"),
     "'Only / just'; limits to what comes before.", "Noun / plain form + だけ", ("一つだけください。", "Just one, please."),
     "Limits the statement to {prev}.")
rule("shika", "しか〜ない", "Only (nothing but)", "particle", "N4",
     m(s="しか", p="助詞"),
     "'Only', always with a negative verb; stresses how little.", "Noun + しか + negative", ("百円しかない。", "I only have 100 yen."),
     "With the negative, says there is nothing other than {prev}.")
rule("demo_even", "でも", "Even; … or something", "particle", "N4",
     m(s="でも", p="助詞,副助詞"),
     "'Even …', or a soft suggestion: '… or something'.", "Noun + でも", ("お茶でも飲みませんか。", "Shall we have some tea or something?"),
     "Softens or extends the statement about {prev}.")
rule("kurai", "くらい / ぐらい", "About, approximately", "particle", "N5",
     m(s=("くらい", "ぐらい"), p="助詞"),
     "Approximate amount: 'about'. Also degree: 'to the extent that'.", "Number / plain form + くらい", ("一時間ぐらいかかる。", "It takes about an hour."),
     "Makes {prev} approximate.")
rule("nado", "など", "Etc., and so on", "particle", "N4",
     m(s="など", p="助詞"),
     "'And so on', 'things like'.", "Noun + など", ("パンや牛乳などを買った。", "I bought bread, milk and so on."),
     "Marks {prev} as examples.")
rule("bakari", "ばかり", "Nothing but; just", "particle", "N4",
     m(s="ばかり", p="助詞"),
     "'Nothing but …'; after a た-form, 'just (did)'.", "Noun + ばかり; た-form + ばかり", ("弟はゲームばかりしている。", "My brother does nothing but play games."),
     "Stresses that it's only (or just now) {prev}.")
rule("tte_quote", "って", "Casual quotation / topic", "particle", "N4",
     m(s="って", p="助詞"),
     "Casual form of と (quotation) or という / は (topic).", "Plain form / noun + って", ("明日休みだって。", "I heard tomorrow's a day off."),
     "Marks what comes before as quoted, or as the topic, in casual speech.")
rule("toka", "とか", "Things like", "particle", "N4",
     m(s="とか", p="助詞"),
     "Lists examples casually: 'things like …'.", "Noun / plain form + とか", ("週末は映画とか見る。", "On weekends I watch movies and stuff."),
     "Gives {prev} as a casual example.")
rule("ka_question", "か", "Question marker", "particle", "N5",
     m(s="か", p="助詞"),
     "At the end of a sentence it makes a question; between nouns it means 'or'.", "Sentence + か", ("これは何ですか。", "What is this?"),
     lambda c: ("Turns the sentence into a question." if c["at_end"] else
                "Marks an embedded question or choice ('… or …')."))
rule("ne", "ね", "Seeking agreement", "particle", "N5",
     m(s="ね", p="助詞,終助詞"),
     "Seeks agreement or shares a feeling: '…, isn't it?', '…, right?'.", "Sentence + ね", ("いい天気ですね。", "Nice weather, isn't it?"),
     "Invites the listener to agree or share the feeling.")
rule("yo", "よ", "Telling / emphasis", "particle", "N5",
     m(s="よ", p="助詞,終助詞"),
     "Tells the listener something new or asserts it: 'I tell you'.", "Sentence + よ", ("この本、面白いですよ。", "This book is interesting, you know."),
     "Presents the sentence as information the listener may not know.")
rule("yone", "よね", "…, right? (checking)", "particle", "N4",
     [m(s="よ", p="助詞,終助詞"), m(s="ね", p="助詞,終助詞")],
     "Checks that the listener agrees with something the speaker believes.", "Sentence + よね", ("明日は休みですよね。", "Tomorrow's a day off, right?"),
     "Checks that the listener agrees.", hides=("yo", "ne"))
rule("kana", "かな", "I wonder", "particle", "N4",
     m(s="かな", p="助詞,終助詞"),
     "'I wonder …' (talking to oneself or softly asking).", "Plain form + かな", ("明日は晴れるかな。", "I wonder if it'll be sunny tomorrow."),
     "Makes the sentence a gentle, self-directed question.")
rule("na_final", "な", "Sentence-ending な", "particle", "N4",
     m(s="な", p="助詞,終助詞"),
     "After a plain verb: 'don't …!' (prohibition). Otherwise: a reflective 'I think / I feel …'.", "Sentence + な", ("触るな。", "Don't touch it!"),
     lambda c: ("After a dictionary-form verb this is a blunt prohibition: 'don't …!'."
                if c["prev_iform"].startswith("基本形") and c["prev_pos"].startswith("動詞")
                else "Adds a reflective, musing tone."))

# --- keigo -------------------------------------------------------------------------

rule("o_ni_naru", "お〜になる", "Respectful: (someone) does", "honorific", "N3",
     [[m(s=("お", "ご", "御"), p="接頭詞"), m(p=("動詞", "名詞")), m(s="に"), m(b="なる")],
      [m(p="名詞,サ変接続"), m(s="に"), m(b="なる")]],
     "Sonkeigo: raises the person doing the action (a customer, a superior).", "お + verb ます-stem + になる", ("先生はもうお帰りになりました。", "The teacher has already gone home."),
     "Politely elevates the person doing the action.",
     check=lambda toks, i, j: toks[i].surface[0] in "おご御", hides=("ni_particle", "ku_naru", "honorific_prefix"))
rule("o_suru", "お〜する", "Humble: I do (for you)", "honorific", "N3",
     [m(s=("お", "ご", "御"), p="接頭詞"), m(p=("動詞", "名詞")), m(b=("する", "いたす", "致す")), m(b="ます", opt=True)],
     "Kenjōgo: lowers the speaker's own action done for someone respected.", "お + verb ます-stem + する (more humble: いたす)", ("お荷物をお持ちします。", "Let me carry your bags."),
     "Humbly describes something the speaker does for the listener.", hides=("honorific_prefix", "masu"))
rule("honorific_verb", "Honorific verb", "Special respectful verb", "honorific", "N3",
     m(b=("いらっしゃる", "おっしゃる", "召し上がる", "めしあがる", "ご覧になる", "なさる", "くださる")),
     "Sonkeigo verbs that replace ordinary ones: いらっしゃる (be/go/come), おっしゃる (say), 召し上がる (eat/drink), なさる (do), くださる (give me).",
     "Special verb in place of the ordinary one", ("社長はいらっしゃいますか。", "Is the company president in?"),
     "{base} is a respectful verb, used for the actions of someone the speaker looks up to.",
     check=lambda toks, i, j: not toks[i].iform.startswith("命令"))
rule("humble_verb", "Humble verb", "Special humble verb", "honorific", "N3",
     m(b=("いたす", "致す", "申す", "申し上げる", "参る", "まいる", "いただく", "頂く", "伺う", "うかがう", "拝見", "おる")),
     "Kenjōgo verbs that lower the speaker: いたす (do), 申す (say), 参る (go/come), いただく (receive/eat), 伺う (visit/ask), おる (be).",
     "Special verb in place of the ordinary one", ("田中と申します。", "My name is Tanaka."),
     "{base} is a humble verb, used for the speaker's own actions.")
rule("gozaimasu", "ございます", "Very polite 'to be / have'", "honorific", "N3",
     m(b="ござる"),
     "The very polite form of ある (and, in でございます, of です).", "ございます", ("こちらにございます。", "It's over here."),
     "An extra-polite 'is / have', typical of shop and service staff.")
rule("honorific_prefix", "お / ご (prefix)", "Polite prefix", "honorific", "N4",
     m(s=("お", "ご", "御"), p="接頭詞"),
     "Makes the following word polite or respectful (お茶, ご飯, ご家族).", "お + native word; ご + Sino-Japanese word", ("お名前は何ですか。", "What is your name?"),
     "Adds politeness to the word that follows.")
rule("san", "〜さん / 〜様 / 〜ちゃん / 〜君", "Name suffix", "honorific", "N5",
     m(s=("さん", "様", "さま", "ちゃん", "君", "くん", "先生"), p="名詞,接尾"),
     "Suffixes added to names: さん (neutral polite), 様 (very polite), ちゃん (affectionate), 君 (for boys / juniors).", "Name + さん", ("田中さん", "Mr./Ms. Tanaka"),
     "{text} is a name suffix showing politeness or closeness to {prev}.")

# --- numbers ------------------------------------------------------------------------

rule("counter", "Number + counter", "Counter word", "other", "N5",
     [m(p="名詞,数"), m(p="名詞,数", opt=True), m(p="名詞,数", opt=True), m(p=("名詞,接尾,助数詞",))],
     "Japanese counts things with counter words that depend on the kind of thing: 冊 (books), 枚 (flat things), 人 (people), 本 (long things).",
     "Number + counter", ("本を三冊買った。", "I bought three books."),
     "{text}: the counter shows what kind of thing is being counted.")


def potential_origin(tok):
    """For a potential verb like 話せる or 見れる, the verb it comes from."""
    from . import dictionary
    base = tok.base
    if not tok.itype.startswith("一段") or len(base) < 2 or not base.endswith("る"):
        return None
    if dictionary.lookup(base):
        return None                                  # a verb in its own right
    e_to_u = dict(zip("えけげせてねべめれ", "うくぐすつぬぶむる"))
    stem = base[:-2]
    last = base[-2]
    if last in e_to_u:
        origin = stem + e_to_u[last]
        if dictionary.lookup(origin):
            return origin
    return None

