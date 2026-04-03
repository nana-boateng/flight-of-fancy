# Finance Film v2

Automated film funding opportunity finder for emerging filmmakers in Toronto/Ontario/Canada.

## Features

- **Multi-source collection**: RSS feeds, web scraping, optional AI research
- **Smart scoring**: Weighted scoring based on filmmaker profile fit
- **Deduplication**: Fuzzy title matching and URL canonicalization
- **Multi-channel notifications**: ntfy push + file log
- **SQLite database**: Full history tracking with proper indexes
- **CLI + cron**: Simple deployment model

## Quick Start

```bash
# Install dependencies
pip install -e ".[dev]"

# Run a scan
finance-film scan

# List opportunities
finance-film list --new --limit 20

# Send digest
finance-film notify

# Health check
finance-film health
```

## Configuration

Copy `.env.example` to `.env` and customize:

```bash
cp .env.example .env
```

Key settings:

| Setting | Description | Default |
|---------|-------------|---------|
| `FILMMAKER__TARGET_AMOUNT_CAD` | Target funding amount | 30000 |
| `FILMMAKER__LOCATION` | Geographic focus | Toronto, Ontario, Canada |
| `NOTIFICATIONS__NTFY_URL` | ntfy server URL | (disabled) |
| `AI__ENABLED` | Enable AI research | false |

## CLI Commands

### `finance-film scan`

Run the funding opportunity scan.

```bash
finance-film scan                    # Normal run
finance-film scan --dry-run          # Don't persist or notify
finance-film scan --ai               # Enable AI research
finance-film scan --no-ai            # Disable AI research
```

### `finance-film list`

List opportunities from database.

```bash
finance-film list                    # All opportunities
finance-film list --new              # Only new
finance-film list --min-score 7      # Fit score >= 7
finance-film list --limit 50         # Show 50
```

### `finance-film notify`

Send notification digest.

```bash
finance-film notify                  # Send digest of new opportunities
finance-film notify --limit 20       # Include up to 20
```

### `finance-film health`

Check system health.

```bash
finance-film health
```

## Cron Setup

Add to crontab for daily runs:

```cron
0 9 * * * cd /path/to/finance-my-film && /path/to/python -m finance_film.cli scan >> cron.log 2>&1
```

## Architecture

```
src/finance_film/
├── cli.py              # CLI commands
├── config.py           # Typed configuration
├── models.py           # Domain models
├── db/
│   ├── models.py       # SQLAlchemy models
│   └── repository.py   # CRUD operations
├── sources/
│   ├── base.py         # Source protocol
│   ├── http_client.py  # HTTP client with retry/rate-limit
│   ├── rss.py          # RSS feed adapter
│   ├── web.py          # Web scraping adapter
│   └── ai_provider.py  # AI research adapter (optional)
├── pipeline/
│   ├── scoring.py      # Scoring engine
│   ├── dedup.py        # Deduplication
│   └── runner.py       # Pipeline orchestrator
└── notifiers/
    ├── base.py         # Notifier protocol
    ├── ntfy.py         # ntfy channel
    ├── file.py         # File log channel
    └── manager.py      # Notification coordinator
```

## Development

```bash
# Install dev dependencies
pip install -e ".[dev]"

# Run tests
pytest

# Lint
ruff check src tests

# Type check
mypy src
```

## Migration from v1

v2 is a complete rewrite with a fresh database. To archive v1 data:

```bash
# Archive old files
mkdir -p .archive
mv film_finance.db .archive/
mv *.log .archive/
mv film_finance_finder.py .archive/
```

## License

MIT
