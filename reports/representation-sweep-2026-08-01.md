# Representation sweep — 2026-08-01

126 person subjects across 9 domains. Source: Wikidata P21 (gender), P172 (ethnic group), P27 (citizenship, context only). Read-only sweep; nothing written to the DB.

> **Caveat on ethnicity:** Wikidata's P172 (ethnic group) is sparsely populated — editors add it mostly for subjects from underrepresented groups, and it is usually absent for white subjects. A large "unknown/unstated" bucket is expected and is **not** evidence of anything; do not read absence as either diversity or its lack. Use the per-subject appendix (with citizenship as weak context) plus your own knowledge when curating.

## Overall

### Gender

| Gender | Count |
|---|---|
| male | 93 (74%) |
| female | 24 (19%) |
| unknown/unstated | 9 (7%) |

### Ethnic group (where stated on Wikidata)

| Ethnic group | Count |
|---|---|
| unknown/unstated | 94 (75%) |
| African Americans | 8 (6%) |
| Italians | 4 (3%) |
| Greeks | 3 (2%) |
| English people | 2 (2%) |
| Italian Americans | 2 (2%) |
| Japanese people | 2 (2%) |
| African Americans, French Canadians | 1 (1%) |
| African Americans, Nigerian Americans, Canadian Americans | 1 (1%) |
| American Jews | 1 (1%) |
| Dutch | 1 (1%) |
| Georgian Americans, Georgians | 1 (1%) |
| German Americans, Austrian Americans, Irish Americans, Dutch Americans, British Americans, White Americans | 1 (1%) |
| Indian Americans | 1 (1%) |
| Polish Americans | 1 (1%) |
| Spaniards | 1 (1%) |
| United States | 1 (1%) |
| Yoruba people | 1 (1%) |

## By domain

### architecture (16)

**Gender**

| Gender | Count |
|---|---|
| male | 12 (75%) |
| female | 3 (19%) |
| unknown/unstated | 1 (6%) |

**Ethnic group:** African Americans (2); unknown/unstated: 14

### art (10)

**Gender**

| Gender | Count |
|---|---|
| male | 9 (90%) |
| female | 1 (10%) |

**Ethnic group:** Italians (3), Dutch (1), Polish Americans (1); unknown/unstated: 5

### dance (11)

**Gender**

| Gender | Count |
|---|---|
| male | 7 (64%) |
| female | 4 (36%) |

**Ethnic group:** African Americans (2), African Americans, French Canadians (1), Georgian Americans, Georgians (1); unknown/unstated: 7

### fashion (8)

**Gender**

| Gender | Count |
|---|---|
| male | 7 (88%) |
| female | 1 (13%) |

**Ethnic group:** none stated; unknown/unstated: 8

### film (16)

**Gender**

| Gender | Count |
|---|---|
| male | 13 (81%) |
| female | 3 (19%) |

**Ethnic group:** Japanese people (2), American Jews (1), United States (1); unknown/unstated: 12

### literature (12)

**Gender**

| Gender | Count |
|---|---|
| male | 11 (92%) |
| female | 1 (8%) |

**Ethnic group:** African Americans (2), Greeks (2), English people (1), Italians (1), Spaniards (1); unknown/unstated: 5

### music (30)

**Gender**

| Gender | Count |
|---|---|
| male | 14 (47%) |
| female | 8 (27%) |
| unknown/unstated | 8 (27%) |

**Ethnic group:** African Americans (2), African Americans, Nigerian Americans, Canadian Americans (1), German Americans, Austrian Americans, Irish Americans, Dutch Americans, British Americans, White Americans (1), Italian Americans (1), Yoruba people (1); unknown/unstated: 24

### other (10)

**Gender**

| Gender | Count |
|---|---|
| male | 9 (90%) |
| female | 1 (10%) |

**Ethnic group:** English people (1), Greeks (1); unknown/unstated: 8

### television (13)

**Gender**

| Gender | Count |
|---|---|
| male | 11 (85%) |
| female | 2 (15%) |

**Ethnic group:** Indian Americans (1), Italian Americans (1); unknown/unstated: 11

## Data hygiene — human on Wikidata but kind != 'person' (5)

Included in the counts above. `scripts/classify-entities.mjs` would fix the kind.

- I. M. Pei (kind: other, architecture)
- Julia Morgan (kind: other, architecture)
- Norma Merrick Sklarek (kind: other, architecture)
- Paul R. Williams (kind: other, architecture)
- Frank Gehry (kind: other, other)

## Manual review — no Wikidata QID (9)

No guesses made for these; review by hand.

