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
        .then(response => response.text())
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
        .catch(error => console.error('Error loading IELTS bank:', error));

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

    function showResult(word) {
        const wordData = dictionary[word.toLowerCase()];
        if (!wordData || wordData.ieltsExamples.length === 0) {
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

        // First show loading state
        document.getElementById('wordTitle').textContent = `${word} (正在翻译...) 📝`;

        // Get word translation
        getWordTranslation(word).then(translation => {
            // Update word title with translation
            document.getElementById('wordTitle').textContent = `${word} (${translation}) 📝`;
            
            // Add frequency information with stars
            const frequency = wordData.frequency;
            const stars = getStarRating(frequency);
            const frequencyHtml = `
                <div class="frequency-badge">
                    <div class="frequency-stars">${stars}</div>
                    <div class="frequency-count">Found ${frequency} time${frequency > 1 ? 's' : ''}</div>
                </div>
            `;
            document.getElementById('wordTitle').insertAdjacentHTML('afterend', frequencyHtml);

            const uniqueExamples = Array.from(new Set(wordData.ieltsExamples.map(ex => JSON.stringify(ex))))
                .map(ex => JSON.parse(ex));

            const examplesContainer = document.getElementById('ieltsExamples');
            examplesContainer.innerHTML = uniqueExamples.map(example => {
                const sourceDisplay = example.title ? 
                    `${example.source} - ${example.title}` : 
                    example.source;
                
                return `
                    <div class="example-item">
                        <div class="source-info">
                            <div class="source-tag">${sourceDisplay}</div>
                        </div>
                        <p>${highlightWord(example.english, word)}</p>
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
        });
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
});
