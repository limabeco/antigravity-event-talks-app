// Application State
let state = {
    entries: [],
    filteredEntries: [],
    selectedEntryId: null,
    activeCategory: 'all',
    searchQuery: ''
};

// DOM Elements
const refreshBtn = document.getElementById('refresh-btn');
const refreshIcon = refreshBtn.querySelector('.refresh-icon');
const exportCsvBtn = document.getElementById('export-csv-btn');
const feedContent = document.getElementById('feed-content');
const searchInput = document.getElementById('search-input');
const categoryTabs = document.getElementById('category-tabs');
const feedStatus = document.getElementById('feed-status');
const statusDot = feedStatus.querySelector('.status-indicator-dot');
const statusText = feedStatus.querySelector('.status-text');

// Twitter Composer Elements
const tweetTextarea = document.getElementById('tweet-textarea');
const charCount = document.getElementById('char-count');
const tweetBtn = document.getElementById('tweet-btn');
const previewText = document.getElementById('preview-text');
const postLinkCard = document.getElementById('post-link-card');
const linkCardTitle = document.getElementById('link-card-title');

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    fetchReleaseNotes();
    setupEventListeners();
});

// Setup Event Listeners
function setupEventListeners() {
    // Refresh Button Click
    refreshBtn.addEventListener('click', fetchReleaseNotes);

    // Export CSV Button Click
    exportCsvBtn.addEventListener('click', exportFeedToCSV);

    // Search Input
    searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value.toLowerCase().trim();
        filterAndRenderFeed();
    });

    // Category Tabs
    categoryTabs.addEventListener('click', (e) => {
        if (e.target.classList.contains('tab-btn')) {
            // Update Active Class
            categoryTabs.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');

            // Update State
            state.activeCategory = e.target.dataset.category;
            filterAndRenderFeed();
        }
    });

    // Tweet Textarea Input
    tweetTextarea.addEventListener('input', () => {
        updateTweetPreview();
    });

    // Tweet Button Click
    tweetBtn.addEventListener('click', () => {
        const text = tweetTextarea.value.trim();
        if (text) {
            const url = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;
            window.open(url, '_blank');
        }
    });
}

// Fetch Release Notes from Flask API
async function fetchReleaseNotes() {
    // Show Loading State
    setLoadingState(true);
    renderSkeletons();

    try {
        const response = await fetch('/api/release-notes');
        const data = await response.json();

        if (data.success && data.entries) {
            state.entries = data.entries;
            filterAndRenderFeed();
            setLoadingState(false, 'Synced');
        } else {
            throw new Error(data.error || 'Failed to fetch release notes.');
        }
    } catch (error) {
        console.error('Error fetching release notes:', error);
        renderErrorState(error.message);
        setLoadingState(false, 'Sync Failed', true);
    }
}

// Set Loading UI State
function setLoadingState(isLoading, statusMsg = 'Ready', isError = false) {
    if (isLoading) {
        refreshBtn.disabled = true;
        refreshIcon.classList.add('spinning');
        statusDot.className = 'status-indicator-dot dot-loading';
        statusText.textContent = 'Syncing...';
    } else {
        refreshBtn.disabled = false;
        refreshIcon.classList.remove('spinning');
        if (isError) {
            statusDot.className = 'status-indicator-dot';
            statusDot.style.backgroundColor = 'var(--color-breaking)';
            statusDot.style.boxShadow = '0 0 8px var(--color-breaking)';
            statusText.textContent = statusMsg;
        } else {
            statusDot.className = 'status-indicator-dot dot-active';
            statusDot.removeAttribute('style');
            statusText.textContent = statusMsg;
            // Revert status to 'Ready' after 3 seconds
            setTimeout(() => {
                if (statusText.textContent === 'Synced') {
                    statusText.textContent = 'Ready';
                }
            }, 3000);
        }
    }
}

// Render skeleton loaders
function renderSkeletons() {
    feedContent.innerHTML = `
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>
    `;
}

