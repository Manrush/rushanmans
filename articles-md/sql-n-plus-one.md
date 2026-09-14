---
title: Проблема N+1 запросов и как её лечить
description: Разбор проблемы N+1 в ORM и способов её решения.
tag: Базы данных
tags: sql, orm, django, базы данных
reading_time: 7 мин чтения · SQL, Django ORM
date: 2026-09-12
slug: sql-n-plus-one
---
N+1 — одна из самых частых причин, почему страница со списком «внезапно» начинает загружаться секундами вместо миллисекунд. Проблема в том, что ORM незаметно для разработчика превращает один логический запрос в десятки или сотни отдельных SQL-запросов.

## Как это возникает

Допустим, есть список статей, и для каждой нужно вывести имя автора:

```python
articles = Article.objects.all()  # 1 запрос: получить все статьи

for article in articles:
    print(article.title, "—", article.author.name)  # +1 запрос НА КАЖДУЮ статью
```

Если статей 50, ORM выполнит 1 запрос на получение статей и ещё 50 отдельных запросов — по одному на каждого автора, потому что связанный объект `author` подгружается лениво (lazy loading), в момент первого обращения к нему.

## Как это увидеть

В Django удобно включить логирование запросов или воспользоваться `django-debug-toolbar`, которая прямо в браузере показывает количество и текст всех SQL-запросов на странице.

```python
from django.db import connection

# ... код, который выполняет запросы ...

print(len(connection.queries))  # если тут 51 вместо 1 — это и есть N+1
```

## Решение: eager loading

Вместо того чтобы подгружать связанные объекты по одному, можно попросить ORM забрать их заранее — одним дополнительным запросом (или через JOIN).

```python
# Для связи "один-к-одному" / "многие-к-одному" — JOIN одним запросом
articles = Article.objects.select_related("author")

# Для связи "многие-ко-многим" / "один-ко-многим" — отдельный запрос + склейка в Python
articles = Article.objects.prefetch_related("tags")

for article in articles:
    print(article.title, "—", article.author.name)  # авторы уже в памяти, доп. запросов нет
```

<table style="width:100%; border-collapse:collapse; margin:1.4em 0;">
  <tr style="text-align:left; border-bottom:1px solid var(--glass-border);">
    <th style="padding:8px 0;">Метод</th>
    <th style="padding:8px 0;">Когда использовать</th>
    <th style="padding:8px 0;">Как работает</th>
  </tr>
  <tr style="border-bottom:1px solid var(--glass-border);">
    <td style="padding:8px 0;"><code>select_related</code></td>
    <td style="padding:8px 0;">ForeignKey, OneToOne</td>
    <td style="padding:8px 0;">Один SQL-запрос с JOIN</td>
  </tr>
  <tr>
    <td style="padding:8px 0;"><code>prefetch_related</code></td>
    <td style="padding:8px 0;">ManyToMany, обратный ForeignKey</td>
    <td style="padding:8px 0;">Доп. запрос + склейка в Python</td>
  </tr>
</table>

## Итог

N+1 почти никогда не заметен на маленьких тестовых данных — 5 статей дадут 6 запросов, и это выглядит нормально. Проблема всплывает в проде на реальных объёмах данных. Поэтому имеет смысл с самого начала привыкать проверять количество запросов на страницах со списками и заранее продумывать `select_related`/`prefetch_related` там, где точно понадобятся связанные объекты.
