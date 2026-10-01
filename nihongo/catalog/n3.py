"""JLPT N3 grammar points."""

from functools import partial

from ..patterns import compound, g

E = partial(g, "N3")
P = "{PLAIN|NA-na|N-no}"           # what usually comes before a noun-like grammar word

E("n3_wake_da", "〜わけだ", "That's why; no wonder", "sentence_pattern",
  f"{P} わけ だ",
  "A natural conclusion from what is known: 'that's why …', 'no wonder …', 'so in other words …'.",
  "Plain form + わけだ", ("三年も住んでいたから、日本語が上手なわけだ。", "They lived here three years, so no wonder their Japanese is good."),
  gloss="no wonder / that's why", hides=("da",))
E("n3_wake_dewa_nai", "〜わけではない", "It's not that, not necessarily", "sentence_pattern",
  f"{P} わけ では|じゃ ない",
  "Partial denial: 'it's not (necessarily) that …'.", "Plain form + わけではない",
  ("肉が嫌いなわけではない。", "It's not that I dislike meat."), gloss="it's not that",
  hides=("dewa_nai",))
E("n3_wake_ga_nai", "〜わけがない", "There's no way", "sentence_pattern",
  f"{P} わけ が ない",
  "Strong denial: 'there's no way that …', 'it can't be that …'.", "Plain form + わけがない",
  ("こんな難しい問題が解けるわけがない。", "There's no way I can solve a problem this hard."),
  gloss="there's no way", hides=("ga_subject",))
E("n3_wake_ni_wa_ikanai", "〜わけにはいかない", "Can't (for moral or social reasons)", "sentence_pattern",
  "{V-dict|V-nai} わけ に は いかない",
  "Something can't be done because of duty, circumstances, or what others would think. After a ない-form: 'have to'.",
  "Verb dictionary form + わけにはいかない", ("明日は試験だから、休むわけにはいかない。", "I have an exam tomorrow, so I can't take the day off."),
  gloss="can't (in good conscience)", hides=("wa_topic", "ni_particle"))
E("n3_ni_chigainai", "〜に違いない", "Must be, no doubt", "sentence_pattern",
  "{PLAIN|N|NA} に 違いない|ちがいない",
  "The speaker's strong conviction: 'it must be …', 'I'm sure …'.", "Plain form / noun + に違いない",
  ("彼が犯人に違いない。", "He must be the culprit."), gloss="must be", hides=("ni_particle",))
E("n3_ni_kimatte_iru", "〜に決まっている", "Definitely, of course", "sentence_pattern",
  "に 決まって|きまって いる|る",
  "A confident, often subjective assertion: 'it's obviously …', 'it's bound to …'.", "Plain form / noun + に決まっている",
  ("そんなの嘘に決まっている。", "That's obviously a lie."), gloss="definitely", hides=("ni_particle", "te_iru"))
E("n3_ppoi", "〜っぽい", "-ish, -like", "auxiliary",
  "っぽい~",
  "'Seems like …', '-ish': a quality or tendency. Often casual.", "Noun / Verb ます-stem / adj stem + っぽい",
  ("彼は子供っぽい。", "He's childish."), gloss="-ish")
E("n3_gachi", "〜がち", "Tend to (bad tendency)", "auxiliary",
  "がち",
  "A tendency to do something, usually undesirable: 'prone to …'.", "Verb ます-stem / noun + がち",
  ("冬は風邪をひきがちだ。", "I tend to catch colds in winter."), gloss="tends to")
E("n3_gimi", "〜気味", "A touch of, slightly", "auxiliary",
  "気味|ぎみ",
  "A slight sign of something (usually unwelcome): 'a bit …', 'a touch of …'.", "Noun / Verb ます-stem + 気味",
  ("最近、少し疲れ気味です。", "Lately I've been feeling a bit tired."), gloss="a touch of")
E("n3_darake", "〜だらけ", "Full of, covered in", "auxiliary",
  "だらけ",
  "Full of something unpleasant: 'covered in …', 'riddled with …'.", "Noun + だらけ",
  ("部屋がごみだらけだ。", "The room is full of rubbish."), gloss="covered in / full of")
