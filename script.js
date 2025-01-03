document.addEventListener('DOMContentLoaded', () => {
    const searchButton = document.getElementById('searchButton');
    const wordInput = document.getElementById('wordInput');
    const resultContainer = document.querySelector('.result-container');
    let dictionary = {};

    function generateSalt() {
        return Math.random().toString(36).slice(2);
    }

    function generateMD5(string) {
        return CryptoJS.MD5(string).toString();
    }

    async function translateText(text) {
        try {
            const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|zh`);

            if (!response.ok) {
                throw new Error('Translation request failed');
            }

            const data = await response.json();
            return data.responseData.translatedText;
        } catch (error) {
            console.error('Translation error:', error);
            return '翻译失败，请稍后重试';
        }
    }

    async function toggleTranslation(event) {
        const button = event.target;
        const translationDiv = button.nextElementSibling;
        const englishText = button.previousElementSibling.textContent;

        if (translationDiv.style.display === 'none') {
            button.textContent = '🔄 正在翻译...';
            button.disabled = true;

            try {
                const translation = await translateText(englishText);
                translationDiv.querySelector('p').textContent = translation;
                translationDiv.style.display = 'block';
                button.textContent = '🔄 隐藏翻译';
                button.classList.add('active');
            } catch (error) {
                console.error('Translation error:', error);
                button.textContent = '🔄 翻译失败';
                setTimeout(() => {
                    button.textContent = '🔄 重试翻译';
                    button.disabled = false;
                }, 2000);
                return;
            }

            button.disabled = false;
        } else {
            translationDiv.style.display = 'none';
            button.textContent = '🔄 显示翻译';
            button.classList.remove('active');
        }
    }

    async function getWordTranslation(word) {
        try {
            const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=en|zh`);
            const data = await response.json();
            return data.responseData.translatedText;
        } catch (error) {
            console.error('Translation error:', error);
            return '翻译失败';
        }
    }

    // Fetch and parse the IELTS bank file
    fetch('IELTS-bank.txt')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.text();
        })
        .then(data => {
            const lines = data.split('\n');
            let wordFrequency = {};
            let currentSource = '';
            let currentPassage = '';

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();

                if (!line) continue;

                // Check if line is a source header (e.g., "C5-Test 3-Passage 3")
                const sourceMatch = line.match(/^(C\d+-Test \d+-(?:Part|Passage) \d+)$/);
                if (sourceMatch) {
                    currentSource = sourceMatch[1];
                    // Get the next line as the title
                    if (i + 1 < lines.length) {
                        currentPassage = lines[i + 1].trim();
                    }
                    continue;
                }

                // Check if line contains English words
                const isEnglish = /^[a-zA-Z]/.test(line);

                if (isEnglish) {
                    // Split into sentences
                    const sentences = line.match(/[^.!?]+[.!?]+/g) || [line];

                    sentences.forEach(sentence => {
                        const words = sentence.toLowerCase().match(/\b[a-zA-Z]+\b/g);
                        if (words) {
                            words.forEach(word => {
                                if (word.length > 2) { // Skip very short words
                                    wordFrequency[word] = (wordFrequency[word] || 0) + 1;

                                    if (!dictionary[word]) {
                                        dictionary[word] = {
                                            frequency: 0,
                                            ieltsExamples: []
                                        };
                                    }

                                    dictionary[word].frequency = wordFrequency[word];

                                    // Add the sentence as an example with source
                                    const example = {
                                        english: sentence.trim(),
                                        source: currentSource,
                                        title: currentPassage
                                    };

                                    // Debug log
                                    console.log('Adding example:', {
                                        word,
                                        source: currentSource,
                                        title: currentPassage
                                    });

                                    // Check if this exact example already exists
                                    const isDuplicate = dictionary[word].ieltsExamples.some(
                                        ex => ex.english === example.english
                                    );

                                    if (!isDuplicate) {
                                        dictionary[word].ieltsExamples.push(example);
                                    }
                                }
                            });
                        }
                    });
                }
            }
            console.log('Dictionary created:', dictionary);
        })
        .catch(error => {
            console.error('Error loading IELTS bank:', error);
            // Add some user feedback here if needed
        });

    function highlightWord(text, word) {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        return text.replace(regex, match => `<span class="highlight">${match}</span>`);
    }

    function getStarRating(frequency) {
        const stars = Math.min(5, frequency);  // Cap at 5 stars
        const filledStar = '⭐';
        const emptyStar = '☆';
        return filledStar.repeat(stars) + emptyStar.repeat(5 - stars);
    }

    function getWordVariations(word) {
        const variations = new Set([word.toLowerCase()]);
        const base = word.toLowerCase();

        // Common word form patterns
        const patterns = {
            // verb -> noun
            'ify': 'ification',
            'ate': 'ation',

            // noun -> verb
            'ification': 'ify',
            'ation': 'ate'
        };

        // Check for each pattern
        for (const [suffix, replacement] of Object.entries(patterns)) {
            if (base.endsWith(suffix)) {
                const stem = base.slice(0, -suffix.length);
                // Add the converted form
                variations.add(stem + replacement);

                // Add variations of the converted form
                if (replacement === 'ification' || replacement === 'ation') {
                    variations.add(stem + replacement + 's'); // plural
                } else if (replacement === 'ify' || replacement === 'ate') {
                    variations.add(stem + replacement + 's');
                    variations.add(stem + replacement + 'ing');
                    variations.add(stem + replacement + 'd');
                    if (replacement === 'ify') {
                        variations.add(stem + 'ies');
                    }
                }
            }
        }

        // Add basic variations
        if (base.endsWith('ing')) {
            const baseForm = base.slice(0, -3);
            variations.add(baseForm);
            variations.add(baseForm + 's');
            variations.add(baseForm + 'ed');
        } else if (base.endsWith('ed')) {
            const baseForm = base.slice(0, -2);
            variations.add(baseForm);
            variations.add(baseForm + 's');
            variations.add(baseForm + 'ing');
        } else if (base.endsWith('es')) {
            variations.add(base.slice(0, -2));  // base form
            variations.add(base.slice(0, -2) + 'ed');  // past tense
            variations.add(base.slice(0, -2) + 'ing');  // present participle
        } else if (base.endsWith('s')) {
            const baseForm = base.slice(0, -1);
            variations.add(baseForm);
            variations.add(baseForm + 'ed');
            variations.add(baseForm + 'ing');
        } else {
            variations.add(base + 's');  // plural
            variations.add(base + 'es'); // alternative plural
            variations.add(base + 'ed'); // past tense
            variations.add(base + 'ing'); // present participle
        }

        // Handle words ending in 'e'
        if (base.endsWith('e')) {
            variations.add(base.slice(0, -1) + 'ing');
        }

        return Array.from(variations);
    }

    function showResult(input) {
        // First, check if input is a sentence/phrase (contains spaces)
        if (input.includes(' ')) {
            showSentenceResult(input);
            return;
        }

        // Original single word search logic
        const variations = getWordVariations(input);
        let allExamples = [];
        let totalFrequency = 0;
        let foundAny = false;

        // Check each variation in the dictionary
        variations.forEach(variation => {
            const wordData = dictionary[variation];
            if (wordData) {
                foundAny = true;
                if (wordData.ieltsExamples) {
                    allExamples = allExamples.concat(
                        wordData.ieltsExamples.map(ex => ({
                            ...ex,
                            wordVariation: variation
                        }))
                    );
                }
            }
        });

        // Remove duplicates first
        const uniqueExamples = Array.from(new Set(allExamples.map(ex => JSON.stringify(ex))))
            .map(ex => JSON.parse(ex));

        // Count total frequency based on unique examples
        totalFrequency = uniqueExamples.length;

        if (!foundAny) {
            alert('Word not found in our database ❌');
            return;
        }

        // Clear previous results
        document.getElementById('wordTitle').textContent = '';
        const oldFrequencyBadge = document.querySelector('.frequency-badge');
        if (oldFrequencyBadge) {
            oldFrequencyBadge.remove();
        }
        document.getElementById('ieltsExamples').innerHTML = '';

        // Set title directly without translation
        document.getElementById('wordTitle').textContent = `${input}`;

        // Add frequency information with stars
        const stars = getStarRating(Math.min(5, totalFrequency));
        const foundVariations = variations.filter(v => dictionary[v]);
        const frequencyHtml = `
            <div class="frequency-badge">
                <div class="frequency-stars">${stars}</div>
                <div class="frequency-count">Found ${totalFrequency} time${totalFrequency > 1 ? 's' : ''}</div>
                <div class="word-variations">
                    Word forms: ${foundVariations.join(', ')}
                </div>
            </div>
        `;
        document.getElementById('wordTitle').insertAdjacentHTML('afterend', frequencyHtml);

        // Display examples...
        const examplesContainer = document.getElementById('ieltsExamples');
        examplesContainer.innerHTML = uniqueExamples.map((example, index) => {
            const sourceDisplay = example.title ?
                `${example.source} - ${example.title}` :
                example.source;

            return `
                <div class="example-item">
                    <div class="source-info">
                        <div class="example-number">${index + 1}</div>
                        <div class="source-tag">${sourceDisplay}</div>
                        <div class="word-variation-tag">Form: ${example.wordVariation}</div>
                    </div>
                    <p>${highlightWord(example.english, example.wordVariation)}</p>
                    <button class="translation-toggle">🔄 显示翻译</button>
                    <div class="translation" style="display: none;">
                        <p>Loading translation...</p>
                    </div>
                </div>
            `;
        }).join('');

        // Add click event listeners to translation toggle buttons
        document.querySelectorAll('.translation-toggle').forEach(button => {
            button.addEventListener('click', toggleTranslation);
        });

        resultContainer.classList.add('visible');
    }

    // Add this new function for sentence/phrase search
    function showSentenceResult(sentence) {
        const words = sentence.toLowerCase().match(/\b[a-zA-Z]+\b/g) || [];
        let allExamples = [];
        let foundAny = false;

        // Search for each word in the sentence
        words.forEach(word => {
            if (word.length > 2 && dictionary[word]) {  // Skip very short words
                foundAny = true;
                dictionary[word].ieltsExamples.forEach(example => {
                    if (example.english.toLowerCase().includes(sentence.toLowerCase())) {
                        allExamples.push({
                            ...example,
                            searchedPhrase: sentence
                        });
                    }
                });
            }
        });

        if (!foundAny || allExamples.length === 0) {
            alert('Phrase not found in our database ❌');
            return;
        }

        // Clear previous results
        document.getElementById('wordTitle').textContent = '';
        const oldFrequencyBadge = document.querySelector('.frequency-badge');
        if (oldFrequencyBadge) {
            oldFrequencyBadge.remove();
        }
        document.getElementById('ieltsExamples').innerHTML = '';

        // Set title as the phrase
        document.getElementById('wordTitle').textContent = sentence;

        // Add frequency information
        const frequencyHtml = `
            <div class="frequency-badge">
                <div class="frequency-stars">${getStarRating(Math.min(5, allExamples.length))}</div>
                <div class="frequency-count">Found ${allExamples.length} time${allExamples.length > 1 ? 's' : ''}</div>
                <div class="word-variations">
                    Showing examples containing this phrase
                </div>
            </div>
        `;
        document.getElementById('wordTitle').insertAdjacentHTML('afterend', frequencyHtml);

        // Remove duplicates
        const uniqueExamples = Array.from(new Set(allExamples.map(ex => JSON.stringify(ex))))
            .map(ex => JSON.parse(ex));

        // Display examples
        const examplesContainer = document.getElementById('ieltsExamples');
        examplesContainer.innerHTML = uniqueExamples.map((example, index) => {
            const sourceDisplay = example.title ?
                `${example.source} - ${example.title}` :
                example.source;

            return `
                <div class="example-item">
                    <div class="source-info">
                        <div class="example-number">${index + 1}</div>
                        <div class="source-tag">${sourceDisplay}</div>
                    </div>
                    <p>${highlightPhrase(example.english, example.searchedPhrase)}</p>
                    <button class="translation-toggle">🔄 显示翻译</button>
                    <div class="translation" style="display: none;">
                        <p>Loading translation...</p>
                    </div>
                </div>
            `;
        }).join('');

        // Add click event listeners to translation toggle buttons
        document.querySelectorAll('.translation-toggle').forEach(button => {
            button.addEventListener('click', toggleTranslation);
        });

        resultContainer.classList.add('visible');
    }

    // Add this new helper function to highlight phrases
    function highlightPhrase(text, phrase) {
        const regex = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        return text.replace(regex, match => `<span class="highlight">${match}</span>`);
    }

    searchButton.addEventListener('click', () => {
        const word = wordInput.value.trim();
        if (word) {
            showResult(word);
        }
    });

    wordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const word = wordInput.value.trim();
            if (word) {
                showResult(word);
            }
        }
    });

    const clearButton = document.getElementById('clearButton');

    // Show/hide clear button based on input content
    wordInput.addEventListener('input', () => {
        clearButton.style.display = wordInput.value ? 'block' : 'none';
    });

    // Clear input when x button is clicked
    clearButton.addEventListener('click', () => {
        wordInput.value = '';
        clearButton.style.display = 'none';
        wordInput.focus();
    });

    // Back to Top functionality
    const backToTopButton = document.getElementById('backToTop');

    // Show button when scrolling down
    window.addEventListener('scroll', () => {
        if (window.scrollY > 300) {
            backToTopButton.classList.add('visible');
        } else {
            backToTopButton.classList.remove('visible');
        }
    });

    // Smooth scroll to top when clicked
    backToTopButton.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
});
