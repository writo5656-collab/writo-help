// JLPT N3–N1 grammar reference: core patterns with meaning and an original
// example sentence (furigana notation). N5–N4 grammar is taught in the lessons.
export interface GrammarPoint { lvl: number; p: string; m: string; f: string; en: string }
const G = (lvl: number, rows: string) => rows.trim().split('\n').map(r => { const [p, m, f, en] = r.split('|').map(x => x.trim()); return { lvl, p, m, f, en }; });

export const GRAMMAR: GrammarPoint[] = [
  ...G(3, `
〜ようにする|to make a point of doing|毎日[まいにち] 野菜[やさい]を 食[た]べるように しています。|I make a point of eating vegetables every day.
〜ようになる|to come to (be able to) do|日本語[にほんご]が 話[はな]せるように なりました。|I've become able to speak Japanese.
〜ことにする|to decide to|毎朝[まいあさ] 走[はし]ることに しました。|I decided to run every morning.
〜ことになる|it has been decided that|来月[らいげつ] 大阪[おおさか]に 引[ひ]っ越[こ]すことに なりました。|It's been decided that I'll move to Osaka next month.
〜ばかり|nothing but, only|弟[おとうと]は ゲームばかり しています。|My little brother does nothing but play games.
〜たばかり|have just done|日本[にほん]に 来[き]たばかりです。|I've just come to Japan.
〜ところだ|about to / just now|今[いま] 出[で]かけるところです。|I'm just about to go out.
〜はずだ|should be, is expected to|彼[かれ]は もう 着[つ]いているはずです。|He should have arrived by now.
〜わけではない|it doesn't mean that|嫌[きら]いなわけでは ありません。|It's not that I dislike it.
〜らしい|apparently (hearsay)|あしたは 雨[あめ]らしいです。|Apparently it will rain tomorrow.
〜みたい|seems, looks like|彼[かれ]は 疲[つか]れているみたいです。|He seems tired.
〜のに|even though|勉強[べんきょう]したのに、 試験[しけん]に 落[お]ちました。|Even though I studied, I failed the exam.
〜ために|in order to; because of|日本[にほん]で 働[はたら]くために 日本語[にほんご]を 勉強[べんきょう]しています。|I'm studying Japanese in order to work in Japan.
〜ように|so that|忘[わす]れないように メモしました。|I wrote a note so that I wouldn't forget.
〜てしまう|to end up doing; to finish completely|財布[さいふ]を 忘[わす]れてしまいました。|I ended up forgetting my wallet.
〜ておく|to do in advance|旅行[りょこう]の 前[まえ]に ホテルを 予約[よやく]しておきます。|I'll book a hotel before the trip.
〜てみる|to try doing|この ラーメンを 食[た]べてみたいです。|I want to try this ramen.
〜ば|if (conditional)|時間[じかん]が あれば、 行[い]きます。|If I have time, I'll go.
〜なら|if (it's the case that)|京都[きょうと]に 行[い]くなら、 秋[あき]が いいですよ。|If you're going to Kyoto, autumn is good.
〜させる|to make / let someone do|母[はは]は 弟[おとうと]に 野菜[やさい]を 食[た]べさせました。|My mother made my brother eat vegetables.
〜られる (passive)|to have something done to you|先生[せんせい]に ほめられました。|I was praised by my teacher.
〜そうだ (looks)|looks like, seems|この ケーキは おいしそうです。|This cake looks delicious.
〜そうだ (heard)|I heard that|あしたは 寒[さむ]いそうです。|I heard it will be cold tomorrow.
〜によると|according to|天気予報[てんきよほう]によると、 雨[あめ]が ふるそうです。|According to the forecast, it will rain.
〜かもしれない|might, maybe|あしたは 雪[ゆき]が ふるかもしれません。|It might snow tomorrow.
〜べきだ|should, ought to|約束[やくそく]は 守[まも]るべきです。|You should keep your promises.
〜うちに|while (before it changes)|若[わか]いうちに いろいろな 国[くに]へ 行[い]きたいです。|I want to visit many countries while I'm young.
〜間に|while, during|寝[ね]ている 間[あいだ]に 雨[あめ]が ふりました。|It rained while I was sleeping.
〜について|about, concerning|日本[にほん]の 文化[ぶんか]について 調[しら]べています。|I'm researching Japanese culture.
〜にとって|for (someone)|私[わたし]にとって、 家族[かぞく]は 一番[いちばん] 大切[たいせつ]です。|For me, family is the most important thing.
〜ても|even if|雨[あめ]が ふっても、 行[い]きます。|Even if it rains, I'll go.
〜ずに|without doing|朝[あさ]ごはんを 食[た]べずに 家[いえ]を 出[で]ました。|I left home without eating breakfast.
`),
  ...G(2, `
〜わけにはいかない|can't (for social or moral reasons)|大事[だいじ]な 会議[かいぎ]なので、 休[やす]むわけには いきません。|It's an important meeting, so I can't take the day off.
〜ざるを得ない|have no choice but to|雨[あめ]なので、 試合[しあい]は 中止[ちゅうし]せざるを 得[え]ない。|Because of the rain, we have no choice but to cancel the match.
〜に違いない|must be, no doubt|あの 人[ひと]は 先生[せんせい]に 違[ちが]いない。|That person must be a teacher.
〜っぱなし|leaving something as it is|電気[でんき]を つけっぱなしで 寝[ね]てしまった。|I fell asleep with the light left on.
〜おかげで|thanks to|先生[せんせい]の おかげで 合格[ごうかく]できました。|Thanks to my teacher, I passed.
〜せいで|because of (a bad result)|雨[あめ]の せいで 電車[でんしゃ]が 遅[おく]れた。|The train was late because of the rain.
〜一方だ|keeps on (increasing or decreasing)|物価[ぶっか]は 上[あ]がる 一方[いっぽう]だ。|Prices just keep going up.
〜に関して|regarding|この 問題[もんだい]に 関[かん]して 質問[しつもん]が あります。|I have a question regarding this problem.
〜に対して|towards; in contrast to|目上[めうえ]の 人[ひと]に 対[たい]して 敬語[けいご]を 使[つか]う。|You use polite language towards your superiors.
〜にしては|for, considering|初[はじ]めてにしては 上手[じょうず]ですね。|You're good, considering it's your first time.
〜からこそ|precisely because|好[す]きだからこそ、 厳[きび]しく 言[い]うんです。|It's precisely because I care that I'm strict.
〜ものの|although|日本語[にほんご]を 勉強[べんきょう]したものの、 まだ 話[はな]せない。|Although I studied Japanese, I still can't speak it.
〜とともに|together with; as|年[とし]を とるとともに、 体力[たいりょく]が 落[お]ちる。|As you get older, your stamina declines.
〜にもかかわらず|despite|雨[あめ]にもかかわらず、 たくさんの 人[ひと]が 来[き]た。|Despite the rain, many people came.
〜次第|as soon as|着[つ]き次第[しだい]、 連絡[れんらく]します。|I'll contact you as soon as I arrive.
〜たとたん|the moment that|家[いえ]を 出[で]たとたん、 雨[あめ]が ふり出[だ]した。|The moment I left home, it started to rain.
〜ついでに|while (doing something else)|買[か]い物[もの]の ついでに 郵便局[ゆうびんきょく]に 寄[よ]った。|While out shopping, I stopped by the post office.
〜わけがない|there's no way that|こんな 難[むずか]しい 問題[もんだい]、 わかるわけがない。|There's no way I can understand such a hard problem.
〜ことはない|there's no need to|心配[しんぱい]する ことはないよ。|There's no need to worry.
〜に過ぎない|nothing more than|それは うわさに 過[す]ぎない。|That's nothing more than a rumour.
〜をはじめ|starting with, including|東京[とうきょう]をはじめ、 大[おお]きな 町[まち]は 人[ひと]が 多[おお]い。|Big cities, starting with Tokyo, are crowded.
〜につれて|as (one thing changes, so does another)|日本語[にほんご]が 上手[じょうず]に なるにつれて、 生活[せいかつ]が 楽[たの]しくなった。|As my Japanese improved, life became more fun.
〜かねない|could (something bad)|そんな 運転[うんてん]をしたら、 事故[じこ]を 起[お]こしかねない。|Driving like that could cause an accident.
〜てたまらない|unbearably; dying to|会[あ]いたくて たまらない。|I'm dying to see you.
〜うえで|after (doing carefully)|よく 考[かんが]えた うえで 決[き]めます。|I'll decide after thinking it over carefully.
〜反面|but on the other hand|都会[とかい]は 便利[べんり]な 反面[はんめん]、 物価[ぶっか]が 高[たか]い。|Cities are convenient, but on the other hand prices are high.
〜ことか|how very…!|どんなに 会[あ]いたかったことか。|How much I wanted to see you!
〜わりに|considering|この 店[みせ]は 安[やす]い わりに おいしい。|This shop is tasty, considering how cheap it is.
〜からといって|just because|高[たか]いからといって、 いいものとは 限[かぎ]らない。|Just because it's expensive doesn't mean it's good.
〜とは限らない|not necessarily|日本人[にほんじん]が みんな すしが 好[す]きだとは 限[かぎ]らない。|Not every Japanese person necessarily likes sushi.
`),
  ...G(1, `
〜ならではの|unique to|これは 京都[きょうと]ならではの 景色[けしき]だ。|This is scenery you only find in Kyoto.
〜をもって|as of; by means of|本日[ほんじつ]をもって 閉店[へいてん]いたします。|We will close as of today.
〜を余儀なくされる|to be forced to|台風[たいふう]で 旅行[りょこう]の 中止[ちゅうし]を 余儀[よぎ]なくされた。|We were forced to cancel the trip because of the typhoon.
〜んばかりに|as if about to|泣[な]かんばかりの 顔[かお]で 謝[あやま]った。|He apologised, looking as if he were about to cry.
〜ともなると|when it comes to (a higher level)|社長[しゃちょう]ともなると、 忙[いそが]しさが 違[ちが]う。|When you're a company president, the busyness is on another level.
〜をものともせず|in defiance of|彼[かれ]は けがを ものともせず 走[はし]り続[つづ]けた。|He kept running in defiance of his injury.
〜に至っては|as for (the extreme case)|弟[おとうと]に 至[いた]っては 卵[たまご]も 焼[や]けない。|As for my younger brother, he can't even fry an egg.
〜てやまない|never stop (wishing, hoping)|皆様[みなさま]の 幸[しあわ]せを 願[ねが]ってやみません。|I never stop wishing for everyone's happiness.
〜ずにはいられない|can't help doing|その 話[はなし]を 聞[き]いて、 泣[な]かずには いられなかった。|Hearing that story, I couldn't help crying.
〜を禁じ得ない|can't help feeling|彼[かれ]の 話[はなし]には 同情[どうじょう]を 禁[きん]じ得[え]ない。|I can't help feeling sympathy at his story.
〜といったらない|indescribably|その 時[とき]の うれしさと いったらなかった。|The joy I felt then was indescribable.
〜べからず|must not (formal signs)|芝生[しばふ]に 入[はい]るべからず。|Keep off the grass.
〜まじき|unbecoming of|教師[きょうし]に あるまじき 行為[こうい]だ。|That is conduct unbecoming of a teacher.
〜が早いか|no sooner than|ベルが 鳴[な]るが 早[はや]いか、 生徒[せいと]たちは 教室[きょうしつ]を 飛[と]び出[だ]した。|No sooner had the bell rung than the students ran out of the classroom.
〜や否や|as soon as|家[いえ]に 着[つ]くや 否[いな]や、 寝[ね]てしまった。|As soon as I got home, I fell asleep.
〜そばから|as soon as (again and again)|覚[おぼ]えるそばから 忘[わす]れてしまう。|I forget things as soon as I learn them.
〜にかたくない|not hard to (imagine)|彼女[かのじょ]の 気持[きも]ちは 想像[そうぞう]に かたくない。|Her feelings are not hard to imagine.
〜に足る|worthy of|彼[かれ]は 信頼[しんらい]に 足[た]る 人物[じんぶつ]だ。|He is a person worthy of trust.
〜とあって|because (of a special situation)|連休[れんきゅう]とあって、 観光地[かんこうち]は 込[こ]んでいる。|Because it's a long weekend, tourist spots are crowded.
〜かたがた|while also (formal)|お礼[れい]かたがた ご挨拶[あいさつ]に 伺[うかが]いました。|I came to greet you and to thank you.
〜までもない|no need to (it's obvious)|言[い]うまでもなく、 健康[けんこう]は 大切[たいせつ]だ。|Needless to say, health is important.
〜ものを|if only (regret)|もっと 早[はや]く 言[い]えば よかったものを。|If only you had said so earlier.
〜とはいえ|although, even so|春[はる]とはいえ、 まだ 寒[さむ]い。|Although it's spring, it's still cold.
〜をよそに|ignoring|親[おや]の 心配[しんぱい]を よそに、 彼[かれ]は 海外[かいがい]へ 行[い]った。|Ignoring his parents' worries, he went abroad.
〜ずくめ|nothing but|今年[ことし]は いいことずくめだった。|This year was nothing but good things.
〜きらいがある|to tend to (something bad)|彼[かれ]は 物事[ものごと]を 大[おお]げさに 言[い]う きらいが ある。|He has a tendency to exaggerate.
〜にひきかえ|in contrast to|兄[あに]にひきかえ、 弟[おとうと]は まじめだ。|Unlike his older brother, the younger one is serious.
〜いかんによらず|regardless of|理由[りゆう]の いかんによらず、 遅刻[ちこく]は 認[みと]めません。|Regardless of the reason, lateness is not allowed.
〜ながらも|although, while|狭[せま]いながらも 楽[たの]しい 我[わ]が家[や]。|Our home is small, but happy.
〜てからというもの|ever since|日本[にほん]に 来[き]てからというもの、 毎日[まいにち]が 新鮮[しんせん]だ。|Ever since coming to Japan, every day has felt fresh.
`),
];
