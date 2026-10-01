"""JLPT N4 grammar points not already handled by the core rules in grammar.py."""

from functools import partial

from ..patterns import compound, g

E = partial(g, "N4")

E("n4_koto_ni_suru", "〜ことにする", "Decide to", "sentence_pattern",
  "{V-dict|V-nai} こと に する~",
  "The speaker's own decision: 'decide to …'. ことにしている means a habit one has decided on.",
  "Verb dictionary / ない-form + ことにする", ("毎日走ることにしました。", "I decided to run every day."),
  gloss="decide to", hides=("n5_ni_suru", "koto_nominal", "ni_particle"))
E("n4_koto_ni_naru", "〜ことになる", "It has been decided that", "sentence_pattern",
  "{V-dict|V-nai} こと に なる~",
  "A decision made by others or by circumstances: 'it's been decided that …', 'it turns out that …'.",
  "Verb dictionary / ない-form + ことになる", ("来月、大阪に転勤することになりました。", "It's been decided that I'll transfer to Osaka next month."),
  gloss="it has been decided that", hides=("koto_nominal", "ni_particle", "ku_naru"))
E("n4_koto_ga_aru", "〜ことがある (dictionary form)", "Sometimes, there are times when", "sentence_pattern",
  "{V-dict|V-nai} こと が|も ある~",
  "After a dictionary or ない-form: 'there are times when …', 'sometimes'. (After た-form it means 'have done'.)",
  "Verb dictionary / ない-form + ことがある", ("時々朝ご飯を食べないことがあります。", "Sometimes I don't eat breakfast."),
  gloss="sometimes", hides=("koto_nominal", "ga_subject", "n5_ga_aru"))
E("n4_ba_yokatta", "〜ばよかった", "Should have, I wish I had", "sentence_pattern",
  "{V-ba|A-ba} よかった",
  "Regret: 'I should have …', 'if only I had …'.", "Verb ば-form + よかった",
  ("もっと勉強すればよかった。", "I should have studied more."), gloss="should have", hides=("ba",))
E("n4_ba_ii", "〜ばいい", "Should, just have to", "sentence_pattern",
  "{V-ba} いい|よい",
  "Advice or asking for it: 'you just have to …', 'what should I …?'.", "Verb ば-form + いい",
  ("どうすればいいですか。", "What should I do?"), gloss="should / just have to", hides=("ba",))
E("n4_tara_ii", "〜たらいい", "Should; it would be good if", "sentence_pattern",
  "たら|だら いい|よい",
  "Advice ('you should …'), asking for advice, or a hope ('it would be nice if …').",
  "Verb た-form + らいい", ("先生に聞いたらいいですよ。", "You should ask the teacher."),
  gloss="should / it would be good if", hides=("tara",))
E("n4_tara_dou", "〜たらどうですか", "Why don't you …?", "sentence_pattern",
  "たら|だら どう",
  "A suggestion: 'why don't you …?', 'how about …?'.", "Verb た-form + らどうですか",
  ("少し休んだらどうですか。", "Why don't you rest a little?"), gloss="why don't you", hides=("tara",))
E("n4_to_ii", "〜といい", "I hope; it would be good to", "sentence_pattern",
  "{V-dict|V-nai|A-dict} と いい|よい",
  "A hope ('I hope …') or advice ('it's good to …').", "Verb dictionary form + といい",
  ("明日晴れるといいですね。", "I hope it's sunny tomorrow."), gloss="I hope / it's good to",
  hides=("to_conditional",))
E("n4_ta_bakari", "〜たばかり", "Just did", "sentence_pattern",
  "{V-ta} ばかり",
  "Something happened only a short time ago (in the speaker's feeling): 'just did'.",
  "Verb た-form + ばかり", ("今来たばかりです。", "I just got here."), gloss="just did",
  hides=("bakari", "ta_past"))
E("n4_you_to_suru", "〜ようとする", "Try to; be about to", "sentence_pattern",
  "{V-vol} と する~",
  "An attempt ('try to …') or something on the verge of happening ('be about to …').",
  "Verb volitional + とする", ("寝ようとしたとき、電話が鳴った。", "Just as I was about to sleep, the phone rang."),
  gloss="try to / be about to", hides=("volitional", "to_quote"))
E("n4_okage_de", "〜おかげで", "Thanks to", "conjunction",
  "{N-no|PLAIN} おかげ で|だ",
  "A good result and its cause: 'thanks to …'.", "Noun + のおかげで; plain form + おかげで",
  ("先生のおかげで合格しました。", "Thanks to my teacher, I passed."), gloss="thanks to",
  hides=("de_particle",))
