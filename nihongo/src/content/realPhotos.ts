// Real photos of Japanese signs, menus and notices (Wikimedia Commons, CC BY / CC BY-SA).
// Every reading below was checked against the photo itself. Credits are shown with each photo.
export interface RealPhoto {
  id: string; img: string;
  /** What to look at in the photo. */
  look: string;
  /** The text to read, its kana (what we listen for), romaji and meaning. */
  read: string; kana: string; romaji: string; en: string;
  /** The reading as it should be shown, when it has katakana (kana above is all hiragana for checking). */
  shown?: string;
  note: string;
  level: 'N5' | 'N4' | 'N3';
  credit: { author: string; license: string; url: string };
}

const C = (file: string) => `https://commons.wikimedia.org/wiki/File:${file}`;

export const REAL_PHOTOS: RealPhoto[] = [
  { id: 'tomare', img: 'real/tomare.jpg', look: 'the word in the red circle', read: 'とまれ', kana: 'とまれ', romaji: 'tomare', en: 'Stop', note: 'とまれ is the order form of とまる (to stop). Around it: しばらく おまちください = "please wait a moment".', level: 'N5', credit: { author: 'Matsukin', license: 'CC BY 2.0', url: C('しばらく_とまれ_おまちください。_(2186560567).jpg') } },
  { id: 'stop-look', img: 'real/stop-look.jpg', look: 'the big sign at the railway crossing', read: 'とまれみよ', kana: 'とまれみよ', romaji: 'tomare miyo', en: 'Stop and look!', note: 'An old-style railway-crossing warning: とまれ (stop) + みよ (look — an old command form of みる).', level: 'N5', credit: { author: 'hiro kobashi', license: 'CC BY 2.0', url: C('とまれみよ_(3374467515).jpg') } },
  { id: 'aim', img: 'real/aim.jpg', look: 'the big black words', read: 'しっかり ねらって', kana: 'しっかりねらって', romaji: 'shikkari neratte', en: 'Aim carefully!', note: 'A funny toilet sign in a shop. しっかり = firmly, properly; ねらって = aim (て-form used as a request).', level: 'N4', credit: { author: 'Hajime NAKANO', license: 'CC BY 2.0', url: C('しっかり_ねらって_(32810613387).jpg') } },
  { id: 'stop-please', img: 'real/stop-please.jpg', look: 'the red flag the guard is holding', read: '止まって下さい！', kana: 'とまってください', romaji: 'tomatte kudasai', en: 'Please stop!', note: '止まって = stop (て-form) + 下さい = please. 下さい is ください written with kanji.', level: 'N5', credit: { author: 'iMorpheus', license: 'CC BY 2.0', url: C('止まって下さい！_(1109417).jpg') } },
  { id: 'exit', img: 'real/exit.jpg', look: 'the green sign', read: '非常口', kana: 'ひじょうぐち', romaji: 'hijouguchi', en: 'Emergency exit', note: '非常 = emergency, 口 = opening (くち becomes ぐち here). You will see this green running man everywhere in Japan.', level: 'N4', credit: { author: '三峰パレス1301号室', license: 'CC BY-SA 4.0', url: C('初期非常口.jpg') } },
  { id: 'mens-toilet', img: 'real/mens-toilet.jpg', look: 'the sign on the right wall', read: '男子便所', kana: 'だんしべんじょ', romaji: 'danshi benjo', en: "Men's toilet", note: '男子 = men/boys, 便所 = toilet (a plain word; お手洗い and トイレ are softer). The small sign on the left says 女子便所 — women\'s toilet.', level: 'N4', credit: { author: 'chia ying Yang', license: 'CC BY 2.0', url: C('女子便所_男子便所_(8157785835).jpg') } },
  { id: 'evening-specials', img: 'real/evening-specials.jpg', look: 'the green title at the top', read: '夜のおすすめ', kana: 'よるのおすすめ', romaji: 'yoru no osusume', en: "Tonight's recommendations", note: '夜 = night/evening, の links the words, おすすめ = recommendation. Look for おすすめ on menus — it is what the shop is proud of.', level: 'N5', credit: { author: 'Richard, enjoy my life!', license: 'CC BY-SA 2.0', url: C('夜のおすすめ_(10326814796).jpg') } },
  { id: 'todays-picks', img: 'real/todays-picks.jpg', look: 'the title at the top of the menu', read: '本日のオススメ', kana: 'ほんじつのおすすめ', shown: 'ほんじつのオススメ', romaji: 'honjitsu no osusume', en: "Today's recommendations", note: '本日 is a polite word for "today" (= きょう). オススメ is おすすめ written in katakana to stand out.', level: 'N4', credit: { author: 'nakashi', license: 'CC BY-SA 2.0', url: C('元気な朝を_お迎えください_(52867021830).jpg') } },
  { id: 'limited-curry', img: 'real/limited-curry.jpg', look: 'the red words at the top', read: '限定カレー', kana: 'げんていかれー', shown: 'げんていカレー', romaji: 'gentei karee', en: 'Limited-time curry', note: '限定 = limited (only for a short time or in small numbers). カレー is katakana for curry — the ー makes the vowel long.', level: 'N4', credit: { author: 'hiro', license: 'CC BY-SA 2.0', url: C('限定カレー_(47958484683).jpg') } },
  { id: 'monkeys', img: 'real/monkeys.jpg', look: 'the first line of the white sign (it has small furigana!)', read: '野生の猿に注意してください', kana: 'やせいのさるにちゅういしてください', romaji: 'yasei no saru ni chuui shite kudasai', en: 'Please watch out for wild monkeys', note: '野生 = wild, 猿 = monkey, 注意して = be careful. The lines below say: don\'t go near them, don\'t look them in the eye, don\'t feed them.', level: 'N4', credit: { author: 'Michael Ocampo', license: 'CC BY 2.0', url: C('野生の猿に注意_(43773162130).jpg') } },
  { id: 'stop-look-kanji', img: 'real/stop-look-kanji.jpg', look: 'the top and the bottom of the sign', read: 'とまれ見よ 左右', kana: 'とまれみよさゆう', romaji: 'tomare miyo sayuu', en: 'Stop and look left and right', note: '見よ = look (old command form of 見る). 左右 = left and right (左 + 右).', level: 'N4', credit: { author: '663highland', license: 'CC BY-SA 3.0', url: C('Hyoshiki.jpg') } },
  { id: 'danger-stop', img: 'real/danger-stop.jpg', look: 'the red and the blue words', read: '危い 一時停止', kana: 'あぶないいちじていし', romaji: 'abunai ichiji teishi', en: 'Danger — stop here', note: '危い is an old spelling — today it is written 危ない. 一時停止 = a full stop for a moment (you see it on roads).', level: 'N3', credit: { author: 'George Dorn', license: 'CC BY-SA 2.0', url: C('危い_一時停止_(2450882964).jpg') } },
  { id: 'hours', img: 'real/hours.jpg', look: 'the red title at the very top', read: '定休日 日・月・祝日', kana: 'ていきゅうびにちげつしゅくじつ', romaji: 'teikyuubi nichi getsu shukujitsu', en: 'Closed on Sundays, Mondays and public holidays', note: '定休日 = regular day off. 日 = Sunday, 月 = Monday, 祝日 = public holiday. Below: a menu of 定食 (set meals) with prices.', level: 'N3', credit: { author: 'whity', license: 'CC BY 2.0', url: C('ラストオーダー_(6842716725).jpg') } },
  { id: 'genki-diner', img: 'real/genki-diner.jpg', look: 'the words in brackets on the yellow sign', read: '元気が出る食堂', kana: 'げんきがでるしょくどう', romaji: 'genki ga deru shokudou', en: 'A diner that gives you energy', note: '元気が出る = to feel energised, 食堂 = canteen/diner. The line above says 平田食事センター (Hirata Meal Center).', level: 'N4', credit: { author: '240', license: 'CC BY 2.0', url: C('元気が出る食堂_(4237899592).jpg') } },
  { id: 'station', img: 'real/station.jpg', look: 'the top line of the blue sign on the left', read: '静岡・東京', kana: 'しずおかとうきょう', romaji: 'shizuoka toukyou', en: 'Shizuoka, Tokyo (platform 4)', note: 'Platform signs list the main stops. The line below: 名古屋・新大阪 (なごや・しんおおさか) from platform 5.', level: 'N5', credit: { author: 'inunami', license: 'CC BY 2.0', url: C('待合室_(52268696966).jpg') } },
  { id: 'money-changer', img: 'real/money-changer.jpg', look: 'the sign at the bottom of the machine', read: '両替機', kana: 'りょうがえき', romaji: 'ryougaeki', en: 'Change machine', note: '両替 = changing money (e.g. a 1000-yen note into coins), 機 = machine. Very useful at stations and coin lockers.', level: 'N3', credit: { author: 'Michael Ocampo', license: 'CC BY 2.0', url: C('両替機_(44883316844).jpg') } },
  { id: 'lanterns', img: 'real/lanterns.jpg', look: 'the lantern on the far right', read: '日本酒', kana: 'にほんしゅ', romaji: 'nihonshu', en: 'Japanese sake', note: '日本 = Japan, 酒 = alcohol (さけ → しゅ in this word). The other lanterns: 串焼き (grilled skewers), ビフテキ (beef steak), 信州牛 (Shinshu beef).', level: 'N4', credit: { author: 'dconvertini', license: 'CC BY-SA 2.0', url: C('一生懸命_営業中_(48861100826).jpg') } },
  { id: 'oshinagaki', img: 'real/oshinagaki.jpg', look: 'the first words on the right of the banner', read: 'お品がき', kana: 'おしながき', romaji: 'oshinagaki', en: 'Menu', note: 'お品がき is a traditional word for a menu at Japanese restaurants. The next items are soba dishes like せいろ and 田舎そば with prices in 円.', level: 'N4', credit: { author: 'Manabu Itoh', license: 'CC BY-SA 2.0', url: C('お品がき_(15532484222).jpg') } },
];

/** Cute ways a teacher asks you to read something (original lines). */
export const READ_ASKS: { jp: string; en: string }[] = [
  { jp: 'ねえ、これ読んでくれる？わたし、読めなくて…', en: "Hey, can you read this for me? I can't read it…" },
  { jp: 'ちょっと見て！これ、なんて書いてあるの？', en: 'Look! What does this say?' },
  { jp: 'お願い、これ読んでほしいな。', en: "Please, I'd love it if you read this for me." },
  { jp: 'あれ？これ、どう読むの？教えて！', en: 'Huh? How do you read this? Tell me!' },
];
export const READ_THANKS: { jp: string; en: string }[] = [
  { jp: 'すごい！ありがとう！', en: 'Amazing! Thank you!' },
  { jp: 'わあ、読めるんだ！助かった！', en: 'Wow, you can read it! That helps!' },
  { jp: 'さすが！ありがとうね。', en: "As expected of you! Thanks!" },
];
export const READ_RETRY: { jp: string; en: string }[] = [
  { jp: 'おしい！もう一回聞かせて？', en: 'So close! Let me hear it once more?' },
  { jp: 'ん〜、ちょっと違うかも。一緒に読もう！', en: "Hmm, maybe a little different. Let's read it together!" },
];
