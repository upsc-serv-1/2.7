/**
 * Syllabus Progress Tracker Module
 * Ported faithfully from q15.html — DOM-manipulation based (no re-render),
 * with Supabase real-time sync layered on top.
 */

import { loadSyllabusProgress } from './supabase-data.js';
import { saveSyllabusProgress } from './student-sync.js';

// ─── State Variables ───────────────────────────────────────────────
let progressData = {};
let recentActivity = [];
let trackerMainMode = 'prelims';
let trackerMode = 'standard'; // 'standard' | 'micro'
let trackingMethod = 'single'; // 'single' | 'multi'
let trackerViewState = 'subject';
let activeSubject = '';
let weakAreaPreviewMode = 'prelims';
let weakAreaTrackingBasis = 'single';

let subjectChart = null;
let overallChart = null;
let currentUserId = null;
let syncTimer = null;

// ─── Syllabus Data ─────────────────────────────────────────────────

export const PRELIMS_SUBJECTS = [
    'History', 'Geography', 'Environment', 'Polity', 'Economy',
    'Science & Technology', 'Agriculture', 'International Relations'
];

export const OPTIONAL_SUBJECTS = [
    'Anthropology', 'Sociology', 'PSIR', 'History', 'Public Administration',
    'Geography', 'Economics', 'Philosophy', 'Medical Science', 'Literature'
];

// Standard UPSC syllabus (flat)
export const STANDARD_SYLLABUS = {
    'History': [
        'Prehistoric Period', 'Stone Age, Chalcolithic Age, Iron Age', 'Indus Valley Civilization',
        'Vedic Age', 'Mahajanapadas', 'Buddhism, Jainism & Other Philosophies', 'Mauryan Empire',
        'Post-Mauryan Period', 'Gupta Period', 'Post Gupta Period', 'Sangam Age',
        'Literature of Ancient India', 'Major Dynasties of Early Medieval India',
        'Chola and South Indian Kingdoms', 'Delhi Sultanate & Early Muslim Invasions',
        'Mughals & Sur Empire', 'Vijayanagara Empire & Bahmani Kingdom', 'Maratha Empire',
        'Medieval Literature & Books', 'Architecture', 'Sculpture', 'Religion & Philosophy',
        'Bhakti and Sufi', 'Painting', 'Pottery & Numismatics', 'Performing Arts',
        'GI Tags, Awards & Honours', 'National and Regional Festivals',
        'Advent of Europeans & British Expansion', '1857 Revolt', 'Peasant & Working-Class Movements',
        'Socio-Religious Reform Movements', 'Early National Movement', 'Revolutionary Movements',
        'Gandhian Phase', 'Partition & Independence', 'Constitutional Developments',
        'Governor Generals and Their Policies', 'Development of Press, Education'
    ],
    'Geography': [
        'Origin, Evolution, Geological Time Scale', 'Interior of Earth and Continental Theories',
        'Geology and Rocks', 'Earthquake and Volcanism', 'Tsunami',
        'Geomorphic Processes', 'Distribution of Continents and Oceans', 'Landforms',
        'Mountains and Plateaus', 'Atmosphere (Composition, Structure)',
        'Solar Radiation, Heat Balance, Temperature', 'Pressure, Winds, Airmasses',
        'Water in the Atmosphere', 'Cyclones', 'Jet Stream, Polar Vortex',
        'El Nino and La Nina', 'World Climatic Regions', 'Water on Earth Surface, Ocean Relief',
        'Temperature, Salinity', 'Movement of Ocean Water', 'Ocean Currents',
        'Marine Resources, Maritime Zones', 'Distribution of Water Resources',
        'Physiography of India', 'Drainage System, Rivers', 'Climate, Monsoon', 'Soils of India',
        'Natural Vegetation (Forests, Trees)', 'Land Resources', 'Minerals and Resources',
        'Petroleum, Oil, Gas', 'Gold, Silver, Diamond', 'Atomic Minerals',
        'Critical and Strategic Minerals', 'Energy', 'Industry', 'Transport',
        'Demography, Population, Census', 'Urbanization, Migration', 'Tribes',
        'Mountains, Plateaus, Valleys (World)', 'Rivers, Lakes (World)', 'Deserts',
        'Straits, Channels, Oceans, Seas', 'Major Ports, Trade Routes', 'Local Winds'
    ],
    'Environment': [
        'Ecology and Ecosystem', 'Biogeochemical Cycles', 'Biomes',
        'Aquatic Ecosystem and Life', 'Biodiversity Basics', 'Major Species',
        'Mass Extinctions and IUCN Red List', 'Ex-Situ and In-Situ Conservation',
        'Wildlife Conservation', 'National Park, Wildlife Sanctuary, Biosphere Reserve',
        'Tiger Reserve, Elephant Reserve', 'Ramsar Sites, World Heritage Sites',
        'Air and Water Acts', 'EPA Act, EIA, ESZ, CRZ', 'Wildlife Acts',
        'Forest Acts', 'NGT, PCB, FSI, NBWL',
        'Air, Water, Noise Pollution', 'Soil Pollution, Solid Waste', 'Hazardous, Radioactive, E-Waste',
        'Carcinogenic Pollutants', 'Plastics and Microplastics',
        'Climate Change and Impacts', 'Greenhouse Gases, ODS', 'Tackling Climate Change',
        'Biodiversity Conventions (IUCN, WWF, CBD, Nagoya)', 'Climate Change Conventions (UNFCCC, REDD)',
        'Pollution Related Conventions', 'Desertification Related'
    ],
    'Polity': [
        'Historical Background', 'Constitutional Development',
        'Salient Features & Comparison', 'Preamble', 'Union, States and Territory, UTs',
        'Citizenship', 'Fundamental Rights', 'Fundamental Duties', 'Amendment and Basic Structure',
        'Directive Principles of State Policy', 'DPSP, FR and FD Comparison',
        'Various Types of Majority, Doctrines', 'Parliamentary and Federal System',
        'President, Vice President, Governor', 'Prime Minister, Chief Minister, Council of Ministers',
        'Centre-State Relations', 'UT, Scheduled Areas', 'Emergency Provisions',
        'Parliament Procedures, Bills, Committees', 'State Legislatures',
        'Judiciary', 'Local Government Panchayats, Municipalities',
        'Scheduled and Tribal Areas', 'Language',
        'Constitutional Bodies', 'Extra-Constitutional Bodies',
        'Elections, Political Parties, Anti-Defection Law', 'Governance and Policies'
    ],
    'Economy': [
        'Money (Evolution, Types, Digital Currency)', 'Monetary Policy', 'Banking, NPA',
        'Financial Markets', 'Insurance and Pension', 'Budget', 'Taxation',
        'Subsidies', 'Fiscal Policy', 'Finance Commission', 'Black Money',
        'Balance of Payments (BoP)', 'Trade (Exports, Imports, FDI)',
        'Exchange Rates (NEER, REER)', 'International Organisations (WTO, IMF)',
        'Map-Based Relevance', 'Agriculture (Schemes, APMC, MSP)',
        'Manufacturing', 'Services', 'GDP, Inflation, Unemployment',
        'Energy (Infrastructure)', 'Transport (Infrastructure)',
        'Communication (Infrastructure)', 'Investment Models, PPP',
        'Education (NEP 2020, Skill)', 'Health', 'Poverty and Development', 'Employment'
    ],
    'Science & Technology': [
        'Biology and Biotechnology', 'Space', 'Navigation', 'Defence',
        'Nuclear Technology', 'Information and Communication Technology, Robotics, AI',
        'Nanotechnology', 'IPR, Institutions and Policies'
    ],
    'Agriculture': [
        'Cropping Patterns and Major Crops', 'Irrigation and Water Management',
        'Agricultural Productivity', 'Technology in Agriculture',
        'Agricultural Marketing and Pricing', 'Government Schemes and Policies',
        'Land Reforms', 'Allied Sectors (Animal Husbandry, Horticulture)',
        'Food Security and Storage', 'Environmental and Global Issues'
    ],
    'International Relations': [
        'International Organizations (UN, IMF, ASEAN, BRICS)',
        'Reports and Indices (HDI, CPI, GHI, WEO)',
        'Global Groupings and Agreements (Paris Agreement, QUAD)',
        'Places in News and Geopolitical Hotspots',
        'India and Neighbourhood (Pakistan, China, Nepal)',
        'India and the World (USA, Russia, Middle East)',
        'Security and Strategic Issues (Terrorism, Cyber)',
        'Current Affairs Focus (Summits, Reports, Conflicts)'
    ]
};

// Mains GS Syllabus
export const MAINS_SYLLABUS = {
    'GS1': {
        'Modern Indian History': ['Freedom Struggle', 'Social Reforms', 'National Leaders', 'Revolutionary Movements'],
        'Indian Culture': ['Art & Architecture', 'Literature', 'Performing Arts', 'Ancient to Medieval'],
        'World History': ['Colonialism', 'World Wars', 'Communism', 'Decolonization'],
        'Indian Society': ['Diversity', 'Caste', 'Women Issues', 'Urbanization', 'Globalization'],
        'Geography': ['Physical Geography', 'India Geography', 'Environment', 'Disasters']
    },
    'GS2': {
        'Constitution': ['Historical Background', 'Features', 'Amendments', 'Emergency Provisions'],
        'Parliament & Executive': ['Parliament', 'President', 'PM & Cabinet', 'Central Administration'],
        'Judiciary': ['Supreme Court', 'High Courts', 'Tribunals', 'Quasi-Judicial'],
        'Federal Structure': ['Centre-State Relations', 'Local Bodies', 'Finance Commission'],
        'Governance': ['Good Governance', 'E-Governance', 'Accountability', 'RTI'],
        'Social Justice': ['Welfare Schemes', 'Health', 'Education', 'Poverty Alleviation'],
        'International Relations': ['India & World', 'Bilateral Relations', 'International Organizations']
    },
    'GS3': {
        'Economy': ['Economic Growth', 'Budgetary Processes', 'Inclusive Growth', 'Investment Models'],
        'Agriculture': ['Major Crops', 'Food Processing', 'Storage & Marketing', 'Land Reforms'],
        'Science & Technology': ['IT', 'Space', 'Biotechnology', 'Defence', 'Nuclear', 'IPR'],
        'Environment': ['Conservation', 'Pollution', 'Climate Change', 'Environmental Impact'],
        'Internal Security': ['Terrorism', 'Border Issues', 'Money Laundering', 'Organized Crime']
    },
    'GS4': {
        'Ethics': ['Core Concepts', 'Public & Private Life', 'Ethical Dilemmas'],
        'Attitude': ['Content & Structure', 'Influence & Relation', 'Moral Influence'],
        'Aptitude & Foundational Values': ['Service & Commitment', 'Integrity', 'Impartiality'],
        'Emotional Intelligence': ['Concepts & Utilities', 'Application in Governance'],
        'Contributions of Thinkers': ['Moral Thinkers', 'Philosophers', 'Social Reformers'],
        'Case Studies': ['Worked Examples', 'Decision Making', 'Ethical Questions']
    }
};

