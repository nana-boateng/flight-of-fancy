/* ── DOM refs ── */
const urlInput = document.querySelector('#url-input');
const manualAsinInput = document.querySelector('#manual-asin');
const analyzeBtn = document.querySelector('#analyze-btn');
const analyzeStatus = document.querySelector('#analyze-status');
const directHibidUrlInput = document.querySelector('#direct-hibid-url');
const directHibidTitleInput = document.querySelector('#direct-hibid-title');
const directHibidPriceInput = document.querySelector('#direct-hibid-price');
const addDirectBtn = document.querySelector('#add-direct-btn');
const addDirectStatus = document.querySelector('#add-direct-status');

const stepUrls = document.querySelector('#step-urls');
const stepReview = document.querySelector('#step-review');
const urlDetailsNode = document.querySelector('#url-details');
const manualBanner = document.querySelector('#manual-banner');

const reviewTitle = document.querySelector('#review-title');
const reviewPrice = document.querySelector('#review-price');
const reviewPriceSource = document.querySelector('#review-price-source');
const reviewKeywords = document.querySelector('#review-keywords');
const reviewUrls = document.querySelector('#review-urls');
const reviewHibidUrls = document.querySelector('#review-hibid-urls');
const saveBtn = document.querySelector('#save-btn');
const backBtn = document.querySelector('#back-btn');
const saveStatus = document.querySelector('#save-status');

const watchesNode = document.querySelector('#watches');
const matchesNode = document.querySelector('#matches');
const refreshButton = document.querySelector('#refresh-btn');
const runButton = document.querySelector('#scan-btn');
const runStatus = document.querySelector('#run-status');
const ntfyForm = document.querySelector('#ntfy-form');
const ntfyStatus = document.querySelector('#ntfy-status');

/* ── helpers ── */
function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function safeUrl(value, fallback = '#') {
  try {
    const parsed = new URL(String(value));
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
  } catch {
    return fallback;
  }
  return fallback;
}

function money(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

function when(ms) {
  return new Date(ms).toLocaleString();
}

function toKeywordArray(input) {
  return input
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry, index, arr) => entry && arr.indexOf(entry) === index);
}

