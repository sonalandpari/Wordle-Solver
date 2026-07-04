document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const correctInputs = document.querySelectorAll('#correct-grid input');
  const misplacedInputs = document.querySelectorAll('#misplaced-grid input');
  const greyInput = document.getElementById('grey-letters');
  const btnSolve = document.getElementById('btn-solve');
  const btnReset = document.getElementById('btn-reset');
  const resultsCount = document.getElementById('results-count-value');
  const searchInput = document.getElementById('search-candidates');
  const sortSelect = document.getElementById('sort-order');
  const suggestionsContainer = document.getElementById('suggestions-container');
  const interactiveTiles = document.querySelectorAll('.interactive-tile');
  const keys = document.querySelectorAll('.key');
  const statsGrid = document.getElementById('stats-grid');
  const toggleStatsBtn = document.getElementById('toggle-stats');
  const statsSection = document.getElementById('stats-section');
  const toast = document.getElementById('toast-notification');
  const toastMessage = document.getElementById('toast-message');

  // App State
  let filteredWords = [];
  let displayWords = [];
  let showStats = true;

  // Initialize
  initGridInputs();
  initStarterTiles();
  initVirtualKeyboard();
  initStatsToggle();
  resetAll();

  // Initialize event listeners for grids
  function initGridInputs() {
    // Correct Grid (Green) - Auto-tabbing, max 1 char, uppercase
    correctInputs.forEach((input, index) => {
      input.addEventListener('input', (e) => {
        // Enforce letters only
        input.value = input.value.replace(/[^a-zA-Z]/g, '').toUpperCase();
        
        const cell = input.parentElement;
        if (input.value) {
          cell.classList.add('filled');
          // Auto tab to next cell
          if (index < correctInputs.length - 1) {
            correctInputs[index + 1].focus();
          }
        } else {
          cell.classList.remove('filled');
        }
        
        onInputsChanged();
      });

      // Backspace behavior
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !input.value && index > 0) {
          correctInputs[index - 1].focus();
          correctInputs[index - 1].value = '';
          correctInputs[index - 1].parentElement.classList.remove('filled');
          onInputsChanged();
        }
      });
    });

    // Misplaced Grid (Yellow) - Multiple letters, uppercase, styling
    misplacedInputs.forEach((input, index) => {
      input.addEventListener('input', () => {
        let val = input.value.replace(/[^a-zA-Z]/g, '').toUpperCase();
        
        // Remove duplicate characters
        val = Array.from(new Set(val.split(''))).join('');
        input.value = val;

        const cell = input.parentElement;
        if (val) {
          cell.classList.add('filled');
        } else {
          cell.classList.remove('filled');
        }
        
        onInputsChanged();
      });

      // Backspace behavior to move backward if cell is empty
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !input.value && index > 0) {
          misplacedInputs[index - 1].focus();
        }
      });
    });

    // Grey Input - clean duplicate characters, uppercase
    greyInput.addEventListener('input', () => {
      let val = greyInput.value.replace(/[^a-zA-Z]/g, '').toUpperCase();
      val = Array.from(new Set(val.split(''))).join('');
      greyInput.value = val;
      onInputsChanged();
    });

    // Reset Button
    btnReset.addEventListener('click', () => {
      resetAll();
    });

    // Solve Button (Manual trigger just in case)
    btnSolve.addEventListener('click', () => {
      solve();
    });

    // Filter and Sort inputs
    searchInput.addEventListener('input', () => {
      filterDisplayList();
    });

    sortSelect.addEventListener('change', () => {
      sortAndRender();
    });
  }

  // Initialize event listeners for interactive starter tiles
  function initStarterTiles() {
    interactiveTiles.forEach(tile => {
      tile.addEventListener('click', () => {
        const char = tile.dataset.char.toUpperCase();
        const index = parseInt(tile.dataset.index);

        // Determine current state
        let currentState = 'default';
        if (tile.classList.contains('state-absent')) currentState = 'absent';
        else if (tile.classList.contains('state-present')) currentState = 'present';
        else if (tile.classList.contains('state-correct')) currentState = 'correct';

        // Cycle state: default -> absent -> present -> correct -> default
        let nextState = 'default';
        if (currentState === 'default') nextState = 'absent';
        else if (currentState === 'absent') nextState = 'present';
        else if (currentState === 'present') nextState = 'correct';

        // Apply visual rotation animation
        tile.style.transform = 'rotateX(90deg)';
        setTimeout(() => {
          updateInputsFromTileChange(char, index, nextState);
          syncInputsToStarterTiles(); // Reflect state
          tile.style.transform = '';
          solve(); // Solve dynamically
        }, 150);
      });
    });
  }

  // Initialize QWERTY keyboard clicks
  function initVirtualKeyboard() {
    keys.forEach(keyElement => {
      keyElement.addEventListener('click', () => {
        const key = keyElement.dataset.key;
        
        // Find if this key is already correct or misplaced in the grids
        const correct = Array.from(correctInputs).map(input => input.value.toUpperCase());
        const misplaced = Array.from(misplacedInputs).map(input => input.value.toUpperCase());
        
        const isGreen = correct.includes(key);
        const isYellow = misplaced.some(val => val.includes(key));

        // If the key is already green or yellow, do not toggle it in the grey list
        // (to prevent contradictory states).
        if (isGreen || isYellow) {
          showToast(`"${key}" is already confirmed in the grid!`);
          return;
        }

        // Toggle letter in grey letters textbox
        let greyVal = greyInput.value.toUpperCase();
        if (greyVal.includes(key)) {
          // Remove from grey
          greyVal = greyVal.replace(new RegExp(key, 'g'), '');
        } else {
          // Add to grey
          greyVal += key;
        }
        
        greyInput.value = Array.from(new Set(greyVal.split(''))).join('');
        onInputsChanged();
      });
    });
  }

  // Initialize stats section collapse button
  function initStatsToggle() {
    toggleStatsBtn.addEventListener('click', () => {
      showStats = !showStats;
      if (showStats) {
        statsGrid.style.display = 'grid';
        toggleStatsBtn.textContent = 'Hide Statistics';
      } else {
        statsGrid.style.display = 'none';
        toggleStatsBtn.textContent = 'Show Statistics';
      }
    });
  }

  // Sync click-to-color updates to Step 2 input DOM values
  function updateInputsFromTileChange(char, index, state) {
    let greyVal = greyInput.value.toUpperCase();

    if (state === 'default') {
      // Clear from correct
      if (correctInputs[index].value.toUpperCase() === char) {
        correctInputs[index].value = '';
        correctInputs[index].parentElement.classList.remove('filled');
      }
      // Clear from misplaced
      misplacedInputs[index].value = misplacedInputs[index].value.replace(new RegExp(char, 'gi'), '');
      if (!misplacedInputs[index].value) {
        misplacedInputs[index].parentElement.classList.remove('filled');
      }
      // Clear from grey
      greyVal = greyVal.replace(new RegExp(char, 'g'), '');
    } 
    else if (state === 'absent') {
      // Add to grey
      if (!greyVal.includes(char)) greyVal += char;
      // Clear correct
      if (correctInputs[index].value.toUpperCase() === char) {
        correctInputs[index].value = '';
        correctInputs[index].parentElement.classList.remove('filled');
      }
      // Clear misplaced
      misplacedInputs[index].value = misplacedInputs[index].value.replace(new RegExp(char, 'gi'), '');
      if (!misplacedInputs[index].value) {
        misplacedInputs[index].parentElement.classList.remove('filled');
      }
    } 
    else if (state === 'present') {
      // Clear grey
      greyVal = greyVal.replace(new RegExp(char, 'g'), '');
      // Clear correct
      if (correctInputs[index].value.toUpperCase() === char) {
        correctInputs[index].value = '';
        correctInputs[index].parentElement.classList.remove('filled');
      }
      // Add to misplaced
      let misplacedVal = misplacedInputs[index].value.toUpperCase();
      if (!misplacedVal.includes(char)) misplacedVal += char;
      misplacedInputs[index].value = misplacedVal;
      misplacedInputs[index].parentElement.classList.add('filled');
    } 
    else if (state === 'correct') {
      // Clear grey
      greyVal = greyVal.replace(new RegExp(char, 'g'), '');
      // Clear misplaced
      misplacedInputs[index].value = misplacedInputs[index].value.replace(new RegExp(char, 'gi'), '');
      if (!misplacedInputs[index].value) {
        misplacedInputs[index].parentElement.classList.remove('filled');
      }
      // Set correct
      correctInputs[index].value = char;
      correctInputs[index].parentElement.classList.add('filled');
    }

    // Clean grey string
    greyInput.value = Array.from(new Set(greyVal.split(''))).join('');
  }

  // Bidirectional binding: Sync Step 2 input states back to Step 1 tiles
  function syncInputsToStarterTiles() {
    const correct = Array.from(correctInputs).map(input => input.value.toUpperCase());
    
    const misplaced = Array.from(misplacedInputs).map(input => input.value.toUpperCase());
    
    const grey = greyInput.value.toUpperCase();

    interactiveTiles.forEach(tile => {
      const char = tile.dataset.char.toUpperCase();
      const index = parseInt(tile.dataset.index);

      // Clean classes
      tile.className = 'interactive-tile';

      if (correct[index] === char) {
        tile.classList.add('state-correct');
      } else if (misplaced[index].includes(char)) {
        tile.classList.add('state-present');
      } else if (grey.includes(char)) {
        tile.classList.add('state-absent');
      }
    });
  }

  // Updates visual state of QWERTY keyboard elements
  function updateKeyboard() {
    const correct = Array.from(correctInputs).map(input => input.value.toUpperCase());
    const misplaced = Array.from(misplacedInputs).map(input => input.value.toUpperCase());
    const grey = greyInput.value.toUpperCase();

    keys.forEach(keyElement => {
      const key = keyElement.dataset.key;
      keyElement.className = 'key'; // Reset class

      // 1. Correct (Green) check
      if (correct.includes(key)) {
        keyElement.classList.add('key-correct');
      } 
      // 2. Misplaced (Yellow) check
      else if (misplaced.some(val => val.includes(key))) {
        keyElement.classList.add('key-present');
      } 
      // 3. Excluded (Grey) check
      else if (grey.includes(key)) {
        keyElement.classList.add('key-absent');
      }
    });
  }

  // Trigger solve & visuals when grids change
  function onInputsChanged() {
    syncInputsToStarterTiles();
    updateKeyboard();
    solve();
  }

  // Reset all inputs and values
  function resetAll() {
    correctInputs.forEach(input => {
      input.value = '';
      input.parentElement.classList.remove('filled');
    });
    misplacedInputs.forEach(input => {
      input.value = '';
      input.parentElement.classList.remove('filled');
    });
    greyInput.value = '';
    searchInput.value = '';
    sortSelect.value = 'frequency';

    // Clear tile and keyboard states
    interactiveTiles.forEach(tile => {
      tile.className = 'interactive-tile';
    });
    keys.forEach(keyElement => {
      keyElement.className = 'key';
    });

    filteredWords = [...WORDLE_WORDS];
    displayWords = [...filteredWords];
    
    sortAndRender();
  }

  // Main Solver logic
  function solve() {
    // 1. Gather inputs
    const correct = Array.from(correctInputs).map(input => input.value.toLowerCase() || null);
    
    const misplaced = Array.from(misplacedInputs).map(input => {
      return input.value.toLowerCase().split('').filter(c => c);
    });
    
    const grey = greyInput.value.toLowerCase().split('').filter(c => c);
    const greySet = new Set(grey);

    // Identify which letters are definitely in the word
    const presentLetters = new Set();
    correct.forEach(c => { if (c) presentLetters.add(c); });
    misplaced.forEach(arr => arr.forEach(c => presentLetters.add(c)));

    // 2. Filter wordlist
    filteredWords = WORDLE_WORDS.filter(word => {
      const w = word.toLowerCase();

      // Check Green constraints (correct position)
      for (let i = 0; i < 5; i++) {
        if (correct[i] && w[i] !== correct[i]) {
          return false;
        }
      }

      // Check Yellow constraints (cannot be at the misplaced index)
      for (let i = 0; i < 5; i++) {
        if (misplaced[i].length > 0) {
          for (const char of misplaced[i]) {
            if (w[i] === char) {
              return false;
            }
          }
        }
      }

      // Check Yellow presence (must contain the yellow letters)
      for (const char of presentLetters) {
        if (!w.includes(char)) {
          return false;
        }
      }

      // Check Grey constraints (excluded letters)
      for (const char of greySet) {
        // Count occurrences of this letter in correct & misplaced
        const greenCount = correct.filter(c => c === char).length;
        const yellowCount = misplaced.filter(arr => arr.includes(char)).length;
        
        // If the letter is also green or yellow, it is in the word
        if (presentLetters.has(char)) {
          // Limit total occurrence of this letter in candidate word
          const maxOccurrences = greenCount + yellowCount;
          const currentOccurrences = w.split('').filter(c => c === char).length;
          if (currentOccurrences > maxOccurrences) {
            return false;
          }
        } else {
          // If not in correct or misplaced, it must NOT appear at all
          if (w.includes(char)) {
            return false;
          }
        }
      }

      return true;
    });

    filterDisplayList();
  }

  // Filter display list based on keyword search
  function filterDisplayList() {
    const query = searchInput.value.toLowerCase().trim();
    if (query) {
      displayWords = filteredWords.filter(word => word.toLowerCase().includes(query));
    } else {
      displayWords = [...filteredWords];
    }
    
    sortAndRender();
  }

  // Sort and Render the list of solutions
  function sortAndRender() {
    const method = sortSelect.value;
    
    if (method === 'alpha') {
      displayWords.sort();
    } else if (method === 'frequency') {
      const frequencies = calculateLetterFrequencies(displayWords);
      
      displayWords.sort((a, b) => {
        const scoreA = getWordScore(a, frequencies);
        const scoreB = getWordScore(b, frequencies);
        return scoreB - scoreA; // Descending
      });
    }

    renderStatsChart();
    renderSuggestions();
  }

  // Calculate letter frequencies across current set of possible words
  function calculateLetterFrequencies(words) {
    const freq = {};
    for (let charCode = 97; charCode <= 122; charCode++) {
      freq[String.fromCharCode(charCode)] = 0;
    }
    
    words.forEach(word => {
      // Use unique letters per word to reward diversity
      const uniqueLetters = new Set(word.toLowerCase().split(''));
      uniqueLetters.forEach(char => {
        if (freq[char] !== undefined) {
          freq[char]++;
        }
      });
    });
    
    return freq;
  }

  // Get score for a word based on letter frequencies of its UNIQUE letters
  function getWordScore(word, frequencies) {
    const unique = new Set(word.toLowerCase().split(''));
    let score = 0;
    unique.forEach(char => {
      score += (frequencies[char] || 0);
    });
    return score;
  }

  // Render the remaining letters statistics bar chart
  function renderStatsChart() {
    statsGrid.innerHTML = '';
    
    if (displayWords.length <= 1) {
      statsGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 0.5rem 0;">No further statistics (1 or fewer words left)</div>';
      return;
    }

    // Identify which letters are already solved/placed in correct or misplaced grids
    const correct = Array.from(correctInputs).map(input => input.value.toLowerCase());
    const misplaced = Array.from(misplacedInputs).map(input => input.value.toLowerCase());
    const knownLetters = new Set();
    correct.forEach(c => { if (c) knownLetters.add(c); });
    misplaced.forEach(val => {
      val.split('').forEach(char => {
        if (char) knownLetters.add(char);
      });
    });

    // Calculate percentage occurrence for each letter in the remaining list of words
    const letterCounts = {};
    for (let charCode = 97; charCode <= 122; charCode++) {
      letterCounts[String.fromCharCode(charCode)] = 0;
    }

    displayWords.forEach(word => {
      const unique = new Set(word.toLowerCase().split(''));
      unique.forEach(char => {
        if (letterCounts[char] !== undefined) {
          letterCounts[char]++;
        }
      });
    });

    // Format list of stats, filter out letters already green/yellow, filter out letters at 0%
    const statsList = [];
    Object.keys(letterCounts).forEach(char => {
      const count = letterCounts[char];
      if (count > 0 && !knownLetters.has(char)) {
        const percentage = Math.round((count / displayWords.length) * 100);
        statsList.push({ letter: char.toUpperCase(), percentage });
      }
    });

    // Sort by percentage descending
    statsList.sort((a, b) => b.percentage - a.percentage);

    // Limit to top 8 letters to keep UI clean
    const topStats = statsList.slice(0, 8);

    if (topStats.length === 0) {
      statsGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 0.5rem 0;">No remaining letters to analyze</div>';
      return;
    }

    // Render bars
    topStats.forEach(stat => {
      const item = document.createElement('div');
      item.className = 'stats-item';
      item.innerHTML = `
        <div class="stats-item-header">
          <span class="stats-letter">${stat.letter}</span>
          <span class="stats-pct">${stat.percentage}%</span>
        </div>
        <div class="stats-bar-bg">
          <div class="stats-bar-fill" style="width: ${stat.percentage}%"></div>
        </div>
      `;
      statsGrid.appendChild(item);
    });
  }

  // Render suggestion elements into Step 3 box
  function renderSuggestions() {
    suggestionsContainer.innerHTML = '';
    resultsCount.textContent = displayWords.length;

    if (displayWords.length === 0) {
      suggestionsContainer.innerHTML = `
        <div class="empty-state">
          <span class="empty-state-icon">🔍</span>
          <p>No matching words found. Check your inputs for conflicting letters.</p>
        </div>
      `;
      return;
    }

    const maxRender = 250;
    const renderList = displayWords.slice(0, maxRender);

    const frequencies = calculateLetterFrequencies(displayWords);
    const maxScore = Math.max(...displayWords.map(w => getWordScore(w, frequencies))) || 1;

    renderList.forEach(word => {
      const chip = document.createElement('div');
      chip.className = 'word-chip';
      
      const score = getWordScore(word, frequencies);
      const matchPct = Math.round((score / maxScore) * 100);

      chip.innerHTML = `
        <span class="word-chip-text">${word.toUpperCase()}</span>
        <span class="word-chip-meta">Score: ${matchPct}%</span>
      `;

      // Copy word on click
      chip.addEventListener('click', () => {
        copyToClipboard(word.toUpperCase());
      });

      suggestionsContainer.appendChild(chip);
    });

    if (displayWords.length > maxRender) {
      const moreBanner = document.createElement('div');
      moreBanner.className = 'empty-state';
      moreBanner.style.gridColumn = '1 / -1';
      moreBanner.style.padding = '1.5rem';
      moreBanner.innerHTML = `<p>... and ${displayWords.length - maxRender} more words. Narrow down with search or more clues.</p>`;
      suggestionsContainer.appendChild(moreBanner);
    }
  }

  // Copy-to-clipboard functionality
  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
      showToast(`Copied "${text}" to clipboard!`);
    }).catch(err => {
      console.error('Failed to copy: ', err);
      showToast('Could not copy automatically.');
    });
  }

  // Toast utility
  let toastTimeout;
  function showToast(message) {
    clearTimeout(toastTimeout);
    toastMessage.textContent = message;
    toast.classList.add('show');
    
    toastTimeout = setTimeout(() => {
      toast.classList.remove('show');
    }, 2500);
  }
});