// Optional Syllabus
export const OPTIONAL_SYLLABUS_STRUCTURED = {
    'Anthropology': {
        'Paper 1': {
            'Section A': ['Meaning, scope and development of Anthropology', 'Relationships with other disciplines', 'Main branches of Anthropology', 'Human Evolution', 'Biological basis of Life'],
            'Section B': ['Primate order', 'Race and racism', 'Age, sex, population variance', 'Concept of human growth', 'Relevance of demography']
        },
        'Paper 2': {
            'Section A': ['Evolution of Indian culture', 'Aspects of Indian villages', 'Tribal situation in India', 'Problems of tribal communities', 'Caste system'],
            'Section B': ['Ethnicity and identity movements', 'Gender issues', 'Religion and society', 'Impact of Hinduism, Islam, Christianity', 'Tribe, caste and their interrelations']
        }
    },
    'Sociology': {
        'Paper 1': {
            'Sociology - The Discipline': ['Modernity and social changes in Europe', 'Scope of the subject', 'Sociology and common sense'],
            'Sociology as Science': ['Science, scientific method and critique', 'Major theoretical strands'],
            'Research Methods and Analysis': ['Qualitative and quantitative methods', 'Techniques of data collection'],
            'Sociological Thinkers': ['Karl Marx', 'Emile Durkheim', 'Max Weber', 'Talcott Parsons', 'Robert K Merton']
        },
        'Paper 2': {
            'Introducing Indian Society': ['Perspectives on Indian society', 'Caste System', 'Tribal Communities'],
            'Social Structure': ['Rural and Agrarian Social Structure', 'Industrial Society', 'Religion and Society'],
            'Social Change in Modern India': ['Social Reform movements', 'Independence and Social Change', 'Vision of Social Change']
        }
    }
};

// ─── Initialization ────────────────────────────────────────────────

export async function initTracker(uid) {
    currentUserId = uid;

    // Load from localStorage first (immediate)
    try {
        progressData = JSON.parse(localStorage.getItem('upsc_tracker_progress_v6') || '{}');
        recentActivity = JSON.parse(localStorage.getItem('upsc_tracker_recent_v4') || '[]');
        trackerMainMode = localStorage.getItem('upsc_tracker_main_mode') || 'prelims';
        trackerMode = localStorage.getItem('upsc_tracker_mode') || 'standard';
        trackingMethod = localStorage.getItem('upsc_tracking_method') || 'single';
        weakAreaTrackingBasis = localStorage.getItem('upsc_weak_area_basis') || 'single';
    } catch (e) {
        progressData = {};
    }

    // Then sync from Supabase (in background, merge if newer)
    if (uid) {
        try {
            const serverData = await loadSyllabusProgress(uid);
            if (serverData && typeof serverData === 'object') {
                progressData = serverData;
                localStorage.setItem('upsc_tracker_progress_v6', JSON.stringify(progressData));
            }
        } catch (e) {
            console.warn('Tracker: Supabase load failed, using local data:', e.message);
        }
    }
}

// Debounced save to Supabase — saves 1.5s after last change
function scheduleSyncToSupabase() {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(async () => {
        if (!currentUserId) return;
        try {
            await saveSyllabusProgress(currentUserId, progressData);
        } catch (e) {
            console.error('Tracker sync failed:', e.message);
        }
    }, 1500);
}

function saveLocal() {
    localStorage.setItem('upsc_tracker_progress_v6', JSON.stringify(progressData));
    localStorage.setItem('upsc_tracker_recent_v4', JSON.stringify(recentActivity));
}

// ─── Helper: Get leaf entries for a subject ────────────────────────

function getSyllabusLeafEntries(sub) {
    if (trackerMainMode === 'mains') {
        const source = MAINS_SYLLABUS[sub];
        if (!source) return [];
        const entries = [];
        const walk = (node, basePath) => {
            Object.entries(node).forEach(([label, child]) => {
                const nextPath = basePath ? `${basePath}.${label}` : label;
                if (Array.isArray(child)) {
                    child.forEach(topic => entries.push({ label: topic, path: `${sub}.${nextPath}.${topic}`, subject: sub }));
                } else {
                    walk(child, nextPath);
                }
            });
        };
        walk(source, '');
        return entries;
    }

    if (trackerMainMode === 'optional') {
        const selected = getSelectedOptional();
        const source = OPTIONAL_SYLLABUS_STRUCTURED[selected];
        if (!source) return [];
        const entries = [];
        const walk = (node, basePath) => {
            Object.entries(node).forEach(([label, child]) => {
                const nextPath = `${basePath}.${label}`;
                if (Array.isArray(child)) {
                    child.forEach(topic => entries.push({ label: topic, path: `${nextPath}.${topic}`, subject: selected }));
                } else {
                    walk(child, nextPath);
                }
            });
        };
        walk(source, selected);
        return entries;
    }

    // Prelims
    const list = trackerMode === 'micro'
        ? buildMicroEntries(sub)
        : (STANDARD_SYLLABUS[sub] || []).map(t => ({ label: t, path: t, subject: sub }));
    return list;
}

function buildMicroEntries(sub) {
    // Just use standard for prelims micro (topics from the JSON taxonomy)
    return (STANDARD_SYLLABUS[sub] || []).map(t => ({ label: t, path: `${sub}.${t}`, subject: sub }));
}

function getSelectedOptional() {
    return localStorage.getItem('upsc_selected_optional') || '';
}

function getCurrentSubjects() {
    if (trackerMainMode === 'mains') return Object.keys(MAINS_SYLLABUS);
    if (trackerMainMode === 'optional') {
        const opt = getSelectedOptional();
        return opt ? [opt] : [];
    }
    return PRELIMS_SUBJECTS;
}

function getModeKey() {
    if (trackerMainMode === 'mains') return 'mains';
    if (trackerMainMode === 'optional') return 'optional';
    return trackerMode; // 'standard' | 'micro'
}

// ─── Stats ─────────────────────────────────────────────────────────

export function getSubjectStats(sub) {
    const modeKey = getModeKey();
    const data = progressData[modeKey]?.[sub] || {};
    const entries = getSyllabusLeafEntries(sub);
    const total = entries.length;

    let score = 0;
    let fullCompleted = 0;

    entries.forEach(entry => {
        const state = data[entry.path] || {};
        if (trackingMethod === 'single') {
            const done = trackerMainMode === 'prelims' ? state.qbank : state.ansWriting;
            if (done) { score += 1; fullCompleted++; }
        } else {
            let itemScore = 0;
            if (trackerMainMode === 'prelims') {
                if (state.ncert) itemScore += 1 / 3;
                if (state.pyqs) itemScore += 1 / 3;
                if (state.qbank) itemScore += 1 / 3;
            } else {
                if (state.books) itemScore += 0.25;
                if (state.valueAddition) itemScore += 0.25;
                if (state.pyqs) itemScore += 0.25;
                if (state.ansWriting) itemScore += 0.25;
            }
            if (itemScore >= 0.99) fullCompleted++;
            score += itemScore;
        }
    });

    const percent = total > 0 ? Math.min(100, Math.round((score / total) * 100)) : 0;
    return { completed: fullCompleted, total, percent, rawScore: score };
}

// ─── Rendering: HTML Template (used once by app.js) ───────────────

