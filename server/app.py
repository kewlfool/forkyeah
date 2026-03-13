import gzip
import json
import os
import re
import zlib
from html import unescape
from html.parser import HTMLParser
from typing import Any, Dict, List, Optional
from urllib.parse import unquote, urlencode, urlparse
from urllib.request import Request, urlopen

from fastapi import FastAPI, HTTPException, Query, Request as FastAPIRequest
from fastapi.middleware.cors import CORSMiddleware
from recipe_scrapers import scrape_html

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


HTML_PREVIEW_LIMIT = 20_000
RECIPE_USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:124.0) Gecko/20100101 Firefox/124.0"
SEARXNG_URL = os.getenv("SEARXNG_URL", "").rstrip("/")
SEARCH_USER_AGENT = "Mozilla/5.0 (compatible; forkyeah-search/1.0; +https://forkyeah.app)"
IMPORT_WARNING = (
    'Website not supported. Try another recipe link or use "Create your recipe" '
    "and paste the ingredients and steps."
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


def preview_text(value: str) -> str:
    trimmed = value.strip()
    if len(trimmed) <= HTML_PREVIEW_LIMIT:
        return trimmed
    return f"{trimmed[:HTML_PREVIEW_LIMIT]}…"


def normalize_text(value: str) -> str:
    text = value.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t\f\v]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def clean_line_item(value: str) -> str:
    cleaned = re.sub(r"^[\s•\-*\u2022]+", "", value)
    cleaned = re.sub(r"^\d+[\).]\s+", "", cleaned)
    return cleaned.strip()


def normalize_list(items: List[str]) -> List[str]:
    return [item.strip() for item in items if item and item.strip()]


def normalize_tags(items: List[str]) -> List[str]:
    seen = set()
    normalized: List[str] = []
    for item in items:
        trimmed = item.strip()
        if not trimmed:
            continue
        key = trimmed.lower()
        if key in seen:
            continue
        seen.add(key)
        normalized.append(trimmed)
    return normalized


def split_list(value: Optional[str]) -> List[str]:
    if not value:
        return []
    parts = re.split(r"[,/|;]+", value)
    return [part.strip() for part in parts if part.strip()]


def to_string_list(value: Any) -> List[str]:
    if not value:
        return []
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str):
        return split_list(value) if re.search(r"[,/|;]", value) else ([value.strip()] if value.strip() else [])
    text = str(value).strip()
    return [text] if text else []


def first_non_empty(*values: Optional[str]) -> str:
    for value in values:
        text = str(value).strip() if value is not None else ""
        if text:
            return text
    return ""


def humanize_nutrient_key(value: str) -> str:
    if not value:
        return ""
    cleaned = re.sub(r"Content$", "", value, flags=re.IGNORECASE)
    spaced = re.sub(r"([a-z])([A-Z])", r"\1 \2", cleaned).replace("_", " ")
    spaced = re.sub(r"\s+", " ", spaced).strip()
    return spaced[:1].upper() + spaced[1:] if spaced else ""


def format_nutrients(nutrients: Any) -> List[str]:
    if not nutrients:
        return []
    if isinstance(nutrients, list):
        return [str(item).strip() for item in nutrients if str(item).strip()]
    if isinstance(nutrients, dict):
        items = []
        for key, value in nutrients.items():
            if str(key).startswith("@") or value is None:
                continue
            label = humanize_nutrient_key(str(key))
            text = str(value).strip()
            if not label or not text:
                continue
            items.append(f"{label}: {text}")
        return items
    text = str(nutrients).strip()
    return [text] if text else []


def format_duration(value: Any) -> str:
    if not value:
        return ""

    text = str(value).strip()
    match = re.match(r"P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?", text, flags=re.IGNORECASE)
    if not match:
        return text

    days = int(match.group(1)) if match.group(1) else 0
    hours = int(match.group(2)) if match.group(2) else 0
    minutes = int(match.group(3)) if match.group(3) else 0

    parts: List[str] = []
    if days:
        parts.append(f"{days} d")
    if hours:
        parts.append(f"{hours} hr")
    if minutes:
        parts.append(f"{minutes} min")

    return " ".join(parts) if parts else text


def derive_title_from_url(value: str) -> str:
    if not value:
        return ""

    try:
        parsed = urlparse(value)
    except Exception:
        return ""

    parts = [part for part in parsed.path.split("/") if part]
    if not parts:
        return parsed.netloc

    last = unquote(parts[-1])
    last = re.sub(r"\.[a-z0-9]+$", "", last, flags=re.IGNORECASE)
    last = last.replace("-", " ").replace("_", " ").strip()
    return last


