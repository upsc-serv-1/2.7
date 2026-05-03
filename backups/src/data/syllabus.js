export const PRELIMS_SUBJECTS = ["Polity", "History", "Geography", "Economy", "Science & Technology", "Environment", "Current Affairs"];

export const CORE_HOME_SUBJECTS = ["Polity", "Governance", "International Relations", "Social Justice", "Indian Society", "History", "Geography", "Economy", "Science & Technology", "Environment", "Disaster Management", "Internal Security", "Ethics"];

export const OPTIONAL_SUBJECTS = ["Anthropology", "Sociology", "PSIR", "History", "Economics", "Medical Science"];

export const STANDARD_SYLLABUS = {
    "Polity": ["Historical Background", "Making of Constitution", "Salient Features", "Preamble", "Citizenship", "Fundamental Rights", "DPSP", "Fundamental Duties", "Union Executive", "Parliament", "Judiciary", "Federal System", "Emergency Provisions", "Constitutional Bodies", "Non-Constitutional Bodies", "Local Government", "Governance & Policies"],
    "History": ["Ancient India", "Medieval India", "Modern India", "Freedom Struggle", "Post Independence", "Art & Culture"],
    "Geography": ["Physical Geography", "Indian Geography", "World Geography", "Environment Geography"],
    "Economy": ["Basic Concepts", "National Income", "Inflation", "Banking", "Monetary Policy", "Fiscal Policy", "Budget", "External Sector", "Agriculture", "Industry", "Infrastructure", "Economic Reforms"],
    "Environment": ["Ecology", "Ecosystem", "Biodiversity", "Climate Change", "Pollution", "Conservation", "Environmental Conventions"],
    "Science & Technology": ["Physics Basics", "Chemistry Basics", "Biology Basics", "Space Tech", "Defence Tech", "Biotechnology", "IT & AI"],
    "Current Affairs": ["Polity CA", "Economy CA", "Geography CA", "Environment CA", "Science CA", "Government Schemes", "Reports & Indices", "International Relations"]
};

export const MICRO_SYLLABUS = {
    "Polity": { "Syllabus": [ "Historical Background", "Making of Constitution", "Salient Features", "Preamble", "Citizenship", "Fundamental Rights", "DPSP", "Fundamental Duties", "Union Executive", "Parliament", "Judiciary", "Federal System", "Emergency Provisions", "Constitutional Bodies", "Non-Constitutional Bodies", "Local Government", "Governance & Policies" ] },
    "History": { "Ancient": ["Prehistoric Period", "Stone Age", "Chalcolithic Age", "Iron Age", "Indus Valley Civilization", "Vedic Age", "Mahajanapadas", "Buddhism & Jainism", "Mauryan Empire", "Post-Mauryan Period", "Gupta Empire", "Sangam Age"], "Medieval": ["Early Medieval India", "Delhi Sultanate", "Vijayanagara Empire", "Mughal Empire", "Marathas"], "Modern": ["Advent of Europeans", "British Expansion", "Revolt of 1857", "Socio-Religious Reform Movements", "Indian National Movement", "Gandhian Phase", "Constitutional Developments", "Partition & Independence"], "Post-Independence": ["Integration of States", "Reorganization of States", "Economic Development"], "Art & Culture": ["Architecture", "Sculpture", "Paintings", "Literature", "Music & Dance", "Religion & Philosophy"] },
    "Geography": { "Physical Geography": ["Origin of Earth", "Evolution of Earth", "Geological Time Scale", "Interior of Earth", "Minerals", "Rocks", "Earthquakes", "Volcanoes", "Tsunami", "Geomorphic Processes", "Landforms", "Continental Drift & Plate Tectonics"], "Climatology": ["Atmosphere Structure", "Insolation & Heat Budget", "Temperature Distribution", "Pressure & Winds", "Jet Streams", "Cyclones", "ENSO", "Monsoon"], "Oceanography": ["Ocean Relief", "Temperature & Salinity", "Ocean Currents", "Tides & Waves", "Marine Resources"], "Indian Geography": ["Physiography", "Drainage System", "Climate", "Monsoon", "Soil", "Natural Vegetation", "Agriculture"], "World Geography": ["Landforms", "Climate Regions", "Resources"] },
    "Economy": { "Units": ["Basic Concepts", "National Income", "Inflation", "Banking", "Monetary Policy", "Fiscal Policy", "Budget", "External Sector", "Agriculture", "Industry", "Infrastructure", "Economic Reforms"] },
    "Environment": { "Units": ["Ecology", "Ecosystem", "Biodiversity", "Climate Change", "Pollution", "Conservation", "Environmental Conventions"] },
    "Science & Technology": { "Units": ["Physics Basics", "Chemistry Basics", "Biology Basics", "Space Tech", "Defence Tech", "Biotechnology", "IT & AI"] },
    "Current Affairs": { "Units": ["Polity CA", "Economy CA", "Geography CA", "Environment CA", "Science CA", "Government Schemes", "Reports & Indices", "International Relations"] }
};