export function renderTracker() {
    return `
<div id="trackerPage" class="animate-fade-in pb-20">

    <!-- Level 0: Main Selection -->
    <div class="mb-8 flex flex-wrap gap-4 items-center">
        <button id="nav-tracker-main" class="px-6 py-2.5 rounded-2xl bg-[#8a795d] text-white font-bold text-sm border-2 border-[#8a795d] shadow-sm">
            Syllabus Progress Tracker
        </button>
        <button id="nav-report-main" class="px-6 py-2.5 rounded-2xl bg-muted text-muted font-bold text-sm border-2 border-theme hover:bg-card hover:text-main transition">
            Comprehensive Report
        </button>
    </div>

    <div id="tracker-report-container" class="hidden animate-fade-in">
        <!-- Content injected by renderComprehensiveReport() -->
    </div>

    <div id="tracker-main-container" class="animate-fade-in">
        <!-- Header -->
        <div class="grid lg:grid-cols-[minmax(0,1fr)_minmax(540px,620px)] gap-8 items-start mb-8">

        <div class="max-w-2xl">
            <h1 class="text-5xl md:text-6xl font-bold text-main mb-4">Syllabus Progress <span class="text-[#8a795d]">Tracker</span></h1>
            <p class="text-lg text-muted">Track syllabus completion, identify weak areas, and generate a customized study schedule across Prelims, Mains and Optional.</p>
        </div>
        <div class="bg-card p-6 rounded-3xl border border-theme shadow-sm w-full">
            <div class="text-[10px] font-bold text-[#8a795d] uppercase tracking-[0.25em] mb-3">How To Use This Tracker</div>
            <div class="flex flex-col lg:flex-row items-stretch gap-3">
                <div class="tracker-flow-step bg-muted border border-theme rounded-2xl p-4 flex-1">
                    <div class="text-[10px] font-bold text-[#8a795d] uppercase tracking-widest mb-2">Step 1</div>
                    <div class="text-xs font-bold text-main mb-1">Track Your Syllabus</div>
                    <div class="text-xs text-muted leading-relaxed">Choose the right mode and start marking progress stage by stage.</div>
                </div>
                <div class="text-[#8a795d] text-sm font-bold hidden lg:flex items-center px-1"><i class="fas fa-arrow-right"></i></div>
                <div class="tracker-flow-step bg-muted border border-theme rounded-2xl p-4 flex-1">
                    <div class="text-[10px] font-bold text-[#8a795d] uppercase tracking-widest mb-2">Step 2</div>
                    <div class="text-xs font-bold text-main mb-1">Read Weak Areas</div>
                    <div class="text-xs text-muted leading-relaxed">Check gaps stage-wise and identify untouched or half-finished topics.</div>
                </div>
                <div class="text-[#8a795d] text-sm font-bold hidden lg:flex items-center px-1"><i class="fas fa-arrow-right"></i></div>
                <div class="tracker-flow-step bg-muted border border-theme rounded-2xl p-4 flex-1">
                    <div class="text-[10px] font-bold text-[#8a795d] uppercase tracking-widest mb-2">Step 3</div>
                    <div class="text-xs font-bold text-main mb-1">Build The Plan</div>
                    <div class="text-xs text-muted leading-relaxed">Turn pending load and weak areas into a practical custom study plan.</div>
                </div>
            </div>
        </div>
    </div>

    <!-- Candidate Name -->
    <div class="mb-8 max-w-4xl">
        <div class="flex flex-col lg:flex-row lg:items-end gap-4">
            <div class="flex-1">
                <label class="block text-[10px] font-bold text-muted uppercase tracking-widest mb-2">Candidate Name</label>
                <input type="text" id="userNameInput" placeholder="Enter Your Name"
                    class="w-full max-w-xl bg-card border border-theme px-4 py-3 rounded-xl focus:ring-2 focus:ring-[#8a795d] outline-none text-sm font-medium text-main">
            </div>
            <div class="flex lg:pb-3">
                <button id="resetAllTrackerBtn" class="text-[10px] font-bold text-red-400 hover:text-red-600 uppercase tracking-widest">Reset All Data</button>
            </div>
        </div>
    </div>

    <!-- Level 1: Main Mode -->
    <div class="mb-10">
        <div class="text-[10px] font-bold text-muted uppercase tracking-[0.2em] mb-4 ml-1">Level 1: Main Tracker Selection</div>
        <div class="flex flex-wrap gap-6">
            <button id="mode-prelims" class="px-7 py-3.5 rounded-3xl border-2 transition font-bold text-base shadow-lg border-theme text-main">
                <i class="fas fa-graduation-cap mr-2"></i> Prelims Tracker
            </button>
            <button id="mode-mains" class="px-7 py-3.5 rounded-3xl border-2 transition font-bold text-base shadow-lg border-theme text-main">
                <i class="fas fa-pen-fancy mr-2"></i> Mains Tracker
            </button>
            <button id="mode-optional" class="px-7 py-3.5 rounded-3xl border-2 transition font-bold text-base shadow-lg border-theme text-main">
                <i class="fas fa-book-open mr-2"></i> Optional Subject Tracker
            </button>
        </div>
    </div>

    <!-- Optional Selector -->
    <div id="optionalSelectorContainer" class="mb-10 hidden">
        <div class="text-[10px] font-bold text-muted uppercase tracking-[0.2em] mb-4 ml-1">Select Your Optional Subject</div>
        <div class="flex flex-wrap gap-4" id="optionalButtonsContainer"></div>
        <p id="optionalSelectMessage" class="hidden mt-4 text-sm font-bold text-red-500">Please select your optional subject to continue tracking.</p>
    </div>

    <!-- Level 2: Syllabus Depth -->
    <div class="mb-10" id="modeSubToggles">
        <div class="text-[10px] font-bold text-muted uppercase tracking-[0.2em] mb-4 ml-1">Level 2: Syllabus Depth Mode</div>
        <div class="flex flex-wrap gap-4">
            <button id="type-standard" class="px-6 py-2.5 rounded-2xl border-2 font-bold text-sm transition border-theme text-main">Official UPSC Syllabus Mode</button>
            <button id="type-micro" class="px-6 py-2.5 rounded-2xl border-2 font-bold text-sm transition border-theme text-main">Micro-Syllabus Mode</button>
        </div>
    </div>

    <!-- Level 3: Tracking Method -->
    <div class="mb-10" id="trackingMethodToggles">
        <div class="text-[10px] font-bold text-muted uppercase tracking-[0.2em] mb-4 ml-1">Level 3: Tracking Mode</div>
        <div class="flex flex-wrap gap-4">
            <button id="method-single" class="px-6 py-2.5 rounded-2xl border-2 font-bold text-sm transition border-theme text-main">Single-Stage Tracking</button>
            <button id="method-multi" class="px-6 py-2.5 rounded-2xl border-2 font-bold text-sm transition border-theme text-main">Multi-Stage Tracking (Books / Value Addition / PYQs / Mocks / Answer Writing)</button>
        </div>
        <div class="mt-4 grid md:grid-cols-2 gap-4">
            <div class="p-3 rounded-2xl bg-muted border border-theme">
                <div class="text-[10px] font-bold text-[#8a795d] uppercase tracking-widest mb-2">Single-Stage Tracking</div>
                <p class="text-xs text-muted leading-relaxed">Use this if you want one final checkbox per topic. Best for quick progress marking.</p>
            </div>
            <div class="p-3 rounded-2xl bg-muted border border-theme">
                <div class="text-[10px] font-bold text-[#8a795d] uppercase tracking-widest mb-2">Multi-Stage Tracking</div>
                <p class="text-xs text-muted leading-relaxed">Stage-wise tracking: NCERT, PYQs, Q.Bank for Prelims; Books, Value Addition, PYQs, Answer Writing for Mains/Optional.</p>
            </div>
        </div>
    </div>

    <!-- Level 4: Action Flow + Views -->
    <div id="prelimsTrackerContent">
        <div class="mb-8">
            <div class="text-[10px] font-bold text-muted uppercase tracking-[0.2em] mb-4 ml-1">Level 4: Action Flow</div>
            <div class="flex flex-wrap items-center gap-3">
                <button id="view-subject" class="px-5 py-3 rounded-2xl text-xs font-bold transition text-white border border-[#8a795d] bg-[#8a795d] shadow-sm">Subject-wise Tracker</button>
                <div class="text-[#8a795d] text-sm font-bold"><i class="fas fa-arrow-right"></i></div>
                <button id="view-summary" class="px-5 py-3 rounded-2xl text-xs font-bold transition text-main border border-theme bg-card hover:bg-muted shadow-sm">Overall Progress Summary</button>
                <div class="text-[#8a795d] text-sm font-bold"><i class="fas fa-arrow-right"></i></div>
                <button id="view-weak" class="px-5 py-3 rounded-2xl text-xs font-bold transition text-main border border-theme bg-card hover:bg-muted shadow-sm">Weak Area Radar</button>
            </div>
        </div>

        <!-- Subject View -->
        <div id="tracker-view-subject" class="grid lg:grid-cols-4 gap-8">
            <div class="lg:col-span-1 space-y-3">
                <div class="mb-2 px-1 text-[10px] font-bold text-muted uppercase tracking-widest">Select Subject</div>
                <div id="trackerSubjectList" class="space-y-3"></div>
                <div class="mt-8">
                    <div class="px-1 text-[10px] font-bold text-muted uppercase tracking-widest mb-3">Recent Progress</div>
                    <div id="recentActivityList" class="space-y-2"></div>
                </div>
            </div>
            <div class="lg:col-span-3">
                <div class="card-premium p-8 rounded-3xl" id="subjectDetailView">
                    <div class="flex justify-between items-start mb-8">
                        <div>
                            <div id="motivationBadge" class="inline-block px-2 py-0.5 bg-muted border border-theme text-[9px] font-bold rounded mb-2 text-main"></div>
                            <h2 id="activeSubjectTitle" class="text-3xl font-bold text-main">Select a Subject</h2>
                            <p id="modeDescription" class="text-sm text-muted mt-1">Syllabus checkpoints</p>
                        </div>
                        <div class="text-right">
                            <div id="subjectPercentage" class="text-4xl font-bold text-[#8a795d]">0%</div>
                            <div class="text-[10px] font-bold text-muted uppercase tracking-widest mt-1">Completion</div>
                        </div>
                    </div>
                    <div style="display:grid;grid-template-columns:3fr 2fr;gap:2rem;align-items:start">
                        <div style="min-width:0;overflow:hidden">
                            <div id="topicChecklist" style="max-height:600px;overflow-y:auto;overflow-x:hidden"></div>
                        </div>
                        <div class="flex flex-col items-center justify-start border-l border-theme pl-8">
                            <div class="w-full max-w-[220px] relative">
                                <canvas id="subjectDoughnut"></canvas>
                                <div id="subjectChartPercent" class="absolute inset-0 flex items-center justify-center text-2xl font-bold text-[#8a795d] pointer-events-none">0%</div>
                            </div>
                            <div class="mt-8 w-full">
                                <div class="flex justify-between text-xs font-bold mb-2 text-main">
                                    <span>Linear Progress</span>
                                    <span id="progressBarText">0/0 Topics</span>
                                </div>
                                <div class="h-2 w-full bg-muted rounded-full overflow-hidden border border-theme">
                                    <div id="subjectProgressBar" class="h-full bg-[#8a795d] transition-all duration-700" style="width: 0%"></div>
                                </div>
                            </div>
                            <div class="w-full mt-10 p-4 bg-muted rounded-2xl border border-theme">
                                <div class="text-[10px] font-bold text-[#8a795d] uppercase mb-2">Personal Insight</div>
                                <p id="subjectSmartNote" class="text-xs text-muted leading-relaxed italic">Select topics to see your progress analysis.</p>
                            </div>
                            <div class="w-full mt-4 p-4 bg-card rounded-2xl border border-theme">
                                <div class="flex items-center justify-between mb-3">
                                    <div class="text-[10px] font-bold text-[#8a795d] uppercase tracking-widest">Weak Areas</div>
                                    <div id="weakAreaCount" class="text-[10px] font-bold text-muted uppercase">0 flagged</div>
                                </div>
                                <div id="weakAreaList" class="space-y-2"></div>
                            </div>
                            <div class="mt-auto pt-10 w-full flex flex-col gap-3">
                                <button id="resetSubjectProgressBtn" class="w-full py-2 text-xs font-bold text-muted hover:text-red-500 transition">Reset Subject Progress</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Summary View -->
        <div id="tracker-view-summary" class="hidden">
            <div class="card-premium p-10 rounded-[40px] bg-card border-2 border-theme">
                <div class="grid lg:grid-cols-2 gap-16 items-center">
                    <div>
                        <h3 class="text-4xl font-bold text-main mb-6">Preparation Intelligence</h3>
                        <div class="grid grid-cols-2 gap-6 mb-10">
                            <div class="bg-muted p-6 rounded-3xl border border-theme">
                                <div class="text-[10px] font-bold text-[#8a795d] uppercase tracking-widest mb-1">Total Units</div>
                                <div id="overallTotalTopics" class="text-3xl font-bold text-main">0</div>
                            </div>
                            <div class="bg-green-50 dark:bg-green-900 p-6 rounded-3xl border border-green-100 dark:border-green-800">
                                <div class="text-[10px] font-bold text-green-600 dark:text-green-400 uppercase tracking-widest mb-1">Completed Topics</div>
                                <div id="overallCompletedTopics" class="text-3xl font-bold text-main">0</div>
                            </div>
                        </div>
                        <p class="text-muted leading-relaxed mb-8">This meta-analysis covers the entire syllabus structure in your current mode.</p>
                        <div class="p-6 bg-[#2d3a3a] text-white rounded-3xl flex items-center justify-between border border-theme">
                            <div>
                                <div class="text-[10px] font-bold opacity-60 uppercase tracking-widest mb-1">Aggregate Efficiency</div>
                                <div id="overallAvgPercent" class="text-4xl font-bold text-[#8a795d]">0%</div>
                            </div>
                            <div class="w-16 h-16 border-4 border-[#8a795d] rounded-full flex items-center justify-center">
                                <i class="fas fa-chart-line text-xl text-[#8a795d]"></i>
                            </div>
                        </div>
                    </div>
                    <div class="flex justify-center">
                        <div class="w-full max-w-[400px] relative">
                            <canvas id="overallDoughnut"></canvas>
                            <div id="overallChartPercent" class="absolute inset-0 flex items-center justify-center text-3xl font-bold text-[#8a795d] pointer-events-none">0%</div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="mt-8">
                <div class="card-premium p-8 rounded-[32px] border border-theme">
                    <h4 class="text-2xl font-bold text-main mb-2">Subject Progress Summary</h4>
                    <p class="text-sm text-muted mt-1 mb-6">First overall statistics, then subject-wise completion in one combined section.</p>
                    <div id="tracker-summary-grid" class="grid sm:grid-cols-2 lg:grid-cols-4 gap-6"></div>
                </div>
            </div>
        </div>

        <!-- Weak Area Radar View -->
        <div id="tracker-view-weak" class="hidden">
            <div id="trackerWeakAreasPanel" class="card-premium p-8 rounded-[32px] border border-theme">
                <div class="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6 mb-8">
                    <div>
                        <h4 class="text-3xl font-bold text-main">Weak Area Radar</h4>
                        <p class="text-sm text-muted mt-2">Review weak areas by exam stage and by the definition you want to apply.</p>
                    </div>
                    <div id="overallWeakAreaCount" class="text-[10px] font-bold text-[#8a795d] uppercase tracking-widest">0 flagged</div>
                </div>
                <div class="grid lg:grid-cols-2 gap-6 mb-8">
                    <div>
                        <div class="text-[10px] font-bold text-muted uppercase tracking-widest mb-3">Choose Exam Stage</div>
                        <div id="weakAreaModeFilters" class="flex flex-wrap gap-3"></div>
                    </div>
                    <div>
                        <div class="text-[10px] font-bold text-muted uppercase tracking-widest mb-3">How To Decide Weak Area</div>
                        <div id="weakAreaBasisFilters" class="flex flex-wrap gap-3"></div>
                    </div>
                </div>
                <div id="weakAreaIntro" class="mb-6 p-5 rounded-3xl bg-muted border border-theme text-sm text-muted"></div>
                <div id="overallWeakAreaList" class="space-y-3 overflow-x-auto"></div>
            </div>
        </div>
    </div>

</div>`;
}

