// The cast: characters from anime the learner loves, used as a personal,
// non-commercial study aid. Female characters teach and cheer; male
// characters make the common mistakes so you can learn from them.
// Only names and original lines are used — no official artwork, dialogue or
// manga pages. Avatars are simple badges, not drawings of the characters.
export interface Character {
  id: string; name: string; jp: string; series: string;
  role: 'guide' | 'goof';
  color: string; mark: string;      // badge colour and the kanji/kana shown on it
  polite: boolean;                  // speaks in です/ます form
  cheers: [string, string][];       // [Japanese, English] when you get it right
  oops: string[];                   // goofs: what they say when you slip (English)
}

const C = (c: Character) => c;
export const CAST: Record<string, Character> = Object.fromEntries([
  // ---- Rascal Does Not Dream of Bunny Girl Senpai
  C({ id: 'mai', name: 'Mai Sakurajima', jp: '桜島麻衣', series: 'Bunny Girl Senpai', role: 'guide', color: '#5b4a8b', mark: '麻', polite: false,
    cheers: [['よくできました。', 'Well done.'], ['ふふ、合格。', 'Heh. You pass.'], ['その調子。', 'Keep it up.']], oops: [] }),
  C({ id: 'rio', name: 'Rio Futaba', jp: '双葉理央', series: 'Bunny Girl Senpai', role: 'guide', color: '#3d6f8e', mark: '理', polite: false,
    cheers: [['論理的に正しい。', 'Logically correct.'], ['仮説どおりだね。', 'Just as the hypothesis said.']], oops: [] }),
  C({ id: 'tomoe', name: 'Tomoe Koga', jp: '古賀朋絵', series: 'Bunny Girl Senpai', role: 'guide', color: '#d77b5e', mark: '朋', polite: false,
    cheers: [['やったー！', 'Yay!'], ['すごいじゃん！', 'That\'s amazing!']], oops: [] }),
  C({ id: 'sakuta', name: 'Sakuta Azusagawa', jp: '梓川咲太', series: 'Bunny Girl Senpai', role: 'goof', color: '#4a5560', mark: '咲', polite: false, cheers: [],
    oops: ['I said it the same way, and Mai-san just sighed at me. Let\'s look at it again.', 'Yeah, I fell for that one too. Here\'s the fix.'] }),
  // ---- The Angel Next Door Spoils Me Rotten
  C({ id: 'mahiru', name: 'Mahiru Shiina', jp: '椎名真昼', series: 'The Angel Next Door', role: 'guide', color: '#b8925a', mark: '昼', polite: true,
    cheers: [['よくできましたね。', 'You did well.'], ['完璧です。', 'Perfect.'], ['えらいですね。', 'Good job.']], oops: [] }),
  C({ id: 'amane', name: 'Amane Fujimiya', jp: '藤宮周', series: 'The Angel Next Door', role: 'goof', color: '#5d6b77', mark: '周', polite: false, cheers: [],
    oops: ['I got that wrong too, and Shiina corrected me without even looking up. Here\'s what she said.', 'Same mistake I made. Not a big deal — check the model and try again.'] }),
  // ---- Horimiya
  C({ id: 'hori', name: 'Kyouko Hori', jp: '堀京子', series: 'Horimiya', role: 'guide', color: '#c0605a', mark: '堀', polite: false,
    cheers: [['いいじゃん！', 'Nice!'], ['ばっちり！', 'Spot on!']], oops: [] }),
  C({ id: 'miyamura', name: 'Izumi Miyamura', jp: '宮村伊澄', series: 'Horimiya', role: 'goof', color: '#3b4250', mark: '宮', polite: false, cheers: [],
    oops: ['I mixed that up too, and Hori-san laughed at me. Here\'s the right way.', 'That one gets me every time. Let\'s look at it together.'] }),
  // ---- The Fragrant Flower Blooms with Dignity
  C({ id: 'kaoruko', name: 'Kaoruko Waguri', jp: '和栗薫子', series: 'The Fragrant Flower Blooms with Dignity', role: 'guide', color: '#c77a94', mark: '薫', polite: true,
    cheers: [['すごいです！', 'That\'s great!'], ['ケーキみたいに完璧です！', 'Perfect, like a cake!']], oops: [] }),
  C({ id: 'rintaro', name: 'Rintaro Tsumugi', jp: '紬凛太郎', series: 'The Fragrant Flower Blooms with Dignity', role: 'goof', color: '#4b5b4e', mark: '凛', polite: false, cheers: [],
    oops: ['I made that exact mistake. Waguri-san didn\'t laugh, she just explained it. Here it is.', 'Looks scarier than it is. Read the fix, then go again.'] }),
  // ---- Alya Sometimes Hides Her Feelings in Russian
  C({ id: 'alya', name: 'Alya Kujou', jp: '九条アリサ', series: 'Alya Sometimes Hides Her Feelings in Russian', role: 'guide', color: '#7d9bb8', mark: 'ア', polite: false,
    cheers: [['当然ね。', 'Naturally.'], ['…まあ、悪くないわ。', '…Well, not bad.']], oops: [] }),
  C({ id: 'yuki', name: 'Yuki Suou', jp: '周防有希', series: 'Alya Sometimes Hides Her Feelings in Russian', role: 'guide', color: '#4d6a8a', mark: '有', polite: true,
    cheers: [['お見事です。', 'Splendid.'], ['さすがですね。', 'As expected of you.']], oops: [] }),
  C({ id: 'masha', name: 'Masha Kujou', jp: '九条マリヤ', series: 'Alya Sometimes Hides Her Feelings in Russian', role: 'guide', color: '#c89a5e', mark: 'マ', polite: false,
    cheers: [['えらいえらい！', 'Good job, good job!'], ['すてき！', 'Lovely!']], oops: [] }),
  C({ id: 'masachika', name: 'Masachika Kuze', jp: '久世政近', series: 'Alya Sometimes Hides Her Feelings in Russian', role: 'goof', color: '#505a66', mark: '政', polite: false, cheers: [],
    oops: ['Yep, I tried that too and Alya gave me a very cold look. Here\'s the version she accepted.', 'Classic slip. I\'ll pretend I didn\'t see it — check the fix.'] }),
  // ---- Blue Box
  C({ id: 'chinatsu', name: 'Chinatsu Kano', jp: '鹿野千夏', series: 'Blue Box', role: 'guide', color: '#3f7fb5', mark: '千', polite: false,
    cheers: [['ナイス！', 'Nice shot!'], ['いいね、その調子！', 'Good, keep that pace!']], oops: [] }),
  C({ id: 'hina', name: 'Hina Chono', jp: '蝶野雛', series: 'Blue Box', role: 'guide', color: '#d36b8f', mark: '雛', polite: false,
    cheers: [['やるじゃん！', 'Not bad at all!'], ['完璧な演技！', 'A perfect routine!']], oops: [] }),
  C({ id: 'taiki', name: 'Taiki Inomata', jp: '猪股大喜', series: 'Blue Box', role: 'goof', color: '#4c6a52', mark: '大', polite: false, cheers: [],
    oops: ['Missed it — me too! Practice is just reps. Here\'s the right form.', 'I lost a point on that exact one. Let\'s fix it and go again!'] }),
  // ---- My Dress-Up Darling
  C({ id: 'marin', name: 'Marin Kitagawa', jp: '喜多川海夢', series: 'My Dress-Up Darling', role: 'guide', color: '#e0719a', mark: '海', polite: false,
    cheers: [['ヤバい、天才じゃん！', 'Whoa, you\'re a genius!'], ['めっちゃいい！', 'Super good!']], oops: [] }),
  C({ id: 'juju', name: 'Juju Inui', jp: '乾紗寿叶', series: 'My Dress-Up Darling', role: 'guide', color: '#8b6fb3', mark: '紗', polite: false,
    cheers: [['ふん、合格よ。', 'Hmph. You pass.'], ['まあまあね。', 'Not too bad.']], oops: [] }),
  C({ id: 'gojo', name: 'Wakana Gojo', jp: '五条新菜', series: 'My Dress-Up Darling', role: 'goof', color: '#5a5f6b', mark: '新', polite: true, cheers: [],
    oops: ['I made the same mistake… sorry! Here is the correct version.', 'Like a costume: one wrong stitch and it shows. Let\'s redo that part.'] }),
  // ---- Naruto
  C({ id: 'sakura', name: 'Sakura Haruno', jp: '春野サクラ', series: 'Naruto', role: 'guide', color: '#d9849b', mark: '桜', polite: false,
    cheers: [['しゃーんなろー！', 'Cha!'], ['やるじゃない！', 'Not bad!']], oops: [] }),
  C({ id: 'hinata', name: 'Hinata Hyuga', jp: '日向ヒナタ', series: 'Naruto', role: 'guide', color: '#6c63a8', mark: '日', polite: true,
    cheers: [['す、すごいです…！', 'A-amazing…!'], ['がんばりましたね。', 'You worked hard.']], oops: [] }),
  C({ id: 'tsunade', name: 'Tsunade', jp: '綱手', series: 'Naruto', role: 'guide', color: '#4f8a5b', mark: '綱', polite: false,
    cheers: [['合格だ。', 'Passed.'], ['いい腕だな。', 'Good skill.']], oops: [] }),
  C({ id: 'ino', name: 'Ino Yamanaka', jp: '山中いの', series: 'Naruto', role: 'guide', color: '#c9a83c', mark: 'い', polite: false,
    cheers: [['さすがね！', 'As expected!'], ['かんぺき！', 'Perfect!']], oops: [] }),
  C({ id: 'naruto', name: 'Naruto Uzumaki', jp: 'うずまきナルト', series: 'Naruto', role: 'goof', color: '#e08a2e', mark: 'ナ', polite: false, cheers: [],
    oops: ['I wrote it like that too, dattebayo! Sakura-chan made me copy it ten times. Here\'s the right way!', 'Never give up — that\'s my ninja way! Check the fix and try again!', 'I mess this up all the time. Let\'s get it together!'] }),
  C({ id: 'lee', name: 'Rock Lee', jp: 'ロック・リー', series: 'Naruto', role: 'goof', color: '#3f8a4c', mark: 'リ', polite: true, cheers: [],
    oops: ['A mistake is just training! I made it too. One hundred more repetitions!', 'Youth is about failing and rising again! Here is the correct form!'] }),
].map(c => [c.id, c]));