E("n3_sae", "〜さえ", "Even", "particle",
  "さえ",
  "'Even …': an extreme example. With ば: 'if only …'.", "Noun + さえ",
  ("先生さえ分からなかった。", "Even the teacher didn't know."), gloss="even")
E("n3_sae_ba", "〜さえ〜ば", "If only, as long as", "sentence_pattern",
  "さえ … ば",
  "The single condition that is enough: 'as long as …', 'if only …'.", "Noun + さえ + ば-form",
  ("お金さえあれば、何でもできる。", "As long as you have money, you can do anything."),
  gloss="as long as", hides=("n3_sae", "ba"))
E("n3_koso", "〜こそ", "Precisely, (it's) … that", "particle",
  "こそ",
  "Strong emphasis on the word before: 'this very …', 'precisely …'.", "Noun + こそ",
  ("今年こそ日本へ行きたい。", "This year for sure I want to go to Japan."), gloss="precisely (emphasis)")
E("n3_kara_koso", "〜からこそ", "Precisely because", "conjunction",
  "から こそ",
  "Stresses the reason: 'precisely because …'.", "Plain form + からこそ",
  ("好きだからこそ厳しく言うのです。", "It's precisely because I care that I'm strict."),
  gloss="precisely because", hides=("n3_koso", "kara_because", "kara_from"))
E("n3_bakari_ka", "〜ばかりか", "Not only … but also", "sentence_pattern",
  "ばかり か",
  "'Not only … but even …'; the second part is more surprising.", "Noun / plain form + ばかりか",
  ("彼は英語ばかりかフランス語も話せる。", "He speaks not only English but French too."),
  gloss="not only … but also", hides=("bakari", "ka_question"))
E("n3_bakari_de_naku", "〜ばかりでなく / だけでなく", "Not only … but also", "sentence_pattern",
  "ばかり|だけ で|じゃ なく|ない",
  "'Not just … (but also …)'.", "Noun / plain form + だけでなく / ばかりでなく",
  ("彼女は歌だけでなく、ダンスも上手だ。", "She's good not only at singing but dancing too."),
  gloss="not only", hides=("bakari", "dake", "de_particle", "dewa_nai"))
E("n3_dokoroka", "〜どころか", "Far from; let alone", "sentence_pattern",
  "どころか",
  "'Far from …' (the reality is the opposite), or 'let alone …'.", "Noun / plain form + どころか",
  ("休むどころか、もっと忙しくなった。", "Far from resting, I got even busier."), gloss="far from")
E("n3_kuse_ni", "〜くせに", "Even though (critical)", "conjunction",
  "くせ|癖 に",
  "'Even though …' with criticism or contempt for the person.", "Plain form / noun + の + くせに",
  ("知っているくせに教えてくれない。", "He knows, yet he won't tell me."), gloss="even though (critical)",
  hides=("ni_particle",))
E("n3_tsuide_ni", "〜ついでに", "While (doing), on the way", "sentence_pattern",
  "ついで に",
  "Doing something extra while doing the main thing: 'while you're at it'.", "Verb / noun + の + ついでに",
  ("買い物のついでに郵便局に寄った。", "While out shopping, I stopped by the post office."),
  gloss="while at it", hides=("ni_particle",))
E("n3_tabi_ni", "〜たびに", "Every time", "sentence_pattern",
  "たび|度 に",
  "'Every time …' (the same result follows).", "Verb dictionary form / noun + の + たびに",
  ("この歌を聞くたびに、昔を思い出す。", "Every time I hear this song, I remember the old days."),
  gloss="every time", hides=("ni_particle",))
E("n3_uchi_ni", "〜うちに", "While (still); before", "sentence_pattern",
  f"{P} うち に",
  "Do something while a state lasts (before it changes): 'while still …'. With ない: 'before …'.",
  "Plain form / noun + の + うちに", ("若いうちに旅行したほうがいい。", "You should travel while you're young."),
  gloss="while still", hides=("ni_particle",))