function parseUrls(text) {
  return text
    .split(/[\n,]+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function statusBadge(status) {
  const colors = { ok: '#16a34a', partial: '#ca8a04', failed: '#dc2626' };
  const labels = { ok: 'resolved', partial: 'partial', failed: 'failed' };
  const color = colors[status] || '#888';
  const label = labels[status] || status;
  return `<span style="color:${color};font-weight:700">${escapeHtml(label)}</span>`;
}

/* ── Step 1: Analyze URLs ── */
analyzeBtn.addEventListener('click', async () => {
  const urls = parseUrls(urlInput.value);
  const asin = manualAsinInput.value.trim();

  if (urls.length === 0 && !asin) {
    analyzeStatus.textContent = 'Enter at least one product URL or an ASIN.';
    return;
  }

  analyzeStatus.textContent = 'Analyzing...';
  analyzeBtn.disabled = true;

  try {
    const payload = {
      urls,
      manualAsin: asin || null,
      manualTitle: null,
      manualReferencePrice: null,
    };

    const response = await fetch('/api/analyze-urls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      analyzeStatus.textContent = data.error || 'Analysis failed.';
      return;
    }

    // Render per-URL details
    if (data.urlDetails && data.urlDetails.length > 0) {
      urlDetailsNode.innerHTML = data.urlDetails
        .map(
          (d) => `
          <div class="url-detail">
            ${statusBadge(d.status)}
            <span class="url-retailer">${escapeHtml(d.retailer || 'Unknown')}</span>
            ${d.asin ? `<span class="url-asin">ASIN: ${escapeHtml(d.asin)}</span>` : ''}
            ${d.title ? `&mdash; ${escapeHtml(d.title)}` : ''}
            ${d.priceCents ? ` &mdash; ${money(d.priceCents)}` : ''}
          </div>
        `,
        )
        .join('');
    } else {
      urlDetailsNode.innerHTML = '';
    }

    // Show/hide manual banner
    if (data.needsManualInput) {
      manualBanner.classList.remove('hidden');
    } else {
      manualBanner.classList.add('hidden');
    }

    // Pre-fill review fields
    reviewTitle.value = data.title || '';
    reviewPrice.value =
      data.referencePriceCents ? (data.referencePriceCents / 100).toFixed(2) : '';
    reviewPriceSource.value = data.priceSource || 'auto';
    reviewKeywords.value = (data.keywords || []).join(', ');
    reviewUrls.value = (data.sourceUrls || []).join('\n');

    // Focus the right field if manual input needed
    if (data.needsManualInput) {
      if (!data.title) {
        reviewTitle.focus();
      } else if (!data.referencePriceCents) {
        reviewPrice.focus();
      } else if (!data.keywords || data.keywords.length === 0) {
        reviewKeywords.focus();
      }
    }

    analyzeStatus.textContent = '';
    stepUrls.classList.add('hidden');
    stepReview.classList.remove('hidden');
  } catch {
    analyzeStatus.textContent = 'Network error during analysis.';
  } finally {
    analyzeBtn.disabled = false;
  }
});

addDirectBtn.addEventListener('click', async () => {
  const lotUrl = directHibidUrlInput.value.trim();
  const manualTitle = directHibidTitleInput.value.trim() || null;
  const manualReferencePrice = directHibidPriceInput.value
    ? Number(directHibidPriceInput.value)
    : null;

  if (!lotUrl) {
    addDirectStatus.textContent = 'Enter a HiBid lot URL.';
    directHibidUrlInput.focus();
    return;
  }

  addDirectStatus.textContent = 'Adding direct listing...';
  addDirectBtn.disabled = true;

  try {
    const response = await fetch('/api/watches/direct-lot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lotUrl,
        manualTitle,
        manualReferencePrice,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      addDirectStatus.textContent = data.error || 'Could not add listing.';
      return;
    }

    addDirectStatus.textContent = 'Direct listing added to watchlist.';
    directHibidUrlInput.value = '';
    directHibidTitleInput.value = '';
    directHibidPriceInput.value = '';
    await refresh();
  } catch {
    addDirectStatus.textContent = 'Network error while adding listing.';
  } finally {
    addDirectBtn.disabled = false;
  }
});

/* ── Step 2: Back ── */
backBtn.addEventListener('click', () => {
  stepReview.classList.add('hidden');
  stepUrls.classList.remove('hidden');
  saveStatus.textContent = '';
});

/* ── Step 2: Save watch ── */
saveBtn.addEventListener('click', async () => {
  const title = reviewTitle.value.trim();
  const keywords = toKeywordArray(reviewKeywords.value);
  const priceDollars = Number(reviewPrice.value);
  const sourceUrls = reviewUrls.value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const hibidUrls = reviewHibidUrls.value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (!title) {
    saveStatus.textContent = 'Title is required.';
    reviewTitle.focus();
    return;
  }
  if (keywords.length === 0 && hibidUrls.length === 0) {
    saveStatus.textContent = 'Add at least one keyword or one direct HiBid link.';
    reviewKeywords.focus();
    return;
  }
  if (!Number.isFinite(priceDollars) || priceDollars <= 0) {
    saveStatus.textContent = 'A valid reference price is required.';
    reviewPrice.focus();
    return;
  }

  saveStatus.textContent = 'Saving watch...';
  saveBtn.disabled = true;

  try {
    const payload = {
      title,
      keywords,
      referencePriceCents: Math.round(priceDollars * 100),
      priceSource: reviewPriceSource.value || 'manual',
      sourceUrls,
      hibidUrls,
    };

    const response = await fetch('/api/watches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      saveStatus.textContent = data.error || 'Could not save watch.';
      return;
    }

    saveStatus.textContent = 'Watch saved!';
    urlInput.value = '';
    manualAsinInput.value = '';
    reviewTitle.value = '';
    reviewPrice.value = '';
    reviewKeywords.value = '';
    reviewUrls.value = '';
    reviewHibidUrls.value = '';
    urlDetailsNode.innerHTML = '';
    manualBanner.classList.add('hidden');

    stepReview.classList.add('hidden');
    stepUrls.classList.remove('hidden');
    await refresh();
  } catch {
    saveStatus.textContent = 'Network error while saving.';
  } finally {
    saveBtn.disabled = false;
  }
});

/* ── Renders ── */
function renderWatches(watches) {
  if (watches.length === 0) {
    watchesNode.innerHTML = '<p>No watches yet.</p>';
    return;
  }

  watchesNode.innerHTML = watches
    .map(
      (watch) => `
      <div class="list-item">
        <strong>${escapeHtml(watch.title)}</strong><br />
        Ref: ${money(watch.referencePriceCents)} (${watch.priceSource})<br />
        Keywords: ${escapeHtml(watch.keywords.join(', '))}<br />
        ${
          watch.sourceUrls && watch.sourceUrls.length > 0
            ? `<small>Sources: ${watch.sourceUrls.map((u) => escapeHtml(u)).join(', ')}</small><br />`
            : ''
        }
        ${
          watch.hibidUrls && watch.hibidUrls.length > 0
            ? `<small>Direct HiBid: ${watch.hibidUrls.map((u) => escapeHtml(u)).join(', ')}</small><br />`
            : ''
        }
        <button data-delete="${watch.id}" class="ghost">Delete</button>
      </div>
    `,
    )
    .join('');

  watchesNode.querySelectorAll('button[data-delete]').forEach((button) => {
    button.addEventListener('click', async () => {
      await fetch(`/api/watches/${button.getAttribute('data-delete')}`, {
        method: 'DELETE',
      });
      await refresh();
    });
  });
}

function renderMatches(matches) {
  if (matches.length === 0) {
    matchesNode.innerHTML = '<p>No matches yet.</p>';
    return;
  }

  matchesNode.innerHTML = matches
    .map(
      (match) => `
      <div class="list-item">
        <a href="${escapeHtml(safeUrl(match.lotUrl, '#'))}" target="_blank" rel="noopener noreferrer">
          <strong>${escapeHtml(match.lotTitle)}</strong>
        </a><br />
        Watch: ${escapeHtml(match.watchTitle)}<br />
        Bid: ${money(match.bidCents)} | Ratio: ${(match.ratio * 100).toFixed(1)}%<br />
        Remaining: ${match.minutesRemaining ?? 'n/a'} min<br />
        Updated: ${when(match.updatedAtMs)}
      </div>
    `,
    )
    .join('');
}

async function refresh() {
  const response = await fetch('/api/dashboard');
  const data = await response.json();
  renderWatches(data.watches);
  renderMatches(data.recentMatches);

  document.querySelector('#ntfy-server').value = data.ntfy.server;
  document.querySelector('#ntfy-topic').value = data.ntfy.topic;
  document.querySelector('#ntfy-token').value = data.ntfy.token;

  if (data.latestRun) {
    runStatus.textContent = `Last run ${when(data.latestRun.finishedAtMs)} | lots: ${data.latestRun.totalLots} | matches: ${data.latestRun.totalCandidates} | notified: ${data.latestRun.totalNotified}`;
  } else {
    runStatus.textContent = 'No scan has completed yet.';
  }
}

/* ── Global actions ── */
runButton.addEventListener('click', async () => {
  runStatus.textContent = 'Running scan...';
  const response = await fetch('/api/run-now', { method: 'POST' });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    runStatus.textContent = data.error || 'Scan failed.';
    return;
  }

  runStatus.textContent = `Scan complete. Notified: ${data.totalNotified}`;
  await refresh();
});

refreshButton.addEventListener('click', () => {
  void refresh();
});

ntfyForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  ntfyStatus.textContent = 'Saving ntfy settings...';

  const payload = {
    server: document.querySelector('#ntfy-server').value,
    topic: document.querySelector('#ntfy-topic').value,
    token: document.querySelector('#ntfy-token').value,
  };

  const response = await fetch('/api/settings/ntfy', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    ntfyStatus.textContent = data.error || 'Could not save settings';
    return;
  }

  ntfyStatus.textContent = 'Settings saved.';
});

void refresh();
