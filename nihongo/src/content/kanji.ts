// JLPT N5 kanji. Format: kanji | on-reading | kun-reading | meaning | example words
// Readings and meanings are standard dictionary facts (cross-checkable in KANJIDIC).
export interface Kanji { k: string; on: string; kun: string; en: string; words: { f: string; en: string }[]; level: string }
const raw = `
一|イチ|ひと(つ)|one|一[ひと]つ=one thing;一月[いちがつ]=January
二|ニ|ふた(つ)|two|二[ふた]つ=two things;二月[にがつ]=February
三|サン|みっ(つ)|three|三[みっ]つ=three things;三月[さんがつ]=March
四|シ|よん、よっ(つ)|four|四[よっ]つ=four things;四月[しがつ]=April
五|ゴ|いつ(つ)|five|五[いつ]つ=five things;五月[ごがつ]=May
六|ロク|むっ(つ)|six|六[むっ]つ=six things;六月[ろくがつ]=June
七|シチ|なな|seven|七[なな]つ=seven things;七月[しちがつ]=July
八|ハチ|やっ(つ)|eight|八[やっ]つ=eight things;八月[はちがつ]=August
九|キュウ、ク|ここの(つ)|nine|九[ここの]つ=nine things;九月[くがつ]=September
十|ジュウ|とお|ten|十[とお]=ten things;十月[じゅうがつ]=October
百|ヒャク||hundred|百[ひゃく]=100;三百[さんびゃく]=300
千|セン|ち|thousand|千[せん]=1,000;三千[さんぜん]=3,000
万|マン||ten thousand|一万[いちまん]=10,000;百万[ひゃくまん]=one million
円|エン|まる(い)|yen, circle|百円[ひゃくえん]=100 yen;千円[せんえん]=1,000 yen
日|ニチ、ジツ|ひ、か|day, sun|日本[にほん]=Japan;今日[きょう]=today;日曜日[にちようび]=Sunday
月|ゲツ、ガツ|つき|month, moon|月曜日[げつようび]=Monday;今月[こんげつ]=this month
火|カ|ひ|fire|火曜日[かようび]=Tuesday;火[ひ]=fire
水|スイ|みず|water|水[みず]=water;水曜日[すいようび]=Wednesday
木|モク|き|tree, wood|木[き]=tree;木曜日[もくようび]=Thursday
金|キン|かね|gold, money|お金[かね]=money;金曜日[きんようび]=Friday
土|ド|つち|earth, soil|土曜日[どようび]=Saturday
年|ネン|とし|year|今年[ことし]=this year;来年[らいねん]=next year
時|ジ|とき|time, hour|時間[じかん]=time;一時[いちじ]=one o'clock
分|フン、ブン|わ(かる)|minute, part, understand|五分[ごふん]=five minutes;分[わ]かります=to understand
半|ハン||half|半分[はんぶん]=half;三時半[さんじはん]=3:30
今|コン|いま|now|今[いま]=now;今日[きょう]=today
先|セン|さき|ahead, previous|先生[せんせい]=teacher;先週[せんしゅう]=last week
週|シュウ||week|今週[こんしゅう]=this week;来週[らいしゅう]=next week
毎|マイ||every|毎日[まいにち]=every day;毎朝[まいあさ]=every morning
午|ゴ||noon|午前[ごぜん]=a.m.;午後[ごご]=p.m.
前|ゼン|まえ|before, front|前[まえ]=front, before;午前[ごぜん]=a.m.
後|ゴ、コウ|あと、うし(ろ)|after, behind|後[あと]で=later;後[うし]ろ=behind
人|ジン、ニン|ひと|person|人[ひと]=person;日本人[にほんじん]=Japanese person;三人[さんにん]=three people
男|ダン|おとこ|man|男[おとこ]の人[ひと]=man
女|ジョ|おんな|woman|女[おんな]の人[ひと]=woman
子|シ|こ|child|子[こ]ども=child;女[おんな]の子[こ]=girl
父|フ|ちち|father|父[ちち]=my father;お父[とう]さん=father
母|ボ|はは|mother|母[はは]=my mother;お母[かあ]さん=mother
友|ユウ|とも|friend|友[とも]だち=friend
私|シ|わたし|I, private|私[わたし]=I, me
学|ガク|まな(ぶ)|study, learning|学生[がくせい]=student;大学[だいがく]=university
校|コウ||school|学校[がっこう]=school;高校[こうこう]=high school
生|セイ、ショウ|い(きる)、う(まれる)|life, birth|先生[せんせい]=teacher;生[う]まれます=to be born
本|ホン|もと|book, origin|本[ほん]=book;日本[にほん]=Japan
語|ゴ|かた(る)|language, word|日本語[にほんご]=Japanese;英語[えいご]=English
名|メイ|な|name|名前[なまえ]=name;有名[ゆうめい]=famous
何|カ|なに、なん|what|何[なに]=what;何時[なんじ]=what time
大|ダイ、タイ|おお(きい)|big|大[おお]きい=big;大学[だいがく]=university
小|ショウ|ちい(さい)|small|小[ちい]さい=small;小学校[しょうがっこう]=elementary school
中|チュウ|なか|middle, inside|中[なか]=inside;中国[ちゅうごく]=China
上|ジョウ|うえ|up, above|上[うえ]=above, on top;上手[じょうず]=skilled
下|カ、ゲ|した|down, below|下[した]=below;地下鉄[ちかてつ]=subway
左|サ|ひだり|left|左[ひだり]=left
右|ウ、ユウ|みぎ|right|右[みぎ]=right
東|トウ|ひがし|east|東[ひがし]=east;東京[とうきょう]=Tokyo
西|セイ、サイ|にし|west|西[にし]=west;西口[にしぐち]=west exit
南|ナン|みなみ|south|南[みなみ]=south;南口[みなみぐち]=south exit
北|ホク|きた|north|北[きた]=north;北口[きたぐち]=north exit
外|ガイ|そと|outside|外[そと]=outside;外国[がいこく]=foreign country
国|コク|くに|country|国[くに]=country;外国人[がいこくじん]=foreigner
山|サン|やま|mountain|山[やま]=mountain;富士山[ふじさん]=Mt. Fuji
川|セン|かわ|river|川[かわ]=river
雨|ウ|あめ|rain|雨[あめ]=rain
天|テン||heaven, sky|天気[てんき]=weather
気|キ||spirit, air|元気[げんき]=well, healthy;天気[てんき]=weather
電|デン||electricity|電車[でんしゃ]=train;電話[でんわ]=telephone
車|シャ|くるま|car, vehicle|車[くるま]=car;電車[でんしゃ]=train
駅|エキ||station|駅[えき]=station;東京駅[とうきょうえき]=Tokyo Station
店|テン|みせ|shop|店[みせ]=shop;喫茶店[きっさてん]=café
道|ドウ|みち|road, way|道[みち]=road, way
入|ニュウ|はい(る)、い(れる)|enter|入口[いりぐち]=entrance;入[はい]ります=to enter
出|シュツ|で(る)、だ(す)|exit, go out|出口[でぐち]=exit;出[で]ます=to leave
口|コウ|くち|mouth, opening|口[くち]=mouth;出口[でぐち]=exit
行|コウ|い(く)|go|行[い]きます=to go;銀行[ぎんこう]=bank
来|ライ|く(る)|come|来[き]ます=to come;来週[らいしゅう]=next week
見|ケン|み(る)|see, look|見[み]ます=to see, watch
聞|ブン|き(く)|hear, ask|聞[き]きます=to listen, ask;新聞[しんぶん]=newspaper
話|ワ|はな(す)|talk|話[はな]します=to speak;電話[でんわ]=telephone
読|ドク|よ(む)|read|読[よ]みます=to read
書|ショ|か(く)|write|書[か]きます=to write
食|ショク|た(べる)|eat|食[た]べます=to eat;食[た]べ物[もの]=food
飲|イン|の(む)|drink|飲[の]みます=to drink;飲[の]み物[もの]=a drink
買|バイ|か(う)|buy|買[か]います=to buy;買[か]い物[もの]=shopping
休|キュウ|やす(む)|rest|休[やす]みます=to rest;休[やす]み=holiday, break
立|リツ|た(つ)|stand|立[た]ちます=to stand
言|ゲン|い(う)|say|言[い]います=to say
会|カイ|あ(う)|meet|会[あ]います=to meet;会社[かいしゃ]=company
社|シャ||company, shrine|会社[かいしゃ]=company;会社員[かいしゃいん]=office worker
高|コウ|たか(い)|high, expensive|高[たか]い=expensive, tall
安|アン|やす(い)|cheap, safe|安[やす]い=cheap
新|シン|あたら(しい)|new|新[あたら]しい=new;新聞[しんぶん]=newspaper
古|コ|ふる(い)|old|古[ふる]い=old (things)
長|チョウ|なが(い)|long|長[なが]い=long
白|ハク|しろ(い)|white|白[しろ]い=white
多|タ|おお(い)|many|多[おお]い=many
少|ショウ|すこ(し)、すく(ない)|few, a little|少[すこ]し=a little
手|シュ|て|hand|手[て]=hand;上手[じょうず]=skilled
目|モク|め|eye|目[め]=eye
耳|ジ|みみ|ear|耳[みみ]=ear
足|ソク|あし|foot, leg|足[あし]=foot, leg
花|カ|はな|flower|花[はな]=flower;花見[はなみ]=flower viewing
魚|ギョ|さかな|fish|魚[さかな]=fish
空|クウ|そら|sky, empty|空[そら]=sky;空港[くうこう]=airport
間|カン|あいだ|interval, between|時間[じかん]=time;間[あいだ]=between
`;
export const KANJI: Kanji[] = raw.trim().split('\n').map(line => {
  const [k, on, kun, en, w] = line.split('|');
  return { k, on, kun, en, level: 'N5', words: w.split(';').map(x => { const [f, e] = x.split('='); return { f, en: e }; }) };
});
export const KANJI_MAP = new Map(KANJI.map(k => [k.k, k]));
