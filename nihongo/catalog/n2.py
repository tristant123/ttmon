"""JLPT N2 grammar points."""

from functools import partial

from ..patterns import g

E = partial(g, "N2")
P = "{PLAIN|NA-na|N-no}"

E("n2_nimo_kakawarazu", "〜にもかかわらず", "Despite, in spite of", "conjunction",
  "にもかかわらず|にも関わらず|にも拘らず|にもかかわらない",
  "'Despite …': the result goes against what you'd expect. Formal.", "Plain form / noun + にもかかわらず",
  ("雨にもかかわらず、たくさんの人が集まった。", "Despite the rain, lots of people gathered."),
  gloss="despite", hides=("ni_particle", "mo"))
E("n2_zaru_wo_enai", "〜ざるを得ない", "Have no choice but to", "sentence_pattern",
  "ざるを得ない|ざるをえない",
  "Being forced by circumstances to do something you'd rather not.", "Verb ない-stem + ざるを得ない (する → せざるを得ない)",
  ("会社の命令だから、行かざるを得ない。", "It's an order from the company, so I have no choice but to go."),
  gloss="have no choice but to", hides=("wo_object",))
E("n2_ni_suginai", "〜に過ぎない", "Merely, no more than", "sentence_pattern",
  "に 過ぎない|すぎない",
  "Downplays something: 'it's merely …', 'nothing more than …'.", "Noun / plain form + に過ぎない",
  ("それは噂に過ぎない。", "That's merely a rumour."), gloss="merely", hides=("ni_particle", "sugiru"))
E("n2_ni_koshita_koto_wa_nai", "〜に越したことはない", "Nothing is better than", "sentence_pattern",
  "に越したことはない",
  "'It's best to …', 'you can't go wrong with …'.", "Plain form / noun + に越したことはない",
  ("安全に越したことはない。", "You can't be too safe."), gloss="it's best to",
  hides=("ni_particle", "ta_past", "koto_nominal", "wa_topic", "n3_koto_wa_nai"))
E("n2_wo_towazu", "〜を問わず", "Regardless of", "particle",
  "を|は 問わず",
  "'Regardless of …', 'no matter …'.", "Noun + を問わず",
  ("年齢を問わず、誰でも参加できます。", "Anyone can join, regardless of age."), gloss="regardless of",
  hides=("wo_object", "n4_zu_ni"))
E("n2_ni_watatte", "〜にわたって", "Over, throughout (a span)", "particle",
  "にわたって|にわたり|にわたる|に渡って|に渡り",
  "Covers a whole span of time, space, or number: 'over …', 'throughout …'.", "Noun + にわたって",
  ("会議は三日にわたって行われた。", "The conference was held over three days."), gloss="over / throughout")
E("n2_ni_oujite", "〜に応じて", "In accordance with, depending on", "particle",
  "に 応じて|応じ|応じた|おうじて",
  "Adjusting to something: 'according to …', 'in response to …'.", "Noun + に応じて",
  ("能力に応じて給料が決まる。", "Pay is decided according to ability."), gloss="according to",
  hides=("ni_particle", "te_form"))
E("n2_ni_sotte", "〜に沿って", "Along; in line with", "particle",
  "に 沿って|沿い|沿った|そって",
  "Following a path, plan, or wishes: 'along …', 'in line with …'.", "Noun + に沿って",
  ("川に沿って歩いた。", "I walked along the river."), gloss="along / in line with",
  hides=("ni_particle", "te_form"))
E("n2_ni_kakete_wa", "〜にかけては", "When it comes to", "particle",
  "にかけては|にかけても",
  "'When it comes to …' (a skill someone excels at).", "Noun + にかけては",
  ("料理にかけては、彼女に勝てる人はいない。", "When it comes to cooking, no one beats her."),
  gloss="when it comes to")
E("n2_nai_koto_wa_nai", "〜ないことはない", "It's not that … not", "sentence_pattern",
  "ない こと は ない",
  "Double negative: 'it's not impossible', 'I could …, I suppose'.", "Verb ない-form + ことはない",
  ("行けないことはないが、少し遠い。", "It's not that I can't go, but it's a bit far."),
  gloss="it's not that … not", hides=("koto_nominal", "wa_topic", "n3_koto_wa_nai"))
