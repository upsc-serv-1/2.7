/**
 * SM-2 Spaced Repetition Engine (Anki-based)
 * Implements the SuperMemo 2 algorithm for scheduling flashcard reviews.
 */

const DEFAULT_EASE_FACTOR = 2.5;
const MIN_EASE_FACTOR = 1.3;

// Difficulty score mapping
const DIFFICULTY_SCORES = {
    again: 0,
    hard: 3,
    good: 4,
    easy: 5
};

/**
 * Create a new SM-2 card state with defaults
 */
export function createCardState(cardId, overrides = {}) {
    const now = new Date().toISOString();
    return {
        cardId,
        status: "active",          // active | frozen
        repetitions: 0,
        interval: 0,               // in days
        easeFactor: DEFAULT_EASE_FACTOR,
        nextReview: now,           // ISO timestamp — due immediately
        lastReviewed: null,
        learningStatus: "not_studied", // not_studied | learning | mastered
        againCount: 0,
        userNote: "",
        ...overrides
    };
}

/**
 * Process a review answer and return updated card state
 * @param {object} currentState - Current card state
 * @param {string} difficulty - "again" | "hard" | "good" | "easy"
 * @returns {object} Updated card state
 */
export function processReview(currentState, difficulty, customIntervals = null) {
    const score = DIFFICULTY_SCORES[difficulty];
    if (score === undefined) throw new Error(`Invalid difficulty: ${difficulty}`);

    const now = new Date();
    const updated = { ...currentState, lastReviewed: now.toISOString() };

    // Track again count for insights
    if (score === 0) {
        updated.againCount = (currentState.againCount || 0) + 1;
    }

    if (score < 3) {
        // Again — reset
        updated.repetitions = 0;
        updated.interval = (customIntervals?.again != null) ? customIntervals.again : 1;
        updated.learningStatus = "learning";
    } else {
        // Score >= 3
        if (currentState.repetitions === 0) {
            updated.interval = (difficulty === "easy" && customIntervals?.easy != null) ? customIntervals.easy : 
                             (difficulty === "good" && customIntervals?.good != null) ? customIntervals.good : 
                             (difficulty === "hard" && customIntervals?.hard != null) ? customIntervals.hard : 1;
        } else if (currentState.repetitions === 1) {
            updated.interval = (difficulty === "easy" && customIntervals?.easy != null) ? Math.max(customIntervals.easy, 7) : 6;
        } else {
            const multiplier = (difficulty === "easy") ? 1.3 : (difficulty === "hard") ? 0.8 : 1.0;
            updated.interval = Math.round(currentState.interval * currentState.easeFactor * multiplier);
        }

        // Update ease factor
        const scoreDelta = (5 - score);
        updated.easeFactor = currentState.easeFactor + (0.1 - scoreDelta * (0.08 + scoreDelta * 0.02));
        if (updated.easeFactor < MIN_EASE_FACTOR) {
            updated.easeFactor = MIN_EASE_FACTOR;
        }

        // Increment repetitions
        updated.repetitions = currentState.repetitions + 1;

        // Update learning status
        if (updated.repetitions >= 5 && updated.easeFactor >= 2.0) {
            updated.learningStatus = "mastered";
        } else {
            updated.learningStatus = "learning";
        }
    }

    // Calculate next review date
    const nextReview = new Date(now.getTime() + updated.interval * 24 * 60 * 60 * 1000);
    updated.nextReview = nextReview.toISOString();

    return updated;
}

/**
 * Check if a card is due for review
 * @param {object} cardState - Card state with nextReview
 * @returns {boolean}
 */
export function isCardDue(cardState) {
    if (!cardState || cardState.status === "frozen") return false;
    if (!cardState.nextReview) return true; // Never reviewed = due now
    return new Date(cardState.nextReview).getTime() <= Date.now();
}

/**
 * Freeze a card — remove from all study queues
 */
export function freezeCard(cardState) {
    return {
        ...cardState,
        status: "frozen"
    };
}

/**
 * Unfreeze a card — reset scheduling
 */
export function unfreezeCard(cardState) {
    const now = new Date().toISOString();
    return {
        ...cardState,
        status: "active",
        repetitions: 0,
        interval: 0,
        easeFactor: DEFAULT_EASE_FACTOR,
        nextReview: now,
        learningStatus: "not_studied"
    };
}

/**
 * Get cards due today
 * @param {Array} cardStates - Array of card states
 * @returns {Array} Due cards (active only)
 */
export function getDueCards(cardStates) {
    return cardStates.filter(c => c.status === "active" && isCardDue(c));
}

/**
 * Get all active cards
 * @param {Array} cardStates - Array of card states
 * @returns {Array} Active cards
 */
export function getActiveCards(cardStates) {
    return cardStates.filter(c => c.status === "active");
}