E("n4_sei_de", "〜せいで", "Because of (blame)", "conjunction",
  "{N-no|PLAIN} せい で|だ",
  "A bad result and the thing blamed for it: 'because of …', 'it's …'s fault'.",
  "Noun + のせいで; plain form + せいで", ("雨のせいで試合が中止になった。", "The game was cancelled because of the rain."),
  gloss="because of (blame)", hides=("de_particle",))
E("n4_hazu_ga_nai", "〜はずがない", "Can't possibly be", "sentence_pattern",
  "{PLAIN|N-no} はず が ない",
  "Strong disbelief based on reasoning: 'there's no way that …'.", "Plain form + はずがない",
  ("彼がそんなことを言うはずがない。", "There's no way he'd say something like that."),
  gloss="can't possibly", hides=("hazu", "ga_subject"))
E("n4_zu_ni", "〜ずに", "Without doing", "conjugation",
  "{V-neg} ずに",
  "'Without …ing'. A slightly more written version of 〜ないで. する becomes せずに.",
  "Verb ない-stem + ずに", ("朝ご飯を食べずに学校へ行った。", "I went to school without eating breakfast."),
  gloss="without doing", hides=("ni_particle",))
E("n4_naide", "〜ないで (without)", "Without doing; instead of", "conjugation",
  "{V-neg} ないで",
  "'Without …ing', or 'instead of …ing'.", "Verb ない-form + で",
  ("傘を持たないで出かけた。", "I went out without an umbrella."), gloss="without doing",
  hides=("te_form", "de_particle"))
E("n4_mama", "〜まま", "As it is, unchanged", "sentence_pattern",
  "{V-ta|N-no|A-dict|V-nai|NA-na} まま",
  "A state stays unchanged while something else happens: 'with … still …'.",
  "Verb た-form / noun + の + まま", ("電気をつけたまま寝てしまった。", "I fell asleep with the light on."),
  gloss="still in that state")
E("n4_ba_hodo", "〜ば〜ほど", "The more …, the more …", "sentence_pattern",
  "{V-ba|A-ba} … ほど",
  "Proportion: 'the more …, the more …'. The same verb is usually repeated.", "Verb ば-form + Verb dictionary form + ほど",
  ("練習すればするほど上手になる。", "The more you practise, the better you get."),
  gloss="the more … the more", hides=("ba",))
E("n4_hodo_nai", "〜ほど〜ない", "Not as … as", "sentence_pattern",
  "{N} ほど … ない",
  "Negative comparison: 'not as … as N'.", "Noun + ほど + negative",
  ("今年は去年ほど寒くない。", "This year isn't as cold as last year."), gloss="not as … as")
E("n4_q_temo", "Question word + 〜ても", "No matter (what / how / who)", "sentence_pattern",
  "{Q} … ても|でも",
  "Question word + て-form + も: 'no matter what / how / who …'.", "Question word + Verb て-form + も",
  ("何度電話しても出ない。", "No matter how many times I call, they don't answer."),
  gloss="no matter …", hides=("te_mo",))
E("n4_no_wa", "〜のは〜だ", "The one that … is", "nominalizer",
  "{PLAIN|NA-na} の は",
  "Turns a clause into the topic to focus on what comes after: 'the thing that … is …'.",
  "Plain form + のは + noun + だ", ("日本語を話すのは難しいです。", "Speaking Japanese is difficult."),
  gloss="the act / thing of … (as the topic)", hides=("no_nominal", "wa_topic"))
E("n4_no_ga_suki", "〜のが好き / 上手", "Like doing / be good at doing", "nominalizer",
  "{V-dict} の が 好き|嫌い|上手|下手|得意|苦手|大好き",
  "の turns the verb into a noun so it can be liked, disliked, or be good at.",
  "Verb dictionary form + のが好き", ("音楽を聞くのが好きです。", "I like listening to music."),
  gloss="likes doing", hides=("no_nominal", "ga_subject", "n5_ga_suki"))
E("n4_kashira", "〜かしら", "I wonder", "particle",
  "かしら",
  "'I wonder …'. Soft and traditionally feminine; かな is the neutral equivalent.", "Plain form + かしら",
  ("明日は雨かしら。", "I wonder if it'll rain tomorrow."), gloss="I wonder")
E("n4_sasete_kudasai", "〜させてください", "Please let me", "sentence_pattern",
  "せて|させて ください",
  "Asking permission politely: 'please let me …'.", "Verb causative て-form + ください",
  ("少し考えさせてください。", "Please let me think about it a little."),
  gloss="please let me", hides=("te_kudasai", "causative"))