E("n2_nai_koto_ni_wa", "〜ないことには", "Unless", "conjunction",
  "ない こと に は",
  "'Unless …, (it won't happen)'. Followed by a negative result.", "Verb ない-form + ことには",
  ("彼が来ないことには、会議を始められない。", "We can't start the meeting unless he comes."),
  gloss="unless", hides=("koto_nominal", "wa_topic", "ni_particle"))
E("n2_koto_naku", "〜ことなく", "Without (ever) doing", "sentence_pattern",
  "{V-dict} こと なく",
  "'Without …ing' — written and emphatic.", "Verb dictionary form + ことなく",
  ("彼は休むことなく働き続けた。", "He kept working without resting."), gloss="without",
  hides=("koto_nominal",))
E("n2_mono_nara", "〜ものなら", "If (it were possible)", "conjunction",
  "もの なら",
  "'If I could …' (it's unlikely); with volitional: 'if you dare …, (something bad happens)'.",
  "Potential verb + ものなら", ("行けるものなら、今すぐ行きたい。", "If I could go, I'd go right now."),
  gloss="if (it were possible)", hides=("nara",))
E("n2_you_ga_nai", "〜ようがない", "There's no way to", "sentence_pattern",
  "ようがない|ようもない",
  "No means of doing something: 'there's no way to …'.", "Verb ます-stem + ようがない",
  ("連絡先が分からないので、連絡しようがない。", "I don't know their contact details, so there's no way to reach them."),
  gloss="no way to", hides=("ga_subject",))
E("n2_kkonai", "〜っこない", "No way, definitely not", "sentence_pattern",
  "っこない",
  "Casual, emphatic 'there's no way …'.", "Verb ます-stem + っこない",
  ("こんな仕事、一日で終わりっこない。", "There's no way this job will get done in a day."),
  gloss="no way")
E("n2_mai", "〜まい", "Will not; probably not", "auxiliary",
  "まい",
  "Firm negative will ('I will never …') or negative guess ('probably not').", "Verb dictionary form + まい",
  ("もう二度と行くまい。", "I'll never go there again."), gloss="will not")
E("n2_ue_de", "〜上で", "After; in (doing)", "sentence_pattern",
  ["{V-ta} 上で|うえで", "{V-dict} 上で|うえで"],
  "After a た-form: 'after (carefully) doing …'. After a dictionary form: 'in doing …, for …'.",
  "Verb た-form + 上で; Verb dictionary form + 上で", ("両親と相談した上で決めます。", "I'll decide after talking it over with my parents."),
  gloss="after / in doing")
E("n2_ue_ni", "〜上に", "On top of, besides", "conjunction",
  "{PLAIN|NA-na} 上に|うえに",
  "Adds a second point of the same kind: 'not only …, but also'.", "Plain form + 上に",
  ("この店は安い上に、おいしい。", "This place is cheap, and on top of that it's tasty."), gloss="on top of")
E("n2_ijou", "〜以上は", "Since, now that", "conjunction",
  "{V-ta|V-dict|PLAIN} 以上 は?",
  "Because a situation exists, the natural duty follows: 'now that …, (must)'.", "Plain form + 以上(は)",
  ("引き受けた以上、最後までやります。", "Now that I've taken it on, I'll see it through."),
  gloss="now that", hides=("wa_topic",))
E("n2_kara_ni_wa", "〜からには", "Now that, since", "conjunction",
  "からには|からは",
  "Since a situation holds, a matching resolve or duty follows.", "Plain form + からには",
  ("約束したからには、守らなければならない。", "Since I promised, I have to keep it."),
  gloss="since (resolve)", hides=("kara_because", "kara_from", "ni_particle", "wa_topic"))
E("n2_kara_to_itte", "〜からといって", "Just because", "conjunction",
  "からといって|からって",
  "'Just because … (doesn't mean …)'.", "Plain form + からといって",
  ("高いからといって、いいものとは限らない。", "Just because it's expensive doesn't mean it's good."),
  gloss="just because", hides=("kara_because", "to_iu", "te_form", "to_quote"))
