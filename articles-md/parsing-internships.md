---
title: Парсер вакансий стажировок на Python
description: Разбор кода парсера стажировок: requests, BeautifulSoup, pandas.
tag: Парсинг
tags: python, парсинг, beautifulsoup, pandas
reading_time: 12 мин чтения · Python, requests, BeautifulSoup, pandas
date: 2026-09-12
slug: parsing-internships
---
Задача: собрать список актуальных стажировок с сайта вакансий, оставить только нужные поля (название, компания, город, ссылка) и сохранить результат в таблицу, с которой удобно работать дальше — фильтровать, сортировать, считать статистику.

## 1. Получаем HTML страницы

Для запросов используем `requests`, а чтобы сайт не банил нас как бота — подставляем заголовок `User-Agent` и делаем паузу между запросами.

```python
import time
import requests
from bs4 import BeautifulSoup

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
}

def get_page(url: str) -> BeautifulSoup:
    response = requests.get(url, headers=HEADERS, timeout=10)
    response.raise_for_status()
    return BeautifulSoup(response.text, "html.parser")
```

## 2. Разбираем список вакансий

На странице поиска карточки вакансий обычно лежат в повторяющихся блоках с одинаковым классом. Находим их все и вытаскиваем нужные поля через CSS-селекторы.

```python
def parse_vacancies(soup: BeautifulSoup) -> list[dict]:
    vacancies = []
    cards = soup.select("div.vacancy-card")

    for card in cards:
        title_tag = card.select_one("a.vacancy-title")
        company_tag = card.select_one("span.company-name")
        city_tag = card.select_one("span.city")

        if not title_tag:
            continue

        vacancies.append({
            "title": title_tag.get_text(strip=True),
            "company": company_tag.get_text(strip=True) if company_tag else "—",
            "city": city_tag.get_text(strip=True) if city_tag else "—",
            "url": title_tag.get("href"),
        })

    return vacancies
```

> Названия классов (`vacancy-card`, `vacancy-title` и т.д.) — условные: у каждого сайта своя вёрстка, реальные селекторы нужно смотреть через «Инструменты разработчика» → вкладка Elements.

## 3. Проходим несколько страниц пагинации

```python
def collect_all(base_url: str, pages: int = 5) -> list[dict]:
    all_vacancies = []
    for page in range(1, pages + 1):
        soup = get_page(f"{base_url}?page={page}")
        all_vacancies.extend(parse_vacancies(soup))
        time.sleep(1)  # пауза, чтобы не нагружать сайт запросами
    return all_vacancies
```

## 4. Сохраняем и анализируем через pandas

Когда данные собраны, удобно сразу превратить список словарей в таблицу — так проще искать дубликаты, фильтровать по городу или считать, у каких компаний больше всего открытых стажировок.

```python
import pandas as pd

data = collect_all("https://example-jobs.ru/internships")
df = pd.DataFrame(data)

df = df.drop_duplicates(subset="url")
df.to_csv("internships.csv", index=False, encoding="utf-8-sig")

print(df["company"].value_counts().head(10))
```

## Итог

Получили конвейер из четырёх шагов: скачать страницу → распарсить карточки → пройтись по пагинации → сложить в CSV. Дальше это можно превратить в регулярную задачу (cron / планировщик задач), которая раз в день обновляет таблицу свежих стажировок.

**Что можно улучшить:**

- Добавить повторные попытки запроса при сетевых ошибках.
- Кэшировать уже просмотренные вакансии, чтобы не парсить повторно.
- Вынести селекторы в конфиг — так парсер проще адаптировать под другой сайт.