E("n4_sasete_itadaku", "〜させていただく", "Humbly do (with your permission)", "honorific",
  "せて|させて いただく~",
  "Very polite humble form of doing something: 'allow me to …'.", "Verb causative て-form + いただく",
  ("今日は早めに帰らせていただきます。", "If you'll allow me, I'll leave early today."),
  gloss="allow me to", hides=("te_morau", "causative"))
E("n4_te_moraemasen_ka", "〜てもらえませんか", "Could you please …?", "sentence_pattern",
  "{V-te} もらえ|いただけ ない か",
  "A polite request, literally 'can't I receive the favor of you …?'. いただけませんか is more polite.",
  "Verb て-form + もらえませんか / いただけませんか", ("ちょっと手伝ってもらえませんか。", "Could you help me a little?"),
  gloss="could you please", hides=("te_morau", "masen_ka", "ka_question", "potential"))
E("n4_te_kuremasen_ka", "〜てくれませんか", "Would you …?", "sentence_pattern",
  "{V-te} くれ ない か",
  "A request: 'would you (do this for me)?'. Less formal than 〜てもらえませんか.",
  "Verb て-form + くれませんか", ("窓を開けてくれませんか。", "Would you open the window?"),
  gloss="would you", hides=("te_kureru", "masen_ka", "ka_question"))
E("n4_ja_nai_ka", "〜じゃないか", "…, isn't it! / didn't I say", "sentence_pattern",
  ["じゃない|ではない か", "じゃん"],
  "Asserting or reminding, not a real negative: 'see, …!', 'isn't it …!'.",
  "Plain form + じゃないか", ("だから言ったじゃないか。", "See, I told you so!"),
  gloss="… isn't it! (assertion)", hides=("dewa_nai", "ka_question"))
E("n4_to_kiku", "〜と聞く", "I heard that", "sentence_pattern",
  "と 聞く~|聞いて",
  "Reports something heard: 'I heard that …'.", "Plain form + と聞く",
  ("明日は休みだと聞きました。", "I heard tomorrow is a day off."), gloss="I heard that",
  hides=("to_quote",))
E("n4_made_ni", "〜までに", "By (a deadline)", "particle",
  "{N|V-dict} までに",
  "A deadline: 'by …'. Compare まで, 'until'.", "Noun / Verb dictionary form + までに",
  ("五時までに帰ってください。", "Please be back by five."), gloss="by (deadline)",
  hides=("made", "ni_particle"))
E("n4_aida", "〜間 / 〜間に", "While, during", "sentence_pattern",
  "{PLAIN|N-no} 間|あいだ",
  "間 alone: throughout the whole time. 間に: at some point within that time.",
  "Plain form / Noun + の + 間(に)", ("夏休みの間、ずっと国にいました。", "I was back home the whole summer vacation."),
  gloss="while / during")
E("n4_ga_suru", "〜がする", "(I) smell / hear / feel …", "sentence_pattern",
  "{N} が する~",
  "Sensations: 匂い (smell), 音 (sound), 味 (taste), 気 (feeling) + がする.",
  "Noun (sensation) + がする", ("いい匂いがする。", "Something smells good."),
  gloss="there is a (smell / sound / feeling)", hides=("ga_subject",))
E("n4_ku_suru", "〜くする / 〜にする", "Make (something) …", "sentence_pattern",
  ["{A-ku} する~", "{NA} に する~"],
  "Changing something on purpose: 'make it …'. Compare 〜くなる, 'become'.",
  "い-adj: い → く + する; な-adj + に + する", ("音を小さくしてください。", "Please turn the sound down."),
  gloss="make it …", hides=("adverb_ku", "n5_ni_suru", "ni_particle", "adverbial_ni"))
E("n4_you_ni_iu", "〜ように言う", "Tell (someone) to", "sentence_pattern",
  "ように 言う~|頼む~|伝える~|注意する~|いう~",
  "Indirect requests or orders: 'tell / ask someone to …'.", "Verb dictionary / ない-form + ように言う",
  ("医者にお酒を飲まないように言われました。", "The doctor told me not to drink."),
  gloss="tell (someone) to", hides=("you_ni",))
E("n4_noni_purpose", "〜のに (purpose)", "For, in order to", "sentence_pattern",
  "{V-dict} のに 使う~|便利|必要|いい|かかる~|役に立つ~",
  "Purpose, with words like 使う, 便利, 必要, かかる: 'for …ing', 'to …'.",
  "Verb dictionary form + のに", ("このはさみは紙を切るのに使います。", "These scissors are for cutting paper."),
  gloss="for / in order to", hides=("noni",))
E("n4_naito_ikenai", "〜ないといけない", "Must, have to", "sentence_pattern",
  "{V-neg|A-ku} ないと いけない|だめ|ダメ",
  "Obligation, a bit more conversational than 〜なければならない.",
  "Verb ない-form + といけない", ("もう帰らないといけない。", "I have to go home now."),
  gloss="must / have to", hides=("to_conditional",))