def base_recipe_response(source_label: str) -> Dict[str, Any]:
    return {
        "title": "",
        "description": "",
        "imageUrl": "",
        "ingredients": [],
        "steps": [],
        "tags": [],
        "categories": [],
        "cuisines": [],
        "nutrients": [],
        "prepTime": "",
        "cookTime": "",
        "notes": "",
        "rawContent": "",
        "sourceLabel": source_label,
        "importWarning": None,
    }


def has_recipe_content(data: Dict[str, Any]) -> bool:
    return bool(data.get("ingredients")) or bool(data.get("steps"))


def fill_missing_fields(target: Dict[str, Any], candidate: Dict[str, Any]) -> None:
    if not candidate:
        return

    for key in ("title", "description", "imageUrl", "prepTime", "cookTime", "notes", "rawContent"):
        if not target.get(key) and candidate.get(key):
            target[key] = candidate[key]

    for key in ("ingredients", "steps"):
        if not target.get(key) and candidate.get(key):
            target[key] = normalize_list(candidate[key])

    for key in ("tags", "categories", "cuisines", "nutrients"):
        target[key] = normalize_tags([*target.get(key, []), *candidate.get(key, [])])


def finalize_recipe_response(data: Dict[str, Any], source_label: str) -> Dict[str, Any]:
    data["sourceLabel"] = source_label
    data["ingredients"] = normalize_list(data.get("ingredients", []))
    data["steps"] = normalize_list(data.get("steps", []))
    data["categories"] = normalize_tags(data.get("categories", []))
    data["cuisines"] = normalize_tags(data.get("cuisines", []))
    data["nutrients"] = normalize_tags(data.get("nutrients", []))
    data["tags"] = normalize_tags([*data.get("tags", []), *data["categories"], *data["cuisines"]])
    data["title"] = first_non_empty(data.get("title"), derive_title_from_url(source_label))
    data["description"] = first_non_empty(data.get("description"))
    data["prepTime"] = first_non_empty(data.get("prepTime"))
    data["cookTime"] = first_non_empty(data.get("cookTime"))
    data["notes"] = first_non_empty(data.get("notes"))
    data["rawContent"] = preview_text(first_non_empty(data.get("rawContent"), source_label))

    data["imageUrl"] = first_non_empty(data.get("imageUrl"))

    if not has_recipe_content(data):
        data["importWarning"] = IMPORT_WARNING

    return data

def fetch_recipe_html(url: str) -> str:
    request = Request(
        url,
        headers={
            "User-Agent": RECIPE_USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Cache-Control": "no-cache",
        },
    )
    with urlopen(request, timeout=12) as response:
        content_type = response.headers.get("Content-Type", "")
        charset = response.headers.get_content_charset() or "utf-8"
        if "text/html" not in content_type:
            raise ValueError(f"Unexpected content type: {content_type}")
        payload = response.read()
        return payload.decode(charset, errors="replace")


def read_text_response(response) -> str:
    payload = response.read()
    encoding = (response.headers.get("Content-Encoding", "") or "").lower()
    if encoding == "gzip":
        payload = gzip.decompress(payload)
    elif encoding == "deflate":
        payload = zlib.decompress(payload)

    charset = response.headers.get_content_charset() or "utf-8"
    return payload.decode(charset, errors="replace")


def extract_client_ip(request: FastAPIRequest) -> str:
    forwarded_for = request.headers.get("x-forwarded-for", "")
    if forwarded_for:
        first_hop = forwarded_for.split(",", 1)[0].strip()
        if first_hop:
            return first_hop

    real_ip = request.headers.get("x-real-ip", "").strip()
    if real_ip:
        return real_ip

    client = request.client.host if request.client else ""
    return client.strip()


def collect_instructions(value: Any) -> List[str]:
    if not value:
        return []

    if isinstance(value, str):
        return [value.strip()] if value.strip() else []

    if isinstance(value, list):
        results: List[str] = []
        for item in value:
            results.extend(collect_instructions(item))
        return results

    if isinstance(value, dict):
        if isinstance(value.get("text"), str):
            text = value["text"].strip()
            return [text] if text else []
        if value.get("itemListElement") is not None:
            return collect_instructions(value["itemListElement"])

    return []