function calculateOverallStats() {
    const stats = {
        prelims: { total: 0, completed: 0, percent: 0 },
        mains: { total: 0, completed: 0, percent: 0 },
        optional: { total: 0, completed: 0, percent: 0 },
        totalPercent: 0
    };

    // Calculate Prelims
    Object.keys(STANDARD_SYLLABUS).forEach(sub => {
        const topics = STANDARD_SYLLABUS[sub];
        stats.prelims.total += topics.length;
        topics.forEach(t => {
            if (progressData.prelims?.[sub]?.[t]?.qbank) stats.prelims.completed++;
        });
    });
    stats.prelims.percent = Math.round((stats.prelims.completed / Math.max(1, stats.prelims.total)) * 100);

    // Calculate Mains
    const mainsSubjects = ['GS1', 'GS2', 'GS3', 'GS4', 'Essay'];
    mainsSubjects.forEach(sub => {
        const topics = MAINS_SYLLABUS[sub] || [];
        const total = topics.length > 0 ? topics.length : 20; // use actual topics if available
        stats.mains.total += total;
        
        topics.forEach(t => {
            if (progressData.mains?.[sub]?.[t]?.ansWriting) stats.mains.completed++;
        });
    });
    stats.mains.percent = Math.round((stats.mains.completed / Math.max(1, stats.mains.total)) * 100);

    stats.totalPercent = Math.round((stats.prelims.percent + stats.mains.percent) / 2);
    return stats;
}

function renderComprehensiveReport() {
    const container = document.getElementById('tracker-report-container');
    if (!container) return;
    
    const stats = calculateOverallStats();
    const userName = localStorage.getItem('upsc_vault_user_name') || 'Candidate';

    container.innerHTML = `
        <div class="card-premium p-10 rounded-[40px] border border-theme bg-white shadow-2xl animate-fade-in">
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10 border-b border-theme pb-8">
                <div>
                    <p class="text-[10px] font-extrabold text-[#8a795d] uppercase tracking-[0.3em] mb-2">Performance Audit</p>
                    <h2 class="text-4xl font-black text-main">${userName}'s Progress <span class="text-[#8a795d]">Report</span></h2>
                </div>
                <div class="text-right">
                    <div class="text-5xl font-black text-[#8a795d]">${stats.totalPercent}%</div>
                    <p class="text-[10px] font-bold text-muted uppercase tracking-widest mt-1">Total Readiness</p>
                </div>
            </div>

            <div class="grid md:grid-cols-2 gap-12 mb-12">
                <div class="space-y-8">
                    <h4 class="text-xl font-bold text-main flex items-center gap-3">
                        <i class="fas fa-chart-line text-[#8a795d]"></i> 
                        Stage-wise Breakdown
                    </h4>
                    
                    <div class="space-y-6">
                        <div>
                            <div class="flex justify-between items-end mb-2">
                                <span class="text-sm font-bold text-main">Prelims Completion</span>
                                <span class="text-sm font-bold text-[#8a795d]">${stats.prelims.percent}%</span>
                            </div>
                            <div class="h-3 bg-muted rounded-full overflow-hidden border border-theme">
                                <div class="h-full bg-[#8a795d] rounded-full transition-all duration-1000" style="width: ${stats.prelims.percent}%"></div>
                            </div>
                        </div>

                        <div>
                            <div class="flex justify-between items-end mb-2">
                                <span class="text-sm font-bold text-main">Mains Completion</span>
                                <span class="text-sm font-bold text-[#8a795d]">${stats.mains.percent}%</span>
                            </div>
                            <div class="h-3 bg-muted rounded-full overflow-hidden border border-theme">
                                <div class="h-full bg-[#C59B6D] rounded-full transition-all duration-1000" style="width: ${stats.mains.percent}%"></div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="p-8 rounded-[32px] bg-muted border border-theme">
                    <h4 class="text-lg font-bold text-main mb-4">Strategic Insights</h4>
                    <p class="text-sm text-muted leading-relaxed mb-4">
                        Based on your current progress, your focus should be on <strong>Untouched Topics</strong> in the Prelims section.
                    </p>
                    <div class="p-4 rounded-2xl bg-white border border-theme shadow-sm">
                        <div class="text-[10px] font-bold text-[#8a795d] uppercase tracking-widest mb-1">Recommended Action</div>
                        <div class="text-xs font-bold text-main">Complete Environment & Economy micro-topics.</div>
                    </div>
                </div>
            </div>

            <div class="flex justify-center border-t border-theme pt-10">
                <button onclick="window.print()" class="px-10 py-4 rounded-3xl bg-main text-white font-black text-sm uppercase tracking-widest shadow-xl hover:scale-105 transition">
                    <i class="fas fa-print mr-2"></i> Download Full Audit PDF
                </button>
            </div>
        </div>
    `;
}


// ─── Event Binding (called after renderTracker() is injected) ──────

