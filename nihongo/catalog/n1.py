"""JLPT N1 grammar points."""

from functools import partial

from ..patterns import g

E = partial(g, "N1")

E("n1_wo_motte", "〜をもって", "With, by means of; as of", "particle",
  "をもって|をもちまして|を以て",
  "Formal: the means ('with …'), or a point in time ('as of …', 'at …').", "Noun + をもって",
  ("本日をもって閉店いたします。", "As of today, we are closing."), gloss="with / as of")
E("n1_wo_kawakiri", "〜を皮切りに", "Starting with", "particle",
  "を皮切りに|を皮切りとして|を皮切りにして",
  "The first in a series of events: 'starting with …'.", "Noun + を皮切りに",
  ("東京を皮切りに、全国でコンサートを行う。", "Starting in Tokyo, they'll give concerts across the country."),
  gloss="starting with")
E("n1_wo_yoso_ni", "〜をよそに", "Ignoring, without regard for", "particle",
  "をよそに",
  "Going ahead regardless of others' worries or opinions.", "Noun + をよそに",
  ("親の心配をよそに、彼は旅に出た。", "Ignoring his parents' worries, he set off on a journey."), gloss="ignoring")
E("n1_naradewa", "〜ならでは", "Unique to", "particle",
  "ならでは",
  "Something only possible for that person or place: 'unique to …'.", "Noun + ならでは(の)",
  ("これは京都ならではの料理だ。", "This is a dish you can only get in Kyoto."), gloss="unique to",
  hides=("nara",))
E("n1_zu_ni_wa_okanai", "〜ずにはおかない", "Will definitely (cause)", "sentence_pattern",
  "ずにはおかない|ないではおかない|ずにはおかぬ",
  "Something inevitably causes a feeling or reaction; or a strong resolve to do it.", "Verb ない-stem + ずにはおかない",
  ("彼の演説は聞く人を感動させずにはおかない。", "His speech cannot fail to move those who hear it."),
  gloss="will inevitably", hides=("n4_zu_ni", "wa_topic", "te_oku"))
E("n1_zu_ni_wa_sumanai", "〜ずにはすまない", "Must, can't get away without", "sentence_pattern",
  "ずにはすまない|ずにはすまされない|ないではすまない",
  "Something must be done because of social duty or circumstances.", "Verb ない-stem + ずにはすまない",
  ("迷惑をかけたのだから、謝らずにはすまない。", "Since I caused trouble, I can't get away without apologising."),
  gloss="can't get away without", hides=("n4_zu_ni", "wa_topic"))
E("n1_wo_kinjienai", "〜を禁じ得ない", "Can't help feeling", "sentence_pattern",
  "を禁じ得ない|を禁じえない",
  "A feeling one can't suppress (sympathy, anger, tears).", "Noun + を禁じ得ない",
  ("被害者には同情を禁じ得ない。", "I can't help but feel sympathy for the victims."), gloss="can't help feeling")
E("n1_wo_yogi_naku", "〜を余儀なくされる", "Be forced to", "sentence_pattern",
  "を余儀なく|をよぎなく",
  "Being forced by circumstances: 'be compelled to …'.", "Noun + を余儀なくされる",
  ("大雨で、試合は中止を余儀なくされた。", "The heavy rain forced the match to be cancelled."), gloss="be forced to")
E("n1_ni_itatte_wa", "〜に至っては", "As for (the extreme case)", "particle",
  "に至っては|にいたっては",
  "Introduces the most extreme example.", "Noun + に至っては",
  ("弟に至っては、一度も学校に行っていない。", "As for my brother, he hasn't been to school even once."),
  gloss="as for (extreme case)")
E("n1_ni_itaru_made", "〜に至るまで", "Down to, even", "particle",
  "に至るまで|にいたるまで",
  "The range extends even to …: 'down to …', 'right up to …'.", "Noun + に至るまで",
  ("子供から老人に至るまで、皆が楽しんだ。", "Everyone from children to the elderly had fun."),
  gloss="even down to")
E("n1_ni_taenai", "〜に堪えない", "Unbearable to; deeply", "sentence_pattern",
  "にたえない|に堪えない|に耐えない|にたえません|に堪えません",
  "'Too awful to …' (見るにたえない), or a formal 'deeply …' (感謝にたえない).", "Verb dictionary form / noun + にたえない",
  ("その番組は見るにたえない。", "That programme is unbearable to watch."), gloss="unbearable to")