/**
 * Get learning status summary for a set of cards
 * @param {Array} cardStates - Array of card states
 * @returns {object} { notStudied, learning, mastered, dueToday, frozen, total }
 */
export function getCardStats(cardStates) {
    const active = cardStates.filter(c => c.status === "active");
    const frozen = cardStates.filter(c => c.status === "frozen");
    return {
        notStudied: active.filter(c => c.learningStatus === "not_studied").length,
        learning: active.filter(c => c.learningStatus === "learning").length,
        mastered: active.filter(c => c.learningStatus === "mastered").length,
        dueToday: active.filter(c => isCardDue(c)).length,
        frozen: frozen.length,
        total: cardStates.length
    };
}

/**
 * Sort cards by various criteria
 * @param {Array} cards - Array of card objects (with state)
 * @param {string} sortBy - "nextReview" | "newest" | "oldest" | "az" | "za"
 * @returns {Array} Sorted cards
 */
export function sortCards(cards, sortBy) {
    const sorted = [...cards];
    switch (sortBy) {
        case "nextReview":
            return sorted.sort((a, b) => {
                const aDate = a.state?.nextReview ? new Date(a.state.nextReview).getTime() : 0;
                const bDate = b.state?.nextReview ? new Date(b.state.nextReview).getTime() : 0;
                return aDate - bDate;
            });
        case "newest":
            return sorted.sort((a, b) => {
                const aDate = a.state?.lastReviewed ? new Date(a.state.lastReviewed).getTime() : 0;
                const bDate = b.state?.lastReviewed ? new Date(b.state.lastReviewed).getTime() : 0;
                return bDate - aDate;
            });
        case "oldest":
            return sorted.sort((a, b) => {
                const aDate = a.state?.createdAt ? new Date(a.state.createdAt).getTime() : Infinity;
                const bDate = b.state?.createdAt ? new Date(b.state.createdAt).getTime() : Infinity;
                return aDate - bDate;
            });
        case "az":
            return sorted.sort((a, b) => (a.questionText || "").localeCompare(b.questionText || ""));
        case "za":
            return sorted.sort((a, b) => (b.questionText || "").localeCompare(a.questionText || ""));
        default:
            return sorted;
    }
}

/**
 * Filter cards by learning status and card status
 * @param {Array} cards - Array of card objects (with state)
 * @param {object} filters - { learningStatus: string[], cardStatus: string }
 * @returns {Array} Filtered cards
 */
export function filterCards(cards, filters = {}) {
    let result = cards;

    if (filters.learningStatus && filters.learningStatus.length > 0) {
        result = result.filter(c => filters.learningStatus.includes(c.state?.learningStatus || "not_studied"));
    }

    if (filters.cardStatus) {
        result = result.filter(c => (c.state?.status || "active") === filters.cardStatus);
    }

    return result;
}

/**
 * Get weak topics (accuracy < 60%)
 * @param {Array} cardStates - Array of card states with microtopic info
 * @returns {Array} [{ microtopic, total, againCount, accuracy }]
 */
export function getWeakTopics(cardStates) {
    const byTopic = {};
    cardStates.forEach(c => {
        const topic = c.microTopic || "Uncategorized";
        if (!byTopic[topic]) byTopic[topic] = { total: 0, againCount: 0 };
        byTopic[topic].total++;
        byTopic[topic].againCount += (c.againCount || 0);
    });

    return Object.entries(byTopic)
        .map(([microTopic, data]) => ({
            microTopic,
            total: data.total,
            againCount: data.againCount,
            accuracy: data.total > 0 ? Math.round(((data.total - data.againCount) / data.total) * 100) : 100
        }))
        .filter(t => t.accuracy < 60 && t.total >= 2)
        .sort((a, b) => a.accuracy - b.accuracy);
}

/**
 * Get most forgotten cards (highest againCount)
 * @param {Array} cardStates - Array of card states
 * @param {number} limit - Max results
 * @returns {Array} Top forgotten cards
 */
export function getMostForgottenCards(cardStates, limit = 10) {
    return cardStates
        .filter(c => c.status === "active" && (c.againCount || 0) > 0)
        .sort((a, b) => (b.againCount || 0) - (a.againCount || 0))
        .slice(0, limit);
}

/**
 * Calculate overall accuracy
 * @param {Array} cardStates - Array of card states
 * @returns {number} Accuracy percentage
 */
export function getOverallAccuracy(cardStates) {
    const reviewed = cardStates.filter(c => c.lastReviewed);
    if (!reviewed.length) return 0;
    const goodOrEasy = reviewed.filter(c => c.learningStatus === "mastered" || c.learningStatus === "learning").length;
    return Math.round((goodOrEasy / reviewed.length) * 100);
}
