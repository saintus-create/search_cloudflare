-- Correct the documents FTS update trigger and rebuild the external-content index.
DROP TRIGGER IF EXISTS documents_au;

CREATE TRIGGER documents_au AFTER UPDATE ON documents BEGIN
  INSERT INTO documents_fts(documents_fts, rowid, title, content)
    VALUES('delete', old.id, old.title, old.content);
  INSERT INTO documents_fts(rowid, title, content)
    VALUES (new.id, new.title, new.content);
END;

INSERT INTO documents_fts(documents_fts) VALUES('rebuild');