E("n2_to_wa_kagiranai", "〜とは限らない", "Not necessarily", "sentence_pattern",
  "とは 限らない|かぎらない",
  "'Not always', 'not necessarily'. Often with 必ずしも.", "Plain form + とは限らない",
  ("高いものがいいとは限らない。", "Expensive things aren't necessarily good."), gloss="not necessarily",
  hides=("to_quote", "wa_topic"))
E("n2_ni_kagitte", "〜に限って", "Only (when); of all people", "particle",
  "に限って|に限り",
  "'Only …', or 'of all times / people (it had to be then)'.", "Noun + に限って",
  ("急いでいる時に限って、電車が遅れる。", "The train is late only when I'm in a hurry."),
  gloss="only / of all times")
E("n2_ni_kagirazu", "〜に限らず", "Not only", "particle",
  "に限らず",
  "'Not limited to …', 'not just …'.", "Noun + に限らず",
  ("この店は若者に限らず、お年寄りにも人気だ。", "This shop is popular not just with young people but the elderly too."),
  gloss="not only", hides=("n4_zu_ni",))
E("n2_ni_kagiru", "〜に限る", "Nothing beats, the best is", "sentence_pattern",
  "に 限る~",
  "The speaker's opinion of what's best: 'nothing beats …'.", "Noun / Verb dictionary form + に限る",
  ("夏はビールに限る。", "Nothing beats beer in summer."), gloss="nothing beats", hides=("ni_particle",))
E("n2_ni_motozuite", "〜に基づいて", "Based on", "particle",
  "に 基づいて|基づき|基づく|基づいた|もとづいて",
  "'Based on …' (data, rules, facts).", "Noun + に基づいて",
  ("事実に基づいて記事を書く。", "I write articles based on facts."), gloss="based on",
  hides=("ni_particle", "te_form"))
E("n2_ni_tomonatte", "〜に伴って", "Along with, as", "conjunction",
  "に 伴って|伴い|伴う|ともなって|ともない",
  "One change brings another: 'along with …', 'as …'.", "Noun / Verb dictionary form + に伴って",
  ("人口の増加に伴って、問題も増えた。", "As the population grew, so did the problems."), gloss="along with",
  hides=("ni_particle", "te_form"))
E("n2_ni_atatte", "〜にあたって", "On the occasion of, when", "particle",
  "にあたって|に当たって|にあたり|に当たり",
  "At an important moment: 'when (starting) …', 'on the occasion of …'.", "Noun / Verb dictionary form + にあたって",
  ("新しい生活を始めるにあたって、目標を立てた。", "Starting my new life, I set some goals."),
  gloss="on the occasion of")
E("n2_ni_oite", "〜において", "In, at (formal)", "particle",
  "において|における|においては|に於いて",
  "Formal 'in, at' for place, time, or field.", "Noun + において",
  ("会議は東京において行われる。", "The conference will be held in Tokyo."), gloss="in / at (formal)")
E("n2_ni_saishite", "〜に際して", "On the occasion of", "particle",
  "に際して|に際し",
  "Formal 'at the time of …' (a special event).", "Noun / Verb dictionary form + に際して",
  ("出発に際して、注意事項を説明します。", "Before departure, I'll explain the precautions."), gloss="on the occasion of")
E("n2_wo_megutte", "〜をめぐって", "Concerning (a dispute)", "particle",
  "をめぐって|を巡って|をめぐる|をめぐり",
  "The issue at the centre of discussion or conflict: 'over …'.", "Noun + をめぐって",
  ("遺産をめぐって兄弟が争った。", "The siblings fought over the inheritance."), gloss="over (an issue)")
E("n2_wo_kikkake", "〜をきっかけに", "Taking the opportunity of", "particle",
  "をきっかけに|をきっかけとして|がきっかけで|をきっかけにして",
  "An event that triggers something new: 'prompted by …'.", "Noun + をきっかけに",
  ("留学をきっかけに、料理を始めた。", "Studying abroad got me started cooking."), gloss="prompted by")
E("n2_wo_chuushin", "〜を中心に", "Centered on", "particle",
  "を中心に|を中心として|を中心とした|を中心にして",
  "'Centered on …', 'mainly …'.", "Noun + を中心に",
  ("東京を中心に雨が降った。", "It rained mainly around Tokyo."), gloss="centered on")
