// Practical Japanese track: real situations, each with a scene card and dialogue.
import { type Lesson, vs, SRC } from './types';

const P = (o: Omit<Lesson, 'track' | 'source' | 'level' | 'grammar'> & { grammar?: Lesson['grammar'] }): Lesson =>
  ({ grammar: [], ...o, level: 'N5', track: 'practical', source: SRC });

export const PRACTICAL_LESSONS: Lesson[] = [
  P({
    id: 'p-01', title: 'Greetings and introducing yourself', jp: 'はじめまして', goal: 'Greet people at any time of day and introduce yourself for the first time.',
    vocab: vs(`おはようございます||good morning
こんにちは||hello, good afternoon
こんばんは||good evening
はじめまして||nice to meet you (first meeting)
よろしくおねがいします||pleased to meet you / I\'m in your care
ありがとうございます||thank you
すみません||excuse me, sorry
インド||India`),
    grammar: [
      { p: '〜から 来ました', e: '"I came from…". Use it to say where you are from: インドから来ました.' },
      { p: 'よろしくおねがいします', e: 'Said at the end of an introduction or when asking a favour. There is no direct English equivalent — it asks for a good relationship.' },
    ],
    sentences: [
      { f: 'はじめまして。', en: 'Nice to meet you.' },
      { f: '私[わたし]は インド{から} 来[き]ました。', en: 'I am from India.' },
      { f: 'よろしく おねがいします。', en: 'Pleased to meet you.', alt: ['よろしく お願[ねが]いします。', 'どうぞ よろしく おねがいします。'] },
      { f: 'おはよう ございます。', en: 'Good morning.' },
      { f: 'ありがとう ございます。', en: 'Thank you very much.' },
    ],
    dialogue: [
      { who: 'Tanaka', f: 'はじめまして。 田中[たなか]です。', en: 'Nice to meet you. I\'m Tanaka.' },
      { who: 'You', f: 'はじめまして。 私[わたし]は インドから 来[き]ました。', en: 'Nice to meet you. I am from India.' },
      { who: 'Tanaka', f: 'そうですか。 よろしく おねがいします。', en: 'Is that so? Pleased to meet you.' },
      { who: 'You', f: 'こちらこそ、 よろしく おねがいします。', en: 'Likewise, pleased to meet you.' },
    ],
    choices: [
      { q: 'You meet your new neighbour at 8 a.m.', options: ['こんばんは', 'おはようございます', 'さようなら'], a: 1, why: 'おはようございます is the polite morning greeting. こんばんは is for the evening.' },
      { q: 'You bump into someone on the train.', options: ['すみません', 'いただきます', 'おやすみなさい'], a: 0, why: 'すみません covers "excuse me" and "sorry". いただきます is said before eating.' },
    ],
  }),
  P({
    id: 'p-02', title: 'At the convenience store', jp: 'コンビニで', goal: 'Buy things, answer the cashier\'s questions and pay.',
    vocab: vs(`コンビニ||convenience store
ふくろ||bag
レシート||receipt
おべんとう||boxed meal
あたためます||to warm up
だいじょうぶです||it\'s fine / no thank you
おねがいします||please (do that)
カード||card`),
    grammar: [
      { p: '〜を ください', e: '"Please give me…". これをください = "This one, please."' },
      { p: 'だいじょうぶです', e: 'A soft way to decline: ふくろはだいじょうぶです = "I\'m fine without a bag."' },
    ],
    sentences: [
      { f: 'これ{を} ください。', en: 'This one, please.' },
      { f: 'ふくろは だいじょうぶです。', en: 'I don\'t need a bag.', alt: ['ふくろは いりません。', 'ふくろは 大丈夫[だいじょうぶ]です。'] },
      { f: 'あたためて ください。', en: 'Please warm it up.', alt: ['あたためてください。', '温[あたた]めて ください。'] },
      { f: 'カード{で} おねがいします。', en: 'By card, please.', alt: ['カードで お願[ねが]いします。'] },
      { f: 'レシートを ください。', en: 'A receipt, please.' },
    ],
    scene: {
      title: 'Cashier counter', place: 'Convenience store', kind: 'screen', items: [
        { f: 'お弁当[べんとう] 温[あたた]めますか', en: 'Shall I warm up your boxed meal?', action: 'Answer はい、おねがいします (yes please) or だいじょうぶです (no thanks).' },
        { look: 'paper', f: 'レジ袋[ぶくろ] 有料[ゆうりょう]', en: 'Plastic bags cost extra', action: 'Bags are not free. Say ふくろをください if you need one.' },
        { f: 'お支払[しはら]い方法[ほうほう]', en: 'Payment method', action: 'Choose on the screen: 現金 (cash), カード (card) or 電子マネー (e-money).' },
        { look: 'red', f: '年齢[ねんれい]確認[かくにん]', en: 'Age verification', action: 'Shown when buying alcohol. Touch the button to confirm you are 20 or older.' },
      ],
    },
    dialogue: [
      { who: 'Cashier', f: 'いらっしゃいませ。 おべんとう、 あたためますか。', en: 'Welcome. Shall I warm up the boxed meal?' },
      { who: 'You', f: 'はい、 おねがいします。', en: 'Yes, please.' },
      { who: 'Cashier', f: 'ふくろは いりますか。', en: 'Do you need a bag?' },
      { who: 'You', f: 'だいじょうぶです。', en: 'No, thank you.' },
      { who: 'Cashier', f: '六百円[ろっぴゃくえん]です。', en: 'That is 600 yen.' },
    ],
    choices: [
      { q: 'The cashier asks ふくろはいりますか and you do not need one.', options: ['はい、ください', 'だいじょうぶです', 'いくらですか'], a: 1, why: 'だいじょうぶです politely declines. はい、ください would ask for the bag.' },
    ],
  }),
  P({
    id: 'p-03', title: 'Ordering at a restaurant', jp: 'レストランで', goal: 'Get a table, order food and ask for the bill.',
    vocab: vs(`メニュー||menu
注文|ちゅうもん|order
お水|おみず|water (polite)
ラーメン||ramen
おすすめ||recommendation
お会計|おかいけい|the bill
二人|ふたり|two people
ごちそうさまでした||thank you for the meal`),
    grammar: [
      { p: '[item] を [number] ください / おねがいします', e: 'Order with を + number: ラーメンを二つください. おねがいします is slightly more polite than ください.' },
      { p: '〜は 何ですか', e: 'おすすめは何ですか = "What do you recommend?"' },
    ],
    sentences: [
      { f: '二人[ふたり]です。', en: 'A table for two.' },
      { f: 'メニュー{を} ください。', en: 'The menu, please.' },
      { f: 'ラーメンを 一[ひと]つ おねがいします。', en: 'One ramen, please.', alt: ['ラーメンを 一[ひと]つ ください。', 'ラーメンを 一[ひと]つ お願[ねが]いします。'] },
      { f: 'おすすめは 何[なん]ですか。', en: 'What do you recommend?' },
      { f: 'お会計[かいけい]を おねがいします。', en: 'The bill, please.', alt: ['お会計[かいけい]を お願[ねが]いします。', 'お会計[かいけい] おねがいします。'] },
      { f: 'ごちそうさまでした。', en: 'Thank you for the meal.' },
    ],
    scene: {
      title: 'Lunch menu', place: 'Restaurant', kind: 'menu', items: [
        { f: '日替[ひが]わり定食[ていしょく] 850円[えん]', en: 'Daily set meal — 850 yen', action: 'A set with rice, soup and a main dish that changes each day. Good value at lunch.' },
        { look: 'paper', f: '大盛[おおも]り +100円[えん]', en: 'Large portion +100 yen', action: 'Say 大盛りでおねがいします to get a bigger serving.' },
        { look: 'paper', f: '税込[ぜいこみ]', en: 'Tax included', action: 'The price shown is what you pay. 税抜 (ぜいぬき) means tax is added later.' },
        { look: 'paper', f: '食券[しょっけん]をお買[か]い求[もと]めください', en: 'Please buy a meal ticket', action: 'Buy a ticket from the machine at the entrance first, then hand it to the staff.' },
      ],
    },
    dialogue: [
      { who: 'Staff', f: 'いらっしゃいませ。 何名様[なんめいさま]ですか。', en: 'Welcome. How many people?' },
      { who: 'You', f: '二人[ふたり]です。', en: 'Two.' },
      { who: 'Staff', f: 'ご注文[ちゅうもん]は お決[き]まりですか。', en: 'Have you decided on your order?' },
      { who: 'You', f: 'ラーメンを 二[ふた]つ おねがいします。', en: 'Two ramen, please.' },
    ],
    choices: [
      { q: 'You have finished eating and want to pay.', options: ['お会計をおねがいします', 'いただきます', 'メニューをください'], a: 0, why: 'お会計 is the bill. いただきます is said before you start eating.' },
    ],
  }),
  P({
    id: 'p-04', title: 'At the train station', jp: '駅で', goal: 'Buy a ticket, find your platform and check where a train goes.',
    kanji: '駅電車口出入東西南北',
    vocab: vs(`きっぷ||ticket
何番線|なんばんせん|which platform
のりかえ||transfer
出口|でぐち|exit
入口|いりぐち|entrance
次|つぎ|next
とまります||to stop
新宿|しんじゅく|Shinjuku`),
    grammar: [
      { p: 'この 電車は 〜に 行きますか', e: '"Does this train go to…?" The safest question to ask before boarding.' },
      { p: '〜は どこですか', e: '"Where is…?" Works for exits, platforms, ticket machines — anything.' },
    ],
    sentences: [
      { f: 'この 電車[でんしゃ]は 新宿[しんじゅく]{に} 行[い]きますか。', en: 'Does this train go to Shinjuku?', alt: ['この 電車[でんしゃ]は 新宿[しんじゅく]へ 行[い]きますか。'] },
      { f: '新宿[しんじゅく]まで いくらですか。', en: 'How much is it to Shinjuku?' },
      { f: '何番線[なんばんせん]ですか。', en: 'Which platform is it?' },
      { f: '出口[でぐち]は どこですか。', en: 'Where is the exit?' },
      { f: '次[つぎ]の 駅[えき]で おります。', en: 'I get off at the next station.', alt: ['次[つぎ]の 駅[えき]で 降[お]ります。'] },
    ],
    scene: {
      title: 'Station signs', place: 'Train station', kind: 'sign', items: [
        { look: 'yellow', f: '北口[きたぐち]', en: 'North Exit', action: 'Exits are named by direction: 北 north, 南 south, 東 east, 西 west. Check which one your destination is near.' },
        { look: 'dark', f: 'のりば 3番線[ばんせん]', en: 'Platform 3', action: 'Follow the number to your platform.' },
        { look: 'dark', f: '各駅停車[かくえきていしゃ]', en: 'Local train (stops at every station)', action: 'Safe choice if you are unsure. 急行 (express) and 快速 (rapid) skip stations.' },
        { look: 'blue', f: 'きっぷうりば', en: 'Ticket machines', action: 'Buy a ticket here, or charge your IC card (Suica / PASMO).' },
        { look: 'blue', f: '精算機[せいさんき]', en: 'Fare adjustment machine', action: 'If your ticket or card balance is short, pay the difference here before the gate.' },
      ],
    },
    dialogue: [
      { who: 'You', f: 'すみません。 この 電車[でんしゃ]は 新宿[しんじゅく]に 行[い]きますか。', en: 'Excuse me. Does this train go to Shinjuku?' },
      { who: 'Staff', f: 'いいえ、 行[い]きません。 三番線[さんばんせん]です。', en: 'No, it doesn\'t. It\'s platform 3.' },
      { who: 'You', f: 'ありがとう ございます。', en: 'Thank you.' },
    ],
  }),
  P({
    id: 'p-05', title: 'Directions and asking for help', jp: '道をたずねる', goal: 'Ask the way, understand simple directions and ask someone to repeat.',
    kanji: '右左道',
    vocab: vs(`まっすぐ||straight ahead
右|みぎ|right
左|ひだり|left
まがります||to turn
ちかく||nearby
こうばん||police box
わかりません||I don\'t understand
ちず||map`),
    grammar: [
      { p: '〜は どこに ありますか', e: 'A polite way to ask where something is.' },
      { p: '[direction] に まがります', e: '右にまがります = "turn right". まっすぐ行きます = "go straight".' },
    ],
    sentences: [
      { f: 'すみません、 駅[えき]は どこですか。', en: 'Excuse me, where is the station?' },
      { f: 'まっすぐ 行[い]って ください。', en: 'Please go straight.', alt: ['まっすぐ 行[い]ってください。'] },
      { f: '右[みぎ]{に} まがります。', en: 'Turn right.', alt: ['右[みぎ]に 曲[ま]がります。'] },
      { f: 'ちかくに コンビニは ありますか。', en: 'Is there a convenience store nearby?', alt: ['近[ちか]くに コンビニは ありますか。'] },
      { f: 'すみません、 わかりません。', en: 'Sorry, I don\'t understand.', alt: ['すみません、 分[わ]かりません。'] },
      { f: 'もう 一度[いちど] おねがいします。', en: 'Once more, please.', alt: ['もう 一度[いちど] お願[ねが]いします。'] },
    ],
    dialogue: [
      { who: 'You', f: 'すみません、 こうばんは どこですか。', en: 'Excuse me, where is the police box?' },
      { who: 'Passer-by', f: 'まっすぐ 行[い]って、 左[ひだり]に まがって ください。', en: 'Go straight, then turn left.' },
      { who: 'You', f: 'もう 一度[いちど] おねがいします。', en: 'Once more, please.' },
    ],
    choices: [
      { q: 'Someone gives you directions too quickly.', options: ['ゆっくり話してください', 'いくらですか', 'ごちそうさまでした'], a: 0, why: 'ゆっくり話してください = "Please speak slowly."' },
    ],
  }),
  P({
    id: 'p-06', title: 'Hotel check-in', jp: 'ホテルで', goal: 'Check in with a reservation and ask basic questions about your stay.',
    vocab: vs(`チェックイン||check-in
予約|よやく|reservation
パスポート||passport
部屋|へや|room
朝ごはん|あさごはん|breakfast
かぎ||key
何時|なんじ|what time
にもつ||luggage`),
    grammar: [
      { p: '〜を おねがいします', e: 'Ask for a service: チェックインをおねがいします = "I\'d like to check in."' },
      { p: '〜は 何時からですか', e: '"From what time is…?" 朝ごはんは何時からですか.' },
    ],
    sentences: [
      { f: 'チェックインを おねがいします。', en: 'I would like to check in.', alt: ['チェックインを お願[ねが]いします。', 'チェックイン おねがいします。'] },
      { f: '予約[よやく]{が} あります。', en: 'I have a reservation.', alt: ['予約[よやく]しています。'] },
      { f: '朝[あさ]ごはんは 何時[なんじ]{から}ですか。', en: 'From what time is breakfast?' },
      { f: 'にもつを おねがいします。', en: 'Please take care of my luggage.', alt: ['荷物[にもつ]を おねがいします。', '荷物[にもつ]を お願[ねが]いします。'] },
      { f: '部屋[へや]の かぎを ください。', en: 'The room key, please.' },
    ],
    scene: {
      title: 'Front desk', place: 'Hotel', kind: 'desk', items: [
        { f: 'フロント', en: 'Front desk / reception', action: 'Check in and out here. Have your passport ready — hotels must copy it for foreign visitors.' },
        { look: 'paper', f: 'チェックアウト 10時[じ]', en: 'Check-out 10:00', action: 'Leave the room by this time.' },
        { f: '朝食[ちょうしょく] 7:00〜9:30', en: 'Breakfast 7:00–9:30', action: '朝食 is the formal word for 朝ごはん.' },
        { look: 'blue', f: '大浴場[だいよくじょう]', en: 'Large public bath', action: 'Shared bath. Wash before getting in; 男 is the men\'s side and 女 the women\'s.' },
      ],
    },
    dialogue: [
      { who: 'You', f: 'チェックインを おねがいします。 予約[よやく]が あります。', en: 'I\'d like to check in. I have a reservation.' },
      { who: 'Staff', f: 'お名前[なまえ]を おねがいします。', en: 'Your name, please.' },
      { who: 'Staff', f: 'パスポートを 見[み]せて ください。', en: 'Please show me your passport.' },
      { who: 'You', f: 'はい、 どうぞ。', en: 'Yes, here you are.' },
    ],
  }),
  P({
    id: 'p-07', title: 'University life', jp: '大学で', goal: 'Introduce yourself to classmates and talk about what you study.',
    kanji: '大学生先',
    vocab: vs(`大学|だいがく|university
留学生|りゅうがくせい|international student
専門|せんもん|major, speciality
一年生|いちねんせい|first-year student
授業|じゅぎょう|class, lecture
経済|けいざい|economics
しゅくだい||homework
教室|きょうしつ|classroom`),
    grammar: [
      { p: '専門は 〜です', e: '"My major is…". 専門は経済です.' },
      { p: '〜を 勉強しています', e: 'ています shows an ongoing activity: "I am studying…".' },
    ],
    sentences: [
      { f: '私[わたし]は 留学生[りゅうがくせい]です。', en: 'I am an international student.' },
      { f: '専門[せんもん]は 経済[けいざい]です。', en: 'My major is economics.' },
      { f: '大学[だいがく]{で} 日本語[にほんご]を 勉強[べんきょう]しています。', en: 'I am studying Japanese at university.' },
      { f: '授業[じゅぎょう]は 何時[なんじ]{から}ですか。', en: 'What time does class start?' },
      { f: '教室[きょうしつ]は どこですか。', en: 'Where is the classroom?' },
    ],
    dialogue: [
      { who: 'Classmate', f: 'こんにちは。 一年生[いちねんせい]ですか。', en: 'Hello. Are you a first-year?' },
      { who: 'You', f: 'はい。 留学生[りゅうがくせい]です。 よろしく おねがいします。', en: 'Yes. I\'m an international student. Nice to meet you.' },
      { who: 'Classmate', f: '専門[せんもん]は 何[なん]ですか。', en: 'What is your major?' },
      { who: 'You', f: '経済[けいざい]です。', en: 'Economics.' },
    ],
  }),
  P({
    id: 'p-08', title: 'Workplace greetings and requests', jp: '職場で', goal: 'Use the set phrases of a Japanese workplace and make polite requests.',
    kanji: '会社',
    vocab: vs(`お疲れ様です|おつかれさまです|thank you for your hard work (greeting)
お先に失礼します|おさきにしつれいします|excuse me for leaving first
会議|かいぎ|meeting
確認|かくにん|confirmation, check
資料|しりょう|documents, materials
少々|しょうしょう|a little (formal)
かしこまりました||certainly (formal)
申し訳ありません|もうしわけありません|I am very sorry (formal)`),
    grammar: [
      { p: '〜て いただけませんか', e: 'A very polite request: "Could you please…?" 確認していただけませんか = "Could you please check it?"' },
      { p: 'お疲れ様です', e: 'Used all day long at work: as a greeting, when passing someone, and when leaving.' },
    ],
    sentences: [
      { f: 'お疲[つか]れ様[さま]です。', en: 'Thank you for your hard work.', alt: ['おつかれさまです。'] },
      { f: 'お先[さき]に 失礼[しつれい]します。', en: 'Excuse me for leaving before you.' },
      { f: '確認[かくにん]して いただけませんか。', en: 'Could you please check it?', alt: ['確認[かくにん]していただけませんか。'] },
      { f: '会議[かいぎ]は 三時[さんじ]{から}です。', en: 'The meeting is from three o\'clock.' },
      { f: '少々[しょうしょう] お待[ま]ちください。', en: 'Please wait a moment. (formal)' },
      { f: '申[もう]し訳[わけ]ありません。', en: 'I am very sorry.', alt: ['申[もう]し訳[わけ]ございません。'] },
    ],
    dialogue: [
      { who: 'Colleague', f: 'お疲[つか]れ様[さま]です。', en: 'Hello / good work.' },
      { who: 'You', f: 'お疲[つか]れ様[さま]です。 資料[しりょう]を 確認[かくにん]して いただけませんか。', en: 'Hello. Could you please check the documents?' },
      { who: 'Colleague', f: 'はい、 わかりました。', en: 'Yes, understood.' },
    ],
    choices: [
      { q: 'You are leaving the office while colleagues are still working.', options: ['お先に失礼します', 'いってきます', 'いただきます'], a: 0, why: 'お先に失礼します is the set phrase for leaving before others. いってきます is said when leaving home.' },
      { q: 'A customer asks you to do something.', options: ['いいよ', 'かしこまりました', 'そうですか'], a: 1, why: 'かしこまりました is the formal "certainly". いいよ is far too casual for a customer.' },
    ],
  }),
  P({
    id: 'p-09', title: 'Emergencies and health', jp: '困ったとき', goal: 'Get help quickly, explain that you feel unwell and say what hurts.',
    vocab: vs(`たすけて||help!
病院|びょういん|hospital
いたい||painful, it hurts
頭|あたま|head
おなか||stomach
くすり||medicine
救急車|きゅうきゅうしゃ|ambulance
なくしました||I lost (something)
さいふ||wallet`),
    grammar: [
      { p: '[body part] が いたいです', e: '"My … hurts". The part that hurts takes が.' },
      { p: '〜を なくしました', e: '"I lost…". Report it at a こうばん (police box) or station office.' },
    ],
    sentences: [
      { f: 'たすけて ください。', en: 'Please help me.', alt: ['助[たす]けて ください。', 'たすけてください。'] },
      { f: '頭[あたま]{が} いたいです。', en: 'I have a headache.', alt: ['頭[あたま]が 痛[いた]いです。'] },
      { f: '病院[びょういん]は どこですか。', en: 'Where is the hospital?' },
      { f: '救急車[きゅうきゅうしゃ]を よんで ください。', en: 'Please call an ambulance.', alt: ['救急車[きゅうきゅうしゃ]を 呼[よ]んで ください。'] },
      { f: 'さいふ{を} なくしました。', en: 'I lost my wallet.', alt: ['財布[さいふ]を なくしました。'] },
    ],
    scene: {
      title: 'Emergency signs', place: 'Around town', kind: 'sign', items: [
        { look: 'green', f: '非常口[ひじょうぐち]', en: 'Emergency exit', action: 'The green running-figure sign. Note where it is in hotels and stations.' },
        { look: 'red', f: '119', en: 'Fire and ambulance: dial 119', action: 'Say 救急です (きゅうきゅうです) for an ambulance, 火事です (かじです) for fire. Police is 110.' },
        { look: 'white', f: '薬局[やっきょく]', en: 'Pharmacy', action: 'Buy medicine here. Say what hurts: 頭がいたいです.' },
        { look: 'green', f: '避難場所[ひなんばしょ]', en: 'Evacuation area', action: 'Where to gather after an earthquake or other disaster.' },
      ],
    },
  }),
];