E("n3_saichuu", "〜最中に", "In the middle of", "sentence_pattern",
  "最中 に|だ",
  "Something happens right in the middle of an action.", "Verb ている / noun + の + 最中に",
  ("会議の最中に電話が鳴った。", "The phone rang in the middle of the meeting."),
  gloss="in the middle of", hides=("ni_particle",))
E("n3_totan", "〜たとたん", "As soon as, the moment", "sentence_pattern",
  "{V-ta} とたん|途端 に?",
  "Something unexpected happens the moment something else does.", "Verb た-form + とたん(に)",
  ("家を出たとたん、雨が降り出した。", "The moment I left the house, it started raining."),
  gloss="the moment that", hides=("ta_past",))
E("n3_te_irai", "〜て以来", "Ever since", "sentence_pattern",
  "{V-te} 以来",
  "A state that has continued since a past event: 'ever since …'.", "Verb て-form + 以来",
  ("日本に来て以来、ずっと東京に住んでいる。", "I've lived in Tokyo ever since I came to Japan."),
  gloss="ever since")
E("n3_ni_taishite", "〜に対して", "Toward; in contrast to", "particle",
  "に対して|に対し|に対する|にたいして",
  "Directed at someone or something ('toward', 'against'), or a contrast ('whereas').",
  "Noun + に対して", ("先生に対して失礼なことを言った。", "I said something rude to the teacher."),
  gloss="toward / against")
E("n3_ni_tsuite", "〜について", "About, concerning", "particle",
  "について|についての|につき",
  "The topic of talking, thinking, or researching: 'about …'.", "Noun + について",
  ("日本の文化について調べています。", "I'm researching Japanese culture."), gloss="about")
E("n3_ni_yotte", "〜によって", "By; depending on; due to", "particle",
  "によって|による|により|によっては",
  "The agent of a passive ('by'), what something varies with ('depending on'), a means, or a cause.",
  "Noun + によって", ("この絵はピカソによって描かれた。", "This painting was painted by Picasso."),
  gloss="by / depending on")
E("n3_ni_yoru_to", "〜によると", "According to", "particle",
  "によると|によれば",
  "Source of information: 'according to …'. Usually ends in そうだ or らしい.", "Noun + によると",
  ("天気予報によると、明日は雨だそうです。", "According to the forecast, it'll rain tomorrow."),
  gloss="according to", hides=("to_conditional", "ni_particle", "n3_ni_yotte"))
E("n3_to_shite", "〜として", "As (in the role of)", "particle",
  "として|としての|としては|としても",
  "A role, status, or capacity: 'as …'.", "Noun + として", ("留学生として日本に来ました。", "I came to Japan as an exchange student."),
  gloss="as (a role)")
E("n3_ni_totte", "〜にとって", "For, to (someone)", "particle",
  "にとって|にとっての|にとっては",
  "From someone's point of view: 'for …', 'to …'.", "Noun + にとって",
  ("私にとって家族が一番大切です。", "To me, family is the most important thing."), gloss="for / to (someone)")
E("n3_ni_kanshite", "〜に関して", "Regarding", "particle",
  "に関して|に関する|に関しては|にかんして",
  "A more formal 'about, regarding'.", "Noun + に関して",
  ("この問題に関して質問があります。", "I have a question regarding this issue."), gloss="regarding")
E("n3_wo_hajime", "〜をはじめ", "Starting with, including", "particle",
  "をはじめ|を始め|をはじめとして|を始めとして",
  "Gives the main example of a group: 'starting with …', '… and others'.", "Noun + をはじめ",
  ("東京をはじめ、大阪や京都にも行った。", "I went to Tokyo, and also Osaka and Kyoto."), gloss="starting with")
E("n3_wo_tooshite", "〜を通して", "Through, via", "particle",
  "を通して|を通じて|をとおして|をつうじて",
  "Means or medium ('through …'), or a whole period ('throughout …').", "Noun + を通して",
  ("友達を通して彼女と知り合った。", "I met her through a friend."), gloss="through")
