import base64
import json
import os
from typing import List, Optional
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from recipe_scrapers import scrape_me

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def format_minutes(value: Optional[int]) -> str:
    if value is None:
        return ""

    try:
        minutes = int(value)
    except (TypeError, ValueError):
        return ""

    if minutes <= 0:
        return ""

    hours = minutes // 60
    remainder = minutes % 60
    parts: List[str] = []
    if hours:
        parts.append(f"{hours} hr")
    if remainder:
        parts.append(f"{remainder} min")

    return " ".join(parts)


def safe_call(func, default=None):
    try:
        return func()
    except Exception:
        return default


IMAGE_MAX_BYTES = 2_500_000
IMAGE_USER_AGENT = "Mozilla/5.0 (compatible; forkyeah/1.0; +https://forkyeah.app)"
SEARXNG_URL = os.getenv("SEARXNG_URL", "").rstrip("/")
SEARCH_USER_AGENT = "Mozilla/5.0 (compatible; forkyeah-search/1.0; +https://forkyeah.app)"


def fetch_image_data_url(url: str) -> str:
    if not url:
        return ""

    try:
        request = Request(url, headers={"User-Agent": IMAGE_USER_AGENT})
        with urlopen(request, timeout=10) as response:
            content_type = response.headers.get("Content-Type", "")
            content_type = content_type.split(";", 1)[0].strip().lower()
            if not content_type.startswith("image/"):
                return ""
            data = response.read(IMAGE_MAX_BYTES + 1)
            if len(data) > IMAGE_MAX_BYTES:
                return ""
    except Exception:
        return ""

    encoded = base64.b64encode(data).decode("ascii")
    return f"data:{content_type};base64,{encoded}"


@app.get("/api/scrape")
def scrape_recipe(url: str = Query(..., min_length=5)):
    try:
        scraper = scrape_me(url)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Unable to fetch recipe: {exc}") from exc

    title = safe_call(scraper.title, "").strip()
    image_url = ""
    image_fn = getattr(scraper, "image", None)
    if callable(image_fn):
        image_url = safe_call(image_fn, "") or ""
    if isinstance(image_url, str):
        image_url = image_url.strip()
    else:
        image_url = ""
    if image_url:
        image_data_url = fetch_image_data_url(image_url)
        if image_data_url:
            image_url = image_data_url
    ingredients = safe_call(scraper.ingredients, []) or []
    instructions_text = safe_call(scraper.instructions, "") or ""
    prep_time = format_minutes(safe_call(scraper.prep_time))
    cook_time = format_minutes(safe_call(scraper.cook_time))

    steps = [line.strip() for line in instructions_text.split("\n") if line.strip()]

    raw_sections: List[str] = []
    if title:
        raw_sections.append(title)
    if ingredients:
        raw_sections.append("Ingredients")
        raw_sections.append("\n".join(ingredients))
    if instructions_text:
        raw_sections.append("Instructions")
        raw_sections.append(instructions_text.strip())

    return {
        "title": title,
        "imageUrl": image_url,
        "ingredients": ingredients,
        "steps": steps,
        "tags": [],
        "prepTime": prep_time,
        "cookTime": cook_time,
        "notes": "",
        "rawContent": "\n\n".join(raw_sections),
        "sourceLabel": url,
    }


@app.get("/api/search")
def search_recipes(q: str = Query(..., min_length=2), limit: int = Query(10, ge=1, le=20)):
    if not SEARXNG_URL:
        raise HTTPException(status_code=501, detail="Search not configured")

    params = {
        "q": q,
        "format": "json",
    }
    url = f"{SEARXNG_URL}/search?{urlencode(params)}"

    try:
        request = Request(url, headers={"User-Agent": SEARCH_USER_AGENT, "Accept": "application/json"})
        with urlopen(request, timeout=12) as response:
            payload = response.read().decode("utf-8")
        data = json.loads(payload)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Search failed: {exc}") from exc

    results = []
    for item in data.get("results", [])[:limit]:
        title = (item.get("title") or item.get("url") or "").strip()
        link = (item.get("url") or "").strip()
        thumbnail = (item.get("thumbnail") or item.get("img_src") or "").strip()
        snippet = (item.get("content") or item.get("summary") or "").strip()
        if not link:
            continue
        results.append(
            {
                "title": title or link,
                "url": link,
                "thumbnail": thumbnail,
                "snippet": snippet,
            }
        )

    return {"query": q, "results": results}