// Render error message inside feed
function renderErrorState(errorMessage) {
    feedContent.innerHTML = `
        <div class="no-results">
            <i class="fa-solid fa-circle-exclamation" style="color: var(--color-breaking);"></i>
            <h3>Error Syncing Release Notes</h3>
            <p>${errorMessage}</p>
            <button class="btn btn-primary" onclick="fetchReleaseNotes()" style="margin-top: 10px;">
                <i class="fa-solid fa-arrows-rotate"></i> Try Again
            </button>
        </div>
    `;
}

// Filter and Render Feed Cards
function filterAndRenderFeed() {
    state.filteredEntries = state.entries.filter(entry => {
        // Category Filter
        const matchesCategory = state.activeCategory === 'all' || 
            entry.type.toLowerCase() === state.activeCategory;

        // Search Filter
        const matchesSearch = !state.searchQuery || 
            entry.type.toLowerCase().includes(state.searchQuery) ||
            entry.date.toLowerCase().includes(state.searchQuery) ||
            entry.text.toLowerCase().includes(state.searchQuery);

        return matchesCategory && matchesSearch;
    });

    renderFeed();
}

// Render Feed Cards UI
function renderFeed() {
    if (state.filteredEntries.length === 0) {
        feedContent.innerHTML = `
            <div class="no-results">
                <i class="fa-solid fa-folder-open"></i>
                <h3>No Updates Found</h3>
                <p>Try clearing your search query or selecting a different filter category tab.</p>
            </div>
        `;
        return;
    }

    feedContent.innerHTML = state.filteredEntries.map(entry => {
        const typeClass = entry.type.toLowerCase();
        const isSelected = entry.id === state.selectedEntryId;
        const badgeClass = `badge badge-${typeClass}`;
        
        return `
            <div class="release-card ${isSelected ? 'selected' : ''}" data-id="${entry.id}">
                <div class="card-header">
                    <div class="card-meta">
                        <span class="${badgeClass}">${entry.type}</span>
                        <span class="date-stamp">${entry.date}</span>
                    </div>
                    <div class="card-select-indicator">
                        <i class="fa-solid fa-check"></i>
                    </div>
                </div>
                <div class="card-body">
                    ${entry.html}
                </div>
                <div class="card-footer">
                    <button class="card-copy-btn" data-id="${entry.id}">
                        <i class="fa-regular fa-copy copy-icon"></i> <span>Copy</span>
                    </button>
                    <button class="card-tweet-trigger" data-id="${entry.id}">
                        <i class="fa-brands fa-x-twitter"></i> Select to Tweet
                    </button>
                </div>
            </div>
        `;
    }).join('');

    // Attach Click Events to Cards
    feedContent.querySelectorAll('.release-card').forEach(card => {
        const id = card.dataset.id;
        const entry = state.entries.find(e => e.id === id);

        card.addEventListener('click', (e) => {
            // Prevent double triggers if clicking on links or select buttons specifically
            if (e.target.tagName === 'A') return;
            selectCardForTweet(entry);
        });

        // Trigger button inside card
        const triggerBtn = card.querySelector('.card-tweet-trigger');
        triggerBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // prevent card click bubble
            selectCardForTweet(entry);
        });

        // Copy button inside card
        const copyBtn = card.querySelector('.card-copy-btn');
        copyBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // prevent card click bubble
            copyEntryToClipboard(entry, copyBtn);
        });
    });
}

// Select a Release Note Card and pre-fill Twitter Composer
function selectCardForTweet(entry) {
    state.selectedEntryId = entry.id;

    // Toggle selected class on UI cards
    feedContent.querySelectorAll('.release-card').forEach(card => {
        if (card.dataset.id === entry.id) {
            card.classList.add('selected');
        } else {
            card.classList.remove('selected');
        }
    });

    // Formulate a beautiful tweet within the 280-char limit
    const prefix = `📢 BigQuery ${entry.type} (${entry.date}): `;
    const link = entry.link || 'https://cloud.google.com/bigquery/docs/release-notes';
    const suffix = `\n\nRead details: ${link}`;

    // X counts any URL as 23 characters, so let's budget 23 for suffix link rather than its literal length
    const simulatedSuffixLength = suffix.length - link.length + 23;
    const textBudget = 280 - prefix.length - simulatedSuffixLength;

    let updateText = entry.text;
    if (updateText.length > textBudget) {
        updateText = updateText.substring(0, textBudget - 3) + '...';
    }

    const prefilledTweet = `${prefix}${updateText}${suffix}`;

    // Update Textarea and trigger live preview
    tweetTextarea.value = prefilledTweet;
    updateTweetPreview();

    // Show simulated link card preview
    postLinkCard.style.display = 'block';
    linkCardTitle.textContent = `BigQuery Release Notes (${entry.date})`;
}

