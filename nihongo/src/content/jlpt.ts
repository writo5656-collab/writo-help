// JLPT track lessons. See types.ts for the furigana notation.
import { type Lesson, vs, SRC } from './types';

const L = (o: Omit<Lesson, 'track' | 'source' | 'level'> & { level?: Lesson['level'] }): Lesson =>
  ({ level: 'N5', ...o, track: 'jlpt', source: SRC });

export const JLPT_LESSONS: Lesson[] = [
  L({
    id: 'n5-01', title: 'A is B', jp: 'AはBです', goal: 'Say who you are and what something is, politely.',
    kanji: '私学生先人日本',
    vocab: vs(`私|わたし|I, me
学生|がくせい|student
先生|せんせい|teacher
日本人|にほんじん|Japanese person
会社員|かいしゃいん|office worker
友だち|ともだち|friend
田中さん|たなかさん|Mr./Ms. Tanaka`),
    grammar: [
      { p: 'A は B です', e: 'は (written "ha", read "wa") marks the topic. です makes the sentence polite, like "is / am / are". A は B です = "A is B".' },
      { p: '〜さん', e: 'Add さん after someone else\'s name to be polite. Never add it to your own name.' },
    ],
    sentences: [
      { f: '私[わたし]{は} 学生[がくせい]です。', en: 'I am a student.' },
      { f: '田中[たなか]さん{は} 先生[せんせい]です。', en: 'Mr. Tanaka is a teacher.', alt: ['田中[たなか]さんは 先生[せんせい]です。'] },
      { f: '私[わたし]{は} 会社員[かいしゃいん]です。', en: 'I am an office worker.' },
      { f: '田中[たなか]さん{は} 日本人[にほんじん]です。', en: 'Ms. Tanaka is Japanese.' },
      { f: '田中[たなか]さん{は} 友[とも]だちです。', en: 'Mr. Tanaka is a friend.' },
    ],
  }),
  L({
    id: 'n5-02', title: 'This, that and whose', jp: 'これ・それ・あれ', goal: 'Point at things and say who they belong to.',
    kanji: '本語名',
    vocab: vs(`これ||this (near me)
それ||that (near you)
あれ||that over there
本|ほん|book
かばん||bag
かさ||umbrella
名前|なまえ|name
日本語|にほんご|Japanese language`),
    grammar: [
      { p: 'これ / それ / あれ', e: 'これ is near the speaker, それ is near the listener, あれ is far from both.' },
      { p: 'A の B', e: 'の links two nouns. 私の本 = "my book", 日本語の本 = "a Japanese-language book".' },
    ],
    sentences: [
      { f: 'これ{は} 本[ほん]です。', en: 'This is a book.' },
      { f: 'それは 私[わたし]{の} かばんです。', en: 'That is my bag.' },
      { f: 'あれは 先生[せんせい]{の} かさです。', en: 'That over there is the teacher\'s umbrella.' },
      { f: 'これは 日本語[にほんご]{の} 本[ほん]です。', en: 'This is a Japanese book.' },
      { f: '私[わたし]{の} 名前[なまえ]は 田中[たなか]です。', en: 'My name is Tanaka.' },
    ],
  }),
  L({
    id: 'n5-03', title: 'Questions and "not"', jp: 'ですか・じゃありません', goal: 'Ask yes/no questions, ask "what", and say something is not so.',
    kanji: '何',
    vocab: vs(`はい||yes
いいえ||no
何|なに|what
そうです||that's right
ちがいます||that's wrong / it is different
だれ||who
アメリカ人|アメリカじん|American person`),
    grammar: [
      { p: '〜ですか', e: 'Add か to the end of a sentence to make it a question. Word order does not change, and no question mark is needed.' },
      { p: '〜じゃありません', e: 'The polite negative of です. In formal writing it becomes ではありません.' },
      { p: '何ですか', e: '何 is read なん before です. これは何ですか = "What is this?"' },
    ],
    sentences: [
      { f: 'あなたは 学生[がくせい]です{か}。', en: 'Are you a student?' },
      { f: 'これは 何[なん]です{か}。', en: 'What is this?' },
      { f: 'いいえ、 学生[がくせい]じゃありません。', en: 'No, I am not a student.', alt: ['いいえ、 学生[がくせい]ではありません。'] },
      { f: 'はい、 そうです。', en: 'Yes, that\'s right.' },
      { f: 'あの 人[ひと]は だれです{か}。', en: 'Who is that person?' },
      { f: '私[わたし]は アメリカ人[じん]じゃありません。', en: 'I am not American.', alt: ['私[わたし]は アメリカ人[じん]ではありません。'] },
    ],
  }),
  L({
    id: 'n5-04', title: 'Doing things', jp: '〜を〜ます', goal: 'Say what you eat, drink, read and do every day.',
    kanji: '水食飲見読毎',
    vocab: vs(`水|みず|water
お茶|おちゃ|green tea
ごはん||cooked rice, meal
パン||bread
飲みます|のみます|to drink
食べます|たべます|to eat
見ます|みます|to watch, see
読みます|よみます|to read
毎日|まいにち|every day
テレビ||television`),
    grammar: [
      { p: '[thing] を [verb]ます', e: 'を marks the thing the action is done to. The verb always comes last. 〜ます is the polite present/future form.' },
      { p: '〜ません', e: 'Change ます to ません for the negative: 飲みます → 飲みません (do not drink).' },
    ],
    sentences: [
      { f: '私[わたし]は 水[みず]{を} 飲[の]みます。', en: 'I drink water.', note: '水 is the thing being drunk, so it takes を.' },
      { f: '私[わたし]は パン{を} 食[た]べます。', en: 'I eat bread.' },
      { f: '毎日[まいにち] テレビ{を} 見[み]ます。', en: 'I watch television every day.' },
      { f: '田中[たなか]さんは 本[ほん]{を} 読[よ]みます。', en: 'Mr. Tanaka reads books.' },
      { f: '私[わたし]は お茶[ちゃ]{を} 飲[の]みません。', en: 'I do not drink green tea.' },
      { f: '何[なに]{を} 食[た]べますか。', en: 'What will you eat?' },
    ],
  }),
  L({
    id: 'n5-05', title: 'Going places, and when', jp: '〜に行きます', goal: 'Say where you go and at what time.',
    kanji: '行来学校時今',
    vocab: vs(`行きます|いきます|to go
来ます|きます|to come
帰ります|かえります|to return home
学校|がっこう|school
うち||home
日本|にほん|Japan
あした||tomorrow
七時|しちじ|seven o'clock
今|いま|now
起きます|おきます|to get up`),
    grammar: [
      { p: '[place] に / へ 行きます', e: 'に (or へ, read "e") marks the destination for 行きます, 来ます and 帰ります.' },
      { p: '[time] に', e: 'に also marks a specific clock time or date: 七時に = "at seven". Words like あした and 毎日 do not take に.' },
    ],
    sentences: [
      { f: '私[わたし]は 学校[がっこう]{に} 行[い]きます。', en: 'I go to school.', alt: ['私[わたし]は 学校[がっこう]へ 行[い]きます。'] },
      { f: 'あした 日本[にほん]{に} 行[い]きます。', en: 'I will go to Japan tomorrow.', alt: ['あした 日本[にほん]へ 行[い]きます。'] },
      { f: '七時[しちじ]{に} 起[お]きます。', en: 'I get up at seven o\'clock.' },
      { f: '友[とも]だちが うち{に} 来[き]ます。', en: 'A friend is coming to my home.', alt: ['友[とも]だちが うちへ 来[き]ます。'] },
      { f: '何時[なんじ]{に} 帰[かえ]りますか。', en: 'What time will you go home?' },
    ],
  }),
  L({
    id: 'n5-06', title: 'Where and how', jp: '〜で', goal: 'Say where an action happens and what you use to do it.',
    kanji: '電車買店',
    vocab: vs(`電車|でんしゃ|train
バス||bus
レストラン||restaurant
店|みせ|shop
買います|かいます|to buy
勉強します|べんきょうします|to study
図書館|としょかん|library
はし||chopsticks`),
    grammar: [
      { p: '[place] で [action]', e: 'で marks the place where an action is carried out: レストランで食べます = "eat at a restaurant".' },
      { p: '[means] で', e: 'で also marks a tool or means of transport: 電車で行きます = "go by train", はしで食べます = "eat with chopsticks".' },
    ],
    sentences: [
      { f: 'レストラン{で} ごはんを 食[た]べます。', en: 'I eat a meal at a restaurant.' },
      { f: '電車[でんしゃ]{で} 学校[がっこう]に 行[い]きます。', en: 'I go to school by train.', alt: ['電車[でんしゃ]で 学校[がっこう]へ 行[い]きます。'] },
      { f: '図書館[としょかん]{で} 勉強[べんきょう]します。', en: 'I study at the library.' },
      { f: '店[みせ]{で} 水[みず]を 買[か]います。', en: 'I buy water at a shop.' },
      { f: 'はし{で} 食[た]べます。', en: 'I eat with chopsticks.' },
    ],
  }),
  L({
    id: 'n5-07', title: 'There is / there are', jp: 'あります・います', goal: 'Say what exists and where things and people are.',
    kanji: '上下中前駅',
    vocab: vs(`あります||to exist (things)
います||to exist (people, animals)
ねこ||cat
つくえ||desk
上|うえ|on top, above
下|した|under
中|なか|inside
駅|えき|station
前|まえ|in front
トイレ||toilet
どこ||where`),
    grammar: [
      { p: '[place] に [thing] が あります', e: 'あります is for things without life; います is for people and animals. The thing that exists takes が, the location takes に.' },
      { p: 'A の 上 / 下 / 中 / 前', e: 'Position words follow の: つくえの上 = "on top of the desk".' },
    ],
    sentences: [
      { f: 'つくえの 上[うえ]に 本[ほん]{が} あります。', en: 'There is a book on the desk.' },
      { f: 'かばんの 中[なか]に かさ{が} あります。', en: 'There is an umbrella in the bag.' },
      { f: 'うちに ねこ{が} います。', en: 'There is a cat at home.' },
      { f: 'トイレは どこ{に} ありますか。', en: 'Where is the toilet?', alt: ['トイレは どこですか。'] },
      { f: '駅[えき]の 前[まえ]に 店[みせ]{が} あります。', en: 'There is a shop in front of the station.' },
    ],
  }),
  L({
    id: 'n5-08', title: 'Describing things', jp: 'い・な形容詞', goal: 'Describe things with the two kinds of Japanese adjectives.',
    kanji: '大小高安新古',
    vocab: vs(`大きい|おおきい|big
小さい|ちいさい|small
高い|たかい|expensive, tall
安い|やすい|cheap
新しい|あたらしい|new
おいしい||delicious
きれい||pretty, clean
しずか||quiet
元気|げんき|well, energetic
とても||very`),
    grammar: [
      { p: 'い-adjectives', e: 'End in い: 高い, おいしい. Negative: drop い and add くないです → 高くないです (not expensive).' },
      { p: 'な-adjectives', e: 'きれい, しずか, 元気. Before a noun they take な (しずかな店). Negative: じゃありません.' },
    ],
    sentences: [
      { f: 'この 本[ほん]は 高[たか]いです。', en: 'This book is expensive.' },
      { f: 'この パンは とても おいしいです。', en: 'This bread is very delicious.' },
      { f: 'その かばんは 高[たか]くないです。', en: 'That bag is not expensive.', alt: ['その かばんは 高[たか]くありません。'] },
      { f: 'ここは しずかです。', en: 'It is quiet here.' },
      { f: 'あれは 新[あたら]しい 店[みせ]です。', en: 'That over there is a new shop.' },
      { f: 'お元気[げんき]です{か}。', en: 'How are you? (Are you well?)' },
    ],
  }),
  L({
    id: 'n5-09', title: 'Talking about the past', jp: '〜ました・でした', goal: 'Say what you did and how things were.',
    kanji: '昨週休書',
    vocab: vs(`きのう||yesterday
先週|せんしゅう|last week
えいが||film, movie
休みます|やすみます|to rest
書きます|かきます|to write
手紙|てがみ|letter
楽しい|たのしい|fun
あつい||hot (weather)`),
    grammar: [
      { p: '〜ました / 〜ませんでした', e: 'Past of verbs: ます → ました (did), ません → ませんでした (did not).' },
      { p: '〜でした / 〜かったです', e: 'Nouns and な-adjectives use でした. い-adjectives drop い and add かったです: 楽しい → 楽しかったです.' },
    ],
    sentences: [
      { f: 'きのう えいが{を} 見[み]ました。', en: 'I watched a film yesterday.' },
      { f: '先週[せんしゅう] 日本[にほん]に 行[い]きました。', en: 'I went to Japan last week.', alt: ['先週[せんしゅう] 日本[にほん]へ 行[い]きました。'] },
      { f: 'きのうは 勉強[べんきょう]しませんでした。', en: 'I did not study yesterday.' },
      { f: 'えいがは 楽[たの]しかったです。', en: 'The film was fun.' },
      { f: 'きのうは 休[やす]みでした。', en: 'Yesterday was a day off.' },
      { f: '友[とも]だちに 手紙[てがみ]{を} 書[か]きました。', en: 'I wrote a letter to a friend.' },
    ],
  }),
  L({
    id: 'n5-10', title: 'Inviting and suggesting', jp: '〜ましょう・ませんか', goal: 'Invite someone, suggest doing something together, and accept.',
    kanji: '会話友',
    vocab: vs(`いっしょに||together
会います|あいます|to meet
話します|はなします|to speak
コーヒー||coffee
いいですね||that sounds good
ちょっと||a little; (softly) not really
土曜日|どようび|Saturday`),
    grammar: [
      { p: '〜ませんか', e: 'A polite invitation: "Won\'t you…? / Would you like to…?" 食べませんか = "Would you like to eat?"' },
      { p: '〜ましょう', e: '"Let\'s…". 行きましょう = "Let\'s go."' },
      { p: '[person] と', e: 'と means "with": 友だちと行きます = "go with a friend".' },
    ],
    sentences: [
      { f: 'いっしょに コーヒーを 飲[の]みませんか。', en: 'Would you like to have coffee together?' },
      { f: 'いいですね。 行[い]きましょう。', en: 'That sounds good. Let\'s go.' },
      { f: '友[とも]だち{と} えいがを 見[み]ます。', en: 'I watch a film with a friend.' },
      { f: '土曜日[どようび]に 会[あ]いましょう。', en: 'Let\'s meet on Saturday.' },
      { f: '日本語[にほんご]{で} 話[はな]しましょう。', en: 'Let\'s speak in Japanese.' },
    ],
  }),
  L({
    id: 'n5-11', title: 'Likes, skills and wants', jp: '〜が好きです・〜たいです', goal: 'Say what you like, what you are good at and what you want to do.',
    kanji: '好手上',
    vocab: vs(`好き|すき|liked, favourite
上手|じょうず|skilled
すし||sushi
音楽|おんがく|music
料理|りょうり|cooking, cuisine
ほしい||want (a thing)
旅行|りょこう|travel`),
    grammar: [
      { p: '[thing] が 好きです', e: 'The thing you like takes が, not を. Negative: 好きじゃありません.' },
      { p: '[verb stem] たいです', e: 'Replace ます with たいです to say "want to do": 行きます → 行きたいです.' },
    ],
    sentences: [
      { f: '私[わたし]は すし{が} 好[す]きです。', en: 'I like sushi.' },
      { f: '田中[たなか]さんは 料理[りょうり]{が} 上手[じょうず]です。', en: 'Ms. Tanaka is good at cooking.' },
      { f: '日本[にほん]に 行[い]きたいです。', en: 'I want to go to Japan.', alt: ['日本[にほん]へ 行[い]きたいです。'] },
      { f: '音楽[おんがく]{が} 好[す]きですか。', en: 'Do you like music?' },
      { f: '新[あたら]しい かばん{が} ほしいです。', en: 'I want a new bag.' },
      { f: '日本語[にほんご]を 勉強[べんきょう]したいです。', en: 'I want to study Japanese.' },
    ],
  }),
  L({
    id: 'n5-12', title: 'The て-form', jp: '〜てください・〜ています', goal: 'Make polite requests and say what is happening right now.',
    kanji: '言聞立待',
    vocab: vs(`待ちます|まちます|to wait
聞きます|ききます|to listen, ask
言います|いいます|to say
見せます|みせます|to show
もう一度|もういちど|once more
ゆっくり||slowly
今|いま|now
雨|あめ|rain`),
    grammar: [
      { p: '〜てください', e: 'て-form + ください = "please do…". 待ちます → 待って, 見ます → 見て, 言います → 言って, 書きます → 書いて, 飲みます → 飲んで.' },
      { p: '〜ています', e: 'て-form + います describes an action in progress: 食べています = "am eating".' },
    ],
    sentences: [
      { f: 'ちょっと 待[ま]ってください。', en: 'Please wait a moment.' },
      { f: 'もう 一度[いちど] 言[い]ってください。', en: 'Please say it once more.' },
      { f: 'ゆっくり 話[はな]してください。', en: 'Please speak slowly.' },
      { f: '今[いま] ごはんを 食[た]べています。', en: 'I am eating a meal now.' },
      { f: '雨[あめ]{が} ふっています。', en: 'It is raining.' },
      { f: 'これを 見[み]てください。', en: 'Please look at this.' },
    ],
  }),
  L({
    id: 'n5-13', title: 'Numbers, prices and time', jp: 'いくらですか', goal: 'Understand prices, count things and tell the time.',
    kanji: '一二三四五六七八九十百千万円半分',
    vocab: vs(`いくら||how much
百円|ひゃくえん|100 yen
千円|せんえん|1,000 yen
一つ|ひとつ|one (thing)
二つ|ふたつ|two (things)
三時半|さんじはん|half past three
午後|ごご|p.m.
ぜんぶで||in total`),
    grammar: [
      { p: 'いくらですか', e: '"How much is it?" Prices are number + 円 (えん).' },
      { p: 'Counting things', e: 'For general objects use ひとつ, ふたつ, みっつ… The number comes after を: パンを二つ買います.' },
    ],
    sentences: [
      { f: 'これは いくらです{か}。', en: 'How much is this?' },
      { f: 'それは 五百円[ごひゃくえん]です。', en: 'That is 500 yen.' },
      { f: 'パンを 二[ふた]つ ください。', en: 'Two pieces of bread, please.' },
      { f: '今[いま] 三時半[さんじはん]です。', en: 'It is half past three now.' },
      { f: 'ぜんぶで 千円[せんえん]です。', en: 'It is 1,000 yen in total.' },
    ],
  }),
  L({
    id: 'n5-14', title: 'From, until and also', jp: '〜から〜まで・も', goal: 'Talk about ranges of time and place, and say "too".',
    kanji: '月火水木金土午後',
    vocab: vs(`から||from
まで||until, as far as
月曜日|げつようび|Monday
金曜日|きんようび|Friday
仕事|しごと|work, job
九時|くじ|nine o'clock
五時|ごじ|five o'clock
東京|とうきょう|Tokyo`),
    grammar: [
      { p: 'A から B まで', e: '"From A to B", for both time and place.' },
      { p: '〜も', e: 'も means "also / too" and replaces は, が or を: 私も学生です = "I am a student too."' },
    ],
    sentences: [
      { f: '仕事[しごと]は 九時[くじ]{から} 五時[ごじ]までです。', en: 'Work is from nine to five.' },
      { f: '月曜日[げつようび]から 金曜日[きんようび]{まで} 勉強[べんきょう]します。', en: 'I study from Monday to Friday.' },
      { f: '私[わたし]{も} 学生[がくせい]です。', en: 'I am a student too.' },
      { f: '東京[とうきょう]{まで} 電車[でんしゃ]で 行[い]きます。', en: 'I go as far as Tokyo by train.' },
      { f: 'お茶[ちゃ]{も} 飲[の]みます。', en: 'I drink green tea too.' },
    ],
  }),
  // ---------------------------------------------------------------- N4 starter
  L({
    id: 'n4-01', level: 'N4', title: 'Can do', jp: '〜ことができます', goal: 'Say what you can and cannot do.',
    vocab: vs(`できます||can do
泳ぎます|およぎます|to swim
漢字|かんじ|kanji
運転|うんてん|driving
少し|すこし|a little
ピアノ||piano
ひきます||to play (an instrument)`),
    grammar: [
      { p: '[dictionary form] ことが できます', e: '"Can do". Use the plain (dictionary) form of the verb: 読みます → 読む → 読むことができます.' },
      { p: '[noun] が できます', e: 'With nouns: 日本語ができます = "I can speak Japanese".' },
    ],
    sentences: [
      { f: '私[わたし]は 漢字[かんじ]を 読[よ]む ことが できます。', en: 'I can read kanji.', alt: ['私[わたし]は 漢字[かんじ]が 読[よ]めます。'] },
      { f: '日本語[にほんご]{が} 少[すこ]し できます。', en: 'I can speak a little Japanese.' },
      { f: '田中[たなか]さんは ピアノを ひく ことが できます。', en: 'Mr. Tanaka can play the piano.', alt: ['田中[たなか]さんは ピアノが ひけます。'] },
      { f: '私[わたし]は 泳[およ]ぐ ことが できません。', en: 'I cannot swim.', alt: ['私[わたし]は 泳[およ]げません。'] },
    ],
  }),
  L({
    id: 'n4-02', level: 'N4', title: 'Experience', jp: '〜たことがあります', goal: 'Talk about things you have (or have never) done.',
    vocab: vs(`富士山|ふじさん|Mt. Fuji
登ります|のぼります|to climb
一度|いちど|once
まだ||not yet, still
なっとう||natto (fermented soybeans)
京都|きょうと|Kyoto`),
    grammar: [
      { p: '[た-form] ことが あります', e: '"Have done before". The た-form is made like the て-form with た: 行って → 行った, 食べて → 食べた.' },
    ],
    sentences: [
      { f: '日本[にほん]{に} 行[い]った ことが あります。', en: 'I have been to Japan.', alt: ['日本[にほん]へ 行[い]った ことが あります。'] },
      { f: 'なっとうを 食[た]べた ことが ありますか。', en: 'Have you ever eaten natto?' },
      { f: '富士山[ふじさん]に 登[のぼ]った ことが ありません。', en: 'I have never climbed Mt. Fuji.' },
      { f: '一度[いちど] 京都[きょうと]に 行[い]った ことが あります。', en: 'I have been to Kyoto once.', alt: ['一度[いちど] 京都[きょうと]へ 行[い]った ことが あります。'] },
    ],
  }),
  L({
    id: 'n4-03', level: 'N4', title: 'I think that…', jp: '〜と思います', goal: 'Give your opinion or a guess using the plain form.',
    vocab: vs(`思います|おもいます|to think
たぶん||probably
便利|べんり|convenient
むずかしい||difficult
来る|くる|to come (plain form)
あした||tomorrow`),
    grammar: [
      { p: '[plain form] と 思います', e: '"I think that…". The sentence before と is in plain form: 高いです → 高い, 来ます → 来る, 便利です → 便利だ.' },
    ],
    sentences: [
      { f: '日本語[にほんご]は むずかしいと 思[おも]います。', en: 'I think Japanese is difficult.' },
      { f: '田中[たなか]さんは あした 来[く]ると 思[おも]います。', en: 'I think Mr. Tanaka will come tomorrow.' },
      { f: '電車[でんしゃ]{は} 便利[べんり]だと 思[おも]います。', en: 'I think trains are convenient.' },
      { f: 'たぶん 雨[あめ]が ふると 思[おも]います。', en: 'I think it will probably rain.' },
    ],
  }),
  L({
    id: 'n4-04', level: 'N4', title: 'The "can" form', jp: '読める・食べられる', goal: 'Say what you can and cannot do with the short potential form.',
    vocab: vs(`読めます|よめます|can read
書けます|かけます|can write
話せます|はなせます|can speak
食べられます|たべられます|can eat
来られます|こられます|can come
英語|えいご|English
写真|しゃしん|photo
さしみ||sashimi`),
    grammar: [
      { p: 'u-verbs: -u → -eる', e: 'Change the last sound to the e-row and add る: 読む → 読める, 話す → 話せる, 泳ぐ → 泳げる. Polite: 読めます.' },
      { p: 'ru-verbs: る → られる', e: '食べる → 食べられる, 見る → 見られる. Irregular: する → できる, くる → こられる.' },
      { p: 'Object with が', e: 'With the potential form the object is usually marked with が: 漢字が読めます. を is also heard.' },
    ],
    sentences: [
      { f: '私[わたし]は 漢字[かんじ]{が} 読[よ]めます。', en: 'I can read kanji.', alt: ['私[わたし]は 漢字[かんじ]を 読[よ]めます。'] },
      { f: '田中[たなか]さんは 英語[えいご]{が} 話[はな]せます。', en: 'Mr. Tanaka can speak English.', alt: ['田中[たなか]さんは 英語[えいご]を 話[はな]せます。'] },
      { f: '私[わたし]は さしみ{が} 食[た]べられません。', en: 'I can\'t eat sashimi.', alt: ['私[わたし]は さしみを 食[た]べられません。'] },
      { f: 'ここで 写真[しゃしん]{が} とれます。', en: 'You can take photos here.', alt: ['ここで 写真[しゃしん]を とれます。', 'ここで 写真[しゃしん]が 撮[と]れます。'] },
      { f: 'あした 来[こ]られますか。', en: 'Can you come tomorrow?' },
    ],
  }),
  L({
    id: 'n4-05', level: 'N4', title: 'If and when', jp: '〜たら', goal: 'Say what happens if or when something happens.',
    vocab: vs(`雨|あめ|rain
ふります||to fall (rain, snow)
着きます|つきます|to arrive
時間|じかん|time
ひま||free (not busy)
電話|でんわ|phone call
映画|えいが|film, movie`),
    grammar: [
      { p: '[た-form] ら', e: 'Add ら to the past plain form for "if" or "when": 雨が降ったら = if it rains. 着いたら = when (I) arrive.' },
      { p: 'Adjectives and nouns', e: 'い-adjectives: 安かったら. な-adjectives and nouns: ひまだったら, 学生だったら.' },
    ],
    sentences: [
      { f: '雨[あめ]{が} ふったら、 行[い]きません。', en: 'If it rains, I won\'t go.', alt: ['雨[あめ]が 降[ふ]ったら、 行[い]きません。'] },
      { f: '駅[えき]に 着[つ]いたら、 電話[でんわ]{を} ください。', en: 'Please call me when you arrive at the station.', alt: ['駅[えき]に 着[つ]いたら、 電話[でんわ]して ください。'] },
      { f: '時間[じかん]{が} あったら、 映画[えいが]を 見[み]ます。', en: 'If I have time, I\'ll watch a film.' },
      { f: '安[やす]かったら、 買[か]います。', en: 'If it\'s cheap, I\'ll buy it.' },
      { f: 'ひまだったら、 いっしょに 行[い]きませんか。', en: 'If you\'re free, would you like to go together?' },
    ],
  }),
  L({
    id: 'n4-06', level: 'N4', title: 'Giving and receiving', jp: 'あげる・くれる・もらう', goal: 'Talk about gifts: who gives what to whom.',
    vocab: vs(`あげます||to give (to someone else)
くれます||to give (to me)
もらいます||to receive
プレゼント||present
誕生日|たんじょうび|birthday
花|はな|flower
母|はは|my mother
妹|いもうと|my younger sister`),
    grammar: [
      { p: 'A は B に X を あげます', e: 'A gives X to B, going away from the speaker. 私は友だちに本をあげました.' },
      { p: 'A が 私に X を くれます', e: 'Someone gives X to me (or my family). The receiver is always the speaker\'s side.' },
      { p: 'A は B に / から X を もらいます', e: 'A receives X from B. The giver takes に or から.' },
    ],
    sentences: [
      { f: '私[わたし]は 友[とも]だち{に} 本[ほん]を あげました。', en: 'I gave a book to a friend.' },
      { f: '友[とも]だちが 私[わたし]{に} 花[はな]を くれました。', en: 'A friend gave me flowers.' },
      { f: '私[わたし]は 母[はは]{に} プレゼントを もらいました。', en: 'I received a present from my mother.', alt: ['私[わたし]は 母[はは]から プレゼントを もらいました。'] },
      { f: '誕生日[たんじょうび]{に} 何[なに]を もらいましたか。', en: 'What did you get for your birthday?' },
      { f: '妹[いもうと]{に} ケーキを あげます。', en: 'I\'ll give my younger sister some cake.' },
    ],
  }),
  L({
    id: 'n4-07', level: 'N4', title: 'Must and don\'t have to', jp: '〜なければなりません', goal: 'Say what you have to do, and what you don\'t need to do.',
    vocab: vs(`薬|くすり|medicine
宿題|しゅくだい|homework
早く|はやく|early
起きます|おきます|to get up
払います|はらいます|to pay
お金|おかね|money`),
    grammar: [
      { p: '[ない-form without い] + ければなりません', e: '"Must". 飲まない → 飲まなければなりません, しない → しなければなりません. In speech this is often shortened to 〜なきゃ.' },
      { p: '[ない-form without い] + くてもいいです', e: '"Don\'t have to". 払わない → 払わなくてもいいです.' },
    ],
    sentences: [
      { f: '毎日[まいにち] 薬[くすり]{を} 飲[の]まなければ なりません。', en: 'I have to take medicine every day.' },
      { f: 'あした 早[はや]く 起[お]きなければ なりません。', en: 'I have to get up early tomorrow.' },
      { f: '宿題[しゅくだい]{を} しなければ なりません。', en: 'I have to do my homework.' },
      { f: 'お金[かね]{を} 払[はら]わなくても いいです。', en: 'You don\'t have to pay.' },
      { f: 'あした 学校[がっこう]{に} 行[い]かなくても いいです。', en: 'You don\'t have to go to school tomorrow.', alt: ['あした 学校[がっこう]へ 行[い]かなくても いいです。'] },
    ],
  }),
  L({
    id: 'n4-08', level: 'N4', title: 'May I? You must not', jp: '〜てもいい・〜てはいけない', goal: 'Ask permission and understand rules and signs.',
    vocab: vs(`とります||to take (a photo)
すいます||to smoke
たばこ||cigarette
入ります|はいります|to enter
座ります|すわります|to sit
部屋|へや|room
教室|きょうしつ|classroom`),
    grammar: [
      { p: '[て-form] も いいです(か)', e: '"May (I)…?" ここで写真をとってもいいですか = May I take photos here?' },
      { p: '[て-form] は いけません', e: '"Must not". Common on signs and in rules: ここでたばこをすってはいけません.' },
    ],
    sentences: [
      { f: 'ここで 写真[しゃしん]{を} とっても いいですか。', en: 'May I take photos here?', alt: ['ここで 写真[しゃしん]を 撮[と]っても いいですか。'] },
      { f: 'ここで たばこ{を} すっては いけません。', en: 'You must not smoke here.', alt: ['ここで たばこを 吸[す]っては いけません。'] },
      { f: 'この 部屋[へや]{に} 入[はい]っても いいです。', en: 'You may enter this room.' },
      { f: 'ここに 座[すわ]っても いいですか。', en: 'May I sit here?' },
      { f: '教室[きょうしつ]{で} 食[た]べては いけません。', en: 'You must not eat in the classroom.' },
    ],
  }),
  L({
    id: 'n4-09', level: 'N4', title: 'Plans and intentions', jp: '〜つもり・〜予定', goal: 'Talk about what you intend to do and what is scheduled.',
    vocab: vs(`つもり||intention
予定|よてい|plan, schedule
夏休み|なつやすみ|summer holidays
留学|りゅうがく|studying abroad
来年|らいねん|next year
会議|かいぎ|meeting`),
    grammar: [
      { p: '[dictionary form] つもりです', e: '"I intend to…". Negative intention: 〜ないつもりです.' },
      { p: '[dictionary form / noun の] 予定です', e: 'Something scheduled or arranged: 三時からの予定です.' },
    ],
    sentences: [
      { f: '来年[らいねん] 日本[にほん]{に} 留学[りゅうがく]する つもりです。', en: 'I intend to study in Japan next year.', alt: ['来年[らいねん] 日本[にほん]へ 留学[りゅうがく]する つもりです。', '来年[らいねん] 日本[にほん]に 留学[りゅうがく]するつもりです。'] },
      { f: '夏休[なつやす]み{に} 京都[きょうと]へ 行[い]く つもりです。', en: 'I plan to go to Kyoto in the summer holidays.', alt: ['夏休[なつやす]みに 京都[きょうと]に 行[い]く つもりです。'] },
      { f: 'あしたは 何[なに]{を} する 予定[よてい]ですか。', en: 'What are your plans for tomorrow?' },
      { f: '会議[かいぎ]は 三時[さんじ]{から}の 予定[よてい]です。', en: 'The meeting is scheduled for three o\'clock.' },
      { f: 'たばこは もう すわない つもりです。', en: 'I intend not to smoke any more.' },
    ],
  }),
  L({
    id: 'n4-10', level: 'N4', title: 'Because… so…', jp: '〜ので', goal: 'Give reasons politely with ので.',
    vocab: vs(`熱|ねつ|fever
休みます|やすみます|to take time off, rest
遅れます|おくれます|to be late
道|みち|road
込んでいます|こんでいます|is crowded
疲れました|つかれました|got tired
寝ます|ねます|to go to bed`),
    grammar: [
      { p: '[plain form] ので', e: '"Because / so". Softer and more polite than から, good for excuses and requests: 熱があるので、休みます.' },
      { p: 'Nouns and な-adjectives: なので', e: 'あしたは休みなので… = Because tomorrow is a day off…' },
    ],
    sentences: [
      { f: '熱[ねつ]{が} あるので、 休[やす]みます。', en: 'I have a fever, so I\'ll take the day off.' },
      { f: '道[みち]{が} 込[こ]んでいたので、 遅[おく]れました。', en: 'The road was crowded, so I was late.' },
      { f: '疲[つか]れたので、 早[はや]く 寝[ね]ます。', en: 'I\'m tired, so I\'ll go to bed early.' },
      { f: 'あしたは 休[やす]みなので、 映画[えいが]{を} 見[み]に 行[い]きます。', en: 'Tomorrow is a day off, so I\'ll go to see a film.' },
      { f: '雨[あめ]{が} ふっているので、 タクシーで 帰[かえ]ります。', en: 'It\'s raining, so I\'ll go home by taxi.', alt: ['雨[あめ]が 降[ふ]っているので、 タクシーで 帰[かえ]ります。'] },
    ],
  }),
  L({
    id: 'n4-11', level: 'N4', title: 'Too much', jp: '〜すぎる', goal: 'Say that something is too much, too big or too difficult.',
    vocab: vs(`食べすぎました|たべすぎました|ate too much
高すぎます|たかすぎます|too expensive
大きすぎます|おおきすぎます|too big
くつ||shoes
お酒|おさけ|alcohol`),
    grammar: [
      { p: '[verb stem] すぎます', e: '"Do too much": 食べます → 食べすぎます, 飲みます → 飲みすぎます.' },
      { p: '[adjective] すぎます', e: 'い-adjectives drop い: 高い → 高すぎます. な-adjectives: しずかすぎます.' },
    ],
    sentences: [
      { f: 'きのう ケーキ{を} 食[た]べすぎました。', en: 'I ate too much cake yesterday.' },
      { f: 'この かばん{は} 高[たか]すぎます。', en: 'This bag is too expensive.' },
      { f: 'この くつ{は} 私[わたし]には 大[おお]きすぎます。', en: 'These shoes are too big for me.' },
      { f: 'お酒[さけ]{を} 飲[の]みすぎないで ください。', en: 'Please don\'t drink too much alcohol.' },
    ],
  }),
  L({
    id: 'n4-12', level: 'N4', title: 'While doing', jp: '〜ながら', goal: 'Say you do two things at the same time.',
    vocab: vs(`ながら||while
音楽|おんがく|music
歌います|うたいます|to sing
歩きます|あるきます|to walk
アルバイト||part-time job
通います|かよいます|to attend, commute`),
    grammar: [
      { p: '[verb stem] ながら', e: '"While doing": the same person does both actions, and the main action comes last. 聞きながら勉強します = study while listening.' },
    ],
    sentences: [
      { f: '音楽[おんがく]{を} 聞[き]きながら 勉強[べんきょう]します。', en: 'I study while listening to music.' },
      { f: '歩[ある]きながら 電話[でんわ]{を} しないで ください。', en: 'Please don\'t talk on the phone while walking.' },
      { f: 'アルバイト{を} しながら 大学[だいがく]に 通[かよ]っています。', en: 'I go to university while working part-time.' },
      { f: 'テレビ{を} 見[み]ながら ごはんを 食[た]べます。', en: 'I eat while watching TV.' },
      { f: '歌[うた]いながら 料理[りょうり]{を} します。', en: 'I cook while singing.' },
    ],
  }),
];