E("n1_ni_taru", "〜に足る", "Worthy of", "sentence_pattern",
  "に足る|に足りる|に足りない|に足らない|にたる",
  "'Worth …', 'deserving of …' (and with a negative, 'not worth …').", "Verb dictionary form / noun + に足る",
  ("彼は信頼するに足る人物だ。", "He is a person worthy of trust."), gloss="worthy of")
E("n1_to_atte", "〜とあって", "Because (it's a special case)", "conjunction",
  "とあって|とあっては",
  "Because of a special situation, a natural result follows.", "Plain form / noun + とあって",
  ("連休とあって、観光地はどこも混んでいる。", "It being a long weekend, every tourist spot is crowded."),
  gloss="because (special case)")
E("n1_to_areba", "〜とあれば", "If it's for", "conjunction", "とあれば",
  "'If it's (for) …, (I'll do anything)'.", "Noun / plain form + とあれば",
  ("子供のためとあれば、何でもする。", "If it's for my children, I'll do anything."), gloss="if it's for")
E("n1_to_iedomo", "〜といえども", "Even though, even", "conjunction",
  "といえども|と言えども",
  "Formal 'even (someone who is …)', 'although …'.", "Noun / plain form + といえども",
  ("専門家といえども、間違うことはある。", "Even experts make mistakes."), gloss="even though")
E("n1_tomo_naru_to", "〜ともなると", "When it comes to (that level)", "conjunction",
  "ともなると|ともなれば",
  "Once something reaches a certain level, a natural consequence follows.", "Noun + ともなると",
  ("社長ともなると、毎日忙しい。", "Once you're the company president, you're busy every day."),
  gloss="once it comes to")
E("n1_taritomo", "〜たりとも", "Not even (one)", "particle",
  "たりとも",
  "With a minimal amount and a negative: 'not even one …'.", "一 + counter + たりとも + negative",
  ("一円たりとも無駄にできない。", "I can't waste even a single yen."), gloss="not even one")
E("n1_sura", "〜すら", "Even", "particle",
  "すら|ですら",
  "A written, emphatic 'even'.", "Noun + すら",
  ("彼は自分の名前すら書けない。", "He can't even write his own name."), gloss="even")
E("n1_wo_oite", "〜をおいて", "Other than (no one but)", "particle",
  "をおいて|を措いて",
  "'There's no one / nothing but …'. Followed by a negative.", "Noun + をおいて",
  ("この仕事を任せられるのは、彼をおいてほかにいない。", "There's no one but him we can trust with this job."),
  gloss="no one but")
E("n1_de_are", "〜であれ", "Whether, even if", "conjunction",
  "であれ|であろうと|であろうが",
  "'Whether it's … (or …)', 'no matter …'.", "Noun + であれ",
  ("どんな理由であれ、遅刻はいけない。", "Whatever the reason, being late isn't OK."), gloss="whether / even if")
E("n1_nari_ni", "〜なりに", "In one's own way", "particle",
  "なりに|なりの",
  "'In one's own way', within one's limits.", "Noun / plain form + なりに",
  ("私なりに頑張りました。", "I did my best in my own way."), gloss="in one's own way")
E("n1_ya_ina_ya", "〜や否や", "As soon as", "conjunction",
  "や否や|やいなや",
  "Formal 'the moment …', 'no sooner … than'.", "Verb dictionary form + や否や",
  ("ベルが鳴るや否や、学生たちは教室を飛び出した。", "The moment the bell rang, the students rushed out of the classroom."),
  gloss="as soon as")
E("n1_ga_hayai_ka", "〜が早いか", "As soon as", "conjunction",
  "が早いか|がはやいか",
  "Something happens immediately after: 'no sooner had … than'.", "Verb dictionary form + が早いか",
  ("彼は家に帰るが早いか、ベッドに倒れ込んだ。", "No sooner had he got home than he collapsed onto the bed."),
  gloss="as soon as", hides=("ga_subject",))
E("n1_soba_kara", "〜そばから", "As soon as (repeatedly)", "conjunction",
  "そばから",
  "As soon as something is done, it's undone — again and again.", "Verb dictionary / た-form + そばから",
  ("聞いたそばから忘れてしまう。", "I forget things as soon as I hear them."), gloss="as soon as (each time)",
  hides=("kara_from",))
E("n1_te_kara_to_iu_mono", "〜てからというもの", "Ever since", "sentence_pattern",
  "{V-te} から という もの",
  "A big change since some event: 'ever since …'.", "Verb て-form + からというもの",
  ("子供が生まれてからというもの、毎日忙しい。", "Ever since our child was born, every day has been busy."),
  gloss="ever since", hides=("te_kara", "to_iu"))