E("n2_wo_komete", "〜を込めて", "Full of, with (feeling)", "particle",
  "を込めて|をこめて|を込めた",
  "Doing something filled with a feeling: 'with love', 'with gratitude'.", "Noun + を込めて",
  ("感謝を込めて手紙を書いた。", "I wrote a letter full of gratitude."), gloss="with (feeling)")
E("n2_wo_moto_ni", "〜をもとに", "Based on", "particle",
  "を もと|元 に|として|にして",
  "Using something as the source or basis: 'based on …'.", "Noun + をもとに",
  ("事実をもとに映画を作った。", "They made a film based on true events."), gloss="based on",
  hides=("ni_particle", "wo_object"))
E("n2_wa_tomokaku", "〜はともかく", "Setting aside", "particle",
  "はともかく|はともかくとして",
  "'Leaving … aside', 'regardless of …'.", "Noun + はともかく",
  ("味はともかく、値段が高すぎる。", "Taste aside, the price is too high."), gloss="setting aside",
  hides=("wa_topic",))
E("n2_wa_mochiron", "〜はもちろん", "Not to mention", "particle",
  "はもちろん|はもとより",
  "'… goes without saying, and also …'.", "Noun + はもちろん",
  ("英語はもちろん、中国語も話せる。", "She speaks English, of course, and Chinese too."),
  gloss="not to mention", hides=("wa_topic",))
E("n2_bakari_ni", "〜ばかりに", "Just because (bad result)", "conjunction",
  "{PLAIN} ばかり に",
  "Only because of that one thing, something bad happened.", "Plain form + ばかりに",
  ("嘘をついたばかりに、信用を失った。", "Just because I lied, I lost their trust."),
  gloss="just because", hides=("bakari", "ni_particle", "n4_ta_bakari"))
E("n2_mo_kamawazu", "〜もかまわず", "Without caring about", "sentence_pattern",
  "も かまわず|構わず",
  "Doing something without regard for …", "Noun + もかまわず",
  ("人目もかまわず泣いた。", "I cried, not caring who saw."), gloss="without caring about",
  hides=("mo", "n4_zu_ni"))
E("n2_mono_ga_aru", "〜ものがある", "There is something (about it)", "sentence_pattern",
  "{PLAIN|NA-na} もの が ある~",
  "The speaker senses a quality: 'there's something … about it'.", "Plain form + ものがある",
  ("彼の演奏には人を感動させるものがある。", "There's something moving about his playing."),
  gloss="there's something …", hides=("ga_subject", "n5_ga_aru"))
E("n2_mono_ka", "〜ものか", "As if I would!", "sentence_pattern",
  "{PLAIN} もの|もん か",
  "Strong rejection: 'as if …!', 'I'll never …!'.", "Plain form + ものか",
  ("あんな店、二度と行くものか。", "As if I'd ever go to that shop again!"), gloss="as if …!",
  hides=("ka_question",))
E("n2_dokoro_dewa_nai", "〜どころではない", "Not the time for", "sentence_pattern",
  "どころ では|じゃ ない",
  "'This is no time for …', 'far from being able to …'.", "Noun / Verb dictionary form + どころではない",
  ("忙しくて旅行どころではない。", "I'm too busy to even think about travelling."),
  gloss="no time for", hides=("dewa_nai",))
E("n2_shidai", "〜次第", "As soon as; depending on", "sentence_pattern",
  ["{V-masu} 次第|しだい", "{N} 次第|しだい だ|で"],
  "After a ます-stem: 'as soon as …'. After a noun: 'depending on …', 'it's up to …'.",
  "Verb ます-stem + 次第; noun + 次第だ", ("準備ができ次第、出発します。", "We'll leave as soon as we're ready."),
  gloss="as soon as / depending on")
E("n2_ka_to_omou_to", "〜かと思うと", "No sooner had … than", "conjunction",
  "かと思うと|かと思ったら|かと思えば",
  "Something changes the instant something else happens.", "Verb た-form + かと思うと",
  ("晴れたかと思うと、また雨が降り出した。", "No sooner had it cleared up than it began raining again."),
  gloss="no sooner … than", hides=("to_omou", "to_conditional", "ka_question", "tara"))
