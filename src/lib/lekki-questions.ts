/**
 * The Lekki Headmaster — 124 JAMB past questions (static dataset).
 * Used in the novel reader, Practice mode, and the Arena novel duel.
 *
 * answer is 0-indexed (A=0, B=1, C=2, D=3).
 *
 * This bundled dataset is the ONLY source of set-text questions in English mock exams, so they
 * keep working offline. Options are kept in their dataset order so the stored answer keys stay valid.
 */
import type { NormalizedQuestion } from "./aloc";
import { CURRENT_UTME_NOVEL } from "./setTexts";

export type NovelQuestion = {
  id: string;
  prompt: string;
  options: string[];
  answer: number;
  explanation: string;
};

function q(
  id: number,
  prompt: string,
  opts: [string, string, string, string],
  ans: "A" | "B" | "C" | "D",
  explanation: string,
): NovelQuestion {
  return {
    id: `lhm-${id}`,
    prompt,
    options: opts,
    answer: { A: 0, B: 1, C: 2, D: 3 }[ans],
    explanation,
  };
}

export const LEKKI_QUESTIONS: NovelQuestion[] = [
  q(1, "Why was Mr. Bepo hesitant to renew his passport?", ["He was too busy with his teaching duties", "He had lost his passport", "He didn't plan to travel abroad anytime soon", "He had heard about the difficulties applicants faced"], "D", "Mr. Bepo was hesitant because he had heard about the difficulties applicants faced during passport renewal."),
  q(2, "What caused a disruption in the Ignatius family's plans to move?", ["Their visa application was denied.", "Mr. Ignatius lost his job.", "Mrs. Ignatius changed her mind about relocating.", "A DNA test revealed Mr. Ignatius was not Favour's biological father."], "D", "A DNA test revealed that Mr. Ignatius was not the biological father of Favour, disrupting their plans. (page 20)"),
  q(3, "What did Mr. Guta request in the MD's office concerning Mr. Fafore?", ["A change in his son's class teacher", "A salary increase for Mr. Fafore", "A public apology from Mr. Fafore", "The immediate dismissal of Mr. Fafore"], "D", "Mr. Guta demanded the immediate dismissal of Mr. Fafore over a supposed grammatical error. (page 27)"),
  q(4, "How much did the form for Head Boy or Head Girl cost in the Stardom school election?", ["N25,000", "N40,000", "N50,000", "N60,000"], "C", "The form cost N50,000. (page 41)"),
  q(5, "What does Mr. Bepo's reluctance to relocate indicate about his values?", ["He feels unprepared for a new environment.", "He values financial security over personal fulfillment.", "He avoids making difficult decisions.", "He prioritizes his students and professional relationships."], "D", "Despite the advantages of relocating, Bepo valued his students and professional relationships above personal gain."),
  q(6, "Why did the school stop allowing students to copy notes from the Class Prefect?", ["The teachers believe it wastes time", "The students often make errors when copying notes", "It disrupts classroom management", "A parent sued the school for this practice"], "D", "A parent (an oil-company accountant) sued the school after his daughter was exploited for her handwriting. (page 29)"),
  q(7, "How much money was in the account of the Stardom Cooperative Society?", ["Over N50 million", "N200 million", "N45 million", "N95 million"], "D", "The cooperative had N95 million, with over N50 million loaned out. (page 26)"),
  q(8, "What tourist attraction did the students visit in Bauchi?", ["Ikogosi Warm Springs", "Arinta Waterfalls", "Erin Ijesha Waterfalls", "Yakari Games Reserve"], "D", "The students visited the Yakari Games Reserve in Bauchi. (page 45)"),
  q(9, "Why did Mr. Ignatius want to relocate his family?", ["To find better jobs abroad.", "To reunite with his extended family abroad.", "To enroll his children in Stardom schools abroad.", "To secure a better future for his children."], "D", "Mr. Ignatius feared that children raised abroad would surpass his own children. (page 20)"),
  q(10, "What does the term 'japa' mean in the context of the novel?", ["To work as a slave in a foreign country", "To resist colonial influences in modern times", "The struggle for financial independence", "To travel abroad in search of better opportunities"], "D", "In the novel, 'to japa' means to leave Nigeria for better opportunities abroad — a central theme."),
  q(11, "What lesson does the novel convey about migration?", ["Migration guarantees success", "Migration should always be the last option", "Migration is a betrayal of one's roots", "Migration brings mixed blessings and challenges"], "D", "The novel illustrates both positive and negative aspects of migration through various characters."),
  q(12, "Why did the director of Beesway Group of Schools claim the ritual with the cow was necessary?", ["To pray for his late father who gave him the land", "To appease the parents who had raised complaints", "To conduct a purification ceremony for the school", "To bring in more pupils to the school"], "A", "The director explained the ritual was a prayer for his late father who had given him the land. (page 41)"),
  q(13, "Why do most Nigerians prefer relocating to the UK, according to the novel?", ["Free education and healthcare for their children", "Higher job opportunities compared to other countries", "Easier visa application process", "Better climate conditions"], "A", "The novel suggests Nigerians prefer the UK for better education and healthcare for their children. (pages 16–17)"),
  q(14, "What factor made Mr. Bepo cautious about commercial transportation?", ["Lack of interest in the sector", "Lack of startup capital", "High operational costs", "Untrustworthy commercial drivers"], "D", "Bepo was cautious because of unreliable drivers who defrauded vehicle owners. (page 12)"),
  q(15, "Which two students have a rivalry dating back to JSS 3?", ["Banky and Tosh", "Ogba and Tosh", "Ogba and Banky", "Seri and Kemi"], "A", "Banky and Tosh have a rivalry from JSS 3; Banky won the Best Dancer category at the end-of-year party. (page 42)"),
  q(16, "What does the MD discover about the land Stardom acquired two years ago?", ["It is being used for illegal activities.", "It has been sold without her knowledge.", "It is being developed into a new school building.", "Teachers and staff are using it as a car park."], "D", "The MD discovered staff were using the land as a car park. (pages 24–25)"),
  q(17, "Why do Mr. Bepo's colleagues find his reluctance to relocate amusing?", ["They believe he should jump at the opportunity to earn more abroad.", "They think he dislikes the United Kingdom.", "They think he is afraid of flying.", "They assume he wants to stay to fulfil entrepreneurial dreams."], "A", "Staff found it amusing because they believed he should earn more abroad. (page 11)"),
  q(18, "What trait earned Mr. Bepo the nickname 'The Lekki Headmaster'?", ["His excellent teaching skills", "His innovative teaching methods", "His strictness with students", "His ability to resolve conflicts amicably"], "D", "Mr. Audu compared Bepo's conflict-resolution to King Oloja from Village Headmaster. (page 10)"),
  q(19, "What does the term 'roforofos' most likely refer to?", ["Petty disagreements and conflicts", "School projects", "Friendly greetings", "Mismanagement issues"], "A", "'Roforofos' refers to petty disagreements and conflicts. (page 10)"),
  q(20, "What was the source of the name 'Badagry', according to the novel?", ["It was named after the Badagry River", "It originated from a European explorer's name", "It was named after a nearby slave market", "It was derived from 'Agbadarigi'"], "D", "The name Badagry originated from 'Agbadarigi'. (page 47)"),
  q(21, "How much was the boarding fee per session at Stardom before the reduction?", ["N163,000", "N250,000", "N160,000", "N93,000"], "B", "The boarding fee was N250,000 before it was reduced to N165,000."),
  q(22, "What caused the conflict during the prefect election speech?", ["Banky insulted Tosh's father", "Tosh's mother accused the school of favoritism", "Banky attempted to bribe the judges", "Bepo intervened in the voting process"], "A", "Banky insulted Tosh's father during the speech, triggering the conflict."),
  q(23, "Where does Bepo reside?", ["Adeniyi Jones, Ikeja, Lagos", "Obalende, Ikoyi, Lagos", "Yaba, Lagos", "Oniru, Victoria Island, Lagos"], "A", "Bepo resides at Adeniyi Jones, Ikeja, Lagos. (page 19)"),
  q(24, "How much does Seri earn monthly as a nurse in the UK?", ["£3,600", "£6,000", "£10,000", "£1,000"], "C", "Seri was rumoured to earn about £10,000 per month as a nurse. (page 11)"),
  q(25, "What items did Mr. Bepo's wife insist he pack for his trip?", ["Locust beans, egusi, ground crayfish and dry snails", "His passport and essential documents", "Fruits and water", "New clothes and electronics"], "A", "His wife advised him to pack iru, egusi with crayfish, and dry snails. (page 60)"),
  q(26, "What was the board's decision on loans from the cooperative?", ["The cooperative must stop lending money to staff immediately.", "All loan requests must be approved by the staff union.", "No loans can be given to staff under any circumstances.", "Staff loans cannot exceed N250,000"], "D", "The board decided no staff member could borrow more than N250,000. (page 26)"),
  q(27, "Why did Bepo leave Beesway Group of School?", ["He witnessed an event he considered ungodly", "He was accused of sharing confidential information", "He was dissatisfied with the grammatical error in the school's name", "He disagreed with the director about his salary"], "A", "Bepo left after witnessing a ritual he found ungodly. (chapter 7)"),
  q(28, "Who offered to drive Mr. Bepo to the airport?", ["Mr. Ogunwale", "Mr. Oyelana", "The Stardom accountant", "Mrs. Grace Apeh"], "A", "Mr. Ogunwale, Bepo's landlord, offered to drive him. (page 60)"),
  q(29, "What inappropriate remark did Banky make during Speech Day?", ["Tosh bribed his way into the election", "Tosh lacked the required skill for the role", "Tosh was unqualified for the position", "Tosh was the son of an ex-convict"], "D", "Banky said 'Instead of voting for the son of an ex-convict, cast your vote for me…'. (page 42)"),
  q(30, "What grammatical rule caused disagreement between the MD and the principal?", ["The proper placement of modifiers", "The use of conjunctions", "Subject-verb agreement with phrases like 'as well as'", "The use of the subjunctive mood"], "C", "The disagreement was about 'Ade as well as Jide comes vs. come' — subject-verb agreement. (chapter 6)"),
  q(31, "What simile did the MD use to describe the risk of the cooperative funds?", ["It's like hanging a snake in the roof and going to bed.", "It's like building castles in the air.", "It's like lighting a fire in the middle of a haystack.", "It's like giving a sword to your enemy."], "A", "The MD used this simile on page 26."),
  q(32, "Why did Fruitful Future school fail?", ["The school had poor management.", "The teachers were unqualified.", "The location lacked basic infrastructure.", "The parents couldn't afford the school fees."], "D", "Fruitful Future failed due to socio-economic challenges; parents in the area could not afford the fees. (page 12)"),
  q(33, "What Yoruba adage did Mr. Bepo recall after the debate at the farewell?", ["The work of a teacher outlives their time", "Success is not final; failure is not fatal", "A wise man never leaves his work unfinished", "Even if the master carver retires, his carvings remain"], "D", "Bepo recalled this adage on page 55."),
  q(34, "Who coined the nickname 'The Lekki Headmaster'?", ["Mr. Audu", "Mr. Bepo's wife", "The students at Stardom Kiddie", "Nike and Kike"], "A", "Mr. Audu coined the nickname by comparing Bepo to King Oloja. (page 10)"),
  q(35, "What nickname did students give to Mr Ayesoro because of his tribal marks?", ["Mr Owala", "Mr Egun", "Mr Ologbo", "Mr Omole"], "A", "Students called Mr. Ayesoro 'Mr. Owala' due to his tribal marks."),
  q(36, "Which of the following waterfalls is the highest in West Africa?", ["Gurara Falls", "Erin Ijesha Waterfalls", "Ikogosi Warm Springs", "Owu Waterfalls"], "D", "Owu Waterfalls in Kwara State is the highest in West Africa at 120 metres. (page 44)"),
  q(37, "What led to the closure of the school Bepo started?", ["Poor road conditions in the neighbourhood", "Mismanagement of school funds", "Parents' dissatisfaction with the curriculum", "A failed spiritual ritual to attract more pupils"], "A", "Bepo's Fruitful Future School closed because worsening roads caused parents to move away. (page 39)"),
  q(38, "What was given as a reward to teachers whose students scored distinctions?", ["₦30,000 each.", "A special commendation letter.", "Bottles of wine only.", "₦20,000 each."], "A", "Teachers whose students scored distinctions received ₦30,000 each. (page 8)"),
  q(39, "What reason did Mr Guta give for being angry with Mr Fafore?", ["He found a grammatical error in his son's note", "He felt Mr Fafore was not teaching effectively", "His son complained about being treated unfairly", "He was unhappy with Mr Fafore's attitude"], "A", "Mr Guta was angry over a supposed grammatical error he found in his son's note. (chapter 6)"),
  q(40, "Who instructed the Chemistry teacher to conclude the assembly after Mr Bepo burst into tears?", ["The principal.", "The school nurse.", "The Vice Principal.", "The Managing Director."], "C", "Mrs Apeh (VP) instructed Mr Justus Anabel to conclude the assembly. (page 5)"),
  q(41, "Who went with the principal to his home on the day of the crying incident?", ["The MD herself.", "Pastor Wande.", "The guidance counselor.", "The school nurse."], "C", "The guidance counselor accompanied Mr. Bepo home at the MD's direction. (page 9)"),
  q(42, "What performance during the send-off made Bepo emotional?", ["The Koroso dance.", "The Bata dance.", "The Canoe dance.", "The Atilogwu dance."], "C", "The Canoe dance of the Badagry people reminded Bepo of the slave heritage and made him emotional. (pages 55–56)"),
  q(43, "What was the official fee for renewing a 10-year passport (64 pages)?", ["N250,000.", "N100,000.", "N1,000,000.", "N70,000."], "D", "The official fee was N70,000. (page 49)"),
  q(44, "Why do some teachers at Stardom Schools fear Open Day?", ["They dislike interacting with parents.", "They are afraid of being sacked.", "The day involves long hours of work.", "Parents often come with complaints."], "D", "Teachers dreaded Open Day because parents brought 'trailer-loads of complaints'. (page 27)"),
  q(45, "What lesson does Hope's story about relocating to the UK teach?", ["Financial independence is critical when relocating.", "Couples always succeed when they share responsibilities.", "Working while studying guarantees success.", "Relocation is a foolproof plan for success."], "A", "Hope's wife stopped supporting him after four months, teaching the importance of financial independence. (page 17)"),
  q(46, "How much did Sola and her husband borrow to fund their relocation?", ["N2 million.", "N4 million.", "N3 million.", "N5 million."], "B", "Sola and her husband borrowed approximately N4 million. (page 16)"),
  q(47, "Why did Mr. Bepo yell 'Noooo!' during the drama performance?", ["He was disappointed with the dance.", "He feels the performance is disrespectful.", "He is overwhelmed by memories of the Heritage Slave Museum.", "He disagrees with the students' portrayal of history."], "C", "The Canoe dance reminded Bepo of the slaves' suffering at Badagry. (pages 55–56)"),
  q(48, "What does Mr. Bepo mean by the term 'new slavery'?", ["Africans willingly move abroad for better opportunities.", "The continuation of slave trade in some regions.", "Africans selling themselves into physical labour.", "The exploitation of Africans by modern companies."], "A", "Bepo refers to Africans 'voluntarily and desperately walking into the workforce of who seemed to be the yester masters.' (page 47)"),
  q(49, "Who among the staff at Stardom School is also a pastor?", ["Mr. Ope Wande.", "Mr. Audu.", "Mr. Obong Ukake.", "Mr. Justus Anabel."], "A", "Mr. Ope Wande, the Physics teacher, is also a pastor. (page 9)"),
  q(50, "According to Bepo, why is the hourly payment system beneficial?", ["It enables employees to change jobs easily.", "It allows employees to earn more.", "It allows employees to take more holidays.", "It reduces the workload for employees."], "A", "Bepo believes hourly pay allows more flexible schedules and the ability to change jobs. (page 14)"),
  q(51, "What is the primary setting of The Lekki Headmaster?", ["The Black Heritage Museum, Badagry.", "Mushin, Lagos.", "Stardom Schools.", "Beesway Group of Schools."], "C", "Most events occur at Stardom Schools in Lekki, Lagos."),
  q(52, "Who is the protagonist of the novel?", ["Mr. Alabi.", "Mrs. Ibidun Gloss.", "Mrs. Grace Apeh.", "Mr. Adewale Adebepo."], "D", "Mr. Adewale Adebepo (Bepo) is the protagonist."),
  q(53, "How did Mr. Bepo inspire students after excursions through Mushin and Ajegunle?", ["By promising to relocate them to better areas.", "By discouraging them from mocking the areas.", "By giving them motivational books about success.", "By sharing stories of successful individuals who rose from slums."], "D", "Bepo shared stories of Odion Ighalo and Victor Osimhen who grew up in slums. (page 46)"),
  q(54, "Why was Mr Bepo moved during his visit to the Black Heritage Museum?", ["He felt nostalgic about Nigeria's history", "He remembered his ancestors were involved in slavery", "He empathised with the suffering of slaves in the past", "He was impressed by the museum's architecture"], "C", "Bepo was emotionally moved by the ugly experiences the enslaved went through. (page 47)"),
  q(55, "Why did the MD decide to send the principal home after the crying incident?", ["To protect the school's reputation.", "To prepare for a replacement.", "To allow the principal to rest.", "To avoid disturbing the students further."], "A", "The MD wanted to move the drama away from the school to protect its reputation. (page 9)"),
  q(56, "Why was Tosh's father, Chief Ogbba, detained for 36 months?", ["He failed to pay a school debt", "He was an ex-convict for theft", "He was accused of fraud but acquitted later", "He faced trial for alleged misappropriation"], "D", "Chief Didi Ogba spent 36 months in detention for alleged misappropriation of a N2.5 billion government contract. (page 42)"),
  q(57, "Why did the Vice Principal contact the MD after Mr Bepo's crying incident?", ["Because parents were calling with concerns.", "To discuss boarding fee reductions.", "To arrange an emergency meeting.", "To announce the principal's retirement."], "A", "Parents were calling with worried rumours, prompting Mrs Apeh to call the MD. (page 6)"),
  q(58, "What year was the Ikogosi Warm Springs discovered?", ["1745", "1820", "1852", "1901"], "C", "Ikogosi Warm Springs was discovered in 1852. (page 44)"),
  q(59, "How are the teachers and staff at Stardom able to afford cars?", ["They are running side businesses.", "They are receiving bribes.", "They have taken loans from the school's cooperative society.", "They are paid high salaries."], "C", "Staff take loans from the school's cooperative society. (pages 25–26)"),
  q(60, "Why did Bepo decide to renew his passport in Ibadan?", ["The fees were lower in Ibadan", "He had a friend who worked in immigration there", "It was closer to his location", "He was advised that the process would be easier there"], "D", "Bepo chose Ibadan knowing fewer crowds would make renewal faster. (page 48)"),
  q(61, "What farewell gift was presented to Mr. Bepo?", ["A plane ticket to his new destination", "A framed picture of the staff and students", "A cheque for $10,000", "A plaque commemorating his years of service"], "C", "The MD presented Bepo with a $10,000 cheque. (page 58)"),
  q(62, "What was the major issue Bepo faced during his NIN validation?", ["Corruption among officials", "Long queues", "Poor networks", "None of the above"], "C", "Bepo had a frustrating experience at the NIN office due to severe network issues. (page 53)"),
  q(63, "What was the regular activity at the morning assembly on Tuesdays and Thursdays?", ["The principal's address", "Words of Exaltation", "The second stanza of the national anthem", "Christian and Muslim Prayers"], "C", "On Tuesdays and Thursdays, Stardom recited the second stanza of the national anthem. (page 6)"),
  q(64, "What does the phrase 'in cahoots' mean in the context of Tai and the immigration staff?", ["Unknowingly assisting", "Secretly collaborating with", "Officially associated with", "In conflict with"], "B", "'In cahoots' means secretly collaborating, especially for dishonest purposes."),
  q(65, "According to the novel, what is the annual migration rate of Nigerian doctors?", ["300 out of 3,000", "2,000 out of 3,000", "500 out of 3,000", "1,000 out of 3,000"], "D", "Up to 1,000 out of Nigeria's 3,000 doctors are migrating annually. (page 15)"),
  q(66, "Which teachers were reprimanded because two of their students received Ds?", ["Mr. Audu and Mr. Justus Anabel", "Mr. Ope Wande and Mrs. Grace Apeh", "Mr. Obong Ukaku and Miss Taye Kareem", "Mr. Bepo and Mr. Ope Wande"], "C", "Mr. Obong Ukaku (Chemistry) and Miss Taye Kareem (Geography) were reprimanded. (page 8)"),
  q(67, "What time is Mr. Bepo's flight to the UK scheduled?", ["5:00pm", "10:00pm", "1:00pm", "8:00pm"], "B", "Mr. Bepo's Emirates Airlines flight was booked for 10:00pm on Saturday. (page 59)"),
  q(68, "Why is Mr. Bepo hesitant to move to the UK?", ["He does not want to leave his students", "He believes life in Nigeria is better", "He is afraid of adapting to a new environment", "He does not want to leave his wife and children behind"], "A", "Bepo loves Stardom Schools and cares deeply for his students. (page 10)"),
  q(69, "Why does Mr. Bepo organise excursions for students at Stardom?", ["To give them a good grasp of their country before they go abroad", "To encourage tourism in Nigeria", "To prepare students for geography exams", "To promote Stardom as a school that values excursions"], "A", "Bepo organises excursions so students understand Nigeria before many of them leave for studies abroad. (page 44)"),
  q(70, "What unethical action did Mr. Nku take before leaving for abroad?", ["He stole money from the school's treasury", "He borrowed N2 million from the school's cooperative", "He sold the school's property", "He falsified documents to gain a visa"], "B", "Mr. Nku borrowed N2 million from the cooperative and left the country two days later. (page 15)"),
  q(71, "Why was Mr. Ayesoro transferred to Stardom Hub?", ["To punish him for misconduct", "To provide him with a better job opportunity", "To reward him for his dedication", "To retain Mrs. Ladele's children in the school"], "D", "Management feared losing Mrs. Ladele's children because of Bibi's nightmares about his tribal marks."),
  q(72, "What is the main challenge Mr. Bepo faces in the novel?", ["Convincing parents to enroll their children", "Starting his own school", "Balancing his career with pressure to migrate", "Managing the school's finances"], "C", "Bepo's central challenge is the pressure to migrate to the UK versus his devotion to Stardom Schools."),
  q(73, "Why was Mr. Ayesoro transferred from his teaching role?", ["He had poor teaching performance", "A student had recurring nightmares about him", "The school wanted him to work in their property division", "He requested a transfer for personal reasons"], "B", "Bibi had recurring nightmares about his tribal marks; her mother complained and Ayesoro was transferred. (pages 22–23)"),
  q(74, "What was Mr. Bepo's monthly salary at Stardom Schools?", ["N400,000", "N200,000", "N600,000", "N1,000,000"], "A", "As principal, Mr Bepo's salary was about N400,000. (page 11)"),
  q(75, "What significant historical location did the students visit in Badagry?", ["First Storey Building", "Slave Market", "Point of No Return", "All of the above"], "D", "Students visited the First Storey Building, Slave Market, Point of No Return, and Seriki Abass Slave Museum. (page 46)"),
  q(76, "What can be inferred about Tai's role in the passport renewal process?", ["He is a middleman exploiting applicants", "He was an honest businessman offering his services", "He was a legitimate immigration officer", "He was unaware of the actual renewal process"], "A", "Tai was a business centre operator 'in cahoots' with immigration staff — a racketeer. (page 52)"),
  q(77, "Why did one of the school drivers attempt to sell the school bus?", ["To pay his son's tuition fees abroad", "To clear his personal debt", "To fund his wife's business", "To finance a trip to the UK"], "A", "The driver wanted to sell the bus to send his son to college abroad. (page 15)"),
  q(78, "What proverb does Bepo recall from his Idoma co-tenant?", ["'Whether the employer records gains or not, the employee will yet take home his full pay.'", "'Life's intriguing tests yield the same results for everyone.'", "'Hard work always leads to success.'", "'The sugarcane and the bitter leaf get different tastes from the same rain.'"], "D", "Bepo recalled this proverb when realising people have different outcomes abroad. (page 17)"),
  q(79, "What was Bepo's relationship with Mrs Ibidun Gloss?", ["She was his rival", "She criticised his decisions frequently", "She deeply respected and appreciated his contributions", "She was his supervisor"], "C", "The MD deeply respected Bepo — she gave him the largest send-off gift she had ever given a departing staff member."),
  q(80, "What term describes the migration phenomenon in the novel?", ["Exodus", "Japa Syndrome", "Wanderlust", "Brain Drain"], "B", "The novel's primary focus on migration is referred to as 'japa syndrome'."),
  q(81, "What grammatical error did Bepo point out about the name of Beesway Group of School?", ["The absence of a hyphen in the name", "The use of singular instead of plural", "The spelling", "The misuse of capital letters"], "B", "Bepo noted 'Group of School' should be 'Group of Schools' — 'group' is a collective noun requiring a plural."),
  q(82, "What is the central theme explored in the novel?", ["Betrayal", "Political corruption", "Love and relationships", "Migration and identity"], "D", "The novel primarily explores migration and identity through Bepo and other characters."),
  q(83, "Which teacher is known for their witty remarks in the novel?", ["Mrs. Ibidun Gloss", "Mr. Amos", "Mr. Audu", "Mrs. Grace Apeh"], "C", "Mr. Audu, the Fine Arts teacher, is recognised for his humorous comments."),
  q(84, "What did Mr. Audu do when the MD realized she had wrongly fired Mr. Fafore?", ["He defended Mr. Fafore's teaching methods", "He suggested a training session for the staff", "He proposed new rules for grammar checks", "He cracked a joke to lighten the mood"], "D", "Audu said 'Mr. Fafore... as well as the principal... is correct. And the MD is hereby pardoned, discharged, and acquitted.'"),
  q(85, "Why was the principal called 'The Lekki Headmaster'?", ["He founded Stardom Kiddies School.", "He humorously imitated characters from the Village Headmaster.", "He lived in Lekki during his time as a headmaster.", "He introduced a new curriculum in the school."], "B", "Bepo earned the nickname for imitating characters from the TV drama Village Headmaster."),
  q(86, "Why did Mr. Bepo change his flight to the UK?", ["He needs to finalize his resignation paperwork", "He is required to attend a farewell celebration", "The airline cancels his flight", "He has a last-minute meeting with the MD"], "B", "Bepo postponed his flight to attend the farewell party; the school paid the $100 change fee."),
  q(87, "What skills did Mrs. Ignatius begin learning to support her family abroad?", ["Cloth weaving and Adire", "Photography", "Tailoring and hairdressing", "Accounting and clerical work"], "C", "In preparation for her move abroad, Mrs. Ignatius learnt tailoring and hairdressing."),
  q(88, "What conclusion did the teachers draw from Mr. Fafore's dismissal?", ["Open Day is a stressful event", "There is no job security in the establishment", "The MD is always fair in her decisions", "Parents should not interfere with teaching methods"], "B", "The teachers concluded that there was no job security at Stardom after Fafore's sudden dismissal."),
  q(89, "What is Mr. Bepo's profession?", ["A historian", "A principal", "A doctor", "A businessman"], "B", "Mr. Bepo is the principal of Stardom Schools, Lekki."),
  q(90, "Who wrote The Lekki Headmaster?", ["Helon Habila", "Kabir Alabi Garba", "Wole Soyinka", "Chinua Achebe"], "B", "The Lekki Headmaster was written by Kabir Alabi Garba."),
  q(91, "In which part of Lagos is Stardom Schools located?", ["Surulere", "Yaba", "Lekki", "Ikeja"], "C", "Stardom Schools is in Lekki, Lagos — hence the novel's title."),
  q(92, "What position does Mrs. Ibidun Gloss hold at Stardom Schools?", ["School Accountant", "Managing Director", "Board Secretary", "Vice Principal"], "B", "Mrs. Ibidun Gloss is the Managing Director of Stardom Schools."),
  q(93, "Who is the Vice Principal of Stardom Schools?", ["Mrs. Ibidun Gloss", "Mrs. Ignatius", "Mrs. Grace Apeh", "Mrs. Ladele"], "C", "Mrs. Grace Apeh is the Vice Principal and one of Bepo's closest colleagues."),
  q(94, "Which subject does Mr. Audu teach at Stardom Schools?", ["Christian Religious Knowledge", "Fine Arts", "Chemistry", "Physics"], "B", "Mr. Audu is the Fine Arts teacher known for his humour."),
  q(95, "Who is the accountant of Stardom Schools?", ["Mr. Jeremi Amos", "Mr. Nku", "Mr. Guta", "Mr. Ogunwale"], "A", "Mr. Jeremi Amos is the school accountant."),
  q(96, "Which subject does Mr. Fafore teach?", ["Geography", "English Language", "Fine Arts", "Government"], "B", "Mr. Fafore is an English Language teacher whose correct grammar was wrongly questioned."),
  q(97, "What is Mr. Fafore's monthly salary at Stardom Schools?", ["N120,000", "N175,000", "N250,000", "N400,000"], "B", "Mr. Fafore earns N175,000 a month."),
  q(98, "Where does Mr. Fafore live?", ["Badagry", "Ifo, Ogun State", "Epe", "Ikeja"], "B", "Mr. Fafore lives in Ifo, Ogun State, because he cannot afford Lekki rent."),
  q(99, "Which award had Mr. Fafore won twice?", ["Best Teacher Award", "Most Punctual Teacher Award", "Teacher of the Year", "Most Dedicated Staff Award"], "B", "Despite his long commute, Mr. Fafore twice won the Most Punctual Teacher Award."),
  q(100, "At what time does Mr. Fafore wake up every day?", ["4:00 a.m.", "5:30 a.m.", "6:00 a.m.", "3:00 a.m."], "A", "Because of his long journey from Ogun State, Mr. Fafore wakes at 4:00 a.m. each day."),
  q(101, "For how many years had Mr. Bepo worked at Stardom before planning to relocate?", ["12 years", "18 years", "24 years", "30 years"], "C", "Bepo spent about 24 years at Stardom Schools."),
  q(102, "Which university did Mr. Bepo attend?", ["University of Ibadan", "University of Lagos", "University of Benin", "Obafemi Awolowo University"], "C", "Bepo studied English and History Education at the University of Benin (UNIBEN)."),
  q(103, "What are the names of Bepo's two children?", ["Jide and Kemi", "Tim and Love", "Nike and Kike", "Banky and Tosh"], "C", "Bepo and Seri have two children, Nike and Kike, living with their mother in the UK."),
  q(104, "What is Seri's profession in the United Kingdom?", ["Lawyer", "Nurse", "Accountant", "Teacher"], "B", "Seri works as a nurse in the UK and encourages Bepo to join the family."),
  q(105, "Which expression does Bepo often use before making a point?", ["As a matter of fact...", "Other things being equal...", "To cut a long story short...", "Honestly speaking..."], "B", "'Other things being equal...' is one of Bepo's well-known verbal habits."),
  q(106, "Which old television drama did Bepo imitate characters from?", ["Checkmate", "Village Headmaster", "Mirror in the Sun", "Tales by Moonlight"], "B", "Bepo was nicknamed 'The Lekki Headmaster' for imitating characters from Village Headmaster."),
  q(107, "Where did Bepo first serve as headmaster?", ["Fruitful Future School", "Stardom Hub", "Stardom Kiddies", "Beesway Group of School"], "C", "Bepo began at Stardom as headmaster of Stardom Kiddies (nursery and primary section)."),
  q(108, "What was the aim of the Invention Club's Breath Project?", ["To train teachers in computing", "To produce phones from recycled materials", "To plant trees around the school", "To build a school library"], "B", "The Breath Project aimed to make phones from recycled parts."),
  q(109, "After which national programme did Bepo and a colleague start Fruitful Future School?", ["SIWES", "NYSC", "Teaching Practice", "N-Power"], "B", "Bepo co-founded Fruitful Future School shortly after completing his NYSC."),
  q(110, "What did Mr. Ogo offer to do for N35,000 at Fruitful Future School?", ["Repair the school roof", "Bring in new teachers", "Sprinkle grains of corn at the school's corners to attract pupils", "Advertise the school on radio"], "C", "Mr. Ogo promised a ritual of sprinkling corn to flood the school with pupils. Bepo refused."),
  q(111, "What is Stardom Hub?", ["The staff cooperative society", "The Invention Club's workshop", "The property wing of Stardom Group of Companies", "The school's boarding house"], "C", "Stardom Hub is the property wing of the Stardom Group of Companies."),
  q(112, "Which student had recurring nightmares about Mr. Ayesoro?", ["Kemi", "Bibi", "Jide", "Tosh"], "B", "Bibi, Mrs. Ladele's daughter, was frightened of Mr. Ayesoro because of his tribal marks."),
  q(113, "Which subject did Mr. Ayesoro teach?", ["Government", "Fine Arts", "Economics", "Literature in English"], "A", "Mr. Ayesoro (Mr. Owala) was the Government teacher with prominent tribal marks."),
  q(114, "What was Mrs. Ladele doing when her daughter Bibi screamed in the night?", ["Marking scripts", "Watching a Nollywood movie", "Praying", "Cooking"], "B", "Mrs. Ladele, a Nollywood lover, was watching a movie when she heard Bibi scream."),
  q(115, "Why did Stardom Schools reduce its boarding fees?", ["To lower teachers' salaries", "To curb lateness", "To pay for excursions", "To attract foreign students"], "B", "The school cut boarding fees so more pupils would live on campus, greatly reducing lateness."),
  q(116, "What was the boarding fee per session after Stardom reduced it?", ["N93,000", "N163,000", "N165,000", "N250,000"], "C", "The fee was lowered from N250,000 to N165,000 per session."),
  q(117, "What share of parents moved their children into the boarding house after the fee reduction?", ["Fewer than 10 percent", "About half", "Over 80 percent", "About 20 percent"], "C", "More than 80 percent of parents moved their children into the boarding house."),
  q(118, "By what time did most students reach school for assembly after the boarding fee reduction?", ["6:30 a.m.", "7:45 a.m.", "8:30 a.m.", "9:00 a.m."], "B", "With most pupils boarding, nearly everyone was at morning assembly by 7:45 a.m."),
  q(119, "By how much did Stardom raise the fee for 'Excursion and Other Items'?", ["N50,000", "N93,000", "N165,000", "N250,000"], "B", "The excursion and other items fee was raised by N93,000."),
  q(120, "In which state are the Ikogosi Warm Springs located?", ["Kwara", "Ekiti", "Oyo", "Osun"], "B", "Ikogosi Warm Springs is in Ekiti State."),
  q(121, "Which chapter of the novel recalls Bepo's experiences at Beesway Group of School?", ["Ritualists", "Dusk", "The Enticement", "A Case of Visa Denied"], "A", "Chapter 7, 'Ritualists', tells of Bepo's time at Beesway and the ritual he witnessed."),
  q(122, "What is the title of the novel's opening chapter?", ["The Enticement", "Dusk", "Dawn", "Ritualists"], "B", "Chapter 1 is titled 'Dusk' and opens with Bepo breaking down in tears at assembly."),
  q(123, "What is the title of the novel's final chapter?", ["Missions Unaccomplished", "Point of No Return", "...Dawn", "Dusk"], "C", "The last chapter, '...Dawn', mirrors the opening 'Dusk' and shows Bepo's return to school."),
  q(124, "How does the novel end for Mr. Bepo?", ["He resigns to start his own school", "He is sacked by the MD", "He does not leave and returns to Stardom Schools", "He settles in the UK with his family"], "C", "Bepo does not board the plane. He returns to Stardom Schools telling everyone his heart is with the school."),
];