E("n4_garu", "〜がる", "Seems to feel (others' feelings)", "auxiliary",
  ["{A-stem|NA} がる~", "がる~|がり"],
  "Describes someone else's feelings from how they act: 寒がる, 欲しがる, 怖がる.",
  "い-adj stem / な-adj + がる", ("弟は犬を怖がる。", "My little brother is scared of dogs."),
  gloss="shows signs of feeling",
  check=lambda toks, core, full: (len(full) > len(core) or compound(("がる",), exclude=(
      "上がる", "下がる", "広がる", "曲がる", "繋がる", "つながる", "転がる", "群がる", "あがる", "さがる",
      "ひろがる", "まがる", "ころがる", "立ち上がる", "盛り上がる", "出来上がる", "できあがる", "跳ね上がる",
      "燃え上がる", "起き上がる", "持ち上がる", "仕上がる", "引き下がる", "宛がう"))(toks, core, full)))
E("n4_tagaru", "〜たがる", "Wants to (someone else)", "auxiliary",
  "{V-masu} たがる~",
  "Someone else's desire, judged from how they act. たい is for the speaker's own wishes.",
  "Verb ます-stem + たがる", ("子供は外で遊びたがる。", "Kids want to play outside."),
  gloss="(someone else) wants to", hides=("tai",))
E("n4_tsumori_datta", "〜つもりだった", "Meant to, thought I had", "sentence_pattern",
  "{PLAIN} つもり だった",
  "'I meant to …' (but didn't), or 'I thought I had …'.", "Plain form + つもりだった",
  ("電話するつもりだったが、忘れた。", "I meant to call, but I forgot."),
  gloss="meant to", hides=("tsumori", "datta"))
E("n4_n_janai", "〜んじゃない", "Isn't it that …? / Don't …!", "sentence_pattern",
  "ん じゃない|ではない",
  "A soft guess ('isn't it the case that …?'); after a plain verb it can also be a firm prohibition.",
  "Plain form + んじゃない", ("彼はもう帰ったんじゃない？", "Hasn't he gone home already?"),
  gloss="I think … (soft guess)", hides=("dewa_nai", "no_da"))

E("n4_compound_aspect", "〜出す / 〜始める / 〜終わる / 〜続ける", "Start / finish / keep doing", "auxiliary",
  "出す~|始める~|終わる~|続ける~|はじめる~|おわる~|つづける~|出し|始め|終わり|続け",
  "Compound verbs (written as one word) marking the start, end, or continuation of an action. 〜出す is a sudden start.",
  "Verb ます-stem + 出す / 始める / 終わる / 続ける", ("雨が降り出した。", "It started raining."),
  gloss="start / finish / keep doing",
  check=compound(("出す", "始める", "終わる", "続ける", "はじめる", "おわる", "つづける"),
                 exclude=("思い出す", "引き出す", "取り出す", "呼び出す", "追い出す", "貸し出す", "見出す",
                          "差し出す", "飛び出す", "抜け出す", "逃げ出す", "持ち出す", "乗り出す", "送り出す",
                          "作り出す", "生み出す", "打ち出す", "売り出す", "押し出す", "救い出す", "見つけ出す",
                          "割り出す", "連れ出す", "掘り出す", "流れ出す", "溢れ出す", "あふれ出す", "抜き出す",
                          "書き出す", "締め出す", "はみ出す", "考え出す", "探し出す", "出し", "取り出し")))
E("n4_kata", "〜方", "Way of doing", "nominalizer",
  ["{V-masu} 方", "方"],
  "'How to …', 'the way of …': a verb ます-stem + 方 makes a noun.", "Verb ます-stem + 方",
  ("漢字の読み方を教えてください。", "Please teach me how to read the kanji."), gloss="the way of doing",
  # 方 alone is also "direction / person"; as one word, only after a kana verb stem (読み方, not 夕方)
  check=lambda toks, core, full: len(full) > len(core) or (
      len(toks[core[0]].surface) >= 3 and toks[core[0]].surface.endswith("方")
      and "\u3040" <= toks[core[0]].surface[-2] <= "\u309f"))
E("n4_demo_suggest", "〜でも (suggestion)", "… or something", "particle",
  "{N} で も … ませんか|ましょう|どう|たらいい",
  "Softens a suggestion: 'how about some tea or something?'.", "Noun + でも + suggestion",
  ("お茶でも飲みませんか。", "Shall we have some tea or something?"), gloss="… or something",
  hides=("de_particle", "mo", "demo_even"))