export const MAINS_SYLLABUS = {
    "GS1": {
        "History": [
            "Modern Indian history from about the middle of the eighteenth century until the present- significant events, personalities, issues.",
            "The Freedom Struggle - its various stages and important contributors/contributions from different parts of the country.",
            "Post-independence consolidation and reorganization within the country.",
            "History of the world will include events from the 18th century such as industrial revolution, world wars, redrawal of national boundaries, colonization, decolonization, political philosophies like communism, capitalism, socialism etc. - their forms and effect on the society."
        ],
        "Culture": [
            "Indian culture will cover the salient aspects of Art Forms, literature and Architecture from ancient to modern times."
        ],
        "Indian Society": [
            "Salient features of Indian Society, Diversity of India.",
            "Role of women and women's organization, population and associated issues, poverty and developmental issues, urbanization, their problems and their remedies.",
            "Effects of globalization on Indian society.",
            "Social empowerment, communalism, regionalism & secularism."
        ],
        "Geography": [
            "Salient features of world's physical geography.",
            "Distribution of key natural resources across the world (including South Asia and the Indian sub-continent); factors responsible for the location of primary, secondary, and tertiary sector industries in various parts of the world (including India).",
            "Important Geophysical phenomena such as earthquakes, Tsunami, Volcanic activity, cyclone etc., geographical features and their location-changes in critical geographical features (including water-bodies and ice-caps) and in flora and fauna and the effects of such changes."
        ]
    },
    "GS2": {
        "Constitution & Polity": [
            "Indian Constitution—historical underpinnings, evolution, features, amendments, significant provisions and basic structure.",
            "Functions and responsibilities of the Union and the States, issues and challenges pertaining to the federal structure, devolution of powers and finances up to local levels and challenges therein.",
            "Separation of powers between various organs dispute redressal mechanisms and institutions.",
            "Comparison of the Indian constitutional scheme with that of other countries.",
            "Parliament and State legislatures—structure, functioning, conduct of business, powers & privileges and issues arising out of these.",
            "Structure, organization and functioning of the Executive and the Judiciary—Ministries and Departments of the Government; pressure groups and formal/informal associations and their role in the Polity.",
            "Salient features of the Representation of People’s Act.",
            "Appointment to various Constitutional posts, powers, functions and responsibilities of various Constitutional Bodies.",
            "Statutory, regulatory and various quasi-judicial bodies."
        ],
        "Governance & Social Justice": [
            "Government policies and interventions for development in various sectors and issues arising out of their design and implementation.",
            "Development processes and the development industry —the role of NGOs, SHGs, various groups and associations, donors, charities, institutional and other stakeholders.",
            "Welfare schemes for vulnerable sections of the population by the Centre and States and the performance of these schemes; mechanisms, laws, institutions and Bodies constituted for the protection and betterment of these vulnerable sections.",
            "Issues relating to development and management of Social Sector/Services relating to Health, Education, Human Resources.",
            "Issues relating to poverty and hunger.",
            "Important aspects of governance, transparency and accountability, e-governance- applications, models, successes, limitations, and potential; citizens charters, transparency & accountability and institutional and other measures.",
            "Role of civil services in a democracy."
        ],
        "International Relations": [
            "India and its neighborhood- relations.",
            "Bilateral, regional and global groupings and agreements involving India and/or affecting India’s interests.",
            "Effect of policies and politics of developed and developing countries on India’s interests, Indian diaspora.",
            "Important International institutions, agencies and fora- their structure, mandate."
        ]
    },
    "GS3": {
        "Economy & Agriculture": [
            "Indian Economy and issues relating to planning, mobilization, of resources, growth, development and employment.",
            "Inclusive growth and issues arising from it.",
            "Government Budgeting.",
            "Major crops-cropping patterns in various parts of the country, - different types of irrigation and irrigation systems storage, transport and marketing of agricultural produce and issues and related constraints; e-technology in the aid of farmers.",
            "Issues related to direct and indirect farm subsidies and minimum support prices; Public Distribution System- objectives, functioning, limitations, revamping; issues of buffer stocks and food security; Technology missions; economics of animal-rearing.",
            "Food processing and related industries in India- scope' and significance, location, upstream and downstream requirements, supply chain management.",
            "Land reforms in India.",
            "Effects of liberalization on the economy, changes in industrial policy and their effects on industrial growth.",
            "Infrastructure: Energy, Ports, Roads, Airports, Railways etc.",
            "Investment models."
        ],
        "Science & Tech": [
            "Science and Technology- developments and their applications and effects in everyday life.",
            "Achievements of Indians in science & technology; indigenization of technology and developing new technology.",
            "Awareness in the fields of IT, Space, Computers, robotics, nano-technology, bio-technology and issues relating to intellectual property rights."
        ],
        "Environment & Disaster Mgmt": [
            "Conservation, environmental pollution and degradation, environmental impact assessment.",
            "Disaster and disaster management."
        ],
        "Security": [
            "Linkages between development and spread of extremism.",
            "Role of external state and non-state actors in creating challenges to internal security.",
            "Challenges to internal security through communication networks, role of media and social networking sites in internal security challenges, basics of cyber security; money-laundering and its prevention.",
            "Security challenges and their management in border areas - linkages of organized crime with terrorism.",
            "Various Security forces and agencies and their mandate."
        ]
    },
    "GS4": {
        "Ethics & Integrity": [
            "Ethics and Human Interface: Essence, determinants and consequences of Ethics in-human actions; dimensions of ethics; ethics - in private and public relationships. Human Values - lessons from the lives and teachings of great leaders, reformers and administrators; role of family society and educational institutions in inculcating values.",
            "Attitude: content, structure, function; its influence and relation with thought and behaviour; moral and political attitudes; social influence and persuasion.",
            "Aptitude and foundational values for Civil Service, integrity, impartiality and non-partisanship, objectivity, dedication to public service, empathy, tolerance and compassion towards the weaker-sections.",
            "Emotional intelligence-concepts, and their utilities and application in administration and governance.",
            "Contributions of moral thinkers and philosophers from India and world.",
            "Public/Civil service values and Ethics in Public administration: Status and problems; ethical concerns and dilemmas in government and private institutions; laws, rules, regulations and conscience as sources of ethical guidance; accountability and ethical governance; strengthening of ethical and moral values in governance; ethical issues in international relations and funding; corporate governance.",
            "Probity in Governance: Concept of public service; Philosophical basis of governance and probity; Information sharing and transparency in government, Right to Information, Codes of Ethics, Codes of Conduct, Citizen’s Charters, Work culture, Quality of service delivery, Utilization of public funds, challenges of corruption.",
            "Case Studies on above issues."
        ]
    }
};