export function bindTrackerEvents() {
    const page = document.getElementById('trackerPage');
    if (!page) return;

    // Restore name
    const userName = localStorage.getItem('upsc_vault_user_name') || '';
    const uInput = document.getElementById('userNameInput');
    if (uInput) {
        uInput.value = userName;
        uInput.addEventListener('input', (e) => {
            localStorage.setItem('upsc_vault_user_name', e.target.value.replace(/^\s+/, ''));
        });
    }

    // Mode buttons
    document.getElementById('mode-prelims')?.addEventListener('click', () => {
        document.getElementById('tracker-main-container')?.classList.remove('hidden');
        document.getElementById('tracker-report-container')?.classList.add('hidden');
        setTrackerMainMode('prelims');
    });
    document.getElementById('mode-mains')?.addEventListener('click', () => {
        document.getElementById('tracker-main-container')?.classList.remove('hidden');
        document.getElementById('tracker-report-container')?.classList.add('hidden');
        setTrackerMainMode('mains');
    });
    document.getElementById('mode-optional')?.addEventListener('click', () => {
        document.getElementById('tracker-main-container')?.classList.remove('hidden');
        document.getElementById('tracker-report-container')?.classList.add('hidden');
        setTrackerMainMode('optional');
    });

    document.getElementById('nav-report-main')?.addEventListener('click', () => {
        document.getElementById('tracker-main-container')?.classList.add('hidden');
        document.getElementById('tracker-report-container')?.classList.remove('hidden');
        renderComprehensiveReport();
        
        // Update button styles
        document.getElementById('nav-tracker-main').className = 'px-6 py-2.5 rounded-2xl bg-muted text-muted font-bold text-sm border-2 border-theme hover:bg-card hover:text-main transition';
        document.getElementById('nav-report-main').className = 'px-6 py-2.5 rounded-2xl bg-[#8a795d] text-white font-bold text-sm border-2 border-[#8a795d] shadow-sm';
    });

    document.getElementById('nav-tracker-main')?.addEventListener('click', () => {
        document.getElementById('tracker-main-container')?.classList.remove('hidden');
        document.getElementById('tracker-report-container')?.classList.add('hidden');
        
        // Update button styles
        document.getElementById('nav-tracker-main').className = 'px-6 py-2.5 rounded-2xl bg-[#8a795d] text-white font-bold text-sm border-2 border-[#8a795d] shadow-sm';
        document.getElementById('nav-report-main').className = 'px-6 py-2.5 rounded-2xl bg-muted text-muted font-bold text-sm border-2 border-theme hover:bg-card hover:text-main transition';
    });

    // Type buttons
    document.getElementById('type-standard')?.addEventListener('click', () => setTrackerType('standard'));
    document.getElementById('type-micro')?.addEventListener('click', () => setTrackerType('micro'));

    // Method buttons
    document.getElementById('method-single')?.addEventListener('click', () => setTrackingMethod('single'));
    document.getElementById('method-multi')?.addEventListener('click', () => setTrackingMethod('multi'));

    // View buttons
    document.getElementById('view-subject')?.addEventListener('click', () => setTrackerView('subject'));
    document.getElementById('view-summary')?.addEventListener('click', () => setTrackerView('summary'));
    document.getElementById('view-weak')?.addEventListener('click', () => setTrackerView('weak'));

    // Reset buttons
    document.getElementById('resetAllTrackerBtn')?.addEventListener('click', confirmResetTracker);
    document.getElementById('resetSubjectProgressBtn')?.addEventListener('click', confirmResetSubject);

    // Init tracker state
    setTrackerMainMode(trackerMainMode);
    setTrackingMethod(trackingMethod);
    renderRecentActivity();
}

// ─── Mode / Type / Method Setters ─────────────────────────────────

function setTrackerMainMode(mode) {
    trackerMainMode = mode;
    weakAreaPreviewMode = mode;
    localStorage.setItem('upsc_tracker_main_mode', mode);

    const pBtn = document.getElementById('mode-prelims');
    const mBtn = document.getElementById('mode-mains');
    const oBtn = document.getElementById('mode-optional');
    const modeSubToggles = document.getElementById('modeSubToggles');
    const activeClass = 'px-7 py-3.5 rounded-3xl border-2 border-[#2d3a3a] bg-[#2d3a3a] text-white text-base font-bold transition shadow-lg';
    const inactiveClass = 'px-7 py-3.5 rounded-3xl border-2 border-theme bg-card text-muted hover:text-main text-base font-bold hover:bg-muted transition';

    if (pBtn) pBtn.className = mode === 'prelims' ? activeClass : inactiveClass;
    if (mBtn) mBtn.className = mode === 'mains' ? activeClass : inactiveClass;
    if (oBtn) oBtn.className = mode === 'optional' ? activeClass : inactiveClass;

    renderOptionalSelector();

    if (mode === 'prelims') {
        modeSubToggles?.classList.remove('hidden');
        document.getElementById('prelimsTrackerContent')?.classList.remove('hidden');
        document.getElementById('trackingMethodToggles')?.classList.remove('hidden');
        activeSubject = PRELIMS_SUBJECTS[0];
        const desc = document.getElementById('modeDescription');
        if (desc) desc.innerText = 'Syllabus checkpoints';
        setTrackerType(trackerMode);
    } else if (mode === 'mains') {
        modeSubToggles?.classList.add('hidden');
        document.getElementById('prelimsTrackerContent')?.classList.remove('hidden');
        document.getElementById('trackingMethodToggles')?.classList.remove('hidden');
        activeSubject = 'GS1';
        const desc = document.getElementById('modeDescription');
        if (desc) desc.innerText = 'Full UPSC Mains Subject Tracking';
        renderTrackerSubjects();
        setTrackerSubject(activeSubject);
    } else {
        modeSubToggles?.classList.add('hidden');
        if (!getSelectedOptional()) {
            document.getElementById('prelimsTrackerContent')?.classList.add('hidden');
            document.getElementById('trackingMethodToggles')?.classList.add('hidden');
            return;
        }
        document.getElementById('prelimsTrackerContent')?.classList.remove('hidden');
        document.getElementById('trackingMethodToggles')?.classList.remove('hidden');
        activeSubject = getSelectedOptional();
        const desc = document.getElementById('modeDescription');
        if (desc) desc.innerText = 'UPSC Optional Tracking (Paper 1 & 2)';
        renderTrackerSubjects();
        setTrackerSubject(activeSubject);
    }

    renderOverallWeakAreas();
}

function setTrackerType(type) {
    trackerMode = type;
    localStorage.setItem('upsc_tracker_mode', type);

    const stdBtn = document.getElementById('type-standard');
    const micBtn = document.getElementById('type-micro');
    const activeClass = 'px-8 py-3 rounded-2xl border-2 border-[#2d3a3a] bg-[#2d3a3a] text-white text-sm font-bold transition shadow-lg';
    const inactiveClass = 'px-8 py-3 rounded-2xl bg-card text-muted hover:text-main text-sm font-bold border-2 border-theme transition';
    if (stdBtn) stdBtn.className = type === 'standard' ? activeClass : inactiveClass;
    if (micBtn) micBtn.className = type === 'micro' ? activeClass : inactiveClass;

    renderTrackerSubjects();
    setTrackerSubject(activeSubject);
}

function setTrackingMethod(method) {
    trackingMethod = method;
    localStorage.setItem('upsc_tracking_method', method);

    const singleBtn = document.getElementById('method-single');
    const multiBtn = document.getElementById('method-multi');
    const activeClass = 'px-8 py-3 rounded-2xl border-2 border-[#2d3a3a] bg-[#2d3a3a] text-white text-sm font-bold transition shadow-lg';
    const inactiveClass = 'px-8 py-3 rounded-2xl bg-card text-muted hover:text-main text-sm font-bold border-2 border-theme transition';
    if (singleBtn) singleBtn.className = method === 'single' ? activeClass : inactiveClass;
    if (multiBtn) multiBtn.className = method === 'multi' ? activeClass : inactiveClass;

    saveAndRefresh();
}

function setTrackerView(view) {
    trackerViewState = view;
    ['subject', 'summary', 'weak'].forEach(v => {
        const el = document.getElementById(`tracker-view-${v}`);
        const btn = document.getElementById(`view-${v}`);
        if (!el || !btn) return;
        if (v === view) {
            el.classList.remove('hidden');
            btn.className = 'px-5 py-3 rounded-2xl bg-[#8a795d] text-white shadow-sm text-xs font-bold transition border border-[#8a795d]';
        } else {
            el.classList.add('hidden');
            btn.className = 'px-5 py-3 rounded-2xl text-main border border-theme bg-card hover:bg-muted shadow-sm text-xs font-bold transition';
        }
    });

    if (view === 'summary') { renderProgressSummary(); updateOverallStats(); }
    if (view === 'weak') renderOverallWeakAreas();
}

// ─── Optional Selector ─────────────────────────────────────────────

function renderOptionalSelector() {
    const container = document.getElementById('optionalSelectorContainer');
    const msg = document.getElementById('optionalSelectMessage');
    if (!container) return;

    if (trackerMainMode !== 'optional') { container.classList.add('hidden'); return; }
    container.classList.remove('hidden');

    const selected = getSelectedOptional();
    if (!selected) msg?.classList.remove('hidden'); else msg?.classList.add('hidden');

    const btnContainer = document.getElementById('optionalButtonsContainer');
    if (btnContainer) {
        btnContainer.innerHTML = OPTIONAL_SUBJECTS.map(opt => `
            <button data-optional="${opt}" class="optional-select-btn px-8 py-3 rounded-2xl border-2 font-bold transition text-sm ${selected === opt ? 'bg-[#8a795d] text-white border-[#8a795d]' : 'bg-card border-theme text-main hover:bg-muted'}">
                ${opt}
            </button>
        `).join('');
        btnContainer.querySelectorAll('.optional-select-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                localStorage.setItem('upsc_selected_optional', btn.dataset.optional);
                renderOptionalSelector();
                setTrackerMainMode('optional');
            });
        });
    }
}

// ─── Subject List ─────────────────────────────────────────────────

