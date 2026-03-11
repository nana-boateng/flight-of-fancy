const watchForm = document.querySelector('#watch-form');
const formStatus = document.querySelector('#form-status');
const watchesNode = document.querySelector('#watches');
const matchesNode = document.querySelector('#matches');
const refreshButton = document.querySelector('#refresh-btn');
const runButton = document.querySelector('#scan-btn');
const runStatus = document.querySelector('#run-status');
const ntfyForm = document.querySelector('#ntfy-form');
const ntfyStatus = document.querySelector('#ntfy-status');

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
        <small>${escapeHtml(safeUrl(watch.amazonUrl, ''))}</small><br />
        Ref: ${money(watch.referencePriceCents)} (${watch.priceSource})<br />
        Keywords: ${escapeHtml(watch.keywords.join(', '))}<br />
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

watchForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  formStatus.textContent = 'Adding watch...';

  const payload = {
    amazonUrl: document.querySelector('#amazon-url').value,
    keywords: toKeywordArray(document.querySelector('#keywords').value),
    manualTitle: document.querySelector('#manual-title').value || null,
    manualReferencePrice: document.querySelector('#manual-price').value || null,
  };

  const response = await fetch('/api/watches', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    formStatus.textContent = data.error || 'Could not add watch';
    return;
  }

  formStatus.textContent = 'Watch added.';
  watchForm.reset();
  await refresh();
});

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