/** Unbiased Fisher–Yates shuffle (the old `sort(() => Math.random() - 0.5)` trick is biased). */
function shuffled<T>(list: readonly T[], rng: () => number): T[] {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Pick N random questions (shuffled). */
export function sampleLekkiQuestions(n = 10, rng: () => number = Math.random): NovelQuestion[] {
  const count = Math.max(0, Math.min(Math.floor(n), LEKKI_QUESTIONS.length));
  return shuffled(LEKKI_QUESTIONS, rng).slice(0, count);
}

/** The Lekki Headmaster question in the same shape the exam screen uses for ALOC questions. */
export function lekkiToNormalized(item: NovelQuestion): NormalizedQuestion {
  return {
    id: item.id,
    prompt: item.prompt,
    options: item.options.slice(),
    answer: item.answer,
    explanation: item.explanation,
    section: null,
    sectionKind: null,
    novel: CURRENT_UTME_NOVEL,
    category: "Novel",
    examtype: "utme",
    subject: "English Language",
    source: "local-novel",
  };
}

/** `n` random, exam-ready Lekki Headmaster questions from the bundled dataset (works fully offline). */
export function sampleLekkiForExam(n: number, rng: () => number = Math.random): NormalizedQuestion[] {
  return sampleLekkiQuestions(n, rng).map(lekkiToNormalized);
}