E("n1_ni_atte", "〜にあって", "In (a situation)", "particle",
  "にあって|にあっては|にあっても",
  "Formal 'in (this situation / era)'.", "Noun + にあって",
  ("この不景気にあって、仕事を見つけるのは難しい。", "In this recession, finding work is hard."), gloss="in (a situation)")
E("n1_majiki", "〜まじき", "Unbefitting, should never", "auxiliary",
  "まじき|まじ",
  "Behaviour that should never be done by someone in that role.", "Verb dictionary form + まじき + noun",
  ("教師にあるまじき行為だ。", "That's conduct unbecoming of a teacher."), gloss="should never (be done)")
E("n1_beku", "〜べく", "In order to", "conjunction",
  "{V-dict} べく|べくして",
  "Written 'in order to …'. する → すべく.", "Verb dictionary form + べく",
  ("問題を解決すべく、全力を尽くした。", "We did everything we could in order to solve the problem."),
  gloss="in order to", hides=("beki",))
E("n1_bekarazu", "〜べからず", "Must not", "auxiliary",
  "べからず|べからざる",
  "Formal prohibition, typical on signs.", "Verb dictionary form + べからず",
  ("芝生に入るべからず。", "Keep off the grass."), gloss="must not", hides=("beki",))
E("n1_n_bakari", "〜んばかり", "As if about to", "sentence_pattern",
  "んばかり",
  "'As if about to …' — almost, but not actually.", "Verb ない-stem + んばかり",
  ("彼女は泣き出さんばかりの顔をしていた。", "She looked as if she was about to burst into tears."),
  gloss="as if about to", hides=("bakari", "negative_n"))
E("n1_gotoku", "〜ごとく / ごとき", "Like, as", "auxiliary",
  "ごとく|ごとき|如く|如き|ごとし",
  "Literary 'like', 'as'.", "Noun + の + ごとく",
  ("時間は矢のごとく過ぎていく。", "Time flies like an arrow."), gloss="like / as")
E("n1_kirai_ga_aru", "〜きらいがある", "Tend to (bad habit)", "sentence_pattern",
  "きらいがある~|嫌いがある~",
  "An undesirable tendency: 'have a tendency to …'.", "Verb dictionary form + きらいがある",
  ("彼は物事を大げさに言うきらいがある。", "He has a tendency to exaggerate."), gloss="has a tendency to",
  hides=("ga_subject", "n5_ga_aru", "n5_ga_suki"))
E("n1_shimatsu_da", "〜始末だ", "End up (badly)", "sentence_pattern",
  "始末|しまつ だ",
  "A bad final outcome after a series of problems.", "Verb dictionary form + 始末だ",
  ("彼は借金を重ね、ついには家まで売る始末だ。", "He kept borrowing and ended up even selling his house."),
  gloss="end up (badly)", hides=("da",))
E("n1_made_mo_nai", "〜までもない", "No need to", "sentence_pattern",
  "までもない|までもなく",
  "So obvious it doesn't need doing or saying.", "Verb dictionary form + までもない",
  ("言うまでもないが、遅刻は禁止だ。", "It goes without saying, but lateness is forbidden."),
  gloss="no need to", hides=("made", "mo"))
E("n1_made_da", "〜までだ", "Will simply; only", "sentence_pattern",
  "{V-dict|V-ta} まで だ|のことだ",
  "'If it fails, I'll simply …' (resolve), or 'I only …' (nothing more).", "Verb + までだ",
  ("だめなら、もう一度やるまでだ。", "If it doesn't work, I'll simply do it again."), gloss="will simply",
  hides=("made", "da"))
E("n1_wa_oroka", "〜はおろか", "Let alone", "particle",
  "はおろか",
  "'Let alone …', 'not to mention …' (usually with a negative).", "Noun + はおろか",
  ("漢字はおろか、ひらがなも書けない。", "I can't write hiragana, let alone kanji."), gloss="let alone",
  hides=("wa_topic",))
E("n1_mo_sarukoto_nagara", "〜もさることながら", "Not only … but also", "particle",
  "もさることながら",
  "'… is (of course) important, but even more so …'.", "Noun + もさることながら",
  ("味もさることながら、見た目も美しい。", "The taste is great, and the presentation is beautiful too."),
  gloss="not only … but also", hides=("mo",))
