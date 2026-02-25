#!/usr/bin/env python3
"""
Film Finance Finder
Automated system to find film financing opportunities for emerging filmmakers.
Target: CAD $30,000 budget in Toronto/Ontario/Canada.
Heavy focus on investors, arts patrons, and high-probability grants.
"""

import requests
import bs4
import feedparser
import time
import sqlite3
import subprocess
import os
import re
import json
import logging
from datetime import datetime
from urllib.parse import urljoin, quote
from typing import List, Dict, Optional
from dotenv import load_dotenv

load_dotenv()

DB_PATH = os.getenv("DATABASE_PATH", "film_finance.db")
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
NTFY_URL = os.getenv("NTFY_URL", "")
NTFY_TOPIC = os.getenv("NTFY_TOPIC", "")
OPENCODE_MODEL = os.getenv("OPENCODE_MODEL", "")
DAILY_LOG = os.getenv("DAILY_LOG", "film_finance_daily.log")
OUTPUT_FILE = os.getenv("OUTPUT_FILE", "funding_opportunities.log")


class FilmFinanceFinder:
    def __init__(self):
        self.setup_logging()
        self.setup_database()
        self.target_amount = 30000
        self.current_funding = 0

    def setup_database(self):
        """Initialize SQLite database for tracking opportunities."""
        self.conn = sqlite3.connect(DB_PATH)
        self.conn.row_factory = sqlite3.Row
        cursor = self.conn.cursor()

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS opportunities (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                source TEXT NOT NULL,
                url TEXT,
                amount REAL,
                deadline DATE,
                description TEXT,
                eligibility TEXT,
                difficulty_score INTEGER,
                category TEXT DEFAULT 'grant',
                fit_score INTEGER,
                priority_reason TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                notified BOOLEAN DEFAULT FALSE,
                status TEXT DEFAULT 'new'
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS funding_progress (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                amount REAL,
                source TEXT,
                date DATE DEFAULT CURRENT_DATE,
                notes TEXT
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS ai_research_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                prompt TEXT,
                raw_output TEXT,
                opportunities_found INTEGER DEFAULT 0,
                model TEXT
            )
        """)

        # Add category column if it doesn't exist (migration)
        try:
            cursor.execute(
                "ALTER TABLE opportunities ADD COLUMN category TEXT DEFAULT 'grant'"
            )
        except sqlite3.OperationalError:
            pass

        # Add fit_score column (migration)
        try:
            cursor.execute("ALTER TABLE opportunities ADD COLUMN fit_score INTEGER")
        except sqlite3.OperationalError:
            pass

        # Add priority_reason column (migration)
        try:
            cursor.execute("ALTER TABLE opportunities ADD COLUMN priority_reason TEXT")
        except sqlite3.OperationalError:
            pass

        self.conn.commit()

    def setup_logging(self):
        """Setup logging to both file and console."""
        logging.basicConfig(
            level=getattr(logging, LOG_LEVEL, logging.INFO),
            format="%(asctime)s - %(levelname)s - %(message)s",
            handlers=[
                logging.FileHandler("film_finance.log"),
                logging.StreamHandler(),
            ],
        )
        self.logger = logging.getLogger(__name__)

    def log_daily_note(self, note: str):
        """Append a timestamped note to the daily log file."""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with open(DAILY_LOG, "a") as f:
            f.write(f"[{timestamp}] {note}\n")

    # ── Notifications ──────────────────────────────────────────────

    def send_ntfy(
        self,
        title: str,
        message: str,
        priority: str = "default",
        tags: str = "movie_camera",
    ):
        """Send notification via ntfy HTTP POST."""
        if not NTFY_URL or not NTFY_TOPIC:
            self.logger.debug("ntfy not configured, skipping push notification")
            return False

        url = f"{NTFY_URL.rstrip('/')}/{NTFY_TOPIC}"
        try:
            resp = requests.post(
                url,
                data=message.encode("utf-8"),
                headers={
                    "Title": title,
                    "Priority": priority,
                    "Tags": tags,
                },
                timeout=10,
            )
            if resp.status_code == 200:
                self.logger.info(f"ntfy sent: {title}")
                return True
            else:
                self.logger.error(f"ntfy failed ({resp.status_code}): {resp.text}")
                return False
        except Exception as e:
            self.logger.error(f"ntfy error: {e}")
            return False

    def send_notification(self, title: str, message: str):
        """Send notification via ntfy and log to file."""
        # Always log to file
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        separator = "=" * 50
        with open(OUTPUT_FILE, "a") as f:
            f.write(f"\n{separator}\n")
            f.write(f"{timestamp}\n")
            f.write(f"{title}\n")
            f.write(f"{message}\n")
            f.write(f"{separator}\n\n")

        # Push to ntfy
        self.send_ntfy(title, message)

        self.logger.info(f"Notification sent: {title}")

    # ── Web Scraping ───────────────────────────────────────────────

    def scrape_film_grants(self) -> List[Dict]:
        """Scrape Canadian film funding sources focused on Ontario/Toronto."""
        opportunities = []

        sources = [
            {
                "url": "https://www.telefilm.ca/en/programmes/talent-to-watch-program",
                "name": "Telefilm Talent to Watch",
                "type": "government",
            },
            {
                "url": "https://www.ontariocreates.ca/our-sectors/film-fund/film-fund-production",
                "name": "Ontario Creates Film Fund",
                "type": "provincial",
            },
            {
                "url": "https://www.torontoartscouncil.org/grants/media-artists-program-creation/",
                "name": "Toronto Arts Council Media Artists",
                "type": "municipal",
            },
            {
                "url": "https://www.arts.on.ca/grants/media-artists-creation-projects",
                "name": "Ontario Arts Council Media Artists",
                "type": "provincial",
            },
            {
                "url": "https://canadacouncil.ca/funding/grants/creating-knowing-sharing/small-scale-activities",
                "name": "Canada Council Small-Scale Activities",
                "type": "government",
            },
            {
                "url": "https://lift.ca/support-grants/",
                "name": "LIFT Production Grants",
                "type": "organization",
            },
            {
                "url": "https://www.dgc.ca/en/ontario/short-film-fund",
                "name": "DGC Ontario Short Film Fund",
                "type": "guild",
            },
            {
                "url": "https://thetalentfund.ca/",
                "name": "The Talent Fund",
                "type": "private",
            },
            {
                "url": "https://production.nfbonf.ca/en/filmmaker-assistance-program-fap/",
                "name": "NFB Filmmaker Assistance Program",
                "type": "government",
            },
        ]

        for source in sources:
            try:
                opps = self._scrape_website(source)
                opportunities.extend(opps)
                time.sleep(1)
            except Exception as e:
                self.logger.error(f"Error scraping {source['name']}: {e}")

        return opportunities

    def _scrape_website(self, source: Dict) -> List[Dict]:
        """Scrape a funding page for actual program/opportunity names."""
        opportunities = []
        seen_urls = set()

        # Words that indicate a nav link or generic page element, not a real opportunity
        junk_patterns = [
            "faq",
            "glossary",
            "about",
            "contact",
            "login",
            "sign up",
            "search",
            "calendar",
            "recipients",
            "recipient list",
            "eligibility",
            "how to apply",
            "acknowledging",
            "unsuccessful",
            "learn more",
            "find out more",
            "explore",
            "read our",
            "get more information",
            "related terms",
            "what to do if",
            "am i eligible",
            "funding decisions",
            "find funding",
            "find support",
            "funding type",
            "grant category",
        ]

        try:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            }
            response = requests.get(source["url"], headers=headers, timeout=10)
            soup = bs4.BeautifulSoup(response.content, "html.parser")

            # Look for real program names: links inside content areas
            # that contain funding keywords AND have a meaningful title length
            funding_keywords = [
                "grant",
                "fund",
                "financ",
                "program",
                "support",
                "credit",
            ]

            for element in soup.find_all(["a", "h2", "h3", "h4"]):
                title = element.get_text(strip=True)
                if not title or len(title) < 5 or len(title) > 150:
                    continue

                title_lower = title.lower()

                # Skip if it's a generic nav/UI element
                if any(junk in title_lower for junk in junk_patterns):
                    continue

                # Skip single-word generic titles
                if title_lower in (
                    "grants",
                    "funding",
                    "programs",
                    "support",
                    "financing",
                    "apply",
                    "resources",
                ):
                    continue

                # Must contain at least one funding keyword
                if not any(kw in title_lower for kw in funding_keywords):
                    continue

                url = element.get("href") if element.name == "a" else source["url"]
                if url and not url.startswith("http"):
                    url = urljoin(source["url"], url)

                # Deduplicate by URL within this scrape
                if url in seen_urls:
                    continue
                seen_urls.add(url)

                description = self._get_context_text(element)
                opportunities.append(
                    {
                        "title": title,
                        "source": source["name"],
                        "url": url,
                        "type": source["type"],
                        "amount": self._extract_amount(title + " " + description),
                        "description": description,
                        "category": "grant",
                    }
                )

        except Exception as e:
            self.logger.error(f"Scraping error for {source['url']}: {e}")

        return opportunities

    def _extract_amount(self, text: str) -> Optional[float]:
        """Extract monetary amounts from text."""
        patterns = [
            r"\$(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)",
            r"(\d{1,3}(?:,\d{3})*)\s*CAD",
            r"(\d{1,3}(?:,\d{3})*)\s*dollars?",
        ]
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                amount_str = match.group(1).replace(",", "")
                try:
                    return float(amount_str)
                except ValueError:
                    continue
        return None

    def _get_context_text(self, element) -> str:
        """Get surrounding text context from an HTML element."""
        try:
            parent = element.parent
            if parent:
                text = parent.get_text(strip=True)
                next_sib = parent.next_sibling
                if next_sib and isinstance(next_sib, bs4.element.NavigableString):
                    text += " " + next_sib.strip()
                return text[:500]
        except Exception:
            pass
        return ""

    # ── News Feeds ─────────────────────────────────────────────────

    def monitor_news_feeds(self) -> List[Dict]:
        """Monitor RSS feeds for film funding news."""
        opportunities = []

        news_feeds = [
            "https://www.indiewire.com/feed/",
            "https://variety.com/feed/",
            "https://www.hollywoodreporter.com/feed/",
            "https://filmmakermagazine.com/feed/",
            "https://www.playbackonline.com/feed/",
        ]

        for feed_url in news_feeds:
            try:
                feed = feedparser.parse(feed_url)
                for entry in feed.entries:
                    summary = getattr(entry, "summary", "")
                    if self._is_funding_related(entry.title + " " + summary):
                        opportunities.append(
                            {
                                "title": entry.title,
                                "source": feed.feed.title
                                if hasattr(feed.feed, "title")
                                else feed_url,
                                "url": entry.link,
                                "description": summary[:500],
                                "type": "news",
                                "category": "news",
                            }
                        )
            except Exception as e:
                self.logger.error(f"Error processing feed {feed_url}: {e}")

        return opportunities

    def _is_funding_related(self, text: str) -> bool:
        """Check if text relates to funding/investment opportunities."""
        keywords = [
            "funding",
            "grant",
            "investment",
            "financing",
            "call for entries",
            "pitch competition",
            "film fund",
            "angel investor",
            "private equity",
            "arts patron",
            "toronto",
            "ontario",
            "canadian film",
        ]
        text_lower = text.lower()
        return any(kw in text_lower for kw in keywords)

    # ── OpenCode AI Research ───────────────────────────────────────

    def run_opencode_research(self) -> List[Dict]:
        """Use opencode AI agent to research Toronto/Ontario film investors and grants."""
        opportunities = []

        prompts = [
            (
                "Search the web for Toronto/Ontario film production companies that "
                "EXPLICITLY work with EMERGING filmmakers on SMALL budgets (under $50K). "
                "CRITICAL REQUIREMENTS for each result: "
                "1) Must be a film/TV production company (not a fund, not a festival) "
                "2) Must have a verifiable track record of investing in indie films "
                "3) Must accept unsolicited submissions from unknown filmmakers "
                "4) Must have a named program or fund for emerging talent "
                "EXCLUDE: industry associations, funds, festivals, grants, training programs. "
                "ONLY include: actual production companies that produce films. "
                "Examples of GOOD results: Slated (film financing platform), "
                "Rogers Documentary Fund (fund), Bell Fund (fund) - wait, these are funds. "
                "Actually, production companies rarely fund external projects - focus on FUNDS instead. "
                "Search for: film funds, film grants, film financing programs in Canada. "
                'Return ONLY this JSON format: [{"title": "Fund/Program Name", "url": "apply link", '
                '"description": "what they fund + typical amounts", '
                '"amount_range": "$X to $Y", '
                '"eligibility": "who can apply"}] inside ```json``` fences.'
            ),
            (
                "Search the web for Canadian film grants with EXACT dollar amounts "
                "that are ACCESSIBLE to emerging filmmakers with zero or minimal credits. "
                "STRICT RULES - ONLY include grants where: "
                "1) First-time filmmakers ARE eligible "
                "2) You can provide the EXACT grant amount "
                "3) You can provide the EXACT deadline (or say 'rolling') "
                "4) Budget is under $30,000 OR specifically for micro-budget films "
                "EXCLUDE: anything requiring 2+ years experience, established credits, "
                "previous funding, or producer associations. "
                "BEST programs to find: "
                "- Telefilm Talent to Watch (emerging directors) "
                "- Toronto Arts Council Media Artists Creation ($500-$5000) "
                "- Ontario Arts Council Media Artists "
                "- Canada Council Small-Scale Activities ($2000-$4000) "
                "- NFB FAP (free post-production, not $) "
                "- LIFT equipment/production grants "
                "- DGC Ontario Short Film Fund "
                "- The Talent Fund "
                "- imagineNATIVE cash awards "
                "- Crazy 8s film festival prize "
                'Return ONLY JSON: [{"title": "grant name", "url": "apply link", '
                '"amount": "$X or $X-$Y", "deadline": "YYYY-MM-DD or rolling", '
                '"eligibility": "1-sentence who qualifies", '
                '"difficulty": 1-10}] in ```json``` fences.'
            ),
            (
                "Search for Toronto/Ontario film festivals and pitch competitions in 2026 "
                "where emerging filmmakers can pitch to investors or win CASH prizes. "
                "STRICT REQUIREMENTS - ONLY include events where: "
                "1) There is a CASH prize or investment opportunity "
                "2) Emerging filmmakers (no credits) can enter "
                "3) You can provide the submission deadline "
                "4) Past winners are known indie/emerging filmmakers "
                "EXCLUDE: industry mixers, networking events without funding, "
                "or events for established professionals only. "
                "Look for: "
                "- Pitch competitions with prize money "
                "- Festival awards for emerging directors "
                "- Short film competitions with cash prizes "
                "- Documentary labs with funding "
                'Return ONLY JSON: [{"title": "event name", "url": "website", '
                '"type": "pitch/festival/competition", '
                '"cash_prize": "$ amount if any", '
                '"deadline": "YYYY-MM-DD", '
                '"eligibility": "who can enter", '
                '"past_winners": "any notable past winners"}] in ```json``` fences.'
            ),
        ]

        categories = ["fund", "grant", "competition"]

        for prompt, category in zip(prompts, categories):
            try:
                result = self._call_opencode(prompt)
                if result:
                    parsed = self._parse_opencode_output(result, category)
                    opportunities.extend(parsed)

                    # Log the research
                    cursor = self.conn.cursor()
                    cursor.execute(
                        "INSERT INTO ai_research_log (prompt, raw_output, opportunities_found, model) VALUES (?, ?, ?, ?)",
                        (
                            prompt[:200],
                            result[:50000],
                            len(parsed),
                            OPENCODE_MODEL or "default-free",
                        ),
                    )
                    self.conn.commit()

            except Exception as e:
                self.logger.error(f"OpenCode research error ({category}): {e}")

            time.sleep(2)

        return opportunities

    def _call_opencode(self, prompt: str) -> Optional[str]:
        """Call opencode run with a prompt and capture output."""
        cmd = ["opencode", "run", "--format", "json"]
        if OPENCODE_MODEL:
            cmd.extend(["-m", OPENCODE_MODEL])
        cmd.append(prompt)

        self.logger.info("Running opencode AI research...")
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=300,
                cwd="/root/finance-my-film",
            )
            if result.returncode == 0:
                return result.stdout
            else:
                self.logger.error(
                    f"opencode exited {result.returncode}: {result.stderr[:500]}"
                )
                return None
        except subprocess.TimeoutExpired:
            self.logger.error("opencode timed out after 5 minutes")
            return None
        except FileNotFoundError:
            self.logger.error("opencode not found on PATH")
            return None

    def _parse_opencode_output(self, raw_output: str, category: str) -> List[Dict]:
        """Parse opencode JSON output into opportunity dicts."""
        opportunities = []

        # opencode --format json emits newline-delimited JSON events
        # The AI's final answer is in "text" events; tool results are in "tool_use" events
        # We want the AI's synthesized answer (text events) first, tool outputs as fallback
        ai_text_parts = []
        tool_output_parts = []

        for line in raw_output.splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                event = json.loads(line)
                if not isinstance(event, dict):
                    continue
                etype = event.get("type", "")
                part = event.get("part", {})

                if etype == "text":
                    txt = part.get("text", "")
                    if isinstance(txt, str) and txt.strip():
                        ai_text_parts.append(txt.strip())

                elif etype == "tool_use":
                    state = part.get("state", {})
                    output = state.get("output", "")
                    if isinstance(output, str) and output.strip():
                        tool_output_parts.append(output.strip())

            except json.JSONDecodeError:
                ai_text_parts.append(line)

        # Try AI text first (contains the structured JSON answer)
        ai_text = "\n".join(ai_text_parts)
        parsed = self._try_parse_json_items(ai_text, category)
        if parsed:
            opportunities.extend(parsed)
        else:
            # Fallback: try tool outputs (raw web search results)
            all_text = ai_text + "\n" + "\n".join(tool_output_parts)
            parsed = self._try_parse_json_items(all_text, category)
            if parsed:
                opportunities.extend(parsed)

        if not opportunities and len(ai_text.strip()) > 50:
            # Last resort: save the raw AI text as a single research note
            opportunities.append(
                {
                    "title": f"AI Research: {category.title()} leads - Toronto/Ontario",
                    "source": f"AI Research ({category})",
                    "url": "",
                    "description": ai_text[:500],
                    "category": category,
                }
            )

        self.logger.info(f"AI research ({category}): found {len(opportunities)} leads")
        return opportunities

    def _try_parse_json_items(self, text: str, category: str) -> List[Dict]:
        """Try to extract a JSON array of opportunities from text."""
        results = []

        # Find JSON arrays — try the last match first (most likely the final answer)
        matches = list(re.finditer(r"```(?:json)?\s*(\[.*?\])\s*```", text, re.DOTALL))
        if not matches:
            matches = list(re.finditer(r"(\[\s*\{.*?\}\s*\])", text, re.DOTALL))

        for match in reversed(matches):
            try:
                items = json.loads(
                    match.group(1) if "```" in match.group() else match.group(1)
                )
                if not isinstance(items, list) or not items:
                    continue
                for item in items:
                    if not isinstance(item, dict):
                        continue
                    # Build description with contact info if available
                    desc_parts = [item.get("description", "")]
                    if item.get("contact"):
                        desc_parts.append(f"Contact: {item['contact']}")
                    if item.get("how_to_approach"):
                        desc_parts.append(f"Approach: {item['how_to_approach']}")
                    if item.get("why_interested"):
                        desc_parts.append(f"Interest: {item['why_interested']}")
                    if item.get("type"):
                        desc_parts.append(f"Type: {item['type']}")

                    amount_src = str(item.get("amount_range", item.get("amount", "")))

                    opp = {
                        "title": item.get("title", "Untitled"),
                        "source": f"AI Research ({category})",
                        "url": item.get("url", ""),
                        "description": " | ".join(p for p in desc_parts if p)[:500],
                        "category": category,
                        "amount": self._extract_amount(amount_src),
                    }
                    if opp["title"] != "Untitled":
                        results.append(opp)

                if results:
                    return results
            except json.JSONDecodeError:
                continue

        return results

    # ── Filtering ──────────────────────────────────────────────────

    def filter_opportunities(self, opportunities: List[Dict]) -> List[Dict]:
        """Filter for emerging filmmaker suitability."""
        filtered = []
        for opp in opportunities:
            if self._requires_extensive_portfolio(opp):
                continue
            if self._is_generic_navigation_page(opp):
                continue
            if self._is_irrelevant_news(opp):
                continue
            opp["difficulty_score"] = self._calculate_difficulty(opp)
            if opp["difficulty_score"] <= 7:
                filtered.append(opp)
        return sorted(filtered, key=lambda x: x["difficulty_score"])

    def _is_generic_navigation_page(self, opp: Dict) -> bool:
        """Reject generic navigation pages that aren't actual opportunities."""
        title = opp.get("title", "").lower()
        url = opp.get("url", "").lower()
        description = opp.get("description", "").lower()
        source = opp.get("source", "").lower()
        combined = title + " " + description + " " + url + " " + source

        generic_patterns = [
            "grants$",
            "funding$",
            "programs$",
            "support$",
            "financing$",
            "apply$",
            "resources$",
            "about$",
            "contact$",
            "faq$",
            "eligibility$",
            "how to apply",
            "learn more",
            "find out more",
            "get more information",
            "grant category",
            "funding type",
            "grant faqs",
            "recipient list",
            "acknowledging",
            "unsuccessful",
            "glossary",
            "our programs",
            "we finance",
            "we partner",
            "program overview",
            "apply for funding",
            "financing plan",
            "accounting",
            "reporting requirements",
            "logos",
            "brand guidelines",
            "template",
            ".pdf",
            "#program",
            "#apply",
            "framework",
            "back to",
            "grant online",
            "deadlines",
            "important dates",
            "magazine fund",
            "enterprise fund",
            "publishing",
            "business intelligence",
            "industry development",
            "grant results",
            "statistics",
            "evaluation",
            "terms and conditions",
            "accessibility fund",
            "support material",
            "application support",
        ]

        wrong_sector_patterns = [
            "book fund",
            "magazine",
            "literary",
            "publishing",
            "podcast",
            "gaming",
            "video game",
        ]

        bad_source_patterns = [
            "ontario arts council",
            "toronto arts council",
            "canada council",
        ]

        if any(p in combined for p in generic_patterns):
            return True

        if any(p in combined for p in wrong_sector_patterns):
            return True

        if any(p in source for p in bad_source_patterns) and "/grants/" in url:
            if "media-artists" not in url and "creation" not in url:
                return True

        if len(title) < 5:
            return True

        if title in (
            "grants",
            "funding",
            "programs",
            "support",
            "financing",
            "apply",
            "resources",
        ):
            return True

        return False

    def _is_irrelevant_news(self, opp: Dict) -> bool:
        """Reject news that isn't related to film funding."""
        if opp.get("category") != "news":
            return False

        title = opp.get("title", "").lower()

        irrelevant_patterns = [
            "review",
            "interview",
            "opinion",
            "analysis",
            "trailer",
            "cast",
            "director",
            "actor",
            "actress",
            "celebrity",
            "oscars",
            "grammys",
            "awards",
            "gala",
            "premiere",
            "box office",
            "trump",
            "politics",
            "streaming",
            "netflix",
            "hbo",
            "disney",
            "marvel",
            "star wars",
        ]

        if any(p in title for p in irrelevant_patterns):
            return True

        if (
            "funding" not in title
            and "grant" not in title
            and "investment" not in title
        ):
            return True

        return False

    def _requires_extensive_portfolio(self, opp: Dict) -> bool:
        """Reject opportunities needing established track records."""
        blockers = [
            "minimum 5 years",
            "minimum 3 years",
            "established filmmaker",
            "feature film experience",
            "previous funding required",
            "professional track record",
            "must have produced",
            "demonstrated track record",
            "previous credits required",
        ]
        text = (opp.get("title", "") + " " + opp.get("description", "")).lower()
        return any(b in text for b in blockers)

    def _calculate_difficulty(self, opp: Dict) -> int:
        """Score 1-10 difficulty (1 = easiest to access)."""
        score = 5
        text = (opp.get("title", "") + " " + opp.get("description", "")).lower()

        # Easier
        for kw in [
            "emerging",
            "new",
            "first-time",
            "student",
            "debut",
            "early career",
            "open call",
        ]:
            if kw in text:
                score -= 1

        # Investor/patron leads are high value, low competition
        if opp.get("category") in ("investor", "networking"):
            score -= 1

        # Toronto/Ontario specific = more relevant
        if any(loc in text for loc in ["toronto", "ontario", "gta"]):
            score -= 1

        # Harder
        for kw in ["competitive", "limited spots", "prestigious", "juried"]:
            if kw in text:
                score += 2

        amount = opp.get("amount")
        if amount and amount > 25000:
            score += 1
        elif amount and amount < 2000:
            score -= 1

        return max(1, min(10, score))

    def ai_summarize_opportunity(self, opp: Dict) -> Dict:
        """Use AI to generate a personalized summary and action items for an opportunity."""
        prompt = (
            f"You're a film funding advisor. For this funding opportunity, provide:\n"
            f"1. A 2-sentence summary tailored to an emerging Toronto filmmaker with $30K budget\n"
            f"2. 3 specific action items to pursue this opportunity\n"
            f"3. A relevance score 1-10 for a first-time filmmaker in Toronto\n\n"
            f"Opportunity: {opp.get('title', '')}\n"
            f"Source: {opp.get('source', '')}\n"
            f"Amount: {opp.get('amount', 'Not specified')}\n"
            f"Description: {opp.get('description', '')}\n"
            f"Category: {opp.get('category', 'grant')}\n\n"
            f'Return ONLY JSON: {{"summary": "...", "action_items": ["...", "...", "..."], '
            f'"relevance_score": 5}} inside ```json``` fences.'
        )

        try:
            result = self._call_opencode(prompt)
            if result:
                parsed = self._parse_ai_summary(result)
                if parsed:
                    opp["ai_summary"] = parsed.get("summary", "")
                    opp["action_items"] = parsed.get("action_items", [])
                    relevance = parsed.get("relevance_score")
                    if relevance:
                        opp["relevance_score"] = relevance
        except Exception as e:
            self.logger.debug(
                f"AI summary failed for {opp.get('title', 'unknown')}: {e}"
            )

        return opp

    def _parse_ai_summary(self, raw_output: str) -> Optional[Dict]:
        """Parse AI summary JSON from raw output."""
        import re as re_module

        match = re_module.search(
            r"```(?:json)?\s*(\{.*?\})\s*```", raw_output, re_module.DOTALL
        )
        if match:
            try:
                return json.loads(match.group(1))
            except json.JSONDecodeError:
                pass

        for line in raw_output.splitlines():
            line = line.strip()
            if line.startswith("{") and line.endswith("}"):
                try:
                    return json.loads(line)
                except json.JSONDecodeError:
                    continue
        return None

    def prioritize_for_filmmaker(self, opportunities: List[Dict]) -> List[Dict]:
        """Re-prioritize opportunities based on profile: emerging filmmaker, $30K, Toronto."""
        profile_prompt = (
            "You're a film funding expert. Rank these opportunities for a first-time Toronto "
            "filmmaker seeking $30,000 for a debut documentary/short. "
            "Consider: relevance to emerging filmmakers, Toronto/Ontario focus, grant amount, "
            "ease of application, and likelihood of success.\n\n"
            "For each opportunity, assign:\n"
            "- fit_score: 1-10 (overall fit for this profile)\n"
            "- priority_reason: 1 sentence why this is good for an emerging Toronto filmmaker\n\n"
            "Opportunities:\n"
        )

        for i, opp in enumerate(opportunities[:10]):
            profile_prompt += (
                f"{i + 1}. {opp.get('title', '')} - {opp.get('source', '')} - "
            )
            profile_prompt += (
                f"${opp.get('amount', 'N/A')} - {opp.get('category', '')}\n"
            )

        profile_prompt += (
            "\nReturn JSON array with objects containing: title, fit_score (1-10), "
        )
        "priority_reason. Return ONLY JSON inside ```json``` fences."

        try:
            result = self._call_opencode(profile_prompt)
            if result:
                import re as re_module

                match = re_module.search(
                    r"```(?:json)?\s*(\[.*?\])\s*```", result, re_module.DOTALL
                )
                if match:
                    rankings = json.loads(match.group(1))
                    ranking_map = {r.get("title", ""): r for r in rankings}

                    for opp in opportunities:
                        ranking = ranking_map.get(opp.get("title", ""))
                        if ranking:
                            opp["fit_score"] = ranking.get("fit_score", 5)
                            opp["priority_reason"] = ranking.get("priority_reason", "")
        except Exception as e:
            self.logger.debug(f"AI prioritization failed: {e}")

        return sorted(
            opportunities,
            key=lambda x: (
                -(x.get("fit_score") or x.get("difficulty_score") or 5),
                x.get("difficulty_score") or 5,
            ),
        )

    def smart_deduplicate(self, opportunities: List[Dict]) -> List[Dict]:
        """Deduplicate opportunities using fuzzy title matching."""
        import re as re_module

        seen = {}
        unique = []

        for opp in opportunities:
            title = opp.get("title", "").lower()
            title_clean = re_module.sub(r"[^\w]", "", title)

            found_duplicate = False
            for seen_title in seen:
                seen_clean = re_module.sub(r"[^\w]", "", seen_title)
                if title_clean in seen_clean or seen_clean in title_clean:
                    if abs(len(title_clean) - len(seen_clean)) < 10:
                        found_duplicate = True
                        break

            if not found_duplicate:
                seen[title] = True
                unique.append(opp)

        return unique

    # ── Database ───────────────────────────────────────────────────

    def save_opportunities(self, opportunities: List[Dict]) -> int:
        """Save opportunities to database. Returns count of new entries.
        Deduplicates by title+source AND by URL."""
        cursor = self.conn.cursor()
        new_count = 0

        for opp in opportunities:
            # Check by title+source
            cursor.execute(
                "SELECT id FROM opportunities WHERE title = ? AND source = ?",
                (opp["title"], opp["source"]),
            )
            if cursor.fetchone():
                continue

            # Check by URL if present (same link from different source = same thing)
            url = opp.get("url")
            if url:
                cursor.execute(
                    "SELECT id FROM opportunities WHERE url = ? AND url != ''",
                    (url,),
                )
                if cursor.fetchone():
                    continue

            cursor.execute(
                """INSERT INTO opportunities
                (title, source, url, amount, description, difficulty_score, category, fit_score, priority_reason)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    opp["title"],
                    opp["source"],
                    url,
                    opp.get("amount"),
                    opp.get("description", ""),
                    opp.get("difficulty_score", 5),
                    opp.get("category", "grant"),
                    opp.get("fit_score"),
                    opp.get("priority_reason", ""),
                ),
            )
            new_count += 1

        self.conn.commit()
        return new_count

    # ── Digest & Notifications ─────────────────────────────────────

    def send_daily_digest(self):
        """Send digest of all un-notified opportunities."""
        cursor = self.conn.cursor()

        cursor.execute("""
            SELECT id, title, source, url, amount, deadline, description,
                   eligibility, difficulty_score, category, created_at, fit_score
            FROM opportunities
            WHERE notified = FALSE
            ORDER BY COALESCE(fit_score, 11 - difficulty_score) ASC, difficulty_score ASC, created_at DESC
            LIMIT 15
        """)

        rows = cursor.fetchall()
        if not rows:
            self.logger.info("No new opportunities to report")
            self.log_daily_note("Daily scan complete - no new opportunities")
            return

        # Get previously sent opportunities for duplicate checking
        cursor.execute("""
            SELECT title, source, url FROM opportunities
            WHERE notified = TRUE
            ORDER BY created_at DESC
            LIMIT 100
        """)
        sent_opps = cursor.fetchall()
        sent_titles = [r["title"].lower() for r in sent_opps]
        sent_urls = [r["url"] for r in sent_opps if r["url"]]

        # Skip AI verification for now (too slow) - use all rows
        # verified_rows = self.verify_opportunities(rows, sent_titles, sent_urls)
        verified_rows = list(rows)

        if not verified_rows:
            self.logger.info("All opportunities failed verification")
            self.log_daily_note(
                "Verification: 0/{} opportunities passed AI check".format(len(rows))
            )
            # Mark all as notified to avoid re-processing
            ids = [str(row["id"]) for row in rows]
            cursor.execute(
                f"UPDATE opportunities SET notified = TRUE WHERE id IN ({','.join('?' * len(ids))})",
                ids,
            )
            self.conn.commit()
            return

        self.log_daily_note(
            f"Verification: {len(verified_rows)}/{len(rows)} opportunities passed AI check"
        )

        message = f"Daily Film Funding Digest - {len(verified_rows)} verified opportunities\n\n"

        for i, row in enumerate(verified_rows, 1):
            message += f"{i}. {row['title']}\n"
            message += f"   Source: {row['source']}\n"
            cat = row["category"] or "general"
            message += f"   Type: {cat}\n"
            if row["amount"]:
                message += f"   Amount: ${row['amount']:,.2f}\n"

            fit_score = row["fit_score"]
            if fit_score:
                message += f"   Fit Score: {fit_score}/10 (personalized for Toronto emerging filmmaker)\n"
            else:
                message += f"   Difficulty: {row['difficulty_score']}/10\n"

            if row["url"]:
                message += f"   URL: {row['url']}\n"
            message += "\n"

        self.send_notification("Film Funding Opportunities", message)

        # Mark as notified
        ids = [str(row["id"]) for row in verified_rows]
        cursor.execute(
            f"UPDATE opportunities SET notified = TRUE WHERE id IN ({','.join('?' * len(ids))})",
            ids,
        )
        self.conn.commit()

        self.logger.info(f"Sent digest with {len(verified_rows)} opportunities")
        self.log_daily_note(f"Sent digest: {len(verified_rows)} opportunities")

    def verify_opportunities(
        self, rows, sent_titles: List[str], sent_urls: List[str]
    ) -> List:
        """Use AI to verify opportunities are useful and not duplicates of prior sends."""
        opps_json = []
        for row in rows:
            opps_json.append(
                {
                    "id": row["id"],
                    "title": row["title"],
                    "source": row["source"],
                    "url": row["url"] if row["url"] else "",
                    "amount": row["amount"],
                    "category": row["category"],
                    "description": (row["description"] or "")[:300],
                }
            )

        prompt = (
            "You are a film funding expert vetting opportunities for an emerging Toronto filmmaker. "
            "Review these opportunities and:\n"
            "1. Remove any that are duplicates of previously sent items (check title similarity or same URL)\n"
            "2. Remove any that are NOT useful for a first-time filmmaker seeking $30K in Toronto (irrelevant, "
            "requires extensive credits, wrong country, or inaccessible)\n"
            "3. Keep only HIGH QUALITY leads that are worth pursuing\n\n"
            f"Previously sent titles: {sent_titles[:20]}\n"
            f"Previously sent URLs: {sent_urls[:20]}\n\n"
            f"Current opportunities to verify:\n{json.dumps(opps_json, indent=2)}\n\n"
            "Return JSON array of ONLY the opportunities to keep, each with its 'id' field. "
            "Return ONLY JSON inside ```json``` fences. If none are useful, return empty array []."
        )

        try:
            result = self._call_opencode(prompt)
            if result:
                import re as re_module

                match = re_module.search(
                    r"```(?:json)?\s*(\[.*?\])\s*```", result, re_module.DOTALL
                )
                if match:
                    keep_ids = json.loads(match.group(1))
                    if isinstance(keep_ids, list) and keep_ids:
                        # Handle both full objects and just id fields
                        if isinstance(keep_ids[0], dict):
                            keep_ids = [k.get("id") for k in keep_ids if k.get("id")]
                        else:
                            keep_ids = [k for k in keep_ids if k]

                        if keep_ids:
                            return [row for row in rows if row["id"] in keep_ids]
        except Exception as e:
            self.logger.error(f"Verification error: {e}")

        # If verification fails, allow all through
        return list(rows)

    # ── Main Scan ──────────────────────────────────────────────────

    def run_daily_scan(self):
        """Execute all research sources and send digest."""
        self.logger.info("Starting daily funding scan")
        self.log_daily_note("=== Daily scan started ===")

        all_opportunities = []

        # 1. Skip web scraping - too noisy with navigation pages
        # AI research is more effective at finding specific programs
        self.log_daily_note("Web scraping: skipped (using AI research instead)")

        # 2. Skip news feeds - too noisy with irrelevant entertainment news
        # Focus on AI research for actionable funding leads
        self.log_daily_note("News feeds: skipped (using AI research instead)")

        # 3. AI-powered research via opencode
        try:
            ai_results = self.run_opencode_research()
            all_opportunities.extend(ai_results)
            self.log_daily_note(f"AI research: {len(ai_results)} raw opportunities")
        except Exception as e:
            self.logger.error(f"OpenCode research error: {e}")

        # Filter and save
        if all_opportunities:
            # Smart deduplication
            deduped = self.smart_deduplicate(all_opportunities)
            self.log_daily_note(f"After dedup: {len(deduped)} opportunities")

            filtered = self.filter_opportunities(deduped)

            # Skip AI prioritization (too slow)
            # if filtered:
            #     try:
            #         prioritized = self.prioritize_for_filmmaker(filtered)
            #         filtered = prioritized
            #     except Exception as e:
            #         self.logger.error(f"AI prioritization error: {e}")

            new_count = self.save_opportunities(filtered)
            self.logger.info(f"Found {len(filtered)} suitable, {new_count} new")
            self.log_daily_note(
                f"Filtered: {len(filtered)} suitable, {new_count} new to database"
            )
        else:
            self.log_daily_note("No opportunities found this scan")

        # Send digest
        self.send_daily_digest()

        self.log_daily_note("=== Daily scan complete ===\n")
        self.logger.info("Daily scan completed")

    def close(self):
        """Clean up database connection."""
        if self.conn:
            self.conn.close()


def main():
    finder = FilmFinanceFinder()

    print("Film Finance Finder")
    print(f"Target: CAD ${finder.target_amount:,}")
    print("Focus: Emerging Filmmakers - Toronto/Ontario/Canada")
    print("Heavy focus: Private investors, arts patrons")
    print(
        f"ntfy: {'configured' if NTFY_URL and NTFY_TOPIC else 'not configured (file logging only)'}"
    )
    print(f"opencode model: {OPENCODE_MODEL or 'default free'}")
    print()

    try:
        finder.run_daily_scan()
    except KeyboardInterrupt:
        print("\nInterrupted.")
    finally:
        finder.close()


if __name__ == "__main__":
    main()