function renderTrackerSubjects() {
    const list = document.getElementById('trackerSubjectList');
    if (!list) return;
    const subjects = getCurrentSubjects();
    const masteredSubs = JSON.parse(localStorage.getItem('upsc_mastered_subjects') || '[]');

    list.innerHTML = subjects.map(sub => {
        const stats = getSubjectStats(sub);
        const isMastered = masteredSubs.includes(sub);
        const badge = isMastered ? '<span class="ml-2 text-sm">🥇</span>' : '';
        return `<button data-subject="${sub}" class="tracker-subject-card w-full p-4 rounded-2xl border bg-card flex justify-between items-center transition ${activeSubject === sub ? 'active border-[#8a795d]' : 'border-theme'}">
            <div class="text-left">
                <div class="text-xs font-bold text-main">${sub}${badge}</div>
                <div class="text-[10px] text-muted mt-1">${stats.completed}/${stats.total} Topics</div>
            </div>
            <div class="text-xs font-bold text-[#8a795d]">${stats.percent}%</div>
        </button>`;
    }).join('');

    list.querySelectorAll('.tracker-subject-card').forEach(btn => {
        btn.addEventListener('click', () => setTrackerSubject(btn.dataset.subject));
    });
}

function setTrackerSubject(sub) {
    activeSubject = sub;
    const titleEl = document.getElementById('activeSubjectTitle');
    if (titleEl) titleEl.innerText = sub;
    renderTrackerSubjects();
    renderTopicChecklist();
    updateSubjectView();
}

// ─── Topic Checklist Rendering ─────────────────────────────────────

function renderTopicChecklist() {
    const container = document.getElementById('topicChecklist');
    if (!container) return;

    const modeKey = getModeKey();
    const completed = progressData[modeKey]?.[activeSubject] || {};

    if (trackerMainMode === 'mains') {
        const source = MAINS_SYLLABUS[activeSubject];
        if (!source) { container.innerHTML = '<p class="text-xs text-muted">No syllabus data for this subject.</p>'; return; }
        container.innerHTML = renderMainsNode(source, '', completed, 0);
    } else if (trackerMainMode === 'optional') {
        const selected = getSelectedOptional();
        const source = OPTIONAL_SYLLABUS_STRUCTURED[selected];
        if (!source) { container.innerHTML = '<p class="text-xs text-muted">No syllabus data for this subject.</p>'; return; }
        container.innerHTML = renderOptionalNode(source, selected, completed, 0);
    } else {
        const source = STANDARD_SYLLABUS[activeSubject] || [];
        container.innerHTML = source.map(topic => renderCheckboxItem(topic, completed[topic], 0, topic)).join('');
    }

    // Bind new checkboxes
    container.querySelectorAll('[data-tracker-path]').forEach(el => {
        el.addEventListener('change', (e) => {
            const path = e.target.dataset.trackerPath;
            const stage = e.target.dataset.trackerStage || 'single';
            toggleTrackerItem(activeSubject, path, stage, e.target);
        });
    });

    // Bind accordion toggles
    container.querySelectorAll('[data-accordion-id]').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.accordionId;
            const panel = document.getElementById(id);
            if (!panel) return;
            panel.classList.toggle('hidden');
            const icon = btn.querySelector('.fa-chevron-down');
            if (icon) icon.classList.toggle('rotate-180');
        });
    });
}

function renderMainsNode(node, basePath, completed, depth) {
    let html = '';
    Object.entries(node).forEach(([label, child]) => {
        const nextPath = basePath ? `${basePath}.${label}` : label;
        const safeId = `mains-${activeSubject}-${nextPath}`.replace(/\W+/g, '-');

        if (Array.isArray(child)) {
            const allChecked = child.length > 0 && child.every(topic => {
                const state = completed[`${activeSubject}.${nextPath}.${topic}`] || {};
                return trackingMethod === 'single' ? state.ansWriting : (state.books && state.valueAddition && state.pyqs && state.ansWriting);
            });
            html += `<div class="mb-2">
                <div class="flex items-center gap-3 p-3 bg-muted rounded-xl border border-theme">
                    <input type="checkbox" data-tracker-path="${activeSubject}.${nextPath}" data-tracker-stage="group" data-tracker-children='${JSON.stringify(child.map(t => `${activeSubject}.${nextPath}.${t}`))}' class="custom-checkbox cb-single" ${allChecked ? 'checked' : ''}>
                    <button type="button" data-accordion-id="${safeId}" class="flex-1 flex items-center justify-between text-left">
                        <span class="text-xs font-bold uppercase tracking-wider text-muted">${label}</span>
                        <i class="fas fa-chevron-down text-muted text-[10px] transition-transform duration-300"></i>
                    </button>
                </div>
                <div id="${safeId}" class="hidden pl-2 border-l-2 border-theme ml-2 mb-4 pt-2">
                    ${child.map(topic => renderCheckboxItem(topic, completed[`${activeSubject}.${nextPath}.${topic}`], depth + 1, `${activeSubject}.${nextPath}.${topic}`)).join('')}
                </div>
            </div>`;
            return;
        }

        html += `<button type="button" data-accordion-id="${safeId}" class="w-full flex justify-between items-center p-3 bg-card border border-theme rounded-xl mb-1 mt-2 text-main hover:border-[#8a795d] transition">
            <span class="text-xs font-bold uppercase tracking-wider ${depth === 0 ? 'text-main' : 'text-[#8a795d]'}">${label}</span>
            <i class="fas fa-chevron-down text-muted text-[10px] transition-transform duration-300"></i>
        </button>
        <div id="${safeId}" class="hidden pl-2 border-l-2 border-theme ml-2 mb-4 pt-2">
            ${renderMainsNode(child, nextPath, completed, depth + 1)}
        </div>`;
    });
    return html;
}

function renderOptionalNode(node, basePath, completed, depth) {
    let html = '';
    Object.entries(node).forEach(([label, child]) => {
        const nextPath = `${basePath}.${label}`;
        const safeId = `opt-${nextPath}`.replace(/\W+/g, '-');

        if (Array.isArray(child)) {
            html += `<div class="mb-2">
                <div class="flex items-center gap-3 p-${depth === 0 ? '4' : '3'} bg-card border border-theme rounded-2xl mb-${depth === 0 ? '2 mt-4' : '1'} text-main hover:border-[#8a795d] transition">
                    <span class="text-${depth === 0 ? 'sm' : 'xs'} font-bold ${depth === 0 ? 'uppercase tracking-wider' : ''}">${label}</span>
                    <button type="button" data-accordion-id="${safeId}" class="ml-auto shrink-0 w-8 h-8 rounded-lg border border-theme bg-card flex items-center justify-center">
                        <i class="fas fa-chevron-down text-[10px] transition-transform duration-300"></i>
                    </button>
                </div>
                <div id="${safeId}" class="${depth === 0 ? '' : 'hidden'} pl-2 border-l-2 border-theme ml-2 mb-4 pt-2">
                    ${child.map(topic => renderCheckboxItem(topic, completed[`${nextPath}.${topic}`], depth, `${nextPath}.${topic}`)).join('')}
                </div>
            </div>`;
            return;
        }

        html += `<button type="button" data-accordion-id="${safeId}" class="w-full flex justify-between items-center p-4 bg-card border border-theme rounded-2xl mb-2 mt-4 text-main hover:border-[#8a795d] transition">
            <span class="text-sm font-bold uppercase tracking-wider">${label}</span>
            <i class="fas fa-chevron-down text-[10px] transition-transform duration-300"></i>
        </button>
        <div id="${safeId}" class="pl-2 border-l-2 border-theme ml-2 mb-4 pt-2">
            ${renderOptionalNode(child, nextPath, completed, depth + 1)}
        </div>`;
    });
    return html;
}

function renderCheckboxItem(label, itemState, level, fullPath) {
    itemState = itemState || { ncert: false, pyqs: false, books: false, ansWriting: false, qbank: false, valueAddition: false };

    if (trackingMethod === 'single') {
        const isChecked = trackerMainMode === 'prelims' ? itemState.qbank : itemState.ansWriting;
        return `<div class="tracker-item-row" style="display:grid;grid-template-columns:30px 1fr;gap:12px;padding:14px 12px;border-bottom:1px solid var(--border-theme);margin-left:${level * 16}px;align-items:center;background:var(--card-bg);transition:background 0.2s">
            <input type="checkbox" data-tracker-path="${fullPath}" data-tracker-stage="single" class="custom-checkbox cb-single" style="margin:0;cursor:pointer" ${isChecked ? 'checked' : ''}>
            <span class="tracker-topic-label" style="font-size:13px;font-weight:700;color:var(--text) !important;line-height:1.5;display:block;cursor:default">${label}</span>
        </div>`;
    } else {
        if (trackerMainMode === 'mains' || trackerMainMode === 'optional') {
            return `<div class="flex items-center justify-between p-4 micro-topic-item border-b border-theme last:border-0 hover:bg-muted transition" style="margin-left: ${level * 16}px; gap: 1rem;">
                <span class="text-[13px] font-bold text-[var(--text)] leading-relaxed flex-grow pr-4">${label}</span>
                <div class="flex gap-4 items-center shrink-0">
                    <label class="flex flex-col items-center gap-1 cursor-pointer"><span class="text-[8px] font-bold text-blue-500 tracking-widest">Syllabus</span><input type="checkbox" data-tracker-path="${fullPath}" data-tracker-stage="books" class="custom-checkbox cb-books" ${itemState.books ? 'checked' : ''}></label>
                    <label class="flex flex-col items-center gap-1 cursor-pointer"><span class="text-[8px] font-bold text-yellow-500 tracking-widest">Value Add</span><input type="checkbox" data-tracker-path="${fullPath}" data-tracker-stage="valueAddition" class="custom-checkbox cb-valueAddition" ${itemState.valueAddition ? 'checked' : ''}></label>
                    <label class="flex flex-col items-center gap-1 cursor-pointer"><span class="text-[8px] font-bold text-orange-500 tracking-widest">PYQs</span><input type="checkbox" data-tracker-path="${fullPath}" data-tracker-stage="pyqs" class="custom-checkbox cb-pyqs" ${itemState.pyqs ? 'checked' : ''}></label>
                    <label class="flex flex-col items-center gap-1 cursor-pointer"><span class="text-[8px] font-bold text-cyan-500 tracking-widest">Ans Writing</span><input type="checkbox" data-tracker-path="${fullPath}" data-tracker-stage="ansWriting" class="custom-checkbox cb-ansWriting" ${itemState.ansWriting ? 'checked' : ''}></label>
                </div>
            </div>`;
        } else {
            return `<div class="flex items-center justify-between p-4 micro-topic-item border-b border-theme last:border-0 hover:bg-muted transition" style="margin-left: ${level * 16}px; gap: 1rem;">
                <span class="text-[13px] font-bold text-[var(--text)] leading-relaxed flex-grow pr-4">${label}</span>
                <div class="flex gap-4 items-center shrink-0">
                    <label class="flex flex-col items-center gap-1 cursor-pointer"><span class="text-[8px] font-bold text-blue-500 tracking-widest">NCERT</span><input type="checkbox" data-tracker-path="${fullPath}" data-tracker-stage="ncert" class="custom-checkbox cb-ncert" ${itemState.ncert ? 'checked' : ''}></label>
                    <label class="flex flex-col items-center gap-1 cursor-pointer"><span class="text-[8px] font-bold text-orange-500 tracking-widest">PYQs</span><input type="checkbox" data-tracker-path="${fullPath}" data-tracker-stage="pyqs" class="custom-checkbox cb-pyqs" ${itemState.pyqs ? 'checked' : ''}></label>
                    <label class="flex flex-col items-center gap-1 cursor-pointer"><span class="text-[8px] font-bold text-purple-500 tracking-widest">Q.Bank / Mocks</span><input type="checkbox" data-tracker-path="${fullPath}" data-tracker-stage="qbank" class="custom-checkbox cb-qbank" ${itemState.qbank ? 'checked' : ''}></label>
                </div>
            </div>`;
        }
    }
}