E("n2_ka_no_you", "〜かのようだ", "As if", "sentence_pattern",
  "か の よう",
  "'As if …' (it isn't really so).", "Plain form + かのようだ / かのように",
  ("彼はまるで何も知らないかのように振る舞った。", "He acted as if he knew nothing."), gloss="as if",
  hides=("you_da", "ka_question", "no_link", "you_ni"))
E("n2_gatai", "〜がたい", "Hard to (emotionally)", "auxiliary",
  "{V-masu} がたい|難い",
  "Hard to do because of feelings or beliefs: 'hard to believe / forgive'.", "Verb ます-stem + がたい",
  ("信じがたい話だ。", "It's a hard story to believe."), gloss="hard to")
E("n2_ge", "〜げ", "Seeming, -looking", "auxiliary",
  "{A-stem|NA} げ",
  "How something appears: 'looking …', 'with an air of …'.", "い-adj stem / な-adj + げ",
  ("彼女は悲しげな顔をしていた。", "She had a sad look on her face."), gloss="-looking")
E("n2_koto_da", "〜ことだ", "Should (advice)", "sentence_pattern",
  "{V-dict|V-nai} ことだ。|ことだよ|ことだね",
  "Strong advice, ending the sentence: 'you should …', 'the best thing is to …'.", "Verb dictionary / ない-form + ことだ",
  ("痩せたいなら、甘い物を控えることだ。", "If you want to lose weight, cut down on sweets."),
  gloss="you should", hides=("da", "koto_nominal"))
E("n2_koto_kara", "〜ことから", "From the fact that", "conjunction",
  f"{P} こと から",
  "The basis for a conclusion or a name: 'because / from the fact that …'.", "Plain form + ことから",
  ("この橋は形が眼鏡に似ていることから、眼鏡橋と呼ばれている。", "This bridge is called Spectacles Bridge because its shape resembles glasses."),
  gloss="from the fact that", hides=("koto_nominal", "kara_from"))
E("n2_koto_ni", "〜ことに", "(Emotion), … to say", "sentence_pattern",
  "{V-ta|A-dict|NA-na} こと に",
  "Stating a feeling first: 'surprisingly, …', 'fortunately, …'.", "Emotion word + ことに",
  ("驚いたことに、彼は泣いていた。", "To my surprise, he was crying."), gloss="(feeling) to say",
  hides=("koto_nominal", "ni_particle"))
E("n2_to_ieba", "〜といえば / というと", "Speaking of", "particle",
  "といえば|と言えば|というと|と言うと|といったら",
  "Brings up a topic or the first thing that comes to mind: 'speaking of …'.", "Noun + といえば",
  ("日本といえば、富士山だ。", "Speaking of Japan, there's Mt. Fuji."), gloss="speaking of",
  hides=("to_quote", "ba", "to_conditional"))
E("n2_to_iu_yori", "〜というより", "Rather than", "sentence_pattern",
  "というより|と言うより",
  "A better description: 'rather than …, (it's more like …)'.", "Noun / plain form + というより",
  ("彼は友達というより家族だ。", "He's more family than a friend."), gloss="rather than",
  hides=("to_iu", "yori"))
E("n2_to_iu_wake_dewa_nai", "〜というわけではない", "It doesn't mean that", "sentence_pattern",
  "という わけ では|じゃ ない",
  "'It's not that …', 'that doesn't mean …'.", "Plain form + というわけではない",
  ("嫌いというわけではない。", "It's not that I dislike it."), gloss="it doesn't mean that",
  hides=("to_iu", "n3_wake_dewa_nai", "dewa_nai"))
E("n2_to_itte_mo", "〜といっても", "Although I say", "conjunction",
  "といっても|と言っても",
  "Qualifies what was just said: 'even though I say …, (it's not much)'.", "Plain form + といっても",
  ("料理ができるといっても、簡単なものだけです。", "I say I can cook, but only simple things."),
  gloss="although I say", hides=("te_mo", "to_quote", "te_form"))
E("n2_ni_hoka_naranai", "〜にほかならない", "Nothing but", "sentence_pattern",
  "にほかならない|に他ならない",
  "Strong assertion: 'it is none other than …'.", "Noun + にほかならない",
  ("成功は努力の結果にほかならない。", "Success is nothing other than the result of effort."),
  gloss="nothing but")
