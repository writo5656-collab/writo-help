// Reading passages, scripted roleplays and extra vocabulary packs.
import { type Sent, type Vocab, vs } from './types';

export interface Passage { id: string; title: string; context: string; lines: Sent[]; questions: { q: string; options: string[]; a: number; why: string }[] }
export const PASSAGES: Passage[] = [
  {
    id: 'r-01', title: 'A self-introduction', context: 'A new classmate posts in the class group chat.',
    lines: [
      { f: 'はじめまして。 私[わたし]は リンです。', en: 'Nice to meet you. I am Lin.' },
      { f: '中国[ちゅうごく]から 来[き]ました。', en: 'I am from China.' },
      { f: '大学[だいがく]の 一年生[いちねんせい]です。', en: 'I am a first-year university student.' },
      { f: 'すしが 好[す]きです。 よろしく おねがいします。', en: 'I like sushi. Pleased to meet you.' },
    ],
    questions: [
      { q: 'Where is Lin from?', options: ['Japan', 'China', 'India'], a: 1, why: '中国から来ました — "I came from China."' },
      { q: 'What does Lin like?', options: ['Sushi', 'Ramen', 'Coffee'], a: 0, why: 'すしが好きです — the liked thing is marked with が.' },
    ],
  },
  {
    id: 'r-02', title: 'A note on the shop door', context: 'You arrive at a café and find this notice.',
    lines: [
      { f: '今日[きょう]は 休[やす]みです。', en: 'We are closed today.' },
      { f: 'あしたは 九時[くじ]から 五時[ごじ]までです。', en: 'Tomorrow we are open from nine to five.' },
      { f: 'すみません。', en: 'We apologise.' },
    ],
    questions: [
      { q: 'Can you have coffee here today?', options: ['Yes, until five', 'No, it is closed today', 'Only after nine'], a: 1, why: '今日は休みです — 休み means a day off / closed.' },
      { q: 'When does it open tomorrow?', options: ['5:00', '7:00', '9:00'], a: 2, why: '九時から = from nine o\'clock.' },
    ],
  },
  {
    id: 'r-03', title: 'My day', context: 'A short diary entry.',
    lines: [
      { f: '私[わたし]は 毎日[まいにち] 七時[しちじ]に 起[お]きます。', en: 'I get up at seven every day.' },
      { f: '電車[でんしゃ]で 学校[がっこう]に 行[い]きます。', en: 'I go to school by train.' },
      { f: '図書館[としょかん]で 日本語[にほんご]を 勉強[べんきょう]します。', en: 'I study Japanese at the library.' },
      { f: 'きのうは 友[とも]だちと えいがを 見[み]ました。 楽[たの]しかったです。', en: 'Yesterday I watched a film with a friend. It was fun.' },
    ],
    questions: [
      { q: 'How does the writer get to school?', options: ['By bus', 'By train', 'On foot'], a: 1, why: '電車で — で marks the means of transport.' },
      { q: 'What did the writer do yesterday?', options: ['Studied at the library', 'Watched a film with a friend', 'Went to Japan'], a: 1, why: '友だちとえいがを見ました — past tense ました.' },
      { q: 'Where does the writer study Japanese?', options: ['At the library', 'At home', 'On the train'], a: 0, why: '図書館で — で marks where the action happens.' },
    ],
  },
  {
    id: 'r-04', title: 'A message from a friend', context: 'Your friend Tanaka sends you a text.',
    lines: [
      { f: '土曜日[どようび]に いっしょに ラーメンを 食[た]べませんか。', en: 'Would you like to eat ramen together on Saturday?' },
      { f: '駅[えき]の 前[まえ]に 新[あたら]しい 店[みせ]が あります。', en: 'There is a new shop in front of the station.' },
      { f: '安[やす]いです。 そして、 とても おいしいです。', en: 'It is cheap. And it is very delicious.' },
      { f: '十二時[じゅうにじ]に 駅[えき]で 会[あ]いましょう。', en: 'Let\'s meet at the station at twelve.' },
    ],
    questions: [
      { q: 'What is Tanaka suggesting?', options: ['Eating ramen together', 'Studying together', 'Watching a film'], a: 0, why: '食べませんか is an invitation: "won\'t you eat…?"' },
      { q: 'Where is the shop?', options: ['Inside the station', 'In front of the station', 'Near the school'], a: 1, why: '駅の前 = in front of the station.' },
      { q: 'Where and when will you meet?', options: ['At the shop at 1:00', 'At the station at 12:00', 'At home at 2:00'], a: 1, why: '十二時に駅で会いましょう.' },
    ],
  },
];