// ─── Toggle Logic ─────────────────────────────────────────────────

function toggleTrackerItem(sub, path, stage, el) {
    const isChecked = el.checked;
    const modeKey = getModeKey();
    if (!progressData[modeKey]) progressData[modeKey] = {};
    if (!progressData[modeKey][sub]) progressData[modeKey][sub] = {};

    let state = progressData[modeKey][sub][path] || { ncert: false, pyqs: false, books: false, ansWriting: false, qbank: false, valueAddition: false };

    if (stage === 'single') {
        state = { ncert: isChecked, pyqs: isChecked, books: isChecked, ansWriting: isChecked, qbank: isChecked, valueAddition: isChecked };
    } else if (stage === 'group') {
        // handled via group checkbox — toggle all children
        const childPaths = JSON.parse(el.dataset.trackerChildren || '[]');
        childPaths.forEach(childPath => {
            const childState = { ncert: isChecked, pyqs: isChecked, books: isChecked, ansWriting: isChecked, qbank: isChecked, valueAddition: isChecked };
            progressData[modeKey][sub][childPath] = childState;
            syncDOMCheckboxes(childPath, childState);
        });
        addToRecent(`${path.split('.').pop()} (Section)`);
        saveLocal();
        scheduleSyncToSupabase();
        updateSubjectView();
        renderTrackerSubjects();
        return;
    } else {
        state[stage] = isChecked;
        if (stage === 'qbank' && isChecked && trackerMainMode === 'prelims') state.ncert = true;
    }

    progressData[modeKey][sub][path] = state;
    addToRecent(path.split('.').pop());
    syncDOMCheckboxes(path, state);
    saveAndRefresh(true); // true = skip checklist re-render (already in DOM)
}

function syncDOMCheckboxes(path, state) {
    document.querySelectorAll(`[data-tracker-path="${path}"]`).forEach(inp => {
        if (inp.classList.contains('cb-single')) inp.checked = trackerMainMode === 'prelims' ? state.qbank : state.ansWriting;
        else if (inp.classList.contains('cb-ncert')) inp.checked = state.ncert;
        else if (inp.classList.contains('cb-pyqs')) inp.checked = state.pyqs;
        else if (inp.classList.contains('cb-qbank')) inp.checked = state.qbank;
        else if (inp.classList.contains('cb-books')) inp.checked = state.books;
        else if (inp.classList.contains('cb-valueAddition')) inp.checked = state.valueAddition;
        else if (inp.classList.contains('cb-ansWriting')) inp.checked = state.ansWriting;
    });
}

function saveAndRefresh(skipChecklistRender = false) {
    saveLocal();
    scheduleSyncToSupabase();
    updateSubjectView();
    renderTrackerSubjects();
    if (!skipChecklistRender) renderTopicChecklist();
}

// ─── Subject View Update (stats + chart) ─────────────────────────

function updateSubjectView() {
    const stats = getSubjectStats(activeSubject);

    const pText = document.getElementById('subjectPercentage');
    const bText = document.getElementById('progressBarText');
    const bar = document.getElementById('subjectProgressBar');
    const chartPercent = document.getElementById('subjectChartPercent');

    if (pText) pText.innerText = `${stats.percent}%`;
    if (bText) bText.innerText = `${stats.completed}/${stats.total} Topics`;
    if (bar) bar.style.width = `${stats.percent}%`;
    if (chartPercent) chartPercent.innerText = `${stats.percent}%`;

    subjectChart = upsertDoughnutChart(subjectChart, 'subjectDoughnut', stats.rawScore, stats.total, '80%');

    let insight = '';
    if (stats.percent <= 20) insight = 'Just starting out. Focus on grasping core concepts before jumping to heavy books.';
    else if (stats.percent <= 60) insight = 'Halfway there. Start topic-wise tests to align preparation with UPSC demand.';
    else if (stats.percent < 100) insight = 'Excellent coverage. Focus on mock tests, answer writing, and current affairs integration.';
    else insight = 'Outstanding! You have mastered this subject. Keep revising via full-length mock tests.';

    const insightEl = document.getElementById('subjectSmartNote');
    if (insightEl) insightEl.innerText = insight;

    renderSubjectWeakAreas();

    // Award mastery
    let masteredSubs = JSON.parse(localStorage.getItem('upsc_mastered_subjects') || '[]');
    if (stats.percent === 100 && stats.total > 0) {
        if (!masteredSubs.includes(activeSubject)) {
            masteredSubs.push(activeSubject);
            localStorage.setItem('upsc_mastered_subjects', JSON.stringify(masteredSubs));
            if (window.confetti) confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
            renderTrackerSubjects();
        }
    } else {
        if (masteredSubs.includes(activeSubject)) {
            masteredSubs = masteredSubs.filter(s => s !== activeSubject);
            localStorage.setItem('upsc_mastered_subjects', JSON.stringify(masteredSubs));
            renderTrackerSubjects();
        }
    }
}

// ─── Weak Areas ────────────────────────────────────────────────────

function getWeakAreasForSubject(sub, limit = 8) {
    const modeKey = getModeKey();
    const subData = progressData[modeKey]?.[sub] || {};
    const entries = getSyllabusLeafEntries(sub);
    const weakAreas = [];

    entries.forEach(entry => {
        const state = subData[entry.path] || {};
        if (trackerMainMode === 'prelims') {
            if (state.ncert && (!state.pyqs || !state.qbank)) {
                const pending = [];
                if (!state.pyqs) pending.push('PYQs');
                if (!state.qbank) pending.push('Q.Bank / Mocks');
                weakAreas.push({ ...entry, pending });
            }
            return;
        }
        if (state.books && (!state.ansWriting || !state.pyqs || !state.valueAddition)) {
            const pending = [];
            if (!state.pyqs) pending.push('PYQs');
            if (!state.valueAddition) pending.push('Value Add');
            if (!state.ansWriting) pending.push('Ans Writing');
            weakAreas.push({ ...entry, pending });
        }
    });

    return weakAreas.slice(0, limit);
}

function renderSubjectWeakAreas() {
    const list = document.getElementById('weakAreaList');
    const count = document.getElementById('weakAreaCount');
    if (!list || !count) return;

    const weakAreas = activeSubject ? getWeakAreasForSubject(activeSubject, 6) : [];
    count.innerText = `${weakAreas.length} flagged`;

    if (!weakAreas.length) {
        const msg = trackerMainMode === 'prelims'
            ? 'No prelim weak areas right now. Keep converting NCERT coverage into PYQs and Q.Bank / mocks.'
            : 'No weak areas right now. Your studied topics are moving forward well.';
        list.innerHTML = `<div class="p-3 rounded-xl bg-muted border border-theme text-xs text-muted">${msg}</div>`;
        return;
    }

    list.innerHTML = weakAreas.map(item => `<div class="p-3 rounded-xl bg-muted border border-theme">
        <div class="text-[11px] font-bold text-main leading-relaxed">${item.label}</div>
        <div class="mt-2 flex flex-wrap gap-2">${renderWeakAreaBadges(item.pending)}</div>
    </div>`).join('');
}

function renderWeakAreaBadges(pending) {
    return (pending || []).map(item =>
        `<span class="inline-flex items-center px-2 py-1 rounded-full bg-amber-50 text-amber-700 text-[9px] font-bold uppercase tracking-widest border border-amber-100">${item}</span>`
    ).join('');
}

// ─── Overall Weak Areas (radar view) ──────────────────────────────

