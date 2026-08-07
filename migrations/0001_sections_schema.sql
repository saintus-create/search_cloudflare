-- Sections hierarchy schema

CREATE TABLE IF NOT EXISTS divisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  division_number TEXT NOT NULL UNIQUE,
  division_title TEXT
);

CREATE TABLE IF NOT EXISTS parts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  division_id INTEGER NOT NULL REFERENCES divisions(id),
  part_number TEXT NOT NULL,
  part_title TEXT
);

CREATE TABLE IF NOT EXISTS chapters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  part_id INTEGER NOT NULL REFERENCES parts(id),
  chapter_number TEXT NOT NULL,
  chapter_title TEXT
);

CREATE TABLE IF NOT EXISTS sections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chapter_id INTEGER NOT NULL REFERENCES chapters(id),
  part_id INTEGER NOT NULL REFERENCES parts(id),
  division_id INTEGER NOT NULL REFERENCES divisions(id),
  section_number TEXT NOT NULL,
  section_number_citation TEXT,
  section_text TEXT
);

CREATE TABLE IF NOT EXISTS section_subdivisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  section_id INTEGER NOT NULL REFERENCES sections(id),
  subdivision_label TEXT,
  subdivision_text TEXT
);

CREATE VIRTUAL TABLE IF NOT EXISTS sections_fts USING fts5(
  section_number,
  section_text,
  content='sections',
  content_rowid='id'
);

CREATE TRIGGER IF NOT EXISTS sections_ai AFTER INSERT ON sections BEGIN
  INSERT INTO sections_fts(rowid, section_number, section_text) VALUES (new.id, new.section_number, new.section_text);
END;

CREATE TRIGGER IF NOT EXISTS sections_ad AFTER DELETE ON sections BEGIN
  INSERT INTO sections_fts(sections_fts, rowid, section_number, section_text) VALUES('delete', old.id, old.section_number, old.section_text);
END;

CREATE TRIGGER IF NOT EXISTS sections_au AFTER UPDATE ON sections BEGIN
  INSERT INTO sections_fts(sections_fts, rowid, section_number, section_text) VALUES('delete', old.id, old.section_number, old.section_text);
  INSERT INTO sections_fts(rowid, section_number, section_text) VALUES (new.id, new.section_number, new.section_text);
END;