E("n3_ni_kurabete", "〜に比べて", "Compared to", "particle",
  "に比べて|に比べ|と比べて|にくらべて",
  "Comparison: 'compared with …'.", "Noun + に比べて",
  ("去年に比べて今年は暑い。", "This year is hotter compared to last year."), gloss="compared to")
E("n3_ni_kuwaete", "〜に加えて", "In addition to", "particle",
  "に加えて|に加え|にくわえて",
  "Adds something: 'in addition to …'.", "Noun + に加えて",
  ("雨に加えて風も強くなった。", "On top of the rain, the wind got stronger too."), gloss="in addition to")
E("n3_ni_kawatte", "〜に代わって", "In place of, on behalf of", "particle",
  "に代わって|に代わり|にかわって|に代わる",
  "Replacement or representation: 'instead of …', 'on behalf of …'.", "Noun + に代わって",
  ("社長に代わって私がご挨拶します。", "I'll give the greeting on behalf of the president."), gloss="on behalf of")
E("n3_kawari_ni", "〜代わりに", "Instead of; in exchange for", "sentence_pattern",
  f"{P} 代わり|かわり に",
  "'Instead of …', or 'in exchange / to make up for …'.", "Plain form / noun + の + 代わりに",
  ("映画に行く代わりに、家で本を読んだ。", "Instead of going to the movies, I read at home."),
  gloss="instead of", hides=("ni_particle",))
E("n3_toori", "〜とおり", "As, in the way that", "sentence_pattern",
  ["{V-ta|V-dict} とおり|通り に?", "{N} どおり|通り に?", "{N-no} とおり に?", "{N-no} 通り に"],
  "Doing something exactly as said, planned, or shown: 'just as …'.", "Verb / noun + の + とおり; noun + どおり",
  ("先生が言ったとおりにやってみた。", "I tried doing it just as the teacher said."), gloss="just as",
  hides=("ni_particle",))
E("n3_koto_wa_nai", "〜ことはない", "There's no need to", "sentence_pattern",
  "{V-dict} こと は ない",
  "'There's no need to …', 'you don't have to …'.", "Verb dictionary form + ことはない",
  ("心配することはないよ。", "There's no need to worry."), gloss="no need to",
  hides=("wa_topic", "koto_nominal"))
E("n3_koto_ni_natte_iru", "〜ことになっている", "Is supposed to (by rule)", "sentence_pattern",
  "{V-dict|V-nai} こと に なって いる~",
  "A rule, custom, or arrangement: 'it's been arranged that …', 'you're supposed to …'.",
  "Verb dictionary / ない-form + ことになっている", ("会社ではスーツを着ることになっている。", "We're supposed to wear suits at the office."),
  gloss="is supposed to (by rule)", hides=("n4_koto_ni_naru", "te_iru", "koto_nominal", "ni_particle"))
E("n3_mono_da", "〜ものだ", "Should (naturally); used to", "sentence_pattern",
  "{PLAIN|NA-na} もの|もん だ",
  "A general truth or what one naturally should do; after a past verb, nostalgia: 'used to …'.",
  "Plain form + ものだ", ("子供の頃はよくこの公園で遊んだものだ。", "I used to play in this park a lot as a kid."),
  gloss="used to / naturally should", hides=("da",))
E("n3_wari_ni", "〜わりに", "Considering, for", "conjunction",
  f"{P} わり|割 に",
  "Contrary to what you'd expect from …: 'considering …', 'for …'.", "Plain form / noun + の + わりに",
  ("このレストランは安いわりにおいしい。", "This restaurant is tasty, considering how cheap it is."),
  gloss="considering", hides=("ni_particle",))
E("n3_to_shitara", "〜としたら / とすれば", "Supposing that", "conjunction",
  "としたら|とすれば|とすると",
  "A hypothetical assumption: 'if we suppose that …'.", "Plain form + としたら",
  ("宝くじが当たったとしたら、何をしますか。", "Supposing you won the lottery, what would you do?"),
  gloss="supposing that", hides=("tara", "to_quote", "ba"))