function renderOverallWeakAreas() {
    const list = document.getElementById('overallWeakAreaList');
    const count = document.getElementById('overallWeakAreaCount');
    if (!list || !count) return;

    renderWeakAreaControls();

    if (weakAreaPreviewMode === 'optional' && !getSelectedOptional()) {
        count.innerText = '0 flagged';
        list.innerHTML = '<div class="p-4 rounded-2xl bg-muted border border-theme text-sm text-muted">Select your optional subject in Level 1 first to review optional weak areas.</div>';
        return;
    }

    const subjects = weakAreaPreviewMode === 'mains' ? Object.keys(MAINS_SYLLABUS)
        : (weakAreaPreviewMode === 'optional' ? [getSelectedOptional()].filter(Boolean) : PRELIMS_SUBJECTS);

    const savedMainMode = trackerMainMode;
    trackerMainMode = weakAreaPreviewMode;

    const rows = subjects.map(sub => {
        const entries = getSyllabusLeafEntries(sub);
        const modeKey = weakAreaPreviewMode === 'mains' ? 'mains' : (weakAreaPreviewMode === 'optional' ? 'optional' : trackerMode);
        const subData = progressData[modeKey]?.[sub] || {};

        const notStudied = entries.filter(e => {
            const state = subData[e.path] || {};
            return weakAreaPreviewMode === 'prelims' ? !state.ncert : !state.books;
        });

        const notMastered = weakAreaTrackingBasis === 'multi' ? entries.filter(e => {
            const state = subData[e.path] || {};
            if (weakAreaPreviewMode === 'prelims') return state.ncert && (!state.pyqs || !state.qbank);
            return state.books && (!state.ansWriting || !state.pyqs || !state.valueAddition);
        }).map(e => ({
            ...e,
            pending: weakAreaPreviewMode === 'prelims'
                ? [!subData[e.path]?.pyqs && 'PYQs', !subData[e.path]?.qbank && 'Q.Bank / Mocks'].filter(Boolean)
                : [!subData[e.path]?.pyqs && 'PYQs', !subData[e.path]?.valueAddition && 'Value Add', !subData[e.path]?.ansWriting && 'Ans Writing'].filter(Boolean)
        })) : [];

        const mastered = entries.filter(e => {
            const state = subData[e.path] || {};
            if (weakAreaPreviewMode === 'prelims') return state.qbank;
            return state.ansWriting;
        });

        return { subject: sub, notStudied, notMastered, mastered };
    });

    trackerMainMode = savedMainMode;

    const totalFlags = rows.reduce((sum, row) => sum + row.notStudied.length + row.notMastered.length, 0);
    count.innerText = `${totalFlags} flagged`;

    const formatList = (items) => {
        const labels = [...new Set(items.map(i => typeof i === 'string' ? i : i.label).filter(Boolean))];
        return labels.length ? labels.join(', ') : 'Nothing pending here.';
    };

    list.innerHTML = `<div class="overflow-x-auto"><table class="w-full min-w-[840px] border-separate border-spacing-y-3">
        <thead><tr>
            <th class="text-left text-[10px] font-bold text-[#8a795d] uppercase tracking-widest px-4">Subject</th>
            <th class="text-left text-[10px] font-bold text-[#8a795d] uppercase tracking-widest px-4">Topics Not Started Yet</th>
            ${weakAreaTrackingBasis === 'multi' ? '<th class="text-left text-[10px] font-bold text-[#8a795d] uppercase tracking-widest px-4">Topics Started But Not Mastered</th>' : ''}
            <th class="text-left text-[10px] font-bold text-[#8a795d] uppercase tracking-widest px-4">Topics Mastered</th>
        </tr></thead>
        <tbody>
            ${rows.map(row => `<tr>
                <td class="align-top p-4 rounded-2xl bg-muted border border-theme text-sm font-bold text-main">${row.subject}</td>
                <td class="align-top p-4 rounded-2xl bg-muted border border-theme text-sm text-main">${formatList(row.notStudied)}</td>
                ${weakAreaTrackingBasis === 'multi' ? `<td class="align-top p-4 rounded-2xl bg-muted border border-theme">
                    ${row.notMastered.length ? row.notMastered.map(item => `<div class="mb-3 last:mb-0">
                        <div class="text-sm font-medium text-main leading-relaxed mb-2">${item.label}</div>
                        <div class="flex flex-wrap gap-2">${renderWeakAreaBadges(item.pending)}</div>
                    </div>`).join('') : '<div class="text-sm text-muted">Moving well.</div>'}
                </td>` : ''}
                <td class="align-top p-4 rounded-2xl bg-muted border border-theme text-sm text-main">${row.mastered.length ? formatList(row.mastered) : '-'}</td>
            </tr>`).join('')}
        </tbody>
    </table></div>`;
}

function renderWeakAreaControls() {
    const modeWrap = document.getElementById('weakAreaModeFilters');
    const basisWrap = document.getElementById('weakAreaBasisFilters');
    const intro = document.getElementById('weakAreaIntro');

    if (modeWrap) {
        modeWrap.innerHTML = ['prelims', 'mains', 'optional'].map(mode => {
            const active = weakAreaPreviewMode === mode;
            return `<button data-wa-mode="${mode}" class="px-4 py-2 rounded-2xl border text-xs font-bold transition ${active ? 'bg-[#8a795d] text-white border-[#8a795d]' : 'bg-card text-main border-theme hover:bg-muted'}">${mode.charAt(0).toUpperCase() + mode.slice(1)}</button>`;
        }).join('');
        modeWrap.querySelectorAll('[data-wa-mode]').forEach(btn => {
            btn.addEventListener('click', () => {
                weakAreaPreviewMode = btn.dataset.waMode;
                renderOverallWeakAreas();
            });
        });
    }

    if (basisWrap) {
        basisWrap.innerHTML = [
            { key: 'single', label: 'Single Stage' },
            { key: 'multi', label: 'Multi Stage' }
        ].map(item => {
            const active = weakAreaTrackingBasis === item.key;
            return `<button data-wa-basis="${item.key}" class="px-4 py-2 rounded-2xl border text-xs font-bold transition ${active ? 'bg-[#2d3a3a] text-white border-[#2d3a3a]' : 'bg-card text-main border-theme hover:bg-muted'}">${item.label}</button>`;
        }).join('');
        basisWrap.querySelectorAll('[data-wa-basis]').forEach(btn => {
            btn.addEventListener('click', () => {
                weakAreaTrackingBasis = btn.dataset.waBasis;
                localStorage.setItem('upsc_weak_area_basis', weakAreaTrackingBasis);
                renderOverallWeakAreas();
            });
        });
    }

    if (intro) {
        intro.innerText = weakAreaTrackingBasis === 'single'
            ? 'Single-stage view shows, subject by subject, the topics that are still unchecked in your submitted stage-tracking data.'
            : 'Multi-stage view separates topics not started yet from topics started but not yet mastered. Pending stages are shown as small badges.';
    }
}

// ─── Summary / Overall Stats ───────────────────────────────────────

function renderProgressSummary() {
    const container = document.getElementById('tracker-summary-grid');
    if (!container) return;
    const subjects = getCurrentSubjects();

    container.innerHTML = subjects.map(sub => {
        const stats = getSubjectStats(sub);
        return `<div class="card-premium p-6 rounded-3xl">
            <div class="text-[10px] font-bold text-muted uppercase mb-2">${sub}</div>
            <div class="flex justify-between items-end mb-4">
                <div class="text-2xl font-bold text-main">${stats.percent}%</div>
                <div class="text-[10px] font-bold text-[#8a795d]">${stats.completed}/${stats.total}</div>
            </div>
            <div class="h-1.5 w-full bg-muted rounded-full overflow-hidden border border-theme">
                <div class="h-full bg-[#8a795d]" style="width: ${stats.percent}%"></div>
            </div>
        </div>`;
    }).join('');
}

function updateOverallStats() {
    const subjects = getCurrentSubjects();
    let total = 0, rawScore = 0, completed = 0;
    subjects.forEach(sub => {
        const s = getSubjectStats(sub);
        total += s.total;
        completed += s.completed;
        rawScore += s.rawScore;
    });
    const avg = total > 0 ? Math.round((rawScore / total) * 100) : 0;

    const ot = document.getElementById('overallTotalTopics');
    const oc = document.getElementById('overallCompletedTopics');
    const oa = document.getElementById('overallAvgPercent');
    const ocp = document.getElementById('overallChartPercent');

    if (ot) ot.innerText = total;
    if (oc) oc.innerText = completed;
    if (oa) oa.innerText = `${avg}%`;
    if (ocp) ocp.innerText = `${avg}%`;

    overallChart = upsertDoughnutChart(overallChart, 'overallDoughnut', rawScore, total, '85%');
}

// ─── Recent Activity ────────────────────────────────────────────────

function addToRecent(label) {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const shortLabel = label.split('.').pop();
    recentActivity.unshift({ label: shortLabel, time });
    recentActivity = recentActivity.slice(0, 5);
    localStorage.setItem('upsc_tracker_recent_v4', JSON.stringify(recentActivity));
    renderRecentActivity();
}

function renderRecentActivity() {
    const list = document.getElementById('recentActivityList');
    if (!list) return;
    if (!recentActivity.length) {
        list.innerHTML = '<p class="text-[10px] text-muted italic">No activity.</p>';
        return;
    }
    list.innerHTML = recentActivity.map(act => `<div class="p-2 bg-muted border border-theme rounded-lg flex items-center justify-between gap-2">
        <span class="text-[10px] font-medium text-main truncate" title="${act.label}">${act.label}</span>
        <span class="text-[8px] text-muted shrink-0">${act.time}</span>
    </div>`).join('');
}

// ─── Reset ─────────────────────────────────────────────────────────

function confirmResetTracker() {
    if (confirm('Permanently wipe all tracker progress?')) {
        progressData = {};
        localStorage.removeItem('upsc_tracker_progress_v6');
        localStorage.removeItem('upsc_mastered_subjects');
        saveAndRefresh();
    }
}

function confirmResetSubject() {
    if (confirm(`Reset data for ${activeSubject}?`)) {
        const modeKey = getModeKey();
        if (progressData[modeKey]) progressData[modeKey][activeSubject] = {};
        saveAndRefresh();
    }
}

// ─── Chart Helper ─────────────────────────────────────────────────

function upsertDoughnutChart(existingChart, canvasId, completedValue, totalValue, cutout) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return existingChart;

    const safeCompleted = Math.max(0, completedValue);
    const safeRemaining = Math.max(0, totalValue - safeCompleted);
    const dataset = [safeCompleted, safeRemaining];

    if (existingChart) {
        existingChart.data.datasets[0].data = dataset;
        existingChart.update();
        return existingChart;
    }

    const ctx = canvas.getContext('2d');
    return new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Progress', 'Remaining'],
            datasets: [{ data: dataset, backgroundColor: ['#8a795d', 'transparent'], borderColor: ['#8a795d', 'var(--border-theme)'], borderWidth: 1 }]
        },
        options: { cutout, plugins: { legend: { display: false } } }
    });
}