E("n2_ni_shite_wa", "〜にしては", "For (someone), considering", "conjunction",
  "にしては",
  "Contrary to what you'd expect: 'for a …', 'considering …'.", "Noun / plain form + にしては",
  ("初めてにしては上手だ。", "That's good for a first time."), gloss="for (considering)")
E("n2_ni_shite_mo", "〜にしても / にしろ", "Even if, whether", "conjunction",
  "にしても|にしろ|にせよ",
  "'Even if …', 'whether … or …'.", "Noun / plain form + にしても",
  ("行くにしても、行かないにしても、連絡してください。", "Whether you go or not, please let me know."),
  gloss="even if / whether")
E("n2_ni_tsuki", "〜につき", "Due to; per", "particle",
  "につき",
  "Formal: 'because of …' (on notices), or 'per …'.", "Noun + につき",
  ("工事中につき、通行止め。", "Road closed due to construction."), gloss="due to / per",
  hides=("n3_ni_tsuite",))
E("n2_ni_hanshite", "〜に反して", "Contrary to", "particle",
  "に反して|に反し|に反する|に反した",
  "Against expectations or rules: 'contrary to …'.", "Noun + に反して",
  ("予想に反して、彼は負けた。", "Contrary to expectations, he lost."), gloss="contrary to")
E("n2_ni_sakidatte", "〜に先立って", "Prior to", "particle",
  "に先立って|に先立ち|に先立つ",
  "Formal 'before (an event)'.", "Noun + に先立って",
  ("開会に先立って、挨拶がある。", "Prior to the opening, there'll be a greeting."), gloss="prior to")
E("n2_ni_kotaete", "〜に応えて", "In response to", "particle",
  "に応えて|に応え|にこたえて",
  "Meeting expectations or requests: 'in response to …'.", "Noun + に応えて",
  ("ファンの声に応えて、再び演奏した。", "In response to the fans, they played again."), gloss="in response to")
E("n2_ppanashi", "〜っぱなし", "Leaving it (as is)", "auxiliary",
  ["{V-masu} っぱなし|っ放し", "っぱなし|っ放し"],
  "Leaving something in a state that should be changed: 'left on', 'nonstop'.", "Verb ます-stem + っぱなし",
  ("電気をつけっぱなしで寝た。", "I slept with the light left on."), gloss="left as is")
E("n2_kiri", "〜きり", "Only; since (and not again)", "sentence_pattern",
  "{V-ta} きり|っきり",
  "After a た-form: 'since then (and not again)'. After a noun: 'only'.", "Verb た-form + きり",
  ("彼とは去年会ったきりだ。", "I haven't seen him since last year."), gloss="(only) since then",
  hides=("ta_past",))
E("n2_ippou_da", "〜一方だ", "Keeps getting more", "sentence_pattern",
  "{V-dict} 一方|いっぽう だ",
  "A trend in one direction that keeps going: 'more and more …'.", "Verb dictionary form + 一方だ",
  ("物価は上がる一方だ。", "Prices just keep rising."), gloss="keeps getting more", hides=("da",))
E("n2_ippou_de", "〜一方で", "While, on the other hand", "conjunction",
  "{PLAIN|NA-na|N-no} 一方 で|、",
  "Contrasts two sides: 'while …, on the other hand …'.", "Plain form + 一方(で)",
  ("彼は仕事が速い一方で、ミスも多い。", "He works fast, but on the other hand makes many mistakes."),
  gloss="while / on the other hand", hides=("de_particle",))
E("n2_hanmen", "〜反面", "On the other hand", "conjunction",
  "反面|はんめん",
  "Two opposite sides of the same thing.", "Plain form + 反面",
  ("この仕事は大変な反面、やりがいもある。", "This job is tough, but on the other hand it's rewarding."),
  gloss="on the other hand")
E("n2_monono", "〜ものの", "Although", "conjunction",
  "ものの",
  "'Although …' — the result isn't what you'd expect.", "Plain form + ものの",
  ("大学を卒業したものの、仕事が見つからない。", "Although I graduated, I can't find a job."), gloss="although")
