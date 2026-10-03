/**
 * Curated JAMB/UTME syllabus topics per ALOC subject.
 *
 * ALOC has no topics endpoint (verified live: /topics → 404, and the `topic=`
 * query param is silently ignored), so topic practice is built by matching
 * fetched ALOC questions against syllabus keyword stems — the same topics
 * students see in the official JAMB syllabus, with questions drawn from the
 * ALOC bank.
 */

export type Topic = { name: string; keywords: string[] };

export const TOPIC_SUBJECTS: { slug: string; name: string; emoji: string }[] = [
  { slug: "english", name: "English Language", emoji: "📘" },
  { slug: "mathematics", name: "Mathematics", emoji: "➗" },
  { slug: "physics", name: "Physics", emoji: "⚛️" },
  { slug: "chemistry", name: "Chemistry", emoji: "🧪" },
  { slug: "biology", name: "Biology", emoji: "🧬" },
  { slug: "government", name: "Government", emoji: "🏛️" },
  { slug: "economics", name: "Economics", emoji: "📈" },
  { slug: "geography", name: "Geography", emoji: "🌍" },
  { slug: "commerce", name: "Commerce", emoji: "🛒" },
  { slug: "accounting", name: "Accounting", emoji: "📊" },
  { slug: "englishlit", name: "Literature in English", emoji: "🎭" },
  { slug: "crk", name: "Christian Religious Knowledge", emoji: "✝️" },
  { slug: "irk", name: "Islamic Religious Knowledge", emoji: "🕌" },
  { slug: "civiledu", name: "Civic Education", emoji: "🗳️" },
  { slug: "insurance", name: "Insurance", emoji: "🛡️" },
  { slug: "history", name: "History", emoji: "📜" },
  { slug: "currentaffairs", name: "Current Affairs", emoji: "📰" },
];

