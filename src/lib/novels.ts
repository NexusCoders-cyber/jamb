/**
 * JAMB/UTME set texts — study notes for the novel reader.
 * Each entry powers /novels (list) and /novels/[slug] (reader).
 */

export type NovelChapter = {
  title: string;
  summary: string;
};

export type NovelNotes = {
  slug: string;
  title: string;
  author: string;
  /** Short tagline shown on cards */
  tagline: string;
  genre: "Prose" | "Drama" | "Poetry";
  /** Rough reading level / exam relevance */
  examBody: "JAMB (Use of English)" | "JAMB (Literature)";
  about: string;
  setting: string;
  characters: { name: string; role: string }[];
  themes: { title: string; detail: string }[];
  chapters: NovelChapter[];
  /** Exam pointers — what JAMB-style questions usually target */
  examFocus: string[];
};

export const NOVELS: NovelNotes[] = [
  {
    slug: "the-lekki-headmaster",
    title: "The Lekki Headmaster",
    author: "Kabir Alabi Garba",
    tagline: "Beloved principal Bepo weighs joining his family in the UK against the school that made him — and stuns everyone at the airport.",
    genre: "Prose",
    examBody: "JAMB (Use of English)",
    about:
      "Mr. Bepo Adewale — 'Principoo' to his students — has led Stardom Schools in Lekki, Lagos for over two decades. Pressured by his wife Seri, a nurse already in the UK with their two children, and enticed by tales of life abroad, he resigns to 'japa'. The novel follows his visa battles, the school dramas he leaves behind, a three-day farewell that stirs memories of the slave trade, and a twist ending: at the departure gate he screams 'Noooo!' and never boards the flight, returning to the school gates on Monday morning declaring, 'My heart is here!'",
    setting:
      "Stardom Schools, an elite private school in Lekki, Lagos — with flashbacks to Beesway Group of School, the Badagry slave-route heritage sites, passport offices in Ibadan, and a family life split between Lagos and the UK.",
    characters: [
      { name: "Bepo Adewale", role: "Protagonist; principal of Stardom Schools, nicknamed 'Principoo' and 'The Lekki Headmaster'" },
      { name: "Mrs. Ibidun Gloss", role: "Managing Director of Stardom Schools; daughter of the late founder Chief David Aje" },
      { name: "Seri", role: "Bepo's wife; a nurse in the UK whose success pressures him to leave" },
      { name: "Nike and Kike", role: "Bepo's two children, living in the UK with their mother" },
      { name: "Mrs. Grace Apeh", role: "Stern Vice Principal; one of the few Bepo confides in" },
      { name: "Mr. Audu", role: "Fine Arts teacher and staff comedian; defuses the Fafore grammar crisis with a joke" },
      { name: "Mr. Jeremi Amos", role: "The school accountant" },
      { name: "Mr. Fafore", role: "English teacher nearly sacked over the grammatically correct sentence 'Ade as well as Jide comes early'" },
      { name: "Mrs. Ignatius", role: "Parent whose family's visa plans collapse after a DNA test questions her daughter Favour's paternity" },
      { name: "Bibi and Mrs. Ladele", role: "Student plagued by nightmares of a teacher's tribal marks, and her Nollywood-loving mother" },
      { name: "Mr. Ayesoro", role: "Government teacher with deep tribal marks, nicknamed 'Mr. Owala'; transferred after Bibi's nightmares" },
      { name: "Banky and Tosh", role: "Rival students whose feud erupts during the prefect election" },
      { name: "Chief Didi Ogba", role: "Tosh's father; detained 36 months over a N2.5 billion contract before being cleared" },
      { name: "Chief Mrs. Solape Bayo", role: "Board chairperson and the MD's mother; her 'snake in the roof' line names the crisis" },
      { name: "Tai", role: "Passport agent in Ibadan who overcharges Bepo during the renewal ordeal" },
      { name: "Jide", role: "Bepo's landlord's grandson and mentee; his emotional farewell shows Bepo's impact" },
      { name: "Mr. Egi Meko", role: "Director of Beesway Group of School; the ritualist episode's antagonist from Bepo's past" },
      { name: "Mr. Nku", role: "Former staff member who absconded with a N2 million cooperative loan" },
    ],
    themes: [
      { title: "Japa syndrome (migration and brain drain)", detail: "The novel's heartbeat: nurses, doctors and teachers flee Nigeria. Seri left first; even Bepo, the model educator, is pulled along — until he turns back." },
      { title: "Patriotism vs personal ambition", detail: "Bepo's final choice — staying to build rather than leaving to earn — answers the question the whole book poses." },
      { title: "Slavery memory as metaphor", detail: "Badagry's Point of No Return haunts Bepo: he sees modern 'japa' in the slave route, and dreams of being herded onto a ship as he is about to fly." },
      { title: "Education as service, not business", detail: "Bepo's Invention Club, excursions and mentorship embody teaching as vocation, against purely commercial interests." },
      { title: "Integrity and precision", detail: "Bepo riskily defends Mr. Fafore's correct grammar against an enraged MD — truth over convenience." },
      { title: "Corruption and institutional decay", detail: "Passport queues, agent Tai's N30,000 markup, and NIN network failures show public institutions buckling under the Japa rush." },
      { title: "Ritualism and superstition", detail: "The Beesway flashback — a live cow buried at 2:51am and a 'ritual to boost enrolment' — indicts hidden practices behind some schools." },
      { title: "Family, separation and sacrifice", detail: "Bepo is torn between his wife and children abroad and his school 'family' at home; either choice costs him." },
    ],
    chapters: [
      { title: "Dusk", summary: "Bepo's last day: after more than two decades, his resignation to relocate to the UK is accepted tearfully — the dusk of an era at Stardom Schools." },
      { title: "The Enticement", summary: "How the decision grew: Seri moved to the UK with Nike and Kike; Mrs. Ignatius offered visa help; colleagues joked about £3,600/month versus his ₦400,000; Bepo dreaded abandoning his Invention Club and excursion programme." },
      { title: "Migration Tales", summary: "Stories of Nigerians abroad — lecturers driving Uber, architects cleaning offices, thriving nurses. Bepo fears becoming, as a returned doctor put it, 'a nobody trying to become a somebody.'" },
      { title: "A Case of Visa Denied", summary: "Bepo's first visa is denied because the officer cannot believe he would abandon his career; a second application succeeds. Meanwhile Bibi's nightmares force Mr. Ayesoro's transfer." },
      { title: "Snake in the Roof", summary: "The MD discovers 17 staff cars hidden behind the school. The cooperative's N95 million — over N50 million out as loans — draws suspicion; the board caps staff loans at N250,000." },
      { title: "Ade as Well as Jide COMES vs. COME", summary: "Open Day: Mr. Guta storms out over a sentence in his son's notebook and the MD orders Mr. Fafore sacked. Bepo calmly proves 'as well as' takes a singular verb — Fafore was right all along." },
      { title: "Ritualists", summary: "Flashback to Beesway Group of School: Mr. Egi Meko buries a live cow on campus at 2:51am; Bepo is struck and threatened. Years earlier, Mr. Ogo's enrolment 'ritual' offer was refused — Ogo later made the news for murder." },
      { title: "Missions Unaccomplished", summary: "Loose ends Bepo hates to leave: the Banky–Tosh feud (rooted in Chief Didi Ogba's detention over a N2.5 billion contract) and the Invention Club's five-year Breath Project phone initiative." },
      { title: "Laughing Waterfalls", summary: "A celebration of the excursion programme: Owu Waterfalls (120m, West Africa's highest), Ikogosi Warm Springs, Erin-Ijesha, Gurara, Yankari — and Badagry's slave route, where Bepo first draws the parallel between the slave trade and japa." },
      { title: "Passport Pains", summary: "The renewal ordeal: COVID-era delays, Japa-swelled queues, an Ibadan trip, agent Tai charging N100,000 against the official N70,000, and NIN validation glitches that nearly wreck his travel date." },
      { title: "Point of No Return", summary: "Three-day farewell: staff beat students 3-2 in a biasedly refereed match; SSS 3 win the arts-vs-sciences debate citing Soyinka's 1986 Nobel; the Canoe dance plunges Bepo into a slave-trade nightmare ('Noooo!'); Mrs. Gloss gifts a $10,000 cheque — Stardom's largest ever." },
      { title: "...Dawn", summary: "At the airport Bepo dreams of slaves marched to the Point of No Return — a white man points: 'Enter!' — and he screams 'Noooo!' without boarding. Monday morning: 'Principoo!' rings at the gate as students carry him shoulder-high. 'I am back! I didn't go! My heart is here!'" },
    ],
    examFocus: [
      "Author: Kabir Alabi Garba. Protagonist: Mr. Bepo Adewale ('Principoo'), principal of Stardom Schools, Lekki, Lagos — for over 24 years.",
      "Key figures: N95 million cooperative funds; over N50 million loaned out; N250,000 loan cap; Mr. Nku's N2 million; 17 hidden cars; £3,600 vs ₦400,000 salaries; N100,000 vs N70,000 passport fees; the $10,000 farewell cheque; Owu Falls at 120 metres; Chief Ogba's 36 months' detention over N2.5 billion; staff beat students 3-2.",
      "Catchphrases: 'other things being equal...', 'if you say education is too expensive, try ignorance!', 'japa', 'a nobody trying to become a somebody'.",
      "The grammar rule behind the Fafore crisis: 'as well as' takes a singular verb — 'Ade as well as Jide COMES early'.",
      "The Dusk → ...Dawn frame and the double meaning of 'Point of No Return' (Badagry slave route AND emigration).",
      "The ending twist: Bepo never boards the Emirates flight — he returns to school on Monday morning.",
      "Who said what: 'snake in the roof' — Chief Mrs. Solape Bayo; the visa denial reason — an officer who couldn't believe he would abandon his career.",
    ],
  },
  {
    slug: "the-life-changer",
    title: "The Life Changer",
    author: "Khadija Abubakar Jalli",
    tagline: "Salma's campus years — temptation, consequences and second chances.",
    genre: "Prose",
    examBody: "JAMB (Use of English)",
    about:
      "The novel follows Salma, a confident young woman who leaves home for university. Her choices — from flouting hostel rules to trusting the wrong people — bring consequences that force her to grow. Told as a family conversation between Ummi and her children, the frame narrative lets the mother turn campus events into life lessons.",
    setting:
      "Ahmadu Bello University, Zaria, and the family home where Ummi narrates the story to her children.",
    characters: [
      { name: "Ummi", role: "Narrator within the frame; mother teaching life lessons" },
      { name: "Salma", role: "Proud, attractive student whose choices drive the plot" },
      { name: "Omar", role: "Ummi's son awaiting admission; the listener" },
      { name: "Teemah, Jamila, Bint", role: "Ummi's other children in the frame story" },
      { name: "Dr. Sam John", role: "Kind lecturer who helps Salma after her missteps" },
      { name: "Hakim", role: "Salma's eventual husband" },
      { name: "Talle / Zaki", role: "Hostel figures tied to the kidnapping episode" },
    ],
    themes: [
      { title: "Pride goes before a fall", detail: "Salma's arrogance in the examination hall and hostel costs her dearly." },
      { title: "Consequences of choices", detail: "Every mistake — exam malpractice, Dishonest Drivers, blind trust — carries a price." },
      { title: "Forgiveness and second chances", detail: "Dr. Sam John's kindness and Salma's reform show growth is possible." },
      { title: "Values and moral education", detail: "The frame story stresses honesty, humility and respect for rules." },
      { title: "Gender and campus life", detail: "Female students navigate pressures and vulnerabilities in higher institutions." },
    ],
    chapters: [
      { title: "1. The story begins", summary: "Ummi waits for Omar's admission; she starts narrating her own university days to teach her children." },
      { title: "2. Salma's arrival", summary: "Salma impresses everyone with her beauty and confidence but shows disdain for rules and people." },
      { title: "3. The examination hall", summary: "Salma flouts exam protocols, invigilators mark her, and her pride sets her on a collision course." },
      { title: "4. Hostel and social life", summary: "Campus relationships, tiny events and small dishonesties accumulate around Salma." },
      { title: "5. Trouble and regret", summary: "Salma's choices catch up with her; she faces consequences that humble her." },
      { title: "6. Redemption", summary: "Helped by Dr. Sam John and later marrying Hakim, Salma rebuilds her life — the 'life changer' of the title." },
    ],
    examFocus: [
      "The frame narrative: Ummi tells the story to her children while they wait for Omar's admission",
      "Salma's character arc — pride → consequences → humility",
      "The roles of Dr. Sam John and Hakim",
      "The exam-hall episode and the Talle–Zaki kidnapping arrest",
    ],
  },
  {
    slug: "sweet-sixteen",
    title: "Sweet Sixteen",
    author: "Bolaji Abdullahi",
    tagline: "A father's letter to his sixteen-year-old daughter entering adulthood.",
    genre: "Prose",
    examBody: "JAMB (Use of English)",
    about:
      "Written as a long letter from a father (Alhaji) to his daughter Aliya on her sixteenth birthday, the novel weaves memories, conversations and advice into lessons about puberty, religion, integrity, social media and dating. It is a coming-of-age guide in story form.",
    setting: "Kaduna, Nigeria — family home, school scenes and reflective flashbacks across Aliya's childhood.",
    characters: [
      { name: "Alhaji (the father)", role: "Narrator; loving, wise, humorous guide" },
      { name: "Aliya", role: "Sixteen-year-old daughter; the letter's recipient" },
      { name: "Bunmi", role: "Aliya's schoolmate whose behaviour triggers lessons" },
      { name: "Kemi", role: "Friend; foil in school episodes" },
      { name: "Mrs. Gem", role: "Teacher figure in school scenes" },
    ],
    themes: [
      { title: "Growing up", detail: "Puberty, body changes and responsibility are discussed frankly and warmly." },
      { title: "Integrity", detail: "The father insists on honesty even in small things — the basis of character." },
      { title: "Religion and morality", detail: "Islamic values frame the father's advice without being preachy." },
      { title: "Social media and self-image", detail: "Cautionary lessons about online life and comparison." },
      { title: "Parental love", detail: "The letter form itself is an act of love — guidance over control." },
    ],
    chapters: [
      { title: "The letter", summary: "Alhaji begins the birthday letter; we learn the family's warmth and his intentions." },
      { title: "Becoming a woman", summary: "Memories of Aliya's first period and the father's gentle, factual guidance." },
      { title: "School episodes", summary: "Bunmi and other schoolmates provide teachable moments about boys, lies and peer pressure." },
      { title: "The grandfather's death", summary: "A sober episode that deepens reflections on mortality and faith." },
      { title: "Advice and parting words", summary: "Concentrated wisdom on integrity, religion, dating and the future." },
    ],
    examFocus: [
      "The letter form and why it suits the story",
      "Specific father–daughter conversations (period, boys, religion)",
      "Bunmi's role as a negative example",
      "Memorable aphorisms — JAMB loves quoting the father's maxims",
    ],
  },
  {
    slug: "the-last-days-at-forcados-high",
    title: "The Last Days at Forcados High",
    author: "A. H. Mohammed",
    tagline: "Final-year students navigate friendship, rivalry and tragedy at school.",
    genre: "Prose",
    examBody: "JAMB (Use of English)",
    about:
      "Set in the last year of secondary school at Forcados High, the story follows Jimi Solade and his classmates through exams, football, crushes, family trouble and a devastating accident. Friendship, forgiveness and growing up are at its heart.",
    setting: "Forcados High School in the Niger Delta region; homes and hangouts of final-year students.",
    characters: [
      { name: "Jimi Solade", role: "Protagonist; popular, intelligent, troubled by family" },
      { name: "Ansa Iza", role: "Jimi's loyal best friend" },
      { name: "Efua Coker", role: "New girl; misunderstood, central to the plot's emotional arc" },
      { name: "Wole Solade", role: "Jimi's estranged elder brother; a source of shame and danger" },
      { name: "Nene Ekpo", role: "Classmate; kind and observant" },
      { name: "Mrs. Kemi / teachers", role: "School authority figures shaping discipline and care" },
    ],
    themes: [
      { title: "Friendship and loyalty", detail: "Jimi and Ansa's bond survives envy, girls and misjudgement." },
      { title: "Prejudice and gossip", detail: "The school misjudges Efua; rumours nearly destroy her." },
      { title: "Family and brotherhood", detail: "Wole's criminal path forces Jimi to confront loyalty vs principle." },
      { title: "Growing up", detail: "Final-year pressures — exams, first love, future choices." },
      { title: "Forgiveness", detail: "The ending turns on reconciliation after tragedy." },
    ],
    chapters: [
      { title: "Final year begins", summary: "Jimi's world: friends, football, exams — and tension at home with Wole." },
      { title: "Efua arrives", summary: "The new girl keeps to herself; her reserve breeds suspicion." },
      { title: "Rumours spread", summary: "A hurtful letter and gossip make Efua an outcast; Jimi is torn." },
      { title: "The accident", summary: "Tragedy strikes through Wole's recklessness; the school reels." },
      { title: "Truth and forgiveness", summary: "Misunderstandings clear; the class learns empathy before parting ways." },
    ],
    examFocus: [
      "The letter incident and who wrote it",
      "Efua's true character vs school gossip",
      "Wole's arc and its effect on Jimi",
      "How the school handles tragedy and reconciliation",
    ],
  },
  {
    slug: "nineteen-eighty-four",
    title: "Nineteen Eighty-Four",
    author: "George Orwell",
    tagline: "Totalitarian control, surveillance and the crushing of one man's mind.",
    genre: "Prose",
    examBody: "JAMB (Literature)",
    about:
      "In Oceania, the Party watches everyone through telescreens. Winston Smith, a minor official who rewrites history, dares to think forbidden thoughts, keeps a diary, falls in love with Julia and seeks the Brotherhood — and the state breaks him completely in Room 101.",
    setting: "Airstrip One (formerly Britain), Oceania — Victory Mansions, the Ministry of Truth, the proles' quarters, Room 101.",
    characters: [
      { name: "Winston Smith", role: "Protagonist; quiet rebel against the Party" },
      { name: "Julia", role: "Winston's lover; rebel in practice, not in ideology" },
      { name: "O'Brien", role: "Inner Party member; betrayer and torturer" },
      { name: "Big Brother", role: "The Party's ever-watching face — may not exist at all" },
      { name: "Mr. Charrington", role: "Shopkeeper who is really a Thought Police agent" },
      { name: "Parsons", role: "Loyal worker betrayed by his own children" },
      { name: "Syme", role: "Newspeak philologist; vaporised for being too intelligent" },
    ],
    themes: [
      { title: "Totalitarianism and surveillance", detail: "Telescreens, Thought Police and children spying show total control." },
      { title: "Control of language and thought", detail: "Newspeak shrinks vocabulary until rebellion becomes unthinkable." },
      { title: "Rewriting history", detail: "Winston's job at the Ministry of Truth shows the past is whatever the Party says." },
      { title: "Betrayal and the destruction of love", detail: "Room 101 forces Winston to betray Julia — the Party's final victory." },
      { title: "Doublethink", detail: "Holding two contradictory beliefs at once is the Party's deepest mind-control." },
    ],
    chapters: [
      { title: "Part One — The world of the Party", summary: "Winston's grey life, the telescreens, the diary, and the Two Minutes Hate that fixates on O'Brien and Julia." },
      { title: "Part Two — Love and rebellion", summary: "Winston and Julia's affair, the rented room, and their trust in O'Brien and the mythical Brotherhood." },
      { title: "Part Three — The Ministry of Love", summary: "Betrayal, torture, Room 101's rats, and Winston's final, broken love for Big Brother." },
    ],
    examFocus: [
      "Slogans: WAR IS PEACE, FREEDOM IS SLAVERY, IGNORANCE IS STRENGTH",
      "Newspeak, doublethink, memory hole, unperson",
      "O'Brien's role and the line 'We shall meet in the place where there is no darkness'",
      "The ending: why loving Big Brother is the Party's triumph",
    ],
  },
];

export function getNovel(slug: string): NovelNotes | undefined {
  return NOVELS.find((n) => n.slug === slug);
}