// Update character counts and live Twitter post preview card
function updateTweetPreview() {
    const text = tweetTextarea.value;
    
    // Parse length with X's standard (all URLs are 23 characters)
    // Find URLs in text and calculate length
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    let computedLength = text.length;
    const urls = text.match(urlRegex);
    
    if (urls) {
        urls.forEach(url => {
            computedLength = computedLength - url.length + 23;
        });
    }

    // Update Char Counter Element
    charCount.textContent = computedLength;

    if (computedLength > 280) {
        charCount.className = 'char-counter danger';
        tweetBtn.disabled = true;
    } else if (computedLength > 250) {
        charCount.className = 'char-counter warning';
        tweetBtn.disabled = false;
    } else {
        charCount.className = 'char-counter';
        tweetBtn.disabled = computedLength === 0;
    }

    // Update simulated Twitter post text preview
    if (text.trim() === '') {
        previewText.textContent = 'Select an update to preview your tweet card here.';
        postLinkCard.style.display = 'none';
        tweetBtn.disabled = true;
    } else {
        // Highlight tags or links in preview for premium aesthetic
        let highlightedText = escapeHtml(text);
        
        // Match links
        highlightedText = highlightedText.replace(urlRegex, '<span style="color: #1d9bf0;">$1</span>');
        
        // Match hashtags or mentions if any
        highlightedText = highlightedText.replace(/(^|\s)(#[a-z\d-_]+)/ig, '$1<span style="color: #1d9bf0;">$2</span>');
        highlightedText = highlightedText.replace(/(^|\s)(@[a-z\d-_]+)/ig, '$1<span style="color: #1d9bf0;">$2</span>');

        previewText.innerHTML = highlightedText;
    }
}

// Utility function to escape HTML string
function escapeHtml(unsafe) {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

// Copy release note contents to user's clipboard
function copyEntryToClipboard(entry, btn) {
    const textToCopy = `📢 BigQuery ${entry.type} (${entry.date}):\n${entry.text}\n\nRead details: ${entry.link}`;
    
    navigator.clipboard.writeText(textToCopy).then(() => {
        const icon = btn.querySelector('.copy-icon');
        const textSpan = btn.querySelector('span');
        
        icon.className = 'fa-solid fa-check copy-icon';
        textSpan.textContent = 'Copied!';
        btn.style.color = 'var(--color-feature)';
        
        setTimeout(() => {
            icon.className = 'fa-regular fa-copy copy-icon';
            textSpan.textContent = 'Copy';
            btn.style.color = '';
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy: ', err);
    });
}

// Export currently active/filtered feed entries to CSV
function exportFeedToCSV() {
    if (state.filteredEntries.length === 0) {
        alert('No entries available to export.');
        return;
    }
    
    const csvRows = [];
    // CSV Header row
    csvRows.push(["ID", "Date", "Type", "Description", "Link"].map(h => `"${h.replace(/"/g, '""')}"`).join(","));
    
    // Add data rows
    state.filteredEntries.forEach(entry => {
        const row = [
            entry.id,
            entry.date,
            entry.type,
            entry.text.replace(/\r?\n|\r/g, ' '),
            entry.link
        ];
        csvRows.push(row.map(val => `"${val.replace(/"/g, '""')}"`).join(","));
    });
    
    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const filename = `bigquery_release_notes_${state.activeCategory}_${new Date().toISOString().slice(0,10)}.csv`;
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