E("n1_mono_wo", "〜ものを", "If only, even though", "conjunction",
  "ものを",
  "Regret or blame: 'if only you had …, (but you didn't)'.", "Plain form + ものを",
  ("言ってくれれば手伝ったものを。", "If only you'd told me, I'd have helped."), gloss="if only")
E("n1_to_wa_ie", "〜とはいえ", "Although, that said", "conjunction",
  "とはいえ|とは言え",
  "'Although …, (still)'.", "Plain form / noun + とはいえ",
  ("春とはいえ、まだ寒い。", "Although it's spring, it's still cold."), gloss="although",
  hides=("to_quote", "wa_topic"))
E("n1_te_yamanai", "〜てやまない", "Never stop (wishing)", "sentence_pattern",
  "{V-te} やまない|止まない|やみません|止みません",
  "A feeling that never stops: 'sincerely hope', 'never cease to …'.", "Verb て-form + やまない",
  ("皆様のご健康を願ってやみません。", "I sincerely wish you all good health."), gloss="never cease to")
E("n1_kara_aru", "〜からある", "As much as (at least)", "particle",
  "{NUM} から ある|する|の",
  "Stresses a large amount: 'as much as … (or more)'.", "Number + からある",
  ("十キロからある荷物を運んだ。", "I carried a load of ten kilos or more."), gloss="as much as",
  hides=("kara_from",))
E("n1_zukume", "〜ずくめ", "Entirely, nothing but", "auxiliary",
  "ずくめ",
  "Surrounded by or full of one thing: 'all …'.", "Noun + ずくめ",
  ("今年はいいことずくめだった。", "This year was nothing but good things."), gloss="nothing but")
E("n1_mamire", "〜まみれ", "Covered in", "auxiliary",
  "まみれ",
  "Covered in something messy (mud, sweat, blood).", "Noun + まみれ",
  ("子供たちは泥まみれになって遊んだ。", "The kids played until they were covered in mud."), gloss="covered in")
E("n1_kiwamaru", "〜極まる / 極まりない", "Extremely", "auxiliary",
  "極まる~|極まりない|きわまる~|きわまりない",
  "'Extremely …' (formal, usually negative).", "な-adj + 極まる / 極まりない",
  ("彼の態度は失礼極まりない。", "His attitude is extremely rude."), gloss="extremely")
E("n1_no_itari", "〜の至り", "The utmost", "other",
  "の至り|のいたり",
  "Formal: 'the height of …' (光栄の至り, 'a great honour').", "Noun + の至り",
  ("お会いできて光栄の至りです。", "It's a great honour to meet you."), gloss="the height of", hides=("no_link",))
E("n1_no_kiwami", "〜の極み", "The peak of", "other",
  "の極み|のきわみ",
  "Formal: 'the utmost …'.", "Noun + の極み",
  ("贅沢の極みだ。", "It's the height of luxury."), gloss="the peak of", hides=("no_link",))
E("n1_gatera", "〜がてら", "While, on the way", "conjunction",
  "がてら",
  "Doing one thing with another: 'while …ing, also …'.", "Noun / Verb ます-stem + がてら",
  ("散歩がてら、パンを買いに行った。", "I went to buy bread while out on a walk."), gloss="while also")
E("n1_katagata", "〜かたがた", "While also (formal)", "conjunction",
  "かたがた",
  "Formal: doing two purposes at once (visit + greet).", "Noun + かたがた",
  ("ご挨拶かたがた、お伺いしました。", "I've come to visit and to pay my respects."), gloss="while also")
E("n1_katawara", "〜かたわら", "While (also doing)", "conjunction",
  "{V-dict|N-no} かたわら|傍ら",
  "Doing one thing alongside one's main occupation.", "Verb dictionary form / noun + の + かたわら",
  ("彼は会社に勤めるかたわら、小説を書いている。", "Alongside his office job, he writes novels."),
  gloss="alongside")
E("n1_dewa_arumaishi", "〜ではあるまいし", "It's not like", "conjunction",
  "ではあるまいし|じゃあるまいし|じゃないんだから",
  "'It's not as if …, so (act accordingly)'.", "Noun + ではあるまいし",
  ("子供じゃあるまいし、自分でやりなさい。", "You're not a child, so do it yourself."), gloss="it's not as if")
E("n1_to_bakari_ni", "〜とばかりに", "As if to say", "sentence_pattern",
  "とばかりに|とばかりの",
  "Acting as if saying something out loud.", "Quote / plain form + とばかりに",
  ("彼は「出て行け」とばかりにドアを指さした。", "He pointed at the door as if to say 'get out'."),
  gloss="as if to say", hides=("to_quote", "bakari"))