E("n3_tatoe_temo", "たとえ〜ても", "Even if", "sentence_pattern",
  "たとえ … ても|でも",
  "'Even if …' (a strong hypothetical). たとえ marks the start.", "たとえ + て-form + も",
  ("たとえ雨が降っても、行きます。", "Even if it rains, I'll go."), gloss="even if", hides=("te_mo",))
E("n3_te_tamaranai", "〜てたまらない", "Unbearably, really want", "sentence_pattern",
  "{V-te|A-te} たまらない|たまりません",
  "A feeling so strong it is hard to bear: 'dying to …', 'terribly …'.", "Adjective / verb て-form + たまらない",
  ("暑くてたまらない。", "It's unbearably hot."), gloss="unbearably", hides=("n5_adj_te",))
E("n3_te_naranai", "〜てならない", "Can't help feeling", "sentence_pattern",
  "{V-te|A-te} ならない|なりません",
  "A feeling that wells up on its own: 'can't help but feel …'.", "Verb / adjective て-form + ならない",
  ("彼のことが気になってならない。", "I can't stop worrying about him."), gloss="can't help feeling")
E("n3_te_shouganai", "〜てしょうがない", "Extremely, can't help it", "sentence_pattern",
  "{V-te|A-te} しょうがない|しようがない|仕方がない|しかたがない|しょうがありません",
  "Casual way to say a feeling is overwhelming: 'so … I can't stand it'.", "Adjective / verb て-form + しょうがない",
  ("眠くてしょうがない。", "I'm so sleepy I can't stand it."), gloss="extremely", hides=("n5_adj_te",))
E("n3_zu_ni_wa_irarenai", "〜ずにはいられない", "Can't help doing", "sentence_pattern",
  "ずにはいられない",
  "An urge you can't resist: 'can't help but …'.", "Verb ない-stem + ずにはいられない",
  ("笑わずにはいられなかった。", "I couldn't help laughing."), gloss="can't help doing",
  hides=("wa_topic", "ni_particle", "passive", "n4_zu_ni"))
E("n3_nante", "〜なんて", "Such a thing as (surprise)", "particle",
  "なんて",
  "Shows surprise, disbelief, or contempt: 'to think that …', 'something like …'.", "Noun / plain form + なんて",
  ("彼が結婚するなんて信じられない。", "I can't believe he's getting married!"), gloss="to think that (surprise)")
E("n3_nanka", "〜なんか", "Things like (dismissive)", "particle",
  "なんか",
  "'Something like …', often humble or dismissive.", "Noun + なんか",
  ("私なんかにはできません。", "Someone like me couldn't do it."), gloss="something like")
E("n3_kke", "〜っけ", "Was it …? (recalling)", "particle",
  "っけ",
  "Trying to remember or checking: 'what was it again?'.", "Plain past / だ + っけ",
  ("会議は何時だっけ。", "What time was the meeting again?"), gloss="was it …? (recalling)")
E("n3_shika_nai", "〜しかない", "Have no choice but to", "sentence_pattern",
  "{V-dict} しか ない",
  "Only one option remains: 'have no choice but to …'.", "Verb dictionary form + しかない",
  ("終電がないので、歩いて帰るしかない。", "There are no more trains, so I have no choice but to walk."),
  gloss="no choice but to", hides=("shika",))
E("n3_tokoro_ni", "〜ところに / ところへ", "Just when", "sentence_pattern",
  "ところ に|へ",
  "Something happens (or someone arrives) just at that moment.", "Verb form + ところに",
  ("出かけようとしたところに電話がかかってきた。", "Just as I was about to go out, the phone rang."),
  gloss="just when", hides=("tokoro", "ni_particle", "he_particle"))