def extract_image_url(value: Any) -> str:
    if not value:
        return ""

    if isinstance(value, str):
        return value.strip()

    if isinstance(value, list):
        for item in value:
            extracted = extract_image_url(item)
            if extracted:
                return extracted
        return ""

    if isinstance(value, dict):
        for key in ("url", "@id"):
            candidate = value.get(key)
            if isinstance(candidate, str) and candidate.strip():
                return candidate.strip()

    return ""


def clean_json_ld_text(value: str) -> str:
    text = value.strip()
    text = re.sub(r"^\s*<!--", "", text)
    text = re.sub(r"-->\s*$", "", text)
    text = re.sub(r"^\s*//<!\[CDATA\[", "", text)
    text = re.sub(r"//\]\]>\s*$", "", text)
    return text.strip()


def node_is_recipe(node: Any) -> bool:
    if not isinstance(node, dict):
        return False

    node_type = node.get("@type")
    if isinstance(node_type, list):
        return any(str(item).lower() == "recipe" for item in node_type)
    return str(node_type).lower() == "recipe"


def find_recipe_node(value: Any) -> Optional[Dict[str, Any]]:
    queue: List[Any] = [value]
    while queue:
        current = queue.pop(0)
        if isinstance(current, list):
            queue.extend(current)
            continue
        if not isinstance(current, dict):
            continue
        if node_is_recipe(current):
            return current
        for nested in current.values():
            if isinstance(nested, (list, dict)):
                queue.append(nested)
    return None


def extract_recipe_from_json_ld(html: str, source_label: str) -> Dict[str, Any]:
    matches = re.findall(
        r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
        html,
        flags=re.IGNORECASE | re.DOTALL,
    )
    for match in matches:
        text = clean_json_ld_text(match)
        if not text:
            continue
        try:
            data = json.loads(text)
        except Exception:
            continue

        recipe = find_recipe_node(data)
        if not recipe:
            continue

        categories = to_string_list(recipe.get("recipeCategory"))
        cuisines = to_string_list(recipe.get("recipeCuisine"))
        keywords = to_string_list(recipe.get("keywords"))
        draft = base_recipe_response(source_label)
        draft["title"] = first_non_empty(recipe.get("name"))
        draft["description"] = first_non_empty(recipe.get("description"))
        draft["imageUrl"] = extract_image_url(recipe.get("image"))
        draft["ingredients"] = normalize_list(to_string_list(recipe.get("recipeIngredient")))
        draft["steps"] = normalize_list(collect_instructions(recipe.get("recipeInstructions")))
        draft["categories"] = normalize_tags(categories)
        draft["cuisines"] = normalize_tags(cuisines)
        draft["tags"] = normalize_tags([*keywords, *categories, *cuisines])
        draft["nutrients"] = format_nutrients(recipe.get("nutrition"))
        draft["prepTime"] = format_duration(recipe.get("prepTime"))
        draft["cookTime"] = format_duration(recipe.get("cookTime"))
        return draft

    return base_recipe_response(source_label)


def parse_section_header(line: str) -> Optional[Dict[str, str]]:
    match = re.match(r"^(ingredients?|instructions?|directions?|method|steps?|notes?)\s*:?\s*(.*)$", line.strip(), flags=re.IGNORECASE)
    if not match:
        return None

    key = match.group(1).lower()
    remainder = (match.group(2) or "").strip()
    section = "steps"
    if key.startswith("ingredient"):
        section = "ingredients"
    elif key.startswith("note"):
        section = "notes"

    return {"section": section, "remainder": remainder}


def parse_line_for_meta(line: str) -> Dict[str, Any]:
    meta: Dict[str, Any] = {}

    time_match = re.match(r"^(prep|prep time|cook|cook time|total time)\s*:?\s*(.+)$", line, flags=re.IGNORECASE)
    if time_match:
        label = time_match.group(1).lower()
        value = time_match.group(2).strip()
        if label.startswith("prep"):
            meta["prepTime"] = value
        elif label.startswith("cook") or label.startswith("total"):
            meta["cookTime"] = value

    tag_match = re.match(r"^(tags?|keywords?)\s*:?\s*(.+)$", line, flags=re.IGNORECASE)
    if tag_match:
        meta["tags"] = split_list(tag_match.group(2))

    return meta