export const TOPICS_BY_SLUG: Record<string, Topic[]> = {
  english: [
    { name: "Comprehension & Summary", keywords: ["passage", "comprehension", "according to the writer", "the writer", "the author", "main idea", "best completes the gap", "suitable title"] },
    { name: "Nearest in Meaning (Synonyms)", keywords: ["nearest in meaning", "opposite of the word underlined", "choose the option nearest", "almost the same meaning", "synonym"] },
    { name: "Opposite in Meaning (Antonyms)", keywords: ["opposite in meaning", "antonym", "contrary in meaning", "word or phrase opposite"] },
    { name: "Grammar & Sentence Structure", keywords: ["choose the option that best completes", "best completes the gap", "fill in the gap", "correct option to fill", "grammar", "tense", "concord", "preposition", "conjunction", "clause"] },
    { name: "Oral Forms: Vowels & Consonants", keywords: ["vowel", "consonant", "phonetic", "sound represented", "transcription", "diphthong", "monophthong", "schwa", "articulation"] },
    { name: "Oral Forms: Stress & Intonation", keywords: ["stress", "syllable", "intonation", "rhyme", "emphatic", "pitch", "accented syllable"] },
    { name: "Registers & Word Usage", keywords: ["register", "jargon", "idiom", "idiomatic", "collocation", "usage", "means the same as"] },
  ],
  mathematics: [
    { name: "Number Bases & Arithmetic", keywords: ["base", "binary", "denary", "decimal", "modulo", "significant figure", "standard form", "approximate"] },
    { name: "Fractions, Decimals & Percentages", keywords: ["fraction", "decimal", "percentage", "percent", "ratio", "proportion", "simple interest", "discount", "profit", "loss", "commission"] },
    { name: "Indices & Logarithms", keywords: ["index", "indices", "logarithm", "log", "exponential", "power of", "surds", "rationalise", "rationalize"] },
    { name: "Sets & Venn Diagrams", keywords: ["set", "venn", "universal set", "subset", "union", "intersection", "complement", "n(u)"] },
    { name: "Algebra: Expressions & Factorisation", keywords: ["factorise", "factorize", "expand", "simplify", "polynomial", "expression", "substitute", "algebraic"] },
    { name: "Equations & Inequalities", keywords: ["equation", "inequality", "simultaneous", "quadratic", "root of", "solve for", "solution set", "linear"] },
    { name: "Sequences & Series", keywords: ["sequence", "series", "arithmetic progression", "geometric progression", "a.p", "g.p", "nth term", "common difference", "common ratio", "sum of the first"] },
    { name: "Matrices & Determinants", keywords: ["matrix", "matrices", "determinant", "singular", "inverse of the matrix", "2 × 2", "3 × 3"] },
    { name: "Geometry & Mensuration", keywords: ["triangle", "circle", "quadrilateral", "polygon", "angle", "area", "perimeter", "volume", "cylinder", "cone", "sphere", "pythagoras", "sector", "arc"] },
    { name: "Trigonometry", keywords: ["sine", "cosine", "tangent", "cos θ", "sin θ", "tan θ", "bearing", "elevation", "depression", "trigonometric", "radian"] },
    { name: "Coordinate Geometry", keywords: ["gradient", "coordinates", "coordinates", "x-axis", "y-axis", "straight line", "midpoint", "intercept", "distance between"] },
    { name: "Calculus (Differentiation & Integration)", keywords: ["differentiate", "derivative", "gradient of", "integrate", "integral", "d/dx", "rate of change", "maximum point", "minimum point"] },
    { name: "Statistics", keywords: ["mean", "median", "mode", "variance", "standard deviation", "frequency", "histogram", "pie chart", "bar chart", "range", "cumulative", "quartile"] },
    { name: "Probability & Permutation", keywords: ["probability", "permutation", "combination", "at random", "favourable outcome", "outcome", "event", "dice", "coin"] },
    { name: "Variation", keywords: ["varies directly", "varies inversely", "varies jointly", "partial variation", "constant of variation"] },
  ],
  physics: [
    { name: "Measurement & Units", keywords: ["dimension", "unit of", "si unit", "metre rule", "caliper", "micrometer", "vernier", "measurement", "scalar", "vector", "significant figure"] },
    { name: "Motion & Kinematics", keywords: ["velocity", "acceleration", "displacement", "uniform speed", "projectile", "time of flight", "free fall", "retardation", "distance-time", "speed-time"] },
    { name: "Forces & Newton's Laws", keywords: ["newton", "friction", "momentum", "impulse", "inertia", "equilibrium", "resultant force", "tension", "coefficient of", "upthrust", "viscosity", "terminal velocity"] },
    { name: "Work, Energy & Power", keywords: ["work done", "energy", "power", "joule", "kinetic", "potential energy", "efficiency", "machine", "lever", "pulley", "inclined plane", "watt"] },
    { name: "Pressure & Fluids", keywords: ["pressure", "pascal", "barometer", "manometer", "archimedes", "float", "buoyan", "hydrometer", "atmospheric"] },
    { name: "Heat & Temperature", keywords: ["temperature", "heat", "thermal", "conduction", "convection", "radiation", "specific heat", "latent heat", "expansion", "thermometer", "melting", "boiling", "evaporation"] },
    { name: "Waves & Sound", keywords: ["wave", "wavelength", "frequency", "amplitude", "sound", "echo", "resonance", "vibration", "longitudinal", "transverse", "doppler", "sonometer"] },
    { name: "Light & Optics", keywords: ["lens", "mirror", "reflection", "refraction", "focal", "magnification", "prism", "spectrum", "dispersion", "ray", "image", "optical"] },
    { name: "Electricity", keywords: ["current", "voltage", "resistance", "resistor", "ohm", "circuit", "ampere", "parallel", "series", "potentiometer", "galvanometer", "ammeter", "voltmeter", "emf", "wheatstone"] },
    { name: "Magnetism & Electromagnetism", keywords: ["magnet", "magnetic", "electromagnet", "induction", "flux", "transformer", "dynamo", "motor", "field", "compass", "lorantz", "fleming"] },
    { name: "Electric Fields & Capacitance", keywords: ["capacitor", "capacitance", "charge", "coulomb", "electric field", "potential difference", "electrostatic", "dielectric", "farad"] },
    { name: "Modern Physics", keywords: ["photoelectric", "photon", "electron", "nucleus", "radioactive", "radioactivity", "half-life", "isotope", "fission", "fusion", "quantum", "x-ray", "alpha", "beta", "gamma", "thermionic"] },
  ],
  chemistry: [
    { name: "Separation Techniques & Purity", keywords: ["separation", "distillation", "filtration", "chromatography", "sublimation", "decantation", "fractional", "pure substance", "evaporation", "separating funnel"] },
    { name: "Atomic Structure & Bonding", keywords: ["atom", "electron configuration", "isotope", "valence", "covalent", "ionic", "electrovalent", "bonding", "orbital", "proton", "neutron", "metallic bond", "hydrogen bond", "van der waals"] },
    { name: "Stoichiometry & Mole Concept", keywords: ["mole", "molar", "stoichiometry", "avogadro", "empirical formula", "molecular formula", "percentage composition", "relative atomic", "concentration", "titration"] },
    { name: "States of Matter & Gas Laws", keywords: ["gas law", "boyle", "charles", "pressure law", "diffusion", "vapour", "kinetic theory", "liquefaction", "effusion", "molar volume"] },
    { name: "Energy & Thermochemistry", keywords: ["exothermic", "endothermic", "enthalpy", "heat of", "energy change", "activation", "hess", "calorimetry"] },
    { name: "Acids, Bases & Salts", keywords: ["acid", "base", "alkali", "salt", "ph ", "indicator", "neutralisation", "neutralization", "buffer", "hydrolysis", "ph of"] },
    { name: "Redox & Electrolysis", keywords: ["oxidation", "reduction", "redox", "electrolysis", "anode", "cathode", "electrode", "galvanic", "electrochemical", "oxidising", "reducing agent", "faraday"] },
    { name: "Rates of Reaction & Equilibrium", keywords: ["rate of reaction", "catalyst", "equilibrium", "reversible", "le chatelier", "activation energy", "collision", "reaction rate"] },
    { name: "Periodic Table & Periodicity", keywords: ["periodic table", "periodic law", "group", "period", "halogen", "alkali metal", "transition", "electronegativity", "ionisation energy", "electron affinity", "periodicity"] },
    { name: "Organic Chemistry: Hydrocarbons", keywords: ["alkane", "alkene", "alkyne", "hydrocarbon", "cracking", "isomer", "homologous", "saturated", "unsaturated", "benzene", "petroleum", "substitution", "addition reaction"] },
    { name: "Alkanols, Acids & Esters", keywords: ["alkanol", "ethanol", "carboxylic", "ester", "esterification", "alkanoic", "fermentation", "saponification", "soap", "polymer", "amide", "ketone", "aldehyde", "oxidation of"] },
    { name: "Air, Water & Pollution", keywords: ["air", "water treatment", "hard water", "soft water", "pollution", "greenhouse", "ozone", "acid rain", "chlorination", "composition of air", "carbon monoxide"] },
    { name: "Metals & Their Compounds", keywords: ["alloy", "extraction", "blast furnace", "ore", "rust", "galvanis", "aluminium", "sodium", "calcium", "iron", "copper", "zinc", "metal"] },
  ],
  biology: [
    { name: "Cell Structure & Organisation", keywords: ["cell", "mitochondri", "organelle", "ribosome", "chloroplast", "nucleus", "cytoplasm", "plasma membrane", "cell wall", "prokaryot", "eukaryot", "lysosome", "vacuole", "tissue"] },
    { name: "Cell Division & Reproduction", keywords: ["mitosis", "meiosis", "chromosome", "cell division", "gamete", "zygote", "fertilisation", "fertilization", "binary fission", "conjugation", "daughter cells"] },
    { name: "Nutrition in Plants", keywords: ["photosynthesis", "stomata", "chlorophyll", "transpiration", "xylem", "phloem", "autotroph", "root hair", "turgid", "flaccid", "plasmolysis", "mineral salt"] },
    { name: "Nutrition & Digestion in Animals", keywords: ["digestion", "enzyme", "alimentary", "stomach", "intestine", "bile", "saliva", "assimilation", "ingestion", "egestion", "villus", "heterotroph", "dentition", "pancreas"] },
    { name: "Transport Systems", keywords: ["blood", "heart", "circulation", "artery", "vein", "capillary", "haemoglobin", "hemoglobin", "plasma", "translocation", "double circulation", "pulse"] },
    { name: "Respiration", keywords: ["respiration", "aerobic", "anaerobic", "oxygen debt", "alveol", "gill", "trachea", "breathing", "lactic acid", "ventilation"] },
    { name: "Excretion", keywords: ["excretion", "kidney", "nephron", "urine", "ureter", "urethra", "bladder", "homeostasis", "osmoregulation", "dialysis", "liver"] },
    { name: "Coordination & Nervous System", keywords: ["neurone", "neuron", "reflex", "synapse", "brain", "spinal cord", "nervous", "impulse", "hormone", "endocrine", "pituitary", "adrenal", "insulin", "thyroxine", "optic"] },
    { name: "Sensory Organs", keywords: ["eye", "ear", "retina", "cornea", "lens", "cochlea", "tympanum", "eustachian", "iris", "pupil", "semicircular", "accommodation"] },
    { name: "Reproduction in Plants & Animals", keywords: ["pollination", "ovule", "stamen", "pistil", " carpel", "seed", "fruit", "germination", "placenta", "uterus", "ovary", "testis", "sperm", "menstruation", "reproduction"] },
    { name: "Genetics & Heredity", keywords: ["gene", "genetic", "allele", "dominant", "recessive", "genotype", "phenotype", "mendel", "inheritance", "dna", "mutation", "sex-linked", "punnett", "trait"] },
    { name: "Ecology & Ecosystems", keywords: ["ecosystem", "habitat", "food chain", "food web", "producer", "consumer", "decomposer", "biotic", "abiotic", "community", "ecological niche", "succession", "biomass", "pyramid"] },
    { name: "Population & Conservation", keywords: ["population", "conservation", "extinction", "endangered", "deforestation", "pollution", "carrying capacity", "census", "overcrowding", "natural resources"] },
    { name: "Adaptation & Evolution", keywords: ["adaptation", "evolution", "natural selection", "lamarck", "darwin", "speciation", "survival", "structural adaptation", "protective coloration", "mimicry"] },
    { name: "Microorganisms & Diseases", keywords: ["bacteria", "virus", "fungi", "protozoa", "pathogen", "disease", "immunity", "vaccine", "antibiotic", "malaria", "hiv", "tuberculosis", "vector", "immunisation", "immunization"] },
  ],
  government: [
    { name: "Basic Concepts of Government", keywords: ["state", "sovereignty", "sovereign", "power", "authority", "legitimacy", "political culture", "society", "nation", "government"] },
    { name: "Political Ideologies", keywords: ["capitalism", "socialism", "communism", "liberalism", "fascism", "feudalism", "democracy", "totalitarian", "ideology", "welfare state"] },
    { name: "Constitution & Constitutionalism", keywords: ["constitution", "constitutional", "rule of law", "amendment", "federal character", "supremacy", "written constitution", "unwritten", "separation of powers"] },
    { name: "Organs of Government", keywords: ["legislature", "executive", "judiciary", "parliament", "senate", "house of representatives", "bill", "veto", "judicial review", "cabinet", "civil service", "public corporation"] },
    { name: "Federalism", keywords: ["federalism", "federal", "unitary", "confederation", "concurrent list", "exclusive list", "residual", "regionalism", "state creation"] },
    { name: "Political Parties & Elections", keywords: ["party", "election", "electoral", "franchise", "suffrage", "ballot", "constituency", "voter", "manifesto", "opposition", "by-election", "ineligible"] },
    { name: "Pre-Colonial Societies in Nigeria", keywords: ["emirate", "caliphate", "sokoto", "kanem", "bornu", "benin kingdom", "kingdom", "chiefdom", "alaafin", "ooni", "sarki", "council of elders", "age grade", "obaship", "emir", "pre-colonial", "fulani empire", "ghazi"] },
    { name: "Colonial Rule & Nationalism", keywords: ["colonial", "indirect rule", "lugard", "nationalist", "nationalism", "independence", "crown colony", "assimilation", "colonisation", "colonization", "partition", "berlin conference", "richards constitution", "macpherson", "clifford", "aba women", "ekumeku"] },
    { name: "Nigeria Since Independence", keywords: ["first republic", "second republic", "third republic", "fourth republic", "military coup", "governor-general", "prime minister", "balewa", "awolowo", "azikiwe", "civil war", "abacha", "babangida", "gowon", "transition", "ncnc", "action group", "npc"] },
    { name: "Local Government & Public Administration", keywords: ["local government", "councillor", "chairman", "chiefdom", "traditional ruler", "public administration", "bureaucracy", "ministry", "parastatal", "decentralisation", "decentralization"] },
    { name: "International Organisations", keywords: ["united nations", "uno", "oau", "au", "ecowas", "commonwealth", "nato", "ngo", "nePad", "foreign policy", "diplomacy", "ambassador", "non-aligned"] },
  ],
  economics: [
    { name: "Basic Economic Concepts", keywords: ["scarcity", "choice", "opportunity cost", "wants", "economic goods", "free goods", "scale of preference", "production possibility", "basic economic"] },
    { name: "Demand & Supply", keywords: ["demand", "supply", "equilibrium price", "market price", "demand curve", "supply curve", "excess demand", "excess supply", "determinants", "law of demand", "law of supply"] },
    { name: "Elasticity", keywords: ["elasticity", "elastic", "inelastic", "price elasticity", "income elasticity", "cross elasticity", "responsiveness"] },
    { name: "Production & Costs", keywords: ["production", "division of labour", "specialisation", "specialization", "fixed cost", "variable cost", "total cost", "marginal cost", "average cost", "economies of scale", "diseconomies", "productivity"] },
    { name: "Market Structures", keywords: ["monopoly", "perfect competition", "oligopoly", "monopolistic", "duopoly", "market structure", "price discrimination", "barrier to entry"] },
    { name: "Money & Inflation", keywords: ["money", "inflation", "deflation", "barter", "value of money", "quantity theory", "hyperinflation", "cost-push", "demand-pull", "purchasing power", "functions of money"] },
    { name: "Banking & Financial Institutions", keywords: ["bank", "central bank", "commercial bank", "monetary policy", "credit", "interest rate", "merchant bank", "stock exchange", "money market", "capital market", "reserve ratio"] },
    { name: "Public Finance & Taxation", keywords: ["taxation", "tax", "fiscal policy", "budget", "public expenditure", "public debt", "direct tax", "indirect tax", "vat", "progressive tax", "regressive", "revenue allocation", "subsidy"] },
    { name: "International Trade & Balance of Payments", keywords: ["international trade", "balance of trade", "balance of payment", "export", "import", "tariff", "quota", "dumping", "exchange rate", "devaluation", "terms of trade", "visible trade", "invisible"] },
    { name: "Population & Labour Market", keywords: ["population", "census", "optimum", "migration", "labour force", "unemployment", "employment", "wages", "trade union", "mobility of labour", "dependency ratio", "malthus"] },
    { name: "Agriculture & Industry in Nigeria", keywords: ["agriculture", "cash crop", "food crop", "marketing board", "land tenure", "irrigation", "industrialisation", "industrialization", "manufacturing", "cottage industry", "localisation", "petroleum", "mining"] },
    { name: "Economic Development & Planning", keywords: ["development", "growth", "planning", "national plan", "gross domestic", "gross national", "per capita income", "underdevelopment", "vision", "mdg", "sustainable"] },
  ],
  geography: [
    { name: "Map Reading & Interpretation", keywords: ["map", "scale", "contour", "latitude", "longitude", "grid", "bearing", "gazetteer", "topographical", "sketch", "legend"] },
    { name: "The Earth & Solar System", keywords: ["earth", "solar", "planet", "rotation", "revolution", "eclipse", "equinox", "solstice", "latitude zones", "international date line"] },
    { name: "Rocks & Landforms", keywords: ["rock", "igneous", "sedimentary", "metamorphic", "weathering", "erosion", "denudation", "plateau", "mountain", "fold", "fault", "volcano", "landform"] },
    { name: "Weather & Climate", keywords: ["climate", "weather", "rainfall", "temperature", "humidity", "wind", "monsoon", "harmattan", "itcz", "equatorial", "tropical", "rain gauge", "climograph", "season"] },
    { name: "Drainage & Water Bodies", keywords: ["river", "drainage", "delta", "tributary", "watershed", "lake", "ocean", "current", "tide", "estuary", "hydrological", "water cycle"] },
    { name: "Population & Settlement", keywords: ["population", "settlement", "migration", "urban", "rural", "census", "density", "megalopolis", "conurbation", "dispersed", "nucleated", "urbanisation", "urbanization"] },
    { name: "Economic Activities", keywords: ["agriculture", "farming", "mining", "fishing", "forestry", "manufacturing", "industry", "tourism", "transport", "trade", "lumbering", "plantation"] },
    { name: "Nigeria: Physical & Human", keywords: ["nigeria", "jos plateau", "river niger", "niger delta", "lagos", "kano", "vegetation belt", "savanna", "mangrove", "guinea"] },
    { name: "Africa & Regional Geography", keywords: ["africa", "sahara", "sahel", "east africa", "west africa", "rift valley", "congo", "kilimanjaro", "nile", "atlas mountain", "desertification"] },
    { name: "Environmental Hazards & Resources", keywords: ["erosion", "flood", "drought", "desertification", "deforestation", "soil", "hazard", "conservation", "environment", "oil spillage", "gully"] },
  ],
  commerce: [
    { name: "Introduction to Commerce", keywords: ["commerce", "trade", "aids to trade", "home trade", "foreign trade", "barter", "production", "commercial occupation"] },
    { name: "Business Units & Ownership", keywords: ["sole proprietor", "partnership", "company", "corporation", "co-operative", "cooperative", "limited liability", "public enterprise", "privatisation", "privatization", "amalgamation", "merger"] },
    { name: "Retail & Wholesale Trade", keywords: ["retail", "wholesale", "supermarket", "departmental store", "hawking", "mail order", "vending", "middleman", "chain store", "door-to-door"] },
    { name: "Transport & Communication", keywords: ["transport", "road transport", "rail", "air transport", "water transport", "pipeline", "freight", "communication", "telecom", "courier", "conveyance"] },
    { name: "Banking & Finance in Trade", keywords: ["bank", "cheque", "cheque", "overdraft", "loan", "savings", "current account", "bill of exchange", "standing order", "credit transfer", "e-banking", "automated teller"] },
    { name: "Insurance", keywords: ["insurance", "policy", "premium", "assurance", "underwriter", "risk", "indemnity", "broker", "actuary", "claim"] },
    { name: "Advertising & Marketing", keywords: ["advertis", "marketing", "promotion", "sales promotion", "branding", "packaging", "publicity", "personal selling", "billboard", "market research"] },
    { name: "Warehousing & Stock", keywords: ["warehouse", "warehousing", "bonded", "stock", "inventory", "storage", "silo", "cold storage", "buffer stock"] },
    { name: "Trade Documents & Procedures", keywords: ["invoice", "receipt", "pro forma", "indent", "bill of lading", "consular", "certificate of origin", "fob", "cif", "debit note", "credit note", "statement of account"] },
    { name: "Tourism & Business Environment", keywords: ["tourism", "hospitality", "business environment", "globalisation", "globalization", "e-commerce", "ecommerce", "digital", "export promotion"] },
  ],
  accounting: [
    { name: "Accounting Principles & Concepts", keywords: ["accounting", "book-keeping", "bookkeeping", "going concern", "consistency", "prudence", "matching concept", "entity", "dual aspect", "convention", "principle", "objectives of accounting"] },
    { name: "Ledger & Double Entry", keywords: ["ledger", "journal", "double entry", "debit", "credit", "posting", "account", "trial balance", "folio"] },
    { name: "Final Accounts of Sole Traders", keywords: ["trading account", "profit and loss", "balance sheet", "final account", "net profit", "gross profit", "turnover", "expenses", "drawings", "capital account"] },
    { name: "Depreciation & Provisions", keywords: ["depreciation", "straight line", "reducing balance", "provision", "bad debt", "doubtful", "reserves", "accumulated", "disposal", "asset"] },
    { name: "Control Accounts & Bank Reconciliation", keywords: ["control account", "reconciliation", "bank statement", "uncredited", "unpresented", "sales ledger", "purchases ledger", "suspense"] },
    { name: "Partnership Accounts", keywords: ["partnership", "partner", "goodwill", "appropriation", "interest on capital", "profit sharing", "admission of", "retirement of", "dissolution", "garner"] },
    { name: "Company Accounts", keywords: ["company", "share", "shares", "shareholder", "debenture", "dividend", "ordinary share", "preference share", "issue", "reserves", "registrar"] },
    { name: "Public Sector Accounting", keywords: ["public sector", "government accounting", "consolidated fund", "treasury", "audit", "virement", "revenue fund", "statutory"] },
    { name: "Cost Accounting", keywords: ["cost accounting", "marginal costing", "absorption", "overhead", "prime cost", "job costing", "process costing", "break-even", "breakeven", "contribution", "standard cost", "variance"] },
  ],
  englishlit: [
    { name: "Poetry Appreciation", keywords: ["poem", "poet", "poetry", "stanza", "verse", "rhyme", "rhythm", "sonnet", "elegy", "ode", "lyric", "ballad", "narrative poem"] },
    { name: "Drama Appreciation", keywords: ["play", "drama", "playwright", "act", "scene", "tragedy", "comedy", "tragic", "protagonist", "antagonist", "soliloquy", "aside", "dialogue", "stage"] },
    { name: "Prose Appreciation", keywords: ["novel", "prose", "narrator", "narrative", "chapter", "plot", "character", "setting", "theme", "point of view", "omniscient", "protagonist"] },
    { name: "Figures of Speech", keywords: ["metaphor", "simile", "personification", "hyperbole", "irony", "onomatopoeia", "alliteration", "assonance", "euphemism", "oxymoron", "metonymy", "apostrophe", "pun", "paradox"] },
    { name: "Literary Terms & Techniques", keywords: ["theme", "mood", "tone", "imagery", "symbol", "flashback", "suspense", "foreshadow", "satire", "denouement", "catharsis", "hubris", "foregrounding", "didactic"] },
    { name: "Set Texts (General Knowledge)", keywords: ["author of", "wrote", "written by", "poet of the poem", "playwright of", "based on the text", "according to the novel", "in the play"] },
  ],
  crk: [
    { name: "God, Creation & the Fall", keywords: ["creation", "created", "genesis", "eden", "adam", "eve", "garden", "fall of man", "serpent", "sabbath", "imago dei", "sovereignty of god"] },
    { name: "The Patriarchs & Covenant", keywords: ["abraham", "covenant", "isaac", "jacob", "joseph", "circumcision", "promise", "sacrifice of isaac", "bethel", "patriarch"] },
    { name: "Moses & the Exodus", keywords: ["moses", "exodus", "pharaoh", "passover", "red sea", "sinai", "commandments", "wilderness", "burning bush", "israelites", "tabernacle", "golden calf"] },
    { name: "Leadership in Israel: Judges & Kings", keywords: ["joshua", "judges", "samuel", "saul", "david", "solomon", "king", "monarchy", "jerusalem", "temple", "ark of the covenant", "goliath", "rehoboam", "jeroboam", " divided kingdom"] },
    { name: "The Prophets", keywords: ["prophet", "elijah", "elisha", "isaiah", "jeremiah", "ezekiel", "amos", "hosea", "prophecy", "baal", "covenant breaking", "remnant", "exile", "daniel"] },
    { name: "Ministry of Jesus", keywords: ["jesus", "christ", "parable", "miracle", "disciples", "baptism", "sermon on the mount", "transfiguration", "pharisee", "sadducee", " kingdom of god", " Bethesda", " feeding of the", "temptation"] },
    { name: "Passion, Resurrection & Early Church", keywords: ["crucifixion", "resurrection", "passion", "last supper", "pilate", "judas", "peter", "paul", "pentecost", "acts of the apostles", "early church", "jerusalem council", "missionary journey", "stephen", "saul of tarsus"] },
  ],
  irk: [
    { name: "The Qur'an & Hadith", keywords: ["qur'an", "quran", "koran", "hadith", "sunnah", "surah", "ayah", "revelation", "wahy", "compilation", "authentication"] },
    { name: "Tawhid & Articles of Faith", keywords: ["tawhid", "tawheed", "shirk", "faith", "iman", "angels", "day of judgement", "qadr", "oneness of allah", "attributes of allah", "kufr"] },
    { name: "Prophethood", keywords: ["prophet", "nabi", "rasul", "adam", "nuh", "ibrahim", "musa", "isa", "muhammad", "seerah", "miracles of", "finality", "ulul-azm"] },
    { name: "Acts of Worship (Ibadat)", keywords: ["salat", "salah", "prayer", "zakat", "sawm", "fasting", "hajj", "pilgrimage", "wudu", "taharah", "ramadan", "eid", "juma'at", "qibla", "tawaf"] },
    { name: "Islamic History & the Caliphate", keywords: ["mecca", "medina", "hijrah", "hijra", "badr", "uhud", "khandaq", "treaty", "caliph", "khalifa", "abubakar", "umar", "uthman", "ali", "ummah", "makkah"] },
    { name: "Sharia, Morals & Society", keywords: ["sharia", "fiqh", "halal", "haram", "akhlaq", "morals", "marriage", "nikah", "talaq", "inheritance", "mirath", "usury", "riba", "family", "justice"] },
  ],
  civiledu: [
    { name: "Democracy & Rule of Law", keywords: ["democracy", "rule of law", "constitution", "separation of powers", "civic", "election", "voting", "majoritarian", "accountability", "transparency", "due process"] },
    { name: "Rights & Duties of Citizens", keywords: ["rights", "human right", "fundamental", "duty", "obligation", "citizen", "citizenship", "passport", "freedom", "equality", "discrimination", "uphold"] },
    { name: "Nationalism & National Consciousness", keywords: ["nationalism", "patriotism", "national unity", "national identity", "symbols", "anthem", "pledge", "national service", "federal character"] },
    { name: "Values, Attitudes & Discipline", keywords: ["value", "attitude", "integrity", "honesty", "discipline", "work ethic", "courtesy", "tolerance", "self-reliance", "corruption", "ethic"] },
    { name: "Social Vices & Contemporary Issues", keywords: ["human trafficking", "drug", "substance", "cultism", "hiv", "aids", "prostitution", "kidnapping", "corruption", "child abuse", "street urchin", "gambling"] },
    { name: "Community Service & Government Structures", keywords: ["community service", "nysc", "volunteer", "local government", "state", "federal government", "civil society", "public service", "civic centre"] },
  ],
  insurance: [
    { name: "Basic Concepts of Insurance", keywords: ["insurance", "risk", "peril", "hazard", "assurance", "pooling", "loss", "premium", "indemnity", "benefit"] },
    { name: "Types of Insurance", keywords: ["life insurance", "assurance", "motor", "marine", "fire", "health", "property", "liability", "fidelity", "endowment", "term", "whole life"] },
    { name: "Principles of Insurance", keywords: ["utmost good faith", "insurable interest", "indemnity", "subrogation", "contribution", "proximate cause", "principle", "disclosure", "warranty"] },
    { name: "Insurance Business Operations", keywords: ["underwriting", "policy", "claim", "actuary", "broker", "agent", "proposal", "cover note", "reinsurance", "ceding", "premium rating"] },
    { name: "Regulation & the Insurance Market", keywords: ["naicom", "regulation", "commission", "insurance market", "lloyd", "insurance company", "supervision", "reciprocal"] },
  ],
  history: [
    { name: "Nigeria Before 1800", keywords: ["kanem", "bornu", "sokoto", "benin", "oyo", "ife", "kingdom", "empire", "emirate", "trans-saharan", "trade routes", "pre-colonial"] },
    { name: "Trade & Contact with the Outside World", keywords: ["trans-saharan", "atlantic", "slave trade", "european traders", "missionaries", "portuguese", "palm oil", "legitimate trade", "abolition", "contact"] },
    { name: "Colonial Conquest & Administration", keywords: ["colonial", "conquest", "protectorate", "indirect rule", "lugard", " amalgamation", "resistance", "native authority", "crown colony", "chartered", "royal niger"] },
    { name: "Nationalism & Independence", keywords: ["nationalism", "nationalist", "independence", "constitution", "conference", "self-government", "party", "ncnc", "action group", "balewa", "azikiwe", "awolowo", "1960"] },
    { name: "Post-Independence Nigeria", keywords: ["first republic", "military", "coup", "civil war", "biafra", "governor", "head of state", " oil boom", "second republic", " shagari", " transition", "abacha"] },
    { name: "Africa & the Wider World", keywords: ["africa", "apartheid", "ghana", "nkrumah", "egypt", "ethiopia", "colonisation of africa", "scramble", "berlin", "pan-african", "liberation"] },
  ],
  currentaffairs: [
    { name: "Government Structure & Offices", keywords: ["president", "vice president", "governor", "senate", "house of representatives", "minister", "cabinet", "chief judge", "chief of", "inspector general", "national assembly"] },
    { name: "States, Capitals & Local Government", keywords: ["state", "capital", "local government", "lga", "created", "774", "headquarters"] },
    { name: "National Symbols & Institutions", keywords: ["anthem", "flag", "coat of arms", "currency", "cbn", "central bank", "nnpc", "efcc", "icpc", "inec", "nysc", "agency", "commission"] },
    { name: "International Organisations", keywords: ["united nations", "unicef", "who", "imf", "world bank", "opec", "ecowas", "au", "african union", "commonwealth", "wto", "united nations general"] },
    { name: "Events, Awards & Appointments", keywords: ["appointed", "awarded", "gcfr", "gcon", "nobel", "hosted", "election", "won", "champion", "current"] },
  ],
};

/** Display names for every slug that carries topics (mirrors ALOC_SUBJECTS names). */
export function topicsForSlug(slug: string): Topic[] {
  return TOPICS_BY_SLUG[slug] ?? [];
}

export function topicCountForSlug(slug: string): number {
  return topicsForSlug(slug).length;
}

// ── Keyword matching ──────────────────────────────────────────────────────────

const keywordReCache = new Map<string, RegExp>();

/** \b-anchored stem match: "cell" hits "cells/cellular" but not "excellent". */
function keywordRe(keyword: string): RegExp {
  let re = keywordReCache.get(keyword);
  if (!re) {
    re = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i");
    keywordReCache.set(keyword, re);
  }
  return re;
}

type MatchableQuestion = { prompt: string; section?: string | null; explanation?: string | null };

/** True when the question text hits any of the topic's keyword stems. */
export function questionMatchesTopic(q: MatchableQuestion, keywords: string[]): boolean {
  const haystack = `${q.prompt ?? ""} ${q.section ?? ""} ${q.explanation ?? ""}`;
  if (!haystack.trim()) return false;
  return keywords.some((k) => keywordRe(k).test(haystack));
}
