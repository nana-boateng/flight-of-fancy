# Film Finance Finder

An automated system that continuously searches the internet for film financing
opportunities to help emerging filmmakers reach their funding goal of CAD
$30,000.

## Features

- **Daily Web Scraping**: Automatically scans Canadian funding agencies, news
  sites, and industry feeds
- **Smart Filtering**: Filters opportunities suitable for emerging filmmakers
  (excludes those requiring extensive portfolios)
- **Difficulty Scoring**: Rates each opportunity by difficulty (1-10 scale)
- **Daily Notifications**: Sends daily digest via local `notify.sh` instance
- **Database Tracking**: Maintains SQLite database of all opportunities and
  progress
- **Continuous Operation**: Runs automatically every day until funding goal is
  reached

## Quick Start

1. Install dependencies:

```bash
pip install -r requirements.txt
```

2. Make notification script executable:

```bash
chmod +x notify.sh
```

3. Run the system:

```bash
python film_finance_finder.py
```

## Configuration

Edit `config.json` to customize:

- Target funding amount
- Sources to monitor
- Notification preferences
- Filtering criteria

## Notification Methods

The system uses `notify.sh` which outputs to a log file:

**Output File**: `funding_opportunities.log`

Each notification includes:

- Timestamp
- Opportunity title
- Full details
- Clear separators for readability

**To monitor opportunities:**

```bash
tail -f funding_opportunities.log
```

**To review all opportunities:**

```bash
cat funding_opportunities.log
```

## Monitored Sources

### Canadian Funding

- Telefilm Canada
- SODEC (Québec)
- Ontario Creates
- Creative BC
- Other provincial agencies

### News & Industry

- IndieWire
- Variety
- Hollywood Reporter
- Filmmaker Magazine
- Playback Online

### Search Monitoring

- Film funding opportunities
- Angel investors
- Crowdfunding campaigns
- Grant opportunities

## Database

The system maintains two SQLite tables:

- `opportunities`: Tracks all funding opportunities found
- `funding_progress`: Tracks actual funding secured

## Automation

The system runs automatically at 9:00 AM daily and will continue operating until
the CAD $30,000 goal is reached.

## Filtering Logic

- **Includes**: Emerging filmmaker opportunities, grants under $10,000, pitch
  competitions
- **Excludes**: Opportunities requiring extensive filmography, established
  filmmaker programs

## Logs

- `film_finance.log`: Application logs
- `notifications.log`: Notification history
- `film_finance.db`: SQLite database

## Requirements

- Python 3.7+
- Internet connection
- `notify.sh` script (included)
- Linux/macOS/Windows with bash