E("n2_dake_atte", "〜だけあって", "As expected of", "conjunction",
  "だけ あって|ある|のことはある",
  "Something matches its reputation: 'as you'd expect from …'.", "Noun / plain form + だけあって",
  ("さすがプロだけあって、上手だ。", "As expected of a pro, they're skilled."), gloss="as expected of",
  hides=("dake",))
E("n2_kakeru_kanenai", "〜かねない", "Could well, might", "auxiliary",
  "{V-masu} かね ない",
  "A bad possibility: 'could well (happen)'.", "Verb ます-stem + かねない",
  ("そんな運転をしたら、事故を起こしかねない。", "Driving like that, you could well cause an accident."),
  gloss="could well (bad)", hides=("n2_kaneru",))
E("n2_kaneru", "〜かねる", "Can't (politely)", "auxiliary",
  "{V-masu} かねる~",
  "A polite refusal: 'I'm afraid I can't …'.", "Verb ます-stem + かねる",
  ("その質問にはお答えしかねます。", "I'm afraid I can't answer that question."), gloss="can't (politely)")
E("n2_tsutsu", "〜つつ", "While; although", "conjunction",
  "{V-masu} つつ",
  "Written 'while …ing'; with も: 'although …'.", "Verb ます-stem + つつ",
  ("悪いと知りつつ、嘘をついてしまった。", "Although I knew it was wrong, I lied."), gloss="while / although")
E("n2_tsutsu_aru", "〜つつある", "Is in the process of", "sentence_pattern",
  "{V-masu} つつ ある~",
  "A change in progress: 'is gradually …ing'.", "Verb ます-stem + つつある",
  ("地球の気温は上がりつつある。", "The earth's temperature is rising."), gloss="is gradually",
  hides=("n2_tsutsu", "n5_ga_aru"))
E("n2_hoka_nai", "〜ほかない", "Have no choice but to", "sentence_pattern",
  "{V-dict} ほか|他 ない|はない",
  "Formal 'have no choice but to …'.", "Verb dictionary form + ほかない",
  ("やってみるほかない。", "There's nothing for it but to try."), gloss="no choice but to")
E("n2_tokoro_de", "〜たところで", "Even if (it's useless)", "conjunction",
  "{V-ta} ところ で",
  "'Even if you did …, (it wouldn't help)'.", "Verb た-form + ところで",
  ("今から行ったところで間に合わない。", "Even if I went now, I wouldn't make it."), gloss="even if (pointless)",
  hides=("tokoro", "de_particle", "ta_past"))
E("n2_bakari_da", "〜ばかりだ", "Keeps getting (worse)", "sentence_pattern",
  "{V-dict} ばかり だ",
  "A change going only one way, usually worse.", "Verb dictionary form + ばかりだ",
  ("彼の病気は悪くなるばかりだ。", "His illness just keeps getting worse."), gloss="keeps getting",
  hides=("bakari", "da"))
E("n2_nagara_mo", "〜ながらも", "Although", "conjunction",
  "ながら も|ながらも",
  "'Although …' with the same subject.", "Verb ます-stem / adjective + ながらも",
  ("狭いながらも楽しい我が家。", "Our home is small, but happy."), gloss="although",
  hides=("nagara", "mo"))
E("n2_sei_ka", "〜せいか", "Perhaps because", "conjunction",
  "せい か",
  "A guessed cause: 'maybe because …'.", "Plain form / noun + の + せいか",
  ("年のせいか、最近疲れやすい。", "Perhaps because of my age, I tire easily these days."),
  gloss="perhaps because", hides=("ka_question",))
E("n2_ni_kakawaru", "〜に関わる", "Affecting, related to", "particle",
  "に関わる|にかかわる|に関わり",
  "Something with serious consequences for …: 'a matter of life and death'.", "Noun + に関わる",
  ("命に関わる病気だ。", "It's a life-threatening illness."), gloss="affecting")
E("n2_wo_fumaete", "〜を踏まえて", "Based on, taking into account", "particle",
  "を 踏まえて|ふまえて|踏まえ",
  "'Taking … into account'.", "Noun + を踏まえて",
  ("調査の結果を踏まえて、計画を立てた。", "We made the plan taking the survey results into account."),
  gloss="taking into account", hides=("wo_object", "te_form"))