def parse_recipe_from_text(text: str, fallback_title: str, source_label: str) -> Dict[str, Any]:
    normalized = normalize_text(unescape(text))
    lines = [line.strip() for line in normalized.split("\n") if line.strip()]

    draft = base_recipe_response(source_label)
    draft["title"] = fallback_title
    draft["rawContent"] = preview_text(normalized)

    prep_time = ""
    cook_time = ""
    tags: List[str] = []
    ingredients: List[str] = []
    steps: List[str] = []
    notes: List[str] = []
    current_section: Optional[str] = None
    saw_section = False

    for line in lines:
        section_info = parse_section_header(line)
        if section_info:
            current_section = section_info["section"]
            saw_section = True
            remainder = clean_line_item(section_info["remainder"])
            if remainder:
                if current_section == "ingredients":
                    ingredients.extend(split_list(remainder))
                elif current_section == "steps":
                    steps.append(remainder)
                else:
                    notes.append(remainder)
            continue

        meta = parse_line_for_meta(line)
        if meta.get("prepTime") and not prep_time:
            prep_time = meta["prepTime"]
            continue
        if meta.get("cookTime") and not cook_time:
            cook_time = meta["cookTime"]
            continue
        if meta.get("tags"):
            tags.extend(meta["tags"])
            continue

        if not draft["title"] and len(line) <= 80 and not re.match(r"^(serves|yield)", line, flags=re.IGNORECASE):
            draft["title"] = line
            continue

        if current_section == "ingredients":
            cleaned = clean_line_item(line)
            if cleaned:
                ingredients.append(cleaned)
            continue

        if current_section == "steps":
            cleaned = clean_line_item(line)
            if cleaned:
                steps.append(cleaned)
            continue

        if current_section == "notes":
            notes.append(line)

    if not saw_section:
        blocks = [block.strip() for block in re.split(r"\n{2,}", normalized) if block.strip()]
        if len(blocks) >= 2:
            ingredients.extend([clean_line_item(line) for line in blocks[0].split("\n") if clean_line_item(line)])
            steps.extend([clean_line_item(line) for line in blocks[1].split("\n") if clean_line_item(line)])
            if len(blocks) > 2:
                notes.append("\n\n".join(blocks[2:]))
        else:
            numbered = [line for line in lines if re.match(r"^\d+[\).]", line)]
            if len(numbered) >= 2:
                steps.extend([clean_line_item(line) for line in numbered])

    if not draft["title"]:
        for line in lines:
            if len(line) <= 80:
                draft["title"] = line
                break

    draft["ingredients"] = normalize_list(ingredients)
    draft["steps"] = normalize_list(steps)
    draft["tags"] = normalize_tags(tags)
    draft["prepTime"] = prep_time
    draft["cookTime"] = cook_time
    draft["notes"] = "\n".join(notes).strip()
    return draft


class HtmlRecipeParser(HTMLParser):
    BLOCK_TAGS = {
        "article",
        "aside",
        "blockquote",
        "div",
        "figcaption",
        "footer",
        "form",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "header",
        "li",
        "main",
        "ol",
        "p",
        "section",
        "table",
        "tr",
        "ul",
    }
    SKIP_TAGS = {"script", "style", "noscript", "template", "svg"}

    def __init__(self):
        super().__init__()
        self.meta: Dict[str, str] = {}
        self.title_parts: List[str] = []
        self.text_parts: List[str] = []
        self._skip_depth = 0
        self._in_title = False

    def handle_starttag(self, tag: str, attrs) -> None:
        tag_name = tag.lower()
        attributes = {str(key).lower(): (value or "") for key, value in attrs if key}

        if tag_name in self.SKIP_TAGS:
            self._skip_depth += 1
            return

        if tag_name == "title":
            self._in_title = True
            return

        if tag_name == "meta":
            key = first_non_empty(attributes.get("property"), attributes.get("name"), attributes.get("itemprop")).lower()
            content = first_non_empty(attributes.get("content"))
            if key and content and key not in self.meta:
                self.meta[key] = content
            return

        if self._skip_depth == 0 and (tag_name in self.BLOCK_TAGS or tag_name == "br"):
            self.text_parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        tag_name = tag.lower()
        if tag_name in self.SKIP_TAGS:
            if self._skip_depth > 0:
                self._skip_depth -= 1
            return

        if tag_name == "title":
            self._in_title = False
            return

        if self._skip_depth == 0 and tag_name in self.BLOCK_TAGS:
            self.text_parts.append("\n")

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self.title_parts.append(data)
            return
        if self._skip_depth > 0:
            return
        self.text_parts.append(data)

    @property
    def page_title(self) -> str:
        return normalize_text("".join(self.title_parts))

    @property
    def body_text(self) -> str:
        return normalize_text(unescape("".join(self.text_parts)))