export const OPTIONAL_SYLLABUS_STRUCTURED = {
    "Anthropology": {
        "Paper 1": {
            "1.1 Meaning, Scope and development of Anthropology": [],
            "1.2 Relationships with other disciplines": ["Social Sciences", "Behavioural Sciences", "Life Sciences", "Medical Sciences", "Earth Sciences", "Humanities"],
            "1.3 Main branches of Anthropology, their scope and relevance": ["Social-cultural Anthropology", "Biological Anthropology", "Archaeological Anthropology", "Linguistic Anthropology"],
            "1.4 Human Evolution and emergence of Man": {
                "Biological and Cultural factors in human evolution": [],
                "Theories of Organic Evolution": ["Pre-Darwinian", "Darwinian", "Post-Darwinian"],
                "Synthetic theory of evolution": ["Doll's rule", "Cope's rule", "Gause's rule", "Parallelism", "Convergence", "Adaptive radiation", "Mosaic evolution"]
            },
            "1.5 Characteristics of Primates": {
                "Evolutionary Trend and Primate Taxonomy": [],
                "Primate Adaptations": ["Arboreal", "Terrestrial"],
                "Primate Behaviour": [],
                "Tertiary and Quaternary fossil primates": [],
                "Living Major Primates": [],
                "Comparative Anatomy of Man and Apes": [],
                "Skeletal changes due to erect posture and its implications": []
            },
            "1.6 Phylogenetic status, characteristics and geographical distribution": {
                "Plio-Pleistocene hominids (South & East Africa)": ["Australopithecines"],
                "Homo erectus": {
                    "Africa": ["Paranthropus"],
                    "Europe": ["Homo erectus (heidelbergensis)"],
                    "Asia": ["Homo erectus javanicus", "Homo erectus pekinensis"]
                },
                "Neanderthal man": ["La-chapelle-aux-saints (Classical)", "Mt. Carmel (Progressive)"],
                "Rhodesian man": [],
                "Homo sapiens": ["Cromagnon", "Grimaldi", "Chancelede"]
            },
            "1.7 Biological basis of Life": ["Cell", "DNA structure and replication", "Protein synthesis", "Gene", "Mutation", "Chromosomes", "Cell division"],
            "1.8 Prehistoric Archaeology": {
                "Principles of Prehistoric Archaeology": [],
                "Chronology": ["Relative dating", "Absolute dating"],
                "Cultural Evolution": ["Paleolithic", "Mesolithic", "Neolithic", "Chalcolithic", "Copper-Bronze Age", "Iron Age"]
            },
            "2.1 Nature of Culture": ["Concept and characteristics of culture and civilization", "Ethnocentrism vs Cultural relativism"],
            "2.2 Nature of Society": ["Concept of society", "Society and culture", "Social institution", "Social groups", "Social stratification"],
            "2.3 Marriage": {
                "Definition and universality": [],
                "Laws of marriage": ["Endogamy", "Exogamy", "Hypergamy", "Hypogamy", "Incest taboo"],
                "Types of marriage": ["Monogamy", "Polygamy", "Polyandry", "Group marriage"],
                "Functions of marriage": [],
                "Marriage regulations": ["Preferential", "Prescriptive", "Proscriptive"],
                "Marriage payments": ["Bride wealth", "Dowry"]
            },
            "2.4 Family": {
                "Definition and universality": [],
                "Family, household and domestic groups": [],
                "Functions of family": [],
                "Types of family": ["Structure", "Blood relation", "Marriage", "Residence", "Succession"],
                "Impact": ["Urbanization", "Industrialization", "Feminist movements"]
            },
            "2.5 Kinship": {
                "Consanguinity and affinity": [],
                "Principles and types of descent": ["Unilineal", "Double", "Bilateral", "Ambilineal"],
                "Forms of descent groups": ["Lineage", "Clan", "Phratry", "Moiety", "Kindred"],
                "Kinship terminology": ["Descriptive", "Classificatory"],
                "Descent, filiation and complementary filiation": [],
                "Descent and alliance": []
            },
            "3. Economic Organization": {
                "Meaning, scope and relevance": [],
                "Formalist vs substantivist debate": [],
                "Production, distribution, exchange": ["Reciprocity", "Redistribution", "Market"],
                "Subsistence types": ["Hunting-gathering", "Fishing", "Swiddening", "Pastoralism", "Horticulture", "Agriculture"],
                "Globalization and indigenous systems": []
            },
            "4. Political Organization and Social Control": ["Band, tribe, chiefdom, kingdom, state", "Power, authority, legitimacy", "Social control, law and justice"],
            "5. Religion": {
                "Anthropological approaches": ["Evolutionary", "Psychological", "Functional"],
                "Monotheism and polytheism": [],
                "Sacred and profane": [],
                "Myths and rituals": [],
                "Forms of religion": ["Animism", "Animatism", "Fetishism", "Naturism", "Totemism"],
                "Religion, magic and science": [],
                "Magico-religious functionaries": ["Priest", "Shaman", "Medicine man", "Sorcerer", "Witch"]
            },
            "6. Anthropological Theories": {
                "Classical evolutionism": ["Tylor", "Morgan", "Frazer"],
                "Historical particularism": ["Boas"],
                "Diffusionism": ["British", "German", "American"],
                "Functionalism": ["Malinowski"],
                "Structural-functionalism": ["Radcliffe-Brown"],
                "Structuralism": ["Levi-Strauss", "E. Leach"],
                "Culture and personality": ["Benedict", "Mead", "Linton", "Kardiner", "Cora-du Bois"],
                "Neo-evolutionism": ["Childe", "White", "Steward", "Sahlins", "Service"],
                "Cultural materialism - Harris": [],
                "Symbolic and interpretive theories": ["Turner", "Schneider", "Geertz"],
                "Cognitive theories": ["Tyler", "Conklin"],
                "Post-modernism": []
            },
            "7. Culture, Language and Communication": ["Nature, origin, characteristics of language", "Verbal and non-verbal communication", "Social context of language"],
            "8. Research Methods in Anthropology": {
                "Fieldwork tradition": [],
                "Technique vs method vs methodology": [],
                "Tools of data collection": ["Observation", "Interview", "Schedules", "Questionnaire", "Case study", "Genealogy", "Life-history", "Oral history", "Secondary sources", "Participatory methods"],
                "Analysis, interpretation, presentation": []
            },
            "9.1 Human Genetics - Methods and Application": [],
            "9.2 Mendelian genetics": [],
            "9.3 Genetic polymorphism, Hardy-Weinberg law, mutation, migration, selection, drift": [],
            "9.4 Chromosomal aberrations": [],
            "9.5 Race and racism": [],
            "9.6 Genetic markers (ABO, Rh, etc.)": [],
            "9.7 Ecological anthropology and adaptation": [],
            "9.8 Epidemiological anthropology": [],
            "10. Human Growth and Development": ["Stages", "Factors", "Ageing", "Somatotypes"],
            "11. Fertility and Demography": ["Menarche, menopause", "Demographic theories", "Fecundity, fertility, mortality"],
            "12. Applications of Anthropology": ["Sports", "Nutrition", "Defence design", "Forensic anthropology", "Personal identification", "Genetic counselling", "DNA technology"]
        },
        "Paper 2": {
            "1. Indian Culture and Civilization": {
                "Prehistoric": ["Paleolithic", "Mesolithic", "Neolithic", "Neolithic-Chalcolithic"],
                "Protohistoric": {
                    "Indus Civilization": ["Pre-Harappan", "Harappan", "Post-Harappan"]
                },
                "Tribal contributions": []
            },
            "1.2 Paleo-anthropological evidences": ["Siwaliks", "Narmada basin", "Ramapithecus", "Sivapithecus", "Narmada Man"],
            "1.3 Ethno-archaeology": { "Concept": [], "Survivals and parallels": ["Hunting", "Foraging", "Fishing", "Pastoral", "Peasant", "Arts and crafts"] },
            "2. Demographic profile of India": ["Ethnic elements", "Linguistic elements", "Population structure and growth"],
            "3. Indian Social System": ["Varnashram", "Purushartha", "Karma", "Rina", "Rebirth"],
            "3.2 Caste system": ["Structure and characteristics", "Varna and caste", "Theories of origin", "Dominant caste", "Mobility", "Future", "Jajmani system", "Tribe-caste continuum"],
            "3.3 Sacred Complex": [],
            "3.4 Impact of religions": ["Buddhism", "Jainism", "Islam", "Christianity"],
            "4. Development of Anthropology in India": ["Scholar-administrators", "Indian anthropologists"],
            "5. Indian Village": ["Village study significance", "Social system", "Settlement patterns", "Inter-caste relations", "Agrarian relations", "Globalization impact"],
            "5.2 Minorities": [],
            "5.3 Social change processes": ["Sanskritization", "Westernization", "Modernization", "Little & Great traditions", "Panchayati Raj", "Media"],
            "6. Tribal Situation": {
                "Bio-genetic variability": [], "Socio-economic characteristics": [], "Distribution": [],
                "Problems": ["Land alienation", "Poverty", "Indebtedness", "Low literacy", "Poor education", "Unemployment", "Under-employment", "Health & nutrition"],
                "Developmental projects": [], "Displacement": [], "Rehabilitation": [], "Forest policy": [], "Urbanization & industrialization": []
            },
            "7. SC/ST/OBC Issues": ["Exploitation & deprivation", "Constitutional safeguards", "Social change", "Welfare measures"],
            "7.3 Ethnicity and conflicts": ["Ethnicity", "Tribal unrest", "Regionalism", "Autonomy demands", "Pseudo-tribalism", "Historical change"],
            "8. Religion and Tribes": ["Hinduism", "Buddhism", "Christianity", "Islam"],
            "8.2 Tribe vs Nation-state comparison": [],
            "9. Tribal Administration & Development": ["Policies & programmes", "PTGs", "NGOs", "Anthropology in development", "Role in regionalism, communalism, ethnic politics"]
        }
    },
    "Sociology": {
        "Paper 1": {
            "1. Sociology - The Discipline": ["Modernity and social changes in Europe and emergence of Sociology", "Scope of the subject and comparison with other social sciences", "Sociology and common sense"],
            "2. Sociology as Science": ["Science, scientific method and critique", "Major theoretical strands of research methodology", "Positivism and its critique", "Fact value and objectivity", "Non-positivist methodologies"],
            "3. Research Methods and Analysis": ["Qualitative and quantitative methods", "Techniques of data collection", "Variables, sampling, hypothesis, reliability and validity"],
            "4. Sociological Thinkers": {
                "Karl Marx": ["Historical materialism", "Mode of production", "Alienation", "Class struggle"],
                "Emile Durkheim": ["Division of labour", "Social fact", "Suicide", "Religion and society"],
                "Max Weber": ["Social action", "Ideal types", "Authority", "Bureaucracy", "Protestant ethic and spirit of capitalism"],
                "Talcott Parsons": ["Social system", "Pattern variables"],
                "Robert K. Merton": ["Latent and manifest functions", "Conformity and deviance", "Reference groups"],
                "Mead": ["Self and identity"]
            },
            "5. Stratification and Mobility": {
                "Concepts": ["Equality", "Inequality", "Hierarchy", "Exclusion", "Poverty", "Deprivation"],
                "Theories of social stratification": ["Structural functionalist theory", "Marxist theory", "Weberian theory"],
                "Dimensions": ["Class", "Status groups", "Gender", "Ethnicity", "Race"],
                "Social mobility": ["Open and closed systems", "Types of mobility", "Sources and causes of mobility"]
            },
            "6. Work and Economic Life": {
                "Social organization of work": ["Slave society", "Feudal society", "Industrial capitalist society"],
                "Formal and informal organization of work": [],
                "Labour and society": []
            },
            "7. Politics and Society": ["Sociological theories of power", "Power elite, bureaucracy, pressure groups, political parties", "Nation, state, citizenship, democracy, civil society, ideology", "Protest, agitation, social movements, collective action, revolution"],
            "8. Religion and Society": {
                "Sociological theories of religion": [],
                "Types of religious practices": ["Animism", "Monism", "Pluralism", "Sects", "Cults"],
                "Religion in modern society": ["Religion and science", "Secularization", "Religious revivalism", "Fundamentalism"]
            },
            "9. Systems of Kinship": ["Family, household, marriage", "Types and forms of family", "Lineage and descent", "Patriarchy and sexual division of labour", "Contemporary trends"],
            "10. Social Change in Modern Society": ["Sociological theories of social change", "Development and dependency", "Agents of social change", "Education and social change", "Science, technology and social change"]
        },
        "Paper 2": {
            "A. Introducing Indian Society": {
                "1. Perspectives on the Study of Indian Society": ["Indology - G.S. Ghurye", "Structural functionalism - M.N. Srinivas", "Marxist sociology - A.R. Desai"],
                "2. Impact of Colonial Rule": ["Social background of Indian nationalism", "Modernization of Indian tradition", "Protests and movements during colonial period", "Social reforms"]
            },
            "B. Social Structure": {
                "1. Rural and Agrarian Social Structure": { "Idea of Indian village and village studies": [], "Agrarian structure": ["Evolution of land tenure system", "Land reforms"] },
                "2. Caste System": { "Perspectives": ["G.S. Ghurye", "M.N. Srinivas", "Louis Dumont", "Andre Beteille"], "Features of caste system": [], "Untouchability - forms and perspectives": [] },
                "3. Tribal Communities in India": ["Definitional problems", "Geographical spread", "Colonial policies", "Issues of integration and autonomy"],
                "4. Social Classes in India": ["Agrarian class structure", "Industrial class structure", "Middle classes in India"],
                "5. Systems of Kinship in India": ["Lineage and descent", "Types of kinship systems", "Family and marriage", "Household dimensions", "Patriarchy, entitlements, sexual division of labour"],
                "6. Religion and Society": ["Religious communities in India", "Problems of religious minorities"]
            },
            "C. Social Change in India": {
                "1. Visions of Social Change": ["Development planning and mixed economy", "Constitution, law and social change", "Education and social change"],
                "2. Rural and Agrarian Transformation": { "Rural development programmes": ["Community Development Programme", "Cooperatives", "Poverty alleviation schemes"], "Green Revolution and social change": [], "Changing modes of production": [], "Rural labour issues": ["Bondage", "Migration"] },
                "3. Industrialization and Urbanisation": { "Evolution of modern industry": [], "Growth of urban settlements": [], "Working class": ["Structure", "Growth", "Class mobilization"], "Informal sector and child labour": [], "Slums and deprivation": [] },
                "4. Politics and Society": ["Nation, democracy, citizenship", "Political parties, pressure groups, elites", "Regionalism and decentralization", "Secularization"],
                "5. Social Movements": ["Peasant and farmers movements", "Women's movement", "Backward classes and Dalit movements", "Environmental movements", "Ethnicity and identity movements"],
                "6. Population Dynamics": { "Size, growth, composition, distribution": [], "Birth, death, migration": [], "Population policy and family planning": [], "Emerging issues": ["Ageing", "Sex ratio", "Infant mortality", "Reproductive health"] },
                "7. Challenges of Social Transformation": { "Crisis of development": ["Displacement", "Environmental problems", "Sustainability"], "Poverty, deprivation, inequality": [], "Violence against women": [], "Caste conflicts": [], "Ethnic conflicts, communalism, religious revivalism": [], "Illiteracy and educational disparities": [] }
            }
        }
    },
    "PSIR": {
        "Paper 1": {
            "Section A": {
                "1. Political Theory": {
                    "meaning and approaches": [],
                    "Theories of state: Liberal, Neo-liberal, Marxist, Pluiralist, post-colonial and Feminist": [],
                    "Justice: Conceptions of justice with special reference to Rawl's theory of justice and its communitarian critiques": [],
                    "Equality: Social, political and economic; relationship between equality and freedom; Affirmative action": [],
                    "Rights: Meaning and theories; different kinds of rights; Concept of Human Rights": [],
                    "Democracy: Classical and contemporary theories; different models of democracy - representative, participatory and deliberative": [],
                    "Concept of power: hegemony, ideology and legitimacy": [],
                    "Political Ideologies: Liberalism, Socialism, Marxism, Fascism, Gandhism and Feminism": [],
                    "Indian Political Thought: Dharamshastra, Arthashastra and Buddhist Traditions; Sir Syed Ahmed Khan, Sri Aurobindo, M. K. Gandhi, B. R. Ambedkar, M. N. Roy": [],
                    "Western Political Thought: Plato, Aristotle, Machiavelli, Hobbes, Locke, John S. Mill, Marx, Gramsci, Hannah Arendt": []
                }
            },
            "Section B": {
                "2. Indian Government and Politics": {
                    "Indian Nationalism": [],
                    "Political Strategies of India's Freedom Struggle": [],
                    "Perspectives on Indian National Movement": [],
                    "Making of the Indian Constitution": [],
                    "Salient Features of the Indian Constitution": [],
                    "Principal Organs of the Union Government": [],
                    "Principal Organs of the State Government": [],
                    "Grassroots Democracy": [],
                    "Statutory Institutions/Commissions": [],
                    "Federalism": [],
                    "Planning and Economic development": [],
                    "Caste, Religion and Ethnicity in Indian Politics": [],
                    "Party System": [],
                    "Social Movement": []
                }
            }
        },
        "Paper 2": {
            "Section A": {
                "3. Comparative Political Analysis and International Politics": {
                    "Comparative Politics": [], "State in Comparative Perspective": [], "Politics of Representation and Participation": [], "Globalisation": [], "Approaches to the Study of International Relations": [], "Key Concepts in International Relations": [], "Changing International Political Order": [], "Evolution of the International Economic System": [], "United Nations": [], "Regionalisation of World Politics": [], "Contemporary Global Concerns": []
                }
            },
            "Section B": {
                "4. India and the World": {
                    "Indian Foreign Policy": [], "India's Contribution to the Non-Alignment Movement": [], "India and South Asia": [], "India and the Global South": [], "India and the Global Centres of Power": [], "India and the UN System": [], "India and the Nuclear Question": [], "Recent developments in Indian Foreign Policy": []
                }
            }
        }
    },
    "History": {
        "Paper 1": {
            "1. Sources": ["Archaeological sources", "Literary sources", "Foreign account"],
            "2. Pre-history and Proto-history": ["Geographical factors", "Hunting and gathering", "Beginning of agriculture"],
            "3. Indus Valley Civilization": ["Origin, date, extent, characteristics", "Decline, survival and significance", "Art and architecture"],
            "4. Megalithic Cultures": [],
            "5. Aryans and Vedic Period": [],
            "6. Period of Mahajanapadas": [],
            "7. Mauryan Empire": [],
            "8. Post-Mauryan Period": [],
            "9. Early State and Society in Eastern India, Deccan and South India": [],
            "10. Guptas, Vakatakas and Vardhanas": [],
            "11. Regional States during Gupta Era": [],
            "12. Themes in Early Indian Cultural History": [],
            "13. Early Medieval India, 750-1200": [],
            "14. Cultural Traditions in India, 750-1200": [],
            "15. The Thirteenth Century": [],
            "16. The Fourteenth Century": [],
            "17. Society, Culture and Economy in the Thirteenth and Fourteenth Centuries": [],
            "18. The Fifteenth and Early Sixteenth Century - Political Developments and Economy": [],
            "19. The Fifteenth and Early Sixteenth Century - Society and culture": [],
            "20. Akbar": [],
            "21. Mughal Empire in the Seventeenth Century": [],
            "22. Economy and society, in the 16th and 17th Centuries": [],
            "23. Culture during Mughal Empire": [],
            "24. The Eighteenth Century": []
        },
        "Paper 2": {
            "1. European Penetration into India": [],
            "2. British Expansion in India": [],
            "3. Early Structure of the British Raj": [],
            "4. Economic Impact of British Colonial Rule": [],
            "5. Social and Cultural Developments": [],
            "6. Social and Religious Reform Movements in Bengal and Other Areas": [],
            "7. Indian Response to British Rule": [],
            "8. Factors leading to the birth of Indian Nationalism": [],
            "9. Rise of Gandhi": [],
            "10. Constitutional Developments in the Colonial India between 1858 and 1935": [],
            "11. Other strands in the National Movement": [],
            "12. Politics of Separatism": [],
            "13. Consolidation as a Nation": [],
            "14. Caste and Ethnicity after 1947": [],
            "15. Economic development and political change": [],
            "16. Enlightenment and Modern ideas": [],
            "17. Origins of Modern Politics": [],
            "18. Industrialization": [],
            "19. Nation-State System": [],
            "20. Imperialism and Colonialism": [],
            "21. Revolution and Counter-Revolution": [],
            "22. World Wars": [],
            "23. The World after World War II": [],
            "24. Liberation from Colonial Rule": [],
            "25. Decolonization and Underdevelopment": [],
            "26. Unification of Europe": [],
            "27. Disintegration of Soviet Union and the Rise of the Unipolar World": []
        }
    },
    "Economics": {
        "Paper 1": {
            "1. Advanced Micro Economics": [], "2. Advanced Macro Economics": [], "3. Money - Banking and Finance": [], "4. International Economics": [], "5. Growth and Development": []
        },
        "Paper 2": {
            "1. Indian Economy in Pre-Independence Era": [],
            "2. Indian Economy after Independence": {
                "A. The Pre Liberalization Era": {},
                "B. The Post Liberalization Era": {}
            }
        }
    },
    "Medical Science": {
        "Paper 1": {
            "Unit 1. Human Anatomy": [], "Unit 2. Human Physiology": [], "Unit 3. Biochemistry": [], "Unit 4. Pathology": [], "Unit 5. Microbiology": [], "Unit 6. Pharmacology": [], "Unit 7. Forensic Medicine and Toxicology": []
        },
        "Paper 2": {
            "Unit 1. General Medicine": [], "Unit 2. Paediatrics": [], "Unit 3. Dermatology": [], "Unit 4. General Surgery": [], "Unit 5. Obstetrics and Gynaecology": [], "Unit 6. Community Medicine": []
        }
    }
};
