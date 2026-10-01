"""JLPT N5 grammar points not already handled by the core rules in grammar.py."""

from functools import partial

from ..patterns import QUESTION_WORDS, g

E = partial(g, "N5")

E("n5_amari_nai", "あまり〜ない", "Not very, not much", "sentence_pattern",
  "あまり|あんまり … ない",
  "With a negative verb or adjective: 'not very …', 'not much'.",
  "あまり + negative form", ("この映画はあまり面白くない。", "This movie isn't very interesting."),
  gloss="not very / not much")
E("n5_zenzen_nai", "全然〜ない", "Not at all", "sentence_pattern",
  "全然|ぜんぜん … ない",
  "With a negative: 'not at all'. (Casually also used with positives to mean 'totally'.)",
  "全然 + negative form", ("全然分かりません。", "I don't understand at all."),
  gloss="not at all")
E("n5_mada_te_inai", "まだ〜ていない", "Not yet", "sentence_pattern",
  "まだ … {V-te} いない",
  "'Have not … yet'. Japanese uses 〜ていない here, not the past negative.",
  "まだ + Verb て-form + いない / いません", ("まだ宿題をしていません。", "I haven't done my homework yet."),
  gloss="not … yet", hides=("te_iru",))
E("n5_mou", "もう〜た", "Already", "sentence_pattern",
  "もう … {V-ta}",
  "With a past verb: 'already'. (With a negative it means 'no longer'; with a number, 'another'.)",
  "もう + Verb た-form", ("もう昼ご飯を食べました。", "I've already eaten lunch."),
  gloss="already")
E("n5_mashou_ka", "〜ましょうか", "Shall I / shall we", "sentence_pattern",
  "{V-masu} ましょう か",
  "Offers to do something ('shall I …?') or suggests doing it together ('shall we …?').",
  "Verb ます-stem + ましょうか", ("窓を開けましょうか。", "Shall I open the window?"),
  gloss="shall I / shall we", hides=("mashou", "ka_question"))
E("n5_ga_aru", "〜がある / 〜がいる", "There is / to have", "sentence_pattern",
  "{N} が ある~|いる~",
  "Existence: ある for things and plants, いる for people and animals. Also 'to have'.",
  "Noun + が + ある / いる", ("机の上に本があります。", "There is a book on the desk."),
  gloss="there is / have",
  here=lambda c: ("いる: something living (a person or animal) exists or is there."
                  if any(c["toks"][i].base == "いる" for i in c["core"])
                  else "ある: something non-living exists or is possessed."))
E("n5_ga_suki", "〜が好き / 嫌い / 上手 / 下手", "Like / dislike / be good at", "sentence_pattern",
  "{N} が 好き|嫌い|上手|下手|得意|苦手|大好き|大嫌い",
  "These are な-adjectives, so the thing liked or skilled at is marked with が, not を.",
  "Noun + が + 好き / 嫌い / 上手 / 下手", ("私は猫が好きです。", "I like cats."),
  gloss="likes / is good at (が marks the thing)")
E("n5_ga_dekiru", "〜ができる", "Can do, be able to", "sentence_pattern",
  "{N} が できる~",
  "'Can do' a skill or activity, or 'be completed / be made'.",
  "Noun + が + できる", ("私は日本語ができます。", "I can speak Japanese."),
  gloss="can do")
E("n5_no_hou_ga", "〜のほうが", "… is more (comparison)", "sentence_pattern",
  "{N-no} ほう|方 が",
  "Picks one side in a comparison: 'A is more …'. Often paired with より.",
  "Noun + のほうが + adjective", ("犬より猫のほうが好きです。", "I like cats more than dogs."),
  gloss="the … side is more")
E("n5_to_dochira", "〜と〜とどちらが", "Which is more …?", "sentence_pattern",
  "と … と どちら|どっち",
  "Asks which of two things is more …", "A と B と どちらが + adjective か",
  ("犬と猫とどちらが好きですか。", "Which do you like more, dogs or cats?"),
  gloss="which of the two", hides=("to_and",))
E("n5_ichiban", "一番", "The most", "other",
  "一番|いちばん",
  "Makes a superlative: 'the most …', 'number one'.", "一番 + adjective",
  ("日本で一番高い山は富士山です。", "The highest mountain in Japan is Mt. Fuji."),
  gloss="the most")
E("n5_goro", "〜ごろ", "Around (a time)", "other",
  "{NUM} ごろ|頃",
  "Approximate point in time: 'around, about'. For amounts use ぐらい.", "Time + ごろ",
  ("七時ごろ起きます。", "I get up around seven."), gloss="around (time)")
E("n5_tachi", "〜たち", "Plural (people)", "other",
  "{N} たち|達",
  "Makes a plural for people (and animals): 子供たち, 私たち.", "Noun + たち",
  ("子供たちが公園で遊んでいる。", "The children are playing in the park."), gloss="plural")
E("n5_zutsu", "〜ずつ", "Each, at a time", "other",
  "{NUM} ずつ",
  "Distributes an amount: 'each', 'at a time'.", "Number + counter + ずつ",
  ("一つずつ食べてください。", "Please eat them one at a time."), gloss="each / at a time")
E("n5_number_mo", "Number + も", "As many as", "particle",
  "{NUM} も",
  "After an amount, stresses that it is large: 'as many / as much as'.", "Number + counter + も",
  ("三時間も待った。", "I waited a whole three hours."), gloss="as much as (surprisingly many)")