- Norman Foster (architecture)
- John Meyer (music)
- Kendrick Lamar (music)
- Miguel (music)
- Natti Natasha (music)
- Nora en Pure (music)
- Pusha T (music)
- Walker Hayes (music)
- ZAYN (music)

## Appendix — per subject

| Name | Domain | Gender | Ethnic group | Citizenship |
|---|---|---|---|---|
| Claude Nicolas Ledoux | architecture | male | unknown/unstated | France |
| Étienne-Louis Boullée | architecture | male | unknown/unstated | France |
| Eugène Viollet-le-Duc | architecture | male | unknown/unstated | France |
| Frank Lloyd Wright | architecture | male | unknown/unstated | United States |
| Henry Hobson Richardson | architecture | male | unknown/unstated | United States |
| I. M. Pei | architecture | male | unknown/unstated | United States, Taiwan |
| Joseph Paxton | architecture | male | unknown/unstated | United Kingdom of Great Britain and Ireland |
| Julia Morgan | architecture | female | unknown/unstated | United States |
| Karl Friedrich Schinkel | architecture | male | unknown/unstated | Kingdom of Prussia |
| Louis Kahn | architecture | male | unknown/unstated | Russian Empire, United States |
| Ludwig Mies van der Rohe | architecture | male | unknown/unstated | Germany, United States |
| Norma Merrick Sklarek | architecture | female | African Americans | United States |
| Norman Foster | architecture | unknown/unstated | unknown/unstated |  |
| Paul R. Williams | architecture | male | African Americans | United States |
| Tadao Ando | architecture | male | unknown/unstated | Japan |
| Zaha Hadid | architecture | female | unknown/unstated | United Kingdom, Iraq |
| Barnett Newman | art | male | Polish Americans | United States |
| Caravaggio | art | male | Italians | Duchy of Milan |
| Georges Braque | art | male | unknown/unstated | France |
| Helen Frankenthaler | art | female | unknown/unstated | United States |
| Johannes Vermeer | art | male | unknown/unstated | Dutch Republic |
| Leonardo da Vinci | art | male | unknown/unstated | Republic of Florence |
| Michelangelo | art | male | Italians | Republic of Florence |
| Raphael | art | male | Italians | Holy Roman Empire, Italy |
| Rembrandt | art | male | Dutch | Dutch Republic |
| Samuel Finley Breese Morse | art | male | unknown/unstated | United States |
| Alvin Ailey | dance | male | African Americans | United States |
| Bill T. Jones | dance | male | African Americans | United States |
| Bob Fosse | dance | male | unknown/unstated | United States |
| Fred Astaire | dance | male | unknown/unstated | United States |
| George Balanchine | dance | male | Georgian Americans, Georgians | Russian Empire, Soviet Union, France, United States |
| Jerome Robbins | dance | male | unknown/unstated | United States |
| Katherine Dunham | dance | female | African Americans, French Canadians | United States |
| Kitsou Dubois | dance | female | unknown/unstated | France |
| Martha Graham | dance | female | unknown/unstated | United States |
| Merce Cunningham | dance | male | unknown/unstated | United States |
| Pina Bausch | dance | female | unknown/unstated | Germany |
| Charles Frederick Worth | fashion | male | unknown/unstated | United Kingdom of Great Britain and Ireland, France |
| Christian Dior | fashion | male | unknown/unstated | France |
| Coco Chanel | fashion | female | unknown/unstated | France |
| Cristóbal Balenciaga | fashion | male | unknown/unstated | Spain |
| Issey Miyake | fashion | male | unknown/unstated | Japan, Empire of Japan |
| Marc Jacobs | fashion | male | unknown/unstated | United States |
| Paul Poiret | fashion | male | unknown/unstated | France |
| Ralph Lauren | fashion | male | unknown/unstated | United States |
| Akira Kurosawa | film | male | Japanese people | Empire of Japan, Japan |
| Alfred Hitchcock | film | male | unknown/unstated | United Kingdom, United States, United Kingdom of Great Britain and Ireland |
| Arthur Penn | film | male | unknown/unstated | United States |
| Brian De Palma | film | male | United States | United States |
| Chantal Akerman | film | female | unknown/unstated | Belgium, France |
| Federico Fellini | film | male | unknown/unstated | Italy |
| Guy Ritchie | film | male | unknown/unstated | United Kingdom |
| Hayao Miyazaki | film | male | Japanese people | Japan |
| Ingmar Bergman | film | male | unknown/unstated | Sweden |
| Jean Renoir | film | male | unknown/unstated | France |
| Jean-Luc Godard | film | male | unknown/unstated | France, Switzerland |
| Kathryn Bigelow | film | female | unknown/unstated | United States |
| Lucile Watson | film | female | unknown/unstated | Canada |
| Orson Welles | film | male | unknown/unstated | United States |
| Ridley Scott | film | male | unknown/unstated | United Kingdom |
| Stanley Kubrick | film | male | American Jews | United States, United Kingdom |
| Aristotle | literature | male | Greeks |  |
| Dante Alighieri | literature | male | Italians | Republic of Florence |
| Dr. Seuss | literature | male | unknown/unstated | United States |
| Geoffrey Chaucer | literature | male | English people | Kingdom of England |
| Homer | literature | male | Greeks | Ionian League |
| Langston Hughes | literature | male | African Americans | United States |
| Miguel de Cervantes | literature | male | Spaniards | Crown of Castile |
| Pablo Neruda | literature | male | unknown/unstated | Chile |
| Toni Morrison | literature | female | African Americans | United States |
| Virgil | literature | male | unknown/unstated | Ancient Rome |
| Walt Whitman | literature | male | unknown/unstated | United States |
| William Shakespeare | literature | male | unknown/unstated | Kingdom of England |
| Alex Warren | music | male | unknown/unstated | United States |
| Billie Holiday | music | female | African Americans | United States |
| Björk | music | female | unknown/unstated | Iceland |
| David Bowie | music | male | unknown/unstated | United Kingdom |
| David Guetta | music | male | unknown/unstated | France |
| Doechii | music | female | unknown/unstated | United States |
| Dolly Parton | music | female | unknown/unstated | United States |
| Fela Kuti | music | male | Yoruba people | Nigeria |
| Frank Sinatra | music | male | Italian Americans | United States, Italy |
| Jeff Buckley | music | male | unknown/unstated | United States |
| John Mayer | music | male | unknown/unstated | United States |
| John Meyer | music | unknown/unstated | unknown/unstated |  |
| Kali Uchis | music | female | unknown/unstated | United States |
| Keith Jarrett | music | male | unknown/unstated | United States |
| Kendrick Lamar | music | unknown/unstated | unknown/unstated |  |
| Lane 8 | music | male | unknown/unstated | United States |
| Lucky Daye | music | male | unknown/unstated | United States |
| Luke Bryan | music | male | unknown/unstated | United States |
| Miguel | music | unknown/unstated | unknown/unstated |  |
| Mitski | music | female | unknown/unstated | United States |
| Natti Natasha | music | unknown/unstated | unknown/unstated |  |
| Nora en Pure | music | unknown/unstated | unknown/unstated |  |
| Prince | music | male | African Americans | United States |
| Pusha T | music | unknown/unstated | unknown/unstated |  |
| Sabrina Carpenter | music | female | German Americans, Austrian Americans, Irish Americans, Dutch Americans, British Americans, White Americans | United States |
| Tove Lo | music | female | unknown/unstated | Sweden |
| Travis Scott | music | male | unknown/unstated | United States |
| Tyler, the Creator | music | male | African Americans, Nigerian Americans, Canadian Americans | United States |
| Walker Hayes | music | unknown/unstated | unknown/unstated |  |
| ZAYN | music | unknown/unstated | unknown/unstated |  |
| Frank Gehry | other | male | unknown/unstated | United States, Canada, Canada |
| Hannah Arendt | other | female | unknown/unstated | Prussia, statelessness, United States |
| Johannes Gutenberg | other | male | unknown/unstated | Holy Roman Empire |
| Laozi | other | male | unknown/unstated | Zhou dynasty |
| Plato | other | male | unknown/unstated | Classical Athens |
| Simón Bolívar | other | male | unknown/unstated | Spain, Venezuela, Ecuador, Bolivia, Gran Colombia |
| Socrates | other | male | Greeks | Classical Athens |
| Thomas Aquinas | other | male | unknown/unstated |  |
| Voltaire | other | male | unknown/unstated | France, Kingdom of France |
| William Blake | other | male | English people | United Kingdom of Great Britain and Ireland, Kingdom of Great Britain, United Kingdom |
| David Chase | television | male | Italian Americans | United States |
| David Simon | television | male | unknown/unstated | United States |
| Garry Marshall | television | male | unknown/unstated | United States |
| James L. Brooks | television | male | unknown/unstated | United States |
| Jesse Armstrong | television | male | unknown/unstated | United Kingdom |
| Julie Plec | television | female | unknown/unstated | United States |
| Matt Groening | television | male | unknown/unstated | United States |
| Matthew Weiner | television | male | unknown/unstated | United States |
| Mindy Kaling | television | female | Indian Americans | United States |
| Norman Lear | television | male | unknown/unstated | United States |
| Richard Pryor | television | male | unknown/unstated | United States |
| Steven Bochco | television | male | unknown/unstated | United States |
| Trey Parker | television | male | unknown/unstated | United States |