E("n3_kiru", "〜切る", "Do completely", "auxiliary",
  ["{V-masu} 切る~|きる~|切れる~|きれる~", "切る~|切れる~"],
  "Doing something to the very end: 'finish …ing', 'completely'. 〜きれない: can't … all.",
  "Verb ます-stem + 切る", ("一日で本を読み切った。", "I read the whole book in a day."), gloss="completely",
  check=lambda toks, core, full: len(full) > len(core)
  or compound(("切る", "切れる"), exclude=("締め切る", "張り切る", "思い切る", "裏切る", "区切る", "仕切る", "横切る", "踏み切る"))(toks, core, full))
E("n3_kakeru", "〜かける", "Half-done, about to", "auxiliary",
  "{V-masu} かける~|かけ",
  "An action started but not finished, or about to happen: 'half-…', 'start to'.", "Verb ます-stem + かける",
  ("彼は何か言いかけて、やめた。", "He started to say something, then stopped."), gloss="half-done / start to")
E("n3_au", "〜合う", "Each other", "auxiliary",
  ["{V-masu} 合う~|あう~", "合う~"],
  "Mutual action: 'each other', 'together'.", "Verb ます-stem + 合う",
  ("二人は助け合って生きてきた。", "The two of them have lived helping each other."), gloss="each other",
  check=lambda toks, core, full: len(full) > len(core)
  or compound(("合う",), exclude=("似合う", "間に合う", "見合う", "釣り合う", "付き合う", "落ち合う", "向き合う", "立ち合う", "振り合う"))(toks, core, full))
E("n3_naosu", "〜直す", "Redo, do again", "auxiliary",
  ["{V-masu} 直す~|なおす~", "直す~"],
  "Doing something again to fix or improve it.", "Verb ます-stem + 直す",
  ("もう一度書き直してください。", "Please rewrite it once more."), gloss="redo",
  check=lambda toks, core, full: len(full) > len(core) or compound(("直す",), exclude=("見直す", "立て直す", "持ち直す", "取り直す"))(toks, core, full))
E("n3_ni_shitagatte", "〜にしたがって", "As; in accordance with", "conjunction",
  "に従って|に従い|にしたがって|にしたがい",
  "One change follows another ('as …'), or following rules or instructions.", "Verb dictionary form / noun + にしたがって",
  ("年をとるに従って、体が弱くなる。", "As you age, your body grows weaker."), gloss="as / in line with")
E("n3_ni_tsurete", "〜につれて", "As (gradually)", "conjunction",
  "につれて|につれ",
  "As one thing changes, another changes along with it.", "Verb dictionary form / noun + につれて",
  ("時間がたつにつれて、痛みが消えた。", "As time passed, the pain went away."), gloss="as (gradually)")
E("n3_to_tomo_ni", "〜とともに", "Together with; as", "conjunction",
  "とともに|と共に",
  "'Together with …', or 'at the same time as / as …'.", "Noun / Verb dictionary form + とともに",
  ("家族とともに暮らす。", "I live together with my family."), gloss="together with", hides=("to_and",))
E("n3_ba_ii_noni", "〜ばいいのに", "I wish, it would be nice if", "sentence_pattern",
  "{V-ba|A-ba} いい|よかった のに",
  "A wish (often a complaint): 'it would be nice if …', 'if only …'.", "Verb ば-form + いいのに",
  ("もっと早く言えばよかったのに。", "You should have said so sooner."), gloss="if only",
  hides=("ba", "noni", "n4_ba_ii", "n4_ba_yokatta"))
E("n3_you_ni_as", "〜ように (as)", "As, like", "sentence_pattern",
  "{V-ta|V-dict|N-no} ように 、",
  "'As …' referring to something said or known (as I said, as you know).", "Verb / noun + の + ように",
  ("前にも言ったように、明日は休みです。", "As I said before, tomorrow is a day off."), gloss="as",
  hides=("you_ni",))
E("n3_te_kara_de_nai_to", "〜てからでないと", "Not until (after) …", "sentence_pattern",
  "{V-te} から で ない と",
  "'Unless you first …', 'not until …'.", "Verb て-form + からでないと",
  ("宿題をしてからでないと、遊んではいけません。", "You can't play until you've done your homework."),
  gloss="not until", hides=("te_kara", "dewa_nai", "to_conditional"))