export interface Turn { npc: Sent; expect: string[]; hint: string; goal: string }
export interface Roleplay { id: string; title: string; place: string; you: string; partner: string; turns: Turn[]; closing: Sent }
export const ROLEPLAYS: Roleplay[] = [
  {
    id: 'rp-intro', title: 'Self-introduction', place: 'First day in class', you: 'New student', partner: 'Tanaka',
    turns: [
      { npc: { f: 'はじめまして。 田中[たなか]です。', en: 'Nice to meet you. I\'m Tanaka.' }, goal: 'Greet them for the first time.', hint: 'はじめまして。', expect: ['はじめまして。', 'はじめまして。 よろしく おねがいします。'] },
      { npc: { f: 'お国[くに]は どちらですか。', en: 'Which country are you from?' }, goal: 'Say you are from India.', hint: 'インドから 来ました。', expect: ['インドから 来[き]ました。', '私[わたし]は インドから 来[き]ました。', 'インドです。'] },
      { npc: { f: '学生[がくせい]ですか。', en: 'Are you a student?' }, goal: 'Say yes, you are a student.', hint: 'はい、 学生です。', expect: ['はい、 学生[がくせい]です。', 'はい、 そうです。', 'はい、 私[わたし]は 学生[がくせい]です。'] },
    ],
    closing: { f: 'そうですか。 よろしく おねがいします。', en: 'I see. Pleased to meet you.' },
  },
  {
    id: 'rp-food', title: 'Ordering food', place: 'Ramen shop', you: 'Customer', partner: 'Staff',
    turns: [
      { npc: { f: 'いらっしゃいませ。 何名様[なんめいさま]ですか。', en: 'Welcome. How many people?' }, goal: 'Say you are one person.', hint: '一人です。', expect: ['一人[ひとり]です。'] },
      { npc: { f: 'ご注文[ちゅうもん]は お決[き]まりですか。', en: 'Have you decided?' }, goal: 'Order one ramen.', hint: 'ラーメンを 一つ おねがいします。', expect: ['ラーメンを 一[ひと]つ おねがいします。', 'ラーメンを 一[ひと]つ ください。', 'ラーメンを 一[ひと]つ お願[ねが]いします。', 'ラーメンを ください。', 'ラーメンを おねがいします。'] },
      { npc: { f: 'お飲[の]み物[もの]は いかがですか。', en: 'Would you like a drink?' }, goal: 'Ask for water.', hint: 'お水を ください。', expect: ['お水[みず]を ください。', '水[みず]を ください。', 'お水[みず]を おねがいします。', '水[みず]を おねがいします。'] },
    ],
    closing: { f: 'かしこまりました。 少々[しょうしょう] お待[ま]ちください。', en: 'Certainly. Please wait a moment.' },
  },
  {
    id: 'rp-shop', title: 'Shopping', place: 'Convenience store', you: 'Customer', partner: 'Cashier',
    turns: [
      { npc: { f: 'いらっしゃいませ。', en: 'Welcome.' }, goal: 'Ask how much this is.', hint: 'これは いくらですか。', expect: ['これは いくらですか。', 'いくらですか。'] },
      { npc: { f: '三百円[さんびゃくえん]です。 ふくろは いりますか。', en: 'It\'s 300 yen. Do you need a bag?' }, goal: 'Politely decline the bag.', hint: 'だいじょうぶです。', expect: ['だいじょうぶです。', 'ふくろは だいじょうぶです。', 'いりません。', 'ふくろは いりません。', '大丈夫[だいじょうぶ]です。'] },
      { npc: { f: 'お支払[しはら]いは？', en: 'How will you pay?' }, goal: 'Say by card, please.', hint: 'カードで おねがいします。', expect: ['カードで おねがいします。', 'カードで お願[ねが]いします。', 'カードで。'] },
    ],
    closing: { f: 'ありがとう ございました。', en: 'Thank you very much.' },
  },
  {
    id: 'rp-hotel', title: 'Hotel check-in', place: 'Hotel front desk', you: 'Guest', partner: 'Receptionist',
    turns: [
      { npc: { f: 'いらっしゃいませ。', en: 'Welcome.' }, goal: 'Say you would like to check in.', hint: 'チェックインを おねがいします。', expect: ['チェックインを おねがいします。', 'チェックインを お願[ねが]いします。', 'チェックイン おねがいします。'] },
      { npc: { f: 'ご予約[よやく]は ありますか。', en: 'Do you have a reservation?' }, goal: 'Say yes, you have one.', hint: 'はい、 あります。', expect: ['はい、 あります。', 'はい、 予約[よやく]が あります。', 'はい。'] },
      { npc: { f: 'パスポートを おねがいします。', en: 'Your passport, please.' }, goal: 'Hand it over politely.', hint: 'はい、 どうぞ。', expect: ['はい、 どうぞ。', 'どうぞ。'] },
    ],
    closing: { f: 'ありがとう ございます。 お部屋[へや]は 五階[ごかい]です。', en: 'Thank you. Your room is on the fifth floor.' },
  },
  {
    id: 'rp-way', title: 'Asking directions', place: 'On the street', you: 'Visitor', partner: 'Passer-by',
    turns: [
      { npc: { f: 'はい、 何[なん]ですか。', en: 'Yes, what is it?' }, goal: 'Ask where the station is.', hint: '駅は どこですか。', expect: ['駅[えき]は どこですか。', 'すみません、 駅[えき]は どこですか。', '駅[えき]は どこに ありますか。'] },
      { npc: { f: 'まっすぐ 行[い]って、 右[みぎ]に まがって ください。', en: 'Go straight and turn right.' }, goal: 'Ask them to say it once more.', hint: 'もう 一度 おねがいします。', expect: ['もう 一度[いちど] おねがいします。', 'もう 一度[いちど] 言[い]ってください。', 'もう 一度[いちど] お願[ねが]いします。', 'ゆっくり 話[はな]してください。'] },
      { npc: { f: 'まっすぐ、 それから 右[みぎ]です。', en: 'Straight, and then right.' }, goal: 'Thank them.', hint: 'ありがとう ございます。', expect: ['ありがとう ございます。', 'ありがとう ございました。', 'わかりました。 ありがとう ございます。'] },
    ],
    closing: { f: 'いいえ。 気[き]をつけて。', en: 'Not at all. Take care.' },
  },
  {
    id: 'rp-work', title: 'At the office', place: 'Workplace', you: 'New employee', partner: 'Colleague',
    turns: [
      { npc: { f: 'お疲[つか]れ様[さま]です。', en: 'Hello / good work.' }, goal: 'Return the workplace greeting.', hint: 'お疲れ様です。', expect: ['お疲[つか]れ様[さま]です。', 'おつかれさまです。'] },
      { npc: { f: '会議[かいぎ]は 何時[なんじ]からですか。', en: 'What time is the meeting from?' }, goal: 'Say it is from three o\'clock.', hint: '三時からです。', expect: ['三時[さんじ]からです。', '会議[かいぎ]は 三時[さんじ]からです。', '三時[さんじ]です。'] },
      { npc: { f: 'わかりました。 もう 帰[かえ]りますか。', en: 'Understood. Are you going home already?' }, goal: 'Excuse yourself for leaving first.', hint: 'お先に 失礼します。', expect: ['お先[さき]に 失礼[しつれい]します。', 'はい、 お先[さき]に 失礼[しつれい]します。'] },
    ],
    closing: { f: 'お疲[つか]れ様[さま]でした。', en: 'Thanks for your work today.' },
  },
];