E("n1_tomo_naku", "〜ともなく", "Without meaning to", "sentence_pattern",
  "ともなく|ともなしに",
  "Doing something without any particular intention.", "Verb dictionary form + ともなく",
  ("見るともなくテレビを見ていた。", "I was watching TV without really watching."), gloss="without meaning to")
E("n1_nagara_ni", "〜ながらに", "While still; since", "particle",
  "ながらに|ながらの",
  "A state that has always been so: 生まれながらに (since birth), 涙ながらに (in tears).",
  "Noun / Verb ます-stem + ながらに", ("彼は涙ながらに話した。", "He spoke in tears."), gloss="while still / since",
  hides=("nagara",))
E("n1_naku_shite", "〜なくして", "Without", "conjunction",
  "なくして|なくしては|なしに|なしには",
  "'Without …, (it's impossible)'.", "Noun + なくして",
  ("努力なくして成功はない。", "There's no success without effort."), gloss="without")
E("n1_nara_iza_shirazu", "〜ならいざ知らず", "It might be different if", "conjunction",
  "ならいざ知らず|ならいざしらず|はいざ知らず",
  "'… is one thing, but (this case is different)'.", "Noun + ならいざ知らず",
  ("子供ならいざ知らず、大人がそんなことをするなんて。", "It'd be one thing for a child, but an adult doing that!"),
  gloss="it would be different if", hides=("nara",))
E("n1_ni_kataku_nai", "〜に難くない", "Not hard to (imagine)", "sentence_pattern",
  "に難くない|にかたくない",
  "'It's easy to (imagine / understand)'.", "Verb dictionary form / noun + に難くない",
  ("彼の苦労は想像に難くない。", "It's not hard to imagine his struggles."), gloss="easy to (imagine)")
E("n1_ni_mo_mashite", "〜にもまして", "Even more than", "particle",
  "にもまして|にも増して",
  "'Even more than (before / anything)'.", "Noun + にもまして",
  ("今年は去年にもまして暑い。", "This year is even hotter than last year."), gloss="even more than",
  hides=("ni_particle", "mo"))
E("n1_ba_sore_made_da", "〜ばそれまでだ", "That's the end of it", "sentence_pattern",
  "ばそれまで|たらそれまで",
  "'If …, that's the end of it (all is lost)'.", "Verb ば-form + それまでだ",
  ("いくらお金があっても、死んでしまえばそれまでだ。", "However rich you are, once you die that's the end of it."),
  gloss="that's the end of it", hides=("made", "ba", "n5_kore"))
E("n1_made_shite", "〜までして", "Even going so far as", "sentence_pattern",
  "まで して",
  "'Even going as far as …'.", "Noun / Verb dictionary form + までして",
  ("借金までして車を買った。", "He even went into debt to buy a car."), gloss="even going so far as",
  hides=("made", "te_form"))
E("n1_wo_monotomo_sezu", "〜をものともせず", "In defiance of", "particle",
  "をものともせず|をものともしないで",
  "Overcoming difficulties without being daunted.", "Noun + をものともせず",
  ("彼は怪我をものともせず、試合に出た。", "He played the match, undaunted by his injury."), gloss="undaunted by")
E("n1_n_ga_tame", "〜んがため", "In order to", "conjunction",
  "んがため|んがために",
  "Literary 'in order to …'.", "Verb ない-stem + んがため",
  ("勝たんがため、彼は毎日練習した。", "In order to win, he practised every day."), gloss="in order to")
E("n1_wo_ii_koto_ni", "〜をいいことに", "Taking advantage of", "particle",
  "をいいことに|を良いことに",
  "Using a situation as an excuse to do something bad.", "Noun + をいいことに",
  ("親が留守なのをいいことに、彼は遊んでばかりいた。", "Taking advantage of his parents being away, he did nothing but play."),
  gloss="taking advantage of")
E("n1_ni_soku_shite", "〜に即して", "In line with", "particle",
  "に即して|に即した|に即し",
  "'In accordance with (facts / reality / rules)'.", "Noun + に即して",
  ("事実に即して判断する。", "I judge in line with the facts."), gloss="in line with")
E("n1_kotoka", "〜ことか", "How (very) …!", "sentence_pattern",
  "{Q} … こと か",
  "Exclamation: 'how …!', 'how many times …!'.", "Question word + plain form + ことか",
  ("何度注意したことか。", "How many times have I warned you!"), gloss="how …!",
  hides=("koto_nominal", "ka_question"))