E("n5_ka_or", "〜か〜", "Or", "particle",
  "{N} か {N}",
  "Between nouns: 'A or B'.", "Noun + か + Noun",
  ("コーヒーか紅茶を飲みます。", "I'll have coffee or tea."), gloss="or",
  check=lambda toks, core, full: core[0] > 0 and toks[core[0] - 1].base not in QUESTION_WORDS)
E("n5_q_ka", "Question word + か", "Some- (someone, something)", "particle",
  "{Q} か",
  "Question word + か makes an indefinite: 誰か (someone), 何か (something), どこか (somewhere).",
  "Question word + か", ("誰か来ました。", "Someone came."), gloss="some-",
  hides=("ka_question", "n5_koko", "n5_kore"))
E("n5_q_mo_nai", "Question word + も〜ない", "No- (nobody, nothing)", "sentence_pattern",
  "{Q} に|で|から|と|へ? も … ない",
  "Question word + も with a negative: 誰も…ない (nobody), 何も…ない (nothing), どこにも…ない (nowhere).",
  "Question word + も + negative", ("何も食べませんでした。", "I didn't eat anything."),
  gloss="no- (nothing / nobody)", hides=("mo", "n5_koko", "n5_kore", "ni_particle", "de_particle"))
E("n5_q_demo", "Question word + でも", "Any- (anything, anyone)", "particle",
  "{Q} でも",
  "Question word + でも means 'any … at all': 何でも (anything), いつでも (any time).",
  "Question word + でも", ("何でも食べます。", "I'll eat anything."), gloss="any-",
  hides=("demo_even", "de_particle", "mo", "n5_koko", "n5_kore"))
E("n5_wo_kudasai", "〜をください", "Please give me", "sentence_pattern",
  "{N} を ください",
  "Asking for a thing: 'please give me …'.", "Noun + をください",
  ("水をください。", "Water, please."), gloss="please give me")
E("n5_ni_suru", "〜にする", "Decide on, choose", "sentence_pattern",
  "{N} に する~",
  "Choosing: 'I'll have / I'll go with …'.", "Noun + にする",
  ("私はコーヒーにします。", "I'll have coffee."), gloss="decide on")
E("n5_kara_made", "〜から〜まで", "From … to …", "particle",
  "から … まで",
  "Range in time or space: 'from … until / to …'.", "Noun + から + Noun + まで",
  ("九時から五時まで働きます。", "I work from nine to five."), gloss="from … to …")
E("n5_mo_mo", "〜も〜も", "Both … and …", "particle",
  "も … も",
  "'Both A and B'; with a negative, 'neither A nor B'.", "Noun + も + Noun + も",
  ("兄も姉も医者です。", "Both my older brother and sister are doctors."), gloss="both … and …")
E("n5_doushite", "どうして / なぜ", "Why", "other",
  "どうして|なぜ|なんで",
  "Asks for a reason. Answers usually end in から or んです.", "どうして + question",
  ("どうして遅れたんですか。", "Why were you late?"), gloss="why")
E("n5_kono", "この / その / あの / どの", "This / that / which (+ noun)", "other",
  "この|その|あの|どの",
  "Demonstratives before a noun: この (near me), その (near you), あの (over there), どの (which).",
  "この / その / あの / どの + noun", ("この本は面白い。", "This book is interesting."),
  gloss="this / that (before a noun)")
E("n5_kore", "これ / それ / あれ / どれ", "This one / that one / which one", "other",
  "これ|それ|あれ|どれ",
  "Demonstrative pronouns: これ (near me), それ (near you), あれ (over there), どれ (which one).",
  "これ / それ / あれ / どれ", ("これは何ですか。", "What is this?"),
  gloss="this one / that one")
E("n5_koko", "ここ / そこ / あそこ / どこ", "Here / there / where", "other",
  "ここ|そこ|あそこ|どこ",
  "Place words: ここ (here), そこ (there, near you), あそこ (over there), どこ (where).",
  "ここ / そこ / あそこ / どこ", ("トイレはどこですか。", "Where is the toilet?"),
  gloss="here / there / where")
E("n5_adj_te", "〜くて / 〜で (adjectives)", "Adjective て-form: and", "conjugation",
  ["{A-ku} て", "{NA} で"],
  "Joins adjectives (or adjective clauses): 'and'. い-adjectives: い→くて; な-adjectives and nouns: で.",
  "い-adj: い → くて; な-adj / noun + で", ("この部屋は広くて明るい。", "This room is spacious and bright."),
  gloss="and (joining descriptions)")
E("n5_ni_iru", "〜にいる / 〜にある", "Be at (location)", "sentence_pattern",
  "{N} に いる~|ある~",
  "Where something is: に marks the location of existence.", "Place + に + いる / ある",
  ("母は台所にいます。", "My mother is in the kitchen."), gloss="is at (location)")

E("n5_to_iu_say", "〜と言う", "Say (quotation)", "sentence_pattern",
  "と 言う~|いう~|言っ|言い",
  "Reports speech: 'say (that) …'. The quote comes before と.", "Quote / plain form + と言う",
  ("彼は明日来ると言った。", "He said he'd come tomorrow."), gloss="say that",
  hides=("to_quote",),
  check=lambda toks, core, full: not (core[-1] + 1 < len(toks) and toks[core[-1] + 1].pos.startswith("名詞")))