export const PACKS: { id: string; title: string; words: Vocab[] }[] = [
  { id: 'pk-days', title: 'Days and time words', words: vs(`日曜日|にちようび|Sunday
月曜日|げつようび|Monday
火曜日|かようび|Tuesday
水曜日|すいようび|Wednesday
木曜日|もくようび|Thursday
金曜日|きんようび|Friday
土曜日|どようび|Saturday
今日|きょう|today
あした||tomorrow
きのう||yesterday
朝|あさ|morning
昼|ひる|noon, daytime
夜|よる|night
今週|こんしゅう|this week
来週|らいしゅう|next week
毎朝|まいあさ|every morning`) },
  { id: 'pk-family', title: 'Family and people', words: vs(`家族|かぞく|family
父|ちち|my father
母|はは|my mother
兄|あに|my older brother
姉|あね|my older sister
弟|おとうと|younger brother
妹|いもうと|younger sister
子ども|こども|child
男の人|おとこのひと|man
女の人|おんなのひと|woman
友だち|ともだち|friend
みなさん||everyone`) },
  { id: 'pk-food', title: 'Food and drink', words: vs(`魚|さかな|fish
肉|にく|meat
野菜|やさい|vegetables
くだもの||fruit
たまご||egg
牛乳|ぎゅうにゅう|milk
お酒|おさけ|alcohol, sake
朝ごはん|あさごはん|breakfast
昼ごはん|ひるごはん|lunch
晩ごはん|ばんごはん|dinner
あまい||sweet
からい||spicy`) },
  { id: 'pk-places', title: 'Places around town', words: vs(`銀行|ぎんこう|bank
郵便局|ゆうびんきょく|post office
病院|びょういん|hospital
空港|くうこう|airport
公園|こうえん|park
会社|かいしゃ|company
スーパー||supermarket
ホテル||hotel
喫茶店|きっさてん|café
交番|こうばん|police box
本屋|ほんや|bookshop
地下鉄|ちかてつ|subway`) },
  { id: 'pk-verbs', title: 'Everyday verbs', words: vs(`寝ます|ねます|to sleep
働きます|はたらきます|to work
歩きます|あるきます|to walk
乗ります|のります|to ride, board
使います|つかいます|to use
作ります|つくります|to make
教えます|おしえます|to teach, tell
習います|ならいます|to learn
開けます|あけます|to open
閉めます|しめます|to close
始まります|はじまります|to begin
終わります|おわります|to end
住みます|すみます|to live (reside)
知ります|しります|to know
持ちます|もちます|to hold, have
遊びます|あそびます|to play, hang out`) },
  { id: 'pk-adj', title: 'Useful adjectives', words: vs(`いい||good
悪い|わるい|bad
暑い|あつい|hot (weather)
寒い|さむい|cold (weather)
忙しい|いそがしい|busy
近い|ちかい|near
遠い|とおい|far
早い|はやい|early, fast
おそい||late, slow
やさしい||kind, easy
有名|ゆうめい|famous
便利|べんり|convenient
大丈夫|だいじょうぶ|all right
ひま||free (not busy)
大切|たいせつ|important
にぎやか||lively`) },
];
