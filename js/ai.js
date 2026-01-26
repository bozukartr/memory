// AI Player for Single Player Mode
// ==================================

class AIPlayer {
    constructor(difficulty = 'medium') {
        this.difficulty = difficulty;
        this.memory = new Map(); // Remembers card positions: index -> emoji
        this.knownPairs = new Map(); // Known pairs: emoji -> [indices]

        // Difficulty settings
        this.settings = {
            easy: {
                memoryRate: 0.3,      // 30% chance to remember a card
                thinkingTime: 2000,   // 2 seconds
                mistakeRate: 0.3     // 30% chance to make a "mistake"
            },
            medium: {
                memoryRate: 0.6,
                thinkingTime: 1000,
                mistakeRate: 0.15
            },
            hard: {
                memoryRate: 0.9,
                thinkingTime: 500,
                mistakeRate: 0.05
            }
        };
    }

    // Reset AI memory for new game
    reset() {
        this.memory.clear();
        this.knownPairs.clear();
    }

    // AI observes a card flip (learns from both players' moves)
    observeCard(index, emoji) {
        const settings = this.settings[this.difficulty];

        // Decide if AI remembers this card based on difficulty
        if (Math.random() < settings.memoryRate) {
            this.memory.set(index, emoji);

            // Track known pairs
            if (!this.knownPairs.has(emoji)) {
                this.knownPairs.set(emoji, []);
            }
            const indices = this.knownPairs.get(emoji);
            if (!indices.includes(index)) {
                indices.push(index);
            }
        }
    }

    // AI forgets a card (when it's matched)
    forgetCard(index) {
        const emoji = this.memory.get(index);
        this.memory.delete(index);

        if (emoji && this.knownPairs.has(emoji)) {
            const indices = this.knownPairs.get(emoji);
            const newIndices = indices.filter(i => i !== index);
            if (newIndices.length === 0) {
                this.knownPairs.delete(emoji);
            } else {
                this.knownPairs.set(emoji, newIndices);
            }
        }
    }

    // Get available cards to flip
    getAvailableCards(boardElement) {
        const available = [];
        const cards = boardElement.children;

        for (let i = 0; i < cards.length; i++) {
            const card = cards[i];
            if (!card.classList.contains('matched') && !card.classList.contains('flipped')) {
                available.push(i);
            }
        }

        return available;
    }

    // AI makes a move (returns promise that resolves with card index to flip)
    async makeMove(boardElement, isFirstCard, firstCardIndex = null, cards = []) {
        const settings = this.settings[this.difficulty];

        // Simulate thinking time
        await this.delay(settings.thinkingTime * (0.5 + Math.random() * 0.5));

        const available = this.getAvailableCards(boardElement);

        if (available.length === 0) return null;

        if (isFirstCard) {
            return this.chooseFirstCard(available, cards, settings);
        } else {
            return this.chooseSecondCard(available, firstCardIndex, cards, settings);
        }
    }

    // Choose first card
    chooseFirstCard(available, cards, settings) {
        // Check if AI knows a complete pair
        for (const [emoji, indices] of this.knownPairs) {
            const validIndices = indices.filter(i => available.includes(i));
            if (validIndices.length >= 2) {
                // AI knows a pair! Pick first card of the pair
                if (Math.random() > settings.mistakeRate) {
                    return validIndices[0];
                }
            }
        }

        // Otherwise, pick a random available card
        return available[Math.floor(Math.random() * available.length)];
    }

    // Choose second card
    chooseSecondCard(available, firstCardIndex, cards, settings) {
        const firstEmoji = cards[firstCardIndex];

        // Safety check
        if (!firstEmoji || available.length === 0) {
            return available.length > 0 ? available[0] : null;
        }

        // Check if AI knows where the matching card is
        if (this.knownPairs.has(firstEmoji)) {
            const indices = this.knownPairs.get(firstEmoji);
            const matchIndex = indices.find(i => i !== firstCardIndex && available.includes(i));

            if (matchIndex !== undefined) {
                // AI knows the match!
                if (Math.random() > settings.mistakeRate) {
                    return matchIndex;
                }
            }
        }

        // Check memory for the matching card
        for (const [index, emoji] of this.memory) {
            if (emoji === firstEmoji && index !== firstCardIndex && available.includes(index)) {
                if (Math.random() > settings.mistakeRate) {
                    return index;
                }
            }
        }

        // Random pick (excluding first card)
        const choices = available.filter(i => i !== firstCardIndex);

        // Safety check for empty choices
        if (choices.length === 0) {
            return available.length > 0 ? available[0] : null;
        }

        return choices[Math.floor(Math.random() * choices.length)];
    }

    // Delay helper
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Global AI player instance
window.aiPlayer = new AIPlayer();
