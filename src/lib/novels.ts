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
    author: "Kunle Adeyemi",
    tagline: "A school leader battles corruption and community pressure in modern Lagos.",
    genre: "Prose",
    examBody: "JAMB (Use of English)",
    about:
      "The story follows a principled headmaster in the Lekki area of Lagos as he confronts the everyday pressures of running a school: levies, inspectors, ambitious parents and political interference. His commitment to honesty is tested by a community that often rewards compromise.",
    setting:
      "Present-day Lagos, Nigeria — the school compound, staff room, parents' meetings and the wider Lekki neighbourhood.",
    characters: [
      { name: "The Headmaster", role: "Protagonist; disciplined, principled school leader" },
      { name: "The Proprietor", role: "Represents commercial interests that clash with integrity" },
      { name: "Staff members", role: "Colleagues whose reactions mirror societal attitudes" },
      { name: "Parents and PTA", role: "Pressure group; some supportive, some obstructive" },
      { name: "Students", role: "The stakes of every decision the headmaster makes" },
    ],
    themes: [
      { title: "Integrity vs corruption", detail: "The headmaster refuses bribes and shortcuts even when they would make life easier." },
      { title: "Leadership and responsibility", detail: "True leadership means service and sacrifice, not title-chasing." },
      { title: "Education as a social force", detail: "The school is a microcosm of society — its health reflects the community's values." },
      { title: "Moral courage", detail: "Doing right costs the headmaster comfort, allies and sometimes money." },
    ],
    chapters: [
      { title: "Part One — A new term", summary: "The headmaster resumes a new term and immediately faces unpaid levies, an ambitious proprietor and pressure to inflate results." },
      { title: "Part Two — Pressure mounts", summary: "Inspectors visit; parents lobby for favours; the headmaster's refusal to compromise earns him enemies." },
      { title: "Part Three — The test", summary: "A scandal threatens the school. The headmaster must choose between an easy cover-up and the hard truth." },
      { title: "Part Four — Resolution", summary: "Integrity wins, but at a price. The community begins to see the value of honest leadership." },
    ],
    examFocus: [
      "Who pressures the headmaster and why (levies, results, favours)",
      "Moments where the headmaster refuses money or compromise",
      "How staff and parents react to his strictness",
      "Vocabulary in context — often tests words from school/education registers",
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
      "The frame narrative: who tells the story and to whom",
      "Salma's character arc — pride → consequences → humility",
      "The roles of Dr. Sam John and Hakim",
      "Names of hostels, the EMAL driver episode, and exam-hall details",
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