/** Who guides each lesson, and who makes the mistakes in its story. */
export const LESSON_CAST: Record<string, { guide: string; goof: string; intro: [string, string] }> = {
  'kana-h1': { guide: 'sakura', goof: 'naruto', intro: ['今日[きょう]はひらがなだよ！', 'Today: hiragana! Even Naruto had to start here.'] },
  'kana-h2': { guide: 'hinata', goof: 'naruto', intro: ['いっしょにがんばりましょう。', 'Let\'s do our best together. Watch out for し, ち and つ.'] },
  'kana-h3': { guide: 'ino', goof: 'lee', intro: ['はなのなまえもよめるよ！', 'You\'ll even read flower names. I run a flower shop, you know.'] },
  'kana-h4': { guide: 'tsunade', goof: 'naruto', intro: ['しゅぎょうだ。', 'Training time. No slacking.'] },
  'kana-h5': { guide: 'hori', goof: 'miyamura', intro: ['てんてんをわすれないでね。', 'Don\'t forget the little ゛ marks.'] },
  'kana-h6': { guide: 'mahiru', goof: 'amane', intro: ['ちいさい「っ」にきをつけてください。', 'Be careful with the small っ.'] },
  'kana-k1': { guide: 'marin', goof: 'gojo', intro: ['カタカナ、マジかわいいじゃん！', 'Katakana is so cute! Cosplay words are all katakana.'] },
  'kana-k2': { guide: 'juju', goof: 'gojo', intro: ['シとツ、まちがえないでよね。', 'Don\'t you dare mix up シ and ツ.'] },
  'kana-k3': { guide: 'alya', goof: 'masachika', intro: ['ロシア語[ご]もカタカナで書[か]けるわ。', 'Even Russian words can be written in katakana.'] },
  'kana-k4': { guide: 'masha', goof: 'masachika', intro: ['ゆっくりでいいのよ。', 'Take it slowly, that\'s fine.'] },
  'n5-01': { guide: 'mai', goof: 'sakuta', intro: ['私[わたし]は女優[じょゆう]です。 今日[きょう]は「AはBです」を教[おし]えます。', 'I\'m an actress. Today I\'ll teach you "A is B".'] },
  'n5-02': { guide: 'tomoe', goof: 'sakuta', intro: ['これ、それ、あれ！いっしょにやろう！', 'This, that, that over there! Let\'s do it together!'] },
  'n5-03': { guide: 'rio', goof: 'sakuta', intro: ['質問[しつもん]の形[かたち]を調[しら]べよう。', 'Let\'s investigate how questions work.'] },
  'n5-04': { guide: 'mahiru', goof: 'amane', intro: ['ごはんを作[つく]りました。 いっしょに食[た]べましょう。', 'I made dinner. Let\'s eat — and learn eating and drinking verbs.'] },
  'n5-05': { guide: 'chinatsu', goof: 'taiki', intro: ['毎朝[まいあさ]、体育館[たいいくかん]に行[い]くよ。', 'I go to the gym every morning. Let\'s talk about going places.'] },
  'n5-06': { guide: 'hina', goof: 'taiki', intro: ['どこで練習[れんしゅう]する？', 'Where do you practise? Today: で for places and tools.'] },
  'n5-07': { guide: 'hori', goof: 'miyamura', intro: ['うちに弟[おとうと]がいます。', 'My little brother is at home. Today: あります and います.'] },
  'n5-08': { guide: 'kaoruko', goof: 'rintaro', intro: ['このケーキはとてもおいしいです！', 'This cake is very delicious! Let\'s learn describing words.'] },
  'n5-09': { guide: 'marin', goof: 'gojo', intro: ['きのう、コスプレしたよ！', 'I cosplayed yesterday! Today: talking about the past.'] },
  'n5-10': { guide: 'yuki', goof: 'masachika', intro: ['いっしょにお茶[ちゃ]を飲[の]みませんか。', 'Would you like some tea with me? Today: invitations.'] },
  'n5-11': { guide: 'alya', goof: 'masachika', intro: ['…べつに、好[す]きじゃないわ。', '…It\'s not like I like it. Today: likes and wants.'] },
  'n5-12': { guide: 'tsunade', goof: 'naruto', intro: ['ちょっと待[ま]て。 て形[けい]の修行[しゅぎょう]だ。', 'Hold on. Time to train the て-form.'] },
  'n5-13': { guide: 'ino', goof: 'lee', intro: ['この花[はな]は三百円[さんびゃくえん]よ。', 'These flowers are 300 yen. Let\'s count money.'] },
  'n5-14': { guide: 'sakura', goof: 'naruto', intro: ['九時[くじ]から五時[ごじ]まで修行[しゅぎょう]よ！', 'Training from nine to five! Today: from, until and also.'] },
  'n4-01': { guide: 'masha', goof: 'masachika', intro: ['何[なに]ができる？', 'What can you do? Let\'s say it in Japanese.'] },
  'n4-02': { guide: 'mai', goof: 'sakuta', intro: ['京都[きょうと]に行[い]ったことがある？', 'Have you ever been to Kyoto? Today: experiences.'] },
  'n4-03': { guide: 'rio', goof: 'sakuta', intro: ['私[わたし]はこう思[おも]う。', 'Here\'s what I think. Today: giving opinions.'] },
  'p-01': { guide: 'mai', goof: 'sakuta', intro: ['はじめまして。', 'First impressions matter. Let\'s introduce yourself properly.'] },
  'p-02': { guide: 'marin', goof: 'gojo', intro: ['コンビニ行[い]こう！', 'Let\'s go to the convenience store!'] },
  'p-03': { guide: 'mahiru', goof: 'amane', intro: ['いっしょに食[た]べに行[い]きましょう。', 'Let\'s go out to eat — and order properly.'] },
  'p-04': { guide: 'chinatsu', goof: 'taiki', intro: ['電車[でんしゃ]で行[い]こう。', 'Let\'s take the train. The signs are easier than they look.'] },
  'p-05': { guide: 'hinata', goof: 'naruto', intro: ['駅[えき]はあちらです。', 'The station is that way. Let\'s learn to ask for directions.'] },
  'p-06': { guide: 'masha', goof: 'masachika', intro: ['ホテルに着[つ]いたわね。', 'We\'ve arrived at the hotel. Let\'s check in.'] },
  'p-07': { guide: 'rio', goof: 'sakuta', intro: ['大学[だいがく]の生活[せいかつ]を説明[せつめい]する。', 'I\'ll explain university life.'] },
  'p-08': { guide: 'yuki', goof: 'masachika', intro: ['会社[かいしゃ]では丁寧[ていねい]に話[はな]しましょう。', 'At work, speak politely.'] },
  'p-09': { guide: 'tsunade', goof: 'naruto', intro: ['けがをしたら、すぐ言[い]え。', 'If you\'re hurt, say so right away. Learn these phrases.'] },
};

const ROTATE = ['mai', 'mahiru', 'hori', 'kaoruko', 'alya', 'chinatsu', 'marin', 'sakura', 'hinata', 'tsunade', 'yuki', 'rio', 'masha', 'ino', 'tomoe', 'hina', 'juju'];
const GOOFS = ['naruto', 'sakuta', 'amane', 'miyamura', 'rintaro', 'masachika', 'taiki', 'gojo', 'lee'];
/** Cast for screens without a lesson (review, drills): changes every day. */
export function dailyCast(seed = new Date().getDate()) {
  return { guide: ROTATE[seed % ROTATE.length], goof: GOOFS[seed % GOOFS.length] };
}
export function castFor(lessonId?: string) {
  const c = lessonId && LESSON_CAST[lessonId];
  return c ? { guide: c.guide, goof: c.goof } : dailyCast();
}
export const GUIDES = ROTATE;
