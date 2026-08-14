"""Build a recipe hash table and graph from pages exposing schema.org Recipe JSON-LD.

Usage:
  python scripts/build_dish_library.py --sources scripts/recipe_sources.json --output data/crawled_dishes.json

Only add pages whose robots.txt and terms permit automated access. Images are stored as source URLs;
the script does not download or redistribute copyrighted image files.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import time
import urllib.parse
import urllib.request
import urllib.robotparser
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any


USER_AGENT = "JinTianChiShaRecipeIndexer/1.0 (+desktop nutrition research; respectful crawler)"
GRAM_PATTERN = re.compile(r"(?P<amount>\d+(?:\.\d+)?)\s*(?:g|克|千克|kg)", re.IGNORECASE)
NUMBER_PATTERN = re.compile(r"\d+(?:\.\d+)?")


@dataclass
class Recipe:
    id: str
    name: str
    cuisine: str
    method: str
    taste: list[str]
    tags: list[str]
    image: str
    ingredients: list[dict[str, Any]]
    nutrition: dict[str, float]
    source_url: str
    license: str


def can_fetch(url: str) -> bool:
    parsed = urllib.parse.urlparse(url)
    robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
    parser = urllib.robotparser.RobotFileParser(robots_url)
    try:
        parser.read()
        return parser.can_fetch(USER_AGENT, url)
    except OSError:
        return False


def fetch_html(url: str) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "text/html"})
    with urllib.request.urlopen(request, timeout=18) as response:
        return response.read().decode(response.headers.get_content_charset() or "utf-8", errors="replace")


def extract_recipe_json_ld(html: str) -> dict[str, Any] | None:
    scripts = re.findall(r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', html, re.I | re.S)
    for raw_script in scripts:
        try:
            payload = json.loads(raw_script.strip())
        except json.JSONDecodeError:
            continue
        candidates = payload if isinstance(payload, list) else payload.get("@graph", [payload])
        for candidate in candidates:
            recipe_type = candidate.get("@type", "") if isinstance(candidate, dict) else ""
            if recipe_type == "Recipe" or "Recipe" in recipe_type:
                return candidate
    return None


def parse_number(value: Any) -> float:
    match = NUMBER_PATTERN.search(str(value or ""))
    return float(match.group()) if match else 0.0


def parse_ingredient(raw_ingredient: str) -> dict[str, Any]:
    match = GRAM_PATTERN.search(raw_ingredient)
    grams = float(match.group("amount")) if match else 0.0
    if match and "kg" in match.group().lower() or match and "千克" in match.group():
        grams *= 1000
    name = GRAM_PATTERN.sub("", raw_ingredient).strip(" ：:,-")
    return {"name": name or raw_ingredient, "grams": grams, "original": raw_ingredient}


def normalize_recipe(raw: dict[str, Any], source: dict[str, str]) -> Recipe:
    name = str(raw.get("name", "未命名菜品")).strip()
    identifier = hashlib.sha1(f"{source['url']}::{name}".encode("utf-8")).hexdigest()[:14]
    image = raw.get("image", "")
    if isinstance(image, list):
        image = image[0] if image else ""
    if isinstance(image, dict):
        image = image.get("url", "")
    nutrition = raw.get("nutrition", {}) or {}
    instructions = json.dumps(raw.get("recipeInstructions", ""), ensure_ascii=False)
    method = next((word for word in ["清蒸", "红烧", "爆炒", "油炸", "炖", "煨", "煮", "煎"] if word in instructions), "家常烹饪")
    raw_keywords = raw.get("keywords", [])
    keywords = re.split(r"[,，、]", raw_keywords) if isinstance(raw_keywords, str) else list(raw_keywords)
    keywords = [str(keyword).strip() for keyword in keywords if str(keyword).strip()]
    return Recipe(
        id=f"crawl-{identifier}",
        name=name,
        cuisine=source.get("cuisine") or str(raw.get("recipeCuisine", "其他")),
        method=method,
        taste=keywords[:2] or ["经典"],
        tags=(keywords[2:4] or [str(raw.get("recipeCategory", "新收录"))]),
        image=str(image),
        ingredients=[parse_ingredient(item) for item in raw.get("recipeIngredient", [])],
        nutrition={
            "calories": parse_number(nutrition.get("calories")),
            "protein": parse_number(nutrition.get("proteinContent")),
            "carbs": parse_number(nutrition.get("carbohydrateContent")),
            "fat": parse_number(nutrition.get("fatContent")),
            "fiber": parse_number(nutrition.get("fiberContent")),
            "sodium": parse_number(nutrition.get("sodiumContent")),
        },
        source_url=source["url"],
        license=source.get("license", "unknown"),
    )


def build_graph(recipes: list[Recipe]) -> list[dict[str, Any]]:
    edges: list[dict[str, Any]] = []
    for left_index, left_recipe in enumerate(recipes):
        left_ingredients = {item["name"] for item in left_recipe.ingredients}
        for right_recipe in recipes[left_index + 1:]:
            right_ingredients = {item["name"] for item in right_recipe.ingredients}
            union = left_ingredients | right_ingredients
            similarity = len(left_ingredients & right_ingredients) / len(union) if union else 0
            method_bonus = 0.25 if left_recipe.method == right_recipe.method else 0
            cuisine_bonus = 0.15 if left_recipe.cuisine == right_recipe.cuisine else 0
            score = similarity + method_bonus + cuisine_bonus
            if score >= 0.2:
                edges.append({"from": left_recipe.id, "to": right_recipe.id, "weight": round(score, 3)})
    return edges


def main() -> None:
    argument_parser = argparse.ArgumentParser()
    argument_parser.add_argument("--sources", required=True, type=Path)
    argument_parser.add_argument("--output", required=True, type=Path)
    argument_parser.add_argument("--delay", type=float, default=1.5)
    arguments = argument_parser.parse_args()
    sources = json.loads(arguments.sources.read_text(encoding="utf-8"))
    recipes: list[Recipe] = []
    skipped: list[dict[str, str]] = []

    for source in sources:
        url = source["url"]
        if not can_fetch(url):
            skipped.append({"url": url, "reason": "robots.txt denied or unavailable"})
            continue
        try:
            recipe_payload = extract_recipe_json_ld(fetch_html(url))
            if recipe_payload:
                recipes.append(normalize_recipe(recipe_payload, source))
            else:
                skipped.append({"url": url, "reason": "schema.org Recipe not found"})
        except (OSError, TimeoutError, ValueError) as error:
            skipped.append({"url": url, "reason": str(error)})
        time.sleep(max(arguments.delay, 1.0))

    output = {
        "dishHash": {recipe.id: asdict(recipe) for recipe in recipes},
        "nameHash": {recipe.name: recipe.id for recipe in recipes},
        "graphEdges": build_graph(recipes),
        "skipped": skipped,
    }
    arguments.output.parent.mkdir(parents=True, exist_ok=True)
    arguments.output.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Indexed {len(recipes)} recipes; skipped {len(skipped)}; wrote {arguments.output}")


if __name__ == "__main__":
    main()