def extract_meta_fallback(parsed_html: HtmlRecipeParser, source_label: str) -> Dict[str, Any]:
    meta = parsed_html.meta
    categories = split_list(first_non_empty(meta.get("recipecategory"), meta.get("article:section")))
    cuisines = split_list(first_non_empty(meta.get("recipecuisine")))
    keywords = split_list(first_non_empty(meta.get("keywords"), meta.get("news_keywords")))

    draft = base_recipe_response(source_label)
    draft["title"] = first_non_empty(meta.get("og:title"), meta.get("twitter:title"), parsed_html.page_title)
    draft["description"] = first_non_empty(
        meta.get("description"),
        meta.get("og:description"),
        meta.get("twitter:description"),
    )
    draft["imageUrl"] = first_non_empty(meta.get("og:image"), meta.get("twitter:image"), meta.get("image"))
    draft["categories"] = normalize_tags(categories)
    draft["cuisines"] = normalize_tags(cuisines)
    draft["tags"] = normalize_tags([*keywords, *categories, *cuisines])
    return draft


def extract_recipe_from_scraper(html: str, url: str) -> Dict[str, Any]:
    draft = base_recipe_response(url)

    try:
        scraper = scrape_html(html, url, supported_only=False)
    except Exception:
        return draft

    title = first_non_empty(safe_call(scraper.title, ""))
    image_url = ""
    image_fn = getattr(scraper, "image", None)
    if callable(image_fn):
        image_url = first_non_empty(safe_call(image_fn, ""))

    ingredients = normalize_list(safe_call(scraper.ingredients, []) or [])
    instructions_text = first_non_empty(safe_call(scraper.instructions, ""))
    description = first_non_empty(safe_call(getattr(scraper, "description", None), ""))
    category_values = to_string_list(safe_call(getattr(scraper, "category", None), None))
    cuisine_values = to_string_list(safe_call(getattr(scraper, "cuisine", None), None))
    nutrients = safe_call(getattr(scraper, "nutrients", None), None)
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

    draft["title"] = title
    draft["description"] = description
    draft["imageUrl"] = image_url
    draft["ingredients"] = ingredients
    draft["steps"] = steps
    draft["categories"] = normalize_tags(category_values)
    draft["cuisines"] = normalize_tags(cuisine_values)
    draft["nutrients"] = format_nutrients(nutrients)
    draft["prepTime"] = prep_time
    draft["cookTime"] = cook_time
    draft["rawContent"] = "\n\n".join(raw_sections)
    return draft


@app.get("/api/scrape")
def scrape_recipe(url: str = Query(..., min_length=5)):
    try:
        html = fetch_recipe_html(url)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Unable to fetch recipe: {exc}") from exc

    parsed_html = HtmlRecipeParser()
    parsed_html.feed(html)

    scraper_draft = extract_recipe_from_scraper(html, url)
    json_ld_draft = extract_recipe_from_json_ld(html, url)
    meta_draft = extract_meta_fallback(parsed_html, url)
    text_draft = parse_recipe_from_text(parsed_html.body_text, derive_title_from_url(url), url)

    response = base_recipe_response(url)
    fill_missing_fields(response, scraper_draft)
    fill_missing_fields(response, json_ld_draft)
    fill_missing_fields(response, meta_draft)
    fill_missing_fields(response, text_draft)

    if not response["rawContent"]:
        response["rawContent"] = preview_text(parsed_html.body_text)

    return finalize_recipe_response(response, url)


@app.get("/api/search")
def search_recipes(
    request: FastAPIRequest,
    q: str = Query(..., min_length=2),
    limit: int = Query(10, ge=1, le=20),
):
    if not SEARXNG_URL:
        raise HTTPException(status_code=501, detail="Search not configured")

    params = {
        "q": q,
        "format": "json",
    }
    url = f"{SEARXNG_URL}/search?{urlencode(params)}"
    client_ip = extract_client_ip(request)
    accept_language = first_non_empty(request.headers.get("accept-language"), "en-US,en;q=0.9")
    forwarded_proto = first_non_empty(request.headers.get("x-forwarded-proto"), "https")

    try:
        upstream_request = Request(
            url,
            headers={
                "User-Agent": SEARCH_USER_AGENT,
                "Accept": "application/json,text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
                "Accept-Language": accept_language,
                "Accept-Encoding": "gzip, deflate",
                "X-Real-IP": client_ip,
                "X-Forwarded-For": client_ip,
                "X-Forwarded-Proto": forwarded_proto,
            },
        )
        with urlopen(upstream_request, timeout=12) as response:
            payload = read_text_response(response)
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
